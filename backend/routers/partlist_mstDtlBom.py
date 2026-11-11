from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body

from database_pg import get_pg_db
from database_sqlserver import get_sqlserver_db


router = APIRouter(
    prefix="/api/partlist-mstdtl-bom",
    tags=["Partlist Master Detail BOM"]
)


def insert_partlist_mstdtl_bom_raw(conn, order: dict, bom_id: str, payload_rows: Optional[List[dict]] = None):
    cursor = conn.cursor()

    def limit(val, max_len=255):
        if val is None or val == "":
            return None
        s = str(val).strip()
        return s[:max_len]

    bom_id_safe = limit(bom_id, 50)

    unit_code_outer_form = limit(order.get('unit_code_outer') or '52RR', 100)
    unit_code_inner_form = limit(order.get('unit_code_inner') or '43TT', 100)

    proj_no = limit("Madoguchi_Master.Project_No", 100)
    order_no = limit("Madoguchi_Master.Order_No", 100)
    item_no_val = limit("Madoguchi_Detail.Item_No", 100)

    rows_to_insert = []

    if payload_rows and len(payload_rows) > 0:
        seq_counter = 1
        
        # P-Counter mapping untuk formula Qty
        p_counter = 5
        formula_map = {}

        for item in payload_rows:
            part_no_raw = str(item.get("PartNo") or item.get("part_no") or item.get("FabricationNo") or "").strip()

            # FILTER: Hanya Part/Aksesoris (bukan profil)
            if not part_no_raw or part_no_raw.count("-") >= 2:
                continue

            cls_iom_val = str(item.get("Cls_IOM") or item.get("cls_iom") or "OUTER").upper()

            if "INNER" in cls_iom_val:
                default_sub_id = "PI0003"
                active_unit_code = unit_code_inner_form
                page_no = "5"
                item_unit = "2"
            else:
                default_sub_id = "PO0005"
                active_unit_code = unit_code_outer_form
                page_no = "4"
                item_unit = "1"

            bom_sub_id_val = item.get("BOM_SUB_ID") or item.get("bom_sub_id") or default_sub_id

            # QTY UNIT & P-MAPPING UNTUK FORMULA
            raw_qty = str(item.get("QtyUnit") or item.get("qty") or item.get("cut_formula") or "1").strip()

            is_formula = any(char in raw_qty.upper() for char in ["IF", "W", "H", "=", "*", "<", ">"]) or not raw_qty.isdigit()

            if is_formula:
                if raw_qty in formula_map:
                    qty_unit_val = formula_map[raw_qty]
                else:
                    qty_unit_val = f"P-{p_counter}"
                    formula_map[raw_qty] = qty_unit_val
                    p_counter += 1
            else:
                qty_unit_val = raw_qty

            qty_formula_val = "ROUND(QtyUnit, 0) * MADELA_ORDER_WINDOW_DETAIL.Qty"
            description_val = item.get("Description") or item.get("description") or ""
            color_val = item.get("Colour") or item.get("color") or item.get("Color") or "YW"

            # Ambil Remark & FS (AT SITE) dari Payload
            remark_val = item.get("Remark") or item.get("remark") or item.get("remark1") or ""
            fs_val = item.get("FS") or item.get("fs") or item.get("at_site") or ""

            row_tuple = (
                bom_id_safe,
                limit(bom_sub_id_val, 50),
                limit(str(seq_counter), 50),
                limit(page_no, 50),
                limit(proj_no, 100),
                limit(order_no, 100),
                limit(item_no_val, 100),
                limit(item_unit, 50),
                limit(unit_code_outer_form, 100),            # Item_Code = Outer Code
                limit(active_unit_code, 100),                 # Unit_Code (Inner = 43TT, Outer = 52RR)
                limit(cls_iom_val, 50),
                limit(description_val, 150),
                limit(part_no_raw, 100),                      # PartNo Aksesoris
                limit(color_val, 50),
                limit(qty_unit_val, 50),                      # P-5, P-6... atau angka
                limit(qty_formula_val, 150),
                limit(remark_val, 150),                       # REMARK DARI FRONTEND
                limit(item.get("Remark2", ""), 150),
                limit(item.get("Remark3", ""), 150),
                limit(item.get("Remark4", ""), 150),
                limit(fs_val, 50)                              # FS (AT SITE) DARI FRONTEND
            )
            rows_to_insert.append(row_tuple)
            seq_counter += 1

    cursor.execute("DELETE FROM MADELA_PARTLIST_MSTDTL_BOM WHERE BOM_ID = ?", (bom_id_safe,))

    insert_sql = """
        INSERT INTO MADELA_PARTLIST_MSTDTL_BOM (
            BOM_ID, BOM_SUB_ID, Sequences, PageNo, Project_No, Order_No, Item_No,
            ItemUnit, Item_Code, Unit_Code, Cls_IOM, Description, PartNo, Colour,
            QtyUnit, Qty, Remark, Remark2, Remark3, Remark4, FS
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    """

    for row in rows_to_insert:
        cursor.execute(insert_sql, row)

    conn.commit()


@router.post("/upload/{order_id}", status_code=status.HTTP_201_CREATED)
def upload_partlist_mstdtl_bom(
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

        dtl_items = payload.get("items") if payload else None

        insert_partlist_mstdtl_bom_raw(sql_conn, order_dict, bom_id, dtl_items)

        return {
            "status": "success",
            "message": f"Berhasil menginsert Partlist Master Detail BOM ke SQL Server untuk BOM_ID: {bom_id}"
        }

    except Exception as e:
        if hasattr(sql_conn, 'rollback'):
            sql_conn.rollback()
        import traceback
        print("=== ERROR INSERT PARTLIST_MSTDTL_BOM ===")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Gagal meng-upload Partlist Master Detail BOM: {str(e)}"
        )


@router.get("/check/{bom_id}")
def check_partlist_mstdtl_bom_exists(bom_id: str, conn=Depends(get_sqlserver_db)):
    try:
        cursor = conn.cursor()
        bom_id_safe = str(bom_id)[:50]
        cursor.execute("SELECT COUNT(*) FROM MADELA_PARTLIST_MSTDTL_BOM WHERE BOM_ID = ?", (bom_id_safe,))
        count = cursor.fetchone()[0]
        return {"exists": count > 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat mengecek database: {str(e)}")