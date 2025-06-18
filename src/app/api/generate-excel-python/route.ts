
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
    if (!request.body) {
      return NextResponse.json({ error: 'Request body is missing' }, { status: 400 });
    }

    const reportData = await request.json() as GeneratedReportInfo;
    if (!reportData || typeof reportData !== 'object') {
      return NextResponse.json({ error: 'Invalid report data' }, { status: 400 });
    }

    const generateSafeFilename = () => {
      const clean = (str: string = '', keepSpaces = false): string => {
        if (typeof str !== 'string') str = String(str);

        let cleaned = str;
        // Primero, reemplazar explícitamente los caracteres que causan problemas de codificación o son inválidos en nombres de archivo.
        cleaned = cleaned.replace(/[\/:\*\?"<>\|#]/g, '_'); // # también se reemplaza por _

        // Si no se mantienen los espacios, reemplazarlos por guiones bajos.
        if (!keepSpaces) {
          cleaned = cleaned.replace(/\s+/g, '_');
        } else {
          // Si se mantienen los espacios, consolidar múltiples espacios a uno solo.
          cleaned = cleaned.replace(/\s+/g, ' ');
        }
        
        // Reemplazar cualquier carácter que no sea alfanumérico, espacio (si se permite), punto, guion o guion bajo, con un guion bajo.
        cleaned = cleaned.replace(keepSpaces ? /[^a-zA-Z0-9\s._-]/g : /[^a-zA-Z0-9._-]/g, '_');
        
        // Consolidar múltiples guiones bajos a uno solo.
        cleaned = cleaned.replace(/_+/g, '_');
        
        cleaned = cleaned.trim();

        // Eliminar guiones bajos, puntos o guiones que hayan quedado al principio o al final.
        cleaned = cleaned.replace(/^[_.-]+|[_.-]+$/g, '');
        
        return cleaned;
      };

      const date = (reportData.startDate || new Date().toISOString().split('T')[0])
        .replace(/\//g, '.').replace(/-/g, '.');
      
      const groupNamePart = clean(reportData.groupName, true); // Mantener espacios
      const guideNamePart = clean(reportData.guideName, false);   // Reemplazar espacios con _
      const fileNumberPart = clean(reportData.fileNumber, false); // Reemplazar espacios con _

      let baseName = `G.O. ${date} - ${groupNamePart} - ${guideNamePart} - ${fileNumberPart}`;
      
      // Limpieza final de la cadena base ensamblada
      baseName = baseName.replace(/\s*-\s*/g, ' - '); // Normalizar espaciado alrededor de guiones
      baseName = baseName.replace(/__+/g, '_'); // Consolidar guiones bajos nuevamente
      baseName = baseName.trim().replace(/[_.-]+$/g, ''); // MUY IMPORTANTE: Eliminar CUALQUIER _, ., - al FINAL de la base
      
      return baseName + ".xlsx";
    };

    const filename = generateSafeFilename();
    // console.log('[API DEBUG] Backend generated filename:', filename); // Puedes descomentar esto temporalmente para depurar

    tempOutputXlsxPath = path.join(os.tmpdir(), `temp_${Date.now()}_${filename}`);

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

    const result = await new Promise<NextResponse>((resolve) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, tempOutputXlsxPath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => stdout += data.toString());
      pythonProcess.stderr.on('data', (data) => stderr += data.toString());

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
          // Usar el nombre de archivo 'filename' ya limpio. Reemplazar " por ' para el valor del atributo.
          headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, "'")}"`);
          headers.set('X-Content-Type-Options', 'nosniff');
          headers.set('Content-Transfer-Encoding', 'binary');

          resolve(new NextResponse(fileBuffer, { headers }));
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
        // No es crítico si falla, pero loguear si ocurre
        // console.warn(`Could not delete temp file ${tempOutputXlsxPath}:`, unlinkError);
      });
    }
  }
}

export const dynamic = 'force-dynamic';
