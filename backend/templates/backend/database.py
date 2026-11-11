import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Muat variabel dari file .env
load_dotenv()

# Path folder penyimpanan upload file tetap dipertahankan
UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"
OUTPUT_DIR = Path(__file__).parent / "data" / "outputs"

# Konfigurasi Postgres dwh_mfg_dev dari environment variables
PG_CONFIG = {
    "host": os.getenv("DWH_PG_HOST", "localhost"),
    "database": os.getenv("DWH_PG_DATABASE", "dbname"),
    "user": os.getenv("DWH_PG_USER", "postgres"),
    "password": os.getenv("DWH_PG_PASSWORD", ""),
    "port": os.getenv("DWH_PG_PORT", "5432"),
}


def get_db():
    """Mengembalikan koneksi PostgreSQL dengan RealDictCursor agar kompatibel"""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    return psycopg2.connect(**PG_CONFIG, cursor_factory=RealDictCursor)


def init_db():
    """Memastikan tabel orders di PostgreSQL sudah siap"""
    conn = None
    try:
        conn = get_db()
        with conn.cursor() as cursor:
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
    except Exception as e:
        print(f"Gagal inisialisasi tabel orders: {e}")
    finally:
        if conn and not conn.closed:
            conn.close()