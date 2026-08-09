"""Google Calendar sync for booked appointments.

One-time setup per doctor: they visit GET /oauth/google/authorize (a link
your UI can render as a "Connect Google Calendar" button), log into Google,
and grant calendar access. Google redirects back to
GET /oauth/google/callback, which exchanges the code for tokens and stores
them on the Doctor row. After that, book_appointment() calls create_event()
automatically — no further login needed (access tokens are refreshed here
using the stored refresh_token as they expire).

If a doctor hasn't connected Google yet, or the Calendar API call fails,
create_event() returns None and logs a warning rather than raising — the
Postgres Appointment row is always the source of truth for whether a slot
is booked; calendar sync is a best-effort mirror of that.
"""

import logging
import os
from datetime import date as date_cls, datetime, time as time_cls, timedelta, timezone
from urllib.parse import urlencode

import httpx

import db

log = logging.getLogger("calendar_sync")

TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
SCOPE = "https://www.googleapis.com/auth/calendar.events"
EVENT_TIMEZONE = "Asia/Kolkata"
APPOINTMENT_DURATION_MINUTES = 30


def _client_id() -> str:
    return os.environ["GOOGLE_CLIENT_ID"]


def _client_secret() -> str:
    return os.environ["GOOGLE_CLIENT_SECRET"]


def _redirect_uri() -> str:
    return os.environ["GOOGLE_REDIRECT_URI"]


def authorize_url() -> str:
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri(),
            },
        )
        resp.raise_for_status()
        return resp.json()


async def _refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def _get_valid_access_token(doctor: dict) -> str | None:
    if not doctor.get("googleRefreshToken"):
        return None

    expiry = doctor.get("googleTokenExpiry")
    if doctor.get("googleAccessToken") and expiry and expiry > datetime.now(timezone.utc):
        return doctor["googleAccessToken"]

    try:
        token_data = await _refresh_access_token(doctor["googleRefreshToken"])
    except httpx.HTTPStatusError as exc:
        log.warning("Google token refresh failed for doctor %s: %s", doctor["id"], exc)
        return None

    new_expiry = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])
    await db.update_doctor_google_tokens(
        doctor["id"],
        access_token=token_data["access_token"],
        refresh_token=doctor["googleRefreshToken"],
        expiry=new_expiry,
    )
    return token_data["access_token"]


async def create_event(
    doctor: dict, d: date_cls, t: time_cls, patient_name: str, patient_phone: str
) -> str | None:
    access_token = await _get_valid_access_token(doctor)
    if not access_token:
        log.info("Doctor %s has no connected Google account; skipping calendar sync.", doctor["id"])
        return None

    start = datetime.combine(d, t)
    end = start + timedelta(minutes=APPOINTMENT_DURATION_MINUTES)
    calendar_id = doctor.get("googleCalendarId") or "primary"

    body = {
        "summary": f"Appointment: {patient_name}",
        "description": f"Booked via AI receptionist. Patient phone: {patient_phone}",
        "start": {"dateTime": start.isoformat(), "timeZone": EVENT_TIMEZONE},
        "end": {"dateTime": end.isoformat(), "timeZone": EVENT_TIMEZONE},
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
                headers={"Authorization": f"Bearer {access_token}"},
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["id"]
    except httpx.HTTPStatusError as exc:
        log.warning("Google Calendar event creation failed for doctor %s: %s", doctor["id"], exc)
        return None
