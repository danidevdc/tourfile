#!/usr/bin/env python3
import sys
import json
import os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

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

        header_font = Font(name='Calibri', size=11, bold=True) 
        
        center_alignment = Alignment(horizontal="center", vertical="center")
        right_alignment = Alignment(horizontal="right", vertical="center")
        left_alignment = Alignment(horizontal="left", vertical="center")
        
        currency_format = '#,##0.00'
        date_format_ddmmyy = 'dd/mm/yy'

        ws['A1'] = "CAJA CHICA GUIA"
        ws['A1'].font = Font(name='Calibri', size=14, bold=True)
        ws['A1'].alignment = left_alignment 
        ws.merge_cells('A1:G1')

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

        headers = ["FECHA", "CANT", "DETALLE DEL GASTO", "", "P. UNIT", "TOTAL Bs.", "VoB OPS"]
        for col_num, header_text in enumerate(headers, 1):
            cell = ws.cell(row=4, column=col_num, value=header_text)
            cell.font = header_font
            cell.alignment = left_alignment
        ws.merge_cells('C4:D4')

        current_row = 5
        for item in expense_items:
            date_cell = ws.cell(row=current_row, column=1)
            date_val_str = item.get("date", "")
            if date_val_str:
                try:
                    date_obj = datetime.strptime(date_val_str, "%d/%m/%y")
                    date_cell.value = date_obj
                    date_cell.number_format = date_format_ddmmyy
                except ValueError:
                    date_cell.value = date_val_str
            else:
                date_cell.value = ""
            date_cell.alignment = center_alignment
            
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

        ws.cell(row=current_row, column=3, value="GASTO TOTAL").font = header_font
        ws.cell(row=current_row, column=3).alignment = center_alignment
        ws.merge_cells(start_row=current_row, start_column=3, end_row=current_row, end_column=5)

        grand_total_formula = f"=SUM(F5:F{current_row-1})" if expense_items else "0"
        grand_total_cell = ws.cell(row=current_row, column=6, value=grand_total_formula)
        grand_total_cell.font = header_font
        grand_total_cell.number_format = currency_format
        grand_total_cell.alignment = right_alignment
        
        ws.column_dimensions['A'].width = 12 
        ws.column_dimensions['B'].width = 9.14
        ws.column_dimensions['C'].width = 9.14
        ws.column_dimensions['D'].width = 14.85
        ws.column_dimensions['E'].width = 9.14
        ws.column_dimensions['F'].width = 9.14
        ws.column_dimensions['G'].width = 9.14

        max_data_row = current_row 
        apply_borders(ws, min_row=1, max_row=max_data_row, min_col=1, max_col=7)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        wb.save(output_path)

    except Exception as e:
        sys.stderr.write(f"Python script error during Excel generation: {str(e)}\\n")
        sys.exit(1) 

if __name__ == "__main__":
    if len(sys.argv) != 2: 
        sys.stderr.write("Usage: python excel_generator.py <output_xlsx_path>\\n")
        sys.exit(1)

    output_xlsx_path = sys.argv[1]
    
    try:
        data_to_process = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Error: Invalid JSON received: {str(e)}\\n")
        sys.exit(1)
    
    if not output_xlsx_path:
        sys.stderr.write("Error: Output path not provided.\\n")
        sys.exit(1)

    generate_excel(data_to_process, output_xlsx_path)
