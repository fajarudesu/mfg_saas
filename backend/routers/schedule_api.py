from fastapi import APIRouter, HTTPException, Query
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Optional
from database_pg import get_pg_db, get_new_pg_db

router = APIRouter(
    prefix="/api/schedule",
    tags=["Production Scheduling"]
)

def fetch_db1_data(target_date: str):
    conn = None
    try:
        conn = get_new_pg_db()
        with conn.cursor() as cursor:
            cursor.execute("SELECT center_id, center_name, work_center_group FROM public.m_work_centers;")
            work_centers = cursor.fetchall()

            cursor.execute("SELECT id, center_id, work_date, starting_datetime, ending_datetime FROM public.t_calendar_entries WHERE work_date = %s;", (target_date,))
            calendar_entries = cursor.fetchall()

            return work_centers, calendar_entries
    finally:
        if conn:
            conn.close()

def fetch_db2_data(target_date: str):
    conn = None
    try:
        start_dt_obj = datetime.strptime(target_date, "%Y-%m-%d")
        end_dt_obj = start_dt_obj + timedelta(days=7)
        end_date_str = end_dt_obj.strftime("%Y-%m-%d")

        conn = get_pg_db()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    "No_" AS prod_order_no, 
                    "Status" AS status, 
                    "Description" AS item_description, 
                    "Quantity" AS quantity,
                    "Weight" AS weight_kg,
                    "Starting_Date_Time" AS starting_date_time, 
                    "Ending_Date_Time" AS ending_date_time,
                    COALESCE(
                        "Order_Segment", 
                        "Product_Type_Name", 
                        REPLACE(COALESCE("Routing_No", ''), 'RO-', '')
                    ) AS work_center_group,
                    REPLACE(COALESCE("Routing_No", ''), 'RO-', '') AS clean_routing
                FROM public.dwh_bc_fab_release_production_order_header
                WHERE "Starting_Date_Time" >= %s AND "Starting_Date_Time" <= %s;
            """, (target_date, end_date_str))
            return cursor.fetchall()
    finally:
        if conn:
            conn.close()

def get_val(item, key_or_index, default=None):
    if isinstance(item, dict):
        return item.get(key_or_index, default)
    elif isinstance(item, (list, tuple)):
        try:
            return item[key_or_index]
        except IndexError:
            return default
    return default

@router.get("", summary="Get Production Schedule")
def get_production_schedule(
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None)
):
    target_date = date or start_date or "2026-08-27"
    
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_db1 = executor.submit(fetch_db1_data, target_date)
            future_db2 = executor.submit(fetch_db2_data, target_date)

            work_centers, calendar_entries = future_db1.result()
            production_orders = future_db2.result()

        formatted_routings = []
        task_id = 1

        for wc in work_centers:
            center_id = str(get_val(wc, "center_id", get_val(wc, 0, ""))).strip().upper()
            wc_group = str(get_val(wc, "work_center_group", get_val(wc, 2, "")) or "").strip().upper()
            
            # Tentukan spesifik Operation No berdasarkan nama Center ID
            op_no = 0
            if "CUT" in center_id or "1CUT" in center_id:
                op_no = 10
            elif "PROC" in center_id or "2PROC" in center_id:
                op_no = 20
            elif "ASSY" in center_id or "3ASSY" in center_id:
                op_no = 30
            elif "PACK" in center_id or "4PACK" in center_id:
                op_no = 40

            if op_no == 0:
                continue

            for order in production_orders:
                # Correct index for clean_routing is 8
                clean_routing = str(get_val(order, "clean_routing", get_val(order, 8, "")) or "").strip().upper()
                prod_no = str(get_val(order, "prod_order_no", get_val(order, 0, "")))

                if clean_routing and clean_routing in center_id:
                    # Correct indices: start_dt is 5, end_dt is 6
                    start_dt = get_val(order, "starting_date_time", get_val(order, 5))
                    end_dt = get_val(order, "ending_date_time", get_val(order, 6))

                    if isinstance(start_dt, datetime):
                        hours_delay = (op_no // 10 - 1) * 3
                        op_start = start_dt + timedelta(hours=hours_delay)
                        op_end = op_start + timedelta(hours=2)

                        start_str = op_start.strftime("%Y-%m-%d %H:%M:%S")
                        end_str = op_end.strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        start_str = str(start_dt or "")
                        end_str = str(end_dt or "")

                    due_str = end_dt.strftime("%Y-%m-%d %H:%M:%S") if isinstance(end_dt, datetime) else str(end_dt or "")

                    formatted_routings.append({
                        "id": task_id,
                        "prod_order_no": prod_no,
                        "item_description": get_val(order, "item_description", get_val(order, 2, "")) or "",
                        "center_id": center_id,
                        "operation_no": op_no,
                        "status": get_val(order, "status", get_val(order, 1, "Planned")) or "Planned",
                        "quantity": int(get_val(order, "quantity", get_val(order, 3, 0)) or 0),
                        
                        # Correct index for weight_kg is 4
                        "weight": float(get_val(order, "weight_kg", get_val(order, 4, 0)) or 0), 
                        
                        "start_time": start_str,
                        "end_time": end_str,
                        "due_date": due_str
                    })
                    task_id += 1

        grouped_work_centers = {}
        for wc in work_centers:
            group_name = get_val(wc, "work_center_group", get_val(wc, 2)) or "UNGROUPED"
            c_id = get_val(wc, "center_id", get_val(wc, 0, ""))
            c_name = get_val(wc, "center_name", get_val(wc, 1, ""))

            grouped_work_centers.setdefault(group_name, []).append({
                "center_id": c_id,
                "center_name": c_name
            })

        formatted_groups = [
            {"group_name": group_name, "centers": centers}
            for group_name, centers in grouped_work_centers.items()
        ]

        return {
            "workCenterGroups": formatted_groups,
            "routings": formatted_routings
        }

    except Exception as e:
        print(f"ERROR SCHEDULE LOGIC: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")
    
@router.get("/sales-orders", summary="Get Sales Orders Hierarchy")
def get_sales_orders_hierarchy(
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None) # TAMBAHKAN PENERIMA END_DATE
):
    target_start = date or start_date or "2026-08-27"
    conn = None
    try:
        start_dt_obj = datetime.strptime(target_start, "%Y-%m-%d")
        
        # GUNAKAN END_DATE DARI REACT JIKA ADA, JIKA TIDAK GUNAKAN +7 HARI
        if end_date:
            end_dt_obj = datetime.strptime(end_date, "%Y-%m-%d")
        else:
            end_dt_obj = start_dt_obj + timedelta(days=7)
            
        end_date_str = end_dt_obj.strftime("%Y-%m-%d")

        # 1. Fetch Non-Working Days (Sabtu/Minggu)
        holidays = []
        curr = start_dt_obj
        while curr <= end_dt_obj:
            if curr.weekday() in (5, 6):
                holidays.append(curr.strftime("%Y-%m-%d"))
            curr += timedelta(days=1)

        conn = get_pg_db()
        with conn.cursor() as cursor:
            # PERBAIKAN SQL: Hapus kolom duplikat dan pastikan urutan indeks benar
            cursor.execute("""
                SELECT 
                    COALESCE("Status", 'Released') AS status,            -- Index 0
                    COALESCE("Project_No_", 'AO00061428') AS sales_order_no, -- Index 1
                    COALESCE("Description", "Search_Description") AS item_description, -- Index 2
                    COALESCE("Quantity", 0) AS quantity,                 -- Index 3
                    COALESCE("Weight", 0) AS weight_kg,                  -- Index 4
                    "No_" AS prod_order_no,                              -- Index 5
                    "Starting_Date_Time" AS starting_date_time,          -- Index 6
                    "Ending_Date_Time" AS ending_date_time               -- Index 7
                FROM public.dwh_bc_fab_release_production_order_header
                WHERE "Starting_Date_Time" >= %s AND "Starting_Date_Time" <= %s
                ORDER BY "Status" DESC, sales_order_no, "No_";
            """, (target_start, end_date_str))
            rows = cursor.fetchall()

        # Build Hierarchy Tree
        grouped_data = {}
        for row in rows:
            # PERBAIKAN INDEKS: Sesuaikan dengan urutan SELECT di atas
            status = str(get_val(row, "status", get_val(row, 0, "Released")) or "Released").strip()
            so_no = get_val(row, "sales_order_no", get_val(row, 1, "AO00061428"))
            item_desc = get_val(row, "item_description", get_val(row, 2, "Item"))
            qty = int(get_val(row, "quantity", get_val(row, 3, 0)) or 0)
            weight = float(get_val(row, "weight_kg", get_val(row, 4, 0)) or 0)
            rpo_no = get_val(row, "prod_order_no", get_val(row, 5, ""))
            start_dt = get_val(row, "starting_date_time", get_val(row, 6))
            end_dt = get_val(row, "ending_date_time", get_val(row, 7))

            start_str = start_dt.strftime("%Y-%m-%d %H:%M:%S") if isinstance(start_dt, datetime) else str(start_dt or "")
            end_str = end_dt.strftime("%Y-%m-%d %H:%M:%S") if isinstance(end_dt, datetime) else str(end_dt or "")

            item_key = f"{item_desc} | {qty}"
            rpo_full_name = f"{rpo_no} | 10000 | {qty}"

            if status not in grouped_data: grouped_data[status] = {}
            if so_no not in grouped_data[status]: grouped_data[status][so_no] = {}
            if item_key not in grouped_data[status][so_no]: grouped_data[status][so_no][item_key] = []

            # Pastikan variabel dikirim ke React
            grouped_data[status][so_no][item_key].append({
                "rpoNo": rpo_full_name,
                "displayNo": rpo_no,
                "startTime": start_str,
                "endTime": end_str,
                "qty": qty,
                "weight": weight,
                "itemDescription": item_desc
            })

        formatted_hierarchy = []
        for status_name, so_dict in grouped_data.items():
            orders_list = []
            for so_name, items_dict in so_dict.items():
                items_list = []
                for item_name, rpos_list in items_dict.items():
                    items_list.append({"itemCode": item_name, "rpos": rpos_list})
                orders_list.append({"soNo": so_name, "items": items_list})
            formatted_hierarchy.append({"status": status_name, "orders": orders_list})

        return {
            "holidays": holidays,
            "hierarchy": formatted_hierarchy
        }
    except Exception as e:
        print(f"ERROR SALES LOGIC: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")
    finally:
        if conn: conn.close()