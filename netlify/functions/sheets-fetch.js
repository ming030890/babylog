import { getAccessToken } from './_shared/googleAuth.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { spreadsheetId } = JSON.parse(event.body || '{}');
    if (!spreadsheetId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing spreadsheetId' }) };
    }

    const token = await getAccessToken();
    const range = 'Sheet1!A:C';
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Fetch error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values;
    if (!rows || rows.length === 0) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify([]) };
    }

    const startIndex = rows[0][0] === 'Timestamp' || rows[0][0] === 'day' ? 1 : 0;
    const logs = rows
      .slice(startIndex)
      .map((row) => ({
        timestamp: row[0],
        eventType: row[1] || 'Unknown',
        value: row[2] || '',
      }))
      .filter((log) => log.timestamp);

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(logs) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
