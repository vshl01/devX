"""Join a LiveKit room as a fake patient, without any UI.

Usage:
    python test_client.py path/to/question.wav

Publishes the given WAV file as the "patient's" mic audio, joins the same
room the agent worker will be dispatched into (via our own /token endpoint),
and records whatever audio the agent sends back to reply.wav. Run the
FastAPI server (`uvicorn server:app`) and the worker (`python worker.py dev`)
in separate terminals first.
"""

import asyncio
import sys
import wave

import httpx
from dotenv import load_dotenv
from livekit import rtc

load_dotenv()

SERVER_URL = "http://localhost:8000"
OUTPUT_PATH = "reply.wav"


async def main(wav_path: str) -> None:
    async with httpx.AsyncClient() as http:
        resp = await http.post(f"{SERVER_URL}/token", json={"patient_name": "Test Patient"})
        resp.raise_for_status()
        token_info = resp.json()

    room = rtc.Room()
    recorded_frames: list[bytes] = []
    recorded_sample_rate = 48000
    recorded_channels = 1

    @room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):  # noqa: ANN001
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(_record_track(track))

    async def _record_track(track: rtc.Track) -> None:
        nonlocal recorded_sample_rate, recorded_channels
        stream = rtc.AudioStream(track)
        async for event in stream:
            frame = event.frame
            recorded_sample_rate = frame.sample_rate
            recorded_channels = frame.num_channels
            recorded_frames.append(bytes(frame.data))

    await room.connect(token_info["server_url"], token_info["participant_token"])
    print(f"Connected to room {token_info['room_name']}. Publishing {wav_path}...")

    await _publish_wav(room, wav_path)

    print("Listening for the agent's reply for 20s (Ctrl+C to stop early)...")
    try:
        await asyncio.sleep(20)
    except KeyboardInterrupt:
        pass

    if recorded_frames:
        with wave.open(OUTPUT_PATH, "wb") as out:
            out.setnchannels(recorded_channels)
            out.setsampwidth(2)
            out.setframerate(recorded_sample_rate)
            out.writeframes(b"".join(recorded_frames))
        print(f"Wrote agent reply audio to {OUTPUT_PATH}")
    else:
        print("No audio received back from the agent.")

    await room.disconnect()


async def _publish_wav(room: rtc.Room, wav_path: str) -> None:
    with wave.open(wav_path, "rb") as wf:
        sample_rate = wf.getframerate()
        channels = wf.getnchannels()
        pcm = wf.readframes(wf.getnframes())

    source = rtc.AudioSource(sample_rate, channels)
    track = rtc.LocalAudioTrack.create_audio_track("patient-mic", source)
    await room.local_participant.publish_track(track)

    frame_ms = 20
    bytes_per_frame = int(sample_rate * frame_ms / 1000) * channels * 2
    for i in range(0, len(pcm), bytes_per_frame):
        chunk = pcm[i : i + bytes_per_frame]
        if len(chunk) < bytes_per_frame:
            chunk += b"\x00" * (bytes_per_frame - len(chunk))
        frame = rtc.AudioFrame(
            data=chunk,
            sample_rate=sample_rate,
            num_channels=channels,
            samples_per_channel=len(chunk) // 2 // channels,
        )
        await source.capture_frame(frame)
        await asyncio.sleep(frame_ms / 1000)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_client.py path/to/question.wav")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
