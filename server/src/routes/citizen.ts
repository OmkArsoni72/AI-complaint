import { Router } from 'express';
import authRoutes from './auth';
import complaintRoutes from './complaints'; // Basic user operations
import userRoutes from './users';
import notificationRoutes from './notifications';
import analyticsRoutes from './analytics';
import officerRoutes from './officers';
import departmentRoutes from './departments';
import slaRoutes from './sla';
import auditRoutes from './audit';
import simulateRoutes from './simulate';
import adminRoutes from './admin';
import superadminRoutes from './superadmin';
import officerComplaintRoutes from './officer-complaints';

const router = Router();

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/officers', officerRoutes);
router.use('/departments', departmentRoutes);
router.use('/sla', slaRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/simulate', simulateRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/officer', officerComplaintRoutes);

export default router;
