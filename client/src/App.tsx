import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import InterviewSetupPage from './pages/InterviewSetupPage';
import RealtimeInterviewRoomPage from './pages/RealtimeInterviewRoomPage';
import BasicInterviewRoomPage from './pages/BasicInterviewRoomPage';
import InterviewResultPage from './pages/InterviewResultPage';
import OnboardingAssessmentPage from './pages/OnboardingAssessmentPage';
import QuestionBankPage from './pages/QuestionBankPage';
import MyProgressPage from './pages/MyProgressPage';
import PricingPage from './pages/PricingPage';
import AccountPage from './pages/AccountPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          {/* No GuestRoute on /register: the page itself handles the post-signup resume step,
              which needs to render even after auto-login flips isAuthenticated to true. */}
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/setup"
            element={
              <ProtectedRoute>
                <InterviewSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/realtime"
            element={
              <ProtectedRoute>
                <RealtimeInterviewRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/basic/:sessionId"
            element={
              <ProtectedRoute>
                <BasicInterviewRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingAssessmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/results/:sessionId"
            element={
              <ProtectedRoute>
                <InterviewResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/question-bank"
            element={
              <ProtectedRoute>
                <QuestionBankPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <MyProgressPage />
              </ProtectedRoute>
            }
          />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
