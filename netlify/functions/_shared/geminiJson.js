export const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

export const parseStructuredJson = (responseData) => {
  const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText || typeof responseText !== 'string') {
    return { error: 'Empty response from Gemini' };
  }

  // Sometimes the model wraps JSON in markdown fences despite responseMimeType.
  const normalizedText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return { data: JSON.parse(normalizedText) };
  } catch (parseError) {
    return { error: 'Failed to parse JSON from Gemini', details: parseError.message };
  }
};

export const defaultGenerationConfig = {
  temperature: 0,
  topP: 0.1,
  maxOutputTokens: 256,
  responseMimeType: 'application/json',
};
