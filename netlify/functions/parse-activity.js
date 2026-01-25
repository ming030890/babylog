import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiApiKey } from './_shared/googleAuth.js';

const MODEL_NAME = 'gemini-3-flash-preview';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { text, knownTypes } = JSON.parse(event.body || '{}');
    if (!text) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing text' }) };
    }

    const apiKey = getGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const dateContext = now.toISOString();
    const knownList = Array.isArray(knownTypes) ? knownTypes : [];

    const prompt = `
      Current System Time: ${dateContext}
      Known Event Types: ${knownList.join(', ')}
      
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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING, description: 'ISO 8601 timestamp' },
            event_type: { type: Type.STRING, description: 'Category of the event' },
            value: { type: Type.STRING, description: 'Quantity, duration, or notes' },
          },
          required: ['timestamp', 'event_type', 'value'],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: 'Empty response from Gemini' }) };
    }

    const parsed = JSON.parse(resultText);
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(parsed) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
