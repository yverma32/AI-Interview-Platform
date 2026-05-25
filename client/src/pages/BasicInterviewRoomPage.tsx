import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Send, Bot } from 'lucide-react';
import { interviewService } from '../services/interviewService';
import type { InterviewStartResponse, AnswerResponse } from '../types/interview';
import { analytics } from '../services/analytics';
import './BasicInterviewRoom.css';

// Minimal local typing for the Web Speech API — TS lib.dom doesn't ship it.
interface SpeechRecognitionResultLike { transcript: string }
interface SpeechRecognitionResultGroup { 0: SpeechRecognitionResultLike; isFinal: boolean }
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultGroup>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type LocationState = { firstResponse?: InterviewStartResponse } | null;

/**
 * Text-mode interview room. The setup page primes us with the first question via router state;
 * we drive a simple Q&amp;A loop against /interview/{id}/answer. STT (when used) just transcribes
 * into the textarea — the actual exchange is always text on the wire.
 */
export default function BasicInterviewRoomPage() {
  const { sessionId: sessionIdParam } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const initial = (state as LocationState)?.firstResponse ?? null;

  const sessionId = Number(sessionIdParam);

  const [currentQuestion, setCurrentQuestion] = useState(initial?.message ?? '');
  const [currentTopic, setCurrentTopic] = useState<string | null>(initial?.topic ?? null);
  const [questionNumber, setQuestionNumber] = useState(initial?.questionNumber ?? 1);
  const totalQuestions = initial?.totalQuestions ?? 10;

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerBeforeSttRef = useRef('');

  // Bootstrap: if the page is hit directly (refresh), we have a sessionId but no first message.
  // Pull the session detail so the user can resume.
  useEffect(() => {
    if (initial || !sessionId) return;
    interviewService.getDetail(sessionId).then((detail) => {
      const lastInterviewer = [...detail.messages].reverse().find((m) => m.role === 'interviewer');
      if (lastInterviewer) {
        setCurrentQuestion(lastInterviewer.content);
        setCurrentTopic(lastInterviewer.questionTopic ?? null);
        setQuestionNumber(lastInterviewer.questionNumber ?? 1);
      }
      if (detail.status === 'Completed') setIsComplete(true);
    }).catch(() => setError('Unable to load interview.'));
  }, [initial, sessionId]);

  // Detect Web Speech API for the dictation button.
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    setSttSupported(true);
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      setAnswer(answerBeforeSttRef.current + (final ? final + ' ' : '') + interim);
      if (final) answerBeforeSttRef.current = answerBeforeSttRef.current + final + ' ';
    };
    recog.onend = () => setIsRecording(false);
    recog.onerror = () => setIsRecording(false);
    recognitionRef.current = recog;
    return () => recog.stop();
  }, []);

  const toggleRecording = () => {
    const recog = recognitionRef.current;
    if (!recog) return;
    if (isRecording) {
      recog.stop();
      setIsRecording(false);
      return;
    }
    answerBeforeSttRef.current = answer.endsWith(' ') || answer === '' ? answer : answer + ' ';
    try {
      recog.start();
      setIsRecording(true);
    } catch {
      // start() can throw if recognition is already in a weird state — just reset.
      setIsRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim() || submitting || isComplete) return;
    setSubmitting(true);
    setError(null);

    try {
      if (isRecording) recognitionRef.current?.stop();
      const result: AnswerResponse = await interviewService.submitAnswer(sessionId, { answer: answer.trim() });

      setAnswer('');
      answerBeforeSttRef.current = '';

      if (result.isComplete) {
        setIsComplete(true);
        analytics.interviewCompleted(result.overallScore ?? null, 0, totalQuestions);
        navigate(`/interview/results/${sessionId}`, { replace: true });
        return;
      }

      setCurrentQuestion(result.message);
      setCurrentTopic(result.topic ?? null);
      setQuestionNumber(result.questionNumber);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(apiMsg || 'Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbandon = async () => {
    if (!confirm('End this interview? Your progress will be saved but the interview will be marked abandoned.')) return;
    try {
      await interviewService.abandonInterview(sessionId);
    } catch {
      // best-effort
    }
    navigate('/dashboard');
  };

  const progressLabel = useMemo(
    () => `Q${questionNumber} of ${totalQuestions}`,
    [questionNumber, totalQuestions],
  );

  return (
    <div className="basic-room">
      <header className="basic-room-header">
        <button className="basic-back" onClick={handleAbandon}>End Interview</button>
        <div className="basic-room-title">
          <Bot size={18} aria-hidden />
          <span>Text Interview</span>
        </div>
        <div className="basic-room-progress">{progressLabel}</div>
      </header>

      <main className="basic-room-main">
        <section className="question-card">
          <div className="question-meta">
            {currentTopic && <span className="question-topic">{currentTopic}</span>}
          </div>
          <p className="question-text">{currentQuestion || 'Loading first question...'}</p>
        </section>

        <section className="answer-card">
          <label htmlFor="answer" className="answer-label">Your answer</label>
          <textarea
            id="answer"
            className="answer-textarea"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (!isRecording) answerBeforeSttRef.current = e.target.value;
            }}
            placeholder="Type your answer, or use the mic button to dictate..."
            rows={8}
            disabled={submitting || isComplete}
          />
          {error && <div className="answer-error">{error}</div>}
          <div className="answer-actions">
            {sttSupported && (
              <button
                type="button"
                className={`btn-mic${isRecording ? ' recording' : ''}`}
                onClick={toggleRecording}
                disabled={submitting || isComplete}
                title={isRecording ? 'Stop dictation' : 'Dictate answer'}
              >
                {isRecording ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
                {isRecording ? 'Stop' : 'Speak Answer'}
              </button>
            )}
            <button
              type="button"
              className="btn-submit"
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting || isComplete}
            >
              <Send size={16} aria-hidden />
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
