
// src/app/api/generate-excel-python/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GeneratedReportInfo } from '@/app/generator/page'; // Adjust path as necessary

export async function POST(request: NextRequest) {
  let inputJsonPath = '';
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
    inputJsonPath = path.join(tempDir, `report_data_${uniqueId}.json`);
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

    await fs.writeFile(inputJsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

    const pythonScriptPath = path.resolve(process.cwd(), 'excel_generator_cli.py');
    
    try {
        await fs.access(pythonScriptPath, fs.constants.F_OK);
    } catch (err) {
        console.error('Python script not found at:', pythonScriptPath);
        return NextResponse.json({ error: 'Excel generation script not found on server.', details: `Script expected at ${pythonScriptPath}` }, { status: 500 });
    }

    return new Promise((resolve) => { // Removed reject, will resolve with NextResponse directly
      const tryPythonCommand = (command: 'python3' | 'python') => {
        const pythonProcess = spawn(command, [pythonScriptPath, inputJsonPath, outputXlsxPath]);
        let scriptOutput = '';
        let scriptError = '';

        pythonProcess.stdout.on('data', (data) => {
          scriptOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          scriptError += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          if (code === 0) {
            try {
              const fileBuffer = await fs.readFile(outputXlsxPath);
              const headers = new Headers();
              headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
              
              resolve(new NextResponse(fileBuffer, { status: 200, headers }));
            } catch (err) {
              console.error('Error reading generated Excel file:', err);
              resolve(NextResponse.json({ error: 'Failed to read generated Excel file.', details: (err as Error).message }, { status: 500 }));
            }
          } else {
            const commonErrorMsg = `Python script exited with code ${code}.`;
            const detailedError = scriptError || scriptOutput || "No specific error message from script.";
            console.error(`${commonErrorMsg} Command: ${command}. Error: ${detailedError}`);

            if (command === 'python3' && (scriptError.includes('command not found') || scriptError.includes('not recognized') || scriptError.includes('No such file or directory'))) {
              console.warn("python3 not found or script path issue, trying with 'python'");
              tryPythonCommand('python');
            } else {
              resolve(NextResponse.json({ error: 'Excel generation failed via Python script.', details: detailedError, output: scriptOutput, exitCode: code, commandUsed: command }, { status: 500 }));
            }
          }
        });

        pythonProcess.on('error', (err) => { // This is for spawn errors (e.g., command not found)
           const spawnErrorMsg = `Failed to start Python script with command '${command}'.`;
           console.error(`${spawnErrorMsg} Error: ${err.message}`);
           if (command === 'python3') {
              console.warn("Attempting fallback to 'python' command.");
              tryPythonCommand('python');
           } else {
            // If 'python' also fails, then resolve with the error
            resolve(NextResponse.json({ error: 'Failed to start Excel generation process.', details: `${spawnErrorMsg} ${err.message}. Ensure Python is installed and in PATH.` }, { status: 500 }));
           }
        });
      };
      
      tryPythonCommand('python3'); // Start with python3
    });

  } catch (error) {
    console.error('API Error in POST /api/generate-excel-python:', error);
    return NextResponse.json({ error: 'An unexpected error occurred in the API handler.', details: (error as Error).message }, { status: 500 });
  } finally {
    // Clean up temporary files
    if (inputJsonPath) {
      fs.unlink(inputJsonPath).catch(err => console.warn('Error deleting temp input JSON file:', err.message));
    }
    if (outputXlsxPath) {
       fs.access(outputXlsxPath)
        .then(() => fs.unlink(outputXlsxPath))
        .catch(err => {
            if (err.code !== 'ENOENT') { 
                 console.warn('Error deleting temp output XLSX file:', err.message);
            }
        });
    }
  }
}

export const dynamic = 'force-dynamic';
    