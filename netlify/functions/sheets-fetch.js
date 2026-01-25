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
    const range = 'Sheet1!A:D';
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

    const header = rows[0] || [];
    const hasHeader = header[0]?.toLowerCase?.() === 'id' || header[0] === 'Timestamp' || header[0] === 'day';
    const startIndex = hasHeader ? 1 : 0;
    const logs = rows
      .slice(startIndex)
      .map((row) => ({
        id: row[0],
        timestamp: normalizeTimestamp(row[1]),
        eventType: row[2] || 'Unknown',
        value: row[3] || '',
      }))
      .filter((log) => log.timestamp);

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(logs) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

const normalizeTimestamp = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return excelSerialToIso(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return excelSerialToIso(Number(trimmed));
    }
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
      ? trimmed.replace(' ', 'T')
      : trimmed;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
};

const excelSerialToIso = (serial) => {
  if (!Number.isFinite(serial)) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const ms = excelEpoch + serial * 86400000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
