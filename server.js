const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'dimsport1986';
const DATA_FILE = path.join(__dirname, 'dati_clienti.json');
const STRINGS_FILE = path.join(__dirname, 'dati_corde.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const KEY_FILE = path.join(__dirname, '.secret.key');

function getEncryptionKey() {
  if (process.env.DATA_KEY) {
    return crypto.createHash('sha256').update(process.env.DATA_KEY).digest();
  }
  if (!fs.existsSync(KEY_FILE)) {
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(KEY_FILE, generated, 'utf8');
  }
  const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
  return Buffer.from(hex, 'hex');
}

function encryptText(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `ENC_V1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(payload) {
  if (!payload.startsWith('ENC_V1:')) {
    return payload; // backward-compatible with plain JSON
  }
  const [, ivHex, tagHex, dataHex] = payload.split(':');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

function createAuthToken() {
  const hmac = crypto.createHmac('sha256', getEncryptionKey()).update(APP_PASSWORD).digest('hex');
  return hmac;
}

function isAuthenticated(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (!match) return false;
  return match[1] === createAuthToken();
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      writeData({ clienti: [] });
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
    const plain = decryptText(raw);
    const parsed = JSON.parse(plain);
    return Array.isArray(parsed.clienti) ? parsed : { clienti: [] };
  } catch (err) {
    console.error('Errore lettura dati_clienti.json:', err);
    return { clienti: [] };
  }
}

function writeData(data) {
  const json = JSON.stringify(data, null, 2);
  const encrypted = encryptText(json);
  fs.writeFileSync(DATA_FILE, encrypted, 'utf8');
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `dati_clienti_${stamp}.json`);
    fs.writeFileSync(backupFile, encrypted, 'utf8');

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('dati_clienti_') && f.endsWith('.json'))
      .sort();
    while (files.length > 5) {
      const oldest = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    }
  } catch (err) {
    console.error('Errore creazione backup:', err);
  }
}

function readStrings() {
  try {
    if (!fs.existsSync(STRINGS_FILE)) {
      fs.writeFileSync(STRINGS_FILE, JSON.stringify({ corde: [] }, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(STRINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed.corde) ? parsed.corde : [];
    return list.map(item =>
      typeof item === 'string'
        ? { nome: item, prezzo: null }
        : { nome: String(item.nome || '').trim(), prezzo: item.prezzo !== undefined && item.prezzo !== null && item.prezzo !== '' ? Number(item.prezzo) : null }
    );
  } catch (err) {
    console.error('Errore lettura dati_corde.json:', err);
    return [];
  }
}

function writeStrings(corde) {
  fs.writeFileSync(STRINGS_FILE, JSON.stringify({ corde }, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload troppo grande'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON non valido'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let safePath = urlPath === '/' ? '/index.html' : urlPath;
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(__dirname, safePath);

  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Accesso negato');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('File non trovato');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Auth endpoints
  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password === APP_PASSWORD) {
        const token = createAuthToken();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `auth_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`
        });
        return res.end(JSON.stringify({ ok: true }));
      }
      return sendJson(res, 401, { error: 'Password non corretta' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': 'auth_token=; HttpOnly; Path=/; Max-Age=0'
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (pathname === '/api/ping' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, ts: Date.now() });
  }

  // Public routes (no login required)
  const isPublicRoute =
    pathname === '/login.html' ||
    pathname === '/scheda.html' ||
    pathname === '/api/ping' ||
    pathname.startsWith('/css/') ||
    pathname.startsWith('/api/public/client/');

  if (!isPublicRoute && !isAuthenticated(req)) {
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 401, { error: 'Non autorizzato' });
    }
    res.writeHead(302, { Location: '/login.html' });
    return res.end();
  }

  // API Routes
  if (pathname === '/api/strings' && req.method === 'GET') {
    return sendJson(res, 200, { corde: readStrings() });
  }

  if (pathname === '/api/strings' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const nome = String(body.nome || '').trim().toUpperCase();
      if (!nome) return sendJson(res, 400, { error: 'Nome corda obbligatorio' });
      const prezzo = body.prezzo !== undefined && body.prezzo !== null && body.prezzo !== '' ? Number(body.prezzo) : null;
      const corde = readStrings();
      const existing = corde.find(s => s.nome.toUpperCase() === nome);
      if (existing) {
        if (prezzo !== null) existing.prezzo = prezzo;
      } else {
        corde.push({ nome, prezzo });
        corde.sort((a, b) => a.nome.localeCompare(b.nome));
      }
      writeStrings(corde);
      return sendJson(res, 201, { corde });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const strItemMatch = pathname.match(/^\/api\/strings\/(.+)$/);
  if (strItemMatch && req.method === 'PUT') {
    try {
      const target = decodeURIComponent(strItemMatch[1]).trim().toUpperCase();
      const body = await parseBody(req);
      const corde = readStrings();
      const item = corde.find(s => s.nome.toUpperCase() === target);
      if (!item) return sendJson(res, 404, { error: 'Corda non trovata' });
      item.prezzo = body.prezzo !== undefined && body.prezzo !== null && body.prezzo !== '' ? Number(body.prezzo) : null;
      writeStrings(corde);
      return sendJson(res, 200, { corde });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const delStringMatch = pathname.match(/^\/api\/strings\/(.+)$/);
  if (delStringMatch && req.method === 'DELETE') {
    const target = decodeURIComponent(delStringMatch[1]).trim().toUpperCase();
    const corde = readStrings().filter(s => s.nome.toUpperCase() !== target);
    writeStrings(corde);
    return sendJson(res, 200, { corde });
  }
  if (pathname === '/api/clients' && req.method === 'GET') {
    const data = readData();
    const includeDeleted = url.searchParams.get('includeDeleted') === '1';
    const baseList = includeDeleted ? data.clienti : data.clienti.filter(c => !c.eliminato);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) {
      return sendJson(res, 200, { clienti: baseList });
    }
    const filtered = baseList.filter(c => {
      const searchable = [
        c.nome,
        c.cognome,
        `${c.nome} ${c.cognome}`,
        `${c.cognome} ${c.nome}`,
        c.telefono,
        c.email,
        c.cordeVerticali,
        c.cordeOrizzontali,
        c.tensioneVerticali,
        c.tensioneOrizzontali,
        c.metodoLavoro,
        c.note,
        ...(Array.isArray(c.racchette) ? c.racchette : []),
        ...(Array.isArray(c.incordature)
          ? c.incordature.flatMap(i => [i.racchetta, i.cordeVerticali, i.cordeOrizzontali, i.note, i.data])
          : [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });
    return sendJson(res, 200, { clienti: filtered });
  }

  if (pathname === '/api/clients' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const data = readData();
      const newClient = {
        id: crypto.randomUUID(),
        nome: String(body.nome || '').trim(),
        cognome: String(body.cognome || '').trim(),
        telefono: String(body.telefono || '').trim(),
        email: String(body.email || '').trim(),
        racchette: Array.isArray(body.racchette)
          ? body.racchette.map(r => String(r).trim()).filter(Boolean)
          : [],
        cordeVerticali: String(body.cordeVerticali || '').trim(),
        cordeOrizzontali: String(body.cordeOrizzontali || '').trim(),
        coloreCorda: String(body.coloreCorda || '').trim(),
        lunghezzaCorda: String(body.lunghezzaCorda || '').trim(),
        tensioneVerticali: String(body.tensioneVerticali || '').trim(),
        tensioneOrizzontali: String(body.tensioneOrizzontali || '').trim(),
        metodoLavoro: String(body.metodoLavoro || '').trim(),
        note: String(body.note || '').trim(),
        prezzoDefault: body.prezzoDefault !== '' && body.prezzoDefault !== undefined ? Number(body.prezzoDefault) : null,
        convenzioneAttiva: Boolean(body.convenzioneAttiva),
        convenzioneCorda: String(body.convenzioneCorda || '').trim(),
        convenzionePrezzo:
          body.convenzionePrezzo !== '' && body.convenzionePrezzo !== undefined && body.convenzionePrezzo !== null
            ? Number(body.convenzionePrezzo)
            : null,
        convenzioneUsate: Math.max(0, Math.min(17, Number(body.convenzioneUsate) || 0)),
        cordaPropriaV: Boolean(body.cordaPropriaV),
        cordaPropriaO: Boolean(body.cordaPropriaO),
        createdAt: new Date().toISOString(),
        incordature: []
      };

      if (body.primaIncordatura && body.primaIncordatura.data) {
        newClient.incordature.push({
          id: crypto.randomUUID(),
          data: body.primaIncordatura.data,
          racchetta: String(body.primaIncordatura.racchetta || newClient.racchette[0] || '').trim(),
          cordeVerticali: String(body.primaIncordatura.cordeVerticali ?? newClient.cordeVerticali).trim(),
          cordeOrizzontali: String(body.primaIncordatura.cordeOrizzontali ?? newClient.cordeOrizzontali).trim(),
          tensioneVerticali: String(body.primaIncordatura.tensioneVerticali ?? newClient.tensioneVerticali).trim(),
          tensioneOrizzontali: String(body.primaIncordatura.tensioneOrizzontali ?? newClient.tensioneOrizzontali).trim(),
          metodoLavoro: String(body.primaIncordatura.metodoLavoro ?? newClient.metodoLavoro).trim(),
          prezzo:
            body.primaIncordatura.prezzo !== '' && body.primaIncordatura.prezzo !== undefined && body.primaIncordatura.prezzo !== null
              ? Number(body.primaIncordatura.prezzo)
              : newClient.prezzoDefault,
          inConvenzione: Boolean(body.primaIncordatura.inConvenzione),
          note: String(body.primaIncordatura.note || '').trim()
        });
      }

      data.clienti.push(newClient);
      writeData(data);
      return sendJson(res, 201, { client: newClient });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const publicMatch = pathname.match(/^\/api\/public\/client\/([^\/]+)$/);
  if (publicMatch && req.method === 'GET') {
    const clientId = publicMatch[1];
    const data = readData();
    const c = data.clienti.find(x => x.id === clientId);
    if (!c) return sendJson(res, 404, { error: 'Scheda non trovata' });
    return sendJson(res, 200, {
      client: {
        id: c.id,
        nome: c.nome,
        cognome: c.cognome,
        racchette: c.racchette || [],
        cordeVerticali: c.cordeVerticali || '',
        cordeOrizzontali: c.cordeOrizzontali || '',
        tensioneVerticali: c.tensioneVerticali || '',
        tensioneOrizzontali: c.tensioneOrizzontali || '',
        prezzoDefault: c.prezzoDefault,
        convenzioneAttiva: Boolean(c.convenzioneAttiva),
        convenzioneCorda: c.convenzioneCorda || '',
        convenzionePrezzo: c.convenzionePrezzo ?? null,
        incordature: c.incordature || []
      }
    });
  }

  const clientMatch = pathname.match(/^\/api\/clients\/([^\/]+)$/);
  if (clientMatch) {
    const clientId = clientMatch[1];
    const data = readData();
    const idx = data.clienti.findIndex(c => c.id === clientId);

    if (req.method === 'GET') {
      if (idx === -1) return sendJson(res, 404, { error: 'Cliente non trovato' });
      return sendJson(res, 200, { client: data.clienti[idx] });
    }

    if (req.method === 'PUT') {
      if (idx === -1) return sendJson(res, 404, { error: 'Cliente non trovato' });
      try {
        const body = await parseBody(req);
        const existing = data.clienti[idx];
        data.clienti[idx] = {
          ...existing,
          nome: body.nome !== undefined ? String(body.nome).trim() : existing.nome,
          cognome: body.cognome !== undefined ? String(body.cognome).trim() : existing.cognome,
          telefono: body.telefono !== undefined ? String(body.telefono).trim() : existing.telefono,
          email: body.email !== undefined ? String(body.email).trim() : existing.email,
          racchette: Array.isArray(body.racchette)
            ? body.racchette.map(r => String(r).trim()).filter(Boolean)
            : existing.racchette,
          cordeVerticali: body.cordeVerticali !== undefined ? String(body.cordeVerticali).trim() : existing.cordeVerticali,
          cordeOrizzontali: body.cordeOrizzontali !== undefined ? String(body.cordeOrizzontali).trim() : existing.cordeOrizzontali,
          coloreCorda: body.coloreCorda !== undefined ? String(body.coloreCorda).trim() : (existing.coloreCorda || ''),
          lunghezzaCorda: body.lunghezzaCorda !== undefined ? String(body.lunghezzaCorda).trim() : (existing.lunghezzaCorda || ''),
          tensioneVerticali: body.tensioneVerticali !== undefined ? String(body.tensioneVerticali).trim() : existing.tensioneVerticali,
          tensioneOrizzontali: body.tensioneOrizzontali !== undefined ? String(body.tensioneOrizzontali).trim() : existing.tensioneOrizzontali,
          metodoLavoro: body.metodoLavoro !== undefined ? String(body.metodoLavoro).trim() : existing.metodoLavoro,
          note: body.note !== undefined ? String(body.note).trim() : existing.note,
          prezzoDefault:
            body.prezzoDefault !== undefined
              ? body.prezzoDefault === '' || body.prezzoDefault === null
                ? null
                : Number(body.prezzoDefault)
              : existing.prezzoDefault,
          convenzioneAttiva:
            body.convenzioneAttiva !== undefined ? Boolean(body.convenzioneAttiva) : Boolean(existing.convenzioneAttiva),
          convenzioneCorda:
            body.convenzioneCorda !== undefined ? String(body.convenzioneCorda).trim() : (existing.convenzioneCorda || ''),
          convenzionePrezzo:
            body.convenzionePrezzo !== undefined
              ? body.convenzionePrezzo === '' || body.convenzionePrezzo === null
                ? null
                : Number(body.convenzionePrezzo)
              : (existing.convenzionePrezzo ?? null),
          convenzioneUsate:
            body.convenzioneUsate !== undefined
              ? Math.max(0, Math.min(17, Number(body.convenzioneUsate) || 0))
              : (Number(existing.convenzioneUsate) || 0),
          cordaPropriaV:
            body.cordaPropriaV !== undefined ? Boolean(body.cordaPropriaV) : Boolean(existing.cordaPropriaV),
          cordaPropriaO:
            body.cordaPropriaO !== undefined ? Boolean(body.cordaPropriaO) : Boolean(existing.cordaPropriaO)
        };
        writeData(data);
        return sendJson(res, 200, { client: data.clienti[idx] });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      if (idx === -1) return sendJson(res, 404, { error: 'Cliente non trovato' });
      const keepInc = url.searchParams.get('keepIncordature') === '1';
      if (keepInc && Array.isArray(data.clienti[idx].incordature) && data.clienti[idx].incordature.length > 0) {
        data.clienti[idx].eliminato = true;
        data.clienti[idx].telefono = '';
        data.clienti[idx].email = '';
        data.clienti[idx].note = '';
      } else {
        data.clienti.splice(idx, 1);
      }
      writeData(data);
      return sendJson(res, 200, { ok: true });
    }
  }

  const incMatch = pathname.match(/^\/api\/clients\/([^\/]+)\/incordature$/);
  if (incMatch && req.method === 'POST') {
    const clientId = incMatch[1];
    const data = readData();
    const client = data.clienti.find(c => c.id === clientId);
    if (!client) return sendJson(res, 404, { error: 'Cliente non trovato' });

    try {
      const body = await parseBody(req);
      if (!body.data) {
        return sendJson(res, 400, { error: 'La data dell\'incordatura è obbligatoria' });
      }
      const quantita = Math.max(1, parseInt(body.quantita, 10) || 1);
      client.incordature = Array.isArray(client.incordature) ? client.incordature : [];
      const created = [];
      for (let i = 0; i < quantita; i++) {
        const newInc = {
          id: crypto.randomUUID(),
          data: body.data || '',
          racchetta: String(body.racchetta || '').trim(),
          cordeVerticali: String(body.cordeVerticali ?? client.cordeVerticali).trim(),
          cordeOrizzontali: String(body.cordeOrizzontali ?? client.cordeOrizzontali).trim(),
          coloreCorda: String(body.coloreCorda ?? client.coloreCorda ?? '').trim(),
          lunghezzaCorda: String(body.lunghezzaCorda ?? client.lunghezzaCorda ?? '').trim(),
          tensioneVerticali: String(body.tensioneVerticali ?? client.tensioneVerticali).trim(),
          tensioneOrizzontali: String(body.tensioneOrizzontali ?? client.tensioneOrizzontali).trim(),
          metodoLavoro: String(body.metodoLavoro ?? client.metodoLavoro).trim(),
          prezzo:
            body.prezzo !== '' && body.prezzo !== undefined && body.prezzo !== null
              ? Number(body.prezzo)
              : client.prezzoDefault,
          inConvenzione: Boolean(body.inConvenzione),
          cordaPropriaV: Boolean(body.cordaPropriaV),
          cordaPropriaO: Boolean(body.cordaPropriaO),
          note: String(body.note || '').trim()
        };
        client.incordature.push(newInc);
        created.push(newInc);
        if (newInc.inConvenzione) {
          client.convenzioneUsate = Math.min(17, (Number(client.convenzioneUsate) || 0) + 1);
        }
      }
      const latest = created[created.length - 1];
      if (latest) {
        if (latest.cordeVerticali) client.cordeVerticali = latest.cordeVerticali;
        if (latest.cordeOrizzontali) client.cordeOrizzontali = latest.cordeOrizzontali;
        if (latest.tensioneVerticali) client.tensioneVerticali = latest.tensioneVerticali;
        if (latest.tensioneOrizzontali) client.tensioneOrizzontali = latest.tensioneOrizzontali;
        if (latest.metodoLavoro) client.metodoLavoro = latest.metodoLavoro;
        if (latest.lunghezzaCorda) client.lunghezzaCorda = latest.lunghezzaCorda;
        if (latest.coloreCorda) client.coloreCorda = latest.coloreCorda;
        if (latest.prezzo !== null && latest.prezzo !== undefined && latest.prezzo !== '') {
          client.prezzoDefault = latest.prezzo;
        }
        client.cordaPropriaV = Boolean(latest.cordaPropriaV);
        client.cordaPropriaO = Boolean(latest.cordaPropriaO);
        if (latest.racchetta) {
          client.racchette = Array.isArray(client.racchette) ? client.racchette : [];
          if (!client.racchette.includes(latest.racchetta)) {
            client.racchette.push(latest.racchetta);
          }
        }
      }
      writeData(data);
      return sendJson(res, 201, { incordatura: created[0], count: created.length, client });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const incItemMatch = pathname.match(/^\/api\/clients\/([^\/]+)\/incordature\/([^\/]+)$/);
  if (incItemMatch && req.method === 'PUT') {
    const [, clientId, incId] = incItemMatch;
    const data = readData();
    const client = data.clienti.find(c => c.id === clientId);
    if (!client) return sendJson(res, 404, { error: 'Cliente non trovato' });
    const incIdx = (client.incordature || []).findIndex(i => i.id === incId);
    if (incIdx === -1) return sendJson(res, 404, { error: 'Incordatura non trovata' });

    try {
      const body = await parseBody(req);
      const existing = client.incordature[incIdx];
      client.incordature[incIdx] = {
        ...existing,
        data: body.data !== undefined ? body.data : existing.data,
        racchetta: body.racchetta !== undefined ? String(body.racchetta).trim() : existing.racchetta,
        cordeVerticali: body.cordeVerticali !== undefined ? String(body.cordeVerticali).trim() : existing.cordeVerticali,
        cordeOrizzontali: body.cordeOrizzontali !== undefined ? String(body.cordeOrizzontali).trim() : existing.cordeOrizzontali,
        coloreCorda: body.coloreCorda !== undefined ? String(body.coloreCorda).trim() : (existing.coloreCorda || ''),
        lunghezzaCorda: body.lunghezzaCorda !== undefined ? String(body.lunghezzaCorda).trim() : (existing.lunghezzaCorda || ''),
        tensioneVerticali: body.tensioneVerticali !== undefined ? String(body.tensioneVerticali).trim() : existing.tensioneVerticali,
        tensioneOrizzontali: body.tensioneOrizzontali !== undefined ? String(body.tensioneOrizzontali).trim() : existing.tensioneOrizzontali,
        metodoLavoro: body.metodoLavoro !== undefined ? String(body.metodoLavoro).trim() : existing.metodoLavoro,
        prezzo:
          body.prezzo !== undefined
            ? body.prezzo === '' || body.prezzo === null
              ? client.prezzoDefault
              : Number(body.prezzo)
            : existing.prezzo,
        inConvenzione: body.inConvenzione !== undefined ? Boolean(body.inConvenzione) : Boolean(existing.inConvenzione),
        cordaPropriaV: body.cordaPropriaV !== undefined ? Boolean(body.cordaPropriaV) : Boolean(existing.cordaPropriaV),
        cordaPropriaO: body.cordaPropriaO !== undefined ? Boolean(body.cordaPropriaO) : Boolean(existing.cordaPropriaO),
        note: body.note !== undefined ? String(body.note).trim() : existing.note
      };
      writeData(data);
      return sendJson(res, 200, { incordatura: client.incordature[incIdx], client });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const delIncMatch = pathname.match(/^\/api\/clients\/([^\/]+)\/incordature\/([^\/]+)$/);
  if (delIncMatch && req.method === 'DELETE') {
    const [, clientId, incId] = delIncMatch;
    const data = readData();
    const client = data.clienti.find(c => c.id === clientId);
    if (!client) return sendJson(res, 404, { error: 'Cliente non trovato' });
    client.incordature = (client.incordature || []).filter(i => i.id !== incId);
    writeData(data);
    return sendJson(res, 200, { client });
  }

  // Static files
  return serveStatic(req, res, pathname);
});

// Keep-Alive automatico su Render (o quando ENABLE_KEEP_ALIVE=true)
const keepAliveBaseUrl =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.APP_URL ||
  (process.env.RENDER ? 'https://registro-incordature-dimensione-sport.onrender.com' : '');

if (keepAliveBaseUrl || process.env.ENABLE_KEEP_ALIVE === 'true') {
  const targetUrl = (keepAliveBaseUrl || `http://localhost:${PORT}`).replace(/\/+$/, '') + '/api/ping';
  setInterval(() => {
    try {
      const client = targetUrl.startsWith('https') ? https : http;
      client
        .get(targetUrl, res => {
          console.log(`[Keep-Alive] Ping ${targetUrl} -> ${res.statusCode}`);
        })
        .on('error', err => {
          console.warn('[Keep-Alive] Errore ping:', err.message);
        });
    } catch (e) {
      console.warn('[Keep-Alive] Eccezione:', e.message);
    }
  }, 10 * 60 * 1000);
  console.log(`⏰ Keep-Alive attivo ogni 10 minuti su ${targetUrl}`);
}

server.listen(PORT, () => {
  console.log(`Registro Incordature attivo su http://localhost:${PORT}`);
});
