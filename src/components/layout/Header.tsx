import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  Plus,
  CreditCard,
  Menu,
  Check,
  Calendar,
  X,
  ExternalLink,
  ChevronDown,
  KeyRound,
  LogOut,
  User as UserIcon,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  CheckCheck,
  BellOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.js';
import { apiClient } from '../../api/client.js';
import { ChangePasswordModal } from '../auth/ChangePasswordModal.js';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenFeeCollection?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onOpenFeeCollection }) => {
  const { user, logout, canAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User Profile Menu & Change Password Modal state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Active session state
  const [activeSessionName, setActiveSessionName] = useState('2026-27');

  // Compute Page Title for mobile header
  const getPageTitle = (pathname: string): string => {
    if (pathname === '/') return 'Dashboard';
    if (pathname.startsWith('/admissions')) return 'Admissions';
    if (pathname.startsWith('/students')) return 'Students';
    if (pathname.startsWith('/fees')) return 'Fee Management';
    if (pathname.startsWith('/payments')) return 'Fee Collection';
    if (pathname.startsWith('/receipts')) return 'Receipts';
    if (pathname.startsWith('/reports')) return 'Reports';
    if (pathname.startsWith('/staff')) return 'Staff & Roles';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'PBPS';
  };

  const pageTitle = getPageTitle(location.pathname);

  // Fetch active academic session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await apiClient.get('/academic-years');
        if (res.data?.success && res.data.data.length > 0) {
          const active = res.data.data.find((y: any) => y.isActive) || res.data.data[0];
          if (active) setActiveSessionName(active.name);
        }
      } catch {
        // silent fallback
      }
    };
    fetchSession();
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global Search debounced
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get(`/students?search=${encodeURIComponent(searchQuery)}&limit=6`);
        if (res.data?.success) {
          setSearchResults(res.data.data);
          setShowSearchResults(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimeAgo = (dateStr: string): string => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderNotificationIcon = (type?: string) => {
    switch (type) {
      case 'SUCCESS':
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case 'WARNING':
      case 'ALERT':
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      case 'INFO':
      default:
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <Info className="h-4 w-4" />
          </div>
        );
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.isRead) {
      try {
        await apiClient.post('/notifications/mark-read', { id: n.id });
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error('Failed to mark notification read:', e);
      }
    }
    if (n.linkUrl) {
      setShowNotifications(false);
      navigate(n.linkUrl);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/notifications/${id}`);
      const target = notifications.find(n => n.id === id);
      if (target && !target.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification removed');
    } catch (e) {
      console.error('Failed to delete notification:', e);
      toast.error('Failed to remove notification');
    }
  };

  const handleClearAll = async () => {
    try {
      await apiClient.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
      toast.success('All notifications cleared');
    } catch (e) {
      console.error('Failed to clear all notifications:', e);
      toast.error('Failed to clear notifications');
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.post('/notifications/mark-read');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (e) {
      console.error(e);
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-3 sm:px-4 md:px-8 backdrop-blur-md">
      {/* Mobile Header Mode: ☰  Page Title  [actions] 🔔 */}
      <div className="flex md:hidden items-center justify-between w-full gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={onToggleSidebar}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {pageTitle}
          </span>
        </div>

        {/* Mobile Right Controls: Search Icon, Quick Fee, Bell */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="flex h-11 w-11 items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {canAccess('payments') && (
            <button
              onClick={() => onOpenFeeCollection ? onOpenFeeCollection() : navigate('/payments')}
              className="flex h-11 w-11 items-center justify-center text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition-colors"
              title="Collect Fee"
              aria-label="Collect Fee"
            >
              <CreditCard className="h-5 w-5" />
            </button>
          )}

          {/* Notification Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-11 w-11 items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Mobile Notifications Dropdown */}
            {showNotifications && (
              <div className="fixed right-2 left-2 sm:left-auto sm:right-0 top-16 mt-1 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    {unreadCount > 0 ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 rounded-full">
                        {unreadCount} new
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded-full">
                        All read
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Mark read</span>
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-[11px] font-medium text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer ml-1"
                        title="Clear all"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                        <BellOff className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Real-time alerts for fee payments, admissions, and system events will appear here.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`group relative flex items-start gap-2.5 p-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                          n.isRead ? 'bg-white opacity-85 hover:opacity-100' : 'bg-indigo-50/50'
                        }`}
                      >
                        {renderNotificationIcon(n.type)}
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs ${n.isRead ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}`}>
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatTimeAgo(n.createdAt)}
                            </span>
                            {n.linkUrl && (
                              <span className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
                                View details &rarr;
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNotification(e, n.id)}
                          className="absolute top-2.5 right-2 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                          title="Remove notification"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Expandable Search Bar Overlay */}
      {mobileSearchOpen && (
        <div ref={mobileSearchRef} className="md:hidden absolute inset-x-0 top-0 h-16 bg-white border-b border-slate-200 px-3 flex items-center gap-2 z-40 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search by student, admission #, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setMobileSearchOpen(false);
              setShowSearchResults(false);
            }}
            className="p-2 text-slate-500 hover:text-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>

          {/* Search Dropdown for Mobile */}
          {showSearchResults && (
            <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                <span>Matching Students ({searchResults.length})</span>
                {isSearching && <span className="text-indigo-600 animate-pulse">Searching...</span>}
              </div>

              {searchResults.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No matching student records found for "{searchQuery}".
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {searchResults.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setShowSearchResults(false);
                        setMobileSearchOpen(false);
                        setSearchQuery('');
                        navigate(`/students?studentId=${s.id}`);
                      }}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {s.firstName?.[0]}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900">{s.fullName}</div>
                          <div className="text-[10px] text-slate-500">
                            {s.admissionNumber} · {s.className} ({s.sectionName})
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        s.feeStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                        s.feeStatus === 'OVERDUE' ? 'bg-rose-50 text-rose-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {s.feeStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Desktop Header: Search on left, Controls on right */}
      <div className="hidden md:flex items-center gap-3 flex-1 max-w-xl">
        {/* Global Search Input */}
        <div ref={searchRef} className="relative w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student, admission #, parent phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-8 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Desktop Search Dropdown Modal */}
          {showSearchResults && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                <span>Matching Students ({searchResults.length})</span>
                {isSearching && <span className="text-indigo-600 animate-pulse">Searching...</span>}
              </div>

              {searchResults.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No matching student records found for "{searchQuery}".
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {searchResults.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchQuery('');
                        navigate(`/students?studentId=${s.id}`);
                      }}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {s.firstName?.[0]}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {s.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {s.admissionNumber} · {s.className} ({s.sectionName}) · {s.parentPhone}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          s.feeStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                          s.feeStatus === 'OVERDUE' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {s.feeStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Right Controls: Session Indicator, Quick Actions, Notifications */}
      <div className="hidden md:flex items-center gap-2.5 md:gap-3.5">
        {/* Academic Year indicator */}
        <button
          onClick={() => navigate('/admissions?tab=sessions')}
          title="Click to view and manage Academic Admission Sessions"
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
        >
          <Calendar className="h-3.5 w-3.5 text-indigo-600" />
          <span>Session: <strong>{activeSessionName}</strong></span>
        </button>

        {/* Quick Action: New Admission */}
        {canAccess('admissions') && (
          <button
            onClick={() => navigate('/admissions')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Admission</span>
          </button>
        )}

        {/* Quick Action: Collect Fee */}
        {canAccess('payments') && (
          <button
            onClick={() => onOpenFeeCollection ? onOpenFeeCollection() : navigate('/payments')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
          >
            <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
            <span>Collect Fee</span>
          </button>
        )}

        {/* Desktop Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Desktop Notifications Popover */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 rounded-full">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded-full">
                      All read
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] font-medium text-slate-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer ml-1"
                      title="Clear all notifications"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Clear all</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                      <BellOff className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">No notifications yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Real-time alerts for fee payments, admissions, and system events will appear here.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`group relative flex items-start gap-2.5 p-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                        n.isRead ? 'bg-white opacity-85 hover:opacity-100' : 'bg-indigo-50/50'
                      }`}
                    >
                      {renderNotificationIcon(n.type)}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs ${n.isRead ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}`}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatTimeAgo(n.createdAt)}
                          </span>
                          {n.linkUrl && (
                            <span className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
                              View details &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteNotification(e, n.id)}
                        className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                        title="Remove notification"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop User Profile Menu */}
        <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              title="User Account Menu"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <span className="font-semibold text-slate-800 block leading-tight">{user?.fullName}</span>
                <span className="text-[10px] text-slate-500 block leading-none capitalize">{user?.role?.replace('_', ' ').toLowerCase()}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown Popover */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <div className="px-3 py-2.5 bg-slate-50 rounded-xl mb-1 border border-slate-100">
                  <div className="text-xs font-bold text-slate-900 truncate">{user?.fullName}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      <Shield className="w-2.5 h-2.5" />
                      {user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5 pt-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    <span>Change Password</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};
