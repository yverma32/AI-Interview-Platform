import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import type { RouteRecord } from 'vite-react-ssg';
import Layout from './Layout';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

// Public marketing/legal pages — eagerly imported so vite-react-ssg can pre-render
// them to static HTML at build time. These are the routes Google crawls.
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import PolicyPage from './pages/PolicyPage';
import BlogIndexPage from './pages/BlogIndexPage';
import BlogPostPage from './pages/BlogPostPage';
import { getAllSlugs } from './content/blog/posts';

// Auth-gated and interactive pages — lazy-loaded. The pre-renderer cannot render
// these (they need auth state / browser APIs) so they ship as code-split chunks
// that hydrate on the client.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const InterviewSetupPage = lazy(() => import('./pages/InterviewSetupPage'));
const RealtimeInterviewRoomPage = lazy(() => import('./pages/RealtimeInterviewRoomPage'));
const BasicInterviewRoomPage = lazy(() => import('./pages/BasicInterviewRoomPage'));
const InterviewResultPage = lazy(() => import('./pages/InterviewResultPage'));
const OnboardingAssessmentPage = lazy(() => import('./pages/OnboardingAssessmentPage'));
const QuestionBankPage = lazy(() => import('./pages/QuestionBankPage'));
const MyProgressPage = lazy(() => import('./pages/MyProgressPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    entry: 'src/Layout.tsx',
    children: [
      // ── Public, pre-rendered ──────────────────────────────────────
      { index: true, element: <LandingPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'privacy', element: <PolicyPage kind="privacy" /> },
      { path: 'terms', element: <PolicyPage kind="terms" /> },
      { path: 'refund', element: <PolicyPage kind="refund" /> },
      { path: 'contact', element: <PolicyPage kind="contact" /> },

      // ── Blog (also pre-rendered) ──────────────────────────────────
      { path: 'blog', element: <BlogIndexPage /> },
      {
        path: 'blog/:slug',
        element: <BlogPostPage />,
        // Tell vite-react-ssg which blog slugs to pre-render. Each one becomes
        // its own static HTML file at dist/blog/<slug>.html.
        getStaticPaths: () => getAllSlugs().map((slug) => `blog/${slug}`),
      },

      // ── Auth pages (public but not pre-rendered — needs client-side guard) ──
      { path: 'login', element: <GuestRoute><LoginPage /></GuestRoute> },
      // No GuestRoute on /register: the page itself handles the post-signup
      // resume step, which needs to render even after isAuthenticated flips true.
      { path: 'register', element: <RegisterPage /> },

      // ── Protected (logged-in) routes ─────────────────────────────
      { path: 'dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
      { path: 'interview/setup', element: <ProtectedRoute><InterviewSetupPage /></ProtectedRoute> },
      { path: 'interview/realtime', element: <ProtectedRoute><RealtimeInterviewRoomPage /></ProtectedRoute> },
      { path: 'interview/basic/:sessionId', element: <ProtectedRoute><BasicInterviewRoomPage /></ProtectedRoute> },
      { path: 'onboarding', element: <ProtectedRoute><OnboardingAssessmentPage /></ProtectedRoute> },
      { path: 'interview/results/:sessionId', element: <ProtectedRoute><InterviewResultPage /></ProtectedRoute> },
      { path: 'question-bank', element: <ProtectedRoute><QuestionBankPage /></ProtectedRoute> },
      { path: 'progress', element: <ProtectedRoute><MyProgressPage /></ProtectedRoute> },
      { path: 'account', element: <ProtectedRoute><AccountPage /></ProtectedRoute> },

      // ── Catch-all ────────────────────────────────────────────────
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export default routes;
