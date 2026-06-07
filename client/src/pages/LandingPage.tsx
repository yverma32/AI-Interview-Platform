import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import {
  Target, MessageCircle, Mic, Diamond, Star,
  Brain, BookOpen, BarChart3, FileText,
  ArrowRight, Sparkles, ShieldCheck, Zap, Gift,
  Layers, Building2, Code2, Check, ChevronDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFoundingStatus } from '../hooks/useCredits';
import './Landing.css';

/* ── Persona data — drives the auto-cycling carousel below ───────────
   Cyan-accented personas: Alex (DSA), Rohan (HR), Vikram (Resume)
   Magenta-accented: Priya (System Design), Ananya (Tech)
   Alternation gives the carousel visual rhythm as it rotates. */
type PersonaAccent = 'cyan' | 'magenta';

interface Persona {
  id: string;
  initial: string;
  name: string;
  round: string;
  accent: PersonaAccent;
  tag: string;
  quote: string;
  quoteEm: string;
  sample: string;
}

const PERSONAS: Persona[] = [
  {
    id: 'alex',
    initial: 'A',
    name: 'Alex',
    round: 'DSA · Algorithms',
    accent: 'cyan',
    tag: 'Sharp',
    quote: 'Walk me through your approach {{em}} you write a single line. I’ll stop you if I see the bug coming.',
    quoteEm: 'before',
    sample: 'Longest subarray with all unique elements. Time and space?',
  },
  {
    id: 'priya',
    initial: 'P',
    name: 'Priya',
    round: 'System Design',
    accent: 'magenta',
    tag: 'Probing',
    quote: 'Cool, that works at 1K users. {{em}} make it work at 100M. What breaks first?',
    quoteEm: 'Now',
    sample: 'Design a URL shortener that handles 100M reads / day.',
  },
  {
    id: 'rohan',
    initial: 'R',
    name: 'Rohan',
    round: 'HR · Behavioural',
    accent: 'cyan',
    tag: 'Warm',
    quote: 'Tell me about the time it {{em}}. What did you do at 2am?',
    quoteEm: 'nearly fell apart',
    sample: 'Describe a time you disagreed with your manager. What did you do?',
  },
  {
    id: 'ananya',
    initial: 'A',
    name: 'Ananya',
    round: 'Tech · Cross-stack',
    accent: 'magenta',
    tag: 'Calm',
    quote: 'You said React reconciler. {{em}}. Why fiber?',
    quoteEm: 'Take me one layer deeper',
    sample: 'Explain how React 18’s concurrent rendering changes your app.',
  },
  {
    id: 'vikram',
    initial: 'V',
    name: 'Vikram',
    round: 'Resume Deep Dive',
    accent: 'cyan',
    tag: 'Curious',
    quote: 'Your resume says you led a migration. Let’s talk about the {{em}} you didn’t need.',
    quoteEm: 'rollback plan',
    sample: 'Why did you pick PostgreSQL over MongoDB on that project?',
  },
];

const PERSONA_INTERVAL_MS = 5500;

/* Small count-up hook used by the Phase 4 score gauge. Animates from 0 to
   the target value over `durationMs` once `start` flips to true. */
function useCountUp(target: number, start: boolean, durationMs = 1100, decimals = 1) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / durationMs, 1);
      // ease-out cubic — finishes with a soft landing rather than ramming the value
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, durationMs]);

  return value.toFixed(decimals);
}

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: foundingStatus } = useFoundingStatus();

  // ── Personas carousel state ────────────────────────────────────────
  // Auto-rotates every PERSONA_INTERVAL_MS unless the user is hovering or
  // prefers reduced motion. Visibility API pauses when the tab is hidden so
  // we don't burn cycles in background tabs.
  const [activePersona, setActivePersona] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const restartProgressRef = useRef(0); // bump to force the progress bar to restart on click

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPaused) return;

    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setActivePersona((i) => (i + 1) % PERSONAS.length);
    }, PERSONA_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPaused, activePersona]);

  const goToPersona = (index: number) => {
    setActivePersona(((index % PERSONAS.length) + PERSONAS.length) % PERSONAS.length);
    restartProgressRef.current += 1;
  };
  const goPrev = () => goToPersona(activePersona - 1);
  const goNext = () => goToPersona(activePersona + 1);

  // Render a persona's quote with its highlighted em phrase.
  const renderQuote = (p: Persona) => {
    const [before, after] = p.quote.split('{{em}}');
    return (
      <>
        <span className="persona-quote-mark">&ldquo;</span>
        {before}
        <em>{p.quoteEm}</em>
        {after}
      </>
    );
  };

  // ── Phase 4: report section reveal ───────────────────────────────
  // IntersectionObserver fires once when the report section enters the
  // viewport — toggling `revealReport` runs the count-up + bar fill + row
  // fade-in animations. Doesn't repeat (the observer disconnects).
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [revealReport, setRevealReport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Skip the animation entirely; show final state immediately.
      setRevealReport(true);
      return;
    }

    const node = reportRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealReport(true);
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Count-up values for the report mockup (only animate after reveal)
  const overallScore = useCountUp(8.3, revealReport, 1100, 1);
  const trendDelta = useCountUp(1.2, revealReport, 1100, 1);

  // If a logged-in user lands here (e.g. typed the root URL), send them to the dashboard.
  // Keeps the landing page exclusively for new/anonymous visitors.
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing">
      <SeoHead
        canonical="/"
        description="Practice real technical interviews with an AI voice or text interviewer. Real-time scoring, weak-topic analytics, company-specific tracks (TCS, Infosys, Razorpay, Google). Free to start — no credit card needed."
      />
      {/* ── Top nav ─────────────────────────────────────────────────── */}
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <Target size={22} aria-hidden />
          <span>PrepFinity</span>
        </Link>
        <nav className="landing-nav-links">
          <Link to="/blog" className="nav-link">Blog</Link>
          <Link to="/pricing" className="nav-link">Pricing</Link>
          <Link to="/login" className="nav-link">Sign In</Link>
          <Link to="/register" className="nav-cta">Get Started</Link>
        </nav>
      </header>

      {/* ── Hero (two-column: copy on left, live-interview mockup on right) ─ */}
      <section className="landing-hero">
        <div className="hero-grid">
          {/* ── Left column: copy + CTAs ─────────────────────────────── */}
          <div className="hero-copy">
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
                <span>AI mock interviews for engineers, worldwide</span>
              </div>
            )}

            <h1 className="hero-title">
              Practice the interviews{' '}
              <span className="grad-text">you&apos;ll actually face</span>.
            </h1>

            <p className="hero-sub">
              AI mock interviews for top companies — FAANG, Razorpay, Stripe, Swiggy, TCS, and more.
              Voice or text. Real-time scoring. Built by people who&apos;ve been on both sides of the table.
            </p>

            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg hero-cta-primary">
                Start Free — 3 Interviews
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link to="/pricing" className="btn btn-ghost btn-lg hero-cta-secondary">
                View Pricing
              </Link>
            </div>

            <ul className="hero-trust">
              <li>
                <ShieldCheck size={14} aria-hidden />
                <span>No credit card</span>
              </li>
              <li>
                <Sparkles size={14} aria-hidden />
                <span>3 free interviews</span>
              </li>
              <li>
                <Diamond size={14} aria-hidden />
                <span>Credits never expire</span>
              </li>
            </ul>
          </div>

          {/* ── Right column: live interview mockup (pure CSS/SVG, no images) ─ */}
          <div className="hero-mockup-wrap" aria-hidden>
            <div className="hero-mockup">
              {/* Subtle floating orbs in card background */}
              <span className="hero-mockup-orb hero-mockup-orb--cyan" />
              <span className="hero-mockup-orb hero-mockup-orb--magenta" />

              {/* Card header: persona + LIVE indicator */}
              <div className="hero-mockup-header">
                <div className="hero-mockup-persona">
                  <span className="hero-persona-avatar">A</span>
                  <div className="hero-persona-meta">
                    <div className="hero-persona-name">Alex</div>
                    <div className="hero-persona-sub">DSA Round · FAANG track</div>
                  </div>
                </div>
                <span className="hero-mockup-live">
                  <span className="hero-mockup-live-dot" />
                  LIVE
                </span>
              </div>

              {/* AI question bubble */}
              <div className="hero-mockup-bubble">
                <span className="hero-mockup-bubble-tag">Alex is asking</span>
                <p>
                  Given an array of n integers, find the longest subarray such that
                  all elements are unique. Walk me through your approach.
                </p>
              </div>

              {/* Live voice waveform */}
              <div className="hero-mockup-wave" role="presentation">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span key={i} className={`hero-mockup-bar hero-mockup-bar-${i % 6}`} />
                ))}
              </div>

              {/* User's transcription, with blinking caret */}
              <div className="hero-mockup-transcript">
                <span className="hero-mockup-transcript-label">You</span>
                <p>
                  Okay, so I&apos;m thinking sliding window with a hash set to track seen
                  characters<span className="hero-mockup-caret" />
                </p>
              </div>

              {/* Live score panel */}
              <div className="hero-mockup-score">
                <div className="hero-mockup-score-row">
                  <span className="hero-mockup-score-label">Score so far</span>
                  <span className="hero-mockup-score-value">
                    8.6<span className="hero-mockup-score-max"> / 10</span>
                  </span>
                </div>
                <div className="hero-mockup-score-track">
                  <span className="hero-mockup-score-fill" />
                </div>
                <div className="hero-mockup-score-tags">
                  <span>Time complexity</span>
                  <span>Edge cases</span>
                  <span>Communication</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Phase 2: pipeline section — left rail + setup mockup + live mockup ──
            Mirrors a Steo-style feature explainer in our cyberpunk aesthetic.
            Three columns on desktop, stacked on mobile. */}
      <section className="landing-section pipeline-section">
        <div className="pipeline-header">
          <div className="pipeline-eyebrow">
            <Sparkles size={14} aria-hidden />
            <span>How it works</span>
          </div>
          <h2 className="section-title">
            From job description to mock interview in{' '}
            <span className="grad-text">60 seconds</span>.
          </h2>
          <p className="section-sub">
            Pick a role, pick a round, get an AI interviewer tuned to that exact context.
          </p>
        </div>

        <div className="pipeline-grid">
          {/* ── Left rail: feature list with neon dots ────────────────── */}
          <aside className="pipeline-rail">
            <ul className="pipeline-rail-list">
              <li className="pipeline-rail-item is-active">
                <span className="pipeline-rail-dot pipeline-rail-dot--cyan" />
                <div>
                  <div className="pipeline-rail-title">Role-based interviews</div>
                  <div className="pipeline-rail-desc">
                    Paste a job description, get a tailored 5-round pipeline.
                  </div>
                </div>
              </li>
              <li className="pipeline-rail-item">
                <span className="pipeline-rail-dot pipeline-rail-dot--magenta" />
                <div className="pipeline-rail-title">5 AI interviewer personas</div>
              </li>
              <li className="pipeline-rail-item">
                <span className="pipeline-rail-dot pipeline-rail-dot--cyan" />
                <div className="pipeline-rail-title">Voice and text modes</div>
              </li>
              <li className="pipeline-rail-item">
                <span className="pipeline-rail-dot pipeline-rail-dot--magenta" />
                <div className="pipeline-rail-title">Company-specific tracks</div>
              </li>
              <li className="pipeline-rail-item">
                <span className="pipeline-rail-dot pipeline-rail-dot--cyan" />
                <div className="pipeline-rail-title">Real-time scoring</div>
              </li>
              <li className="pipeline-rail-item">
                <span className="pipeline-rail-dot pipeline-rail-dot--magenta" />
                <div className="pipeline-rail-title">Weak-topic drilling</div>
              </li>
            </ul>
          </aside>

          {/* ── Middle: "Set up your interview" mockup ────────────────── */}
          <div className="pipeline-card pipeline-card--setup" aria-hidden>
            <div className="pipeline-card-head">
              <span className="pipeline-card-step">
                <span className="pipeline-step-num">01</span>
                Set up
              </span>
              <span className="pipeline-card-title">New interview</span>
            </div>

            <div className="pipeline-field">
              <label>Technology</label>
              <div className="pipeline-chips">
                <span className="pipeline-chip is-selected">
                  <Check size={11} aria-hidden /> React
                </span>
                <span className="pipeline-chip is-selected">
                  <Check size={11} aria-hidden /> Node.js
                </span>
                <span className="pipeline-chip">TypeScript</span>
                <span className="pipeline-chip">Postgres</span>
                <span className="pipeline-chip is-muted">+ 14 more</span>
              </div>
            </div>

            <div className="pipeline-field">
              <label>Experience</label>
              <div className="pipeline-select">
                Mid-level (2–5 yrs)
                <ChevronDown size={14} aria-hidden />
              </div>
            </div>

            <div className="pipeline-field">
              <label>Round</label>
              <div className="pipeline-radios">
                <span className="pipeline-radio">
                  <Code2 size={13} aria-hidden /> DSA
                </span>
                <span className="pipeline-radio is-selected">
                  <Layers size={13} aria-hidden /> System Design
                </span>
                <span className="pipeline-radio">
                  <MessageCircle size={13} aria-hidden /> HR
                </span>
              </div>
            </div>

            <div className="pipeline-field">
              <label>Company track</label>
              <div className="pipeline-track-card">
                <span className="pipeline-track-icon">
                  <Building2 size={16} aria-hidden />
                </span>
                <div>
                  <div className="pipeline-track-name">FAANG</div>
                  <div className="pipeline-track-companies">Google · Microsoft · Amazon</div>
                </div>
                <Check size={14} className="pipeline-track-check" aria-hidden />
              </div>
            </div>

            <button className="pipeline-cta" type="button">
              Start Interview
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>

          {/* ── Right: "Live interview" mockup (Priya · System Design) ── */}
          <div className="pipeline-card pipeline-card--live" aria-hidden>
            <div className="pipeline-card-head">
              <span className="pipeline-card-step">
                <span className="pipeline-step-num">02</span>
                In progress
              </span>
              <span className="pipeline-live-pill">
                <span className="pipeline-live-dot" /> LIVE
              </span>
            </div>

            <div className="pipeline-persona">
              <span className="pipeline-persona-avatar">P</span>
              <div>
                <div className="pipeline-persona-name">Priya</div>
                <div className="pipeline-persona-sub">System Design · Senior</div>
              </div>
            </div>

            <div className="pipeline-bubble">
              <span className="pipeline-bubble-tag">Priya is asking</span>
              <p>
                Design a URL shortener that handles 100M reads / day. Walk me through
                your high-level architecture first.
              </p>

              {/* Tiny architecture diagram inside the question bubble */}
              <div className="pipeline-arch">
                <span className="pipeline-arch-box">Client</span>
                <span className="pipeline-arch-arrow">→</span>
                <span className="pipeline-arch-box pipeline-arch-box--accent">API</span>
                <span className="pipeline-arch-arrow">→</span>
                <span className="pipeline-arch-box">Cache</span>
                <span className="pipeline-arch-arrow">→</span>
                <span className="pipeline-arch-box">DB</span>
              </div>
            </div>

            <div className="pipeline-score">
              <div className="pipeline-score-head">
                <span className="pipeline-score-label">Live score</span>
                <span className="pipeline-score-value">
                  9.1<span className="pipeline-score-max"> / 10</span>
                </span>
              </div>
              <div className="pipeline-score-track">
                <span className="pipeline-score-fill" />
              </div>
              <div className="pipeline-score-tags">
                <span>Scalability</span>
                <span>Trade-offs</span>
                <span>Clarity</span>
              </div>
            </div>
          </div>
        </div>

        <p className="pipeline-caption">
          Same engine. Different personas. Real interviews, every time.
        </p>
      </section>

      {/* ── Phase 3: Personas grid ──────────────────────────────────── */}
      <section className="landing-section personas-section">
        <div className="personas-header">
          <div className="personas-eyebrow">
            <Brain size={14} aria-hidden />
            <span>Your interviewer panel</span>
          </div>
          <h2 className="section-title">
            Five interviewers. Five styles.{' '}
            <span className="grad-text">One you.</span>
          </h2>
          <p className="section-sub">
            Each persona has its own voice, its own style of probing, and its own way of grading.
            Pick whichever round you&apos;re preparing for.
          </p>
        </div>

        {/* Holographic carousel: cards live in 3D space, rotated around a perspective.
            offset relative to active persona: 0 = center, ±1 = side peek, ±2 = far edge.
            CSS uses data-offset to position each card. */}
        <div
          className="personas-carousel personas-carousel--holo"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          style={{ '--active-accent-cyan': PERSONAS[activePersona].accent === 'cyan' ? 1 : 0 } as React.CSSProperties}
        >
          {/* Active-persona accent backdrop — radial glow that shifts color as you advance */}
          <div
            className="personas-holo-backdrop"
            data-accent={PERSONAS[activePersona].accent}
            aria-hidden
          />

          {/* Scanline overlay for the cyberpunk terminal feel */}
          <div className="personas-holo-scanlines" aria-hidden />

          {/* Stage: all 5 cards in 3D space, rotated by their offset */}
          <div
            className="personas-stage personas-stage--holo"
            role="region"
            aria-label="AI interviewer personas"
            data-active-id={PERSONAS[activePersona].id}
          >
            {PERSONAS.map((p, i) => {
              // Signed offset from active, wrapped to [-2, +2] range
              const n = PERSONAS.length;
              let offset = i - activePersona;
              if (offset > n / 2) offset -= n;
              if (offset < -n / 2) offset += n;
              const isActive = offset === 0;

              return (
                <article
                  key={p.id}
                  className={`persona-card persona-card--holo ${isActive ? 'is-active' : ''}`}
                  data-persona={p.id}
                  data-offset={offset}
                  aria-hidden={!isActive}
                  aria-labelledby={`persona-name-${p.id}`}
                  onClick={() => !isActive && goToPersona(i)}
                >
                  {/* Glitch boot scanline that sweeps across when the card becomes active */}
                  {isActive && (
                    <span
                      key={`boot-${activePersona}`}
                      className="persona-card-bootline"
                      aria-hidden
                    />
                  )}

                  <header className="persona-card-head">
                    <span className={`persona-avatar persona-avatar--${p.accent}`}>{p.initial}</span>
                    <div>
                      <div className="persona-name" id={`persona-name-${p.id}`}>{p.name}</div>
                      <div className="persona-round">{p.round}</div>
                    </div>
                    <span className={`persona-tag persona-tag--${p.accent}`}>{p.tag}</span>
                  </header>
                  <p className="persona-quote">{renderQuote(p)}</p>
                  <footer className="persona-card-foot">
                    <span className="persona-foot-label">Sample question</span>
                    <p className="persona-sample">{p.sample}</p>
                  </footer>
                </article>
              );
            })}

            {/* Manual nav arrows — float over the stage on desktop */}
            <button
              type="button"
              className="personas-arrow personas-arrow--holo personas-arrow--prev"
              onClick={goPrev}
              aria-label="Previous persona"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="personas-arrow personas-arrow--holo personas-arrow--next"
              onClick={goNext}
              aria-label="Next persona"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>

          {/* Thumbnail strip: 5 mini avatars + the active one's progress bar */}
          <div className="personas-thumbs" role="tablist" aria-label="Choose interviewer persona">
            {PERSONAS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === activePersona}
                aria-label={`${p.name}, ${p.round}`}
                className={`personas-thumb personas-thumb--${p.accent} ${
                  i === activePersona ? 'is-active' : ''
                }`}
                onClick={() => goToPersona(i)}
              >
                <span className="personas-thumb-avatar">{p.initial}</span>
                <span className="personas-thumb-meta">
                  <span className="personas-thumb-name">{p.name}</span>
                  <span className="personas-thumb-round">{p.round}</span>
                </span>
                {/* Progress bar shows for the active thumbnail; the key prop
                    forces a fresh element so the CSS animation restarts whenever
                    the user clicks (otherwise jumping to the same persona twice
                    would silently fail to reset). */}
                {i === activePersona && !isPaused && (
                  <span
                    key={`progress-${activePersona}-${restartProgressRef.current}`}
                    className="personas-thumb-progress"
                    style={{ animationDuration: `${PERSONA_INTERVAL_MS}ms` }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Phase 4: Post-interview report mockup ───────────────────── */}
      <section
        ref={reportRef}
        className={`landing-section report-section ${revealReport ? 'is-revealed' : ''}`}
      >
        {/* Subtle data-grid backdrop, anchored to the section */}
        <div className="report-grid-bg" aria-hidden />

        <div className="report-header">
          <div className="report-eyebrow">
            <BarChart3 size={14} aria-hidden />
            <span>Report generated · 12:48 AM</span>
          </div>
          <h2 className="section-title">
            Every session, a real report.{' '}
            <span className="grad-text">Not a participation trophy.</span>
          </h2>
          <p className="section-sub">
            Every answer gets scored. Every gap gets flagged. Every next session gets queued.
            Built so you can stop guessing how prepared you are.
          </p>
        </div>

        {/* ── Three-column report mockup ───────────────────────────── */}
        <div className="report-dashboard" aria-hidden>
          {/* ── Left: overall score gauge + sub-scores ─────────────── */}
          <div className="report-card report-card--score">
            <div className="report-card-head">
              <span className="report-card-label">Overall · DSA round</span>
              <span className="report-trend">
                <span className="report-trend-arrow">↑</span>
                +{trendDelta} vs last
              </span>
            </div>

            <div className="report-gauge">
              <div className="report-gauge-ring">
                <svg viewBox="0 0 120 120" width="180" height="180" aria-hidden>
                  <defs>
                    <linearGradient id="report-gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--neon-cyan)" />
                      <stop offset="100%" stopColor="var(--neon-magenta)" />
                    </linearGradient>
                  </defs>
                  {/* Background ring */}
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke="color-mix(in srgb, var(--text-primary) 8%, transparent)"
                    strokeWidth="10"
                  />
                  {/* Filled arc — strokeDashoffset animates via CSS */}
                  <circle
                    className="report-gauge-arc"
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke="url(#report-gauge-grad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="314.16"
                    strokeDashoffset="314.16"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="report-gauge-value">
                  <span className="report-gauge-num">{overallScore}</span>
                  <span className="report-gauge-max">/ 10</span>
                </div>
              </div>
            </div>

            <ul className="report-subscores">
              <li>
                <span className="report-subscore-label">Technical depth</span>
                <span className="report-subscore-bar">
                  <span className="report-subscore-fill" style={{ ['--target' as string]: '92%' }} />
                </span>
                <span className="report-subscore-value">9.2</span>
              </li>
              <li>
                <span className="report-subscore-label">Communication</span>
                <span className="report-subscore-bar">
                  <span className="report-subscore-fill" style={{ ['--target' as string]: '76%' }} />
                </span>
                <span className="report-subscore-value">7.6</span>
              </li>
              <li>
                <span className="report-subscore-label">Problem-solving</span>
                <span className="report-subscore-bar">
                  <span className="report-subscore-fill" style={{ ['--target' as string]: '81%' }} />
                </span>
                <span className="report-subscore-value">8.1</span>
              </li>
            </ul>
          </div>

          {/* ── Center: per-question timeline ──────────────────────── */}
          <div className="report-card report-card--timeline">
            <div className="report-card-head">
              <span className="report-card-label">Per-question replay</span>
              <span className="report-card-meta">5 questions · 38 min</span>
            </div>

            <ol className="report-timeline">
              <li className="report-row" data-rating="great">
                <span className="report-row-num">01</span>
                <div className="report-row-body">
                  <div className="report-row-title">Sliding window — unique substring</div>
                  <div className="report-row-meta">DSA · 4 follow-ups</div>
                </div>
                <span className="report-row-score">9.0</span>
              </li>
              <li className="report-row" data-rating="great">
                <span className="report-row-num">02</span>
                <div className="report-row-body">
                  <div className="report-row-title">Two-pointer — sorted array merge</div>
                  <div className="report-row-meta">DSA · 2 follow-ups</div>
                </div>
                <span className="report-row-score">9.4</span>
              </li>
              <li className="report-row" data-rating="ok">
                <span className="report-row-num">03</span>
                <div className="report-row-body">
                  <div className="report-row-title">Binary tree — level-order traversal</div>
                  <div className="report-row-meta">DSA · stumbled on edge case</div>
                </div>
                <span className="report-row-score">7.2</span>
              </li>
              <li className="report-row is-active" data-rating="ok">
                <span className="report-row-num">04</span>
                <div className="report-row-body">
                  <div className="report-row-title">Concurrency — producer/consumer</div>
                  <div className="report-row-meta">DSA · race condition missed</div>
                </div>
                <span className="report-row-score">7.5</span>
              </li>
              <li className="report-row" data-rating="great">
                <span className="report-row-num">05</span>
                <div className="report-row-body">
                  <div className="report-row-title">Hash map — anagram grouping</div>
                  <div className="report-row-meta">DSA · clean and fast</div>
                </div>
                <span className="report-row-score">8.4</span>
              </li>
            </ol>
          </div>

          {/* ── Right: weak topics + queued recommendation ─────────── */}
          <div className="report-card report-card--weak">
            <div className="report-card-head">
              <span className="report-card-label">Topics to drill</span>
              <span className="report-card-meta">Flagged from 3 sessions</span>
            </div>

            <ul className="report-weak-list">
              <li>
                <div className="report-weak-row">
                  <span className="report-weak-name">Binary trees</span>
                  <span className="report-weak-pct">62%</span>
                </div>
                <span className="report-weak-bar">
                  <span className="report-weak-fill" style={{ ['--target' as string]: '62%' }} />
                </span>
              </li>
              <li>
                <div className="report-weak-row">
                  <span className="report-weak-name">Concurrency</span>
                  <span className="report-weak-pct">68%</span>
                </div>
                <span className="report-weak-bar">
                  <span className="report-weak-fill" style={{ ['--target' as string]: '68%' }} />
                </span>
              </li>
              <li>
                <div className="report-weak-row">
                  <span className="report-weak-name">Hash map collisions</span>
                  <span className="report-weak-pct">74%</span>
                </div>
                <span className="report-weak-bar">
                  <span className="report-weak-fill" style={{ ['--target' as string]: '74%' }} />
                </span>
              </li>
            </ul>

            <div className="report-queue">
              <div className="report-queue-label">
                <Sparkles size={12} aria-hidden />
                Auto-queued for next session
              </div>
              <div className="report-queue-card">
                <div className="report-queue-title">Focus drill: Binary trees</div>
                <div className="report-queue-meta">10 questions · ~25 min</div>
              </div>
              <button className="report-queue-cta" type="button">
                Start next session
                <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Legacy sections (kept in source, hidden via CSS) ──────────
            Old "Choose how you want to practice", features grid, "How it works",
            and old final CTA. Hidden behind .landing-legacy { display: none }.
            Trivial to bring back by removing that one CSS rule. */}
      <div className="landing-legacy" aria-hidden hidden>
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

      {/* ── Final CTA (old, hidden via .landing-legacy) ─────────────── */}
      <section className="landing-cta">
        <h2>Ready for your next interview?</h2>
        <p>The first three are on us.</p>
        <Link to="/register" className="btn btn-primary btn-lg">
          Get Started Free
          <ArrowRight size={18} aria-hidden />
        </Link>
      </section>
      </div>
      {/* end .landing-legacy */}

      {/* ── Phase 5a: FAQ ─────────────────────────────────────────── */}
      <section className="landing-section faq-section">
        <div className="faq-header">
          <div className="faq-eyebrow">
            <BookOpen size={14} aria-hidden />
            <span>Common questions</span>
          </div>
          <h2 className="section-title">
            What candidates ask before{' '}
            <span className="grad-text">their first session.</span>
          </h2>
        </div>

        <div className="faq-list">
          <details className="faq-item">
            <summary>
              <span>How is this different from just talking to ChatGPT?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                ChatGPT will give you a single question, accept your answer, and move on.
                A real interviewer probes — they ask &ldquo;what if the load doubles,&rdquo;
                &ldquo;walk me through the edge cases,&rdquo; &ldquo;why this approach over that one.&rdquo;
                PrepFinity is engineered around that follow-up loop. Each persona is tuned
                to push you the way a senior engineer would, then scores you on how you
                handled the pressure — not just the final answer.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              <span>Is the scoring actually accurate?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                Scoring is calibrated against rubrics built with engineers who&apos;ve
                conducted hundreds of real interviews at FAANG, Razorpay-tier startups,
                and major service companies. It will not match a specific human
                interviewer exactly — neither will two humans match each other — but
                the per-question scores and weak-topic flags are consistent enough
                to drive real practice decisions. Use the rubric breakdown, not the
                single score, as your signal.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              <span>Do the same questions repeat across sessions?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                The AI is prompted to avoid topics it has asked you in past sessions.
                You&apos;ll see fresh question variants almost every time. If you&apos;re
                using Focus Mode on a specific weak topic, you&apos;ll see questions on
                that topic by design — but the framings will rotate.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              <span>What does the voice interview actually feel like?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                It runs on OpenAI&apos;s Realtime API. The latency is conversational
                — the AI will interrupt if you go off track and let you interrupt
                back. The voices for each persona are deliberately different. It is
                noticeably less robotic than text-to-speech you&apos;ve heard
                elsewhere. The trade-off: voice sessions use Premium credits.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              <span>What happens after the free credits run out?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                Nothing automatic. No card on file, no surprise charges. You can
                keep using whatever&apos;s left of your free credits as long as you
                want; they don&apos;t expire. When you&apos;re ready for more,
                packs start at &#8377;199 and you only buy what you need. Pricing
                is on the <Link to="/pricing">pricing page</Link>.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              <span>Is this only for Indian companies?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                No. The platform works for any technical interview in English. The
                company tracks (Service / Startup / FAANG) cover both Indian and
                global companies — Google, Microsoft, Amazon on the FAANG side;
                Razorpay, Stripe, Swiggy on the Startup side; TCS, Infosys, Wipro
                on the Service side. Pricing is in INR but card payments work
                internationally via Razorpay.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              <span>Will it work on my phone?</span>
              <span className="faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="faq-body">
              <p>
                Yes. Both text and voice interviews work on iOS and Android via the
                browser. For voice on iOS, use Safari (Chrome on iOS has some audio
                quirks). Headphones strongly recommended for voice sessions —
                anywhere there&apos;s open-mic feedback, the AI will detect itself
                speaking and get confused.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* ── Phase 5b: Final CTA ───────────────────────────────────── */}
      <section className="final-cta-section">
        <div className="final-cta-panel">
          {/* Decorative corner brackets — HUD reticle feel */}
          <span className="final-cta-corner final-cta-corner--tl" aria-hidden />
          <span className="final-cta-corner final-cta-corner--tr" aria-hidden />
          <span className="final-cta-corner final-cta-corner--bl" aria-hidden />
          <span className="final-cta-corner final-cta-corner--br" aria-hidden />

          {/* Soft glow orbs */}
          <span className="final-cta-orb final-cta-orb--cyan" aria-hidden />
          <span className="final-cta-orb final-cta-orb--magenta" aria-hidden />

          <div className="final-cta-eyebrow">
            <span className="final-cta-eyebrow-tick">&#9656;</span>
            READY?
          </div>

          <h2 className="final-cta-title">
            Stop wondering if you&apos;re ready.{' '}
            <span className="grad-text">Find out tonight.</span>
          </h2>

          <p className="final-cta-sub">
            Three interviews on the house. No card. No bait-and-switch. If you don&apos;t
            get a real report at the end, we&apos;d be surprised.
          </p>

          <div className="final-cta-actions">
            <Link to="/register" className="btn btn-primary btn-lg final-cta-primary">
              Start Free — 3 Interviews
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/pricing" className="btn btn-ghost btn-lg final-cta-secondary">
              See Pricing
            </Link>
          </div>

          <ul className="final-cta-trust">
            <li>
              <ShieldCheck size={14} aria-hidden />
              <span>No credit card</span>
            </li>
            <li>
              <Sparkles size={14} aria-hidden />
              <span>3 free interviews</span>
            </li>
            <li>
              <Diamond size={14} aria-hidden />
              <span>Credits never expire</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Footer (Phase 6: multi-column) ─────────────────────────── */}
      <footer className="landing-footer landing-footer--multi">
        {/* Soft top-edge gradient line separating the footer from the CTA above */}
        <div className="footer-edge" aria-hidden />

        <div className="footer-grid">
          {/* Left: brand block */}
          <div className="footer-brand-block">
            <Link to="/" className="footer-brand-mark">
              <Target size={20} aria-hidden />
              <span>PrepFinity</span>
            </Link>
            <p className="footer-brand-tagline">
              AI mock interviews for engineers, worldwide. Voice or text.
              Real-time scoring. Honest reports.
            </p>
            <ul className="footer-trust">
              <li>
                <ShieldCheck size={13} aria-hidden />
                <span>No card on file</span>
              </li>
              <li>
                <Sparkles size={13} aria-hidden />
                <span>3 free interviews on signup</span>
              </li>
              <li>
                <Diamond size={13} aria-hidden />
                <span>Credits never expire</span>
              </li>
            </ul>
          </div>

          {/* Product */}
          <nav className="footer-col" aria-labelledby="footer-product">
            <h3 className="footer-col-title" id="footer-product">Product</h3>
            <ul>
              <li><Link to="/register">Get started</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/login">Sign in</Link></li>
            </ul>
          </nav>

          {/* Resources */}
          <nav className="footer-col" aria-labelledby="footer-resources">
            <h3 className="footer-col-title" id="footer-resources">Resources</h3>
            <ul>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/blog/top-10-ai-mock-interview-mistakes">Mistakes to avoid</Link></li>
              <li><Link to="/blog/tcs-technical-interview-process-step-by-step">TCS interview guide</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </nav>

          {/* Legal */}
          <nav className="footer-col" aria-labelledby="footer-legal">
            <h3 className="footer-col-title" id="footer-legal">Legal</h3>
            <ul>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/refund">Refund Policy</Link></li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar: copyright + minimalist meta */}
        <div className="footer-bottom">
          <span className="footer-copyright">
            © {new Date().getFullYear()} PrepFinity. Built for honest interview prep.
          </span>
          <span className="footer-meta">
            Made with care in India · Used worldwide
          </span>
        </div>
      </footer>
    </div>
  );
}
