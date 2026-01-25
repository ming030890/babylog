import { ParsedActivity } from '../types';

const FUNCTION_URL = '/.netlify/functions/parse-activity';

export const parseActivityText = async (
  text: string, 
  knownTypes: string[]
): Promise<ParsedActivity> => {
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, knownTypes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to parse activity.');
    }

    return await response.json();
  } catch (error) {
    console.error("Gemini Parse Error:", error);
    // Fallback if AI fails: Use current time and raw text
    return {
      timestamp: new Date().toISOString(),
      event_type: "note",
      value: text
    };
  }
};
