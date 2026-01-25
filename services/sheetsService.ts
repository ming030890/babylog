import { SheetConfig, ActivityLog } from '../types';
import * as jose from 'jose';

// In Netlify, set these environment variables in Site Settings > Build & Deploy > Environment
// SERVICE_ACCOUNT_EMAIL
// SERVICE_ACCOUNT_PRIVATE_KEY
const SERVICE_ACCOUNT = {
  client_email: process.env.SERVICE_ACCOUNT_EMAIL || "",
  // Handle newlines in private key which can be escaped in some env var UIs
  private_key: (process.env.SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
};

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT.client_email || !SERVICE_ACCOUNT.private_key) {
    throw new Error("Missing Service Account Credentials. Please set SERVICE_ACCOUNT_EMAIL and SERVICE_ACCOUNT_PRIVATE_KEY environment variables.");
  }

  const now = Math.floor(Date.now() / 1000);
  
  // Return cached token if still valid (with 5 min buffer)
  if (accessToken && now < tokenExpiry - 300) {
    return accessToken;
  }

  const alg = 'RS256';
  const privateKey = await jose.importPKCS8(SERVICE_ACCOUNT.private_key, alg);

  const jwt = await new jose.SignJWT({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(SERVICE_ACCOUNT.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime('1h')
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get access token: ${error.error_description || error.error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = now + data.expires_in;
  return accessToken!;
}

export const initGoogleServices = async (
  config: SheetConfig, 
  onInit: () => void
) => {
  try {
    await getAccessToken();
    onInit();
  } catch (error) {
    console.error("Error initializing Google Service Account:", error);
    // We re-throw here so the UI can show the specific error (e.g. missing env vars)
    throw error;
  }
};

export const fetchActivities = async (spreadsheetId: string): Promise<ActivityLog[]> => {
  const token = await getAccessToken();
  const range = 'Sheet1!A:C';
  
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Fetch error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values;
    
    if (!rows || rows.length === 0) return [];

    const startIndex = (rows[0][0] === 'Timestamp' || rows[0][0] === 'day') ? 1 : 0;

    const logs: ActivityLog[] = rows.slice(startIndex).map((row: any[]) => ({
      timestamp: row[0],
      eventType: row[1] || 'Unknown',
      value: row[2] || '',
    })).filter((log: ActivityLog) => log.timestamp);

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.error("Error fetching activities:", err);
    throw err;
  }
};

export const appendActivity = async (spreadsheetId: string, activity: ActivityLog): Promise<void> => {
  const token = await getAccessToken();
  const range = 'Sheet1!A:C';
  
  const body = {
    values: [[activity.timestamp, activity.eventType, activity.value]],
  };

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Append error: ${error.error?.message || response.statusText}`);
    }
  } catch (err) {
    console.error("Error appending activity:", err);
    throw err;
  }
};