import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Story } from '../lib/supabase';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { StoryViewer } from './StoryViewer';
import { CreateStoryModal } from './CreateStoryModal';

interface StoriesBarProps {
  stories: Story[];
  onOpenProfile?: (userId: string) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ stories }) => {
  const { user } = useAuth();
  const [viewing, setViewing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="stories-bar" ref={scrollRef}>
        {user && (
          <div className="story-item story-add" onClick={() => setCreating(true)} style={{ cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={user.avatar_url} alt={user.username} size="md" />
              <div className="story-add-btn"><Plus size={14} /></div>
            </div>
            <div className="username">Your Story</div>
          </div>
        )}
        {stories.map((s, i) => (
          <div key={s.id} className="story-item" onClick={() => setViewing(i)} style={{ cursor: 'pointer' }}>
            <Avatar src={s.profiles?.avatar_url || ''} alt={s.profiles?.username || ''} size="md" ring />
            <div className="username ellipsis">{s.profiles?.username}</div>
          </div>
        ))}
      </div>
      {viewing !== null && (
        <StoryViewer stories={stories} initialIndex={viewing} onClose={() => setViewing(null)} />
      )}
      {creating && <CreateStoryModal onClose={() => setCreating(false)} />}
    </>
  );
};
