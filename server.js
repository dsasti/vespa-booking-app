try { require('dotenv').config(); } catch(e) {}
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_FILE = path.join(__dirname, 'dati_prenotazioni.json');
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

let lastGlobalChangeTimestamp = Date.now();
function notifyDataChange() {
  lastGlobalChangeTimestamp = Date.now();
}

const MONGO_URI = process.env.MONGO_URI;
let mongoose = null;
let RegistrationModel = null;
let isMongoConnected = false;

// Tentativo connessione a MongoDB Atlas se MONGO_URI è definita
if (MONGO_URI) {
  try {
    mongoose = require('mongoose');
    const RegistrationSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      data: { type: Object, required: true },
      updatedAt: { type: Date, default: Date.now }
    });
    RegistrationModel = mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);

    mongoose.connect(MONGO_URI)
      .then(() => {
        isMongoConnected = true;
        console.log("✅ Connesso con successo a MongoDB Atlas (Cloud DB)!");
      })
      .catch(err => {
        console.error("⚠️ Errore connessione MongoDB Atlas, fallback su file locale:", err.message);
      });
  } catch (err) {
    console.warn("⚠️ Pacchetto mongoose non trovato o errore inizializzazione, uso file locale:", err.message);
  }
} else {
  console.log("ℹ️ MONGO_URI non impostata: operatività su file locale dati_prenotazioni.json");
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml'
};

async function readDataAsync() {
  if (isMongoConnected && RegistrationModel) {
    try {
      const docs = await RegistrationModel.find({});
      return docs.map(d => d.data);
    } catch (e) {
      console.error("Errore lettura MongoDB:", e.message);
    }
  }
  // Fallback locale JSON
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error("Errore lettura file dati:", e);
  }
  return [];
}

async function saveRecordAsync(record) {
  notifyDataChange();
  if (isMongoConnected && RegistrationModel) {
    try {
      await RegistrationModel.findOneAndUpdate(
        { id: record.id },
        { id: record.id, data: record, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error("Errore salvataggio MongoDB:", e.message);
    }
  }
  // Mantieni sincronizzato anche il file locale come backup di sicurezza
  try {
    const list = readDataSync();
    const idx = list.findIndex(r => r.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    saveDataSync(list);
  } catch(e) {}
}

async function saveBatchAsync(list) {
  notifyDataChange();
  if (isMongoConnected && RegistrationModel) {
    try {
      await RegistrationModel.deleteMany({});
      if (Array.isArray(list) && list.length > 0) {
        const docs = list.map(item => ({ id: item.id, data: item, updatedAt: new Date() }));
        await RegistrationModel.insertMany(docs);
      }
    } catch (e) {
      console.error("Errore batch MongoDB:", e.message);
    }
  }
  saveDataSync(list);
}

async function deleteRecordAsync(id) {
  if (isMongoConnected && RegistrationModel) {
    try {
      await RegistrationModel.deleteOne({ id: new RegExp('^' + id + '$', 'i') });
    } catch (e) {
      console.error("Errore cancellazione MongoDB:", e.message);
    }
  }
  const list = readDataSync().filter(r => r.id.toUpperCase() !== id.toUpperCase());
  saveDataSync(list);
}

async function wipeDatabaseAsync() {
  if (isMongoConnected && RegistrationModel) {
    try {
      await RegistrationModel.deleteMany({});
    } catch (e) {
      console.error("Errore svuotamento MongoDB:", e.message);
    }
  }
  saveDataSync([]);
}

function readDataSync() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error("Errore lettura sync file dati:", e);
  }
  return [];
}

function saveDataSync(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Errore scrittura file dati:", e);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Endpoint Keep-Alive per azzerare i tempi di sleep di Render
  if (pathname === '/api/ping' || pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'active',
      timestamp: new Date().toISOString(),
      database: isMongoConnected ? 'mongodb_atlas' : 'local_json',
      uptime: Math.round(process.uptime()),
      lastChange: lastGlobalChangeTimestamp
    }));
    return;
  }

  // Endpoint di sincronizzazione rapida / pulse per aggiornamento istantaneo
  if (pathname === '/api/pulse') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      lastChange: lastGlobalChangeTimestamp,
      timestamp: Date.now()
    }));
    return;
  }

  // API REST Endpoints
  if (pathname === '/api/registrations') {
    if (req.method === 'GET') {
      const data = await readDataAsync();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const record = JSON.parse(body);
          await saveRecordAsync(record);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, record }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      await wipeDatabaseAsync();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Database azzerato' }));
      return;
    }
  }

  // Ripristino/batch import massivo via API (/api/registrations/batch-restore)
  if (pathname === '/api/registrations/batch-restore' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const list = JSON.parse(body);
        if (Array.isArray(list)) {
          await saveBatchAsync(list);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: list.length }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Formato lista non valido' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Gestione Backups Salvi / Ripristino (/api/backups)
  if (pathname === '/api/backups') {
    if (req.method === 'GET') {
      try {
        if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.toLowerCase().endsWith('.json'));
        const backups = files.map(filename => {
          try {
            const fullPath = path.join(BACKUPS_DIR, filename);
            const stats = fs.statSync(fullPath);
            const content = fs.readFileSync(fullPath, 'utf8');
            let count = 0;
            try {
              const parsed = JSON.parse(content);
              const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.data) ? parsed.data : []);
              count = list.length;
            } catch(e) {}
            return {
              filename,
              name: filename.replace(/\.json$/i, ''),
              size: stats.size,
              createdAt: stats.mtime.toISOString(),
              count
            };
          } catch (e) {
            return null;
          }
        }).filter(Boolean);

        backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, backups }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          let rawName = (payload.name || '').trim();
          if (!rawName) rawName = 'backup_' + new Date().toISOString().replace(/[:.]/g, '-');
          
          let safeName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim();
          if (!safeName.toLowerCase().endsWith('.json')) safeName += '.json';

          if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
          const targetPath = path.join(BACKUPS_DIR, safeName);
          const dataToSave = payload.data || [];
          fs.writeFileSync(targetPath, JSON.stringify(dataToSave, null, 2), 'utf8');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            filename: safeName,
            name: safeName.replace(/\.json$/i, ''),
            count: Array.isArray(dataToSave) ? dataToSave.length : 0,
            createdAt: new Date().toISOString()
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // Lettura o ripristino di un backup specifico (/api/backups/:filename)
  if (pathname.startsWith('/api/backups/') && req.method === 'GET') {
    const rawFilename = decodeURIComponent(pathname.replace('/api/backups/', '')).trim();
    const safeFilename = path.basename(rawFilename);
    const targetPath = path.join(BACKUPS_DIR, safeFilename);

    if (fs.existsSync(targetPath)) {
      try {
        const fileContent = fs.readFileSync(targetPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename: safeFilename, data: parsed }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Errore lettura file backup: ' + err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backup non trovato' }));
    }
    return;
  }

  // Eliminazione singolo partecipante via API
  if (pathname.startsWith('/api/registrations/') && req.method === 'DELETE') {
    const id = decodeURIComponent(pathname.replace('/api/registrations/', '')).trim();
    await deleteRecordAsync(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Ricerca rapida partecipante per QR Scanner (/api/participant/lookup?query=...)
  if (pathname === '/api/participant/lookup' && req.method === 'GET') {
    const query = (reqUrl.searchParams.get('query') || '').trim().toUpperCase();
    const list = await readDataAsync();
    const found = list.find(r => 
      (r.id && r.id.toUpperCase() === query) ||
      (r.cognome && r.cognome.toUpperCase() === query) ||
      (r.tesseraVci && r.tesseraVci.toUpperCase() === query)
    );
    if (found) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(found));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Partecipante non trovato' }));
    }
    return;
  }

  // Aggiornamento stato/riscatto servizio da Scanner (/api/participant/update/:id)
  if (pathname.startsWith('/api/participant/update/') && req.method === 'POST') {
    const id = decodeURIComponent(pathname.replace('/api/participant/update/', '')).trim();
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const updateData = JSON.parse(body);
        const list = await readDataAsync();
        const idx = list.findIndex(r => r.id.toUpperCase() === id.toUpperCase());
        if (idx >= 0) {
          const merged = { ...list[idx], ...updateData };
          if (merged.accettazioneConclusa) merged.statoAccettazioneSabato = true;
          if (merged.kitGadgetConsegnato) merged.ritiroGadget = true;
          if (merged.aperitivoErogato) merged.aperitivo = true;
          if (merged.cenaSabatoErogato) merged.cena = true;
          if (merged.pranzoDomenicaErogato) merged.pranzo = true;
          await saveRecordAsync(merged);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, record: merged }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Partecipante non trovato con ID ' + id }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // File Statici
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Accesso Negato');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        res.end('Errore Server: ' + error.code);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

// Self-ping Keep-Alive opzionale se configurato APP_URL su Render
if (process.env.ENABLE_KEEP_ALIVE === 'true' && process.env.APP_URL) {
  const pingUrl = process.env.APP_URL.replace(/\/+$/, '') + '/api/ping';
  const PING_INTERVAL = 10 * 60 * 1000; // ogni 10 minuti
  setInterval(() => {
    try {
      const client = pingUrl.startsWith('https') ? https : http;
      client.get(pingUrl, (res) => {
        console.log(`[Keep-Alive] Ping eseguito verso ${pingUrl} (Status: ${res.statusCode})`);
      }).on('error', (err) => {
        console.warn(`[Keep-Alive] Errore ping:`, err.message);
      });
    } catch (e) {
      console.warn(`[Keep-Alive] Eccezione:`, e.message);
    }
  }, PING_INTERVAL);
  console.log(`⏰ Keep-Alive attivo: ping periodico impostato ogni 10 minuti su ${pingUrl}`);
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Vespa Club Asti Cloud Server Attivo!`);
  console.log(`Porta: ${PORT} | Database: ${MONGO_URI ? 'MongoDB Atlas' : 'Locale (JSON)'}`);
  console.log(`====================================================`);
});
