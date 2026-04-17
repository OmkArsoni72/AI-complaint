import { Router } from 'express';
import { verifyAuth, requireRole } from '../middleware/auth';
import { getAdminOverview, warnAdmin } from '../controllers/superadminController';

const router = Router();

router.get('/admins', verifyAuth, requireRole('SUPER_ADMIN'), getAdminOverview);
router.post('/admins/:id/warn', verifyAuth, requireRole('SUPER_ADMIN'), warnAdmin);

export default router;
