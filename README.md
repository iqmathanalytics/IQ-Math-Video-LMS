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

## Deploy

The API runs on Render. The site runs on Cloudflare Pages. The database stays on the host already in `DATABASE_URL` (TiDB Cloud or PostgreSQL). Render does not create a database.

Paste secret values without the quotation marks from the `.env` files. `VITE_*` values are baked in when Cloudflare builds the site, so changing them requires a new frontend deploy.

### 1. Push the repo

Commit these deployment files and push `main` to GitHub:

- `render.yaml` (API only)
- `frontend/public/_redirects` (keeps client-side routes working)
- `frontend/public/_headers`

### 2. Create the Render API

1. Sign in at https://dashboard.render.com and connect the GitHub repo.
2. **New → Blueprint**, point it at this repo, and apply `render.yaml`. That creates the web service `iqmath-backend` (Python, root directory `backend`, Oregon).
3. When the form asks for secrets, copy them from `backend/.env` **without quotes**:

| Key | Value |
| --- | --- |
| `SECRET_KEY` | long random string, not `change_me` |
| `DATABASE_URL` | TiDB or PostgreSQL URL. It must be reachable from the internet, not `localhost` |
| `FRONTEND_URL` | leave blank until Cloudflare gives you a URL, then set it with no trailing slash |
| `ALLOWED_ORIGINS` | same Cloudflare origin, or several separated by commas: `https://your-app.pages.dev,https://www.yourdomain.com` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | live Razorpay key pair |
| `GEMINI_API_KEY` | Gemini key |
| `EMAIL_SENDER` / `BREVO_API_KEY` | Brevo sender and API key |
| `AWS_LAMBDA_URL` | compiler Function URL |

Non-secret keys (`PYTHON_VERSION`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`) are already in `render.yaml`.

4. Open **Logs** and wait until the deploy is live.
5. Open `https://<service>.onrender.com/` and confirm JSON like `{"status":"online",...}`. Docs stay at `/docs`.

The start command binds `$PORT` and trusts Render's proxy headers. The service creates missing tables on startup, so a separate migration step is not required for a first deploy.

Free instances sleep after 15 minutes without requests. The first request after that can take about a minute. Use a paid plan when the site needs to stay awake.

Uploaded assessment files live on the instance disk and disappear on the next deploy. Keep course media on YouTube or another durable store.

### 3. Create the Cloudflare Pages site

1. In https://dash.cloudflare.com go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repo and set:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node.js version | `20` (`NODE_VERSION=20` under Environment variables) |

3. Add these **build** environment variables for Production (and Preview if you use it). Copy Firebase and Razorpay values from `frontend/.env`, without quotes.

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<service>.onrender.com/api/v1` |
| `VITE_RAZORPAY_KEY_ID` | same public key as `RAZORPAY_KEY_ID` |
| `VITE_RAZORPAY_PAYLINK_URL` | `https://razorpay.me/iqmathtechnologies` |
| `VITE_FIREBASE_API_KEY` | from `frontend/.env` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `iqmath-lms.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `iqmath-lms` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `iqmath-lms.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | from `frontend/.env` |
| `VITE_FIREBASE_APP_ID` | from `frontend/.env` |
| `VITE_FIREBASE_MEASUREMENT_ID` | from `frontend/.env` |

`VITE_API_URL` must end with `/api/v1`.

4. Deploy. Cloudflare assigns `https://<project>.pages.dev`.

### 4. Point the API at that site

1. On Render, set `FRONTEND_URL` and `ALLOWED_ORIGINS` to `https://<project>.pages.dev` (add a custom domain too, if you attach one).
2. Save. Render restarts the API. No frontend rebuild is required for this step.
3. In Firebase Authentication → Settings → **Authorized domains**, add `<project>.pages.dev` and any custom domain: https://console.firebase.google.com/project/iqmath-lms/authentication/settings
4. Open the Pages URL, sign in, and open a course. A CORS error in the browser means `ALLOWED_ORIGINS` does not match the exact site origin, including `https://`.

### 5. Optional custom domain

In Cloudflare Pages → **Custom domains**, add the domain. Add the same hostname to `ALLOWED_ORIGINS` and to Firebase authorized domains, then restart the API.
