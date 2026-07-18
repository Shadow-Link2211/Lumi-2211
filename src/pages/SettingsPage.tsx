import React, { useState, useEffect } from 'react';
import { Moon, Sun, Shield, ShieldAlert, Lock, User, Link2, Share2, Copy, MessageCircle, Send, Mail, QrCode, Globe } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { Toggle } from '../components/Toggle';
import { supabase } from '../lib/supabase';

interface SettingsPageProps {
  onNavigate: (page: any) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { user, settings, updateSettings, updateProfile, signOut } = useAuth();
  const { showToast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [showParentalSetup, setShowParentalSetup] = useState(false);
  const [parentalPassword, setParentalPassword] = useState('');
  const [parentalUnlock, setParentalUnlock] = useState('');
  const [showParentalUnlock, setShowParentalUnlock] = useState(false);
  const [qrCode, setQrCode] = useState('');

  if (!user || !settings) return <div className="loading-center"><div className="spinner" /></div>;

  const inviteUrl = `${window.location.origin}/invite?ref=${user.referral_code || user.username}`;

  const handleThemeChange = (theme: 'light' | 'dark') => {
    updateSettings({ theme });
  };

  const handlePrivateToggle = (isPrivate: boolean) => {
    updateSettings({ is_private: isPrivate });
    updateProfile({ is_private: isPrivate });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast('Invite link copied!');
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on Lumi! ${inviteUrl}`)}`, '_blank');
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Join me on Lumi!')}`, '_blank');
  };

  const shareEmail = () => {
    window.open(`mailto:?subject=Join me on Lumi&body=${encodeURIComponent(`Hey! I'm using Lumi. Join me here: ${inviteUrl}`)}`, '_blank');
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lumi', text: 'Join me on Lumi!', url: inviteUrl });
        showToast('Shared successfully');
      } catch {}
    } else {
      copyInviteLink();
    }
  };

  const generateQR = () => {
    // Simple QR code via public API
    setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`);
  };

  const enableParentalLock = async () => {
    if (parentalPassword.length < 4) {
      showToast('Password must be at least 4 characters');
      return;
    }
    await updateSettings({
      parental_lock_enabled: true,
      parental_lock_password: parentalPassword,
      explicit_content_filter: true,
      parental_block_dms: true,
    });
    setShowParentalSetup(false);
    setParentalPassword('');
    showToast('Parental Lock enabled');
  };

  const disableParentalLock = async () => {
    if (parentalUnlock !== settings.parental_lock_password) {
      showToast('Incorrect password');
      return;
    }
    await updateSettings({
      parental_lock_enabled: false,
      parental_lock_password: null,
      parental_block_dms: false,
    });
    setShowParentalUnlock(false);
    setParentalUnlock('');
    showToast('Parental Lock disabled');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Appearance */}
      <div className="settings-section">
        <h2 className="settings-section-title">Appearance</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="title">Theme</div>
            <div className="desc">Choose between light and dark mode</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className={`btn btn-sm ${settings.theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleThemeChange('light')}
            >
              <Sun size={14} /> Light
            </button>
            <button
              className={`btn btn-sm ${settings.theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="title">Private Account</div>
            <div className="desc">When enabled, only approved followers can see your posts</div>
          </div>
          <Toggle active={settings.is_private} onChange={handlePrivateToggle} />
        </div>
        <div className="settings-row" style={{ cursor: 'pointer' }} onClick={() => onNavigate('edit-profile')}>
          <div className="settings-row-info">
            <div className="title">Edit Profile</div>
            <div className="desc">Change your name, bio, and profile photo</div>
          </div>
          <User size={20} color="var(--text-tertiary)" />
        </div>
      </div>

      {/* AI & Safety */}
      <div className="settings-section">
        <h2 className="settings-section-title">AI & Content Safety</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="title"><Shield size={14} style={{ display: 'inline', marginRight: '4px' }} />Fake News Checker</div>
            <div className="desc">Show AI fact-check badges on posts</div>
          </div>
          <Toggle active={settings.fake_news_checker} onChange={v => updateSettings({ fake_news_checker: v })} />
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="title"><ShieldAlert size={14} style={{ display: 'inline', marginRight: '4px' }} />Explicit Content Filter</div>
            <div className="desc">Blur or hide mature content in your feed</div>
          </div>
          <Toggle active={settings.explicit_content_filter} onChange={v => updateSettings({ explicit_content_filter: v })} />
        </div>
      </div>

      {/* Parental Lock */}
      <div className="settings-section">
        <h2 className="settings-section-title"><Lock size={16} style={{ display: 'inline', marginRight: '4px' }} />Parental Lock</h2>
        {settings.parental_lock_enabled ? (
          <>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="title">Parental Lock Active</div>
                <div className="desc">Explicit content restricted, screen time limited, unknown DMs blocked</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowParentalUnlock(true)}>Disable</button>
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="title">Block Unknown DMs</div>
                <div className="desc">Only allow messages from people you follow</div>
              </div>
              <Toggle active={settings.parental_block_dms} onChange={v => updateSettings({ parental_block_dms: v })} />
            </div>
            <div className="settings-row">
              <div className="settings-row-info">
                <div className="title">Daily Screen Time Limit</div>
                <div className="desc">Current: {settings.parental_screen_time_limit} minutes</div>
              </div>
              <input
                type="range"
                min={30}
                max={480}
                step={30}
                value={settings.parental_screen_time_limit}
                onChange={e => updateSettings({ parental_screen_time_limit: parseInt(e.target.value) })}
                style={{ width: 120 }}
              />
            </div>
          </>
        ) : (
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="title">Enable Parental Lock</div>
              <div className="desc">Restrict explicit content, set screen time limits, and block unknown DMs</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowParentalSetup(true)}>Enable</button>
          </div>
        )}
      </div>

      {/* Invite Friends */}
      <div className="settings-section">
        <h2 className="settings-section-title"><Share2 size={16} style={{ display: 'inline', marginRight: '4px' }} />Invite Friends</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="title">Your Referral Code</div>
            <div className="desc">{user.referral_code || 'LUMI' + user.username.slice(0, 4).toUpperCase()}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setShowInvite(true)}>
            <Link2 size={14} /> Invite
          </button>
        </div>
      </div>

      <button className="btn btn-outline w-full" onClick={signOut}>Log Out</button>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Friends">
        <div className="share-options">
          <div className="share-option" onClick={copyInviteLink}>
            <div className="icon-circle" style={{ background: 'var(--accent)' }}><Copy size={20} /></div>
            <span>Copy Link</span>
          </div>
          <div className="share-option" onClick={shareWhatsApp}>
            <div className="icon-circle" style={{ background: '#25D366' }}><MessageCircle size={20} /></div>
            <span>WhatsApp</span>
          </div>
          <div className="share-option" onClick={shareTelegram}>
            <div className="icon-circle" style={{ background: '#0088cc' }}><Send size={20} /></div>
            <span>Telegram</span>
          </div>
          <div className="share-option" onClick={shareEmail}>
            <div className="icon-circle" style={{ background: '#EA4335' }}><Mail size={20} /></div>
            <span>Email</span>
          </div>
          <div className="share-option" onClick={nativeShare}>
            <div className="icon-circle" style={{ background: 'var(--secondary)' }}><Share2 size={20} /></div>
            <span>Share</span>
          </div>
          <div className="share-option" onClick={generateQR}>
            <div className="icon-circle" style={{ background: 'var(--neutral-700)' }}><QrCode size={20} /></div>
            <span>QR Code</span>
          </div>
        </div>
        {qrCode && (
          <div className="qr-container">
            <img src={qrCode} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 'var(--radius-md)' }} />
            <p className="text-sm text-muted">Scan to join Lumi</p>
          </div>
        )}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div className="label">Invite Link</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input className="input" readOnly value={inviteUrl} />
            <button className="btn btn-primary btn-sm" onClick={copyInviteLink}><Copy size={14} /></button>
          </div>
        </div>
      </Modal>

      {/* Parental Setup Modal */}
      <Modal open={showParentalSetup} onClose={() => setShowParentalSetup(false)} title="Set Parental Lock Password">
        <p className="text-muted mb-4">Create a password to manage the Parental Lock. You'll need this password to disable it later.</p>
        <input
          className="input"
          type="password"
          placeholder="Create password"
          value={parentalPassword}
          onChange={e => setParentalPassword(e.target.value)}
        />
        <button className="btn btn-primary w-full mt-4" onClick={enableParentalLock}>Enable Parental Lock</button>
      </Modal>

      {/* Parental Unlock Modal */}
      <Modal open={showParentalUnlock} onClose={() => setShowParentalUnlock(false)} title="Enter Password to Disable">
        <p className="text-muted mb-4">Enter your Parental Lock password to disable it.</p>
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={parentalUnlock}
          onChange={e => setParentalUnlock(e.target.value)}
        />
        <button className="btn btn-primary w-full mt-4" onClick={disableParentalLock}>Disable Parental Lock</button>
      </Modal>
    </div>
  );
};
