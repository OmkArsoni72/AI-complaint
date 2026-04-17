import { Router } from 'express';
import { login, register, getMe, googleLogin } from '../controllers/authController';
import { verifyAuth } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/google', googleLogin);
router.get('/me', verifyAuth, getMe);

export default router;

