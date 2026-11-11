# 🏭 Manufacturing & Production Intelligence Suite

> Enterprise fullstack platform for automated manufacturing list generation, cross-database breakdown testing (PostgreSQL, Microsoft SQL Server, IBM DB2), and real-time fabrication reporting.

[![IBM DB2](https://img.shields.io/badge/IBM_DB2-052FAD?style=for-the-badge&logo=ibm&logoColor=white)](https://www.ibm.com/products/db2)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Microsoft SQL Server](https://img.shields.io/badge/SQL_Server-CC292B?style=for-the-badge&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

[日本語版ドキュメントはこちら (Japanese Documentation)](./README.ja.md)

---

## 📽️ Interactive Walkthrough

<div align="center">
  <video src="Recording.mp4" width="100%" autoplay loop muted playsinline></video>
  <p><em>Demonstration: Multi-Role Authentication &rarr; Tri-Database Reconciliation &rarr; Real-Time Fabrication Picking Dashboard</em></p>
</div>

---

## 💼 Business Context & Engineering Impact (STAR)

* **Situation:** Quality checks and reconciliation between engineering design spreadsheets (Standard Lists) and live factory floor data were conducted manually across fragmented legacy silos, causing discrepancies in Quantity, Length, Color, and Remarks.
* **Task:** Build a centralized web platform capable of cross-reconciling manufacturing data across three heterogeneous enterprise databases (**PostgreSQL**, **MS SQL Server**, and **IBM DB2**) in near real-time while maintaining strict audit trail compliance.
* **Action:**
  * Engineered an asynchronous backend using **FastAPI** with vectorised data processing pipelines (**Pandas**, **OpenPyXL**) for multi-thousand-row spreadsheet validation.
  * Architected a heterogeneous tri-database adapter layer connecting to **PostgreSQL** (DWH and audit storage), **MS SQL Server** (Shiage production tables), and **IBM DB2** (legacy enterprise ERP records).
  * Implemented an automated audit trail middleware and Axios request interceptor pattern that records user identity (`NIK`, `Username`), IP address, HTTP method, and accessed endpoints on every transaction.
  * Designed a responsive UI using **React (Vite)** and **Tailwind CSS** featuring color-coded discrepancy inspectors (`MATCH`, `MISMATCH`, `DB NULL`) and live inventory progress gauges.
* **Result:** Eliminated manual inspection latency by cutting verification cycles from hours to sub-second responses, prevented downstream line stoppages due to mismatched part orders, and provided live production backlog transparency for PPIC and fabrication leads.

---

## 🏗️ System Architecture

```text
                  ┌─────────────────────────────────────────┐
                  │          React + Vite Frontend          │
                  │   (RBAC UI, Axios Global Interceptors)  │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / X-User-Headers
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │             FastAPI Backend             │
                  │   (Logging Middleware, Generator &      │
                  │            Parser Engines)              │
                  └────────────┬───────────────┬────────────┘
                               │               │
            ┌──────────────────┼───────────────┼──────────────────┐
            ▼                  ▼               ▼                  ▼
    ┌───────────────┐  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │  PostgreSQL   │  │ MS SQL Server │ │    IBM DB2    │ │ Excel / Files │
    │ (psycopg2)    │  │ (pyodbc)      │ │ (ibm_db/pyodbc│ │ (OpenPyXL)    │
    │ - Logs & Auth │  │ - Shiage Data │ │ - ERP Core    │ │ - Breakdown   │
    └───────────────┘  └───────────────┘ └───────────────┘ └───────────────┘
```

---

## ✨ Key Modules & Capabilities

### 1. Tri-Engine Breakdown Testing
* **PostgreSQL Engine (BC DWH):** Reconciles uploaded work order sheets against warehouse database records, highlighting field-level anomalies in dimensions and specifications.
* **Shiage Engine (SQL Server):** Compares production datasets against `Profil_MSTDTL` and `PARTs_MSTDTL`.
* **IBM DB2 Enterprise Bridge:** Synchronizes core ERP enterprise item specifications with operational lines.

### 2. Live Fabrication Reports
* Real-time monitoring of outstanding material transfers (`Requirement_Qty` vs. `Actual_Transfer`) backed by PostgreSQL views.
* Metric summary cards for operational visibility: Total Required, Total Actual, and Remaining Quantity with instant CSV/Excel export.

### 3. BD Generator & Production Scheduling
* Parameter-driven calculation module parsing Inner and Outer Standard Lists.
* Dynamic dimension calculation (Width/Height) producing standardized manufacturing outputs alongside milestone timeline trackers.

### 4. Global Audit Logging & RBAC
* Role-based access control protecting divisional workflows: `Admin`, `PPIC`, `Production`, `Delivery`, and `MT`.
* Global audit logging middleware saving client metadata (`X-User-NIK`, `X-User-Name`, client IP) to `system_access_logs`.

---

## 🗂️ Project Directory Structure

```text
project_root/
├── backend/
│   ├── main.py                  # API entry point & global audit logging middleware
│   ├── database_pg.py           # PostgreSQL connection & logging repository
│   ├── database_sqlserver.py    # Microsoft SQL Server connector (Shiage)
│   ├── database_db2.py          # IBM DB2 enterprise connector
│   ├── generator.py             # Manufacturing list output generation logic
│   ├── parser.py                # File & spreadsheet parsing engine
│   ├── models.py                # Pydantic data validation schemas
│   ├── utils.py                 # Core business helper utilities
│   ├── requirements.txt         # Python dependencies
│   ├── data/                    # Storage staging for inputs & generated outputs
│   ├── templates/               # Document and layout reporting templates
│   └── routers/                 # Modular API controllers
│       ├── auth_api.py          # Authentication & user authorization
│       ├── breakdown_api.py     # Breakdown reconciliation endpoints
│       ├── orders_api.py        # BD Generator endpoints
│       ├── reports_api.py       # Fabrication & picking reports
│       └── schedule_api.py      # Production scheduling endpoints
│
└── frontend/
    ├── public/                  # Static assets & brand icons
    ├── src/
    │   ├── components/          # Reusable UI elements (Navigation, Modals)
    │   ├── pages/               # Functional views (Breakdown, Reports, Settings, Dashboard)
    │   ├── App.jsx              # Application router & route guards
    │   └── main.jsx             # Entry point with Axios global interceptors
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Local Development Setup

### Prerequisites
* Python 3.10+
* Node.js 18+ & npm
* Microsoft ODBC Driver 17 for SQL Server
* IBM DB2 CLI Driver / Client Package

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your local credentials

# Launch FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

---

## 🔐 Environment Variables (.env.example)

This repository strictly decouples code from configuration. Never commit `.env` files. Use the following sample as your `.env.example`:

```env
# Application Server
HOST=0.0.0.0
PORT=8000
DEBUG=True

# PostgreSQL (DWH & Audit Logs)
PG_DB1_HOST=localhost
PG_DB1_PORT=5432
PG_DB1_DATABASE=production_suite_db
PG_DB1_USER=postgres
PG_DB1_PASSWORD=your_local_password

# Microsoft SQL Server (Shiage Production Data)
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=SHIAGE_DB
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=your_local_password
SQLSERVER_DRIVER=ODBC Driver 17 for SQL Server

# IBM DB2 Enterprise System
DB2_DATABASE=PRODDB2
DB2_HOST=localhost
DB2_PORT=50000
DB2_UID=db2admin
DB2_PWD=your_local_password
DB2_DRIVER={IBM DB2 ODBC DRIVER}
```

---

## 👨‍💻 Author & Maintainer

* **Engineer:** F-set
* **LinkedIn:** [linkedin.com/in/username](https://linkedin.com/in/Fajar Setiono)
* **GitHub:** [Fajar Set](https://github.com/fajarudesu)
