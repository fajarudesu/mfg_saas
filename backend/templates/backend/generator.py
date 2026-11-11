import os
from pathlib import Path
from openpyxl import load_workbook
from parser import parse_standard_list
import re

TEMPLATE_PATH = Path(__file__).parent / "templates" / "MFG_LIST.xlsx"


def replace_excel_vars(formula) -> str:
    """
    Mengubah variabel w/h/w.1000/h.2000 menjadi Cell Reference Excel (E11 untuk W, E12 untuk H)
    agar Excel mengenali rumus sebagai formula aktif tanpa tanda petik (').
    """
    if formula is None:
        return ""
        
    s_formula = str(formula).strip()
    if not s_formula.startswith('='):
        return s_formula
    
    # Ganti w, w.1000, w.2000, dll -> E11
    f = re.sub(r'(?i)\bw(?:\.\d+)?\b', 'E11', s_formula)
    # Ganti h, h.1000, h.2000, dll -> E12
    f = re.sub(r'(?i)\bh(?:\.\d+)?\b', 'E12', f)
    
    return f


def evaluate_formula(formula: str, W: int, H: int) -> str:
    """Mengembalikan rumus agar dihitung oleh Name Manager bawaan template."""
    if not formula or str(formula).strip() in ["", "-", "."]:
        return ""
        
    expr = str(formula).strip()
    expr = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", expr)
    
    if expr.startswith('='):
        expr = expr[1:]
        
    if '/2' in expr and '(' not in expr:
        expr = expr.replace('WS/2', '(WS/2)').replace('HS/2', '(HS/2)')
        
    return f"=({expr})"


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
    
    # Ambil nilai olahan Nested IF untuk QTY
    processed_qty = build_qty_formula(qty_str, lookup_tables)
    
    desc_upper = description.upper()
    # Deteksi part meteran
    is_linear = "AT MATERIAL" in desc_upper or "GASKET" in desc_upper or "WEATHER" in desc_upper
    
    # 1. Jika part meteran dan memiliki LENGTH
    if is_linear and length_str:
        l_expr = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", length_str)
        if l_expr.startswith('='): l_expr = l_expr[1:]
        
        # Bersihkan /1000 bawaan jika ada, agar bisa digabungkan rapi di luar
        if l_expr.endswith('/1000'):
            l_expr = l_expr[:-5]
            
        if qty_str:
            q_expr = processed_qty[1:] if processed_qty.startswith('=') else processed_qty
            # Output: =(((Length)*Qty)/1000)
            return f"=((({l_expr})*{q_expr})/1000)"
        else:
            return f"=({l_expr})/1000"
            
    # 2. Jika bukan part meteran (contoh: Spacer, Screw, Hole Cap), UTAMAKAN QTY.
    elif qty_str:
        return processed_qty
        
    # 3. Fallback jika QTY kosong tapi ada Length
    elif length_str:
        l_expr = re.sub(r'(?i)\b([hw])\.?(\d+)\b', lambda m: f"{m.group(1).lower()}.{m.group(2)}", length_str)
        if re.search(r'[a-zA-Z]', l_expr) and not l_expr.startswith('='):
            return f"={l_expr}"
        return l_expr
        
    return ""


def generate_manufacturing_list(output_path: str, order_data: dict) -> str:
    wb = load_workbook(str(TEMPLATE_PATH))
    ws = wb.active

    old_sheet_name = ws.title
    custom_sheet_name = (order_data.get('sheet_name') or '').strip()
    if custom_sheet_name:
        safe_sheet_name = re.sub(r'[\\/*?:\[\]]', ' ', custom_sheet_name)
        ws.title = safe_sheet_name[:31].strip()
    new_sheet_name = ws.title

    def replace_sheet_in_defined_names(defined_names_collection, old_name, new_name):
        if hasattr(defined_names_collection, 'values'):
            items = defined_names_collection.values() 
        elif hasattr(defined_names_collection, 'definedName'):
            items = defined_names_collection.definedName  
        else:
            items = defined_names_collection
            
        for dn in items:
            if hasattr(dn, 'value') and dn.value:
                val = str(dn.value)
                val = val.replace(f"'{old_name}'!", f"'{new_name}'!")
                val = val.replace(f"{old_name}!", f"'{new_name}'!")
                dn.value = val

    if hasattr(wb, 'defined_names'):
        replace_sheet_in_defined_names(wb.defined_names, old_sheet_name, new_sheet_name)
    if hasattr(ws, 'defined_names') and ws.defined_names:
        replace_sheet_in_defined_names(ws.defined_names, old_sheet_name, new_sheet_name)

    W = order_data.get('width', 1000)
    H = order_data.get('height', 2000)
    Q = order_data.get('qty', 1)
    WS1 = W - 52
    HS1 = H - 50

    ws['E4'] = order_data.get('project_name', '')
    ws['E6'] = order_data.get('series', '')
    ws['E7'] = order_data.get('item_no', '')
    ws['E8'] = order_data.get('elevation_code', '')
    ws['E10'] = order_data.get('unit_code_outer', '')   
    ws['AK10'] = order_data.get('unit_code_inner', '')  
    ws['O9'] = order_data.get('std_list_outer', '')
    ws['O10'] = order_data.get('std_list_inner', '')
    ws['E11'] = W
    ws['E12'] = H
    ws['I11'] = Q
    ws['K11'] = order_data.get('color', '')
    ws['O11'] = order_data.get('glass_thickness', 5)
    ws['L14'] = HS1
    ws['N14'] = WS1
    
    start_row = 22

    # --- 4. FILL OUTER FRAME ---
    outer_path = order_data.get('outer_file_path', '')
    if outer_path and os.path.exists(outer_path):
        outer_data = parse_standard_list(outer_path)
        
        for i, mat in enumerate(outer_data.materials):
            row = start_row + i
            fab_base, fab_suffix = mat.fab_no, ""
            if mat.fab_no and "-" in str(mat.fab_no):
                parts = str(mat.fab_no).rsplit("-", 1)
                if len(parts) == 2:
                    fab_base, fab_suffix = parts[0], parts[1]
                    
            ws.cell(row=row, column=18).value = mat.description
            ws.cell(row=row, column=21).value = fab_base
            ws.cell(row=row, column=22).value = "-"
            ws.cell(row=row, column=23).value = fab_suffix
            ws.cell(row=row, column=24).value = replace_excel_vars(evaluate_formula(mat.cut_formula, W, H))
            ws.cell(row=row, column=25).value = mat.qty
            
            ws.cell(row=row, column=27).value = getattr(mat, 'remark1', '')
            ws.cell(row=row, column=28).value = "" 
            
        for i, part in enumerate(outer_data.parts):
            row = start_row + i
            ws.cell(row=row, column=50).value = part.description
            ws.cell(row=row, column=53).value = part.part_no
            
            # Eksekusi fungsi QTY * LENGTH
            raw_formula = combine_qty_length_formula(part.qty, part.length, outer_data.lookup_tables, part.description)
            ws.cell(row=row, column=57).value = replace_excel_vars(raw_formula)
            
            ws.cell(row=row, column=59).value = getattr(part, 'remark1', '')
            ws.cell(row=row, column=60).value = getattr(part, 'remark2', '')
            ws.cell(row=row, column=61).value = getattr(part, 'remark3', '')
            ws.cell(row=row, column=62).value = getattr(part, 'remark4', '')
            
            ws.cell(row=row, column=64).value = getattr(part, 'at_site', '')

    # --- 5. FILL INNER SASH ---
    inner_path = order_data.get('inner_file_path', '')
    if inner_path and os.path.exists(inner_path):
        inner_data = parse_standard_list(inner_path)
        
        for i, mat in enumerate(inner_data.materials):
            row = start_row + i
            fab_base, fab_suffix = mat.fab_no, ""
            if mat.fab_no and "-" in str(mat.fab_no):
                parts = str(mat.fab_no).rsplit("-", 1)
                if len(parts) == 2:
                    fab_base, fab_suffix = parts[0], parts[1]
                    
            ws.cell(row=row, column=34).value = mat.description
            ws.cell(row=row, column=37).value = fab_base
            ws.cell(row=row, column=38).value = "-"
            ws.cell(row=row, column=39).value = fab_suffix
            ws.cell(row=row, column=40).value = replace_excel_vars(evaluate_formula(mat.cut_formula, W, H))
            ws.cell(row=row, column=41).value = mat.qty
            
            ws.cell(row=row, column=43).value = getattr(mat, 'remark1', '')
            ws.cell(row=row, column=44).value = ""
            
        for i, part in enumerate(inner_data.parts):
            row = start_row + i
            ws.cell(row=row, column=66).value = part.description
            ws.cell(row=row, column=69).value = part.part_no
            
            # Eksekusi fungsi QTY * LENGTH
            raw_formula = combine_qty_length_formula(part.qty, part.length, inner_data.lookup_tables, part.description)
            ws.cell(row=row, column=73).value = replace_excel_vars(raw_formula)
            
            ws.cell(row=row, column=75).value = getattr(part, 'remark1', '')
            ws.cell(row=row, column=76).value = getattr(part, 'remark2', '')
            ws.cell(row=row, column=77).value = getattr(part, 'remark3', '')
            ws.cell(row=row, column=78).value = getattr(part, 'remark4', '')
            
            ws.cell(row=row, column=80).value = getattr(part, 'at_site', '')

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        
    wb.save(output_path)
    return output_path