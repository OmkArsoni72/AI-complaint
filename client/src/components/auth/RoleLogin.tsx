'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, Users, UserCircle2, User, Phone } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type RoleType = 'PUBLIC' | 'ADMIN' | 'SUPER_ADMIN' | 'OFFICER';
type PortalGuard = 'HEAD_ADMIN' | 'SUB_DEPARTMENT' | 'ANY_ADMIN';

interface RoleLoginProps {
  role: RoleType;
  title: string;
  subtitle: string;
  redirectTo: string;
  portalGuard?: PortalGuard;
}

const roleMeta: Record<RoleType, { icon: any; label: string }> = {
  PUBLIC: { icon: UserCircle2, label: 'Citizen' },
  ADMIN: { icon: Users, label: 'Admin' },
  SUPER_ADMIN: { icon: ShieldCheck, label: 'Superadmin' },
  OFFICER: { icon: Users, label: 'Officer' },
};

export default function RoleLogin({ role, title, subtitle, redirectTo, portalGuard = 'ANY_ADMIN' }: RoleLoginProps) {
  const router = useRouter();
  const { login, register, logout, googleLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [particles, setParticles] = useState<any[]>([]);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [googleLoading, setGoogleLoading] = useState(false);

  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    const p = [...Array(18)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${3 + Math.random() * 4}s`,
      size: `${2 + Math.random() * 4}px`,
    }));
    setParticles(p);

    setParticles(p);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password, role);
    if (result.ok) {
      const isSubDepartment = result.user?.isSubDepartment;
      if (portalGuard === 'SUB_DEPARTMENT' && !isSubDepartment) {
        logout();
        setError('Use the Head Admin login. This account is not a sub-department admin.');
        setLoading(false);
        return;
      }
      if (portalGuard === 'HEAD_ADMIN' && isSubDepartment) {
        logout();
        setError('Use Sub-Department login for this account.');
        setLoading(false);
        return;
      }
      router.push(redirectTo);
    } else {
      if (result.errorRole) {
        const stored = result.errorRole;
        setError(`This account is registered as ${stored}. Please use the ${stored === 'SUPER_ADMIN' ? 'Superadmin' : stored === 'ADMIN' ? 'Admin' : stored === 'OFFICER' ? 'Officer' : 'Citizen'} login.`);
      } else if (result.error) {
        setError(result.error);
      } else {
        setError(`Invalid credentials or access denied for ${roleMeta[role].label} portal.`);
      }
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await register({
      name,
      email,
      password,
      phone,
    });

    if (res.ok) {
      router.push(redirectTo);
    } else {
      setError(res.error || 'Registration failed. Please try again.');
    }

    setLoading(false);
  };

  const RoleIcon = roleMeta[role].icon;

  return (
    <div className="login-page-wrapper">
      <div className="login-bg-particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="login-particle"
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.delay,
              animationDuration: p.duration,
              width: p.size,
              height: p.size,
            }}
          />
        ))}
      </div>

      <div className="login-bg-gradient" />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="login-container"
      >
        <div className="login-emblem-section">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
            className="login-emblem"
          >
            <div className="login-emblem-inner">
              <RoleIcon className="w-10 h-10 text-amber-400" strokeWidth={1.5} />
            </div>
            <div className="login-emblem-ring" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="login-title">{title}</h1>
            <p className="login-subtitle">{subtitle}</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="login-card"
        >
          <div className="login-role-toggle" style={{ gridTemplateColumns: 'repeat(1, 1fr)' }}>
            <button
              className="login-role-btn login-role-btn-active"
              style={{ padding: '0.75rem 0.25rem' }}
            >
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="text-xs">{roleMeta[role].label}</span>
            </button>
            <motion.div
              className="login-role-indicator"
              style={{ width: 'calc(100% - 1.33px)' }}
              animate={{ x: '0%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>

          <div className="login-mode-header">
            <h2 className="login-mode-title">
              {mode === 'login' ? 'Login' : 'Register'}{' '}
              <span className="login-mode-title-thin">
                {mode === 'login' ? 'to your account' : 'for a new account'}
              </span>
            </h2>
            {role === 'PUBLIC' && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'login'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'register'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  Register
                </button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="login-error"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="login-form">
            {role === 'PUBLIC' && mode === 'register' && (
              <>
                <div className="login-field">
                  <div className="login-input-wrapper">
                    <User className="login-input-icon" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="login-input"
                      placeholder="Full name"
                      required
                    />
                  </div>
                </div>
                <div className="login-field">
                  <div className="login-input-wrapper">
                    <Phone className="login-input-icon" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="login-input"
                      placeholder="Phone (optional)"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="login-field">
              <div className="login-input-wrapper">
                <Mail className="login-input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input login-input-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? (
                <div className="login-spinner" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>{mode === 'login' ? 'Login' : 'Register'}</span>
                </>
              )}
            </button>

            {role === 'PUBLIC' && (
              <>
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] uppercase tracking-widest text-white/25 font-bold">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  type="button"
                  disabled={googleLoading}
                  onClick={async () => {
                    setGoogleLoading(true);
                    setError('');
                    try {
                      // Dynamically import to avoid SSR issues
                      const { auth, googleProvider, signInWithPopup } = await import('@/lib/firebase');
                      const result = await signInWithPopup(auth, googleProvider);
                      // Get the ID token from Firebase to send to our backend
                      const token = await result.user.getIdToken();
                      
                      // We use process.env here indirectly - if firebase logged them in, it's valid.
                      // Send token to our server endpoint which decodes the JWT and registers/logs in
                      const backendResult = await googleLogin(token);
                      if (backendResult.ok) {
                        router.push(redirectTo);
                      } else {
                        setError(backendResult.error || 'Google login failed on server');
                      }
                    } catch (err: any) {
                      console.error('Google Sign-In Error:', err);
                      // Don't show error for user-cancelled popups
                      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                        setError(err.message || 'Google sign-in failed');
                      }
                    } finally {
                      setGoogleLoading(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all text-sm font-semibold text-white/70 hover:text-white"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {googleLoading ? 'Connecting...' : 'Continue with Google'}
                </button>
              </>
            )}
          </form>


          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="login-footer"
          >
            AI Grievance Intelligence System • Secure Access
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
