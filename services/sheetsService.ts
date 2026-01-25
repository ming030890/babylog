import { SheetConfig, ActivityLog } from '../types';

const CHECK_URL = '/.netlify/functions/sheets-check';
const FETCH_URL = '/.netlify/functions/sheets-fetch';
const APPEND_URL = '/.netlify/functions/sheets-append';
const DELETE_URL = '/.netlify/functions/sheets-delete';
const UPDATE_URL = '/.netlify/functions/sheets-update';

export const initGoogleServices = async (
  config: SheetConfig, 
  onInit: () => void
) => {
  try {
    const response = await fetch(CHECK_URL, { method: 'POST' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initialize Google Services.');
    }
    onInit();
  } catch (error) {
    console.error("Error initializing Google Service Account:", error);
    // We re-throw here so the UI can show the specific error (e.g. missing env vars)
    throw error;
  }
};

export const fetchActivities = async (spreadsheetId: string): Promise<ActivityLog[]> => {
  try {
    const response = await fetch(FETCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }

    return await response.json();
  } catch (err) {
    console.error("Error fetching activities:", err);
    throw err;
  }
};

export const appendActivity = async (spreadsheetId: string, activity: ActivityLog): Promise<string | null> => {
  try {
    const response = await fetch(APPEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, activity }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }
    const result = await response.json();
    return typeof result?.id === 'string' ? result.id : null;
  } catch (err) {
    console.error("Error appending activity:", err);
    throw err;
  }
};

export const deleteActivity = async (spreadsheetId: string, id: string): Promise<void> => {
  try {
    const response = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }
  } catch (err) {
    console.error("Error deleting activity:", err);
    throw err;
  }
};

export const updateActivity = async (spreadsheetId: string, id: string, activity: ActivityLog): Promise<void> => {
  try {
    const response = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, id, activity }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }
  } catch (err) {
    console.error("Error updating activity:", err);
    throw err;
  }
};
