import Complaint from '../models/Complaint';
import Escalation from '../models/Escalation';
import Notification from '../models/Notification';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import { emitToDepartment, emitToUser } from '../socket';

let monitorTimer: NodeJS.Timeout | null = null;

const AUTO_ESCALATE_STATUSES = ['PENDING', 'IN_PROGRESS'];

export const runEscalationPass = async () => {
  const now = new Date();

  const overdueComplaints = await Complaint.find({
    status: { $in: AUTO_ESCALATE_STATUSES },
    slaDeadline: { $lt: now },
  }).limit(100);

  if (!overdueComplaints.length) return;

  const superAdmins = await User.find({ role: 'SUPER_ADMIN', isActive: true }).select('_id name');

  for (const complaint of overdueComplaints) {
    complaint.status = 'ESCALATED';
    complaint.timeline = complaint.timeline || [];
    complaint.timeline.push({ step: 'AUTO_ESCALATED', time: new Date() } as any);
    await complaint.save();

    await Escalation.create({
      complaintId: complaint.complaintId,
      level: 1,
      reason: 'SLA deadline exceeded (auto escalation)',
      autoEscalated: true,
    });

    await AuditLog.create({
      action: 'AUTO_ESCALATE',
      performedBy: 'system',
      performedByName: 'System',
      role: 'SYSTEM',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Auto escalated due to SLA breach (${complaint.department})`,
    });

    for (const superAdmin of superAdmins) {
      await Notification.create({
        userId: superAdmin._id.toString(),
        title: 'Auto Escalated Complaint',
        message: `Complaint #${complaint.complaintId} exceeded SLA and was escalated automatically.`,
        type: 'ESCALATION',
        relatedId: complaint.complaintId,
      });

      emitToUser(superAdmin._id.toString(), 'complaint_notification', {
        type: 'ESCALATION',
        title: 'Auto Escalated Complaint',
        complaintId: complaint.complaintId,
        status: 'ESCALATED',
        department: complaint.department,
        area: complaint.location?.area,
      });
    }

    if (complaint.userId) {
      await Notification.create({
        userId: complaint.userId,
        title: 'Complaint Escalated',
        message: `Your complaint #${complaint.complaintId} has been escalated to senior authority.`,
        type: 'ESCALATION',
        relatedId: complaint.complaintId,
      });

      emitToUser(complaint.userId, 'complaint_notification', {
        type: 'ESCALATION',
        title: 'Complaint Escalated',
        complaintId: complaint.complaintId,
        status: 'ESCALATED',
      });
    }

    emitToDepartment(complaint.department, 'complaint_escalated', {
      complaintId: complaint.complaintId,
      status: 'ESCALATED',
      category: complaint.category,
      priority: complaint.priority,
      location: complaint.location?.area,
      reason: 'SLA deadline exceeded',
    });
  }
};

export const startEscalationMonitor = (intervalMs = 60_000) => {
  if (monitorTimer) return;

  // Run once on startup so old overdue complaints are escalated immediately.
  runEscalationPass().catch((err) => {
    console.error('Escalation pass startup error:', err?.message || err);
  });

  monitorTimer = setInterval(() => {
    runEscalationPass().catch((err) => {
      console.error('Escalation pass error:', err?.message || err);
    });
  }, intervalMs);
};
