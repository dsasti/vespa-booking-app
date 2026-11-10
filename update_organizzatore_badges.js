const fs = require('fs');

let html = fs.readFileSync('organizzatore.html', 'utf8').replace(/\r\n/g, '\n');

// 1. Aggiorna select del filtro adminModeFilter con le sigle stilizzate
const oldSelect = `<select id="adminModeFilter"><option value="ALL">Tutti i Pacchetti</option><option value="COMPLETA">🏆 COMPLETA Sab+Dom</option><option value="FULL_SAB">🌅 FULL Sabato</option><option value="FULL_DOM">🌄 FULL Domenica</option><option value="LIGHT_SAB">🛵 LIGHT Sabato</option><option value="LIGHT_DOM">☀️ LIGHT Domenica</option></select>`;

const newSelect = `<select id="adminModeFilter"><option value="ALL">Tutti i Pacchetti</option><option value="COMPLETA">[C] COMPLETA Sab+Dom</option><option value="FULL_SAB">[SF] FULL Sabato</option><option value="LIGHT_SAB">[SL] LIGHT Sabato</option><option value="FULL_DOM">[DF] FULL Domenica</option><option value="LIGHT_DOM">[DL] LIGHT Domenica</option></select>`;

if (html.includes(oldSelect)) {
  html = html.replace(oldSelect, newSelect);
  console.log('organizzatore.html filter select updated');
} else {
  console.warn('oldSelect not found in organizzatore.html');
}

// 2. Aggiorna la legenda colori per includere le mini immagini dei pacchetti
const oldLegend = `          <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap; font-size:0.8rem; color:var(--text-muted);">
            <strong style="color:var(--text-main); font-weight:800;">Legenda Colori Pacchetto:</strong>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <span style="display:inline-block; width:13px; height:13px; border-radius:3px; background:#EFF6FF; border:1px solid #93C5FD;"></span>
              <strong style="color:#1E40AF;">Sabato + Domenica</strong> (Completa / Full 2 Giorni)
            </span>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <span style="display:inline-block; width:13px; height:13px; border-radius:3px; background:#FFF7ED; border:1px solid #FDBA74;"></span>
              <strong style="color:#9A3412;">Solo Sabato</strong> (Full / Light Sabato)
            </span>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <span style="display:inline-block; width:13px; height:13px; border-radius:3px; background:#F0FDF4; border:1px solid #86EFAC;"></span>
              <strong style="color:#166534;">Solo Domenica</strong> (Full / Light Domenica)
            </span>
          </div>`;

const newLegend = `          <div style="display:flex; align-items:center; gap:1.1rem; flex-wrap:wrap; font-size:0.8rem; color:var(--text-muted);">
            <strong style="color:var(--text-main); font-weight:800;">Sigle &amp; Colori Pacchetto:</strong>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="18" height="18" style="vertical-align:middle;display:inline-block;border-radius:4px;"><defs><linearGradient id="legC" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1D4ED8"/><stop offset="100%" stop-color="#1E40AF"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#legC)"/><text x="22" y="31" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="26" fill="#FFFFFF">C</text></svg>
              <strong style="color:#1E40AF;">Completa</strong> (Sab+Dom)
            </span>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="18" height="18" style="vertical-align:middle;display:inline-block;border-radius:4px;"><defs><linearGradient id="legSF" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C2410C"/><stop offset="100%" stop-color="#9A3412"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#legSF)"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">SF</text></svg>
              <strong style="color:#9A3412;">Full Sabato</strong>
            </span>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="18" height="18" style="vertical-align:middle;display:inline-block;border-radius:4px;"><defs><linearGradient id="legSL" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EA580C"/><stop offset="100%" stop-color="#C2410C"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#legSL)"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">SL</text></svg>
              <strong style="color:#EA580C;">Light Sabato</strong>
            </span>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="18" height="18" style="vertical-align:middle;display:inline-block;border-radius:4px;"><defs><linearGradient id="legDF" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#15803D"/><stop offset="100%" stop-color="#166534"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#legDF)"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">DF</text></svg>
              <strong style="color:#15803D;">Full Domenica</strong>
            </span>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="18" height="18" style="vertical-align:middle;display:inline-block;border-radius:4px;"><defs><linearGradient id="legDL" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#16A34A"/><stop offset="100%" stop-color="#15803D"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#legDL)"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">DL</text></svg>
              <strong style="color:#16A34A;">Light Domenica</strong>
            </span>
          </div>`;

if (html.includes(oldLegend)) {
  html = html.replace(oldLegend, newLegend);
  console.log('organizzatore.html legend updated');
} else {
  console.warn('oldLegend not found in organizzatore.html');
}

fs.writeFileSync('organizzatore.html', html, 'utf8');
console.log('organizzatore.html saved successfully');

