import os
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from livekit import api
from pydantic import BaseModel

import calendar_sync
import db
from constants import AGENT_NAME

load_dotenv()

app = FastAPI()

# ponytail: permissive CORS for the hackathon so the other dev's UI (unknown
# origin yet) can call this directly. Lock to the real UI origin before
# this is public-facing.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TokenRequest(BaseModel):
    patient_name: str | None = None


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/token")
async def create_token(body: TokenRequest) -> dict:
    room_name = f"call-{uuid.uuid4().hex[:8]}"
    identity = body.patient_name or f"patient-{uuid.uuid4().hex[:6]}"

    # agent_name in worker.py's @server.rtc_session is "explicit dispatch" —
    # LiveKit won't send an agent into the room unless something requests it
    # by name. This is that request, attached to the room via the token.
    token = (
        api.AccessToken(os.environ["LIVEKIT_API_KEY"], os.environ["LIVEKIT_API_SECRET"])
        .with_identity(identity)
        .with_name(identity)
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .with_room_config(
            api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name=AGENT_NAME)])
        )
    )

    return {
        "server_url": os.environ["LIVEKIT_URL"],
        "room_name": room_name,
        "participant_token": token.to_jwt(),
    }


@app.get("/oauth/google/authorize")
async def google_authorize() -> RedirectResponse:
    """The doctor visits this once (render it as a "Connect Google Calendar"
    link/button wherever your UI shows doctor settings) to grant calendar
    access. There's only one seeded doctor for this pass, so no doctor_id
    param is needed yet."""
    return RedirectResponse(calendar_sync.authorize_url())


@app.get("/oauth/google/callback")
async def google_callback(code: str) -> dict:
    token_data = await calendar_sync.exchange_code(code)
    doctor = await db.get_doctor()
    expiry = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])

    await db.update_doctor_google_tokens(
        doctor["id"],
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        expiry=expiry,
    )

    return {"status": "connected", "doctor": doctor["name"]}
