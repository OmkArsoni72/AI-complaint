'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import UserLayout from './UserLayout';
import AdminLayout from './AdminLayout';

const AUTH_PATHS = ['/admin/login', '/superadmin/login', '/citizen/login', '/sub-department/login'];
const PORTAL_PATHS = ['/', '/portal'];

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPortalPath(pathname: string) {
  return PORTAL_PATHS.includes(pathname);
}

function isAdminPath(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sub-department') ||
    pathname.startsWith('/superadmin') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/officer')
  );
}

function CitizenGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/citizen/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <UserLayout>{children}</UserLayout>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // No user → send to appropriate login
    if (!user) {
      if (pathname.startsWith('/superadmin')) router.replace('/superadmin/login');
      else if (pathname.startsWith('/sub-department')) router.replace('/sub-department/login');
      else router.replace('/admin/login');
      return;
    }

    // PUBLIC user has no business here
    if (user.role === 'PUBLIC') {
      router.replace('/citizen/login');
      return;
    }


    // Non-superadmin on /superadmin → send to /admin
    if (pathname.startsWith('/superadmin') && user.role !== 'SUPER_ADMIN') {
      router.replace('/admin');
      return;
    }

    // OFFICER / sub-department user on /admin → send to /sub-department
    if (pathname.startsWith('/admin') && (user.role === 'OFFICER' || user.isSubDepartment)) {
      router.replace('/sub-department');
      return;
    }
  }, [isLoading, user, pathname, router]);

  // While loading, show spinner — never render children prematurely
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Waiting for redirect to fire
  if (!user || user.role === 'PUBLIC') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }


  return <AdminLayout>{children}</AdminLayout>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPortalPath(pathname) || isAuthPath(pathname)) {
    return <>{children}</>;
  }

  if (isAdminPath(pathname)) {
    return <AdminGuard>{children}</AdminGuard>;
  }

  return <CitizenGuard>{children}</CitizenGuard>;
}
