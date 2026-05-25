import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

interface Props {
  basicCredits: number;
  premiumCredits: number;
}

/**
 * Banner shown on the dashboard / setup page when the user is low on credits.
 * Renders nothing if both balances are healthy. Tightens copy + colors as it gets worse.
 */
export default function LowCreditWarning({ basicCredits, premiumCredits }: Props) {
  const exhausted = basicCredits === 0 && premiumCredits === 0;
  const lowBasic = basicCredits > 0 && basicCredits <= 2;
  const noPremium = premiumCredits === 0;

  if (!exhausted && !lowBasic && !noPremium) return null;

  let message: string;
  if (exhausted) {
    message = "You've used all your credits. Buy more to continue practicing.";
  } else if (lowBasic && noPremium) {
    message = `Only ${basicCredits} basic credit${basicCredits === 1 ? '' : 's'} left and no premium credits — top up to keep practicing.`;
  } else if (lowBasic) {
    message = `Only ${basicCredits} basic credit${basicCredits === 1 ? '' : 's'} left. Top up before you run out.`;
  } else {
    message = 'No premium credits remaining — voice interviews require a Premium or Pro pack.';
  }

  return (
    <div className={`low-credit-banner${exhausted ? ' exhausted' : ''}`} role="status">
      <div className="low-credit-banner-text">
        <AlertCircle size={16} aria-hidden style={{ verticalAlign: 'middle', marginRight: 8 }} />
        <strong>{message}</strong>
      </div>
      <Link to="/pricing" className="low-credit-banner-cta">
        Buy Credits
      </Link>
    </div>
  );
}
