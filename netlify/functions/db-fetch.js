import { getDb } from './_shared/db.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const toIsoString = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, "timestamp", event_type, value, original_input
      FROM activity_logs
      ORDER BY "timestamp" DESC
    `;

    const logs = rows
      .map((row) => ({
        id: row.id,
        timestamp: toIsoString(row.timestamp),
        eventType: row.event_type || 'Unknown',
        value: row.value ?? '',
        originalInput: row.original_input ?? undefined,
      }))
      .filter((log) => log.timestamp);

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(logs) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
