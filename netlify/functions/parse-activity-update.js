import { GEMINI_ENDPOINT, parseStructuredJson, defaultGenerationConfig } from './_shared/geminiJson.js';
import { getGeminiApiKey } from './_shared/googleAuth.js';
import { getTimeZoneContext } from './_shared/timeContext.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
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
    const { nowUtcIso, nowLocalIso, timeZone } = getTimeZoneContext();
    const knownList = Array.isArray(knownTypes) ? knownTypes : [];

    const prompt = `
      Current System Time (UTC): ${nowUtcIso}
      Current System Time (Configured Local): ${nowLocalIso}
      Configured Time Zone: ${timeZone}
      Known Event Types: ${knownList.join(', ')}

      Existing Activity (do not lose details unless the instruction says to change them):
      ${JSON.stringify(existing)}

      Update Instruction: "${instruction}"

      Task: Update the existing activity using the instruction, returning a single activity object.

      Rules:
      1. Only change fields implied by the instruction. Otherwise keep existing values.
      2. Output scope:
         - Only output JSON for the updated row.
         - Do not include any schema changes or database instructions.
      3. Timestamp:
         - If the instruction includes a time (e.g., "16:30"), combine it with the Current System Date.
         - Use the Configured Time Zone for any date/time interpretation.
         - If no time is provided, keep the existing timestamp.
         - Always return ISO 8601 with an explicit timezone offset or Z.
      4. Event Type:
         - Try to reuse one of the "Known Event Types" if semantically similar.
         - Otherwise keep or create a concise label using the user's casing.
         - The event_type is displayed to the user, so keep it human-friendly.
      5. Value:
         - Extract updated details like amount, duration, or notes.
         - If the event type is "feed_ml", store only the numeric amount without units (e.g., "160").
         - If the instruction is too vague to update, return an error message and no activity.
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
          ...defaultGenerationConfig,
          responseJsonSchema: {
            type: 'object',
            properties: {
              activity: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', description: 'ISO 8601 timestamp' },
                  event_type: { type: 'string', description: 'Category of the event' },
                  value: { type: 'string', description: 'Quantity, duration, or notes' },
                },
                required: ['timestamp', 'event_type', 'value'],
              },
              error: { type: 'string', description: 'Error message when input is invalid' },
            },
            required: [],
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
    const { data: parsed, error, details } = parseStructuredJson(responseData);
    if (!parsed) {
      return {
        statusCode: 502,
        headers: jsonHeaders,
        body: JSON.stringify({ error: error || 'Failed to parse JSON from Gemini', details }),
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
