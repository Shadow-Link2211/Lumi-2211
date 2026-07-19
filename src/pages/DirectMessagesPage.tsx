import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Search, MessageCircle } from 'lucide-react';
import { Conversation, Message, Profile } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { OwnerBadge, VerifiedBadge } from '../components/Badges';
import { useAuth } from '../lib/auth';
import { formatLastSeen } from '../lib/presence';

interface DirectMessagesProps {
  initialUserId?: string;
  onOpenProfile: (userId: string) => void;
}

interface ConversationWithOther extends Conversation {
  other_user: Profile;
  unread_count: number;
}

export const DirectMessagesPage: React.FC<DirectMessagesProps> = ({ initialUserId, onOpenProfile }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithOther[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationWithOther | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, { is_online: boolean; last_seen_at: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations with the OTHER participant's profile (never the current user)
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('conversations')
      .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    if (!data) return;
    const convs: ConversationWithOther[] = data.map(c => {
      const isOne = c.participant_one === user.id;
      const other = (isOne ? c.p2 : c.p1) as Profile;
      const otherId = isOne ? c.participant_two : c.participant_one;
      return {
        ...c,
        other_user: other || { id: otherId, username: 'User', full_name: '', avatar_url: '', is_online: false, last_seen_at: '', onboarded: false } as Profile,
        unread_count: 0,
      };
    });
    setConversations(convs);

    // Compute unread counts (messages not sent by me and not read)
    const unreadByConv: Record<string, number> = {};
    await Promise.all(convs.map(async c => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      unreadByConv[c.id] = count || 0;
    }));
    setConversations(prev => prev.map(c => ({ ...c, unread_count: unreadByConv[c.id] || 0 })));

    // Load presence for all other users
    const otherIds = convs.map(c => c.other_user.id);
    if (otherIds.length > 0) {
      const { data: presenceData } = await supabase.from('profiles').select('id, is_online, last_seen_at').in('id', otherIds);
      if (presenceData) {
        const map: Record<string, { is_online: boolean; last_seen_at: string }> = {};
        presenceData.forEach(p => { map[p.id] = { is_online: p.is_online, last_seen_at: p.last_seen_at }; });
        setPresenceMap(map);
      }
    }
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Real-time: new conversations, last_message updates, message inserts, read receipts, presence
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('dm-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        // If it's for the active conversation, append and mark read
        if (activeConv && msg.conversation_id === activeConv.id) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_id !== user.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
          }
        } else if (msg.sender_id !== user.id) {
          // Increment unread for the conversation
          setConversations(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, unread_count: c.unread_count + 1 } : c));
        }
        // Bump conversation order + last_message
        loadConversations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as Profile;
        setPresenceMap(prev => ({ ...prev, [p.id]: { is_online: p.is_online, last_seen_at: p.last_seen_at } }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activeConv, loadConversations]);

  useEffect(() => {
    if (initialUserId && user) startConversation(initialUserId);
  }, [initialUserId, user]);

  // Load messages for active conversation + mark as read
  useEffect(() => {
    if (!activeConv || !user) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('conversation_id', activeConv.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as unknown as Message[]);
      // Mark unread messages from the other user as read
      await supabase.from('messages').update({ is_read: true }).eq('conversation_id', activeConv.id).neq('sender_id', user.id).eq('is_read', false);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, unread_count: 0 } : c));
    };
    loadMessages();
  }, [activeConv, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async (otherUserId: string) => {
    if (!user) return;
    // Check for existing conversation in either direction
    const { data: existing } = await supabase
      .from('conversations')
      .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${otherUserId}),and(participant_one.eq.${otherUserId},participant_two.eq.${user.id})`)
      .maybeSingle();
    if (existing) {
      const isOne = existing.participant_one === user.id;
      const other = (isOne ? existing.p2 : existing.p1) as Profile;
      setActiveConv({ ...(existing as unknown as Conversation), other_user: other, unread_count: 0 });
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ participant_one: user.id, participant_two: otherUserId })
        .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
        .single();
      if (newConv) {
        const isOne = newConv.participant_one === user.id;
        const other = (isOne ? newConv.p2 : newConv.p1) as Profile;
        setActiveConv({ ...(newConv as unknown as Conversation), other_user: other, unread_count: 0 });
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
      .neq('id', user?.id || '')
      .limit(10);
    if (data) setSearchResults(data as Profile[]);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConv || !user) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeConv.id,
      sender_id: user.id,
      content: messageText.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
      sender: user,
    } as unknown as Message;
    setMessages(prev => [...prev, optimistic]);
    setMessageText('');
    // Insert asynchronously (don't block UI)
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: user.id, content: optimistic.content })
      .select('*, sender:profiles!messages_sender_id_fkey(*)')
      .single();
    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? (data as unknown as Message) : m));
      await supabase.from('conversations').update({ last_message: optimistic.content, last_message_at: new Date().toISOString() }).eq('id', activeConv.id);
      // Insert notification for recipient
      await supabase.from('notifications').insert({ recipient_id: activeConv.other_user.id, actor_id: user.id, type: 'message', message_id: (data as any).id });
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  if (!user) return null;

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="page-container wide">
      <div className="page-header">
        <h1 className="page-title">Messages</h1>
      </div>
      <div className="dm-layout">
        <div className={`dm-sidebar ${activeConv ? 'hidden-mobile' : ''}`}>
          <div className="dm-sidebar-header">{user.username}</div>
          <div className="dm-search">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                className="input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); handleSearch(); }}
              />
            </div>
          </div>
          <div className="dm-conversation-list">
            {searchResults.length > 0 ? (
              searchResults.map(p => (
                <div key={p.id} className="dm-conversation-item" onClick={() => { startConversation(p.id); setSearchResults([]); setSearchQuery(''); }}>
                  <Avatar src={p.avatar_url} alt={p.username} size="md" />
                  <div className="dm-conversation-info">
                    <div className="name">{p.username}</div>
                    <div className="last-msg">{p.full_name}</div>
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="dm-empty">
                <MessageCircle size={40} />
                <p className="font-semibold">No messages yet</p>
                <p className="text-sm">Search for someone to start chatting</p>
              </div>
            ) : (
              conversations.map(c => {
                const presence = presenceMap[c.other_user.id];
                const online = presence?.is_online;
                return (
                  <div key={c.id} className={`dm-conversation-item ${activeConv?.id === c.id ? 'active' : ''}`} onClick={() => setActiveConv(c)}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={c.other_user?.avatar_url || ''} alt={c.other_user?.username || ''} size="md" />
                      {online && <span className="presence-dot online" />}
                    </div>
                    <div className="dm-conversation-info">
                      <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        {c.other_user?.username}
                        {c.other_user?.is_verified && <VerifiedBadge />}
                        {c.other_user?.is_owner && <OwnerBadge />}
                      </div>
                      <div className="last-msg ellipsis">{c.last_message || 'Start a conversation'}</div>
                    </div>
                    {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`dm-chat ${!activeConv ? 'hidden-mobile' : ''}`}>
          {activeConv ? (
            <>
              <div className="dm-chat-header" onClick={() => onOpenProfile(activeConv.other_user?.id || '')} style={{ cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar src={activeConv.other_user?.avatar_url || ''} alt={activeConv.other_user?.username || ''} size="sm" />
                  {presenceMap[activeConv.other_user.id]?.is_online && <span className="presence-dot online" />}
                </div>
                <div>
                  <div className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    {activeConv.other_user?.username}
                    {activeConv.other_user?.is_verified && <VerifiedBadge />}
                    {activeConv.other_user?.is_owner && <OwnerBadge />}
                  </div>
                  <div className="text-sm text-muted" style={{ fontSize: 12 }}>
                    {formatLastSeen(presenceMap[activeConv.other_user.id]?.last_seen_at || null, presenceMap[activeConv.other_user.id]?.is_online || false)}
                  </div>
                </div>
              </div>
              <div className="dm-messages">
                {messages.map(m => (
                  <div key={m.id} className={`dm-message ${m.sender_id === user.id ? 'sent' : 'received'}`}>
                    {m.content}
                  </div>
                ))}
                {messages.length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', margin: 'auto' }}>Say hello!</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className="dm-input-bar">
                <input
                  className="input"
                  placeholder="Message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!messageText.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="dm-empty">
              <MessageCircle size={48} />
              <p className="font-semibold">Your Messages</p>
              <p className="text-sm">Select a conversation or search for someone to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
