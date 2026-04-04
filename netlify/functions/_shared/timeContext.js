const DEFAULT_TIME_ZONE = process.env.FAMLY_TZ || 'Europe/London';

const getTimeZoneContext = (timeZone = DEFAULT_TIME_ZONE) => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  });

  const parts = formatter.formatToParts(now);
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const offset = (map.timeZoneName || 'UTC').replace('GMT', 'UTC');
  const isoLikeLocal = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${offset.replace('UTC', '') || 'Z'}`;

  return {
    nowUtcIso: now.toISOString(),
    nowLocalIso: isoLikeLocal,
    timeZone,
  };
};

export { getTimeZoneContext };
