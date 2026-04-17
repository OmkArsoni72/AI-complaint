'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface StatsData {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  escalated: number;
}

function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function StatsCards({ data }: { data: StatsData | null }) {
  const stats = [
    {
      label: 'Total Complaints',
      value: data?.total || 0,
      icon: TrendingUp,
      gradient: 'from-cyan-500 to-blue-600',
      glowColor: 'rgba(6, 182, 212, 0.15)',
      iconBg: 'rgba(6, 182, 212, 0.1)',
      iconColor: '#22d3ee',
      barColor: 'rgba(6, 182, 212, 0.3)',
    },
    {
      label: 'Pending',
      value: data?.pending || 0,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      glowColor: 'rgba(245, 158, 11, 0.12)',
      iconBg: 'rgba(245, 158, 11, 0.1)',
      iconColor: '#fbbf24',
      barColor: 'rgba(245, 158, 11, 0.3)',
    },
    {
      label: 'Resolved',
      value: data?.resolved || 0,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-teal-600',
      glowColor: 'rgba(16, 185, 129, 0.12)',
      iconBg: 'rgba(16, 185, 129, 0.1)',
      iconColor: '#34d399',
      barColor: 'rgba(16, 185, 129, 0.3)',
    },
    {
      label: 'Escalated',
      value: data?.escalated || 0,
      icon: AlertTriangle,
      gradient: 'from-rose-500 to-pink-600',
      glowColor: 'rgba(244, 63, 94, 0.12)',
      iconBg: 'rgba(244, 63, 94, 0.1)',
      iconColor: '#fb7185',
      barColor: 'rgba(244, 63, 94, 0.3)',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="stat-card cursor-default group relative overflow-hidden border border-white/[0.06]"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${stat.iconColor}25`;
              e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${stat.glowColor}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-2.5 rounded-xl"
                style={{ background: stat.iconBg }}
              >
                <Icon className="w-5 h-5" style={{ color: stat.iconColor }} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">
              <AnimatedCounter value={stat.value} />
            </h3>
            <p className="text-sm text-white/45">{stat.label}</p>

            {/* Subtle corner glow on hover */}
            <div
              className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${stat.glowColor} 0%, transparent 70%)`,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
