import { GoogleGenAI, Type } from '@google/genai/node';
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
    const { instruction, existing, knownTypes } = JSON.parse(event.body || '{}');
    if (!instruction) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing instruction' }) };
    }
    if (!existing?.timestamp || !existing?.event_type) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing existing activity' }) };
    }

    const apiKey = getGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const dateContext = now.toISOString();
    const knownList = Array.isArray(knownTypes) ? knownTypes : [];

    const prompt = `
      Current System Time: ${dateContext}
      Known Event Types: ${knownList.join(', ')}

      Existing Activity (do not lose details unless the instruction says to change them):
      ${JSON.stringify(existing)}

      Update Instruction: "${instruction}"

      Task: Update the existing activity using the instruction, returning a single activity object.

      Rules:
      1. Only change fields implied by the instruction. Otherwise keep existing values.
      2. Output scope:
         - Only output JSON for the updated row.
         - Do not include any schema changes or spreadsheet instructions.
      3. Timestamp:
         - If the instruction includes a time (e.g., "16:30"), combine it with the Current System Date.
         - If no time is provided, keep the existing timestamp.
         - Return as ISO 8601 string.
      4. Event Type:
         - Try to reuse one of the "Known Event Types" if semantically similar.
         - Otherwise keep or create a concise, lowercase label.
      5. Value:
         - Extract updated details like amount, duration, or notes.
         - If the event type is "feed_ml", store only the numeric amount without units (e.g., "160").
         - If the instruction is too vague to update, return an error message and no activity.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            activity: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING, description: 'ISO 8601 timestamp' },
                event_type: { type: Type.STRING, description: 'Category of the event' },
                value: { type: Type.STRING, description: 'Quantity, duration, or notes' },
              },
              required: ['timestamp', 'event_type', 'value'],
            },
            error: { type: Type.STRING, description: 'Error message when input is invalid' },
          },
          required: [],
        },
      },
    });

    const resultText = response.text;
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

    if (!parsed?.activity) {
      return {
        statusCode: 422,
        headers: jsonHeaders,
        body: JSON.stringify({ error: parsed?.error || 'Unable to parse update instruction.' }),
      };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ activity: parsed.activity }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
