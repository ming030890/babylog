import { getDb } from './_shared/db.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { id } = JSON.parse(event.body || '{}');
    if (!id) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing activity id' }) };
    }

    const sql = getDb();
    await sql`DELETE FROM activity_logs WHERE id = ${id}`;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
