import { getGeminiApiKey } from './_shared/googleAuth.js';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

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
      
      Task: Parse the User Input into one or more structured baby activity log entries.
      
      Rules:
      1. Timestamp: 
         - If time is provided in input (e.g., "15:00"), combine it with the Current System Date.
         - If no time is provided, use the Current System Time exactly.
         - Return as ISO 8601 string.
      2. Event Type:
         - Try to reuse one of the "Known Event Types" if semantically similar (e.g., "fed" -> "feed_ml").
         - Do not change the casing of event types provided by the user or known types.
         - If it's a new type of activity, create a concise label using the user's casing.
         - The event_type is displayed to the user, so keep it human-friendly.
      3. Value:
         - Extract details like amount (ml, oz), duration, or notes.
         - If the event type is "feed_ml", store only the numeric amount without units (e.g., "160").
         - If the input is just the event type (e.g., "poo"), leave value empty or describe strictly if details exist.
      4. Output scope:
         - Only output JSON for the rows to insert.
         - Do not include any schema changes or spreadsheet instructions.
      5. Multiple entries:
         - If the input describes multiple activities, return multiple items in the activities array.
         - Preserve the order the user provided.
      6. Invalid input:
         - If the input cannot be parsed into any activity, return an error message and an empty activities array.
  
      User Input: "${text}"
    `;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: {
              activities: {
                type: 'array',
                description: 'Parsed activity entries',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string', description: 'ISO 8601 timestamp' },
                    event_type: { type: 'string', description: 'Category of the event' },
                    value: { type: 'string', description: 'Quantity, duration, or notes' },
                  },
                  required: ['timestamp', 'event_type', 'value'],
                },
              },
              error: { type: 'string', description: 'Error message when input is invalid' },
            },
            required: ['activities'],
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: 502,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Gemini request failed', details: errorText }),
      };
    }

    const responseData = await response.json();
    const resultText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
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

    const activities = Array.isArray(parsed.activities) ? parsed.activities : [];
    const errorMessage = typeof parsed.error === 'string' ? parsed.error : null;

    if (!activities.length) {
      return {
        statusCode: 422,
        headers: jsonHeaders,
        body: JSON.stringify({ error: errorMessage || 'Unable to parse activity input.', activities: [] }),
      };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ activities }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
