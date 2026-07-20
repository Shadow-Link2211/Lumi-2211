import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Reel } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { ReelCard } from '../components/ReelCard';
import { CreateReelModal } from '../components/CreateReelModal';
import { useAuth } from '../lib/auth';

export const ReelsPage: React.FC<{ onOpenProfile?: (userId: string) => void }> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadReels = useCallback(async (reset = false) => {
    if (reset) { setLoading(true); setPage(0); setHasMore(true); }
    const pageNum = reset ? 0 : page;
    const { data } = await supabase
      .from('reels')
      .select('*, profiles!reels_user_id_fkey(*)')
      .order('created_at', { ascending: false })
      .range(pageNum * 10, (pageNum + 1) * 10 - 1);
    const newReels = (data as unknown as Reel[]) || [];
    if (reset) {
      setReels(newReels);
    } else {
      setReels(prev => [...prev, ...newReels]);
    }
    if (newReels.length < 10) setHasMore(false);
    setLoading(false);
    setLoadingMore(false);
  }, [page]);

  useEffect(() => { loadReels(true); }, []);

  // Infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 200 && hasMore && !loadingMore) {
        setLoadingMore(true);
        setPage(p => p + 1);
        loadReels(false);
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loadReels]);

  const handleDelete = (reelId: string) => {
    setReels(prev => prev.filter(r => r.id !== reelId));
    supabase.from('reels').delete().eq('id', reelId).then();
  };

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  if (reels.length === 0) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <p>No reels yet</p>
        <p className="text-sm">Be the first to share a reel!</p>
        <button className="btn btn-primary mt-4" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> Create Reel
        </button>
        {showCreate && <CreateReelModal onClose={() => setShowCreate(false)} onCreated={() => loadReels(true)} />}
      </div>
    );
  }

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setShowCreate(true)}
        style={{ position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 50 }}
      >
        <Plus size={18} /> Create
      </button>
      <div className="reels-scroll-container" ref={containerRef}>
        {reels.map(reel => (
          <div key={reel.id} className="reels-scroll-item">
            <ReelCard reel={reel} onOpenProfile={onOpenProfile} onDelete={handleDelete} fullscreen />
          </div>
        ))}
        {loadingMore && <div className="loading-more"><div className="spinner" /></div>}
      </div>
      {showCreate && <CreateReelModal onClose={() => setShowCreate(false)} onCreated={() => loadReels(true)} />}
    </>
  );
};
