
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

    // Generación del nombre de archivo seguro (usando la lógica de la última versión que proporcionaste)
    const generateSafeFilename = () => {
      const clean = (str: string = '', keepSpaces = false) => {
        let cleaned = str.replace(/[^\w\s.-]/g, ''); // Permite alfanuméricos, espacios (si keepSpaces), puntos, guiones.
        return keepSpaces 
          ? cleaned.replace(/\s+/g, ' ').trim() // Consolida espacios si se mantienen
          : cleaned.replace(/\s+/g, '_').trim(); // Reemplaza espacios con guiones bajos si no
      };

      const date = (reportData.startDate || new Date().toISOString().split('T')[0])
        .replace(/\//g, '.').replace(/-/g, '.');

      // El nombre de archivo base construido por tu lógica anterior
      let constructedFilename = `G.O. ${date} - ${clean(reportData.groupName, true)} - ${clean(reportData.guideName)} - ${clean(reportData.fileNumber)}.xlsx`;
      
      // Asegurar que no termine con .xlsx_
      if (constructedFilename.endsWith('.xlsx_')) {
        constructedFilename = constructedFilename.slice(0, -1);
      }
      return constructedFilename;
    };

    const finalConstructedFileName = generateSafeFilename(); // Este es el nombre que usaremos como base

    // Archivo temporal
    tempOutputXlsxPath = path.join(os.tmpdir(), `temp_${Date.now()}.xlsx`);

    // Verificar script Python
    const pythonScriptPath = path.join(process.cwd(), 'excel_generator_cli.py');
    try {
      await fs.access(pythonScriptPath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Excel generator script not found' },
        { status: 500 }
      );
    }

    // Ejecutar Python
    const result = await new Promise<NextResponse>((resolve) => {
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
            { error: 'Excel generation failed', details: (stderr || stdout || "No specific error message from script.").trim(), exitCode: code },
            { status: 500 }
          ));
        }

        try {
          await fs.access(tempOutputXlsxPath);
          const fileBuffer = await fs.readFile(tempOutputXlsxPath);
          
          // Aplicando tu solución recomendada para los headers:
          const safeFilename = finalConstructedFileName
            .replace(/"/g, '') // Elimina comillas
            .replace(/\s+/g, ' ') // Normaliza espacios
            .trim();

          const headers = new Headers();
          headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);

          // Opción extra segura para navegadores problemáticos
          headers.set('X-Content-Type-Options', 'nosniff');
          headers.set('Content-Transfer-Encoding', 'binary');

          resolve(new NextResponse(fileBuffer, { status: 200, headers }));

        } catch (error) {
          resolve(NextResponse.json(
            { error: 'Failed to read generated Excel file', details: `Error accessing ${tempOutputXlsxPath}: ${(error as Error).message}` },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', (error) => {
        resolve(NextResponse.json(
          { error: 'Python execution failed', details: `${error.message}. Ensure Python 3 is installed and in PATH.` },
          { status: 500 }
        ));
      });
    });

    return result;

  } catch (error) {
    return NextResponse.json(
      { error: 'An unexpected error occurred in the API handler.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    if (tempOutputXlsxPath) {
      fs.unlink(tempOutputXlsxPath).catch(err => {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`Could not delete temp file ${tempOutputXlsxPath}:`, err);
        }
      });
    }
  }
}

export const dynamic = 'force-dynamic';
