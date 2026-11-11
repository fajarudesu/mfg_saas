# database_pg.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Muat variabel dari file .env
load_dotenv()

# Konfigurasi DB1 (Work Center & Calendar)
DB1_CONFIG = {
    "dbname": os.getenv("PG_DB1_NAME", "db_workcenter"),
    "user": os.getenv("PG_DB1_USER", "postgres"),
    "password": os.getenv("PG_DB1_PASSWORD", ""),
    "host": os.getenv("PG_DB1_HOST", "localhost"),
    "port": os.getenv("PG_DB1_PORT", "5432")
}

# Konfigurasi DB2 (Production Orders ERP & Logs)
DB2_CONFIG = {
    "dbname": os.getenv("PG_DB2_NAME", "db_production_orders"),
    "user": os.getenv("PG_DB2_USER", "postgres"),
    "password": os.getenv("PG_DB2_PASSWORD", ""),
    "host": os.getenv("PG_DB2_HOST", "localhost"),
    "port": os.getenv("PG_DB2_PORT", "5432")
}


def get_pg_db():
    """Koneksi ke DB1 (Work Center & Calendar)"""
    return psycopg2.connect(**DB1_CONFIG, cursor_factory=RealDictCursor)


def get_new_pg_db():
    """Koneksi ke DB2 (Production Orders ERP)"""
    return psycopg2.connect(**DB2_CONFIG, cursor_factory=RealDictCursor)


def save_log_to_db(
    client_ip: str, 
    menu: str, 
    aktivitas: str, 
    method: str, 
    path: str, 
    status_code: int = 200, 
    process_time: float = 0.0,
    nik: str = "-",
    username: str = "System/Guest"
):
    conn = None
    try:
        conn = get_new_pg_db()
        with conn.cursor() as cursor:
            query = """
                INSERT INTO public.system_access_logs 
                (timestamp, client_ip, menu, aktivitas, method, path, status_code, process_time_ms, nik, username)
                VALUES (NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(
                query, 
                (client_ip, menu, aktivitas, method, path, status_code, process_time, nik, username)
            )
            conn.commit()
    except Exception as e:
        print(f"Gagal menyimpan system access log: {e}")
    finally:
        # Menutup koneksi dengan aman jika berhasil terbuka
        if conn and not conn.closed:
            conn.close()