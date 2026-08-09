import json
import os
from datetime import date as date_cls, time as time_cls, datetime, timedelta

import asyncpg

SLOT_MINUTES = 30

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    return _pool


async def get_doctor() -> dict:
    """Only one doctor is seeded for this pass — return it."""
    pool = await _get_pool()
    row = await pool.fetchrow('SELECT * FROM "Doctor" LIMIT 1')
    if not row:
        raise RuntimeError(
            "No doctor found. Run the Prisma migration "
            "(20260809131746_add_doctors_appointments) against DATABASE_URL first."
        )
    return dict(row)


def _day_key(d: date_cls) -> str:
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][d.weekday()]


def _windows_for_day(doctor: dict, d: date_cls) -> list[tuple[time_cls, time_cls]]:
    working_hours = doctor["workingHours"]
    if isinstance(working_hours, str):
        working_hours = json.loads(working_hours)
    day_key = _day_key(d)
    for entry in working_hours:
        if entry["day"] == day_key:
            return [
                (time_cls.fromisoformat(start), time_cls.fromisoformat(end))
                for start, end in entry["windows"]
            ]
    return []


async def _booked_times(doctor_id: str, d: date_cls) -> set[time_cls]:
    pool = await _get_pool()
    rows = await pool.fetch(
        'SELECT "startTime" FROM "Appointment" '
        'WHERE "doctorId" = $1 AND "date" = $2 AND "status" = $3',
        doctor_id,
        d,
        "confirmed",
    )
    return {time_cls.fromisoformat(row["startTime"]) for row in rows}


async def available_slots(d: date_cls) -> list[str]:
    """All free HH:MM slots for the seeded doctor on date `d`."""
    doctor = await get_doctor()
    booked = await _booked_times(doctor["id"], d)
    slots: list[str] = []
    for start, end in _windows_for_day(doctor, d):
        cur = datetime.combine(d, start)
        end_dt = datetime.combine(d, end)
        while cur + timedelta(minutes=SLOT_MINUTES) <= end_dt:
            if cur.time() not in booked:
                slots.append(cur.time().strftime("%H:%M"))
            cur += timedelta(minutes=SLOT_MINUTES)
    return slots


async def book_appointment(patient_name: str, patient_phone: str, d: date_cls, t: time_cls) -> dict:
    doctor = await get_doctor()
    pool = await _get_pool()
    try:
        row = await pool.fetchrow(
            'INSERT INTO "Appointment" '
            '("id", "doctorId", "patientName", "patientPhone", "date", "startTime") '
            "VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) "
            'RETURNING "id"',
            doctor["id"],
            patient_name,
            patient_phone,
            d,
            t.strftime("%H:%M"),
        )
        return {"success": True, "appointment_id": row["id"]}
    except asyncpg.UniqueViolationError:
        return {"success": False, "reason": "slot_taken"}


async def update_doctor_google_tokens(
    doctor_id: str, *, access_token: str, refresh_token: str, expiry: datetime
) -> None:
    pool = await _get_pool()
    await pool.execute(
        'UPDATE "Doctor" SET "googleAccessToken" = $1, "googleRefreshToken" = $2, '
        '"googleTokenExpiry" = $3 WHERE "id" = $4',
        access_token,
        refresh_token,
        expiry,
        doctor_id,
    )


async def set_appointment_calendar_event(appointment_id: str, event_id: str) -> None:
    pool = await _get_pool()
    await pool.execute(
        'UPDATE "Appointment" SET "calendarEventId" = $1 WHERE "id" = $2',
        event_id,
        appointment_id,
    )


async def get_prescription_context(patient_phone: str) -> list[dict]:
    """Prescriptions on file for this phone number, for the call agent to
    reference (e.g. "I see you have a prescription from Dr. X on file").
    Not wired into a tool yet — available for whoever adds that next."""
    pool = await _get_pool()
    rows = await pool.fetch(
        'SELECT "id", "status", "structuredData", "createdAt" FROM "Prescription" '
        'WHERE "patientPhone" = $1 ORDER BY "createdAt" DESC',
        patient_phone,
    )
    return [dict(row) for row in rows]
