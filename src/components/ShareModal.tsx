import React, { useState, useEffect } from 'react';
import { Copy, MessageCircle, Send, Mail, Share2, QrCode, X, Search, Bookmark } from 'lucide-react';
import { Modal } from './Modal';
import { Avatar } from './Avatar';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Profile, Conversation } from '../lib/supabase';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  text: string;
  postId?: string;
  reelId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ open, onClose, url, text, postId, reelId }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [qr, setQr] = useState('');
  const [showDM, setShowDM] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

  useEffect(() => {
    if (showDM && user) {
      const load = async () => {
        const { data } = await supabase
          .from('conversations')
          .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
          .order('last_message_at', { ascending: false })
          .limit(20);
        if (data) {
          const convs = data.map(c => {
            const isOne = c.participant_one === user.id;
            return { ...c, other_user: isOne ? c.p2 : c.p1 } as unknown as Conversation;
          });
          setConversations(convs);
        }
      };
      load();
    }
  }, [showDM, user]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const search = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
          .neq('id', user?.id || '')
          .limit(10);
        setSearchResults((data as Profile[]) || []);
      };
      const t = setTimeout(search, 300);
      return () => clearTimeout(t);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(
      () => showToast('Link copied to clipboard'),
      () => showToast('Could not copy link'),
    );
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareEmail = () => {
    window.open(`mailto:?subject=Check this out on Lumi&body=${encodeURIComponent(`${text}\n\n${url}`)}`, '_blank');
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lumi', text, url });
        showToast('Shared successfully');
      } catch {}
    } else {
      copyLink();
    }
  };

  const generateQR = () => {
    setQr(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`);
  };

  const shareToDM = async (targetUserId: string) => {
    if (!user) return;
    let convId: string | null = null;
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${targetUserId}),and(participant_one.eq.${targetUserId},participant_two.eq.${user.id})`)
      .maybeSingle();
    if (existing) convId = existing.id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ participant_one: user.id, participant_two: targetUserId })
        .select('id')
        .single();
      convId = newConv?.id || null;
    }
    if (convId) {
      const msgData: any = { conversation_id: convId, sender_id: user.id, content: text };
      if (postId) msgData.shared_post_id = postId;
      if (reelId) msgData.shared_reel_id = reelId;
      await supabase.from('messages').insert(msgData);
      await supabase.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', convId);
      await supabase.from('notifications').insert({ recipient_id: targetUserId, actor_id: user.id, type: 'message' });
      showToast('Shared via DM');
      setShowDM(false);
      onClose();
    }
  };

  const shareToStory = async () => {
    if (!user) return;
    await supabase.from('stories').insert({
      user_id: user.id,
      media_url: url,
      media_type: 'image',
      caption: text,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    showToast('Shared to your story');
    setShowStory(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={showDM ? 'Send via DM' : 'Share'}>
      {showDM ? (
        <div>
          <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input className="input" style={{ paddingLeft: '36px' }} placeholder="Search people..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          {searchQuery.trim() && searchResults.length > 0 ? (
            <div className="search-results">
              {searchResults.map(p => (
                <div key={p.id} className="search-result-item" onClick={() => shareToDM(p.id)}>
                  <Avatar src={p.avatar_url} alt={p.username} size="md" />
                  <div className="search-result-info">
                    <div className="name">{p.username}</div>
                    <div className="sub">{p.full_name}</div>
                  </div>
                  <Send size={18} style={{ color: 'var(--primary)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="search-results">
              {conversations.length === 0 ? (
                <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No conversations yet. Search above to start sharing.</div>
              ) : (
                conversations.map(c => {
                  const other = (c as any).other_user as Profile;
                  if (!other) return null;
                  return (
                    <div key={c.id} className="search-result-item" onClick={() => shareToDM(other.id)}>
                      <Avatar src={other.avatar_url} alt={other.username} size="md" />
                      <div className="search-result-info">
                        <div className="name">{other.username}</div>
                        <div className="sub">{c.last_message || 'Tap to send'}</div>
                      </div>
                      <Send size={18} style={{ color: 'var(--primary)' }} />
                    </div>
                  );
                })
              )}
            </div>
          )}
          <button className="btn btn-ghost w-full mt-3" onClick={() => setShowDM(false)}>Back</button>
        </div>
      ) : showStory ? (
        <div>
          <p className="text-muted mb-4">Share this to your story? Your followers will see it for 24 hours.</p>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Preview:</div>
            <div style={{ fontWeight: 600 }}>{text}</div>
            <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 'var(--space-1)' }}>{url}</div>
          </div>
          <button className="btn btn-primary w-full mb-2" onClick={shareToStory}>Share to Story</button>
          <button className="btn btn-ghost w-full" onClick={() => setShowStory(false)}>Cancel</button>
        </div>
      ) : (
        <>
          <div className="share-options">
            <div className="share-option" onClick={() => setShowDM(true)}>
              <div className="icon-circle" style={{ background: 'var(--primary)' }}><MessageCircle size={20} /></div>
              <span>Send via DM</span>
            </div>
            <div className="share-option" onClick={() => setShowStory(true)}>
              <div className="icon-circle" style={{ background: 'var(--secondary)' }}><Bookmark size={20} /></div>
              <span>Add to Story</span>
            </div>
            <div className="share-option" onClick={copyLink}>
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
              <span>More</span>
            </div>
            <div className="share-option" onClick={generateQR}>
              <div className="icon-circle" style={{ background: 'var(--neutral-700)' }}><QrCode size={20} /></div>
              <span>QR Code</span>
            </div>
          </div>
          {qr && (
            <div className="qr-container">
              <img src={qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 'var(--radius-md)' }} />
              <p className="text-sm text-muted">Scan to open</p>
            </div>
          )}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div className="label">Link</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input className="input" readOnly value={url} />
              <button className="btn btn-primary btn-sm" onClick={copyLink}><Copy size={14} /></button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};
