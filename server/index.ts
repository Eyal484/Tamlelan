import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { JsonFileStorage } from './storage.js';
import { SSEManager } from './sse.js';
import type { VoicenterCall } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data', 'calls');

// Initialize storage and SSE
const storage = new JsonFileStorage(DATA_DIR);
const sse = new SSEManager();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Voicenter payloads with AI data can be large
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ============================================================
// SSE Endpoint — must be before other /api/calls routes
// ============================================================

app.get('/api/calls/stream', (req, res) => {
  sse.addClient(res);
});

// ============================================================
// Webhook: Voicenter sends call data here
// ============================================================

app.post('/api/webhook/voicenter', async (req, res) => {
  try {
    const call = req.body as VoicenterCall;

    if (!call || !call.ivruniqueid) {
      console.warn('[Webhook] Received payload without ivruniqueid');
      res.json({ err: 1, errdesc: 'Missing ivruniqueid' });
      return;
    }

    console.log(`[Webhook] Received call: ${call.ivruniqueid} | ${call.type} | ${call.status} | ${call.caller} -> ${call.target}`);

    // Save to storage
    const listItem = await storage.saveCall(call);

    // Broadcast to SSE clients
    sse.broadcast('new-call', listItem);

    // Respond with success (Voicenter expects this)
    res.json({ err: 0, errdesc: 'OK' });
  } catch (err) {
    console.error('[Webhook] Error processing call:', err);
    // Still respond with success to prevent Voicenter retries for server errors
    // Log the error for debugging
    res.json({ err: 0, errdesc: 'OK' });
  }
});

// ============================================================
// REST API: Calls
// ============================================================

// List calls (paginated, filterable)
app.get('/api/calls', async (req, res) => {
  try {
    const result = await storage.listCalls({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      search: req.query.search as string,
      direction: req.query.direction as string,
      status: req.query.status as string,
    });
    res.json(result);
  } catch (err) {
    console.error('[API] Error listing calls:', err);
    res.status(500).json({ error: 'Failed to list calls' });
  }
});

// Get single call detail
app.get('/api/calls/:id', async (req, res) => {
  try {
    const call = await storage.getCall(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }
    res.json(call);
  } catch (err) {
    console.error('[API] Error getting call:', err);
    res.status(500).json({ error: 'Failed to get call' });
  }
});

// Delete a call
app.delete('/api/calls/:id', async (req, res) => {
  try {
    const deleted = await storage.deleteCall(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }
    // Broadcast deletion to SSE clients
    sse.broadcast('delete-call', { ivruniqueid: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error deleting call:', err);
    res.status(500).json({ error: 'Failed to delete call' });
  }
});

// ============================================================
// Production: Serve frontend static files
// ============================================================

const distPath = path.join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================
// Start server
// ============================================================

async function start() {
  await storage.initialize();

  app.listen(PORT, () => {
    console.log(`\n  Tamlelan Server running on http://localhost:${PORT}`);
    console.log(`  Webhook URL: http://localhost:${PORT}/api/webhook/voicenter`);
    console.log(`  API: http://localhost:${PORT}/api/calls`);
    console.log(`  SSE: http://localhost:${PORT}/api/calls/stream\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
