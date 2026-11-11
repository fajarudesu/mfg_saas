import re
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
import traceback
from psycopg2.extras import execute_batch
import io
import csv
from fastapi.responses import StreamingResponse

from database_db2 import get_db2_conn
from database_pg import get_db

router = APIRouter(prefix="/api/cutting", tags=["Cutting Demax"])

class CuttingInputItem(BaseModel):
    PROJECT_NO: str
    LOT_NO: str
    ITEM_NO: Optional[str] = ""
    COLOR: Optional[str] = ""
    THICK: Optional[str] = ""
    PROFILE_NO: str
    LINE: Optional[str] = "M0"
    CUT_SIZE: float
    PLAN_QTY: int
    INPUT_QTY: int
    REMAIN_QTY: int
    CUTTING_WEIGHT: float
    OPERATOR_NIK: Optional[str] = "220506"
    
    BAR_LENGTH: Optional[Any] = 0.0
    BAR_QTY: Optional[int] = 0
    BAR_WEIGHT: Optional[float] = 0.0
    GOOD_LENGTH: Optional[float] = 0.0
    GOOD_QTY: Optional[int] = 0
    GOOD_WEIGHT: Optional[float] = 0.0
    DEFECT_LENGTH: Optional[float] = 0.0
    DEFECT_QTY: Optional[int] = 0
    DEFECT_WEIGHT: Optional[float] = 0.0
    WASTE_WEIGHT: Optional[float] = 0.0
    CUTTING_TIMES: Optional[int] = 1
    REMARK: Optional[str] = ""
    BAR_UNIT_WGT: Optional[float] = 0.0
    EFFCTV_SIZ: Optional[float] = 0.0

class CuttingBatchRequest(BaseModel):
    items: List[CuttingInputItem]

def get_val(row, key: str, idx: int):
    if isinstance(row, dict):
        return row.get(key, row.get(key.lower(), row.get(key.upper())))
    return row[idx] if idx < len(row) else None

def extract_clean_lot(raw_input: str) -> str:
    raw = (raw_input or "").strip().upper()
    if not raw:
        return ""
    
    # Ambil bagian setelah spasi jika ada
    parts = raw.split()
    if len(parts) > 1:
        raw = parts[-1]
        
    return raw

def fetch_profile_variants(cursor_db2, profile_list):
    if not profile_list:
        return {}, {}
    variants_by_key = {}
    variants_by_prf = {}
    try:
        placeholders = ",".join(["?"] * len(profile_list))
        var_sql = f"""
            SELECT 
                RTRIM(PRF_NO) AS PRF_NO,
                RTRIM(CLR_CD) AS CLR_CD,
                RTRIM(FLM_THICK_CD) AS FLM_THICK_CD,
                EFFCTV_SIZ,
                BAR_UNT_WGT
            FROM BAR_INVN_MST
            WHERE RTRIM(PRF_NO) IN ({placeholders})
            ORDER BY EFFCTV_SIZ DESC
            FOR READ ONLY WITH UR
        """
        cursor_db2.execute(var_sql, tuple(profile_list))
        for vr in cursor_db2.fetchall():
            prf = str(vr[0] or "").strip()
            clr = str(vr[1] or "").strip()
            thk = str(vr[2] or "").strip()
            eff = float(vr[3]) if vr[3] is not None and float(vr[3]) > 0 else 5900.0
            raw_wgt = float(vr[4]) if vr[4] is not None else 0.0
            wgt_kg = round(raw_wgt / 1000.0, 3) if raw_wgt > 50 else round(raw_wgt, 3)

            item_var = {"length": int(eff), "unit_weight": wgt_kg}
            k_full = (prf, clr, thk)
            if k_full not in variants_by_key:
                variants_by_key[k_full] = []
            if not any(x["length"] == int(eff) for x in variants_by_key[k_full]):
                variants_by_key[k_full].append(item_var)

            if prf not in variants_by_prf:
                variants_by_prf[prf] = []
            if not any(x["length"] == int(eff) for x in variants_by_prf[prf]):
                variants_by_prf[prf].append(item_var)
    except Exception as e:
        print(f"[WARN] Gagal query BAR_INVN_MST: {e}")
    return variants_by_key, variants_by_prf

@router.get("/lookup-lot/{lot_no}")
def lookup_lot(lot_no: str):
    clean_lot = extract_clean_lot(lot_no)
    if not clean_lot:
        raise HTTPException(status_code=400, detail="Nomor Lot tidak boleh kosong")

    # Ambil 10 karakter pertama untuk pencarian fleksibel
    base_lot = clean_lot[:10] if len(clean_lot) >= 10 else clean_lot

    # 1. CEK DULU DI POSTGRESQL (Data Aktual / Hasil Scan Sebelumnya)
    pg_conn = get_db()
    pg_cursor = pg_conn.cursor()
    try:
        check_pg_sql = """
            SELECT 
                "PROJECT_NO", "LOT_NO", "ITEM_NO", "COLOR", "THICK",
                "PROFILE_NO", "LINE", "CUT_SIZE", "PLAN_QTY", "INPUT_QTY",
                "REMAIN_QTY", "CUTTING_WEIGHT", "UPDATED_AT",
                "BAR_LENGTH", "BAR_QTY", "BAR_WEIGHT",
                "GOOD_LENGTH", "GOOD_QTY", "GOOD_WEIGHT",
                "DEFECT_LENGTH", "DEFECT_QTY", "DEFECT_WEIGHT",
                "WASTE_WEIGHT", "CUTTING_TIMES", "REMARK",
                "BAR_UNIT_WGT", "EFFCTV_SIZ"
            FROM "CUT_INPUT_ACTUAL"
            WHERE RTRIM(UPPER("LOT_NO")) LIKE UPPER(%s)
            ORDER BY "LINE" ASC, "PROFILE_NO" ASC
        """
        pg_cursor.execute(check_pg_sql, (f"{base_lot}%",))
        pg_rows = pg_cursor.fetchall()

        if pg_rows:
            # Ambil varian profil dari DB2 untuk dropdown varian
            profile_set = list({str(get_val(r, "PROFILE_NO", 5) or "").strip() for r in pg_rows if get_val(r, "PROFILE_NO", 5)})
            variants_by_key, variants_by_prf = {}, {}
            try:
                db2_conn_temp = get_db2_conn()
                db2_cur_temp = db2_conn_temp.cursor()
                variants_by_key, variants_by_prf = fetch_profile_variants(db2_cur_temp, profile_set)
                db2_cur_temp.close()
                db2_conn_temp.close()
            except Exception as ex_db2:
                print(f"[WARN] DB2 lookup error: {ex_db2}")

            results = []
            all_rows_completed = True

            for r in pg_rows:
                p_no = str(get_val(r, "PROFILE_NO", 5) or "").strip()
                c_cd = str(get_val(r, "COLOR", 3) or "").strip()
                t_cd = str(get_val(r, "THICK", 4) or "").strip()
                plan_qty = int(get_val(r, "PLAN_QTY", 8) or 0)
                good_qty = int(get_val(r, "GOOD_QTY", 17) or get_val(r, "INPUT_QTY", 9) or 0)
                bar_qty = int(get_val(r, "BAR_QTY", 14) or 0)
                cut_size = float(get_val(r, "CUT_SIZE", 7) or 0.0)
                b_len = get_val(r, "BAR_LENGTH", 13)
                bar_length_str = str(int(float(b_len))) if b_len and float(b_len) > 0 else ""

                r_qty = plan_qty - good_qty
                is_row_done = (r_qty <= 0) and (bar_qty > 0)
                if not is_row_done:
                    all_rows_completed = False

                opts = variants_by_key.get((p_no, c_cd, t_cd)) or variants_by_prf.get(p_no) or []
                bar_unit_wgt = float(get_val(r, "BAR_UNIT_WGT", 25) or 0.0)

                results.append({
                    "project_no": get_val(r, "PROJECT_NO", 0) or "",
                    "lot_no": get_val(r, "LOT_NO", 1) or clean_lot,
                    "item_no": get_val(r, "ITEM_NO", 2) or "",
                    "color": c_cd,
                    "thick": t_cd,
                    "profile_no": p_no,
                    "line": get_val(r, "LINE", 6) or "M0",
                    "cut_size": cut_size,
                    "plan_qty": plan_qty,
                    "input_qty": good_qty,
                    "good_qty": good_qty,
                    "remain_qty": r_qty,
                    "cutting_weight": float(get_val(r, "CUTTING_WEIGHT", 11) or 0.0),
                    "updated_at": str(get_val(r, "UPDATED_AT", 12) or ""),
                    "bar_length": bar_length_str or (str(opts[0]["length"]) if opts else "5900"),
                    "bar_qty": bar_qty,
                    "bar_weight": float(get_val(r, "BAR_WEIGHT", 15) or 0.0),
                    "good_length": float(get_val(r, "GOOD_LENGTH", 16) or cut_size),
                    "good_weight": float(get_val(r, "GOOD_WEIGHT", 18) or 0.0),
                    "defect_length": float(get_val(r, "DEFECT_LENGTH", 19) or cut_size),
                    "defect_qty": int(get_val(r, "DEFECT_QTY", 20) or 0),
                    "defect_weight": float(get_val(r, "DEFECT_WEIGHT", 21) or 0.0),
                    "waste_weight": float(get_val(r, "WASTE_WEIGHT", 22) or 0.0),
                    "cutting_times": int(get_val(r, "CUTTING_TIMES", 23) or 1),
                    "remark": get_val(r, "REMARK", 24) or "",
                    "bar_unit_wgt": bar_unit_wgt or (opts[0]["unit_weight"] if opts else 0.0),
                    "effctv_siz": float(get_val(r, "EFFCTV_SIZ", 26) or 0.0),
                    "length_variants": opts
                })

            return {
                "status": "success",
                "source": "actual_db",
                "is_completed": all_rows_completed,
                "count": len(results),
                "data": results
            }
    finally:
        pg_cursor.close()
        pg_conn.close()

    # 2. JIKA BELUM ADA DI POSTGRESQL, AMBIL DARI DB2
    db2_sql = """
        SELECT 
            RTRIM(PROJECT_NO) AS PROJECT_NO,
            RTRIM(LOT_NO) AS LOT_NO,
            RTRIM(ITEM_NO) AS ITEM_NO,
            RTRIM(COLOR) AS COLOR,
            RTRIM(THICK) AS THICK,
            RTRIM(PROFILE_NO) AS PROFILE_NO,
            RTRIM(LINE) AS LINE,
            CUT_SIZE,
            QTY,
            CUTTING_WEIGHT
        FROM V_CUTTING_PREPARED
        WHERE RTRIM(UPPER(LOT_NO)) LIKE UPPER(?)
        ORDER BY LINE ASC, PROFILE_NO ASC
        FOR READ ONLY WITH UR
    """

    conn = None
    cursor = None
    try:
        conn = get_db2_conn()
        cursor = conn.cursor()
        cursor.execute(db2_sql, (f"{base_lot}%",))
        rows = cursor.fetchall()

        if not rows:
            return {"status": "not_found", "count": 0, "data": []}

        profile_set = list({str(r[5]).strip() for r in rows if r[5]})
        variants_by_key, variants_by_prf = fetch_profile_variants(cursor, profile_set)

        results = []
        for r in rows:
            p_no = str(r[5] or "").strip()
            c_cd = str(r[3] or "").strip()
            t_cd = str(r[4] or "").strip()
            plan_qty = int(r[8]) if r[8] is not None else 0
            plan_weight = float(r[9]) if r[9] is not None else 0.0
            cut_size = float(r[7]) if r[7] is not None else 0.0

            opts = variants_by_key.get((p_no, c_cd, t_cd)) or variants_by_prf.get(p_no) or []
            default_bar_len = str(opts[0]["length"]) if opts else "5900"
            default_unit_wgt = opts[0]["unit_weight"] if opts else 0.0

            results.append({
                "project_no": str(r[0] or "").strip(),
                "lot_no": clean_lot,  # Gunakan nomor lot penuh dari scan
                "item_no": str(r[2] or "").strip(),
                "color": c_cd,
                "thick": t_cd,
                "profile_no": p_no,
                "line": str(r[6] or "").strip() or "M0",
                "cut_size": cut_size,
                "plan_qty": plan_qty,
                "input_qty": 0,
                "good_qty": 0,
                "remain_qty": plan_qty,
                "cutting_weight": plan_weight,
                "updated_at": "",
                "bar_length": default_bar_len,
                "bar_qty": 0,
                "bar_weight": 0.0,
                "good_length": cut_size,
                "good_weight": 0.0,
                "defect_length": cut_size,
                "defect_qty": 0,
                "defect_weight": 0.0,
                "waste_weight": 0.0,
                "cutting_times": 1,
                "remark": "",
                "length_variants": opts,
                "bar_unit_wgt": default_unit_wgt,
                "effctv_siz": float(default_bar_len)
            })

        return {
            "status": "success",
            "source": "db2",
            "is_completed": False,
            "count": len(results),
            "data": results
        }
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# 2. Endpoint Simpan Batch: UPDATE / INSERT Presisi (Bisa Lanjut Input Remain)
@router.post("/input-batch", status_code=status.HTTP_201_CREATED)
def save_cutting_input_batch(payload: CuttingBatchRequest):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Data item kosong")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    target_lot = payload.items[0].LOT_NO

    conn = get_db()
    cursor = conn.cursor()
    try:
        # Hapus data spesifik untuk Lot dan Profile/Line yang dikirim agar tidak terjadi duplicate key
        for item in payload.items:
            cursor.execute("""
                DELETE FROM "CUT_INPUT_ACTUAL" 
                WHERE UPPER("LOT_NO") = UPPER(%s) 
                  AND UPPER("PROFILE_NO") = UPPER(%s) 
                  AND UPPER("LINE") = UPPER(%s)
                  AND "CUT_SIZE" = %s
            """, (item.LOT_NO, item.PROFILE_NO, item.LINE, item.CUT_SIZE))

        insert_sql = """
            INSERT INTO "CUT_INPUT_ACTUAL" (
                "PROJECT_NO", "LOT_NO", "ITEM_NO", "COLOR", "THICK",
                "PROFILE_NO", "LINE", "CUT_SIZE", "PLAN_QTY", "INPUT_QTY", "REMAIN_QTY", 
                "CUTTING_WEIGHT", "OPERATOR_NIK", "CREATED_AT", "UPDATED_AT",
                "BAR_LENGTH", "BAR_QTY", "BAR_WEIGHT",
                "GOOD_LENGTH", "GOOD_QTY", "GOOD_WEIGHT",
                "DEFECT_LENGTH", "DEFECT_QTY", "DEFECT_WEIGHT",
                "WASTE_WEIGHT", "CUTTING_TIMES", "REMARK",
                "BAR_UNIT_WGT", "EFFCTV_SIZ"
            ) VALUES (
                %(PROJECT_NO)s, %(LOT_NO)s, %(ITEM_NO)s, %(COLOR)s, %(THICK)s,
                %(PROFILE_NO)s, %(LINE)s, %(CUT_SIZE)s, %(PLAN_QTY)s, %(INPUT_QTY)s, %(REMAIN_QTY)s,
                %(CUTTING_WEIGHT)s, %(OPERATOR_NIK)s, %(CREATED_AT)s, %(UPDATED_AT)s,
                %(BAR_LENGTH)s, %(BAR_QTY)s, %(BAR_WEIGHT)s,
                %(GOOD_LENGTH)s, %(GOOD_QTY)s, %(GOOD_WEIGHT)s,
                %(DEFECT_LENGTH)s, %(DEFECT_QTY)s, %(DEFECT_WEIGHT)s,
                %(WASTE_WEIGHT)s, %(CUTTING_TIMES)s, %(REMARK)s,
                %(BAR_UNIT_WGT)s, %(EFFCTV_SIZ)s
            )
        """

        records = [
            {
                "PROJECT_NO": item.PROJECT_NO,
                "LOT_NO": item.LOT_NO,
                "ITEM_NO": item.ITEM_NO or "",
                "COLOR": item.COLOR or "",
                "THICK": item.THICK or "",
                "PROFILE_NO": item.PROFILE_NO,
                "LINE": item.LINE or "M0",
                "CUT_SIZE": item.CUT_SIZE,
                "PLAN_QTY": item.PLAN_QTY,
                "INPUT_QTY": item.GOOD_QTY if item.GOOD_QTY is not None else item.INPUT_QTY,
                "REMAIN_QTY": item.REMAIN_QTY,
                "CUTTING_WEIGHT": item.GOOD_WEIGHT if item.GOOD_WEIGHT else item.CUTTING_WEIGHT,
                "OPERATOR_NIK": item.OPERATOR_NIK or "UNKNOWN",
                "CREATED_AT": now_str,
                "UPDATED_AT": now_str,
                "BAR_LENGTH": float(item.BAR_LENGTH) if item.BAR_LENGTH and str(item.BAR_LENGTH).strip() else 0.0,
                "BAR_QTY": item.BAR_QTY or 0,
                "BAR_WEIGHT": item.BAR_WEIGHT or 0.0,
                "GOOD_LENGTH": item.GOOD_LENGTH or item.CUT_SIZE,
                "GOOD_QTY": item.GOOD_QTY if item.GOOD_QTY is not None else item.INPUT_QTY,
                "GOOD_WEIGHT": item.GOOD_WEIGHT or 0.0,
                "DEFECT_LENGTH": item.DEFECT_LENGTH or item.CUT_SIZE,
                "DEFECT_QTY": item.DEFECT_QTY or 0,
                "DEFECT_WEIGHT": item.DEFECT_WEIGHT or 0.0,
                "WASTE_WEIGHT": item.WASTE_WEIGHT or 0.0,
                "CUTTING_TIMES": item.CUTTING_TIMES or 1,
                "REMARK": item.REMARK or "",
                "BAR_UNIT_WGT": item.BAR_UNIT_WGT or 0.0,
                "EFFCTV_SIZ": item.EFFCTV_SIZ or 0.0
            }
            for item in payload.items
        ]

        execute_batch(cursor, insert_sql, records, page_size=100)
        conn.commit()
        return {"status": "success", "message": f"Berhasil menyimpan {len(records)} baris pemotongan lot {target_lot}."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# 3. Endpoint Riwayat Input
@router.get("/input-history")
def get_cutting_input_history(limit: int = 50, operator_nik: Optional[str] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        where_clause = 'WHERE "OPERATOR_NIK" = %s' if operator_nik else ''
        params = (operator_nik, limit) if operator_nik else (limit,)
        query = f"""
            SELECT 
                "LOT_NO", "PROJECT_NO", "ITEM_NO", "PROFILE_NO", "COLOR", "LINE",
                "CUT_SIZE", "PLAN_QTY", "INPUT_QTY", "REMAIN_QTY", "CUTTING_WEIGHT",
                "UPDATED_AT", "CREATED_AT", "OPERATOR_NIK",
                "BAR_WEIGHT", "GOOD_WEIGHT", "DEFECT_WEIGHT", "WASTE_WEIGHT", "REMARK"
            FROM "CUT_INPUT_ACTUAL"
            {where_clause}
            ORDER BY "UPDATED_AT" DESC, "CREATED_AT" DESC
            LIMIT %s
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        history = []
        for r in rows:
            history.append({
                "lot_no": get_val(r, "LOT_NO", 0),
                "project_no": get_val(r, "PROJECT_NO", 1),
                "item_no": get_val(r, "ITEM_NO", 2),
                "profile_no": get_val(r, "PROFILE_NO", 3),
                "color": get_val(r, "COLOR", 4),
                "line": get_val(r, "LINE", 5) or "M0",
                "cut_size": float(get_val(r, "CUT_SIZE", 6) or 0.0),
                "plan_qty": int(get_val(r, "PLAN_QTY", 7) or 0),
                "input_qty": int(get_val(r, "INPUT_QTY", 8) or 0),
                "remain_qty": int(get_val(r, "REMAIN_QTY", 9) or 0),
                "cutting_weight": float(get_val(r, "CUTTING_WEIGHT", 10) or 0.0),
                "updated_at": str(get_val(r, "UPDATED_AT", 11) or get_val(r, "CREATED_AT", 12) or ""),
                "operator_nik": get_val(r, "OPERATOR_NIK", 13) or "-",
                "bar_weight": float(get_val(r, "BAR_WEIGHT", 14) or 0.0),
                "good_weight": float(get_val(r, "GOOD_WEIGHT", 15) or 0.0),
                "defect_weight": float(get_val(r, "DEFECT_WEIGHT", 16) or 0.0),
                "waste_weight": float(get_val(r, "WASTE_WEIGHT", 17) or 0.0),
                "remark": get_val(r, "REMARK", 18) or ""
            })

        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# 4. Endpoint Ambil Data Cutting Result
@router.get("/results")
def get_cutting_results(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lot_no: Optional[str] = Query(None),
    project_no: Optional[str] = Query(None),
    limit: int = Query(500, le=2000)
):
    conn = get_db()
    cursor = conn.cursor()
    try:
        conditions = []
        params = []

        if date_from:
            conditions.append('"UPDATED_AT" >= %s')
            params.append(f"{date_from.strip()} 00:00:00")
        if date_to:
            conditions.append('"UPDATED_AT" <= %s')
            params.append(f"{date_to.strip()} 23:59:59")
        if lot_no:
            conditions.append('UPPER("LOT_NO") LIKE UPPER(%s)')
            params.append(f"%{lot_no.strip()}%")
        if project_no:
            conditions.append('UPPER("PROJECT_NO") LIKE UPPER(%s)')
            params.append(f"%{project_no.strip()}%")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        query = f"""
            SELECT 
                "LOT_NO", "PROJECT_NO", "ITEM_NO", "PROFILE_NO", "COLOR", "LINE",
                "CUT_SIZE", "PLAN_QTY", "INPUT_QTY", "REMAIN_QTY", "CUTTING_WEIGHT",
                "UPDATED_AT", "CREATED_AT", "OPERATOR_NIK",
                "BAR_LENGTH", "BAR_QTY", "BAR_WEIGHT",
                "GOOD_LENGTH", "GOOD_QTY", "GOOD_WEIGHT",
                "DEFECT_LENGTH", "DEFECT_QTY", "DEFECT_WEIGHT",
                "WASTE_WEIGHT", "CUTTING_TIMES", "REMARK"
            FROM "CUT_INPUT_ACTUAL"
            {where_clause}
            ORDER BY "UPDATED_AT" DESC, "LOT_NO" ASC
            LIMIT %s
        """
        params.append(limit)
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        results = []
        for r in rows:
            plan_qty = int(get_val(r, "PLAN_QTY", 7) or 0)
            good_qty = int(get_val(r, "GOOD_QTY", 18) or get_val(r, "INPUT_QTY", 8) or 0)
            remain_qty = int(get_val(r, "REMAIN_QTY", 9) or 0)
            bar_qty = int(get_val(r, "BAR_QTY", 15) or 0)
            is_complete = (remain_qty <= 0) and (good_qty >= plan_qty) and (bar_qty > 0)
            wgt_per_mm = (bar_unit_wgt / float(bar_length_str)) if (bar_length_str and float(bar_length_str) > 0 and bar_unit_wgt > 0) else 0.0
            calculated_plan_weight = round(plan_qty * cut_size * wgt_per_mm, 3) if wgt_per_mm > 0 else float(get_val(r, "CUTTING_WEIGHT", 11) or 0.0)

            results.append({
                "lot_no": get_val(r, "LOT_NO", 0),
                "project_no": get_val(r, "PROJECT_NO", 1),
                "item_no": get_val(r, "ITEM_NO", 2) or "-",
                "profile_no": get_val(r, "PROFILE_NO", 3),
                "color": get_val(r, "COLOR", 4),
                "line": get_val(r, "LINE", 5) or "M0",
                "cut_size": float(get_val(r, "CUT_SIZE", 6) or 0.0),
                "plan_qty": plan_qty,
                "input_qty": good_qty,
                "good_qty": good_qty,
                "remain_qty": remain_qty,
                "plan_weight": calculated_plan_weight,  # Bobot rencana 46 Pcs murni
                "cutting_weight": calculated_plan_weight,
                "updated_at": str(get_val(r, "UPDATED_AT", 11) or get_val(r, "CREATED_AT", 12) or ""),
                "operator_nik": get_val(r, "OPERATOR_NIK", 13) or "-",
                "bar_length": float(get_val(r, "BAR_LENGTH", 14) or 0.0),
                "bar_qty": bar_qty,
                "bar_weight": float(get_val(r, "BAR_WEIGHT", 16) or 0.0),
                "good_length": float(get_val(r, "GOOD_LENGTH", 17) or get_val(r, "CUT_SIZE", 6) or 0.0),
                "good_weight": float(get_val(r, "GOOD_WEIGHT", 19) or 0.0),
                "defect_length": float(get_val(r, "DEFECT_LENGTH", 20) or 0.0),
                "defect_qty": int(get_val(r, "DEFECT_QTY", 21) or 0),
                "defect_weight": float(get_val(r, "DEFECT_WEIGHT", 22) or 0.0),
                "waste_weight": float(get_val(r, "WASTE_WEIGHT", 23) or 0.0),
                "cutting_times": int(get_val(r, "CUTTING_TIMES", 24) or 1),
                "remark": get_val(r, "REMARK", 25) or "",
                "status": "COMPLETE" if is_complete else "PARTIAL"
            })

        return {"status": "success", "count": len(results), "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# 5. Endpoint Export CSV
@router.get("/export-result")
def export_cutting_result(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lot_no: Optional[str] = Query(None),
    project_no: Optional[str] = Query(None)
):
    conn = get_db()
    cursor = conn.cursor()
    try:
        conditions = []
        params = []

        if date_from:
            conditions.append('"UPDATED_AT" >= %s')
            params.append(f"{date_from.strip()} 00:00:00")
        if date_to:
            conditions.append('"UPDATED_AT" <= %s')
            params.append(f"{date_to.strip()} 23:59:59")
        if lot_no:
            conditions.append('UPPER("LOT_NO") LIKE UPPER(%s)')
            params.append(f"%{lot_no.strip()}%")
        if project_no:
            conditions.append('UPPER("PROJECT_NO") LIKE UPPER(%s)')
            params.append(f"%{project_no.strip()}%")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        query = f"""
            SELECT 
                "LOT_NO", "PROJECT_NO", "ITEM_NO", "PROFILE_NO", "COLOR", "LINE",
                "CUT_SIZE", "PLAN_QTY", "GOOD_QTY", "REMAIN_QTY",
                "BAR_LENGTH", "BAR_QTY", "BAR_WEIGHT",
                "GOOD_WEIGHT", "DEFECT_LENGTH", "DEFECT_QTY", "DEFECT_WEIGHT",
                "WASTE_WEIGHT", "CUTTING_TIMES", "REMARK", "OPERATOR_NIK", "UPDATED_AT"
            FROM "CUT_INPUT_ACTUAL"
            {where_clause}
            ORDER BY "UPDATED_AT" DESC, "LOT_NO" ASC
        """
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        output = io.StringIO()
        output.write("\ufeff")
        writer = csv.writer(output, delimiter=';')

        writer.writerow([
            "NO", "TANGGAL SELESAI", "LOT NO", "PROJECT NO", "ITEM NO", "LINE",
            "PROFILE NO", "COLOR", "PLAN SIZE (MM)", "PLAN QTY", "GOOD QTY", "REMAIN QTY",
            "BAR LENGTH (MM)", "BAR QTY", "BAR WEIGHT (KG)",
            "GOOD WEIGHT (KG)", "DEFECT LENGTH (MM)", "DEFECT QTY", "DEFECT WEIGHT (KG)",
            "WASTE WEIGHT (KG)", "CUTTING TIMES", "OPERATOR NIK", "REMARK", "STATUS"
        ])

        for idx, r in enumerate(rows, start=1):
            plan_qty = int(get_val(r, "PLAN_QTY", 7) or 0)
            good_qty = int(get_val(r, "GOOD_QTY", 8) or 0)
            remain_qty = int(get_val(r, "REMAIN_QTY", 9) or 0)
            bar_qty = int(get_val(r, "BAR_QTY", 11) or 0)
            is_done = (remain_qty <= 0) and (good_qty >= plan_qty) and (bar_qty > 0)

            writer.writerow([
                idx,
                get_val(r, "UPDATED_AT", 21) or "",
                get_val(r, "LOT_NO", 0) or "",
                get_val(r, "PROJECT_NO", 1) or "",
                get_val(r, "ITEM_NO", 2) or "",
                get_val(r, "LINE", 5) or "M0",
                get_val(r, "PROFILE_NO", 3) or "",
                get_val(r, "COLOR", 4) or "",
                get_val(r, "CUT_SIZE", 6) or 0.0,
                plan_qty,
                good_qty,
                remain_qty,
                get_val(r, "BAR_LENGTH", 10) or 0,
                bar_qty,
                get_val(r, "BAR_WEIGHT", 12) or 0.0,
                get_val(r, "GOOD_WEIGHT", 13) or 0.0,
                get_val(r, "DEFECT_LENGTH", 14) or 0.0,
                get_val(r, "DEFECT_QTY", 15) or 0,
                get_val(r, "DEFECT_WEIGHT", 16) or 0.0,
                get_val(r, "WASTE_WEIGHT", 17) or 0.0,
                get_val(r, "CUTTING_TIMES", 18) or 1,
                get_val(r, "OPERATOR_NIK", 20) or "",
                get_val(r, "REMARK", 19) or "",
                "COMPLETE" if is_done else "PARTIAL"
            ])

        output.seek(0)
        filename = f"Cutting_Result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()