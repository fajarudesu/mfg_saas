from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body

from database_pg import get_pg_db               
from database_sqlserver import get_sqlserver_db  


router = APIRouter(
    prefix="/api/manufacturing-mstdtl-bom",
    tags=["Manufacturing Master Detail BOM"]
)


def insert_dtl_bom_raw(conn, order: dict, bom_id: str, payload_rows: Optional[List[dict]] = None):
    cursor = conn.cursor()

    def limit(val, max_len=30):
        s = str(val) if val is not None and val != "" else ""
        return s[:max_len]

    bom_id_safe = limit(bom_id, 20)

    # Unit Code Outer & Inner dari Form
    unit_code_outer_form = limit(order.get('unit_code_outer') or order.get('unitCodeOuter') or '52RR', 30)
    unit_code_inner_form = limit(order.get('unit_code_inner') or order.get('unitCodeInner') or '43TT', 30)

    proj_no = limit(order.get('project_no', 'Madoguchi_Master.Project_No'), 30)
    order_no = limit(order.get('order_no', 'Madoguchi_Master.Order_No'), 30)
    
    # PERMINTAAN: Default Item_No adalah Madoguchi_Detail.Item_No
    item_no_default = limit("Madoguchi_Detail.Item_No", 30)

    rows_to_insert = []

    if payload_rows and len(payload_rows) > 0:
        seq_counter = 1

        for item in payload_rows:
            part_fab_raw = str(item.get("FabricationNo") or item.get("fabrication_no") or item.get("PartNo") or item.get("part_no") or "").strip()

            # Filter Profil (PartNo yang memiliki minimal 2 dash '-')
            if not part_fab_raw or part_fab_raw.count("-") < 2:
                continue

            last_dash_idx = part_fab_raw.rfind("-")
            fabrication_no_val = part_fab_raw[:last_dash_idx]
            fab_no_val = part_fab_raw[last_dash_idx + 1:]

            cls_iom_val = str(item.get("Cls_IOM") or item.get("cls_iom") or "OUTER").upper()
            
            # PERMINTAAN 1: BOM_SUB_ID diambil dari no standardlist inner dan outer
            fallback_sub_id = "MO0005" if "OUTER" in cls_iom_val else "MI0003"
            bom_sub_id = item.get("BOM_SUB_ID") or fallback_sub_id

            if "INNER" in cls_iom_val:
                active_unit_code = unit_code_inner_form
                page_no = "3"
            else:
                active_unit_code = unit_code_outer_form
                page_no = "2"

            description_val = item.get("Description") or item.get("description") or ""
            qty_unit_val = item.get("QtyUnit") or item.get("qty_unit") or item.get("Qty_Unit") or "1"
            qty_formula = "MADELA_ORDER_WINDOW_DETAIL.Qty * QtyUnit"

            row_tuple = (
                bom_id_safe,
                limit(bom_sub_id, 20),                         # BOM_SUB_ID dari Standard List
                limit(str(seq_counter), 20),                   # Sequences (1, 2, 3...)
                limit(page_no, 20),
                limit(proj_no, 30),
                limit(order_no, 30),
                limit(item_no_default, 30),                    # Item_No = "Madoguchi_Detail.Item_No"
                limit("1", 20),
                limit(unit_code_outer_form, 30),               # PERMINTAAN 2: Item_Code HANYA AMBIL OUTER!
                limit(active_unit_code, 30),                   # Unit_Code (Dinamis: Outer=52RR, Inner=43TT)
                limit(cls_iom_val, 20),
                limit(description_val, 50),
                limit(item.get("Color", ""), 30),
                limit(fabrication_no_val, 30),
                limit(fab_no_val, 20),
                limit("M-0", 30),
                limit(qty_unit_val, 20),
                limit(qty_formula, 50),
                limit("", 50),
                limit("M-8", 50),
                limit("M-14", 50),
                limit("", 50),
                limit("Prof_Master.M_WEIGHT_F", 30),
                limit("Length*Qty*weight_M/1000", 50),
            )
            rows_to_insert.append(row_tuple)
            seq_counter += 1

    # Clear old data
    cursor.execute("DELETE FROM MADELA_MANUFACTURINGLIST_MSTDTL_BOM WHERE BOM_ID = ?", (bom_id_safe,))

    insert_sql = """
        INSERT INTO MADELA_MANUFACTURINGLIST_MSTDTL_BOM (
            BOM_ID, BOM_SUB_ID, Sequences, PageNo, Project_No, Order_No, Item_No,
            ItemUnit, Item_Code, Unit_Code, Cls_IOM, Description, Color, FabricationNo,
            FabNo, Length, QtyUnit, Qty, Remark, Remark2, Remark3, Remark4, Weight_M, Weight_kg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    for row in rows_to_insert:
        cursor.execute(insert_sql, row)

    conn.commit()


@router.post("/upload/{order_id}", status_code=status.HTTP_201_CREATED)
def upload_mstdtl_bom(
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

        insert_dtl_bom_raw(sql_conn, order_dict, bom_id, dtl_items)

        return {
            "status": "success",
            "message": f"Berhasil menginsert Master Detail BOM ke SQL Server untuk BOM_ID: {bom_id}"
        }

    except Exception as e:
        if hasattr(sql_conn, 'rollback'):
            sql_conn.rollback()
        import traceback
        print("=== ERROR INSERT MSTDTL_BOM ===")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Gagal meng-upload Master Detail BOM: {str(e)}"
        )


@router.get("/check/{bom_id}")
def check_dtl_bom_exists(bom_id: str, conn=Depends(get_sqlserver_db)):
    try:
        cursor = conn.cursor()
        bom_id_safe = str(bom_id)[:20]
        cursor.execute("SELECT COUNT(*) FROM MADELA_MANUFACTURINGLIST_MSTDTL_BOM WHERE BOM_ID = ?", (bom_id_safe,))
        count = cursor.fetchone()[0]
        return {"exists": count > 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat mengecek database: {str(e)}")