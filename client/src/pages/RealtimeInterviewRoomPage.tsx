import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LiveWaveform from '../components/LiveWaveform';
import TranscriptPanel from '../components/TranscriptPanel';
import LiveScoreCard from '../components/LiveScoreCard';
import InterviewTimer from '../components/InterviewTimer';
import CodeEditorPanel from '../components/CodeEditorPanel';
import { realtimeService } from '../services/realtimeService';
import { analytics } from '../services/analytics';
import type {
  CreateRealtimeSessionRequest,
  CreateRealtimeSessionResponse,
  HiringRecommendation,
  QuestionScore,
  RealtimeStatus,
  TranscriptEntry,
} from '../types/realtime';
import './RealtimeInterviewRoom.css';

/**
 * The setup page navigates here with a session config in router state. We mint an ephemeral
 * OpenAI Realtime key from our backend, then open a WebRTC connection straight to OpenAI.
 * The .NET backend never touches the audio stream — it only sees tool-call events the client
 * forwards (per-question scores, end-of-interview summary).
 */
type SetupState = CreateRealtimeSessionRequest;

// GA endpoint (May 2026): WebRTC SDP exchange happens at /v1/realtime/calls.
// The model is now baked into the ephemeral session, so no ?model= query string.
const REALTIME_SDP_URL = 'https://api.openai.com/v1/realtime/calls';

export default function RealtimeInterviewRoomPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const setup = location.state as SetupState | null;

  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CreateRealtimeSessionResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [streamingAIText, setStreamingAIText] = useState<string>('');
  const [scores, setScores] = useState<QuestionScore[]>([]);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);

  // Code editor state (driven by the request_code_input tool call).
  const [codeEditor, setCodeEditor] = useState<{
    open: boolean;
    callId: string;
    language: string;
    prompt: string;
    starterCode?: string;
  }>({ open: false, callId: '', language: 'javascript', prompt: '' });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const completedRef = useRef(false);

  // Watchdog: tracks whether the AI is currently generating a response. If a candidate finishes
  // speaking and we don't see a response.created within 5 seconds, we nudge the AI with an explicit
  // response.create. This rescues sessions where the semantic VAD's auto-response got skipped
  // (happens occasionally after several turns or after a tool-call round).
  const responseActiveRef = useRef(false);
  const lastUserSpeechAtRef = useRef<number>(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleResponseWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== 'open') return;
      if (responseActiveRef.current) return; // AI is already responding
      // 5s elapsed since user stopped speaking and no response started — kick it.
      // eslint-disable-next-line no-console
      console.warn('[Realtime] watchdog: no response after speech, forcing response.create');
      dc.send(JSON.stringify({ type: 'response.create' }));
    }, 5000);
  }, []);

  // Keep the latest values available inside async event handlers without re-binding effects.
  const sessionRef = useRef<CreateRealtimeSessionResponse | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { startedAtRef.current = startedAt; }, [startedAt]);

  // ───────────── Bootstrap: mint key, open WebRTC ─────────────

  useEffect(() => {
    if (!setup) {
      setError('Missing interview setup. Please start from the setup page.');
      setStatus('error');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatus('connecting');

        const sess = await realtimeService.createSession(setup);
        if (cancelled) return;

        // Defence in depth: the ephemeral key has a ~60s window. If for any reason we'd be racing
        // the expiry (slow mic prompt, sluggish SDP exchange), abort early so the user gets a clean
        // retry instead of a cryptic 401 from OpenAI.
        const expiresAt = new Date(sess.expiresAt).getTime();
        const msUntilExpiry = expiresAt - Date.now();
        if (msUntilExpiry < 5000) {
          throw new Error('Session token expired before we could connect. Please try again.');
        }

        setSession(sess);

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // Monitor connection health so we can see degradations in DevTools instead of just
        // wondering why the AI stopped responding mid-interview.
        pc.oniceconnectionstatechange = () => {
          // eslint-disable-next-line no-console
          console.debug('[Realtime] ICE state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            // eslint-disable-next-line no-console
            console.warn('[Realtime] ICE connection degraded:', pc.iceConnectionState);
          }
        };
        pc.onconnectionstatechange = () => {
          // eslint-disable-next-line no-console
          console.debug('[Realtime] PC state:', pc.connectionState);
        };

        // Capture mic
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          micStream.getTracks().forEach(t => t.stop());
          return;
        }
        micStreamRef.current = micStream;
        micStream.getTracks().forEach(t => pc.addTrack(t, micStream));

        // Wire up remote audio
        pc.ontrack = (e) => {
          remoteStreamRef.current = e.streams[0];
          if (audioElRef.current) audioElRef.current.srcObject = e.streams[0];
        };

        // Open data channel for events + tool calls
        const dc = pc.createDataChannel('oai-events');
        dcRef.current = dc;
        dc.onmessage = (e) => handleRealtimeEvent(JSON.parse(e.data));
        dc.onopen = () => {
          setStatus('active');
          setStartedAt(Date.now());
          // Trigger the AI to greet the candidate and ask the first question. Semantic VAD only
          // creates responses after speech is detected, so without this kickoff the session sits
          // silent forever waiting for the user to speak first.
          dc.send(JSON.stringify({
            type: 'response.create',
            response: { instructions: 'Greet the candidate warmly and ask your first interview question.' },
          }));
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResp = await fetch(REALTIME_SDP_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sess.clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        });

        if (!sdpResp.ok) {
          throw new Error(`OpenAI SDP exchange failed: ${sdpResp.status}`);
        }

        const answerSdp = await sdpResp.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to connect to the interviewer.';
        setError(msg);
        setStatus('error');
        analytics.realtimeConnectionFailed(msg);
        cleanup();
      }
    })();

    return () => {
      cancelled = true;
      // Cleanup runs both on unmount and on completion via the explicit cleanup() call.
      cleanup();
    };
    // We deliberately bootstrap once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────── Realtime event handling ─────────────

  const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;

    switch (type) {
      case 'session.created':
        // Connection acknowledged.
        break;

      case 'input_audio_buffer.speech_started':
        setStatus('user_speaking');
        lastUserSpeechAtRef.current = Date.now();
        // Cancel any prior watchdog — user is mid-utterance.
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        break;

      case 'input_audio_buffer.speech_stopped':
        setStatus('ai_thinking');
        // Arm the watchdog: if no response.created in 5s, force one.
        scheduleResponseWatchdog();
        break;

      // Streaming AI transcript chunks. Beta used `response.audio_transcript.*`; GA renamed to
      // `response.output_audio_transcript.*`. Some intermediate builds also emit `response.output_audio.transcript.*`.
      // Handle all three so we don't silently miss the agent's words.
      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
      case 'response.output_audio.transcript.delta': {
        const delta = event.delta as string | undefined;
        if (delta) setStreamingAIText((prev) => prev + delta);
        setStatus('ai_speaking');
        break;
      }

      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done':
      case 'response.output_audio.transcript.done': {
        const text = event.transcript as string | undefined;
        if (text) {
          setTranscript((prev) => [
            ...prev,
            { role: 'interviewer', content: text, timestamp: new Date().toISOString() },
          ]);
        }
        setStreamingAIText('');
        // A finished question is a new question. Don't rely on score_answer to advance the counter,
        // because follow-ups within the same question won't bump it. See Issue 3 fix below.
        break;
      }

      case 'conversation.item.input_audio_transcription.completed':
      case 'conversation.item.input_audio_transcription.delta': {
        const text = (event.transcript ?? event.delta) as string | undefined;
        if (text && type.endsWith('.completed')) {
          setTranscript((prev) => [
            ...prev,
            { role: 'candidate', content: text, timestamp: new Date().toISOString() },
          ]);
        }
        break;
      }

      case 'response.function_call_arguments.done':
        handleToolCall(event);
        break;

      case 'response.created':
        // AI started responding — disarm the watchdog.
        responseActiveRef.current = true;
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
        break;

      case 'response.done': {
        responseActiveRef.current = false;
        setStatus('active');
        // Diagnostic: surface truncated or failed responses that don't trigger 'error'.
        const resp = event.response as { status?: string; status_details?: unknown } | undefined;
        if (resp?.status && resp.status !== 'completed' && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[Realtime] response ended with status:', resp.status, resp.status_details);
        }
        break;
      }

      case 'response.cancelled':
      case 'response.failed':
        responseActiveRef.current = false;
        setStatus('active');
        // eslint-disable-next-line no-console
        console.warn('[Realtime] response did not complete:', type, event);
        break;

      case 'error': {
        const errEvent = event.error as { message?: string; code?: string } | undefined;
        // eslint-disable-next-line no-console
        console.error('[Realtime] error event:', errEvent);
        // Non-fatal errors (rate limit, individual response failure) shouldn't kill the session.
        // Only mark the whole interview as errored for connection-level failures.
        const code = errEvent?.code ?? '';
        if (code.includes('session') || code.includes('connection')) {
          setError(errEvent?.message || 'Realtime error');
          setStatus('error');
        }
        break;
      }

      default: {
        // GA event names shift over time. Log unhandled events in dev so we can spot renames fast.
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[Realtime] unhandled event', type, event);
        }
        break;
      }
    }
    // sessionRef/transcriptRef carry latest state into async handlers below.
  }, []);

  const handleToolCall = useCallback((event: Record<string, unknown>) => {
    const name = event.name as string;
    const callId = event.call_id as string;
    const argsJson = event.arguments as string;
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(argsJson); } catch { /* ignore */ }

    const sess = sessionRef.current;
    if (!sess) return;

    if (name === 'score_answer') {
      const score: QuestionScore = {
        questionNumber: Number(args.question_number ?? questionNumber),
        topic: String(args.topic ?? ''),
        score: Number(args.score ?? 0),
        feedback: String(args.feedback ?? ''),
      };
      setScores((prev) => [...prev, score]);
      setCurrentTopic(score.topic);
      setQuestionNumber(score.questionNumber + 1);

      realtimeService.scoreAnswer(sess.sessionId, {
        question: String(args.question ?? ''),
        answer: String(args.answer ?? ''),
        topic: score.topic,
        score: score.score,
        feedback: score.feedback,
        followUpAsked: Boolean(args.follow_up_asked),
        questionNumber: score.questionNumber,
      }).catch(() => { /* best-effort — completeSession will still capture state */ });

      sendToolOutput(callId, { success: true });
    } else if (name === 'flag_weak_topic') {
      // No-op for Phase 3 — we'll aggregate this in Phase 6's progress dashboard.
      sendToolOutput(callId, { acknowledged: true });
    } else if (name === 'end_interview') {
      sendToolOutput(callId, { acknowledged: true });
      finalizeInterview({
        overallScore: Number(args.overall_score),
        overallFeedback: String(args.overall_feedback ?? ''),
        strengths: Array.isArray(args.strengths) ? (args.strengths as string[]) : undefined,
        improvements: Array.isArray(args.improvements) ? (args.improvements as string[]) : undefined,
        hiringRecommendation: args.hiring_recommendation as HiringRecommendation | undefined,
      });
    } else if (name === 'request_code_input') {
      // Open the editor on screen. We DON'T send the tool output yet — we wait for the candidate
      // to submit their code, then the submit handler sends both the code (as a user message)
      // and the tool output.
      setCodeEditor({
        open: true,
        callId,
        language: String(args.language ?? 'javascript'),
        prompt: String(args.prompt ?? 'Write your code below.'),
        starterCode: typeof args.starter_code === 'string' ? args.starter_code : undefined,
      });
    }
  }, [questionNumber]);

  const handleCodeSubmit = useCallback((code: string, submittedLanguage: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;

    // 1. Send the code as a user conversation item so the AI can read and evaluate it.
    //    Use the language the candidate actually chose, not the AI's original suggestion.
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: `Here is my code (${submittedLanguage}):\n\n\`\`\`${submittedLanguage}\n${code}\n\`\`\`` }],
      },
    }));

    // 2. Add to local transcript so the candidate sees what they submitted.
    setTranscript((prev) => [
      ...prev,
      {
        role: 'candidate',
        content: `[code submitted: ${code.split('\n').length} lines of ${submittedLanguage}]`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // 3. Complete the request_code_input tool call so the AI can proceed.
    sendToolOutput(codeEditor.callId, { submitted: true, code_length: code.length, language: submittedLanguage });

    // 4. Close the editor.
    setCodeEditor((s) => ({ ...s, open: false }));
  }, [codeEditor.callId]);

  const handleCodeCancel = useCallback(() => {
    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      // Tell the AI the candidate skipped. AI can decide to offer a hint or move on.
      sendToolOutput(codeEditor.callId, { submitted: false, reason: 'candidate_cancelled' });
    }
    setCodeEditor((s) => ({ ...s, open: false }));
  }, [codeEditor.callId]);

  const sendToolOutput = (callId: string, output: unknown) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    }));
    dc.send(JSON.stringify({ type: 'response.create' }));
  };

  const finalizeInterview = useCallback(async (summary: {
    overallScore?: number;
    overallFeedback?: string;
    strengths?: string[];
    improvements?: string[];
    hiringRecommendation?: HiringRecommendation;
  }) => {
    if (completedRef.current) return;
    completedRef.current = true;

    const sess = sessionRef.current;
    if (!sess) return;

    const startedAtMs = startedAtRef.current ?? Date.now();
    const duration = Math.floor((Date.now() - startedAtMs) / 1000);

    try {
      await realtimeService.completeSession(sess.sessionId, {
        transcript: transcriptRef.current,
        durationSeconds: duration,
        ...summary,
      });
    } catch { /* swallow — we still want to navigate to results */ }

    analytics.interviewCompleted(
      summary.overallScore ?? null,
      duration,
      transcriptRef.current.filter((e) => e.role === 'candidate').length,
    );

    setStatus('ended');
    cleanup();
    navigate(`/interview/results/${sess.sessionId}`);
  }, [navigate]);

  // ───────────── Cleanup ─────────────

  const cleanup = useCallback(() => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => { try { s.track?.stop(); } catch { /* */ } });
    pcRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    micStreamRef.current = null;
  }, []);

  // Manual end button. We don't finalize immediately — we ask the AI to call end_interview with
  // whatever scores it has so far, so the results page shows a real summary. If the AI doesn't
  // respond within 8 seconds, we finalize anyway with a synthesized summary from per-question scores.
  const handleEnd = useCallback(async () => {
    if (completedRef.current) return;

    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      setStatus('ai_thinking');
      dc.send(JSON.stringify({
        type: 'response.create',
        response: {
          instructions:
            'The candidate has chosen to end the interview early. Immediately call end_interview with overall_score, 3 strengths, 3 improvements, and a hiring_recommendation based on what you have heard so far. Do not ask any more questions.',
        },
      }));

      // Race: if end_interview fires within 8s, finalizeInterview() will be called from the tool
      // handler and completedRef will guard against double-finalize. Otherwise we synthesize.
      setTimeout(() => {
        if (completedRef.current) return;
        const localScores = scores;
        const avg = localScores.length > 0
          ? localScores.reduce((s, q) => s + q.score, 0) / localScores.length
          : undefined;
        finalizeInterview({
          overallScore: avg,
          overallFeedback: localScores.length > 0
            ? `Interview ended early after ${localScores.length} scored question${localScores.length === 1 ? '' : 's'}. Average score: ${avg!.toFixed(1)}/10.`
            : 'Interview ended before any questions were scored.',
        });
      }, 8000);
    } else {
      // No live connection — just finalize with what we have.
      await finalizeInterview({});
    }
  }, [scores, finalizeInterview]);

  // ───────────── Render ─────────────

  if (status === 'error') {
    return (
      <div className="realtime-room realtime-error">
        <h2>Interview couldn't start</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/interview/setup')}>Back to setup</button>
      </div>
    );
  }

  const waveformMode =
    status === 'ai_speaking' ? 'ai' :
    status === 'user_speaking' ? 'user' :
    'idle';
  const waveformStream =
    waveformMode === 'ai' ? remoteStreamRef.current :
    waveformMode === 'user' ? micStreamRef.current :
    null;

  const statusLabel: Record<RealtimeStatus, string> = {
    idle: 'Ready',
    connecting: 'Connecting…',
    active: 'Listening',
    ai_speaking: `${session?.personaName ?? 'Interviewer'} is speaking`,
    user_speaking: 'You are speaking',
    ai_thinking: 'Thinking…',
    ended: 'Interview complete',
    error: 'Error',
  };

  return (
    <div className="realtime-room">
      {/* playsInline is required on iOS Safari — without it autoplay is silently blocked */}
      <audio ref={audioElRef} autoPlay playsInline />

      <header className="realtime-header">
        <div>
          <h1>{session?.personaName ?? 'Interviewer'}</h1>
          <p className="realtime-subtitle">
            {setup?.roundType?.replace('_', ' ')} · {setup?.technology} · {setup?.experienceLevel}
          </p>
        </div>
        <div className="realtime-header-right">
          <InterviewTimer startedAt={startedAt} />
          <button className="end-btn" onClick={handleEnd} disabled={status === 'connecting'}>
            End interview
          </button>
        </div>
      </header>

      <div className="realtime-main">
        <div className="realtime-left">
          <div className={`realtime-status realtime-status-${status}`}>
            {statusLabel[status]}
          </div>
          <LiveWaveform stream={waveformStream} mode={waveformMode} />
          <p className="bargein-hint">Tip: you can interrupt the interviewer at any time — just start talking.</p>
        </div>
        <aside className="realtime-right">
          <LiveScoreCard
            scores={scores}
            totalQuestions={setup?.totalQuestions ?? 10}
            currentTopic={currentTopic}
            questionNumber={Math.min(questionNumber, setup?.totalQuestions ?? 10)}
          />
        </aside>
      </div>

      <section className="realtime-transcript">
        <h3>Transcript</h3>
        <TranscriptPanel
          entries={transcript}
          streamingAIText={streamingAIText}
          personaName={session?.personaName ?? 'Interviewer'}
        />
      </section>

      <CodeEditorPanel
        open={codeEditor.open}
        language={codeEditor.language}
        prompt={codeEditor.prompt}
        starterCode={codeEditor.starterCode}
        onSubmit={handleCodeSubmit}
        onClose={handleCodeCancel}
      />
    </div>
  );
}
