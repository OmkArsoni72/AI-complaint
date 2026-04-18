type MappingResult = {
  rawCategory: string | null;
  category: string;
  department: string;
  departmentId: string | null;
};

type Dept = {
  _id?: any;
  name?: string;
  type?: string;
  categories?: string[];
};

const KEYWORDS = {
  utilitiesWater: ['water', 'pani', 'pipeline', 'leakage', 'jal', 'nall'],
  utilitiesPower: ['electricity', 'bijli', 'power', 'current'],
  law: ['crime', 'theft', 'police', 'fir', 'rape', 'raped', 'rapped', 'assault', 'harassment', 'murder', 'homicide', 'kill', 'killed', 'stabbing', 'shooting', 'kidnap', 'abduction'],
  infrastructure: ['road', 'drainage', 'bridge', 'pothole', 'pwd'],
  government: ['scheme', 'pension', 'ration', 'govt', 'government'],
  education: ['school', 'education', 'teacher', 'college', 'student', 'students', 'class', 'padhai', 'skool', 'siksha'],
  cyber: ['fraud', 'hacking', 'scam', 'otp', 'banking', 'phishing'],
};

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function detectGenericCategory(text: string): string | null {
  if (hasAny(text, KEYWORDS.cyber)) return 'Cyber';
  if (hasAny(text, KEYWORDS.law)) return 'Law';
  if (hasAny(text, KEYWORDS.infrastructure)) return 'Infrastructure';
  if (hasAny(text, KEYWORDS.government)) return 'Government';
  if (hasAny(text, KEYWORDS.education)) return 'Education';
  if (hasAny(text, [...KEYWORDS.utilitiesWater, ...KEYWORDS.utilitiesPower])) return 'Utilities';
  return null;
}

function resolveTopic(text: string, rawCategory: string | null) {
  const keywordGeneric = detectGenericCategory(text);
  const generic = keywordGeneric || rawCategory || '';
  switch (generic) {
    case 'Utilities':
      if (hasAny(text, KEYWORDS.utilitiesWater)) return { topic: 'Water', words: KEYWORDS.utilitiesWater };
      if (hasAny(text, KEYWORDS.utilitiesPower)) return { topic: 'Electricity', words: KEYWORDS.utilitiesPower };
      return { topic: 'Utilities', words: [...KEYWORDS.utilitiesWater, ...KEYWORDS.utilitiesPower] };
    case 'Law':
      return { topic: 'Law', words: KEYWORDS.law };
    case 'Infrastructure':
      return { topic: 'Infrastructure', words: KEYWORDS.infrastructure };
    case 'Government':
      return { topic: 'Government', words: KEYWORDS.government };
    case 'Education':
      return { topic: 'Education', words: KEYWORDS.education };
    case 'Cyber':
      return { topic: 'Cyber', words: KEYWORDS.cyber };
    default:
      return { topic: 'General', words: [] };
  }
}

function scoreDepartment(text: string, topic: string, words: string[], dept: Dept) {
  const name = (dept.name || '').toLowerCase();
  const type = (dept.type || '').toLowerCase();
  const categories = (dept.categories || []).join(' ').toLowerCase();
  const haystack = `${name} ${type} ${categories}`;

  let score = 0;
  if (topic && haystack.includes(topic.toLowerCase())) score += 3;
  if (topic && name.includes(topic.toLowerCase())) score += 4;
  if (topic && type.includes(topic.toLowerCase())) score += 2;

  for (const w of words) {
    if (name.includes(w)) score += 3;
    if (type.includes(w) || categories.includes(w)) score += 1;
    if (text.includes(w)) score += 1;
  }

  return score;
}

function countDeptKeywordHits(topic: string, words: string[], dept: Dept) {
  const name = (dept.name || '').toLowerCase();
  const type = (dept.type || '').toLowerCase();
  const categories = (dept.categories || []).join(' ').toLowerCase();
  const haystack = `${name} ${type} ${categories}`;

  let hits = 0;
  if (topic && haystack.includes(topic.toLowerCase())) hits += 3;
  if (topic && name.includes(topic.toLowerCase())) hits += 3;
  if (topic && type.includes(topic.toLowerCase())) hits += 1;

  for (const w of words) {
    if (name.includes(w)) hits += 2;
    if (type.includes(w) || categories.includes(w)) hits += 1;
  }

  return hits;
}

export function mapComplaintCategory(description: string, rawCategory: string | null, departments: Dept[]): MappingResult {
  const text = description.toLowerCase();
  const { topic, words } = resolveTopic(text, rawCategory);

  let best: { dept: Dept | null; score: number; hits: number } = { dept: null, score: 0, hits: 0 };
  for (const dept of departments) {
    const score = scoreDepartment(text, topic, words, dept);
    const hits = countDeptKeywordHits(topic, words, dept);
    if (score > best.score || (score === best.score && hits > best.hits)) {
      best = { dept, score, hits };
    }
  }

  const matchedDept = best.dept;
  if (matchedDept && best.score > 0) {
    const category = (topic && topic !== 'General')
      ? topic
      : (matchedDept.type || matchedDept.name || 'General Department').toString();
    const department = (matchedDept.name || category).toString();
    const departmentId = matchedDept._id ? matchedDept._id.toString() : null;
    return { rawCategory: rawCategory || null, category, department, departmentId };
  }

  return {
    rawCategory: rawCategory || null,
    category: topic && topic !== 'General' ? topic : 'General Department',
    department: 'General Department',
    departmentId: null,
  };
}
