import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getUsers, createUser, updateUser, deleteUser, getMe, updateProfile } from '../controllers/userController';
import { verifyAuth, requireRole } from '../middleware/auth';

const router = Router();

// Multer Storage for Avatars
const isVercel = process.env.VERCEL === '1';
const avatarsDir = isVercel
  ? path.join('/tmp', 'uploads', 'avatars')
  : path.join(process.cwd(), 'uploads', 'avatars');

try {
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
} catch (err) {
  console.log('Avatars directory creation skipped or failed:', err);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (req: any, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user?.userId || 'unknown'}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Self-service routes (any logged-in user)
router.get('/me', verifyAuth, getMe);
router.patch('/profile', verifyAuth, updateProfile);

router.post('/avatar', verifyAuth, upload.single('avatar'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    res.json({ success: true, avatarUrl });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only routes
router.get('/', verifyAuth, requireRole('SUPER_ADMIN'), getUsers);
router.post('/', verifyAuth, requireRole('SUPER_ADMIN'), createUser);
router.patch('/:id', verifyAuth, requireRole('SUPER_ADMIN'), updateUser);
router.delete('/:id', verifyAuth, requireRole('SUPER_ADMIN'), deleteUser);

export default router;
