const state = {
  clients: [],
  currentClient: null,
  strings: []
};

async function loadStringsCatalog() {
  try {
    const res = await fetch('/api/strings');
    const data = await res.json();
    state.strings = data.corde || [];
  } catch {
    state.strings = [];
  }
  const datalist = document.getElementById('cordeDatalist');
  if (datalist) {
    datalist.innerHTML = state.strings.map(s => `<option value="${escapeHtml(s.nome)}"></option>`).join('');
  }
}

function setStringSelectValue(inputId, value) {
  document.getElementById(inputId).value = (value || '').trim();
}

function getStringSelectValue(inputId) {
  return document.getElementById(inputId).value.trim();
}

function toTitleCase(str) {
  return String(str ?? '').replace(/\S+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function attachTitleCase(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('input', () => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const formatted = toTitleCase(el.value);
    if (el.value !== formatted) {
      el.value = formatted;
      if (start !== null && end !== null) {
        el.setSelectionRange(start, end);
      }
    }
  });
}

['searchInput', 'newNome', 'newCognome', 'editNome', 'editCognome'].forEach(attachTitleCase);

// Elements
const searchSection = document.getElementById('searchSection');
const newClientSection = document.getElementById('newClientSection');
const clientDetailSection = document.getElementById('clientDetailSection');
const btnHome = document.getElementById('btnHome');

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchEmpty = document.getElementById('searchEmpty');
const searchQueryLabel = document.getElementById('searchQueryLabel');

const newClientForm = document.getElementById('newClientForm');
const newRacketsList = document.getElementById('newRacketsList');

const clientInfoView = document.getElementById('clientInfoView');
const editClientForm = document.getElementById('editClientForm');
const editRacketsList = document.getElementById('editRacketsList');
const addIncordaturaForm = document.getElementById('addIncordaturaForm');

const toastEl = document.getElementById('toast');

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDateIT(isoDate) {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatEuro(val) {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  if (Number.isNaN(num)) return '-';
  return num.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatTensionDisplay(val) {
  const clean = String(val ?? '').trim();
  if (!clean) return '-';
  return `${clean.replace(/\s*kg$/i, '')} Kg`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showView(view) {
  searchSection.classList.add('hidden');
  newClientSection.classList.add('hidden');
  clientDetailSection.classList.add('hidden');
  btnHome.classList.add('hidden');

  if (view === 'search') {
    searchSection.classList.remove('hidden');
    loadClients(searchInput.value);
  } else if (view === 'new') {
    newClientSection.classList.remove('hidden');
    btnHome.classList.remove('hidden');
  } else if (view === 'detail') {
    clientDetailSection.classList.remove('hidden');
    btnHome.classList.remove('hidden');
  }
}

function createRacketRow(container, value = '') {
  const row = document.createElement('div');
  row.className = 'racket-row';

  let modelVal = String(value || '');
  let patternVal = '';
  let gripVal = '';

  const gripMatch = modelVal.match(/\s*\[([^\[\]]+)\]\s*$/);
  if (gripMatch) {
    gripVal = gripMatch[1].trim();
    modelVal = modelVal.slice(0, gripMatch.index).trim();
  }

  const patternMatch = modelVal.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (patternMatch) {
    modelVal = patternMatch[1].trim();
    patternVal = patternMatch[2].trim();
  }

  const inputModel = document.createElement('input');
  inputModel.type = 'text';
  inputModel.className = 'racket-model';
  inputModel.placeholder = 'es. Babolat Pure Aero';
  inputModel.style.maxWidth = '260px';
  inputModel.value = modelVal;

  const inputPattern = document.createElement('input');
  inputPattern.type = 'text';
  inputPattern.className = 'racket-pattern';
  inputPattern.setAttribute('list', 'patternDatalist');
  inputPattern.placeholder = 'Pattern (es. 16x19)';
  inputPattern.style.maxWidth = '150px';
  inputPattern.value = patternVal;

  const inputGrip = document.createElement('input');
  inputGrip.type = 'text';
  inputGrip.className = 'racket-grip';
  inputGrip.setAttribute('list', 'manicoDatalist');
  inputGrip.placeholder = 'Manico (es. L2)';
  inputGrip.style.maxWidth = '120px';
  inputGrip.value = gripVal;

  const btnRemove = document.createElement('button');
  btnRemove.type = 'button';
  btnRemove.className = 'btn btn-danger btn-sm';
  btnRemove.textContent = '✕';
  btnRemove.onclick = () => row.remove();

  row.appendChild(inputModel);
  row.appendChild(inputPattern);
  row.appendChild(inputGrip);
  row.appendChild(btnRemove);
  container.appendChild(row);
}

function getRacketsFromContainer(container) {
  return Array.from(container.querySelectorAll('.racket-row'))
    .map(row => {
      const model = row.querySelector('.racket-model').value.trim();
      const pattern = row.querySelector('.racket-pattern').value.trim();
      const grip = row.querySelector('.racket-grip').value.trim();
      if (!model) return '';
      let out = model;
      if (pattern) out += ` (${pattern})`;
      if (grip) out += ` [${grip}]`;
      return out;
    })
    .filter(Boolean);
}

async function loadClients(query = '') {
  const url = query.trim()
    ? `/api/clients?q=${encodeURIComponent(query.trim())}`
    : '/api/clients';
  const res = await fetch(url);
  const data = await res.json();
  state.clients = data.clienti || [];
  if (!query.trim()) {
    const countEl = document.getElementById('totalClientsCount');
    if (countEl) countEl.textContent = state.clients.length;
    const currentYear = String(new Date().getFullYear());
    const yearEl = document.getElementById('activeClientsYear');
    if (yearEl) yearEl.textContent = currentYear;
    const activeCount = state.clients.filter(c =>
      (c.incordature || []).some(i => (i.data || '').startsWith(currentYear))
    ).length;
    const activeEl = document.getElementById('activeClientsCount');
    if (activeEl) activeEl.textContent = activeCount;
  }
  renderSearchResults(query.trim());
}

function getMostUsedValue(list, field, fallback) {
  if (!Array.isArray(list) || list.length === 0) return fallback || '-';
  const sorted = [...list].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const counts = new Map();
  sorted.forEach(item => {
    const val = (item[field] || '').trim();
    if (!val) return;
    const key = val.toUpperCase();
    if (!counts.has(key)) {
      counts.set(key, { name: val, count: 0 });
    }
    counts.get(key).count += 1;
  });
  if (counts.size === 0) return fallback || '-';
  let best = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best.name;
}

function renderSearchResults(query) {
  searchResults.innerHTML = '';
  if (state.clients.length === 0) {
    if (query) {
      searchQueryLabel.textContent = query;
      searchEmpty.classList.remove('hidden');
    } else {
      searchEmpty.classList.add('hidden');
      searchResults.innerHTML =
        '<div class="empty-state">Nessun cliente registrato. Clicca su <strong>+ Nuovo Cliente</strong> per iniziare.</div>';
    }
    return;
  }

  searchEmpty.classList.add('hidden');

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()).toISOString().split('T')[0];
  const countLast12 = c => (c.incordature || []).filter(i => (i.data || '') >= twelveMonthsAgo).length;

  const sortedClients = [...state.clients].sort((a, b) => {
    const diff = countLast12(b) - countLast12(a);
    if (diff !== 0) return diff;
    return `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`);
  });

  sortedClients.slice(0, 10).forEach(c => {
    const item = document.createElement('div');
    item.className = 'result-item';
    const racketsText = (c.racchette && c.racchette.length) ? c.racchette.join(', ') : 'Nessuna racchetta';
    const stringsText = [c.cordeVerticali, c.cordeOrizzontali].filter(Boolean).join(' / ') || 'Corde non impostate';
    const count = (c.incordature || []).length;
    const topStrV = getMostUsedValue(c.incordature, 'cordeVerticali', c.cordeVerticali);
    const topStrO = getMostUsedValue(c.incordature, 'cordeOrizzontali', c.cordeOrizzontali);
    const strDisplay = topStrV !== '-' && topStrO !== '-' && topStrV !== topStrO ? `${topStrV} / ${topStrO}` : (topStrV !== '-' ? topStrV : topStrO);

    const topTenV = getMostUsedValue(c.incordature, 'tensioneVerticali', c.tensioneVerticali);
    const topTenO = getMostUsedValue(c.incordature, 'tensioneOrizzontali', c.tensioneOrizzontali);
    const tenDisplay =
      topTenV !== '-' || topTenO !== '-'
        ? `${formatTensionDisplay(topTenV !== '-' ? topTenV : '')} / ${formatTensionDisplay(topTenO !== '-' ? topTenO : '')}`
        : '-';

    const sortedIncs = Array.isArray(c.incordature)
      ? [...c.incordature].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      : [];
    const lastWithPrice = sortedIncs.find(i => i.prezzo !== null && i.prezzo !== undefined && i.prezzo !== '');
    const priceVal = lastWithPrice ? lastWithPrice.prezzo : c.prezzoDefault;
    const priceDisplay = formatEuro(priceVal);

    item.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px;">
        <div class="result-name">${escapeHtml(toTitleCase(`${c.cognome} ${c.nome}`))}</div>
        <span style="font-size:0.85rem; color:var(--text-muted);">
          ${strDisplay !== '-' ? `🧵 ${escapeHtml(strDisplay)}` : ''}
          ${tenDisplay !== '-' ? ` • ⚖️ ${escapeHtml(tenDisplay)}` : ''}
          ${priceDisplay !== '-' ? ` • <strong>${escapeHtml(priceDisplay)}</strong>` : ''}
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="badge">${count} incordatur${count === 1 ? 'a' : 'e'}</span>
        <button class="btn btn-danger btn-sm" data-del-client="${c.id}" title="Elimina cliente">✕</button>
      </div>
    `;
    item.querySelector('[data-del-client]').onclick = async e => {
      e.stopPropagation();
      if (!confirm(`Eliminare il cliente "${c.cognome} ${c.nome}" mantenendo le sue incordature salvate nel registro?`)) return;
      const res = await fetch(`/api/clients/${c.id}?keepIncordature=1`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Cliente eliminato (incordature mantenute)');
        loadClients(searchInput.value);
      }
    };
    item.onclick = () => openClientDetail(c.id);
    searchResults.appendChild(item);
  });
}

async function openClientDetail(clientId) {
  const res = await fetch(`/api/clients/${clientId}`);
  if (!res.ok) {
    showToast('Errore nel caricamento del cliente');
    return;
  }
  const data = await res.json();
  state.currentClient = data.client;
  renderClientDetail();
  showView('detail');
}

function applySettingToNewIncForm(src, c) {
  const s = src || {};
  const cordeV = s.cordeVerticali ?? c.cordeVerticali ?? '';
  const cordeO = s.cordeOrizzontali ?? c.cordeOrizzontali ?? '';
  const tenV = s.tensioneVerticali ?? c.tensioneVerticali ?? '';
  const tenO = s.tensioneOrizzontali ?? c.tensioneOrizzontali ?? '';
  const metodo = s.metodoLavoro || c.metodoLavoro || 'ATW';
  const lunghezza = s.lunghezzaCorda ?? c.lunghezzaCorda ?? '';
  const colore = s.coloreCorda ?? c.coloreCorda ?? '';
  const inConv = src ? Boolean(s.inConvenzione) : Boolean(c.convenzioneAttiva);
  const cpV = src ? Boolean(s.cordaPropriaV) : Boolean(c.cordaPropriaV);
  const cpO = src ? Boolean(s.cordaPropriaO) : Boolean(c.cordaPropriaO);

  setStringSelectValue('incCordeV', cordeV);
  setStringSelectValue('incCordeO', cordeO);
  document.getElementById('incColoreCorda').value = colore;
  document.getElementById('incMetodo').value = metodo;
  setLengthValue(lunghezza, 'incLunghezzaCorda', 'incLunghezzaV', 'incLunghezzaO', toggleIncLen);
  document.getElementById('incTensioneV').value = tenV;
  document.getElementById('incTensioneO').value = tenO;
  document.getElementById('incInConvenzione').checked = inConv;
  document.getElementById('incCordaPropriaV').checked = cpV;
  document.getElementById('incCordaPropriaO').checked = cpO;

  const convUnitPrice =
    c.convenzioneAttiva && c.convenzionePrezzo !== null && c.convenzionePrezzo !== undefined && c.convenzionePrezzo !== ''
      ? (Number(c.convenzionePrezzo) / 17).toFixed(2)
      : null;
  const priceVal =
    inConv && convUnitPrice !== null
      ? convUnitPrice
      : s.prezzo !== undefined && s.prezzo !== null && s.prezzo !== ''
      ? s.prezzo
      : c.prezzoDefault ?? '';
  document.getElementById('incPrezzo').value = priceVal;

  const sel = document.getElementById('incRacchettaSelect');
  const customGroup = document.getElementById('incRacchettaCustomGroup');
  const customInput = document.getElementById('incRacchettaCustom');
  const targetRacket = (s.racchetta || '').trim();
  if (targetRacket) {
    if ((c.racchette || []).includes(targetRacket)) {
      sel.value = targetRacket;
      customGroup.classList.add('hidden');
      customInput.value = '';
    } else {
      sel.value = '__custom__';
      customGroup.classList.remove('hidden');
      customInput.value = targetRacket;
    }
  } else if (!c.racchette || c.racchette.length === 0) {
    sel.value = '__custom__';
    customGroup.classList.remove('hidden');
    customInput.value = '';
  } else {
    sel.selectedIndex = 0;
    customGroup.classList.add('hidden');
    customInput.value = '';
  }
}

function renderClientDetail(keepNewIncOpen = false) {
  const c = state.currentClient;
  if (!c) return;

  document.getElementById('detailClientName').textContent = toTitleCase(`${c.cognome} ${c.nome}`);
  document.getElementById('clientProfileBody').classList.add('hidden');
  document.getElementById('profileToggleIcon').textContent = '▸';
  if (!keepNewIncOpen) {
    document.getElementById('newIncBody').classList.add('hidden');
    document.getElementById('newIncToggleIcon').textContent = '▸';
  }
  clientInfoView.classList.remove('hidden');
  editClientForm.classList.add('hidden');

  const racketsHtml = (c.racchette && c.racchette.length)
    ? c.racchette.map(r => `<span class="badge">${escapeHtml(r)}</span>`).join(' ')
    : '-';

  const usate = Math.max(0, Math.min(17, Number(c.convenzioneUsate) || 0));
  const rimaste = 17 - usate;
  const matassaHtml = c.convenzioneAttiva
    ? `<span class="matassa-wrap">
        <button type="button" id="btnMatassaToggle" class="btn btn-secondary btn-sm">🧵 Matassa: ${rimaste}/17 rimaste</button>
        <div id="matassaPopover" class="matassa-popover hidden"></div>
       </span>`
    : '';
  const convText = c.convenzioneAttiva
    ? `<span class="badge">Attiva</span> ${escapeHtml(c.convenzioneCorda || '')} ${c.convenzionePrezzo !== null && c.convenzionePrezzo !== undefined ? `— ${formatEuro(c.convenzionePrezzo)}` : ''} ${matassaHtml}`
    : 'No';

  const getMostUsedString = (list, field, fallback) => {
    if (!Array.isArray(list) || list.length === 0) return fallback || '-';
    const sorted = [...list].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const counts = new Map();
    sorted.forEach(item => {
      const val = (item[field] || '').trim();
      if (!val) return;
      const key = val.toUpperCase();
      if (!counts.has(key)) {
        counts.set(key, { name: val, count: 0 });
      }
      counts.get(key).count += 1;
    });
    if (counts.size === 0) return fallback || '-';
    let best = null;
    for (const entry of counts.values()) {
      if (!best || entry.count > best.count) {
        best = entry;
      }
    }
    return best.name;
  };

  const topCordeV = getMostUsedString(c.incordature, 'cordeVerticali', c.cordeVerticali);
  const topCordeO = getMostUsedString(c.incordature, 'cordeOrizzontali', c.cordeOrizzontali);
  const topTensioneV = getMostUsedString(c.incordature, 'tensioneVerticali', c.tensioneVerticali);
  const topTensioneO = getMostUsedString(c.incordature, 'tensioneOrizzontali', c.tensioneOrizzontali);

  const sortedIncs = Array.isArray(c.incordature)
    ? [...c.incordature].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    : [];
  const lastIncWithPrice = sortedIncs.find(i => i.prezzo !== null && i.prezzo !== undefined && i.prezzo !== '');
  const effectiveDefaultPrice = lastIncWithPrice ? lastIncWithPrice.prezzo : c.prezzoDefault;

  const hasCorde = (topCordeV && topCordeV !== '-') || (topCordeO && topCordeO !== '-');
  const hasTensione = (topTensioneV && topTensioneV !== '-') || (topTensioneO && topTensioneO !== '-');
  const hasPrezzo = effectiveDefaultPrice !== null && effectiveDefaultPrice !== undefined && effectiveDefaultPrice !== '';
  const hasRacchette = Array.isArray(c.racchette) && c.racchette.length > 0;

  clientInfoView.innerHTML = `
    ${c.telefono ? `<div class="form-group"><label>Telefono</label><div>${escapeHtml(c.telefono)}</div></div>` : ''}
    ${c.email ? `<div class="form-group"><label>Email</label><div>${escapeHtml(c.email)}</div></div>` : ''}
    ${hasPrezzo ? `<div class="form-group"><label>Prezzo Default</label><div style="font-size:1.25rem; font-weight:800; color:var(--primary);">${formatEuro(effectiveDefaultPrice)}</div></div>` : ''}
    ${c.metodoLavoro ? `<div class="form-group"><label>Metodo di Lavoro</label><div>${escapeHtml(c.metodoLavoro)}</div></div>` : ''}
    ${hasCorde ? `<div class="form-group"><label>Corde Verticali / Orizzontali</label><div>${escapeHtml(topCordeV)} / ${escapeHtml(topCordeO)}</div></div>` : ''}
    ${c.coloreCorda ? `<div class="form-group"><label>Colore Corda</label><div>${escapeHtml(c.coloreCorda)}</div></div>` : ''}
    ${c.lunghezzaCorda ? `<div class="form-group"><label>Lunghezza Corda</label><div>${escapeHtml(c.lunghezzaCorda)}</div></div>` : ''}
    ${hasTensione ? `<div class="form-group"><label>Tensione Verticali / Orizzontali</label><div>${escapeHtml(formatTensionDisplay(topTensioneV))} / ${escapeHtml(formatTensionDisplay(topTensioneO))}</div></div>` : ''}
    ${c.convenzioneAttiva ? `<div class="form-group full"><label>Convenzione (17 incordature)</label><div>${convText}</div></div>` : ''}
    ${hasRacchette ? `<div class="form-group full"><label>Racchette Preferite</label><div>${racketsHtml}</div></div>` : ''}
    ${c.note ? `<div class="form-group full"><label>Note</label><div>${escapeHtml(c.note)}</div></div>` : ''}
  `;

  if (c.convenzioneAttiva) {
    const btnMat = document.getElementById('btnMatassaToggle');
    const popMat = document.getElementById('matassaPopover');
    const renderMatassaGrid = usedCount => {
      popMat.innerHTML = '';
      for (let n = 1; n <= 17; n++) {
        const sq = document.createElement('button');
        sq.type = 'button';
        sq.className = `matassa-square ${n <= usedCount ? 'used' : ''}`;
        sq.textContent = n;
        sq.onclick = async ev => {
          ev.stopPropagation();
          const newUsed = n === usedCount ? n - 1 : n;
          const res = await fetch(`/api/clients/${c.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ convenzioneUsate: newUsed })
          });
          if (res.ok) {
            const data = await res.json();
            state.currentClient = data.client;
            btnMat.textContent = `🧵 Matassa: ${17 - newUsed}/17 rimaste`;
            renderMatassaGrid(newUsed);
            showToast(`Matassa aggiornata: ${17 - newUsed}/17 rimaste`);
          }
        };
        popMat.appendChild(sq);
      }
    };
    renderMatassaGrid(usate);
    btnMat.addEventListener('click', ev => {
      ev.stopPropagation();
      popMat.classList.toggle('hidden');
    });
  }

  // Pre-fill Add Incordatura form
  document.getElementById('incDataGiorno').value = '';
  document.getElementById('incDataMese').value = '';
  document.getElementById('incDataAnno').value = new Date().getFullYear();
  document.getElementById('incQuantita').value = '1';
  setStringSelectValue('incCordeV', topCordeV !== '-' ? topCordeV : '');
  setStringSelectValue('incCordeO', topCordeO !== '-' ? topCordeO : '');
  document.getElementById('incColoreCorda').value = c.coloreCorda || '';
  const topMetodo = getMostUsedValue(c.incordature, 'metodoLavoro', c.metodoLavoro || 'ATW');
  document.getElementById('incMetodo').value = topMetodo !== '-' ? topMetodo : 'ATW';
  setLengthValue(c.lunghezzaCorda || '', 'incLunghezzaCorda', 'incLunghezzaV', 'incLunghezzaO', toggleIncLen);
  document.getElementById('incTensioneV').value = topTensioneV !== '-' ? topTensioneV : '';
  document.getElementById('incTensioneO').value = topTensioneO !== '-' ? topTensioneO : '';
  const convUnitPrice =
    c.convenzioneAttiva && c.convenzionePrezzo !== null && c.convenzionePrezzo !== undefined && c.convenzionePrezzo !== ''
      ? (Number(c.convenzionePrezzo) / 17).toFixed(2)
      : null;

  document.getElementById('incPrezzo').value =
    c.convenzioneAttiva && convUnitPrice !== null
      ? convUnitPrice
      : effectiveDefaultPrice !== null && effectiveDefaultPrice !== undefined
      ? effectiveDefaultPrice
      : '';
  document.getElementById('incNote').value = '';
  document.getElementById('incInConvenzione').checked = Boolean(c.convenzioneAttiva);
  document.getElementById('incCordaPropriaV').checked = Boolean(c.cordaPropriaV);
  document.getElementById('incCordaPropriaO').checked = Boolean(c.cordaPropriaO);

  const sel = document.getElementById('incRacchettaSelect');
  const customGroup = document.getElementById('incRacchettaCustomGroup');
  const customInput = document.getElementById('incRacchettaCustom');
  sel.innerHTML = '';
  (c.racchette || []).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  });
  const optOther = document.createElement('option');
  optOther.value = '__custom__';
  optOther.textContent = '+ Altra racchetta...';
  sel.appendChild(optOther);

  applySettingToNewIncForm(sortedIncs[0] || null, c);

  // Render stats & history
  const incordature = Array.isArray(c.incordature) ? [...c.incordature] : [];
  incordature.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const currentYear = String(new Date().getFullYear());
  let spesaTotale = 0;
  let countAnno = 0;

  incordature.forEach(inc => {
    const p = inc.prezzo !== null && inc.prezzo !== undefined && inc.prezzo !== '' ? Number(inc.prezzo) : Number(c.prezzoDefault || 0);
    if (!Number.isNaN(p)) spesaTotale += p;
    if ((inc.data || '').startsWith(currentYear)) countAnno += 1;
  });

  document.getElementById('statSpesaTotale').textContent = formatEuro(spesaTotale);
  document.getElementById('statAnnoCorrente').textContent = currentYear;
  document.getElementById('statIncordatureAnno').textContent = countAnno;
  document.getElementById('statIncordatureTotali').textContent = incordature.length;

  const tbody = document.getElementById('incordatureTableBody');
  tbody.innerHTML = '';
  if (incordature.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nessuna incordatura registrata</td></tr>';
    return;
  }

  const grouped = [];
  const groupMap = new Map();
  incordature.forEach(inc => {
    const key = [
      inc.data,
      inc.racchetta,
      inc.cordeVerticali,
      inc.cordeOrizzontali,
      inc.tensioneVerticali,
      inc.tensioneOrizzontali,
      inc.prezzo,
      inc.inConvenzione ? '1' : '0',
      inc.cordaPropriaV ? '1' : '0',
      inc.cordaPropriaO ? '1' : '0',
      inc.note
    ].join('|');
    if (groupMap.has(key)) {
      groupMap.get(key).items.push(inc);
    } else {
      const entry = { rep: inc, items: [inc] };
      groupMap.set(key, entry);
      grouped.push(entry);
    }
  });

  grouped.forEach(group => {
    const inc = group.rep;
    const count = group.items.length;
    const tr = document.createElement('tr');
    const prezzoUnit = inc.prezzo !== null && inc.prezzo !== undefined && inc.prezzo !== '' ? Number(inc.prezzo) : Number(c.prezzoDefault || 0);
    const prezzoTot = prezzoUnit * count;
    const cpBadges = [
      inc.cordaPropriaV ? '<span class="badge">CP V</span>' : '',
      inc.cordaPropriaO ? '<span class="badge">CP O</span>' : ''
    ].filter(Boolean).join(' ');
    const qtyBadge = count > 1 ? `<span class="badge">×${count}</span>` : '';
    tr.innerHTML = `
      <td>${formatDateIT(inc.data)} ${qtyBadge} ${inc.inConvenzione ? '<span class="badge">Conv.</span>' : ''} ${cpBadges}</td>
      <td>${escapeHtml(inc.racchetta || '-')}</td>
      <td>${escapeHtml(inc.cordeVerticali || '-')} / ${escapeHtml(inc.cordeOrizzontali || '-')}</td>
      <td>${escapeHtml(formatTensionDisplay(inc.tensioneVerticali))} / ${escapeHtml(formatTensionDisplay(inc.tensioneOrizzontali))}</td>
      <td>${formatEuro(prezzoTot)}${count > 1 ? ` <small style="color:var(--text-muted);">(${formatEuro(prezzoUnit)} cad.)</small>` : ''}</td>
      <td>${escapeHtml(inc.note || '-')}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" data-edit-inc="${inc.id}">✏️</button>
        <button class="btn btn-danger btn-sm" data-del-inc="${inc.id}">✕</button>
      </td>
    `;
    tr.querySelector('[data-edit-inc]').onclick = () => openEditIncordaturaModal(inc);
    tr.querySelector('[data-del-inc]').onclick = () => deleteIncordatura(c.id, inc.id);
    tbody.appendChild(tr);
  });
}

async function deleteIncordatura(clientId, incId) {
  if (!confirm('Eliminare questa incordatura?')) return;
  const res = await fetch(`/api/clients/${clientId}/incordature/${incId}`, { method: 'DELETE' });
  if (res.ok) {
    const data = await res.json();
    state.currentClient = data.client;
    renderClientDetail();
    showToast('Incordatura eliminata');
  }
}

// Event Listeners
let selectedResultIndex = -1;

searchInput.addEventListener('input', () => {
  selectedResultIndex = -1;
  loadClients(searchInput.value);
});

searchInput.addEventListener('keydown', e => {
  const items = Array.from(searchResults.querySelectorAll('.result-item'));
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedResultIndex = (selectedResultIndex + 1) % items.length;
    items.forEach((el, idx) => el.classList.toggle('selected', idx === selectedResultIndex));
    items[selectedResultIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedResultIndex = selectedResultIndex <= 0 ? items.length - 1 : selectedResultIndex - 1;
    items.forEach((el, idx) => el.classList.toggle('selected', idx === selectedResultIndex));
    items[selectedResultIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const target = selectedResultIndex >= 0 ? items[selectedResultIndex] : (items.length === 1 ? items[0] : null);
    if (target) target.click();
  }
});

btnHome.addEventListener('click', () => {
  searchInput.value = '';
  showView('search');
  searchInput.focus();
});

function openNewClientForm(prefillQuery = '') {
  newClientForm.reset();
  setStringSelectValue('newCordeV', '');
  setStringSelectValue('newCordeO', '');
  document.getElementById('newMetodo').value = 'ATW';
  if (typeof toggleNewLen === 'function') toggleNewLen();
  newRacketsList.innerHTML = '';
  createRacketRow(newRacketsList);

  if (prefillQuery) {
    const parts = prefillQuery.trim().split(/\s+/);
    if (parts.length >= 2) {
      document.getElementById('newNome').value = parts[0];
      document.getElementById('newCognome').value = parts.slice(1).join(' ');
    } else {
      document.getElementById('newCognome').value = parts[0];
    }
  }
  showView('new');
}

document.getElementById('btnShowNewClient').addEventListener('click', () => openNewClientForm());
document.getElementById('btnRegisterFromSearch').addEventListener('click', () => openNewClientForm(searchInput.value));
document.getElementById('btnCancelNew').addEventListener('click', () => showView('search'));
document.getElementById('btnAddNewRacket').addEventListener('click', () => createRacketRow(newRacketsList));

async function submitNewClientPayload(payload) {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    showToast(err.error || 'Errore salvataggio');
    return;
  }

  const data = await res.json();
  state.currentClient = data.client;
  showToast('Cliente registrato!');
  renderClientDetail();
  showView('detail');
}

newClientForm.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    nome: document.getElementById('newNome').value,
    cognome: document.getElementById('newCognome').value,
    telefono: document.getElementById('newTelefono').value,
    email: document.getElementById('newEmail').value,
    racchette: getRacketsFromContainer(newRacketsList),
    cordeVerticali: getStringSelectValue('newCordeV'),
    cordeOrizzontali: getStringSelectValue('newCordeO'),
    coloreCorda: document.getElementById('newColoreCorda').value.trim(),
    lunghezzaCorda: getLengthValue('newMetodo', 'newLunghezzaCorda', 'newLunghezzaV', 'newLunghezzaO'),
    tensioneVerticali: document.getElementById('newTensioneV').value,
    tensioneOrizzontali: document.getElementById('newTensioneO').value,
    metodoLavoro: document.getElementById('newMetodo').value,
    prezzoDefault: document.getElementById('newPrezzo').value,
    note: document.getElementById('newNote').value,
    convenzioneAttiva: document.getElementById('newConvenzione').checked,
    convenzioneCorda: document.getElementById('newConvenzioneCorda').value,
    convenzionePrezzo: document.getElementById('newConvenzionePrezzo').value,
    cordaPropriaV: document.getElementById('newCordaPropriaV').checked,
    cordaPropriaO: document.getElementById('newCordaPropriaO').checked
  };

  try {
    const allRes = await fetch('/api/clients');
    const allData = await allRes.json();
    const allClients = allData.clienti || [];
    const nNorm = payload.nome.trim().toLowerCase();
    const cNorm = payload.cognome.trim().toLowerCase();
    const telNorm = payload.telefono.replace(/\s+/g, '').trim();
    const emailNorm = payload.email.trim().toLowerCase();

    let matchReason = '';
    const match = allClients.find(c => {
      const sameName = nNorm && cNorm && (c.nome || '').trim().toLowerCase() === nNorm && (c.cognome || '').trim().toLowerCase() === cNorm;
      const sameTel = telNorm && (c.telefono || '').replace(/\s+/g, '').trim() === telNorm;
      const sameEmail = emailNorm && (c.email || '').trim().toLowerCase() === emailNorm;
      if (sameName) matchReason = 'stesso Cognome e Nome';
      else if (sameTel) matchReason = 'stesso Numero di Telefono';
      else if (sameEmail) matchReason = 'stessa Email';
      return sameName || sameTel || sameEmail;
    });

    if (match) {
      const modal = document.getElementById('duplicateClientModal');
      document.getElementById('duplicateClientMsg').innerHTML =
        `Esiste già un cliente registrato con <strong>${escapeHtml(matchReason)}</strong>: <strong>${escapeHtml(toTitleCase(`${match.cognome} ${match.nome}`))}</strong>.<br><br>Vuoi aprire la sua scheda oppure proseguire creando un nuovo cliente?`;

      const closeDup = () => modal.classList.add('hidden');
      document.getElementById('btnCloseDupModal').onclick = closeDup;
      document.getElementById('btnCancelDup').onclick = closeDup;
      document.getElementById('btnGoToExistingClient').onclick = () => {
        closeDup();
        openClientDetail(match.id);
      };
      document.getElementById('btnProceedNewClient').onclick = () => {
        closeDup();
        submitNewClientPayload(payload);
      };
      modal.classList.remove('hidden');
      return;
    }
  } catch (err) {
    console.error('Errore controllo duplicati:', err);
  }

  await submitNewClientPayload(payload);
});

document.getElementById('incRacchettaSelect').addEventListener('change', e => {
  if (e.target.value === '__custom__') {
    document.getElementById('addRacketForm').reset();
    document.getElementById('addRacketModal').classList.remove('hidden');
    document.getElementById('modalRacketModel').focus();
  }
});

function closeAddRacketModal() {
  document.getElementById('addRacketModal').classList.add('hidden');
  const sel = document.getElementById('incRacchettaSelect');
  if (sel.value === '__custom__' && sel.options.length > 1) {
    sel.selectedIndex = 0;
  }
}

document.getElementById('btnCloseAddRacketModal').addEventListener('click', closeAddRacketModal);
document.getElementById('btnCancelAddRacket').addEventListener('click', closeAddRacketModal);

document.getElementById('addRacketForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.currentClient) return;
  const model = document.getElementById('modalRacketModel').value.trim();
  if (!model) return;
  const pattern = document.getElementById('modalRacketPattern').value.trim();
  const grip = document.getElementById('modalRacketGrip').value.trim();
  let newRacket = model;
  if (pattern) newRacket += ` (${pattern})`;
  if (grip) newRacket += ` [${grip}]`;

  const updatedRackets = [...(state.currentClient.racchette || [])];
  if (!updatedRackets.includes(newRacket)) {
    updatedRackets.push(newRacket);
  }

  const res = await fetch(`/api/clients/${state.currentClient.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ racchette: updatedRackets })
  });

  if (res.ok) {
    const data = await res.json();
    state.currentClient = data.client;
    const sel = document.getElementById('incRacchettaSelect');
    sel.innerHTML = '';
    (state.currentClient.racchette || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      sel.appendChild(opt);
    });
    const optOther = document.createElement('option');
    optOther.value = '__custom__';
    optOther.textContent = '+ Altra racchetta...';
    sel.appendChild(optOther);
    sel.value = newRacket;
    document.getElementById('addRacketModal').classList.add('hidden');
    showToast('Racchetta aggiunta alla scheda cliente!');
  } else {
    showToast('Errore salvataggio racchetta');
  }
});

addIncordaturaForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.currentClient) return;

  const selVal = document.getElementById('incRacchettaSelect').value;
  const racchetta = selVal === '__custom__'
    ? document.getElementById('incRacchettaCustom').value.trim()
    : selVal;

  const gg = String(document.getElementById('incDataGiorno').value || '').trim().padStart(2, '0');
  const mm = String(document.getElementById('incDataMese').value || '').trim().padStart(2, '0');
  const aaaa = String(document.getElementById('incDataAnno').value || '').trim();
  if (!gg || gg === '00' || !mm || mm === '00' || aaaa.length !== 4) {
    showToast('Inserisci giorno, mese e anno validi');
    return;
  }

  const payload = {
    data: `${aaaa}-${mm}-${gg}`,
    quantita: document.getElementById('incQuantita').value,
    racchetta,
    cordeVerticali: getStringSelectValue('incCordeV'),
    cordeOrizzontali: getStringSelectValue('incCordeO'),
    coloreCorda: document.getElementById('incColoreCorda').value.trim(),
    lunghezzaCorda: getLengthValue('incMetodo', 'incLunghezzaCorda', 'incLunghezzaV', 'incLunghezzaO'),
    tensioneVerticali: document.getElementById('incTensioneV').value,
    tensioneOrizzontali: document.getElementById('incTensioneO').value,
    metodoLavoro: document.getElementById('incMetodo').value,
    prezzo: document.getElementById('incPrezzo').value,
    inConvenzione: document.getElementById('incInConvenzione').checked,
    cordaPropriaV: document.getElementById('incCordaPropriaV').checked,
    cordaPropriaO: document.getElementById('incCordaPropriaO').checked,
    note: document.getElementById('incNote').value
  };

  const res = await fetch(`/api/clients/${state.currentClient.id}/incordature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    showToast(err.error || 'Errore registrazione incordatura');
    return;
  }

  const data = await res.json();
  state.currentClient = data.client;
  renderClientDetail(true);
  document.getElementById('incDataGiorno').focus();
  showToast('Incordatura registrata!');
});

// Edit client
document.getElementById('btnToggleEditClient').addEventListener('click', () => {
  const c = state.currentClient;
  if (!c) return;
  document.getElementById('clientProfileBody').classList.remove('hidden');
  document.getElementById('profileToggleIcon').textContent = '▾';
  clientInfoView.classList.add('hidden');
  editClientForm.classList.remove('hidden');

  document.getElementById('editNome').value = c.nome || '';
  document.getElementById('editCognome').value = c.cognome || '';
  document.getElementById('editTelefono').value = c.telefono || '';
  document.getElementById('editEmail').value = c.email || '';
  setStringSelectValue('editCordeV', c.cordeVerticali || '');
  setStringSelectValue('editCordeO', c.cordeOrizzontali || '');
  document.getElementById('editColoreCorda').value = c.coloreCorda || '';
  document.getElementById('editMetodo').value = c.metodoLavoro || '';
  setLengthValue(c.lunghezzaCorda || '', 'editLunghezzaCorda', 'editLunghezzaV', 'editLunghezzaO', toggleEditLen);
  document.getElementById('editTensioneV').value = c.tensioneVerticali || '';
  document.getElementById('editTensioneO').value = c.tensioneOrizzontali || '';
  document.getElementById('editMetodo').value = c.metodoLavoro || '';
  document.getElementById('editPrezzo').value = c.prezzoDefault ?? '';
  document.getElementById('editNote').value = c.note || '';
  document.getElementById('editConvenzione').checked = Boolean(c.convenzioneAttiva);
  document.getElementById('editConvenzioneCorda').value = c.convenzioneCorda || '';
  document.getElementById('editConvenzionePrezzo').value = c.convenzionePrezzo ?? '';
  document.getElementById('editConvenzioneBox').classList.toggle('hidden', !c.convenzioneAttiva);
  document.getElementById('editCordaPropriaV').checked = Boolean(c.cordaPropriaV);
  document.getElementById('editCordaPropriaO').checked = Boolean(c.cordaPropriaO);

  editRacketsList.innerHTML = '';
  if (c.racchette && c.racchette.length) {
    c.racchette.forEach(r => createRacketRow(editRacketsList, r));
  } else {
    createRacketRow(editRacketsList);
  }
});

document.getElementById('btnCancelEditClient').addEventListener('click', () => {
  clientInfoView.classList.remove('hidden');
  editClientForm.classList.add('hidden');
});

document.getElementById('btnAddEditRacket').addEventListener('click', () => createRacketRow(editRacketsList));

editClientForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.currentClient) return;

  const payload = {
    nome: document.getElementById('editNome').value,
    cognome: document.getElementById('editCognome').value,
    telefono: document.getElementById('editTelefono').value,
    email: document.getElementById('editEmail').value,
    racchette: getRacketsFromContainer(editRacketsList),
    cordeVerticali: getStringSelectValue('editCordeV'),
    cordeOrizzontali: getStringSelectValue('editCordeO'),
    coloreCorda: document.getElementById('editColoreCorda').value.trim(),
    lunghezzaCorda: getLengthValue('editMetodo', 'editLunghezzaCorda', 'editLunghezzaV', 'editLunghezzaO'),
    tensioneVerticali: document.getElementById('editTensioneV').value,
    tensioneOrizzontali: document.getElementById('editTensioneO').value,
    metodoLavoro: document.getElementById('editMetodo').value,
    prezzoDefault: document.getElementById('editPrezzo').value,
    note: document.getElementById('editNote').value,
    convenzioneAttiva: document.getElementById('editConvenzione').checked,
    convenzioneCorda: document.getElementById('editConvenzioneCorda').value,
    convenzionePrezzo: document.getElementById('editConvenzionePrezzo').value,
    cordaPropriaV: document.getElementById('editCordaPropriaV').checked,
    cordaPropriaO: document.getElementById('editCordaPropriaO').checked
  };

  const res = await fetch(`/api/clients/${state.currentClient.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const data = await res.json();
    state.currentClient = data.client;
    renderClientDetail();
    showToast('Dati cliente aggiornati!');
  }
});

document.getElementById('newConvenzione').addEventListener('change', e => {
  document.getElementById('newConvenzioneBox').classList.toggle('hidden', !e.target.checked);
});

document.getElementById('editConvenzione').addEventListener('change', e => {
  document.getElementById('editConvenzioneBox').classList.toggle('hidden', !e.target.checked);
});

document.getElementById('incInConvenzione').addEventListener('change', e => {
  const c = state.currentClient;
  if (!c) return;
  if (e.target.checked && c.convenzioneAttiva && c.convenzionePrezzo) {
    document.getElementById('incPrezzo').value = (Number(c.convenzionePrezzo) / 17).toFixed(2);
  } else {
    document.getElementById('incPrezzo').value = c.prezzoDefault ?? '';
  }
});

function openEditIncordaturaModal(inc) {
  document.getElementById('editIncId').value = inc.id;
  document.getElementById('editIncData').value = inc.data || '';
  document.getElementById('editIncRacchetta').value = inc.racchetta || '';
  document.getElementById('editIncPrezzo').value = inc.prezzo ?? '';
  setStringSelectValue('editIncCordeV', inc.cordeVerticali || '');
  setStringSelectValue('editIncCordeO', inc.cordeOrizzontali || '');
  document.getElementById('editIncColoreCorda').value = inc.coloreCorda || '';
  document.getElementById('editIncLunghezzaCorda').value = inc.lunghezzaCorda || '';
  document.getElementById('editIncMetodo').value = inc.metodoLavoro || '';
  document.getElementById('editIncTensioneV').value = inc.tensioneVerticali || '';
  document.getElementById('editIncTensioneO').value = inc.tensioneOrizzontali || '';
  document.getElementById('editIncNote').value = inc.note || '';
  document.getElementById('editIncInConvenzione').checked = Boolean(inc.inConvenzione);
  document.getElementById('editIncCordaPropriaV').checked = Boolean(inc.cordaPropriaV);
  document.getElementById('editIncCordaPropriaO').checked = Boolean(inc.cordaPropriaO);
  document.getElementById('editIncModal').classList.remove('hidden');
}

function closeEditIncordaturaModal() {
  document.getElementById('editIncModal').classList.add('hidden');
}

document.getElementById('btnCloseEditIncModal').addEventListener('click', closeEditIncordaturaModal);
document.getElementById('btnCancelEditInc').addEventListener('click', closeEditIncordaturaModal);

document.getElementById('editIncForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.currentClient) return;
  const incId = document.getElementById('editIncId').value;
  const payload = {
    data: document.getElementById('editIncData').value,
    racchetta: document.getElementById('editIncRacchetta').value,
    prezzo: document.getElementById('editIncPrezzo').value,
    cordeVerticali: getStringSelectValue('editIncCordeV'),
    cordeOrizzontali: getStringSelectValue('editIncCordeO'),
    coloreCorda: document.getElementById('editIncColoreCorda').value.trim(),
    lunghezzaCorda: document.getElementById('editIncLunghezzaCorda').value.trim(),
    metodoLavoro: document.getElementById('editIncMetodo').value,
    tensioneVerticali: document.getElementById('editIncTensioneV').value,
    tensioneOrizzontali: document.getElementById('editIncTensioneO').value,
    note: document.getElementById('editIncNote').value,
    inConvenzione: document.getElementById('editIncInConvenzione').checked,
    cordaPropriaV: document.getElementById('editIncCordaPropriaV').checked,
    cordaPropriaO: document.getElementById('editIncCordaPropriaO').checked
  };

  const res = await fetch(`/api/clients/${state.currentClient.id}/incordature/${incId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const data = await res.json();
    state.currentClient = data.client;
    closeEditIncordaturaModal();
    renderClientDetail();
    showToast('Incordatura aggiornata!');
  } else {
    showToast('Errore aggiornamento incordatura');
  }
});

function linkVerticalToHorizontal(vertId, horizId) {
  const v = document.getElementById(vertId);
  const h = document.getElementById(horizId);
  if (!v || !h) return;
  let lastSynced = v.value;
  v.addEventListener('input', () => {
    if (h.value === '' || h.value === lastSynced) {
      h.value = v.value;
      h.dispatchEvent(new Event('input'));
    }
    lastSynced = v.value;
  });
}

linkVerticalToHorizontal('newCordeV', 'newCordeO');
linkVerticalToHorizontal('newTensioneV', 'newTensioneO');
linkVerticalToHorizontal('editCordeV', 'editCordeO');
linkVerticalToHorizontal('editTensioneV', 'editTensioneO');
linkVerticalToHorizontal('incCordeV', 'incCordeO');
linkVerticalToHorizontal('incTensioneV', 'incTensioneO');
linkVerticalToHorizontal('editIncCordeV', 'editIncCordeO');
linkVerticalToHorizontal('editIncTensioneV', 'editIncTensioneO');

function formatTensionKg(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('blur', () => {
    const val = el.value.trim();
    if (!val) return;
    if (!/kg$/i.test(val)) {
      el.value = `${val} Kg`;
    }
  });
}

['newTensioneV', 'newTensioneO', 'editTensioneV', 'editTensioneO', 'incTensioneV', 'incTensioneO', 'editIncTensioneV', 'editIncTensioneO'].forEach(formatTensionKg);

function formatLengthMt(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('blur', () => {
    const val = el.value.trim();
    if (!val) return;
    if (!/mt$/i.test(val)) {
      el.value = `${val.replace(/\s*kg$/i, '')} mt`;
    }
  });
}

[
  'newLunghezzaCorda', 'newLunghezzaV', 'newLunghezzaO',
  'editLunghezzaCorda', 'editLunghezzaV', 'editLunghezzaO',
  'incLunghezzaCorda', 'incLunghezzaV', 'incLunghezzaO',
  'editIncLunghezzaCorda'
].forEach(formatLengthMt);

function autoFillPriceFromStrings(vertId, horizId, priceInputId, convCheckboxId) {
  const vEl = document.getElementById(vertId);
  const hEl = document.getElementById(horizId);
  const priceEl = document.getElementById(priceInputId);
  if (!vEl || !hEl || !priceEl) return;

  const update = () => {
    if (convCheckboxId && document.getElementById(convCheckboxId)?.checked) return;
    const findPrice = name => {
      const clean = name.trim().toUpperCase();
      if (!clean) return null;
      const found = state.strings.find(s => s.nome.toUpperCase() === clean);
      return found && found.prezzo !== null && found.prezzo !== undefined ? Number(found.prezzo) : null;
    };
    const pV = findPrice(vEl.value);
    const pH = findPrice(hEl.value);
    if (pV !== null && pH !== null) {
      priceEl.value = ((pV + pH) / 2).toFixed(2);
    } else if (pV !== null) {
      priceEl.value = pV.toFixed(2);
    } else if (pH !== null) {
      priceEl.value = pH.toFixed(2);
    }
  };

  vEl.addEventListener('change', update);
  hEl.addEventListener('change', update);
}

autoFillPriceFromStrings('newCordeV', 'newCordeO', 'newPrezzo', 'newConvenzione');
autoFillPriceFromStrings('editCordeV', 'editCordeO', 'editPrezzo', 'editConvenzione');
autoFillPriceFromStrings('incCordeV', 'incCordeO', 'incPrezzo', 'incInConvenzione');
autoFillPriceFromStrings('editIncCordeV', 'editIncCordeO', 'editIncPrezzo', 'editIncInConvenzione');

function autoCheckCordaPropria(stringInputId, checkboxId) {
  const strEl = document.getElementById(stringInputId);
  const cbEl = document.getElementById(checkboxId);
  if (!strEl || !cbEl) return;
  const check = () => {
    const val = strEl.value.trim().toUpperCase();
    if (!val) return;
    const isRegistered = state.strings.some(s => s.nome.toUpperCase() === val);
    if (val === 'CORDA PROPRIA' || !isRegistered) {
      cbEl.checked = true;
      cbEl.dispatchEvent(new Event('change'));
    }
  };
  strEl.addEventListener('change', check);
  strEl.addEventListener('blur', check);
}

function autoSetMethodForCordaPropria(cbVId, cbOId, metodoId) {
  const cbV = document.getElementById(cbVId);
  const cbO = document.getElementById(cbOId);
  const mEl = document.getElementById(metodoId);
  if (!cbV || !cbO || !mEl) return;
  const update = () => {
    if (cbV.checked || cbO.checked) {
      mEl.value = '4 nodi standard';
      mEl.dispatchEvent(new Event('input'));
    }
  };
  cbV.addEventListener('change', update);
  cbO.addEventListener('change', update);
}

autoSetMethodForCordaPropria('newCordaPropriaV', 'newCordaPropriaO', 'newMetodo');
autoSetMethodForCordaPropria('editCordaPropriaV', 'editCordaPropriaO', 'editMetodo');
autoSetMethodForCordaPropria('incCordaPropriaV', 'incCordaPropriaO', 'incMetodo');
autoSetMethodForCordaPropria('editIncCordaPropriaV', 'editIncCordaPropriaO', 'editIncMetodo');

autoCheckCordaPropria('newCordeV', 'newCordaPropriaV');
autoCheckCordaPropria('newCordeO', 'newCordaPropriaO');
autoCheckCordaPropria('editCordeV', 'editCordaPropriaV');
autoCheckCordaPropria('editCordeO', 'editCordaPropriaO');
autoCheckCordaPropria('incCordeV', 'incCordaPropriaV');
autoCheckCordaPropria('incCordeO', 'incCordaPropriaO');
autoCheckCordaPropria('editIncCordeV', 'editIncCordaPropriaV');
autoCheckCordaPropria('editIncCordeO', 'editIncCordaPropriaO');

const BASE_COLORS = [
  { name: 'Nero', hex: '#1e1e1e' },
  { name: 'Bianco', hex: '#ffffff' },
  { name: 'Giallo', hex: '#fdd835' },
  { name: 'Giallo Fluo', hex: '#d4ff00' },
  { name: 'Arancione', hex: '#fb8c00' },
  { name: 'Rosso', hex: '#e53935' },
  { name: 'Blu', hex: '#1e88e5' },
  { name: 'Verde', hex: '#43a047' },
  { name: 'Grigio', hex: '#9e9e9e' },
  { name: 'Oro', hex: '#d4af37' },
  { name: 'Naturale', hex: '#f5ebd6' },
  { name: 'Rosa', hex: '#ec407a' },
  { name: 'Viola', hex: '#8e24aa' }
];

function setupColorPalette(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.removeAttribute('list');
  input.type = 'hidden';

  const wrap = document.createElement('div');
  wrap.className = 'color-picker-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const squareBtn = document.createElement('button');
  squareBtn.type = 'button';
  squareBtn.className = 'color-square-btn';
  squareBtn.setAttribute('tabindex', '-1');
  squareBtn.title = 'Colore Corda (clicca per scegliere)';

  const syncSquare = () => {
    const found = BASE_COLORS.find(c => c.name.toLowerCase() === (input.value || '').trim().toLowerCase());
    if (found) {
      squareBtn.style.background = found.hex;
      squareBtn.textContent = '';
      squareBtn.title = `Colore: ${found.name}`;
    } else {
      squareBtn.style.background = '#fff';
      squareBtn.textContent = '—';
      squareBtn.title = 'Nessun colore (clicca per scegliere)';
    }
  };
  syncSquare();
  wrap.appendChild(squareBtn);

  const popover = document.createElement('div');
  popover.className = 'color-popover hidden';

  BASE_COLORS.forEach(col => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch';
    btn.innerHTML = `<span class="color-dot" style="background:${col.hex}"></span><span>${col.name}</span>`;
    btn.onclick = () => {
      input.value = col.name;
      syncSquare();
      popover.classList.add('hidden');
    };
    popover.appendChild(btn);
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'color-swatch-clear';
  clearBtn.textContent = 'Nessuno (lascia vuoto)';
  clearBtn.onclick = () => {
    input.value = '';
    syncSquare();
    popover.classList.add('hidden');
  };
  popover.appendChild(clearBtn);

  wrap.appendChild(popover);

  squareBtn.addEventListener('click', e => {
    e.stopPropagation();
    const wasHidden = popover.classList.contains('hidden');
    document.querySelectorAll('.color-popover').forEach(p => p.classList.add('hidden'));
    if (wasHidden) popover.classList.remove('hidden');
  });
}

['newColoreCorda', 'editColoreCorda', 'incColoreCorda', 'editIncColoreCorda'].forEach(setupColorPalette);

document.addEventListener('click', e => {
  if (!e.target.closest('.color-picker-wrap')) {
    document.querySelectorAll('.color-popover').forEach(p => p.classList.add('hidden'));
  }
  if (!e.target.closest('.matassa-wrap')) {
    const mp = document.getElementById('matassaPopover');
    if (mp) mp.classList.add('hidden');
  }
});

document.getElementById('toggleProfileHeader').addEventListener('click', e => {
  if (e.target.closest('#btnToggleEditClient, #btnCopyClientLink, #btnPrintClientPdf, #btnDeleteClientKeepInc')) return;
  const body = document.getElementById('clientProfileBody');
  const isHidden = body.classList.toggle('hidden');
  document.getElementById('profileToggleIcon').textContent = isHidden ? '▸' : '▾';
});

document.getElementById('toggleNewIncHeader').addEventListener('click', () => {
  const body = document.getElementById('newIncBody');
  const isHidden = body.classList.toggle('hidden');
  document.getElementById('newIncToggleIcon').textContent = isHidden ? '▸' : '▾';
  if (!isHidden) {
    document.getElementById('incDataGiorno').focus();
  }
});

function populateNumericDatalists() {
  const lenList = document.getElementById('lunghezzaDatalist');
  if (lenList) {
    let opts = '';
    for (let v = 10; v <= 14.5 + 0.001; v += 0.5) {
      const label = `${String(v).replace('.', ',')} mt`;
      opts += `<option value="${label}"></option>`;
    }
    lenList.innerHTML = opts;
  }
  const tenList = document.getElementById('tensioneDatalist');
  if (tenList) {
    let opts = '';
    for (let v = 5; v <= 30 + 0.001; v += 0.5) {
      const label = `${String(v).replace('.', ',')} Kg`;
      opts += `<option value="${label}"></option>`;
    }
    tenList.innerHTML = opts;
  }
}

populateNumericDatalists();

function setupLengthSplit(metodoId, singleGroupId, vGroupId, oGroupId) {
  const mEl = document.getElementById(metodoId);
  const sGrp = document.getElementById(singleGroupId);
  const vGrp = document.getElementById(vGroupId);
  const oGrp = document.getElementById(oGroupId);
  if (!mEl || !sGrp || !vGrp || !oGrp) return;

  const toggle = () => {
    const is4Nodi = /4\s*nodi/i.test(mEl.value);
    sGrp.classList.toggle('hidden', is4Nodi);
    vGrp.classList.toggle('hidden', !is4Nodi);
    oGrp.classList.toggle('hidden', !is4Nodi);
  };
  mEl.addEventListener('input', toggle);
  mEl.addEventListener('change', toggle);
  return toggle;
}

const toggleNewLen = setupLengthSplit('newMetodo', 'newLunghezzaSingleGroup', 'newLunghezzaVGroup', 'newLunghezzaOGroup');
const toggleEditLen = setupLengthSplit('editMetodo', 'editLunghezzaSingleGroup', 'editLunghezzaVGroup', 'editLunghezzaOGroup');
const toggleIncLen = setupLengthSplit('incMetodo', 'incLunghezzaSingleGroup', 'incLunghezzaVGroup', 'incLunghezzaOGroup');

function getLengthValue(metodoId, singleId, vId, oId) {
  if (/4\s*nodi/i.test(document.getElementById(metodoId).value)) {
    const v = document.getElementById(vId).value.trim();
    const o = document.getElementById(oId).value.trim();
    if (!v && !o) return '';
    return `V: ${v || '-'} / O: ${o || '-'}`;
  }
  return document.getElementById(singleId).value.trim();
}

function setLengthValue(val, singleId, vId, oId, toggleFn) {
  const str = String(val || '').trim();
  const match = str.match(/^V:\s*(.*?)\s*\/\s*O:\s*(.*)$/i);
  if (match) {
    document.getElementById(vId).value = match[1] === '-' ? '' : match[1];
    document.getElementById(oId).value = match[2] === '-' ? '' : match[2];
    document.getElementById(singleId).value = '';
  } else {
    document.getElementById(singleId).value = str;
    document.getElementById(vId).value = '';
    document.getElementById(oId).value = '';
  }
  if (toggleFn) toggleFn();
}

document.getElementById('btnPickPrevSetting').addEventListener('click', () => {
  const c = state.currentClient;
  if (!c) return;
  const listEl = document.getElementById('prevSettingsList');
  listEl.innerHTML = '';

  const sorted = Array.isArray(c.incordature)
    ? [...c.incordature].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    : [];

  const seen = new Set();
  const uniqueSettings = [];
  sorted.forEach(inc => {
    const key = [
      inc.racchetta || '',
      inc.cordeVerticali || '',
      inc.cordeOrizzontali || '',
      inc.tensioneVerticali || '',
      inc.tensioneOrizzontali || '',
      inc.metodoLavoro || '',
      inc.lunghezzaCorda || '',
      inc.coloreCorda || '',
      inc.prezzo ?? ''
    ].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSettings.push(inc);
    }
  });

  if (uniqueSettings.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nessun settaggio precedente disponibile per questo cliente.</div>';
  } else {
    uniqueSettings.forEach(inc => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <div>
          <div class="result-name">🎾 ${escapeHtml(inc.racchetta || 'Racchetta non specificata')}</div>
          <div class="result-meta">
            🧵 ${escapeHtml(inc.cordeVerticali || '-')} / ${escapeHtml(inc.cordeOrizzontali || '-')} •
            ⚖️ ${escapeHtml(formatTensionDisplay(inc.tensioneVerticali))} / ${escapeHtml(formatTensionDisplay(inc.tensioneOrizzontali))}
            ${inc.metodoLavoro ? ` • ${escapeHtml(inc.metodoLavoro)}` : ''}
            ${inc.prezzo !== null && inc.prezzo !== undefined && inc.prezzo !== '' ? ` • <strong>${formatEuro(inc.prezzo)}</strong>` : ''}
          </div>
        </div>
        <span class="badge">${formatDateIT(inc.data)}</span>
      `;
      item.onclick = () => {
        applySettingToNewIncForm(inc, c);
        document.getElementById('prevSettingsModal').classList.add('hidden');
        showToast('Settaggio applicato!');
      };
      listEl.appendChild(item);
    });
  }

  document.getElementById('prevSettingsModal').classList.remove('hidden');
});

document.getElementById('btnClosePrevSettings').addEventListener('click', () => {
  document.getElementById('prevSettingsModal').classList.add('hidden');
});

function autoSet4NodiOnHybrid(vertId, horizId, metodoId) {
  const vEl = document.getElementById(vertId);
  const hEl = document.getElementById(horizId);
  const mEl = document.getElementById(metodoId);
  if (!vEl || !hEl || !mEl) return;
  const check = () => {
    const v = vEl.value.trim().toUpperCase();
    const h = hEl.value.trim().toUpperCase();
    if (v && h && v !== h) {
      mEl.value = '4 nodi standard';
      mEl.dispatchEvent(new Event('input'));
    }
  };
  vEl.addEventListener('change', check);
  hEl.addEventListener('change', check);
  hEl.addEventListener('blur', check);
}

autoSet4NodiOnHybrid('incCordeV', 'incCordeO', 'incMetodo');
autoSet4NodiOnHybrid('newCordeV', 'newCordeO', 'newMetodo');
autoSet4NodiOnHybrid('editCordeV', 'editCordeO', 'editMetodo');
autoSet4NodiOnHybrid('editIncCordeV', 'editIncCordeO', 'editIncMetodo');

['newClientForm', 'editClientForm', 'addIncordaturaForm', 'editIncForm'].forEach(formId => {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'textarea' || (tag === 'button' && e.target.type === 'submit')) return;

    const hasDropdown = e.target.hasAttribute('list') || tag === 'select';
    if ((formId === 'addIncordaturaForm' || formId === 'newClientForm') && !hasDropdown) {
      return; // allow normal Enter submit on non-dropdown fields
    }

    e.preventDefault();
    const focusables = Array.from(form.querySelectorAll('input, select, textarea, button'))
      .filter(el => !el.disabled && el.type !== 'hidden' && el.tabIndex !== -1 && el.offsetParent !== null);
    const idx = focusables.indexOf(e.target);
    if (idx > -1 && idx + 1 < focusables.length) {
      focusables[idx + 1].focus();
    }
  });
});

document.getElementById('btnCopyClientLink').addEventListener('click', async () => {
  if (!state.currentClient) return;
  const url = `${window.location.origin}/scheda.html?id=${encodeURIComponent(state.currentClient.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link scheda cliente copiato!');
  } catch {
    prompt('Copia questo link:', url);
  }
});

document.getElementById('btnPrintClientPdf').addEventListener('click', () => {
  if (!state.currentClient) return;
  window.open(`/scheda.html?id=${encodeURIComponent(state.currentClient.id)}&print=1`, '_blank');
});

document.getElementById('btnDeleteClientKeepInc').addEventListener('click', async () => {
  const c = state.currentClient;
  if (!c) return;
  if (!confirm(`Eliminare il cliente "${toTitleCase(`${c.cognome} ${c.nome}`)}" dal database mantenendo comunque salvate tutte le sue incordature nel registro?`)) {
    return;
  }
  const res = await fetch(`/api/clients/${c.id}?keepIncordature=1`, { method: 'DELETE' });
  if (res.ok) {
    state.currentClient = null;
    searchInput.value = '';
    showToast('Cliente eliminato (incordature mantenute nel registro)');
    showView('search');
  } else {
    showToast('Errore durante l\'eliminazione del cliente');
  }
});

let allClientsModalCache = [];

function renderAllClientsModalList() {
  const sortOrder = document.getElementById('allClientsSortSelect').value;
  const activityFilter = document.getElementById('allClientsActivitySelect').value;
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()).toISOString().split('T')[0];

  const isActiveLast12 = c => (c.incordature || []).some(i => (i.data || '') >= twelveMonthsAgo);

  let list = allClientsModalCache.filter(c => {
    if (activityFilter === 'active') return isActiveLast12(c);
    if (activityFilter === 'inactive') return !isActiveLast12(c);
    return true;
  });

  list.sort((a, b) => {
    const nameA = `${a.cognome || ''} ${a.nome || ''}`.trim();
    const nameB = `${b.cognome || ''} ${b.nome || ''}`.trim();
    const cmp = nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  document.getElementById('allClientsModalCount').textContent = list.length;
  const container = document.getElementById('allClientsModalList');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Nessun cliente corrisponde ai filtri selezionati.</div>';
    return;
  }

  list.forEach(c => {
    const count12 = (c.incordature || []).filter(i => (i.data || '') >= twelveMonthsAgo).length;
    const totalCount = (c.incordature || []).length;
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div>
        <div class="result-name">${escapeHtml(toTitleCase(`${c.cognome} ${c.nome}`))}</div>
        <div class="result-meta">
          ${count12 > 0 ? `<span style="color:var(--primary); font-weight:600;">Attivo (${count12} negli ultimi 12 mesi)</span>` : 'Non attivo negli ultimi 12 mesi'}
        </div>
      </div>
      <span class="badge">${totalCount} incordatur${totalCount === 1 ? 'a' : 'e'}</span>
    `;
    item.onclick = () => {
      document.getElementById('allClientsModal').classList.add('hidden');
      openClientDetail(c.id);
    };
    container.appendChild(item);
  });
}

async function openAllClientsModal() {
  const res = await fetch('/api/clients');
  if (res.ok) {
    const data = await res.json();
    allClientsModalCache = data.clienti || [];
  } else {
    allClientsModalCache = [];
  }
  renderAllClientsModalList();
  document.getElementById('allClientsModal').classList.remove('hidden');
}

document.getElementById('btnShowAllClients').addEventListener('click', openAllClientsModal);
document.getElementById('btnShowAllClientsMain').addEventListener('click', openAllClientsModal);
document.getElementById('btnCloseAllClientsModal').addEventListener('click', () => {
  document.getElementById('allClientsModal').classList.add('hidden');
});
document.getElementById('allClientsSortSelect').addEventListener('change', renderAllClientsModalList);
document.getElementById('allClientsActivitySelect').addEventListener('change', renderAllClientsModalList);

// Init
loadStringsCatalog().then(() => loadClients());
