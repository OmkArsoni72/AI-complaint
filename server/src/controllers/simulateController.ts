import { Request, Response } from 'express';
import Complaint from '../models/Complaint';
import Officer from '../models/Officer';
import {
  detectCategory,
  detectPriority,
  getDepartment,
  calculateSLA,
  generateTags,
  generateComplaintId,
} from '../services/aiEngine';

const crisisTemplates = [
  { desc: 'Major fire reported in Chandni Chowk market area, multiple shops affected', area: 'Chandni Chowk', district: 'Central Delhi', lat: 28.6507, lng: 77.2334 },
  { desc: 'Severe waterlogging on NH-24 near Laxmi Nagar, traffic at standstill', area: 'Laxmi Nagar', district: 'East Delhi', lat: 28.6304, lng: 77.2773 },
  { desc: 'Gas pipeline leak detected near Dwarka Sector 21 metro station', area: 'Dwarka', district: 'South West Delhi', lat: 28.5571, lng: 77.0588 },
  { desc: 'Building collapse reported in Rohini Sector 7, emergency rescue needed', area: 'Rohini', district: 'North West Delhi', lat: 28.7158, lng: 77.0695 },
  { desc: 'Multiple vehicle accident on Ring Road near AIIMS flyover causing major traffic disruption', area: 'AIIMS', district: 'South Delhi', lat: 28.5672, lng: 77.2100 },
  { desc: 'Complete power outage in Janakpuri district affecting hospitals and schools', area: 'Janakpuri', district: 'West Delhi', lat: 28.6219, lng: 77.0864 },
  { desc: 'Toxic chemical spill from overturned tanker near Wazirpur Industrial Area', area: 'Wazirpur', district: 'North West Delhi', lat: 28.6969, lng: 77.1602 },
  { desc: 'Massive garbage dump fire in Ghazipur landfill releasing toxic fumes across East Delhi', area: 'Ghazipur', district: 'East Delhi', lat: 28.6206, lng: 77.3266 },
  { desc: 'Severe water contamination reported in Mayur Vihar Phase 2, residents falling ill', area: 'Mayur Vihar', district: 'East Delhi', lat: 28.6087, lng: 77.2988 },
  { desc: 'Road cave-in near Connaught Place outer circle disrupting metro services', area: 'Connaught Place', district: 'New Delhi', lat: 28.6315, lng: 77.2167 },
];

// POST /api/simulate
export const simulateCrisis = async (_req: Request, res: Response) => {
  try {
    const numComplaints = Math.floor(Math.random() * 4) + 5; // 5-8 complaints
    const selected = [...crisisTemplates]
      .sort(() => Math.random() - 0.5)
      .slice(0, numComplaints);

    const complaints = [];

    for (const template of selected) {
      const { category } = detectCategory(template.desc);
      const priority = detectPriority(template.desc);
      const department = getDepartment(category);
      const slaDeadline = calculateSLA(category, priority);
      const tags = generateTags(template.desc, category);

      const officer = await Officer.findOne({ department }).sort({ pendingCount: 1 });
      
      const createdAt = new Date();
      const timeline = [
        { step: 'Submitted', time: createdAt },
        { step: 'Assigned', time: new Date(createdAt.getTime() + 1000 * 60 * 5) } // Assigned 5 mins later
      ];

      const complaint = await Complaint.create({
        complaintId: generateComplaintId(),
        description: template.desc,
        category,
        priority,
        status: 'PENDING',
        department,
        tags,
        location: {
          type: 'Point',
          coordinates: [template.lng + (Math.random() - 0.5) * 0.01, template.lat + (Math.random() - 0.5) * 0.01],
          area: template.area,
          district: template.district,
        },
        assignedOfficer: officer?._id?.toString() || '',
        assignedOfficerName: officer?.name || 'Assigned Officer',
        slaDeadline,
        timeline,
        imageUrls: [],
        voiceNoteUrl: '',
        createdAt,
      });

      if (officer) {
        officer.pendingCount += 1;
        await officer.save();
      }

      complaints.push(complaint);
    }

    res.json({
      success: true,
      message: `🚨 Crisis simulated! ${complaints.length} complaints generated.`,
      data: complaints,
    });
  } catch (error) {
    console.error('Simulate crisis error:', error);
    res.status(500).json({ success: false, error: 'Failed to simulate crisis' });
  }
};
