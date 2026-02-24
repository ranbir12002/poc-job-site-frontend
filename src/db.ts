import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Default to a dummy connection string if not provided, just to allow the app to start
// In a real scenario, this would fail or use a local dev DB
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/glass_mapper';

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper to initialize the database schema
export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        points JSONB NOT NULL DEFAULT '[]',
        metrics JSONB NOT NULL DEFAULT '{}',
        is_closed BOOLEAN DEFAULT TRUE,
        custom_tile_url TEXT,
        contractor_commitment_per_day NUMERIC,
        daily_progress JSONB NOT NULL DEFAULT '[]'
      );

      -- Add columns if they don't exist (for existing DBs)
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_tile_url TEXT;
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS contractor_commitment_per_day NUMERIC;
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS daily_progress JSONB NOT NULL DEFAULT '[]';
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}
