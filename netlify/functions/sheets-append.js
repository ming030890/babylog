import { getAccessToken } from './_shared/googleAuth.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { spreadsheetId, activity } = JSON.parse(event.body || '{}');
    if (!spreadsheetId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing spreadsheetId' }) };
    }
    if (!activity?.timestamp || !activity?.eventType) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing activity data' }) };
    }

    const token = await getAccessToken();
    const range = 'Sheet1!A:C';
    const body = {
      values: [[activity.timestamp, activity.eventType, activity.value || '']],
    };

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Append error: ${error.error?.message || response.statusText}`);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
