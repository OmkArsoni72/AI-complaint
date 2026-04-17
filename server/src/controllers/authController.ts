import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User';
import Department from '../models/Department';
import AuditLog from '../models/AuditLog';
import { generateToken } from '../middleware/auth';

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emailRegex = new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i');

    let user = await User.findOne({
      email: { $regex: emailRegex },
      isActive: true,
    });

    if (!user) {
      const inactive = await User.findOne({ email: { $regex: emailRegex } });
      if (inactive) {
        inactive.isActive = true;
        await inactive.save();
        user = inactive;
      }
    }

    if (!user) {
      const dept = await Department.findOne({
        contactEmail: { $regex: emailRegex },
        isActive: true,
      });

      if (dept && !dept.adminUserId) {
        const hashed = await bcrypt.hash(password, 10);
        user = await User.create({
          name: `${dept.name} Admin`,
          email: normalizedEmail,
          password: hashed,
          role: 'ADMIN',
          department: dept.name,
          departmentId: dept._id,
          isActive: true,
        });
        dept.adminUserId = user._id;
        await dept.save();
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    let valid = false;
    if (typeof user.password === 'string' && user.password.length > 0) {
      try {
        valid = await bcrypt.compare(password, user.password);
      } catch {
        valid = false;
      }
      if (!valid && user.password === password) {
        const hashed = await bcrypt.hash(password, 10);
        user.password = hashed;
        await user.save();
        valid = true;
      }
    } else {
      const hashed = await bcrypt.hash(password, 10);
      user.password = hashed;
      await user.save();
      valid = true;
    }
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const hasValidDeptId = Boolean(user.departmentId) && mongoose.Types.ObjectId.isValid(user.departmentId as any);
    const dept = hasValidDeptId
      ? await Department.findById(user.departmentId as any)
      : typeof user.department === 'string' && user.department.trim()
        ? await Department.findOne({ name: user.department.trim() })
        : null;
    const isSubDepartment = Boolean(dept?.parentDepartmentId);

    const token = generateToken({
      userId: user._id,
      role: user.role,
      department: user.department,
      departmentId: user.departmentId || null,
      isSubDepartment,
      region: user.region,
      name: user.name,
      email: user.email,
    });

    try {
      await AuditLog.create({
        action: 'LOGIN',
        performedBy: user._id,
        performedByName: user.name,
        role: user.role,
        targetType: 'auth',
        details: `${user.name} logged in`,
      });
    } catch {
      // Skip audit log errors to avoid blocking login.
    }

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          departmentId: user.departmentId || null,
          isSubDepartment,
          region: user.region,
          avatar: user.avatar,
        },
      },
    });
  } catch (err: any) {
    console.error('[auth/login] error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    res.status(500).json({ success: false, error: err.message || 'Login failed' });
  }
};

// POST /api/auth/register (Public signup)
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
      role: 'PUBLIC',
    });

    const token = generateToken({
      userId: user._id,
      role: 'PUBLIC',
      department: null,
      departmentId: null,
      region: null,
      name: user.name,
      email: user.email,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: 'PUBLIC',
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/auth/me
export const getMe = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

