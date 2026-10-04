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
# Top-right, level with the company logo band.
ID_TOP = 52.0
ID_RIGHT_INSET = 48.0
ID_FONT = 15.0

# Fixed wording for every course. Only {course_name} is replaced.
# Never use course description, Drive links, images, or other course fields.
CERTIFICATE_BODY = (
    "has successfully completed the {course_name} training program conducted by "
    "IQMath Technologies, demonstrating a strong understanding of the concepts "
    "and practical skills covered throughout the program."
)
COMPANY_NAME = "IQMath Technologies"

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


_DURATION_TAG = re.compile(r"\n*\[Duration:\s*[^\]]+\]", re.I)
_DURATION_LEAD = re.compile(
    r"^\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|h)(?:\s+\d+(?:\.\d+)?\s*(?:minutes?|mins?|m))?\s*[,:\-]?\s*",
    re.I,
)
_URL = re.compile(r"https?://\S+|www\.\S+|drive\.google\.com/\S+|docs\.google\.com/\S+", re.I)


def _clean_cert_text(value: str) -> str:
    text = _DURATION_TAG.sub(" ", value or "")
    text = _URL.sub(" ", text)
    text = _DURATION_LEAD.sub("", text)
    return re.sub(r"\s+", " ", text).strip(" -:|,")


def certificate_course_name(course_title: str) -> str:
    return _clean_cert_text(course_title or "this program") or "this program"


def certificate_body(course_title: str, description: str = "") -> str:
    """Fixed wording for every course. Only the course name changes."""
    del description
    return CERTIFICATE_BODY.format(course_name=certificate_course_name(course_title))


def certificate_body_runs(course_title: str) -> list[tuple[str, bool]]:
    """Body as (text, bold) runs — course name and company name are bold."""
    program = certificate_course_name(course_title)
    return [
        ("has successfully completed the ", False),
        (program, True),
        (" training program conducted by ", False),
        (COMPANY_NAME, True),
        (
            ", demonstrating a strong understanding of the concepts "
            "and practical skills covered throughout the program.",
            False,
        ),
    ]


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


def _tokenize_words(runs: list[tuple[str, bool]]) -> list[tuple[str, bool]]:
    words: list[tuple[str, bool]] = []
    for text, bold in runs:
        for part in text.split(" "):
            if part:
                words.append((part, bold))
    return words


def _wrap_runs(pdf, words: list[tuple[str, bool]], size: float, max_width: float) -> list[list[tuple[str, bool]]]:
    lines: list[list[tuple[str, bool]]] = []
    current: list[tuple[str, bool]] = []
    for word, bold in words:
        trial = current + [(word, bold)]
        width = 0.0
        for i, (token, token_bold) in enumerate(trial):
            token_font = "Baskerville-Bold" if token_bold else "Baskerville"
            if i:
                width += pdf.stringWidth(" ", "Baskerville", size)
            width += pdf.stringWidth(token, token_font, size)
        if current and width > max_width:
            lines.append(current)
            current = [(word, bold)]
        else:
            current.append((word, bold))
    if current:
        lines.append(current)
    return lines


def _fitted_body_runs(pdf, runs: list[tuple[str, bool]], box, scale: float):
    _x, _y, width, height, base_size = box
    max_width = width * scale
    max_height = (height + 2) * scale
    size = base_size * scale
    words = _tokenize_words(runs)
    while size >= 13 * scale:
        leading = size * 1.52
        lines = _wrap_runs(pdf, words, size, max_width)
        if lines and len(lines) * leading <= max_height:
            return size, leading, lines
        size -= 0.5 * scale
    size = 13 * scale
    return size, size * 1.52, _wrap_runs(pdf, words, size, max_width)


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
    """Landscape certificate. Same wording for every course; only name, course title, and ID change."""
    _ensure_fonts()
    del date_str
    del description
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

    body_x, body_y, body_w, _body_h, _body_base = BODY_BOX
    body_size, pdf_leading, lines = _fitted_body_runs(pdf, certificate_body_runs(course_name), BODY_BOX, scale)
    top = page_h - (body_y * scale) - (body_size * 0.8)
    for index, words in enumerate(lines):
        y = top - index * pdf_leading
        last = index == len(lines) - 1
        space_w = pdf.stringWidth(" ", "Baskerville", body_size)

        def token_width(token: str, bold: bool) -> float:
            return pdf.stringWidth(token, "Baskerville-Bold" if bold else "Baskerville", body_size)

        if last or len(words) == 1:
            cursor = body_x * scale
            for word_index, (word, bold) in enumerate(words):
                if word_index:
                    cursor += space_w
                pdf.setFont("Baskerville-Bold" if bold else "Baskerville", body_size)
                pdf.drawString(cursor, y, word)
                cursor += token_width(word, bold)
            continue
        gaps = len(words) - 1
        words_width = sum(token_width(word, bold) for word, bold in words)
        extra = ((body_w * scale) - words_width) / gaps if gaps else 0
        cursor = body_x * scale
        for word, bold in words:
            pdf.setFont("Baskerville-Bold" if bold else "Baskerville", body_size)
            pdf.drawString(cursor, y, word)
            cursor += token_width(word, bold) + extra

    if credential_id:
        cert_no = str(credential_id).strip()
        label = f"Certificate ID: {cert_no}"
        font_size = max(10, ID_FONT * scale)
        pdf.setFillColorRGB(*INK)
        pdf.setFont("Baskerville-Bold", font_size)
        while font_size > 9 and pdf.stringWidth(label, "Baskerville-Bold", font_size) > page_w * 0.45:
            font_size -= 0.5
            pdf.setFont("Baskerville-Bold", font_size)
        x = page_w - (ID_RIGHT_INSET * scale)
        y = page_h - (ID_TOP * scale)
        pdf.drawRightString(x, y, label)
        pdf.setSubject(cert_no)

    pdf.setTitle(f"{certificate_course_name(course_name)} — Certificate")
    pdf.setAuthor(COMPANY_NAME)
    pdf.setCreator("IQNex certificate-v3-fixed-body")
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer
