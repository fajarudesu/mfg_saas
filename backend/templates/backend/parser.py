"""
Parser for Standard List .xls files.
Extracts metadata, parts, materials, lookup tables, and formulas.
"""
import xlrd
import re
from models import ParsedStandardList, PartItem, LookupTable

def build_qty_formula(qty_str: str, lookup_tables: list) -> str:
    """Mengubah qty menjadi formula Nested IF Excel yang bersih."""
    if not qty_str:
        return ""
    
    qty_str = str(qty_str).strip()
    qty_str = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", qty_str)
    
    if not re.search(r'[a-zA-Z]', qty_str):
        return qty_str
        
    final_formula = qty_str
    
    for table in lookup_tables:
        for cond in table.conditions:
            for raw_header in cond['values'].keys():
                header_key = str(raw_header).strip()
                
                if header_key and re.search(rf'(?<![a-zA-Z]){header_key}(?![0-9])', final_formula):
                    excel_var = str(table.variable).strip()
                    excel_var = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", excel_var)
                    
                    if not excel_var:
                        excel_var = "W" 
                        
                    conditions_list = []
                    fallback_val = "0" 
                    
                    for c in table.conditions:
                        if header_key in [str(k).strip() for k in c['values'].keys()]:
                            raw_cond = str(c['condition']).strip().replace(' ', '')
                            val = str(c['values'].get(raw_header, '0')).strip()
                            
                            clean_cond = re.sub(r'[a-zA-Z]+\.?\d*', '', raw_cond)
                            nums = re.findall(r'\d+\.?\d*', clean_cond.replace(',', '.'))
                            
                            if not nums:
                                continue
                                
                            if len(nums) >= 2:
                                cond_expr = f"{excel_var}<={nums[1]}"
                                conditions_list.append((cond_expr, val))
                            else:
                                num = nums[0]
                                is_greater_than = False
                                
                                if '≧' in raw_cond or '>=' in raw_cond:
                                    is_greater_than = True
                                elif '>' in raw_cond and '<' not in raw_cond: 
                                    is_greater_than = True
                                elif '<' in raw_cond and not ('<=' in raw_cond or '≦' in raw_cond):
                                    if raw_cond.find(num) < raw_cond.find('<'):
                                        is_greater_than = True
                                        
                                if is_greater_than:
                                    fallback_val = val
                                else:
                                    cond_expr = f"{excel_var}<={num}"
                                    conditions_list.append((cond_expr, val))
                    
                    if conditions_list:
                        nested_if = fallback_val
                        for cond_expr, val in reversed(conditions_list):
                            nested_if = f"IF({cond_expr},{val},{nested_if})"
                        
                        final_formula = re.sub(rf'(?<![a-zA-Z]){header_key}(?![0-9])', f"({nested_if})", final_formula)

    if final_formula != qty_str:
        final_formula = re.sub(r'(\d)\(', r'\1*(', final_formula)
        return f"={final_formula}"
        
    return qty_str

def combine_qty_length_formula(qty_str: str, length_str: str, lookup_tables: list, description: str = "") -> str:
    """Menggabungkan QTY dan LENGTH (QTY * LENGTH / 1000) khusus untuk part meteran."""
    qty_str = str(qty_str).strip() if qty_str else ""
    length_str = str(length_str).strip() if length_str else ""
    
    if qty_str in ["", "-", "."]: qty_str = ""
    if length_str in ["", "-", "."]: length_str = ""
    
    processed_qty = build_qty_formula(qty_str, lookup_tables)
    
    desc_upper = (description or "").upper()
    is_linear = "AT MATERIAL" in desc_upper or "GASKET" in desc_upper or "WEATHER" in desc_upper
    
    if is_linear and length_str:
        l_expr = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", length_str)
        if l_expr.startswith('='): l_expr = l_expr[1:]
        
        if l_expr.endswith('/1000'):
            l_expr = l_expr[:-5]
            
        if qty_str:
            q_expr = processed_qty[1:] if processed_qty.startswith('=') else processed_qty
            return f"=((({l_expr})*{q_expr})/1000)"
        else:
            return f"=({l_expr})/1000"
            
    elif qty_str:
        return processed_qty
        
    elif length_str:
        l_expr = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", length_str)
        if re.search(r'[a-zA-Z]', l_expr) and not l_expr.startswith('='):
            return f"={l_expr}"
        return l_expr
        
    return ""

def parse_standard_list(file_path: str) -> ParsedStandardList:
    """Parse a standard list .xls file and return structured data."""
    wb = xlrd.open_workbook(file_path, formatting_info=True)

    sheet_name = wb.sheet_names()[0]
    result = ParsedStandardList(list_no=sheet_name)

    main_sheet = wb.sheet_by_index(0)
    _parse_metadata(main_sheet, result)

    for i in range(len(wb.sheet_names())):
        current_sheet = wb.sheet_by_index(i)
        _parse_materials(current_sheet, result)
        _parse_parts(current_sheet, result)
        _parse_lookup_tables(current_sheet, result)

    # --- POST-PROCESSING: Render formula Part ke UI Frontend ---
    for part in result.parts:
        part.cut_formula = combine_qty_length_formula(part.qty, part.length, result.lookup_tables, part.description)

    return result

def _safe_str(cell_value) -> str:
    if cell_value is None or cell_value == '':
        return ''
    s = str(cell_value).strip()
    if s.endswith('.0') and s[:-2].isdigit():
        return s[:-2]
    return s

def _is_strikethrough(ws, row, col) -> bool:
    try:
        xf_index = ws.cell_xf_index(row, col)
        xf = ws.book.xf_list[xf_index]
        font = ws.book.font_list[xf.font_index]
        return font.struck_out == 1
    except Exception:
        return False

def _parse_metadata(ws, result: ParsedStandardList):
    for row in range(ws.nrows):
        for col in range(ws.ncols):
            val = _safe_str(ws.cell(row, col).value)
            if val == 'SYSTEM':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value)
                    if v2 and v2 not in ('SYSTEM', 'DESCRIPTION', 'APPROVED'):
                        result.system = v2
                        break
            if val == 'DEPTH':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value)
                    if v2 and v2 != 'DEPTH':
                        result.depth = v2
                        break
            if val == 'GLASS GROOVE':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value)
                    if v2 and v2 != 'GLASS GROOVE':
                        result.glass_groove = v2
                        break
            if val == 'HANDLE':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value)
                    if v2 and v2 != 'HANDLE':
                        result.handle = v2
                        break
            if val == 'SYSTEM DRAWING':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value)
                    if v2 and v2 != 'SYSTEM DRAWING':
                        result.system_drawing = v2
                        break
            if val == 'LIST No.':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row + 1, c2).value) if row + 1 < ws.nrows else ''
                    if v2.startswith('U9S-') or v2.startswith('U9H-'):
                        result.list_no = v2
                        break

    for row in range(ws.nrows):
        for col in range(ws.ncols):
            val = _safe_str(ws.cell(row, col).value)
            if val == 'DESCRIPTION':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value).upper()
                    if v2 in ('OUTER', 'INNER'):
                        result.role = v2.lower()
                        break
            if '=' in val and any(v in val for v in ['WS', 'HS']):
                parts = val.split('=', 1)
                if len(parts) == 2:
                    result.formulas[parts[0].strip()] = parts[1].strip()
            if val == 'UNIT CODE':
                for c2 in range(col + 1, min(col + 15, ws.ncols)):
                    v2 = _safe_str(ws.cell(row, c2).value)
                    if v2 and v2 not in ('UNIT CODE', '-'):
                        result.unit_code = v2
                        break

def _parse_materials(ws, result: ParsedStandardList):
    is_at_site = False
    for row in range(3, 48):
        if row >= ws.nrows: break
        if ws.ncols > 7 and _is_strikethrough(ws, row, 7): continue

        description = _safe_str(ws.cell(row, 7).value) if ws.ncols > 7 else ''
        fab_no = _safe_str(ws.cell(row, 9).value) if ws.ncols > 9 else ''

        desc_upper = description.upper().strip()
        fab_upper = fab_no.upper().strip()
        if desc_upper in ('DATE', 'APPROVED', 'REMARKS', 'DESIGN', 'REVISION') or fab_upper in ('APPROVED', 'DESIGN'):
            break

        if description in ('(AT SITE)', 'AT SITE'):
            is_at_site = True
            continue

        if not description and not fab_no: continue
        if description == 'DESCRIPTION' or fab_no == 'FAB No.': continue

        if fab_no:
            qty = _safe_str(ws.cell(row, 11).value) if ws.ncols > 11 else ''
            cut_formula = _safe_str(ws.cell(row, 12).value) if ws.ncols > 12 else ''
            note = _safe_str(ws.cell(row, 6).value) if ws.ncols > 6 else ''

            item = PartItem(
                description=description, fab_no=fab_no, qty=qty, cut_formula=cut_formula,
                remarks=note, remark2=note, at_site="S" if is_at_site else ""
            )
            result.materials.append(item)

def _parse_parts(ws, result: ParsedStandardList):
    is_at_site = False
    for row in range(3, 48):
        if row >= ws.nrows: break
        if ws.ncols > 19 and _is_strikethrough(ws, row, 19): continue

        description = _safe_str(ws.cell(row, 19).value) if ws.ncols > 19 else ''
        part_no = _safe_str(ws.cell(row, 20).value) if ws.ncols > 20 else ''

        desc_upper = description.upper().strip()
        if desc_upper in ('DATE', 'APPROVED', 'REMARKS', 'DESIGN', 'REVISION'): break

        if description in ('(AT SITE)', 'AT SITE'):
            is_at_site = True
            continue

        if not description and not part_no: continue
        if description == 'DESCRIPTION' or part_no == 'PART No.': continue
        if description.startswith('[') and description.endswith(']'): continue

        qty = _safe_str(ws.cell(row, 22).value) if ws.ncols > 22 else ''
        material = _safe_str(ws.cell(row, 23).value) if ws.ncols > 23 else ''
        color = _safe_str(ws.cell(row, 24).value) if ws.ncols > 24 else ''
        length = _safe_str(ws.cell(row, 32).value) if ws.ncols > 32 else ''

        if not part_no and not qty and not length: continue

        remarks = _safe_str(ws.cell(row, 35).value) if ws.ncols > 35 else ''
        remark1_val = ""
        if "AT MATERIAL" in desc_upper or "GASKET" in desc_upper:
            remark1_val = "M"

        item = PartItem(
            description=description, part_no=part_no, qty=qty, material=material,
            color=color, length=length, remarks=remarks, remark1=remark1_val,
            remark2=remarks, at_site="S" if is_at_site else ""
        )
        result.parts.append(item)

def _parse_lookup_tables(ws, result: ParsedStandardList):
    current_table = None
    header_map = {} 
    key_col = -1

    for row in range(ws.nrows):
        found_new_table = False
        for col in range(min(20, ws.ncols)):
            val_raw = _safe_str(ws.cell(row, col).value)
            val_clean = val_raw.replace(' ', '').replace('［', '[').replace('］', ']')
            if val_clean.startswith('[T') and ']' in val_clean:
                key_col = col
                tokens = val_clean.split(']')
                table_id = tokens[0].replace('[', '').strip()
                desc = tokens[1].strip() if len(tokens) > 1 else ''

                current_table = LookupTable(
                    table_id=table_id, description=desc, variable='', conditions=[]
                )
                result.lookup_tables.append(current_table)
                header_map = {}
                found_new_table = True
                break 
                
        if found_new_table: continue 
        if current_table is None or key_col == -1: continue

        row_val = _safe_str(ws.cell(row, key_col).value).strip()
        is_empty_row = True
        for c in range(key_col, min(key_col + 15, ws.ncols)):
            if _safe_str(ws.cell(row, c).value).strip():
                is_empty_row = False
                break
                
        if is_empty_row:
            current_table = None
            header_map = {}
            continue

        if not current_table.variable:
            if row_val: current_table.variable = row_val
            for c in range(key_col + 1, min(key_col + 15, ws.ncols)):
                h_val = _safe_str(ws.cell(row, c).value).strip()
                if h_val: header_map[c] = h_val
            continue

        if row_val:
            condition = {'condition': row_val, 'values': {}}
            for col_idx, h_name in header_map.items():
                if col_idx < ws.ncols:
                    cell_val = _safe_str(ws.cell(row, col_idx).value).strip()
                    if cell_val: condition['values'][h_name] = cell_val
            
            if condition['values']: current_table.conditions.append(condition)