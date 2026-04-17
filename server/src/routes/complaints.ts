import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import express from 'express';
import Complaint from '../models/Complaint';
import Notification from '../models/Notification';
import Department from '../models/Department';
import User from '../models/User';
import { detectCategory, detectPriority, getDepartment, calculateSLA, generateTags, generateComplaintId } from '../services/aiEngine';
import { emitEvent, emitToDepartment, emitToUser } from '../socket';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'grievance-system-secret-key-2024';

// ── Multer Storage Config ────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp3|wav|ogg|webm|m4a/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(null, valid);
  },
});

// Serve uploaded files as static
router.use('/files', express.static(uploadsDir));

// ── Helper: extract user from token (non-blocking) ───────────────────────
function getUserFromToken(req: Request): { userId: string; userName: string } | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return { userId: decoded.userId || '', userName: decoded.name || 'Anonymous' };
  } catch {
    return null;
  }
}

// ── GET /api/complaints/nearby — Find complaints within 2km ───────────────
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'Invalid coordinates' });
    }

    const complaints = await Complaint.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: 2000, // 2km in meters
        },
      },
    }).limit(20);

    res.json({ success: true, data: complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/complaints — Create complaint with optional files ──────────
router.post(
  '/',
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'voice', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const { description } = req.body;
      const rawLocation = req.body.location;
      const rawLat = req.body.lat;
      const rawLng = req.body.lng;
      let category: string = typeof req.body.category === 'string' ? req.body.category : '';

      if (!description || !rawLocation) {
        return res.status(400).json({
          success: false,
          error: 'description and location are required',
        });
      }

      let loc: any = null;
      if (typeof rawLocation === 'string') {
        try {
          loc = JSON.parse(rawLocation);
        } catch {
          loc = null;
        }
      } else if (typeof rawLocation === 'object') {
        loc = rawLocation;
      }

      const latNum =
        typeof loc?.lat === 'number'
          ? loc.lat
          : parseFloat((loc?.lat ?? rawLat) as string);
      const lngNum =
        typeof loc?.lng === 'number'
          ? loc.lng
          : parseFloat((loc?.lng ?? rawLng) as string);

      const area =
        typeof loc?.area === 'string'
          ? loc.area
          : typeof rawLocation === 'string'
            ? rawLocation
            : 'Unknown Area';
      const district =
        typeof loc?.district === 'string'
          ? loc.district
          : typeof req.body.district === 'string'
            ? req.body.district
            : 'Delhi';

      // ── AI Engine ────────────────────────────────────────────────────
      if (!category || category === 'General') {
        category = detectCategory(description).category;
      }
      const priority = detectPriority(description);
      const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const deptDoc = await Department.findOne({
        isActive: true,
        categories: { $regex: new RegExp(`^${escapedCategory}$`, 'i') },
      }).select('name');
      const department = deptDoc?.name || getDepartment(category);
      const departmentId = deptDoc?._id || null;
      const slaDeadline = calculateSLA(category, priority);
      const tags = generateTags(description, category);

      // ── Uploaded Files ───────────────────────────────────────────────
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const imageUrls = (files?.images || []).map((f) => `/api/complaints/files/${f.filename}`);
      const voiceNoteUrl = files?.voice?.[0]
        ? `/api/complaints/files/${files.voice[0].filename}`
        : '';

      // ── Extract user identity from JWT (if logged in) ────────────────
      const userInfo = getUserFromToken(req);

      const complaint = await Complaint.create({
        complaintId: generateComplaintId(),
        description,
        category,
        priority,
        department,
        departmentId,
        slaDeadline,
        tags,
        imageUrls,
        voiceNoteUrl,
        userId: userInfo?.userId || '',
        userName: userInfo?.userName || 'Anonymous',
        timeline: [{ step: 'Submitted', time: new Date() }],
        location: {
          type: 'Point',
          coordinates: [Number.isFinite(lngNum) ? lngNum : 77.209, Number.isFinite(latNum) ? latNum : 28.6139],
          area,
          district,
        },
        status: 'PENDING',
      });

      // Build admin recipients for this department so bell notifications are not static.
      const deptAdmins = await User.find({
        role: 'ADMIN',
        isActive: true,
        $or: [
          ...(departmentId ? [{ departmentId }] : []),
          { department: { $regex: new RegExp(`^${department}$`, 'i') } },
        ],
      }).select('_id');

      const adminIds = new Set<string>(deptAdmins.map((a) => a._id.toString()));
      if (deptDoc?.adminUserId) {
        adminIds.add(deptDoc.adminUserId.toString());
      }

      const adminNotificationPayload = {
        title: 'New Complaint Assigned',
        message: `#${complaint.complaintId} (${complaint.category}) reported in ${area || 'Unknown area'}`,
        type: 'GENERAL' as const,
        relatedId: complaint.complaintId,
      };

      if (adminIds.size > 0) {
        await Notification.insertMany(
          Array.from(adminIds).map((adminId) => ({
            userId: adminId,
            ...adminNotificationPayload,
          }))
        );

        for (const adminId of adminIds) {
          emitToUser(adminId, 'complaint_notification', adminNotificationPayload);
          emitToUser(adminId, 'complaint_created', complaint);
        }
      }

      // Emit real-time updates
      emitToDepartment(complaint.department, 'complaint_created', complaint);
      if (complaint.userId) {
        emitToUser(complaint.userId, 'complaint_created', complaint);
      }
      emitEvent('stats_updated', null);

      res.status(201).json({ success: true, data: complaint });
    } catch (err: any) {
      console.error('Create complaint error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── GET /api/complaints/my — Complaints for the logged-in user ──────────
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userInfo = getUserFromToken(req);
    if (!userInfo || !userInfo.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const complaints = await Complaint.find({ userId: userInfo.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/complaints — Get complaints (public/admin view) ─────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const query: any = {};

    if (typeof req.query.department === 'string' && req.query.department.trim()) {
      query.department = req.query.department.trim();
    }

    if (typeof req.query.userId === 'string' && req.query.userId.trim()) {
      query.userId = req.query.userId.trim();
    }

    if (typeof req.query.status === 'string' && req.query.status.trim()) {
      query.status = req.query.status.trim();
    }

    const limit =
      typeof req.query.limit === 'string' && req.query.limit.trim()
        ? parseInt(req.query.limit, 10)
        : undefined;

    let dbQuery = Complaint.find(query).sort({ createdAt: -1 });
    if (Number.isFinite(limit) && (limit as number) > 0) {
      dbQuery = dbQuery.limit(limit as number);
    }

    const complaints = await dbQuery;
    res.json({ success: true, data: complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/complaints/:id — Get complaint by ID ──────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });
    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/complaints/:id/feedback — User satisfaction feedback ─────
router.patch('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { satisfied } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

    complaint.status = satisfied === false ? 'ESCALATED' : 'RESOLVED';
    complaint.timeline.push({ step: complaint.status, time: new Date() });

    await complaint.save();

    emitToDepartment(complaint.department, 'complaint_updated', complaint);
    if (complaint.userId) {
      emitToUser(complaint.userId, 'complaint_updated', complaint);
    }
    if (complaint.status === 'ESCALATED') {
      emitToDepartment(complaint.department, 'complaint_escalated', complaint);
    }
    emitEvent('stats_updated', null);

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/complaints/:id/status — Admin status update ────────────────
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, assignedOfficer } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

    if (typeof status === 'string' && status.trim()) {
      const normalizedStatus = status.trim().toUpperCase();
      complaint.status = normalizedStatus;
      complaint.timeline.push({ step: normalizedStatus, time: new Date() });
    }

    if (assignedOfficer) {
      complaint.assignedOfficer = assignedOfficer;
      complaint.timeline.push({ step: 'Assigned', time: new Date() });
    }

    await complaint.save();

    emitToDepartment(complaint.department, 'complaint_updated', complaint);
    if (complaint.userId) {
      emitToUser(complaint.userId, 'complaint_updated', complaint);
    }
    emitEvent('stats_updated', null);

    // ── Notifications ───────────────────────────────────────────────
    if (complaint.userId) {
      if (assignedOfficer) {
        await Notification.create({
          userId: complaint.userId,
          title: 'Officer Assigned',
          message: `Your grievance has been assigned to: ${assignedOfficer}`,
          type: 'ASSIGNMENT',
          relatedId: complaint._id.toString(),
        });
      } else if (status) {
        await Notification.create({
          userId: complaint.userId,
          title: 'Status Updated',
          message: `Your grievance status is now: ${complaint.status}`,
          type: 'STATUS_UPDATE',
          relatedId: complaint._id.toString(),
        });
      }
    }

    res.json({ success: true, data: complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
