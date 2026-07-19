import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Profile } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      // Fetch the Owner first, then other verified/popular accounts
      const { data: owner } = await supabase.from('profiles').select('*').eq('is_owner', true).limit(1).maybeSingle();
      const { data: others } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id || '')
        .neq('is_owner', true)
        .order('follower_count', { ascending: false })
        .limit(8);
      const list: Profile[] = [];
      if (owner) list.push(owner as Profile);
      if (others) list.push(...(others as Profile[]).filter(p => p.id !== (owner as Profile)?.id));
      setSuggestions(list);
    };
    load();
  }, [user]);

  const toggleFollow = async (p: Profile) => {
    if (!user) return;
    if (followed.has(p.id)) {
      setFollowed(prev => { const n = new Set(prev); n.delete(p.id); return n; });
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', p.id);
    } else {
      setFollowed(prev => new Set(prev).add(p.id));
      await supabase.from('follows').insert({ follower_id: user.id, following_id: p.id });
      await supabase.from('notifications').insert({ recipient_id: p.id, actor_id: user.id, type: 'follow' });
    }
  };

  const finish = () => {
    showToast(`Following ${followed.size} account${followed.size === 1 ? '' : 's'}`);
    onComplete();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <button className="btn-icon" style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }} onClick={finish}><X size={20} /></button>
        <h2 className="onboarding-title">Welcome to Lumi</h2>
        <p className="onboarding-subtitle">Follow some accounts to get started. The Owner is recommended first.</p>
        <div className="onboarding-suggestions">
          {suggestions.map(p => (
            <div key={p.id} className="onboarding-suggestion">
              <Avatar src={p.avatar_url} alt={p.username} size="md" ring={p.is_owner} />
              <div className="info">
                <div className="name">
                  {p.username}
                  {p.is_verified && <VerifiedBadge />}
                  {p.is_owner && <OwnerBadge />}
                </div>
                <div className="bio">{p.bio || p.full_name}</div>
              </div>
              <button
                className={`btn btn-sm ${followed.has(p.id) ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => toggleFollow(p)}
              >
                {followed.has(p.id) ? <><Check size={14} /> Following</> : 'Follow'}
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-primary w-full" style={{ marginTop: 'var(--space-5)' }} onClick={finish}>
          {followed.size > 0 ? `Done — Following ${followed.size}` : 'Skip for now'}
        </button>
      </div>
    </div>
  );
};
