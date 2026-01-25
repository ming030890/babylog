import { getAccessToken } from './_shared/googleAuth.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const fetchSheetId = async (spreadsheetId, sheetName, token) => {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Sheet lookup error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const sheets = data.sheets || [];
  const target = sheets.find((sheet) => sheet.properties?.title === sheetName) || sheets[0];
  if (!target?.properties?.sheetId && target?.properties?.sheetId !== 0) {
    throw new Error('Unable to locate sheet ID.');
  }
  return target.properties.sheetId;
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { spreadsheetId, id } = JSON.parse(event.body || '{}');
    if (!spreadsheetId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing spreadsheetId' }) };
    }
    if (!id) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing id' }) };
    }

    const token = await getAccessToken();
    const sheetId = await fetchSheetId(spreadsheetId, 'Sheet1', token);
    const rowIndex = await findRowIndexById(spreadsheetId, token, id);

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Delete error: ${error.error?.message || response.statusText}`);
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
