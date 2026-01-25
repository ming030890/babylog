import { SignJWT, importPKCS8 } from 'jose';

const formatEnv = (value) => value?.replace(/\\n/g, '\n');

export const requireEnv = (name, value) => {
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
};

export const getGeminiApiKey = () => requireEnv('GEMINI_API_KEY', process.env.GEMINI_API_KEY);

export const getServiceAccount = () => ({
  clientEmail: requireEnv('SERVICE_ACCOUNT_EMAIL', process.env.SERVICE_ACCOUNT_EMAIL),
  privateKey: requireEnv('SERVICE_ACCOUNT_PRIVATE_KEY', formatEnv(process.env.SERVICE_ACCOUNT_PRIVATE_KEY)),
});

export const getAccessToken = async () => {
  const { clientEmail, privateKey } = getServiceAccount();
  const alg = 'RS256';
  const signingKey = await importPKCS8(privateKey, alg);
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime('1h')
    .sign(signingKey);

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
  return data.access_token;
};
