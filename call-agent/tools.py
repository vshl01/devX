import json
from datetime import date as date_cls, time as time_cls

from livekit.agents import RunContext, function_tool

import calendar_sync
import db

TIME_OF_DAY_WINDOWS = {
    "morning": (time_cls(9, 0), time_cls(12, 0)),
    "afternoon": (time_cls(12, 0), time_cls(17, 0)),
    "evening": (time_cls(17, 0), time_cls(21, 0)),
}


@function_tool
async def get_availability(date: str, time_of_day: str | None = None) -> dict:
    """Look up the doctor's real available appointment slots for a given date.

    Args:
        date: The date the patient wants, as an ISO string YYYY-MM-DD. Resolve
            relative phrases like "tomorrow" against today's date yourself
            before calling this.
        time_of_day: One of "morning", "afternoon", "evening", or omit/null to
            return every free slot regardless of time of day.
    """
    try:
        d = date_cls.fromisoformat(date)
    except ValueError:
        return {"error": f"'{date}' is not a valid YYYY-MM-DD date."}

    slots = await db.available_slots(d)

    if time_of_day:
        window = TIME_OF_DAY_WINDOWS.get(time_of_day.lower())
        if window:
            start, end = window
            slots = [s for s in slots if start.strftime("%H:%M") <= s < end.strftime("%H:%M")]

    return {"date": date, "slots": slots}


@function_tool
async def book_appointment(
    context: RunContext, patient_name: str, patient_phone: str, date: str, time: str
) -> dict:
    """Book a confirmed appointment slot. Only call this after the patient has
    explicitly confirmed a specific date and time that get_availability showed
    as free — never book a slot you haven't just checked is available.

    Args:
        patient_name: The patient's full name, as they gave it.
        patient_phone: The patient's phone number, as they gave it.
        date: ISO date YYYY-MM-DD.
        time: 24-hour time HH:MM, matching one of the free slots exactly.
    """
    try:
        d = date_cls.fromisoformat(date)
        t = time_cls.fromisoformat(time)
    except ValueError:
        return {"success": False, "reason": "invalid_date_or_time"}

    result = await db.book_appointment(patient_name, patient_phone, d, t)

    # Calendar sync is best-effort — the DB row above is the real booking.
    # If the doctor hasn't connected Google yet, or the API call fails,
    # create_event() returns None and the appointment still stands.
    if result["success"]:
        doctor = await db.get_doctor()
        event_id = await calendar_sync.create_event(doctor, d, t, patient_name, patient_phone)
        if event_id:
            await db.set_appointment_calendar_event(result["appointment_id"], event_id)

        # Lets the browser UI show a confirmation card without polling the DB.
        room = context.session.room_io.room
        room.local_participant.publish_data(
            json.dumps(
                {
                    "type": "appointment_booked",
                    "doctorName": doctor["name"],
                    "patientName": patient_name,
                    "date": date,
                    "time": time,
                }
            ),
            topic="appointment",
        )

    return result
