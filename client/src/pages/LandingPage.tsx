import { Link, Navigate } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import {
  Target, MessageCircle, Mic, Diamond, Star,
  Brain, BookOpen, BarChart3, FileText,
  ArrowRight, Sparkles, ShieldCheck, Zap, Gift,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFoundingStatus } from '../hooks/useCredits';
import './Landing.css';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: foundingStatus } = useFoundingStatus();

  // If a logged-in user lands here (e.g. typed the root URL), send them to the dashboard.
  // Keeps the landing page exclusively for new/anonymous visitors.
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing">
      <SeoHead
        canonical="/"
        description="Practice technical interviews with an AI voice interviewer. Real-time scoring, weak-topic analytics, 5 personas. Free to start — no credit card needed."
      />
      {/* ── Top nav ─────────────────────────────────────────────────── */}
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <Target size={22} aria-hidden />
          <span>AI Interview Simulator</span>
        </Link>
        <nav className="landing-nav-links">
          <Link to="/pricing" className="nav-link">Pricing</Link>
          <Link to="/login" className="nav-link">Sign In</Link>
          <Link to="/register" className="nav-cta">Get Started</Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        {foundingStatus?.active ? (
          <Link to="/register" className="hero-badge hero-badge--promo">
            <Gift size={14} aria-hidden />
            <span>
              <strong>Launch offer:</strong> First {foundingStatus.totalSpots} buyers get{' '}
              <strong>2× credits</strong> on any pack →
            </span>
          </Link>
        ) : (
          <div className="hero-badge">
            <Sparkles size={14} aria-hidden />
            <span>Built for Indian tech interviews</span>
          </div>
        )}
        <h1 className="hero-title">
          Practice <span className="grad-text">real interviews</span>.<br />
          Get scored in real time.
        </h1>
        <p className="hero-sub">
          A voice-and-text AI interviewer that asks the questions your dream company
          actually asks. Five personas. Five rounds. Detailed feedback after every session.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary btn-lg">
            Start Free — 3 Interviews
            <ArrowRight size={18} aria-hidden />
          </Link>
          <Link to="/pricing" className="btn btn-ghost btn-lg">
            View Pricing
          </Link>
        </div>
        <p className="hero-fineprint">
          <ShieldCheck size={14} aria-hidden />
          No credit card. 2 Basic + 1 Premium credits free on signup. Credits never expire.
        </p>
      </section>

      {/* ── Two-mode comparison ─────────────────────────────────────── */}
      <section className="landing-section">
        <h2 className="section-title">Choose how you want to practice</h2>
        <p className="section-sub">Two interview styles. Same scoring engine. Switch any time.</p>

        <div className="mode-cards">
          <div className="mode-card">
            <div className="mode-icon mode-icon--basic">
              <MessageCircle size={28} aria-hidden />
            </div>
            <div className="mode-credit">
              <Diamond size={14} aria-hidden /> Basic credit
            </div>
            <h3>Text Interview</h3>
            <p className="mode-desc">
              The AI asks. You type — or dictate with your voice. Great for quick daily reps,
              or when you're somewhere you can't talk.
            </p>
            <ul className="mode-features">
              <li><Zap size={14} aria-hidden /> Fast — submit at your own pace</li>
              <li><Zap size={14} aria-hidden /> Voice-to-text for hands-free typing</li>
              <li><Zap size={14} aria-hidden /> Per-question scoring after the round</li>
            </ul>
          </div>

          <div className="mode-card mode-card--featured">
            <div className="mode-icon mode-icon--premium">
              <Mic size={28} aria-hidden />
            </div>
            <div className="mode-credit mode-credit--premium">
              <Star size={14} aria-hidden /> Premium credit
            </div>
            <h3>Voice Interview</h3>
            <p className="mode-desc">
              Real-time spoken conversation. The AI speaks the question, you answer aloud,
              and it follows up like a human interviewer would.
            </p>
            <ul className="mode-features">
              <li><Zap size={14} aria-hidden /> OpenAI Realtime API — human-quality voice</li>
              <li><Zap size={14} aria-hidden /> Interrupt anytime, like a real interview</li>
              <li><Zap size={14} aria-hidden /> Hiring recommendation at the end</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────── */}
      <section className="landing-section">
        <h2 className="section-title">Everything you need to prep</h2>
        <p className="section-sub">Not just questions. A complete prep loop.</p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon"><Brain size={20} aria-hidden /></div>
            <h4>5 interviewer personas</h4>
            <p>Alex (DSA), Priya (System Design), Rohan (HR), Ananya (Tech), Vikram (Resume). Each with a distinct interviewing style.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BarChart3 size={20} aria-hidden /></div>
            <h4>Weak-topic analytics</h4>
            <p>Every wrong answer becomes a flagged topic. Next session, focus mode drills those exact gaps.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FileText size={20} aria-hidden /></div>
            <h4>Resume-aware interviews</h4>
            <p>Upload your resume once. Vikram asks about your actual projects and impact — not generic questions.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BookOpen size={20} aria-hidden /></div>
            <h4>Generated question bank</h4>
            <p>Stuck on a topic? Generate 20 fresh questions with model answers in seconds. Download as PDF.</p>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="landing-section">
        <h2 className="section-title">How it works</h2>
        <div className="how-steps">
          <div className="how-step">
            <span className="how-num">1</span>
            <h4>Sign up free</h4>
            <p>2 Basic + 1 Premium credit, no card required.</p>
          </div>
          <div className="how-step">
            <span className="how-num">2</span>
            <h4>Pick a round</h4>
            <p>DSA, System Design, HR, Tech, or Resume. Pick a target — Service Co., Startup, or FAANG.</p>
          </div>
          <div className="how-step">
            <span className="how-num">3</span>
            <h4>Get scored</h4>
            <p>Per-question scores, overall verdict, and weak-topic drills queued for next time.</p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="landing-cta">
        <h2>Ready for your next interview?</h2>
        <p>The first three are on us.</p>
        <Link to="/register" className="btn btn-primary btn-lg">
          Get Started Free
          <ArrowRight size={18} aria-hidden />
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <Target size={16} aria-hidden />
          <span>AI Interview Simulator</span>
        </div>
        <div className="footer-links">
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund">Refund</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
