/**
 * Custom Next.js server.
 *
 * Next route handlers cannot answer a WebSocket upgrade, and Sarvam's realtime
 * speech-to-text is a WebSocket API whose key must never reach the browser.
 * This server runs Next as usual and additionally relays `/api/stt/ws` to
 * `wss://api.sarvam.ai/speech-to-text/ws`, attaching the subscription key to
 * the upstream handshake on this side of the wire.
 *
 * Not run through the Next compiler, so this file stays plain Node ESM.
 */
import { createServer } from "node:http";
import nextEnv from "@next/env";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "localhost";
const dev = process.env.NODE_ENV !== "production";

const RELAY_PATH = "/api/stt/ws";
const SARVAM_WS_URL =
  process.env.SARVAM_WS_URL ?? "wss://api.sarvam.ai/speech-to-text/ws";

/** Query params the browser may set. Everything else is decided here. */
const FORWARDED_PARAMS = new Set(["language-code", "model", "mode"]);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function buildUpstreamUrl(requestUrl) {
  const incoming = new URL(requestUrl, `http://${hostname}`);
  const upstream = new URL(SARVAM_WS_URL);

  for (const [key, value] of incoming.searchParams) {
    if (FORWARDED_PARAMS.has(key) && value) upstream.searchParams.set(key, value);
  }

  if (!upstream.searchParams.has("model")) {
    upstream.searchParams.set("model", "saaras:v3");
  }
  upstream.searchParams.set("sample_rate", "16000");
  upstream.searchParams.set("vad_signals", "true");
  upstream.searchParams.set("high_vad_sensitivity", "true");

  return upstream;
}

function closeWithReason(socket, code, reason) {
  if (socket.readyState === WebSocket.OPEN) socket.close(code, reason);
}

function relay(client, requestUrl) {
  const apiKey = process.env.SARVAM_API_KEY ?? process.env.SARVAM_AI;
  if (!apiKey) {
    client.send(
      JSON.stringify({
        type: "error",
        data: { code: "missing_key", error: "SARVAM_API_KEY is not set." },
      }),
    );
    closeWithReason(client, 1011, "missing_key");
    return;
  }

  const upstream = new WebSocket(buildUpstreamUrl(requestUrl), {
    headers: { "api-subscription-key": apiKey },
    handshakeTimeout: 10_000,
  });

  /** Audio recorded before the upstream handshake finishes. */
  const pending = [];
  let upstreamReady = false;

  upstream.on("open", () => {
    upstreamReady = true;
    for (const [frame, isBinary] of pending.splice(0)) {
      upstream.send(frame, { binary: isBinary });
    }
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "ready" }));
    }
  });

  upstream.on("message", (payload, isBinary) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload, { binary: isBinary });
  });

  upstream.on("error", (error) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "error",
          data: { code: "upstream_error", error: error.message },
        }),
      );
    }
    closeWithReason(client, 1011, "upstream_error");
  });

  upstream.on("close", (code, reason) => {
    closeWithReason(client, code >= 1000 && code <= 4999 ? code : 1011, reason.toString());
  });

  // Sarvam rejects binary frames on this endpoint, so the text/binary flag has
  // to survive the relay rather than defaulting to binary.
  client.on("message", (payload, isBinary) => {
    if (upstreamReady) {
      upstream.send(payload, { binary: isBinary });
    } else if (pending.length < 200) {
      // Roughly 50 seconds of 250ms frames. Beyond that the handshake is dead.
      pending.push([payload, isBinary]);
    }
  });

  client.on("close", () => {
    if (upstream.readyState === WebSocket.OPEN) upstream.close(1000, "client_closed");
    else upstream.terminate();
  });

  client.on("error", () => upstream.terminate());
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("[next] request failed", error);
      res.statusCode = 500;
      res.end("Internal Server Error");
    });
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", relay);

  const upgradeNext = app.getUpgradeHandler();

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (pathname !== RELAY_PATH) {
      // Everything else, including the dev HMR socket, belongs to Next.
      upgradeNext(request, socket, head);
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request.url);
    });
  });

  server.listen(port, () => {
    console.log(`> ready on http://${hostname}:${port} (${dev ? "development" : "production"})`);
  });
});
