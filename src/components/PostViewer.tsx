import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Post, Reel } from '../lib/supabase';
import { PostCard } from './PostCard';
import { ReelCard } from './ReelCard';

interface PostViewerProps {
  posts: Post[];
  reels: Reel[];
  initialType: 'post' | 'reel';
  initialIndex: number;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onDeletePost?: (id: string) => void;
  onDeleteReel?: (id: string) => void;
}

export const PostViewer: React.FC<PostViewerProps> = ({ posts, reels, initialType, initialIndex, onClose, onOpenProfile, onDeletePost, onDeleteReel }) => {
  const [type, setType] = useState<'post' | 'reel'>(initialType);
  const [index, setIndex] = useState(initialIndex);

  const items = type === 'post' ? posts : reels;
  const current = items[index];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      if (e.key === 'ArrowRight' && index < items.length - 1) setIndex(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, items.length]);

  if (!current) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.9)' }}>
      <div style={{ maxWidth: 500, width: '100%', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button className="btn-icon" style={{ position: 'absolute', top: '-48px', right: 0, color: 'white', zIndex: 10 }} onClick={onClose}><X size={28} /></button>
        {index > 0 && <button className="btn-icon" style={{ position: 'absolute', left: '-56px', top: '50%', transform: 'translateY(-50%)', color: 'white', background: 'rgba(255,255,255,0.15)' }} onClick={() => setIndex(index - 1)}><ChevronLeft size={28} /></button>}
        {index < items.length - 1 && <button className="btn-icon" style={{ position: 'absolute', right: '-56px', top: '50%', transform: 'translateY(-50%)', color: 'white', background: 'rgba(255,255,255,0.15)' }} onClick={() => setIndex(index + 1)}><ChevronRight size={28} /></button>}
        {type === 'post' ? (
          <PostCard post={current as Post} onOpenProfile={onOpenProfile} onDelete={onDeletePost} />
        ) : (
          <div style={{ maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReelCard reel={current as Reel} onOpenProfile={onOpenProfile} onDelete={onDeleteReel} />
          </div>
        )}
      </div>
    </div>
  );
};
