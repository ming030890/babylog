import { ParsedActivity } from '../types';

const FUNCTION_URL = '/.netlify/functions/parse-activity';

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    return data?.error || fallback;
  } catch {
    try {
      const text = await response.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
};

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
      const message = await readErrorMessage(response, 'Failed to parse activity.');
      throw new Error(message);
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
