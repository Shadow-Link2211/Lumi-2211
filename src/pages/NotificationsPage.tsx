import React, { useState, useEffect } from 'react';
import { Heart, UserPlus, MessageCircle, AtSign, Share2, Clapperboard } from 'lucide-react';
import { Notification } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../lib/auth';

interface NotificationsPageProps {
  onOpenProfile: (userId: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(*)')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications((data as unknown as Notification[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} fill="var(--error)" color="var(--error)" />;
      case 'follow': return <UserPlus size={16} color="var(--secondary)" />;
      case 'comment': return <MessageCircle size={16} color="var(--accent)" />;
      case 'mention': return <AtSign size={16} color="var(--secondary)" />;
      case 'share': return <Share2 size={16} color="var(--accent)" />;
      case 'reel_like': return <Clapperboard size={16} color="var(--error)" />;
      default: return <Heart size={16} />;
    }
  };

  const getText = (n: Notification) => {
    switch (n.type) {
      case 'like': return 'liked your post.';
      case 'follow': return 'started following you.';
      case 'comment': return 'commented on your post.';
      case 'mention': return 'mentioned you in a post.';
      case 'share': return 'shared your post.';
      case 'reel_like': return 'liked your reel.';
      default: return 'interacted with you.';
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Notifications</h1>
        {notifications.some(n => !n.is_read) && (
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="empty-state">
          <Heart />
          <p>No notifications yet</p>
          <p className="text-sm">When someone interacts with you, it'll show here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {notifications.map(n => (
            <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`} onClick={() => n.actor && onOpenProfile(n.actor.id)}>
              <div style={{ position: 'relative' }}>
                <Avatar src={n.actor?.avatar_url || ''} alt={n.actor?.username || ''} size="md" />
                <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--bg-primary)', borderRadius: '50%', padding: 2 }}>
                  {getIcon(n.type)}
                </div>
              </div>
              <div className="notification-content">
                <span className="username-text">{n.actor?.username || 'Someone'}</span> {getText(n)}
              </div>
              <div className="notification-time">{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
