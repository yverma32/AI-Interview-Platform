import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ICONS = {
  system: Monitor,
  light:  Sun,
  dark:   Moon,
} as const;

const LABELS: Record<string, string> = {
  system: 'System theme',
  light:  'Light theme',
  dark:   'Dark theme',
};

/**
 * Cycles System → Light → Dark → System on click. Tooltip shows the current mode so users know
 * what tapping again will do.
 */
export default function ThemeToggle() {
  const { mode, cycleMode } = useTheme();
  const Icon = ICONS[mode];
  return (
    <button
      className="theme-toggle"
      onClick={cycleMode}
      aria-label={`${LABELS[mode]} (click to change)`}
      title={`${LABELS[mode]} — click to cycle`}
    >
      <Icon size={18} className="theme-toggle-icon" aria-hidden />
    </button>
  );
}
