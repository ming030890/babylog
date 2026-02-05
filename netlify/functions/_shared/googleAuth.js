export const requireEnv = (name, value) => {
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
};

export const getGeminiApiKey = () => requireEnv('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
