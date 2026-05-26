import { useNavigate } from 'react-router-dom';
import { Target, Bot, BookOpen, BarChart3, Gem, Hand, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../hooks/useCredits';
import CreditBalanceBadge from '../components/CreditBalanceBadge';
import LowCreditWarning from '../components/LowCreditWarning';
import ThemeToggle from '../components/ThemeToggle';
import './Dashboard.css';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: credits } = useCredits();

  const basicCredits = credits?.basicCredits ?? user?.basicCredits ?? 0;
  const premiumCredits = credits?.premiumCredits ?? user?.premiumCredits ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const technologies = user?.preferredTechnologies?.split(',').filter(Boolean) || [];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <Target className="brand-icon" size={22} aria-hidden />
          <h1>AI Interview Simulator</h1>
        </div>
        <div className="dashboard-user">
          <CreditBalanceBadge basicCredits={basicCredits} premiumCredits={premiumCredits} showBuyButton />
          <ThemeToggle />
          <span className="user-name">{user?.fullName}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="welcome-section">
          <h2>
            Welcome back, {user?.fullName?.split(' ')[0]}!{' '}
            <Hand className="welcome-wave" size={28} aria-hidden />
          </h2>
          <p>Ready to ace your next interview? Choose a mode below to get started.</p>
        </section>

        <LowCreditWarning basicCredits={basicCredits} premiumCredits={premiumCredits} />

        <section className="profile-card">
          <h3>Your Profile</h3>
          <div className="profile-details">
            <div className="profile-item">
              <span className="label">Email</span>
              <span className="value">{user?.email}</span>
            </div>
            <div className="profile-item">
              <span className="label">Experience</span>
              <span className="value">{user?.experienceLevel || 'Not set'}</span>
            </div>
            <div className="profile-item">
              <span className="label">Technologies</span>
              <div className="tech-tags">
                {technologies.length > 0
                  ? technologies.map((tech) => (
                      <span key={tech} className="tech-tag">
                        {tech}
                      </span>
                    ))
                  : <span className="value">Not set</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="action-cards">
          <div className="action-card">
            <div className="action-icon"><Bot size={24} aria-hidden /></div>
            <h3>AI Interview</h3>
            <p>Start a simulated interview with our AI interviewer. Get real-time feedback and scoring.</p>
            <button className="btn-primary" onClick={() => navigate('/interview/setup')}>
              Start Interview
            </button>
          </div>

          <div className="action-card">
            <div className="action-icon"><BookOpen size={24} aria-hidden /></div>
            <h3>Question Bank</h3>
            <p>Browse categorized interview questions by topic, technology, and difficulty level.</p>
            <button className="btn-primary" onClick={() => navigate('/question-bank')}>
              Explore Questions
            </button>
          </div>

          <div className="action-card">
            <div className="action-icon"><BarChart3 size={24} aria-hidden /></div>
            <h3>My Progress</h3>
            <p>Track your interview performance, scores, and improvement areas over time.</p>
            <button className="btn-primary" onClick={() => navigate('/progress')}>
              View Progress
            </button>
          </div>

          <div className="action-card">
            <div className="action-icon"><Gem size={24} aria-hidden /></div>
            <h3>Buy Credits</h3>
            <p>Top up basic or premium credits. Credits never expire — use them at your own pace.</p>
            <button className="btn-primary" onClick={() => navigate('/pricing')}>
              View Packs
            </button>
          </div>

          <div className="action-card">
            <div className="action-icon"><Receipt size={24} aria-hidden /></div>
            <h3>Account & Billing</h3>
            <p>Profile details, credit balance, and the full history of your purchases.</p>
            <button className="btn-primary" onClick={() => navigate('/account')}>
              View Account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
