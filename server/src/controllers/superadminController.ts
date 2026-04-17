import { Response } from 'express';
import mongoose from 'mongoose';
import Department from '../models/Department';
import User from '../models/User';
import Complaint from '../models/Complaint';
import AuditLog from '../models/AuditLog';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { emitToUser } from '../socket';

// GET /api/superadmin/admins
export const getAdminOverview = async (req: AuthRequest, res: Response) => {
  try {
    // 1. All departments (head + sub)
    const allDepts = await Department.find({ isActive: true }).select(
      '_id name parentDepartmentId adminUserId contactEmail'
    );
    const headDepts = allDepts.filter((d: any) => !d.parentDepartmentId);
    const subDepts  = allDepts.filter((d: any) =>  d.parentDepartmentId);

    // Maps for fast lookup
    const deptById        = new Map(allDepts.map((d: any) => [d._id.toString(), d]));
    const deptByNameLower = new Map(allDepts.map((d: any) => [d.name.toLowerCase().trim(), d]));

    // head → [head_id, ...child_ids]
    const headToAllIds = new Map<string, string[]>();
    headDepts.forEach((h: any) => {
      const hid      = h._id.toString();
      const children = subDepts
        .filter((s: any) => s.parentDepartmentId.toString() === hid)
        .map((s: any) => s._id.toString());
      headToAllIds.set(hid, [hid, ...children]);
    });

    // 2. All active admin users (no filter by dept — fetch all)
    const admins = await User.find({ role: 'ADMIN', isActive: true }).select('-password');

    // 3. Complaint stats by departmentId (ObjectId)
    const allDeptObjectIds = allDepts.map((d: any) => new mongoose.Types.ObjectId(d._id));
    const idStats = await Complaint.aggregate([
      { $match: { departmentId: { $in: allDeptObjectIds } } },
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
          total:          { $sum: 1 },
          resolved:       { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED']    }, 1, 0] } },
          pending:        { $sum: { $cond: [{ $eq: ['$status', 'PENDING']     }, 1, 0] } },
          inProgress:     { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
          escalated:      { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED']   }, 1, 0] } },
          avgResolutionMs:{ $avg: '$resolutionMs' },
        },
      },
    ]);
    const statsById = new Map(idStats.map((s: any) => [s._id?.toString(), s]));

    // 4. Complaint stats by department NAME (case-insensitive, for complaints without ID)
    const nameStats = await Complaint.aggregate([
      { $match: { $or: [{ departmentId: { $exists: false } }, { departmentId: null }] } },
      {
        $addFields: {
          deptNameLower: { $toLower: { $trim: { input: { $ifNull: ['$department', ''] } } } },
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
          _id: '$deptNameLower',
          total:          { $sum: 1 },
          resolved:       { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED']    }, 1, 0] } },
          pending:        { $sum: { $cond: [{ $eq: ['$status', 'PENDING']     }, 1, 0] } },
          inProgress:     { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
          escalated:      { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED']   }, 1, 0] } },
          avgResolutionMs:{ $avg: '$resolutionMs' },
        },
      },
    ]);
    const statsByName = new Map(nameStats.map((s: any) => [s._id || '', s]));

    // 5. Login stats
    const loginStats = await AuditLog.aggregate([
      {
        $match: {
          action: 'LOGIN',
          performedBy: { $in: admins.map((a: any) => a._id.toString()) },
        },
      },
      { $group: { _id: '$performedBy', lastLoginAt: { $max: '$createdAt' } } },
    ]);
    const loginMap = new Map(loginStats.map((s: any) => [s._id?.toString(), s.lastLoginAt]));

    // Helper: merge stats for a set of dept IDs + optional name fallback
    const mergeStats = (deptIds: string[], deptName?: string) => {
      const acc = { total: 0, resolved: 0, pending: 0, inProgress: 0, escalated: 0, rMs: 0, rCount: 0 };

      for (const id of deptIds) {
        const s = statsById.get(id);
        if (!s) continue;
        acc.total      += s.total || 0;
        acc.resolved   += s.resolved || 0;
        acc.pending    += s.pending || 0;
        acc.inProgress += s.inProgress || 0;
        acc.escalated  += s.escalated || 0;
        if (s.avgResolutionMs) { acc.rMs += s.avgResolutionMs; acc.rCount += 1; }
      }

      // Also add name-based complaints (complaints filed before proper deptId linkage)
      if (deptName) {
        const key = deptName.toLowerCase().trim();
        const ns  = statsByName.get(key);
        if (ns) {
          acc.total      += ns.total || 0;
          acc.resolved   += ns.resolved || 0;
          acc.pending    += ns.pending || 0;
          acc.inProgress += ns.inProgress || 0;
          acc.escalated  += ns.escalated || 0;
          if (ns.avgResolutionMs) { acc.rMs += ns.avgResolutionMs; acc.rCount += 1; }
        }
      }

      return {
        total:          acc.total,
        resolved:       acc.resolved,
        pending:        acc.pending,
        inProgress:     acc.inProgress,
        escalated:      acc.escalated,
        avgResolutionMs: acc.rCount ? acc.rMs / acc.rCount : 0,
      };
    };

    // 6. Build per-admin result
    const data = admins.map((admin: any) => {
      const adminDeptId = admin.departmentId?.toString() || null;

      // Resolve admin's department object
      let adminDept: any = adminDeptId ? deptById.get(adminDeptId) : null;
      if (!adminDept && admin.department) {
        adminDept = deptByNameLower.get(admin.department.toLowerCase().trim()) || null;
      }

      // Resolve to head department
      let headDeptId: string | null = null;
      if (adminDept) {
        headDeptId = adminDept.parentDepartmentId
          ? adminDept.parentDepartmentId.toString()    // admin is in a sub-dept
          : adminDept._id.toString();                  // admin is the head
      }

      // All dept IDs to aggregate (head + its children)
      const deptIds: string[] = headDeptId
        ? (headToAllIds.get(headDeptId) || [headDeptId])
        : adminDeptId ? [adminDeptId] : [];

      const stats = mergeStats(deptIds, admin.department);

      const lastLoginAt    = loginMap.get(admin._id.toString()) || null;
      const daysSinceLogin = lastLoginAt
        ? Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id:           admin._id,
        name:         admin.name,
        email:        admin.email,
        department:   admin.department || adminDept?.name || '—',
        departmentId: adminDeptId || adminDept?._id?.toString() || null,
        lastLoginAt,
        daysSinceLogin,
        status: lastLoginAt && daysSinceLogin !== null && daysSinceLogin <= 7 ? 'ACTIVE' : 'INACTIVE',
        stats,
      };
    });

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[superadmin/admins] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/superadmin/admins/:id/warn
export const warnAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;
    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });

    const note =
      typeof message === 'string' && message.trim()
        ? message.trim()
        : 'Please review pending complaints and SLA performance.';

    const notification = await Notification.create({
      userId:  admin._id.toString(),
      title:   'Superadmin Warning',
      message: note,
      type:    'GENERAL',
    });

    emitToUser(admin._id.toString(), 'notification_created', notification);

    await AuditLog.create({
      action:            'ADMIN_WARNING',
      performedBy:       req.user!.userId,
      performedByName:   req.user!.name,
      role:              req.user!.role,
      targetType:        'user',
      targetId:          admin._id.toString(),
      details:           note,
    });

    res.json({ success: true, message: 'Warning sent' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
