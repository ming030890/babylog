import { GoogleGenAI, Type } from "@google/genai";
import { ParsedActivity } from '../types';

// Use gemini-3-flash-preview as requested for cheap/fast text processing
const MODEL_NAME = 'gemini-3-flash-preview';

export const parseActivityText = async (
  text: string, 
  knownTypes: string[]
): Promise<ParsedActivity> => {
  if (!process.env.API_KEY) {
    throw new Error("Gemini API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const now = new Date();
  
  // Format current date context for the model
  const dateContext = now.toISOString();
  
  const prompt = `
    Current System Time: ${dateContext}
    Known Event Types: ${knownTypes.join(', ')}
    
    Task: Parse the User Input into a structured baby activity log.
    
    Rules:
    1. Timestamp: 
       - If time is provided in input (e.g., "15:00"), combine it with the Current System Date.
       - If no time is provided, use the Current System Time exactly.
       - Return as ISO 8601 string.
    2. Event Type:
       - Try to reuse one of the "Known Event Types" if semantically similar (e.g., "fed" -> "feed").
       - If it's a new type of activity, create a concise, lowercase label (e.g., "poo", "sleep", "bath").
    3. Value:
       - Extract details like amount (ml, oz), duration, or notes.
       - If the input is just the event type (e.g., "poo"), leave value empty or describe strictly if details exist.

    User Input: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING, description: "ISO 8601 timestamp" },
            event_type: { type: Type.STRING, description: "Category of the event" },
            value: { type: Type.STRING, description: "Quantity, duration, or notes" },
          },
          required: ["timestamp", "event_type", "value"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from Gemini");

    return JSON.parse(resultText) as ParsedActivity;
  } catch (error) {
    console.error("Gemini Parse Error:", error);
    // Fallback if AI fails: Use current time and raw text
    return {
      timestamp: now.toISOString(),
      event_type: "note",
      value: text
    };
  }
};
