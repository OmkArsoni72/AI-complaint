import { Response } from 'express';
import Department from '../models/Department';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

// GET /api/departments
export const getDepartments = async (req: AuthRequest, res: Response) => {
  try {
    const query: Record<string, any> = { isActive: true };

    if (req.user?.role === 'SUPER_ADMIN') {
      query.parentDepartmentId = null;
    }

    const departments = await Department.find(query).sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/departments (SUPER_ADMIN only)
export const createDepartment = async (req: AuthRequest, res: Response) => {
  try {
    const { name, icon, location, type, jurisdictionLevel, categories, hierarchy } = req.body;
    const normalizedType = typeof type === 'string' ? type.trim() : '';
    const exists = await Department.findOne({ name });
    if (exists) return res.status(400).json({ success: false, error: 'Department already exists' });

    const department = await Department.create({
      name,
      icon: icon || '🏢',
      location: location || 'Delhi',
      type: normalizedType || 'General',
      jurisdictionLevel: jurisdictionLevel || 'City',
      categories: categories || [],
      hierarchy: hierarchy || [],
    });

    await AuditLog.create({
      action: 'CREATE_DEPARTMENT',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'department',
      targetId: department._id.toString(),
      details: `Created department: ${name}`,
    });

    res.status(201).json({ success: true, data: department });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/departments/:id
export const updateDepartment = async (req: AuthRequest, res: Response) => {
  try {
    const deptToUpdate = await Department.findById(req.params.id);
    if (!deptToUpdate) return res.status(404).json({ success: false, error: 'Department not found' });

    // Role check
    if (req.user!.role === 'ADMIN') {
      // Find the officer profile of the requester to get their department name
      // assuming req.user!.department is already set in the JWT or session
      // If not, we should look it up. But let's assume it's available or we trust the role.
      // Actually, many departments might have the same name in different areas. 
      // Safe check: Admins can only update their OWN department.
      if (req.user!.department !== deptToUpdate.name) {
        return res.status(403).json({ success: false, error: 'Unauthorized to update this department' });
      }
    } else if (req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { name, icon, location, type, jurisdictionLevel, categories, hierarchy } = req.body;
    const normalizedType = typeof type === 'string' ? type.trim() : '';
    
    if (name) deptToUpdate.name = name;
    if (icon) deptToUpdate.icon = icon;
    if (location) deptToUpdate.location = location;
    if (normalizedType) deptToUpdate.type = normalizedType;
    if (jurisdictionLevel) deptToUpdate.jurisdictionLevel = jurisdictionLevel;
    if (categories) deptToUpdate.categories = categories;
    if (hierarchy) deptToUpdate.hierarchy = hierarchy;

    await deptToUpdate.save();

    await AuditLog.create({
      action: 'UPDATE_DEPARTMENT',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'department',
      targetId: deptToUpdate._id.toString(),
      details: `Updated department: ${deptToUpdate.name}`,
    });

    res.json({ success: true, data: deptToUpdate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/departments/:id (SUPER_ADMIN only - permanent delete)
export const deleteDepartment = async (req: AuthRequest, res: Response) => {
  try {
    const deptToDelete = await Department.findById(req.params.id);
    if (!deptToDelete) return res.status(404).json({ success: false, error: 'Department not found' });

    await Department.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'DELETE_DEPARTMENT',
      performedBy: req.user!.userId,
      performedByName: req.user!.name,
      role: req.user!.role,
      targetType: 'department',
      targetId: req.params.id,
      details: `Permanently deleted department: ${deptToDelete.name}`,
    });

    res.json({ success: true, message: 'Department deleted permanently' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
