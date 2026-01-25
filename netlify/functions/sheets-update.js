import { getAccessToken } from './_shared/googleAuth.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { spreadsheetId, id, activity } = JSON.parse(event.body || '{}');
    if (!spreadsheetId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing spreadsheetId' }) };
    }
    if (!id) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing id' }) };
    }
    if (!activity?.timestamp || !activity?.eventType) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing activity data' }) };
    }

    const token = await getAccessToken();
    const rowIndex = await findRowIndexById(spreadsheetId, token, id);
    const rowNumber = rowIndex + 1;
    const range = `Sheet1!A${rowNumber}:D${rowNumber}`;
    const body = {
      values: [[id, activity.timestamp, activity.eventType, activity.value || '']],
    };

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Update error: ${error.error?.message || response.statusText}`);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

const findRowIndexById = async (spreadsheetId, token, id) => {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`,
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
  const rows = data.values || [];
  const startIndex = rows[0]?.[0]?.toLowerCase?.() === 'id' ? 1 : 0;
  const rowOffset = rows.slice(startIndex).findIndex((row) => row[0] === id);
  if (rowOffset === -1) {
    throw new Error('Unable to locate activity row.');
  }
  return startIndex + rowOffset;
};
