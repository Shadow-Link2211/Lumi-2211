import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { Sidebar, MobileNav, MobileTopBar, Page } from './components/Navigation';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { HomeFeed } from './pages/HomeFeed';
import { ExplorePage } from './pages/ExplorePage';
import { ReelsPage } from './pages/ReelsPage';
import { SearchPage } from './pages/SearchPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CreatePostPage } from './pages/CreatePostPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { DirectMessagesPage } from './pages/DirectMessagesPage';
import { SettingsPage } from './pages/SettingsPage';
import { StoryArchivePage } from './pages/StoryArchivePage';
import { Onboarding } from './components/Onboarding';
import { supabase } from './lib/supabase';
import { startPresence, stopPresence } from './lib/presence';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [page, setPage] = useState<Page>('home');
  const [pageParams, setPageParams] = useState<any>({});
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const navigate = (newPage: Page, params: any = {}) => {
    setPage(newPage);
    setPageParams(params);
    window.scrollTo(0, 0);
  };

  // Start presence when logged in
  useEffect(() => {
    if (user) startPresence(user.id);
    return () => stopPresence();
  }, [user]);

  // Real-time unread notifications count
  useEffect(() => {
    if (!user) return;
    const loadUnread = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('is_read', false);
      setUnreadNotifs(count || 0);
    };
    loadUnread();
    const channel = supabase.channel('unread-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => loadUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => loadUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Real-time unread messages count (messages not sent by me and not read)
  useEffect(() => {
    if (!user) return;
    const loadUnread = async () => {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).neq('sender_id', user.id).eq('is_read', false);
      setUnreadMessages(count || 0);
    };
    loadUnread();
    const channel = supabase.channel('unread-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => loadUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Show onboarding for users who haven't completed it
  useEffect(() => {
    if (user && !user.onboarded) setShowOnboarding(true);
  }, [user]);

  // Listen for push-notification clicks to navigate to the conversation
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.otherUserId) navigate('messages', { userId: detail.otherUserId });
    };
    window.addEventListener('open-conversation', handler);
    return () => window.removeEventListener('open-conversation', handler);
  }, []);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (user) await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-secondary)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!user) {
    return authMode === 'login' ? (
      <LoginPage onSwitch={() => setAuthMode('signup')} />
    ) : (
      <SignupPage onSwitch={() => setAuthMode('login')} />
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'home': return <HomeFeed onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
      case 'explore': return <ExplorePage onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
      case 'reels': return <ReelsPage onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
      case 'search': return <SearchPage onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
      case 'create': return <CreatePostPage onPosted={() => navigate('profile', { userId: user.id })} />;
      case 'notifications': return <NotificationsPage onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
      case 'messages': return <DirectMessagesPage initialUserId={pageParams.userId} onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
      case 'profile': return <ProfilePage userId={pageParams.userId || user.id} onEditProfile={() => navigate('edit-profile')} onNavigate={navigate} />;
      case 'edit-profile': return <EditProfilePage onDone={() => navigate('profile', { userId: user.id })} />;
      case 'settings': return <SettingsPage onNavigate={navigate} />;
      case 'archive': return <StoryArchivePage />;
      default: return <HomeFeed onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
    }
  };

  return (
    <div className="app">
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <Sidebar current={page} onNavigate={navigate} unreadNotifications={unreadNotifs} unreadMessages={unreadMessages} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MobileTopBar onNavigate={navigate} unreadMessages={unreadMessages} />
        <main className="main-content">
          {renderPage()}
        </main>
        <MobileNav current={page} onNavigate={navigate} unreadNotifications={unreadNotifs} unreadMessages={unreadMessages} />
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </AuthProvider>
);

export default App;
