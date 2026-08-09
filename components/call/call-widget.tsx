"use client";

import { Phone, PhoneDisconnect } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Waveform } from "@/components/composer/waveform";
import { cn } from "@/lib/utils";

type CallState = "idle" | "connecting" | "live" | "error";

/**
 * "Call Receptionist" button + floating in-call panel. Joins the LiveKit
 * room the call-agent worker is dispatched into (see app/api/call/token)
 * and plays the agent's voice back through a hidden <audio> element.
 */
export function CallWidget() {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const levelRef = useRef(0);

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    levelRef.current = 0;
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

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          audioElRef.current = track.attach() as HTMLAudioElement;
          audioElRef.current.autoplay = true;
        }
      });

      room.on(RoomEvent.Disconnected, () => {
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
