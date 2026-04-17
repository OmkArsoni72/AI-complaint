'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  LayoutDashboard,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  LogIn,
  LogOut,
  User,
  Building2,
  Activity,
  Gauge,
  Bell,
  Brain,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function getLoginPath(pathname: string) {
  if (pathname.startsWith('/superadmin')) return '/superadmin/login';
  return '/admin/login';
}

export default function AdminSidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();

  const adminSection = searchParams.get('section') || 'overview';

  const navItems = user?.role === 'SUPER_ADMIN'
    ? [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/superadmin/dashboard' },
        { label: 'Control Room', icon: Shield, href: '/superadmin/controlroom' },
        { label: 'Admin Panel', icon: Building2, href: '/superadmin/adminpanel' },
        { label: 'Analytics', icon: BarChart3, href: '/superadmin/analytics' },
        { label: 'Officer Desk', icon: Users, href: '/superadmin/officer-desk' },
      ]
    : [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/admin?section=dashboard', sectionKey: 'dashboard' },
        { label: 'Complaint Control', icon: Users, href: '/admin?section=complaints', sectionKey: 'complaints' },
        { label: 'Work Status', icon: Activity, href: '/admin?section=work-status', sectionKey: 'work-status' },
        { label: 'Performance', icon: Gauge, href: '/admin?section=performance', sectionKey: 'performance' },
        { label: 'Smart Alerts', icon: Bell, href: '/admin?section=alerts', sectionKey: 'alerts' },
        { label: 'AI Assistance', icon: Brain, href: '/admin?section=ai', sectionKey: 'ai' },
        { label: 'Location Control', icon: MapPin, href: '/admin?section=location', sectionKey: 'location' },
        { label: 'Communication', icon: MessageSquare, href: '/admin?section=communication', sectionKey: 'communication' },
        { label: 'Control Limits', icon: ShieldCheck, href: '/admin?section=controls', sectionKey: 'controls' },
        { label: 'Sub-Departments', icon: Tag, href: '/admin?section=subdepartments', sectionKey: 'subdepartments' },
        { label: 'Analytics', icon: BarChart3, href: '/analytics' },
        { label: 'Officer Desk', icon: Users, href: '/officer' },
      ];

  const roleColors: Record<string, string> = {
    PUBLIC: 'from-emerald-500 to-teal-600',
    ADMIN: 'from-cyan-500 to-blue-600',
    SUPER_ADMIN: 'from-violet-500 to-purple-600',
  };

  const roleBadgeBg: Record<string, string> = {
    PUBLIC: 'bg-emerald-500/10 text-emerald-400',
    ADMIN: 'bg-cyan-500/10 text-cyan-400',
    SUPER_ADMIN: 'bg-violet-500/10 text-violet-400',
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-white/[0.06] premium-sidebar"
    >
      {user?.role !== 'SUPER_ADMIN' && (
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
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
                <p className="text-sm font-bold text-white uppercase tracking-tighter">
                  {pathname.includes('/superadmin') ? 'Superadmin' : 'Officer Portal'}
                </p>
                <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-black">
                  Govt. Intelligence
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {user && <div className="border-b border-white/[0.06]" />}

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isSectionItem = !!(item as any).sectionKey;
          const isActive = isSectionItem
            ? pathname === '/admin' && adminSection === (item as any).sectionKey
            : item.href === '/superadmin/controlroom'
            ? pathname === item.href || pathname === '/superadmin'
            : item.href === '/superadmin/adminpanel'
              ? pathname === item.href || pathname === '/admin'
              : item.href === '/superadmin/analytics'
                ? pathname === item.href || pathname === '/analytics'
                : item.href === '/superadmin/officer-desk'
                  ? pathname === item.href || pathname === '/officer'
                  : pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? 'nav-link-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-400' : ''}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-white/[0.06] space-y-1">
        {user ? (
          <button
            onClick={() => {
              logout();
              router.replace(getLoginPath(pathname));
            }}
            className={`nav-link w-full text-danger-400/60 hover:text-danger-400 hover:bg-danger-500/5 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Logout</span>}
          </button>
        ) : (
          <Link href={getLoginPath(pathname)} className={`nav-link ${collapsed ? 'justify-center px-0' : ''}`}>
            <LogIn className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Login</span>}
          </Link>
        )}

        <button onClick={onToggle} className="nav-link w-full justify-center">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
