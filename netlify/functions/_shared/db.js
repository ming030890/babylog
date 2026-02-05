import { neon } from '@neondatabase/serverless';

let sqlClient;

const resolveConnectionString = () =>
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;

export const getDb = () => {
  if (!sqlClient) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new Error('Missing NETLIFY_DATABASE_URL (or NETLIFY_DATABASE_URL_UNPOOLED) environment variable.');
    }
    sqlClient = neon(connectionString);
  }

  return sqlClient;
};
