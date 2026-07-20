import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export const LoginPage: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) setError(error);
    else showToast('Welcome back to Lumi');
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Lumi" />
        </div>
        <p className="auth-subtitle">Welcome back. Sign in to continue.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : 'Sign In'}
          </button>
        </form>
        <div className="auth-divider">OR</div>
        <p className="auth-switch">
          Don't have an account? <a onClick={onSwitch}>Sign up</a>
        </p>
      </div>
    </div>
  );
};
