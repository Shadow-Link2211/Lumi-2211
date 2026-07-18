import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Reel } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { ReelCard } from '../components/ReelCard';
import { CreateReelModal } from '../components/CreateReelModal';

export const ReelsPage: React.FC<{ onOpenProfile?: (userId: string) => void }> = ({ onOpenProfile }) => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadReels = async () => {
    setLoading(true);
    const { data } = await supabase.from('reels').select('*, profiles!reels_user_id_fkey(*)').order('created_at', { ascending: false }).limit(20);
    setReels((data as unknown as Reel[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadReels(); }, []);

  const handleDelete = (reelId: string) => {
    setReels(prev => prev.filter(r => r.id !== reelId));
    supabase.from('reels').delete().eq('id', reelId).then();
  };

  return (
    <div style={{ paddingTop: 'var(--space-4)', position: 'relative' }}>
      <button
        className="btn btn-primary"
        onClick={() => setShowCreate(true)}
        style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 10 }}
      >
        <Plus size={18} /> Create Reel
      </button>
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : reels.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 120 }}>
          <p>No reels yet</p>
          <p className="text-sm">Be the first to share a reel!</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Create Reel
          </button>
        </div>
      ) : (
        <div className="reels-container">
          {reels.map(reel => (
            <ReelCard key={reel.id} reel={reel} onOpenProfile={onOpenProfile} onDelete={handleDelete} />
          ))}
        </div>
      )}
      {showCreate && <CreateReelModal onClose={() => setShowCreate(false)} onCreated={loadReels} />}
    </div>
  );
};
