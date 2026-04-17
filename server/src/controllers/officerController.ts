import { Response } from 'express';
import Officer from '../models/Officer';
import { AuthRequest } from '../middleware/auth';

// GET /api/officers
export const getOfficers = async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { isActive: true };

    if (req.user?.role === 'ADMIN' || req.user?.role === 'OFFICER') {
      if (req.user.departmentId) {
        filter.departmentId = req.user.departmentId;
      } else if (req.user.department) {
        filter.department = req.user.department;
      } else {
        return res.status(403).json({ success: false, error: 'Department scope missing' });
      }
    }

    const officers = await Officer.find(filter).sort({ department: 1 });
    res.json({ success: true, data: officers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch officers' });
  }
};

// GET /api/officers/:id
export const getOfficerById = async (req: AuthRequest, res: Response) => {
  try {
    const query: any = { _id: req.params.id };
    if (req.user?.role === 'ADMIN' || req.user?.role === 'OFFICER') {
      if (req.user.departmentId) query.departmentId = req.user.departmentId;
      else if (req.user.department) query.department = req.user.department;
      else return res.status(403).json({ success: false, error: 'Department scope missing' });
    }

    const officer = await Officer.findOne(query);
    if (!officer) {
      return res.status(404).json({ success: false, error: 'Officer not found' });
    }
    res.json({ success: true, data: officer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch officer' });
  }
};
