from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from psycopg2.extras import execute_batch
import traceback
from database_pg import get_db

router = APIRouter(prefix="/api/parts", tags=["Parts Control"])

# 1. Skema Validasi Pydantic
class OutboundPartItem(BaseModel):
    PRDT_PLNT_CD: str = Field(default="API0P5")
    LST_INPT_DT: Optional[str] = None
    ISS_DTL_NO: Optional[str] = ""
    ISS_DT: Optional[str] = None
    STOR_ISS_OUT_CD: str = "31"
    INPT_PROC_CD: str = "70"
    PAT_CLR_CD: Optional[str] = ""
    ITM_NO: str
    ITM_NO_SPEC: Optional[str] = ""
    RACK_AREA_CD: Optional[str] = "WD"
    RACK_CD: Optional[str] = "02"
    RAC_LOCAT_CD: Optional[str] = "01"
    OT_STC_QTY: int = 1
    ISS_TO_CD: Optional[str] = "L1"
    PRJ_PRFIX: Optional[str] = ""
    PART_SHP_ID: Optional[str] = "0"
    ISS_MEMO: Optional[str] = ""
    INPT_ID: Optional[str] = "220506"
    IVNT_UD_DV: str = "2"
    Z_RGST_DT: Optional[str] = None
    Z_RGSTER_CD: Optional[str] = "220506"
    Z_UD_DT: Optional[str] = None
    Z_UD_PSN_CD: Optional[str] = "220506"

class OutboundBatchRequest(BaseModel):
    items: List[OutboundPartItem]


# 2. Endpoint Batch Insert Outbound
@router.post("/outbound-batch", status_code=status.HTTP_201_CREATED)
def insert_outbound_batch(payload: OutboundBatchRequest):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Data items tidak boleh kosong!")

    now = datetime.now()
    default_date = now.strftime("%Y-%m-%d")
    default_ts = now.strftime("%Y-%m-%d-%H.%M.%S.%f")

    insert_query = """
        INSERT INTO "PAT_ISS_RSLT_WK" (
            "PRDT_PLNT_CD",
            "LST_INPT_DT",
            "ISS_DTL_NO",
            "ISS_DT",
            "STOR_ISS_OUT_CD",
            "INPT_PROC_CD",
            "PAT_CLR_CD",
            "ITM_NO",
            "ITM_NO_SPEC",
            "RACK_AREA_CD",
            "RACK_CD",
            "RAC_LOCAT_CD",
            "OT_STC_QTY",
            "ISS_TO_CD",
            "PRJ_PRFIX",
            "PART_SHP_ID",
            "ISS_MEMO",
            "INPT_ID",
            "IVNT_UD_DV",
            "Z_RGST_DT",
            "Z_RGSTER_CD",
            "Z_UD_DT",
            "Z_UD_PSN_CD"
        ) VALUES (
            %(PRDT_PLNT_CD)s,
            %(LST_INPT_DT)s,
            %(ISS_DTL_NO)s,
            %(ISS_DT)s,
            %(STOR_ISS_OUT_CD)s,
            %(INPT_PROC_CD)s,
            %(PAT_CLR_CD)s,
            %(ITM_NO)s,
            %(ITM_NO_SPEC)s,
            %(RACK_AREA_CD)s,
            %(RACK_CD)s,
            %(RAC_LOCAT_CD)s,
            %(OT_STC_QTY)s,
            %(ISS_TO_CD)s,
            %(PRJ_PRFIX)s,
            %(PART_SHP_ID)s,
            %(ISS_MEMO)s,
            %(INPT_ID)s,
            %(IVNT_UD_DV)s,
            %(Z_RGST_DT)s,
            %(Z_RGSTER_CD)s,
            %(Z_UD_DT)s,
            %(Z_UD_PSN_CD)s
        )
    """

    records = []
    for item in payload.items:
        try:
            qty_val = int(item.OT_STC_QTY)
        except (ValueError, TypeError):
            qty_val = 1

        records.append({
            "PRDT_PLNT_CD": str(item.PRDT_PLNT_CD or "API0P5"),
            "LST_INPT_DT": str(item.LST_INPT_DT or default_date),
            "ISS_DTL_NO": str(item.ISS_DTL_NO or ""),
            "ISS_DT": str(item.ISS_DT or default_date),
            "STOR_ISS_OUT_CD": str(item.STOR_ISS_OUT_CD or "31"),
            "INPT_PROC_CD": str(item.INPT_PROC_CD or "70"),
            "PAT_CLR_CD": str(item.PAT_CLR_CD or ""),
            "ITM_NO": str(item.ITM_NO or ""),
            "ITM_NO_SPEC": str(item.ITM_NO_SPEC or ""),
            "RACK_AREA_CD": str(item.RACK_AREA_CD or "WD"),
            "RACK_CD": str(item.RACK_CD or "02"),
            "RAC_LOCAT_CD": str(item.RAC_LOCAT_CD or "01"),
            "OT_STC_QTY": qty_val,
            "ISS_TO_CD": str(item.ISS_TO_CD or "L1"),
            "PRJ_PRFIX": str(item.PRJ_PRFIX or ""),
            "PART_SHP_ID": str(item.PART_SHP_ID or "0"),
            "ISS_MEMO": str(item.ISS_MEMO or ""),
            "INPT_ID": str(item.INPT_ID or "220506"),
            "IVNT_UD_DV": str(item.IVNT_UD_DV or "2"),
            "Z_RGST_DT": str(item.Z_RGST_DT or default_ts),
            "Z_RGSTER_CD": str(item.Z_RGSTER_CD or "220506"),
            "Z_UD_DT": str(item.Z_UD_DT or default_ts),
            "Z_UD_PSN_CD": str(item.Z_UD_PSN_CD or "220506"),
        })

    conn = get_db()
    cursor = conn.cursor()
    try:
        execute_batch(cursor, insert_query, records, page_size=100)
        conn.commit()
        return {
            "status": "success",
            "inserted_count": len(records),
            "message": f"Berhasil menyimpan {len(records)} baris outbound ke PAT_ISS_RSLT_WK"
        }
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Gagal simpan ke PostgreSQL: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


# 3. Endpoint Riwayat Outbound (Mulai tepat di kolom 0 / tanpa indentasi)
@router.get("/outbound-history")
def get_outbound_history(limit: int = 50):
    conn = get_db()
    cursor = conn.cursor()
    try:
        query = """
            SELECT 
                "ISS_DTL_NO" AS po_no,
                "ITM_NO" AS part_no,
                "PAT_CLR_CD" AS color,
                "OT_STC_QTY" AS qty,
                "ISS_TO_CD" AS destination,
                "RACK_AREA_CD" || "RACK_CD" AS location,
                "RAC_LOCAT_CD" AS bin,
                "ISS_DT" AS issue_date,
                "Z_RGST_DT" AS created_at,
                "INPT_ID" AS operator_nik
            FROM "PAT_ISS_RSLT_WK"
            ORDER BY "Z_RGST_DT" DESC
            LIMIT %s
        """
        cursor.execute(query, (limit,))
        rows = cursor.fetchall()

        history_list = []
        for r in rows:
            history_list.append({
                "po_no": r["po_no"] if isinstance(r, dict) else r[0],
                "part_no": r["part_no"] if isinstance(r, dict) else r[1],
                "color": r["color"] if isinstance(r, dict) else r[2],
                "qty": r["qty"] if isinstance(r, dict) else r[3],
                "destination": r["destination"] if isinstance(r, dict) else r[4],
                "location": r["location"] if isinstance(r, dict) else r[5],
                "bin": r["bin"] if isinstance(r, dict) else r[6],
                "issue_date": r["issue_date"] if isinstance(r, dict) else r[7],
                "created_at": str(r["created_at"]) if isinstance(r, dict) else str(r[8]),
                "operator_nik": r["operator_nik"] if isinstance(r, dict) else r[9],
            })

        return {"status": "success", "data": history_list}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil riwayat outbound: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()