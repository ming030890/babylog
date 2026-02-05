import { getDb } from './_shared/db.js';
import { parseJsonBody, validateActivityId } from './_shared/activityValidation.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { data, error } = parseJsonBody(event.body);
    if (error) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error }) };
    }
    const { id } = data || {};
    const idError = validateActivityId(id);
    if (idError) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: idError }) };
    }

    const sql = getDb();
    await sql`DELETE FROM activity_logs WHERE id = ${id}`;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) };
  }
};
