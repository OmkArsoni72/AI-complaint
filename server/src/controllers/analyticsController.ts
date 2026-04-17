import { Request, Response } from 'express';
import Complaint from '../models/Complaint';

// GET /api/analytics/summary
export const getSummary = async (_req: Request, res: Response) => {
  try {
    const total = await Complaint.countDocuments();
    const pending = await Complaint.countDocuments({ status: 'PENDING' });
    const inProgress = await Complaint.countDocuments({ status: 'IN_PROGRESS' });
    const resolved = await Complaint.countDocuments({ status: 'RESOLVED' });
    const escalated = await Complaint.countDocuments({ status: 'ESCALATED' });

    res.json({
      success: true,
      data: { total, pending, inProgress, resolved, escalated },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
};

// GET /api/analytics/department
export const getDepartmentStats = async (_req: Request, res: Response) => {
  try {
    const stats = await Complaint.aggregate([
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $ne: ['$status', 'RESOLVED'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $in: ['$status', ['PENDING', 'IN_PROGRESS']] }, 1, 0] }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'HIGH'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } },
    ]);

    const data = stats.map((s) => ({
      department: s._id || 'Unassigned',
      count: s.total,
      total: s.total,
      active: s.active,
      pending: s.pending,
      resolved: s.resolved,
      highPriority: s.highPriority,
      performance: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get department stats' });
  }
};

// GET /api/analytics/resolution
export const getResolutionStats = async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stats = await Complaint.aggregate([
      {
        $match: {
          status: 'RESOLVED',
          resolvedAt: { $ne: null },
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: '%a', date: '$createdAt' } },
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: '$day',
          avgHours: { $avg: '$resolutionTime' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Map to preferred format
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const trendData = days.map(day => {
      const dayData = stats.find(s => s._id === day);
      return {
        day,
        avgHours: dayData ? parseFloat(dayData.avgHours.toFixed(1)) : 0,
        complaints: dayData ? dayData.count : 0
      };
    });

    const totalResolved = stats.reduce((acc, s) => acc + s.count, 0);
    const globalAvg = totalResolved > 0 
      ? stats.reduce((acc, s) => acc + (s.avgHours * s.count), 0) / totalResolved 
      : 0;

    res.json({
      success: true,
      data: {
        averageResolutionHours: parseFloat(globalAvg.toFixed(1)),
        trend: trendData,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get resolution stats' });
  }
};

// GET /api/analytics/heatmap
export const getHeatmapData = async (_req: Request, res: Response) => {
  try {
    const stats = await Complaint.aggregate([
      {
        $group: {
          _id: {
            area: '$location.area',
            slot: {
              $concat: [
                { $substr: [{ $hour: '$createdAt' }, 0, 2] },
                '-',
                { $substr: [{ $add: [{ $hour: '$createdAt' }, 3] }, 0, 2] }
              ]
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.area',
          slots: {
            $push: {
              time: '$_id.slot',
              count: '$count'
            }
          }
        }
      },
      { $limit: 15 }
    ]);

    const data = stats.map(s => ({
      area: s._id || 'Unknown',
      slots: s.slots
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get heatmap' });
  }
};

// GET /api/analytics/escalation
export const getEscalationStats = async (_req: Request, res: Response) => {
  try {
    const stats = await Complaint.aggregate([
      {
        $match: {
          status: 'ESCALATED'
        }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const data = stats.map(s => ({
      department: s._id || 'Unassigned',
      escalations: s.count
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get escalation stats' });
  }
};

// GET /api/analytics/insights (NEW: Dynamic AI Insights)
export const getAIInsights = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Find categories with significant increases
    const categoryTrends = await Complaint.aggregate([
      { $match: { createdAt: { $gte: prevWeek } } },
      {
        $group: {
          _id: '$category',
          lastWeekCount: {
            $sum: { $cond: [{ $gte: ['$createdAt', lastWeek] }, 1, 0] }
          },
          prevWeekCount: {
            $sum: { $cond: [{ $lt: ['$createdAt', lastWeek] }, 1, 0] }
          }
        }
      }
    ]);

    const insights = [];

    categoryTrends.forEach(t => {
      if (t.lastWeekCount > t.prevWeekCount && t.prevWeekCount > 0) {
        const increase = Math.round(((t.lastWeekCount - t.prevWeekCount) / t.prevWeekCount) * 100);
        if (increase > 10) {
          insights.push({
            text: `${t._id} complaints increased by ${increase}% this week compared to last.`,
            type: increase > 30 ? 'warning' : 'info',
            icon: '📈'
          });
        }
      }
    });

    // 2. Hotspot Detection
    const hotspots = await Complaint.aggregate([
      { $match: { status: { $ne: 'RESOLVED' } } },
      { $group: { _id: '$location.area', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 2 }
    ]);

    hotspots.forEach(h => {
      if (h.count > 5) {
        insights.push({
          text: `Critical hotspot detected in ${h._id} with ${h.count} active issues.`,
          type: 'danger',
          icon: '🚨'
        });
      }
    });

    // 3. Efficiency Stats
    const resolvedStats = await Complaint.countDocuments({ 
      status: 'RESOLVED', 
      createdAt: { $gte: lastWeek } 
    });
    
    if (resolvedStats > 0) {
      insights.push({
        text: `Resolution efficiency is maintained with ${resolvedStats} tickets closed this week.`,
        type: 'success',
        icon: '✅'
      });
    }

    // Fallback if no trends found
    if (insights.length < 3) {
      insights.push({
        text: 'System processing real-time telemetry. No critical anomalies detected currently.',
        type: 'success',
        icon: '🛡️'
      });
    }

    res.json({ success: true, data: insights });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate insights' });
  }
};
