import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Target, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SeoHead from '../components/SeoHead';
import './Auth.css';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return undefined;
  };

  const validateAll = (): boolean => {
    const errors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    setTouched({ email: true, password: true });
    return !errors.email && !errors.password;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    if (field === 'password') setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message || 'Invalid email or password. Please try again.');
      }
    } catch {
      setError('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <SeoHead title="Sign In" description="Sign in to InterviewReady and continue your AI mock interview practice." canonical="/login" noIndex />
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Target size={32} aria-hidden /></div>
          <h1>Welcome Back</h1>
          <p>Sign in to continue your interview prep</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertTriangle className="error-icon" size={16} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className={`form-group ${touched.email && fieldErrors.email ? 'has-error' : ''}`}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
              }}
              onBlur={() => handleBlur('email')}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={touched.email && !!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {touched.email && fieldErrors.email && (
              <span className="field-error" id="email-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className={`form-group ${touched.password && fieldErrors.password ? 'has-error' : ''}`}>
            <label htmlFor="password">Password</label>
            <div className="input-with-toggle">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) setFieldErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                }}
                onBlur={() => handleBlur('password')}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={touched.password && !!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
            {touched.password && fieldErrors.password && (
              <span className="field-error" id="password-error">{fieldErrors.password}</span>
            )}
          </div>

          <button type="submit" className="auth-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="btn-loading"><span className="btn-spinner" /> Signing in...</span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
