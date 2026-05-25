import type { QuestionScore } from '../types/realtime';

interface Props {
  /** Kept in the signature so the card can show scored-question count if we ever want it. */
  scores: QuestionScore[];
  totalQuestions: number;
  currentTopic: string | null;
  questionNumber: number;
}

/**
 * Live, non-distracting status card. Deliberately does NOT show per-question scores or running
 * average mid-interview — seeing the previous score in real time rattles candidates on the next
 * question. The full score breakdown shows up on the results page.
 */
export default function LiveScoreCard({ totalQuestions, currentTopic, questionNumber }: Props) {
  return (
    <div className="live-score-card">
      <div className="score-row">
        <span className="score-label">Question</span>
        <span className="score-value">{questionNumber} / {totalQuestions}</span>
      </div>
      {currentTopic && (
        <div className="score-row">
          <span className="score-label">Topic</span>
          <span className="score-topic">{currentTopic}</span>
        </div>
      )}
    </div>
  );
}
