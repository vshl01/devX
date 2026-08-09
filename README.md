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
| `DATABASE_URL` | yes | Postgres. The workspace stores sessions, documents and transcripts. |

The key is never sent to the browser. Client code only ever talks to same-origin routes.

## Structure

```
app/                 layout, page, /new-screen, and route handlers under app/api/
components/ui/       Button, Container, Logo, Reveal
components/layout/   Navbar (auto-hiding glass bar), Footer
components/sections/ Hero, SupportedReports, HowItWorks, ExampleReading, Limits, ClosingCta
components/composer/ Composer, MicButton, Waveform, FileChip, ReplyPanel
components/workspace/ Workspace, LeftPane (Chat | Document), ChatPane, VoiceBar,
                     VoiceWaveform, MessageBubble, InsightsPane, ReportMarkdown
hooks/               use-audio-recorder, use-report-upload, use-coach-reply,
                     use-document-workspace, use-report-language, use-split-pane,
                     use-voice-conversation, use-workspace-session
lib/                 sarvam.ts (all Sarvam calls), extraction.ts, markdown-translate.ts,
                     conversation.ts, sessions.ts, db.ts, mic-capture.ts, audio-queue.ts,
                     turn-protocol.ts, languages.ts, insights.ts, stt-transport.ts
types/               sarvam.ts (API shapes), composer.ts, workspace.ts, conversation.ts
prisma/              schema.prisma and committed migrations
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

**Reports.** `POST /api/reports` validates type and size, then reads the file: `unpdf` for a
text-layer PDF, and Sarvam Document AI for photos and scans. Nothing is written to disk; the excerpt
travels back to the browser and rides along with the question.

**Answers.** `POST /api/chat` builds the coach messages (system prompt in `lib/sarvam.ts`) and streams
`sarvam-105b-conversations` back as plain text. Sarvam's SSE frames are parsed server side so the
client just reads a text stream. Sarvam chat takes text only, which is why every image goes through
Document AI first.

Failure paths are handled in the UI, not swallowed: microphone permission denied, no microphone,
unsupported browser, network loss mid-transcription, a recording with no speech in it, oversized or
wrong-typed uploads, unreadable PDFs, and an empty or failed completion.

## /new-screen, the document workspace

A two-pane screen at `/new-screen`: source document on the left, structured insights on the right,
each scrolling independently, a draggable divider on desktop and Document/Insights tabs on mobile.

Flow: `POST /api/extract` uploads the file to Sarvam Document AI and returns a job id. Doc AI decides
what it will read from the filename extension and accepts only `.pdf`, `.jpg`, `.jpeg` and `.png`, so
the name it receives is rebuilt from the content type: a file called `scan` or `photo.HEIC` cannot be
rejected for the wrong reason. HEIC and WebP are re-encoded to JPEG in the browser
(`lib/image-convert.ts`) before upload, since Sarvam cannot read either. The browser polls
`GET /api/extract/[jobId]` until the job completes, then pulls the Markdown out of the result
archive. That path is vision-backed, so photographs of handwritten prescriptions are read too.
`POST /api/insights` streams a structured report over that text: summary, key findings, a results
table with Test / Value / Reference range / Flag, medications with dosage, red flags, and a plain
language section. `components/workspace/report-markdown.tsx` maps every Markdown element to a
designed component and turns flag cells into colour-coded badges.

The language dropdown calls `POST /api/translate`. `lib/markdown-translate.ts` splits the document
into the smallest translatable units, holds back every heading mark, pipe and bullet on the server,
translates only prose (skipping pure numbers and units), and reassembles through placeholders, so
the structure cannot drift. Translations are cached per language for the life of a report and the
pane dims rather than blanking while one loads.

The landing page composer shares the same reader: text-layer PDFs go through `unpdf`, and photos or
scans fall through to Document AI.

## The voice conversation

The moment the report finishes, the agent opens the conversation itself: one short spoken insight
naming a real value from the document, then one follow-up question that only makes sense for that
document. No generic greeting; the opening prompt forbids it.

Full duplex runs on the relay that already exists. The mic (`lib/mic-capture.ts`) stays open through
the agent's own turn and streams 250 ms frames to `/api/stt/ws`. Sarvam's VAD drives both ends:
`END_SPEECH` plus 900 ms of quiet submits the turn, and `START_SPEECH` during playback is a barge-in.
Amplitude cuts the audio locally first, because the server signal round-trips and an interruption has
to feel immediate. On the mic button a tap toggles listening and a press over 300 ms is push-to-talk,
which suspends automatic endpointing. A floating mic sits over the Document view: one tap opens the
microphone, starts listening and follows the transcript over to Chat.

`POST /api/converse` streams the reply. `SpeechChunker` cuts the first speakable clause out of the
token stream and `/api/tts` synthesises it while the model is still writing; later chunks synthesise
in parallel and `AudioQueue` plays them strictly in order on the Web Audio clock, which is also what
makes `stop()` instant. Measured against Sarvam: first token 2.1 s, first chunk synthesised in 0.83 s,
so time to first audio is roughly 2.9 s. The sub-second target is not reachable while the model's own
first token takes 2.1 s; the next lever is Sarvam's streaming TTS socket, not more client tuning.

Every reply ends with a `%%META%%` line carrying `confidence` and `refs`. It is stripped before
speech and drives the bubble style: `unclear_source` is tinted and tagged "Unclear scan",
`outside_document` is dashed and tagged "Not from your report", and refs render as source chips.
The agent never diagnoses or changes a dose; it hands treatment decisions to the physician in
conversation, and the UI carries one quiet disclaimer rather than a wall of them.

Languages follow the insights pane. Sarvam speaks eleven of the thirteen; Assamese and Urdu translate
but have no voice, so those fall back to text with the voice bar disabled.

## Schema

`Session` holds one `Document` (original bytes kept for preview) with one `Extraction`
(OCR markdown, page count, generated report), plus `Message` rows (role, text, audio_url, language,
confidence, source_refs, created_at) with `MessageAudio` chunks for replay, and a `ReportTranslation`
cache keyed by session and language. Uploading a new document clears the previous document, its
transcript and its translations in one transaction. The session id lives in local storage, so a
reload restores the document, the report and the whole conversation.

## Not built here

No auth and no multi-document history: a session holds the one document being discussed. The landing
page composer still answers a single turn rather than opening a thread.
