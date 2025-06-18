
// src/app/api/generate-excel-python/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GeneratedReportInfo } from '@/app/generator/page';

export async function POST(request: NextRequest) {
  let tempOutputXlsxPath = '';

  try {
    // Validación del request
    if (!request.body) {
      return NextResponse.json({ error: 'Request body is missing' }, { status: 400 });
    }

    const reportData = await request.json() as GeneratedReportInfo;
    if (!reportData || typeof reportData !== 'object') {
      return NextResponse.json({ error: 'Invalid report data' }, { status: 400 });
    }

    // Generación del nombre de archivo seguro
    const generateSafeFilename = () => {
      const clean = (str: string = '', keepSpaces = false) => {
        // Permite alfanuméricos, espacios (si keepSpaces es true), puntos, guiones y guiones bajos.
        // Remueve otros caracteres que podrían ser problemáticos en nombres de archivo.
        let cleaned = str.replace(keepSpaces ? /[^\w\s.-]/g : /[^\w.-]/g, '');
        
        // Si no se mantienen espacios, reemplaza múltiples espacios/puntos/guiones por un solo guion bajo.
        // Si se mantienen espacios, solo consolida múltiples espacios a uno.
        cleaned = keepSpaces 
          ? cleaned.replace(/\s+/g, ' ').trim()
          : cleaned.replace(/[\s._-]+/g, '_').trim();
        
        // Elimina guiones bajos o puntos al inicio o al final si no se mantienen espacios
        if (!keepSpaces) {
            cleaned = cleaned.replace(/^[_.-]+|[_.-]+$/g, '');
        }
        return cleaned || "component"; // Devuelve "component" si la limpieza resulta en string vacío
      };

      const date = (reportData.startDate || new Date().toISOString().split('T')[0])
        .replace(/[\/\s-]/g, '.'); // Reemplaza /, espacio, - con .

      const groupName = clean(reportData.groupName, true); // Mantener espacios
      const guideName = clean(reportData.guideName).toUpperCase(); // Sin espacios, a mayúsculas
      const fileNumber = clean(reportData.fileNumber); // Sin espacios

      return `G.O. ${date} - ${groupName} - ${guideName} - ${fileNumber}.xlsx`;
    };

    const filename = generateSafeFilename();
    
    // Archivo temporal
    const uniqueId = Date.now() + Math.random().toString(36).substring(2, 9);
    tempOutputXlsxPath = path.join(os.tmpdir(), `report_output_temp_${uniqueId}.xlsx`);

    // Verificar script Python
    const pythonScriptPath = path.join(process.cwd(), 'excel_generator_cli.py');
    try {
      await fs.access(pythonScriptPath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Excel generator script not found on server.', details: `Script expected at ${pythonScriptPath}` },
        { status: 500 }
      );
    }

    // Ejecutar Python
    const result = await new Promise<NextResponse>((resolve) => {
      // Intenta con 'python3', si falla, podría intentarse con 'python' o manejar el error.
      // Por ahora, se asume 'python3'.
      const pythonProcess = spawn('python3', [pythonScriptPath, tempOutputXlsxPath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => stdout += data.toString());
      pythonProcess.stderr.on('data', (data) => stderr += data.toString());

      try {
        pythonProcess.stdin.write(JSON.stringify(reportData));
        pythonProcess.stdin.end();
      } catch (stdinError) {
        resolve(NextResponse.json({ error: 'Server failed to send data to Excel generation script.', details: (stdinError as Error).message }, { status: 500 }));
        return;
      }
      
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          return resolve(NextResponse.json(
            { error: 'Excel generation failed via Python script.', details: (stderr || stdout || "No specific error message from script.").trim(), exitCode: code },
            { status: 500 }
          ));
        }

        try {
          await fs.access(tempOutputXlsxPath); // Verifica si el archivo existe antes de leerlo
          const fileBuffer = await fs.readFile(tempOutputXlsxPath);
          
          const headers = new Headers();
          headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          // Uso de filename simple, reemplazando comillas dobles en el nombre por simples para el valor del header.
          headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, "'")}"`);

          resolve(new NextResponse(fileBuffer, { headers }));
        } catch (error) {
          resolve(NextResponse.json(
            { error: 'Failed to read generated Excel file.', details: `Error accessing ${tempOutputXlsxPath}: ${(error as Error).message}` },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', (error) => { // Error al iniciar el proceso Python
        resolve(NextResponse.json(
          { error: 'Failed to start Python script execution.', details: `${error.message}. Ensure Python 3 is installed and in PATH.` },
          { status: 500 }
        ));
      });
    });

    return result;

  } catch (error) {
    // Captura de errores generales en el handler POST
    return NextResponse.json(
      { error: 'An unexpected error occurred in the API handler.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    // Limpieza del archivo temporal
    if (tempOutputXlsxPath) {
      fs.unlink(tempOutputXlsxPath).catch(err => {
        // Solo loguear si el error no es porque el archivo no existe (ya fue borrado o nunca se creó)
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`Could not delete temp file ${tempOutputXlsxPath}:`, err);
        }
      });
    }
  }
}

export const dynamic = 'force-dynamic';
