import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'grievance-system-secret-key-2024';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    department: string | null;
    departmentId?: string | null;
    isSubDepartment?: boolean;
    region: string | null;
    name: string;
    email: string;
  };
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  // BYPASS FOR STANDALONE DEMO MODE
  if (token === 'demo-token-active-citizen') {
    req.user = {
      userId: '65f1a2b3c4d5e6f7a8b9c0d1', // Mock Mongo ID
      role: 'PUBLIC',
      department: null,
      region: 'Delhi NCR',
      name: 'Demo Citizen',
      email: 'citizen@example.com'
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}
