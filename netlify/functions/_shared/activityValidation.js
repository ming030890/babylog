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
  return null;
};

export const validateActivityId = (id) => {
  if (!id) {
    return 'Missing activity id';
  }
  return null;
};
