const { onRequest } = require("firebase-functions/v2/https");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Función que replica tu lógica actual de src/app/api/generate-excel-python/route.ts
exports.generateExcelPython = onRequest({
  timeoutSeconds: 540,
  memory: "1GiB"
}, async (req, res) => {
  // Configurar CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  console.log("🚀 generateExcelPython function iniciada");
  
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const requestData = req.body;
    console.log("📝 Datos recibidos:", JSON.stringify(requestData, null, 2));

    // Crear archivos temporales
    const tempDir = '/tmp';
    const timestamp = Date.now();
    const inputFile = path.join(tempDir, `data_${timestamp}.json`);
    const outputFile = path.join(tempDir, `output_${timestamp}.xlsx`);

    // Escribir datos al archivo temporal
    fs.writeFileSync(inputFile, JSON.stringify(requestData, null, 2));
    console.log(`📄 Archivo de datos creado: ${inputFile}`);

    // Copiar el script de Python al directorio temporal
    const sourceScript = path.join(__dirname, 'excel_generator_cli.py');
    const tempScript = path.join(tempDir, `excel_generator_${timestamp}.py`);
    
    // Verificar si el script existe
    if (!fs.existsSync(sourceScript)) {
      throw new Error(`Script de Python no encontrado: ${sourceScript}`);
    }
    
    fs.copyFileSync(sourceScript, tempScript);
    console.log(`🐍 Script copiado a: ${tempScript}`);

    // Ejecutar el script de Python
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [tempScript, inputFile, outputFile], {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('Python stdout:', output);
      });

      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log('Python stderr:', error);
      });

      pythonProcess.on('close', (code) => {
        console.log(`🏁 Python process terminado con código: ${code}`);
        
        // Limpiar archivos temporales
        try {
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
        } catch (cleanupError) {
          console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
        }

        if (code === 0) {
          // Éxito - leer el archivo Excel generado
          try {
            if (fs.existsSync(outputFile)) {
              const fileBuffer = fs.readFileSync(outputFile);
              
              // Limpiar archivo de salida
              fs.unlinkSync(outputFile);
              
              // Configurar headers de respuesta
              res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="reporte.xlsx"',
                'Content-Length': fileBuffer.length.toString()
              });
              
              console.log('✅ Enviando archivo Excel generado');
              resolve(res.send(fileBuffer));
            } else {
              reject(res.status(500).json({
                error: 'Archivo Excel no fue generado',
                stdout: stdout,
                stderr: stderr
              }));
            }
          } catch (fileError) {
            console.error('💥 Error leyendo archivo Excel:', fileError);
            reject(res.status(500).json({
              error: 'Error procesando archivo Excel generado',
              details: fileError.message,
              stdout: stdout,
              stderr: stderr
            }));
          }
        } else {
          // Error en el proceso de Python
          console.error('💥 Error en proceso Python:', stderr);
          reject(res.status(500).json({
            error: 'Error ejecutando script Python',
            code: code,
            stdout: stdout,
            stderr: stderr
          }));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('💥 Error spawning Python process:', error);
        
        // Limpiar archivos temporales
        try {
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
        } catch (cleanupError) {
          console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
        }
        
        reject(res.status(500).json({
          error: 'Error iniciando proceso Python',
          details: error.message
        }));
      });
    });

  } catch (error) {
    console.error('💥 Error general en Cloud Function:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});