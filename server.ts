import express from 'express';
import { createServer as createViteServer } from 'vite';
import { pool, initDb } from './src/db';
import { Project, Site } from './src/types';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const FRAMES_DIR = path.join(process.cwd(), 'public', 'frames');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = /video\/(mp4|webm|ogg|quicktime|x-msvideo|x-matroska)/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

function generateNodes(tourId: string, folderPath: string) {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png')).sort();
  const nodes: any[] = [];
  let currentLat = 28.6139;
  let currentLng = 77.2090;

  if (files.length === 0) {
    console.warn('WARNING: No PNG files found in ' + folderPath);
    return [];
  }

  for (let i = 0; i < files.length; i++) {
    const nodeId = `node_${i}`;
    currentLat += 0.0001;
    currentLng += 0.0001;

    const node: any = {
      id: nodeId,
      panorama: `/frames/${tourId}/${files[i]}`,
      name: `Frame ${i + 1}`,
      gps: [currentLng, currentLat],
      links: [],
    };

    if (i > 0) node.links.push({ nodeId: `node_${i - 1}` });
    if (i < files.length - 1) node.links.push({ nodeId: `node_${i + 1}` });

    nodes.push(node);
  }

  fs.writeFileSync(path.join(folderPath, 'nodes.json'), JSON.stringify(nodes, null, 2));
  return nodes;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Serve extracted frames statically
  app.use('/frames', express.static(FRAMES_DIR));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // --- Video Upload Endpoint ---
  app.post('/api/upload-video', upload.single('video'), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });

    const videoPath = req.file.path;
    const tourId = path.parse(req.file.filename).name;
    const outputFolder = path.join(FRAMES_DIR, tourId);

    fs.mkdirSync(outputFolder, { recursive: true });

    console.log(`Processing video: ${tourId}... Extracting PNG frames...`);

    ffmpeg(videoPath)
      .outputOptions(['-vf', 'fps=1'])
      .output(path.join(outputFolder, 'frame_%04d.png'))
      .on('end', () => {
        console.log('Frames extracted! Generating tour nodes...');
        const nodes = generateNodes(tourId, outputFolder);
        // Clean up the uploaded video to save space
        try { fs.unlinkSync(videoPath); } catch (_) { }
        res.json({ success: true, tourId, nodes });
      })
      .on('error', (err: any) => {
        console.error('ffmpeg error:', err);
        res.status(500).json({ error: 'Error processing video. Make sure ffmpeg is installed.' });
      })
      .run();
  });

  // API Routes
  app.get('/api/projects', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
      const projects = await Promise.all(result.rows.map(async (project) => {
        const sitesResult = await pool.query('SELECT * FROM sites WHERE project_id = $1', [project.id]);
        return {
          ...project,
          createdAt: parseInt(project.created_at),
          sites: sitesResult.rows.map(site => {
            // SQLite returns strings for JSON columns
            const points = typeof site.points === 'string' ? JSON.parse(site.points) : site.points;
            const metrics = typeof site.metrics === 'string' ? JSON.parse(site.metrics) : site.metrics;
            const dailyProgress = typeof site.daily_progress === 'string' ? JSON.parse(site.daily_progress) : site.daily_progress;

            return {
              ...site,
              createdAt: parseInt(site.created_at),
              points,
              metrics,
              isClosed: !!site.is_closed,
              customTileUrl: site.custom_tile_url,
              contractorCommitmentPerDay: site.contractor_commitment_per_day ? parseFloat(site.contractor_commitment_per_day) : undefined,
              dailyProgress: dailyProgress || []
            };
          })
        };
      }));
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    const { name, description, createdAt } = req.body;
    const id = uuidv4();
    try {
      await pool.query(
        'INSERT INTO projects (id, name, description, created_at) VALUES ($1, $2, $3, $4)',
        [id, name, description, createdAt]
      );
      res.json({ id, name, description, createdAt, sites: [] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.post('/api/projects/:id/sites', async (req, res) => {
    const { id: projectId } = req.params;
    const { name, createdAt, points, metrics, isClosed, customTileUrl, contractorCommitmentPerDay, dailyProgress } = req.body;
    const siteId = uuidv4();
    try {
      await pool.query(
        'INSERT INTO sites (id, project_id, name, created_at, points, metrics, is_closed, custom_tile_url, contractor_commitment_per_day, daily_progress) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [siteId, projectId, name, createdAt, JSON.stringify(points), JSON.stringify(metrics), isClosed ? 1 : 0, customTileUrl, contractorCommitmentPerDay, JSON.stringify(dailyProgress || [])]
      );
      res.json({
        id: siteId,
        projectId,
        name,
        createdAt,
        points,
        metrics,
        isClosed,
        customTileUrl,
        contractorCommitmentPerDay,
        dailyProgress: dailyProgress || []
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create site' });
    }
  });

  app.put('/api/sites/:id', async (req, res) => {
    const { id } = req.params;
    const { points, metrics, isClosed, customTileUrl, contractorCommitmentPerDay, dailyProgress } = req.body;
    try {
      const result = await pool.query(
        'UPDATE sites SET points = $1, metrics = $2, is_closed = $3, custom_tile_url = $4, contractor_commitment_per_day = $5, daily_progress = $6 WHERE id = $7 RETURNING *',
        [JSON.stringify(points), JSON.stringify(metrics), isClosed ? 1 : 0, customTileUrl, contractorCommitmentPerDay, JSON.stringify(dailyProgress || []), id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Site not found' });
      }
      const site = result.rows[0];
      res.json({
        ...site,
        createdAt: parseInt(site.created_at),
        points: typeof site.points === 'string' ? JSON.parse(site.points) : site.points,
        metrics: typeof site.metrics === 'string' ? JSON.parse(site.metrics) : site.metrics,
        isClosed: !!site.is_closed,
        customTileUrl: site.custom_tile_url,
        contractorCommitmentPerDay: site.contractor_commitment_per_day ? parseFloat(site.contractor_commitment_per_day) : undefined,
        dailyProgress: typeof site.daily_progress === 'string' ? JSON.parse(site.daily_progress) : site.daily_progress
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update site' });
    }
  });

  // Always initialize SQLite for demo
  await initDb();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist/
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
