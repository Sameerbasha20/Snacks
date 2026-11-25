// Local server: the API plus the built website on one port.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config, ROOT } from './config.js';
import app from './app.js';

const dist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`\nSnack Shack running on http://localhost:${config.port}`);
  console.log(`Phones on the same Wi-Fi can open: http://${config.publicUrl.replace(/^https?:\/\//, '')}\n`);
});
