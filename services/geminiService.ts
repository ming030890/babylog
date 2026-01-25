import { ParsedActivity, ParsedActivityResult } from '../types';

const FUNCTION_URL = '/.netlify/functions/parse-activity';

export const parseActivityText = async (
  text: string, 
  knownTypes: string[]
): Promise<ParsedActivityResult> => {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, knownTypes }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to parse activity.');
  }

  const result = await response.json();
  if (!result?.activities?.length) {
    throw new Error(result?.error || 'No activities detected in that entry.');
  }

  return result;
};

export const parseActivityUpdate = async (
  instruction: string,
  existing: ParsedActivity,
  knownTypes: string[]
): Promise<ParsedActivity> => {
  const response = await fetch(`${FUNCTION_URL}-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, existing, knownTypes }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to parse update.');
  }

  const result = await response.json();
  if (!result?.activity) {
    throw new Error(result?.error || 'No update detected in that entry.');
  }

  return result.activity;
};
