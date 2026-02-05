import { ActivityLog } from '../types';

const CHECK_URL = '/.netlify/functions/db-check';
const FETCH_URL = '/.netlify/functions/db-fetch';
const APPEND_URL = '/.netlify/functions/db-append';
const DELETE_URL = '/.netlify/functions/db-delete';
const UPDATE_URL = '/.netlify/functions/db-update';

export const initDatabaseServices = async (onInit: () => void) => {
  try {
    const response = await fetch(CHECK_URL, { method: 'POST' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initialize database.');
    }
    onInit();
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const fetchActivities = async (): Promise<ActivityLog[]> => {
  try {
    const response = await fetch(FETCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }

    return await response.json();
  } catch (err) {
    console.error('Error fetching activities:', err);
    throw err;
  }
};

export const appendActivity = async (activity: ActivityLog): Promise<string | null> => {
  try {
    const response = await fetch(APPEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }
    const result = await response.json();
    return typeof result?.id === 'string' ? result.id : null;
  } catch (err) {
    console.error('Error appending activity:', err);
    throw err;
  }
};

export const deleteActivity = async (id: string): Promise<void> => {
  try {
    const response = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }
  } catch (err) {
    console.error('Error deleting activity:', err);
    throw err;
  }
};

export const updateActivity = async (id: string, activity: ActivityLog): Promise<void> => {
  try {
    const response = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activity }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }
  } catch (err) {
    console.error('Error updating activity:', err);
    throw err;
  }
};
