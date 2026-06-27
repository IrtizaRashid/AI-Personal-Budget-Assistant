// Centralised environment-variable loading.
// Importing this module first guarantees process.env is populated
// before any other module (e.g. the database pool) reads from it.
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5001,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
};

export default config;
