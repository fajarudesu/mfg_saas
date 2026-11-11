from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import pandas as pd
import io
from psycopg2.extras import RealDictCursor

# Import helpers dari file utils.py
from utils import clean_qty_roundup, clean_key_string, clean_str, is_equal
# Import database
from database_pg import get_pg_db
from database_sqlserver import get_sqlserver_db 

# Inisialisasi Router (Pengganti 'app' di file terpisah)
router = APIRouter()

class ExportBreakdownSchema(BaseModel):
    project_name: str
    file_name: str
    data: List[Dict[str, Any]]

@router.post("/api/breakdown/export")
def export_breakdown_result(payload: ExportBreakdownSchema):
    mfg_data = []
    part_data = []
    
    for item in payload.data:
        # Filter untuk membuang Group ELEVATION
        if str(item.get("Group", "")).upper() == "ELEVATION":
            continue

        status = "MATCH"
        if item.get("status_compare") == "MISMATCH": status = "MISMATCH"
        if "NOT_IN_DB" in item.get("discrepancies", []): status = "DB NULL"

        db = item.get("db_reference") or {}

        if item.get("Category") == "MFG":
            mfg_data.append({
                "Status": status,
                "Discrepancies": ", ".join(item.get("discrepancies", [])),
                "Order No": item.get("Order_No", ""),       # <--- KOLOM BARU
                "Item No": item.get("Item_No", ""),         # <--- KOLOM BARU
                "Group": item.get("Group", ""),
                "Unit Code": item.get("Unit_Code", ""),
                "Fabrication No": item.get("Fabrication_No", ""),
                "Description": item.get("Description", ""),
                "Process Code (Excel)": item.get("Process_Code", ""),
                "Process Code (DB)": db.get("process_code", ""),
                "Length (Excel)": item.get("Length", ""),
                "Length (DB)": db.get("length", ""),
                "Qty (Excel)": item.get("Qty", ""),
                "Qty (DB)": db.get("qty", ""),
                "Color (Excel)": item.get("Colour", ""),
                "Color (DB)": db.get("color", ""),
                "Remark (Excel)": item.get("Remark", ""),
                "Remark (DB)": db.get("remark", "")
            })
        elif item.get("Category") == "PART":
            part_data.append({
                "Status": status,
                "Discrepancies": ", ".join(item.get("discrepancies", [])),
                "Order No": item.get("Order_No", ""),       # <--- KOLOM BARU
                "Item No": item.get("Item_No", ""),         # <--- KOLOM BARU
                "Group": item.get("Group", ""),
                "Unit Code": item.get("Unit_Code", ""),
                "Part No": item.get("Part_No", ""),
                "Description": item.get("Description", ""),
                "Length": item.get("Length", ""),
                "Qty (Excel)": item.get("Qty", ""),
                "Qty (DB)": db.get("qty", ""),
                "Color (Excel)": item.get("Colour", ""),
                "Color (DB)": db.get("color", db.get("colour", "")),
                "Remark 1 (Excel)": item.get("Remark", ""),
                "Remark 1 (DB)": db.get("remark", ""),
                "Remark 2 (Excel)": item.get("Remark_2", ""),
                "Remark 2 (DB)": db.get("remark_2", ""),
                "F/S (Excel)": item.get("FS", ""),
                "F/S (DB)": db.get("fs", "")
            })

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        sheet_name = 'Comparison_Result'
        start_row = 0
        
        if mfg_data:
            df_mfg = pd.DataFrame(mfg_data)
            pd.DataFrame([["MANUFACTURING LIST COMPARISON"]]).to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False, header=False)
            start_row += 1
            df_mfg.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False)
            start_row += len(df_mfg) + 3 
            
        if part_data:
            df_part = pd.DataFrame(part_data)
            pd.DataFrame([["PARTS LIST COMPARISON"]]).to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False, header=False)
            start_row += 1
            df_part.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False)

    output.seek(0)
    headers = {
        'Content-Disposition': f'attachment; filename="Comparison_{payload.project_name}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


# 2. CUT & PASTE fungsi BREAKDOWN BC ke sini
@router.post("/api/breakdown/upload")
async def upload_breakdown_bc(file: UploadFile = File(...)):

    try:
        contents = await file.read()
        xls = pd.ExcelFile(io.BytesIO(contents))
        sheet_name = str(xls.sheet_names[0])
        
        df_temp = pd.read_excel(xls, header=None)
        
        def get_cell_val(row_idx, col_idx):
            try:
                val = df_temp.iloc[row_idx, col_idx]
                return "" if pd.isna(val) else str(val).strip()
            except IndexError:
                return ""

        global_order_no = get_cell_val(2, 4) 
        if global_order_no.endswith(".0"): global_order_no = global_order_no[:-2]
            
        global_item_no = get_cell_val(4, 4)  
        if global_item_no.endswith(".0"): global_item_no = global_item_no[:-2]

        elevation_code = get_cell_val(7, 4)
        std_list_w = get_cell_val(8, 14)
        std_list_h = get_cell_val(9, 14)

        header_idx = -1
        for i, row in df_temp.iterrows():
            r = row.astype(str).str.lower()
            if r.str.contains('description').any() and (r.str.contains('fabrication').any() or r.str.contains('part.no').any()):
                header_idx = i
                break
        
        if header_idx == -1:
            return {"status": "error", "message": "Format tabel MFG LIST / PART LIST tidak ditemukan."}

        df = pd.read_excel(xls, skiprows=header_idx)
        rows_to_keep = 47 - (header_idx + 1)
        if rows_to_keep > 0:
            df = df.head(rows_to_keep)

        parsed_data = []
        desc_cols = [c for c in df.columns if 'description' in str(c).lower()]
        
        for desc_col in desc_cols:
            col_idx = df.columns.get_loc(desc_col)
            max_cols = len(df.columns)
            end_idx = min(col_idx + 16, max_cols) 
            sub_df = df.iloc[:, col_idx:end_idx].copy()
            
            current_unit_code = get_cell_val(9, col_idx + 3)
            current_group = get_cell_val(20, col_idx).upper()
            
            if not current_group or current_group == "NAN":
                first_row_val = str(sub_df['Description'].iloc[0]).upper()
                if "OUTER" in first_row_val: current_group = "OUTER"
                elif "INNER" in first_row_val: current_group = "INNER"
                else: current_group = "UNKNOWN"
            
            col_mapping = {}
            for i_c, c in enumerate(sub_df.columns):
                cl = str(c).lower()
                if i_c == 5:
                    col_mapping[c] = 'Process_Code'
                elif 'order' in cl and 'no' in cl and 'Order_No' not in col_mapping.values(): col_mapping[c] = 'Order_No'
                elif 'item' in cl and 'no' in cl and 'Item_No' not in col_mapping.values(): col_mapping[c] = 'Item_No'
                elif 'description' in cl and 'Description' not in col_mapping.values(): col_mapping[c] = 'Description'
                elif 'fabrication' in cl and 'Fabrication_No' not in col_mapping.values(): col_mapping[c] = 'Fabrication_No'
                elif 'part' in cl and 'no' in cl and 'Part_No' not in col_mapping.values(): col_mapping[c] = 'Part_No'
                elif 'length' in cl and 'Length' not in col_mapping.values(): col_mapping[c] = 'Length'
                elif ('colour' in cl or 'color' in cl) and 'Colour' not in col_mapping.values(): col_mapping[c] = 'Colour'
                elif 'qty unit' in cl and 'Qty_Unit' not in col_mapping.values(): col_mapping[c] = 'Qty_Unit'
                elif 'qty' in cl and 'qty unit' not in cl and 'Qty' not in col_mapping.values(): col_mapping[c] = 'Qty'
                elif 'remark' in cl and 'Remark' not in col_mapping.values(): 
                    col_mapping[c] = 'Remark'
                    if i_c + 1 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 1]] = 'Remark_2'
                    if i_c + 2 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 2]] = 'Remark_3'
                    if i_c + 3 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 3]] = 'Remark_4'
                    if i_c + 4 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 4]] = 'Remark_5'
                elif 'weight/m' in cl and 'Weight_M' not in col_mapping.values(): col_mapping[c] = 'Weight_M'
                elif 'weight(kg)' in cl and 'Weight_kg' not in col_mapping.values(): col_mapping[c] = 'Weight_kg'
                elif 'f/s' in cl and 'FS' not in col_mapping.values(): col_mapping[c] = 'FS'
            
            sub_df = sub_df.rename(columns=col_mapping)
            if 'Description' not in sub_df.columns: continue
                
            category = "MFG" if 'Fabrication_No' in sub_df.columns else "PART" if 'Part_No' in sub_df.columns else "UNKNOWN"
            if category == "UNKNOWN": continue
            
            ignore_list = ['outer', 'inner', 'elevation', '[outside view]', '[inside view]', 'nan', '']
            
            for _, row in sub_df.iterrows():
                desc_val = str(row.get('Description', '')).strip()
                if desc_val.lower() in ignore_list or desc_val.startswith('='): continue
                    
                def clean_val(val):
                    v = str(val).strip()
                    if v.startswith("'="): v = v[1:]
                    elif v.startswith("'"): v = v.lstrip("'")
                    if v.endswith(".0"): v = v[:-2]
                    if v == "=" or v == "nan": return ""
                    return v

                item = {
                    "Category": category,
                    "Group": current_group,
                    "Unit_Code": current_unit_code,
                    "Order_No": global_order_no, 
                    "Item_No": global_item_no,   
                    "Description": clean_val(row.get('Description')),
                    "Length": clean_val(row.get('Length')),
                    "Qty_Unit": clean_val(row.get('Qty_Unit')),
                    "Qty": clean_val(row.get('Qty')),
                }
                
                if category == "MFG":
                    item["Fabrication_No"] = clean_val(row.get('Fabrication_No'))
                    item["Process_Code"] = clean_val(row.get('Process_Code'))
                    item["Remark"] = clean_val(row.get('Remark'))
                    item["Weight_M"] = clean_val(row.get('Weight_M'))
                    item["Weight_kg"] = clean_val(row.get('Weight_kg'))
                    item["Colour"] = clean_val(row.get('Colour')) 
                elif category == "PART":
                    item["Part_No"] = clean_val(row.get('Part_No'))
                    item["Colour"] = clean_val(row.get('Colour'))
                    item["Remark"] = clean_val(row.get('Remark'))
                    item["Remark_2"] = clean_val(row.get('Remark_2'))
                    item["Remark_3"] = clean_val(row.get('Remark_3'))
                    item["Remark_4"] = clean_val(row.get('Remark_4'))
                    item["Remark_5"] = clean_val(row.get('Remark_5'))
                    item["FS"] = clean_val(row.get('FS'))

                parsed_data.append(item)

        mfg_db = {}
        part_db = {}
        try:
            conn = get_pg_db()  
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            mfg_query = """
                SELECT dbbh."Order_No", dbbh."Item_No", dbbml."Fabrication_No", dbbml."Length",
                       dbbml."Quantity", dbbml."Process_Code", dbbml."Color", dbbml."Remark",
                       dbbml."Weight_m", dbbml."Weight_kg"
                FROM dwh_bc_fab_breakdown_header dbbh
                JOIN dwh_bc_fab_breakdown_manufacturing_line dbbml ON dbbh."No_" = dbbml."Breakdown_No"
                ORDER BY dbbml."Breakdown_No", dbbml."Fabrication_No"
            """
            cursor.execute(mfg_query)
            
            for row in cursor.fetchall():
                key = (clean_key_string(row['Order_No']), clean_key_string(row['Item_No']), clean_key_string(row['Fabrication_No']))
                if key not in mfg_db: mfg_db[key] = []
                mfg_db[key].append({
                    "length": row['Length'], "qty": row['Quantity'], "process_code": row['Process_Code'],
                    "color": row['Color'], "remark": row['Remark'], "weight_m": row['Weight_m'], "weight_kg": row['Weight_kg']
                })

            part_query = """
                SELECT dbfbh."Order_No", dbfbh."Item_No", dbfbpl."Unit_Code", dbfbpl."Group",
                       dbfbpl."Description", dbfbpl."Part_No", dbfbpl."Color", dbfbpl."Quantity",
                       dbfbpl."Remark", dbfbpl."Remark_2", dbfbpl."F_S" 
                FROM dwh_bc_fab_breakdown_header dbfbh 
                JOIN dwh_bc_fab_breakdown_part_line dbfbpl ON dbfbpl."Breakdown_No" = dbfbh."No_"
                ORDER BY dbfbpl."Breakdown_No", dbfbpl."Part_No"
            """
            cursor.execute(part_query)
            for row in cursor.fetchall():
                k = (clean_key_string(row['Order_No']), clean_key_string(row['Item_No']), clean_key_string(row['Part_No']))
                if k not in part_db: part_db[k] = []
                part_db[k].append({
                    "unit_code": row['Unit_Code'], "group": row['Group'], "description": row['Description'],
                    "color": row['Color'], "qty": row['Quantity'], "remark": row['Remark'],
                    "remark_2": row['Remark_2'], "fs": row['F_S']
                })

            cursor.close()
            conn.close()
        except Exception as db_err:
            print("[WARN] Gagal membaca data komparasi PostgreSQL:", db_err)

        validated_data = []
        for item in parsed_data:
            discrepancies = []
            db_match = None
            item['Colour'] = clean_str(item.get('Colour', item.get('Color', '')))
            item['Remark'] = clean_str(item.get('Remark', ''))
            
            current_order = clean_key_string(global_order_no)
            current_item_no = clean_key_string(global_item_no)

            if item.get('Category') == 'MFG':
                fab_no = clean_key_string(item.get('Fabrication_No'))
                search_key = (current_order, current_item_no, fab_no)
                db_matches = mfg_db.get(search_key, [])

                if db_matches:
                    best_match = next((m for m in db_matches if is_equal(m['process_code'], item.get('Process_Code'), True) and is_equal(m['length'], item.get('Length'), True)), None)
                    if not best_match: best_match = next((m for m in db_matches if is_equal(m['process_code'], item.get('Process_Code'), True)), None)
                    if not best_match: best_match = next((m for m in db_matches if is_equal(m['length'], item.get('Length'), True)), None)
                    if not best_match: best_match = db_matches[0]
                    db_match = best_match
                    db_matches.remove(best_match)

                if db_match:
                    db_match['color'] = clean_str(db_match.get('color'))
                    db_match['remark'] = clean_str(db_match.get('remark'))

                    if not is_equal(item.get('Length'), db_match.get('length'), True): discrepancies.append('Length')
                    if not is_equal(item.get('Qty'), db_match.get('qty'), True): discrepancies.append('Qty')
                    if not is_equal(item.get('Process_Code'), db_match.get('process_code'), True): discrepancies.append('Process_Code')
                    if not is_equal(item.get('Colour'), db_match.get('color')): discrepancies.append('Colour')
                    if not is_equal(item.get('Remark'), db_match.get('remark')): discrepancies.append('Remark')
                    if not is_equal(item.get('Weight_M'), db_match.get('weight_m'), True, True): discrepancies.append('Weight_M')
                    if not is_equal(item.get('Weight_kg'), db_match.get('weight_kg'), True, True): discrepancies.append('Weight_kg')
                else:
                    discrepancies.append('NOT_IN_DB')

            elif item.get('Category') == 'PART':
                item['Qty'] = clean_qty_roundup(item.get('Qty'))
                part_no = clean_key_string(item.get('Part_No'))
                search_key = (current_order, current_item_no, part_no)
                db_matches = part_db.get(search_key, [])

                if db_matches:
                    best_match = next((m for m in db_matches if is_equal(clean_qty_roundup(m['qty']), item.get('Qty'), True) and is_equal(m['color'], item.get('Colour'))), None)
                    if not best_match: best_match = db_matches[0]
                    db_match = best_match
                    db_matches.remove(best_match)

                if db_match:
                    db_match['colour'] = clean_str(db_match.get('color')) 
                    db_match['remark'] = clean_str(db_match.get('remark'))
                    db_match['remark_2'] = clean_str(db_match.get('remark_2'))
                    db_match['fs'] = clean_str(db_match.get('fs'))
                    db_match['group'] = clean_str(db_match.get('group'))
                    db_match['unit_code'] = clean_str(db_match.get('unit_code'))
                    db_match['qty'] = clean_qty_roundup(db_match.get('qty'))

                    if not is_equal(item.get('Group'), db_match.get('group')): discrepancies.append('Group')
                    if not is_equal(item.get('Unit_Code'), db_match.get('unit_code')): discrepancies.append('Unit_Code')
                    if not is_equal(item.get('Qty'), db_match.get('qty'), True): discrepancies.append('Qty')
                    if not is_equal(item.get('Colour'), db_match.get('color')): discrepancies.append('Colour')
                    if not is_equal(item.get('Remark'), db_match.get('remark')): discrepancies.append('Remark')
                    if not is_equal(item.get('Remark_2'), db_match.get('remark_2')): discrepancies.append('Remark_2')
                    if not is_equal(item.get('FS'), db_match.get('fs')): discrepancies.append('FS')
                else:
                    discrepancies.append('NOT_IN_DB')

            item['status_compare'] = 'MISMATCH' if len(discrepancies) > 0 else 'MATCH'
            item['discrepancies'] = discrepancies
            item['db_reference'] = db_match
            validated_data.append(item)

        return {
            "status": "success", "filename": file.filename, "sheet_name": sheet_name,
            "elevation_code": elevation_code, "standard_list_w": std_list_w, "standard_list_h": std_list_h,
            "data": validated_data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
pass

# 3. CUT & PASTE fungsi BREAKDOWN SHIAGE ke sini
@router.post("/api/breakdown-shiage/upload")

async def upload_breakdown_shiage(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        xls = pd.ExcelFile(io.BytesIO(contents))
        sheet_name = str(xls.sheet_names[0])
        
        df_temp = pd.read_excel(xls, header=None)
        
        def get_cell_val(row_idx, col_idx):
            try:
                val = df_temp.iloc[row_idx, col_idx]
                return "" if pd.isna(val) else str(val).strip()
            except IndexError:
                return ""

        global_order_no = get_cell_val(2, 4) 
        if global_order_no.endswith(".0"): global_order_no = global_order_no[:-2]
            
        global_item_no = get_cell_val(4, 4)  
        if global_item_no.endswith(".0"): global_item_no = global_item_no[:-2]

        elevation_code = get_cell_val(7, 4)
        std_list_w = get_cell_val(8, 14)
        std_list_h = get_cell_val(9, 14)

        header_idx = -1
        for i, row in df_temp.iterrows():
            r = row.astype(str).str.lower()
            if r.str.contains('description').any() and (r.str.contains('fabrication').any() or r.str.contains('part.no').any()):
                header_idx = i
                break
        
        if header_idx == -1:
            return {"status": "error", "message": "Format tabel MFG LIST / PART LIST tidak ditemukan."}

        df = pd.read_excel(xls, skiprows=header_idx)
        rows_to_keep = 47 - (header_idx + 1)
        if rows_to_keep > 0:
            df = df.head(rows_to_keep)

        parsed_data = []
        desc_cols = [c for c in df.columns if 'description' in str(c).lower()]
        
        for desc_col in desc_cols:
            col_idx = df.columns.get_loc(desc_col)
            max_cols = len(df.columns)
            end_idx = min(col_idx + 16, max_cols) 
            sub_df = df.iloc[:, col_idx:end_idx].copy()
            
            current_unit_code = get_cell_val(9, col_idx + 3)
            current_group = get_cell_val(20, col_idx).upper()
            
            if not current_group or current_group == "NAN":
                first_row_val = str(sub_df['Description'].iloc[0]).upper()
                if "OUTER" in first_row_val: current_group = "OUTER"
                elif "INNER" in first_row_val: current_group = "INNER"
                else: current_group = "UNKNOWN"
            
            col_mapping = {}
            for i_c, c in enumerate(sub_df.columns):
                cl = str(c).lower()
                if i_c == 5: col_mapping[c] = 'Process_Code'
                elif 'order' in cl and 'no' in cl and 'Order_No' not in col_mapping.values(): col_mapping[c] = 'Order_No'
                elif 'item' in cl and 'no' in cl and 'Item_No' not in col_mapping.values(): col_mapping[c] = 'Item_No'
                elif 'description' in cl and 'Description' not in col_mapping.values(): col_mapping[c] = 'Description'
                elif 'fabrication' in cl and 'Fabrication_No' not in col_mapping.values(): col_mapping[c] = 'Fabrication_No'
                elif 'part' in cl and 'no' in cl and 'Part_No' not in col_mapping.values(): col_mapping[c] = 'Part_No'
                elif 'length' in cl and 'Length' not in col_mapping.values(): col_mapping[c] = 'Length'
                elif ('colour' in cl or 'color' in cl) and 'Colour' not in col_mapping.values(): col_mapping[c] = 'Colour'
                elif 'qty unit' in cl and 'Qty_Unit' not in col_mapping.values(): col_mapping[c] = 'Qty_Unit'
                elif 'qty' in cl and 'qty unit' not in cl and 'Qty' not in col_mapping.values(): col_mapping[c] = 'Qty'
                elif 'remark' in cl and 'Remark' not in col_mapping.values(): 
                    col_mapping[c] = 'Remark'
                    if i_c + 1 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 1]] = 'Remark_2'
                    if i_c + 2 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 2]] = 'Remark_3'
                    if i_c + 3 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 3]] = 'Remark_4'
                    if i_c + 4 < len(sub_df.columns): col_mapping[sub_df.columns[i_c + 4]] = 'Remark_5'
                elif 'weight/m' in cl and 'Weight_M' not in col_mapping.values(): col_mapping[c] = 'Weight_M'
                elif 'weight(kg)' in cl and 'Weight_kg' not in col_mapping.values(): col_mapping[c] = 'Weight_kg'
                elif 'f/s' in cl and 'FS' not in col_mapping.values(): col_mapping[c] = 'FS'
            
            sub_df = sub_df.rename(columns=col_mapping)
            if 'Description' not in sub_df.columns: continue
                
            category = "MFG" if 'Fabrication_No' in sub_df.columns else "PART" if 'Part_No' in sub_df.columns else "UNKNOWN"
            if category == "UNKNOWN": continue
            
            ignore_list = ['outer', 'inner', 'elevation', '[outside view]', '[inside view]', 'nan', '']
            
            for _, row in sub_df.iterrows():
                desc_val = str(row.get('Description', '')).strip()
                if desc_val.lower() in ignore_list or desc_val.startswith('='): continue
                    
                def clean_val(val):
                    v = str(val).strip()
                    if v.startswith("'="): v = v[1:]
                    elif v.startswith("'"): v = v.lstrip("'")
                    if v.endswith(".0"): v = v[:-2]
                    if v == "=" or v == "nan": return ""
                    return v

                item = {
                    "Category": category,
                    "Group": current_group,
                    "Unit_Code": current_unit_code,
                    "Order_No": global_order_no, 
                    "Item_No": global_item_no,   
                    "Description": clean_val(row.get('Description')),
                    "Length": clean_val(row.get('Length')),
                    "Qty_Unit": clean_val(row.get('Qty_Unit')),
                    "Qty": clean_val(row.get('Qty')),
                }
                
                if category == "MFG":
                    item["Fabrication_No"] = clean_val(row.get('Fabrication_No'))
                    item["Process_Code"] = clean_val(row.get('Process_Code'))
                    item["Remark"] = clean_val(row.get('Remark'))
                    item["Weight_M"] = clean_val(row.get('Weight_M'))
                    item["Weight_kg"] = clean_val(row.get('Weight_kg'))
                    item["Colour"] = clean_val(row.get('Colour')) 
                elif category == "PART":
                    item["Part_No"] = clean_val(row.get('Part_No'))
                    item["Colour"] = clean_val(row.get('Colour'))
                    item["Remark"] = clean_val(row.get('Remark'))
                    item["Remark_2"] = clean_val(row.get('Remark_2'))
                    item["Remark_3"] = clean_val(row.get('Remark_3'))
                    item["Remark_4"] = clean_val(row.get('Remark_4'))
                    item["Remark_5"] = clean_val(row.get('Remark_5'))
                    item["FS"] = clean_val(row.get('FS'))

                parsed_data.append(item)

        mfg_db = {}
        part_db = {}
        
        try:
            conn = get_sqlserver_db()  
            cursor = conn.cursor()

            mfg_query = """
                SELECT Order_No, Item_No, Unit_Code, Cls_IOM, description, 
                       FabricationNo, FabNo, Length, Color, Qty, 
                       Remark, Remark2, Weight_M, Weight_kg  
                FROM MANUFACTURINGLIST_MSTDTL 
                WHERE Order_No = ? AND Item_No = ?
            """
            cursor.execute(mfg_query, (global_order_no, global_item_no))
            columns_mfg = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                row_dict = dict(zip(columns_mfg, row))
                key = (clean_key_string(row_dict['Order_No']), clean_key_string(row_dict['Item_No']), clean_key_string(row_dict['FabricationNo']))
                if key not in mfg_db: mfg_db[key] = []
                mfg_db[key].append({
                    "group": row_dict['Cls_IOM'], "length": row_dict['Length'], "qty": row_dict['Qty'],
                    "process_code": row_dict['FabNo'], "color": row_dict['Color'], "remark": row_dict['Remark'],
                    "weight_m": row_dict['Weight_M'], "weight_kg": row_dict['Weight_kg']
                })

            part_query = """
                SELECT Order_No, Item_No, Unit_Code, Cls_IOM, Description, 
                       PartNo, Colour, Qty, Remark, Remark2, Remark3, FS 
                FROM PARTLIST_MSTDTL 
                WHERE Order_No = ? AND Item_No = ?
            """
            cursor.execute(part_query, (global_order_no, global_item_no))
            columns_part = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                row_dict = dict(zip(columns_part, row))
                k = (clean_key_string(row_dict['Order_No']), clean_key_string(row_dict['Item_No']), clean_key_string(row_dict['PartNo']))
                if k not in part_db: part_db[k] = []
                part_db[k].append({
                    "unit_code": row_dict['Unit_Code'], "group": row_dict['Cls_IOM'], "description": row_dict['Description'],
                    "color": row_dict['Colour'], "qty": row_dict['Qty'], "remark": row_dict['Remark'],
                    "remark_2": row_dict['Remark2'], "fs": row_dict['FS']
                })

            cursor.close()
            conn.close()
        except Exception as db_err:
            print("[WARN] Gagal membaca data komparasi SQL Server Shiage:", db_err)

        validated_data = []
        for item in parsed_data:
            discrepancies = []
            db_match = None
            item['Colour'] = clean_str(item.get('Colour', item.get('Color', '')))
            item['Remark'] = clean_str(item.get('Remark', ''))
            
            current_order = clean_key_string(global_order_no)
            current_item_no = clean_key_string(global_item_no)

            if item.get('Category') == 'MFG':
                fab_no = clean_key_string(item.get('Fabrication_No')) 
                search_key = (current_order, current_item_no, fab_no)
                db_matches = mfg_db.get(search_key, [])

                if db_matches:
                    best_match = next((m for m in db_matches if is_equal(m['process_code'], item.get('Process_Code'), True) and is_equal(m['length'], item.get('Length'), True)), None)
                    if not best_match: best_match = next((m for m in db_matches if is_equal(m['process_code'], item.get('Process_Code'), True)), None)
                    if not best_match: best_match = next((m for m in db_matches if is_equal(m['length'], item.get('Length'), True)), None)
                    if not best_match: best_match = db_matches[0]
                    db_match = best_match
                    db_matches.remove(best_match)

                if db_match:
                    db_match['color'] = clean_str(db_match.get('color'))
                    db_match['remark'] = clean_str(db_match.get('remark'))

                    if not is_equal(item.get('Length'), db_match.get('length'), True): discrepancies.append('Length')
                    if not is_equal(item.get('Qty'), db_match.get('qty'), True): discrepancies.append('Qty')
                    if not is_equal(item.get('Process_Code'), db_match.get('process_code'), True): discrepancies.append('Process_Code')
                    if not is_equal(item.get('Colour'), db_match.get('color')): discrepancies.append('Colour')
                    if not is_equal(item.get('Remark'), db_match.get('remark')): discrepancies.append('Remark')
                    if not is_equal(item.get('Weight_M'), db_match.get('weight_m'), True, True): discrepancies.append('Weight_M')
                    if not is_equal(item.get('Weight_kg'), db_match.get('weight_kg'), True, True): discrepancies.append('Weight_kg')
                else:
                    discrepancies.append('NOT_IN_DB')

            elif item.get('Category') == 'PART':
                item['Qty'] = clean_qty_roundup(item.get('Qty'))
                part_no = clean_key_string(item.get('Part_No'))
                search_key = (current_order, current_item_no, part_no)
                db_matches = part_db.get(search_key, [])

                if db_matches:
                    best_match = next((m for m in db_matches if is_equal(clean_qty_roundup(m['qty']), item.get('Qty'), True) and is_equal(m['color'], item.get('Colour'))), None)
                    if not best_match: best_match = db_matches[0]
                    db_match = best_match
                    db_matches.remove(best_match)

                if db_match:
                    db_match['colour'] = clean_str(db_match.get('color')) 
                    db_match['remark'] = clean_str(db_match.get('remark'))
                    db_match['remark_2'] = clean_str(db_match.get('remark_2'))
                    db_match['fs'] = clean_str(db_match.get('fs'))
                    db_match['group'] = clean_str(db_match.get('group'))
                    db_match['unit_code'] = clean_str(db_match.get('unit_code'))
                    db_match['qty'] = clean_qty_roundup(db_match.get('qty'))

                    if not is_equal(item.get('Group'), db_match.get('group')): discrepancies.append('Group')
                    if not is_equal(item.get('Unit_Code'), db_match.get('unit_code')): discrepancies.append('Unit_Code')
                    if not is_equal(item.get('Qty'), db_match.get('qty'), True): discrepancies.append('Qty')
                    if not is_equal(item.get('Colour'), db_match.get('color')): discrepancies.append('Colour')
                    if not is_equal(item.get('Remark'), db_match.get('remark')): discrepancies.append('Remark')
                    if not is_equal(item.get('Remark_2'), db_match.get('remark_2')): discrepancies.append('Remark_2')
                    if not is_equal(item.get('FS'), db_match.get('fs')): discrepancies.append('FS')        
                else:
                    discrepancies.append('NOT_IN_DB')

            item['status_compare'] = 'MISMATCH' if len(discrepancies) > 0 else 'MATCH'
            item['discrepancies'] = discrepancies
            item['db_reference'] = db_match
            validated_data.append(item)

        return {
            "status": "success", "filename": file.filename, "sheet_name": sheet_name,
            "elevation_code": elevation_code, "standard_list_w": std_list_w, "standard_list_h": std_list_h,
            "data": validated_data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
pass