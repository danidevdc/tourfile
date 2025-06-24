
const { onRequest } = require("firebase-functions/v2/https");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

exports.generateExcel = onRequest({ memory: "512MiB", timeoutSeconds: 60 }, (req, res) => {
  // Set CORS headers for all responses to allow requests from any origin.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight (OPTIONS) requests, which browsers send before the actual POST.
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const reportData = req.body;
  if (!reportData) {
    return res.status(400).send('Bad Request: Missing report data');
  }

  const pythonScriptPath = path.resolve(__dirname, 'excel_generator.py');
  const tempId = `report_${Date.now()}`;
  const tempOutputXlsxPath = path.join(os.tmpdir(), `${tempId}.xlsx`);
  
  const pythonProcess = spawn('python3', [pythonScriptPath, tempOutputXlsxPath]);
  
  let scriptError = '';
  pythonProcess.stderr.on('data', (data) => {
    scriptError += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script error (code ${code}): ${scriptError}`);
      return res.status(500).send(`Python script failed with exit code ${code}: ${scriptError}`);
    }
    
    fs.readFile(tempOutputXlsxPath, (err, fileBuffer) => {
      if (err) {
        console.error('Error reading the generated file:', err);
        return res.status(500).send('Could not read generated Excel file.');
      }

      const safeGroupName = (reportData.groupName || 'grupo').replace(/[^\w.-]/g, '_');
      const safeGuideName = (reportData.guideName || 'guia').replace(/[^\w.-]/g, '_');
      const safeFileNumber = (reportData.fileNumber || 'file').replace(/[^\w.-]/g, '_');
      const finalConstructedFileName = `G.O. ${reportData.startDate || ''} - ${safeGroupName} - ${safeGuideName} - ${safeFileNumber}.xlsx`;

      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', `attachment; filename="${finalConstructedFileName}"`);
      res.status(200).send(fileBuffer);
      
      fs.unlink(tempOutputXlsxPath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temp file", unlinkErr);
      });
    });
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python process:', err);
    return res.status(500).send('Failed to start Python process.');
  });
  
  pythonProcess.stdin.write(JSON.stringify(reportData));
  pythonProcess.stdin.end();
});
