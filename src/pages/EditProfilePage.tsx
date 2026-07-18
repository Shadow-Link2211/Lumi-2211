import React, { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Avatar } from '../components/Avatar';
import { supabase } from '../lib/supabase';

export const EditProfilePage: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    await updateProfile({
      full_name: fullName,
      username,
      bio,
      website,
      avatar_url: avatarUrl,
    });
    setLoading(false);
    showToast('Profile updated successfully');
    onDone();
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Edit Profile</h1>
      </div>
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={avatarUrl} alt={username} size="lg" />
            <button
              className="btn-icon"
              style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent)', color: 'white', width: 32, height: 32 }}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={16} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>
          <div>
            <div className="font-bold">{user.username}</div>
            <button className="text-accent font-semibold text-sm" onClick={() => fileRef.current?.click()}>Change Profile Photo</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input textarea" value={bio} onChange={e => setBio(e.target.value)} maxLength={150} />
            <div className="text-xs text-tertiary" style={{ textAlign: 'right' }}>{bio.length}/150</div>
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : 'Save Changes'}
            </button>
            <button className="btn btn-outline" onClick={onDone}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};
