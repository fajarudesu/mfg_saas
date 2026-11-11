import os
import pyodbc
from dotenv import load_dotenv

# Muat variabel dari file .env
load_dotenv()

def get_sqlserver_db():
    # Ambil nilai konfigurasi dari environment variable
    server = os.getenv("SQLSERVER_HOST", "localhost")
    port = os.getenv("SQLSERVER_PORT", "1433")
    database = os.getenv("SQLSERVER_DATABASE", "")
    username = os.getenv("SQLSERVER_USER", "")
    password = os.getenv("SQLSERVER_PASSWORD", "")
    driver = os.getenv("SQLSERVER_DRIVER", "{ODBC Driver 17 for SQL Server}")
    
    # Format alamat server jika menggunakan port non-standar atau instans spesifik
    server_address = f"{server},{port}" if port else server

    # Susun connection string tanpa hardcoded credentials
    connection_string = (
        f"DRIVER={driver};"
        f"SERVER={server_address};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
    )
    
    conn = pyodbc.connect(connection_string)
    return conn