import os
from contextlib import contextmanager
os.environ["DB2CODEPAGE"] = "1208"
import ibm_db_dbi as dbi
from dotenv import load_dotenv

# Muat variabel dari file .env lokal jika ada
load_dotenv()

# Ambil dari .env; jika tidak ada (misal di Git/AI agent), gunakan string dummy
CONN_STRING = os.getenv(
    "DB2_CONN_STRING",
    "DATABASE=TESTDB;HOSTNAME=localhost;PORT=50000;PROTOCOL=TCPIP;UID=dummy_user;PWD=dummy_pass;"
)


def get_db2_connection():
    """Mengembalikan koneksi dbi untuk Pandas / FastAPI."""
    return dbi.connect(CONN_STRING, "", "")


get_db2_conn = get_db2_connection


@contextmanager
def get_db2_cursor():
    """Context manager untuk mengelola koneksi dan cursor secara aman."""
    conn = get_db2_connection()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception as err:
        conn.rollback()
        raise err
    finally:
        cursor.close()
        conn.close()


def test_read_view():
    print("\nMencoba membaca view V_CUTTING_PREPARED...")
    try:
        with get_db2_cursor() as cursor:
            cursor.execute("""
                SELECT PROJECT_NO, LOT_NO, PROFILE_NO, CUT_SIZE, QTY 
                FROM V_CUTTING_PREPARED 
                WHERE LOT_NO = '250910A079'
                FOR READ ONLY WITH UR
            """)
            rows = cursor.fetchall()
            print(f"Berhasil menarik {len(rows)} baris data dari view:")
            for r in rows:
                print(" ->", r)
    except Exception as e:
        print("Gagal membaca view:", e)


if __name__ == "__main__":
    print("Mencoba koneksi ke IBM Db2 (UTF-8 Mode)...")
    try:
        with get_db2_cursor() as cur:
            cur.execute("SELECT 'KONEKSI_OK', 1 FROM SYSIBM.SYSDUMMY1")
            row = cur.fetchone()
            print("========================================")
            print("Status   : KONEKSI BERHASIL!")
            print(f"Response : {row[0]} | Value: {row[1]}")
            print("========================================")
    except Exception as e:
        print("========================================")
        print("Status   : KONEKSI GAGAL!")
        print(f"Detail Error : {e}")
        print("========================================")

    # Uji query data
    test_read_view()