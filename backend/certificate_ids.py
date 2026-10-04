"""Build unique certificate IDs from an admin-configured template."""
from __future__ import annotations

import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models

TEMPLATE_KEY = "certificate_id_template"
SEQ_KEY = "certificate_id_seq"
DEFAULT_TEMPLATE = "IQ-{YYYY}-{SEQ:5}"
MAX_TEMPLATE_LEN = 80
_SEQ_TOKEN = re.compile(r"\{SEQ(?::(\d+))?\}", re.I)
_ALLOWED = re.compile(
    r"^[\w\-./]+$"
)

def validate_template(template: str) -> str:
    text = (template or "").strip()
    if not text:
        raise ValueError("Enter a certificate ID template.")
    if len(text) > MAX_TEMPLATE_LEN:
        raise ValueError(f"Keep the template under {MAX_TEMPLATE_LEN} characters.")
    if not _SEQ_TOKEN.search(text):
        raise ValueError("Template must include {SEQ} or {SEQ:n} so each ID stays unique.")
    # Allow tokens; validate remaining literal characters after stripping known tokens.
    stripped = text
    for token in ("{YYYY}", "{YY}", "{MM}", "{DD}", "{COURSE_ID}", "{USER_ID}"):
        stripped = stripped.replace(token, "X")
    stripped = _SEQ_TOKEN.sub("X", stripped)
    if not _ALLOWED.match(stripped):
        raise ValueError("Use letters, numbers, dash, underscore, dot, or slash besides tokens.")
    return text


def render_certificate_id(
    template: str,
    *,
    seq: int,
    user_id: int,
    course_id: int,
    when: datetime | None = None,
) -> str:
    when = when or datetime.utcnow()
    out = template
    out = out.replace("{YYYY}", f"{when.year:04d}")
    out = out.replace("{YY}", f"{when.year % 100:02d}")
    out = out.replace("{MM}", f"{when.month:02d}")
    out = out.replace("{DD}", f"{when.day:02d}")
    out = out.replace("{COURSE_ID}", str(course_id))
    out = out.replace("{USER_ID}", str(user_id))

    def _seq(match: re.Match[str]) -> str:
        width = int(match.group(1) or 5)
        width = max(1, min(width, 12))
        return f"{seq:0{width}d}"

    out = _SEQ_TOKEN.sub(_seq, out)
    return out[:64]


def preview_certificate_id(template: str, next_seq: int) -> str:
    return render_certificate_id(template, seq=next_seq, user_id=1, course_id=1)


async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    res = await db.execute(select(models.SiteSetting).where(models.SiteSetting.key == key))
    row = res.scalars().first()
    if row is None:
        return default
    return row.value


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    res = await db.execute(select(models.SiteSetting).where(models.SiteSetting.key == key))
    row = res.scalars().first()
    if row is None:
        db.add(models.SiteSetting(key=key, value=value))
    else:
        row.value = value


async def ensure_certificate_settings(db: AsyncSession) -> None:
    if not await get_setting(db, TEMPLATE_KEY, ""):
        await set_setting(db, TEMPLATE_KEY, DEFAULT_TEMPLATE)
    seq = await get_setting(db, SEQ_KEY, "")
    if seq == "":
        await set_setting(db, SEQ_KEY, "0")
    await db.commit()


async def next_certificate_id(db: AsyncSession, user_id: int, course_id: int) -> str:
    """Increment the site sequence and return a unique certificate ID."""
    await ensure_certificate_settings(db)
    template = await get_setting(db, TEMPLATE_KEY, DEFAULT_TEMPLATE)
    raw = await get_setting(db, SEQ_KEY, "0")
    try:
        current = int(raw or "0")
    except ValueError:
        current = 0
    for _ in range(8):
        current += 1
        candidate = render_certificate_id(template, seq=current, user_id=user_id, course_id=course_id)
        exists = await db.execute(
            select(models.UserCertificate).where(models.UserCertificate.certificate_id == candidate)
        )
        if exists.scalars().first():
            continue
        await set_setting(db, SEQ_KEY, str(current))
        return candidate
    # Extremely unlikely fallback
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    await set_setting(db, SEQ_KEY, str(current))
    return f"IQ-{stamp}-{user_id}-{course_id}"[:64]
