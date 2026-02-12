import { getDb } from './_shared/db.js';

const FAMLY_EMAIL = (process.env.FAMLY_EMAIL || '').trim();
const FAMLY_PASSWORD = (process.env.FAMLY_PASSWORD || '').trim();
const FAMLY_CHILD_ID = process.env.FAMLY_CHILD_ID || '';
const FAMLY_TZ = process.env.FAMLY_TZ || 'Europe/London';
const FAMLY_MILK_UNIT = (process.env.FAMLY_MILK_UNIT || 'oz').toLowerCase();

const GRAPHQL_URL = 'https://familyapp.brighthorizons.co.uk/graphql?Authenticate';
const CALENDAR_URL = 'https://familyapp.brighthorizons.co.uk/api/v2/calendar';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/143 Safari/537.36';

const X_FAMLY_INSTALLATION_ID =
  process.env.FAMLY_INSTALLATION_ID || 'b82c03b2-6aa0-408d-80b5-3a3282c47980';
const X_FAMLY_PLATFORM = process.env.FAMLY_PLATFORM || 'docker';
const X_FAMLY_VERSION = process.env.FAMLY_VERSION || '2f2a26761a';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const config = {
  schedule: '0 18 * * 1-5',
};

const buildBaseHeaders = () => ({
  accept: '*/*',
  'content-type': 'application/json',
  'user-agent': USER_AGENT,
  origin: 'https://familyapp.brighthorizons.co.uk',
  referer: 'https://familyapp.brighthorizons.co.uk/',
  'x-famly-installationid': X_FAMLY_INSTALLATION_ID,
  'x-famly-platform': X_FAMLY_PLATFORM,
  'x-famly-version': X_FAMLY_VERSION,
});

const authenticate = async () => {
  const query = `
mutation Authenticate($email: EmailAddress!, $password: Password!, $deviceId: DeviceId, $legacy: Boolean) {
  me {
    authenticateWithPassword(
      email: $email
      password: $password
      deviceId: $deviceId
      legacy: $legacy
    ) {
      ...AuthenticationResult
      __typename
    }
    __typename
  }
}

fragment AuthenticationResult on AuthenticationResult {
  status
  __typename
  ... on AuthenticationFailed {
    status
    errorDetails
    errorTitle
    __typename
  }
  ... on AuthenticationSucceeded {
    accessToken
    deviceId
    __typename
  }
  ... on AuthenticationChallenged {
    loginId
    deviceId
    expiresAt
    __typename
  }
}
`.trim();

  const payload = {
    operationName: 'Authenticate',
    variables: {
      email: FAMLY_EMAIL,
      password: FAMLY_PASSWORD,
      deviceId: null,
      legacy: false,
    },
    query,
  };

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { ...buildBaseHeaders(), 'x-famly-route': '/login' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Famly auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const auth = data?.data?.me?.authenticateWithPassword ?? {};
  if (auth.status !== 'Succeeded') {
    throw new Error(`Authentication failed: status=${auth.status}`);
  }
  if (!auth.accessToken) {
    throw new Error('Authentication did not return an accessToken.');
  }

  return auth.accessToken;
};

const fetchCalendar = async (accessToken, day, toDay, childId) => {
  const url = new URL(CALENDAR_URL);
  url.searchParams.set('type', 'RANGE');
  url.searchParams.set('day', day);
  url.searchParams.set('to', toDay);
  url.searchParams.set('childId', childId);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...buildBaseHeaders(),
      'x-famly-accesstoken': accessToken,
      'x-famly-route': '/calendar',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Calendar fetch failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected calendar response format.');
  }
  return data;
};

const isoDateInTimeZone = (timeZone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date for timeZone: ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
};

const normalizeDateInput = (input, timeZone) => {
  if (!input) {
    return { day: isoDateInTimeZone(timeZone) };
  }

  const trimmed = String(input).trim();
  if (!trimmed) {
    return { day: isoDateInTimeZone(timeZone) };
  }

  if (DATE_ONLY_REGEX.test(trimmed)) {
    return { day: trimmed };
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    return {
      error:
        'Invalid date override. Use YYYY-MM-DD (preferred) or a valid ISO datetime (e.g. 2026-02-11T09:30:00Z).',
    };
  }

  return { day: isoDateInTimeZone(timeZone, parsedDate) };
};

const unitAmountToMl = (unitAmount) => {
  if (unitAmount == null) return null;
  const value = Number(unitAmount);
  if (Number.isNaN(value)) return null;
  if (FAMLY_MILK_UNIT === 'ml') {
    return Math.round(value);
  }
  return Math.round(value * 29.5735);
};

const findDay = (periods, dayLocalDate) => {
  for (const period of periods) {
    for (const day of period?.days ?? []) {
      if (day?.day_localdate === dayLocalDate) {
        return day;
      }
    }
  }
  return null;
};

const extractEvents = (dayObj) => {
  const bmEvents = [];
  const milkEvents = [];

  for (const event of dayObj?.events ?? []) {
    const embed = event?.embed ?? {};
    const title = (event?.title || '').toLowerCase();
    const timestamp = event?.from;

    if (embed?.actionType === 'DIAPERCHANGE') {
      const diaperingType = (embed?.diaperingType || '').toUpperCase();
      if (diaperingType.includes('BM')) {
        bmEvents.push({
          timestamp,
          eventType: 'diaper_bm',
          value: embed?.note || diaperingType || '',
          sourceId: event?.id || event?.eventId || null,
        });
      }
    }

    if (embed?.type === 'mealRegistration') {
      const mealItems = embed?.mealItems ?? [];
      const hasMilk = mealItems.some((item) => {
        const foodTitle = (item?.foodItem?.title || '').toLowerCase();
        return foodTitle.includes('milk') || title.includes('bottle');
      });

      if (!hasMilk) continue;

      for (const item of mealItems) {
        const ml = unitAmountToMl(item?.unitAmount);
        if (ml == null) continue;
        milkEvents.push({
          timestamp,
          eventType: 'feed_ml',
          value: String(ml),
          sourceId: event?.id || event?.eventId || null,
        });
      }
    }
  }

  return { bmEvents, milkEvents };
};

const buildOriginalInput = (eventType, event) => {
  if (event?.sourceId) {
    return `famly:${event.sourceId}`;
  }
  return `famly:${eventType}:${event.timestamp}:${event.value ?? ''}`;
};

const insertIfMissing = async (sql, activity) => {
  const value = activity.value ?? '';
  const originalInput = buildOriginalInput(activity.eventType, activity);
  const [row] = await sql`
    INSERT INTO activity_logs ("timestamp", event_type, value, original_input)
    SELECT ${activity.timestamp}, ${activity.eventType}, ${value}, ${originalInput}
    WHERE NOT EXISTS (
      SELECT 1
      FROM activity_logs
      WHERE "timestamp" = ${activity.timestamp}
        AND event_type = ${activity.eventType}
        AND value = ${value}
        AND original_input = ${originalInput}
    )
    RETURNING id
  `;
  return row?.id ?? null;
};

export const handler = async (event) => {
  try {
    if (!FAMLY_EMAIL || !FAMLY_PASSWORD || !FAMLY_CHILD_ID) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Missing FAMLY_EMAIL, FAMLY_PASSWORD, or FAMLY_CHILD_ID.' }),
      };
    }

    const dateOverride = event?.queryStringParameters?.date;
    const { day: dayStr, error: dateError } = normalizeDateInput(dateOverride, FAMLY_TZ);
    if (dateError) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: dateError }),
      };
    }

    const accessToken = await authenticate();
    const data = await fetchCalendar(accessToken, dayStr, dayStr, FAMLY_CHILD_ID);
    const dayObj = findDay(data, dayStr);
    if (!dayObj) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ error: `No day found for ${dayStr}.` }),
      };
    }

    const { bmEvents, milkEvents } = extractEvents(dayObj);
    const allEvents = [...bmEvents, ...milkEvents].filter((entry) => Boolean(entry.timestamp));

    const sql = getDb();
    const insertedIds = [];
    for (const entry of allEvents) {
      const id = await insertIfMissing(sql, entry);
      if (id) {
        insertedIds.push(id);
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        day: dayStr,
        inserted: insertedIds.length,
        fetched: allEvents.length,
        insertedIds,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};


export const __test = {
  isoDateInTimeZone,
  normalizeDateInput,
};
