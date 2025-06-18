
import sys
import json
import os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
# import traceback # For more detailed Python error logging if needed

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
    try:
        wb = Workbook()
        ws = wb.active
        ws.title = "CajaChica"

        file_number = data.get("fileNumber", "N/A")
        guide_name = data.get("guideName", "N/A").upper()
        group_name = data.get("groupName", "N/A")
        pax_count = int(data.get("paxCount", 0))
        expense_items = data.get("expenseItems", [])

        # Fonts
        # title_font used for A1 was originally size 14, changed to header_font for size 11
        header_font = Font(name='Calibri', size=11, bold=True) 
        # General font for data cells, if needed (not explicitly defined before for data)
        # data_font = Font(name='Calibri', size=11, bold=False) 

        # Alignments
        center_alignment = Alignment(horizontal="center", vertical="center")
        right_alignment = Alignment(horizontal="right", vertical="center")
        left_alignment = Alignment(horizontal="left", vertical="center") # New alignment for A1
        
        currency_format = '#,##0.00'

        # --- Row 1: CAJA CHICA GUIA ---
        ws['A1'] = "CAJA CHICA GUIA"
        ws['A1'].font = header_font # Changed from title_font (size 14) to header_font (size 11)
        ws['A1'].alignment = left_alignment # Changed from center_alignment
        ws.merge_cells('A1:G1') # Merging remains the same, but content inside A1 is left aligned

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
        ws.merge_cells('E2:F2')

        # --- Row 3: NOMBRE Y Nº DE PAX & Nº ---
        ws['A3'] = "NOMBRE Y Nº DE PAX:"
        ws['A3'].font = header_font
        ws.merge_cells('A3:C3')

        ws['D3'] = group_name
        ws['D3'].alignment = center_alignment
        ws.merge_cells('D3:E3')

        ws['F3'] = "Nº"
        ws['F3'].font = header_font
        ws['G3'] = pax_count
        ws['G3'].font = header_font
        ws['G3'].alignment = right_alignment

        # --- Row 4: Table Headers ---
        headers = ["FECHA", "CANT", "DETALLE DEL GASTO", "", "PREC. UNIT Bs.", "TOTAL Bs.", "VoB OPS"]
        for col_num, header_text in enumerate(headers, 1):
            cell = ws.cell(row=4, column=col_num, value=header_text)
            cell.font = header_font
            cell.alignment = center_alignment
        ws.merge_cells('C4:D4')

        # --- Expense Items ---
        current_row = 5
        for item in expense_items:
            date_val = item.get("date", "")
            ws.cell(row=current_row, column=1, value=date_val).alignment = center_alignment
            
            quantity_str = str(item.get("quantity", "1"))
            if quantity_str.startswith("="):
                ws.cell(row=current_row, column=2, value=quantity_str).alignment = center_alignment
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
        # (Original widths commented out for clarity of change)
        # ws.column_dimensions['A'].width = 12
        # ws.column_dimensions['B'].width = 8
        # ws.column_dimensions['C'].width = 35 
        # ws.column_dimensions['D'].width = 0.1 # Effectively hide column D if merged
        # ws.column_dimensions['E'].width = 15
        # ws.column_dimensions['F'].width = 15
        # ws.column_dimensions['G'].width = 10

        pixel_width_target = 9.14 # Approx 64 pixels (64px / ~7px_per_char)

        ws.column_dimensions['A'].width = 12 # A remains unchanged as per request
        ws.column_dimensions['B'].width = pixel_width_target
        ws.column_dimensions['C'].width = pixel_width_target 
        # Column D is merged often, its width setting might not be critical if C covers it.
        # If C's width is 9.14, D is part of merged cells with C.
        # ws.column_dimensions['D'].width = # Not explicitly requested to change, let's leave it as openpyxl default or as affected by merge
        ws.column_dimensions['E'].width = pixel_width_target
        ws.column_dimensions['F'].width = pixel_width_target
        ws.column_dimensions['G'].width = pixel_width_target


        # --- Apply Borders to the main table content ---
        max_data_row = current_row 
        apply_borders(ws, min_row=1, max_row=max_data_row, min_col=1, max_col=7)

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        wb.save(output_path)

    except Exception as e:
        sys.stderr.write(f"Python script error during Excel generation: {str(e)}\\n")
        # import traceback
        # sys.stderr.write(traceback.format_exc() + "\\n") # More detailed traceback
        sys.exit(1) 

if __name__ == "__main__":
    if len(sys.argv) != 2: 
        sys.stderr.write("Usage: python excel_generator_cli.py <output_xlsx_path>\\n")
        sys.stderr.write(f"Received arguments: {sys.argv}\\n")
        sys.exit(1)

    output_xlsx_path = sys.argv[1]
    
    try:
        data_to_process = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Error: Invalid JSON received on stdin: {str(e)}\\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Error reading or parsing JSON from stdin: {str(e)}\\n")
        sys.exit(1)
    
    if not output_xlsx_path:
        sys.stderr.write("Error: Output XLSX path not provided or empty.\\n")
        sys.exit(1)

    generate_excel(data_to_process, output_xlsx_path)
    # print(f"Excel file generated successfully at {output_xlsx_path}") # Optional: for debugging
    
    

    
