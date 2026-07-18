import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play, Volume2, VolumeX, Trash2 } from 'lucide-react';
import { Reel } from '../lib/supabase';
import { Avatar } from './Avatar';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { ShareModal } from './ShareModal';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';

interface ReelCardProps {
  reel: Reel;
  onOpenProfile?: (userId: string) => void;
  onDelete?: (reelId: string) => void;
}

export const ReelCard: React.FC<ReelCardProps> = ({ reel, onOpenProfile, onDelete }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const profile = reel.profiles;
  const isMyReel = user?.id === reel.user_id;
  const shareUrl = `${window.location.origin}/?reel=${reel.id}`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && videoRef.current) {
          videoRef.current.play().catch(() => {});
        } else if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.6 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLike = () => {
    if (!liked) {
      setLiked(true);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
      supabase.from('likes').insert({ user_id: user?.id, reel_id: reel.id }).then();
      supabase.from('notifications').insert({ recipient_id: reel.user_id, actor_id: user?.id, type: 'reel_like', reel_id: reel.id }).then();
    } else {
      setLiked(false);
      setShowBreak(true);
      setTimeout(() => setShowBreak(false), 800);
      supabase.from('likes').delete().eq('user_id', user?.id).eq('reel_id', reel.id).then();
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (onDelete) onDelete(reel.id);
  };

  return (
    <div className="reel-item" onDoubleClick={handleLike}>
      {reel.video_url ? (
        <video
          ref={videoRef}
          src={reel.video_url}
          loop
          muted={muted}
          playsInline
          className="reel-thumbnail"
          poster={reel.thumbnail_url}
        />
      ) : (
        <img src={reel.thumbnail_url} alt={reel.caption} className="reel-thumbnail" />
      )}

      {showHeart && <div className="heart-burst"><Heart size={80} fill="white" /></div>}
      {showBreak && <div className="heart-break"><Heart size={80} fill="white" /></div>}

      <div className="reel-overlay">
        <div className="reel-user" onClick={() => onOpenProfile?.(reel.user_id)} style={{ cursor: 'pointer' }}>
          <Avatar src={profile?.avatar_url || ''} alt={profile?.username || ''} size="sm" ring />
          <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            {profile?.username}
            {profile?.is_verified && <VerifiedBadge />}
            {profile?.is_owner && <OwnerBadge />}
          </span>
        </div>
        <div className="reel-caption">{reel.caption}</div>
      </div>

      <div className="reel-actions">
        <div className="reel-action" onClick={handleLike}>
          <Heart size={28} fill={liked ? 'var(--error)' : 'none'} color={liked ? 'var(--error)' : 'white'} />
          <span>{(reel.like_count + (liked ? 1 : 0)).toLocaleString()}</span>
        </div>
        <div className="reel-action">
          <MessageCircle size={28} />
          <span>{reel.comment_count.toLocaleString()}</span>
        </div>
        <div className="reel-action" onClick={() => setShowShare(true)}>
          <Send size={28} />
          <span>Share</span>
        </div>
        <div className="reel-action" onClick={() => { setSaved(!saved); showToast(saved ? 'Removed' : 'Saved'); }}>
          <Bookmark size={28} fill={saved ? 'white' : 'none'} />
          <span>{reel.view_count.toLocaleString()}</span>
        </div>
        {reel.video_url && (
          <div className="reel-action" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={28} /> : <Volume2 size={28} />}
          </div>
        )}
        {isMyReel && (
          <div className="reel-action" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={28} />
          </div>
        )}
      </div>

      {showMenu && isMyReel && (
        <div style={{ position: 'absolute', right: 'var(--space-3)', bottom: '180px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 20, minWidth: 160 }}>
          <button className="btn-ghost w-full" style={{ padding: '12px', color: 'var(--error)', textAlign: 'left' }} onClick={handleDelete}>
            <Trash2 size={16} style={{ display: 'inline', marginRight: '8px' }} /> Delete Reel
          </button>
        </div>
      )}

      {!reel.video_url && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', opacity: 0.5 }}>
          <Play size={48} />
        </div>
      )}

      <ShareModal open={showShare} onClose={() => setShowShare(false)} url={shareUrl} text={reel.caption} />
    </div>
  );
};
