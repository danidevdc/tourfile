
const { onRequest } = require("firebase-functions/v2/https");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const cors = require("cors")({ origin: true }); // Import and configure CORS

// This is the main Cloud Function that will be triggered by HTTP requests.
exports.generateExcel = onRequest({ memory: "512MiB", timeoutSeconds: 60 }, (req, res) => {
  // First, handle the CORS preflight request.
  // The 'cors' middleware will automatically send the correct headers.
  cors(req, res, () => {
    // After CORS is handled, proceed with the function's logic.
    // We explicitly block non-POST requests after the CORS check.
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const reportData = req.body;
    if (!reportData) {
      return res.status(400).send('Bad Request: Missing report data');
    }

    // Define paths for the Python script and a temporary output file.
    const pythonScriptPath = path.resolve(__dirname, 'excel_generator.py');
    const tempId = `report_${Date.now()}`;
    const tempOutputXlsxPath = path.join(os.tmpdir(), `${tempId}.xlsx`);
    
    // Spawn a new Python process to run the generator script.
    // Pass the temporary output path as an argument.
    const pythonProcess = spawn('python3', [pythonScriptPath, tempOutputXlsxPath]);
    
    let scriptError = '';
    // Listen for any errors from the Python script.
    pythonProcess.stderr.on('data', (data) => {
      scriptError += data.toString();
    });

    // Handle the process closing.
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script error (code ${code}): ${scriptError}`);
        // Send a detailed error message back to the client.
        return res.status(500).send(`Python script failed with exit code ${code}: ${scriptError}`);
      }
      
      // If the script runs successfully, read the generated Excel file.
      fs.readFile(tempOutputXlsxPath, (err, fileBuffer) => {
        if (err) {
          console.error('Error reading the generated file:', err);
          return res.status(500).send('Could not read generated Excel file.');
        }

        // Sanitize parts of the filename to ensure they are valid.
        const safeGroupName = (reportData.groupName || 'grupo').replace(/[^\w.-]/g, '_');
        const safeGuideName = (reportData.guideName || 'guia').replace(/[^\w.-]/g, '_');
        const safeFileNumber = (reportData.fileNumber || 'file').replace(/[^\w.-]/g, '_');
        const finalConstructedFileName = `G.O. ${reportData.startDate || ''} - ${safeGroupName} - ${safeGuideName} - ${safeFileNumber}.xlsx`;

        // Set the correct headers for a file download response.
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.set('Content-Disposition', `attachment; filename="${finalConstructedFileName}"`);
        
        // Send the file buffer as the response.
        res.status(200).send(fileBuffer);
        
        // Clean up by deleting the temporary file.
        fs.unlink(tempOutputXlsxPath, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting temp file", unlinkErr);
        });
      });
    });

    // Handle errors in starting the Python process itself.
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      return res.status(500).send('Failed to start Python process.');
    });
    
    // Write the report data to the Python process's standard input and end it.
    pythonProcess.stdin.write(JSON.stringify(reportData));
    pythonProcess.stdin.end();
  });
});
