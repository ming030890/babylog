import { getDb } from './_shared/db.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { id, activity } = JSON.parse(event.body || '{}');
    if (!id) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing activity id' }) };
    }
    if (!activity?.timestamp || !activity?.eventType) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing activity data' }) };
    }

    const sql = getDb();
    await sql`
      UPDATE activity_logs
      SET "timestamp" = ${activity.timestamp},
          event_type = ${activity.eventType},
          value = ${activity.value ?? ''},
          original_input = ${activity.originalInput ?? null},
          updated_at = now()
      WHERE id = ${id}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
