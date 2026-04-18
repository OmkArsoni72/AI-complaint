import { Request, Response } from 'express';
import Complaint from '../models/Complaint';
import Officer from '../models/Officer';
import Escalation from '../models/Escalation';
import AuditLog from '../models/AuditLog';
import Department from '../models/Department';
import Notification from '../models/Notification';
import { emitToDepartment, emitToUser } from '../socket';
import {
  calculateSLA,
  generateComplaintId,
  detectPriority,
} from '../services/aiEngine';
import { fetchAiCategory } from '../services/aiService';
import { mapComplaintCategory } from '../services/mappingService';
import { AuthRequest } from '../middleware/auth';

type OfficerScope =
  | { kind: 'OFFICER'; officerId: string; officerName: string }
  | { kind: 'SUB_DEPT'; departmentId?: string | null; departmentName?: string | null };

const notifyUser = async (userId: string | undefined, payload: { title: string; message: string; type: 'ASSIGNMENT' | 'STATUS_UPDATE' | 'CRISIS' | 'ESCALATION' | 'GENERAL'; relatedId?: string }) => {
  if (!userId) return;
  const note = await Notification.create({
    userId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    relatedId: payload.relatedId,
  });
  emitToUser(userId, 'complaint_notification', payload);
  emitToUser(userId, 'notification_created', note);
};

const findHeadAdminId = async (complaint: any) => {
  const deptId = complaint?.assignedSubDepartment || complaint?.departmentId || null;
  if (!deptId) return null;
  const dept = await Department.findById(deptId).select('parentDepartmentId adminUserId name');
  if (dept?.parentDepartmentId) {
    const parent = await Department.findById(dept.parentDepartmentId).select('adminUserId name');
    return parent?.adminUserId?.toString() || null;
  }
  return dept?.adminUserId?.toString() || null;
};

async function resolveOfficerScope(req: AuthRequest, res: Response): Promise<OfficerScope | null> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return null;
  }

  if (req.user.role === 'OFFICER') {
    const officer = await Officer.findOne({ userId: req.user.userId, isActive: true }).select('_id name department departmentId');
    if (!officer) {
      res.status(404).json({ success: false, error: 'Officer profile not found' });
      return null;
    }
    const deptId = officer.departmentId ? officer.departmentId.toString() : null;
    if (deptId) {
      const dept = await Department.findById(deptId).select('parentDepartmentId name');
      if (dept?.parentDepartmentId) {
        return { kind: 'SUB_DEPT', departmentId: deptId, departmentName: dept.name };
      }
    }
    return { kind: 'OFFICER', officerId: officer._id.toString(), officerName: officer.name };
  }

  if (req.user.role === 'ADMIN' && req.user.isSubDepartment) {
    return {
      kind: 'SUB_DEPT',
      departmentId: req.user.departmentId || null,
      departmentName: req.user.department || null,
    };
  }

  res.status(403).json({ success: false, error: 'Insufficient permissions' });
  return null;
}

async function findComplaintByAnyId(id: string) {
  const byComplaintId = await Complaint.findOne({ complaintId: id });
  if (byComplaintId) return byComplaintId;
  return Complaint.findById(id);
}


// ====================== GET ALL ======================
export const getComplaints = async (req: Request, res: Response) => {
  try {
    const { status, priority, department, userId, limit = '50' } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (department) filter.department = department;
    if (userId) filter.userId = userId;

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string));

    res.json({ success: true, data: complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// ====================== CREATE COMPLAINT (AI POWERED) ======================
export const createComplaint = async (req: Request, res: Response) => {
  try {
    const { description, location, userId, userName } = req.body;

    const aiResult = await fetchAiCategory(description);
    const activeDepartments = await Department.find({ isActive: true, parentDepartmentId: null }).select('name type categories');
    const mapped = mapComplaintCategory(description, aiResult.rawCategory || null, activeDepartments as any);
    const priority = detectPriority(description);
    const slaDeadline = calculateSLA(mapped.category, priority);

    const departmentName = mapped.department;
    const departmentId = mapped.departmentId || null;
    const complaintId = generateComplaintId();

    // 🔥 OFFICER AUTO ASSIGN
    const officer = await Officer.findOne({
      department: departmentName,
      isActive: true
    }).sort({ pendingCount: 1 });

    // 🔥 SAVE DB
    const complaint = await Complaint.create({
      complaintId,
      description,
      rawCategory: mapped.rawCategory || '',
      category: mapped.category,
      priority,
      status: 'PENDING',
      department: departmentName,
      departmentId,
      location,
      assignedOfficer: officer?._id || null,
      assignedOfficerName: officer?.name || null,
      slaDeadline,
      userId: userId || null,
      userName: userName || 'Anonymous',
    });

    if (officer) {
      await Officer.findByIdAndUpdate(officer._id, {
        $inc: { pendingCount: 1 }
      });
    }

    // 🔥 AUDIT LOG
    await AuditLog.create({
      action: 'CREATE_COMPLAINT',
      performedBy: userId || 'anonymous',
      performedByName: userName || 'Anonymous',
      role: 'PUBLIC',
      targetType: 'complaint',
      targetId: complaintId,
      details: `AI routed complaint → ${mapped.category} → ${departmentName}`,
    });

    // 🔥 REALTIME SOCKET
    emitToDepartment(departmentName, 'new_complaint', {
      complaintId,
      category: mapped.category,
      priority,
      userName,
      department: departmentName,
      location: location?.area,
      description: description.substring(0, 100),
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      data: complaint
    });

  } catch (err: any) {
    console.error("AI ERROR:", err.message);
    res.status(500).json({
      success: false,
      error: "AI Integration Failed"
    });
  }
};

// ====================== OFFICER: GET ASSIGNED ======================
export const getOfficerComplaints = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveOfficerScope(req, res);
    if (!scope) return;

    let filter: any = {};
    if (scope.kind === 'OFFICER') {
      filter = { assignedOfficer: scope.officerId };
    } else {
      const deptId = scope.departmentId ? scope.departmentId.toString() : null;
      const deptName = scope.departmentName ? scope.departmentName.toString() : null;
      if (deptId) {
        filter = {
          $or: [
            { assignedSubDepartment: deptId },
            { departmentId: deptId },
          ],
        };
      } else if (deptName) {
        filter = {
          $or: [
            { assignedSubDepartmentName: deptName },
            { department: deptName },
          ],
        };
      }
    }

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ====================== OFFICER: UPDATE STATUS ======================
export const updateOfficerComplaintStatus = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveOfficerScope(req, res);
    if (!scope) return;

    const { status, remarks, proofFileName } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const complaintId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const complaint = await findComplaintByAnyId(complaintId);
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

    if (scope.kind === 'OFFICER') {
      if (complaint.assignedOfficer?.toString() !== scope.officerId) {
        return res.status(403).json({ success: false, error: 'Not assigned to this officer' });
      }
    } else {
      const deptId = scope.departmentId ? scope.departmentId.toString() : '';
      const deptName = scope.departmentName ? scope.departmentName.toString() : '';
      const matchesDept = deptId
        ? complaint.departmentId?.toString() === deptId || complaint.assignedSubDepartment?.toString() === deptId
        : deptName
          ? complaint.department === deptName || complaint.assignedSubDepartmentName === deptName
          : false;
      if (!matchesDept) {
        return res.status(403).json({ success: false, error: 'Not assigned to this sub-department' });
      }
    }

    complaint.status = status;
    if (typeof remarks === 'string' && remarks.trim()) {
      complaint.lastRemark = remarks.trim();
      if (!complaint.notes) complaint.notes = [];
      complaint.notes.push({
        text: remarks.trim(),
        addedBy: req.user?.name || 'Officer',
        addedAt: new Date(),
        attachment: null,
      });
    }
    if (typeof proofFileName === 'string' && proofFileName.trim()) {
      complaint.proofFileName = proofFileName.trim();
    }

    if (status === 'RESOLVED') {
      complaint.resolvedAt = new Date();
      if (complaint.assignedOfficer && complaint.assignedOfficer !== 'Unassigned') {
        await Officer.findByIdAndUpdate(complaint.assignedOfficer, {
          $inc: { pendingCount: -1, resolvedCount: 1 },
        });
      }
    }

    if (status === 'ESCALATED') {
      await Escalation.create({
        complaintId: complaint.complaintId,
        level: 1,
        escalatedFrom: req.user?.userId,
        reason: remarks || 'Escalated by officer',
      });
      if (complaint.assignedOfficer && complaint.assignedOfficer !== 'Unassigned') {
        await Officer.findByIdAndUpdate(complaint.assignedOfficer, { $inc: { escalatedCount: 1 } });
      }
    }

    await complaint.save();

    const headAdminId = await findHeadAdminId(complaint);
    if (headAdminId) {
      await notifyUser(headAdminId, {
        title: 'Sub-Department Status Update',
        message: `Complaint #${complaint.complaintId} status updated to ${status}.`,
        type: 'STATUS_UPDATE',
        relatedId: complaint.complaintId,
      });
    }

    if (complaint.userId) {
      await notifyUser(complaint.userId, {
        title: 'Complaint Status Updated',
        message: `Your complaint #${complaint.complaintId} status is now ${status}.`,
        type: 'STATUS_UPDATE',
        relatedId: complaint.complaintId,
      });
      emitToUser(complaint.userId, 'complaint_updated', complaint);
    }

    if (complaint.department) {
      emitToDepartment(complaint.department, 'complaint_updated', complaint);
    }

    await AuditLog.create({
      action: 'OFFICER_STATUS_UPDATE',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: req.user?.role || 'OFFICER',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Status → ${status}${remarks ? `: ${remarks}` : ''}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ====================== OFFICER: ADD REMARK ======================
export const addOfficerComplaintRemark = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await resolveOfficerScope(req, res);
    if (!scope) return;

    const { text } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const complaintId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const complaint = await findComplaintByAnyId(complaintId);
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

    if (scope.kind === 'OFFICER') {
      if (complaint.assignedOfficer?.toString() !== scope.officerId) {
        return res.status(403).json({ success: false, error: 'Not assigned to this officer' });
      }
    } else {
      const deptId = scope.departmentId ? scope.departmentId.toString() : '';
      const deptName = scope.departmentName ? scope.departmentName.toString() : '';
      const matchesDept = deptId
        ? complaint.departmentId?.toString() === deptId || complaint.assignedSubDepartment?.toString() === deptId
        : deptName
          ? complaint.department === deptName || complaint.assignedSubDepartmentName === deptName
          : false;
      if (!matchesDept) {
        return res.status(403).json({ success: false, error: 'Not assigned to this sub-department' });
      }
    }

    if (!complaint.notes) complaint.notes = [];
    complaint.notes.push({
      text: text.trim(),
      addedBy: req.user?.name || 'Officer',
      addedAt: new Date(),
      attachment: null,
    });
    complaint.lastRemark = text.trim();
    await complaint.save();

    const headAdminId = await findHeadAdminId(complaint);
    if (headAdminId) {
      await notifyUser(headAdminId, {
        title: 'Sub-Department Remark Added',
        message: `Complaint #${complaint.complaintId} updated with a new remark.`,
        type: 'STATUS_UPDATE',
        relatedId: complaint.complaintId,
      });
    }

    if (complaint.userId) {
      await notifyUser(complaint.userId, {
        title: 'Complaint Updated',
        message: `A new remark was added to complaint #${complaint.complaintId}.`,
        type: 'STATUS_UPDATE',
        relatedId: complaint.complaintId,
      });
      emitToUser(complaint.userId, 'complaint_updated', complaint);
    }

    if (complaint.department) {
      emitToDepartment(complaint.department, 'complaint_updated', complaint);
    }

    await AuditLog.create({
      action: 'OFFICER_REMARK',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: req.user?.role || 'OFFICER',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Remark: ${text.trim()}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};