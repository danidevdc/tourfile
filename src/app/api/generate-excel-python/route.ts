import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: Request) {
  try {
    const reportData = await request.json();

    // Use a temporary directory for input and output files
    const tempDir = os.tmpdir();
    const uniqueId = `report_${Date.now()}`;
    const inputJsonPath = path.join(tempDir, `${uniqueId}_input.json`);
    const outputXlsxPath = path.join(tempDir, `${uniqueId}_output.xlsx`);
    
    // Write the report data to a temporary JSON file
    await fs.promises.writeFile(inputJsonPath, JSON.stringify(reportData));

    // Define the path to the Python script.
    // In Firebase App Hosting, the CWD is /workspace, so we resolve from there.
    const scriptPath = path.resolve(process.cwd(), 'excel_generator_cli.py');

    const pythonProcess = spawn('python3', [scriptPath, inputJsonPath, outputXlsxPath]);

    let stderr = '';
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Promise to wait for the python process to finish
    const executionPromise = new Promise<void>((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Construct a detailed error message from Python's stderr
          const error = new Error(`Python script exited with code ${code}. Error: ${stderr}`);
          console.error(error); // Log the full error on the server
          reject(error);
        }
      });
      pythonProcess.on('error', (err) => {
        const error = new Error(`Failed to start Python process: ${err.message}`);
        console.error(error);
        reject(error);
      });
    });

    await executionPromise;

    // Read the generated Excel file from the temporary path
    const fileBuffer = await fs.promises.readFile(outputXlsxPath);

    // Clean up temporary files
    await fs.promises.unlink(inputJsonPath);
    await fs.promises.unlink(outputXlsxPath);

    // Construct a safe filename for the download
    const safeGroupName = (reportData.groupName || 'grupo').replace(/[^\w.-]/g, '_');
    const safeGuideName = (reportData.guideName || 'guia').replace(/[^\w.-]/g, '_');
    const safeFileNumber = (reportData.fileNumber || 'file').replace(/[^\w.-]/g, '_');
    const finalConstructedFileName = `G.O. ${reportData.startDate || ''} - ${safeGroupName} - ${safeGuideName} - ${safeFileNumber}.xlsx`;
    
    // Return the Excel file as a downloadable attachment
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${finalConstructedFileName}"`,
      },
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    // Return a structured JSON error response
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
