"""
Manufacturing List Generator - FastAPI Backend
"""
import logging
import time
from logging.handlers import TimedRotatingFileHandler

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from database_pg import save_log_to_db

# Import Routers
from routers.breakdown_api import router as breakdown_router
from routers.auth_api import router as auth_router
from routers.reports_api import router as reports_router
from routers.orders_api import router as orders_router
from routers.schedule_api import router as schedule_router

# 1. INISIALISASI APP FASTAPI
app = FastAPI(title="SAMFG API", version="1.0.0")

# 2. KONFIGURASI LOGGING FILE SYSTEM
log_handler = TimedRotatingFileHandler(
    filename="system_access.log",
    when="midnight",
    interval=1,
    backupCount=30,
    encoding="utf-8"
)
log_handler.suffix = "%Y-%m-%d"

log_formatter = logging.Formatter(
    "%(asctime)s - %(levelname)s - %(message)s", 
    datefmt="%Y-%m-%d %H:%M:%S"
)
log_handler.setFormatter(log_formatter)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.addHandler(log_handler)

# 3. HELPER LOGS
def get_menu_name(path: str):
    if "/auth" in path:
        return "Authentication (Login)"
    elif "/schedule" in path:
        return "Production Schedule"
    elif "/breakdown/shiage" in path:
        return "Breakdown Shiage"
    elif "/breakdown" in path:
        return "Breakdown Testing (BC)"
    elif "/orders" in path:
        return "BD Generator / Order List"
    elif "/reports" in path:
        return "Production Reports"
    elif "/users" in path:
        return "User Management"
    return "Sistem/Lainnya"

def get_activity_type(method: str):
    if method == "GET":
        return "Melihat/Mengambil Data"
    elif method == "POST":
        return "Menambah/Memproses Data Baru"
    elif method in ["PUT", "PATCH"]:
        return "Mengubah/Update Data"
    elif method == "DELETE":
        return "Menghapus Data"
    return "Aktivitas Lainnya"

# 4. MIDDLEWARE AUDIT LOG (TERMASUK KAN NIK DAN USERNAME/NAME)
@app.middleware("http")
async def log_client_ip(request: Request, call_next):
    client_ip = request.headers.get("X-Forwarded-For") or (request.client.host if request.client else "127.0.0.1")
    start_time = time.time()
    
    # Ambil NIK dan Nama dari Header HTTP (Case-Insensitive)
    nik = request.headers.get("x-user-nik") or request.headers.get("X-User-NIK") or "-"
    username = request.headers.get("x-user-name") or request.headers.get("X-User-Name") or "System/Guest"

    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000

    menu = get_menu_name(request.url.path)
    aktivitas = get_activity_type(request.method)

    # Simpan ke tabel system_access_logs
    save_log_to_db(
        client_ip=client_ip,
        menu=menu,
        aktivitas=aktivitas,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        process_time=round(process_time, 2),
        nik=nik,
        username=username
    )

    return response

# 5. MIDDLEWARE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. REGISTRASI SEMUA ROUTER
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(orders_router)
app.include_router(breakdown_router)
app.include_router(schedule_router)

@app.on_event("startup")
def startup():
    init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)