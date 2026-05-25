import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Atom, Type, Heart, Circle, Coffee, Snail, FileType2, Database, Layers,
  BarChart3, Cloud, Container, Wrench,
  BookOpen, Bot, Sparkles, Download, ChevronUp, Lightbulb, NotebookPen, Target,
  type LucideIcon,
} from 'lucide-react';
import { questionBankService } from '../services/questionBankService';
import type { GeneratedQuestion, QuestionAnswer } from '../services/questionBankService';
import './QuestionBank.css';

const TECHNOLOGIES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'React',             label: 'React',         icon: Atom },
  { id: 'Angular',           label: 'Angular',       icon: Type },
  { id: 'Vue.js',            label: 'Vue.js',        icon: Heart },
  { id: 'Node.js',           label: 'Node.js',       icon: Circle },
  { id: '.NET/C#',           label: '.NET / C#',     icon: Circle },
  { id: 'Java',              label: 'Java',          icon: Coffee },
  { id: 'Python',            label: 'Python',        icon: Snail },
  { id: 'TypeScript',        label: 'TypeScript',    icon: FileType2 },
  { id: 'SQL/Databases',     label: 'SQL / DB',      icon: Database },
  { id: 'System Design',     label: 'System Design', icon: Layers },
  { id: 'DSA',               label: 'DSA',           icon: BarChart3 },
  { id: 'AWS',               label: 'AWS',           icon: Cloud },
  { id: 'Docker/Kubernetes', label: 'Docker / K8s',  icon: Container },
  { id: 'DevOps',            label: 'DevOps',        icon: Wrench },
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
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  /**
   * Apply a batch of answers from the API onto our local question list, matched by id.
   * Used by both single-question fetch and bulk "fetch all".
   */
  const applyAnswers = (answers: QuestionAnswer[]) => {
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
  };

  const handleGenerate = async () => {
    if (!technology) return;
    setError('');
    setPhase('loading');

    try {
      // Just fetch questions — answers come on-demand to save tokens.
      const result = await questionBankService.generateQuestions(technology, topic || undefined, 10);
      setQuestions(result.map((q) => ({ ...q, showAnswer: false })));
      setPhase('questions');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to generate questions.');
      setPhase('setup');
    }
  };

  /**
   * Fetch the answer for a single question on demand. Marks the row loading, then either reveals
   * the answer when it lands or surfaces an inline error if the API call fails.
   */
  const handleFetchAnswer = async (questionId: number) => {
    const target = questions.find((q) => q.id === questionId);
    if (!target || target.answer) {
      // Already cached — just toggle visibility.
      setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, showAnswer: !q.showAnswer } : q));
      return;
    }

    setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, loadingAnswer: true } : q));
    try {
      const answers = await questionBankService.getBatchAnswers(
        technology,
        [{ id: target.id, question: target.question }],
      );
      applyAnswers(answers);
      // Auto-reveal after fetch (the user clicked Fetch Answer — they want to read it now).
      setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, showAnswer: true, loadingAnswer: false } : q));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || 'Failed to fetch answer.');
      setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, loadingAnswer: false } : q));
    }
  };

  const handleToggleAnswer = (questionId: number) => {
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === questionId ? { ...item, showAnswer: !item.showAnswer } : item
      )
    );
  };

  /**
   * Fetch answers for every question that doesn't already have one. Used by the "Fetch all answers"
   * button and as a prerequisite step when the user downloads the PDF with answers.
   * @returns the up-to-date list with all answers, suitable for the caller to use directly.
   */
  const [fetchingAll, setFetchingAll] = useState(false);
  const fetchAllMissingAnswers = async (): Promise<QuestionWithAnswer[]> => {
    const missing = questions.filter((q) => !q.answer);
    if (missing.length === 0) return questions;

    setFetchingAll(true);
    setQuestions((prev) => prev.map((q) => q.answer ? q : { ...q, loadingAnswer: true }));
    try {
      const answers = await questionBankService.getBatchAnswers(
        technology,
        missing.map((q) => ({ id: q.id, question: q.question })),
      );
      const answerMap = new Map<number, QuestionAnswer>();
      answers.forEach((a) => answerMap.set(a.id, a));
      const updated = questions.map((item) => {
        const ans = answerMap.get(item.id);
        return ans
          ? { ...item, answer: ans.answer, keyPoints: ans.keyPoints, tips: ans.tips, loadingAnswer: false }
          : { ...item, loadingAnswer: false };
      });
      setQuestions(updated);
      return updated;
    } catch (err: unknown) {
      setQuestions((prev) => prev.map((q) => ({ ...q, loadingAnswer: false })));
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || 'Failed to fetch answers.');
      return questions;
    } finally {
      setFetchingAll(false);
    }
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
      }));
      setQuestions((p) => [...p, ...newQs]);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to load more questions.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDownloadPDF = async (withAnswers: boolean) => {
    setShowDownloadMenu(false);

    // If the user wants answers but we haven't fetched them all yet, fetch the missing ones first.
    // Otherwise the PDF would show "Answer not yet loaded" placeholders, which is worse than waiting.
    let questionsForPdf = questions;
    if (withAnswers) {
      questionsForPdf = await fetchAllMissingAnswers();
    }

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
  <p class="subtitle">Generated on ${new Date().toLocaleDateString()} • ${questionsForPdf.length} questions${withAnswers ? ' • With Answers' : ''}</p>
  ${questionsForPdf.map((q, i) => `
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
  };

  return (
    <div className="qb">
      {/* Header */}
      <header className="qb-header">
        <button className="qb-back" onClick={() => phase === 'setup' ? navigate('/dashboard') : handleBack()}>
          ← {phase === 'setup' ? 'Dashboard' : 'Back'}
        </button>
        <div className="qb-title">
          <span className="qb-title-icon"><BookOpen size={22} aria-hidden /></span>
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
              {TECHNOLOGIES.map((tech) => {
                const Icon = tech.icon;
                return (
                  <button
                    key={tech.id}
                    className={`qb-tech-card${technology === tech.id ? ' selected' : ''}`}
                    onClick={() => setTechnology(tech.id)}
                  >
                    <span className="qb-tech-icon"><Icon size={22} aria-hidden /></span>
                    <span className="qb-tech-label">{tech.label}</span>
                  </button>
                );
              })}
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
            <Bot size={18} aria-hidden /> Generate Questions
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
              {questions.some((q) => !q.answer) && (
                <button
                  className="qb-fetch-all-btn"
                  onClick={fetchAllMissingAnswers}
                  disabled={fetchingAll}
                >
                  {fetchingAll ? (
                    <><span className="qb-btn-spinner" /> Fetching answers...</>
                  ) : (
                    <><Sparkles size={14} aria-hidden /> Fetch All Answers</>
                  )}
                </button>
              )}
              <div className="qb-download-wrapper" ref={downloadRef}>
                <button
                  className="qb-download-btn"
                  onClick={() => setShowDownloadMenu((prev) => !prev)}
                >
                  <Download size={14} aria-hidden /> Download PDF
                </button>
                {showDownloadMenu && (
                  <div className="qb-download-menu">
                    <button onClick={() => handleDownloadPDF(false)}>Questions Only</button>
                    <button onClick={() => handleDownloadPDF(true)}>
                      With Answers
                      {questions.some((q) => !q.answer) && (
                        <span className="qb-download-hint"> (will fetch missing first)</span>
                      )}
                    </button>
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
                    onClick={() => q.answer ? handleToggleAnswer(q.id) : handleFetchAnswer(q.id)}
                    disabled={q.loadingAnswer}
                  >
                    {q.loadingAnswer ? (
                      <><span className="qb-btn-spinner" /> Fetching answer...</>
                    ) : !q.answer ? (
                      <><Sparkles size={14} aria-hidden /> Fetch Answer</>
                    ) : q.showAnswer ? (
                      <><ChevronUp size={14} aria-hidden /> Hide Answer</>
                    ) : (
                      <><Lightbulb size={14} aria-hidden /> Show Answer</>
                    )}
                  </button>
                </div>

                {q.showAnswer && q.answer && (
                  <div className="qb-answer-panel">
                    <div className="qb-answer-section">
                      <h4><NotebookPen size={14} aria-hidden /> Model Answer</h4>
                      <div className="qb-answer-text">{q.answer}</div>
                    </div>

                    {q.keyPoints && (
                      <div className="qb-answer-section">
                        <h4><Target size={14} aria-hidden /> Key Points</h4>
                        <div className="qb-answer-text qb-key-points">{q.keyPoints}</div>
                      </div>
                    )}

                    {q.tips && (
                      <div className="qb-answer-section">
                        <h4><Lightbulb size={14} aria-hidden /> Tips</h4>
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
