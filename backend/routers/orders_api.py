import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Optional
from database_pg import get_db, UPLOAD_DIR, OUTPUT_DIR
from models import OrderUpdate
from parser import parse_standard_list
from generator import generate_manufacturing_list

router = APIRouter()

@router.post("/api/orders")
async def create_order(
    outer_file: Optional[UploadFile] = File(None),
    inner_file: Optional[UploadFile] = File(None),
    project_name: str = Form(""),
    width: int = Form(0),
    height: int = Form(0),
    qty: int = Form(1),
    color: str = Form(""),
    glass_thickness: int = Form(5),
):
    if not outer_file and not inner_file:
        raise HTTPException(400, "At least one standard list file must be uploaded")
    conn = get_db()
    try:
        order_data = {
            'project_name': project_name, 'sheet_name': '', 'width': width, 'height': height,
            'qty': qty, 'color': color, 'glass_thickness': glass_thickness, 'series': '',
            'elevation_code': '', 'item_no': '', 'unit_code_outer': '', 'unit_code_inner': '',
            'std_list_outer': '', 'std_list_inner': '', 'outer_file_path': '', 'inner_file_path': '',
        }
        if outer_file:
            file_id = str(uuid.uuid4())
            outer_path = UPLOAD_DIR / f"{file_id}_{outer_file.filename}"
            with open(outer_path, "wb") as f:
                content = await outer_file.read()
                f.write(content)
            order_data['outer_file_path'] = str(outer_path)
            parsed = parse_standard_list(str(outer_path))
            order_data['std_list_outer'] = parsed.list_no
            if parsed.system: order_data['series'] = parsed.system
        if inner_file:
            file_id = str(uuid.uuid4())
            inner_path = UPLOAD_DIR / f"{file_id}_{inner_file.filename}"
            with open(inner_path, "wb") as f:
                content = await inner_file.read()
                f.write(content)
            order_data['inner_file_path'] = str(inner_path)
            parsed = parse_standard_list(str(inner_path))
            order_data['std_list_inner'] = parsed.list_no
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO orders (
                project_name, series, elevation_code, item_no, unit_code_outer, unit_code_inner,
                width, height, qty, color, glass_thickness, std_list_outer, std_list_inner,
                outer_file_path, inner_file_path, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
            RETURNING id
        """, (
            order_data['project_name'], order_data['series'], order_data['elevation_code'], order_data['item_no'],
            order_data['unit_code_outer'], order_data['unit_code_inner'], order_data['width'], order_data['height'],
            order_data['qty'], order_data['color'], order_data['glass_thickness'], order_data['std_list_outer'], 
            order_data['std_list_inner'], order_data['outer_file_path'], order_data['inner_file_path']
        ))
        
        # Ambil ID yang baru saja di-insert
        new_order_id = cursor.fetchone()['id']
        
        conn.commit()
        cursor.close()
        return {"id": cursor.lastrowid, "message": "Order created successfully"}
    finally:
        conn.close()

@router.get("/api/orders")
def list_orders():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        orders = []
        for row in rows:
            # Karena get_db() menggunakan RealDictCursor, row sudah berupa dictionary
            order = dict(row)
            order['has_output'] = bool(order.get('output_file_path'))
            orders.append(order)
            
        cursor.close()
        return orders
    finally:
        conn.close()

@router.get("/api/orders/{order_id}")
def get_order(order_id: int):
    conn = get_db()
    try:
        # SEBELUM (Error):
        # row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()

        # SESUDAH (Benar):
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        row = cursor.fetchone()
        cursor.close()
        if not row: raise HTTPException(404, "Order not found")
        order = dict(row)
        order['has_output'] = bool(order.get('output_file_path'))
        parsed_data = {}
        if order.get('outer_file_path') and os.path.exists(order['outer_file_path']):
            parsed_data['outer'] = parse_standard_list(order['outer_file_path']).model_dump()
        if order.get('inner_file_path') and os.path.exists(order['inner_file_path']):
            parsed_data['inner'] = parse_standard_list(order['inner_file_path']).model_dump()
        order['parsed_data'] = parsed_data
        return order
    finally:
        conn.close()

@router.put("/api/orders/{order_id}")
def update_order(order_id: int, data: OrderUpdate):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        row = cursor.fetchone()
        cursor.close()
        if not row: raise HTTPException(404, "Order not found")
        updates = {}
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None: updates[field] = value
        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
            values = list(updates.values()) + [order_id]
            cursor = conn.cursor()
            set_clause_pg = set_clause.replace('?', '%s')
            cursor.execute(f"UPDATE orders SET {set_clause_pg}, updated_at = CURRENT_TIMESTAMP WHERE id = %s", values)

            conn.commit()
            cursor.close()
            conn.commit()
        return {"message": "Order updated successfully"}
    finally:
        conn.close()

@router.post("/api/orders/{order_id}/generate")
def generate_output(order_id: int):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        row = cursor.fetchone()
        cursor.close()
        if not row: raise HTTPException(404, "Order not found")
        order = dict(row)
        if order['width'] <= 0 or order['height'] <= 0:
            raise HTTPException(400, "Width and Height must be set before generating")
        output_filename = f"MFG_LIST_{order_id}_{order['project_name'] or 'order'}.xlsx"
        output_path = OUTPUT_DIR / output_filename
        generate_manufacturing_list(output_path=str(output_path), order_data=order)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE orders SET output_file_path = %s, status = 'generated', updated_at = CURRENT_TIMESTAMP WHERE id = %s", 
            (str(output_path), order_id)
        )
        conn.commit()
        cursor.close()
        return {"message": "Manufacturing list generated successfully", "filename": output_filename}
    finally:
        conn.close()

@router.get("/api/orders/{order_id}/download")
def download_output(order_id: int):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        row = cursor.fetchone()
        cursor.close()
        if not row: raise HTTPException(404, "Order not found")
        order = dict(row)
        if not order.get('output_file_path') or not os.path.exists(order['output_file_path']):
            raise HTTPException(404, "Output file not found. Generate it first.")
        return FileResponse(path=order['output_file_path'], filename=os.path.basename(order['output_file_path']), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    finally:
        conn.close()

@router.delete("/api/orders/{order_id}")
def delete_order(order_id: int):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not row: raise HTTPException(404, "Order not found")
        order = dict(row)
        for path_field in ['outer_file_path', 'inner_file_path', 'output_file_path']:
            if order.get(path_field) and os.path.exists(order[path_field]):
                os.remove(order[path_field])
        conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        conn.commit()
        return {"message": "Order deleted successfully"}
    finally:
        conn.close()