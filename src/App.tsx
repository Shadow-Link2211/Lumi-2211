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
import { supabase } from './lib/supabase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [page, setPage] = useState<Page>('home');
  const [pageParams, setPageParams] = useState<any>({});
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const navigate = (newPage: Page, params: any = {}) => {
    setPage(newPage);
    setPageParams(params);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (!user) return;
    const loadUnread = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('is_read', false);
      setUnreadNotifs(count || 0);
    };
    loadUnread();
  }, [user, page]);

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
      default: return <HomeFeed onOpenProfile={(uid) => navigate('profile', { userId: uid })} />;
    }
  };

  return (
    <div className="app">
      <Sidebar current={page} onNavigate={navigate} unreadNotifications={unreadNotifs} unreadMessages={unreadMessages} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MobileTopBar onNavigate={navigate} />
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
