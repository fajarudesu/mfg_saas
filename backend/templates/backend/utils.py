
import math

def clean_qty_roundup(val):
    v = str(val).strip()
    if v.lower() in ['none', 'nan', 'null', '=', '']: return ""
    v = v.replace(',', '.') 
    try:
        return str(math.ceil(float(v)))
    except ValueError:
        return v

def clean_key_string(val):
    if val is None:
        return ""
    s = str(val).strip()
    if s.endswith('.0'):
        s = s[:-2]
    return s

def clean_str(val):
    v = str(val).strip()
    if v.lower() in ['none', 'nan', 'null', '=', '']: return ""
    if v.endswith(".0"): v = v[:-2]
    return v

def is_equal(val1, val2, is_numeric=False, is_weight=False):
    v1 = clean_str(val1)
    v2 = clean_str(val2)
    
    if v1 == v2: return True
    if not v1 and not v2: return True 
    
    if is_numeric or is_weight:
        try:
            f1 = float(v1) if v1 else 0.0
            f2 = float(v2) if v2 else 0.0
            
            if f1 == f2: return True
            
            if is_weight:
                if abs(f1 - (f2 * 1000)) <= 5.0: return True
                if abs((f1 * 1000) - f2) <= 5.0: return True
                
            return abs(f1 - f2) < 0.1
        except ValueError:
            pass
    
    return str(v1).lower() == str(v2).lower()