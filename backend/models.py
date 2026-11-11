from pydantic import BaseModel
from typing import Optional


class OrderCreate(BaseModel):
    project_name: str = ""
    width: int = 0
    height: int = 0
    qty: int = 1
    color: str = ""
    glass_thickness: int = 5


class OrderUpdate(BaseModel):
    project_name: Optional[str] = None
    series: Optional[str] = None
    elevation_code: Optional[str] = None
    item_no: Optional[str] = None
    sheet_name: Optional[str] = None  
    unit_code_outer: Optional[str] = None
    unit_code_inner: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    qty: Optional[int] = None
    color: Optional[str] = None
    glass_thickness: Optional[int] = None


class OrderResponse(BaseModel):
    id: int
    project_name: str
    series: str
    elevation_code: str
    item_no: str
    unit_code_outer: str
    unit_code_inner: str
    width: int
    height: int
    qty: int
    color: str
    glass_thickness: int
    std_list_outer: str
    std_list_inner: str
    status: str
    created_at: str
    updated_at: str
    has_output: bool = False


class PartItem(BaseModel):
    description: str
    fab_no: str = ""
    part_no: str = ""
    qty: str = ""
    material: str = ""
    color: str = ""
    cut_formula: str = ""
    length: str = ""
    remarks: str = ""
    remark1: str = ""
    remark2: str = ""
    remark3: str = ""
    remark4: str = ""
    at_site: str = ""


class LookupTable(BaseModel):
    table_id: str
    description: str
    variable: str
    conditions: list[dict] = []


class ParsedStandardList(BaseModel):
    list_no: str = ""
    role: str = ""
    series: str = ""
    system: str = ""
    depth: str = ""
    glass_groove: str = ""
    handle: str = ""
    unit_code: str = ""
    system_drawing: str = ""
    formulas: dict = {}
    materials: list[PartItem] = []
    parts: list[PartItem] = []
    lookup_tables: list[LookupTable] = []