import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check, Diamond, Star, MessageCircle, Sparkles, Gift,
  ShieldCheck, ArrowRight, ArrowLeft, BookOpen, Target,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SeoHead from '../components/SeoHead';
import {
  useCredits, useCreditPacks, useCreateOrder, useVerifyPayment, useFoundingStatus,
  type CreditPack,
} from '../hooks/useCredits';
import { useGeoLocation } from '../hooks/useGeoLocation';
import CreditBalanceBadge from '../components/CreditBalanceBadge';
import FoundingMemberModal from '../components/FoundingMemberModal';
import { analytics } from '../services/analytics';
import './Pricing.css';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { name: string; email: string };
  theme: { color: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { currency } = useGeoLocation();
  const { data: packsData, isLoading: packsLoading } = useCreditPacks();
  const { data: credits } = useCredits();
  const { data: foundingStatus } = useFoundingStatus();
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();

  const [processingPack, setProcessingPack] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const currencySymbol = currency === 'INR' ? '₹' : '$';
  const getPrice = (pack: CreditPack) => currency === 'INR' ? pack.priceINR : pack.priceUSD;

  // Founding-member celebration modal state. Surfaced when verify response says the 2× bonus fired.
  const [foundingModal, setFoundingModal] = useState<{
    open: boolean;
    packName: string;
    basicCreditsAdded: number;
    premiumCreditsAdded: number;
  }>({ open: false, packName: '', basicCreditsAdded: 0, premiumCreditsAdded: 0 });

  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  const handleBuy = async (pack: CreditPack) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!scriptLoaded || !window.Razorpay) {
      setFeedback({ kind: 'error', message: 'Payment system is loading. Please try again in a moment.' });
      return;
    }

    setProcessingPack(pack.id);
    setFeedback(null);

    try {
      const order = await createOrder.mutateAsync({ packId: pack.id, currency });

      const options: RazorpayOptions = {
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'PrepFinity',
        description: order.packName,
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            const result = await verifyPayment.mutateAsync({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (result.success) {
              analytics.creditsPurchased(pack.id, pack.basicCredits, pack.premiumCredits);
              // If the founding-member 2× bonus fired, surface the celebration modal instead of
              // the generic toast — the modal owns the post-purchase communication.
              if (result.foundingMemberBonusApplied) {
                setFoundingModal({
                  open: true,
                  packName: pack.name,
                  basicCreditsAdded: result.basicCreditsAdded,
                  premiumCreditsAdded: result.premiumCreditsAdded,
                });
              } else {
                const parts: string[] = [];
                if (result.basicCreditsAdded > 0) parts.push(`${result.basicCreditsAdded} Basic`);
                if (result.premiumCreditsAdded > 0) parts.push(`${result.premiumCreditsAdded} Premium`);
                setFeedback({
                  kind: 'success',
                  message: parts.length > 0
                    ? `${parts.join(' + ')} credits added to your account!`
                    : (result.message || 'Credits added!'),
                });
              }
            } else {
              setFeedback({ kind: 'error', message: result.message || 'Payment verification failed.' });
            }
          } catch {
            setFeedback({ kind: 'error', message: 'Payment verification failed. If you were charged, contact support.' });
          } finally {
            setProcessingPack(null);
          }
        },
        prefill: {
          name: user?.fullName || '',
          email: user?.email || '',
        },
        theme: { color: '#6366f1' },
        modal: { ondismiss: () => setProcessingPack(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setFeedback({ kind: 'error', message: 'Failed to initiate payment. Please try again.' });
      setProcessingPack(null);
    }
  };

  const packs = packsData?.packs ?? [];

  // Head tags need to render in both states so pre-rendering captures them
  // (during SSG, packsLoading is always true and the early return runs first).
  const head = (
    <SeoHead
      title="Pricing — AI Mock Interview Credits"
      description="Affordable AI mock interview pricing from ₹199. Buy text and voice interview credits that never expire. Pay with UPI, cards, or wallets via Razorpay. First 50 buyers get 2× credits."
      canonical="/pricing"
    />
  );

  if (packsLoading) {
    return (
      <div className="pricing-page">
        {head}
        <div className="pricing-loading">Loading credit packs...</div>
      </div>
    );
  }

  return (
    <div className="pricing-page pricing-page--neo">
      {head}

      {/* Ambient glow backdrop — matches the landing aesthetic */}
      <div className="pricing-bg" aria-hidden>
        <div className="pricing-bg-orb pricing-bg-orb--cyan" />
        <div className="pricing-bg-orb pricing-bg-orb--magenta" />
      </div>

      {/* Pinned top-left back affordance — sits outside the centered header
          so it reads as page navigation, not body content. */}
      <button
        className="pricing-back"
        onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
        aria-label={isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}
      >
        <ArrowLeft size={14} aria-hidden />
        <span>{isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}</span>
      </button>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="pricing-header">
        <div className="pricing-eyebrow">
          <span className="pricing-eyebrow-tick">&#9656;</span>
          PRICING
        </div>

        <h1 className="pricing-h1">
          Credits never expire.{' '}
          <span className="grad-text">Use them at your pace.</span>
        </h1>
        <p className="pricing-subtitle">
          No subscriptions. Buy packs of interviews — keep them forever. UPI, cards, wallets via Razorpay.
        </p>

        {isAuthenticated && credits && (
          <div className="pricing-balance-wrap">
            <CreditBalanceBadge basicCredits={credits.basicCredits} premiumCredits={credits.premiumCredits} />
          </div>
        )}

        {!isAuthenticated && (
          <div className="pricing-free-banner" role="status">
            <ShieldCheck size={15} aria-hidden />
            <span>
              Sign up free — get <strong>2 Basic + 1 Premium</strong> credit instantly. No card needed.
            </span>
          </div>
        )}
      </header>

      {/* ── Founding member promo ──────────────────────────────────── */}
      {foundingStatus?.active && (
        <div className="founding-banner founding-banner--neo" role="status">
          <span className="founding-banner-icon">
            <Gift size={16} aria-hidden />
          </span>
          <div className="founding-banner-text">
            <strong>Founding Member offer</strong>
            <span>
              First {foundingStatus.totalSpots} buyers get{' '}
              <strong>2× credits</strong> on any pack — limited time.
            </span>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`pricing-feedback pricing-feedback--${feedback.kind}`} role="status">
          {feedback.message}
        </div>
      )}

      <FoundingMemberModal
        open={foundingModal.open}
        packName={foundingModal.packName}
        basicCreditsAdded={foundingModal.basicCreditsAdded}
        premiumCreditsAdded={foundingModal.premiumCreditsAdded}
        onClose={() => setFoundingModal((p) => ({ ...p, open: false }))}
      />

      {/* ── Pricing grid ───────────────────────────────────────────── */}
      <section className="pricing-grid pricing-grid--neo">
        {packs.map((pack) => (
          <article
            key={pack.id}
            className={`plan-card ${pack.highlight ? 'plan-card--featured' : ''}`}
          >
            {pack.highlight && (
              <div className="plan-featured-badge">
                <Sparkles size={11} aria-hidden />
                Most Popular
              </div>
            )}

            <div className="plan-card-head">
              <h2 className="plan-name">{pack.name}</h2>
              <div className="plan-price">
                <span className="plan-price-currency">{currencySymbol}</span>
                <span className="plan-price-amount">{getPrice(pack)}</span>
              </div>
            </div>

            <div className="plan-credits">
              <div className="plan-credit-line plan-credit-line--basic">
                <Diamond size={14} aria-hidden />
                <strong>{pack.basicCredits}</strong>
                <span>Basic interview{pack.basicCredits === 1 ? '' : 's'}</span>
              </div>
              <div className={`plan-credit-line plan-credit-line--premium ${pack.premiumCredits === 0 ? 'is-empty' : ''}`}>
                <Star size={14} aria-hidden />
                <strong>{pack.premiumCredits > 0 ? pack.premiumCredits : '—'}</strong>
                <span>{pack.premiumCredits > 0 ? `Premium interview${pack.premiumCredits === 1 ? '' : 's'}` : 'No Premium'}</span>
              </div>
            </div>

            <ul className="plan-features">
              <li>
                <Check className="plan-check" size={13} aria-hidden />
                <span>{pack.description}</span>
              </li>
              <li>
                <Check className="plan-check" size={13} aria-hidden />
                <span>Credits never expire</span>
              </li>
              <li>
                <Check className="plan-check" size={13} aria-hidden />
                <span>Detailed scoring &amp; feedback report</span>
              </li>
            </ul>

            <button
              className={`plan-cta ${pack.highlight ? 'plan-cta--featured' : ''}`}
              disabled={processingPack !== null}
              onClick={() => handleBuy(pack)}
            >
              {processingPack === pack.id
                ? 'Processing…'
                : `Buy for ${currencySymbol}${getPrice(pack)}`}
              {processingPack !== pack.id && <ArrowRight size={14} aria-hidden />}
            </button>
          </article>
        ))}
      </section>

      {/* ── Basic vs Premium comparison ────────────────────────────── */}
      <section className="mode-compare-section">
        <div className="mode-compare-header">
          <div className="mode-compare-eyebrow">
            <BookOpen size={14} aria-hidden />
            <span>What you actually get</span>
          </div>
          <h2 className="mode-compare-title">
            Basic vs Premium — <span className="grad-text">the real difference.</span>
          </h2>
        </div>

        <div className="mode-compare-grid">
          <article className="mode-compare-card">
            <header className="mode-compare-card-head">
              <span className="mode-compare-avatar mode-compare-avatar--cyan">A</span>
              <div>
                <div className="mode-compare-mode">Basic</div>
                <div className="mode-compare-mode-sub">Text-mode interview · with Alex</div>
              </div>
              <span className="mode-compare-tag mode-compare-tag--cyan">
                <Diamond size={11} aria-hidden /> 1 credit
              </span>
            </header>
            <ul className="mode-compare-list">
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>Text questions on screen, type or dictate your answer</span>
              </li>
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>GPT-4o scoring with per-question feedback</span>
              </li>
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>Submit at your own pace — no live timer pressure</span>
              </li>
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>Great for daily reps, commutes, or when you can&apos;t talk</span>
              </li>
            </ul>
          </article>

          <article className="mode-compare-card mode-compare-card--premium">
            <header className="mode-compare-card-head">
              <span className="mode-compare-avatar mode-compare-avatar--magenta">P</span>
              <div>
                <div className="mode-compare-mode">Premium</div>
                <div className="mode-compare-mode-sub">Voice-mode interview · with Priya</div>
              </div>
              <span className="mode-compare-tag mode-compare-tag--magenta">
                <Star size={11} aria-hidden /> 1 credit
              </span>
            </header>
            <ul className="mode-compare-list">
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>AI speaks questions aloud — full voice conversation</span>
              </li>
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>OpenAI Realtime API, low-latency, can be interrupted</span>
              </li>
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>Follow-ups feel like a real human interviewer</span>
              </li>
              <li>
                <Check size={13} className="plan-check" aria-hidden />
                <span>The closest thing to a real screening round, before the real one</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── Pricing FAQ (accordion) ────────────────────────────────── */}
      <section className="pricing-faq-section">
        <div className="pricing-faq-header">
          <div className="pricing-faq-eyebrow">
            <MessageCircle size={14} aria-hidden />
            <span>Pricing questions</span>
          </div>
          <h2 className="pricing-faq-title">
            What buyers ask <span className="grad-text">before checking out.</span>
          </h2>
        </div>

        <div className="pricing-faq-list">
          <details className="pricing-faq-item">
            <summary>
              <span>Do credits really never expire?</span>
              <span className="pricing-faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="pricing-faq-body">
              <p>
                Yes. No subscription, no monthly cycle, no &ldquo;use it or lose it.&rdquo;
                Buy a pack today, take a 6-month break, come back, the credits are still there.
                We deduct only when an interview actually starts.
              </p>
            </div>
          </details>

          <details className="pricing-faq-item">
            <summary>
              <span>Can I mix Basic and Premium in one pack?</span>
              <span className="pricing-faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="pricing-faq-body">
              <p>
                The Premium Pack and Pro Pack include both kinds of credits — buy
                those if you want a mix. Starter and Basic packs are text-only. You
                choose the mode at the start of each session.
              </p>
            </div>
          </details>

          <details className="pricing-faq-item">
            <summary>
              <span>What payment methods work?</span>
              <span className="pricing-faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="pricing-faq-body">
              <p>
                All Razorpay-supported methods: UPI (PhonePe, Google Pay, Paytm),
                credit cards, debit cards, net banking, and most wallets. International
                cards also work — we&apos;ll switch the currency to USD automatically
                based on your location.
              </p>
            </div>
          </details>

          <details className="pricing-faq-item">
            <summary>
              <span>What if I run out mid-interview?</span>
              <span className="pricing-faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="pricing-faq-body">
              <p>
                You won&apos;t. The credit is deducted when the interview <em>starts</em>,
                never mid-session. Whatever round you began, you finish — even if it&apos;s
                your last credit.
              </p>
            </div>
          </details>

          <details className="pricing-faq-item">
            <summary>
              <span>Do I need a credit card to sign up?</span>
              <span className="pricing-faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="pricing-faq-body">
              <p>
                No. Sign up is free — you get 2 Basic + 1 Premium credit on the house,
                no card asked. Run all three interviews. Only enter payment details if
                you decide to buy more.
              </p>
            </div>
          </details>

          <details className="pricing-faq-item">
            <summary>
              <span>Can I get a refund or invoice?</span>
              <span className="pricing-faq-chevron" aria-hidden>+</span>
            </summary>
            <div className="pricing-faq-body">
              <p>
                Credits are non-refundable once purchased — see the{' '}
                <Link to="/refund">Refund Policy</Link> for the full rules. If you need a
                GST invoice for reimbursement, email us via the{' '}
                <Link to="/contact">contact page</Link> with your order ID and we&apos;ll
                generate one.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* ── Footer — same multi-column footer as landing ───────────── */}
      <footer className="landing-footer landing-footer--multi">
        <div className="footer-edge" aria-hidden />

        <div className="footer-grid">
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
              <li><ShieldCheck size={13} aria-hidden /><span>No card on file</span></li>
              <li><Sparkles size={13} aria-hidden /><span>3 free interviews on signup</span></li>
              <li><Diamond size={13} aria-hidden /><span>Credits never expire</span></li>
            </ul>
          </div>

          <nav className="footer-col" aria-labelledby="pricing-footer-product">
            <h3 className="footer-col-title" id="pricing-footer-product">Product</h3>
            <ul>
              <li><Link to="/register">Get started</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/login">Sign in</Link></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-labelledby="pricing-footer-resources">
            <h3 className="footer-col-title" id="pricing-footer-resources">Resources</h3>
            <ul>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/blog/top-10-ai-mock-interview-mistakes">Mistakes to avoid</Link></li>
              <li><Link to="/blog/tcs-technical-interview-process-step-by-step">TCS interview guide</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-labelledby="pricing-footer-legal">
            <h3 className="footer-col-title" id="pricing-footer-legal">Legal</h3>
            <ul>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/refund">Refund Policy</Link></li>
            </ul>
          </nav>
        </div>

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
