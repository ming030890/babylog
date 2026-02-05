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
    const body = event.body ? JSON.parse(event.body) : {};
    const hasPaging = body?.before || body?.days;
    const pageDays = Number.isFinite(body?.days) ? Number(body.days) : 14;
    const endDate = body?.before ? new Date(body.before) : new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - pageDays);

    const rows = hasPaging
      ? await sql`
          SELECT id, "timestamp", event_type, value, original_input
          FROM activity_logs
          WHERE "timestamp" < ${endDate} AND "timestamp" >= ${startDate}
          ORDER BY "timestamp" DESC
        `
      : await sql`
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

    if (!hasPaging) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ logs, hasMore: false, nextCursor: null }) };
    }

    const olderRows = await sql`
      SELECT id
      FROM activity_logs
      WHERE "timestamp" < ${startDate}
      LIMIT 1
    `;

    const hasMore = olderRows.length > 0;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        logs,
        hasMore,
        nextCursor: toIsoString(startDate)
      })
    };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
