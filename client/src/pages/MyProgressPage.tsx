import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { progressService } from '../services/progressService';
import type { ProgressData } from '../services/progressService';
import './MyProgress.css';

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#f59e0b';
  if (score >= 4) return '#f97316';
  return '#ef4444';
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  Completed: { label: 'Completed', color: '#22c55e' },
  InProgress: { label: 'In Progress', color: '#3b82f6' },
  Abandoned: { label: 'Abandoned', color: '#64748b' },
};

export default function MyProgressPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    progressService
      .getProgress()
      .then(setData)
      .catch((err) => {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e.response?.data?.message || e.message || 'Failed to load progress.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mp">
        <header className="mp-header">
          <button className="mp-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="mp-title"><span className="mp-title-icon">📊</span><h1>My Progress</h1></div>
        </header>
        <div className="mp-loading">
          <div className="mp-spinner" />
          <p>Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mp">
        <header className="mp-header">
          <button className="mp-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="mp-title"><span className="mp-title-icon">📊</span><h1>My Progress</h1></div>
        </header>
        <div className="mp-loading">
          <div className="mp-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!data || data.stats.totalInterviews === 0) {
    return (
      <div className="mp">
        <header className="mp-header">
          <button className="mp-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className="mp-title"><span className="mp-title-icon">📊</span><h1>My Progress</h1></div>
        </header>
        <div className="mp-empty">
          <span className="mp-empty-icon">🎯</span>
          <h2>No Interview Data Yet</h2>
          <p>Complete your first AI interview to start tracking your progress.</p>
          <button className="mp-start-btn" onClick={() => navigate('/interview/setup')}>
            Start Your First Interview
          </button>
        </div>
      </div>
    );
  }

  const { stats, scoreHistory, technologyBreakdown, topicScores, strengths, improvements, recentSessions } = data;

  // Simple bar chart max for scaling
  const maxTopicScore = 10;

  return (
    <div className="mp">
      {/* Header */}
      <header className="mp-header">
        <button className="mp-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div className="mp-title">
          <span className="mp-title-icon">📊</span>
          <h1>My Progress</h1>
        </div>
      </header>

      <div className="mp-content">
        {/* ── Stats Cards ── */}
        <section className="mp-stats-grid">
          <div className="mp-stat-card">
            <span className="mp-stat-icon">🎤</span>
            <div className="mp-stat-info">
              <span className="mp-stat-value">{stats.completedInterviews}</span>
              <span className="mp-stat-label">Interviews Completed</span>
            </div>
          </div>
          <div className="mp-stat-card">
            <span className="mp-stat-icon">⭐</span>
            <div className="mp-stat-info">
              <span className="mp-stat-value" style={{ color: stats.averageScore ? SCORE_COLOR(stats.averageScore) : undefined }}>
                {stats.averageScore?.toFixed(1) ?? '—'}
              </span>
              <span className="mp-stat-label">Average Score</span>
            </div>
          </div>
          <div className="mp-stat-card">
            <span className="mp-stat-icon">🏆</span>
            <div className="mp-stat-info">
              <span className="mp-stat-value" style={{ color: stats.bestScore ? SCORE_COLOR(stats.bestScore) : undefined }}>
                {stats.bestScore?.toFixed(1) ?? '—'}
              </span>
              <span className="mp-stat-label">Best Score</span>
            </div>
          </div>
          <div className="mp-stat-card">
            <span className="mp-stat-icon">❓</span>
            <div className="mp-stat-info">
              <span className="mp-stat-value">{stats.totalQuestionsAnswered}</span>
              <span className="mp-stat-label">Questions Answered</span>
            </div>
          </div>
          <div className="mp-stat-card">
            <span className="mp-stat-icon">⏱️</span>
            <div className="mp-stat-info">
              <span className="mp-stat-value">{stats.totalPracticeMinutes}</span>
              <span className="mp-stat-label">Minutes Practiced</span>
            </div>
          </div>
          <div className="mp-stat-card">
            <span className="mp-stat-icon">💻</span>
            <div className="mp-stat-info">
              <span className="mp-stat-value">{technologyBreakdown.length}</span>
              <span className="mp-stat-label">Technologies Practiced</span>
            </div>
          </div>
        </section>

        {/* ── Score Trend ── */}
        {scoreHistory.length > 1 && (
          <section className="mp-card">
            <h2>📈 Score Trend</h2>
            <div className="mp-chart">
              <div className="mp-chart-y-axis">
                <span>10</span>
                <span>8</span>
                <span>6</span>
                <span>4</span>
                <span>2</span>
                <span>0</span>
              </div>
              <div className="mp-chart-area">
                {/* Grid lines */}
                <div className="mp-chart-grid">
                  {[0, 2, 4, 6, 8, 10].map((v) => (
                    <div key={v} className="mp-chart-gridline" style={{ bottom: `${(v / 10) * 100}%` }} />
                  ))}
                </div>
                {/* Bars */}
                <div className="mp-chart-bars">
                  {scoreHistory.map((pt, i) => (
                    <div key={i} className="mp-chart-bar-wrapper" title={`${pt.technology}: ${pt.score}/10 (${pt.date})`}>
                      <div
                        className="mp-chart-bar"
                        style={{
                          height: `${(pt.score / 10) * 100}%`,
                          backgroundColor: SCORE_COLOR(pt.score),
                        }}
                      >
                        <span className="mp-chart-bar-label">{pt.score}</span>
                      </div>
                      <span className="mp-chart-x-label">{pt.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mp-two-col">
          {/* ── Technology Breakdown ── */}
          <section className="mp-card">
            <h2>💻 By Technology</h2>
            {technologyBreakdown.length === 0 ? (
              <p className="mp-muted">No completed interviews yet.</p>
            ) : (
              <div className="mp-tech-list">
                {technologyBreakdown.map((t) => (
                  <div key={t.technology} className="mp-tech-row">
                    <div className="mp-tech-main">
                      <span className="mp-tech-name">{t.technology}</span>
                      <span className="mp-tech-count">{t.interviewCount} interview{t.interviewCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="mp-tech-scores">
                      <div className="mp-tech-score-item">
                        <span className="mp-tech-score-label">Avg</span>
                        <span
                          className="mp-tech-score-value"
                          style={{ color: t.averageScore ? SCORE_COLOR(t.averageScore) : undefined }}
                        >
                          {t.averageScore?.toFixed(1) ?? '—'}
                        </span>
                      </div>
                      <div className="mp-tech-score-item">
                        <span className="mp-tech-score-label">Best</span>
                        <span
                          className="mp-tech-score-value"
                          style={{ color: t.bestScore ? SCORE_COLOR(t.bestScore) : undefined }}
                        >
                          {t.bestScore?.toFixed(1) ?? '—'}
                        </span>
                      </div>
                    </div>
                    <span className="mp-tech-date">{t.lastPracticed}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Topic Scores ── */}
          <section className="mp-card">
            <h2>🎯 Topic Performance</h2>
            {topicScores.length === 0 ? (
              <p className="mp-muted">No topic-level data yet.</p>
            ) : (
              <div className="mp-topic-list">
                {topicScores.map((t) => (
                  <div key={t.topic} className="mp-topic-row">
                    <div className="mp-topic-info">
                      <span className="mp-topic-name">{t.topic}</span>
                      <span className="mp-topic-count">{t.questionCount} Q{t.questionCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="mp-topic-bar-container">
                      <div
                        className="mp-topic-bar"
                        style={{
                          width: `${(t.averageScore / maxTopicScore) * 100}%`,
                          backgroundColor: SCORE_COLOR(t.averageScore),
                        }}
                      />
                    </div>
                    <span className="mp-topic-score" style={{ color: SCORE_COLOR(t.averageScore) }}>
                      {t.averageScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Strengths & Improvements ── */}
        {(strengths.length > 0 || improvements.length > 0) && (
          <div className="mp-two-col">
            {strengths.length > 0 && (
              <section className="mp-card mp-strengths">
                <h2>💪 Key Strengths</h2>
                <ul className="mp-insight-list">
                  {strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
            {improvements.length > 0 && (
              <section className="mp-card mp-improvements">
                <h2>📝 Areas to Improve</h2>
                <ul className="mp-insight-list">
                  {improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* ── Recent Sessions ── */}
        <section className="mp-card">
          <h2>🕐 Recent Interviews</h2>
          {recentSessions.length === 0 ? (
            <p className="mp-muted">No interviews yet.</p>
          ) : (
            <div className="mp-sessions-table">
              <div className="mp-session-header-row">
                <span>Technology</span>
                <span>Level</span>
                <span>Questions</span>
                <span>Score</span>
                <span>Status</span>
                <span>Date</span>
                <span>Duration</span>
              </div>
              {recentSessions.map((s) => {
                const badge = STATUS_BADGE[s.status] || { label: s.status, color: '#64748b' };
                return (
                  <div
                    key={s.id}
                    className="mp-session-row"
                    onClick={() => s.status === 'Completed' && navigate(`/interview/results/${s.id}`)}
                    style={{ cursor: s.status === 'Completed' ? 'pointer' : 'default' }}
                  >
                    <span className="mp-session-tech">{s.technology}</span>
                    <span>{s.experienceLevel}</span>
                    <span>{s.totalQuestions}</span>
                    <span style={{ color: s.overallScore ? SCORE_COLOR(s.overallScore) : '#64748b', fontWeight: 600 }}>
                      {s.overallScore?.toFixed(1) ?? '—'}
                    </span>
                    <span>
                      <span className="mp-status-badge" style={{ color: badge.color, borderColor: badge.color }}>
                        {badge.label}
                      </span>
                    </span>
                    <span>{s.startedAt}</span>
                    <span>{s.duration ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
