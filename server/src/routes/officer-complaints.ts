import { Router } from 'express';
import { verifyAuth, AuthRequest } from '../middleware/auth';
import {
  getOfficerComplaints,
  updateOfficerComplaintStatus,
  addOfficerComplaintRemark,
} from '../controllers/complaintController';

const router = Router();

function allowOfficerAccess(req: AuthRequest, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const isOfficer = req.user.role === 'OFFICER';
  const isSubDepartmentAdmin = req.user.role === 'ADMIN' && req.user.isSubDepartment;

  if (!isOfficer && !isSubDepartmentAdmin) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }

  next();
}

router.get('/complaints', verifyAuth, allowOfficerAccess, getOfficerComplaints);
router.patch('/complaints/:id/status', verifyAuth, allowOfficerAccess, updateOfficerComplaintStatus);
router.post('/complaints/:id/remark', verifyAuth, allowOfficerAccess, addOfficerComplaintRemark);

export default router;
