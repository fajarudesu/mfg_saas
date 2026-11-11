import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body

from database_pg import get_pg_db               
from database_sqlserver import get_sqlserver_db  


router = APIRouter(
    prefix="/api/master-formula",
    tags=["Master Formula"]
)


def convert_excel_formula_to_sql(formula_str: str) -> str:
    """Helper untuk mengonversi rumus Excel/Frontend ke klausa SQL MADELA_ORDER_WINDOW_DETAIL"""
    if not formula_str or str(formula_str).strip() in ["", "-", "0"]:
        return "0"

    s = str(formula_str).strip()

    # Jika nilai murni angka
    if s.isdigit():
        return s

    # Ganti variabel umum ke kolom MADELA_ORDER_WINDOW_DETAIL
    sql_expr = s
    sql_expr = re.sub(r'\bW\b', 'MADELA_ORDER_WINDOW_DETAIL.Width', sql_expr)
    sql_expr = re.sub(r'\bH\b', 'MADELA_ORDER_WINDOW_DETAIL.Height', sql_expr)
    sql_expr = re.sub(r'\bWS\.1\b', '(MADELA_ORDER_WINDOW_DETAIL.Width - 52)', sql_expr)
    sql_expr = re.sub(r'\bHS\.1\b', '(MADELA_ORDER_WINDOW_DETAIL.Height - 50)', sql_expr)
    sql_expr = re.sub(r'\bGTH\b', 'MADELA_ORDER_WINDOW_DETAIL.GlassThickness', sql_expr)

    # Konversi fungsi IF(...) Excel dasar ke CASE WHEN SQL jika mengandung kata IF
    if "IF" in s.upper():
        # Fallback format SQL dinamis jika ada ekspresi IF
        sql_expr = f"CASE WHEN {sql_expr} THEN 1 ELSE 0 END"

    return sql_expr


def insert_master_formula_raw(conn, bom_id: str, payload_materials: List[dict], payload_parts: List[dict], user_by: str = "Fajar"):
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def limit(val, max_len=255):
        if val is None or val == "":
            return ""
        s = str(val).strip()
        return s[:max_len]

    bom_id_safe = limit(bom_id, 50)
    user_by_safe = limit(user_by or "Fajar", 50)

    rows_to_insert = []
    
    # -------------------------------------------------------------
    # 1. TEMPLATE FORMULA HARDCODED DARI SISTEM (M-0, M-1, M-10, dst)
    # -------------------------------------------------------------
    default_master_formulas = [
        ("M-0", "M", "", "", "", now_str, user_by_safe),
        ("M-1", "M", "0", "0", "0", now_str, user_by_safe),
        ("M-10", "M", "CONCATENATE(\"A = \";(H/2))", "CONCATENATE(\"A = \";(H/2))", "CASE WHEN MADELA_ORDER_WINDOW_DETAIL.HandlePosition='600' THEN CONCAT('a = ', 600 + 25) ELSE CONCAT('a =', CAST(MADELA_ORDER_WINDOW_DETAIL.Height/2 as numeric(9, 1))) END", now_str, user_by_safe),
        ("M-11", "M", "CONCATENATE(\"A = \";(HS.1/2))", "CONCATENATE(\"A = \";(HS.1/2))", "CASE WHEN MADELA_ORDER_WINDOW_DETAIL.HandlePosition='600' THEN CONCAT('as = ', 600) ELSE CONCAT('as = ', CAST((MADELA_ORDER_WINDOW_DETAIL.Height-50)/2 as numeric(9, 1))) END", now_str, user_by_safe),
        ("M-12", "M", "WS.1-32", "(OrderWindowDetail.Width - 52) - 32", "(MADELA_ORDER_WINDOW_DETAIL.Width - 52) - 32", now_str, user_by_safe),
        ("M-13", "M", "CONCATENATE(IF(AND(Option2='Stopper',WS<=750), '9K-11113 {E = 69.5}',...))", "(OrderWindowDetail.Width - 52) - 32", "CASE WHEN (MADELA_ORDER_WINDOW_DETAIL.Option2='Stopper' AND MADELA_ORDER_WINDOW_DETAIL.Width - 52 <= 648) THEN '' ELSE '' END", now_str, user_by_safe),
        ("M-14", "M", "CONCATENATE(IF(AND(Option2='Stopper',WS<=448), '9K-11114 {J = 115}',...))", "(OrderWindowDetail.Width - 52) - 32", "CASE WHEN (MADELA_ORDER_WINDOW_DETAIL.Option2='Stopper' AND MADELA_ORDER_WINDOW_DETAIL.Width - 52 <= 448) THEN ('9K-11114 {J = 115}') ELSE ('No ArmStopper') END", now_str, user_by_safe),
        ("M-2", "M", "W-41", "OrderWindowDetail.Width - 41", "MADELA_ORDER_WINDOW_DETAIL.Width - 41", now_str, user_by_safe),
        ("M-3", "M", "H", "OrderWindowDetail.Height", "MADELA_ORDER_WINDOW_DETAIL.Height", now_str, user_by_safe),
        ("M-4", "M", "WS.1", "OrderWindowDetail.Width - 52", "MADELA_ORDER_WINDOW_DETAIL.Width - 52", now_str, user_by_safe),
        ("M-5", "M", "HS.1", "OrderWindowDetail.Height - 50", "MADELA_ORDER_WINDOW_DETAIL.Height - 50", now_str, user_by_safe),
        ("M-6", "M", "WS.1-83", "(OrderWindowDetail.Width -52) - 83", "(MADELA_ORDER_WINDOW_DETAIL.Width -52) - 83", now_str, user_by_safe),
        ("M-7", "M", "HS.1-84", "(OrderWindowDetail.Height - 50) - 84", "(MADELA_ORDER_WINDOW_DETAIL.Height - 50) - 84", now_str, user_by_safe),
        ("M-8", "M", "IF(WS.1<=448,\"4K-14210\",...)", "IF((OrderWindowDetail.Width - 52)<=448,...)", "case when (MADELA_ORDER_WINDOW_DETAIL.Width - 52) <= 448 then '4K-14210' else '' end", now_str, user_by_safe),
        ("M-9", "M", "(HS.1/2)+25", "((OrderWindowDetail.Height - 50)/2)+25", "CASE WHEN MADELA_ORDER_WINDOW_DETAIL.HandlePosition='600' THEN 600+25 ELSE ((MADELA_ORDER_WINDOW_DETAIL.Height - 50)/2)+25 END", now_str, user_by_safe),
        ("P-1", "P", "0", "0", "0", now_str, user_by_safe),
        ("P-2", "P", "WS.1", "OrderWindowDetail.Width - 52", "MADELA_ORDER_WINDOW_DETAIL.Width - 52", now_str, user_by_safe),
        ("P-3", "P", "HS.1", "OrderWindowDetail.Height - 50", "MADELA_ORDER_WINDOW_DETAIL.Height - 50", now_str, user_by_safe),
        ("P-4", "P", "(HS.1/2)+25", "((OrderWindowDetail.Height - 50)/2)+25", "CASE WHEN MADELA_ORDER_WINDOW_DETAIL.HandlePosition='600' THEN 600+25 ELSE ((MADELA_ORDER_WINDOW_DETAIL.Height - 50)/2)+25 END", now_str, user_by_safe)
    ]

    seen_formula_codes = set()

    for code, f_type, formula, f_desc, f_sql, date_ins, ins_by in default_master_formulas:
        rows_to_insert.append((
            bom_id_safe, code, f_type,
            limit(formula, 255), limit(f_desc, 255), limit(f_sql, 255),
            date_ins, ins_by, None, None
        ))
        seen_formula_codes.add(code)

    # -------------------------------------------------------------
    # 2. EKSTRAKSI FORMULA DINAMIS DARI FRONTEND PROFIL (M-) DAN PARTS (P-)
    # -------------------------------------------------------------
    # Proses Profil -> Kode M-
    m_counter = 15
    for mat in (payload_materials or []):
        raw_formula = str(mat.get("Qty") or mat.get("cut_formula") or mat.get("QtyUnit") or "").strip()
        if raw_formula and raw_formula not in ["0", "-", "1"]:
            code = f"M-{m_counter}"
            if code not in seen_formula_codes:
                sql_conv = convert_excel_formula_to_sql(raw_formula)
                rows_to_insert.append((
                    bom_id_safe, code, "M",
                    limit(raw_formula, 255),
                    "",
                    limit(sql_conv, 255),
                    now_str, user_by_safe, None, None
                ))
                seen_formula_codes.add(code)
                m_counter += 1

    # Proses Parts -> Kode P-
    p_counter = 5
    for part in (payload_parts or []):
        raw_formula = str(part.get("QtyUnit") or part.get("cut_formula") or part.get("qty") or "").strip()
        if raw_formula and raw_formula not in ["0", "-", "1"]:
            code = f"P-{p_counter}"
            if code not in seen_formula_codes:
                sql_conv = convert_excel_formula_to_sql(raw_formula)
                rows_to_insert.append((
                    bom_id_safe, code, "P",
                    limit(raw_formula, 255),
                    "",
                    limit(sql_conv, 255),
                    now_str, user_by_safe, None, None
                ))
                seen_formula_codes.add(code)
                p_counter += 1

    # Hapus data lama berdasarkan BOM_ID
    cursor.execute("DELETE FROM MADELA_MASTER_FORMULA WHERE BOM_ID = ?", (bom_id_safe,))

    # Insert batch ke SQL Server
    insert_sql = """
        INSERT INTO MADELA_MASTER_FORMULA (
            BOM_ID, FormulaCode, Type, Formula, FormulaDesc, FormulaSQL,
            FirstInsertDate, FirstInsertBy, UpdateDate, UpdateBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    for row in rows_to_insert:
        cursor.execute(insert_sql, row)

    conn.commit()


@router.post("/upload/{order_id}", status_code=status.HTTP_201_CREATED)
def upload_master_formula(
    order_id: int, 
    item_no: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(None),
    pg_conn = Depends(get_pg_db),          
    sql_conn = Depends(get_sqlserver_db)   
):
    try:
        order_dict = {}

        try:
            cursor = pg_conn.cursor()
            cursor.execute("""
                SELECT id, project_name, project_no, item_no
                FROM "orders"
                WHERE id = %s
            """, (order_id,))
            
            row = cursor.fetchone()
            if row:
                colnames = [desc[0] for desc in cursor.description]
                order_dict = dict(zip(colnames, row))
        except Exception:
            if hasattr(pg_conn, 'rollback'):
                pg_conn.rollback()

        if item_no and item_no.strip():
            bom_id = item_no.strip()
        else:
            db_item_no = order_dict.get('item_no')
            project_name = order_dict.get('project_name')
            bom_id = str(db_item_no if db_item_no else (project_name if project_name else order_id)).strip()

        materials = (payload or {}).get("materials", [])
        parts = (payload or {}).get("parts", [])
        user_by = (payload or {}).get("user_by", "Fajar")

        insert_master_formula_raw(sql_conn, bom_id, materials, parts, user_by)

        return {
            "status": "success",
            "message": f"Berhasil menginsert Master Formula ke SQL Server untuk BOM_ID: {bom_id}"
        }

    except Exception as e:
        if hasattr(sql_conn, 'rollback'):
            sql_conn.rollback()
        import traceback
        print("=== ERROR INSERT MASTER_FORMULA ===")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Gagal meng-upload Master Formula: {str(e)}"
        )


@router.get("/check/{bom_id}")
def check_master_formula_exists(bom_id: str, conn=Depends(get_sqlserver_db)):
    try:
        cursor = conn.cursor()
        bom_id_safe = str(bom_id)[:50]
        cursor.execute("SELECT COUNT(*) FROM MADELA_MASTER_FORMULA WHERE BOM_ID = ?", (bom_id_safe,))
        count = cursor.fetchone()[0]
        return {"exists": count > 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat mengecek database: {str(e)}")