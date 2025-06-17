
import sys
import json
import os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def resolve_pax_formula_value(quantity_str, pax_value):
    """
    Resolves quantity strings like "=$G$3" or "=$G$3+1" to a numerical value.
    This is a simplified version for direct value calculation if needed,
    but Excel will handle the formulas. For display or simple logic in Python
    if formulas are not directly translatable outside Excel.
    """
    if isinstance(quantity_str, (int, float)):
        return quantity_str
    
    # Simplified replacement for G3-like formulas
    # In a real scenario, you might need a more robust formula parser
    # or rely on Excel to calculate this if you're just writing the formula.
    # For this script, we assume JS sends quantity strings that are either numbers
    # or Excel-ready formulas.
    
    # If the quantity_str IS a formula starting with '=', Excel will handle it.
    # If it's a number string, convert.
    try:
        return float(quantity_str)
    except ValueError:
        # It's likely a formula string, or a more complex string not handled here.
        # For the purpose of openpyxl, writing the string "=$G$3" is correct.
        # This function is more for conceptual understanding or if a Python-side
        # numerical value of the formula was needed before writing to Excel.
        # We will primarily write the formula strings directly to Excel.
        if "G3" in quantity_str.upper(): # A very basic check
            # This is a placeholder - actual evaluation is complex.
            # Excel will do the real work with the formula string.
            temp_val_str = quantity_str.upper().replace("=$G$3", str(pax_value)).replace("$G$3", str(pax_value))
            if temp_val_str.startswith("="):
                temp_val_str = temp_val_str[1:]
            try:
                # VERY UNSAFE, DO NOT USE IN PRODUCTION WITHOUT A SAFE EVALUATOR
                # return eval(temp_val_str.replace(str(pax_value), str(pax_value))) # Example, but unsafe
                return pax_value # Fallback for complex formulas
            except:
                return 1 # Fallback
        return 1 # Default fallback

def apply_borders(ws, min_row, max_row, min_col, max_col):
    thin_border = Border(
        left=Side(style='thin'), 
        right=Side(style='thin'),
        top=Side(style='thin'), 
        bottom=Side(style='thin')
    )
    for row_idx in range(min_row, max_row + 1):
        for col_idx in range(min_col, max_col + 1):
            ws.cell(row=row_idx, column=col_idx).border = thin_border

def generate_excel(data, output_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "CajaChica"

    # Data extraction from input JSON
    file_number = data.get("fileNumber", "N/A")
    guide_name = data.get("guideName", "N/A").upper()
    group_name = data.get("groupName", "N/A")
    pax_count = int(data.get("paxCount", 0))
    start_date_str = data.get("startDate", "") # Expected "dd/MM/yy" or similar
    expense_items = data.get("expenseItems", [])

    # Styles
    title_font = Font(name='Calibri', size=14, bold=True)
    header_font = Font(name='Calibri', size=11, bold=True)
    center_alignment = Alignment(horizontal="center", vertical="center")
    right_alignment = Alignment(horizontal="right", vertical="center")
    
    currency_format = '#,##0.00'

    # --- Row 1: CAJA CHICA GUIA ---
    ws['A1'] = "CAJA CHICA GUIA"
    ws['A1'].font = title_font
    ws['A1'].alignment = center_alignment
    ws.merge_cells('A1:G1')

    # --- Row 2: FILE & NOMBRE GUIA ---
    ws['A2'] = "FILE:"
    ws['A2'].font = header_font
    ws['B2'] = file_number
    ws['B2'].alignment = center_alignment
    ws.merge_cells('B2:C2')

    ws['D2'] = "NOMBRE GUIA:"
    ws['D2'].font = header_font
    ws['E2'] = guide_name
    ws['E2'].alignment = center_alignment
    ws.merge_cells('E2:F2') # Adjusted merge to F

    # --- Row 3: NOMBRE Y Nº DE PAX & Nº ---
    ws['A3'] = "NOMBRE Y Nº DE PAX:"
    ws['A3'].font = header_font
    ws.merge_cells('A3:C3')

    ws['D3'] = group_name
    ws['D3'].alignment = center_alignment
    ws.merge_cells('D3:E3') # Adjusted merge to E

    ws['F3'] = "Nº" # Moved to F3
    ws['F3'].font = header_font
    ws['G3'] = pax_count # Moved to G3
    ws['G3'].font = header_font
    ws['G3'].alignment = right_alignment


    # --- Row 4: Table Headers ---
    headers = ["FECHA", "CANT", "DETALLE DEL GASTO", "", "PREC. UNIT Bs.", "TOTAL Bs.", "VoB OPS"]
    for col_num, header_text in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_num, value=header_text)
        cell.font = header_font
        cell.alignment = center_alignment
    ws.merge_cells('C4:D4') # Merge for DETALLE DEL GASTO

    # --- Expense Items ---
    current_row = 5
    for item in expense_items:
        date_val = "" if item.get("detail", "").upper() == "AGUAS" else item.get("date", "")
        ws.cell(row=current_row, column=1, value=date_val).alignment = center_alignment
        
        quantity_str = str(item.get("quantity", "1"))
        # Write formula strings directly if they start with '='
        if quantity_str.startswith("="):
             # Replace $G$3 with G3 for openpyxl if needed, though usually direct $G$3 works.
             # Ensure G3 refers to the correct cell if sheet structure changes.
             ws.cell(row=current_row, column=2, value=quantity_str.replace("$G$3", "G3")).alignment = center_alignment
        else:
            try:
                ws.cell(row=current_row, column=2, value=float(quantity_str)).alignment = center_alignment
            except ValueError:
                 ws.cell(row=current_row, column=2, value=quantity_str).alignment = center_alignment


        ws.cell(row=current_row, column=3, value=item.get("detail", "")).alignment = center_alignment
        ws.merge_cells(start_row=current_row, start_column=3, end_row=current_row, end_column=4)
        
        unit_price_val = item.get("unitPrice", 0)
        try:
            unit_price_val = float(unit_price_val)
        except ValueError:
            unit_price_val = 0

        unit_price_cell = ws.cell(row=current_row, column=5, value=unit_price_val)
        unit_price_cell.number_format = currency_format
        unit_price_cell.alignment = right_alignment

        total_formula = f"=B{current_row}*E{current_row}"
        total_cell = ws.cell(row=current_row, column=6, value=total_formula)
        total_cell.number_format = currency_format
        total_cell.alignment = right_alignment
        
        ws.cell(row=current_row, column=7, value=item.get("vobOps", "")).alignment = center_alignment
        current_row += 1

    # --- Row Total General ---
    ws.cell(row=current_row, column=3, value="GASTO TOTAL").font = header_font
    ws.cell(row=current_row, column=3).alignment = center_alignment
    ws.merge_cells(start_row=current_row, start_column=3, end_row=current_row, end_column=5)

    grand_total_formula = f"=SUM(F5:F{current_row-1})" if expense_items else "0"
    grand_total_cell = ws.cell(row=current_row, column=6, value=grand_total_formula)
    grand_total_cell.font = header_font
    grand_total_cell.number_format = currency_format
    grand_total_cell.alignment = right_alignment
    
    # --- Column Widths ---
    ws.column_dimensions['A'].width = 12  # FECHA
    ws.column_dimensions['B'].width = 8   # CANT
    ws.column_dimensions['C'].width = 35  # DETALLE (col C part)
    ws.column_dimensions['D'].width = 0.1 # DETALLE (col D part, effectively hidden)
    ws.column_dimensions['E'].width = 15  # PREC. UNIT
    ws.column_dimensions['F'].width = 15  # TOTAL
    ws.column_dimensions['G'].width = 10  # VoB OPS

    # --- Apply Borders ---
    # Determine the full range of the table data for bordering
    # Header rows 1-3, table header row 4, data rows, total row
    max_data_row = current_row 
    apply_borders(ws, min_row=1, max_row=max_data_row, min_col=1, max_col=7)


    wb.save(output_path)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python excel_generator_cli.py <input_json_path> <output_xlsx_path>")
        sys.exit(1)

    input_json_path = sys.argv[1]
    output_xlsx_path = sys.argv[2]

    try:
        with open(input_json_path, 'r', encoding='utf-8') as f:
            data_to_process = json.load(f)
    except Exception as e:
        print(f"Error reading or parsing JSON input file: {e}")
        sys.exit(1)
    
    try:
        generate_excel(data_to_process, output_xlsx_path)
        # print(f"Excel file generated successfully at {output_xlsx_path}") # Optional: for server logs
    except Exception as e:
        print(f"Error generating Excel file: {e}")
        # Ensure a partial/corrupt file is not left if possible, or handle upstream
        if os.path.exists(output_xlsx_path):
            try:
                os.remove(output_xlsx_path)
            except OSError:
                pass # Error removing, nothing much to do
        sys.exit(1)


    