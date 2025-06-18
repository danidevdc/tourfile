
// src/app/api/generate-excel-python/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GeneratedReportInfo } from '@/app/generator/page';

export async function POST(request: NextRequest) {
  let tempOutputXlsxPath = ''; // Renamed to avoid confusion with user-facing paths

  try {
    if (!request.body) {
      return NextResponse.json({ error: 'Request body is missing' }, { status: 400 });
    }
    const reportData = await request.json() as GeneratedReportInfo;

    if (!reportData || typeof reportData !== 'object') {
        return NextResponse.json({ error: 'Invalid report data' }, { status: 400 });
    }
    
    const uniqueId = Date.now() + Math.random().toString(36).substring(2, 9);
    const tempDir = os.tmpdir();
    tempOutputXlsxPath = path.join(tempDir, `report_output_temp_${uniqueId}.xlsx`);
    
    // --- Start Filename Construction and Sanitization ---
    const startDateForFileName = (reportData.startDate || new Date().toISOString().split('T')[0]).replace(/[/\\]/g, '.');
    
    let groupNameForFileName = reportData.groupName || "report";
    // Replace # with space first for groupName, then other problem chars with underscore
    groupNameForFileName = groupNameForFileName.replace(/#/g, ' ');
    groupNameForFileName = groupNameForFileName.replace(/[/:*?"<>|\\]/g, '_'); // Common problematic chars for filenames
    groupNameForFileName = groupNameForFileName.replace(/\s+/g, ' ').replace(/__+/g, '_').trim();
    if (groupNameForFileName.endsWith("_")) {
        groupNameForFileName = groupNameForFileName.slice(0, -1);
    }
    if (!groupNameForFileName) groupNameForFileName = "report";

    let guideNameForFileName = (reportData.guideName || "GUIDE").toUpperCase();
    guideNameForFileName = guideNameForFileName.replace(/[/:*?"<>|\\]/g, '_');
    guideNameForFileName = guideNameForFileName.replace(/\s+/g, '_').replace(/__+/g, '_').trim();
    if (guideNameForFileName.endsWith("_")) {
        guideNameForFileName = guideNameForFileName.slice(0, -1);
    }
    if (!guideNameForFileName) guideNameForFileName = "GUIDE";

    let fileNumberForFileName = (reportData.fileNumber || "filenumber");
    fileNumberForFileName = fileNumberForFileName.replace(/[/:*?"<>|\s\\]/g, '_').replace(/__+/g, '_').trim();
    if (fileNumberForFileName.endsWith("_")) {
        fileNumberForFileName = fileNumberForFileName.slice(0, -1);
    }
    if (!fileNumberForFileName) fileNumberForFileName = "filenumber";

    // 1. Assemble the base filename (everything before .xlsx)
    let baseFileName = `G.O. ${startDateForFileName} - ${groupNameForFileName} - ${guideNameForFileName} - ${fileNumberForFileName}`;

    // 2. Remove any trailing underscores from this assembled base name
    while (baseFileName.endsWith("_") || baseFileName.endsWith(" ") || baseFileName.endsWith("-")) {
      baseFileName = baseFileName.slice(0, -1);
    }
    baseFileName = baseFileName.trim(); // Final trim

    // 3. Add the .xlsx extension
    let finalConstructedFileName = baseFileName + ".xlsx";

    // 4. Ensure it ends with .xlsx and not .xlsx_ (this is a very defensive check)
    if (finalConstructedFileName.endsWith(".xlsx_")) {
      finalConstructedFileName = finalConstructedFileName.slice(0, -1); // Remove trailing underscore
    }
    // Ensure it actually ends with .xlsx if somehow it was lost or altered
    if (!finalConstructedFileName.endsWith(".xlsx")) {
      const dotIndex = finalConstructedFileName.lastIndexOf('.');
      if (dotIndex > 0) { // if there is a dot and it's not the first char
        finalConstructedFileName = finalConstructedFileName.substring(0, dotIndex);
      }
      finalConstructedFileName += ".xlsx";
    }
    // --- End Filename Construction and Sanitization ---


    // For filename="..."; replace double quotes, which are problematic in unencoded form
    // IMPORTANT: Base this on the *final, cleaned* finalConstructedFileName
    let legacyFilenamePart = finalConstructedFileName.replace(/"/g, "'");
    // Explicitly ensure this part doesn't end with .xlsx_ if somehow it got re-introduced
    if (legacyFilenamePart.endsWith(".xlsx_")) {
        legacyFilenamePart = legacyFilenamePart.slice(0, -1);
    }


    // For filename*=UTF-8''... ; RFC5987 encode.
    // Base this on the *final, cleaned* finalConstructedFileName
    const rfc5987EncodedFilename = encodeURIComponent(finalConstructedFileName)
                                      .replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()) // More robustly escape ' ( )
                                      .replace(/\*/g, '%2A');   // Escape *

    const pythonScriptPath = path.resolve(process.cwd(), 'excel_generator_cli.py');
    
    try {
        await fs.access(pythonScriptPath, fs.constants.F_OK);
    } catch (err) {
        return NextResponse.json({ error: 'Excel generation script not found on server.', details: `Script expected at ${pythonScriptPath}` }, { status: 500 });
    }

    return new Promise((resolve) => {
      const tryPythonCommand = (command: 'python3' | 'python') => {
        const pythonProcess = spawn(command, [pythonScriptPath, tempOutputXlsxPath]);
        
        let scriptOutput = '';
        let scriptError = '';

        try {
            const jsonDataString = JSON.stringify(reportData);
            pythonProcess.stdin.write(jsonDataString);
            pythonProcess.stdin.end();
        } catch (stdinError) {
            resolve(NextResponse.json({ error: 'Server failed to send data to Excel generation script.', details: (stdinError as Error).message }, { status: 500 }));
            return;
        }

        pythonProcess.stdout.on('data', (data) => {
          scriptOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          scriptError += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          if (code === 0) {
            try {
              await fs.access(tempOutputXlsxPath, fs.constants.F_OK);
              const fileBuffer = await fs.readFile(tempOutputXlsxPath);
              
              const headers = new Headers();
              headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              headers.set('Content-Disposition', `attachment; filename="${legacyFilenamePart}"; filename*=UTF-8''${rfc5987EncodedFilename}`);
              
              resolve(new NextResponse(fileBuffer, { status: 200, headers }));
            } catch (err) {
              const fileReadError = err as Error;
              resolve(NextResponse.json({ error: 'Failed to read generated Excel file.', details: `Error accessing ${tempOutputXlsxPath}: ${fileReadError.message}` }, { status: 500 }));
            }
          } else {
            const commonErrorMsg = `Python script exited with code ${code}.`;
            let detailedError = (scriptError || scriptOutput || "No specific error message from script.").trim();
            if (!detailedError) { 
              detailedError = "Python script finished with an error, but provided no specific output.";
            }
            resolve(NextResponse.json({ 
              error: 'Excel generation failed via Python script.', 
              details: detailedError,
              output: scriptOutput.trim(), 
              exitCode: code, 
              commandUsed: command 
            }, { status: 500 }));
          }
        });

        pythonProcess.on('error', (err) => { 
           const spawnErrorMsg = `Failed to start Python script with command '${command}'.`;
           const spawnErrDetails = (err as NodeJS.ErrnoException).code === 'ENOENT' ? `${err.message}. Ensure Python is installed and in PATH.` : err.message;
           
           if (command === 'python3') {
              tryPythonCommand('python');
           } else {
            resolve(NextResponse.json({ 
              error: 'Failed to start Excel generation process.', 
              details: `${spawnErrorMsg} ${spawnErrDetails}. This often means Python is not installed or not in the system's PATH.`
            }, { status: 500 }));
           }
        });
      };
      
      tryPythonCommand('python3'); 
    });

  } catch (error) {
    const apiError = error as Error;
    return NextResponse.json({ error: 'An unexpected error occurred in the API handler.', details: apiError.message }, { status: 500 });
  } finally {
    if (tempOutputXlsxPath) {
       fs.access(tempOutputXlsxPath)
        .then(() => fs.unlink(tempOutputXlsxPath))
        .catch(err => {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') { 
            }
        });
    }
  }
}

export const dynamic = 'force-dynamic';
    
