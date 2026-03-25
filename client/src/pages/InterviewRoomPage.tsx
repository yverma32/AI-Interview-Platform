import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { interviewService } from '../services/interviewService';
import type { InterviewStartResponse } from '../types/interview';
import './InterviewRoom.css';

type ConversationPhase = 'permission' | 'loading' | 'interviewer-speaking' | 'your-turn' | 'processing' | 'complete';

interface ChatBubble {
  id: number;
  role: 'interviewer' | 'candidate';
  text: string;
  score?: number | null;
  feedback?: string | null;
}

export default function InterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const bubbleIdRef = useRef(0);
  const autoSubmitLockRef = useRef(false);

  const { speak, stop: stopSpeaking, isSpeaking } = useSpeechSynthesis();

  // When user stays silent for 3s after speaking, stop listening and
  // populate the text input so they can review / edit before submitting.
  const [voiceDraftReady, setVoiceDraftReady] = useState(false);
  const handleSilenceTimeout = useCallback(() => {
    if (!autoSubmitLockRef.current) {
      autoSubmitLockRef.current = true;
      // Transfer transcript into editable text field
      transferVoiceDraftRef.current?.();
    }
  }, []);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSpeaking: userIsSpeaking,
    isSupported: sttSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ silenceTimeoutMs: 3500, onSilenceTimeout: handleSilenceTimeout });

  const [phase, setPhase] = useState<ConversationPhase>('permission');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);
  const [error, setError] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentInterviewerText, setCurrentInterviewerText] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Ref so silence callback can transfer transcript without stale closure
  const transferVoiceDraftRef = useRef<(() => void) | null>(null);
  // Track STT self-healing retry attempts
  const sttRetryRef = useRef(0);

  const addBubble = useCallback((role: ChatBubble['role'], text: string, score?: number | null, feedback?: string | null) => {
    bubbleIdRef.current += 1;
    const bubble: ChatBubble = { id: bubbleIdRef.current, role, text, score, feedback };
    setChatHistory((prev) => [...prev, bubble]);
    return bubble;
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, interimTranscript, transcript]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Interviewer speaks, then auto-start listening
  const interviewerSay = useCallback(
    async (message: string) => {
      setPhase('interviewer-speaking');
      setCurrentInterviewerText(message);
      addBubble('interviewer', message);

      try {
        await speak(message);
      } catch {
        // TTS failed, question still visible in chat
      }

      if (!isMountedRef.current) return;

      // Force-cancel any lingering TTS so the audio system fully releases the mic
      stopSpeaking();
      window.speechSynthesis.cancel();

      // Give Chrome enough time to release audio resources before starting STT
      await new Promise((r) => setTimeout(r, 500));
      if (!isMountedRef.current) return;

      // Auto-start listening after interviewer finishes speaking
      setPhase('your-turn');
      resetTranscript();
      autoSubmitLockRef.current = false;
      if (sttSupported && !useTextMode) {
        console.log('[InterviewRoom] Starting STT after TTS finished');
        startListening();
      } else {
        console.log('[InterviewRoom] Skipping STT: sttSupported=' + sttSupported + ', useTextMode=' + useTextMode);
      }
    },
    [speak, stopSpeaking, addBubble, resetTranscript, sttSupported, startListening, useTextMode]
  );

  // Submit answer — shared by silence-auto-submit and manual submit
  const submitAnswer = useCallback(
    async (answerText: string) => {
      if (!answerText.trim()) return;

      stopListening();
      stopSpeaking();
      setError('');
      setPhase('processing');

      addBubble('candidate', answerText.trim());

      try {
        const response = await interviewService.submitAnswer(Number(sessionId), { answer: answerText.trim() });
        if (!isMountedRef.current) return;

        if (response.isComplete) {
          setPhase('complete');
          clearInterval(timerRef.current);
          addBubble('interviewer', response.message);
          setCurrentInterviewerText(response.message);
          try { await speak(response.message); } catch { /* ok */ }
          setTimeout(() => {
            if (isMountedRef.current) navigate(`/interview/results/${sessionId}`);
          }, 3000);
        } else {
          setQuestionNumber(response.questionNumber);
          resetTranscript();
          setTextInput('');
          setVoiceDraftReady(false);
          autoSubmitLockRef.current = false;
          await interviewerSay(response.message);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e.response?.data?.message || e.message || 'Failed to submit answer.');
        setPhase('your-turn');
        autoSubmitLockRef.current = false;
        if (sttSupported && !useTextMode) startListening();
      }
    },
    [sessionId, stopListening, stopSpeaking, addBubble, speak, navigate, resetTranscript, interviewerSay, sttSupported, startListening, useTextMode]
  );

  // Wire up silence-timeout ref — transfer transcript to text input for editing
  useEffect(() => {
    transferVoiceDraftRef.current = () => {
      const answer = (transcript + ' ' + interimTranscript).trim();
      if (answer) {
        stopListening();
        setTextInput(answer);
        setVoiceDraftReady(true);
      }
    };
  }, [transcript, interimTranscript, stopListening]);

  // Request mic permission and start interview — called from user click
  const requestMicAndStart = useCallback(async () => {
    // Request microphone permission via getUserMedia (requires user gesture)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately — we just needed the permission grant
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
    } catch {
      // Permission denied — fall back to text mode
      console.warn('[MIC] Permission denied, falling back to text mode');
      setUseTextMode(true);
    }

    // Now start the interview
    const initialData = location.state as InterviewStartResponse | null;
    if (initialData) {
      setQuestionNumber(initialData.questionNumber);
      setTotalQuestions(initialData.totalQuestions);
      await interviewerSay(initialData.message);
    } else {
      setPhase('loading');
      setError('No interview data. Please start from the setup page.');
    }
  }, [location.state, interviewerSay]);

  // Auto-detect if speech not supported → text mode
  useEffect(() => {
    if (!sttSupported) setUseTextMode(true);
  }, [sttSupported]);

  // Self-healing: if phase is 'your-turn' in voice mode but STT isn't listening,
  // automatically retry with increasing delays. After max retries, fall back to text mode.
  useEffect(() => {
    if (phase !== 'your-turn') {
      sttRetryRef.current = 0;
      return;
    }
    if (useTextMode || isListening) return;

    // STT should be listening but isn't — schedule a retry
    const attempt = sttRetryRef.current;
    const delay = attempt === 0 ? 800 : 1500;
    const retryTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      sttRetryRef.current += 1;
      if (sttRetryRef.current > 4) {
        // Give up — switch to text mode so user can still answer
        console.warn('[STT] Self-healing exhausted after ' + sttRetryRef.current + ' attempts, switching to text mode');
        setUseTextMode(true);
        setError('Microphone not responding. Switched to text input — type your answer below.');
        return;
      }
      console.log('[STT] Self-healing attempt #' + sttRetryRef.current);
      window.speechSynthesis.cancel();
      startListening();
    }, delay);
    return () => clearTimeout(retryTimer);
  }, [phase, useTextMode, isListening, startListening]);

  // Manual submit — always uses the text input field now
  const handleManualSubmit = () => {
    const answer = textInput.trim() || (transcript + ' ' + interimTranscript).trim();
    if (!answer) {
      setError('Please provide an answer first.');
      return;
    }
    autoSubmitLockRef.current = true;
    setVoiceDraftReady(false);
    submitAnswer(answer);
  };

  // Re-record: clear the voice draft and start listening again
  const handleReRecord = () => {
    setTextInput('');
    setVoiceDraftReady(false);
    resetTranscript();
    autoSubmitLockRef.current = false;
    startListening();
  };

  // Handle text mode submit on Enter
  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleManualSubmit();
    }
  };

  const handleSkip = () => {
    autoSubmitLockRef.current = true;
    submitAnswer('I would like to skip this question.');
  };

  const handleEndInterview = () => {
    stopSpeaking();
    stopListening();
    clearInterval(timerRef.current);
    navigate('/dashboard');
  };

  const progress = ((questionNumber - 1) / totalQuestions) * 100;
  const fullTranscript = (transcript + ' ' + interimTranscript).trim();

  if (phase === 'loading' && error) {
    return (
      <div className="iv-room">
        <div className="iv-error-screen">
          <p>{error}</p>
          <button onClick={() => navigate('/interview/setup')}>Go to Setup</button>
        </div>
      </div>
    );
  }

  // Permission gate — requires a user click to grant mic access
  if (phase === 'permission') {
    return (
      <div className="iv-room">
        <div className="iv-permission-screen">
          <div className="iv-perm-card">
            <div className="iv-perm-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h2>Ready to begin your interview?</h2>
            <p>Click below to allow microphone access and start the interview with Alex.</p>
            <button className="iv-perm-btn" onClick={requestMicAndStart}>
              Start Interview
            </button>
            <button className="iv-perm-skip" onClick={() => { setUseTextMode(true); requestMicAndStart(); }}>
              Use text input instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iv-room">
      {/* ── Video Call Top Bar ── */}
      <div className="iv-topbar">
        <div className="iv-topbar-left">
          <div className="iv-call-indicator" />
          <span className="iv-call-label">Interview in progress</span>
        </div>
        <div className="iv-topbar-center">
          <span className="iv-q-counter">Question {questionNumber} of {totalQuestions}</span>
        </div>
        <div className="iv-topbar-right">
          <span className="iv-timer">{formatTime(elapsedTime)}</span>
          <button className="iv-end-call" onClick={handleEndInterview} title="End Interview">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.09 12.79 19.79 19.79 0 0 1 2.02 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path><line x1="1" y1="1" x2="23" y2="23" stroke="#ef4444" strokeWidth="2.5"></line></svg>
          </button>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className="iv-progress-track">
        <div className="iv-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Main Video Call Layout ── */}
      <div className="iv-body">
        {/* Interviewer Video Feed (simulated) */}
        <div className={`iv-interviewer-panel ${phase === 'interviewer-speaking' || isSpeaking ? 'speaking' : ''} ${phase === 'processing' ? 'thinking' : ''}`}>
          <div className="iv-interviewer-video">
            {/* Professional avatar */}
            <div className="iv-avatar">
              <div className="iv-avatar-head" />
              <div className="iv-avatar-body" />
              {/* Voice visualizer rings */}
              <div className="iv-voice-rings">
                <div className="iv-ring iv-ring-1" />
                <div className="iv-ring iv-ring-2" />
                <div className="iv-ring iv-ring-3" />
              </div>
            </div>
            <div className="iv-interviewer-name">
              <span className="iv-name">Alex</span>
              <span className="iv-role">Senior Interviewer</span>
            </div>
            {/* Status indicator */}
            <div className="iv-interviewer-status">
              {phase === 'interviewer-speaking' || isSpeaking ? (
                <span className="iv-status speaking">Speaking...</span>
              ) : phase === 'processing' ? (
                <span className="iv-status thinking">
                  <span className="iv-dot-1">·</span>
                  <span className="iv-dot-2">·</span>
                  <span className="iv-dot-3">·</span>
                  Evaluating
                </span>
              ) : phase === 'your-turn' ? (
                <span className="iv-status listening-to-you">Listening to you</span>
              ) : phase === 'complete' ? (
                <span className="iv-status done">Interview Complete</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="iv-conversation">
          <div className="iv-chat-scroll">
            {chatHistory.map((bubble) => (
              <div key={bubble.id} className={`iv-bubble iv-bubble-${bubble.role}`}>
                <div className="iv-bubble-avatar">
                  {bubble.role === 'interviewer' ? (
                    <div className="iv-mini-avatar interviewer" />
                  ) : (
                    <div className="iv-mini-avatar you">You</div>
                  )}
                </div>
                <div className="iv-bubble-content">
                  <p>{bubble.text}</p>
                  {bubble.score != null && bubble.feedback && (
                    <div className={`iv-inline-feedback ${bubble.score >= 7 ? 'good' : bubble.score >= 5 ? 'ok' : 'weak'}`}>
                      <span className="iv-fb-score">{bubble.score}/10</span>
                      <span className="iv-fb-text">{bubble.feedback}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Live typing indicator — what you're saying right now */}
            {phase === 'your-turn' && !useTextMode && fullTranscript && (
              <div className="iv-bubble iv-bubble-candidate iv-bubble-live">
                <div className="iv-bubble-avatar">
                  <div className="iv-mini-avatar you">You</div>
                </div>
                <div className="iv-bubble-content">
                  <p>
                    {transcript}
                    {interimTranscript && <span className="iv-interim">{interimTranscript}</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {phase === 'processing' && (
              <div className="iv-thinking-indicator">
                <div className="iv-thinking-dots">
                  <span /><span /><span />
                </div>
                <span className="iv-thinking-text">Alex is preparing the next question...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Your status / input area at the bottom */}
          <div className="iv-your-area">
            {phase === 'your-turn' && !useTextMode && !voiceDraftReady && (
              <div
                className={`iv-mic-status ${isListening ? (userIsSpeaking ? 'active-speaking' : 'active-idle') : 'off'}`}
                onClick={() => {
                  if (!isListening) {
                    // Cancel any lingering TTS that might block the mic
                    window.speechSynthesis.cancel();
                    resetTranscript();
                    startListening();
                  }
                }}
                style={{ cursor: isListening ? 'default' : 'pointer' }}
              >
                <div className="iv-mic-ring">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <div className="iv-mic-info">
                  {userIsSpeaking ? (
                    <span className="iv-mic-label">Listening to you...</span>
                  ) : isListening && fullTranscript ? (
                    <span className="iv-mic-label fading">Waiting for you to finish speaking...</span>
                  ) : isListening ? (
                    <span className="iv-mic-label">Go ahead, I'm listening...</span>
                  ) : (
                    <span className="iv-mic-label tap-prompt">Tap here to activate microphone</span>
                  )}
                  {/* Voice level bars */}
                  <div className="iv-voice-bars">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="iv-vbar" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Voice draft editing — review / edit transcribed answer before submitting */}
            {phase === 'your-turn' && !useTextMode && voiceDraftReady && (
              <div className="iv-text-input-area">
                <label className="iv-voice-draft-label">Review &amp; edit your answer, then submit:</label>
                <textarea
                  className="iv-text-input"
                  placeholder="Edit your answer..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                  rows={3}
                  autoFocus
                />
                <div className="iv-voice-draft-actions">
                  <button className="iv-ctrl-btn" onClick={handleReRecord} title="Re-record with voice">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                    <span>Re-record</span>
                  </button>
                  <button className="iv-send-btn" onClick={handleManualSubmit} disabled={!textInput.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </div>
              </div>
            )}

            {phase === 'your-turn' && useTextMode && (
              <div className="iv-text-input-area">
                <textarea
                  className="iv-text-input"
                  placeholder="Type your answer and press Enter..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                  rows={2}
                  autoFocus
                />
                <button className="iv-send-btn" onClick={handleManualSubmit} disabled={!textInput.trim()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            )}

            {phase === 'interviewer-speaking' && (
              <div className="iv-mic-status off">
                <div className="iv-mic-ring">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <span className="iv-mic-label muted">Alex is speaking — your mic will activate after</span>
              </div>
            )}

            {/* Minimal control strip */}
            {phase !== 'complete' && (
              <div className="iv-controls-strip">
                {sttSupported && (
                  <button className="iv-ctrl-btn" onClick={() => setUseTextMode(!useTextMode)} title={useTextMode ? 'Switch to voice' : 'Switch to text'}>
                    {useTextMode ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
                    )}
                    <span>{useTextMode ? 'Voice' : 'Text'}</span>
                  </button>
                )}

                {phase === 'your-turn' && !useTextMode && !voiceDraftReady && fullTranscript && (
                  <button className="iv-ctrl-btn submit" onClick={() => { stopListening(); setTextInput(fullTranscript); setVoiceDraftReady(true); autoSubmitLockRef.current = true; }} title="Done speaking — review answer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Done</span>
                  </button>
                )}

                <button className="iv-ctrl-btn skip" onClick={handleSkip} disabled={phase === 'processing' || phase === 'interviewer-speaking'} title="Skip question">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
                  <span>Skip</span>
                </button>
              </div>
            )}

            {error && <div className="iv-error">{error}</div>}
          </div>
        </div>
      </div>

      {/* Complete overlay */}
      {phase === 'complete' && (
        <div className="iv-complete-overlay">
          <div className="iv-complete-card">
            <div className="iv-complete-check">✓</div>
            <h2>Interview Complete</h2>
            <p>Great job! Redirecting to your results...</p>
          </div>
        </div>
      )}
    </div>
  );
}
