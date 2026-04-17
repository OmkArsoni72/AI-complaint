import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Officer from '../models/Officer';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import Department from '../models/Department';

// GET /api/users/me (Authenticated user)
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/users/profile (Authenticated user updates own profile)
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, phone, avatar, 
      address, city, state, zipCode, 
      gender, dob, bio 
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { 
        name, phone, avatar, 
        address, city, state, zipCode, 
        gender, dob, bio 
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/users (SUPER_ADMIN only)
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    let query: any = {};
    if (req.user!.role === 'ADMIN') {
      // Find the officer profile of the requester to get their department
      const officer = await Officer.findOne({ email: req.user!.email });
      if (officer) {
        query = { department: officer.department };
      } else {
        return res.status(403).json({ success: false, error: 'Officer profile not found for Admin' });
      }
    }

    if (req.user!.role === 'SUPER_ADMIN') {
      const headDepts = await Department.find({ parentDepartmentId: null, isActive: true }).select('_id name');
      const headDeptIds = headDepts.map((d) => d._id);
      const headDeptNames = headDepts.map((d) => d.name);

      query = {
        $or: [
          { role: 'SUPER_ADMIN' },
          {
            role: 'ADMIN',
            $or: [
              { departmentId: { $in: headDeptIds } },
              { department: { $in: headDeptNames } },
            ],
          },
        ],
      };
    }
    
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/users
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, email, password, role, department, region, phone, rank, level, employeeId, officeAddress, 
      district, state, pincode 
    } = req.body;
    
    // Authorization check for ADMIN role
    if (req.user!.role === 'ADMIN') {
      const requester = await Officer.findOne({ email: req.user!.email });
      if (!requester) return res.status(403).json({ success: false, error: 'Officer profile not found' });
      
      // Admin can only create users for their own department
      if (department !== requester.department) {
        return res.status(403).json({ success: false, error: 'Admins can only create users for their own department' });
      }
      
      // Admin can only create users with lower rank (higher level number = lower rank? no, user said Commissioner is level 8, Constable is 1. So Admin can create users with level < their level)
      // Actually, user said Constable is 1, Commissioner is 8. So higher number = higher rank.
      // So Admin can only create users with level < requester.level.
      if (level >= requester.level) {
        return res.status(403).json({ success: false, error: 'You can only create users with a lower rank than yours' });
      }
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const userResult = await User.create({
      name,
      email,
      password: hashed,
      role: role || 'ADMIN',
      department: department || null,
      region: region || null,
      phone: phone || '',
      rank: rank || '',
      level: level || 1,
      employeeId: employeeId || '',
      officeAddress: officeAddress || '',
      district: district || '',
      state: state || '',
      pincode: pincode || '',
    });

    // If role is ADMIN, also create an Officer record for handling complaints
    if (userResult.role === 'ADMIN') {
      await Officer.create({
        name: userResult.name,
        email: userResult.email,
        phone: userResult.phone || '000-000-0000',
        department: userResult.department || 'General Administration',
        designation: rank || 'Department Officer',
        rank: rank || 'Officer',
        level: level || 1,
        employeeId: employeeId || '',
        officeAddress: officeAddress || '',
        district: district || '',
        state: state || '',
        pincode: pincode || '',
        region: region || 'Delhi-NCR',
        performance: 75,
        isActive: true,
      });
    }

    await AuditLog.create({
      action: 'CREATE_USER',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'user',
      targetId: userResult._id.toString(),
      details: `Created ${role} user: ${name} (${email})`,
    });

    res.status(201).json({
      success: true,
      data: { ...userResult.toObject(), password: undefined },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/users/:id (SUPER_ADMIN updates user)
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, email, role, department, region, isActive, 
      employeeId, officeAddress, rank, level, phone, district, state, pincode 
    } = req.body;
    
    // Find original user for Officer sync
    const originalUser = await User.findById(req.params.id);
    if (!originalUser) return res.status(404).json({ success: false, error: 'User not found' });

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { 
        name, email, role, department, region, isActive, 
        employeeId, officeAddress, rank, level, phone, district, state, pincode 
      },
      { new: true }
    ).select('-password');

    // Sync with Officer record if this is an ADMIN
    if (updatedUser?.role === 'ADMIN' && updatedUser.email) {
      await Officer.findOneAndUpdate(
        { email: originalUser.email }, // Old email
        { 
          name: updatedUser.name,
          email: updatedUser.email,
          department: updatedUser.department || 'General',
          employeeId: updatedUser.employeeId,
          officeAddress: updatedUser.officeAddress,
          rank: updatedUser.rank,
          level: updatedUser.level,
          district: updatedUser.district,
          state: updatedUser.state,
          pincode: updatedUser.pincode,
          phone: updatedUser.phone
        },
        { upsert: true }
      );
    }

    await AuditLog.create({
      action: 'UPDATE_USER',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'user',
      targetId: req.params.id,
      details: `Updated user profile/permissions for : ${updatedUser?.name}`,
    });

    res.json({ success: true, data: updatedUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// DELETE /api/users/:id (SUPER_ADMIN deactivates/removes user)
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ success: false, error: 'User not found' });

    // Prevent deleting the only superadmin
    if (userToDelete.role === 'SUPER_ADMIN') {
      const superAdminCount = await User.countDocuments({ role: 'SUPER_ADMIN' });
      if (superAdminCount <= 1) {
        return res.status(403).json({ success: false, error: 'Cannot delete the only Super Admin account' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    
    // Also remove from Officer table if they were an admin
    if (userToDelete.role === 'ADMIN') {
      await Officer.findOneAndDelete({ email: userToDelete.email });
    }

    await AuditLog.create({
      action: 'DELETE_USER',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'user',
      targetId: req.params.id,
      details: `Permanently deleted user: ${userToDelete.name} (${userToDelete.email})`,
    });

    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
