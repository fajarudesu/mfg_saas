from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body

from database_pg import get_pg_db               
from database_sqlserver import get_sqlserver_db  


router = APIRouter(
    prefix="/api/manufacturing-mst-bom",
    tags=["Manufacturing Master BOM"]
)


def get_prod_line_and_bunnou(cursor, unit_code: str):
    if not unit_code or not str(unit_code).strip():
        return None, None
        
    try:
        query = """
            SELECT 
                b.PRODUCTION_LINE_AFTER_BREAKDOWN_CODE, 
                c.BUNNOU_ID
            FROM UNIT_CODE_PRODUCTION_LINE_MASTER b 
            LEFT JOIN PRODUCTION_LINE_AFTER_BREAKDOWN c 
                ON b.PRODUCTION_LINE_AFTER_BREAKDOWN_CODE = c.PRODUCTION_LINE_AFTER_BREAKDOWN_CODE
            WHERE b.UNIT_CODE = ?
        """
        cursor.execute(query, (str(unit_code).strip(),))
        row = cursor.fetchone()
        
        if row:
            prod_line = str(row[0]).strip() if row[0] is not None else None
            bunnou_id = str(row[1]).strip() if row[1] is not None else None
            return prod_line, bunnou_id
            
    except Exception as e:
        print(f"Warning: Query unit_code '{unit_code}' gagal: {str(e)}")
        
    return None, None


def insert_master_bom_raw(conn, order: dict, bom_id: str, payload_info: Optional[dict] = None):
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Helper limit panjang string aman
    def limit(val, max_len=255):
        if val is None or val == "":
            return None
        s = str(val).strip()
        return s[:max_len]

    bom_id_safe = limit(bom_id, 50)

    # 1. AMBIL UNIT CODE DARI FRONTEND (PAYLOAD)
    unit_code_outer_form = limit((payload_info or {}).get('unit_code_outer') or order.get('unit_code_outer') or order.get('unitCodeOuter') or '52CL', 100)
    unit_code_inner_form = limit((payload_info or {}).get('unit_code_inner') or order.get('unit_code_inner') or order.get('unitCodeInner') or '52CL-A/SC', 100)

    # Elevation_Code & Item_Code SELALU AMBIL DARI UNIT CODE OUTER FRONTEND
    elevation_code_val = unit_code_outer_form
    item_code_val = unit_code_outer_form

    # Standard List No dari Frontend jika ada
    outer_sub_id = limit((payload_info or {}).get('outer_list_no') or 'MO0005', 50)
    inner_sub_id = limit((payload_info or {}).get('inner_list_no') or 'MI0003', 50)

    # Lookup Prod Line & Bunnou ID
    prod_line_inner, bunnou_inner = get_prod_line_and_bunnou(cursor, unit_code_inner_form)
    prod_line_outer, bunnou_outer = get_prod_line_and_bunnou(cursor, unit_code_outer_form)

    warnings = []
    if unit_code_inner_form and (prod_line_inner is None or bunnou_inner is None):
        warnings.append(f"Unit Code Inner '{unit_code_inner_form}' tidak ditemukan di UNIT_CODE_PRODUCTION_LINE_MASTER")
    if unit_code_outer_form and (prod_line_outer is None or bunnou_outer is None):
        warnings.append(f"Unit Code Outer '{unit_code_outer_form}' tidak ditemukan di UNIT_CODE_PRODUCTION_LINE_MASTER")

    # NILAI STRING / FORMULA SESUAI SAMPEL DATA DIBERIKAN
    order_no_val = limit("Madoguchi_Master.Order_No", 100)
    project_val = limit("Madoguchi_Master.Project_Name", 150)
    project_no_val = limit("Madoguchi_Master.Project_No", 100)
    item_no_val = limit("Madoguchi_Detail.Item_No", 100)
    
    width_val = limit("Madoguchi_Detail.Width", 100)
    height_val = limit("Madoguchi_Detail.Height", 100)
    qty_val = limit("Madoguchi_Detail.ITEM_NO_QTY", 100)
    delivery_date_val = limit("Madoguchi_Master.Estimated_Delivery_Date", 150)

    # Field yang Disesuaikan Sesuai Permintaan
    w_item_val = limit("MADELA_ORDER_WINDOW_DETAIL.Width", 150)
    h_item_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height", 150)
    color_val = limit("MADELA_ORDER_WINDOW_DETAIL.Color_Code", 100)
    glass_thick_val = limit("MADELA_ORDER_WINDOW_DETAIL.GlassThickness", 150)
    
    h1_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height_1", 100)
    h2_val = limit("MADELA_ORDER_WINDOW_DETAIL.Height_2", 100)

    hs1_val, hs2_val, hs3_val = "M-5", "M-1", "M-1"
    ws1_val, ws2_val, ws3_val = "M-4", "M-1", "M-1"
    c_val = "M-9"
    total_weight_val = limit("SUM(MADELA_ORDER_WINDOW_DETAIL.Weightotal)", 150)

    rows_data = [
        # 1. INNER (MI0003, Sequence 3, PageNo 3)
        (
            bom_id_safe, inner_sub_id, "3", "3", 
            order_no_val, project_val, project_no_val, 
            "MADELA", item_no_val, elevation_code_val, item_code_val, unit_code_inner_form, 
            "INNER", "2", width_val, height_val, qty_val, 
            "Automatic", now_str, "Automatic", None, delivery_date_val, None,
            w_item_val, h_item_val, color_val, glass_thick_val, 
            h1_val, h2_val, None, None, None, None, None, None, None, None,
            None, None, None, None, None, None, None, None, None, None,
            hs1_val, hs2_val, hs3_val, None, None,
            ws1_val, ws2_val, ws3_val, None, None,
            None, c_val, None,
            limit(prod_line_inner, 50), limit(bunnou_inner, 50), total_weight_val, None
        ),
        # 2. ELEVATION (MO0005, Sequence 1, PageNo 1)
        (
            bom_id_safe, outer_sub_id, "1", "1", 
            order_no_val, project_val, project_no_val, 
            "MADELA", item_no_val, elevation_code_val, item_code_val, unit_code_outer_form, 
            "ELEVATION", "0", width_val, height_val, qty_val, 
            "Automatic", now_str, "Automatic", None, delivery_date_val, None,
            w_item_val, h_item_val, color_val, glass_thick_val, 
            h1_val, h2_val, None, None, None, None, None, None, None, None,
            None, None, None, None, None, None, None, None, None, None,
            hs1_val, hs2_val, hs3_val, None, None,
            ws1_val, ws2_val, ws3_val, None, None,
            None, c_val, None,
            None, None, total_weight_val, None
        ),
        # 3. OUTER (MO0005, Sequence 2, PageNo 2)
        (
            bom_id_safe, outer_sub_id, "2", "2", 
            order_no_val, project_val, project_no_val, 
            "MADELA", item_no_val, elevation_code_val, item_code_val, unit_code_outer_form, 
            "OUTER", "1", width_val, height_val, qty_val, 
            "Automatic", now_str, "Automatic", None, delivery_date_val, None,
            w_item_val, h_item_val, color_val, glass_thick_val, 
            h1_val, h2_val, None, None, None, None, None, None, None, None,
            None, None, None, None, None, None, None, None, None, None,
            hs1_val, hs2_val, hs3_val, None, None,
            ws1_val, ws2_val, ws3_val, None, None,
            None, c_val, None,
            limit(prod_line_outer, 50), limit(bunnou_outer, 50), total_weight_val, None
        )
    ]

    cursor.execute("DELETE FROM MADELA_MANUFACTURINGLIST_MST_BOM WHERE BOM_ID = ?", (bom_id_safe,))

    insert_sql = """
        INSERT INTO MADELA_MANUFACTURINGLIST_MST_BOM (
            BOM_ID, BOM_SUB_ID, Sequences, PageNo, Order_No, Project, Project_No, Series, Item_No,
            Elevation_Code, Item_Code, Unit_Code, Cls_IOM, ItemUnit, W, H, Qty,
            Person_In_Charge, Date, Approved, Revision, Delivery_Date, Drawing_No,
            W_item, H_item, Colour, Glass_Thick,
            h1, h2, h3, h4, h5, h6, h7, h8, h9, h10,
            w1, w2, w3, w4, w5, w6, w7, w8, w9, w10,
            HS1, HS2, HS3, HS4, HS5,
            WS1, WS2, WS3, WS4, WS5,
            F, C, A,
            ProductionLineAfterBreakDown, BunnouID, Total_Weight_kg, Status_Prod_Line
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?
        )
    """

    for row in rows_data:
        cursor.execute(insert_sql, row)

    conn.commit()
    return warnings


@router.post("/upload/{order_id}", status_code=status.HTTP_201_CREATED)
def upload_mst_bom(
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
                SELECT id, project_name, project_no, item_no, elevation_code, 
                       unit_code_outer, unit_code_inner, width, height, qty, color, glass_thickness 
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

        warnings = insert_master_bom_raw(sql_conn, order_dict, bom_id, payload)

        return {
            "status": "success",
            "message": f"Berhasil menginsert Master BOM ke SQL Server untuk BOM_ID: {bom_id}",
            "warnings": warnings
        }

    except Exception as e:
        if hasattr(sql_conn, 'rollback'):
            sql_conn.rollback()
        import traceback
        print("=== ERROR INSERT MANUFACTURING_MST_BOM ===")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Gagal meng-upload Master BOM ke SQL Server: {str(e)}"
        )


@router.get("/check/{bom_id}")
def check_bom_exists(bom_id: str, conn=Depends(get_sqlserver_db)):
    try:
        cursor = conn.cursor()
        bom_id_safe = str(bom_id)[:50]
        cursor.execute("SELECT COUNT(*) FROM MADELA_MANUFACTURINGLIST_MST_BOM WHERE BOM_ID = ?", (bom_id_safe,))
        count = cursor.fetchone()[0]
        return {"exists": count > 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat mengecek database: {str(e)}")