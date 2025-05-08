import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Create a Neon client with the DATABASE_URL
const sql = neon(process.env.DATABASE_URL);
// Pass in the database schema and SQL client
const db = drizzle(sql, { schema });

// Create PostgreSQL Pool for session storage
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export { db, sql, pool };