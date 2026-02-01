import { getDb } from './_shared/db.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { activity } = JSON.parse(event.body || '{}');
    if (!activity?.timestamp || !activity?.eventType) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing activity data' }) };
    }

    const sql = getDb();
    const [row] = await sql`
      INSERT INTO activity_logs ("timestamp", event_type, value, original_input)
      VALUES (${activity.timestamp}, ${activity.eventType}, ${activity.value ?? ''}, ${activity.originalInput ?? null})
      RETURNING id
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, id: row?.id ?? null }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
