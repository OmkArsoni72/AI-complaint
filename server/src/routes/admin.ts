import { Router } from 'express';
import { verifyAuth, requireRole } from '../middleware/auth';
import Department from '../models/Department';
import {
  getSubDepartments,
  createSubDepartment,
  updateSubDepartment,
  deleteSubDepartment,
  getAdminOfficers,
  createOfficer,
  getAdminComplaints,
  acceptComplaint,
  rejectComplaint,
  assignComplaint,
  assignSubDepartment,
  updateComplaintStatus,
  addComplaintRemark,
  getSubDepartmentComplaints,
} from '../controllers/adminController';

const router = Router();

// GET /api/admin/department — Get admin's own department info
router.get('/department', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const authReq = req as any;
    console.log('[admin/department] user:', authReq.user?.email, 'departmentId:', authReq.user?.departmentId, 'department:', authReq.user?.department);

    // Try by departmentId first, then fall back to department name
    let dept: any = null;
    if (authReq.user?.departmentId) {
      dept = await Department.findById(authReq.user.departmentId).select('name categories location jurisdiction address state');
    }
    if (!dept && authReq.user?.department) {
      dept = await Department.findOne({
        name: { $regex: new RegExp(`^${authReq.user.department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        isActive: true,
      }).select('name categories location jurisdiction address state');
    }
    if (!dept) {
      console.log('[admin/department] Department not found for user:', authReq.user?.email);
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    console.log('[admin/department] Found dept:', dept.name, 'categories:', dept.categories);
    res.json({ success: true, data: dept });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sub-departments', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getSubDepartments);
router.post('/sub-departments', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), createSubDepartment);
router.patch('/sub-departments/:id', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), updateSubDepartment);
router.delete('/sub-departments/:id', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), deleteSubDepartment);
router.get('/sub-departments/:id/complaints', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getSubDepartmentComplaints);

router.get('/officers', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getAdminOfficers);
router.post('/officers', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), createOfficer);

router.get('/complaints', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getAdminComplaints);
router.patch('/complaints/:id/accept', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), acceptComplaint);
router.patch('/complaints/:id/reject', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), rejectComplaint);
router.patch('/complaints/:id/assign', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), assignComplaint);
router.patch('/complaints/:id/assign-subdepartment', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), assignSubDepartment);
router.patch('/complaints/:id/status', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), updateComplaintStatus);
router.post('/complaints/:id/remark', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), addComplaintRemark);

export default router;
