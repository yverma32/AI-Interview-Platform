import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewService } from '../services/interviewService';
import './InterviewSetup.css';

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

const EXPERIENCE_LEVELS = [
  { id: 'Junior', label: 'Junior', desc: '0–2 years', icon: '🌱' },
  { id: 'Mid-Level', label: 'Mid-Level', desc: '2–5 years', icon: '🌿' },
  { id: 'Senior', label: 'Senior', desc: '5+ years', icon: '🌳' },
  { id: 'Lead', label: 'Lead', desc: '8+ years', icon: '👑' },
];

const QUESTION_COUNTS = [
  { id: 5, label: 'Quick', desc: '5 questions', icon: '⚡' },
  { id: 10, label: 'Standard', desc: '10 questions', icon: '📋' },
  { id: 15, label: 'Deep Dive', desc: '15 questions', icon: '🔬' },
];

export default function InterviewSetupPage() {
  const navigate = useNavigate();
  const [technology, setTechnology] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canStart = technology && experienceLevel && !isLoading;

  const handleStart = async () => {
    if (!canStart) return;
    setError('');
    setIsLoading(true);

    try {
      const response = await interviewService.startInterview({
        technology,
        experienceLevel,
        totalQuestions,
      });

      navigate(`/interview/room/${response.sessionId}`, {
        state: response,
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        error.response?.data?.message ||
          error.message ||
          'Failed to start interview. Please check your API key configuration.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-container">
        <button className="back-link" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>

        <div className="setup-header">
          <div className="setup-icon">🎯</div>
          <h1>AI Interview Simulator</h1>
          <p>Practice with an AI-powered technical interviewer that adapts to your level</p>
        </div>

        {/* Technology Selection */}
        <section className="setup-section">
          <h2>Select Technology</h2>
          <div className="option-grid tech-grid">
            {TECHNOLOGIES.map((tech) => (
              <button
                key={tech.id}
                className={`option-card${technology === tech.id ? ' selected' : ''}`}
                onClick={() => setTechnology(tech.id)}
              >
                <span className="option-icon">{tech.icon}</span>
                <span className="option-label">{tech.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Experience Level */}
        <section className="setup-section">
          <h2>Experience Level</h2>
          <div className="option-grid level-grid">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level.id}
                className={`option-card level-card${experienceLevel === level.id ? ' selected' : ''}`}
                onClick={() => setExperienceLevel(level.id)}
              >
                <span className="option-icon">{level.icon}</span>
                <span className="option-label">{level.label}</span>
                <span className="option-desc">{level.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Question Count */}
        <section className="setup-section">
          <h2>Number of Questions</h2>
          <div className="option-grid count-grid">
            {QUESTION_COUNTS.map((count) => (
              <button
                key={count.id}
                className={`option-card count-card${totalQuestions === count.id ? ' selected' : ''}`}
                onClick={() => setTotalQuestions(count.id)}
              >
                <span className="option-icon">{count.icon}</span>
                <span className="option-label">{count.label}</span>
                <span className="option-desc">{count.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {error && <div className="setup-error">{error}</div>}

        <button className="start-btn" onClick={handleStart} disabled={!canStart}>
          {isLoading ? (
            <>
              <span className="btn-spinner" /> Starting Interview...
            </>
          ) : (
            <>🎤 Start Interview</>
          )}
        </button>
      </div>
    </div>
  );
}
