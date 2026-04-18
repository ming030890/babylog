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

export const config = {
  schedule: '30 17,18 * * 1-5',
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

const isoDateInTimeZone = (timeZone, date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);

const isLocalTime = (timeZone, expectedHour, expectedMinute = 0, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour === expectedHour && minute === expectedMinute;
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

const getEvents = (dayObj) => {
  for (const key of ['events', 'items', 'activities', 'dayEvents']) {
    if (Array.isArray(dayObj?.[key]) && dayObj[key].length) return dayObj[key];
  }
  return [];
};

const getEmbed = (event) => {
  for (const key of ['embed', 'embedded', 'data', 'payload']) {
    const val = event?.[key];
    if (val && typeof val === 'object') return val;
  }
  return {};
};

const getEventTimestamp = (event) =>
  event?.from || event?.start || event?.startDate || event?.startDateTime || event?.datetime || null;

const getMealItems = (event, embed) => {
  for (const key of ['mealItems', 'items', 'meal_items']) {
    if (Array.isArray(embed?.[key]) && embed[key].length) return embed[key];
    if (Array.isArray(event?.[key]) && event[key].length) return event[key];
  }
  return [];
};

const isBmType = (type) => {
  const normalizedType = (type || '').toUpperCase();
  return (
    normalizedType.includes('BM') ||
    normalizedType.includes('BOWEL') ||
    normalizedType.includes('SOIL') ||
    normalizedType.includes('POO') ||
    normalizedType.includes('DIRTY') ||
    normalizedType.includes('MIXED')
  );
};

const looksLikeMilk = (title, eventTitle, item) => {
  const foodTitle = (title || '').toLowerCase();
  const normalizedEventTitle = (eventTitle || '').toLowerCase();
  return (
    foodTitle.includes('milk') ||
    foodTitle.includes('formula') ||
    foodTitle.includes('breast') ||
    normalizedEventTitle.includes('bottle') ||
    normalizedEventTitle.includes('milk') ||
    normalizedEventTitle.includes('formula') ||
    (item?.unitAmount != null && item?.unit)
  );
};

const extractEvents = (dayObj) => {
  const bmEvents = [];
  const milkEvents = [];

  const events = getEvents(dayObj);

  for (const event of events) {
    const embed = getEmbed(event);
    const title = (event?.title || embed?.title || '').trim();
    const timestamp = getEventTimestamp(event);

    const actionType = (embed?.actionType || embed?.type || '').toUpperCase();

    if (actionType.includes('DIAPER') || actionType.includes('NAPPY') || actionType === 'DIAPERCHANGE') {
      const diaperingType = (embed?.diaperingType || embed?.diaperType || title || '').toUpperCase();
      if (isBmType(diaperingType)) {
        bmEvents.push({
          timestamp,
          eventType: 'diaper_bm',
          value: embed?.note || diaperingType || '',
          sourceId: event?.id || event?.eventId || null,
        });
      }
    }

    const mealType = (embed?.type || embed?.actionType || '').toLowerCase();
    const mealItems = getMealItems(event, embed);
    const isMeal = mealType === 'mealregistration' || mealType === 'meal_registration' || mealItems.length > 0;

    if (isMeal) {
      const hasMilk = mealItems.some((item) => {
        const foodTitle = (item?.foodItem?.title || item?.title || item?.name || '').toLowerCase();
        return looksLikeMilk(foodTitle, title, item);
      });

      if (!hasMilk) continue;

      for (const item of mealItems) {
        const unitAmount = item?.unitAmount ?? item?.amount ?? item?.quantity ?? item?.value ?? null;
        const ml = unitAmountToMl(unitAmount);
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
    if (!dateOverride && !isLocalTime(FAMLY_TZ, 18, 30)) {
      return {
        statusCode: 204,
        headers: jsonHeaders,
        body: JSON.stringify({
          message: `Skipping run outside ${FAMLY_TZ} 18:30 window.`,
        }),
      };
    }
    const dayStr = dateOverride || isoDateInTimeZone(FAMLY_TZ);

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
