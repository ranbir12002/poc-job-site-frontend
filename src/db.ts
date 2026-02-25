import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Mock pool to minimize changes in server.ts
export const pool = {
  query: (text: string, params: any[] = []) => {
    // Convert $1, $2, etc. to ? for better-sqlite3 compatibility
    const sqliteSql = text.replace(/\$(\d+)/g, '?');

    try {
      if (text.trim().toLowerCase().startsWith('select')) {
        const rows = db.prepare(sqliteSql).all(...params);
        return { rows };
      } else {
        const info = db.prepare(sqliteSql).run(...params);
        // For INSERT RETURNING *, we need to fetch the record separately in SQLite if RETURNING is not supported or different
        // better-sqlite3 doesn't support RETURNING * in some versions or needs specific handling.
        // Actually, better-sqlite3 supports RETURNING in newer versions. Let's try it.
        // If it fails, we might need to handle it.
        if (text.includes('RETURNING')) {
          const rows = db.prepare(sqliteSql).all(...params);
          return { rows };
        }
        return { rows: [], lastInsertRowid: info.lastInsertRowid };
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },
  connect: async () => ({
    query: (text: string, params: any[] = []) => pool.query(text, params),
    release: () => { },
  }),
};

export async function initDb() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        points TEXT NOT NULL DEFAULT '[]',
        metrics TEXT NOT NULL DEFAULT '{}',
        is_closed INTEGER DEFAULT 1,
        custom_tile_url TEXT,
        contractor_commitment_per_day REAL,
        daily_progress TEXT NOT NULL DEFAULT '[]'
      );
    `);
    console.log('SQLite database initialized successfully');
  } catch (err) {
    console.error('Error initializing SQLite database:', err);
  }
}

