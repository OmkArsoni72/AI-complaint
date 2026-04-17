'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  FileText,
  LogOut,
  User,
  Navigation,
  Activity,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function UserSidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, t } = useAuth();

  const navItems = [
    { label: t('dashboard'), icon: Activity, href: '/user/dashboard' },
    { label: t('submitComplaint'), icon: PlusCircle, href: '/user/complaints/new' },
    { label: t('myComplaints'), icon: FileText, href: '/user/complaints' },
    { label: t('nearbyIssues'), icon: Navigation, href: '/user/nearby' },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col
                 premium-sidebar border-r dark:border-white/[0.06] border-slate-200"
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b dark:border-white/5 border-slate-200/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600
                        flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-bold dark:text-white text-slate-900">Citizen Portal</p>
              <p className="text-[9px] dark:text-white/30 text-slate-500 uppercase tracking-widest">Smart Governance</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Info removed per design */}

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? 'nav-link-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-500' : 'text-slate-500 dark:text-white/40'}`} />
              {!collapsed && <span className="text-sm font-medium ml-3">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 py-3 border-t dark:border-white/[0.06] border-slate-200/50 space-y-1">
        <button
          onClick={() => { logout(); router.push('/'); }}
          className={`nav-link w-full text-rose-500 dark:text-rose-400 group hover:bg-rose-500/10 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium ml-3">Exit Portal</span>}
        </button>

        <button
          onClick={onToggle}
          className="nav-link w-full justify-center text-slate-400 hover:text-primary-500 transition-all"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </motion.aside>
  );
}
