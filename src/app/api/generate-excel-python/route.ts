
// src/app/api/generate-excel-python/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GeneratedReportInfo } from '@/app/generator/page';

export async function POST(request: NextRequest) {
  let outputXlsxPath = '';

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
    outputXlsxPath = path.join(tempDir, `report_output_${uniqueId}.xlsx`);
    
    // Sanitize individual filename components
    const startDateForFileName = (reportData.startDate || new Date().toISOString().split('T')[0]).replace(/\//g, '.');
    
    let sanitizedGroupName = reportData.groupName || "report";
    sanitizedGroupName = sanitizedGroupName.replace(/#/g, ' '); // Replace # with space
    const groupCharsToReplace = ['/', ':', '\\*', '\\?', '\\[', '\\]', '\\(', '\\)'];
    groupCharsToReplace.forEach(char => {
        const regex = new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        sanitizedGroupName = sanitizedGroupName.replace(regex, '_');
    });
    sanitizedGroupName = sanitizedGroupName.replace(/\s+/g, ' ').replace(/__+/g, '_').trim();
    while (sanitizedGroupName.endsWith("_")) {
        sanitizedGroupName = sanitizedGroupName.slice(0, -1);
    }
    if (!sanitizedGroupName) sanitizedGroupName = "report";

    let sanitizedGuideName = (reportData.guideName || "GUIDE").toUpperCase().replace(/\s+/g, '_').replace(/__+/g, '_').trim();
    while (sanitizedGuideName.endsWith("_")) {
        sanitizedGuideName = sanitizedGuideName.slice(0, -1);
    }
    if (!sanitizedGuideName) sanitizedGuideName = "GUIDE";

    let cleanFileNumber = (reportData.fileNumber || "filenumber").replace(/[^a-zA-Z0-9-]/g, '_').replace(/__+/g, '_').trim();
    while (cleanFileNumber.endsWith("_")) {
        cleanFileNumber = cleanFileNumber.slice(0, -1);
    }
    if (!cleanFileNumber) cleanFileNumber = "filenumber";

    // 1. Assemble the base filename (everything before .xlsx)
    let baseFileName = `G.O. ${startDateForFileName} - ${sanitizedGroupName} - ${sanitizedGuideName} - ${cleanFileNumber}`;

    // 2. Remove any trailing underscores from this assembled base name
    while (baseFileName.endsWith("_")) {
      baseFileName = baseFileName.slice(0, -1);
    }
    
    // 3. Add the .xlsx extension
    const finalConstructedFileName = baseFileName + ".xlsx";

    // Prepare filename parts for Content-Disposition
    // For filename="..."; replace double quotes, which are problematic in unencoded form
    const legacyFilenamePart = finalConstructedFileName.replace(/"/g, "'");

    // For filename*=UTF-8''... ; RFC5987 encode.
    // encodeURIComponent handles most characters. Then replace specific ones not covered by it but problematic in headers.
    const rfc5987EncodedFilename = encodeURIComponent(finalConstructedFileName)
                                      .replace(/['()]/g, escape) // Escape ' ( )
                                      .replace(/\*/g, '%2A');   // Escape *

    const pythonScriptPath = path.resolve(process.cwd(), 'excel_generator_cli.py');
    
    try {
        await fs.access(pythonScriptPath, fs.constants.F_OK);
    } catch (err) {
        const errorPayload = { error: 'Excel generation script not found on server.', details: `Script expected at ${pythonScriptPath}` };
        return NextResponse.json(errorPayload, { status: 500 });
    }

    return new Promise((resolve) => {
      const tryPythonCommand = (command: 'python3' | 'python') => {
        const pythonProcess = spawn(command, [pythonScriptPath, outputXlsxPath]);
        
        let scriptOutput = '';
        let scriptError = '';

        try {
            const jsonDataString = JSON.stringify(reportData);
            pythonProcess.stdin.write(jsonDataString);
            pythonProcess.stdin.end();
        } catch (stdinError) {
            const errorPayload = { error: 'Server failed to send data to Excel generation script.', details: (stdinError as Error).message };
            resolve(NextResponse.json(errorPayload, { status: 500 }));
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
              await fs.access(outputXlsxPath, fs.constants.F_OK);
              const fileBuffer = await fs.readFile(outputXlsxPath);
              
              const headers = new Headers();
              headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              // Correctly formatted Content-Disposition with both filename and filename*
              headers.set('Content-Disposition', `attachment; filename="${legacyFilenamePart}"; filename*=UTF-8''${rfc5987EncodedFilename}`);
              
              resolve(new NextResponse(fileBuffer, { status: 200, headers }));
            } catch (err) {
              const fileReadError = err as Error;
              const errorPayload = { error: 'Failed to read generated Excel file.', details: `Error accessing ${outputXlsxPath}: ${fileReadError.message}` };
              resolve(NextResponse.json(errorPayload, { status: 500 }));
            }
          } else {
            const commonErrorMsg = `Python script exited with code ${code}.`;
            let detailedError = (scriptError || scriptOutput || "No specific error message from script.").trim();
            if (!detailedError) { 
              detailedError = "Python script finished with an error, but provided no specific output.";
            }
            const errorPayload = { 
              error: 'Excel generation failed via Python script.', 
              details: detailedError,
              output: scriptOutput.trim(), 
              exitCode: code, 
              commandUsed: command 
            };
            resolve(NextResponse.json(errorPayload, { status: 500 }));
          }
        });

        pythonProcess.on('error', (err) => { 
           const spawnErrorMsg = `Failed to start Python script with command '${command}'.`;
           const spawnErrDetails = (err as NodeJS.ErrnoException).code === 'ENOENT' ? `${err.message}. Ensure Python is installed and in PATH.` : err.message;
           
           if (command === 'python3') {
              tryPythonCommand('python');
           } else {
            const errorPayload = { 
              error: 'Failed to start Excel generation process.', 
              details: `${spawnErrorMsg} ${spawnErrDetails}. This often means Python is not installed or not in the system's PATH.`
            };
            resolve(NextResponse.json(errorPayload, { status: 500 }));
           }
        });
      };
      
      tryPythonCommand('python3'); 
    });

  } catch (error) {
    const apiError = error as Error;
    const errorPayload = { error: 'An unexpected error occurred in the API handler.', details: apiError.message };
    return NextResponse.json(errorPayload, { status: 500 });
  } finally {
    if (outputXlsxPath) {
       fs.access(outputXlsxPath)
        .then(() => fs.unlink(outputXlsxPath))
        .catch(err => {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') { 
            }
        });
    }
  }
}

export const dynamic = 'force-dynamic';
    
