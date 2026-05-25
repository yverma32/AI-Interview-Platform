import { Link } from 'react-router-dom';
import { Diamond, Star, Plus } from 'lucide-react';
import './CreditBalanceBadge.css';

interface Props {
  basicCredits: number;
  premiumCredits: number;
  showBuyButton?: boolean;
}

export default function CreditBalanceBadge({ basicCredits, premiumCredits, showBuyButton = false }: Props) {
  return (
    <div className="credit-balance">
      <div className="credit-item credit-basic" title="Text interview credits">
        <Diamond size={14} aria-hidden />
        <span className="credit-count">{basicCredits}</span>
        <span className="credit-label">Basic</span>
      </div>
      <div className="credit-item credit-premium" title="Voice interview credits">
        <Star size={14} aria-hidden />
        <span className="credit-count">{premiumCredits}</span>
        <span className="credit-label">Premium</span>
      </div>
      {showBuyButton && (
        <Link to="/pricing" className="buy-credits-btn">
          <Plus size={14} aria-hidden />
          Buy Credits
        </Link>
      )}
    </div>
  );
}
