'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Menu, AlertTriangle, User, ChevronDown, LogIn, LogOut, Shield, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { onEvent } from '@/lib/socket';
import toast from 'react-hot-toast';
import ThemeToggle from './ThemeToggle';

interface TopbarProps {
  onMenuToggle: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, token, logout, language, setLanguage } = useAuth();
  const router = useRouter();
  const [notificationList, setNotificationList] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      if (res.success) {
        setNotificationList(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  useEffect(() => {
    if (user) fetchNotifications();

    // ── Real-time Notifications ──────────────────────────────────────
    const unSubCreated = onEvent('complaint_created', () => {
      fetchNotifications();
      toast('New grievance reported in your area', { icon: '📢', style: { border: '1px solid #3b82f6', background: '#0f172a', color: '#fff' } });
    }, token);

    const unSubUpdated = onEvent('complaint_updated', (complaint) => {
      fetchNotifications();
      if (complaint.userId === user?.id) {
        toast.success(`Your complaint status updated: ${complaint.status}`, { icon: '✅' });
      }
    }, token);

    // Admin workflows emit this event to specific users/officers/super-admin.
    const unSubDirect = onEvent('complaint_notification', (payload) => {
      fetchNotifications();
      if (payload?.title || payload?.message) {
        toast(payload?.title || 'New update', {
          icon: '🔔',
          style: { border: '1px solid #22c55e', background: '#0f172a', color: '#fff' },
        });
      }
    }, token);

    return () => {
      unSubCreated();
      unSubUpdated();
      unSubDirect();
    };
  }, [user, token]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotificationList(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const unreadCount = notificationList.filter(n => !n.isRead).length;

  const handleSimulateCrisis = async () => {
    setCrisisLoading(true);
    try {
      const res: any = await api.simulateCrisis();
      if (res.success) {
        toast.success(res.message || 'Crisis simulated!', { icon: '🚨', duration: 5000 });
        window.dispatchEvent(new CustomEvent('crisis-simulated'));
      } else {
        toast.error('Failed to simulate crisis');
      }
    } catch {
      toast.error('Error simulating crisis');
    } finally {
      setCrisisLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    PUBLIC: 'from-emerald-500 to-teal-600',
    ADMIN: 'from-cyan-500 to-blue-600',
    SUPER_ADMIN: 'from-violet-500 to-purple-600',
  };

  const roleLabels: Record<string, string> = {
    PUBLIC: 'Citizen',
    ADMIN: 'Officer',
    SUPER_ADMIN: 'Super Admin',
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b dark:border-white/[0.06] border-slate-200 premium-topbar sticky top-0 z-40 bg-surface-primary dark:bg-surface-glass backdrop-blur-xl">
      {/* Left: Menu + Search */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuToggle}
          suppressHydrationWarning
          aria-label="Toggle menu"
          title="Toggle menu"
          className="lg:hidden p-2 rounded-lg dark:text-white/50 text-slate-500 hover:text-primary-500 hover:bg-primary-500/5 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative max-w-md flex-1 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-white/25 text-slate-400" />
          <input
            type="text"
            placeholder="Search complaints, areas, officers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            suppressHydrationWarning
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none transition-all duration-200
                       dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder-white/25
                       bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] dark:text-white/20 text-slate-400 rounded border dark:border-white/[0.08] border-slate-200 dark:bg-black/20 bg-white shadow-sm">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="flex items-center dark:bg-white/5 bg-slate-100 rounded-xl border dark:border-white/5 border-slate-200 p-1 mr-2 scale-90 sm:scale-100 shadow-sm">
          <button
            onClick={() => setLanguage('en')}
            suppressHydrationWarning
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${language === 'en' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'dark:text-white/40 text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('hi')}
            suppressHydrationWarning
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${language === 'hi' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'dark:text-white/40 text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            हिन्दी
          </button>
        </div>

        <ThemeToggle />

        {user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={handleSimulateCrisis}
            disabled={crisisLoading}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20"
          >
            <AlertTriangle className={`w-4 h-4 ${crisisLoading ? 'animate-spin' : 'animate-pulse'}`} />
            {crisisLoading ? 'Simulating...' : 'Simulate Crisis'}
          </button>
        )}

        {user && (
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              suppressHydrationWarning
              className={`relative p-2 rounded-xl transition-all ${showNotifications ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'dark:text-white/60 text-slate-500 hover:dark:text-white hover:text-slate-900 dark:hover:bg-white/5 hover:bg-slate-100'}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-pulse border-2 dark:border-slate-900 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 dark:bg-slate-900 bg-white border dark:border-white/10 border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                <div className="px-5 py-4 border-b dark:border-white/5 border-slate-100 flex items-center justify-between dark:bg-white/[0.02] bg-slate-50">
                  <p className="text-xs font-black dark:text-white text-slate-900 uppercase tracking-widest">Alerts Center</p>
                  {unreadCount > 0 && (
                    <button 
                      onClick={async () => {
                        await api.markAllNotificationsAsRead();
                        fetchNotifications();
                      }}
                      className="text-[10px] font-bold text-primary-500 hover:text-primary-600 transition-colors uppercase"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  {notificationList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Bell className="w-8 h-8 opacity-20 mx-auto mb-3" />
                      <p className="text-xs">No notifications yet</p>
                    </div>
                  ) : (
                    notificationList.map((n) => (
                      <div 
                        key={n._id}
                        onClick={() => {
                          if (!n.isRead) handleMarkRead(n._id);
                          if (n.relatedId) router.push(`/user/complaints/${n.relatedId}`);
                          setShowNotifications(false);
                        }}
                        className={`px-5 py-4 border-b dark:border-white/5 border-slate-50 hover:dark:bg-white/5 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-primary-500/[0.02]' : ''}`}
                      >
                        {!n.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />}
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-primary-500 animate-pulse' : 'bg-slate-300'}`} />
                          <div>
                            <p className={`text-xs font-bold leading-tight mb-1 ${!n.isRead ? 'dark:text-white text-slate-900' : 'dark:text-white/60 text-slate-500'}`}>{n.title}</p>
                            <p className="text-[11px] dark:text-white/40 text-slate-400 leading-relaxed mb-2 line-clamp-2">{n.message}</p>
                            <p className="text-[9px] dark:text-white/20 text-slate-300 font-bold uppercase tracking-tighter">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 dark:bg-white/[0.02] bg-slate-50 border-t dark:border-white/5 border-slate-100 text-center">
                   <button className="text-[10px] font-black text-slate-400 hover:text-primary-500 transition-colors uppercase">
                     View Archive
                   </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative flex items-center gap-2 pl-3 border-l dark:border-white/10 border-slate-200">
          {user && (
            <>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                suppressHydrationWarning
                className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition-colors group"
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleColors[user.role]} flex items-center justify-center shadow-lg shadow-primary-500/10`}>
                  {user.role === 'SUPER_ADMIN' ? <Shield className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-bold dark:text-white text-slate-900 group-hover:text-primary-500 transition-colors">{user.name}</p>
                  <p className="text-[10px] dark:text-white/30 text-slate-500 uppercase tracking-widest leading-none">{roleLabels[user.role]}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-primary-500 transition-colors hidden md:block" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-12 w-56 dark:bg-slate-900 bg-white border dark:border-white/10 border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden py-1">
                  <div className="px-4 py-3 border-b dark:border-white/5 border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-bold dark:text-white text-slate-900">{user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      router.push('/user/profile');
                    }}
                    className="w-full px-4 py-3 text-left text-sm dark:text-white/70 text-slate-600 hover:text-primary-500 hover:bg-primary-500/5 flex items-center gap-3 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                      router.push('/');
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-rose-500 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
