# IQMath Learning Management System

A full-stack Learning Management System complete with payment integration, AI features, an interactive code compiler, and secure authentication. 

Official repository: https://github.com/iqmathanalytics/iqmathlms_platform

## 🏗️ Project Architecture
This project is divided into two main parts:
- **Backend:** FastAPI, PostgreSQL, SQLAlchemy, Asyncpg, Python-Jose (JWT Authentication)
- **Frontend:** React, Vite, Tailwind CSS, Firebase (OTP), Framer Motion, Recharts

## 📋 Prerequisites
Before you begin, ensure you have the following installed on your machine:
- Node.js (v18+)
- Python 3.9+
- TiDB Cloud (MySQL-compatible) or PostgreSQL

---

## 🔐 Environment Variables (.env)

You must create a `.env` file in both the `backend` and `frontend` directories before starting the project.

### Backend (`backend/.env`)
Create a new file `backend/.env` and add the following keys. Replace placeholders with your own actual values where applicable.

```ini
# SECURITY
SECRET_KEY="supersecretkey_change_this_in_production"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=60

# DATABASE
# PostgreSQL example:
# DATABASE_URL="postgresql://user:password@host:5432/dbname"
#
# TiDB/MySQL example:
# DATABASE_URL="mysql://user:password@host:4000/test?ssl_verify_cert=true&ssl_verify_identity=true"
DATABASE_URL="your_database_url"

# RAZORPAY PAYMENT
RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_secret"

# GEMINI AI
GEMINI_API_KEY="your_gemini_api_key"

# EMAIL CONFIGURATION (Brevo)
EMAIL_SENDER="your_email@gmail.com"
BREVO_API_KEY="your_brevo_api_key"

# JUDGE0 COMPILER API
JUDGE0_API_KEY="your_judge0_api_key"
JUDGE0_API_HOST="judge0-ce.p.rapidapi.com"

# AWS LAMBDA URL
AWS_LAMBDA_URL="your_aws_lambda_url"
```

### Frontend (`frontend/.env`)
Create a new file `frontend/.env` and configure your API and Firebase parameters:

```ini
# --- API CONNECTION ---
VITE_API_URL=http://localhost:8000/api/v1  # or your production backend URL

# --- RAZORPAY ---
VITE_RAZORPAY_KEY_ID="your_razorpay_key_id"
VITE_RAZORPAY_PAYLINK_URL="https://razorpay.me/iqmathtechnologies"

# --- FIREBASE CONFIG ---
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
VITE_FIREBASE_MEASUREMENT_ID="your_measurement_id"
```

Firebase console for this project:
https://console.firebase.google.com/project/iqmath-lms/overview

---

## 🚀 Installation & Running the Project

### 1. Setting up the Backend
Navigate to the `backend` directory, install dependencies, and run the server.

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On MacOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run database migrations (if alembic is set up)
alembic upgrade head

# Start the FastAPI backend server
uvicorn main:app --reload
```
The backend API will run on `http://localhost:8000`. You can access the automatic interactive docs at `http://localhost:8000/docs`.

### 2. Setting up the Frontend
Open a new terminal session, navigate to the `frontend` directory, install the node modules, and start the development server.

```bash
cd frontend

# Install Node modules
npm install

# Start the Vite development server
npm run dev
```
The frontend application will normally host on `http://localhost:5173`.

### 3. Database Seeding (Optional)
If you need to seed initial users into the database, you can run the provided scripts from the project root while your python virtual environment is active.
Before running these, ensure you configure them to match your local database settings.

```bash
# Wait until your local database server is running
python seed_admin.py
python seed_student.py
```

---

## Deploy on Render

Production uses the Blueprint in `render.yaml`. It creates two services. Secret values are not stored in the repo. Copy them from your local `backend/.env` and `frontend/.env` into the Render Dashboard when the Blueprint asks for each `sync: false` key.

Dashboard link (works after `render.yaml` is on `main`):

https://dashboard.render.com/blueprint/new?repo=https://github.com/iqmathanalytics/IQ-Math-Video-LMS

### Services

| Service | Type | Root | Build | Start / publish |
| --- | --- | --- | --- | --- |
| `iqmath-backend` | Python web, free, Oregon | `backend` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| `iqmath-frontend` | Static site, Node 20 | `frontend` | `npm ci && npm run build` | `frontend/dist` |

The API health check is `/docs`. The site rewrites unknown paths to `/index.html` so client-side routes keep working.

The database stays on TiDB Cloud or your existing PostgreSQL host. Render does not create a new database. `DATABASE_URL` is the same connection string as in `backend/.env`.

### Backend environment (`iqmath-backend`)

Set these in the Render Dashboard. Non-secret values are already in `render.yaml`.

| Key | Value |
| --- | --- |
| `PYTHON_VERSION` | `3.12.8` (set by the Blueprint) |
| `SECRET_KEY` | from `backend/.env` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
| `DATABASE_URL` | TiDB or PostgreSQL URL from `backend/.env` |
| `RAZORPAY_KEY_ID` | from `backend/.env` |
| `RAZORPAY_KEY_SECRET` | from `backend/.env` |
| `GEMINI_API_KEY` | from `backend/.env` |
| `EMAIL_SENDER` | from `backend/.env` |
| `BREVO_API_KEY` | from `backend/.env` |
| `JUDGE0_API_KEY` | from `backend/.env` |
| `JUDGE0_API_HOST` | `judge0-ce.p.rapidapi.com` |
| `AWS_LAMBDA_URL` | compiler Function URL from `backend/.env` |

### Frontend environment (`iqmath-frontend`)

Vite reads these at **build** time. After you change any `VITE_*` value, save with **Save, rebuild, and deploy**.

| Key | Value |
| --- | --- |
| `NODE_VERSION` | `20` (set by the Blueprint) |
| `VITE_API_URL` | `https://<iqmath-backend>.onrender.com/api/v1` |
| `VITE_RAZORPAY_KEY_ID` | same public key as `RAZORPAY_KEY_ID` |
| `VITE_RAZORPAY_PAYLINK_URL` | `https://razorpay.me/iqmathtechnologies` |
| `VITE_FIREBASE_API_KEY` | from `frontend/.env` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `iqmath-lms.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `iqmath-lms` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `iqmath-lms.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | from `frontend/.env` |
| `VITE_FIREBASE_APP_ID` | from `frontend/.env` |
| `VITE_FIREBASE_MEASUREMENT_ID` | from `frontend/.env` |

Use the backend URL Render assigns after the API service is created. It must end with `/api/v1`.

Firebase project: https://console.firebase.google.com/project/iqmath-lms/overview

### Apply the Blueprint

1. Push `render.yaml` to `main` on GitHub.
2. Open the Dashboard link above and connect the `iqmathanalytics/IQ-Math-Video-LMS` repo if Render asks.
3. Fill every secret the form lists. Use the tables above.
4. Click **Apply**.
5. When the backend URL is live, set `VITE_API_URL` on `iqmath-frontend` and rebuild that static site.
6. Open `https://<iqmath-backend>.onrender.com/docs` and confirm it loads. Then open the frontend URL and sign in.

Free web services sleep after inactivity. The first request after sleep can take up to a minute.
