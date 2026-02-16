<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tamlelan - AI Co-Sales Agent for Recruitment Ads

An intelligent sales assistant for B2B recruitment professionals. Tamlelan transcribes and analyzes sales calls in real-time, extracts key insights, generates follow-up emails, and maintains organized records—all with Hebrew language support.

**Built for**: Israeli recruitment agencies and sales teams selling job advertisement packages.

View your app in AI Studio: https://ai.studio/apps/drive/1Q-wVw1oNlD3WnCwi1G0oq1TDrmnSBEQI

---

## 🎯 Core Features

### **1. Audio Recording & Transcription**
- **Dual-mode recording**:
  - 🎤 Microphone-only: Capture your voice and conversation
  - 🔊 Both sides: Record your voice + system audio (for recording both parties)
- **Audio playback**: Preview recordings before transcription
- **File upload**: Process previously recorded calls
- **Gemini AI**: Hebrew/English automatic transcription with high accuracy

### **2. Intelligent Call Analysis**

#### Call Type Classification
Select from 5 call types for tailored analysis:
- **בדיקת ביצועים** (Performance Check) - How is the ad performing?
- **חידוש/הזמנה חוזרת** (Renewal/Reorder) - Previous client follow-up
- **לקוח חדש** (New Prospect) - Lead from website
- **עקיבה על הצעה** (Follow-up on Offering) - Closing existing proposals
- **תזכורת לשימוש** (Reminder) - Reminding about unused packages

#### Type-Specific Insights
Each call type generates custom analysis:
- **Automatic summaries** focused on relevant details
- **Smart extraction** of conversation markers (introductions, offers, objections, performance issues)
- **Key discussion points** with exact quotes from the conversation
- **Professional follow-up emails** (20-50 words, ready to send)
- **CRM notes** (5-12 word summaries for your CRM system)

### **3. Call History & Organization**

- **Browser-local storage**: All calls saved to localStorage (no server needed)
- **Rich search**: Find calls by summary, transcript, tags, context, or call type
- **Call details view**: See full transcript, analysis, extracted data
- **Context tracking**: Add pre-call notes before recording (client background, goals, etc.)
- **CSV export**: Download all call data with timestamps, summaries, tags, CRM notes

### **4. Speaker Separation**
When recording both sides of a conversation, Gemini automatically labels:
- `אני:` (Your voice / seller)
- `לקוח:` (Customer / other party)
- `[?]:` (Uncertain speaker)

---

## 🚀 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Enter** | Start recording (from IDLE screen) |
| **Esc** | Cancel recording |

---

## 💻 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI**: Google Gemini 3 Flash (transcription + analysis)
- **Storage**: Browser localStorage
- **Styling**: Tailwind CSS
- **Language**: Hebrew-first interface with English support

---

## 📋 Installation & Setup

**Prerequisites**: Node.js 18+

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up your Gemini API key** in `.env.local`:
   ```
   API_KEY=your_gemini_api_key_here
   ```
   Get a free key at: https://ai.google.dev/

3. **Run locally**:
   ```bash
   npm run dev
   ```
   Open http://localhost:5173

---

## 🏗️ Build for Production

```bash
npm run build      # Create optimized bundle
npm run preview    # Test production build locally
```

---

## 📁 Project Structure

```
.
├── App.tsx                 # Main application component
├── types.ts               # TypeScript interfaces
├── services/
│   └── gemini.ts         # Gemini API integration
├── README.md             # This file
└── [.env.local]          # Your API keys (create this)
```

---

## 🎬 How to Use

### Basic Workflow

1. **Select Call Type** (Optional - can be set after recording)
2. **Add Context** (Optional - notes about the call)
3. **Choose Recording Mode**: Microphone only or Both sides
4. **Press Enter** or click record button
5. **Have your conversation**
6. **Stop Recording** - Audio plays back immediately
7. **Click Transcribe** - Gemini generates transcript
8. **Analyze** - Get summary, emails, CRM notes
9. **Save** - Automatically stored in browser history

### Managing History

- **Search**: Find calls by any keyword
- **Export**: Download all calls as CSV (for Excel/CRM)
- **View Details**: Click any call to see full analysis
- **Delete**: Remove calls you no longer need

---

## 🔄 Data Flow

```
Record Audio
    ↓
Preview & Transcribe (Gemini)
    ↓
Analyze (Type-specific Gemini prompt)
    ↓
Generate Email + CRM Note
    ↓
Save to History (localStorage)
    ↓
Search, Export, Share
```

---

## 📊 Supported Languages

- **Hebrew** ✅ (Primary - all UI & analysis in Hebrew)
- **English** ✅ (Supported in transcription & analysis)
- **Mixed conversations** ✅ (Gemini handles code-switching)

---

## 🔒 Privacy & Data

- **All data stored locally** in your browser's localStorage
- **No calls sent to servers** (except Gemini API for transcription)
- **No tracking** or analytics
- **Clear data anytime** by clearing browser storage

---

## 🐛 Troubleshooting

### "Failed to record audio"
- Check microphone permissions in browser
- Try a different browser (Chrome/Edge recommended)
- Close other apps using microphone

### "Transcription failed"
- Check internet connection
- Verify API key is set correctly
- Try again with the **Retry** button
- Ensure audio file is < 25MB (Gemini limit)

### "Storage full"
- Export CSV to back up your data
- Clear older calls from history
- Clear browser cache/localStorage

---

## 📞 Support

For issues or feature requests, please open a GitHub issue.

---

## 📝 License

Private project for internal use.

---

**Built with ❤️ for Israeli recruitment teams**
