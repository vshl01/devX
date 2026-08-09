# Lucid

Landing page for an AI health coach that reads medical reports and explains them in plain language.
The hero composer is real: record a question, watch Sarvam transcribe it live, attach a PDF or photo
of a report, and get a streamed answer.

## Setup

```bash
npm install
cp .env.example .env.local   # add SARVAM_API_KEY
npm run dev                  # http://localhost:3000
```

`npm run dev` and `npm start` run `server.mjs`, not `next dev`/`next start`. The custom server is
required for the realtime speech relay (see below). `npm run build` is unchanged.

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `SARVAM_API_KEY` | yes | `sk_...`. Server side only. `SARVAM_AI` is accepted as an alias. |
| `SARVAM_BASE_URL` | no | Defaults to `https://api.sarvam.ai`. |
| `SARVAM_WS_URL` | no | Defaults to `wss://api.sarvam.ai/speech-to-text/ws`. |

The key is never sent to the browser. Client code only ever talks to same-origin routes.

## Structure

```
app/                 layout, page, and route handlers under app/api/
components/ui/       Button, Container, Logo, Reveal
components/layout/   Navbar (auto-hiding glass bar), Footer
components/sections/ Hero, SupportedReports, HowItWorks, ExampleReading, Limits, ClosingCta
components/composer/ Composer, MicButton, Waveform, FileChip, ReplyPanel
hooks/               use-audio-recorder, use-report-upload, use-coach-reply
lib/                 sarvam.ts (all Sarvam calls), stt-transport.ts, audio.ts, files.ts, motion.ts
types/               sarvam.ts (API shapes), composer.ts (UI state)
public/audio/        recorder-worklet.js (audio-thread capture)
server.mjs           Next + the /api/stt/ws relay
```

Design tokens live once in `app/globals.css`: palette, semantic colours, radii, elevation, easing.
Theme switches through `prefers-color-scheme` on CSS variables, so no component carries a `dark:`
variant and no section can drift out of theme.

## How the Sarvam flow works

**Voice, realtime.** The mic captures through an `AudioWorklet`, downsamples to 16 kHz mono, and
pushes ~250 ms WAV frames as base64 JSON over `ws://.../api/stt/ws`. `server.mjs` relays that socket
to Sarvam, adding `api-subscription-key` on the server side of the wire. Sarvam's VAD segments the
audio and returns a transcript per utterance, which is appended into the composer while the user is
still speaking. Route handlers cannot answer a WebSocket upgrade, which is why the custom server
exists.

**Voice, fallback.** If the socket cannot open (a serverless host without the relay), the recorder
switches to `POST /api/stt`: it cuts utterances on 700 ms of silence and uploads each as a WAV to
Sarvam's `/speech-to-text`. Same transcripts, one utterance of latency.

**Reports.** `POST /api/reports` validates type and size, then extracts PDF text with `unpdf`.
Images and scanned PDFs are marked `needsVision` and read by the vision model at question time.
Nothing is written to disk; the excerpt travels back to the browser and rides along with the question.

**Answers.** `POST /api/chat` builds the coach messages (system prompt in `lib/sarvam.ts`) and streams
`sarvam-105b-conversations` back as plain text. Sarvam's SSE frames are parsed server side so the
client just reads a text stream. An image part that the model rejects retries once as text only.

Failure paths are handled in the UI, not swallowed: microphone permission denied, no microphone,
unsupported browser, network loss mid-transcription, a recording with no speech in it, oversized or
wrong-typed uploads, unreadable PDFs, and an empty or failed completion.

## Not built here

Scope is the landing page. There is no auth, no persistence, no report history, and no chat thread
beyond the single streamed answer under the composer.
