import logging

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.plugins import sarvam, silero

import db
import tools
from constants import AGENT_NAME
from prompts import system_prompt

load_dotenv()
logging.basicConfig(level=logging.INFO)

server = AgentServer()

# Loaded once per worker process and reused across jobs (silero.VAD.load() is
# too slow to call per-call). Replaces Sarvam STT's own vad_signals as the
# turn-detection source — those kept the turn open indefinitely on background
# noise/room echo, so the agent never generated a reply after a real answer.
vad = silero.VAD.load()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    doctor = await db.get_doctor()

    session = AgentSession(
        stt=sarvam.STT(model="saaras:v3", language="unknown"),
        vad=vad,
        # sarvam-30b was deprecated by Sarvam. The API error also offered
        # sarvam-105b-conversations, but the installed livekit-plugins-sarvam
        # version hardcodes its own allowlist and doesn't know that model yet
        # (ValueError before the API is even called) — sticking with plain
        # sarvam-105b, which both the API and the plugin's allowlist accept.
        llm=sarvam.LLM(model="sarvam-105b"),
        tts=sarvam.TTS(target_language_code="en-IN", speaker="shubh"),
        # Defaults (min_delay 0.5s/max_delay 3.0s, preemptive_tts off) made
        # replies feel ~3-5s slow end-to-end in testing. Tightened further
        # for a snappier demo — tradeoff is a higher chance of the agent
        # jumping in if a caller pauses mid-sentence.
        turn_handling={
            "endpointing": {"min_delay": 0.05, "max_delay": 0.8},
            "preemptive_generation": {"preemptive_tts": True},
        },
    )

    agent = Agent(
        instructions=system_prompt(doctor["name"]),
        tools=[tools.get_availability, tools.book_appointment],
    )

    # ponytail: no hand-built booking state machine — the LLM's turn context
    # plus book_appointment()'s DB-level validation (unique slot constraint,
    # re-checked before insert) prevents hallucinated/double bookings for
    # this scope. Add an explicit state machine if testing shows the model
    # loses track of what it already collected mid-call.
    await session.start(agent=agent, room=ctx.room)
    await session.generate_reply(
        instructions=(
            f"Greet the caller warmly as {doctor['name']}'s receptionist and "
            "ask how you can help."
        )
    )


if __name__ == "__main__":
    cli.run_app(server)
