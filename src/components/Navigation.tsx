import React, { useState, useEffect } from 'react';
import { Home, Compass, Clapperboard, PlusSquare, Search, Bell, Send, User, Settings, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

export type Page = 'home' | 'explore' | 'reels' | 'create' | 'profile' | 'notifications' | 'messages' | 'search' | 'settings' | 'edit-profile';

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page, params?: any) => void;
  unreadNotifications: number;
  unreadMessages: number;
}

const navItems: { page: Page; label: string; icon: React.FC<any> }[] = [
  { page: 'home', label: 'Home', icon: Home },
  { page: 'search', label: 'Search', icon: Search },
  { page: 'explore', label: 'Explore', icon: Compass },
  { page: 'reels', label: 'Reels', icon: Clapperboard },
  { page: 'create', label: 'Create', icon: PlusSquare },
  { page: 'notifications', label: 'Notifications', icon: Bell },
  { page: 'messages', label: 'Messages', icon: Send },
];

export const Sidebar: React.FC<SidebarProps> = ({ current, onNavigate, unreadNotifications, unreadMessages }) => {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/assets/images/files_11030906-2026-07-18T17-00-19-421Z-files_11030906-2026-07-18T16-49-02-927Z-ed179abf-c932-4a59-ac3c-944712c405bf.webp" alt="Lumi" />
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = current === item.page;
          const badge = item.page === 'notifications' ? unreadNotifications : item.page === 'messages' ? unreadMessages : 0;
          return (
            <div
              key={item.page}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.page)}
            >
              <Icon />
              <span>{item.label}</span>
              {badge > 0 && <span className="badge-dot" />}
            </div>
          );
        })}
        <div
          className={`sidebar-item ${current === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigate('profile', { userId: user.id })}
        >
          <Avatar src={user.avatar_url} alt={user.username} size="sm" />
          <span>Profile</span>
        </div>
      </nav>
      <div className="sidebar-footer">
        <div className={`sidebar-item ${current === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')}>
          <Settings />
          <span>Settings</span>
        </div>
        <div className="sidebar-item" onClick={signOut}>
          <LogOut />
          <span>Logout</span>
        </div>
      </div>
    </aside>
  );
};

export const MobileNav: React.FC<SidebarProps> = ({ current, onNavigate, unreadNotifications, unreadMessages }) => {
  const { user } = useAuth();
  if (!user) return null;
  const items = [
    { page: 'home' as Page, icon: Home },
    { page: 'search' as Page, icon: Search },
    { page: 'create' as Page, icon: PlusSquare },
    { page: 'reels' as Page, icon: Clapperboard },
    { page: 'profile' as Page, icon: User },
  ];
  return (
    <nav className="mobile-nav">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = current === item.page;
        return (
          <div key={item.page} className={`mobile-nav-item ${isActive ? 'active' : ''}`} onClick={() => onNavigate(item.page, item.page === 'profile' ? { userId: user.id } : undefined)}>
            <Icon />
          </div>
        );
      })}
    </nav>
  );
};

export const MobileTopBar: React.FC<{ onNavigate: (page: Page) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="mobile-top-bar">
      <div className="sidebar-logo">
        <img src="/assets/images/files_11030906-2026-07-18T17-00-19-421Z-files_11030906-2026-07-18T16-49-02-927Z-ed179abf-c932-4a59-ac3c-944712c405bf.webp" alt="Lumi" />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn-icon" onClick={() => onNavigate('notifications')}><Bell size={22} /></button>
        <button className="btn-icon" onClick={() => onNavigate('messages')}><Send size={22} /></button>
      </div>
    </div>
  );
};
