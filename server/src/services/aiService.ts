import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000/predict';

export async function fetchAiCategory(description: string): Promise<{ rawCategory: string | null; error?: string }> {
  try {
    const res = await axios.post(AI_SERVICE_URL, { text: description });
    const rawCategory = typeof res?.data?.category === 'string' ? res.data.category.trim() : '';
    return { rawCategory: rawCategory || null };
  } catch (err: any) {
    return { rawCategory: null, error: err?.message || 'AI service unavailable' };
  }
}
