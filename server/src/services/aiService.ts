import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface AICategorization {
  category: string;
  department: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  reasoning: string;
}

export const categorizeComplaint = async (description: string): Promise<AICategorization> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an AI assistant for a Smart City Grievance Management System. 
      Your task is to analyze a citizen's complaint and categorize it.

      Complaint Description: "${description}"

      Return your response in STRICT JSON format with these exact keys:
      {
        "category": "The specific type of issue (e.g., Pothole, Water Leakage, Streetlight Out, Illegal Dumping)",
        "department": "The government department responsible (e.g., Public Works, Water Board, Electricity, Sanitation)",
        "priority": "LOW, MEDIUM, HIGH, or URGENT",
        "reasoning": "A short 1-sentence explanation of why you chose this categorization"
      }
      
      Respond with ONLY the JSON object. Keep it professional.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean text in case Gemini adds markdown backticks
    const cleanedText = text.replace(/```json|```/gi, "").trim();
    return JSON.parse(cleanedText) as AICategorization;
    
  } catch (error) {
    console.error("AI Categorization Error:", error);
    // Fallback safe defaults
    return {
      category: "General Inquiry",
      department: "General Administration",
      priority: "MEDIUM",
      reasoning: "AI analysis failed, using default values."
    };
  }
};

// Alias for backward compatibility with complaints.ts
export const fetchAiCategory = async (description: string): Promise<{ rawCategory: string }> => {
  const result = await categorizeComplaint(description);
  return { rawCategory: result.category };
};

