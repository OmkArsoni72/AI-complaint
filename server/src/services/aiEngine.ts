/**
 * AI Engine — Category Detection, Priority Scoring, SLA Calculation,
 * Department Mapping, and Auto-Tag Generation
 */

import Department from '../models/Department';

// ── Category Detection ──────────────────────────────────────────────────
const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { 
    keywords: ['water', 'pipeline', 'drain', 'leakage', 'sewage', 'tap', 'borewell', 'flood', 'paani', 'jal', 'nall', 'pani'], 
    category: 'Water Supply' 
  },
  { 
    keywords: ['electricity', 'power', 'light', 'current', 'transformer', 'outage', 'wire', 'spark', 'bijli', 'current', 'line', 'taar'], 
    category: 'Electricity' 
  },
  { 
    keywords: ['traffic', 'road', 'pothole', 'signal', 'accident', 'jam', 'highway', 'flyover', 'sadak', 'rasta', 'gadda', 'jam'], 
    category: 'Traffic & Transport' 
  },
  { 
    keywords: ['garbage', 'clean', 'waste', 'filth', 'sanitation', 'dirt', 'dump', 'rubbish', 'kachra', 'gandagi', 'safai', 'safayi'], 
    category: 'Sanitation' 
  },
  { 
    keywords: ['safety', 'crime', 'police', 'robbery', 'assault', 'theft', 'harassment', 'danger', 'police', 'chor', 'shakti', 'khatra'], 
    category: 'Public Safety' 
  },
  { 
    keywords: ['park', 'tree', 'garden', 'playground', 'green', 'environment', 'pollution', 'ped', 'ped-paudhe', 'per', 'pradushan'], 
    category: 'Environment' 
  },
  { 
    keywords: ['hospital', 'health', 'medical', 'disease', 'ambulance', 'doctor', 'clinic', 'bimari', 'aspatal', 'dawakhana'], 
    category: 'Health' 
  },
  { 
    keywords: ['school', 'education', 'teacher', 'college', 'student', 'class', 'padhai', 'skool', 'siksha'], 
    category: 'Education' 
  },
  { 
    keywords: ['building', 'construction', 'collapse', 'demolition', 'encroachment', 'makan', 'ghar', 'kabja', 'girna'], 
    category: 'Infrastructure' 
  },
];

export function detectCategory(description: string): { category: string; confidence: number } {
  const lower = description.toLowerCase();
  let bestMatch = { category: 'General', score: 0 };

  for (const rule of CATEGORY_RULES) {
    const score = rule.keywords.filter(k => lower.includes(k)).length;
    if (score > bestMatch.score) {
      bestMatch = { category: rule.category, score };
    }
  }
  // Simplified confidence: ratio of matches to total words (max 1.0)
  const confidence = Math.min(bestMatch.score / 3, 1.0) || 0.5;
  return { category: bestMatch.category, confidence };
}

// ── Priority Detection ──────────────────────────────────────────────────
const HIGH_PRIORITY_KEYWORDS = [
  'fire', 'accident', 'collapse', 'emergency', 'urgent', 'danger', 'death', 'dead',
  'injured', 'serious', 'critical', 'explosion', 'toxic', 'gas leak', 'flooding',
  'aag', 'durghatna', 'emargency', 'khatra', 'maut', 'ghayal', 'baadh'
];
const MEDIUM_PRIORITY_KEYWORDS = [
  'broken', 'leak', 'not working', 'damaged', 'faulty', 'pothole', 'issue',
  'problem', 'outage', 'contaminated', 'blocked', 'stuck',
  'toota', 'leakage', 'kharab', 'gadda', 'dikkat', 'paresani', 'problem', 'phas'
];

export function detectPriority(description: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const lower = description.toLowerCase();
  if (HIGH_PRIORITY_KEYWORDS.some(k => lower.includes(k))) return 'HIGH';
  if (MEDIUM_PRIORITY_KEYWORDS.some(k => lower.includes(k))) return 'MEDIUM';
  return 'LOW';
}

// ── Department Mapping ──────────────────────────────────────────────────
const DEPARTMENT_MAP: Record<string, string> = {
  'Water Supply': 'Delhi Jal Board',
  'Electricity': 'BSES / TPDDL',
  'Traffic & Transport': 'Delhi Traffic Police',
  'Sanitation': 'Municipal Corporation of Delhi',
  'Public Safety': 'Delhi Police',
  'Environment': 'Delhi Pollution Control Committee',
  'Health': 'Delhi Health Services',
  'Education': 'Directorate of Education',
  'Infrastructure': 'Public Works Department',
  'General': 'General Administration',
};

/**
 * Find department by category from database
 * Searches for a department whose categories array includes the given category
 * Falls back to default department mapping if not found
 */
export async function getDepartmentByCategory(category: string) {
  try {
    // Search for department with this category in their categories array
    const dept = await Department.findOne({
      categories: category,
      isActive: true
    }).select('_id name categories adminUserId');
    
    if (dept) {
      return {
        name: dept.name,
        _id: dept._id,
        adminUserId: dept.adminUserId,
        source: 'database'
      };
    }
  } catch (err: any) {
    console.error('Error finding department by category:', err.message);
  }
  
  // Fallback to hardcoded mapping
  const deptName = DEPARTMENT_MAP[category] || 'General Administration';
  return {
    name: deptName,
    _id: null,
    adminUserId: null,
    source: 'fallback'
  };
}

export function getDepartment(category: string): string {
  return DEPARTMENT_MAP[category] || 'General Administration';
}

// ── SLA Timer (in hours) ────────────────────────────────────────────────
const SLA_MAP: Record<string, Record<string, number>> = {
  'Water Supply':      { HIGH: 4,  MEDIUM: 24,  LOW: 48 },
  'Electricity':       { HIGH: 2,  MEDIUM: 12,  LOW: 24 },
  'Traffic & Transport': { HIGH: 1, MEDIUM: 8,  LOW: 72 }, // This is road
  'Public Safety':     { HIGH: 0.5, MEDIUM: 4,  LOW: 12 },
  'Sanitation':        { HIGH: 6,  MEDIUM: 24,  LOW: 72 },
  'Environment':       { HIGH: 8,  MEDIUM: 48,  LOW: 96 },
  'Health':            { HIGH: 1,  MEDIUM: 8,   LOW: 24 },
  'Infrastructure':    { HIGH: 4,  MEDIUM: 48,  LOW: 96 },
  'Education':         { HIGH: 12, MEDIUM: 48,  LOW: 96 },
  'General':           { HIGH: 12, MEDIUM: 48,  LOW: 96 },
};

export function calculateSLA(category: string, priority: string): Date {
  const hours = SLA_MAP[category]?.[priority] ?? 48;
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}

// ── Auto Tags ───────────────────────────────────────────────────────────
const TAG_KEYWORDS: { tag: string; keywords: string[] }[] = [
  { tag: 'leakage',       keywords: ['leak', 'leaking', 'leakage', 'drip'] },
  { tag: 'urgent',        keywords: ['urgent', 'emergency', 'immediately', 'asap', 'fire', 'critical'] },
  { tag: 'road-damage',   keywords: ['pothole', 'road damage', 'broken road', 'highway'] },
  { tag: 'no-water',      keywords: ['no water', 'water shortage', 'dry tap', 'no supply'] },
  { tag: 'power-cut',     keywords: ['power cut', 'no electricity', 'outage', 'blackout'] },
  { tag: 'garbage',       keywords: ['garbage', 'waste', 'dump', 'rubbish', 'trash'] },
  { tag: 'illegal',       keywords: ['illegal', 'encroachment', 'unauthorized'] },
  { tag: 'structural',    keywords: ['collapse', 'building', 'wall', 'crack', 'structure'] },
  { tag: 'pollution',     keywords: ['pollution', 'smoke', 'fumes', 'toxic', 'chemical'] },
  { tag: 'flooding',      keywords: ['flood', 'waterlogging', 'overflow', 'submerged'] },
  { tag: 'noise',         keywords: ['noise', 'sound', 'loud', 'disturbance'] },
  { tag: 'safety-risk',   keywords: ['danger', 'hazard', 'unsafe', 'risk', 'threat'] },
];

export function generateTags(description: string, category: string): string[] {
  const lower = description.toLowerCase();
  const tags: string[] = [];

  for (const { tag, keywords } of TAG_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) {
      tags.push(tag);
    }
  }

  // Add category-based tag
  const catTag = category.toLowerCase().replace(/[& ]+/g, '-');
  if (!tags.includes(catTag)) tags.push(catTag);

  return [...new Set(tags)].slice(0, 6); // max 6 tags, deduplicated
}

export function generateComplaintId(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `GRV${year}${month}${day}${random}`;
}
