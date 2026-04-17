'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Users, UserCircle2 } from 'lucide-react';

const portals = [
  {
    title: 'Citizen Portal',
    subtitle: 'Track complaints, submit new issues, and get live updates',
    href: '/citizen/login',
    icon: UserCircle2,
    accent: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/20',
  },
  {
    title: 'Admin Console',
    subtitle: 'Department queues, officer oversight, and response tooling',
    href: '/admin/login',
    icon: Users,
    accent: 'from-cyan-400 to-blue-500',
    glow: 'shadow-cyan-500/20',
  },
  {
    title: 'Sub-Department Login',
    subtitle: 'Head-assigned queues, resolution tracking, and department actions',
    href: '/sub-department/login',
    icon: ShieldCheck,
    accent: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/20',
  },
];

export default function PortalChooser() {
  return (
    <div className="portal-page">
      <div className="portal-halo portal-halo-left" />
      <div className="portal-halo portal-halo-right" />

      <div className="portal-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="portal-header"
        >
          <p className="portal-kicker">AI Grievance Intelligence System</p>
          <h1 className="portal-title">Choose your access lane</h1>
          <p className="portal-subtitle">
            Unified platform for citizens, department officers, and citywide oversight.
          </p>
        </motion.div>

        <div className="portal-grid">
          {portals.map((portal, index) => {
            const Icon = portal.icon;
            return (
              <motion.div
                key={portal.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 * index }}
                className="portal-card"
              >
                <div className={`portal-icon bg-gradient-to-br ${portal.accent} ${portal.glow}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="portal-card-body">
                  <h2 className="portal-card-title">{portal.title}</h2>
                  <p className="portal-card-subtitle">{portal.subtitle}</p>
                </div>
                <Link href={portal.href} className="portal-action">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
