import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './config/db';
import Complaint from './models/Complaint';
import Officer from './models/Officer';
import User from './models/User';
import SLAConfig from './models/SLAConfig';
import AuditLog from './models/AuditLog';
import Department from './models/Department';
import {
  detectCategory,
  detectPriority,
  getDepartment,
  calculateSLA,
  generateTags,
} from './services/aiEngine';

dotenv.config();

const departments = [
  {
    name: 'Delhi Police',
    icon: 'POL',
    categories: ['Public Safety', 'Crime', 'Harassment'],
    hierarchy: [
      { name: 'Constable', level: 1 },
      { name: 'Head Constable', level: 2 },
      { name: 'Sub Inspector', level: 3 },
      { name: 'Inspector / SHO', level: 4 },
      { name: 'DSP / ACP', level: 5 },
      { name: 'SP / DCP', level: 6 },
      { name: 'IG', level: 7 },
      { name: 'Commissioner', level: 8 },
    ],
  },
  {
    name: 'Municipal Corporation (MCD)',
    icon: 'MUN',
    categories: ['Sanitation', 'Road & Infrastructure'],
    hierarchy: [
      { name: 'Ward Worker', level: 1 },
      { name: 'Junior Engineer (JE)', level: 2 },
      { name: 'Assistant Engineer (AE)', level: 3 },
      { name: 'Executive Engineer', level: 4 },
      { name: 'Municipal Commissioner', level: 5 },
    ],
  },
  {
    name: 'Electricity Department',
    icon: 'ELEC',
    categories: ['Electricity'],
    hierarchy: [
      { name: 'Lineman', level: 1 },
      { name: 'Junior Engineer', level: 2 },
      { name: 'Assistant Engineer', level: 3 },
      { name: 'Executive Engineer', level: 4 },
      { name: 'Chief Engineer', level: 5 },
    ],
  },
];

const officers = [
  { name: 'Rajesh Kumar', department: 'Delhi Traffic Police', designation: 'Inspector', email: 'rajesh.kumar@dtp.gov.in', phone: '+91 98111 00001', performance: 88 },
  { name: 'Priya Sharma', department: 'Delhi Jal Board', designation: 'Executive Engineer', email: 'priya.sharma@djb.gov.in', phone: '+91 98111 00002', performance: 92 },
  { name: 'Amit Singh', department: 'BSES / TPDDL', designation: 'Senior Engineer', email: 'amit.singh@bses.gov.in', phone: '+91 98111 00003', performance: 78 },
  { name: 'Sunita Gupta', department: 'Municipal Corporation of Delhi', designation: 'Sanitation Officer', email: 'sunita.gupta@mcd.gov.in', phone: '+91 98111 00004', performance: 85 },
  { name: 'Vikram Mehta', department: 'Public Works Department', designation: 'Assistant Engineer', email: 'vikram.mehta@pwd.gov.in', phone: '+91 98111 00005', performance: 72 },
  { name: 'Ananya Patel', department: 'Delhi Police', designation: 'Sub Inspector', email: 'ananya.patel@dp.gov.in', phone: '+91 98111 00006', performance: 90 },
];

const users = [
  { name: 'Aarav Citizen', email: 'citizen@demo.com', password: 'demo123', role: 'PUBLIC' as const, department: null, region: 'Delhi' },
  { name: 'Rohit Kumar', email: 'rohit@demo.com', password: 'demo123', role: 'PUBLIC' as const, department: null, region: 'Delhi' },
  { name: 'Rajesh Kumar', email: 'admin@trafficpolice.gov.in', password: 'admin123', role: 'ADMIN' as const, department: 'Delhi Traffic Police', region: 'Delhi-Central' },
  { name: 'Priya Sharma', email: 'admin@jalboard.gov.in', password: 'admin123', role: 'ADMIN' as const, department: 'Delhi Jal Board', region: 'Delhi-South' },
  { name: 'Commissioner Singh', email: 'superadmin@delhi.gov.in', password: 'super123', role: 'SUPER_ADMIN' as const, department: null, region: 'Delhi-NCR' },
];

const slaConfigs = [
  { category: 'Traffic & Transport', department: 'Delhi Traffic Police', priorityHigh: 2, priorityMedium: 12, priorityLow: 72 },
  { category: 'Water Supply', department: 'Delhi Jal Board', priorityHigh: 4, priorityMedium: 24, priorityLow: 48 },
  { category: 'Electricity', department: 'BSES / TPDDL', priorityHigh: 3, priorityMedium: 12, priorityLow: 24 },
  { category: 'Sanitation', department: 'Municipal Corporation of Delhi', priorityHigh: 6, priorityMedium: 24, priorityLow: 72 },
  { category: 'Public Safety', department: 'Delhi Police', priorityHigh: 1, priorityMedium: 8, priorityLow: 48 },
];

const complaintDescriptions = [
  { desc: 'Major accident near Laxmi Nagar flyover, multiple vehicles involved', area: 'Laxmi Nagar', district: 'East Delhi', lat: 28.6304, lng: 77.2773 },
  { desc: 'No water supply in Dwarka Sector 7 for 3 days', area: 'Dwarka', district: 'South West Delhi', lat: 28.5921, lng: 77.0460 },
  { desc: 'Streetlights not working near Saket Metro Station', area: 'Saket', district: 'South Delhi', lat: 28.5244, lng: 77.2066 },
  { desc: 'Garbage dump overflowing near Chandni Chowk market', area: 'Chandni Chowk', district: 'Central Delhi', lat: 28.6507, lng: 77.2334 },
  { desc: 'Dangerous pothole on Ring Road near Nehru Place', area: 'Nehru Place', district: 'South Delhi', lat: 28.5491, lng: 77.2533 },
  { desc: 'Power outage in Rohini Sector 15 affecting 500+ families', area: 'Rohini', district: 'North West Delhi', lat: 28.7495, lng: 77.0565 },
  { desc: 'Sewage flooding in Janakpuri Block C residential colony', area: 'Janakpuri', district: 'West Delhi', lat: 28.6219, lng: 77.0864 },
  { desc: 'Broken water pipeline flooding road in Pitampura', area: 'Pitampura', district: 'North West Delhi', lat: 28.6969, lng: 77.1315 },
  { desc: 'Transformer sparking dangerously near Hauz Khas Village', area: 'Hauz Khas', district: 'South Delhi', lat: 28.5494, lng: 77.2001 },
  { desc: 'Fire outbreak in slum area near ITO junction', area: 'ITO', district: 'Central Delhi', lat: 28.6289, lng: 77.2411 },
];

const statuses = ['pending', 'in_progress', 'Resolved', 'Escalated'];

async function seed() {
  await connectDB();

  // Clear collections
  await Promise.all([
    Complaint.deleteMany({}),
    Officer.deleteMany({}),
    User.deleteMany({}),
    SLAConfig.deleteMany({}),
    AuditLog.deleteMany({}),
    Department.deleteMany({}),
  ]);
  console.log('Cleared all collections');

  // Seed Departments
  const createdDepartments = await Department.insertMany(departments);
  console.log(`Seeded ${createdDepartments.length} departments`);

  // Seed Officers
  const createdOfficers = await Officer.insertMany(
    officers.map((o) => ({
      ...o,
      pendingCount: Math.floor(Math.random() * 8),
      escalatedCount: Math.floor(Math.random() * 3),
      resolvedCount: Math.floor(Math.random() * 20) + 5,
      isActive: true,
    }))
  );
  console.log(`Seeded ${createdOfficers.length} officers`);

  // Seed Users
  const hashedUsers = await Promise.all(
    users.map(async (u) => ({
      ...u,
      password: await bcrypt.hash(u.password, 10),
      phone: '+91 98111 ' + String(Math.floor(Math.random() * 90000) + 10000),
      isActive: true,
    }))
  );
  const createdUsers = await User.insertMany(hashedUsers);
  console.log(`Seeded ${createdUsers.length} users`);

  // Seed SLA Configs
  const createdSLA = await SLAConfig.insertMany(
    slaConfigs.map((s) => ({ ...s, autoEscalate: true, escalationLevels: 3 }))
  );
  console.log(`Seeded ${createdSLA.length} SLA configurations`);

  // Seed Complaints (with new GeoJSON + timeline schema)
  const publicUsers = createdUsers.filter((u) => u.role === 'PUBLIC');
  const complaints = complaintDescriptions.map((c, i) => {
    const { category, confidence: aiConfidence } = detectCategory(c.desc);
    const priority = detectPriority(c.desc);
    const department = getDepartment(category);
    const slaDeadline = calculateSLA(category, priority);
    const tags = generateTags(c.desc, category);
    const officer = createdOfficers.find((o) => o.department === department) || createdOfficers[0];
    const status = statuses[i % statuses.length];
    const publicUser = publicUsers[i % publicUsers.length];
    const hoursAgo = Math.floor(Math.random() * 48) + 1;
    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    // Build timeline based on status
    const timeline = [{ step: 'Submitted', time: createdAt }];
    if (status !== 'pending') {
      timeline.push({ step: 'Assigned', time: new Date(createdAt.getTime() + 30 * 60 * 1000) });
    }
    if (status === 'in_progress' || status === 'Resolved') {
      timeline.push({ step: 'In Progress', time: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) });
    }
    if (status === 'Resolved') {
      timeline.push({ step: 'Resolved', time: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) });
    }
    if (status === 'Escalated') {
      timeline.push({ step: 'Escalated', time: new Date(createdAt.getTime() + 4 * 60 * 60 * 1000) });
    }

    return {
      description: c.desc,
      category,
      priority,
      status,
      department,
      tags,
      assignedOfficer: officer.name,
      timeline,
      location: {
        type: 'Point',
        coordinates: [c.lng, c.lat],
        area: c.area,
        district: c.district,
      },
      slaDeadline,
      userId: publicUser._id.toString(),
      userName: publicUser.name,
      imageUrls: [],
      voiceNoteUrl: '',
      createdAt,
    };
  });

  await Complaint.insertMany(complaints);
  console.log(`Seeded ${complaints.length} complaints`);

  // Seed audit logs
  await AuditLog.insertMany([
    { action: 'SYSTEM_SEED', performedBy: 'system', performedByName: 'System', role: 'SYSTEM', targetType: 'system', details: 'Database seeded with demo data' },
  ]);
  console.log('Seeded audit logs');

  console.log('\nSeed complete');
  console.log('\n--- Demo Accounts ---');
  console.log('PUBLIC:      citizen@demo.com / demo123');
  console.log('ADMIN:       admin@trafficpolice.gov.in / admin123');
  console.log('SUPER_ADMIN: superadmin@delhi.gov.in / super123');
  console.log('---');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
