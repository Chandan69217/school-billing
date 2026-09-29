import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  CreditCard,
  Receipt,
  FileBarChart,
  UserCog,
  Settings,
  GraduationCap,
  LogOut,
  ChevronRight,
  ShieldCheck,
  X,
  Coins
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { SchoolLogo } from '../common/SchoolLogo.js';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout, canAccess } = useAuth();
  const navigate = useNavigate();

  // Prevent background scrolling while mobile drawer is open & handle Escape key
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, module: 'dashboard' as const },
    { name: 'Admissions', path: '/admissions', icon: UserPlus, module: 'admissions' as const },
    { name: 'Students', path: '/students', icon: Users, module: 'students' as const },
    { name: 'Fee Management', path: '/fees', icon: Coins, module: 'fees' as const },
    { name: 'Fee Collection', path: '/payments', icon: CreditCard, module: 'payments' as const },
    { name: 'Receipts', path: '/receipts', icon: Receipt, module: 'receipts' as const },
    { name: 'Reports', path: '/reports', icon: FileBarChart, module: 'reports' as const },
    { name: 'Staff & Roles', path: '/staff', icon: UserCog, module: 'staff' as const },
    { name: 'Settings', path: '/settings', icon: Settings, module: 'settings' as const },
  ];

  const filteredNav = navItems.filter((item) => canAccess(item.module));

  const roleLabelMap: Record<string, { label: string; color: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    PRINCIPAL: { label: 'Principal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ACCOUNTANT: { label: 'Accountant', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    ADMISSION_STAFF: { label: 'Admission Staff', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    STAFF: { label: 'Staff Member', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const currentRole = user?.role ? roleLabelMap[user.role] : { label: 'Staff', color: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-[calc(100vw-3.5rem)] max-w-72 sm:w-72 md:w-68 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 sm:px-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <SchoolLogo className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <span className="text-base font-extrabold tracking-tight text-slate-900 block leading-tight truncate">
                PBPS
              </span>
              <span className="text-[11px] font-medium text-slate-500 block truncate" title="Pragya Bharti Public School">
                Pragya Bharti Public School
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Main Navigation
          </div>
          {filteredNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 md:h-4.5 md:w-4.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout in Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs min-h-[48px]">
            <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user?.fullName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentRole.label}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="p-2 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
