import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Target, AlertTriangle, Eye, EyeOff, Check, FileText, SkipForward } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ResumeUpload from '../components/ResumeUpload';
import './Auth.css';
import './InterviewSetup.css';

const EXPERIENCE_LEVELS = ['Junior (0-2 yrs)', 'Mid (2-5 yrs)', 'Senior (5+ yrs)', 'Lead / Architect'];
const TECHNOLOGIES = ['.NET', 'React', 'Java', 'Angular', 'Python', 'Node.js', 'SQL', 'AWS', 'Azure', 'Docker'];

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' };
  if (score <= 3) return { score, label: 'Good', color: '#eab308' };
  if (score <= 4) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Excellent', color: '#10b981' };
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    experienceLevel: '',
    preferredTechnologies: [] as string[],
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Post-registration: show the optional resume step before sending the user to the dashboard.
  const [step, setStep] = useState<'form' | 'resume'>('form');

  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // If a returning user (with a valid session cookie) lands on /register, bounce them to
  // the dashboard. But ONLY when we're still on the form step — once registration has
  // succeeded and we've moved to the resume step, isAuthenticated is true *because we
  // just signed up*; the resume step needs to render.
  if (!authLoading && isAuthenticated && step === 'form') {
    return <Navigate to="/dashboard" replace />;
  }

  const passwordStrength = form.password ? getPasswordStrength(form.password) : null;

  const validators: Record<string, (val: string) => string | undefined> = {
    fullName: (v) => {
      if (!v.trim()) return 'Full name is required';
      if (v.trim().length < 2) return 'Name must be at least 2 characters';
      if (v.trim().length > 100) return 'Name must not exceed 100 characters';
      return undefined;
    },
    email: (v) => {
      if (!v.trim()) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email address';
      return undefined;
    },
    password: (v) => {
      if (!v) return 'Password is required';
      if (v.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(v)) return 'Password must contain an uppercase letter';
      if (!/[a-z]/.test(v)) return 'Password must contain a lowercase letter';
      if (!/[0-9]/.test(v)) return 'Password must contain a digit';
      if (!/[^A-Za-z0-9]/.test(v)) return 'Password must contain a special character';
      return undefined;
    },
    confirmPassword: (v) => {
      if (!v) return 'Please confirm your password';
      if (v !== form.password) return 'Passwords do not match';
      return undefined;
    },
  };

  const validateField = (field: string, value: string) => {
    const validate = validators[field];
    return validate ? validate(value) : undefined;
  };

  const validateAll = (): boolean => {
    const errors: FieldErrors = {
      fullName: validateField('fullName', form.fullName),
      email: validateField('email', form.email),
      password: validateField('password', form.password),
      confirmPassword: validateField('confirmPassword', form.confirmPassword),
    };
    setFieldErrors(errors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    return !errors.fullName && !errors.email && !errors.password && !errors.confirmPassword;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const value = form[field as keyof typeof form];
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value as string) }));
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
    // Re-validate confirm if password changes
    if (field === 'password' && touched.confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: form.confirmPassword
          ? (value !== form.confirmPassword ? 'Passwords do not match' : undefined)
          : prev.confirmPassword,
      }));
    }
  };

  const toggleTech = (tech: string) => {
    setForm((prev) => ({
      ...prev,
      preferredTechnologies: prev.preferredTechnologies.includes(tech)
        ? prev.preferredTechnologies.filter((t) => t !== tech)
        : [...prev.preferredTechnologies, tech],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const result = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        experienceLevel: form.experienceLevel || undefined,
        preferredTechnologies: form.preferredTechnologies.length
          ? form.preferredTechnologies.join(',')
          : undefined,
      });

      if (result.success) {
        // Registration auto-logged the user in (cookies set). Show the optional resume step
        // before sending them to the dashboard — uploading needs auth, so this can only run now.
        setStep('resume');
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch {
      setError('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'resume') {
    return (
      <div className="auth-container">
        <div className="auth-card auth-card-wide">
          <div className="auth-header">
            <div className="auth-logo"><FileText size={32} aria-hidden /></div>
            <h1>Add Your Resume</h1>
            <p>Optional — makes Resume Deep Dive interviews far more personal. You can also add it later.</p>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <ResumeUpload onReady={() => { /* uploaded — user clicks Continue below */ }} />
          </div>

          <div className="resume-step-actions">
            <button
              type="button"
              className="auth-btn auth-btn-ghost"
              onClick={() => navigate('/dashboard', { replace: true })}
            >
              <SkipForward size={16} aria-hidden /> Skip for now
            </button>
            <button
              type="button"
              className="auth-btn"
              onClick={() => navigate('/dashboard', { replace: true })}
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="auth-logo"><Target size={32} aria-hidden /></div>
          <h1>Join AI Interview Simulator</h1>
          <p>Create your account and start preparing</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertTriangle className="error-icon" size={16} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-row">
            <div className={`form-group ${touched.fullName && fieldErrors.fullName ? 'has-error' : ''}`}>
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                onBlur={() => handleBlur('fullName')}
                placeholder="John Doe"
                aria-invalid={touched.fullName && !!fieldErrors.fullName}
              />
              {touched.fullName && fieldErrors.fullName && (
                <span className="field-error">{fieldErrors.fullName}</span>
              )}
            </div>

            <div className={`form-group ${touched.email && fieldErrors.email ? 'has-error' : ''}`}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="you@example.com"
                aria-invalid={touched.email && !!fieldErrors.email}
              />
              {touched.email && fieldErrors.email && (
                <span className="field-error">{fieldErrors.email}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className={`form-group ${touched.password && fieldErrors.password ? 'has-error' : ''}`}>
              <label htmlFor="password">Password</label>
              <div className="input-with-toggle">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  placeholder="••••••••"
                  aria-invalid={touched.password && !!fieldErrors.password}
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
                <span className="field-error">{fieldErrors.password}</span>
              )}
              {form.password && passwordStrength && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className="strength-fill"
                      style={{
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        backgroundColor: passwordStrength.color,
                      }}
                    />
                  </div>
                  <span className="strength-label" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            <div className={`form-group ${touched.confirmPassword && fieldErrors.confirmPassword ? 'has-error' : ''}`}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-with-toggle">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="••••••••"
                  aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              {touched.confirmPassword && fieldErrors.confirmPassword && (
                <span className="field-error">{fieldErrors.confirmPassword}</span>
              )}
              {form.confirmPassword && !fieldErrors.confirmPassword && touched.confirmPassword && (
                <span className="field-success"><Check size={12} aria-hidden /> Passwords match</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="experience">Experience Level</label>
            <select
              id="experience"
              value={form.experienceLevel}
              onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
            >
              <option value="">Select your level</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Preferred Technologies</label>
            <div className="tech-chips">
              {TECHNOLOGIES.map((tech) => (
                <button
                  type="button"
                  key={tech}
                  className={`tech-chip ${form.preferredTechnologies.includes(tech) ? 'active' : ''}`}
                  onClick={() => toggleTech(tech)}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="btn-loading"><span className="btn-spinner" /> Creating Account...</span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
