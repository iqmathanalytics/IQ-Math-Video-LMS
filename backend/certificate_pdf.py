"""IQmath certificate PDFs using the Canva course and internship templates."""
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ASSETS = Path(__file__).resolve().parent / "certificate_assets"
DESIGN_W = 1122.51968503937
DESIGN_H = 793.7007874015748
INK = (52 / 255, 52 / 255, 52 / 255)
# Canva boxes: x, y from the top, width, height, and the design font size in px.
NAME_BOX = (245.73, 278.92, 631.06, 63.93, 53.33)
BODY_BOX = (144.89, 361.86, 832.75, 140, 21.33)

_fonts_ready = False


def _font_path(weight: str) -> Path:
    return ASSETS / f"LibreBaskerville-{weight}.ttf"


def _ensure_fonts():
    global _fonts_ready
    if _fonts_ready:
        return
    pdfmetrics.registerFont(TTFont("Baskerville", str(_font_path("Regular"))))
    pdfmetrics.registerFont(TTFont("Baskerville-Bold", str(_font_path("Bold"))))
    _fonts_ready = True


def _pil_font(weight: str, size: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(_font_path(weight)), size=max(8, size))


def certificate_body(course_title: str, description: str = "") -> str:
    """Course title, duration, and description become the paragraph under the name."""
    raw = description or ""
    duration = ""
    match = re.search(r"\[Duration:\s*([^\]]+)\]", raw, re.I)
    if match:
        duration = re.sub(r"\s+", " ", match.group(1)).strip()
        raw = (raw[: match.start()] + raw[match.end() :]).strip()
    program = re.sub(r"\s+", " ", (course_title or "this program")).strip()
    if duration and duration.lower() not in program.lower():
        program = f"{duration} {program}"
    lead = f"has successfully completed the {program} conducted by IQmath Technologies."
    detail = re.sub(r"\s+", " ", raw).strip()
    if len(detail) < 30:
        return (
            f"{lead} Throughout this intensive training, the recipient demonstrated "
            "comprehensive understanding of the subject matter covered in this program."
        )
    if detail.count(" ") >= 12:
        if detail[0].islower():
            detail = detail[0].upper() + detail[1:]
        if detail[-1] not in ".!?":
            detail += "."
        return f"{lead} {detail}"
    phrase = detail.rstrip(". ")
    if phrase[:1].isupper():
        phrase = phrase[0].lower() + phrase[1:]
    return (
        f"{lead} Throughout this intensive training, the recipient demonstrated "
        f"comprehensive understanding of {phrase}."
    )


def _template_for(course_name: str, course_type: str) -> Path:
    label = f"{course_name} {course_type}".lower()
    if "intern" in label:
        return ASSETS / "internship_completion.png"
    return ASSETS / "course_completion.png"


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, tracking: float = 0) -> float:
    width = draw.textlength(text, font=font)
    if tracking and len(text) > 1:
        width += tracking * (len(text) - 1)
    return width


def _wrap(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = []
    for word in words:
        trial = " ".join(current + [word])
        if current and _text_width(draw, trial, font) > max_width:
            lines.append(current)
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(current)
    return lines


def _fitted_body(draw, text, box):
    _x, _y, width, height, base_size = box
    size = base_size
    while size >= 13:
        font = _pil_font("Regular", size)
        leading = size * 1.52
        lines = _wrap(draw, text, font, width)
        if lines and len(lines) * leading <= height + 2:
            return font, leading, lines
        size -= 0.5
    font = _pil_font("Regular", 13)
    return font, 13 * 1.52, _wrap(draw, text, font, width)


def _fitted_name(draw, name, box):
    _x, _y, width, _height, base_size = box
    size = base_size
    tracking = size * 0.028
    font = _pil_font("Bold", size)
    while size > 22 and _text_width(draw, name, font, tracking) > width:
        size -= 1
        tracking = size * 0.028
        font = _pil_font("Bold", size)
    return font, tracking


def create_certificate_pdf(
    student_name: str,
    course_name: str,
    date_str: str = "",
    credential_id: str = "",
    description: str = "",
    course_type: str = "",
):
    """Landscape certificate. The Canva frame stays fixed; name and course text change."""
    _ensure_fonts()
    del date_str  # The issued date stays on the certificate record, not on this template.
    buffer = io.BytesIO()
    page = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=page)
    page_w, page_h = page
    scale = page_w / DESIGN_W
    template = Image.open(_template_for(course_name, course_type)).convert("RGB")
    pdf.drawImage(ImageReader(template), 0, 0, width=page_w, height=page_h, mask="auto")

    measure = ImageDraw.Draw(template)
    name = re.sub(r"\s+", " ", (student_name or "Student")).strip()
    name_font, tracking = _fitted_name(measure, name, NAME_BOX)
    name_size = name_font.size * scale
    name_x, name_y, name_w, name_h, _name_base = NAME_BOX
    name_width = _text_width(measure, name, name_font, tracking) * scale
    baseline = page_h - (name_y + name_h * 0.72) * scale
    pdf.setFillColorRGB(*INK)
    pdf.setFont("Baskerville-Bold", name_size)
    pdf.drawString(
        (name_x * scale) + (name_w * scale - name_width) / 2,
        baseline,
        name,
        charSpace=tracking * scale,
    )

    body = certificate_body(course_name, description)
    body_font, leading, lines = _fitted_body(measure, body, BODY_BOX)
    body_size = body_font.size * scale
    body_x, body_y, body_w, _body_h, _body_base = BODY_BOX
    pdf.setFont("Baskerville", body_size)
    pdf_leading = leading * scale
    top = page_h - (body_y + body_font.size * 0.8) * scale
    for index, words in enumerate(lines):
        line = " ".join(words)
        y = top - index * pdf_leading
        last = index == len(lines) - 1
        if last or len(words) == 1:
            pdf.drawString(body_x * scale, y, line)
            continue
        gaps = len(words) - 1
        words_width = sum(pdf.stringWidth(word, "Baskerville", body_size) for word in words)
        extra = ((body_w * scale) - words_width) / gaps
        cursor = body_x * scale
        for word_index, word in enumerate(words):
            pdf.drawString(cursor, y, word)
            cursor += pdf.stringWidth(word, "Baskerville", body_size) + extra

    pdf.setTitle(f"{course_name} — Certificate")
    pdf.setAuthor("IQmath Technologies")
    if credential_id:
        pdf.setSubject(credential_id)
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer
