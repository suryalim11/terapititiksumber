import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

// Configure neon to use fetch polyfill
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// For @neondatabase/serverless
const sql = neon(process.env.DATABASE_URL);
// Pass in the database schema and SQL client
const db = drizzle(sql as any, { schema });

export { db, sql };