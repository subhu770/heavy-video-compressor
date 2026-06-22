# Heavy-Duty Video Compressor

A full-stack web application built with Node.js, Express, Socket.io, and `fluent-ffmpeg`. This application takes advantage of your desktop/server CPU to compress large video files quickly using multithreading, avoiding browser limitations.

## Prerequisites

Before running this project, ensure you have **Node.js** and **FFmpeg** installed on your system.

### 1. Install Node.js
If you don't have Node.js installed, download it from the official website: [https://nodejs.org/](https://nodejs.org/)

### 2. FFmpeg Integration
This application uses the `ffmpeg-static` and `ffprobe-static` npm packages. You **do not** need to install FFmpeg natively on your system! The static binaries are automatically downloaded during `npm install` and used directly by the application. This ensures seamless deployment on cloud providers like Render.

## Installation

1. Open a terminal in the project directory.
2. Install all the necessary Node.js dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the Express server:
   ```bash
   node server.js
   ```
2. Open your web browser and navigate to: [http://localhost:3000](http://localhost:3000)

## Usage

1. Drag and drop a video file (up to 1GB) into the upload area or click "Browse Files".
2. Select your desired Compression Level and Target Resolution.
3. Click "Upload & Compress". 
4. The file will securely upload to the local server, and you will see the real-time processing progress powered by Socket.io.
5. Once complete, click "Save Compressed Video" to download the file.
