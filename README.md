<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tamlelan — AI Sales Call Manager

A full-stack call management platform for B2B recruitment sales teams. Tamlelan receives calls from Voicenter, auto-analyzes transcripts with Gemini AI, and provides a real-time Hebrew-first dashboard for reviewing, searching, and acting on sales conversations.

**Built for**: Drushim.co.il sales team selling recruitment ad packages.

---

## 🏗️ Architecture

```
Voicenter PBX
     │  webhook POST
     ▼
Express Backend (Oracle Cloud VM :3001)
     │  saves JSON · broadcasts SSE
     ▼
React Frontend (served from same process)
     │  Google Sign-In · real-time updates
     ▼
Gemini AI  ←→  analysis · semantic search · Q&A
```

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | Express.js + Node.js 18 |
| AI | Google Gemini 2.0 Flash |
| Auth | Firebase Auth — Google Sign-In |
| Storage | JSON files on disk (one file per call) |
| Realtime | Server-Sent Events (SSE) |
| Deploy | Oracle Cloud VM + GitHub Actions + PM2 |

---

## 🔒 Authentication

Access is restricted to **Google accounts** matching:
- `*@drushim.il`
- `eyalbch@gmail.com`

Sign-in via Google popup → Firebase issues an ID token → backend verifies with Firebase REST API on every request (55-min in-memory cache). The Voicenter webhook is excluded from auth.

---

## 🎯 Features

### Core (F-series)

| ID | Feature | Description |
|----|---------|-------------|
| F1 | Auto-analyze | Calls with transcripts are automatically analyzed by Gemini on webhook receipt |
| F2 | Tag filtering | Filter by detected conversation tags (הצגה עצמית, הצעה נשלחה, מעקב...) |
| F3 | Call detail | Tabbed view: Analysis · Transcript · Insights · Emotions · Metadata |
| F4 | Objection detection | Gemini labels objections: מחיר / תזמון / מתחרה / לא רלוונטי / אישור |
| F5 | Contact thread | Shows how many other calls came from the same number; click to filter |
| F6 | Full-text search | Search inside all transcripts by keyword |
| F7 | Star / bookmark | Star important calls; filter to starred view |
| F8 | AI semantic search | Natural language query → Gemini finds relevant calls + highlights the matching transcript sentence |
| F9 | Ask Gemini | Free-form questions about a specific call answered from its transcript |

### UI Enhancements (U-series)

| ID | Enhancement |
|----|------------|
| U1 | Direction filter: All / Incoming / Outgoing / Starred |
| U2 | Status dots (green=answered, red=abandoned, yellow=no answer) |
| U3 | New call flash highlight (3s cyan ring on arrival) |
| U4 | Human-readable duration & relative timestamps |
| U5 | Rich call row: rep avatar · caller → target · badges · AI reason |
| U6 | Tabbed call detail with fade transition |
| U7 | Rep color avatars (consistent color per rep name) |
| U8 | CSV export (UTF-8 BOM for Excel) |
| U9 | Tab switch fade animation |
| U10 | Back button in header when call detail is open |
| U11 | Skeleton loading rows |
| U12 | Meaningful empty states per filter type |
| U13 | Tag filter chips |
| U14 | Sliding transcript side panel (opens from analysis quotes) |

---

## 📁 Project Structure

```
Tamlelan/
├── App.tsx                    # Auth gate → CallList | CallDetail
├── types.ts                   # Shared TypeScript interfaces
├── .env                       # Public Firebase client config (committed)
├── .env.local                 # Secrets: GEMINI_API_KEY, FIREBASE_API_KEY (gitignored)
│
├── components/
│   ├── CallList.tsx           # Main list with search, filters, SSE, AI search
│   ├── CallDetail.tsx         # Tabbed call detail view
│   ├── LoginScreen.tsx        # Google Sign-In screen
│   ├── AnalysisView.tsx       # Gemini analysis panel + ask Q&A
│   ├── TranscriptView.tsx     # Transcript with emotion colors + AI banner
│   ├── InsightsView.tsx       # AI insights summary
│   ├── EmotionsView.tsx       # Per-sentence emotion chart
│   └── CallMetadata.tsx       # Raw call metadata table
│
├── hooks/
│   ├── useAuth.ts             # Firebase onIdTokenChanged → AuthUser | null
│   └── useSSE.ts              # EventSource with ?token= auth query param
│
├── lib/
│   └── firebase.ts            # Firebase app init + signInWithGoogle
│
├── services/
│   └── api.ts                 # All fetch calls with Bearer token headers
│
└── server/
    ├── index.ts               # Express app: middleware · auth · all routes
    ├── storage.ts             # JSON file read/write + in-memory index
    ├── sse.ts                 # SSE client manager + broadcast
    ├── gemini.ts              # analyzeTranscription · askAboutCall · semanticSearch
    └── types.ts               # Server-side types (VoicenterCall shape)
```

---

## 🚀 Local Development

**Prerequisites**: Node.js 18+, a Gemini API key, a Firebase project

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create `.env.local`** (never committed)
   ```
   GEMINI_API_KEY=your_key_here
   FIREBASE_API_KEY=your_firebase_web_api_key
   ```

3. **Run dev server** (frontend + backend together via concurrently)
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

4. **Send a test webhook**
   ```bash
   curl -X POST http://localhost:3001/api/webhook/voicenter \
     -H "Content-Type: application/json" \
     -d @test-call.json
   ```

---

## 🏭 Production Deployment

**Server**: Oracle Cloud VM — `151.145.90.232:3001`
**Deploy trigger**: Push to `main` branch → GitHub Actions SSH deploy

### GitHub Actions workflow (`.github/workflows/deploy.yml`)
```
git pull → npm install → npm run build → pm2 restart tamlelan
```

### First-time server setup
```bash
# On the server, create /home/ubuntu/Tamlelan/.env.local with:
GEMINI_API_KEY=...
FIREBASE_API_KEY=...
```

### After committing a new `.env` to git (run on server)
```bash
GEMINI_KEY=$(grep GEMINI_API_KEY ~/Tamlelan/.env.local | cut -d= -f2-)
# Then append to .env after git pull if needed
```

---

## 🔄 Data Flow

```
Voicenter webhook POST /api/webhook/voicenter
    │
    ├─ saveCall() → JSON file on disk
    ├─ SSE broadcast('new-call') → all connected browsers
    └─ if transcript exists → auto-analyze with Gemini
           │
           └─ saveCall() with analysis → SSE broadcast('update-call')

Browser
    ├─ GET /api/calls        → paginated list
    ├─ GET /api/calls/:id    → full call JSON
    ├─ POST /api/calls/:id/analyze   → manual Gemini analysis
    ├─ POST /api/calls/:id/ask       → free-form Q&A
    ├─ GET /api/search/transcripts   → full-text search
    ├─ POST /api/search/ai           → semantic search
    ├─ PATCH /api/calls/:id/star     → star toggle
    └─ GET /api/calls/stream         → SSE (token via ?token=)
```

---

## 🔑 Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GEMINI_API_KEY` | `.env.local` (server) | Gemini AI calls |
| `FIREBASE_API_KEY` | `.env.local` (server) | Verify Firebase ID tokens |
| `VITE_FIREBASE_API_KEY` | `.env` (committed) | Firebase client SDK |
| `VITE_FIREBASE_AUTH_DOMAIN` | `.env` | Firebase client SDK |
| `VITE_FIREBASE_PROJECT_ID` | `.env` | Firebase client SDK |
| `VITE_FIREBASE_STORAGE_BUCKET` | `.env` | Firebase client SDK |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `.env` | Firebase client SDK |
| `VITE_FIREBASE_APP_ID` | `.env` | Firebase client SDK |
| `PORT` | env / PM2 | Server port (default: 3001) |
| `DATA_DIR` | env / PM2 | Call storage directory |

---

## 📋 Pending / Roadmap

- [ ] **Pull model**: Switch Voicenter integration from webhook (push) to API polling (pull) with admin token — removes dependency on public IP
- [ ] **Server refactor**: Split `server/index.ts` into `routes/` + `middleware/` folders
- [ ] **Types consolidation**: Single `types.ts` shared between frontend and backend
- [ ] **Call notes**: Freeform notes per call saved to disk
- [ ] **Rep performance dashboard**: Aggregated stats per representative
- [ ] **Audio playback**: Stream call recordings from Voicenter CDN

---

## 🐛 Troubleshooting

### Login fails / "Forbidden"
- Confirm your Google account matches `@drushim.il` or `eyalbch@gmail.com`
- Enable Google Sign-In in Firebase Console → Authentication → Sign-in method

### No calls appearing
- Check PM2 logs: `pm2 logs tamlelan`
- Verify webhook is hitting the right IP/port
- Check `GEMINI_API_KEY` is set on the server

### SSE disconnects constantly
- Normal — EventSource auto-reconnects. Check server logs for auth errors (missing `?token=`)

---

## 📝 License

Private project — internal use only.

---

**Built with ❤️ for the Drushim sales team**
