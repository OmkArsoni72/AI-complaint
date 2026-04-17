import { Request, Response } from 'express';
import Complaint from '../models/Complaint';
import Officer from '../models/Officer';
import Escalation from '../models/Escalation';
import AuditLog from '../models/AuditLog';
import Department from '../models/Department';
import { emitToDepartment, emitToUser } from '../socket';
import {
  detectCategory,
  detectPriority,
  getDepartment,
  getDepartmentByCategory,
  calculateSLA,
  generateComplaintId,
} from '../services/aiEngine';
import { AuthRequest } from '../middleware/auth';

// GET /api/complaints
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

// GET /api/complaints/:id
export const getComplaintById = async (req: Request, res: Response) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }
    // Also fetch escalation history
    const escalations = await Escalation.find({ complaintId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: { ...complaint.toObject(), escalations } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/complaints
export const createComplaint = async (req: Request, res: Response) => {
  try {
    const { description, location, userId, userName } = req.body;
    const { category, confidence: aiConfidence } = detectCategory(description);
    const priority = detectPriority(description);
    
    // Route complaint to the department that handles this category
    const deptInfo = await getDepartmentByCategory(category);
    const deptDoc = await Department.findOne({ name: deptInfo.name }).select('_id name');
    const departmentId = deptDoc?._id || null;
    
    const slaDeadline = calculateSLA(category, priority);
    const complaintId = generateComplaintId();
    const confidence = aiConfidence;

    // Find officer in the routed department
    const officer = await Officer.findOne({ department: deptInfo.name, isActive: true })
      .sort({ pendingCount: 1 });

    const complaint = await Complaint.create({
      complaintId,
      description,
      category,
      priority,
      status: 'PENDING',
      department: deptInfo.name,
      departmentId,
      location,
      assignedOfficer: officer?._id || null,
      assignedOfficerName: officer?.name || null,
      confidence,
      slaDeadline,
      userId: userId || null,
      userName: userName || 'Anonymous',
    });

    if (officer) {
      await Officer.findByIdAndUpdate(officer._id, { $inc: { pendingCount: 1 } });
    }

    await AuditLog.create({
      action: 'CREATE_COMPLAINT',
      performedBy: userId || 'anonymous',
      performedByName: userName || 'Anonymous',
      role: 'PUBLIC',
      targetType: 'complaint',
      targetId: complaintId,
      details: `New ${priority} complaint: ${category} (${deptInfo.source === 'database' ? 'routed' : 'unmapped'}) → ${deptInfo.name} at ${location?.area || 'Unknown'}`,
    });

    // Emit real-time notification to department admins
    emitToDepartment(deptInfo.name, 'new_complaint', {
      complaintId,
      category,
      priority,
      userName,
      department: deptInfo.name,
      location: location?.area,
      description: description.substring(0, 100),
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/complaints/:id
export const updateComplaint = async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.id },
      updates,
      { new: true }
    );
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/complaints/:id/status (Admin action)
export const updateStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, remarks } = req.body;
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ success: false, error: 'Not found' });

    complaint.status = status;
    if (status === 'RESOLVED') {
      complaint.resolvedAt = new Date();
      // Decrement officer pending, increment resolved
      if (complaint.assignedOfficer) {
        await Officer.findByIdAndUpdate(complaint.assignedOfficer, {
          $inc: { pendingCount: -1, resolvedCount: 1 },
        });
      }
    }
    if (status === 'ESCALATED') {
      if (complaint.assignedOfficer) {
        await Officer.findByIdAndUpdate(complaint.assignedOfficer, {
          $inc: { escalatedCount: 1 },
        });
      }
      await Escalation.create({
        complaintId: complaint.complaintId,
        level: 1,
        escalatedFrom: req.user?.userId,
        reason: remarks || 'Manual escalation',
      });
    }
    await complaint.save();

    await AuditLog.create({
      action: 'UPDATE_STATUS',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: req.user?.role || 'SYSTEM',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Status → ${status}${remarks ? `: ${remarks}` : ''}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/complaints/:id/force-assign (SUPER_ADMIN only)
export const forceAssign = async (req: AuthRequest, res: Response) => {
  try {
    const { officerId, officerName, remarks } = req.body;
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ success: false, error: 'Not found' });

    // Decrement old officer, increment new
    if (complaint.assignedOfficer) {
      await Officer.findByIdAndUpdate(complaint.assignedOfficer, { $inc: { pendingCount: -1 } });
    }
    await Officer.findByIdAndUpdate(officerId, { $inc: { pendingCount: 1 } });

    complaint.assignedOfficer = officerId;
    complaint.assignedOfficerName = officerName;
    complaint.notes.push({
      text: `FORCE REASSIGN by Super Admin: ${remarks || 'No reason provided'}`,
      addedBy: req.user?.name || 'Super Admin',
      addedAt: new Date(),
      attachment: null,
    });
    await complaint.save();

    await AuditLog.create({
      action: 'FORCE_REASSIGN',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: 'SUPER_ADMIN',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Force reassigned to ${officerName}. Reason: ${remarks}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/complaints/:id/global-close (SUPER_ADMIN only)
export const globalClose = async (req: AuthRequest, res: Response) => {
  try {
    const { remarks } = req.body;
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ success: false, error: 'Not found' });

    if (complaint.status === 'RESOLVED') return res.status(400).json({ success: false, error: 'Already resolved' });

    if (complaint.assignedOfficer) {
      await Officer.findByIdAndUpdate(complaint.assignedOfficer, {
        $inc: { pendingCount: -1, resolvedCount: 1 },
      });
    }

    complaint.status = 'RESOLVED';
    complaint.resolvedAt = new Date();
    complaint.notes.push({
      text: `GLOBAL CLOSE by Super Admin: ${remarks || 'Administrative closure'}`,
      addedBy: req.user?.name || 'Super Admin',
      addedAt: new Date(),
      attachment: null,
    });
    await complaint.save();

    await AuditLog.create({
      action: 'GLOBAL_CLOSE',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: 'SUPER_ADMIN',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Globally closed by Super Admin. Remarks: ${remarks}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/complaints/:id/notes (Admin adds notes)
export const addNote = async (req: AuthRequest, res: Response) => {
  try {
    const { text, attachment } = req.body;
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ success: false, error: 'Not found' });

    const note = {
      text,
      attachment: attachment || null,
      addedBy: req.user?.name || 'Unknown',
      addedAt: new Date(),
    };

    if (!complaint.notes) complaint.notes = [];
    complaint.notes.push(note);
    await complaint.save();

    await AuditLog.create({
      action: 'ADD_NOTE',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: req.user?.role || 'ADMIN',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Note: ${text.substring(0, 80)}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/officer/complaints
export const getOfficerComplaints = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const complaints = await Complaint.find({ assignedTo: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/officer/complaints/:id/status
export const updateOfficerComplaintStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, remarks, proofFileName } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'status is required' });
    const complaint = await Complaint.findOne({ complaintId: req.params.id, assignedTo: req.user?.userId });
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

    complaint.status = status;
    if (status === 'RESOLVED') {
      complaint.resolvedAt = new Date();
    }
    if (typeof proofFileName === 'string' && proofFileName.trim()) {
      complaint.proofFileName = proofFileName.trim();
    }
    if (remarks) {
      if (!complaint.notes) complaint.notes = [];
      complaint.notes.push({
        text: remarks,
        addedBy: req.user?.name || 'Officer',
        addedAt: new Date(),
        attachment: null,
      });
    }

    await complaint.save();

    await AuditLog.create({
      action: 'OFFICER_UPDATE_STATUS',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'Officer',
      role: req.user?.role || 'OFFICER',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Status -> ${status}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/officer/complaints/:id/remark
export const addOfficerComplaintRemark = async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    const complaint = await Complaint.findOne({ complaintId: req.params.id, assignedTo: req.user?.userId });
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

    if (!complaint.notes) complaint.notes = [];
    complaint.notes.push({
      text,
      addedBy: req.user?.name || 'Officer',
      addedAt: new Date(),
      attachment: null,
    });
    await complaint.save();

    await AuditLog.create({
      action: 'OFFICER_ADD_REMARK',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'Officer',
      role: req.user?.role || 'OFFICER',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: 'Added officer remark',
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/complaints/:id/reassign
export const reassignComplaint = async (req: AuthRequest, res: Response) => {
  try {
    const { officerId, officerName } = req.body;
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ success: false, error: 'Not found' });

    // Decrement old officer, increment new
    if (complaint.assignedOfficer) {
      await Officer.findByIdAndUpdate(complaint.assignedOfficer, { $inc: { pendingCount: -1 } });
    }
    await Officer.findByIdAndUpdate(officerId, { $inc: { pendingCount: 1 } });

    complaint.assignedOfficer = officerId;
    complaint.assignedOfficerName = officerName;
    await complaint.save();

    await AuditLog.create({
      action: 'REASSIGN',
      performedBy: req.user?.userId || 'system',
      performedByName: req.user?.name || 'System',
      role: req.user?.role || 'ADMIN',
      targetType: 'complaint',
      targetId: complaint.complaintId,
      details: `Reassigned to ${officerName}`,
    });

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/complaints/:id/feedback (Public gives feedback)
export const addFeedback = async (req: Request, res: Response) => {
  try {
    const { satisfied, comment } = req.body;
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ success: false, error: 'Not found' });

    complaint.feedback = { satisfied, comment, submittedAt: new Date() };

    // If not satisfied, re-escalate
    if (!satisfied) {
      complaint.status = 'ESCALATED';
      await Escalation.create({
        complaintId: complaint.complaintId,
        level: 2,
        reason: `Citizen not satisfied: ${comment || 'No comment'}`,
        autoEscalated: false,
      });
    }

    await complaint.save();
    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
