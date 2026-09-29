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
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { apiClient } from '../../api/client.js';

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await apiClient.post('/notifications/mark-read');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  return (
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
              <div className="fixed right-2 left-2 sm:left-auto sm:right-0 top-16 mt-1 sm:w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 py-1 px-1.5"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`py-2 px-1 text-xs ${n.isRead ? 'opacity-70' : ''}`}>
                        <div className="font-semibold text-slate-800">{n.title}</div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{n.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(n.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
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
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-2">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`py-2 px-1 text-xs ${n.isRead ? 'opacity-70' : ''}`}>
                      <div className="font-semibold text-slate-800">{n.title}</div>
                      <div className="text-slate-600 text-[11px] mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
