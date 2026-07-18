import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Send, Play, Volume2, VolumeX } from 'lucide-react';
import { Reel } from '../lib/supabase';
import { Avatar } from './Avatar';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { ShareModal } from './ShareModal';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';

interface FeedReelCardProps {
  reel: Reel;
  onOpenProfile?: (userId: string) => void;
}

export const FeedReelCard: React.FC<FeedReelCardProps> = ({ reel, onOpenProfile }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const profile = reel.profiles;
  const shareUrl = `${window.location.origin}/?reel=${reel.id}`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && videoRef.current) videoRef.current.play().catch(() => {});
        else if (videoRef.current) videoRef.current.pause();
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

  return (
    <article className="post-card" style={{ paddingBottom: 'var(--space-3)' }}>
      <div className="post-header">
        <div className="post-user" onClick={() => onOpenProfile?.(reel.user_id)} style={{ cursor: 'pointer' }}>
          <Avatar src={profile?.avatar_url || ''} alt={profile?.username || ''} size="sm" ring />
          <div style={{ minWidth: 0 }}>
            <div className="username-text">
              {profile?.username}
              {profile?.is_verified && <VerifiedBadge />}
              {profile?.is_owner && <OwnerBadge />}
            </div>
            <div className="location-text">Reel</div>
          </div>
        </div>
      </div>

      <div className="post-image-wrapper" onDoubleClick={handleLike} style={{ aspectRatio: '9/16', maxHeight: 600 }}>
        {reel.video_url ? (
          <video ref={videoRef} src={reel.video_url} loop muted={muted} playsInline className="post-image" poster={reel.thumbnail_url} style={{ objectFit: 'cover' }} />
        ) : (
          <img src={reel.thumbnail_url} alt={reel.caption} className="post-image" />
        )}
        {showHeart && <div className="heart-burst"><Heart size={80} fill="white" /></div>}
        {showBreak && <div className="heart-break"><Heart size={80} fill="white" /></div>}
        {!reel.video_url && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', opacity: 0.5 }}>
            <Play size={48} />
          </div>
        )}
        {reel.video_url && (
          <button className="btn-icon" style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(0,0,0,0.5)', color: 'white' }} onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
      </div>

      <div className="post-actions">
        <button className="btn-icon" onClick={handleLike} style={{ color: liked ? 'var(--error)' : undefined }}>
          <Heart size={24} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button className="btn-icon"><MessageCircle size={24} /></button>
        <button className="btn-icon" onClick={() => setShowShare(true)}><Send size={24} /></button>
        <div className="spacer" />
      </div>

      <div className="post-likes">{(reel.like_count + (liked ? 1 : 0)).toLocaleString()} likes</div>
      <div className="post-caption">
        <span className="username-text">{profile?.username}</span>
        {reel.caption}
      </div>
      <div className="post-time">{new Date(reel.created_at).toLocaleDateString()}</div>

      <ShareModal open={showShare} onClose={() => setShowShare(false)} url={shareUrl} text={reel.caption} />
    </article>
  );
};
