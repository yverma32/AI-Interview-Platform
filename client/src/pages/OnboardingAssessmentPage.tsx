import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboardingService, type AssessmentQuestion, type AssessmentResult } from '../services/onboardingService';
import { analytics } from '../services/analytics';
import './OnboardingAssessment.css';

const DURATION_SECONDS = 15 * 60;

export default function OnboardingAssessmentPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'loading' | 'in_progress' | 'submitting' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SECONDS);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    onboardingService.createAssessment().then((set) => {
      if (cancelled) return;
      setAssessmentId(set.assessmentId);
      setQuestions(set.questions);
      setPhase('in_progress');
    }).catch((e) => {
      if (cancelled) return;
      setError(e?.response?.data?.message ?? 'Failed to start assessment.');
      setPhase('error');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== 'in_progress') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          handleSubmit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSubmit = async () => {
    if (!assessmentId) return;
    setPhase('submitting');
    try {
      const payload = Object.entries(answers).map(([qid, idx]) => ({
        questionId: Number(qid),
        selectedIndex: idx,
      }));
      const res = await onboardingService.submit(assessmentId, payload);
      setResult(res);
      setPhase('done');
      analytics.onboardingCompleted(res.skillLevel, res.recommendedCompanyTrack, res.score);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? 'Submission failed.');
      setPhase('error');
    }
  };

  if (phase === 'loading') return <div className="onboarding-page"><p>Preparing your assessment…</p></div>;
  if (phase === 'error') return (
    <div className="onboarding-page">
      <h2>Something went wrong</h2>
      <p>{error}</p>
      <button onClick={() => navigate('/dashboard')}>Back to dashboard</button>
    </div>
  );
  if (phase === 'done' && result) {
    return (
      <div className="onboarding-page">
        <h1>Your Skill Profile</h1>
        <div className="result-card">
          <div className="result-row">
            <span>Score</span>
            <strong>{result.score} / {result.total}</strong>
          </div>
          <div className="result-row">
            <span>Skill level</span>
            <strong className={`level-${result.skillLevel}`}>{result.skillLevel}</strong>
          </div>
          <div className="result-row">
            <span>Recommended track</span>
            <strong>{result.recommendedCompanyTrack.toUpperCase()}</strong>
          </div>
          {result.strongTopics.length > 0 && (
            <div className="result-topics">
              <h4>Strengths</h4>
              <ul>{result.strongTopics.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          {result.weakTopics.length > 0 && (
            <div className="result-topics">
              <h4>Practice these</h4>
              <ul>{result.weakTopics.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </div>
        <button className="primary-btn" onClick={() => navigate('/interview/setup')}>Start your first interview →</button>
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <h1>Skill Assessment</h1>
        <div className="onboarding-meta">
          <span>{answered} / {questions.length} answered</span>
          <span className={`timer${secondsLeft < 60 ? ' warn' : ''}`}>{mm}:{ss}</span>
        </div>
      </header>

      <div className="questions-list">
        {questions.map((q, i) => (
          <div key={q.id} className="question-card">
            <p className="question-stem"><strong>Q{i + 1}.</strong> {q.question}</p>
            <p className="question-topic">{q.topic}</p>
            <div className="options">
              {q.options.map((opt, idx) => (
                <label key={idx} className={`option${answers[q.id] === idx ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === idx}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="onboarding-actions">
        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={phase === 'submitting' || answered === 0}
        >
          {phase === 'submitting' ? 'Submitting…' : 'Submit assessment'}
        </button>
      </div>
    </div>
  );
}
