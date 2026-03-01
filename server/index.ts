import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { JsonFileStorage } from './storage.js';
import { SSEManager } from './sse.js';
import { analyzeTranscription, askAboutCall, semanticSearch } from './gemini.js';
import type { VoicenterCall } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data', 'calls');

const storage = new JsonFileStorage(DATA_DIR);
const sse = new SSEManager();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ============================================================
// Firebase Auth Middleware
// ============================================================

const ALLOWED_DOMAIN = '@drushim.il';
const ALLOWED_EMAILS_SERVER = ['eyalbch@gmail.com'];

// In-memory token cache to avoid verifying on every request
const tokenCache = new Map<string, { email: string; exp: number }>();

function isEmailAllowed(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith(ALLOWED_DOMAIN) || ALLOWED_EMAILS_SERVER.includes(lower);
}

async function verifyFirebaseToken(token: string): Promise<string | null> {
  // Return cached result if still valid
  const cached = tokenCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.email;

  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    // No key configured — allow in dev so the server still works locally
    console.warn('[Auth] FIREBASE_API_KEY not set — auth skipped');
    return 'dev@drushim.il';
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    );
    if (!resp.ok) return null;

    const data = await resp.json() as { users?: { email?: string }[] };
    const email = data.users?.[0]?.email;
    if (!email) return null;

    // Cache for 55 min (tokens last 1 hour)
    tokenCache.set(token, { email, exp: Date.now() + 55 * 60 * 1000 });
    return email;
  } catch {
    return null;
  }
}

// Auth guard — applies to all /api/* routes except the webhook
app.use(async (req, res, next) => {
  // Only guard API routes
  if (!req.path.startsWith('/api')) return next();

  // Voicenter webhook has no auth header — always allow
  if (req.path === '/api/webhook/voicenter') return next();

  // SSE: EventSource can't set headers, so token comes as query param
  let token: string;
  if (req.path === '/api/calls/stream') {
    token = (req.query.token as string) || '';
  } else {
    const authHeader = req.headers.authorization || '';
    token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const email = await verifyFirebaseToken(token);
  if (!email || !isEmailAllowed(email)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
});

// ============================================================
// SSE Endpoint
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

    const listItem = await storage.saveCall(call);
    sse.broadcast('new-call', listItem);
    res.json({ err: 0, errdesc: 'OK' });

    // F1: Auto-analyze if call has transcript and no existing analysis
    const hasTranscript = !!(call.aiData?.transcript && call.aiData.transcript.length > 0);
    if (hasTranscript && !call.geminiAnalysis) {
      setImmediate(async () => {
        try {
          console.log(`[Auto-analyze] Starting for ${call.ivruniqueid}...`);
          const transcriptText = call.aiData!.transcript!
            .map(s => `${s.speaker}: ${s.text}`)
            .join('\n');

          const autoContext = [
            call.caller ? `מתקשר: ${call.caller}` : '',
            call.representative_name ? `נציג: ${call.representative_name}` : '',
            call.queuename ? `מעגל: ${call.queuename}` : '',
            call.duration ? `משך: ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '',
          ].filter(Boolean).join(' | ');

          // Detect call type from context
          const callType = call.direction === 'outgoing' ? 'follow_up' : 'new_prospect';

          const analysis = await analyzeTranscription(transcriptText, autoContext, callType);
          call.geminiAnalysis = analysis;
          const updatedItem = await storage.saveCall(call);
          sse.broadcast('update-call', { ivruniqueid: call.ivruniqueid, hasAnalysis: true, ...updatedItem });
          console.log(`[Auto-analyze] Done for ${call.ivruniqueid}`);
        } catch (err) {
          console.error(`[Auto-analyze] Error for ${call.ivruniqueid}:`, err);
        }
      });
    }
  } catch (err) {
    console.error('[Webhook] Error processing call:', err);
    res.json({ err: 0, errdesc: 'OK' });
  }
});

// ============================================================
// REST API: Calls
// ============================================================

// List calls
app.get('/api/calls', async (req, res) => {
  try {
    const result = await storage.listCalls({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      search: req.query.search as string,
      direction: req.query.direction as string,
      status: req.query.status as string,
      starred: req.query.starred === 'true' ? true : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',').filter(Boolean) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error('[API] Error listing calls:', err);
    res.status(500).json({ error: 'Failed to list calls' });
  }
});

// Get single call
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

    const autoContext = [
      call.caller ? `מתקשר: ${call.caller}` : '',
      call.target ? `יעד: ${call.target}` : '',
      call.representative_name ? `נציג: ${call.representative_name}` : '',
      call.queuename ? `מעגל: ${call.queuename}` : '',
      call.duration ? `משך: ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '',
    ].filter(Boolean).join(' | ');

    const context = [autoContext, customContext].filter(Boolean).join('\n');

    console.log(`[Analyze] Starting for ${req.params.id} (type: ${callType || 'general'})`);
    const analysis = await analyzeTranscription(transcriptText, context, callType);

    call.geminiAnalysis = analysis;
    await storage.saveCall(call);

    sse.broadcast('update-call', { ivruniqueid: call.ivruniqueid, hasAnalysis: true });

    console.log(`[Analyze] Done for ${req.params.id}`);
    res.json(analysis);
  } catch (err: any) {
    console.error('[Analyze] Error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// F9: Ask Gemini about a call
app.post('/api/calls/:id/ask', async (req, res) => {
  try {
    const call = await storage.getCall(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    const { question } = req.body || {};
    if (!question?.trim()) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const transcript = call.aiData?.transcript;
    if (!transcript || transcript.length === 0) {
      res.status(400).json({ error: 'No transcript available' });
      return;
    }

    const transcriptText = transcript.map(s => `${s.speaker}: ${s.text}`).join('\n');
    const context = [
      call.caller ? `מתקשר: ${call.caller}` : '',
      call.representative_name ? `נציג: ${call.representative_name}` : '',
    ].filter(Boolean).join(' | ');

    const answer = await askAboutCall(transcriptText, question, context);
    res.json({ answer });
  } catch (err: any) {
    console.error('[Ask] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to answer' });
  }
});

// F7: Star/unstar a call
app.patch('/api/calls/:id/star', async (req, res) => {
  try {
    const { starred } = req.body;
    if (typeof starred !== 'boolean') {
      res.status(400).json({ error: 'starred (boolean) is required' });
      return;
    }

    const listItem = await storage.starCall(req.params.id, starred);
    if (!listItem) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    sse.broadcast('update-call', { ivruniqueid: req.params.id, starred });
    res.json(listItem);
  } catch (err) {
    console.error('[Star] Error:', err);
    res.status(500).json({ error: 'Failed to star call' });
  }
});

// F6: Full-text search in transcripts
app.get('/api/search/transcripts', async (req, res) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json({ calls: [] });
      return;
    }

    const allIndexed = storage.getAllIndexed();
    const results = [];

    for (const item of allIndexed) {
      if (!item.hasAI) continue; // skip calls without AI data
      const call = await storage.getCall(item.ivruniqueid);
      if (!call?.aiData?.transcript) continue;

      const qLower = q.toLowerCase();
      const found = call.aiData.transcript.some(s =>
        s.text.toLowerCase().includes(qLower)
      );
      if (found) results.push(item);
    }

    res.json({ calls: results });
  } catch (err) {
    console.error('[Search] Error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// F8: AI semantic search
app.post('/api/search/ai', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query?.trim()) {
      res.json({ calls: [] });
      return;
    }

    const allIndexed = storage.getAllIndexed();

    // Build searchable text for each call that has analysis
    const callsWithText = allIndexed
      .filter(c => c.summary || c.crmNote || c.representative_name)
      .map(c => ({
        id: c.ivruniqueid,
        text: [
          c.summary,
          c.crmNote,
          c.representative_name,
          c.caller,
          c.queuename,
        ].filter(Boolean).join(' | '),
      }));

    if (callsWithText.length === 0) {
      res.json({ calls: [] });
      return;
    }

    const matches = await semanticSearch(query, callsWithText);
    const matchedIds = matches.map(m => m.id);
    const matchingCalls = allIndexed
      .filter(c => matchedIds.includes(c.ivruniqueid))
      .map(c => ({
        ...c,
        aiHighlight: matches.find(m => m.id === c.ivruniqueid)?.reason,
      }));

    res.json({ calls: matchingCalls });
  } catch (err: any) {
    console.error('[AI Search] Error:', err);
    res.status(500).json({ error: err.message || 'AI search failed' });
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
    sse.broadcast('delete-call', { ivruniqueid: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error deleting call:', err);
    res.status(500).json({ error: 'Failed to delete call' });
  }
});

// ============================================================
// Production: Serve frontend
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
