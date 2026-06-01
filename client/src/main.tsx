import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './App';
import { initAnalytics } from './services/analytics';
import './index.css';

export const createRoot = ViteReactSSG(
  { routes },
  () => {
    // Client-only side effects (initAnalytics is guarded — no-op during pre-render).
    initAnalytics();
  },
);
