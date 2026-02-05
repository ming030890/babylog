export const parseJsonBody = (body) => {
  if (!body) {
    return { data: {}, error: null };
  }

  try {
    return { data: JSON.parse(body), error: null };
  } catch (error) {
    return { data: null, error: 'Invalid JSON body.' };
  }
};

export const validateActivityPayload = (activity) => {
  if (!activity?.timestamp || !activity?.eventType) {
    return 'Missing activity data';
  }
  if (typeof activity.timestamp !== 'string') {
    return 'Activity timestamp must be a string';
  }
  const parsedTimestamp = new Date(activity.timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return 'Activity timestamp must be a valid ISO date string';
  }
  if (typeof activity.eventType !== 'string' || !activity.eventType.trim()) {
    return 'Activity event type must be a non-empty string';
  }
  if (activity.value != null && typeof activity.value !== 'string') {
    return 'Activity value must be a string';
  }
  return null;
};

export const validateActivityId = (id) => {
  if (!id) {
    return 'Missing activity id';
  }
  return null;
};
