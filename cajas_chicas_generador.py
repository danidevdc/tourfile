import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
import os
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side, Alignment


# Variable global para almacenar la ruta del archivo cargado
archivo_programacion = ""
df_fuente = None  # DataFrame global para almacenar los datos del archivo

def cargar_archivo():
    global archivo_programacion, df_fuente
    archivo_programacion = filedialog.askopenfilename(title="Seleccionar archivo de programación", filetypes=[("Excel Files", "*.xlsx")])
    if archivo_programacion:
        df_fuente = pd.read_excel(archivo_programacion)  # Cargar el archivo de Excel
        lbl_archivo.config(text=f"Archivo cargado: {os.path.basename(archivo_programacion)}")
    else:
        lbl_archivo.config(text="No se ha cargado ningún archivo")

def agregar_detalle_gasto(ws, idx, fecha, detalle, cantidad, precio_unitario):
    ws[f'A{idx}'] = '' if detalle == "AGUAS" else fecha
    ws[f'B{idx}'] = cantidad
    ws[f'C{idx}'] = detalle
    ws[f'C{idx}'].alignment = Alignment(horizontal="center", vertical="center")
    ws[f'D{idx}'] = ""  # Para que la fusión no deje datos extraños en la columna D
    ws.merge_cells(start_row=idx, start_column=3, end_row=idx, end_column=4)
    ws[f'E{idx}'] = precio_unitario
    ws[f'F{idx}'] = f'=B{idx}*E{idx}'

def aplicar_bordes(ws, min_row, max_row, min_col, max_col):
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'),
                         top=Side(style='thin'), bottom=Side(style='thin'))
    for row in ws.iter_rows(min_row=min_row, max_row=max_row, min_col=min_col, max_col=max_col):
        for cell in row:
            cell.border = thin_border        

def buscar_file():
    global df_fuente
    if df_fuente is None:
        messagebox.showwarning("Archivo no cargado", "Primero debes cargar un archivo de programación.")
        return

    codigo_file = entry_file.get()
    if not codigo_file:
        messagebox.showwarning("Código File vacío", "Por favor, ingresa un número de File.")
        return

    try:
        columna_indice = buscar_file_en_df(df_fuente, codigo_file)
        lbl_resultado.config(text="File encontrado", fg="green")  # Mensaje en verde
    except ValueError as e:
        lbl_resultado.config(text="File no encontrado", fg="red")  # Mensaje en rojo

# Función para limpiar el cuadro de texto del "File"
def limpiar_file():
    entry_file.delete(0, tk.END)  # Limpiar el cuadro de texto de "File"
    lbl_resultado.config(text="", fg="black")  # Limpiar el mensaje        

def buscar_file_en_df(df, codigo_file):
    for col in df.columns:
        if df[col].astype(str).str.contains(codigo_file, na=False).any():
            return df.columns.get_loc(col)  # Retorna el índice de la columna
    raise ValueError(f"El código {codigo_file} no se encontró en el archivo.")

def generar_orden():
    if not archivo_programacion:
        messagebox.showwarning("Archivo no cargado", "Primero debes cargar un archivo de programación.")
        return

    codigo_file = entry_file.get()
    if not codigo_file:
        messagebox.showwarning("Código File vacío", "Por favor, ingresa un número de File.")
        return

    nombre_guia = simpledialog.askstring("Nombre de la guía", "Introduce el nombre de la guía:")
    if not nombre_guia:
        messagebox.showwarning("Nombre de la guía vacío", "Por favor, introduce el nombre de la guía.")
        return

    ruta_guardado = seleccionar_ruta_descarga()
    if not os.path.isdir(ruta_guardado):
        messagebox.showerror("Ruta inválida", "La carpeta seleccionada no es válida. Intenta de nuevo.")
        return

    # Generar el archivo de orden
    generar_documento_nuevo(df_fuente, codigo_file, nombre_guia, ruta_guardado)

def seleccionar_ruta_descarga():
    return filedialog.askdirectory(title="Selecciona la ruta de guardado")

def generar_documento_nuevo(df_fuente, codigo_file, nombre_guia, ruta_guardado):
    # Buscar la columna que contiene el código de FILE
    columna_indice = buscar_file_en_df(df_fuente, codigo_file)
    
    # Extraer datos necesarios de filas específicas de la columna identificada
    id_file = df_fuente.iloc[0, columna_indice]  # Fila 1
    nombre_grupo = df_fuente.iloc[1, columna_indice].replace('/', '.').replace(':', '.').replace('*', '.')
    fecha_inicio = pd.to_datetime(df_fuente.iloc[3, columna_indice]).strftime("%d.%m.%Y")  # Fila 4
    pax = df_fuente.iloc[4, columna_indice]  # Fila 5

    contiene_tiwa = df_fuente.iloc[:, columna_indice].astype(str).str.contains("Tiwanaku", case=False).any()
    contiene_desaguadero = df_fuente.iloc[:, columna_indice].astype(str).str.contains("desaguadero", case=False).any()
    contiene_teleferico = df_fuente.iloc[:, columna_indice].astype(str).str.contains("Cable Car", case=False).any()
    contiene_valle = df_fuente.iloc[:, columna_indice].astype(str).str.contains("Moon Valley", case=False).any()
    contiene_isla = df_fuente.iloc[:, columna_indice].astype(str).str.contains("I.Sol", case=False).any()
    contiene_puno = df_fuente.iloc[:, columna_indice].astype(str).str.contains("Puno/Kasani", case=False).any()
    contiene_kasani = df_fuente.iloc[:, columna_indice].astype(str).str.contains("Kasani/Puno", case=False).any()
    contiene_trf_in = df_fuente.iloc[:, columna_indice].astype(str).str.contains("CT-Private transfer from airport to hotel", case=False).any()
    contiene_trf_out = df_fuente.iloc[:, columna_indice].astype(str).str.contains("CT-Private transfer from hotel to airport", case=False).any()
    contiene_aguas = df_fuente.iloc[:, columna_indice].astype(str).str.contains("CT-City Tour", case=False).any()
    contiene_city_tour = df_fuente.iloc[:, columna_indice].astype(str).str.contains("City Tour", case=False).any()
    contiene_city_continuado = df_fuente.iloc[:, columna_indice].astype(str).str.contains("AM", case=False).any()
    contiene_musef = df_fuente.iloc[:, columna_indice].astype(str).str.contains("walking", case=False).any()

    # Crear un nuevo libro de trabajo
    wb = Workbook()
    ws = wb.active

    # Añadir metadatos y estructura similar al segundo archivo
    ws['A1'] = "CAJA CHICA GUIA"
    ws['A2'] = "FILE:"
    ws['B2'] = id_file
    ws.merge_cells('B2:C2')
    ws['B2'].alignment = Alignment(horizontal="center", vertical="center")

    ws['D2'] = "NOMBRE GUIA:"
    ws['E2'] = nombre_guia
    ws.merge_cells('E2:F2')

    ws['A3'] = "NOMBRE Y Nº DE PAX:"
    ws.merge_cells('A3:C3')

    ws['D3'] = nombre_grupo
    ws.merge_cells('D3:E3')

    ws['F3'] = "Nº"
    ws['G3'] = pax

    guia = 1
    
    # Encabezados del cuerpo de datos
    encabezados = ["FECHA", "CANT", "DETALLE DEL GASTO"," ", "PREC. UNIT Bs.", "TOTAL", "VoB OPS"]
    ws.append(encabezados)

    # Mergear celdas para el encabezado "DETALLE DEL GASTO"
    ws.merge_cells('C4:D4')
    
    # Formato de los encabezados en negrita
    for cell in ws[4]:
        cell.font = Font(bold=True)
    
    # Aplicar el formato en negrita a las celdas especificadas
    celdas_negrita = ['A2', 'D2', 'A3', 'F3', 'G3']
    for celda in celdas_negrita:
        ws[celda].font = Font(bold=True)

    # Aplicar el tamaño de letra a las celdas especificadas
    ws['A1'].font = Font(size=14)    
    
    # Aplicar el formato en negrit
    celdas_negritaS = ['A1']
    for celda in celdas_negritaS:
        ws[celda].font = Font(bold=True)

    # Añadir detalles de gastos
    detalles_gastos = []

    # Añadir el detalle de "desaguadero" si la palabra está presente en la columna
    if contiene_desaguadero:
        detalles_gastos.append({"detalle": "MALETAS FRONTERA", "precio_unitario": 3.00, "cantidad": "=$G$3"})

    # Añadir el detalle de "TRF IN" si la palabra está presente en la columna
    if contiene_puno:
        detalles_gastos.extend([
            {"detalle": "TAXI DOM - OFICINA", "precio_unitario": 30.00, "cantidad": guia},
            {"detalle": "BUS LPB - COPA", "precio_unitario": 40.00, "cantidad": guia},
            {"detalle": "DESAYUNO GUIA", "precio_unitario": 20.00, "cantidad": guia}
        ])
            
    # Añadir detalles adicionales si la palabra "Isla" está presente en la columna
    if contiene_isla:
        detalles_gastos.extend([
            {"detalle": "TAXI DOM - HOTEL", "precio_unitario": 30.00, "cantidad": guia},
            {"detalle": "ISLA DEL SOL", "precio_unitario": 10.00, "cantidad": "=$G$3"},
            {"detalle": "ISLA DE LA LUNA", "precio_unitario": 10.00, "cantidad": "=$G$3"}
        ])
            
    # Añadir el detalle de "puno" si la palabra está presente en la columna
    if contiene_trf_in:
        detalles_gastos.extend([
            {"detalle": "TAXI DOM - OFICINA", "precio_unitario": 30.00, "cantidad": guia},
            {"detalle": "MALETAS AEROPUERTO", "precio_unitario": 3.00, "cantidad": "=$G$3"},
            {"detalle": "TAXI HOTEL - DOM", "precio_unitario": 30.00, "cantidad": guia}
        ])
            
    # Añadir el detalle de "TIWANAKU" si la palabra está presente en la columna
    if contiene_tiwa:
        detalles_gastos.append({"detalle": "TIWANAKU", "precio_unitario": 100.00, "cantidad": "=$G$3"})

    # Añadir el detalle de "TELEFERICO" si la palabra está presente en la columna
    if contiene_teleferico:
        detalles_gastos.append({"detalle": "TELEFERICO", "precio_unitario": 7.00, "cantidad": "=$G$3+1"})

    # Añadir el detalle de "VALLE" si la palabra está presente en la columna
    if contiene_valle:
        detalles_gastos.append({"detalle": "VALLE", "precio_unitario": 20.00, "cantidad": "=$G$3"})

    # Añadir el detalle de "AM" si la palabra está presente en la columna
    if contiene_city_continuado:
        detalles_gastos.append({"detalle": "ALMUERZO GUIA", "precio_unitario": 35.00, "cantidad": guia})

    # Añadir el detalle de "kasani" si la palabra está presente en la columna
    if contiene_kasani:
        detalles_gastos.extend([
            {"detalle": "MALETAS FRONTERA", "precio_unitario": 3.00, "cantidad": "=$G$3"},
            {"detalle": "BUS COPA - LPB", "precio_unitario": 40.00, "cantidad": guia}
        ])
            
    # Añadir el detalle de "puno" si la palabra está presente en la columna
    if contiene_trf_out:
        detalles_gastos.extend([
            {"detalle": "TAXI DOM - HOTEL", "precio_unitario": 30.00, "cantidad": guia},
            {"detalle": "MALETAS AEROPUERTO", "precio_unitario": 3.00, "cantidad": "=$G$3"},
            {"detalle": "TAXI CENTRO - DOM", "precio_unitario": 30.00, "cantidad": guia}
        ])

    # Añadir el detalle de "aguas" si la palabra está presente en la columna
    if contiene_aguas:
        cantidad_formula = "=$G$3+2"
        if contiene_city_tour and contiene_tiwa:
            cantidad_formula = "=($G$3+2)*2"
        detalles_gastos.append({"detalle": "AGUAS", "precio_unitario": 6.00, "cantidad": cantidad_formula})

    # Comprobar si hay detalles para agregar
    if detalles_gastos:
        idx_inicio = 5  # Primera fila de datos
        for idx, gasto in enumerate(detalles_gastos, start=idx_inicio):
            agregar_detalle_gasto(ws, idx, fecha_inicio.replace('.', '/'), gasto["detalle"], gasto["cantidad"], gasto["precio_unitario"])

    # Añadir fila para el gasto total
    fila_total = idx + 1
    ws[f'C{fila_total}'] = "GASTO TOTAL"
    ws.merge_cells(start_row=fila_total, start_column=3, end_row=fila_total, end_column=5)
    ws[f'C{fila_total}'].font = Font(bold=True)

    # Aplicar bordes a toda la tabla
    aplicar_bordes(ws, min_row=2, max_row=ws.max_row, min_col=1, max_col=7)

    # Guardar el archivo
    output_file = os.path.join(ruta_guardado, f"G.O. {fecha_inicio} - {nombre_grupo} - {nombre_guia} - {id_file}.xlsx")
    wb.save(output_file)
    messagebox.showinfo("Archivo generado", f"El archivo se ha guardado en: {output_file}")



# Configuración de la interfaz gráfica
root = tk.Tk()
root.title("Gestión de Files")

# Botón para cargar el archivo
btn_cargar = tk.Button(root, text="Cargar archivo", command=cargar_archivo)
btn_cargar.pack(pady=10)

# Etiqueta para mostrar el archivo cargado
lbl_archivo = tk.Label(root, text="No se ha cargado ningún archivo")
lbl_archivo.pack()

# Campo de entrada para el número de File
entry_file = tk.Entry(root, width=30)
entry_file.pack(pady=10)
entry_file.insert(0, 'Nº File')

# Botón para buscar el file
btn_buscar_file = tk.Button(root, text="Buscar File", command=buscar_file)
btn_buscar_file.pack()

# Etiqueta para mostrar el resultado de la búsqueda
lbl_resultado = tk.Label(root, text="")
lbl_resultado.pack(pady=10)

# Agregar el botón "Limpiar"
btn_limpiar = tk.Button(root, text="Limpiar", command=limpiar_file)
btn_limpiar.pack(pady=10)

# Botón para generar la orden
btn_generar_orden = tk.Button(root, text="Generar Orden", command=generar_orden)
btn_generar_orden.pack(pady=10)

root.mainloop()
