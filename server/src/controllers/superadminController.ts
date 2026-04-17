import { Response } from 'express';
import Department from '../models/Department';
import User from '../models/User';
import Complaint from '../models/Complaint';
import AuditLog from '../models/AuditLog';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { emitToUser } from '../socket';

const getDeptIdMap = (headDepts: Array<{ _id: any; name: string }>) => {
  const byId = new Map<string, { _id: any; name: string }>();
  const byName = new Map<string, { _id: any; name: string }>();
  headDepts.forEach((d) => {
    byId.set(d._id.toString(), d);
    byName.set(d.name, d);
  });
  return { byId, byName };
};

// GET /api/superadmin/admins
export const getAdminOverview = async (req: AuthRequest, res: Response) => {
  try {
    const headDepts = await Department.find({ parentDepartmentId: null, isActive: true }).select('_id name');
    const headDeptIds = headDepts.map((d) => d._id);
    const headDeptNames = headDepts.map((d) => d.name);
    const { byId, byName } = getDeptIdMap(headDepts as any);

    const admins = await User.find({
      role: 'ADMIN',
      isActive: true,
      $or: [
        { departmentId: { $in: headDeptIds } },
        { department: { $in: headDeptNames } },
      ],
    }).select('-password');

    const subDepts = await Department.find({ parentDepartmentId: { $in: headDeptIds }, isActive: true }).select('_id parentDepartmentId');
    const subMap = new Map<string, string[]>();
    subDepts.forEach((d) => {
      const parentId = d.parentDepartmentId?.toString();
      if (!parentId) return;
      const list = subMap.get(parentId) || [];
      list.push(d._id.toString());
      subMap.set(parentId, list);
    });

    const allDeptIds = new Set<string>();
    headDeptIds.forEach((id) => allDeptIds.add(id.toString()));
    subDepts.forEach((d) => allDeptIds.add(d._id.toString()));

    const deptIdArray = Array.from(allDeptIds).map((id) => ({ _id: id }));

    const idStats = await Complaint.aggregate([
      { $match: { departmentId: { $in: deptIdArray.map((d) => d._id) } } },
      {
        $addFields: {
          resolutionMs: {
            $cond: [
              { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$resolvedAt', ''] }] },
              { $subtract: ['$resolvedAt', '$createdAt'] },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$departmentId',
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
          escalated: { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED'] }, 1, 0] } },
          avgResolutionMs: { $avg: '$resolutionMs' },
        },
      },
    ]);

    const nameStats = await Complaint.aggregate([
      {
        $match: {
          department: { $in: headDeptNames },
          $or: [{ departmentId: { $exists: false } }, { departmentId: null }],
        },
      },
      {
        $addFields: {
          resolutionMs: {
            $cond: [
              { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$resolvedAt', ''] }] },
              { $subtract: ['$resolvedAt', '$createdAt'] },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
          escalated: { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED'] }, 1, 0] } },
          avgResolutionMs: { $avg: '$resolutionMs' },
        },
      },
    ]);

    const statsById = new Map(idStats.map((s: any) => [s._id?.toString(), s]));
    const statsByName = new Map(nameStats.map((s: any) => [s._id, s]));

    const loginStats = await AuditLog.aggregate([
      { $match: { action: 'LOGIN', performedBy: { $in: admins.map((a) => a._id.toString()) } } },
      { $group: { _id: '$performedBy', lastLoginAt: { $max: '$createdAt' } } },
    ]);
    const loginMap = new Map(loginStats.map((s: any) => [s._id, s.lastLoginAt]));

    const data = admins.map((admin) => {
      const deptId = admin.departmentId ? admin.departmentId.toString() : null;
      const headDept = deptId ? byId.get(deptId) : admin.department ? byName.get(admin.department) : null;
      const headId = headDept?._id?.toString();
      const relatedIds = headId ? [headId, ...(subMap.get(headId) || [])] : [];

      const merged = relatedIds.reduce(
        (acc, id) => {
          const s = statsById.get(id);
          if (!s) return acc;
          acc.total += s.total || 0;
          acc.resolved += s.resolved || 0;
          acc.pending += s.pending || 0;
          acc.inProgress += s.inProgress || 0;
          acc.escalated += s.escalated || 0;
          acc.avgResolutionMs += s.avgResolutionMs || 0;
          acc.avgCount += s.avgResolutionMs ? 1 : 0;
          return acc;
        },
        { total: 0, resolved: 0, pending: 0, inProgress: 0, escalated: 0, avgResolutionMs: 0, avgCount: 0 }
      );

      if (!headId && admin.department) {
        const s = statsByName.get(admin.department);
        if (s) {
          merged.total = s.total || 0;
          merged.resolved = s.resolved || 0;
          merged.pending = s.pending || 0;
          merged.inProgress = s.inProgress || 0;
          merged.escalated = s.escalated || 0;
          merged.avgResolutionMs = s.avgResolutionMs || 0;
          merged.avgCount = s.avgResolutionMs ? 1 : 0;
        }
      }

      const avgResolutionMs = merged.avgCount ? merged.avgResolutionMs / merged.avgCount : 0;
      const lastLoginAt = loginMap.get(admin._id.toString()) || null;
      const daysSinceLogin = lastLoginAt ? Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / (1000 * 60 * 60 * 24)) : null;

      return {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        department: admin.department || headDept?.name || '—',
        departmentId: admin.departmentId || headDept?._id || null,
        lastLoginAt,
        daysSinceLogin,
        status: lastLoginAt && daysSinceLogin !== null && daysSinceLogin <= 7 ? 'ACTIVE' : 'INACTIVE',
        stats: {
          total: merged.total,
          resolved: merged.resolved,
          pending: merged.pending,
          inProgress: merged.inProgress,
          escalated: merged.escalated,
          avgResolutionMs,
        },
      };
    });

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/superadmin/admins/:id/warn
export const warnAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;
    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });

    const note = typeof message === 'string' && message.trim()
      ? message.trim()
      : 'Please review pending complaints and SLA performance.';

    const notification = await Notification.create({
      userId: admin._id.toString(),
      title: 'Superadmin Warning',
      message: note,
      type: 'GENERAL',
    });

    emitToUser(admin._id.toString(), 'notification_created', notification);

    await AuditLog.create({
      action: 'ADMIN_WARNING',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'user',
      targetId: admin._id.toString(),
      details: note,
    });

    res.json({ success: true, message: 'Warning sent' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
