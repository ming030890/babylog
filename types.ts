export interface ActivityLog {
  timestamp: string; // ISO String
  eventType: string;
  value: string;
  originalInput?: string;
  id?: string;
}

export enum AppState {
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface ParsedActivity {
  timestamp: string;
  event_type: string;
  value: string;
}

export interface ParsedActivityResult {
  activities: ParsedActivity[];
  error?: string;
}
