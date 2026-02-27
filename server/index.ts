import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { JsonFileStorage } from './storage.js';
import { SSEManager } from './sse.js';
import { analyzeTranscription } from './gemini.js';
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

// Analyze a call with Gemini
app.post('/api/calls/:id/analyze', async (req, res) => {
  try {
    const call = await storage.getCall(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    const { callType, customContext } = req.body || {};

    // Build transcript text from Voicenter transcript sentences
    let transcriptText = '';
    if (call.aiData?.transcript && call.aiData.transcript.length > 0) {
      transcriptText = call.aiData.transcript
        .map(s => `${s.speaker}: ${s.text}`)
        .join('\n');
    }

    if (!transcriptText.trim()) {
      res.status(400).json({ error: 'No transcript available for this call' });
      return;
    }

    // Build context from call metadata
    const autoContext = [
      call.caller ? `מתקשר: ${call.caller}` : '',
      call.target ? `יעד: ${call.target}` : '',
      call.representative_name ? `נציג: ${call.representative_name}` : '',
      call.queuename ? `מעגל: ${call.queuename}` : '',
      call.duration ? `משך: ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '',
    ].filter(Boolean).join(' | ');

    // Merge auto-detected context with user-provided custom context
    const context = [autoContext, customContext].filter(Boolean).join('\n');

    console.log(`[Analyze] Starting analysis for call ${req.params.id} (type: ${callType || 'general'})`);

    const analysis = await analyzeTranscription(transcriptText, context, callType);

    // Save analysis back to the call
    call.geminiAnalysis = analysis;
    await storage.saveCall(call);

    // Broadcast update so list refreshes
    sse.broadcast('update-call', {
      ivruniqueid: call.ivruniqueid,
      hasAnalysis: true,
    });

    console.log(`[Analyze] Done for ${req.params.id}`);
    res.json(analysis);
  } catch (err: any) {
    console.error('[Analyze] Error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
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
