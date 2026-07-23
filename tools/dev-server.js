#!/usr/bin/env node
/**
 * dev-server.js — Lightweight dev server for Game Studio
 *
 * Serves static files + handles save endpoints so editors
 * can write changes directly back to disk.
 *
 * Usage: node tools/dev-server.js [--port=3456]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '3456');
const TRAINER_PORT = PORT + 1; // trainer runs on next port

// ── Trainer child process management ────────────────────────────────────
let trainerProcess = null;
let trainerStatus = { running: false, generation: 0, maxGenerations: 0, bestScore: 0, history: [], log: ['Click Start to begin evolution'], breakdown: {}, mapWidth: 36, mapHeight: 24 };

function startTrainer() {
  if (trainerProcess) return;
  const args = [
    '--max-old-space-size=8192', '--expose-gc',
    path.join(ROOT, 'tools', 'map-trainer', 'v2', 'v2-server.js'),
    '--target=99', '--max-gens=2000', '--pop=20', '--port=' + TRAINER_PORT
  ];
  console.log('Starting trainer on port', TRAINER_PORT);
  trainerProcess = spawn('node', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  trainerProcess.stdout.on('data', d => {
    const lines = d.toString().split('\n').filter(l => l.trim());
    for (const line of lines) console.log('[trainer]', line);
  });
  trainerProcess.stderr.on('data', d => console.error('[trainer-err]', d.toString()));
  trainerProcess.on('exit', (code) => {
    console.log('Trainer exited with code', code);
    trainerProcess = null;
    trainerStatus.running = false;
    trainerStatus.log.push('Trainer process exited');
  });
}

// Proxy trainer API — fetch from trainer subprocess
async function proxyTrainer(reqUrl) {
  try {
    return new Promise((resolve, reject) => {
      const r = http.get('http://127.0.0.1:' + TRAINER_PORT + reqUrl, { timeout: 2000 }, (resp) => {
        const chunks = [];
        resp.setEncoding('binary');
        resp.on('data', chunk => chunks.push(chunk));
        resp.on('end', () => resolve({ status: resp.statusCode, data: chunks.join(''), contentType: resp.headers['content-type'] }));
      });
      r.on('error', () => resolve(null));
      r.on('timeout', () => { r.destroy(); resolve(null); });
    });
  } catch (e) {
    return null;
  }
}

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// Writable paths (relative to ROOT) — only these can be saved to.
// NOTE: level files are intentionally NOT in this list. The map trainer
// should write to its own results folder; transitions and quest data are
// hand-authored and must not be overwritten by the trainer.
const WRITABLE = [
  'sprites/sprite-anims.json',
  'tools/map-trainer/v2/painted-map.json',
  'tools/map-trainer/v2/tile-tags.json',
  'tools/map-trainer/v2/flagged-tiles.json',
  'tools/map-trainer/v2/annotations.json',
  'tools/map-trainer/v2/learned-knowledge-v2.json',
];

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // POST /api/save — write a file back to disk
  if (req.method === 'POST' && req.url === '/api/save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, content } = JSON.parse(body);
        if (!file || content === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing file or content' }));
          return;
        }
        // Security: only allow whitelisted paths
        const normalized = path.normalize(file).replace(/\\/g, '/');
        if (!WRITABLE.includes(normalized)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not in writable list: ' + normalized }));
          return;
        }
        const fullPath = path.join(ROOT, normalized);
        // Backup before overwriting
        if (fs.existsSync(fullPath)) {
          const backup = fullPath + '.bak';
          fs.copyFileSync(fullPath, backup);
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Saved:', normalized, '(' + content.length + ' bytes)');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: normalized, bytes: content.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── API endpoints that the editor tools expect ─────────────────────────
  const V2 = path.join(ROOT, 'tools', 'map-trainer', 'v2');
  const url = req.url.split('?')[0];

  // GET endpoints — serve JSON files directly
  const API_FILES = {
    '/api/painted-map':   path.join(V2, 'painted-map.json'),
    '/api/tile-tags':     path.join(V2, 'tile-tags.json'),
    '/api/custom-tiles':  path.join(V2, 'custom-tiles.json'),
    '/api/flagged-tiles': path.join(V2, 'flagged-tiles.json'),
    '/api/tile-catalog':  path.join(ROOT, 'tools', 'tile-catalog.json'),
    '/api/annotations':   path.join(V2, 'annotations.json'),
    '/api/status':        null, // trainer-specific, return idle status
    '/api/best-map-data': null,
  };

  // GET /api/best-map — proxy PNG from trainer
  if (req.method === 'GET' && url === '/api/best-map') {
    if (trainerProcess) {
      const r = await proxyTrainer('/api/best-map');
      if (r && r.status === 200) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(Buffer.from(r.data, 'binary')); return; }
    }
    res.writeHead(404); res.end('No map yet'); return;
  }

  if (req.method === 'GET' && API_FILES.hasOwnProperty(url)) {
    const filePath = API_FILES[url];
    if (url === '/api/status') {
      // Proxy to trainer if running
      if (trainerProcess) {
        const r = await proxyTrainer('/api/status');
        if (r) { res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(r.data); return; }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(trainerStatus));
      return;
    }
    if (url === '/api/best-map-data') {
      if (trainerProcess) {
        const r = await proxyTrainer('/api/best-map-data');
        if (r) { res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(r.data); return; }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ width: 0, height: 0, ground: [], objects: [], foreground: [] }));
      return;
    }
    if (filePath && fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
    return;
  }

  // POST endpoints — save JSON data to files
  const API_SAVE_MAP = {
    '/api/painted-map':   path.join(V2, 'painted-map.json'),
    '/api/tile-tags':     path.join(V2, 'tile-tags.json'),
    '/api/custom-tiles':  path.join(V2, 'custom-tiles.json'),
    '/api/flagged-tiles': path.join(V2, 'flagged-tiles.json'),
    '/api/annotations':   path.join(V2, 'annotations.json'),
  };

  if (req.method === 'POST' && API_SAVE_MAP[url]) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const target = API_SAVE_MAP[url];
      if (fs.existsSync(target)) fs.copyFileSync(target, target + '.bak');
      fs.writeFileSync(target, body, 'utf8');
      console.log('Saved:', url, '(' + body.length + ' bytes)');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // GET /tilemap — serve the tileset PNG
  if (url === '/tilemap') {
    const tileset = path.join(ROOT, 'sprites', 'town', 'tilemap_packed.png');
    if (fs.existsSync(tileset)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(tileset).pipe(res);
    } else {
      res.writeHead(404); res.end('Tileset not found');
    }
    return;
  }

  // GET /reference — serve the js13k-level1 rendered town as target reference
  if (url === '/reference') {
    const refs = [
      path.join(V2, 'js13k-level1-render.png'),
      path.join(V2, 'painted-reference.png'),
    ];
    const ref = refs.find(r => fs.existsSync(r));
    if (ref) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(ref).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // POST /api/learn — re-scan all training maps and rebuild knowledge
  if (req.method === 'POST' && url === '/api/learn') {
    try {
      const { V2Learner } = require(path.join(V2, 'v2-learner'));
      const learner = new V2Learner();
      learner.loadFromFile(path.join(V2, 'learned-knowledge-v2.json'));
      const before = learner.getStats();

      // Learn from all available maps
      const mapFiles = [
        { file: path.join(V2, 'painted-map.json'), weight: 100, name: 'painted-map' },
        ...Array.from({length: 8}, (_, i) => ({ file: path.join(V2, `js13k-level${i+1}.json`), weight: 50, name: `js13k-level${i+1}` })),
      ];
      const learned = [];
      for (const m of mapFiles) {
        if (fs.existsSync(m.file)) {
          const map = JSON.parse(fs.readFileSync(m.file, 'utf8'));
          learner.learnFromTarget(map);
          learned.push(m.name + ' (' + map.width + 'x' + map.height + ')');
        }
      }
      learner.saveToFile(path.join(V2, 'learned-knowledge-v2.json'));
      const after = learner.getStats();
      console.log('Re-learned from', learned.length, 'maps:', before.rules, '→', after.rules, 'rules');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, before: before.rules, after: after.rules, maps: learned }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Trainer start/stop — spawn the actual trainer server as child process
  if (req.method === 'POST' && url === '/api/start') {
    if (!trainerProcess) {
      startTrainer();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, note: 'Trainer started' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, note: 'Trainer already running' }));
    }
    return;
  }
  if (req.method === 'POST' && url === '/api/stop') {
    if (trainerProcess) {
      trainerProcess.kill();
      trainerProcess = null;
      trainerStatus = { running: false, generation: trainerStatus.generation, maxGenerations: 0, bestScore: trainerStatus.bestScore, history: trainerStatus.history, log: [...trainerStatus.log, 'Stopped by user'], breakdown: trainerStatus.breakdown };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Static file serving
  let filePath = path.join(ROOT, decodeURIComponent(url));
  if (filePath.endsWith(path.sep) || filePath === ROOT) filePath = path.join(filePath, 'index.html');

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Game Studio dev server: http://localhost:${PORT}/tools/studio.html`);
  console.log(`Serving from: ${ROOT}`);
  console.log(`Writable files: ${WRITABLE.length}`);
});
