import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, Receipt, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SeoHead from '../components/SeoHead';
import './Policy.css';

/**
 * Generic policy/legal page. The same component renders Privacy, Terms, Refund, and Contact
 * pages — content is keyed by the `kind` prop so we don't fan out four nearly-identical files.
 *
 * These are the minimum legal docs Razorpay's terms require merchants to publish, and they
 * also satisfy the India DPDP Act 2023 notice obligation for the Privacy Policy.
 *
 * Effective date is the constant below — update when policy text materially changes.
 */
export type PolicyKind = 'privacy' | 'terms' | 'refund' | 'contact';

const EFFECTIVE_DATE = '26 May 2026';
const CONTACT_EMAIL = 'yverma32@gmail.com';
const BRAND_OWNER = 'Yash Verma'; // operating as an individual / sole proprietor
const PRODUCT_NAME = 'AI Interview Simulator';

interface Props {
  kind: PolicyKind;
}

export default function PolicyPage({ kind }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const meta = METADATA[kind];

  const SEO_DESCRIPTIONS: Record<PolicyKind, string> = {
    privacy: 'Privacy Policy for InterviewReady — how we collect, use, and protect your data.',
    terms: 'Terms of Service for InterviewReady — rules and conditions for using the platform.',
    refund: 'Refund Policy for InterviewReady — credit purchase terms and refund conditions.',
    contact: 'Contact InterviewReady — get in touch with support.',
  };

  return (
    <div className="policy-page">
      <SeoHead title={meta.title} description={SEO_DESCRIPTIONS[kind]} canonical={`/${kind}`} noIndex />
      <header className="policy-header">
        <button className="policy-back" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}>
          <ArrowLeft size={16} aria-hidden />
          {isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}
        </button>
        <div className="policy-title-row">
          <div className="policy-icon"><meta.icon size={22} aria-hidden /></div>
          <h1>{meta.title}</h1>
        </div>
        <p className="policy-effective">Effective: {EFFECTIVE_DATE}</p>
      </header>

      <article className="policy-content">{CONTENT[kind]()}</article>

      <nav className="policy-footer-nav" aria-label="Other policies">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/refund">Refund</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </div>
  );
}

// ── Metadata ─────────────────────────────────────────────────────────
const METADATA: Record<PolicyKind, { title: string; icon: LucideIcon }> = {
  privacy: { title: 'Privacy Policy', icon: ShieldCheck },
  terms:   { title: 'Terms of Service', icon: FileText },
  refund:  { title: 'Refund Policy', icon: Receipt },
  contact: { title: 'Contact Us', icon: Mail },
};

// ── Content blocks ───────────────────────────────────────────────────
// Plain JSX, no markdown. Edit text in one place and ship.

const CONTENT: Record<PolicyKind, () => React.ReactNode> = {
  privacy: () => (
    <>
      <p>
        {PRODUCT_NAME} (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;) is operated by {BRAND_OWNER} as an
        individual. This Privacy Policy explains what personal data we collect, why we collect it,
        how we use and protect it, and the rights you have over your data. By using the Service you
        consent to the practices described here.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account data</strong> — your name, email, password (stored as a bcrypt hash, never in plaintext), and the experience level and preferred technologies you optionally provide on signup.</li>
        <li><strong>Interview data</strong> — the questions our AI asks you, your typed or spoken answers, transcripts of voice sessions, and the AI&apos;s scores and feedback. Voice audio is processed in real time by OpenAI under their API terms and is not stored by us.</li>
        <li><strong>Resume data</strong> — if you choose to upload a resume, we store the file along with the parsed structured summary (name, projects, skills, employment). You can delete this at any time by emailing us.</li>
        <li><strong>Payment data</strong> — when you purchase credits, we record the Razorpay order and payment identifiers, the amount paid, and the pack purchased. We do not see or store your card number, CVV, or banking credentials; those are handled entirely by Razorpay.</li>
        <li><strong>Usage data</strong> — basic web analytics (page views, anonymized device info) collected via Vercel Analytics and, optionally, PostHog. We do not sell this data.</li>
        <li><strong>Technical data</strong> — IP address, browser user-agent, and timestamps in our server logs for security and abuse detection. Retained for 30 days unless required longer for an open investigation.</li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul>
        <li>To deliver the interview practice service — generating questions, scoring answers, computing your weak-topic analytics.</li>
        <li>To process payments via Razorpay and credit your account.</li>
        <li>To enforce fair use (rate limiting, abuse detection, account lockout after repeated failed logins).</li>
        <li>To respond to support requests you initiate.</li>
        <li>To send transactional emails about your account or purchases (we do not send marketing emails without separate opt-in).</li>
      </ul>

      <h2>3. How we share your data</h2>
      <p>We share the minimum necessary data with the following processors, each governed by their own privacy and security commitments:</p>
      <ul>
        <li><strong>OpenAI</strong> — your interview prompts and answers are sent to OpenAI&apos;s API for the AI interviewer to function. Per their API terms, content is not used to train their public models.</li>
        <li><strong>Razorpay</strong> — your name and email are passed to Razorpay&apos;s checkout to process credit-pack payments. Card details flow directly to Razorpay and never touch our servers.</li>
        <li><strong>Railway</strong> — our hosting provider for the backend API and Postgres database (servers located in the US).</li>
        <li><strong>Vercel</strong> — our hosting provider for the frontend, also handling page-view analytics.</li>
      </ul>
      <p>We never sell your personal data and we do not share it with advertisers.</p>

      <h2>4. Data security</h2>
      <p>
        Passwords are hashed with bcrypt at work factor 12. Authentication uses signed JWT cookies (HttpOnly, Secure, SameSite enforced). All
        traffic between you, our backend, and our processors is encrypted in transit (TLS 1.2+). Database connections use SSL. We log security
        events (failed logins, signature mismatches, suspicious refresh-token reuse) and lock accounts after 5 failed login attempts.
      </p>

      <h2>5. Your rights</h2>
      <p>Under the Indian Digital Personal Data Protection Act, 2023, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct any inaccurate data.</li>
        <li>Request deletion of your account and associated data, except where retention is required by law (e.g. tax records of completed transactions).</li>
        <li>Withdraw consent, after which we will stop processing your data (account deletion will follow).</li>
      </ul>
      <p>To exercise any of these rights, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim to respond within 7 working days.</p>

      <h2>6. Data retention</h2>
      <ul>
        <li><strong>Active accounts</strong> — retained as long as your account is active.</li>
        <li><strong>Deleted accounts</strong> — personal data deleted within 30 days of your request, except records required for tax/accounting (Payment rows are retained for 8 years per Indian tax law, with PII stripped).</li>
        <li><strong>Logs</strong> — 30 days, unless retained longer for a specific investigation.</li>
      </ul>

      <h2>7. Children</h2>
      <p>The Service is not directed to users under 18. We do not knowingly collect data from minors. If you believe a minor has provided us data, contact us and we&apos;ll remove it.</p>

      <h2>8. Changes to this policy</h2>
      <p>If we change this policy materially, we&apos;ll notify active account holders by email. The &quot;Effective&quot; date above reflects the current version.</p>

      <h2>9. Contact</h2>
      <p>Questions, requests, or complaints: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </>
  ),

  terms: () => (
    <>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of {PRODUCT_NAME} (&quot;the Service&quot;), operated by {BRAND_OWNER}.
        By creating an account, purchasing credits, or using the Service in any way, you agree to these Terms. If you do not agree, please do
        not use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        {PRODUCT_NAME} is an interview-practice tool that uses an AI interviewer to ask technical or behavioural questions, evaluate your
        answers, and provide feedback. The Service is for personal, non-commercial use to help you prepare for job interviews. It is not
        career advice, recruitment, or a guarantee of any outcome.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must be 18 or older to register.</li>
        <li>You are responsible for keeping your password confidential and for all activity under your account.</li>
        <li>One account per person. Sharing accounts is not allowed.</li>
        <li>You agree to provide accurate information at signup and keep it updated.</li>
      </ul>

      <h2>3. Credits</h2>
      <ul>
        <li>The Service runs on a credit system. Each interview deducts one credit of the appropriate kind (Basic or Premium).</li>
        <li>New users receive 2 Basic and 1 Premium credit free on signup, sufficient to evaluate the Service.</li>
        <li>Additional credits can be purchased through Razorpay in the form of pre-defined credit packs.</li>
        <li>Credits do not expire and are not transferable between accounts.</li>
        <li>Credits have no cash value and cannot be exchanged for cash.</li>
      </ul>

      <h2>4. Payments</h2>
      <ul>
        <li>All payments are processed by Razorpay. We receive only the payment identifier and amount; we do not see your card details.</li>
        <li>Prices are listed in Indian Rupees (INR) and include applicable taxes unless stated otherwise.</li>
        <li>Once a payment is successfully verified, credits are added to your account within seconds.</li>
        <li>See our <Link to="/refund">Refund Policy</Link> for refund rules.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse-engineer, scrape, or copy the Service beyond personal study.</li>
        <li>Use automated tools, bots, or scripts to consume credits or generate interviews.</li>
        <li>Submit content that is illegal, hateful, harassing, sexually explicit, or violates someone else&apos;s rights.</li>
        <li>Attempt to extract data about other users, probe for vulnerabilities, or disrupt the Service.</li>
        <li>Resell credits or your account.</li>
      </ul>
      <p>We may suspend or terminate accounts that violate these rules. Credits in a terminated account are forfeit and not refundable.</p>

      <h2>6. AI-generated content</h2>
      <ul>
        <li>The AI interviewer&apos;s questions, scores, and feedback are generated by large language models. They may contain factual errors and should not be relied on as authoritative.</li>
        <li>You retain ownership of your answers. By submitting them, you grant us a non-exclusive licence to process them in order to deliver the Service.</li>
        <li>We do not use your interview content to train our models or any third party&apos;s models.</li>
      </ul>

      <h2>7. Service availability</h2>
      <p>
        We aim to keep the Service available but do not guarantee uninterrupted access. Scheduled maintenance, third-party outages (OpenAI,
        Razorpay, Railway, Vercel) and other events may cause downtime. If a credit is consumed by an interview that fails for technical
        reasons, we will refund that credit on request.
      </p>

      <h2>8. Liability</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided &quot;as is&quot;. We are not liable for any consequential, indirect,
        or punitive damages. Our total aggregate liability to you for any claim related to the Service is limited to the amount you have
        paid us in the 12 months preceding the claim.
      </p>

      <h2>9. Termination</h2>
      <p>You may close your account at any time by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may terminate or suspend accounts that breach these Terms, with notice where reasonable.</p>

      <h2>10. Governing law</h2>
      <p>These Terms are governed by the laws of India. Any dispute will be subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.</p>

      <h2>11. Changes</h2>
      <p>We may update these Terms. Material changes will be notified by email to active account holders. Continued use after the change means you accept the updated Terms.</p>

      <h2>12. Contact</h2>
      <p>Questions about these Terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </>
  ),

  refund: () => (
    <>
      <p>
        This Refund Policy applies to credit packs purchased on {PRODUCT_NAME}. Please read it carefully before you make a purchase.
      </p>

      <h2>1. Credits are non-refundable</h2>
      <p>
        Once a credit pack purchase is verified and credits are added to your account, the purchase is final. We do not offer refunds on
        used or unused credits. This is because:
      </p>
      <ul>
        <li>You can evaluate the Service free of cost using the signup bonus (2 Basic + 1 Premium credits) before deciding to pay.</li>
        <li>The pricing page clearly describes what each pack contains and what each credit can be used for.</li>
        <li>Credits never expire and are not subject to time-bound consumption.</li>
      </ul>

      <h2>2. Exceptions</h2>
      <p>We will refund or re-issue credits in the following specific circumstances:</p>
      <ul>
        <li><strong>Duplicate charge</strong> — if your card is charged twice for the same order due to a technical issue, we will refund the duplicate within 7 working days.</li>
        <li><strong>Failed delivery</strong> — if your payment was successful but credits did not arrive in your account within 24 hours and our webhook safety-net did not recover them, we will manually credit your account.</li>
        <li><strong>Interview failure due to our system</strong> — if a credit is consumed by an interview that cannot be completed because of a verifiable bug on our side, we will refund that credit on request.</li>
      </ul>
      <p>To request a refund or re-credit, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from your registered email with the Razorpay payment ID and a description of the issue.</p>

      <h2>3. How refunds are processed</h2>
      <p>Approved refunds are processed back to the original payment method through Razorpay. They typically arrive within 5–7 working days, though bank processing times can vary.</p>

      <h2>4. Account termination</h2>
      <p>If we terminate your account because of a Terms of Service violation, unused credits are forfeit and are not refunded.</p>

      <h2>5. Changes</h2>
      <p>We may update this policy. Material changes will be notified by email. The effective date above shows the current version.</p>

      <h2>6. Contact</h2>
      <p>Refund queries: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </>
  ),

  contact: () => (
    <>
      <p>The fastest way to reach us is email. We&apos;re a small team — most messages get a response within 1–2 working days.</p>

      <h2>General support</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        <br />
        Use this for account help, refund requests, billing questions, bug reports, and feedback.
      </p>

      <h2>What to include for faster help</h2>
      <ul>
        <li>The email address associated with your account.</li>
        <li>A short description of what happened and what you expected.</li>
        <li>For payment issues: the Razorpay payment ID (visible on the <Link to="/account">Account &amp; Billing</Link> page once logged in).</li>
        <li>Screenshots if the issue is visual.</li>
      </ul>

      <h2>Operating entity</h2>
      <p>
        {PRODUCT_NAME} is operated by {BRAND_OWNER} as an individual / sole proprietor based in India. We are not a registered company at this time.
      </p>

      <h2>Privacy queries</h2>
      <p>For privacy, data access, or deletion requests, see the <Link to="/privacy">Privacy Policy</Link> or write to the email above with &quot;Privacy&quot; in the subject.</p>
    </>
  ),
};
