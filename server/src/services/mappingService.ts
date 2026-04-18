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
  law: ['crime', 'theft', 'police', 'fir', 'rape', 'assault', 'harassment', 'murder', 'homicide', 'kill', 'killed', 'stabbing', 'shooting', 'kidnap', 'abduction'],
  infrastructure: ['road', 'drainage', 'bridge', 'pothole', 'pwd'],
  government: ['scheme', 'pension', 'ration', 'govt', 'government'],
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

export function mapComplaintCategory(description: string, rawCategory: string | null, departments: Dept[]): MappingResult {
  const text = description.toLowerCase();
  const { topic, words } = resolveTopic(text, rawCategory);

  let best: { dept: Dept | null; score: number } = { dept: null, score: 0 };
  for (const dept of departments) {
    const score = scoreDepartment(text, topic, words, dept);
    if (score > best.score) best = { dept, score };
  }

  const matchedDept = best.dept;
  if (matchedDept && best.score > 0) {
    const category = (matchedDept.type || matchedDept.name || 'General Department').toString();
    const department = (matchedDept.name || category).toString();
    const departmentId = matchedDept._id ? matchedDept._id.toString() : null;
    return { rawCategory: rawCategory || null, category, department, departmentId };
  }

  return {
    rawCategory: rawCategory || null,
    category: 'General Department',
    department: 'General Department',
    departmentId: null,
  };
}
