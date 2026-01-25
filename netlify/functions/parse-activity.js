import { getGeminiApiKey } from './_shared/googleAuth.js';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const extractJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return objectMatch[0];
  }

  return trimmed;
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || response.statusText);
    }

    const data = await response.json();
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: 'Empty response from Gemini' }) };
    }

    const rawJson = extractJson(resultText);
    if (!rawJson) {
      return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: 'Gemini returned no JSON payload' }) };
    }

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (parseError) {
      return {
        statusCode: 502,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Failed to parse JSON from Gemini', details: parseError.message }),
      };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(parsed) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
