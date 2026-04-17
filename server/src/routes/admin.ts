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
  updateComplaintStatus,
  addComplaintRemark,
} from '../controllers/adminController';

const router = Router();

// GET /api/admin/department — Get admin's own department info
router.get('/department', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const authReq = req as any;
    if (!authReq.user?.departmentId) {
      return res.status(400).json({ success: false, error: 'Department ID not found' });
    }
    const dept = await Department.findById(authReq.user.departmentId).select('name categories location jurisdiction address state');
    if (!dept) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    res.json({ success: true, data: dept });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sub-departments', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getSubDepartments);
router.post('/sub-departments', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), createSubDepartment);
router.patch('/sub-departments/:id', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), updateSubDepartment);
router.delete('/sub-departments/:id', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), deleteSubDepartment);

router.get('/officers', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getAdminOfficers);
router.post('/officers', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), createOfficer);

router.get('/complaints', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), getAdminComplaints);
router.patch('/complaints/:id/accept', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), acceptComplaint);
router.patch('/complaints/:id/reject', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), rejectComplaint);
router.patch('/complaints/:id/assign', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), assignComplaint);
router.patch('/complaints/:id/status', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), updateComplaintStatus);
router.post('/complaints/:id/remark', verifyAuth, requireRole('ADMIN', 'SUPER_ADMIN'), addComplaintRemark);

export default router;
