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

    console.log('[auth/login] Attempting login for:', normalizedEmail);

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emailRegex = new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i');

    let user = await User.findOne({
      email: { $regex: emailRegex },
      isActive: true,
    });

    if (!user) {
      const inactive = await User.findOne({ email: { $regex: emailRegex } });
      if (inactive) {
        console.log('[auth/login] Reactivating inactive user:', normalizedEmail);
        inactive.isActive = true;
        await inactive.save();
        user = inactive;
      }
    }

    // Fallback: check Department contactEmail and auto-provision user
    if (!user) {
      const dept = await Department.findOne({
        contactEmail: { $regex: emailRegex },
        isActive: true,
      });

      if (dept) {
        const isSubDept = Boolean(dept.parentDepartmentId);
        if (dept.adminUserId) {
          // Dept has an admin but user not found — try finding by adminUserId
          user = await User.findById(dept.adminUserId);
          if (user && user.email.toLowerCase() !== normalizedEmail) {
            // adminUserId points to a different email, update the user's email
            user = null;
          }
          if (!user) {
            // Create the user account for this department email
            console.log('[auth/login] Creating user for dept contactEmail:', normalizedEmail, 'dept:', dept.name);
            const hashed = await bcrypt.hash(password, 10);
            user = await User.create({
              name: `${dept.name} Admin`,
              email: normalizedEmail,
              password: hashed,
              role: isSubDept ? 'OFFICER' : 'ADMIN',
              department: dept.name,
              departmentId: dept._id,
              isActive: true,
            });
            dept.adminUserId = user._id;
            await dept.save();
          }
        } else {
          console.log('[auth/login] Auto-provisioning user for dept:', dept.name);
          const hashed = await bcrypt.hash(password, 10);
          user = await User.create({
            name: `${dept.name} Admin`,
            email: normalizedEmail,
            password: hashed,
            role: isSubDept ? 'OFFICER' : 'ADMIN',
            department: dept.name,
            departmentId: dept._id,
            isActive: true,
          });
          dept.adminUserId = user._id;
          await dept.save();
        }
      }
    }

    if (!user) {
      console.log('[auth/login] User not found for email:', normalizedEmail);
      return res.status(401).json({ success: false, error: 'Invalid credentials — no account found for this email' });
    }

    console.log('[auth/login] Found user:', user.email, 'role:', user.role, 'active:', user.isActive);

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
          ...user.toObject(),
          id: user._id,
          isSubDepartment,
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
          ...user.toObject(),
          id: user._id,
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

// POST /api/auth/google — Continue with Google
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential is required' });
    }

    // Decode the Google JWT token (base64 payload)
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid Google token' });
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ success: false, error: 'No email in Google token' });
    }

    console.log('[auth/google] Google login for:', email, name);

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Auto-register as PUBLIC citizen
      const randomPass = await bcrypt.hash(googleId + Date.now(), 10);
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: randomPass,
        role: 'PUBLIC',
        avatar: picture || '',
        isActive: true,
      });
      console.log('[auth/google] Created new user:', email);
    } else {
      // Update avatar if missing
      if (!user.avatar && picture) {
        user.avatar = picture;
        await user.save();
      }
    }

    const token = generateToken({
      userId: user._id,
      role: user.role,
      department: user.department || null,
      departmentId: user.departmentId || null,
      region: user.region || null,
      name: user.name,
      email: user.email,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          ...user.toObject(),
          id: user._id,
        },
      },
    });
  } catch (err: any) {
    console.error('[auth/google] error:', err?.message);
    res.status(500).json({ success: false, error: 'Google login failed' });
  }
};

