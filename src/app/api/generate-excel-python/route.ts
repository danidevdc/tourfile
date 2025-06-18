
// src/app/api/generate-excel-python/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GeneratedReportInfo } from '@/app/generator/page';

export async function POST(request: NextRequest) {
  let outputXlsxPath = ''; // Input JSON path is no longer needed

  try {
    if (!request.body) {
      console.error('[API] Error: Request body is missing');
      return NextResponse.json({ error: 'Request body is missing' }, { status: 400 });
    }
    const reportData = await request.json() as GeneratedReportInfo;

    if (!reportData || typeof reportData !== 'object') {
        console.error('[API] Error: Invalid report data received:', reportData);
        return NextResponse.json({ error: 'Invalid report data' }, { status: 400 });
    }
    
    const uniqueId = Date.now() + Math.random().toString(36).substring(2, 9);
    const tempDir = os.tmpdir();
    // inputJsonPath is removed
    outputXlsxPath = path.join(tempDir, `report_output_${uniqueId}.xlsx`);
    
    let sanitizedGroupName = reportData.groupName || "report";
    const charsToReplace = ['/', ':', '\\*', '\\?', '\\[', '\\]', '\\s', '\\(', '\\)'];
    charsToReplace.forEach(char => {
        const regex = new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        sanitizedGroupName = sanitizedGroupName.replace(regex, '_');
    });
    sanitizedGroupName = sanitizedGroupName.replace(/__+/g, '_');

    const startDateForFileName = reportData.startDate ? reportData.startDate.replace(/\//g, '.') : new Date().toISOString().split('T')[0];
    const fileName = `G.O. ${startDateForFileName} - ${sanitizedGroupName} - ${reportData.guideName.toUpperCase().replace(/\s/g, '_')} - ${reportData.fileNumber}.xlsx`;

    // The input JSON file writing is removed. Data will be passed via stdin.

    const pythonScriptPath = path.resolve(process.cwd(), 'excel_generator_cli.py');
    
    try {
        await fs.access(pythonScriptPath, fs.constants.F_OK);
        console.log(`[API] Python script found at: ${pythonScriptPath}`);
    } catch (err) {
        console.error('[API] CRITICAL: Python script not found at:', pythonScriptPath, err);
        const errorPayload = { error: 'Excel generation script not found on server.', details: `Script expected at ${pythonScriptPath}` };
        console.error("[API] Error Response (Server-side):", JSON.stringify(errorPayload));
        return NextResponse.json(errorPayload, { status: 500 });
    }

    return new Promise((resolve) => {
      const tryPythonCommand = (command: 'python3' | 'python') => {
        // Python script now only takes outputXlsxPath as argument
        console.log(`[API] Attempting to spawn Python script with command: ${command} ${pythonScriptPath} ${outputXlsxPath}`);
        const pythonProcess = spawn(command, [pythonScriptPath, outputXlsxPath]);
        
        let scriptOutput = '';
        let scriptError = '';

        // Write reportData to Python script's stdin
        try {
            const jsonDataString = JSON.stringify(reportData);
            pythonProcess.stdin.write(jsonDataString);
            pythonProcess.stdin.end(); // Close stdin to signal end of input
            console.log("[API] Successfully wrote data to Python script stdin.");
        } catch (stdinError) {
            console.error("[API] CRITICAL: Failed to write data to Python script stdin:", stdinError);
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
          console.log(`[API] Python script (${command}) finished with exit code ${code}.`);
          if (scriptOutput) console.log(`[API] Python script stdout: ${scriptOutput}`);
          if (scriptError) console.error(`[API] Python script stderr: ${scriptError}`);

          if (code === 0) {
            try {
              await fs.access(outputXlsxPath, fs.constants.F_OK); // Check if output file exists
              const fileBuffer = await fs.readFile(outputXlsxPath);
              const headers = new Headers();
              headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
              
              console.log(`[API] Successfully generated Excel. Sending file: ${fileName}`);
              resolve(new NextResponse(fileBuffer, { status: 200, headers }));
            } catch (err) {
              const fileReadError = err as Error;
              console.error('[API] Error reading or accessing generated Excel file:', fileReadError.message, fileReadError.stack);
              const errorPayload = { error: 'Failed to read generated Excel file.', details: `Error accessing ${outputXlsxPath}: ${fileReadError.message}` };
              console.error("[API] Error Response (Server-side):", JSON.stringify(errorPayload));
              resolve(NextResponse.json(errorPayload, { status: 500 }));
            }
          } else {
            const commonErrorMsg = `Python script exited with code ${code}.`;
            let detailedError = (scriptError || scriptOutput || "No specific error message from script.").trim();
            if (!detailedError) { 
              detailedError = "Python script finished with an error, but provided no specific output.";
            }
            
            console.error(`[API] Server-side: ${commonErrorMsg} Command: ${command}. Full Error Details: ${detailedError}. Script Output (if any): ${scriptOutput}`);
            
            const errorPayload = { 
              error: 'Excel generation failed via Python script.', 
              details: detailedError,
              output: scriptOutput.trim(), 
              exitCode: code, 
              commandUsed: command 
            };
            console.error("[API] Error Response (Server-side):", JSON.stringify(errorPayload));
            resolve(NextResponse.json(errorPayload, { status: 500 }));
          }
        });

        pythonProcess.on('error', (err) => { 
           const spawnErrorMsg = `Failed to start Python script with command '${command}'.`;
           const spawnErrDetails = (err as NodeJS.ErrnoException).code === 'ENOENT' ? `${err.message}. Ensure Python is installed and in PATH.` : err.message;
           console.error(`[API] Server-side: ${spawnErrorMsg} Error: ${spawnErrDetails}`, err);
           
           if (command === 'python3') {
              console.warn("[API] Python3 command failed, attempting fallback to 'python' command.");
              tryPythonCommand('python');
           } else {
            const errorPayload = { 
              error: 'Failed to start Excel generation process.', 
              details: `${spawnErrorMsg} ${spawnErrDetails}. This often means Python is not installed or not in the system's PATH.`
            };
            console.error("[API] Error Response (Server-side):", JSON.stringify(errorPayload));
            resolve(NextResponse.json(errorPayload, { status: 500 }));
           }
        });
      };
      
      tryPythonCommand('python3'); 
    });

  } catch (error) {
    const apiError = error as Error;
    console.error('[API] CRITICAL: Unhandled error in POST /api/generate-excel-python:', apiError.message, apiError.stack);
    const errorPayload = { error: 'An unexpected error occurred in the API handler.', details: apiError.message };
    console.error("[API] Error Response (Server-side):", JSON.stringify(errorPayload));
    return NextResponse.json(errorPayload, { status: 500 });
  } finally {
    // No inputJsonPath to delete
    if (outputXlsxPath) {
       fs.access(outputXlsxPath)
        .then(() => fs.unlink(outputXlsxPath).then(() => console.log(`[API] Deleted temp output XLSX: ${outputXlsxPath}`)))
        .catch(err => {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') { 
                 console.warn('[API] Error deleting temp output XLSX file:', (err as Error).message);
            }
        });
    }
  }
}

export const dynamic = 'force-dynamic';
    

    