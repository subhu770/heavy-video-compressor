const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());

// Ensure directories exist
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'output')));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Acknowledge connection and send back socket.id
  socket.emit('connected', { id: socket.id });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.post('/compress', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const { socketId, targetSize, resolution, duration } = req.body;
  
  const inputPath = req.file.path;
  const outputFileName = `compressed-${req.file.filename}`;
  const outputPath = path.join(outputDir, outputFileName);

  if (!duration || isNaN(parseFloat(duration))) {
    console.error('Duration not provided or invalid');
    if (socketId) {
      io.to(socketId).emit('error', { message: 'Could not determine video duration from frontend' });
    }
    if (!res.headersSent) {
      res.status(400).json({ error: 'Duration not provided or invalid' });
    }
    fs.unlink(inputPath, () => {});
    return;
  }

  // targetSize is in MB. Calculate total kbps.
  // 1 MB = 8192 kilobits
  const targetMb = parseFloat(targetSize);
  const durSecs = parseFloat(duration);
  
  let videoBitrate = Math.floor((targetMb * 8192) / durSecs) - 128; // assuming 128k audio
  
  // Ensure minimum bitrate to avoid extremely poor quality or ffmpeg errors
  if (videoBitrate < 100) {
    videoBitrate = 100;
  }

  const command = ffmpeg(inputPath);
  
  // Advanced options to utilize multi-core and set bitrate
  command.outputOptions([
    '-vcodec libx264',
    `-b:v ${videoBitrate}k`,
    '-preset ultrafast',
    '-threads 0' // Utilize optimal number of threads based on CPU
  ]);

  if (resolution && resolution !== 'original') {
    const [width, height] = resolution.split('x');
    command.outputOptions([
      `-vf scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease`
    ]);
  }

  command
    .on('start', (commandLine) => {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
      if (socketId) {
        io.to(socketId).emit('progress', { percent: 0 });
      }
    })
    .on('progress', (progress) => {
      if (socketId && progress.percent !== undefined) {
        let percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
        io.to(socketId).emit('progress', { percent });
      }
    })
    .on('end', () => {
      console.log('Processing finished successfully');
      
      const oldSize = fs.statSync(inputPath).size;
      const newSize = fs.statSync(outputPath).size;
      
      if (socketId) {
        io.to(socketId).emit('complete', { 
          downloadUrl: `/output/${outputFileName}`,
          oldSize,
          newSize
        });
      }
      
      // Clean up input file after processing
      fs.unlink(inputPath, (err) => {
        if (err) console.error('Error deleting input file:', err);
      });
      
      if (!res.headersSent) {
        res.json({ success: true });
      }
    })
    .on('error', (err, stdout, stderr) => {
      console.error('Cannot process video: ' + err.message);
      if (socketId) {
        io.to(socketId).emit('error', { message: err.message });
      }
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
      
      // Cleanup on error
      fs.unlink(inputPath, () => {});
    })
    .save(outputPath);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
