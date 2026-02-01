import { getDb } from './_shared/db.js';
import { parseJsonBody, validateActivityId, validateActivityPayload } from './_shared/activityValidation.js';

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
    const { id, activity } = data || {};
    const idError = validateActivityId(id);
    if (idError) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: idError }) };
    }
    const activityError = validateActivityPayload(activity);
    if (activityError) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: activityError }) };
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
