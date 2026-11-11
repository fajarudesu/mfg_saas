import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Muat variabel environment dari .env
load_dotenv()

# Direktori penyimpanan data / upload file
UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"
OUTPUT_DIR = Path(__file__).parent / "data" / "outputs"

# --- Konfigurasi DB1 (Work Center & Calendar) ---
DB1_CONFIG = {
    "host": os.getenv("PG_DB1_HOST", "localhost"),
    "port": int(os.getenv("PG_DB1_PORT", "5432")),
    "dbname": os.getenv("PG_DB1_NAME", "dummy_db1"),
    "user": os.getenv("PG_DB1_USER", "postgres"),
    "password": os.getenv("PG_DB1_PASS", "dummy_pass"),
}

# --- Konfigurasi DB2 (Production Orders ERP / dwh_mfg_dev) ---
DB2_CONFIG = {
    "host": os.getenv("PG_DB2_HOST", "localhost"),
    "port": int(os.getenv("PG_DB2_PORT", "5432")),
    "dbname": os.getenv("PG_DB2_NAME", "dummy_db2"),
    "user": os.getenv("PG_DB2_USER", "postgres"),
    "password": os.getenv("PG_DB2_PASS", "dummy_pass"),
}


def get_pg_db():
    """Koneksi ke DB1 (Work Center & Calendar)"""
    return psycopg2.connect(**DB1_CONFIG, cursor_factory=RealDictCursor)


def get_new_pg_db():
    """Koneksi ke DB2 (Production Orders ERP / dwh_mfg_dev)"""
    # Pastikan folder output dan upload sudah dibuat jika belum ada
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return psycopg2.connect(**DB2_CONFIG, cursor_factory=RealDictCursor)


# Alias agar kode lama yang memanggil 'get_db()' tetap berjalan tanpa error
get_db = get_new_pg_db


def init_db():
    """Memastikan tabel orders di PostgreSQL sudah siap"""
    conn = None
    try:
        conn = get_new_pg_db()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                project_name VARCHAR(255) DEFAULT '',
                sheet_name VARCHAR(255) DEFAULT '',
                series VARCHAR(255) DEFAULT '',
                elevation_code VARCHAR(255) DEFAULT '',
                item_no VARCHAR(255) DEFAULT '',
                unit_code_outer VARCHAR(255) DEFAULT '',
                unit_code_inner VARCHAR(255) DEFAULT '',
                width INT DEFAULT 0,
                height INT DEFAULT 0,
                qty INT DEFAULT 1,
                color VARCHAR(255) DEFAULT '',
                glass_thickness INT DEFAULT 5,
                std_list_outer TEXT DEFAULT '',
                std_list_inner TEXT DEFAULT '',
                outer_file_path TEXT DEFAULT '',
                inner_file_path TEXT DEFAULT '',
                output_file_path TEXT DEFAULT '',
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"Gagal inisialisasi tabel orders: {e}")
    finally:
        if conn:
            conn.close()


def save_log_to_db(
    client_ip: str,
    menu: str,
    aktivitas: str,
    method: str,
    path: str,
    status_code: int = 200,
    process_time: float = 0.0,
    nik: str = "-",
    username: str = "System/Guest",
):
    conn = None
    try:
        conn = get_new_pg_db()
        cursor = conn.cursor()
        query = """
            INSERT INTO public.system_access_logs 
            (timestamp, client_ip, menu, aktivitas, method, path, status_code, process_time_ms, nik, username)
            VALUES (NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            query,
            (client_ip, menu, aktivitas, method, path, status_code, process_time, nik, username),
        )
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"Gagal menyimpan system access log: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("========================================")
    print("MENGUJI KONEKSI POSTGRESQL...")
    print("========================================")

    # 1. Tes DB1 (Work Center)
    print("\n[1] Mencoba koneksi ke DB1 (Work Center)...")
    try:
        conn1 = get_pg_db()
        cur1 = conn1.cursor()
        cur1.execute("SELECT version();")
        res1 = cur1.fetchone()
        print("  -> Status : BERHASIL TERHUBUNG KE DB1!")
        print(f"  -> Info   : {list(res1.values())[0][:60]}...")
        cur1.close()
        conn1.close()
    except Exception as e:
        print("  -> Status : GAGAL KONEKSI DB1!")
        print(f"  -> Error  : {e}")

    # 2. Tes DB2 (Production Orders / dwh_mfg_dev)
    print("\n[2] Mencoba koneksi ke DB2 (Production Orders)...")
    try:
        conn2 = get_new_pg_db()
        cur2 = conn2.cursor()
        cur2.execute("SELECT current_database(), current_user;")
        res2 = cur2.fetchone()
        print("  -> Status : BERHASIL TERHUBUNG KE DB2!")
        print(f"  -> DB Name: {res2.get('current_database')}")
        print(f"  -> User   : {res2.get('current_user')}")
        cur2.close()
        conn2.close()
    except Exception as e:
        print("  -> Status : GAGAL KONEKSI DB2!")
        print(f"  -> Error  : {e}")
    print("========================================")