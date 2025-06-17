
// src/app/api/generate-excel-python/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GeneratedReportInfo } from '@/app/generator/page'; // Adjust path as necessary

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const chunks = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }
  return chunks.join('');
}


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
    
    // Sanitize group name for file naming
    let sanitizedGroupName = reportData.groupName || "report";
    const charsToReplace = ['/', ':', '\\*', '\\?', '\\[', '\\]', '\\s', '\\(', '\\)'];
    charsToReplace.forEach(char => {
        const regex = new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); // Escape regex special chars
        sanitizedGroupName = sanitizedGroupName.replace(regex, '_');
    });
    sanitizedGroupName = sanitizedGroupName.replace(/__+/g, '_');

    const startDateForFileName = reportData.startDate ? reportData.startDate.replace(/\//g, '.') : new Date().toISOString().split('T')[0];
    const fileName = `G.O. ${startDateForFileName} - ${sanitizedGroupName} - ${reportData.guideName.toUpperCase().replace(/\s/g, '_')} - ${reportData.fileNumber}.xlsx`;


    await fs.writeFile(inputJsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

    // Determine the path to the Python script.
    // This assumes the script is at the root of your project when deployed.
    // You might need to adjust this path based on your project structure and deployment.
    const pythonScriptPath = path.resolve(process.cwd(), 'excel_generator_cli.py');
    
    // Check if python script exists
    try {
        await fs.access(pythonScriptPath, fs.constants.F_OK);
    } catch (err) {
        console.error('Python script not found at:', pythonScriptPath);
        return NextResponse.json({ error: 'Excel generation script not found on server.' }, { status: 500 });
    }


    return new Promise((resolve, reject) => {
      // Try 'python3' first, then 'python'
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
              reject(NextResponse.json({ error: 'Failed to read generated Excel file.', details: (err as Error).message }, { status: 500 }));
            }
          } else {
            if (command === 'python3' && (scriptError.includes('command not found') || scriptError.includes('not recognized'))) {
              // If python3 failed with "command not found", try "python"
              console.warn("python3 not found, trying with 'python'");
              tryPythonCommand('python');
            } else {
              console.error(`Python script error (command: ${command}): ${scriptError}`);
              console.error(`Python script output (command: ${command}): ${scriptOutput}`);
              reject(NextResponse.json({ error: 'Excel generation failed.', details: scriptError || 'Unknown Python script error', output: scriptOutput }, { status: 500 }));
            }
          }
        });

        pythonProcess.on('error', (err) => {
           if (command === 'python3') {
              console.warn(`Error spawning python3 (command: ${command}): ${err.message}. Trying with 'python'.`);
              tryPythonCommand('python');
           } else {
            console.error(`Failed to start Python script (command: ${command}):`, err);
            reject(NextResponse.json({ error: 'Failed to start Excel generation process.', details: err.message }, { status: 500 }));
           }
        });
      };
      
      tryPythonCommand('python3'); // Start with python3
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: (error as Error).message }, { status: 500 });
  } finally {
    // Clean up temporary files
    if (inputJsonPath) {
      fs.unlink(inputJsonPath).catch(err => console.error('Error deleting temp input JSON file:', err));
    }
    if (outputXlsxPath) {
      // Do not delete outputXlsxPath immediately if there was an error during Python script execution,
      // as it might be useful for debugging. However, successful reads should delete it.
      // For simplicity here, we might want to delete it always or handle more granularly.
      // For now, ensure it's deleted if read successfully or if an error occurs before read.
      // The Python script might also fail to produce it.
       fs.access(outputXlsxPath)
        .then(() => fs.unlink(outputXlsxPath))
        .catch(err => {
            if (err.code !== 'ENOENT') { // ENOENT means file doesn't exist, which is fine if script failed to create it
                 console.error('Error deleting temp output XLSX file:', err)
            }
        });
    }
  }
}

export const dynamic = 'force-dynamic'; // Ensure fresh execution

    