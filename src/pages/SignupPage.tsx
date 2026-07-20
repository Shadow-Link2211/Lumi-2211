import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export const SignupPage: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signUp(email, password, username, fullName);
    if (error) setError(error);
    else showToast('Welcome to Lumi! Your account is ready.');
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Lumi" />
        </div>
        <p className="auth-subtitle">Sign up to see photos and videos from your friends.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <input className="input" type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : 'Sign Up'}
          </button>
        </form>
        <p className="auth-switch">
          Have an account? <a onClick={onSwitch}>Sign in</a>
        </p>
      </div>
    </div>
  );
};
