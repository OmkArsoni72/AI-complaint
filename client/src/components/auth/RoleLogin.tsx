'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, Users, UserCircle2, User, Phone } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type RoleType = 'PUBLIC' | 'ADMIN' | 'SUPER_ADMIN';
type PortalGuard = 'HEAD_ADMIN' | 'SUB_DEPARTMENT' | 'ANY_ADMIN';

interface RoleLoginProps {
  role: RoleType;
  title: string;
  subtitle: string;
  redirectTo: string;
  allowDemo?: boolean;
  portalGuard?: PortalGuard;
}

const roleMeta: Record<RoleType, { icon: any; label: string }> = {
  PUBLIC: { icon: UserCircle2, label: 'Citizen' },
  ADMIN: { icon: Users, label: 'Admin' },
  SUPER_ADMIN: { icon: ShieldCheck, label: 'Superadmin' },
};

export default function RoleLogin({ role, title, subtitle, redirectTo, allowDemo = true, portalGuard = 'ANY_ADMIN' }: RoleLoginProps) {
  const router = useRouter();
  const { login, demoLogin, register, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [particles, setParticles] = useState<any[]>([]);
  const [mode, setMode] = useState<'login' | 'register'>('login');

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
        setError(`This account is registered as ${stored}. Please use the ${stored === 'SUPER_ADMIN' ? 'Superadmin' : stored === 'ADMIN' ? 'Admin' : 'Citizen'} login.`);
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

  const handleDemo = async () => {
    setLoading(true);
    setError('');
    const ok = await demoLogin(role);
    if (ok) {
      router.push(redirectTo);
    } else {
      setError('Demo login failed. Seed data may be missing.');
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
          </form>

          {allowDemo && mode === 'login' && (
            <div className="login-demo-section">
              <div className="login-divider">
                <span>Demo Access</span>
              </div>
              <button
                type="button"
                onClick={handleDemo}
                className="login-demo-btn"
                disabled={loading}
              >
                Continue as Demo {roleMeta[role].label}
              </button>
            </div>
          )}

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
