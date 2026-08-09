"use client";

import { Phone, PhoneDisconnect } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Waveform } from "@/components/composer/waveform";
import { cn } from "@/lib/utils";

type CallState = "idle" | "connecting" | "live" | "error";

type BookedAppointment = {
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
};

/**
 * "Call Receptionist" button + floating in-call panel. Joins the LiveKit
 * room the call-agent worker is dispatched into (see app/api/call/token)
 * and plays the agent's voice back through a hidden <audio> element.
 */
export function CallWidget({
  onAppointmentBooked,
}: {
  onAppointmentBooked?: (appointment: BookedAppointment) => void;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const levelRef = useRef(0);

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    audioElRef.current?.remove();
    audioElRef.current = null;
    levelRef.current = 0;
    setAudioBlocked(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function startCall() {
    setState("connecting");
    setError(null);

    try {
      const { Room, RoomEvent, Track } = await import("livekit-client");

      const res = await fetch("/api/call/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message ?? "Could not reach the call service.");
      }
      const { server_url, participant_token } = body.data;

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, (p) => {
        console.log("[call] participant connected:", p.identity);
      });

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        console.log("[call] track subscribed:", track.kind, "from", participant.identity);
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          document.body.appendChild(el);
          audioElRef.current = el;
          el.play()
            .then(() => console.log("[call] audio element playing"))
            .catch((e) => console.error("[call] audio play() blocked:", e));
        }
      });

      // Autoplay-with-sound can be blocked by the browser since the remote
      // track arrives well after the click that started the call; LiveKit's
      // own flag + startAudio() is the documented way to recover from that.
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioBlocked(!room.canPlaybackAudio);
      });

      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        if (topic !== "appointment") return;
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          if (data.type === "appointment_booked") {
            onAppointmentBooked?.(data);
          }
        } catch (e) {
          console.error("[call] failed to parse appointment data:", e);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        audioElRef.current?.remove();
        audioElRef.current = null;
        roomRef.current = null;
        setState("idle");
      });

      let raf = 0;
      const meter = () => {
        const remoteLevels = Array.from(room.remoteParticipants.values()).map(
          (p) => p.audioLevel,
        );
        levelRef.current = Math.max(room.localParticipant.audioLevel, ...remoteLevels, 0);
        raf = requestAnimationFrame(meter);
      };
      raf = requestAnimationFrame(meter);
      room.once(RoomEvent.Disconnected, () => cancelAnimationFrame(raf));

      await room.connect(server_url, participant_token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setState("live");
    } catch (err) {
      cleanup();
      setError(err instanceof Error ? err.message : "Could not start the call.");
      setState("error");
    }
  }

  function endCall() {
    cleanup();
    setState("idle");
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={state === "live" ? "secondary" : "primary"}
        onClick={state === "live" ? endCall : startCall}
        disabled={state === "connecting"}
        className="gap-1.5"
      >
        {state === "live" ? (
          <>
            <PhoneDisconnect size={16} weight="fill" />
            End call
          </>
        ) : (
          <>
            <Phone size={16} weight="fill" />
            {state === "connecting" ? "Connecting…" : "Call receptionist"}
          </>
        )}
      </Button>

      {state === "live" || error ? (
        <div
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-80",
          )}
        >
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : audioBlocked ? (
            <button
              type="button"
              className="text-sm font-medium text-ink underline"
              onClick={() => roomRef.current?.startAudio()}
            >
              Tap to enable audio
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Waveform levelRef={levelRef} active />
                <span className="text-sm font-medium text-ink">
                  Connected to the AI receptionist
                </span>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={endCall}>
                End
              </Button>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
