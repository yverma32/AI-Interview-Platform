import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const technologies = user?.preferredTechnologies?.split(',').filter(Boolean) || [];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="brand-icon">🎯</span>
          <h1>AI Interview Simulator</h1>
        </div>
        <div className="dashboard-user">
          <span className="user-name">{user?.fullName}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="welcome-section">
          <h2>Welcome back, {user?.fullName?.split(' ')[0]}! 👋</h2>
          <p>Ready to ace your next interview? Choose a mode below to get started.</p>
        </section>

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
            <div className="action-icon">🤖</div>
            <h3>AI Interview</h3>
            <p>Start a simulated interview with our AI interviewer. Get real-time feedback and scoring.</p>
            <button className="btn-primary" onClick={() => navigate('/interview/setup')}>
              Start Interview
            </button>
          </div>

          <div className="action-card">
            <div className="action-icon">📚</div>
            <h3>Question Bank</h3>
            <p>Browse categorized interview questions by topic, technology, and difficulty level.</p>
            <button className="btn-primary" onClick={() => navigate('/question-bank')}>
              Explore Questions
            </button>
          </div>

          <div className="action-card">
            <div className="action-icon">📊</div>
            <h3>My Progress</h3>
            <p>Track your interview performance, scores, and improvement areas over time.</p>
            <button className="btn-primary" onClick={() => navigate('/progress')}>
              View Progress
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
