import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Diamond, Star, MessageCircle, Mic, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  useCredits, useCreditPacks, useCreateOrder, useVerifyPayment, useFoundingStatus,
  type CreditPack,
} from '../hooks/useCredits';
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
  const { data: packsData, isLoading: packsLoading } = useCreditPacks();
  const { data: credits } = useCredits();
  const { data: foundingStatus } = useFoundingStatus();
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();

  const [processingPack, setProcessingPack] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

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
      const order = await createOrder.mutateAsync(pack.id);

      const options: RazorpayOptions = {
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'InterviewReady',
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

  if (packsLoading) {
    return (
      <div className="pricing-page">
        <div className="pricing-loading">Loading credit packs...</div>
      </div>
    );
  }

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <button className="btn-back" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}>
          ← {isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}
        </button>
        <h1>Buy Interview Credits</h1>
        <p className="pricing-subtitle">
          Credits never expire. Use them at your own pace.
        </p>
        {isAuthenticated && credits && (
          <div style={{ marginTop: 16, display: 'inline-block' }}>
            <CreditBalanceBadge basicCredits={credits.basicCredits} premiumCredits={credits.premiumCredits} />
          </div>
        )}
        {!isAuthenticated && (
          <div className="free-tier-banner" role="status">
            Sign up free — get <strong>2 Basic + 1 Premium</strong> credit instantly. No card needed.
          </div>
        )}
      </header>

      {/* Launch promo banner — shows only while spots remain. We deliberately do NOT show
          the live spot count: an empty "50 spots left" reads as negative social proof to
          early visitors. The promo still ends silently once the cap is hit (the banner
          stops rendering because foundingStatus.active goes false). */}
      {foundingStatus?.active && (
        <div className="founding-banner" role="status">
          <Sparkles size={18} aria-hidden />
          <div className="founding-banner-text">
            <strong>🎯 Founding Member offer:</strong> First {foundingStatus.totalSpots} buyers get{' '}
            <strong>DOUBLE credits</strong> on any pack — limited time.
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

      <section className="pricing-grid">
        {packs.map((pack) => (
          <div
            key={pack.id}
            className={`pricing-card ${pack.highlight ? 'pricing-card--featured' : ''}`}
          >
            {pack.highlight && <div className="featured-badge">Most Popular</div>}
            <h2 className="plan-name">{pack.name}</h2>
            <div className="plan-price">
              <span className="price-currency">₹</span>
              <span className="price-amount">{pack.price}</span>
            </div>
            <div className="plan-interviews">
              <div className="credit-line">
                <Diamond size={14} aria-hidden /> <strong>{pack.basicCredits}</strong> Basic
              </div>
              <div className="credit-line">
                <Star size={14} aria-hidden /> <strong>{pack.premiumCredits > 0 ? pack.premiumCredits : '—'}</strong> Premium
              </div>
            </div>
            <ul className="plan-features">
              <li>
                <Check className="feature-check" size={14} aria-hidden />
                {pack.description}
              </li>
              <li>
                <Check className="feature-check" size={14} aria-hidden />
                Credits never expire
              </li>
              <li>
                <Check className="feature-check" size={14} aria-hidden />
                Detailed scoring & feedback
              </li>
            </ul>
            <button
              className={`btn-plan ${pack.highlight ? 'btn-plan--featured' : ''}`}
              disabled={processingPack !== null}
              onClick={() => handleBuy(pack)}
            >
              {processingPack === pack.id ? 'Processing...' : `Buy for ₹${pack.price}`}
            </button>
          </div>
        ))}
      </section>

      <section className="cost-transparency">
        <h2>What's the difference?</h2>
        <div className="cost-breakdown-card mode-compare">
          <div className="mode-col">
            <h3><Diamond size={18} aria-hidden /> Basic Interview</h3>
            <ul>
              <li>Text questions on screen</li>
              <li>Type or speak (voice-to-text) to answer</li>
              <li>GPT-4o-mini scoring & feedback</li>
              <li>Great for daily practice</li>
            </ul>
          </div>
          <div className="mode-col">
            <h3><Star size={18} aria-hidden /> Premium Interview</h3>
            <ul>
              <li>AI speaks questions aloud</li>
              <li>Voice-only conversation, human-quality</li>
              <li>OpenAI Realtime API, low latency</li>
              <li>Real interview simulation</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pricing-faq">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h4><MessageCircle size={16} aria-hidden style={{ verticalAlign: 'middle', marginRight: 6 }} /> Do credits expire?</h4>
            <p>No — credits never expire. Use them at your own pace.</p>
          </div>
          <div className="faq-item">
            <h4>Can I mix Basic and Premium?</h4>
            <p>Yes — you choose the mode before each interview. Buy the pack that matches how you want to practice.</p>
          </div>
          <div className="faq-item">
            <h4>What if I run out mid-interview?</h4>
            <p>Credits are deducted only when an interview starts, never mid-session. You'll always finish what you started.</p>
          </div>
          <div className="faq-item">
            <h4><Mic size={16} aria-hidden style={{ verticalAlign: 'middle', marginRight: 6 }} /> Can I get a refund?</h4>
            <p>Credits are non-refundable once purchased. Reach out if you hit a technical issue.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
