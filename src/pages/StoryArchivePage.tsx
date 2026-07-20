import React, { useState, useEffect } from 'react';
import { Archive, Film, Image as ImageIcon } from 'lucide-react';
import { Story } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { StoryViewer } from '../components/StoryViewer';

export const StoryArchivePage: React.FC = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .lt('expires_at', now)
        .order('created_at', { ascending: false });
      setStories((data as Story[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Archive size={22} />
        <h1 className="page-title">Story Archive</h1>
      </div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        Your expired stories. Only you can see them.
      </p>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <Archive size={48} style={{ opacity: 0.4, marginBottom: 'var(--space-3)' }} />
          <p>No archived stories yet</p>
          <p className="text-sm text-muted">Stories you share will appear here after they expire.</p>
        </div>
      ) : (
        <div className="profile-grid">
          {stories.map((story, i) => (
            <div key={story.id} className="profile-grid-item" onClick={() => setViewing(i)}>
              {story.media_type === 'video' ? (
                <>
                  <video src={story.media_url} className="reel-thumbnail" style={{ objectFit: 'cover' }} muted />
                  <div className="explore-overlay">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Film size={16} fill="white" />
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <img src={story.media_url} alt={story.caption || 'Archived story'} loading="lazy" />
                  <div className="explore-overlay">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ImageIcon size={16} fill="white" />
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {viewing !== null && (
        <StoryViewer stories={stories} initialIndex={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
};
