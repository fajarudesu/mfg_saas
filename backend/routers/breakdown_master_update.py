from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body

from database_pg import get_pg_db
from database_sqlserver import get_sqlserver_db


router = APIRouter(
    prefix="/api/breakdown-master-update",
    tags=["Breakdown Master Update"]
)


def log_user_action(pg_conn, user_name: str, bom_id: str, action: str, details: str):
    """Mencatat aktivitas edit ke tabel system_access_logs di PostgreSQL"""
    try:
        cursor = pg_conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_access_logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_name VARCHAR(100),
                bom_id VARCHAR(50),
                action VARCHAR(100),
                details TEXT
            )
        """)
        cursor.execute("""
            INSERT INTO system_access_logs (user_name, bom_id, action, details)
            VALUES (%s, %s, %s, %s)
        """, (user_name, bom_id, action, details))
        pg_conn.commit()
    except Exception as e:
        print(f"Failed to write to system_access_logs: {e}")


@router.get("/data/{bom_id}")
def get_all_tables_by_bom_id(bom_id: str, sql_conn=Depends(get_sqlserver_db)):
    """Mengambil seluruh baris data dari 5 tabel berdasarkan BOM_ID"""
    cursor = sql_conn.cursor()
    bom_id_safe = str(bom_id).strip()[:50]

    def fetch_table(query, params):
        cursor.execute(query, params)
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    try:
        data_mfg_mst = fetch_table("SELECT * FROM MADELA_MANUFACTURINGLIST_MST_BOM WHERE BOM_ID = ?", (bom_id_safe,))
        data_mfg_dtl = fetch_table("SELECT * FROM MADELA_MANUFACTURINGLIST_MSTDTL_BOM WHERE BOM_ID = ? ORDER BY CAST(Sequences AS INT)", (bom_id_safe,))
        data_part_mst = fetch_table("SELECT * FROM MADELA_PARTLIST_MST_BOM WHERE BOM_ID = ?", (bom_id_safe,))
        data_part_dtl = fetch_table("SELECT * FROM MADELA_PARTLIST_MSTDTL_BOM WHERE BOM_ID = ? ORDER BY CAST(Sequences AS INT)", (bom_id_safe,))
        data_formula = fetch_table("SELECT * FROM MADELA_MASTER_FORMULA WHERE BOM_ID = ?", (bom_id_safe,))

        return {
            "bom_id": bom_id_safe,
            "mfg_mst": data_mfg_mst,
            "mfg_dtl": data_mfg_dtl,
            "part_mst": data_part_mst,
            "part_dtl": data_part_dtl,
            "formula": data_formula
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data dari SQL Server: {str(e)}")


@router.post("/save/{bom_id}")
def save_modified_tables_by_bom_id(
    bom_id: str,
    payload: Dict[str, Any] = Body(...),
    sql_conn=Depends(get_sqlserver_db),
    pg_conn=Depends(get_pg_db)
):
    """Menyimpan HANYA TABEL YANG DIUBAH dan mencatat log ke system_access_logs"""
    cursor = sql_conn.cursor()
    bom_id_safe = str(bom_id).strip()[:50]
    user_name = payload.get("user_name", "Fajar")
    modified_tables = payload.get("modified_tables", [])

    if not modified_tables:
        return {"status": "no_change", "message": "Tidak ada perubahan data yang perlu disimpan."}

    table_mapping = {
        "mfg_mst": "MADELA_MANUFACTURINGLIST_MST_BOM",
        "mfg_dtl": "MADELA_MANUFACTURINGLIST_MSTDTL_BOM",
        "part_mst": "MADELA_PARTLIST_MST_BOM",
        "part_dtl": "MADELA_PARTLIST_MSTDTL_BOM",
        "formula": "MADELA_MASTER_FORMULA"
    }

    updated_table_names = []

    try:
        for tab_key in modified_tables:
            if tab_key in table_mapping and tab_key in payload:
                db_table_name = table_mapping[tab_key]
                rows = payload[tab_key]

                # Delete data lama di tabel yang berubah
                cursor.execute(f"DELETE FROM {db_table_name} WHERE BOM_ID = ?", (bom_id_safe,))

                # Insert data baru
                for row in rows:
                    cols = ", ".join(row.keys())
                    placeholders = ", ".join(["?"] * len(row))
                    sql = f"INSERT INTO {db_table_name} ({cols}) VALUES ({placeholders})"
                    cursor.execute(sql, list(row.values()))

                updated_table_names.append(db_table_name)

        sql_conn.commit()

        # Catat aktivitas ke PostgreSQL system_access_logs
        updated_info = ", ".join(updated_table_names)
        log_user_action(
            pg_conn, 
            user_name, 
            bom_id_safe, 
            "UPDATE_BREAKDOWN_MASTER", 
            f"User {user_name} memperbarui tabel ({updated_info}) untuk BOM_ID {bom_id_safe}"
        )

        return {
            "status": "success", 
            "message": f"Berhasil memperbarui tabel [{updated_info}] untuk BOM_ID {bom_id_safe}"
        }

    except Exception as e:
        if hasattr(sql_conn, 'rollback'):
            sql_conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan perubahan: {str(e)}")