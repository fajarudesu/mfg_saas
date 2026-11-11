import openpyxl

wb = openpyxl.load_workbook("10046.xlsx")
ws = wb.active

# Change just one cell to see if formatting holds
ws["E4"] = "TEST PROJECT MERGED FORMAT"

wb.save("/tmp/test_format_output.xlsx")
print("Saved to /tmp/test_format_output.xlsx")
