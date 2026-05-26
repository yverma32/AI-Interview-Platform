import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Diamond, Star, Sparkles, X } from 'lucide-react';
import './FoundingMemberModal.css';

interface Props {
  open: boolean;
  packName: string;
  basicCreditsAdded: number;
  premiumCreditsAdded: number;
  onClose: () => void;
}

/**
 * Full-screen celebration shown after a purchase that triggered the founding-member 2× bonus.
 * Fires confetti from both bottom corners (the "fireworks" pattern), uses the platform's
 * cyan→magenta gradient palette for particle colors so it feels on-brand, then settles.
 */
export default function FoundingMemberModal({
  open, packName, basicCreditsAdded, premiumCreditsAdded, onClose,
}: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!open || firedRef.current) return;
    firedRef.current = true;

    // Two bursts ~150ms apart to feel like a celebration, not a single thunk.
    // Particle colors match var(--neon-cyan) / var(--neon-purple) / var(--neon-magenta).
    const colors = ['#00F0FF', '#B026FF', '#FF2BD6', '#FF3D9A'];

    const burst = (originX: number) => confetti({
      particleCount: 80,
      angle: originX === 0 ? 60 : 120,
      spread: 70,
      startVelocity: 55,
      origin: { x: originX, y: 1 },
      colors,
      gravity: 0.9,
      ticks: 250,
      scalar: 1.1,
    });

    burst(0);
    setTimeout(() => burst(1), 150);
    setTimeout(() => burst(0.5), 400);

    return () => { firedRef.current = false; };
  }, [open]);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="fm-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden />
        </button>

        <div className="fm-modal-badge">
          <Sparkles size={14} aria-hidden />
          <span>Founding Member</span>
        </div>

        <h2 className="fm-modal-title">
          You're in! <span className="fm-modal-emoji" aria-hidden>🎉</span>
        </h2>

        <p className="fm-modal-sub">
          Thank you for being one of the first 50 to back us. As promised, your credits have been doubled.
        </p>

        <div className="fm-modal-pack">{packName}</div>

        <div className="fm-modal-credits">
          <div className="fm-credit-row">
            <div className="fm-credit-icon fm-credit-icon--basic">
              <Diamond size={20} aria-hidden />
            </div>
            <div className="fm-credit-text">
              <div className="fm-credit-amount">+{basicCreditsAdded}</div>
              <div className="fm-credit-label">Basic credits added</div>
            </div>
            <div className="fm-credit-bonus">2× bonus</div>
          </div>

          {premiumCreditsAdded > 0 && (
            <div className="fm-credit-row">
              <div className="fm-credit-icon fm-credit-icon--premium">
                <Star size={20} aria-hidden />
              </div>
              <div className="fm-credit-text">
                <div className="fm-credit-amount">+{premiumCreditsAdded}</div>
                <div className="fm-credit-label">Premium credits added</div>
              </div>
              <div className="fm-credit-bonus">2× bonus</div>
            </div>
          )}
        </div>

        <button className="fm-modal-cta" onClick={onClose}>
          Start practicing →
        </button>
      </div>
    </div>
  );
}
