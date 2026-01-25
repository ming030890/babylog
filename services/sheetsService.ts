import { SheetConfig, ActivityLog } from '../types';

const CHECK_URL = '/.netlify/functions/sheets-check';
const FETCH_URL = '/.netlify/functions/sheets-fetch';
const APPEND_URL = '/.netlify/functions/sheets-append';

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    return data?.error || fallback;
  } catch {
    try {
      const text = await response.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
};

export const initGoogleServices = async (
  config: SheetConfig, 
  onInit: () => void
) => {
  try {
    const response = await fetch(CHECK_URL, { method: 'POST' });
    if (!response.ok) {
      const message = await readErrorMessage(response, 'Failed to initialize Google Services.');
      throw new Error(message);
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
      const message = await readErrorMessage(response, response.statusText);
      throw new Error(message);
    }

    return await response.json();
  } catch (err) {
    console.error("Error fetching activities:", err);
    throw err;
  }
};

export const appendActivity = async (spreadsheetId: string, activity: ActivityLog): Promise<void> => {
  try {
    const response = await fetch(APPEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, activity }),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response, response.statusText);
      throw new Error(message);
    }
  } catch (err) {
    console.error("Error appending activity:", err);
    throw err;
  }
};
