import io
import pandas as pd
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from psycopg2.extras import RealDictCursor
from database_pg import get_pg_db, get_new_pg_db

# KUNCI: Prefix utama diset sekali di sini
router = APIRouter(prefix="/api/reports", tags=["Reports"])


# ==========================================
# 1. REPORT LAIN (Path Cukup Ditulis Singkat)
# ==========================================

@router.get("/dwh-mfg")
def get_data_from_new_db():
    try:
        conn = get_new_pg_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM system_access_logs ORDER BY "timestamp" DESC')
        rows = cursor.fetchall()
        
        data = []
        for row in rows:
            if isinstance(row, dict):
                cleaned_dict = {k: ("" if v is None else v) for k, v in row.items()}
            else:
                cleaned_dict = {k: ("" if v is None else v) for k, v in row}
            data.append(cleaned_dict)

        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/fabrikasi-spesial")
def get_fabrikasi_spesial_report():
    try:
        conn = get_pg_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM fab_special_prosess')
        rows = cursor.fetchall()
        
        data = []
        columns = [desc[0] for desc in cursor.description] if cursor.description else []

        for row in rows:
            if isinstance(row, dict):
                cleaned_dict = {k: ("" if v is None else v) for k, v in row.items()}
            else:
                row_dict = dict(zip(columns, row))
                cleaned_dict = {k: ("" if v is None else v) for k, v in row_dict.items()}
            data.append(cleaned_dict)

        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# SEBELUMNYA: @router.get("/api/reports/delivery") -> DIPERBAIKI MENJADI:
@router.get("/delivery")
def get_delivery_report():
    try:
        conn = get_pg_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM fab_delivery_report')
        rows = cursor.fetchall()
        
        data = []
        columns = [desc[0] for desc in cursor.description] if cursor.description else []

        for row in rows:
            if isinstance(row, dict):
                cleaned_dict = {k: ("" if v is None else v) for k, v in row.items()}
            else:
                row_dict = dict(zip(columns, row))
                cleaned_dict = {k: ("" if v is None else v) for k, v in row_dict.items()}
            data.append(cleaned_dict)

        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# SEBELUMNYA: @router.get("/api/reports/export") -> DIPERBAIKI MENJADI:
@router.get("/export")
def get_report_export():
    try:
        conn = get_pg_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT "Order_Date", "Order_No", "Project_Name", "destinaton_name", 
                   "Project", "Product_Code", "Breakdown_No", "Item_Code", 
                   "Color", "Quantity", "ship_res_qty", "Item_Status", 
                   "weight_kg", "total_weight", "Requested_Delivery_Date", 
                   "cancel", "remain_deli"
            FROM fab_order_in ORDER BY "Order_Date" DESC
        """)
        data = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# SEBELUMNYA: @router.get("/api/reports/progress-perline") -> DIPERBAIKI MENJADI:
@router.get("/progress-perline")
def get_progress_perline(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    project_no: Optional[str] = Query(None),
    item_no: Optional[str] = Query(None),
    limit: int = 100
):
    try:
        conn = get_pg_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query mengambil langsung dari View public.fab_prod_res_perline
        base_query = """
            SELECT 
                "Project_Name",
                "Order_No",
                "LINE",
                "Color",
                "Requirement_Qty_PROF",
                "Actual_QAD",
                "Cutting_Quantity",
                "Material_Order_Date",
                "Related_Mat_Req_Prof",
                "Material_Order_Number",
                "Total_Weight_MF",
                "Total_Weight_Painting",
                "Total_Weight_ST",
                (
                    COALESCE("Total_Weight_MF", 0) + 
                    COALESCE("Total_Weight_Painting", 0) + 
                    COALESCE("Total_Weight_ST", 0)
                ) AS total_weight
            FROM public.fab_prod_res_perline
            WHERE 1=1
        """
        params = []

        # Filter Tanggal (Material_Order_Date)
        if start_date:
            base_query += ' AND "Material_Order_Date" >= %s'
            params.append(start_date)
        if end_date:
            base_query += ' AND "Material_Order_Date" <= %s'
            params.append(end_date)

        # Filter Advance Search (Project No / Item No)
        if project_no:
            base_query += ' AND ("Order_No" ILIKE %s OR "Project_Name" ILIKE %s)'
            p_param = f"%{project_no}%"
            params.extend([p_param, p_param])

        if item_no:
            base_query += ' AND ("LINE" ILIKE %s OR "Related_Mat_Req_Prof" ILIKE %s OR "Material_Order_Number" ILIKE %s)'
            i_param = f"%{item_no}%"
            params.extend([i_param, i_param, i_param])

        base_query += ' ORDER BY "Project_Name" ASC, "Order_No" ASC'

        # Jika limit > 0 (di UI): Batasi 100 row. jika limit <= 0 (saat Export CSV): Ambil SEMUA data
        if limit > 0:
            base_query += ' LIMIT %s'
            params.append(limit)

        cursor.execute(base_query, tuple(params))
        data = cursor.fetchall()

        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==========================================
# 2. BACKLOG PARTS REPORT
# ==========================================

@router.get("/backlog-parts")
def get_backlog_parts(
    search: Optional[str] = Query(None),
    project_no: Optional[str] = Query(None),
    unfulfilled_only: bool = Query(True),
    limit: int = 100,
    offset: int = 0
):
    conn = get_pg_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        base_query = """
            SELECT 
                "No" AS mr_no,
                "Project_No" AS project_no,
                "Description" AS description,
                "Item_Code" AS item_code,
                "Color" AS color,
                "Item_Name" AS item_name,
                "Unit_of_Measure" AS uom,
                "Requirement_Qty" AS requirement_qty,
                "Actual_Movement" AS actual_movement,
                "Qty_Available_to_Take" AS qty_available_to_take,
                "case" AS fs_type,
                "Remark" AS remark,
                "TOTAL_PLANOUT" AS total_planout
            FROM public.fab_backlog_parts
            WHERE 1=1
        """
        params = []
        if unfulfilled_only:
            base_query += ' AND COALESCE("Requirement_Qty", 0) > COALESCE("Actual_Movement", 0)'

        if search:
            base_query += """ AND (
                "No" ILIKE %s OR "Project_No" ILIKE %s OR "Item_Code" ILIKE %s OR 
                "Description" ILIKE %s OR "Item_Name" ILIKE %s
            )"""
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param, search_param, search_param])
            
        if project_no:
            base_query += ' AND "Project_No" = %s'
            params.append(project_no)

        base_query += ' ORDER BY "No" DESC, "Item_Code" ASC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cursor.execute(base_query, tuple(params))
        data = cursor.fetchall()

        count_query = 'SELECT COUNT(*) FROM public.fab_backlog_parts WHERE 1=1'
        count_params = []
        if unfulfilled_only:
            count_query += ' AND COALESCE("Requirement_Qty", 0) > COALESCE("Actual_Movement", 0)'
        if search:
            count_query += """ AND (
                "No" ILIKE %s OR "Project_No" ILIKE %s OR "Item_Code" ILIKE %s OR 
                "Description" ILIKE %s OR "Item_Name" ILIKE %s
            )"""
            count_params.extend([search_param, search_param, search_param, search_param, search_param])
        if project_no:
            count_query += ' AND "Project_No" = %s'
            count_params.append(project_no)

        cursor.execute(count_query, tuple(count_params))
        total_rows_res = cursor.fetchone()
        total_rows = total_rows_res['count'] if isinstance(total_rows_res, dict) else total_rows_res[0]

        return {"status": "success", "total": total_rows, "limit": limit, "offset": offset, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.get("/backlog-parts/export")
def export_backlog_parts(
    search: Optional[str] = Query(None),
    project_no: Optional[str] = Query(None),
    unfulfilled_only: bool = Query(True)
):
    conn = get_pg_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT 
                "No" AS "MR No",
                "Project_No" AS "Project No",
                "Description" AS "Description",
                "Item_Code" AS "Item Code",
                "Item_Name" AS "Item Name",
                "Color" AS "Color",
                "Unit_of_Measure" AS "UoM",
                "Requirement_Qty" AS "Req Qty",
                "Actual_Movement" AS "Actual Move",
                "Qty_Available_to_Take" AS "Avail To Take",
                "case" AS "F/S",
                "Remark" AS "Remark"
            FROM public.fab_backlog_parts
            WHERE 1=1
        """
        params = []
        if unfulfilled_only:
            query += ' AND COALESCE("Requirement_Qty", 0) > COALESCE("Actual_Movement", 0)'
        if search:
            query += """ AND (
                "No" ILIKE %s OR "Project_No" ILIKE %s OR "Item_Code" ILIKE %s OR 
                "Description" ILIKE %s OR "Item_Name" ILIKE %s
            )"""
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param, s_param])
        if project_no:
            query += ' AND "Project_No" = %s'
            params.append(project_no)

        query += ' ORDER BY "No" DESC, "Item_Code" ASC'

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        df = pd.DataFrame(rows)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Backlog_Parts')
        output.seek(0)

        headers = {'Content-Disposition': 'attachment; filename="Backlog_Parts_Report.xlsx"'}
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.get("/assembling-result")
def get_assembling_result(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    project_no: Optional[str] = Query(None),
    item_no: Optional[str] = Query(None),
    limit: int = 100
):
    try:
        conn = get_pg_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query dari View public.fab_assembling_result01
        base_query = """
            SELECT 
                "Lot_No",
                "Project",
                "Project_Name",
                "Order_No",
                "Item_No",
                "Color",
                "Elevation_Code",
                "Unit_Code",
                "Prod_Line_After_BD" AS line,
                "Item_Unit",
                "Group",
                "Quantity",
                "Material_Order_Date",
                "Profile_Req_Dlvry_Date",
                "Loading_Date",
                "Total_Weight_MF",
                "Total_Weight_Painting",
                "Total_Weight_ST",
                (
                    COALESCE("Total_Weight_MF", 0) + 
                    COALESCE("Total_Weight_Painting", 0) + 
                    COALESCE("Total_Weight_ST", 0)
                ) AS total_weight
            FROM public.fab_assembling_result01
            WHERE 1=1
        """
        params = []

        # Filter Rentang Tanggal (Material_Order_Date)
        if start_date:
            base_query += ' AND "Material_Order_Date" >= %s'
            params.append(start_date)
        if end_date:
            base_query += ' AND "Material_Order_Date" <= %s'
            params.append(end_date)

        # Filter Search Project No / Name
        if project_no:
            base_query += ' AND ("Order_No" ILIKE %s OR "Project_Name" ILIKE %s OR "Project" ILIKE %s)'
            p_param = f"%{project_no}%"
            params.extend([p_param, p_param, p_param])

        # Filter Search Item No / Unit Code / Lot
        if item_no:
            base_query += ' AND ("Item_No" ILIKE %s OR "Unit_Code" ILIKE %s OR "Lot_No" ILIKE %s)'
            i_param = f"%{item_no}%"
            params.extend([i_param, i_param, i_param])

        base_query += ' ORDER BY "Material_Order_Date" DESC NULLS LAST, "Order_No" ASC'

        # Jika limit > 0 (dari UI), batasi 100 row. Jika limit <= 0 (export CSV), ambil SEMUA data
        if limit > 0:
            base_query += ' LIMIT %s'
            params.append(limit)

        cursor.execute(base_query, tuple(params))
        data = cursor.fetchall()

        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@router.get("/fab-remain-picking") 
def get_fab_remain_picking():
    # Coba ganti get_new_pg_db() menjadi get_pg_db()
    conn = get_pg_db() 
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                "No", 
                "AO_Series", 
                "Project_No", 
                "Product_Type_Name", 
                "All_Alocation_All_Order", 
                "Description", 
                "Prod_Line_After_BD", 
                "Unit_Code", 
                "Item_Code", 
                "Color", 
                "Variant_Code_2", 
                "Variant_Code", 
                "Location_Code", 
                "Bin_Code", 
                COALESCE("Requirement_Qty", 0) AS "Requirement_Qty", 
                COALESCE("Actual_Transfer", 0) AS "Actual_Transfer"
            FROM fab_remain_picking_profile
            ORDER BY "No" DESC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        data = []
        for row in rows:
            cleaned_dict = {k: ("" if v is None else v) for k, v in row.items()}
            data.append(cleaned_dict)

        cursor.close()
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        # Menampilkan detail error asli di terminal/browser
        print("ERROR FAB REMAIN PICKING:", str(e))
        return {"status": "error", "message": f"Gagal mengambil data remain picking: {str(e)}"}