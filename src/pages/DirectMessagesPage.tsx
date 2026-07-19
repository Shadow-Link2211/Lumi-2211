import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Search, MessageCircle, Edit2, Trash2, Copy, Forward, Smile } from 'lucide-react';
import { Conversation, Message, Profile, Reaction } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { OwnerBadge, VerifiedBadge } from '../components/Badges';
import { useAuth } from '../lib/auth';
import { formatLastSeen } from '../lib/presence';
import { requestNotificationPermission, showMessageNotification, setOpenConversation } from '../lib/notifications';

interface DirectMessagesProps {
  initialUserId?: string;
  onOpenProfile: (userId: string) => void;
}

interface ConversationWithOther extends Conversation {
  other_user: Profile;
  unread_count: number;
}

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '👏'];

interface ContextMenuState {
  x: number;
  y: number;
  message: Message;
}

interface ForwardState {
  message: Message;
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [reactionMenu, setReactionMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardState, setForwardState] = useState<ForwardState | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardResults, setForwardResults] = useState<Profile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in realtime subscriptions
  const activeConvRef = useRef<ConversationWithOther | null>(null);
  const userRef = useRef(user);
  useEffect(() => { activeConvRef.current = activeConv; setOpenConversation(activeConv?.id || null); }, [activeConv]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Request notification permission on mount
  useEffect(() => { requestNotificationPermission(); }, []);

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
    const withUnread = convs.map(c => ({ ...c, unread_count: unreadByConv[c.id] || 0 }));

    const active = activeConvRef.current;
    setConversations(withUnread.map(c => (active && c.id === active.id ? { ...c, unread_count: 0 } : c)));

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

  // Load reactions for the active conversation's messages
  const loadReactionsFor = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('reactions').select('*').in('message_id', messageIds);
    return (data as Reaction[]) || [];
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('dm-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as Message;
        const currentUser = userRef.current;
        const active = activeConvRef.current;
        if (!currentUser) return;

        // Fetch sender profile for the message
        const { data: senderProfile } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).maybeSingle();

        if (active && msg.conversation_id === active.id) {
          const fullMsg = { ...msg, sender: senderProfile as Profile };
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, fullMsg]);
          if (msg.sender_id !== currentUser.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
          }
        } else if (msg.sender_id !== currentUser.id) {
          setConversations(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, unread_count: c.unread_count + 1 } : c));
          // Push notification for incoming message
          if (senderProfile) {
            const conv = (await supabase.from('conversations').select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)').eq('id', msg.conversation_id).maybeSingle()).data;
            const isOne = conv?.participant_one === currentUser.id;
            const otherId = isOne ? conv?.participant_two : conv?.participant_one;
            showMessageNotification({
              messageId: msg.id,
              senderName: (senderProfile as Profile).username,
              senderAvatar: (senderProfile as Profile).avatar_url || undefined,
              messagePreview: msg.content,
              conversationId: msg.conversation_id,
              otherUserId: otherId || '',
            });
          }
        }
        loadConversations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as Message;
        const active = activeConvRef.current;
        if (active && updated.conversation_id === active.id) {
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
        loadConversations();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages(prev => prev.filter(m => m.id !== deleted.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, async (payload) => {
        const r = payload.new as Reaction;
        setMessages(prev => prev.map(m => m.id === r.message_id ? { ...m, reactions: [...(m.reactions || []), r] } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, (payload) => {
        const r = payload.old as Reaction;
        setMessages(prev => prev.map(m => m.id === r.message_id ? { ...m, reactions: (m.reactions || []).filter(x => x.id !== r.id) } : m));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as Profile;
        setPresenceMap(prev => ({ ...prev, [p.id]: { is_online: p.is_online, last_seen_at: p.last_seen_at } }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

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
      if (data) {
        const msgs = data as unknown as Message[];
        const reactions = await loadReactionsFor(msgs.map(m => m.id));
        const reactionsByMsg: Record<string, Reaction[]> = {};
        reactions.forEach(r => { (reactionsByMsg[r.message_id] = reactionsByMsg[r.message_id] || []).push(r); });
        setMessages(msgs.map(m => ({ ...m, reactions: reactionsByMsg[m.id] || [] })));
      }
      await supabase.from('messages').update({ is_read: true }).eq('conversation_id', activeConv.id).neq('sender_id', user.id).eq('is_read', false);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, unread_count: 0 } : c));
    };
    loadMessages();
  }, [activeConv, user, loadReactionsFor]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async (otherUserId: string) => {
    if (!user) return;
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
    const content = messageText.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeConv.id,
      sender_id: user.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      sender: user,
      reactions: [],
    };
    setMessages(prev => [...prev, optimistic]);
    setMessageText('');

    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: user.id, content })
      .select('*, sender:profiles!messages_sender_id_fkey(*)')
      .single();
    if (data) {
      const realMsg = data as unknown as Message;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...realMsg, reactions: [] } : m));
      await supabase.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', activeConv.id);
      await supabase.from('notifications').insert({ recipient_id: activeConv.other_user.id, actor_id: user.id, type: 'message', message_id: realMsg.id });
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // ===== Edit / Unsend =====
  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.content);
    setContextMenu(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const saveEdit = async (msg: Message) => {
    if (!editText.trim() || !user) return;
    await supabase.from('messages').update({ content: editText.trim(), edited_at: new Date().toISOString() }).eq('id', msg.id);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m));
    cancelEdit();
  };

  const unsendMessage = async (msg: Message) => {
    if (!user) return;
    setContextMenu(null);
    await supabase.from('messages').delete().eq('id', msg.id);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  };

  // ===== Context menu =====
  const openContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 240);
    setContextMenu({ x, y, message: msg });
    setReactionMenu(null);
  };

  const copyMessage = (msg: Message) => {
    navigator.clipboard?.writeText(msg.content);
    setContextMenu(null);
  };

  // ===== Reactions =====
  const openReactionMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 260);
    const y = Math.min(e.clientY, window.innerHeight - 60);
    setReactionMenu({ x, y, messageId: msg.id });
  };

  const toggleReaction = async (msg: Message, emoji: string) => {
    if (!user) return;
    setReactionMenu(null);
    const existing = (msg.reactions || []).find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: (m.reactions || []).filter(r => r.id !== existing.id) } : m));
    } else {
      // Remove any prior reaction by this user on this message (one reaction per user per message)
      const prior = (msg.reactions || []).filter(r => r.user_id === user.id);
      if (prior.length > 0) {
        await supabase.from('reactions').delete().eq('user_id', user.id).eq('message_id', msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: (m.reactions || []).filter(r => r.user_id !== user.id) } : m));
      }
      const { data } = await supabase.from('reactions').insert({ message_id: msg.id, user_id: user.id, emoji }).select().single();
      if (data) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: [...(m.reactions || []), data as Reaction] } : m));
      }
    }
  };

  // ===== Forward =====
  const openForward = (msg: Message) => {
    setForwardState({ message: msg });
    setContextMenu(null);
  };

  const handleForwardSearch = async () => {
    if (!forwardSearch.trim()) { setForwardResults([]); return; }
    const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${forwardSearch}%,full_name.ilike.%${forwardSearch}%`).neq('id', user?.id || '').limit(10);
    setForwardResults((data as Profile[]) || []);
  };

  const forwardTo = async (target: Profile) => {
    if (!user || !forwardState) return;
    // Find or create conversation with target
    const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant_one.eq.${user.id},participant_two.eq.${target.id}),and(participant_one.eq.${target.id},participant_two.eq.${user.id})`).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: newConv } = await supabase.from('conversations').insert({ participant_one: user.id, participant_two: target.id }).select('id').single();
      convId = newConv?.id;
    }
    if (convId) {
      await supabase.from('messages').insert({ conversation_id: convId, sender_id: user.id, content: forwardState.message.content });
      await supabase.from('conversations').update({ last_message: forwardState.message.content, last_message_at: new Date().toISOString() }).eq('id', convId);
      await supabase.from('notifications').insert({ recipient_id: target.id, actor_id: user.id, type: 'message' });
    }
    setForwardState(null);
    setForwardSearch('');
    setForwardResults([]);
  };

  // Close menus on outside click
  useEffect(() => {
    const close = () => { setContextMenu(null); setReactionMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, []);

  if (!user) return null;

  // Group reactions by emoji for display
  const renderReactions = (msg: Message) => {
    const grouped: Record<string, Reaction[]> = {};
    (msg.reactions || []).forEach(r => { (grouped[r.emoji] = grouped[r.emoji] || []).push(r); });
    const entries = Object.entries(grouped);
    if (entries.length === 0) return null;
    return (
      <div className="message-reactions">
        {entries.map(([emoji, reactions]) => (
          <button key={emoji} className="reaction-chip" onClick={(e) => { e.stopPropagation(); toggleReaction(msg, emoji); }}>
            <span>{emoji}</span>
            <span className="count">{reactions.length}</span>
          </button>
        ))}
      </div>
    );
  };

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
              <input className="input" style={{ paddingLeft: '36px' }} placeholder="Search..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); handleSearch(); }} />
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
                {messages.map(m => {
                  const isMine = m.sender_id === user.id;
                  return (
                    <div
                      key={m.id}
                      className={`dm-message-row ${isMine ? 'mine' : 'theirs'}`}
                      onContextMenu={(e) => openContextMenu(e, m)}
                    >
                      <div className={`dm-message ${isMine ? 'sent' : 'received'}`}>
                        {editingId === m.id ? (
                          <div className="edit-row">
                            <input className="input edit-input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') cancelEdit(); }} autoFocus />
                            <button className="btn btn-primary btn-sm" onClick={() => saveEdit(m)}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <span className="message-content">{m.content}</span>
                            {m.edited_at && <span className="edited-indicator">Edited</span>}
                          </>
                        )}
                      </div>
                      {editingId !== m.id && renderReactions(m)}
                      {editingId !== m.id && (
                        <button className="reaction-trigger" onClick={(e) => openReactionMenu(e, m)} title="React">
                          <Smile size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {messages.length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', margin: 'auto' }}>Say hello!</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className="dm-input-bar">
                <input className="input" placeholder="Message..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
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

      {/* Context menu */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={() => openForward(contextMenu.message)}>
            <Forward size={16} /> <span>Forward</span>
          </div>
          <div className="context-menu-item" onClick={() => copyMessage(contextMenu.message)}>
            <Copy size={16} /> <span>Copy</span>
          </div>
          {contextMenu.message.sender_id === user.id && (
            <>
              <div className="context-menu-item" onClick={() => startEdit(contextMenu.message)}>
                <Edit2 size={16} /> <span>Edit</span>
              </div>
              <div className="context-menu-item danger" onClick={() => unsendMessage(contextMenu.message)}>
                <Trash2 size={16} /> <span>Unsend</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reaction picker */}
      {reactionMenu && (
        <div className="reaction-picker" style={{ left: reactionMenu.x, top: reactionMenu.y }} onClick={e => e.stopPropagation()}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} className="reaction-emoji" onClick={() => {
              const msg = messages.find(m => m.id === reactionMenu.messageId);
              if (msg) toggleReaction(msg, emoji);
            }}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Forward modal */}
      {forwardState && (
        <div className="modal-overlay" onClick={() => { setForwardState(null); setForwardSearch(''); setForwardResults([]); }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Forward Message</h2>
              <button className="btn-icon" onClick={() => { setForwardState(null); setForwardSearch(''); setForwardResults([]); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="forward-preview">"{forwardState.message.content}"</div>
              <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input className="input" style={{ paddingLeft: '36px' }} placeholder="Search people..." value={forwardSearch} onChange={e => { setForwardSearch(e.target.value); handleForwardSearch(); }} />
              </div>
              <div className="forward-results">
                {forwardResults.map(p => (
                  <div key={p.id} className="forward-result-item" onClick={() => forwardTo(p)}>
                    <Avatar src={p.avatar_url} alt={p.username} size="sm" />
                    <div>
                      <div className="font-semibold" style={{ fontSize: 14 }}>{p.username}</div>
                      <div className="text-sm text-muted" style={{ fontSize: 12 }}>{p.full_name}</div>
    </div>
                  </div>
                ))}
                {forwardResults.length === 0 && forwardSearch && <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>No users found</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
