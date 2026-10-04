from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload 
from sqlalchemy import and_, delete, func, update
from pydantic import BaseModel
import bcrypt 
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
import models
from database import engine, get_db, AsyncSessionLocal # Importing the Async engine and dependency
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
import requests
import hashlib
import io
import json
import mimetypes
import os
import secrets
import smtplib
import random
import string
import pandas as pd     
import requests 
import razorpay
from certificate_pdf import create_certificate_pdf
import google.generativeai as genai 
import re  
import schemas
import random
import ssl
import sys
import backup_manager
from dotenv import load_dotenv
from pydantic import BaseModel
# --- 📄 PDF GENERATION IMPORTS ---
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

from database import engine, get_db
# 🟢 GOOGLE DRIVE IMPORTS
from google.auth.transport.requests import Request as GoogleRequest  # 👈 Rename this
from fastapi import Request  # 👈 Add this explicitly for FastAPI
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from sqlalchemy import text
from token_manager import TokenManager

# Load environment variables before any os.getenv reads.
load_dotenv()

AWS_LAMBDA_URL = os.getenv("AWS_LAMBDA_URL")

# 1. Initialize Database Tables (Async approach is slightly different, but for now we keep sync creation for simplicity or use Alembic in prod)
# For this setup, we will rely on the sync engine for table creation if needed, or assume tables exist.
# Ideally, use Alembic for migrations. For now, we will create tables using a temporary sync connection if not exists.
import asyncio

# Windows + async MySQL TLS can fail under Proactor loop (WinError 87).
# Force selector policy for stable TiDB SSL connectivity.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def init_models():
    async with engine.begin() as conn:
        # 1. Create tables if they don't exist
        await conn.run_sync(models.Base.metadata.create_all)
        
        # 2. ✅ AUTO-MIGRATION: Update existing tables (MySQL/TiDB only)
        if conn.dialect.name == "sqlite":
            async def sqlite_add(table: str, column: str, definition: str):
                info = await conn.execute(text(f"PRAGMA table_info({table})"))
                names = {row[1] for row in info.fetchall()}
                if column not in names:
                    await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {definition}"))
            for table, column, definition in (
                ("users", "phone_number", "phone_number VARCHAR(32)"),
                ("users", "college", "college VARCHAR(255)"),
                ("users", "organization", "organization VARCHAR(255)"),
                ("users", "social_media_link", "social_media_link VARCHAR(500)"),
                ("users", "is_active", "is_active BOOLEAN DEFAULT 1"),
                ("users", "created_at", "created_at TIMESTAMP"),
                ("users", "last_login", "last_login TIMESTAMP"),
                ("notifications", "is_read", "is_read BOOLEAN DEFAULT 0"),
                ("content_items", "resource_links", "resource_links TEXT"),
                ("course_assessments", "file_data", "file_data BLOB"),
                ("submissions", "file_data", "file_data BLOB"),
            ):
                try:
                    await sqlite_add(table, column, definition)
                except Exception as exc:
                    print(f"SQLite migration note ({table}.{column}): {exc}")
            return
        print("Checking for database migrations...")
        try:
            # Existing migrations
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS college VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_media_link VARCHAR(500);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;"))
            
            # 🆕 FIX FOR YOUR ERROR: Add last_login column
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;"))
            await conn.execute(text("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS resource_links TEXT;"))
            await conn.execute(text("ALTER TABLE courses MODIFY description TEXT;"))
            await conn.execute(text("ALTER TABLE content_items MODIFY content TEXT;"))
            await conn.execute(text("ALTER TABLE course_assessments ADD COLUMN IF NOT EXISTS file_data LONGBLOB;"))
            await conn.execute(text("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_data LONGBLOB;"))
            
            print("Database migrations applied successfully.")
        except Exception as e:
            print(f"Migration note: {e}")

        # One-time wipe of every notification for all users.
        try:
            await conn.execute(text(
                "CREATE TABLE IF NOT EXISTS app_flags ("
                "name VARCHAR(64) PRIMARY KEY, "
                "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
            ))
            flag = await conn.execute(text(
                "SELECT name FROM app_flags WHERE name = 'clear_all_notifications_v1' LIMIT 1"
            ))
            if flag.first() is None:
                await conn.execute(text("DELETE FROM notifications"))
                await conn.execute(text(
                    "INSERT INTO app_flags (name) VALUES ('clear_all_notifications_v1')"
                ))
                print("Cleared all notifications for every user.")
        except Exception as e:
            print(f"Notification clear note: {e}")
            
            
app = FastAPI(title="iQmath Pro - Military Grade API")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Initialize Auto-Refresh Service
token_manager = TokenManager()

DEMO_USERS = (
    ("student@iqmath.com", "Demo Student", "student", "9000000001"),
    ("instructor@iqmath.com", "Demo Instructor", "instructor", "9000000002"),
)

SAMPLE_WATCH = (
    ("Neural networks, explained · 3Blue1Brown", "aircAruvnKk"),
    ("Python for beginners · freeCodeCamp.org", "rfscVS0vtbw"),
    ("JavaScript for beginners · freeCodeCamp.org", "PkZNo7MFNFg"),
    ("Git and GitHub for beginners · freeCodeCamp.org", "RGOj5yH7evk"),
)

async def ensure_sample_watch():
    """Keep at least four YouTube sample lessons on the public watch list."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.WatchLesson))
        rows = result.scalars().all()
        existing = {row.youtube_id for row in rows}
        missing = 4 - len(rows)
        if missing <= 0:
            return
        for title, video_id in SAMPLE_WATCH:
            if video_id in existing:
                continue
            session.add(models.WatchLesson(title=title, youtube_id=video_id))
            missing -= 1
            if missing <= 0:
                break
        await session.commit()

async def ensure_demo_users():
    """Create local demo accounts when the app is running on SQLite."""
    if not str(engine.url).startswith("sqlite"):
        return
    async with AsyncSessionLocal() as session:
        for email, name, role, phone in DEMO_USERS:
            result = await session.execute(select(models.User).where(models.User.email == email))
            if result.scalars().first():
                continue
            session.add(models.User(
                email=email,
                full_name=name,
                hashed_password=await asyncio.to_thread(get_password_hash, "password123"),
                role=role,
                phone_number=phone,
                is_active=True,
            ))
        await session.commit()

_db_warm_task = None

async def warm_db_pool():
    async def ping():
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    await asyncio.gather(ping(), ping(), ping())

async def keep_db_warm():
    while True:
        await asyncio.sleep(20)
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            pass

# Run DB Init on Startup
@app.on_event("startup")
async def on_startup():
    global _db_warm_task
    async def prepare():
        try:
            await init_models()
            await ensure_sample_watch()
            await ensure_demo_users()
            await warm_db_pool()
        except Exception as exc:
            print(f"Database prepare: {exc}")
    asyncio.create_task(prepare())
    _db_warm_task = asyncio.create_task(keep_db_warm())
    token_manager.start()

@app.on_event("shutdown")
async def on_shutdown():
    if _db_warm_task:
        _db_warm_task.cancel()
    token_manager.stop()

# 2. CONFIG: CORS POLICY
# Credentials and a wildcard origin cannot be combined.
# Set ALLOWED_ORIGINS (comma-separated) and FRONTEND_URL to the Cloudflare site.
def _cors_origins() -> list[str]:
    defaults = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    origins = [
        item.strip().rstrip("/")
        for item in os.getenv("ALLOWED_ORIGINS", defaults).split(",")
        if item.strip()
    ]
    frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend and frontend not in origins:
        origins.append(frontend)
    return origins

_origins = _cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 🔐 SECURITY & AUTH CONFIG ---
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "fallback_secret_change_me_in_prod":
    raise RuntimeError("Set a unique SECRET_KEY in backend/.env before starting the API.")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="api/v1/login", auto_error=False) 

# --- 💳 RAZORPAY ---
def _razorpay_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1].strip()
    lowered = value.lower()
    if not value or lowered in {"replace_me", "change_me"} or lowered.startswith("your_"):
        return ""
    return value

RAZORPAY_KEY_ID = _razorpay_env("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = _razorpay_env("RAZORPAY_KEY_SECRET")
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET else None

def razorpay_failure(exc: Exception) -> HTTPException:
    message = str(exc)
    print(f"Razorpay order failed: {type(exc).__name__}")
    if "authentication" in message.lower():
        return HTTPException(
            status_code=502,
            detail="Razorpay rejected this live key. In the Razorpay dashboard, open the same live key and copy its current Key Secret into RAZORPAY_KEY_SECRET in backend/.env, then restart the API.",
        )
    if isinstance(exc, requests.exceptions.ConnectionError):
        return HTTPException(status_code=502, detail="The Razorpay service could not be reached. Try the payment again in a moment.")
    return HTTPException(status_code=502, detail="Razorpay did not create the order. Check the live key and secret, then try again.")

def configured_secret(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    lowered = value.lower()
    if not value or lowered in {"replace_me", "change_me"} or lowered.startswith("your_"):
        return ""
    return value

# --- ✨ GEMINI AI ---
GEMINI_API_KEY = configured_secret("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL) if GEMINI_API_KEY else None

# --- 📋 DATA MODELS ---
# (Keeping your existing Pydantic models)
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str
    phone_number: Optional[str] = None

class ModuleCreate(BaseModel):
    title: str; order: int

class ReorderModulesRequest(BaseModel):
    module_ids: List[int]

class ResourceLinkInput(BaseModel):
    title: str
    link: str

class ContentCreate(BaseModel):
    title: str; type: str; data_url: Optional[str] = None; duration: Optional[int] = None; 
    is_mandatory: bool = False; instructions: Optional[str] = None; test_config: Optional[str] = None; module_id: int
    resource_links: Optional[List[ResourceLinkInput]] = None
    # ✅ NEW
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class ViolationReport(BaseModel):
    lesson_id: int
    
class StatusUpdate(BaseModel):
    status: str 

class Token(BaseModel):
    access_token: str; token_type: str; role: str
    
class AssignmentSubmission(BaseModel):
    link: str; lesson_id: int

class AdmitStudentRequest(BaseModel):
    full_name: str; email: str; course_ids: List[int]; password: Optional[str] = None 

class EnrollmentRequest(BaseModel):
    type: str 

class CreateOrderRequest(BaseModel):
    course_id: int

class PaymentVerifyRequest(BaseModel):
    course_id: int
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

class PasswordChange(BaseModel):
    new_password: str
    current_password: str

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    college: Optional[str] = None
    organization: Optional[str] = None
    social_media_link: Optional[str] = None

class AssignCoursesRequest(BaseModel):
    course_ids: List[int]
    emails: Optional[List[str]] = None
    college: Optional[str] = None
    organization: Optional[str] = None

class AdminPasswordReset(BaseModel):
    new_password: str

# Code Test Models
class ProblemSchema(BaseModel):
    title: str; description: str; difficulty: str; test_cases: str 

class CodeTestCreate(BaseModel):
    title: str; pass_key: str; time_limit: int; problems: List[ProblemSchema]

class TestSubmission(BaseModel):
    test_id: int
    score: Optional[int] = None
    problems_solved: Optional[int] = None
    time_taken: str = "Finished"

class ContentUpdate(BaseModel):
    title: Optional[str] = None; url: Optional[str] = None; resource_links: Optional[List[ResourceLinkInput]] = None

class LibraryBulkAddRequest(BaseModel):
    module_id: int
    item_ids: List[int]

class LibraryImportModulesRequest(BaseModel):
    target_course_id: int
    module_ids: List[int]

class CodeExecutionRequest(BaseModel):
    source_code: str; stdin: str; language_id: int = 71
    
class AIGenerateRequest(BaseModel):
    title: str

class LiveSessionRequest(BaseModel):
    youtube_url: str; topic: str

class CourseCreate(BaseModel):
    title: str; description: str; price: int; image_url: Optional[str] = None
    course_type: str = "standard"; language: Optional[str] = None

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    image_url: Optional[str] = None
    language: Optional[str] = None
    # If your DB has a duration column, add it here. If not, remove this line.
    # duration: Optional[str] = None

class ChallengeCreate(BaseModel):
    title: str; description: str; difficulty: str; test_cases: str
 
class ConfirmationRequest(BaseModel):
    lesson_id: int
    lesson_title: str = ""
    file_name: str = ""

class CodePayload(BaseModel):
    source_code: str
    language_id: int
    # ✅ NEW: Accepts a list of test cases (Batch Execution)
    # Example: [{"input": "5", "output": "25"}, {"input": "10", "output": "100"}]
    test_cases: List[Dict[str, Any]]
    # When both set, server loads canonical cases from DB (Code Arena integrity)
    code_test_id: Optional[int] = None
    problem_id: Optional[int] = None
    challenge_id: Optional[int] = None
    # "dry_run" = only non-hidden cases (when loading from DB)
    execution_mode: Optional[str] = None

class OTPLoginRequest(BaseModel):
    phone_number: str
    
    
class ModuleUpdate(BaseModel):
    title: str

class NotificationRequest(BaseModel):
    target_type: str  # "all", "course", "student"
    target_id: Optional[int] = None # course_id or user_id
    message: str

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime
        
class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    test_cases: Optional[str] = None

def normalize_resource_links(resource_links: Optional[List[ResourceLinkInput]]) -> List[Dict[str, str]]:
    cleaned: List[Dict[str, str]] = []
    for item in resource_links or []:
        title = (item.title or "").strip()
        link = (item.link or "").strip()
        if title and link:
            cleaned.append({"title": title, "link": link})
    return cleaned

def parse_resource_links(raw_links: Optional[str]) -> List[Dict[str, str]]:
    if not raw_links:
        return []
    try:
        parsed = json.loads(raw_links)
        if isinstance(parsed, list):
            parsed_links: List[Dict[str, str]] = []
            for entry in parsed:
                # Backward compatibility for old shape: ["https://..."]
                if isinstance(entry, str):
                    link = entry.strip()
                    if link:
                        parsed_links.append({"title": link, "link": link})
                    continue

                if isinstance(entry, dict):
                    title = str(entry.get("title", "")).strip()
                    link = str(entry.get("link", entry.get("url", ""))).strip()
                    if link:
                        parsed_links.append({"title": title or link, "link": link})
            return parsed_links
    except Exception:
        return []
    return []
        
# --- 🔑 AUTH LOGIC ---
def verify_password(plain_password, hashed_password):
    if isinstance(hashed_password, str): hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# 🔒 ASYNC AUTH DEPENDENCY
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise HTTPException(status_code=401, detail="Invalid session")
    except JWTError: raise HTTPException(status_code=401, detail="Session expired")
    
    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalars().first()
    
    if user is None or user.is_active is False:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: AsyncSession = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
    except JWTError:
        return None
    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalars().first()
    if user is None or user.is_active is False:
        return None
    return user

async def require_instructor(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "instructor":
        raise HTTPException(status_code=403, detail="⛔ Access Forbidden: Instructors Only")
    return current_user

async def require_student(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="⛔ Access Forbidden: Students Only")
    return current_user

def guess_mime(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename or "")
    return guessed or "application/octet-stream"

def file_attachment(data: bytes, filename: str) -> Response:
    return Response(
        content=data,
        media_type=guess_mime(filename),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

def safe_storage_name(user_id: int, original: str, suffix_hint: str = "") -> str:
    base = os.path.basename(original or "upload")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)[:80] or "upload"
    stamp = int(datetime.utcnow().timestamp())
    extra = suffix_hint or os.path.splitext(base)[1].lower()
    if extra and not base.endswith(extra):
        base = f"{base}{extra}"
    return f"{user_id}_{stamp}_{base}"

def visible_test_cases(raw: Optional[str]) -> str:
    try:
        cases = json.loads(raw or "[]")
    except Exception:
        return "[]"
    visible = []
    for case in cases if isinstance(cases, list) else []:
        if not isinstance(case, dict) or case.get("hidden"):
            continue
        visible.append({
            "input": case.get("input", case.get("stdin", "")),
            "output": case.get("output", case.get("expected", "")),
            "hidden": False,
        })
    return json.dumps(visible)

def course_brief(course: models.Course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "price": course.price,
        "image_url": course.image_url,
        "is_published": bool(course.is_published),
        "course_type": course.course_type,
        "language": course.language,
        "instructor_id": course.instructor_id,
    }

async def load_owned_course(course_id: int, user: models.User, db: AsyncSession) -> models.Course:
    res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

async def course_of_item(item_id: int, db: AsyncSession):
    res = await db.execute(
        select(models.Course, models.ContentItem)
        .join(models.Module, models.Module.course_id == models.Course.id)
        .join(models.ContentItem, models.ContentItem.module_id == models.Module.id)
        .where(models.ContentItem.id == item_id)
    )
    return res.first()

async def require_enrolment(user: models.User, course_id: int, db: AsyncSession):
    res = await db.execute(select(models.Enrollment).where(
        models.Enrollment.user_id == user.id,
        models.Enrollment.course_id == course_id,
    ))
    row = res.scalars().first()
    if not row:
        raise HTTPException(status_code=403, detail="Enrol in this course first.")
    if row.enrollment_type == "trial" and row.expiry_date and datetime.utcnow() > row.expiry_date:
        raise HTTPException(status_code=402, detail="Trial expired")
    return row

async def remember_attempt(db: AsyncSession, user_id: int, passed: int, total: int, code_test_id=None, problem_id=None, challenge_id=None):
    query = select(models.CodeAttempt).where(models.CodeAttempt.user_id == user_id)
    if problem_id is not None:
        query = query.where(models.CodeAttempt.problem_id == problem_id, models.CodeAttempt.code_test_id == code_test_id)
    elif challenge_id is not None:
        query = query.where(models.CodeAttempt.challenge_id == challenge_id)
    else:
        return
    existing = (await db.execute(query)).scalars().first()
    if not existing:
        existing = models.CodeAttempt(
            user_id=user_id,
            code_test_id=code_test_id,
            problem_id=problem_id,
            challenge_id=challenge_id,
        )
        db.add(existing)
    existing.passed = passed
    existing.total = total
    existing.all_passed = total > 0 and passed == total
    existing.updated_at = datetime.utcnow()
    await db.commit()

def generate_random_password(length=8):
    characters = string.ascii_letters + string.digits + "!@#$"
    return ''.join(random.choice(characters) for i in range(length))

# --- UTILITIES ---
# backend/main.py

# In backend/main.py

def send_credentials_email(to_email: str, name: str, password: str = None, subject: str = None, body: str = None):
    # 1. Get Config
    api_key = configured_secret("BREVO_API_KEY")
    sender_email = os.getenv("EMAIL_SENDER")
    
    print(f"[BREVO API] Preparing to send to: {to_email}")

    if not api_key or not sender_email:
        raise Exception("BREVO_API_KEY or EMAIL_SENDER is not configured")

    # 2. Define the URL (Port 443 - Bypasses Render Firewall)
    url = "https://api.brevo.com/v3/smtp/email"

    # 3. Construct Content
    if not subject:
        subject = "Welcome to iQmath! Your Credentials"
    
    if not body:
        html_content = f"""
        <html>
        <body>
            <h1>Welcome {name}!</h1>
            <p>You have been admitted to iQmath Pro.</p>
            <p><strong>User ID:</strong> {to_email}</p>
            <p><strong>Password:</strong> {password}</p>
            <br/>
            <p>Happy Learning!</p>
        </body>
        </html>
        """
    else:
        # If body is passed from OTP logic
        html_content = f"<p>{body}</p>".replace("\n", "<br>")

    # 4. Create Payload
    payload = {
        "sender": {"name": "iQmath Admin", "email": sender_email},
        "to": [{"email": to_email, "name": name}],
        "subject": subject,
        "htmlContent": html_content
    }

    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }

    # 5. Send Request
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=4)
        
        if response.status_code == 201:
            print(f"[BREVO API] SUCCESS: Email sent! ID: {response.json().get('messageId')}")
        else:
            print(f"[BREVO API] FAILED: {response.status_code} - {response.text}")
            # Raise exception so the calling function knows it failed
            raise Exception(f"API Error: {response.text}")
            
    except Exception as e:
        print(f"[BREVO API] NETWORK ERROR: {str(e)}")
        raise e  
def upload_file_to_drive(file_obj, filename, folder_link):
    # (Drive logic remains mostly same, executed in thread pool usually by FastAPI)
    try:
        folder_id = folder_link
        if "drive.google.com" in folder_link: folder_id = folder_link.split("/")[-1].split("?")[0]
        
        creds = None
        if os.path.exists('token.json'): creds = Credentials.from_authorized_user_file('token.json', ['https://www.googleapis.com/auth/drive.file'])
        
        if not creds or not creds.valid:
           if creds and creds.expired and creds.refresh_token:
               creds.refresh(GoogleRequest())
               # Save the refreshed token
               with open('token.json', 'w') as token:
                   token.write(creds.to_json())
           else:
               print("Creds invalid and no refresh token")
               return None

        service = build('drive', 'v3', credentials=creds)
        file_metadata = { 'name': filename, 'parents': [folder_id] }
        media = MediaIoBaseUpload(file_obj, mimetype=guess_mime(filename), resumable=True)
        uploaded_file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        return uploaded_file.get('id')
    except Exception as e:
        print(f"Drive Error: {e}")
        return None


# --- 🔄 ASYNC LOGIC HELPERS ---
# --- 🔄 UPDATED LOGIC: Strict 100% Completion Check ---
async def check_progress_status(user_id: int, course_id: int, db: AsyncSession):
    """
    Returns (completed_count, total_count, is_fully_completed)
    """
    # 1. Get ALL items in the course
    # We join Course -> Module -> ContentItem to get the total list
    result = await db.execute(
        select(models.ContentItem.id)
        .join(models.Module, models.ContentItem.module_id == models.Module.id)
        .where(models.Module.course_id == course_id)
    )
    all_item_ids = result.scalars().all()
    total_items = len(all_item_ids)
    
    if total_items == 0:
        return 0, 0, False

    # 2. Get User's Completed Items
    # We filter LessonProgress for this user and these specific items
    progress_res = await db.execute(
        select(models.LessonProgress.content_item_id)
        .where(
            models.LessonProgress.user_id == user_id, 
            models.LessonProgress.is_completed == True,
            models.LessonProgress.content_item_id.in_(all_item_ids)
        )
    )
    completed_ids = progress_res.scalars().all()
    completed_count = len(completed_ids)

    # 3. Check if 100% complete
    is_fully_completed = completed_count == total_items
    
    return completed_count, total_items, is_fully_completed

async def generate_certificate_record(user_id: int, course_id: int, db: AsyncSession):
    # Check if cert already exists
    cert_check = await db.execute(select(models.UserCertificate).where(
        models.UserCertificate.user_id == user_id, 
        models.UserCertificate.course_id == course_id
    ))
    if cert_check.scalars().first():
        return True # Already exists

    # Create new cert
    new_cert = models.UserCertificate(
        user_id=user_id, 
        course_id=course_id, 
        certificate_id=f"IQ-LMS-{user_id:04d}{course_id:03d}"
    )
    db.add(new_cert)
    await db.commit()
    return True
# --- 🚀 ASYNC API ENDPOINTS ---

@app.post("/api/v1/users", status_code=201)
@limiter.limit("8/minute")
async def create_user(request: Request, user: UserCreate, db: AsyncSession = Depends(get_db)):
    # Public signup is always a learner. Instructor accounts are created by seed or admit tools.
    result = await db.execute(select(models.User).where(models.User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(user.password or "") < 8:
        raise HTTPException(status_code=400, detail="Use at least 8 characters.")
    
    new_user = models.User(
        email=user.email, 
        hashed_password=await asyncio.to_thread(get_password_hash, user.password), 
        full_name=user.name, 
        role="student",
        phone_number=user.phone_number
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3. 📧 SEND OTP EMAIL
    otp_code = str(random.randint(100000, 999999))
    custom_subject = "Welcome to iQmath! Verify your account"
    custom_body = f"Hello {user.name},\n\nWelcome to iQmath Pro!\n\nYour Account Status: ACTIVE\n\n(If you need an OTP for verification, here it is: {otp_code})\n\nHappy Learning!"

    try:
        # Run in thread so it doesn't block
        await asyncio.to_thread(
            send_credentials_email, 
            to_email=user.email, 
            name=user.name, 
            password=None, 
            subject=custom_subject, 
            body=custom_body
        )
        email_status = "sent"
        email_warning = None
    except Exception as e:
        print(f"Email failed: {e}")
        # Do not fail signup if email provider is misconfigured.
        email_status = "failed"
        email_warning = str(e)

    return {
        "message": "User created successfully",
        "email_status": email_status,
        "email_warning": email_warning
    }

@app.post("/api/v1/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not await asyncio.to_thread(verify_password, form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact support.")
    
    user.last_login = datetime.utcnow()
    await db.commit()
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}
@app.post("/api/v1/admin/admit-student")
async def admit_single_student(req: AdmitStudentRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # 1. Check if student exists
    result = await db.execute(select(models.User).where(models.User.email == req.email))
    student = result.scalars().first()
    
    final_password = req.password if req.password else generate_random_password()
    is_new_user = False
    email_status = "skipped"

    # 2. Create User if New
    if not student:
        is_new_user = True
        
        # ✅ CRITICAL: Send Email FIRST. If this fails, we want to know immediately.
        # Running in a thread to keep it non-blocking but synchronous for the logic flow.
        try:
            await asyncio.to_thread(send_credentials_email, req.email, req.full_name, final_password)
            email_status = "sent"
        except Exception as e:
            # If email fails, we STOP here. We do NOT create the user. 
            # This forces you to fix the email issue instead of creating "broken" users.
            print(f"Aborting user creation because email failed: {e}")
            raise HTTPException(status_code=500, detail=f"Email failed: {str(e)}")

        # If email succeeded, NOW create the user
        student = models.User(
            email=req.email, 
            full_name=req.full_name, 
            hashed_password=await asyncio.to_thread(get_password_hash, final_password), 
            role="student",
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)
    
    # 3. Enroll in Courses
    enrolled = []
    for cid in req.course_ids:
        check = await db.execute(select(models.Enrollment).where(models.Enrollment.user_id == student.id, models.Enrollment.course_id == cid))
        if not check.scalars().first():
            db.add(models.Enrollment(user_id=student.id, course_id=cid))
            enrolled.append(cid)
    
    await db.commit()

    if is_new_user:
        return {"message": f"User created & Email Sent! Enrolled in {len(enrolled)} courses.", "email_status": email_status}
    else:
        return {"message": f"Existing user enrolled.", "email_status": email_status}
    
@app.post("/api/v1/admin/bulk-admit")
async def bulk_admit_students(file: UploadFile = File(...), course_id: int = Form(...), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith('.csv') else pd.read_excel(io.BytesIO(contents))
    except: 
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload CSV or Excel.")
    
    # Normalize headers
    df.columns = [c.lower().strip() for c in df.columns]
    if "email" not in df.columns: 
        raise HTTPException(status_code=400, detail="Missing 'email' column in file.")
    
    count = 0
    failed = []
    touched_ids = []

    for _, row in df.iterrows():
        email = str(row["email"]).strip()
        name = str(row.get("name", "Student"))
        
        if not email or email.lower() == "nan": continue
        
        res = await db.execute(select(models.User).where(models.User.email == email))
        student = res.scalars().first()
        
        if not student:
            bulk_password = generate_random_password()
            try:
                await asyncio.to_thread(send_credentials_email, email, name, bulk_password)
            except Exception as exc:
                print(f"Skipping {email}: {exc}")
                failed.append(email)
                continue
            student = models.User(
                email=email, 
                full_name=name, 
                hashed_password=await asyncio.to_thread(get_password_hash, bulk_password), 
                role="student"
            )
            db.add(student)
            await db.commit()
            await db.refresh(student)
        
        enrol_check = await db.execute(select(models.Enrollment).where(
            models.Enrollment.user_id == student.id, 
            models.Enrollment.course_id == course_id
        ))
        
        if not enrol_check.scalars().first():
            db.add(models.Enrollment(user_id=student.id, course_id=course_id))
            count += 1
        touched_ids.append(student.id)
    
    await db.commit()
    return {
        "message": f"Enrolled {count} students. {len(failed)} new accounts were not created because the welcome email failed.",
        "failed_emails": failed,
    }

@app.post("/api/v1/ai/generate-challenge")
async def generate_problem_content(req: AIGenerateRequest, current_user: models.User = Depends(require_instructor)):
    if not GEMINI_API_KEY or model is None:
        raise HTTPException(status_code=503, detail="Set a real GEMINI_API_KEY on the API service. A placeholder value cannot generate challenges.")
    try:
        prompt = f"""Create a programming challenge on "{req.title}". OUTPUT JSON ONLY: {{ "description": "...", "test_cases": [ {{"input": "...", "output": "...", "hidden": false}} ] }}"""
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if not match: raise ValueError("Invalid JSON")
        ai_data = json.loads(match.group())
        return { "description": ai_data.get("description"), "test_cases": json.dumps(ai_data.get("test_cases", [])) }
    except Exception as e: raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/v1/code-tests")
async def create_code_test(test: CodeTestCreate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    new_test = models.CodeTest(title=test.title, pass_key=test.pass_key, time_limit=test.time_limit, instructor_id=current_user.id)
    db.add(new_test)
    await db.commit()
    await db.refresh(new_test)
    
    for prob in test.problems:
        new_prob = models.Problem(test_id=new_test.id, title=prob.title, description=prob.description, difficulty=prob.difficulty, test_cases=prob.test_cases)
        db.add(new_prob)
    await db.commit()
    return {"message": "Test Created Successfully!"}

@app.get("/api/v1/courses/{course_id}")
async def get_course_details(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    result = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role != "instructor" and not course.is_published:
        raise HTTPException(status_code=403, detail="This course is not published.")
    return course_brief(course)

@app.get("/api/v1/code-tests")
async def get_code_tests(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Instructor View: Show ALL their created tests
    if current_user.role == "instructor": 
        res = await db.execute(select(models.CodeTest).where(models.CodeTest.instructor_id == current_user.id))
        return res.scalars().all()
    
    # 2. Student View: Show ONLY Pending/Active tests
    res = await db.execute(select(models.CodeTest))
    tests = res.scalars().all()
    
    response_data = []
    
    for t in tests:
        # Check if a result already exists for this student + test
        sub_res = await db.execute(select(models.TestResult).where(
            models.TestResult.test_id == t.id, 
            models.TestResult.user_id == current_user.id
        ))
        submission = sub_res.scalars().first()
        
        # ✅ LOGIC CHANGE: If submission exists (Completed/Terminated), SKIP IT.
        if submission:
            continue
            
        # If no submission, add to list (Available to take)
        response_data.append({ 
            "id": t.id, 
            "title": t.title, 
            "time_limit": t.time_limit, 
            "completed": False 
        })
        
    return response_data
@app.post("/api/v1/code-tests/{test_id}/start")
async def start_code_test(test_id: int, pass_key: str = Form(...), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify not submitted
    res = await db.execute(select(models.TestResult).where(models.TestResult.test_id == test_id, models.TestResult.user_id == current_user.id))
    if res.scalars().first(): raise HTTPException(status_code=403, detail="Test already submitted.")
    
    # Eager load problems
    res_test = await db.execute(select(models.CodeTest).options(selectinload(models.CodeTest.problems)).where(models.CodeTest.id == test_id))
    test = res_test.scalars().first()
    
    if not test: raise HTTPException(status_code=404)
    if test.pass_key != pass_key: raise HTTPException(status_code=403, detail="Invalid Key")
    
    return { "id": test.id, "title": test.title, "time_limit": test.time_limit, "problems": [{"id": p.id, "title": p.title, "description": p.description, "test_cases": visible_test_cases(p.test_cases)} for p in test.problems] }

@app.post("/api/v1/code-tests/submit")
async def submit_test_result(sub: TestSubmission, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    test_res = await db.execute(select(models.CodeTest).options(selectinload(models.CodeTest.problems)).where(models.CodeTest.id == sub.test_id))
    test = test_res.scalars().first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    already = await db.execute(select(models.TestResult).where(models.TestResult.test_id == sub.test_id, models.TestResult.user_id == current_user.id))
    if already.scalars().first():
        raise HTTPException(status_code=403, detail="Test already submitted.")
    problems = list(test.problems or [])
    attempt_res = await db.execute(select(models.CodeAttempt).where(
        models.CodeAttempt.user_id == current_user.id,
        models.CodeAttempt.code_test_id == sub.test_id,
    ))
    attempts = {row.problem_id: row for row in attempt_res.scalars().all()}
    solved = sum(1 for problem in problems if attempts.get(problem.id) and attempts[problem.id].all_passed)
    total = len(problems)
    score = round(100 * solved / total) if total else 0
    result = models.TestResult(
        test_id=sub.test_id,
        user_id=current_user.id,
        score=score,
        problems_solved=solved,
        time_taken=sub.time_taken or "Finished",
    )
    db.add(result)
    await db.commit()
    return {"message": "Submitted", "score": score, "problems_solved": solved}

@app.get("/api/v1/code-tests/{test_id}/results")
async def get_test_results(test_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # Eager load student details
    res = await db.execute(select(models.TestResult).options(selectinload(models.TestResult.student)).where(models.TestResult.test_id == test_id))
    results = res.scalars().all()
    return [{"student_name": r.student.full_name, "email": r.student.email, "score": r.score, "problems_solved": r.problems_solved, "time_taken": r.time_taken, "submitted_at": r.submitted_at.strftime("%Y-%m-%d %H:%M")} for r in results]

@app.delete("/api/v1/code-tests/{test_id}")
async def delete_code_test(test_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.CodeTest).where(models.CodeTest.id == test_id))
    test = res.scalars().first()
    if not test:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if test.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.execute(delete(models.TestResult).where(models.TestResult.test_id == test_id))
    await db.execute(delete(models.Problem).where(models.Problem.test_id == test_id))
    await db.execute(delete(models.CodeTest).where(models.CodeTest.id == test_id))
    await db.commit()
    return {"message": "Challenge deleted"}


def _normalize_judge_text(s: Any) -> str:
    if s is None:
        return ""
    t = str(s).replace("\r\n", "\n").replace("\r", "\n").strip()
    return t


def _pick_output_for_single_line_expected(actual: str, expected: str) -> str:
    """If expected is one logical line but actual has many (prints + answer), compare the last non-empty line."""
    a = _normalize_judge_text(actual)
    e = _normalize_judge_text(expected)
    if not e or "\n" in e:
        return a
    if "\n" in a:
        lines = [ln.strip() for ln in a.split("\n") if ln.strip() != ""]
        if lines:
            return lines[-1]
    return a


def _try_parse_judge_number(s: str) -> Optional[float]:
    s = s.strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _judge_outputs_equal(raw_actual: str, raw_expected: str) -> Tuple[bool, str, str]:
    """
    Returns (passed, display_actual, display_expected).
    Aligns with Code Arena / Pyodide: tolerate extra prints, whitespace, and numeric formatting.
    """
    e = _normalize_judge_text(raw_expected)
    if e == "":
        return False, _normalize_judge_text(raw_actual), e
    a = _normalize_judge_text(_pick_output_for_single_line_expected(raw_actual, e))
    e = _normalize_judge_text(e)
    if a == e:
        return True, a, e
    if " ".join(a.split()) == " ".join(e.split()):
        return True, a, e
    na, ne = _try_parse_judge_number(a), _try_parse_judge_number(e)
    if na is not None and ne is not None:
        if na == ne or abs(na - ne) < 1e-9:
            return True, a, e
    return False, a, e


async def _resolve_execute_test_cases(
    payload: CodePayload, db: AsyncSession, current_user: models.User
) -> List[Dict[str, Any]]:
    """Use DB-backed cases for Code Arena when IDs are provided; otherwise trust the client list."""
    if payload.code_test_id is None or payload.problem_id is None:
        if payload.challenge_id is None:
            return payload.test_cases
        ch_res = await db.execute(select(models.CourseChallenge).where(models.CourseChallenge.id == payload.challenge_id))
        challenge = ch_res.scalars().first()
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        if current_user.role == "student":
            await require_enrolment(current_user, challenge.course_id, db)
        elif current_user.role == "instructor":
            await load_owned_course(challenge.course_id, current_user, db)
        else:
            raise HTTPException(status_code=403, detail="Not authorized")
        try:
            cases = json.loads(challenge.test_cases or "[]")
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid stored test cases")
        if payload.execution_mode == "dry_run":
            cases = [c for c in cases if not c.get("hidden")]
        return cases

    prob_res = await db.execute(select(models.Problem).where(models.Problem.id == payload.problem_id))
    prob = prob_res.scalars().first()
    if not prob or prob.test_id != payload.code_test_id:
        raise HTTPException(status_code=400, detail="Invalid problem or code test")

    ct_res = await db.execute(select(models.CodeTest).where(models.CodeTest.id == payload.code_test_id))
    code_test = ct_res.scalars().first()
    if not code_test:
        raise HTTPException(status_code=404, detail="Code test not found")

    if current_user.role == "instructor":
        if code_test.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "student":
        done = await db.execute(
            select(models.TestResult).where(
                models.TestResult.test_id == payload.code_test_id,
                models.TestResult.user_id == current_user.id,
            )
        )
        if done.scalars().first():
            raise HTTPException(status_code=403, detail="Test already submitted")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        cases: List[Dict[str, Any]] = json.loads(prob.test_cases)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid stored test cases")

    if payload.execution_mode == "dry_run":
        cases = [c for c in cases if not c.get("hidden")]
    return cases


# Judge0 Execution (Async Request) -> Replaced with AWS Lambda Proxy
@app.post("/api/v1/execute")
async def execute_code(
    payload: CodePayload,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not AWS_LAMBDA_URL:
        raise HTTPException(status_code=500, detail="Compiler Configuration Error (Missing AWS URL)")

    test_cases = await _resolve_execute_test_cases(payload, db, current_user)
    tc_count = len(test_cases)

    if tc_count == 0:
        return {"error": "No test cases to run for this request.", "stats": {"passed": 0, "total": 0}, "results": []}

    try:
        # 1. Forward to AWS Lambda (The Runner)
        # We assume Lambda returns a list of results with "actual" output
        response = await asyncio.to_thread(
            requests.post,
            AWS_LAMBDA_URL,
            json={
                "source_code": payload.source_code,
                "language_id": payload.language_id,
                "test_cases": test_cases,
                "stdin": "",
            },
            timeout=15,
        )
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            return {
                "error": "Compiler returned invalid JSON.",
                "stats": {"passed": 0, "total": tc_count},
                "results": [],
            }

        # Handle AWS API Gateway wrapping
        if isinstance(data, dict) and "body" in data:
            body = data.get("body")
            if isinstance(body, str):
                try:
                    data = json.loads(body)
                except json.JSONDecodeError:
                    return {
                        "error": "Compiler `body` field is not valid JSON.",
                        "stats": {"passed": 0, "total": tc_count},
                        "results": [],
                    }
            else:
                data = body

        # Lambda Function URL often returns a bare JSON string (e.g. "Hello from Lambda!")
        if isinstance(data, str):
            return {
                "error": "Compiler service is not returning the code-runner JSON format (got plain text or a JSON string). The Lambda must return an object with `results` and `stats`.",
                "detail": data[:400],
                "stats": {"passed": 0, "total": tc_count},
                "results": [],
            }

        if not isinstance(data, dict):
            return {
                "error": "Compiler returned an unexpected response type.",
                "stats": {"passed": 0, "total": tc_count},
                "results": [],
            }

        # --- 🛡️ THE FIX: BACKEND VERIFICATION LAYER ---
        # The Lambda runs the code, but we (the Backend) will GRADE it.
        # This fixes the issue where Java/C "passes" without actually matching the output.

        results_list = data.get("results")
        if not isinstance(results_list, list):
            results_list = []

        if len(results_list) == 0:
            return {
                "error": data.get("error")
                or "Compiler did not return a `results` array. Update the Lambda to return one entry per test case with `input`, `expected`, `actual`, and optional `status`.",
                "stats": {"passed": 0, "total": tc_count},
                "results": [],
            }

        passed_count = 0

        for i, res in enumerate(results_list):
            if not isinstance(res, dict):
                continue
            rid = res.get("id")
            idx = rid if isinstance(rid, int) and 0 <= rid < len(test_cases) else i
            if idx < 0 or idx >= len(test_cases):
                idx = i if i < len(test_cases) else len(test_cases) - 1
            tc = test_cases[idx] if isinstance(test_cases[idx], dict) else {}

            # DB / Code Arena store expected value as "output"; Lambda often leaves "expected" blank.
            canon_expected = tc.get("expected", tc.get("output", ""))
            canon_input = tc.get("input", tc.get("stdin", ""))

            raw_actual = str(res.get("actual", ""))
            raw_expected = str(res.get("expected", res.get("output", "")))
            if not raw_expected.strip() and canon_expected is not None and str(canon_expected).strip():
                raw_expected = str(canon_expected)
            if not str(res.get("input", res.get("stdin", ""))).strip() and str(canon_input).strip():
                res["input"] = canon_input

            # 2–3. RE-GRADE with same rules as local Pyodide (multi-line stdout, whitespace, numbers)
            ok, disp_a, disp_e = _judge_outputs_equal(raw_actual, raw_expected)
            hidden = bool(tc.get("hidden"))
            res["actual"] = disp_a
            res["expected"] = disp_e
            if ok:
                res["status"] = "Passed"
                passed_count += 1
            else:
                res["status"] = "Failed"
            if hidden and current_user.role != "instructor":
                res["input"] = ""
                res["expected"] = ""
                res["actual"] = ""
                res["hidden"] = True

        data["results"] = results_list
        data.setdefault("stats", {})
        data["stats"]["passed"] = passed_count
        data["stats"]["total"] = tc_count

        if payload.execution_mode != "dry_run":
            if payload.code_test_id is not None and payload.problem_id is not None:
                await remember_attempt(db, current_user.id, passed_count, tc_count, code_test_id=payload.code_test_id, problem_id=payload.problem_id)
            elif payload.challenge_id is not None:
                await remember_attempt(db, current_user.id, passed_count, tc_count, challenge_id=payload.challenge_id)

        return data

    except requests.exceptions.Timeout:
        return {"error": "Execution Timed Out (Server Limit)", "stats": {"passed": 0, "total": tc_count}, "results": []}
    except Exception as e:
        print(f"AWS Error: {e}")
        return {"error": "Compiler Service Unavailable", "stats": {"passed": 0, "total": tc_count}, "results": []}
@app.get("/api/v1/courses")
async def get_courses(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "instructor":
        res = await db.execute(select(models.Course).order_by(models.Course.id.desc()))
        courses = res.scalars().all()
        course_ids = [course.id for course in courses]
        module_counts: dict[int, int] = {}
        lesson_counts: dict[int, int] = {}
        if course_ids:
            module_res = await db.execute(
                select(models.Module.course_id, func.count(models.Module.id))
                .where(models.Module.course_id.in_(course_ids))
                .group_by(models.Module.course_id)
            )
            module_counts = {row[0]: row[1] for row in module_res.all()}
            lesson_res = await db.execute(
                select(models.Module.course_id, func.count(models.ContentItem.id))
                .join(models.ContentItem, models.ContentItem.module_id == models.Module.id)
                .where(models.Module.course_id.in_(course_ids))
                .group_by(models.Module.course_id)
            )
            lesson_counts = {row[0]: row[1] for row in lesson_res.all()}
        return [
            {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "price": course.price,
                "image_url": course.image_url,
                "is_published": course.is_published,
                "course_type": course.course_type,
                "language": course.language,
                "instructor_id": course.instructor_id,
                "modules": module_counts.get(course.id, 0),
                "lessons": lesson_counts.get(course.id, 0),
            }
            for course in courses
        ]
    res = await db.execute(select(models.Course).where(models.Course.is_published == True).order_by(models.Course.id.desc()))
    return [course_brief(course) for course in res.scalars().all()]

@app.get("/api/v1/public/courses")
async def public_courses(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=30"
    res = await db.execute(select(models.Course).where(models.Course.is_published == True).order_by(models.Course.id.desc()))
    rows = []
    for course in res.scalars().all():
        brief = course_brief(course)
        brief.pop("instructor_id", None)
        rows.append(brief)
    return rows

@app.get("/api/v1/public/courses/{course_id}")
async def public_course_share(
    course_id: int,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    """Published course curriculum for share links — titles only, no lesson URLs.

    Guests get a teaser (module 1 + first 2 lessons). Signed-in students get the full outline.
    """
    is_student = bool(current_user and current_user.role == "student")
    response.headers["Cache-Control"] = "private, no-store" if is_student else "public, max-age=30"
    result = await db.execute(
        select(models.Course)
        .options(selectinload(models.Course.modules).selectinload(models.Module.items))
        .where(models.Course.id == course_id, models.Course.is_published == True)
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="This course is not available to share.")

    sorted_modules = sorted(
        course.modules or [],
        key=lambda row: (row.order is None, row.order if row.order is not None else 10**9, row.id),
    )
    modules = []
    lesson_total = 0
    for module_index, module in enumerate(sorted_modules):
        sorted_items = sorted(
            module.items or [],
            key=lambda row: (row.order is None, row.order if row.order is not None else 10**9, row.id),
        )
        lesson_total += len(sorted_items)
        if is_student:
            lessons = [
                {
                    "id": item.id,
                    "title": item.title,
                    "type": item.type,
                    "order": item.order,
                    "duration": item.duration,
                    "locked": False,
                }
                for item in sorted_items
            ]
            modules.append({
                "id": module.id,
                "title": module.title,
                "order": module.order,
                "locked": False,
                "lesson_count": len(sorted_items),
                "lessons": lessons,
            })
            continue

        # Guests: module titles only — no lesson details until sign-in.
        modules.append({
            "id": module.id,
            "title": module.title,
            "order": module.order,
            "locked": False,
            "lesson_count": len(sorted_items),
            "lessons": [],
        })

    brief = course_brief(course)
    brief.pop("instructor_id", None)
    brief["modules"] = modules
    brief["module_count"] = len(sorted_modules)
    brief["lesson_count"] = lesson_total
    brief["preview"] = not is_student
    return brief

@app.post("/api/v1/courses")
# 👇 CHANGE: Remove "schemas." prefix to use the local class
async def create_course(course: CourseCreate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    new_course = models.Course(
        title=course.title, 
        description=course.description, 
        price=course.price, 
        image_url=course.image_url, 
        instructor_id=current_user.id, 
        course_type=course.course_type, 
        language=course.language
    )
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return new_course

@app.post("/api/v1/courses/{course_id}/modules")
async def create_module(course_id: int, module: ModuleCreate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    await load_owned_course(course_id, current_user, db)
    new_module = models.Module(**module.dict(), course_id=course_id)
    db.add(new_module)
    await db.commit()
    await db.refresh(new_module)
    return new_module

@app.put("/api/v1/courses/{course_id}/modules/reorder")
async def reorder_modules(course_id: int, req: ReorderModulesRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = res.scalars().first()
    if not course: raise HTTPException(status_code=404, detail="Course not found")

    # 2. Fetch all modules for this course
    result = await db.execute(select(models.Module).where(models.Module.course_id == course_id))
    modules_db = result.scalars().all()
    module_map = {m.id: m for m in modules_db}

    # 3. Update Order
    for idx, mid in enumerate(req.module_ids):
        if mid in module_map:
            module_map[mid].order = idx
            
    await db.commit()
    return {"message": "Modules reordered"}

def parse_youtube_url(value: str):
    raw = (value or "").strip()
    if not raw:
        return None
    start = 0
    seconds = re.search(r"[?&](?:t|start)=(\d+)", raw)
    if seconds:
        start = int(seconds.group(1))
    else:
        clock = re.search(r"[?&]t=(\d+)m(\d+)s", raw)
        if clock:
            start = int(clock.group(1)) * 60 + int(clock.group(2))
    for pattern in (
        r"(?:v=|vi=)([\w-]{11})",
        r"youtu\.be/([\w-]{11})",
        r"youtube\.com/(?:embed|shorts|live)/([\w-]{11})",
    ):
        found = re.search(pattern, raw)
        if found:
            return {"video_id": found.group(1), "start_seconds": start}
    if re.fullmatch(r"[\w-]{11}", raw):
        return {"video_id": raw, "start_seconds": start}
    if re.search(r"[?&]list=([\w-]+)", raw):
        return {"playlist": True}
    return None

def parse_chapters(text: str):
    rows = []
    for line in (text or "").splitlines():
        match = re.match(r"^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$", line.strip())
        if not match:
            continue
        hours = int(match.group(1) or 0)
        rows.append({
            "title": match.group(4).strip(),
            "seconds": hours * 3600 + int(match.group(2)) * 60 + int(match.group(3)),
        })
    return rows

def youtube_oembed(video_id: str):
    try:
        response = requests.get(
            "https://www.youtube.com/oembed",
            params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
            timeout=8,
        )
        if response.status_code != 200:
            return None
        return response.json()
    except Exception:
        return None

async def _owned_course(course_id: int, user: models.User, db: AsyncSession):
    return await load_owned_course(course_id, user, db)

def _recording_payload(item: models.CourseRecording, progress: models.RecordingProgress | None, include_id: bool):
    try:
        chapters = json.loads(item.chapters or "[]")
    except Exception:
        chapters = []
    return {
        "id": item.id,
        "course_id": item.course_id,
        "section": item.section_title,
        "title": item.title,
        "description": item.description or "",
        "youtube_id": item.youtube_id if include_id else "",
        "channel_name": item.channel_name or "",
        "channel_url": item.channel_url or "",
        "start_seconds": item.start_seconds or 0,
        "chapters": chapters,
        "position": item.position or 0,
        "is_published": item.is_published,
        "required": item.required,
        "content_item_id": item.content_item_id,
        "last_position": progress.last_position if progress else 0,
        "is_completed": progress.is_completed if progress else False,
    }

class RecordingIn(BaseModel):
    link: str
    title: str = ""
    section: str = "Recordings"
    description: str = ""
    channel_name: str = ""
    required: bool = True

class RecordingProgressIn(BaseModel):
    position: int = 0
    completed: bool = False

@app.get("/api/v1/courses/{course_id}/recordings")
async def list_recordings(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    course_res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role != "instructor":
        enrol = await db.execute(select(models.Enrollment).where(models.Enrollment.user_id == current_user.id, models.Enrollment.course_id == course_id))
        if not enrol.scalars().first():
            raise HTTPException(status_code=403, detail="Enrol to watch recordings")
    query = select(models.CourseRecording).where(models.CourseRecording.course_id == course_id)
    if current_user.role != "instructor":
        query = query.where(models.CourseRecording.is_published == True)
    res = await db.execute(query.order_by(models.CourseRecording.position, models.CourseRecording.id))
    items = res.scalars().all()
    prog = await db.execute(select(models.RecordingProgress).where(models.RecordingProgress.user_id == current_user.id))
    by_id = {row.recording_id: row for row in prog.scalars().all()}
    return [_recording_payload(item, by_id.get(item.id), True) for item in items]

@app.post("/api/v1/courses/{course_id}/recordings", status_code=201)
async def add_recording(course_id: int, body: RecordingIn, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    course = await _owned_course(course_id, current_user, db)
    parsed = parse_youtube_url(body.link)
    if not parsed or parsed.get("playlist"):
        raise HTTPException(status_code=400, detail="Paste one public or unlisted IQNex video link. Playlist links are not added as a single recording.")
    video_id = parsed["video_id"]
    meta = await asyncio.to_thread(youtube_oembed, video_id)
    if not meta:
        raise HTTPException(status_code=400, detail="This video cannot be embedded. Use a public or unlisted video, not a private one.")
    existing = await db.execute(select(models.CourseRecording).where(models.CourseRecording.course_id == course_id, models.CourseRecording.youtube_id == video_id))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="This video is already in the course.")
    section = (body.section or "Recordings").strip() or "Recordings"
    module_res = await db.execute(select(models.Module).where(models.Module.course_id == course_id, models.Module.title == section))
    module = module_res.scalars().first()
    if not module:
        count_res = await db.execute(select(func.count(models.Module.id)).where(models.Module.course_id == course_id))
        module = models.Module(title=section, order=int(count_res.scalar() or 0), course_id=course_id)
        db.add(module)
        await db.flush()
    title = (body.title or meta.get("title") or "Recording").strip()
    author = (body.channel_name or meta.get("author_name") or "").strip()
    author_url = meta.get("author_url") or ""
    chapters = parse_chapters(body.description)
    lesson = models.ContentItem(
        title=title,
        type="video",
        content=f"https://www.youtube.com/watch?v={video_id}",
        order=0,
        module_id=module.id,
        is_mandatory=body.required,
        instructions=body.description.strip(),
    )
    db.add(lesson)
    await db.flush()
    count_res = await db.execute(select(func.count(models.CourseRecording.id)).where(models.CourseRecording.course_id == course_id))
    recording = models.CourseRecording(
        course_id=course.id,
        section_title=section,
        title=title,
        description=body.description.strip(),
        youtube_id=video_id,
        channel_name=author,
        channel_url=author_url,
        start_seconds=parsed["start_seconds"],
        chapters=json.dumps(chapters),
        position=int(count_res.scalar() or 0),
        required=body.required,
        content_item_id=lesson.id,
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    return _recording_payload(recording, None, True)

@app.delete("/api/v1/recordings/{recording_id}")
async def delete_recording(recording_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.CourseRecording).where(models.CourseRecording.id == recording_id))
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Recording not found")
    await _owned_course(item.course_id, current_user, db)
    progress = await db.execute(select(models.RecordingProgress).where(models.RecordingProgress.recording_id == recording_id, models.RecordingProgress.is_completed == True))
    if progress.scalars().first():
        item.is_published = False
        await db.commit()
        return {"message": "Archived. Students already watched this, so it was unpublished instead of deleted."}
    await db.execute(delete(models.RecordingProgress).where(models.RecordingProgress.recording_id == recording_id))
    if item.content_item_id:
        await db.execute(delete(models.LessonProgress).where(models.LessonProgress.content_item_id == item.content_item_id))
        await db.execute(delete(models.ContentItem).where(models.ContentItem.id == item.content_item_id))
    await db.delete(item)
    await db.commit()
    return {"message": "Removed"}

@app.post("/api/v1/recordings/{recording_id}/progress")
async def save_recording_progress(recording_id: int, body: RecordingProgressIn, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    res = await db.execute(select(models.CourseRecording).where(models.CourseRecording.id == recording_id, models.CourseRecording.is_published == True))
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Recording not found")
    if current_user.role != "instructor":
        enrol = await db.execute(select(models.Enrollment).where(models.Enrollment.user_id == current_user.id, models.Enrollment.course_id == item.course_id))
        if not enrol.scalars().first():
            raise HTTPException(status_code=403, detail="Enrol to watch recordings")
    prog_res = await db.execute(select(models.RecordingProgress).where(models.RecordingProgress.user_id == current_user.id, models.RecordingProgress.recording_id == recording_id))
    row = prog_res.scalars().first()
    if not row:
        row = models.RecordingProgress(user_id=current_user.id, recording_id=recording_id)
        db.add(row)
    row.last_position = max(0, body.position)
    row.updated_at = datetime.utcnow()
    if body.completed:
        row.is_completed = True
        if item.content_item_id:
            done = await db.execute(select(models.LessonProgress).where(models.LessonProgress.user_id == current_user.id, models.LessonProgress.content_item_id == item.content_item_id))
            if not done.scalars().first():
                db.add(models.LessonProgress(user_id=current_user.id, content_item_id=item.content_item_id, is_completed=True))
    await db.commit()
    return {"last_position": row.last_position, "is_completed": row.is_completed}

@app.get("/api/v1/courses/{course_id}/modules")
async def get_modules(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    await load_owned_course(course_id, current_user, db)
    res = await db.execute(select(models.Module).where(models.Module.course_id == course_id).order_by(models.Module.order))
    return [{"id": module.id, "title": module.title, "order": module.order, "course_id": module.course_id} for module in res.scalars().all()]

@app.post("/api/v1/content")
async def add_content(content: ContentCreate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    module_res = await db.execute(select(models.Module).where(models.Module.id == content.module_id))
    module = module_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    await load_owned_course(module.course_id, current_user, db)
    cleaned_resource_links = normalize_resource_links(content.resource_links)
    new_content = models.ContentItem(
        title=content.title, 
        type=content.type, 
        content=content.data_url, 
        order=0, 
        module_id=content.module_id, 
        duration=content.duration, 
        is_mandatory=content.is_mandatory, 
        instructions=content.instructions, 
        test_config=content.test_config,
        resource_links=json.dumps(cleaned_resource_links) if cleaned_resource_links else None,
        # ✅ Save Times
        start_time=content.start_time,
        end_time=content.end_time
    )
    db.add(new_content)
    await db.commit()
    return {"message": "Content added"}

class PublishRequest(BaseModel):
    is_published: bool = True

@app.patch("/api/v1/courses/{course_id}/publish")
async def publish_course(course_id: int, body: PublishRequest = Body(default_factory=PublishRequest), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    course = await load_owned_course(course_id, current_user, db)
    course.is_published = body.is_published
    await db.commit()
    return {"message": "Published" if course.is_published else "Hidden", "is_published": course.is_published}

@app.get("/api/v1/library/items")
async def list_library_items(
    q: Optional[str] = None,
    content_type: Optional[str] = None,
    course_id: Optional[int] = None,
    course_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_instructor)
):
    query = (
        select(models.ContentItem, models.Module, models.Course, models.User)
        .join(models.Module, models.ContentItem.module_id == models.Module.id)
        .join(models.Course, models.Module.course_id == models.Course.id)
        .join(models.User, models.Course.instructor_id == models.User.id)
    )

    if q:
        search_text = f"%{q.strip()}%"
        query = query.where(
            (models.ContentItem.title.ilike(search_text))
            | (models.Module.title.ilike(search_text))
            | (models.Course.title.ilike(search_text))
            | (models.User.full_name.ilike(search_text))
            | (models.User.email.ilike(search_text))
        )

    if content_type and content_type != "all":
        query = query.where(models.ContentItem.type == content_type)

    if course_id is not None:
        query = query.where(models.Course.id == course_id)

    if course_name:
        course_text = f"%{course_name.strip()}%"
        query = query.where(models.Course.title.ilike(course_text))

    query = query.order_by(models.ContentItem.id.desc()).limit(500)
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": item.id,
            "title": item.title,
            "type": item.type,
            "url": item.content,
            "duration": item.duration,
            "is_mandatory": item.is_mandatory,
            "instructions": item.instructions,
            "test_config": item.test_config,
            "start_time": item.start_time,
            "end_time": item.end_time,
            "resource_links": parse_resource_links(item.resource_links),
            "module_id": module.id,
            "module_title": module.title,
            "course_id": course.id,
            "course_title": course.title,
            "instructor_id": instructor.id,
            "instructor_name": instructor.full_name or instructor.email,
        }
        for item, module, course, instructor in rows
    ]

@app.get("/api/v1/library/courses")
async def list_library_courses(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_instructor)
):
    result = await db.execute(
        select(models.Course.id, models.Course.title)
        .join(models.Module, models.Module.course_id == models.Course.id)
        .join(models.ContentItem, models.ContentItem.module_id == models.Module.id)
        .group_by(models.Course.id, models.Course.title)
        .order_by(models.Course.title.asc())
    )
    rows = result.all()
    return [{"id": row[0], "title": row[1]} for row in rows]

@app.get("/api/v1/library/course-modules")
async def list_course_modules_for_library(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_instructor)
):
    res = await db.execute(
        select(models.Module)
        .options(selectinload(models.Module.items))
        .where(models.Module.course_id == course_id)
        .order_by(models.Module.order, models.Module.id)
    )
    modules = res.scalars().all()
    return [
        {
            "id": module.id,
            "title": module.title,
            "order": module.order,
            "lesson_count": len(module.items or []),
        }
        for module in modules
    ]

@app.post("/api/v1/library/add-to-module")
async def add_items_from_library(
    payload: LibraryBulkAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_instructor)
):
    target_mod_res = await db.execute(
        select(models.Module, models.Course)
        .join(models.Course, models.Module.course_id == models.Course.id)
        .where(models.Module.id == payload.module_id)
    )
    target_pair = target_mod_res.first()
    if not target_pair:
        raise HTTPException(status_code=404, detail="Target module not found")

    target_module, target_course = target_pair

    item_ids = [item_id for item_id in payload.item_ids if isinstance(item_id, int)]
    if not item_ids:
        raise HTTPException(status_code=400, detail="No library items selected")

    src_items_res = await db.execute(select(models.ContentItem).where(models.ContentItem.id.in_(item_ids)))
    src_items = src_items_res.scalars().all()
    src_items_map = {item.id: item for item in src_items}

    ordered_source_items = [src_items_map[item_id] for item_id in item_ids if item_id in src_items_map]
    if not ordered_source_items:
        raise HTTPException(status_code=404, detail="Selected library items were not found")

    max_order_res = await db.execute(
        select(func.max(models.ContentItem.order)).where(models.ContentItem.module_id == payload.module_id)
    )
    max_order = max_order_res.scalar()
    next_order = (max_order + 1) if max_order is not None else 0

    created_items = []
    for src in ordered_source_items:
        cloned = models.ContentItem(
            title=src.title,
            type=src.type,
            content=src.content,
            duration=src.duration,
            is_mandatory=src.is_mandatory,
            instructions=src.instructions,
            test_config=src.test_config,
            resource_links=src.resource_links,
            start_time=src.start_time,
            end_time=src.end_time,
            order=next_order,
            module_id=payload.module_id,
        )
        next_order += 1
        db.add(cloned)
        created_items.append(cloned)

    await db.commit()
    return {"message": "Library items added", "count": len(created_items)}

@app.post("/api/v1/library/import-modules")
async def import_modules_from_library(
    payload: LibraryImportModulesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_instructor)
):
    target_course_res = await db.execute(select(models.Course).where(models.Course.id == payload.target_course_id))
    target_course = target_course_res.scalars().first()
    if not target_course:
        raise HTTPException(status_code=404, detail="Target course not found")

    module_ids = [module_id for module_id in payload.module_ids if isinstance(module_id, int)]
    if not module_ids:
        raise HTTPException(status_code=400, detail="No modules selected")

    src_res = await db.execute(
        select(models.Module)
        .options(selectinload(models.Module.items))
        .where(models.Module.id.in_(module_ids))
    )
    src_modules = src_res.scalars().all()
    src_map = {module.id: module for module in src_modules}
    ordered_src_modules = [src_map[module_id] for module_id in module_ids if module_id in src_map]
    if not ordered_src_modules:
        raise HTTPException(status_code=404, detail="Selected source modules were not found")

    max_order_res = await db.execute(select(func.max(models.Module.order)).where(models.Module.course_id == payload.target_course_id))
    max_order = max_order_res.scalar()
    next_module_order = (max_order + 1) if max_order is not None else 0

    imported_modules = 0
    for src_module in ordered_src_modules:
        new_module = models.Module(
            title=src_module.title,
            order=next_module_order,
            course_id=payload.target_course_id
        )
        next_module_order += 1
        db.add(new_module)
        await db.flush()

        sorted_items = sorted(
            src_module.items or [],
            key=lambda item: (
                item.order is None,
                item.order if item.order is not None else 10**9,
                item.id
            )
        )
        for idx, src_item in enumerate(sorted_items):
            new_item = models.ContentItem(
                title=src_item.title,
                type=src_item.type,
                content=src_item.content,
                duration=src_item.duration,
                is_mandatory=src_item.is_mandatory,
                instructions=src_item.instructions,
                test_config=src_item.test_config,
                resource_links=src_item.resource_links,
                start_time=src_item.start_time,
                end_time=src_item.end_time,
                order=idx,
                module_id=new_module.id,
            )
            db.add(new_item)
        imported_modules += 1

    await db.commit()
    return {"message": "Modules imported from library", "count": imported_modules}

@app.patch("/api/v1/courses/{course_id}/details")
async def update_course_details(
    course_id: int, 
    update: CourseUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: models.User = Depends(require_instructor)
):
    course = await load_owned_course(course_id, current_user, db)

    # 3. Update Fields if provided
    if update.title: course.title = update.title
    if update.description: course.description = update.description
    if update.price is not None: course.price = update.price
    if update.image_url: course.image_url = update.image_url
    if update.language: course.language = update.language
    
    # 4. Save
    await db.commit()
    await db.refresh(course)
    
    return {"message": "Course updated successfully", "course": course}

@app.get("/api/v1/courses/{course_id}/player")
async def get_course_player(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # ⚡ OPTIMIZED EAGER LOADING: Fetch Course + Modules + Items in 1 Go
    result = await db.execute(
        select(models.Course)
        .options(selectinload(models.Course.modules).selectinload(models.Module.items))
        .where(models.Course.id == course_id)
    )
    course = result.scalars().first()
    if not course: raise HTTPException(status_code=404)

    # Check Enrollment
    enrol_res = await db.execute(select(models.Enrollment).where(models.Enrollment.user_id == current_user.id, models.Enrollment.course_id == course_id))
    enrollment = enrol_res.scalars().first()
    
    if current_user.role == "student" and not course.is_published:
        raise HTTPException(status_code=403, detail="This course is not published.")
    if not enrollment and current_user.role != "instructor": raise HTTPException(status_code=403)
    if enrollment and enrollment.enrollment_type == "trial" and enrollment.expiry_date and datetime.utcnow() > enrollment.expiry_date:
        raise HTTPException(status_code=402, detail="Trial Expired")

    item_ids = [item.id for module in course.modules for item in (module.items or [])]
    if item_ids:
        prog_res = await db.execute(select(models.LessonProgress).where(
            models.LessonProgress.user_id == current_user.id,
            models.LessonProgress.content_item_id.in_(item_ids),
        ))
    else:
        prog_res = None
    progress_records = prog_res.scalars().all() if prog_res is not None else []
    progress_map = {p.content_item_id: p for p in progress_records}
    completed_ids = {p.content_item_id for p in progress_records if p.is_completed}

    return {
        "id": course.id, 
        "title": course.title,
        "price": course.price,
        "enrollment_type": enrollment.enrollment_type if enrollment else None,
        "course_type": course.course_type,
        "language": course.language,
        "modules": [
            {
                "id": m.id, 
                "title": m.title, 
                "order": m.order,
                "is_completed": any(item.type == 'assignment' and item.id in completed_ids for item in m.items),
                "lessons": [
                    {
                        "id": c.id, 
                        "title": c.title, 
                        "order": c.order,
                        "type": c.type, 
                        "url": c.content, 
                        "test_config": c.test_config, 
                        "instructions": c.instructions, 
                        "resource_links": parse_resource_links(c.resource_links),
                        "duration": c.duration, 
                        "is_mandatory": c.is_mandatory, 
                        "is_completed": c.id in completed_ids, 

                        # ✅ INSERT THE NEW LINES EXACTLY HERE (After "is_completed")
                        "start_time": c.start_time,
                        "end_time": c.end_time,
                        "is_terminated": progress_map.get(c.id).is_terminated if c.id in progress_map else False,
                        "violation_count": progress_map.get(c.id).violation_count if c.id in progress_map else 0
                        
                    } for c in sorted(
                        m.items,
                        key=lambda item: (
                            item.order is None,
                            item.order if item.order is not None else 10**9,
                            item.id
                        )
                    )
                ]
            } for m in sorted(
                course.modules,
                key=lambda module: (
                    module.order is None,
                    module.order if module.order is not None else 10**9,
                    module.id
                )
            )
        ]
    }

@app.post("/api/v1/enroll/{course_id}")
async def enroll_student(course_id: int, req: EnrollmentRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    course_res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "student" and req.type == "paid" and int(course.price or 0) > 0:
        raise HTTPException(status_code=402, detail="Complete Razorpay checkout to unlock this course.")
    res = await db.execute(select(models.Enrollment).where(models.Enrollment.user_id == current_user.id, models.Enrollment.course_id == course_id))
    existing = res.scalars().first()
    if existing:
        if existing.enrollment_type == "trial" and req.type == "paid":
            existing.enrollment_type = "paid"; existing.expiry_date = None; await db.commit(); return {"message": "Upgraded"}
        return {"message": "Already enrolled"}
    
    new_enrollment = models.Enrollment(user_id=current_user.id, course_id=course_id, enrollment_type=req.type, expiry_date=(datetime.utcnow() + timedelta(days=7)) if req.type == "trial" else None)
    db.add(new_enrollment)
    await db.commit()
    return {"message": "Enrolled"}

@app.get("/api/v1/generate-pdf/{course_id}")
async def generate_pdf_endpoint(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. ✅ SECURITY CHECK: Verify if the certificate record exists in DB
    # This ensures they have passed the "100% completion" check in the claim endpoint first.
    cert_res = await db.execute(select(models.UserCertificate).where(
        models.UserCertificate.user_id == current_user.id, 
        models.UserCertificate.course_id == course_id
    ))
    certificate = cert_res.scalars().first()

    if not certificate:
        raise HTTPException(status_code=403, detail="Certificate not yet earned. Please complete the course and click 'Claim Certificate' first.")

    # 2. Fetch Course Details
    res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = res.scalars().first()
    
    # 3. Generate PDF
    # We use the date they actually earned it (certificate.issued_at) rather than current time
    formatted_date = certificate.issued_at.strftime("%B %d, %Y")
    
    pdf = await asyncio.to_thread(
        create_certificate_pdf,
        current_user.full_name,
        course.title,
        formatted_date,
        certificate.certificate_id,
        course.description or "",
        course.course_type or "",
    )
    return StreamingResponse(pdf, media_type="application/pdf")

async def enrolled_courses_for(db: AsyncSession, current_user: models.User):
    # 1. Fetch enrollments with course details AND certificates
    res = await db.execute(
        select(models.Enrollment)
        .options(selectinload(models.Enrollment.course))
        .where(models.Enrollment.user_id == current_user.id)
    )
    enrollments = res.scalars().all()
    
    # 2. Fetch earned certificates for ribbon logic
    cert_res = await db.execute(
        select(models.UserCertificate.course_id)
        .where(models.UserCertificate.user_id == current_user.id)
    )
    earned_cert_ids = set(cert_res.scalars().all())
    course_ids = [e.course.id for e in enrollments if e.course]
    lesson_totals: dict[int, int] = {}
    lesson_done: dict[int, int] = {}
    if course_ids:
        total_res = await db.execute(
            select(models.Module.course_id, func.count(models.ContentItem.id))
            .join(models.ContentItem, models.ContentItem.module_id == models.Module.id)
            .where(models.Module.course_id.in_(course_ids))
            .group_by(models.Module.course_id)
        )
        lesson_totals = {row[0]: row[1] for row in total_res.all()}
        done_res = await db.execute(
            select(models.Module.course_id, func.count(models.LessonProgress.id))
            .join(models.ContentItem, models.ContentItem.module_id == models.Module.id)
            .join(
                models.LessonProgress,
                and_(
                    models.LessonProgress.content_item_id == models.ContentItem.id,
                    models.LessonProgress.user_id == current_user.id,
                    models.LessonProgress.is_completed == True,
                ),
            )
            .where(models.Module.course_id.in_(course_ids))
            .group_by(models.Module.course_id)
        )
        lesson_done = {row[0]: row[1] for row in done_res.all()}

    # 3. Build response with enrollment status
    valid_courses = []
    for e in enrollments:
        if e.course and (current_user.role != "student" or e.course.is_published):
            # Calculate Trial Status
            days_left = 0
            is_trial_expired = False
            
            if e.enrollment_type == "trial" and e.expiry_date:
                delta = e.expiry_date - datetime.utcnow()
                days_left = max(0, delta.days)
                if delta.total_seconds() <= 0:
                    is_trial_expired = True

            course_data = {
                "id": e.course.id,
                "title": e.course.title,
                "description": e.course.description,
                "price": e.course.price,
                "image_url": e.course.image_url,
                "instructor_id": e.course.instructor_id,
                
                # ✅ ADDED THIS LINE to support Standard/Coding tabs
                "course_type": e.course.course_type, 

                # UI Status Fields
                "enrollment_type": e.enrollment_type, # "paid" or "trial"
                "days_left": days_left,
                "is_trial_expired": is_trial_expired,
                "has_certificate": e.course.id in earned_cert_ids,
                "lessons_total": lesson_totals.get(e.course.id, 0),
                "lessons_done": lesson_done.get(e.course.id, 0),
            }
            valid_courses.append(course_data)

    return valid_courses

@app.get("/api/v1/my-courses")
async def get_my_courses(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return await enrolled_courses_for(db, current_user)

@app.get("/api/v1/account")
async def account_home(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    courses = await enrolled_courses_for(db, current_user)
    notes = await db.execute(
        select(models.Notification)
        .where(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(5)
    )
    notices = [
        {"id": note.id, "title": note.title, "message": note.message, "is_read": bool(note.is_read)}
        for note in notes.scalars().all()
    ]
    return {
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "phone_number": current_user.phone_number,
            "college": getattr(current_user, "college", None),
            "organization": getattr(current_user, "organization", None),
            "social_media_link": getattr(current_user, "social_media_link", None),
        },
        "courses": courses,
        "notices": notices,
    }

@app.post("/api/v1/user/change-password")
async def change_password(req: PasswordChange, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if len(req.new_password or "") < 8:
        raise HTTPException(status_code=400, detail="Use at least 8 characters.")
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.hashed_password = await asyncio.to_thread(get_password_hash, req.new_password)
    await db.commit()
    return {"message": "Password updated"}

# In backend/main.py

@app.delete("/api/v1/content/{content_id}")
async def delete_content(content_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # 1. Fetch the item
    res = await db.execute(select(models.ContentItem).where(models.ContentItem.id == content_id))
    item = res.scalars().first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    pair = await course_of_item(content_id, db)
    if pair:
        await load_owned_course(pair[0].id, current_user, db)

    try:
        # 2. ✅ CRITICAL FIX: Delete related dependencies first!
        
        # Delete related Progress records (Proctoring/Completion data)
        await db.execute(
            delete(models.LessonProgress).where(models.LessonProgress.content_item_id == content_id)
        )

        # Delete related Submissions (if it was an assignment)
        await db.execute(
            delete(models.Submission).where(models.Submission.content_item_id == content_id)
        )

        # 3. Now delete the actual item
        await db.delete(item)
        await db.commit()
        return {"message": "Deleted successfully"}

    except Exception as e:
        await db.rollback()
        print(f"Delete Error: {str(e)}") # This prints to your backend terminal for debugging
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.patch("/api/v1/content/{content_id}")
async def update_content(content_id: int, update: ContentUpdate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.ContentItem).where(models.ContentItem.id == content_id))
    item = res.scalars().first()
    if item: 
        pair = await course_of_item(content_id, db)
        if pair:
            await load_owned_course(pair[0].id, current_user, db)
        if update.title: item.title = update.title
        if update.url: item.content = update.url
        if update.resource_links is not None:
            cleaned_resource_links = normalize_resource_links(update.resource_links)
            item.resource_links = json.dumps(cleaned_resource_links) if cleaned_resource_links else None
        await db.commit()
        return {"message": "Updated"}
    raise HTTPException(status_code=404)

@app.post("/api/v1/create-order")
async def create_payment_order(
    data: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Razorpay client is sync, use thread
    if not client or not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the API service.")

    res = await db.execute(select(models.Course).where(models.Course.id == data.course_id))
    course = res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    amount_value = int(course.price or 0)
    if amount_value <= 0:
        raise HTTPException(status_code=400, detail="Course amount must be greater than zero")

    order_data = {
        "amount": amount_value * 100,
        "currency": "INR",
        "payment_capture": 1,
        "notes": {
            "course_id": str(data.course_id),
            "user_id": str(current_user.id)
        }
    }
    last_error = None
    for attempt in range(2):
        try:
            order = await asyncio.to_thread(client.order.create, data=order_data)
            # Return the public key that created this order so checkout never mismatches the API account.
            return {
                "id": order.get("id"),
                "amount": order.get("amount"),
                "currency": order.get("currency") or "INR",
                "status": order.get("status"),
                "key_id": RAZORPAY_KEY_ID,
            }
        except Exception as e:
            last_error = e
            if "authentication" in str(e).lower() or attempt == 1:
                break
            await asyncio.sleep(0.5)
    raise razorpay_failure(last_error)

@app.post("/api/v1/payment/verify")
async def verify_payment_and_unlock_course(
    payload: PaymentVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not client or not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the API service.")

    res = await db.execute(select(models.Course).where(models.Course.id == payload.course_id))
    course = res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    try:
        await asyncio.to_thread(
            client.utility.verify_payment_signature,
            {
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature
            }
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    try:
        payment = await asyncio.to_thread(client.payment.fetch, payload.razorpay_payment_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to fetch payment details: {str(e)}")

    expected_amount = int(course.price or 0) * 100
    paid_amount = int(payment.get("amount") or 0)
    payment_status = str(payment.get("status") or "").lower()
    if paid_amount != expected_amount:
        raise HTTPException(status_code=400, detail="Payment amount mismatch")
    if payment_status != "captured":
        raise HTTPException(status_code=400, detail=f"Payment not captured (status: {payment_status or 'unknown'})")

    try:
        order = await asyncio.to_thread(client.order.fetch, payload.razorpay_order_id)
    except Exception:
        raise HTTPException(status_code=502, detail="Unable to confirm the Razorpay order.")
    notes = order.get("notes") or {}
    if str(notes.get("course_id")) != str(payload.course_id) or str(notes.get("user_id")) != str(current_user.id):
        raise HTTPException(status_code=400, detail="This payment belongs to a different checkout.")
    if str(order.get("id")) != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order id mismatch")
    if str(payment.get("order_id") or "") != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment does not match this order.")

    enroll_res = await db.execute(
        select(models.Enrollment).where(
            models.Enrollment.user_id == current_user.id,
            models.Enrollment.course_id == payload.course_id
        )
    )
    existing = enroll_res.scalars().first()
    if existing:
        if existing.enrollment_type != "paid":
            existing.enrollment_type = "paid"
            existing.expiry_date = None
            await db.commit()
        return {"message": "Payment verified. Course unlocked.", "status": "success"}

    new_enrollment = models.Enrollment(
        user_id=current_user.id,
        course_id=payload.course_id,
        enrollment_type="paid",
        expiry_date=None
    )
    db.add(new_enrollment)
    await db.commit()
    return {"message": "Payment verified. Course unlocked.", "status": "success"}

@app.post("/api/v1/submit-assignment")
async def submit_assignment(file: UploadFile = File(...), lesson_title: str = Form(...), lesson_id: int = Form(None), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if lesson_id:
        res = await db.execute(select(models.ContentItem).where(models.ContentItem.id == lesson_id))
    else:
        # Fallback to legacy title matching (deprecated but kept for safety)
        res = await db.execute(select(models.ContentItem).where(models.ContentItem.title == lesson_title, models.ContentItem.type == "assignment"))
    
    assignment_data = res.scalars().first()
    
    content = await file.read()
    safe_filename = safe_storage_name(current_user.id, file.filename or "assignment")
    drive_status = "Not Uploaded"

    if assignment_data:
        pair = await course_of_item(assignment_data.id, db)
        if pair and current_user.role == "student":
            await require_enrolment(current_user, pair[0].id, db)
        if assignment_data and assignment_data.content:
            file_stream = io.BytesIO(content)
            file_id = await asyncio.to_thread(upload_file_to_drive, file_stream, safe_filename, assignment_data.content)
            if file_id: drive_status = "Uploaded"
    
    # Local Backup
    os.makedirs("assignments_backup", exist_ok=True)
    with open(f"assignments_backup/{safe_filename}", "wb") as f: f.write(content)
    
    # ✅ FIX: Record Submission in Database
    if assignment_data:
        # Check if already submitted to avoid duplicates? Maybe just add new one.
        # For now, simplistic approach: append new submission.
        new_sub = models.Submission(
            user_id=current_user.id, 
            content_item_id=assignment_data.id, 
            drive_link=f"Uploaded: {safe_filename}", 
            status="Submitted",
            file_data=content,
        )
        db.add(new_sub)

        # Mark Progress
        prog_res = await db.execute(select(models.LessonProgress).where(models.LessonProgress.user_id == current_user.id, models.LessonProgress.content_item_id == assignment_data.id))
        if not prog_res.scalars().first():
            db.add(models.LessonProgress(user_id=current_user.id, content_item_id=assignment_data.id, is_completed=True))
        
        await db.commit()

    return {"message": "Submitted", "drive_status": drive_status}

@app.post("/api/v1/confirm-submission")
async def confirm_submission(req: ConfirmationRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    pair = await course_of_item(req.lesson_id, db)
    if not pair:
        raise HTTPException(status_code=404, detail="Assignment not found")
    course, assignment = pair
    if assignment.type != "assignment":
        raise HTTPException(status_code=400, detail="That lesson is not an assignment")
    await require_enrolment(current_user, course.id, db)

    # 1. Create Submission Record
    new_sub = models.Submission(user_id=current_user.id, content_item_id=assignment.id, drive_link=f"Uploaded: {req.file_name}", status="Submitted")
    db.add(new_sub)

    # 2. Mark Lesson as Complete (Green Tick)
    prog_res = await db.execute(select(models.LessonProgress).where(models.LessonProgress.user_id == current_user.id, models.LessonProgress.content_item_id == assignment.id))
    if not prog_res.scalars().first():
        db.add(models.LessonProgress(user_id=current_user.id, content_item_id=assignment.id, is_completed=True))
    
    await db.commit()
    
    # ✅ Removed certificate logic. Certificate is now only claimed via the "Claim Certificate" button.
    return {"message": "Submitted"}
# In main.py

@app.get("/api/v1/admin/students")
async def get_all_students(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # 1. REMOVED THE BROAD TRY/EXCEPT BLOCK so real errors raise 500 instead of returning []
    
    # Optimized: Fetch students + enrollments + course names
    res = await db.execute(
        select(models.User)
        .options(selectinload(models.User.enrollments).selectinload(models.Enrollment.course))
        .where(models.User.role == "student")
    )
    students = res.scalars().all()
    
    real_data = []
    for s in students:
        # 2. Safely get course names (Handle missing relationships)
        course_names = []
        # Check if 'enrollments' exists safely
        user_enrollments = getattr(s, "enrollments", [])
        if user_enrollments:
            course_names = [e.course.title for e in user_enrollments if e.course]

        # 3. Safely format Date (Fixes the crash if created_at is missing/None)
        join_date = "N/A"
        # Check if 'created_at' exists on the model and is not None
        created_at_val = getattr(s, "created_at", None)
        
        if created_at_val:
            try:
                # If it's already a string, use it; otherwise format datetime
                if isinstance(created_at_val, str):
                    join_date = created_at_val
                else:
                    join_date = created_at_val.strftime("%Y-%m-%d")
            except Exception:
                join_date = str(created_at_val)

        real_data.append({ 
            "id": s.id, 
            "full_name": s.full_name, 
            "email": s.email,
            "phone_number": getattr(s, "phone_number", None),
            "college": getattr(s, "college", None),
            "organization": getattr(s, "organization", None),
            "social_media_link": getattr(s, "social_media_link", None),
            "joined_at": join_date, 
            "enrolled_courses": course_names 
        })
        
    return real_data

@app.post("/api/v1/admin/assign-courses")
async def assign_courses_by_profile(
    req: AssignCoursesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_instructor),
):
    """Enroll matching students in courses by email list and/or college/organization."""
    if not req.course_ids:
        raise HTTPException(status_code=400, detail="Select at least one course.")
    emails = [str(item).strip().lower() for item in (req.emails or []) if str(item).strip()]
    college = (req.college or "").strip()
    organization = (req.organization or "").strip()
    if not emails and not college and not organization:
        raise HTTPException(status_code=400, detail="Filter by email, college, or organization.")

    course_res = await db.execute(select(models.Course).where(models.Course.id.in_(req.course_ids)))
    valid_ids = {course.id for course in course_res.scalars().all()}
    if not valid_ids:
        raise HTTPException(status_code=404, detail="No matching courses found.")

    student_res = await db.execute(select(models.User).where(models.User.role == "student", models.User.is_active == True))
    students = student_res.scalars().all()
    matched = []
    for student in students:
        email = (student.email or "").strip().lower()
        student_college = (getattr(student, "college", None) or "").strip()
        student_org = (getattr(student, "organization", None) or "").strip()
        email_ok = True if not emails else email in emails
        college_ok = True if not college else student_college.lower() == college.lower()
        org_ok = True if not organization else student_org.lower() == organization.lower()
        if email_ok and college_ok and org_ok:
            matched.append(student)

    if not matched:
        raise HTTPException(status_code=404, detail="No students matched those filters.")

    enrolled_pairs = 0
    for student in matched:
        for course_id in valid_ids:
            existing = await db.execute(select(models.Enrollment).where(
                models.Enrollment.user_id == student.id,
                models.Enrollment.course_id == course_id,
            ))
            if existing.scalars().first():
                continue
            db.add(models.Enrollment(user_id=student.id, course_id=course_id, enrollment_type="paid"))
            enrolled_pairs += 1
    await db.commit()
    return {
        "message": f"Assigned {len(valid_ids)} course(s) to {len(matched)} student(s).",
        "matched_students": len(matched),
        "new_enrollments": enrolled_pairs,
        "course_ids": sorted(valid_ids),
    }

@app.get("/api/v1/admin/overview")
async def admin_overview(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    courses_res = await db.execute(select(models.Course))
    courses = courses_res.scalars().all()
    course_ids = [course.id for course in courses]
    students_res = await db.execute(select(models.User).where(models.User.role == "student"))
    student_count = len(students_res.scalars().all())
    enroll_res = await db.execute(select(models.Enrollment))
    enrolments = [row for row in enroll_res.scalars().all() if row.course_id in course_ids]
    cert_res = await db.execute(select(models.UserCertificate))
    certificates = [row for row in cert_res.scalars().all() if row.course_id in course_ids]
    watch_res = await db.execute(select(models.WatchLesson))
    watch_count = len(watch_res.scalars().all())
    return {
        "courses": len(courses),
        "published": sum(1 for course in courses if course.is_published),
        "students": student_count,
        "enrolments": len(enrolments),
        "certificates": len(certificates),
        "watch_lessons": watch_count,
    }

@app.get("/api/v1/admin/certificates")
async def admin_certificates(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    courses_res = await db.execute(select(models.Course))
    owned = {course.id: course.title for course in courses_res.scalars().all()}
    if not owned:
        return []
    cert_res = await db.execute(
        select(models.UserCertificate)
        .options(selectinload(models.UserCertificate.user))
        .where(models.UserCertificate.course_id.in_(list(owned.keys())))
    )
    rows = []
    for cert in cert_res.scalars().all():
        issued = cert.issued_at.strftime("%Y-%m-%d") if cert.issued_at else ""
        rows.append({
            "id": cert.id,
            "credential_id": cert.certificate_id,
            "student": cert.user.full_name if cert.user else "Student",
            "email": cert.user.email if cert.user else "",
            "course": owned.get(cert.course_id, "Course"),
            "course_id": cert.course_id,
            "issued_at": issued,
        })
    return rows

@app.delete("/api/v1/admin/students/{user_id}")
async def delete_student(user_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.User).where(models.User.id == user_id, models.User.role == "student"))
    student = res.scalars().first()
    
    if not student: 
        raise HTTPException(status_code=404, detail="Student not found")
    
    # 2. ✅ HARD DELETE LOGIC (Permanent Removal)
    try:
        # Delete related Enrollments
        await db.execute(delete(models.Enrollment).where(models.Enrollment.user_id == user_id))
        
        # Delete related Submissions
        await db.execute(delete(models.Submission).where(models.Submission.user_id == user_id))
        
        # Delete related Test Results
        await db.execute(delete(models.TestResult).where(models.TestResult.user_id == user_id))
        
        # Delete related Lesson Progress
        await db.execute(delete(models.LessonProgress).where(models.LessonProgress.user_id == user_id))
        await db.execute(delete(models.LessonNote).where(models.LessonNote.user_id == user_id))
        await db.execute(delete(models.PasswordReset).where(models.PasswordReset.user_id == user_id))
        await db.execute(delete(models.CodeAttempt).where(models.CodeAttempt.user_id == user_id))
        
        # Delete related Certificates
        await db.execute(delete(models.UserCertificate).where(models.UserCertificate.user_id == user_id))
        
        # Delete related Notifications
        await db.execute(delete(models.Notification).where(models.Notification.user_id == user_id))
        
        # Delete related Challenge Progress
        await db.execute(delete(models.ChallengeProgress).where(models.ChallengeProgress.user_id == user_id))

        await db.execute(delete(models.CourseAssessment).where(models.CourseAssessment.user_id == user_id))
        await db.execute(delete(models.RecordingProgress).where(models.RecordingProgress.user_id == user_id))
        await db.execute(delete(models.ProgramRegistration).where(models.ProgramRegistration.user_id == user_id))
        await db.execute(
            update(models.ProgramItem)
            .where(models.ProgramItem.created_by == user_id)
            .values(created_by=None)
        )

        # Finally, delete the User
        await db.delete(student)
        await db.commit()
        
        return {"message": "Student permanently removed from the database."}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete student: {str(e)}")

# --- 🆕 ADD THIS TO main.py ---
@app.patch("/api/v1/admin/students/{user_id}/reset-password")
async def reset_student_password(user_id: int, req: AdminPasswordReset, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    student = result.scalars().first()
    
    if not student or student.role != "student":
        raise HTTPException(status_code=404, detail="Student not found")
    if len(req.new_password or "") < 8:
        raise HTTPException(status_code=400, detail="Use at least 8 characters.")
    
    student.hashed_password = await asyncio.to_thread(get_password_hash, req.new_password)
    await db.commit()
    
    return {"message": f"Password for {student.full_name} has been reset."}

@app.delete("/api/v1/courses/{course_id}")
async def delete_course(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    course = await load_owned_course(course_id, current_user, db)
    modules = (await db.execute(select(models.Module).where(models.Module.course_id == course_id))).scalars().all()
    module_ids = [module.id for module in modules]
    item_ids = []
    if module_ids:
        item_ids = (await db.execute(select(models.ContentItem.id).where(models.ContentItem.module_id.in_(module_ids)))).scalars().all()
    if item_ids:
        await db.execute(delete(models.LessonProgress).where(models.LessonProgress.content_item_id.in_(item_ids)))
        await db.execute(delete(models.Submission).where(models.Submission.content_item_id.in_(item_ids)))
        await db.execute(delete(models.LessonNote).where(models.LessonNote.content_item_id.in_(item_ids)))
        await db.execute(delete(models.ContentItem).where(models.ContentItem.id.in_(item_ids)))
    if module_ids:
        await db.execute(delete(models.Module).where(models.Module.id.in_(module_ids)))
    challenge_ids = (await db.execute(select(models.CourseChallenge.id).where(models.CourseChallenge.course_id == course_id))).scalars().all()
    if challenge_ids:
        await db.execute(delete(models.ChallengeProgress).where(models.ChallengeProgress.challenge_id.in_(challenge_ids)))
        await db.execute(delete(models.CodeAttempt).where(models.CodeAttempt.challenge_id.in_(challenge_ids)))
        await db.execute(delete(models.CourseChallenge).where(models.CourseChallenge.id.in_(challenge_ids)))
    recording_ids = (await db.execute(select(models.CourseRecording.id).where(models.CourseRecording.course_id == course_id))).scalars().all()
    if recording_ids:
        await db.execute(delete(models.RecordingProgress).where(models.RecordingProgress.recording_id.in_(recording_ids)))
        await db.execute(delete(models.CourseRecording).where(models.CourseRecording.id.in_(recording_ids)))
    await db.execute(delete(models.Enrollment).where(models.Enrollment.course_id == course_id))
    await db.execute(delete(models.UserCertificate).where(models.UserCertificate.course_id == course_id))
    await db.execute(delete(models.CourseAssessment).where(models.CourseAssessment.course_id == course_id))
    await db.delete(course)
    await db.commit()
    return {"message": "Deleted"}

# Live Sessions
@app.post("/api/v1/live/start")
async def start_live_session(req: LiveSessionRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # Deactivate old
    old_res = await db.execute(select(models.LiveSession).where(models.LiveSession.instructor_id == current_user.id, models.LiveSession.is_active == True))
    for s in old_res.scalars().all(): s.is_active = False
    
    new_session = models.LiveSession(instructor_id=current_user.id, youtube_url=req.youtube_url, topic=req.topic, is_active=True)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return {"message": "Started", "session_id": new_session.id}

@app.get("/api/v1/live/active")
async def get_active_live_sessions(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    res = await db.execute(select(models.LiveSession).where(models.LiveSession.is_active == True))
    rows = res.scalars().all()
    if current_user.role == "instructor":
        rows = [row for row in rows if row.instructor_id == current_user.id]
    return [{"id": row.id, "topic": row.topic, "youtube_url": row.youtube_url, "started_at": row.started_at} for row in rows]

def youtube_id_from_link(value: str) -> Optional[str]:
    raw = (value or "").strip()
    patterns = (
        r"(?:v=|vi=)([\w-]{11})",
        r"youtu\.be/([\w-]{11})",
        r"youtube\.com/(?:embed|shorts)/([\w-]{11})",
        r"^([\w-]{11})$",
    )
    for pattern in patterns:
        match = re.search(pattern, raw)
        if match:
            return match.group(1)
    return None

class WatchLessonIn(BaseModel):
    title: str
    youtube_url: str

def watch_lesson_out(row: models.WatchLesson) -> dict:
    return {"id": row.id, "title": row.title, "youtube_id": row.youtube_id}

@app.get("/api/v1/watch")
async def list_watch_lessons(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=30"
    res = await db.execute(select(models.WatchLesson).order_by(models.WatchLesson.id.desc()))
    return [watch_lesson_out(row) for row in res.scalars().all()]

@app.post("/api/v1/watch", status_code=201)
async def add_watch_lesson(body: WatchLessonIn, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    title = body.title.strip()
    video_id = youtube_id_from_link(body.youtube_url)
    if len(title) < 2:
        raise HTTPException(status_code=400, detail="Enter a lesson title.")
    if not video_id:
        raise HTTPException(status_code=400, detail="Paste an IQNex link or an 11-character video id.")
    row = models.WatchLesson(title=title[:255], youtube_id=video_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return watch_lesson_out(row)

@app.delete("/api/v1/watch/{lesson_id}")
async def delete_watch_lesson(lesson_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.WatchLesson).where(models.WatchLesson.id == lesson_id))
    row = res.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    await db.delete(row)
    await db.commit()
    return {"message": "Removed"}

@app.post("/api/v1/live/end/{session_id}")
async def end_live_session(session_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.LiveSession).where(models.LiveSession.id == session_id))
    session = res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="This live class belongs to another instructor.")
    session.is_active = False
    await db.commit()
    return {"message": "Ended"}

# Dashboard optimized
@app.get("/api/v1/instructor/assignments")
async def get_assignment_dashboard(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # ⚡ OPTIMIZED DASHBOARD QUERY
    # Fetch Courses + Modules + Items(Assignment) + Submissions + Student
    # This prevents the 10,000 query crash loop.
    result = await db.execute(
        select(models.Course)
        .options(
            selectinload(models.Course.modules)
            .selectinload(models.Module.items)
           # Assuming relationship back to submission exists? 
            # Actually better to just load course structure and then fetch submissions in batch
        )
    )
    courses = result.scalars().all()
    
    # Batch fetch all students
    all_students_res = await db.execute(select(models.User).where(models.User.role == "student"))
    all_students = all_students_res.scalars().all()
    student_map = {s.id: s for s in all_students}

    # Batch fetch enrollments
    enroll_res = await db.execute(select(models.Enrollment))
    all_enrollments = enroll_res.scalars().all()
    
    # Process in memory (Fast Python is better than N+1 DB calls)
    dashboard_data = []
    
    for course in courses:
        course_data = { "course_id": course.id, "course_title": course.title, "assignment_tasks": [] }
        
        # Get students for this course
        enrolled_ids = [e.user_id for e in all_enrollments if e.course_id == course.id]
        
        for module in course.modules:
            for item in module.items:
                if item.type == "assignment":
                    # Get submissions for this item (Need a relationship or separate query. For strictness, separate query is safer here if relationship missing)
                    # To keep it async safe:
                    sub_res = await db.execute(select(models.Submission).where(models.Submission.content_item_id == item.id))
                    submissions = sub_res.scalars().all()
                    
                    submitted_list = []
                    submitted_ids = set()
                    
                    for sub in submissions:
                        student = student_map.get(sub.user_id)
                        if not student: continue
                        submitted_ids.add(sub.user_id)
                        clean_name = sub.drive_link.replace("Uploaded: ", "").strip()
                        smart_link = f"https://drive.google.com/drive/search?q=name contains '{clean_name}'"
                        submitted_list.append({
                            "submission_id": sub.id, "student_name": student.full_name, 
                            "file_name": clean_name, "drive_search_link": smart_link, 
                            "status": sub.status, "submitted_at": sub.submitted_at.strftime("%Y-%m-%d")
                        })
                    
                    pending_list = []
                    for sid in enrolled_ids:
                        if sid not in submitted_ids and sid in student_map:
                            s = student_map[sid]
                            pending_list.append({"student_id": s.id, "student_name": s.full_name, "email": s.email})
                    
                    course_data["assignment_tasks"].append({
                        "task_id": item.id, "task_title": item.title, 
                        "submitted": submitted_list, "pending": pending_list
                    })
        
        dashboard_data.append(course_data)
        
    return dashboard_data

@app.post("/api/v1/instructor/verify-assignment/{submission_id}")
async def verify_assignment(submission_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.Submission).where(models.Submission.id == submission_id))
    sub = res.scalars().first()
    if not sub: raise HTTPException(status_code=404)
    pair = await course_of_item(sub.content_item_id, db)
    if not pair:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await load_owned_course(pair[0].id, current_user, db)
    
    # 1. Update Status
    sub.status = "Verified"
    
    # 2. Ensure Progress is Marked Complete
    prog_res = await db.execute(select(models.LessonProgress).where(models.LessonProgress.user_id == sub.user_id, models.LessonProgress.content_item_id == sub.content_item_id))
    progress = prog_res.scalars().first()
    if not progress:
        db.add(models.LessonProgress(user_id=sub.user_id, content_item_id=sub.content_item_id, is_completed=True))
    else:
        progress.is_completed = True
        
    await db.commit()
    
    # ✅ Removed certificate logic.
    return {"message": "Verified"}

# 1. Toggle Item Completion (The Green Tick)
@app.post("/api/v1/content/{item_id}/complete")
async def mark_item_complete(item_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    pair = await course_of_item(item_id, db)
    if not pair:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course, _item = pair
    await require_enrolment(current_user, course.id, db)
    # Check if progress record exists
    res = await db.execute(select(models.LessonProgress).where(
        models.LessonProgress.user_id == current_user.id, 
        models.LessonProgress.content_item_id == item_id
    ))
    progress = res.scalars().first()

    if not progress:
        # Create new record as completed
        progress = models.LessonProgress(user_id=current_user.id, content_item_id=item_id, is_completed=True)
        db.add(progress)
    else:
        # If it exists, ensure it is true (or toggle if you prefer, but usually 'mark as read' is one-way or explicit)
        progress.is_completed = True
        
    await db.commit()
    return {"message": "Marked as complete", "status": "success"}


def _assessment_row(row: models.CourseAssessment):
    return {
        "submitted": True,
        "link": row.link or "",
        "file_name": row.file_name or "",
        "submitted_at": row.submitted_at.strftime("%Y-%m-%d") if row.submitted_at else "",
    }

@app.get("/api/v1/courses/{course_id}/assessment")
async def get_course_assessment(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    res = await db.execute(select(models.CourseAssessment).where(
        models.CourseAssessment.user_id == current_user.id,
        models.CourseAssessment.course_id == course_id,
    ))
    row = res.scalars().first()
    if not row:
        return {"submitted": False, "link": "", "file_name": "", "submitted_at": ""}
    return _assessment_row(row)

@app.post("/api/v1/courses/{course_id}/assessment")
async def submit_course_assessment(
    course_id: int,
    file: UploadFile | None = File(None),
    link: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    course_res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    if not course_res.scalars().first():
        raise HTTPException(status_code=404, detail="Course not found")
    enrol = await db.execute(select(models.Enrollment).where(models.Enrollment.user_id == current_user.id, models.Enrollment.course_id == course_id))
    if not enrol.scalars().first():
        raise HTTPException(status_code=403, detail="Enrol in this course before submitting the assessment.")
    _done, total_items, finished = await check_progress_status(current_user.id, course_id, db)
    if total_items == 0 or not finished:
        raise HTTPException(status_code=400, detail="Finish every module before submitting the assessment.")

    folder_link = (link or "").strip()
    saved_name = ""
    if file and file.filename:
        allowed = {".pdf", ".zip", ".doc", ".docx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".txt"}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed:
            raise HTTPException(status_code=400, detail="Upload a PDF, ZIP, document, or image.")
        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="The file must be 20 MB or smaller.")
        folder = os.path.join(os.path.dirname(__file__), "assessment_uploads")
        os.makedirs(folder, exist_ok=True)
        saved_name = f"{current_user.id}_{course_id}_{int(datetime.utcnow().timestamp())}{ext}"
        with open(os.path.join(folder, saved_name), "wb") as handle:
            handle.write(content)
    else:
        content = b""
    if not saved_name and not folder_link.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Upload a file or paste a project folder link.")

    existing = await db.execute(select(models.CourseAssessment).where(
        models.CourseAssessment.user_id == current_user.id,
        models.CourseAssessment.course_id == course_id,
    ))
    row = existing.scalars().first()
    if not row:
        row = models.CourseAssessment(user_id=current_user.id, course_id=course_id)
        db.add(row)
    if saved_name:
        row.file_name = saved_name
        row.file_data = content
    if folder_link:
        row.link = folder_link
    row.submitted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return _assessment_row(row)

# 2. Final Course Completion (The "Complete Course" Button)
@app.post("/api/v1/courses/{course_id}/claim-certificate")
async def claim_course_certificate(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Fetch Course Type
    course_res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = course_res.scalars().first()
    
    if not course: raise HTTPException(status_code=404)
    await require_enrolment(current_user, course_id, db)

    submitted = await db.execute(select(models.CourseAssessment).where(
        models.CourseAssessment.user_id == current_user.id,
        models.CourseAssessment.course_id == course_id,
    ))
    if not submitted.scalars().first():
        return {"status": "error", "message": "Upload the assessment file or project link before the certificate is issued."}

    _done, total_items, finished = await check_progress_status(current_user.id, course_id, db)
    if total_items == 0 or not finished:
        return {"status": "error", "message": "Finish every lesson in the course before the certificate is issued."}

    await generate_certificate_record(current_user.id, course_id, db)
    return {"status": "success", "message": "Certificate Generated!", "certificate_ready": True}

 
@app.get("/api/v1/courses/{course_id}/challenges")
async def get_course_challenges(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Fetch Challenges Directly from DB
    result = await db.execute(select(models.CourseChallenge).where(models.CourseChallenge.course_id == course_id))
    challenges = result.scalars().all()
    
    challenges_data = []
    for c in challenges:
        challenges_data.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "difficulty": c.difficulty,
            "test_cases": c.test_cases if current_user.role == "instructor" else visible_test_cases(c.test_cases),
            "course_id": c.course_id
        })

    # 2. Fetch User Progress
    try:
        solved_res = await db.execute(text("SELECT challenge_id FROM challenge_progress WHERE user_id = :uid"), {"uid": current_user.id})
        solved_ids = {row[0] for row in solved_res.fetchall()}
    except Exception as e:
        solved_ids = set()

    # 3. Merge
    final_response = []
    for challenge in challenges_data:
        challenge["is_solved"] = challenge["id"] in solved_ids
        final_response.append(challenge)

    return final_response
# 3️⃣ ADD CREATE CHALLENGE
@app.post("/api/v1/courses/{course_id}/challenges")
async def create_course_challenge(course_id: int, challenge: ChallengeCreate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    await load_owned_course(course_id, current_user, db)
    new_challenge = models.CourseChallenge(
        title=challenge.title,
        description=challenge.description,
        difficulty=challenge.difficulty,
        test_cases=challenge.test_cases,
        course_id=course_id
    )
    db.add(new_challenge)
    await db.commit()
    
    return {"message": "Challenge added"}

@app.post("/api/v1/login-otp")
async def login_otp(req: OTPLoginRequest):
    raise HTTPException(status_code=410, detail="Phone login is turned off. Sign in with email and password.")

@app.post("/api/v1/proctoring/violation")
async def record_violation(report: ViolationReport, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    res = await db.execute(select(models.LessonProgress).where(models.LessonProgress.user_id == current_user.id, models.LessonProgress.content_item_id == report.lesson_id))
    progress = res.scalars().first()
    
    if not progress:
        progress = models.LessonProgress(user_id=current_user.id, content_item_id=report.lesson_id, is_completed=False, violation_count=1)
        db.add(progress)
    else:
        if progress.is_terminated:
            return {"status": "terminated", "message": "Already terminated", "violation_count": progress.violation_count}
            
        progress.violation_count += 1
        
        # ✅ FIX 1: Strict Logic. If count is 2 or more, Terminate.
        if progress.violation_count >= 2: 
            progress.is_terminated = True
            progress.is_completed = False
            
    await db.commit()
    
    return {
        "status": "terminated" if progress.is_terminated else "warning", 
        "violation_count": progress.violation_count,
        # ✅ FIX 2: Correct math for frontend display (Max 2)
        "remaining_attempts": max(0, 2 - progress.violation_count) 
    }
    
# ✅ NEW: Helper to refresh status instantly on frontend mount
@app.get("/api/v1/proctoring/status/{lesson_id}")
async def get_lesson_status(lesson_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    res = await db.execute(select(models.LessonProgress).where(
        models.LessonProgress.user_id == current_user.id, 
        models.LessonProgress.content_item_id == lesson_id
    ))
    progress = res.scalars().first()
    
    if not progress:
        return {"is_terminated": False, "violation_count": 0}
        
    return {
        "is_terminated": progress.is_terminated,
        "violation_count": progress.violation_count
    }    
    
@app.patch("/api/v1/modules/{module_id}")
async def update_module(module_id: int, update: ModuleUpdate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.Module).where(models.Module.id == module_id))
    module = res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    await load_owned_course(module.course_id, current_user, db)
    
    module.title = update.title
    await db.commit()
    return {"message": "Module renamed"}

# 2. Delete Module (Cascade)
@app.delete("/api/v1/modules/{module_id}")
async def delete_module(module_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # Fetch module with items to delete dependencies
    res = await db.execute(select(models.Module).options(selectinload(models.Module.items)).where(models.Module.id == module_id))
    module = res.scalars().first()
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    await load_owned_course(module.course_id, current_user, db)
    
    try:
        # Delete dependencies for ALL items in this module
        for item in module.items:
            await db.execute(delete(models.LessonProgress).where(models.LessonProgress.content_item_id == item.id))
            await db.execute(delete(models.Submission).where(models.Submission.content_item_id == item.id))
            await db.execute(delete(models.LessonNote).where(models.LessonNote.content_item_id == item.id))
        
        # Now delete items
        await db.execute(delete(models.ContentItem).where(models.ContentItem.module_id == module_id))
        
        # Finally delete module
        await db.delete(module)
        await db.commit()
        return {"message": "Module deleted"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# 3. Reorder Items
class ReorderRequest(BaseModel):
    item_ids: List[int] # List of IDs in the new order

@app.put("/api/v1/modules/{module_id}/reorder")
async def reorder_module_items(module_id: int, req: ReorderRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    module_res = await db.execute(select(models.Module).where(models.Module.id == module_id))
    module = module_res.scalars().first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    await load_owned_course(module.course_id, current_user, db)
    owned_ids = set((await db.execute(select(models.ContentItem.id).where(models.ContentItem.module_id == module_id))).scalars().all())
    # Update the 'order' field for each item based on its index in the list
    for index, item_id in enumerate(req.item_ids):
        if item_id not in owned_ids:
            continue
        await db.execute(
            models.ContentItem.__table__.update()
            .where(models.ContentItem.id == item_id)
            .values(order=index)
        )
    await db.commit()
    return {"message": "Order updated"}    

@app.post("/api/v1/notifications/send")
async def send_notification(req: NotificationRequest, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    recipients = []
    
    # Logic 1: Send to All Students
    if req.target_type == "all":
        res = await db.execute(select(models.User.id).where(models.User.role == "student"))
        recipients = res.scalars().all()
    
    # Logic 2: Send to Students in Specific Course
    elif req.target_type == "course":
        res = await db.execute(select(models.Enrollment.user_id).where(models.Enrollment.course_id == req.target_id))
        recipients = res.scalars().all()
        
    # Logic 3: Send to Single Student
    elif req.target_type == "student":
        recipients = [req.target_id]

    # Bulk Insert
    for uid in recipients:
        new_notif = models.Notification(
            user_id=uid,
            title="Message from Instructor",
            message=req.message,
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(new_notif)
    
    await db.commit()
    return {"message": f"Sent to {len(recipients)} students."}

# 2. Student Gets Notifications
@app.get("/api/v1/notifications")
async def get_notifications(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    res = await db.execute(
        select(models.Notification)
        .where(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
    )
    return res.scalars().all()

# 3. Mark as Read (Optional, happens when they open the page)
@app.patch("/api/v1/notifications/read")
async def mark_notifications_read(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    await db.execute(
        models.Notification.__table__.update()
        .where(models.Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Marked read"}

# 4. Delete Notification
@app.delete("/api/v1/notifications/{notif_id}")
async def delete_notification(notif_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    await db.execute(delete(models.Notification).where(models.Notification.id == notif_id, models.Notification.user_id == current_user.id))
    await db.commit()
    return {"message": "Deleted"}

@app.delete("/api/v1/notifications")
async def clear_all_notifications(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    result = await db.execute(delete(models.Notification))
    await db.commit()
    return {"message": "All notifications removed.", "deleted": result.rowcount or 0}

class ProgramIn(BaseModel):
    kind: str
    title: str
    summary: str = ""
    details: str = ""
    mode: str = "online"
    starts_on: str = ""
    seats: int = 0
    prize: str = ""
    level: str = ""

class ProgramNote(BaseModel):
    note: str = ""

def _program_row(item: models.ProgramItem, registration: models.ProgramRegistration | None):
    return {
        "id": item.id,
        "kind": item.kind,
        "title": item.title,
        "summary": item.summary or "",
        "details": item.details or "",
        "mode": item.mode or "online",
        "starts_on": item.starts_on or "",
        "seats": item.seats or 0,
        "prize": item.prize or "",
        "level": item.level or "",
        "registered": registration is not None,
        "status": registration.status if registration else "",
        "note": registration.note if registration else "",
    }

@app.get("/api/v1/programs")
async def list_programs(kind: str = "", db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = select(models.ProgramItem)
    if current_user.role != "instructor":
        query = query.where(models.ProgramItem.is_published == True)
    if kind:
        query = query.where(models.ProgramItem.kind == kind)
    res = await db.execute(query.order_by(models.ProgramItem.id.desc()))
    items = res.scalars().all()
    regs = await db.execute(select(models.ProgramRegistration).where(models.ProgramRegistration.user_id == current_user.id))
    by_item = {row.item_id: row for row in regs.scalars().all()}
    return [_program_row(item, by_item.get(item.id)) for item in items]

@app.post("/api/v1/programs", status_code=201)
async def create_program(body: ProgramIn, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    if body.kind not in {"event", "hackathon", "competition"}:
        raise HTTPException(status_code=400, detail="Kind must be event, hackathon, or competition.")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="A title is required.")
    item = models.ProgramItem(
        kind=body.kind,
        title=body.title.strip(),
        summary=body.summary.strip(),
        details=body.details.strip(),
        mode=body.mode.strip() or "online",
        starts_on=body.starts_on.strip(),
        seats=body.seats,
        prize=body.prize.strip(),
        level=body.level.strip(),
        created_by=current_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _program_row(item, None)

@app.delete("/api/v1/programs/{item_id}")
async def delete_program(item_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    await db.execute(delete(models.ProgramRegistration).where(models.ProgramRegistration.item_id == item_id))
    await db.execute(delete(models.ProgramItem).where(models.ProgramItem.id == item_id))
    await db.commit()
    return {"message": "Removed"}

@app.post("/api/v1/programs/{item_id}/register")
async def register_program(item_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    item_res = await db.execute(select(models.ProgramItem).where(models.ProgramItem.id == item_id, models.ProgramItem.is_published == True))
    item = item_res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="This is not open for registration.")
    existing = await db.execute(select(models.ProgramRegistration).where(models.ProgramRegistration.user_id == current_user.id, models.ProgramRegistration.item_id == item_id))
    row = existing.scalars().first()
    if not row:
        row = models.ProgramRegistration(user_id=current_user.id, item_id=item_id, status="registered")
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return _program_row(item, row)

@app.post("/api/v1/programs/{item_id}/submit")
async def submit_program(item_id: int, body: ProgramNote, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    item_res = await db.execute(select(models.ProgramItem).where(models.ProgramItem.id == item_id))
    item = item_res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found.")
    existing = await db.execute(select(models.ProgramRegistration).where(models.ProgramRegistration.user_id == current_user.id, models.ProgramRegistration.item_id == item_id))
    row = existing.scalars().first()
    if not row:
        raise HTTPException(status_code=400, detail="Register before you submit.")
    row.status = "submitted"
    row.note = body.note.strip()
    await db.commit()
    return _program_row(item, row)

def _profile_payload(user: models.User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "phone_number": getattr(user, "phone_number", None),
        "college": getattr(user, "college", None),
        "organization": getattr(user, "organization", None),
        "social_media_link": getattr(user, "social_media_link", None),
    }

@app.get("/api/v1/users/me")
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return _profile_payload(current_user)

@app.patch("/api/v1/users/me")
async def update_users_me(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if body.full_name is not None:
        name = body.full_name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Enter a valid name.")
        current_user.full_name = name
    if body.phone_number is not None:
        phone = re.sub(r"\D", "", body.phone_number or "")
        if phone and len(phone) < 10:
            raise HTTPException(status_code=400, detail="Enter a mobile number with at least 10 digits.")
        current_user.phone_number = phone or None
    if body.college is not None:
        current_user.college = body.college.strip() or None
    if body.organization is not None:
        current_user.organization = body.organization.strip() or None
    if body.social_media_link is not None:
        link = body.social_media_link.strip()
        if link and not (link.startswith("http://") or link.startswith("https://")):
            link = f"https://{link}"
        current_user.social_media_link = link or None
    await db.commit()
    await db.refresh(current_user)
    return _profile_payload(current_user)

@app.post("/api/v1/admin/trigger-backup")
async def manual_backup(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    # Run the backup synchronously
    backup_path = backup_manager.create_local_backup()
    if backup_path:
        backup_manager.upload_to_drive(backup_path)
        backup_manager.cleanup_old_backups()
        return {"message": "Backup triggered successfully!"}
    return {"message": "Backup failed."}

@app.post("/api/v1/challenges/{challenge_id}/solve")
async def mark_challenge_solved(challenge_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    # 1. Check if challenge exists
    res = await db.execute(select(models.CourseChallenge).where(models.CourseChallenge.id == challenge_id))
    challenge = res.scalars().first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    attempt = await db.execute(select(models.CodeAttempt).where(
        models.CodeAttempt.user_id == current_user.id,
        models.CodeAttempt.challenge_id == challenge_id,
        models.CodeAttempt.all_passed == True,
    ))
    if not attempt.scalars().first():
        raise HTTPException(status_code=400, detail="The official tests have not passed yet.")

    try:
        # We use ON CONFLICT DO NOTHING to avoid errors if they solve it twice
        # Note: Ensure your DB has a UNIQUE constraint on (user_id, challenge_id)
        # If not, use a SELECT check first.
        
        # Safe check logic just in case unique constraint isn't set:
        check_res = await db.execute(text("SELECT 1 FROM challenge_progress WHERE user_id=:uid AND challenge_id=:cid"), {"uid": current_user.id, "cid": challenge_id})
        if not check_res.first():
            await db.execute(
                text("INSERT INTO challenge_progress (user_id, challenge_id, is_solved, solved_at) VALUES (:uid, :cid, :solved, :time)"),
                {"uid": current_user.id, "cid": challenge_id, "solved": True, "time": datetime.utcnow()}
            )
            await db.commit()
    except Exception as e:
        print(f"Error saving progress: {e}")
        pass

    return {"status": "success", "message": "Challenge marked as solved"}

@app.patch("/api/v1/challenges/{challenge_id}")
async def update_challenge(challenge_id: int, update: ChallengeUpdate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.CourseChallenge).where(models.CourseChallenge.id == challenge_id))
    challenge = res.scalars().first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    await load_owned_course(challenge.course_id, current_user, db)

    if update.title: challenge.title = update.title
    if update.description: challenge.description = update.description
    if update.difficulty: challenge.difficulty = update.difficulty
    if update.test_cases: challenge.test_cases = update.test_cases
    
    await db.commit()
    
    return {"message": "Challenge updated successfully"}

@app.delete("/api/v1/challenges/{challenge_id}")
async def delete_challenge(challenge_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.CourseChallenge).where(models.CourseChallenge.id == challenge_id))
    challenge = res.scalars().first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    await load_owned_course(challenge.course_id, current_user, db)
        
    # Delete related progress first to avoid foreign key constraints
    await db.execute(text("DELETE FROM challenge_progress WHERE challenge_id = :cid"), {"cid": challenge_id})
    
    await db.delete(challenge)
    await db.commit()
    
    return {"message": "Challenge deleted"}

@app.get("/api/v1/course-description-pdf/{course_id}")
async def generate_course_description_pdf(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Fetch Course
    res = await db.execute(select(models.Course).where(models.Course.id == course_id))
    course = res.scalars().first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 2. Generate PDF using ReportLab
    # We run this in a thread to avoid blocking the async loop
    def make_pdf():
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # -- Styling --
        # Header Blue Bar
        p.setFillColor(colors.Color(0/255, 94/255, 184/255)) # iQmath Blue
        p.rect(0, height - 100, width, 100, fill=True, stroke=False)
        
        # Title (White text on Blue)
        p.setFillColor(colors.white)
        p.setFont("Helvetica-Bold", 24)
        p.drawCentredString(width / 2, height - 60, "Course Syllabus & Overview")
        
        # Course Name
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 20)
        p.drawCentredString(width / 2, height - 140, course.title)
        
        # Divider Line
        p.setStrokeColor(colors.lightgrey)
        p.line(50, height - 160, width - 50, height - 160)
        
        # Description Body
        p.setFont("Helvetica", 12)
        text_object = p.beginText(50, height - 200)
        
        # Simple text wrapping logic
        description = course.description or "No description provided."
        max_width = 80  # Characters per line approx
        
        for paragraph in description.split('\n'):
            words = paragraph.split()
            line = ""
            for word in words:
                if len(line + word) < max_width:
                    line += word + " "
                else:
                    text_object.textLine(line)
                    line = word + " "
            text_object.textLine(line)
            text_object.textLine("") # Empty line between paragraphs
            
        p.drawText(text_object)
        
        # Footer
        p.setFont("Helvetica-Oblique", 10)
        p.setFillColor(colors.grey)
        p.drawCentredString(width / 2, 30, f"Generated by iQmath Pro • {datetime.utcnow().strftime('%Y-%m-%d')}")
        
        p.showPage()
        p.save()
        buffer.seek(0)
        return buffer

    pdf_buffer = await asyncio.to_thread(make_pdf)
    
    # 3. Return as Streaming Response
    filename = f"{course.title.replace(' ', '_')}_Syllabus.pdf"
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    
class NoteIn(BaseModel):
    body: str = ""

class ForgotIn(BaseModel):
    email: str

class ResetIn(BaseModel):
    token: str
    new_password: str

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

@app.get("/api/v1/courses/{course_id}/notes")
async def list_notes(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    await require_enrolment(current_user, course_id, db)
    res = await db.execute(
        select(models.LessonNote, models.ContentItem.id)
        .join(models.ContentItem, models.ContentItem.id == models.LessonNote.content_item_id)
        .join(models.Module, models.Module.id == models.ContentItem.module_id)
        .where(models.Module.course_id == course_id, models.LessonNote.user_id == current_user.id)
    )
    return [{"lesson_id": lesson_id, "body": note.body or ""} for note, lesson_id in res.all()]

@app.put("/api/v1/courses/{course_id}/notes/{lesson_id}")
async def save_note(course_id: int, lesson_id: int, body: NoteIn, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_student)):
    await require_enrolment(current_user, course_id, db)
    pair = await course_of_item(lesson_id, db)
    if not pair or pair[0].id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    existing = await db.execute(select(models.LessonNote).where(
        models.LessonNote.user_id == current_user.id,
        models.LessonNote.content_item_id == lesson_id,
    ))
    row = existing.scalars().first()
    if not row:
        row = models.LessonNote(user_id=current_user.id, content_item_id=lesson_id)
        db.add(row)
    row.body = body.body or ""
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"lesson_id": lesson_id, "body": row.body}

@app.post("/api/v1/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotIn, db: AsyncSession = Depends(get_db)):
    generic = {"message": "If that email has an account, a reset link is on its way."}
    email = (body.email or "").strip()
    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalars().first()
    if not user or user.is_active is False:
        return generic
    raw = secrets.token_urlsafe(32)
    db.add(models.PasswordReset(
        user_id=user.id,
        token_hash=_hash_token(raw),
        expires_at=datetime.utcnow() + timedelta(minutes=30),
        used=False,
    ))
    await db.commit()
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    link = f"{frontend}/reset-password?token={raw}"
    try:
        await asyncio.to_thread(
            send_credentials_email,
            user.email,
            user.full_name or "Student",
            None,
            "Reset your IQNex password",
            f"Hello {user.full_name or 'there'},\n\nUse this link within 30 minutes to choose a new password:\n{link}\n\nIf you did not ask for this, you can ignore the email.",
        )
    except Exception as exc:
        print(f"Password reset email failed: {exc}")
        raise HTTPException(status_code=503, detail="The reset email could not be sent. Ask an instructor to reset the password from the student list.")
    return generic

@app.post("/api/v1/reset-password")
@limiter.limit("8/minute")
async def reset_password(request: Request, body: ResetIn, db: AsyncSession = Depends(get_db)):
    if len(body.new_password or "") < 8:
        raise HTTPException(status_code=400, detail="Use at least 8 characters.")
    token_hash = _hash_token(body.token or "")
    res = await db.execute(select(models.PasswordReset).where(models.PasswordReset.token_hash == token_hash, models.PasswordReset.used == False))
    row = res.scalars().first()
    if not row or row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    user_res = await db.execute(select(models.User).where(models.User.id == row.user_id))
    user = user_res.scalars().first()
    if not user or user.is_active is False:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    user.hashed_password = await asyncio.to_thread(get_password_hash, body.new_password)
    row.used = True
    await db.commit()
    return {"message": "Password updated. Sign in with the new password."}

@app.get("/api/v1/instructor/submissions/{submission_id}/file")
async def download_submission_file(submission_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    res = await db.execute(select(models.Submission).where(models.Submission.id == submission_id))
    sub = res.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    pair = await course_of_item(sub.content_item_id, db)
    if not pair:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await load_owned_course(pair[0].id, current_user, db)
    if sub.file_data:
        name = os.path.basename((sub.drive_link or "").replace("Uploaded:", "").strip()) or "submission"
        return file_attachment(bytes(sub.file_data), name)
    name = os.path.basename((sub.drive_link or "").replace("Uploaded:", "").strip())
    if not name:
        raise HTTPException(status_code=404, detail="No file is stored for this submission")
    candidates = [
        os.path.join("assignments_backup", name),
        os.path.join(os.path.dirname(__file__), "assignments_backup", name),
    ]
    path = next((item for item in candidates if os.path.isfile(item)), "")
    if not path:
        raise HTTPException(status_code=404, detail="The file is not on this server. Check Google Drive if the upload succeeded there.")
    return FileResponse(path, filename=name, media_type=guess_mime(name))

@app.get("/api/v1/instructor/courses/{course_id}/assessments")
async def instructor_assessments(course_id: int, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    await load_owned_course(course_id, current_user, db)
    res = await db.execute(
        select(models.CourseAssessment, models.User)
        .join(models.User, models.User.id == models.CourseAssessment.user_id)
        .where(models.CourseAssessment.course_id == course_id)
        .order_by(models.CourseAssessment.submitted_at.desc())
    )
    rows = []
    for item, student in res.all():
        rows.append({
            "student": student.full_name,
            "email": student.email,
            "file_name": item.file_name or "",
            "link": item.link or "",
            "submitted_at": item.submitted_at.strftime("%Y-%m-%d") if item.submitted_at else "",
        })
    return rows

@app.get("/api/v1/instructor/assessments/file/{file_name}")
async def download_assessment_file(file_name: str, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(require_instructor)):
    safe_name = os.path.basename(file_name)
    res = await db.execute(select(models.CourseAssessment).where(models.CourseAssessment.file_name == safe_name))
    row = res.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    await load_owned_course(row.course_id, current_user, db)
    if row.file_data:
        return file_attachment(bytes(row.file_data), safe_name)
    path = os.path.join(os.path.dirname(__file__), "assessment_uploads", safe_name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=safe_name, media_type=guess_mime(safe_name))

@app.get("/")
def read_root(): return {"status": "online", "message": "iQmath Military Grade API Active"}
