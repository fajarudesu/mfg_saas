from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body

from database_pg import get_pg_db
from database_sqlserver import get_sqlserver_db


router = APIRouter(
    prefix="/api/partlist-mst-bom",
    tags=["Partlist Master BOM"]
)


def insert_partlist_mst_bom_raw(conn, order: dict, bom_id: str, payload_info: Optional[dict] = None):
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Helper membatasi panjang string agar aman di SQL Server tanpa memotong data panjang
    def limit(val, max_len=255):
        if val is None or val == "":
            return None
        s = str(val).strip()
        return s[:max_len]

    bom_id_safe = limit(bom_id, 50)

    # Ambil nilai pendukung dari order / payload frontend
    unit_code_outer_form = limit(order.get('unit_code_outer') or '52RR', 100)
    unit_code_inner_form = limit(order.get('unit_code_inner') or '43TT', 100)

    # Standard List No dari Frontend (jika ada)
    outer_sub_id = limit((payload_info or {}).get('outer_list_no') or 'PO0005', 50)
    inner_sub_id = limit((payload_info or {}).get('inner_list_no') or 'PI0003', 50)

    # Nilai Teks / Formula Hardcoded Default
    order_no_val = limit("Madoguchi_Master.Order_No", 100)
    project_val = limit("Madoguchi_Master.Project_Name", 150)
    project_no_val = limit("Madoguchi_Master.Project_No", 100)
    
    # ATURAN 1: Default Item_No diisi string literal "Madoguchi_Detail.Item_No" (Bukan dari frontend)
    item_no_val = limit("Madoguchi_Detail.Item_No", 100)

    width_val = limit("Madoguchi_Detail.Width", 100)
    height_val = limit("Madoguchi_Detail.Height", 100)
    qty_val = limit("Madoguchi_Detail.ITEM_NO_QTY", 100)
    delivery_date_val = limit("Madoguchi_Master.Estimated_Delivery_Date", 150)

    width_item_val = limit("MADELA_ORDER_WINDOW_DETAIL.Width", 150)
    height_item_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height", 150)
    color_code_val = limit("MADELA_ORDER_WINDOW_DETAIL.Color_Code", 100)
    glass_thick_val = limit("MADELA_ORDER_WINDOW_DETAIL.GlassThickness", 150)

    height_1_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height_1", 100)
    height_2_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height_2", 100)
    height_3_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height_3", 100)

    # 2 Baris (INNER & OUTER) sesuai struktur spesifikasi
    rows_data = [
        # 1. INNER
        (
            bom_id_safe, inner_sub_id, "2", "5",
            order_no_val, project_val, project_no_val, "MADELA", item_no_val,
            unit_code_outer_form, unit_code_outer_form, unit_code_inner_form, "INNER", "2",
            width_val, height_val, qty_val,
            "Automatic", now_str, "Automatic", None, delivery_date_val, None,
            width_item_val, height_item_val, color_code_val, glass_thick_val,
            height_1_val, height_2_val, height_3_val, None, None, None, None, None, None, None,
            None, None, None, None, None, None, None, None, None, None,
            "P-3", "P-1", "P-1", None, None,
            "P-2", "P-1", "P-1", None, None,
            None, "P-4", None
        ),
        # 2. OUTER
        (
            bom_id_safe, outer_sub_id, "1", "4",
            order_no_val, project_val, project_no_val, "MADELA", item_no_val,
            unit_code_outer_form, unit_code_outer_form, unit_code_outer_form, "OUTER", "1",
            width_val, height_val, qty_val,
            "Automatic", now_str, "Automatic", None, delivery_date_val, None,
            width_item_val, height_item_val, color_code_val, glass_thick_val,
            height_1_val, height_2_val, height_3_val, None, None, None, None, None, None, None,
            None, None, None, None, None, None, None, None, None, None,
            "P-3", "P-1", "P-1", None, None,
            "P-2", "P-1", "P-1", None, None,
            None, "P-4", None
        )
    ]

    # Hapus data lama berdasarkan BOM_ID
    cursor.execute("DELETE FROM MADELA_PARTLIST_MST_BOM WHERE BOM_ID = ?", (bom_id_safe,))

    insert_sql = """
        INSERT INTO MADELA_PARTLIST_MST_BOM (
            BOM_ID, BOM_SUB_ID, Sequences, PageNo, Order_No, Project, Project_No, Series, Item_No,
            Elevation_Code, Item_Code, Unit_Code, Cls_IOM, ItemUnit, W, H, Qty,
            Person_In_Charge, Date, Approved, Revision, Delivery_Date, Drawing_No,
            W_item, H_item, Colour, Glass_Thick,
            h1, h2, h3, h4, h5, h6, h7, h8, h9, h10,
            w1, w2, w3, w4, w5, w6, w7, w8, w9, w10,
            HS1, HS2, HS3, HS4, HS5,
            WS1, WS2, WS3, WS4, WS5,
            F, C, A
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?
        )
    """

    for row in rows_data:
        cursor.execute(insert_sql, row)

    conn.commit()


@router.post("/upload/{order_id}", status_code=status.HTTP_201_CREATED)
def upload_partlist_mst_bom(
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
                SELECT id, project_name, project_no, item_no, 
                       unit_code_outer, unit_code_inner 
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

        if payload:
            if payload.get("unit_code_outer"):
                order_dict["unit_code_outer"] = payload.get("unit_code_outer")
            if payload.get("unit_code_inner"):
                order_dict["unit_code_inner"] = payload.get("unit_code_inner")

        if not order_dict:
            order_dict = {
                "id": order_id,
                "project_name": f"Project Sample #{order_id}",
                "item_no": item_no or str(order_id)
            }

        if item_no and item_no.strip():
            bom_id = item_no.strip()
        else:
            db_item_no = order_dict.get('item_no')
            project_name = order_dict.get('project_name')
            bom_id = str(db_item_no if db_item_no else (project_name if project_name else order_id)).strip()

        order_dict['item_no'] = bom_id

        # Insert ke SQL Server
        insert_partlist_mst_bom_raw(sql_conn, order_dict, bom_id, payload)

        return {
            "status": "success",
            "message": f"Berhasil menginsert Partlist Master BOM ke SQL Server untuk BOM_ID: {bom_id}"
        }

    except Exception as e:
        if hasattr(sql_conn, 'rollback'):
            sql_conn.rollback()
        import traceback
        print("=== ERROR INSERT PARTLIST_MST_BOM ===")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Gagal meng-upload Partlist Master BOM: {str(e)}"
        )


@router.get("/check/{bom_id}")
def check_partlist_mst_bom_exists(bom_id: str, conn=Depends(get_sqlserver_db)):
    try:
        cursor = conn.cursor()
        bom_id_safe = str(bom_id)[:50]
        cursor.execute("SELECT COUNT(*) FROM MADELA_PARTLIST_MST_BOM WHERE BOM_ID = ?", (bom_id_safe,))
        count = cursor.fetchone()[0]
        return {"exists": count > 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat mengecek database: {str(e)}")