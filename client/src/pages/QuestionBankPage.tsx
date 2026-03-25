import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionBankService } from '../services/questionBankService';
import type { GeneratedQuestion, QuestionAnswer } from '../services/questionBankService';
import './QuestionBank.css';

const TECHNOLOGIES = [
  { id: 'React', label: 'React', icon: '⚛️' },
  { id: 'Angular', label: 'Angular', icon: '🅰️' },
  { id: 'Vue.js', label: 'Vue.js', icon: '💚' },
  { id: 'Node.js', label: 'Node.js', icon: '🟢' },
  { id: '.NET/C#', label: '.NET / C#', icon: '🟣' },
  { id: 'Java', label: 'Java', icon: '☕' },
  { id: 'Python', label: 'Python', icon: '🐍' },
  { id: 'TypeScript', label: 'TypeScript', icon: '📘' },
  { id: 'SQL/Databases', label: 'SQL / DB', icon: '🗄️' },
  { id: 'System Design', label: 'System Design', icon: '🏗️' },
  { id: 'DSA', label: 'DSA', icon: '📊' },
  { id: 'AWS', label: 'AWS', icon: '☁️' },
  { id: 'Docker/Kubernetes', label: 'Docker / K8s', icon: '🐳' },
  { id: 'DevOps', label: 'DevOps', icon: '🔧' },
];

const DIFF_COLORS: Record<string, string> = {
  Easy: '#22c55e',
  Medium: '#f59e0b',
  Hard: '#ef4444',
};

type Phase = 'setup' | 'loading' | 'questions';

interface QuestionWithAnswer extends GeneratedQuestion {
  answer?: string;
  keyPoints?: string | null;
  tips?: string | null;
  showAnswer?: boolean;
  loadingAnswer?: boolean;
}

export default function QuestionBankPage() {
  const navigate = useNavigate();

  // Setup state
  const [technology, setTechnology] = useState('');
  const [topic, setTopic] = useState('');

  // App state
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [answersLoaded, setAnswersLoaded] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  const fetchAnswersInBackground = (tech: string, qs: QuestionWithAnswer[]) => {
    questionBankService
      .getBatchAnswers(tech, qs.map((q) => ({ id: q.id, question: q.question })))
      .then((answers) => {
        const answerMap = new Map<number, QuestionAnswer>();
        answers.forEach((a) => answerMap.set(a.id, a));
        setQuestions((prev) =>
          prev.map((item) => {
            const ans = answerMap.get(item.id);
            return ans
              ? { ...item, answer: ans.answer, keyPoints: ans.keyPoints, tips: ans.tips, loadingAnswer: false }
              : item;
          })
        );
        setAnswersLoaded(true);
      })
      .catch(() => {
        // Silently fail — user can still see questions
        setQuestions((prev) => prev.map((item) => ({ ...item, loadingAnswer: false })));
      });
  };

  const handleGenerate = async () => {
    if (!technology) return;
    setError('');
    setPhase('loading');
    setAnswersLoaded(false);

    try {
      const result = await questionBankService.generateQuestions(technology, topic || undefined, 10);
      const withState = result.map((q) => ({ ...q, showAnswer: false, loadingAnswer: true }));
      setQuestions(withState);
      setPhase('questions');
      // Fetch answers in background
      fetchAnswersInBackground(technology, withState);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to generate questions.');
      setPhase('setup');
    }
  };

  const handleToggleAnswer = (questionId: number) => {
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === questionId ? { ...item, showAnswer: !item.showAnswer } : item
      )
    );
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const prev = questions;
    try {
      const result = await questionBankService.generateQuestions(technology, topic || undefined, 10);
      const startId = prev.length;
      const newQs = result.map((q) => ({
        ...q,
        id: startId + q.id,
        showAnswer: false,
        loadingAnswer: true,
      }));
      setQuestions((p) => [...p, ...newQs]);
      // Fetch answers for the new batch in background
      fetchAnswersInBackground(technology, newQs);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to load more questions.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDownloadPDF = (withAnswers: boolean) => {
    setShowDownloadMenu(false);

    const title = `${technology} Interview Questions${topic ? ` — ${topic}` : ''}`;
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin-bottom: 32px; }
  .q-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; page-break-inside: avoid; }
  .q-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .q-num { font-weight: 700; font-size: 13px; color: #6366f1; background: #eef2ff; padding: 2px 8px; border-radius: 4px; }
  .q-diff { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 12px; }
  .q-diff.Easy { color: #16a34a; border: 1px solid #16a34a; }
  .q-diff.Medium { color: #d97706; border: 1px solid #d97706; }
  .q-diff.Hard { color: #dc2626; border: 1px solid #dc2626; }
  .q-topic { font-size: 12px; color: #64748b; background: #f1f5f9; padding: 1px 8px; border-radius: 12px; }
  .q-text { font-size: 15px; color: #1e293b; margin-bottom: ${withAnswers ? '12px' : '0'}; }
  .answer-section { margin-top: 8px; padding: 12px 16px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #6366f1; }
  .answer-section h4 { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .answer-section p { font-size: 13px; color: #334155; white-space: pre-wrap; }
  .kp-section { border-left-color: #6366f1; margin-top: 8px; }
  .tips-section { border-left-color: #f59e0b; margin-top: 8px; }
  @media print {
    body { padding: 20px; }
    .q-card { break-inside: avoid; }
  }
</style>
</head><body>
  <h1>${title}</h1>
  <p class="subtitle">Generated on ${new Date().toLocaleDateString()} • ${questions.length} questions${withAnswers ? ' • With Answers' : ''}</p>
  ${questions.map((q, i) => `
    <div class="q-card">
      <div class="q-header">
        <span class="q-num">Q${i + 1}</span>
        <span class="q-diff ${q.difficulty}">${q.difficulty}</span>
        <span class="q-topic">${q.topic}</span>
      </div>
      <p class="q-text">${q.question}</p>
      ${withAnswers ? `
        <div class="answer-section">
          <h4>Model Answer</h4>
          <p>${q.answer || 'Answer not yet loaded'}</p>
        </div>
        ${q.keyPoints ? `<div class="answer-section kp-section"><h4>Key Points</h4><p>${q.keyPoints}</p></div>` : ''}
        ${q.tips ? `<div class="answer-section tips-section"><h4>Tips</h4><p>${q.tips}</p></div>` : ''}
      ` : ''}
    </div>
  `).join('')}
</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Allow content to render before triggering print
      setTimeout(() => printWindow.print(), 300);
    }
  };

  const handleBack = () => {
    setPhase('setup');
    setQuestions([]);
    setError('');
    setShowDownloadMenu(false);
    setAnswersLoaded(false);
  };

  return (
    <div className="qb">
      {/* Header */}
      <header className="qb-header">
        <button className="qb-back" onClick={() => phase === 'setup' ? navigate('/dashboard') : handleBack()}>
          ← {phase === 'setup' ? 'Dashboard' : 'Back'}
        </button>
        <div className="qb-title">
          <span className="qb-title-icon">📚</span>
          <h1>Question Bank</h1>
        </div>
      </header>

      {/* ── SETUP PHASE ── */}
      {phase === 'setup' && (
        <div className="qb-setup">
          <div className="qb-setup-header">
            <h2>Generate Interview Questions</h2>
            <p>Select a technology and optionally specify a topic to get AI-generated interview questions.</p>
          </div>

          {/* Technology Selection */}
          <section className="qb-section">
            <h3>Select Technology</h3>
            <div className="qb-tech-grid">
              {TECHNOLOGIES.map((tech) => (
                <button
                  key={tech.id}
                  className={`qb-tech-card${technology === tech.id ? ' selected' : ''}`}
                  onClick={() => setTechnology(tech.id)}
                >
                  <span className="qb-tech-icon">{tech.icon}</span>
                  <span className="qb-tech-label">{tech.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Optional Topic */}
          <section className="qb-section">
            <h3>Specific Topic <span className="qb-optional">(optional)</span></h3>
            <input
              type="text"
              className="qb-topic-input"
              placeholder="e.g., React Hooks, Async/Await, System Design, Binary Trees..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </section>

          {error && <div className="qb-error">{error}</div>}

          <button className="qb-generate-btn" onClick={handleGenerate} disabled={!technology}>
            🤖 Generate Questions
          </button>
        </div>
      )}

      {/* ── LOADING PHASE ── */}
      {phase === 'loading' && (
        <div className="qb-loading-screen">
          <div className="qb-loading-spinner" />
          <h2>Generating Questions...</h2>
          <p>AI is crafting interview questions for <strong>{technology}</strong>
            {topic && <> on <strong>{topic}</strong></>}
          </p>
        </div>
      )}

      {/* ── QUESTIONS PHASE ── */}
      {phase === 'questions' && (
        <div className="qb-questions">
          <div className="qb-questions-header">
            <div className="qb-questions-info">
              <h2>{technology} {topic && `— ${topic}`}</h2>
              <span className="qb-questions-count">{questions.length} questions</span>
            </div>
            <div className="qb-header-actions">
              <div className="qb-download-wrapper" ref={downloadRef}>
                <button
                  className="qb-download-btn"
                  onClick={() => setShowDownloadMenu((prev) => !prev)}
                >
                  📥 Download PDF
                </button>
                {showDownloadMenu && (
                  <div className="qb-download-menu">
                    <button onClick={() => handleDownloadPDF(false)}>Questions Only</button>
                    <button onClick={() => handleDownloadPDF(true)}>With Answers</button>
                  </div>
                )}
              </div>
              <button className="qb-new-btn" onClick={handleBack}>
                + New Questions
              </button>
            </div>
          </div>

          <div className="qb-questions-list">
            {questions.map((q, index) => (
              <div key={q.id} className="qb-q-card">
                <div className="qb-q-top">
                  <span className="qb-q-num">Q{index + 1}</span>
                  <div className="qb-q-tags">
                    <span
                      className="qb-q-diff"
                      style={{ color: DIFF_COLORS[q.difficulty], borderColor: DIFF_COLORS[q.difficulty] }}
                    >
                      {q.difficulty}
                    </span>
                    <span className="qb-q-topic">{q.topic}</span>
                  </div>
                </div>

                <p className="qb-q-text">{q.question}</p>

                <div className="qb-q-actions">
                  <button
                    className={`qb-answer-btn${q.showAnswer ? ' active' : ''}`}
                    onClick={() => handleToggleAnswer(q.id)}
                    disabled={q.loadingAnswer}
                  >
                    {q.loadingAnswer ? (
                      <><span className="qb-btn-spinner" /> Loading answer...</>
                    ) : q.showAnswer ? (
                      '🔼 Hide Answer'
                    ) : (
                      '💡 Show Answer'
                    )}
                  </button>
                </div>

                {q.showAnswer && q.answer && (
                  <div className="qb-answer-panel">
                    <div className="qb-answer-section">
                      <h4>📝 Model Answer</h4>
                      <div className="qb-answer-text">{q.answer}</div>
                    </div>

                    {q.keyPoints && (
                      <div className="qb-answer-section">
                        <h4>🎯 Key Points</h4>
                        <div className="qb-answer-text qb-key-points">{q.keyPoints}</div>
                      </div>
                    )}

                    {q.tips && (
                      <div className="qb-answer-section">
                        <h4>💡 Tips</h4>
                        <div className="qb-answer-text qb-tips">{q.tips}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {/* Load More */}
            <div className="qb-load-more">
              {error && <div className="qb-error">{error}</div>}
              <button
                className="qb-load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <><span className="qb-btn-spinner" /> Loading more questions...</>
                ) : (
                  '+ Load More Questions'
                )}
              </button>
            </div>          </div>
        </div>
      )}
    </div>
  );
}
