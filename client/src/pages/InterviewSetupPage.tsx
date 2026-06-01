import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Rocket, Sparkles,
  Code2, Calculator, Layers, MessageSquare, FileText,
  Atom, Type, Heart, FileType2, Circle, Coffee, Snail, Gem,
  Database, BrainCircuit, Zap, Smartphone, TabletSmartphone, Sparkle,
  Cloud, Globe, Container, Wrench, FlaskConical, Lock,
  Sprout, Leaf, TreePine, Crown, ListChecks, Microscope,
  Target, Mic, MessageCircle, type LucideIcon,
} from 'lucide-react';
import { interviewService } from '../services/interviewService';
import type { WeakTopicItem, InterviewMode } from '../types/interview';
import type { RoundType, CompanyTrack } from '../types/realtime';
import ResumeUpload from '../components/ResumeUpload';
import CreditBalanceBadge from '../components/CreditBalanceBadge';
import { useCredits } from '../hooks/useCredits';
import type { ResumeResponse } from '../services/resumeService';
import { analytics } from '../services/analytics';
import './InterviewSetup.css';

const COMPANY_TRACKS: { id: CompanyTrack; label: string; examples: string; icon: LucideIcon }[] = [
  { id: 'service', label: 'Service Co.',    examples: 'TCS · Infosys · Wipro',         icon: Building2 },
  { id: 'startup', label: 'Product Startup', examples: 'Razorpay · Swiggy · Zepto',     icon: Rocket },
  { id: 'faang',   label: 'FAANG India',    examples: 'Google · Microsoft · Amazon',   icon: Sparkles },
];

const ROUND_TYPES: { id: RoundType; label: string; persona: string; desc: string; icon: LucideIcon }[] = [
  { id: 'tech',           label: 'Tech',             persona: 'Ananya', desc: 'Any stack — frontend, backend, data, mobile, ML, cloud', icon: Code2 },
  { id: 'dsa',            label: 'DSA',              persona: 'Alex',   desc: 'Algorithms, complexity, optimization',                     icon: Calculator },
  { id: 'system_design',  label: 'System Design',    persona: 'Priya',  desc: 'Architecture, scalability, trade-offs',                    icon: Layers },
  { id: 'hr',             label: 'HR / Behavioural', persona: 'Rohan',  desc: 'STAR stories, culture fit',                                icon: MessageSquare },
  { id: 'resume',         label: 'Resume Deep Dive', persona: 'Vikram', desc: 'Your projects, decisions, impact',                         icon: FileText },
];

const TECHNOLOGIES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'React',            label: 'React',            icon: Atom },
  { id: 'Angular',          label: 'Angular',          icon: Type },
  { id: 'Vue.js',           label: 'Vue.js',           icon: Heart },
  { id: 'TypeScript',       label: 'TypeScript',       icon: FileType2 },
  { id: 'Node.js',          label: 'Node.js',          icon: Circle },
  { id: '.NET/C#',          label: '.NET / C#',        icon: Circle },
  { id: 'Java/Spring',      label: 'Java / Spring',    icon: Coffee },
  { id: 'Python/Django',    label: 'Python / Django',  icon: Snail },
  { id: 'Go',               label: 'Go',               icon: Code2 },
  { id: 'Ruby on Rails',    label: 'Ruby on Rails',    icon: Gem },
  { id: 'Data Engineering', label: 'Data Engineering', icon: Database },
  { id: 'Machine Learning', label: 'Machine Learning', icon: BrainCircuit },
  { id: 'SQL/Databases',    label: 'SQL / Databases',  icon: Database },
  { id: 'Apache Spark',     label: 'Apache Spark',     icon: Zap },
  { id: 'iOS/Swift',        label: 'iOS / Swift',      icon: Smartphone },
  { id: 'Android/Kotlin',   label: 'Android / Kotlin', icon: Smartphone },
  { id: 'React Native',     label: 'React Native',     icon: TabletSmartphone },
  { id: 'Flutter',          label: 'Flutter',          icon: Sparkle },
  { id: 'AWS',              label: 'AWS',              icon: Cloud },
  { id: 'Azure',            label: 'Azure',            icon: Cloud },
  { id: 'GCP',              label: 'GCP',              icon: Globe },
  { id: 'Docker/Kubernetes', label: 'Docker / K8s',    icon: Container },
  { id: 'DevOps/SRE',       label: 'DevOps / SRE',     icon: Wrench },
  { id: 'QA/Automation',    label: 'QA / Automation',  icon: FlaskConical },
  { id: 'Security',         label: 'Security',         icon: Lock },
];

const EXPERIENCE_LEVELS: { id: string; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 'Junior',    label: 'Junior',    desc: '0–2 years', icon: Sprout },
  { id: 'Mid-Level', label: 'Mid-Level', desc: '2–5 years', icon: Leaf },
  { id: 'Senior',    label: 'Senior',    desc: '5+ years', icon: TreePine },
  { id: 'Lead',      label: 'Lead',      desc: '8+ years', icon: Crown },
];

const QUESTION_COUNTS: { id: number; label: string; desc: string; icon: LucideIcon }[] = [
  { id: 5,  label: 'Quick',     desc: '5 questions',  icon: Zap },
  { id: 10, label: 'Standard',  desc: '10 questions', icon: ListChecks },
  { id: 15, label: 'Deep Dive', desc: '15 questions', icon: Microscope },
];

export default function InterviewSetupPage() {
  const navigate = useNavigate();
  const { data: credits } = useCredits();
  const basicCredits = credits?.basicCredits ?? 0;
  const premiumCredits = credits?.premiumCredits ?? 0;

  const [interviewMode, setInterviewMode] = useState<InterviewMode>('basic');
  const [technology, setTechnology] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [roundType, setRoundType] = useState<RoundType>('tech');
  const [companyTrack, setCompanyTrack] = useState<CompanyTrack | ''>('');
  const [resume, setResume] = useState<ResumeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [weakTopics, setWeakTopics] = useState<WeakTopicItem[]>([]);
  const [selectedWeakTopics, setSelectedWeakTopics] = useState<string[]>([]);
  const [loadingWeakTopics, setLoadingWeakTopics] = useState(false);

  const fetchWeakTopics = useCallback(async (tech: string) => {
    if (!tech) {
      setWeakTopics([]);
      setSelectedWeakTopics([]);
      return;
    }
    setLoadingWeakTopics(true);
    try {
      const topics = await interviewService.getWeakTopics(tech);
      setWeakTopics(topics);
      setSelectedWeakTopics([]);
    } catch {
      setWeakTopics([]);
    } finally {
      setLoadingWeakTopics(false);
    }
  }, []);

  useEffect(() => {
    fetchWeakTopics(technology);
  }, [technology, fetchWeakTopics]);

  // Auto-fall-back to basic if user lands on premium but has none, vice versa.
  useEffect(() => {
    if (interviewMode === 'premium' && premiumCredits === 0 && basicCredits > 0) {
      setInterviewMode('basic');
    }
  }, [premiumCredits, basicCredits, interviewMode]);

  const handleToggleWeakTopic = (topic: string) => {
    setSelectedWeakTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const insufficientCredits =
    (interviewMode === 'basic' && basicCredits === 0) ||
    (interviewMode === 'premium' && premiumCredits === 0);
  const needsResume = roundType === 'resume' && !resume;
  const techRequired = roundType === 'tech';
  const techSatisfied = !techRequired || !!technology;
  const canStart = techSatisfied && experienceLevel && !isLoading && !insufficientCredits && !needsResume;

  const handleStart = async () => {
    if (!canStart) return;
    setError('');
    setIsLoading(true);

    const effectiveTechnology = techRequired
      ? technology
      : roundType === 'dsa' ? 'DSA'
      : roundType === 'system_design' ? 'System Design'
      : roundType === 'hr' ? 'Behavioural'
      : 'Resume Review';

    analytics.interviewStarted(effectiveTechnology, roundType, companyTrack || undefined);
    analytics.interviewModeSelected(interviewMode);

    if (interviewMode === 'premium') {
      // Premium routes to the Realtime room — credit deduction happens server-side when minting the session.
      navigate('/interview/realtime', {
        state: {
          technology: effectiveTechnology,
          experienceLevel,
          totalQuestions,
          roundType,
          ...(companyTrack && { companyTrack }),
          ...(selectedWeakTopics.length > 0 && { focusTopics: selectedWeakTopics }),
        },
      });
      setIsLoading(false);
      return;
    }

    // Basic: hit /interview/start directly, then route to the basic room with the first question.
    try {
      const session = await interviewService.startInterview({
        technology: effectiveTechnology,
        experienceLevel,
        totalQuestions,
        focusTopics: selectedWeakTopics.length > 0 ? selectedWeakTopics : undefined,
        interviewMode: 'basic',
      });
      navigate(`/interview/basic/${session.sessionId}`, {
        state: { firstResponse: session },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start interview.';
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(apiMsg || msg);
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
          <div className="setup-icon"><Target size={36} aria-hidden /></div>
          <h1>PrepFinity</h1>
          <p>Practice with an AI-powered technical interviewer that adapts to your level</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <CreditBalanceBadge basicCredits={basicCredits} premiumCredits={premiumCredits} showBuyButton />
        </div>

        {/* Interview Mode — Basic vs Premium */}
        <section className="setup-section">
          <h2>Choose Your Interview Type</h2>
          <div className="option-grid round-grid">
            <button
              className={`option-card round-card${interviewMode === 'basic' ? ' selected' : ''}`}
              onClick={() => setInterviewMode('basic')}
              disabled={basicCredits === 0}
            >
              <span className="option-icon"><MessageCircle size={22} aria-hidden /></span>
              <span className="option-label">Text Interview</span>
              <span className="option-desc">
                Questions on screen, answer by typing or voice-to-text. 1 Basic credit · {basicCredits} available
              </span>
              {basicCredits === 0 && <span className="weak-score" style={{ color: '#ef4444' }}>Buy credits</span>}
            </button>
            <button
              className={`option-card round-card${interviewMode === 'premium' ? ' selected' : ''}`}
              onClick={() => setInterviewMode('premium')}
              disabled={premiumCredits === 0}
            >
              <span className="option-icon"><Mic size={22} aria-hidden /></span>
              <span className="option-label">Voice Interview</span>
              <span className="option-desc">
                AI speaks, you respond with your voice. Real-time conversation. 1 Premium credit · {premiumCredits} available
              </span>
              {premiumCredits === 0 && <span className="weak-score" style={{ color: '#ef4444' }}>Buy Premium pack</span>}
            </button>
          </div>
        </section>

        {/* Round Type */}
        <section className="setup-section">
          <h2>Choose Your Interview Round</h2>
          <div className="option-grid round-grid">
            {ROUND_TYPES.map((round) => {
              const Icon = round.icon;
              return (
                <button
                  key={round.id}
                  className={`option-card round-card${roundType === round.id ? ' selected' : ''}`}
                  onClick={() => setRoundType(round.id)}
                >
                  <span className="option-icon"><Icon size={22} aria-hidden /></span>
                  <span className="option-label">{round.label}</span>
                  <span className="option-desc">With {round.persona} — {round.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {roundType === 'resume' && (
          <section className="setup-section">
            <h2>Upload Your Resume</h2>
            <p className="weak-topics-hint">Vikram will reference your projects and experience directly.</p>
            <ResumeUpload onReady={setResume} />
          </section>
        )}

        {roundType === 'tech' && (
          <section className="setup-section">
            <h2>Select Technology</h2>
            <div className="option-grid tech-grid">
              {TECHNOLOGIES.map((tech) => {
                const Icon = tech.icon;
                return (
                  <button
                    key={tech.id}
                    className={`option-card${technology === tech.id ? ' selected' : ''}`}
                    onClick={() => setTechnology(tech.id)}
                  >
                    <span className="option-icon"><Icon size={22} aria-hidden /></span>
                    <span className="option-label">{tech.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {roundType === 'tech' && technology && !loadingWeakTopics && weakTopics.length > 0 && (
          <section className="setup-section weak-topics-section">
            <h2>
              <span className="section-badge">Practice Mode</span>
              Improve Your Weak Areas
            </h2>
            <p className="weak-topics-hint">
              Based on your past interviews, these topics need more practice. Select any to focus your next interview on them.
            </p>
            <div className="option-grid weak-grid">
              {weakTopics.map((item) => (
                <button
                  key={item.topic}
                  className={`option-card weak-card${selectedWeakTopics.includes(item.topic) ? ' selected' : ''}`}
                  onClick={() => handleToggleWeakTopic(item.topic)}
                >
                  <span className="weak-score" style={{ color: item.averageScore < 4 ? '#ef4444' : '#f59e0b' }}>
                    {item.averageScore.toFixed(1)}/10
                  </span>
                  <span className="option-label">{item.topic}</span>
                  <span className="option-desc">
                    Asked {item.questionCount} time{item.questionCount !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
            {selectedWeakTopics.length > 0 && (
              <div className="focus-badge">
                Focused practice: {selectedWeakTopics.length} topic{selectedWeakTopics.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </section>
        )}
        {roundType === 'tech' && technology && loadingWeakTopics && (
          <section className="setup-section">
            <div className="weak-loading">Checking your weak areas...</div>
          </section>
        )}

        <section className="setup-section">
          <h2>Target Company Type <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '14px' }}>(optional)</span></h2>
          <div className="option-grid count-grid">
            {COMPANY_TRACKS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`option-card count-card${companyTrack === t.id ? ' selected' : ''}`}
                  onClick={() => setCompanyTrack(companyTrack === t.id ? '' : t.id)}
                >
                  <span className="option-icon"><Icon size={22} aria-hidden /></span>
                  <span className="option-label">{t.label}</span>
                  <span className="option-desc">{t.examples}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="setup-section">
          <h2>Experience Level</h2>
          <div className="option-grid level-grid">
            {EXPERIENCE_LEVELS.map((level) => {
              const Icon = level.icon;
              return (
                <button
                  key={level.id}
                  className={`option-card level-card${experienceLevel === level.id ? ' selected' : ''}`}
                  onClick={() => setExperienceLevel(level.id)}
                >
                  <span className="option-icon"><Icon size={22} aria-hidden /></span>
                  <span className="option-label">{level.label}</span>
                  <span className="option-desc">{level.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="setup-section">
          <h2>Number of Questions</h2>
          <div className="option-grid count-grid">
            {QUESTION_COUNTS.map((count) => {
              const Icon = count.icon;
              return (
                <button
                  key={count.id}
                  className={`option-card count-card${totalQuestions === count.id ? ' selected' : ''}`}
                  onClick={() => setTotalQuestions(count.id)}
                >
                  <span className="option-icon"><Icon size={22} aria-hidden /></span>
                  <span className="option-label">{count.label}</span>
                  <span className="option-desc">{count.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {error && <div className="setup-error">{error}</div>}
        {insufficientCredits && (
          <div className="setup-error">
            {interviewMode === 'premium'
              ? 'No premium credits remaining. Buy a Premium or Pro pack to start a voice interview.'
              : 'No basic credits remaining. Buy a credit pack to continue.'}
          </div>
        )}

        <button className="start-btn" onClick={handleStart} disabled={!canStart}>
          {isLoading ? (
            <>
              <span className="btn-spinner" /> Starting Interview...
            </>
          ) : (
            <>{interviewMode === 'premium' ? <Mic size={18} aria-hidden /> : <MessageCircle size={18} aria-hidden />} Start Interview</>
          )}
        </button>
      </div>
    </div>
  );
}
