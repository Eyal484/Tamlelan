<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tamlelan - Sales Call Transcription & Analysis

An AI-powered tool for transcribing and analyzing sales conversations. Tamlelan uses Google Gemini to automatically transcribe audio calls and extract key insights including summaries, conversation markers, and important discussion points.

**Ideal for**: Sales teams, recruitment professionals, and anyone who needs to document and analyze conversations.

View your app in AI Studio: https://ai.studio/apps/drive/1Q-wVw1oNlD3WnCwi1G0oq1TDrmnSBEQI

## Features

- **Audio Recording**: Record conversations directly from your microphone or upload audio files
- **AI Transcription**: Automatic speech-to-text using Google Gemini (supports Hebrew and English)
- **Smart Analysis**:
  - Conversation summaries with key details (names, packages, prices, decisions)
  - Automatic detection of conversation markers (introductions, offers, follow-ups, performance issues)
  - Extraction of key points with exact quotes from the transcript
- **Call History**: All transcriptions saved locally in your browser

## Run Locally

**Prerequisites**: Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Gemini API key in [.env.local](.env.local):
   ```
   API_KEY=your_gemini_api_key_here
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

## Build for Production

```bash
npm run build
npm run preview
```
