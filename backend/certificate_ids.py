"""Build unique per-course certificate IDs: {prefix}-{CODE}-{number}."""
from __future__ import annotations

import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models

DEFAULT_PREFIX = "IQ"
DEFAULT_WIDTH = 3
_PREFIX_RE = re.compile(r"^[A-Za-z0-9]{1,8}$")
_CODE_RE = re.compile(r"^[A-Za-z]{3}$")


def suggest_code(title: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", title or "")
    if len(letters) >= 3:
        return letters[:3].upper()
    padded = (letters + "XXX")[:3]
    return padded.upper()


def clamp_width(value: int | None) -> int:
    try:
        width = int(value if value is not None else DEFAULT_WIDTH)
    except (TypeError, ValueError):
        width = DEFAULT_WIDTH
    return max(1, min(width, 8))


def normalize_prefix(value: str | None) -> str:
    text = (value or DEFAULT_PREFIX).strip().upper() or DEFAULT_PREFIX
    if not _PREFIX_RE.match(text):
        raise ValueError("Prefix must be 1–8 letters or numbers.")
    return text


def normalize_code(value: str | None) -> str:
    text = (value or "").strip().upper()
    if not _CODE_RE.match(text):
        raise ValueError("Course code must be exactly 3 letters (A–Z).")
    return text


def render_certificate_id(prefix: str, code: str, seq: int, width: int) -> str:
    w = clamp_width(width)
    return f"{prefix}-{code}-{seq:0{w}d}"[:64]


def preview_certificate_id(prefix: str, code: str, next_seq: int, width: int) -> str:
    return render_certificate_id(prefix, code or "XXX", next_seq, width)


def normalize_start_number(value: int | None, *, current_seq: int = 0) -> int:
    """Next certificate number the admin wants (first issue uses this value)."""
    try:
        start = int(value if value is not None else 1)
    except (TypeError, ValueError) as exc:
        raise ValueError("Start number must be a whole number.") from exc
    if start < 1:
        raise ValueError("Start number must be at least 1.")
    if start > 999_999_999:
        raise ValueError("Start number is too large.")
    # Do not move the counter backwards into numbers already consumed.
    if start <= current_seq:
        raise ValueError(
            f"Start number must be greater than {current_seq} "
            f"(already used). Enter {current_seq + 1} or higher."
        )
    return start


def apply_start_number(course: models.Course, start_number: int) -> None:
    """Set sequence so the next issued ID uses start_number."""
    course.cert_seq = int(start_number) - 1


def course_id_payload(course: models.Course) -> dict:
    prefix = (course.cert_prefix or DEFAULT_PREFIX).strip().upper() or DEFAULT_PREFIX
    code = (course.cert_code or "").strip().upper()
    width = clamp_width(course.cert_number_width)
    current = int(course.cert_seq or 0)
    next_seq = current + 1
    return {
        "course_id": course.id,
        "title": course.title,
        "prefix": prefix,
        "code": code or suggest_code(course.title or ""),
        "number_width": width,
        "current_seq": current,
        "next_seq": next_seq,
        "start_number": next_seq,
        "preview": preview_certificate_id(prefix, code or suggest_code(course.title or ""), next_seq, width),
        "configured": bool(code),
    }


async def next_certificate_id(db: AsyncSession, user_id: int, course_id: int) -> str:
    """Increment the course sequence and return a unique certificate ID."""
    res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = res.scalars().first()
    if not course:
        stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"IQ-{stamp}-{user_id}-{course_id}"[:64]

    prefix = (course.cert_prefix or DEFAULT_PREFIX).strip().upper() or DEFAULT_PREFIX
    if not _PREFIX_RE.match(prefix):
        prefix = DEFAULT_PREFIX
        course.cert_prefix = prefix

    code = (course.cert_code or "").strip().upper()
    if not _CODE_RE.match(code):
        code = suggest_code(course.title or f"C{course_id}")
        course.cert_code = code

    width = clamp_width(course.cert_number_width)
    course.cert_number_width = width
    current = int(course.cert_seq or 0)

    for _ in range(8):
        current += 1
        candidate = render_certificate_id(prefix, code, current, width)
        exists = await db.execute(
            select(models.UserCertificate).where(models.UserCertificate.certificate_id == candidate)
        )
        if exists.scalars().first():
            continue
        course.cert_seq = current
        return candidate

    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    course.cert_seq = current
    return f"{prefix}-{code}-{stamp}"[:64]
