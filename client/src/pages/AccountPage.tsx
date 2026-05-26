import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User as UserIcon, Receipt, Sparkles, Check, Copy, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCredits, usePaymentHistory, type PaymentHistoryItem } from '../hooks/useCredits';
import CreditBalanceBadge from '../components/CreditBalanceBadge';
import './Account.css';

/**
 * Account / settings hub. Today this is mostly the billing-history table the user explicitly
 * asked for, but the layout intentionally leaves room for future "Profile", "Security",
 * "Notifications" panels without restructuring the page.
 */
export default function AccountPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const { data: history, isLoading, isError } = usePaymentHistory();

  return (
    <div className="account-page">
      <header className="account-header">
        <button className="account-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} aria-hidden />
          Back to Dashboard
        </button>
        <h1>Account & Billing</h1>
        <p className="account-sub">Your profile, credit balance, and payment history — all in one place.</p>
      </header>

      {/* Profile summary card — keeps the existing dashboard profile data visible so users don't
          have to bounce back. Editing will come in a later iteration. */}
      <section className="account-card">
        <div className="account-card-header">
          <div className="account-card-icon"><UserIcon size={18} aria-hidden /></div>
          <h2>Profile</h2>
        </div>
        <div className="account-grid">
          <div>
            <div className="account-label">Name</div>
            <div className="account-value">{user?.fullName || '—'}</div>
          </div>
          <div>
            <div className="account-label">Email</div>
            <div className="account-value">{user?.email || '—'}</div>
          </div>
          <div>
            <div className="account-label">Experience</div>
            <div className="account-value">{user?.experienceLevel || 'Not set'}</div>
          </div>
          <div>
            <div className="account-label">Credit Balance</div>
            <div className="account-value">
              <CreditBalanceBadge
                basicCredits={credits?.basicCredits ?? 0}
                premiumCredits={credits?.premiumCredits ?? 0}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Billing history */}
      <section className="account-card">
        <div className="account-card-header">
          <div className="account-card-icon"><Receipt size={18} aria-hidden /></div>
          <h2>Billing History</h2>
          <button className="account-buy-btn" onClick={() => navigate('/pricing')}>
            + Buy Credits
          </button>
        </div>

        {isLoading && <div className="account-empty">Loading your payment history…</div>}
        {isError && <div className="account-empty">Couldn't load payment history. Try refreshing.</div>}
        {!isLoading && !isError && (history?.length ?? 0) === 0 && (
          <div className="account-empty">
            <p>No purchases yet.</p>
            <button className="account-cta" onClick={() => navigate('/pricing')}>Browse Credit Packs →</button>
          </div>
        )}
        {!isLoading && history && history.length > 0 && (
          <PaymentHistoryTable items={history} />
        )}
      </section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Table

function PaymentHistoryTable({ items }: { items: PaymentHistoryItem[] }) {
  return (
    <div className="payment-table-wrap">
      <table className="payment-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Pack</th>
            <th>Amount</th>
            <th>Credits</th>
            <th>Status</th>
            <th>Payment ID</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <PaymentRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>

      {/* Mobile: same data, stacked as cards */}
      <div className="payment-cards">
        {items.map((item) => (
          <PaymentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function PaymentRow({ item }: { item: PaymentHistoryItem }) {
  const dateLabel = formatDate(item.paidAt ?? item.createdAt);
  return (
    <tr>
      <td>{dateLabel}</td>
      <td className="cell-pack">{item.packName}</td>
      <td>{item.currencySymbol}{item.amountRupees.toFixed(2)}</td>
      <td>
        <CreditsCell item={item} />
      </td>
      <td><StatusPill status={item.status} /></td>
      <td><PaymentIdCell value={item.razorpayPaymentId ?? item.razorpayOrderId} /></td>
    </tr>
  );
}

function PaymentCard({ item }: { item: PaymentHistoryItem }) {
  const dateLabel = formatDate(item.paidAt ?? item.createdAt);
  return (
    <div className="payment-card">
      <div className="payment-card-top">
        <div>
          <div className="payment-card-pack">{item.packName}</div>
          <div className="payment-card-date">{dateLabel}</div>
        </div>
        <div className="payment-card-amount">{item.currencySymbol}{item.amountRupees.toFixed(2)}</div>
      </div>
      <div className="payment-card-row">
        <span className="payment-card-label">Credits</span>
        <CreditsCell item={item} />
      </div>
      <div className="payment-card-row">
        <span className="payment-card-label">Status</span>
        <StatusPill status={item.status} />
      </div>
      <div className="payment-card-row">
        <span className="payment-card-label">Payment ID</span>
        <PaymentIdCell value={item.razorpayPaymentId ?? item.razorpayOrderId} />
      </div>
    </div>
  );
}

function CreditsCell({ item }: { item: PaymentHistoryItem }) {
  const parts: string[] = [];
  if (item.basicCreditsReceived > 0) parts.push(`${item.basicCreditsReceived} Basic`);
  if (item.premiumCreditsReceived > 0) parts.push(`${item.premiumCreditsReceived} Premium`);
  return (
    <div className="credits-cell">
      <span>{parts.length > 0 ? parts.join(' + ') : '—'}</span>
      {item.foundingMemberBonusApplied && (
        <span className="bonus-pill">
          <Sparkles size={11} aria-hidden /> 2× bonus
        </span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === 'paid') {
    return <span className="status-pill status-pill--paid"><CheckCircle2 size={12} aria-hidden /> Paid</span>;
  }
  if (lower === 'failed') {
    return <span className="status-pill status-pill--failed"><XCircle size={12} aria-hidden /> Failed</span>;
  }
  // "Created" or anything else
  return <span className="status-pill status-pill--pending"><Clock size={12} aria-hidden /> Pending</span>;
}

function PaymentIdCell({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="payment-id-empty">—</span>;

  const short = value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently fail rather than alarm the user */
    }
  };

  return (
    <button className="payment-id-button" onClick={onCopy} title="Copy to clipboard">
      <span className="payment-id-text">{short}</span>
      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
    </button>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
