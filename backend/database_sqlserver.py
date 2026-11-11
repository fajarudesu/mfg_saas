import os
import pyodbc
from dotenv import load_dotenv

# Muat file .env lokal
load_dotenv()

# Ambil dari .env dengan fallback nilai dummy
SERVER = os.getenv("SQLSERVER_SERVER", "localhost")
DATABASE = os.getenv("SQLSERVER_DATABASE", "dummy_db")
USERNAME = os.getenv("SQLSERVER_USER", "sa")
PASSWORD = os.getenv("SQLSERVER_PASSWORD", "dummy_pass")
DRIVER = os.getenv("SQLSERVER_DRIVER", "ODBC Driver 17 for SQL Server")


def get_sqlserver_db():
    """Mengembalikan koneksi pyodbc ke SQL Server."""
    connection_string = (
        f"DRIVER={{{DRIVER}}};"
        f"SERVER={SERVER};"
        f"DATABASE={DATABASE};"
        f"UID={USERNAME};"
        f"PWD={PASSWORD};"
    )
    
    return pyodbc.connect(connection_string, timeout=5)


if __name__ == "__main__":
    print("Mencoba koneksi ke Microsoft SQL Server...")
    try:
        conn = get_sqlserver_db()
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION, DB_NAME()")
        row = cursor.fetchone()
        
        print("========================================")
        print("Status   : KONEKSI BERHASIL!")
        print(f"Database : {row[1]}")
        print(f"Version  : {row[0][:60]}...")
        print("========================================")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print("========================================")
        print("Status   : KONEKSI GAGAL!")
        print(f"Detail Error : {e}")
        print("========================================")