
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
        // Modificación: Se añade '#' a la lista de caracteres permitidos en la regex.
        // Esto evitará que '#' sea eliminado.
        let cleaned = str.replace(/[^\w\s.#-]/g, ''); 
        return keepSpaces 
          ? cleaned.replace(/\s+/g, ' ').trim()
          : cleaned.replace(/\s+/g, '_').trim();
      };

      const date = (reportData.startDate || new Date().toISOString().split('T')[0])
        .replace(/\//g, '.').replace(/-/g, '.');
      
      let groupNamePart = clean(reportData.groupName, true);
      let guideNamePart = clean(reportData.guideName, false); // keepSpaces = false
      let fileNumberPart = clean(reportData.fileNumber, false); // keepSpaces = false

      // Asegurar que no haya múltiples guiones bajos seguidos si se generaron por espacios
      groupNamePart = groupNamePart.replace(/__+/g, '_');
      guideNamePart = guideNamePart.replace(/__+/g, '_');
      fileNumberPart = fileNumberPart.replace(/__+/g, '_');
      
      // Construir el nombre base
      let baseFileName = `G.O. ${date} - ${groupNamePart} - ${guideNamePart} - ${fileNumberPart}`;
      
      // Limpieza final de la base del nombre de archivo
      // Eliminar caracteres que no queremos al final de la parte base
      baseFileName = baseFileName.replace(/[_.-]+$/, '');

      return `${baseFileName}.xlsx`;
    };

    const finalConstructedFileName = generateSafeFilename();
    
    // Para el header Content-Disposition, versión simplificada
    const safeFilenameForHeader = finalConstructedFileName
      .replace(/"/g, '') // Elimina comillas dobles si las hubiera por error
      .replace(/\s+/g, ' ') // Normaliza múltiples espacios a uno solo
      .trim();

    // Archivo temporal
    // Usar una parte del nombre de archivo final para el temporal, pero asegurar unicidad.
    const tempBase = finalConstructedFileName.replace('.xlsx', '').replace(/[^a-zA-Z0-9_.-]/g, '_');
    tempOutputXlsxPath = path.join(os.tmpdir(), `temp_${Date.now()}_${tempBase.substring(0,50)}.xlsx`);


    // Verificar script Python
    const pythonScriptPath = path.join(process.cwd(), 'excel_generator_cli.py');
    try {
      await fs.access(pythonScriptPath);
    } catch (error) {
      console.error('Excel generator script not found at:', pythonScriptPath);
      return NextResponse.json(
        { error: 'Excel generator script not found on server.' },
        { status: 500 }
      );
    }

    // Ejecutar Python
    const result = await new Promise<NextResponse>((resolve) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, tempOutputXlsxPath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => stdout += data.toString());
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // console.error(`Python stderr: ${data.toString()}`); // Log stderr as it comes
      });

      pythonProcess.stdin.write(JSON.stringify(reportData));
      pythonProcess.stdin.end();

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error(`Python script failed with code ${code}:`, stderr.trim());
          return resolve(NextResponse.json(
            { error: 'Excel generation failed on server', details: stderr.trim() },
            { status: 500 }
          ));
        }

        try {
          const fileBuffer = await fs.readFile(tempOutputXlsxPath);
          
          const headers = new Headers();
          headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          // Usar el nombre de archivo ya limpio y seguro para el header
          headers.set('Content-Disposition', `attachment; filename="${safeFilenameForHeader}"`);
          
          // Headers adicionales para robustez
          headers.set('X-Content-Type-Options', 'nosniff');
          headers.set('Content-Transfer-Encoding', 'binary');

          resolve(new NextResponse(fileBuffer, { status: 200, headers }));

        } catch (readError) {
          console.error('Failed to read generated Excel file:', readError);
          resolve(NextResponse.json(
            { error: 'Failed to read generated file on server' , details: (readError as Error).message },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', (pyError) => {
        console.error('Python execution failed:', pyError);
        resolve(NextResponse.json(
          { error: 'Python execution failed on server', details: pyError.message },
          { status: 500 }
        ));
      });
    });

    return result;

  } catch (error) {
    console.error('Internal server error in API route:', error);
    return NextResponse.json(
      { error: 'Internal server error in API handler', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    if (tempOutputXlsxPath) {
      fs.unlink(tempOutputXlsxPath).catch((unlinkError) => {
        // console.warn(`Could not delete temp file ${tempOutputXlsxPath}:`, unlinkError);
      });
    }
  }
}

export const dynamic = 'force-dynamic';
