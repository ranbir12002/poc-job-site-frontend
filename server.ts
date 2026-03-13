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
const SCANS_DIR = path.join(process.cwd(), 'public', 'scans');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });
if (!fs.existsSync(SCANS_DIR)) fs.mkdirSync(SCANS_DIR, { recursive: true });

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

interface GpsPoint {
  lat: number;
  lng: number;
  t: number;
}

interface ExtractionPoint {
  time: number;
  lat: number;
  lng: number;
  nodeId: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getExtractionPoints(gpsTrack: GpsPoint[], intervalMeters = 5, idPrefix = 'node'): ExtractionPoint[] {
  if (!gpsTrack || gpsTrack.length === 0) return [];
  
  const points: ExtractionPoint[] = [];
  let nodeIndex = 0;

  // Always include the first point
  points.push({
    time: gpsTrack[0].t,
    lat: gpsTrack[0].lat,
    lng: gpsTrack[0].lng,
    nodeId: `${idPrefix}_${nodeIndex++}`
  });

  let lastPoint = gpsTrack[0];
  let remainingDistToNextNode = intervalMeters;

  for (let i = 1; i < gpsTrack.length; i++) {
    const p2 = gpsTrack[i];
    let dist = calculateDistance(lastPoint.lat, lastPoint.lng, p2.lat, p2.lng);

    while (dist >= remainingDistToNextNode) {
      const ratio = remainingDistToNextNode / dist;
      const interpT = lastPoint.t + (p2.t - lastPoint.t) * ratio;
      const interpLat = lastPoint.lat + (p2.lat - lastPoint.lat) * ratio;
      const interpLng = lastPoint.lng + (p2.lng - lastPoint.lng) * ratio;

      const newPoint = { lat: interpLat, lng: interpLng, t: interpT };
      points.push({
        time: interpT,
        lat: interpLat,
        lng: interpLng,
        nodeId: `node_${nodeIndex++}`
      });

      lastPoint = newPoint;
      dist = calculateDistance(lastPoint.lat, lastPoint.lng, p2.lat, p2.lng);
      remainingDistToNextNode = intervalMeters;
    }
    
    remainingDistToNextNode -= dist;
    lastPoint = p2;
  }

  return points;
}

function generateNodes(tourId: string, folderPath: string) {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png')).sort();
  const nodes: any[] = [];
  let currentLat = 25.7617;
  let currentLng = -80.1918;

  if (files.length === 0) {
    console.warn('WARNING: No PNG files found in ' + folderPath);
    return [];
  }

  for (let i = 0; i < files.length; i++) {
    const nodeId = `${tourId}_node_${i}`;
    currentLat += 0.0001;
    currentLng += 0.0001;

    const node: any = {
      id: nodeId,
      panorama: `/frames/${tourId}/${files[i]}`,
      name: `Frame ${i + 1}`,
      gps: [currentLng, currentLat],
      links: [],
    };

    if (i > 0) node.links.push({ nodeId: `${tourId}_node_${i - 1}` });
    if (i < files.length - 1) node.links.push({ nodeId: `${tourId}_node_${i + 1}` });

    nodes.push(node);
  }

  fs.writeFileSync(path.join(folderPath, 'nodes.json'), JSON.stringify(nodes, null, 2));
  return nodes;
}



async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve extracted frames and scans statically
  app.use('/frames', express.static(FRAMES_DIR));
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/scans', express.static(SCANS_DIR));

  // --- 3D Scan Upload Endpoint ---
  const scanStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, SCANS_DIR),
    filename: (_req: any, file: any, cb: any) => cb(null, Date.now() + '_' + file.originalname),
  });
  const scanUpload = multer({
    storage: scanStorage,
    fileFilter: (_req: any, file: any, cb: any) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.ply', '.obj', '.glb', '.usdz'].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only PLY, OBJ, GLB, and USDZ files are allowed'));
      }
    },
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB max
  } as any);

  app.post('/api/upload-scan', scanUpload.single('scan'), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: 'No scan file uploaded.' });

    const scanId = req.file.filename ? path.parse(req.file.filename).name : `scan-${Date.now()}`;
    const fileUrl = `/scans/${req.file.filename || req.file.originalname}`;
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '') as any;

    console.log(`3D scan uploaded: ${req.file.filename}`);

    // Return basic metadata — the Three.js viewer will extract detailed info client-side
    res.json({
      success: true,
      scan: {
        id: scanId,
        filename: req.file.originalname,
        format: ext,
        fileUrl,
        vertexCount: 0,
        boundingBox: { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 },
        depthRange: { min: 0, max: 0 },
        createdAt: Date.now(),
      }
    });
  });

  // --- Video Upload Endpoint ---
  app.post('/api/upload-video', upload.single('video'), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });

    const videoPath = req.file.path;
    const tourId = req.file.filename ? path.parse(req.file.filename).name : `tour-${Date.now()}`;
    const outputFolder = path.join(FRAMES_DIR, tourId);
    
    let gpsTrack: GpsPoint[] = [];
    const { orientation } = req.body;
    try {
      if (req.body.gpsTrack) {
        gpsTrack = JSON.parse(req.body.gpsTrack);
        // Sometimes t is not exactly 0. Normalize it relative to first point if needed.
        if (gpsTrack.length > 0 && gpsTrack[0].t !== 0) {
          const t0 = gpsTrack[0].t;
          gpsTrack.forEach(p => p.t = p.t - t0);
        }
      }
    } catch (e) {
      console.error("Failed to parse gpsTrack");
    }

    fs.mkdirSync(outputFolder, { recursive: true });

    if (gpsTrack && gpsTrack.length > 0) {
      console.log(`Processing video with GPS track: ${tourId}... Extracting accurate points...`);
      const extractionPoints = getExtractionPoints(gpsTrack, 5, tourId); // Use tourId as prefix
      const tempFolder = path.join(FRAMES_DIR, `${tourId}_temp`);
      fs.mkdirSync(tempFolder, { recursive: true });

      const FPS = 4; // Extract 4 frames per second for intermediate extraction
      
      const videoFilters = [
        `fps=${FPS}`,
        'format=yuv420p' // Ensure consistent pixel format
      ];

      if (orientation === 'landscape') {
        // Landscape videos from phones often arrive as vertical frames
        // Apply 90-degree anti-clockwise rotation to fix them
        videoFilters.push('transpose=2');
      } else if (orientation === 'portrait') {
        // Portrait videos that need clockwise rotation
        videoFilters.push('transpose=1');
      }

      ffmpeg(videoPath)
        .videoFilters(videoFilters)
        .output(path.join(tempFolder, 'frame_%04d.png'))
        .on('end', () => {
          console.log('High-res frames extracted! Matching with 5m GPS points...');
          const nodes: any[] = [];
          
          extractionPoints.forEach((pt, i) => {
            // Match target time to exact frame index (FFmpeg puts first frame at nearly t=0 but 1-indexed)
            let frameIndex = Math.max(1, Math.round(pt.time * FPS));
            
            let frameName = `frame_${String(frameIndex).padStart(4, '0')}.png`;
            if (!fs.existsSync(path.join(tempFolder, frameName))) {
               const files = fs.readdirSync(tempFolder).filter(f => f.endsWith('.png')).sort();
               if (files.length > 0) {
                 if (frameIndex > files.length) frameIndex = files.length;
                 frameName = files[frameIndex - 1]; // fallback
               }
            }

            if (fs.existsSync(path.join(tempFolder, frameName))) {
               const finalName = `node_${i}.png`;
               fs.copyFileSync(path.join(tempFolder, frameName), path.join(outputFolder, finalName));
               
               const node: any = {
                 id: pt.nodeId,
                 panorama: `/frames/${tourId}/${finalName}`,
                 name: `Frame ${i + 1}`,
                 gps: [pt.lng, pt.lat] as [number, number],
                 links: []
               };

               nodes.push(node);
            }
          });

          // Post-process links to ensure we only link to nodes that were successfully added
          nodes.forEach((node, i) => {
            node.links = [];
            if (i > 0) node.links.push({ nodeId: nodes[i - 1].id });
            if (i < nodes.length - 1) node.links.push({ nodeId: nodes[i + 1].id });
          });

          fs.writeFileSync(path.join(outputFolder, 'nodes.json'), JSON.stringify(nodes, null, 2));
          
          // Cleanup
          try { 
            fs.rmSync(tempFolder, { recursive: true, force: true });
            fs.unlinkSync(videoPath); 
          } catch (_) {}

          res.json({ success: true, tourId, nodes });
        })
        .on('error', (err: any) => {
          console.error('ffmpeg error:', err);
          res.status(500).json({ error: 'Error processing video.' });
        })
        .run();
    } else {
      console.log(`Processing video: ${tourId}... Orientation: ${orientation}... Extracting PNG frames (mock coords)...`);

      const fallbackFilters = [
        'fps=1',
        'format=yuv420p'
      ];

      if (orientation === 'landscape') {
        fallbackFilters.push('transpose=2'); // 90° anti-clockwise
      } else if (orientation === 'portrait') {
        fallbackFilters.push('transpose=1'); // 90° clockwise
      }

      ffmpeg(videoPath)
        .videoFilters(fallbackFilters)
        .output(path.join(outputFolder, 'frame_%04d.png'))
        .on('end', () => {
          console.log('Frames extracted! Generating tour nodes...');
          const nodes = generateNodes(tourId, outputFolder);
          try { fs.unlinkSync(videoPath); } catch (_) { }
          res.json({ success: true, tourId, nodes });
        })
        .on('error', (err: any) => {
          console.error('ffmpeg error:', err);
          res.status(500).json({ error: 'Error processing video.' });
        })
        .run();
    }
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
            const recordings = typeof site.recordings === 'string' ? JSON.parse(site.recordings) : site.recordings;

            return {
              ...site,
              createdAt: parseInt(site.created_at),
              points,
              metrics,
              isClosed: !!site.is_closed,
              customTileUrl: site.custom_tile_url,
              contractorCommitmentPerDay: site.contractor_commitment_per_day ? parseFloat(site.contractor_commitment_per_day) : undefined,
              dailyProgress: dailyProgress || [],
              pathThickness: site.path_thickness ? parseFloat(site.path_thickness) : 0,
              approved: !!site.approved,
              recordings: recordings || []
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
    const { name, createdAt, points, metrics, isClosed, customTileUrl, contractorCommitmentPerDay, dailyProgress, pathThickness, approved, recordings } = req.body;
    const siteId = uuidv4();
    try {
      await pool.query(
        'INSERT INTO sites (id, project_id, name, created_at, points, metrics, is_closed, custom_tile_url, contractor_commitment_per_day, daily_progress, path_thickness, approved, recordings) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        [siteId, projectId, name, createdAt, JSON.stringify(points), JSON.stringify(metrics), isClosed ? 1 : 0, customTileUrl, contractorCommitmentPerDay, JSON.stringify(dailyProgress || []), pathThickness || 0, approved ? 1 : 0, JSON.stringify(recordings || [])]
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
        dailyProgress: dailyProgress || [],
        pathThickness: pathThickness || 0,
        approved: !!approved,
        recordings: recordings || []
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create site' });
    }
  });

  app.put('/api/sites/:id', async (req, res) => {
    const { id } = req.params;
    const { points, metrics, isClosed, customTileUrl, contractorCommitmentPerDay, dailyProgress, pathThickness, approved, recordings } = req.body;
    try {
      const result = await pool.query(
        'UPDATE sites SET points = $1, metrics = $2, is_closed = $3, custom_tile_url = $4, contractor_commitment_per_day = $5, daily_progress = $6, path_thickness = $7, approved = $8, recordings = $9 WHERE id = $10 RETURNING *',
        [JSON.stringify(points), JSON.stringify(metrics), isClosed ? 1 : 0, customTileUrl, contractorCommitmentPerDay, JSON.stringify(dailyProgress || []), pathThickness || 0, approved ? 1 : 0, JSON.stringify(recordings || []), id]
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
        dailyProgress: typeof site.daily_progress === 'string' ? JSON.parse(site.daily_progress) : site.daily_progress,
        pathThickness: site.path_thickness ? parseFloat(site.path_thickness) : 0,
        approved: !!site.approved,
        recordings: typeof site.recordings === 'string' ? JSON.parse(site.recordings) : site.recordings
      });
    } catch (err) {
      console.error('Error updating site:', err);
      res.status(500).json({ error: 'Failed to update site' });
    }
  });

  // Delete a project (cascades to sites via DB schema)
  app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM projects WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // Delete a site
  app.delete('/api/sites/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM sites WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete site' });
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
    // Support client-side routing for SPA
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
