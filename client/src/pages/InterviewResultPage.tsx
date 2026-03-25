import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewService } from '../services/interviewService';
import type { InterviewDetail } from '../types/interview';
import './InterviewResult.css';

export default function InterviewResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await interviewService.getDetail(Number(sessionId));
        setDetail(data);
      } catch {
        setError('Failed to load interview results.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="result-page">
        <div className="result-loading">
          <div className="spinner" />
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="result-page">
        <div className="result-loading">
          <p>{error || 'Interview not found.'}</p>
          <button className="primary-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Build question breakdown from messages
  const questions: Array<{
    number: number;
    topic?: string;
    question: string;
    answer?: string;
    score?: number;
    feedback?: string;
  }> = [];

  const msgs = detail.messages;
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (msg.role === 'interviewer' && msg.questionNumber) {
      const answerMsg = msgs[i + 1];
      const evalMsg = msgs[i + 2]; // Next interviewer message has score for this Q
      questions.push({
        number: msg.questionNumber,
        topic: msg.questionTopic ?? undefined,
        question: msg.content,
        answer: answerMsg?.role === 'candidate' ? answerMsg.content : undefined,
        score: evalMsg?.role === 'interviewer' ? (evalMsg.score ?? undefined) : undefined,
        feedback: evalMsg?.role === 'interviewer' ? (evalMsg.feedback ?? undefined) : undefined,
      });
    }
  }

  const scoreColor = (score?: number) => {
    if (!score) return '#808098';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    if (score >= 4) return '#f97316';
    return '#ef4444';
  };

  const duration = detail.completedAt
    ? Math.round(
        (new Date(detail.completedAt).getTime() - new Date(detail.startedAt).getTime()) / 60000
      )
    : null;

  return (
    <div className="result-page">
      <div className="result-container">
        <button className="back-link" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>

        {/* Header */}
        <div className="result-header">
          <div className="result-badge">🎯</div>
          <h1>Interview Results</h1>
          <p className="result-meta">
            {detail.technology} · {detail.experienceLevel} · {detail.totalQuestions} Questions
            {duration ? ` · ${duration} min` : ''}
          </p>
        </div>

        {/* Overall Score */}
        <div className="score-card">
          <h2>Overall Score</h2>
          <div className="score-circle" style={{ borderColor: scoreColor(detail.overallScore ?? 0) }}>
            <span className="score-value">{detail.overallScore?.toFixed(1) ?? '—'}</span>
            <span className="score-max">/ 10</span>
          </div>
          <div className="score-bar-track">
            <div
              className="score-bar-fill"
              style={{
                width: `${((detail.overallScore ?? 0) / 10) * 100}%`,
                background: scoreColor(detail.overallScore ?? 0),
              }}
            />
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="insight-grid">
          {detail.strengths && detail.strengths.length > 0 && (
            <div className="insight-card strengths">
              <h3>✅ Strengths</h3>
              <ul>
                {detail.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {detail.improvements && detail.improvements.length > 0 && (
            <div className="insight-card improvements">
              <h3>⚠️ Areas to Improve</h3>
              <ul>
                {detail.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Overall Feedback */}
        {detail.overallFeedback && (
          <div className="overall-feedback">
            <h3>📝 Overall Feedback</h3>
            <p>{detail.overallFeedback}</p>
          </div>
        )}

        {/* Question Breakdown */}
        <div className="breakdown-section">
          <h3>📊 Question Breakdown</h3>
          <div className="breakdown-list">
            {questions.map((q) => (
              <details key={q.number} className="breakdown-item">
                <summary>
                  <span className="q-num">Q{q.number}</span>
                  {q.topic && <span className="q-topic">{q.topic}</span>}
                  <span className="q-score" style={{ color: scoreColor(q.score) }}>
                    {q.score != null ? `${q.score}/10` : '—'}
                  </span>
                </summary>
                <div className="q-details">
                  <div className="q-block">
                    <strong>Question:</strong>
                    <p>{q.question}</p>
                  </div>
                  {q.answer && (
                    <div className="q-block">
                      <strong>Your Answer:</strong>
                      <p>{q.answer}</p>
                    </div>
                  )}
                  {q.feedback && (
                    <div className="q-block">
                      <strong>Feedback:</strong>
                      <p>{q.feedback}</p>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="result-actions">
          <button className="primary-btn" onClick={() => navigate('/interview/setup')}>
            🔄 Try Again
          </button>
          <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
