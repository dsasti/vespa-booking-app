/**
 * Vespa Club Asti - Configurazione Centralizzata Pacchetti di Iscrizione
 * =========================================================================
 * Questo file è l'unica fonte di verità per i pacchetti disponibili.
 * Tutti gli altri moduli (prenotazione, dashboard, scanner) lo leggono.
 */

// Generatore universale di badge SVG per pacchetti
function createCustomBadgeSvg(code, color) {
  const safeCode = (code || 'C').toString().trim().toUpperCase().slice(0, 4);
  const bgColor = color || '#1D4ED8';
  let fontSize = 26;
  let letterSpacing = 'normal';
  if (safeCode.length === 2) {
    fontSize = 20;
    letterSpacing = '-1px';
  } else if (safeCode.length === 3) {
    fontSize = 15;
    letterSpacing = '-0.5px';
  } else if (safeCode.length >= 4) {
    fontSize = 12;
    letterSpacing = '-0.5px';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="22" height="22" style="vertical-align:middle;display:inline-block;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.25);margin-right:4px;">' +
    '<rect width="44" height="44" rx="8" fill="' + bgColor + '"/>' +
    '<rect x="1.5" y="1.5" width="41" height="41" rx="6.5" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>' +
    '<text x="22" y="' + (fontSize >= 20 ? 30 : 28) + '" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="' + fontSize + '" fill="#FFFFFF" letter-spacing="' + letterSpacing + '">' + safeCode + '</text>' +
    '</svg>';
}

const PACKAGE_BADGE_SVGS = {
  COMPLETA: createCustomBadgeSvg('C', '#1D4ED8'),
  FULL_SAB: createCustomBadgeSvg('SF', '#C2410C'),
  LIGHT_SAB: createCustomBadgeSvg('SL', '#EA580C'),
  FULL_DOM: createCustomBadgeSvg('DF', '#15803D'),
  LIGHT_DOM: createCustomBadgeSvg('DL', '#16A34A')
};

const VESPA_PACKAGES_DEFAULT = [
  {
    id: 'COMPLETA',
    code: 'C',
    badgeColor: '#1D4ED8',
    label: 'COMPLETA Sabato + Domenica',
    description: 'COMPLETA Sabato + Domenica (Gadget, Merenda Sab., Aperitivo Sab., Cena Sab., Colazione Dom., Aperitivo Dom., Pranzo Dom.)',
    defaultPrice: 95,
    emoji: '[C]',
    badgeSvg: PACKAGE_BADGE_SVGS.COMPLETA,
    includesSabato: true,
    includesDomenica: true,
    services: ['gadget', 'merendaSabato', 'aperitivoSabato', 'cena', 'colazioneDomenica', 'aperitivoDomenica', 'pranzo']
  },
  {
    id: 'FULL_SAB',
    code: 'SF',
    badgeColor: '#C2410C',
    label: 'FULL Sabato',
    description: 'FULL Sabato (Gadget, Merenda Sab., Aperitivo Sab., Cena Sab.)',
    defaultPrice: 60,
    emoji: '[SF]',
    badgeSvg: PACKAGE_BADGE_SVGS.FULL_SAB,
    includesSabato: true,
    includesDomenica: false,
    services: ['gadget', 'merendaSabato', 'aperitivoSabato', 'cena']
  },
  {
    id: 'LIGHT_SAB',
    code: 'SL',
    badgeColor: '#EA580C',
    label: 'LIGHT Sabato',
    description: 'LIGHT Sabato (Gadget, Merenda Sab., Aperitivo Sab.)',
    defaultPrice: 15,
    emoji: '[SL]',
    badgeSvg: PACKAGE_BADGE_SVGS.LIGHT_SAB,
    includesSabato: true,
    includesDomenica: false,
    services: ['gadget', 'merendaSabato', 'aperitivoSabato']
  },
  {
    id: 'FULL_DOM',
    code: 'DF',
    badgeColor: '#15803D',
    label: 'FULL Domenica',
    description: 'FULL Domenica (Gadget, Colazione Dom., Aperitivo Dom., Pranzo Dom.)',
    defaultPrice: 50,
    emoji: '[DF]',
    badgeSvg: PACKAGE_BADGE_SVGS.FULL_DOM,
    includesSabato: false,
    includesDomenica: true,
    services: ['gadget', 'colazioneDomenica', 'aperitivoDomenica', 'pranzo']
  },
  {
    id: 'LIGHT_DOM',
    code: 'DL',
    badgeColor: '#16A34A',
    label: 'LIGHT Domenica',
    description: 'LIGHT Domenica (Gadget, Colazione Dom., Aperitivo Dom.)',
    defaultPrice: 20,
    emoji: '[DL]',
    badgeSvg: PACKAGE_BADGE_SVGS.LIGHT_DOM,
    includesSabato: false,
    includesDomenica: true,
    services: ['gadget', 'colazioneDomenica', 'aperitivoDomenica']
  }
];

// Nomi/etichette personalizzabili dei servizi
const DEFAULT_SERVICES_LABELS = {
  gadget: '👕 Gadget',
  merendaSabato: '🧁 Merenda Sab.',
  aperitivoSabato: '🍹 Aperitivo Sab.',
  cena: '🍽️ Cena Sab.',
  colazioneDomenica: '🥐 Colazione Dom.',
  aperitivoDomenica: '🍸 Aperitivo Dom.',
  pranzo: '🥗 Pranzo Dom.'
};

const SERVICES_LABELS_KEY = 'vespa_services_labels_config';

function loadServicesLabelsConfig() {
  try {
    const raw = localStorage.getItem(SERVICES_LABELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SERVICES_LABELS, ...parsed };
    }
  } catch (e) {}
  return { ...DEFAULT_SERVICES_LABELS };
}

function saveServicesLabelsConfig(labelsMap) {
  try {
    localStorage.setItem(SERVICES_LABELS_KEY, JSON.stringify(labelsMap));
    localStorage.setItem(SERVICES_LABELS_KEY + '_pulse', Date.now().toString());
    if (window.vespaDB && typeof window.vespaDB.saveAppConfig === 'function') {
      window.vespaDB.saveAppConfig(SERVICES_LABELS_KEY, labelsMap);
    }
  } catch (e) {}
}

const SERVICE_DB_FIELDS = {
  gadget:            { field: 'ritiroGadget',              alias: 'kitGadgetConsegnato',       tsField: 'ritiroGadgetTimestamp',           label: '👕 Gadget' },
  merendaSabato:     { field: 'merendaSabatoErogata',      alias: 'merenda',                   tsField: 'merendaSabatoErogataTimestamp',   label: '🧁 Merenda Sab.' },
  aperitivoSabato:   { field: 'aperitivoSabatoErogato',    alias: 'aperitivoSabatoErogato',    tsField: 'aperitivoSabatoErogatomestamp',   label: '🍹 Aperitivo Sab.' },
  cena:              { field: 'cenaSabatoErogato',          alias: 'cena',                      tsField: 'cenaSabatoErogatoTimestamp',       label: '🍽️ Cena Sab.' },
  colazioneDomenica: { field: 'colazioneDomenicaErogata',  alias: 'colazioneDomenicaErogata',  tsField: 'colazioneDomenicaErogataTimestamp',label: '🥐 Colazione Dom.' },
  aperitivoDomenica: { field: 'aperitivoDomenicaErogato',  alias: 'aperitivoDomenicaErogato',  tsField: 'aperitivoDomenicaErogatoTimestamp',label: '🍸 Aperitivo Dom.' },
  pranzo:            { field: 'pranzoDomenicaErogato',     alias: 'pranzo',                    tsField: 'pranzoTimestamp',                 label: '🥗 Pranzo Dom.' }
};

function getServiceLabel(sKey) {
  const customMap = loadServicesLabelsConfig();
  if (customMap && customMap[sKey]) return customMap[sKey];
  return (SERVICE_DB_FIELDS[sKey] && SERVICE_DB_FIELDS[sKey].label) || sKey;
}

const PKG_CONFIG_KEY = 'vespa_packages_config';

/**
 * Carica l'array completo di pacchetti correnti (supporta aggiunta ed eliminazione).
 */
function loadPackagesConfig() {
  try {
    const raw = localStorage.getItem(PKG_CONFIG_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) {
        return saved.map(item => {
          const def = VESPA_PACKAGES_DEFAULT.find(p => p.id === item.id);
          const code = item.code || (def ? def.code : (item.id || 'C').slice(0, 2).toUpperCase());
          const badgeColor = item.badgeColor || (def ? def.badgeColor : '#1D4ED8');
          const defaultPrice = (def && def.defaultPrice != null) ? def.defaultPrice : (item.price || 0);
          return {
            id: item.id,
            code: code,
            badgeColor: badgeColor,
            badgeSvg: createCustomBadgeSvg(code, badgeColor),
            active: item.active !== false,
            price: (item.price != null && !isNaN(item.price)) ? Number(item.price) : defaultPrice,
            defaultPrice: defaultPrice,
            label: item.customLabel || item.label || (def ? def.label : item.id),
            customLabel: item.customLabel || item.label || (def ? def.label : item.id),
            emoji: '[' + code + ']',
            includesSabato: item.includesSabato !== undefined ? !!item.includesSabato : (def ? def.includesSabato : true),
            includesDomenica: item.includesDomenica !== undefined ? !!item.includesDomenica : (def ? def.includesDomenica : true),
            services: Array.isArray(item.customServices) ? item.customServices : (Array.isArray(item.services) ? item.services : (def ? def.services : []))
          };
        });
      }
    }
  } catch (e) {}

  return VESPA_PACKAGES_DEFAULT.map(pkg => ({
    ...pkg,
    active: true,
    price: pkg.defaultPrice,
    customLabel: pkg.label,
    customServices: [...pkg.services]
  }));
}

function savePackagesConfig(config) {
  try {
    localStorage.setItem(PKG_CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem('vespa_packages_config_pulse', Date.now().toString());
    if (window.vespaDB && typeof window.vespaDB.saveAppConfig === 'function') {
      window.vespaDB.saveAppConfig(PKG_CONFIG_KEY, config);
    }
  } catch (e) {}
}

function getActivePackages() {
  const pkgs = loadPackagesConfig();
  return pkgs.filter(p => p.active !== false);
}

function getPackageById(id) {
  if (!id) return null;
  const pkgs = loadPackagesConfig();
  const found = pkgs.find(p => p.id === id);
  if (found) return found;
  const def = VESPA_PACKAGES_DEFAULT.find(p => p.id === id);
  return def ? { ...def } : null;
}

function getBadgeHtml(pkgOrId) {
  const pkg = typeof pkgOrId === 'string' ? resolvePackageFromRegistration(pkgOrId) : pkgOrId;
  if (!pkg) return '';
  if (pkg.code && pkg.badgeColor) {
    return createCustomBadgeSvg(pkg.code, pkg.badgeColor);
  }
  if (PACKAGE_BADGE_SVGS[pkg.id]) {
    return PACKAGE_BADGE_SVGS[pkg.id];
  }
  return createCustomBadgeSvg(pkg.code || 'C', '#1D4ED8');
}

function getEventConfigDays() {
  try {
    const raw = localStorage.getItem('vespa_event_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.giorni) && parsed.giorni.length > 0) {
        return parsed.giorni;
      }
      if (parsed.dataSabato || parsed.dataDomenica) {
        return [
          { id: 'giorno_1', code: 'SABATO', name: 'Sabato', date: parsed.dataSabato || 'Sabato 20 Settembre 2026', icon: '🌙' },
          { id: 'giorno_2', code: 'DOMENICA', name: 'Domenica', date: parsed.dataDomenica || 'Domenica 21 Settembre 2026', icon: '☀️' }
        ];
      }
    }
  } catch(e) {}
  return [
    { id: 'giorno_1', code: 'SABATO', name: 'Sabato', date: 'Sabato 20 Settembre 2026', icon: '🌙' },
    { id: 'giorno_2', code: 'DOMENICA', name: 'Domenica', date: 'Domenica 21 Settembre 2026', icon: '☀️' }
  ];
}

function getPriceForRegistration(modalitaStr) {
  if (!modalitaStr) return 55;
  const pkg = getPackageById(modalitaStr.split('|')[0]);
  if (pkg) return pkg.price;

  const upper = modalitaStr.toUpperCase();
  if (upper.includes('COMPLETA')) return getPackageById('COMPLETA')?.price ?? 95;
  if (upper.includes('FULL_SAB') || (upper.includes('FULL') && upper.includes('SABATO') && !upper.includes('DOMENICA'))) return getPackageById('FULL_SAB')?.price ?? 60;
  if (upper.includes('FULL_DOM') || (upper.includes('FULL') && upper.includes('DOMENICA') && !upper.includes('SABATO'))) return getPackageById('FULL_DOM')?.price ?? 50;
  if (upper.includes('LIGHT_SAB') || (upper.includes('LIGHT') && upper.includes('SABATO'))) return getPackageById('LIGHT_SAB')?.price ?? 15;
  if (upper.includes('LIGHT_DOM') || (upper.includes('LIGHT') && upper.includes('DOMENICA'))) return getPackageById('LIGHT_DOM')?.price ?? 20;
  if (upper.includes('FULL 2 GIORNI') || upper.includes('55')) return 55;
  if (upper.includes('FULL SABATO') || upper.includes('35')) return 35;
  if (upper.includes('FULL DOMENICA') || upper.includes('45')) return 45;

  return 55;
}

function resolvePackageFromRegistration(modalitaStr) {
  if (!modalitaStr) return getPackageById('COMPLETA');
  const id = modalitaStr.split('|')[0];
  let pkg = getPackageById(id);
  if (pkg) return pkg;

  // Cerca per id o code nei pacchetti correnti
  const allCurrent = loadPackagesConfig();
  const matchCode = allCurrent.find(p => p.id === id || p.code === id || (p.label && modalitaStr.includes(p.label)));
  if (matchCode) return matchCode;

  const upper = modalitaStr.toUpperCase();
  if (upper.includes('COMPLETA')) return getPackageById('COMPLETA');
  if (upper.includes('FULL_SAB') || (upper.includes('FULL SABATO') && !upper.includes('DOM'))) return getPackageById('FULL_SAB');
  if (upper.includes('FULL_DOM') || (upper.includes('FULL DOMENICA') && !upper.includes('SAB'))) return getPackageById('FULL_DOM');
  if (upper.includes('LIGHT_SAB') || (upper.includes('LIGHT') && upper.includes('SAB'))) return getPackageById('LIGHT_SAB');
  if (upper.includes('LIGHT_DOM') || (upper.includes('LIGHT') && upper.includes('DOM'))) return getPackageById('LIGHT_DOM');

  if (upper.includes('FULL 2 GIORNI')) return getPackageById('COMPLETA');
  if (upper.includes('FULL SABATO'))   return getPackageById('FULL_SAB');
  if (upper.includes('FULL DOMENICA')) return getPackageById('FULL_DOM');

  return null;
}

function participantHasService(record, serviceKey) {
  const pkg = resolvePackageFromRegistration(record.modalitaPartecipazione);
  if (!pkg) return true;
  return Array.isArray(pkg.services) ? pkg.services.includes(serviceKey) : true;
}

function packageIncludesSabato(modalitaStr) {
  const pkg = resolvePackageFromRegistration(modalitaStr);
  if (pkg) return !!pkg.includesSabato;
  const upper = (modalitaStr || '').toUpperCase();
  return upper.includes('SABATO') || upper.includes('FULL 2 GIORNI') || upper.includes('COMPLETA');
}

function packageIncludesDomenica(modalitaStr) {
  const pkg = resolvePackageFromRegistration(modalitaStr);
  if (pkg) return !!pkg.includesDomenica;
  const upper = (modalitaStr || '').toUpperCase();
  return upper.includes('DOMENICA') || upper.includes('FULL 2 GIORNI') || upper.includes('COMPLETA');
}

function packageIncludesDay(modalitaStr, dayIdentifier) {
  if (!dayIdentifier) return true;
  const target = dayIdentifier.toString().toUpperCase();
  const pkg = resolvePackageFromRegistration(modalitaStr);
  const upper = (modalitaStr || '').toUpperCase();

  if (upper.includes('COMPLETA') || upper.includes('FULL 2 GIORNI') || (pkg && pkg.id === 'COMPLETA')) {
    return true;
  }
  if (target === 'SABATO' || target === 'GIORNO_1' || target === 'GIORNO 1') {
    return packageIncludesSabato(modalitaStr);
  }
  if (target === 'DOMENICA' || target === 'GIORNO_2' || target === 'GIORNO 2') {
    return packageIncludesDomenica(modalitaStr);
  }
  if (upper.includes(target)) return true;
  return true;
}

if (typeof window !== 'undefined') {
  window.VespaPkg = {
    PACKAGES: VESPA_PACKAGES_DEFAULT,
    PACKAGE_BADGE_SVGS,
    createCustomBadgeSvg,
    getBadgeHtml,
    SERVICE_DB_FIELDS,
    DEFAULT_SERVICES_LABELS,
    loadServicesLabelsConfig,
    saveServicesLabelsConfig,
    getServiceLabel,
    loadPackagesConfig,
    savePackagesConfig,
    getActivePackages,
    getPackageById,
    getPriceForRegistration,
    resolvePackageFromRegistration,
    participantHasService,
    packageIncludesSabato,
    packageIncludesDomenica,
    packageIncludesDay,
    getEventConfigDays
  };
}

/**
 * Gestione Interfaccia Dashboard per Configurazione Pacchetti, Prezzi, Sigle & Nomi Servizi
 */
window.vespaPackagesUI = {
  _workingPackages: null,

  init() {
    this._workingPackages = loadPackagesConfig();
    this.render();
  },

  render() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('packagesConfigGrid');
    if (!grid) return;

    if (!this._workingPackages) {
      this._workingPackages = loadPackagesConfig();
    }
    const packages = this._workingPackages;
    const allServiceKeys = Object.keys(SERVICE_DB_FIELDS);
    const serviceLabels = loadServicesLabelsConfig();

    let packagesHtml = packages.map((pkg, idx) => {
      const isActive = pkg.active !== false;
      const currentPrice = (pkg.price !== undefined && pkg.price !== null && !isNaN(pkg.price)) ? Number(pkg.price) : (pkg.defaultPrice || 0);
      const currentLabel = pkg.label || pkg.customLabel || pkg.id;
      const currentCode = (pkg.code || pkg.id || 'C').toString().toUpperCase();
      const currentColor = pkg.badgeColor || '#1D4ED8';
      const currentServices = Array.isArray(pkg.services) ? pkg.services : (pkg.customServices || []);
      const badgePreviewSvg = createCustomBadgeSvg(currentCode, currentColor);

      const servicesCheckboxes = allServiceKeys.map(sKey => {
        const checked = currentServices.includes(sKey);
        const sLabel = serviceLabels[sKey] || (SERVICE_DB_FIELDS[sKey] && SERVICE_DB_FIELDS[sKey].label) || sKey;
        return '<label style="display:flex; align-items:center; gap:0.4rem; font-size:0.78rem; font-weight:600; color:#1E293B; cursor:pointer; padding:0.25rem 0.5rem; border-radius:6px; border:1px solid ' + (checked ? '#86EFAC' : '#E2E8F0') + '; background:' + (checked ? '#F0FDF4' : '#F8FAFC') + '; white-space:nowrap;">' +
          '<input type="checkbox" id="pkg-svc-' + pkg.id + '-' + sKey + '" ' + (checked ? 'checked' : '') + ' onchange="window.vespaPackagesUI.updateWorkingField(' + idx + ', \'services\')" style="accent-color:#10B981; cursor:pointer;">' +
          sLabel +
        '</label>';
      }).join('');

      return '<div class="pkg-card" style="background:#FFF; border:2px solid ' + (isActive ? '#10B981' : '#E2E8F0') + '; border-radius:14px; padding:1.25rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:space-between; transition:all 0.25s ease; ' + (isActive ? '' : 'opacity:0.78; background:#F8FAFC;') + '">' +
        '<div>' +
          '<!-- Intestazione Pacchetto con ID e badge di stato -->' +
          '<div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">' +
            '<div style="font-size:0.85rem; font-weight:800; color:#64748B; font-family:monospace;">ID: ' + pkg.id + '</div>' +
            '<div style="display:flex; align-items:center; gap:0.4rem;">' +
              '<span style="font-size:0.75rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:999px; white-space:nowrap; background:' + (isActive ? '#DCFCE7' : '#FEE2E2') + '; color:' + (isActive ? '#15803D' : '#B91C1C') + '; border:1px solid ' + (isActive ? '#86EFAC' : '#FCA5A5') + ';">' +
                (isActive ? '✅ ATTIVO' : '⛔ DISATTIVATO') +
              '</span>' +
              '<button type="button" onclick="window.vespaPackagesUI.deletePackage(\'' + pkg.id + '\')" title="Elimina Pacchetto" style="background:#FEE2E2; border:1px solid #FCA5A5; color:#DC2626; border-radius:6px; padding:0.2rem 0.5rem; font-size:0.75rem; font-weight:800; cursor:pointer;">' +
                '🗑️' +
              '</button>' +
            '</div>' +
          '</div>' +

          '<!-- RIGA BADGE & SIGLA EDITABILE -->' +
          '<div style="background:#F1F5F9; border:1.5px solid #CBD5E1; border-radius:10px; padding:0.6rem 0.8rem; margin-bottom:0.85rem; display:flex; align-items:center; justify-content:space-between; gap:0.75rem;">' +
            '<div style="display:flex; align-items:center; gap:0.6rem;">' +
              '<span id="badge-preview-' + pkg.id + '">' + badgePreviewSvg + '</span>' +
              '<div>' +
                '<label style="font-size:0.7rem; font-weight:800; color:#475569; text-transform:uppercase; display:block;">Sigla Badge</label>' +
                '<input type="text" id="pkg-code-' + pkg.id + '" value="' + currentCode + '" maxlength="4" oninput="window.vespaPackagesUI.updateBadgePreview(\'' + pkg.id + '\', ' + idx + ')" style="width:55px; padding:0.25rem 0.45rem; border:1.5px solid #94A3B8; border-radius:6px; font-size:0.88rem; font-weight:900; text-align:center; color:#1E293B; text-transform:uppercase;">' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:0.7rem; font-weight:800; color:#475569; text-transform:uppercase; display:block;">Colore Badge</label>' +
              '<input type="color" id="pkg-color-' + pkg.id + '" value="' + currentColor + '" oninput="window.vespaPackagesUI.updateBadgePreview(\'' + pkg.id + '\', ' + idx + ')" style="width:45px; height:32px; padding:2px; border:1.5px solid #94A3B8; border-radius:6px; cursor:pointer;">' +
            '</div>' +
          '</div>' +

          '<!-- Nome personalizzabile -->' +
          '<div style="margin-bottom:0.75rem;">' +
            '<label for="pkg-label-' + pkg.id + '" style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:0.3rem;">' +
              '📛 Nome Pacchetto' +
            '</label>' +
            '<input type="text" id="pkg-label-' + pkg.id + '" value="' + currentLabel.replace(/"/g, '&quot;') + '" oninput="window.vespaPackagesUI.updateWorkingField(' + idx + ', \'label\')" placeholder="Es. Pacchetto Completo" style="width:100%; padding:0.45rem 0.7rem; border:1.5px solid #cbd5e1; border-radius:8px; font-size:0.88rem; font-weight:700; box-sizing:border-box; color:var(--vespa-blue-dark);">' +
          '</div>' +

          '<!-- Giornate incluse -->' +
          '<div style="margin-bottom:0.75rem; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:0.5rem 0.75rem; display:flex; gap:1rem; align-items:center;">' +
            '<span style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Giorni:</span>' +
            '<label style="font-size:0.8rem; font-weight:700; color:#1E293B; display:flex; align-items:center; gap:0.3rem; cursor:pointer;">' +
              '<input type="checkbox" id="pkg-sabato-' + pkg.id + '" ' + (pkg.includesSabato ? 'checked' : '') + ' onchange="window.vespaPackagesUI.updateWorkingField(' + idx + ', \'includesSabato\')" style="accent-color:#1D4ED8;"> Sabato' +
            '</label>' +
            '<label style="font-size:0.8rem; font-weight:700; color:#1E293B; display:flex; align-items:center; gap:0.3rem; cursor:pointer;">' +
              '<input type="checkbox" id="pkg-domenica-' + pkg.id + '" ' + (pkg.includesDomenica ? 'checked' : '') + ' onchange="window.vespaPackagesUI.updateWorkingField(' + idx + ', \'includesDomenica\')" style="accent-color:#1D4ED8;"> Domenica' +
            '</label>' +
          '</div>' +

          '<!-- Servizi Inclusi (checkboxes editabili) -->' +
          '<div style="margin-bottom:0.75rem;">' +
            '<div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.4rem;">' +
              '✅ Servizi Inclusi nel Pacchetto:' +
            '</div>' +
            '<div style="display:flex; flex-wrap:wrap; gap:0.35rem; line-height:1.8;">' + servicesCheckboxes + '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Sezione Controlli Organizzatore (Attiva/Disattiva & Prezzo) -->' +
        '<div style="border-top:1px solid #E2E8F0; padding-top:1rem; margin-top:0.75rem; display:flex; flex-direction:column; gap:0.85rem;">' +
          '<div style="display:flex; align-items:center; justify-content:space-between; background:#F8FAFC; padding:0.6rem 0.85rem; border-radius:10px; border:1px solid #E2E8F0;">' +
            '<div>' +
              '<label for="pkg-toggle-' + pkg.id + '" style="font-size:0.88rem; font-weight:800; color:#1E293B; cursor:pointer; margin:0; display:block;">' +
                'Disponibile per Prenotazione' +
              '</label>' +
              '<span style="font-size:0.75rem; color:var(--text-muted);">' +
                (isActive ? 'Visibile agli iscritti nel modulo' : 'Nascosto nel modulo di prenotazione') +
              '</span>' +
            '</div>' +
            '<label style="position:relative; display:inline-block; width:48px; height:26px; margin:0; cursor:pointer;">' +
              '<input type="checkbox" id="pkg-toggle-' + pkg.id + '" ' + (isActive ? 'checked' : '') + ' onchange="window.vespaPackagesUI.onToggleChange(\'' + pkg.id + '\', this.checked)" style="opacity:0; width:0; height:0;">' +
              '<span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:' + (isActive ? '#10B981' : '#CBD5E1') + '; transition:.3s; border-radius:26px;">' +
                '<span style="position:absolute; content:\'\'; height:20px; width:20px; left:' + (isActive ? '24px' : '3px') + '; bottom:3px; background-color:white; transition:.3s; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
              '</span>' +
            '</label>' +
          '</div>' +

          '<div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; background:#F8FAFC; padding:0.6rem 0.85rem; border-radius:10px; border:1px solid #E2E8F0;">' +
            '<div>' +
              '<label for="pkg-price-' + pkg.id + '" style="font-size:0.88rem; font-weight:800; color:#1E293B; margin:0; display:block;">' +
                'Quota Iscrizione (€)' +
              '</label>' +
              '<span style="font-size:0.75rem; color:var(--text-muted);">' +
                'Default listino: € ' + (pkg.defaultPrice || currentPrice) +
              '</span>' +
            '</div>' +
            '<div style="display:flex; align-items:center; gap:0.4rem;">' +
              '<input type="number" id="pkg-price-' + pkg.id + '" min="0" max="999" step="1" value="' + currentPrice + '" onchange="window.vespaPackagesUI.onPriceChange(\'' + pkg.id + '\', this.value)" style="width:85px; padding:0.45rem 0.6rem; font-size:1.05rem; font-weight:800; border-radius:8px; border:1.5px solid var(--vespa-blue); text-align:right; color:var(--vespa-blue-dark); background:#FFF;">' +
              '<span style="font-size:1rem; font-weight:800; color:var(--vespa-blue-dark);">€</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.innerHTML = packagesHtml;
    this.renderServicesLabelsEditor();
  },

  renderServicesLabelsEditor() {
    const container = document.getElementById('servicesLabelsConfigContainer');
    if (!container) return;
    const allServiceKeys = Object.keys(SERVICE_DB_FIELDS);
    const serviceLabels = loadServicesLabelsConfig();

    let html = '<div style="background:#F8FAFC; border:1.5px solid #CBD5E1; border-radius:12px; padding:1.25rem; margin-top:1.5rem;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">' +
        '<div>' +
          '<h3 style="margin:0; font-size:0.95rem; font-weight:800; color:var(--vespa-blue-dark); display:flex; align-items:center; gap:0.4rem;">' +
            '🏷️ Modifica Nomi dei Servizi Inclusi' +
          '</h3>' +
          '<p style="margin:3px 0 0 0; font-size:0.78rem; color:var(--text-muted);">' +
            'Personalizza le etichette dei pasti, gadget e servizi mostrati nelle caselle dei pacchetti e in tutta l\'app.' +
          '</p>' +
        '</div>' +
        '<button type="button" onclick="window.vespaPackagesUI.resetServicesLabelsToDefault()" class="btn btn-sm" style="background:transparent; border:1px solid #CBD5E1; color:#64748B; font-size:0.75rem; font-weight:700; cursor:pointer;">' +
          'Ripristina Nomi Default' +
        '</button>' +
      '</div>' +
      '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">';

    allServiceKeys.forEach(sKey => {
      const currentVal = serviceLabels[sKey] || (SERVICE_DB_FIELDS[sKey] && SERVICE_DB_FIELDS[sKey].label) || sKey;
      html += '<div style="background:#FFF; border:1px solid #E2E8F0; border-radius:8px; padding:0.5rem 0.75rem;">' +
        '<label style="font-size:0.72rem; font-weight:800; color:#64748B; text-transform:uppercase; display:block; margin-bottom:0.25rem;">' + sKey + '</label>' +
        '<input type="text" id="svc-label-input-' + sKey + '" value="' + currentVal.replace(/"/g, '&quot;') + '" style="width:100%; padding:0.35rem 0.5rem; border:1.5px solid #CBD5E1; border-radius:6px; font-size:0.85rem; font-weight:700; color:#1E293B; box-sizing:border-box;">' +
      '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
  },

  updateBadgePreview(id, idx) {
    const codeInput = document.getElementById('pkg-code-' + id);
    const colorInput = document.getElementById('pkg-color-' + id);
    const previewSpan = document.getElementById('badge-preview-' + id);
    if (!codeInput || !colorInput || !previewSpan) return;
    const code = (codeInput.value || 'C').toUpperCase();
    const color = colorInput.value || '#1D4ED8';
    previewSpan.innerHTML = createCustomBadgeSvg(code, color);

    if (this._workingPackages && this._workingPackages[idx]) {
      this._workingPackages[idx].code = code;
      this._workingPackages[idx].badgeColor = color;
      this._workingPackages[idx].badgeSvg = createCustomBadgeSvg(code, color);
      this._workingPackages[idx].emoji = '[' + code + ']';
    }
  },

  updateWorkingField(idx, field) {
    if (!this._workingPackages || !this._workingPackages[idx]) return;
    const pkg = this._workingPackages[idx];
    if (field === 'label') {
      const el = document.getElementById('pkg-label-' + pkg.id);
      if (el) pkg.label = el.value.trim();
    } else if (field === 'includesSabato') {
      const el = document.getElementById('pkg-sabato-' + pkg.id);
      if (el) pkg.includesSabato = el.checked;
    } else if (field === 'includesDomenica') {
      const el = document.getElementById('pkg-domenica-' + pkg.id);
      if (el) pkg.includesDomenica = el.checked;
    } else if (field === 'services') {
      const allServiceKeys = Object.keys(SERVICE_DB_FIELDS);
      pkg.services = allServiceKeys.filter(sKey => {
        const cb = document.getElementById('pkg-svc-' + pkg.id + '-' + sKey);
        return cb ? cb.checked : false;
      });
    }
  },

  addNewPackage() {
    this.collectCurrentUIState();
    if (!this._workingPackages) this._workingPackages = loadPackagesConfig();

    const newId = 'PKG_' + Date.now().toString().slice(-4);
    const newPkg = {
      id: newId,
      code: 'P' + (this._workingPackages.length + 1),
      badgeColor: '#7C3AED',
      badgeSvg: createCustomBadgeSvg('P' + (this._workingPackages.length + 1), '#7C3AED'),
      active: true,
      price: 40,
      defaultPrice: 40,
      label: 'Nuovo Pacchetto ' + (this._workingPackages.length + 1),
      customLabel: 'Nuovo Pacchetto ' + (this._workingPackages.length + 1),
      emoji: '[P' + (this._workingPackages.length + 1) + ']',
      includesSabato: true,
      includesDomenica: false,
      services: ['gadget', 'merendaSabato', 'aperitivoSabato']
    };

    this._workingPackages.push(newPkg);
    this.render();

    if (window.app && window.app.showToast) {
      window.app.showToast('➕ Nuovo pacchetto aggiunto! Personalizza nome, sigla e servizi e clicca "💾 Salva tutto".', 'info');
    }
  },

  deletePackage(id) {
    if (!confirm('Sei sicuro di voler eliminare il pacchetto "' + id + '"? Le iscrizioni già registrate non verranno cancellate ma il pacchetto non sarà più selezionabile.')) {
      return;
    }
    this.collectCurrentUIState();
    if (!this._workingPackages) this._workingPackages = loadPackagesConfig();
    this._workingPackages = this._workingPackages.filter(p => p.id !== id);
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast('🗑️ Pacchetto rimosso. Ricordati di cliccare "💾 Salva tutto" per confermare definitivamente.', 'warning');
    }
  },

  resetServicesLabelsToDefault() {
    if (!confirm('Ripristinare i nomi default per tutti i servizi?')) return;
    saveServicesLabelsConfig(DEFAULT_SERVICES_LABELS);
    this.renderServicesLabelsEditor();
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast('↺ Nomi servizi ripristinati ai valori di default.', 'info');
    }
  },

  collectCurrentUIState() {
    if (!this._workingPackages) return;
    const allServiceKeys = Object.keys(SERVICE_DB_FIELDS);

    this._workingPackages.forEach((pkg, idx) => {
      const codeEl = document.getElementById('pkg-code-' + pkg.id);
      const colorEl = document.getElementById('pkg-color-' + pkg.id);
      const labelEl = document.getElementById('pkg-label-' + pkg.id);
      const sabEl = document.getElementById('pkg-sabato-' + pkg.id);
      const domEl = document.getElementById('pkg-domenica-' + pkg.id);
      const priceEl = document.getElementById('pkg-price-' + pkg.id);
      const toggleEl = document.getElementById('pkg-toggle-' + pkg.id);

      if (codeEl) pkg.code = (codeEl.value || 'C').toUpperCase();
      if (colorEl) pkg.badgeColor = colorEl.value || '#1D4ED8';
      if (labelEl) pkg.label = labelEl.value.trim() || pkg.label;
      if (sabEl) pkg.includesSabato = sabEl.checked;
      if (domEl) pkg.includesDomenica = domEl.checked;
      if (priceEl) pkg.price = Math.max(0, parseInt(priceEl.value, 10) || 0);
      if (toggleEl) pkg.active = toggleEl.checked;

      const hasSvcInputs = allServiceKeys.some(sKey => document.getElementById('pkg-svc-' + pkg.id + '-' + sKey));
      if (hasSvcInputs) {
        pkg.services = allServiceKeys.filter(sKey => {
          const cb = document.getElementById('pkg-svc-' + pkg.id + '-' + sKey);
          return cb ? cb.checked : false;
        });
      }

      pkg.customLabel = pkg.label;
      pkg.customServices = [...pkg.services];
      pkg.badgeSvg = createCustomBadgeSvg(pkg.code, pkg.badgeColor);
      pkg.emoji = '[' + pkg.code + ']';
    });
  },

  onToggleChange(id, checked) {
    if (this._workingPackages) {
      const item = this._workingPackages.find(c => c.id === id);
      if (item) item.active = checked;
    }
    const config = loadPackagesConfig();
    const item = config.find(c => c.id === id);
    if (item) item.active = checked;
    savePackagesConfig(config);
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast(checked ? '✅ Pacchetto attivato: compare nella scheda prenotazioni.' : '⛔ Pacchetto disattivato: nascosto dalle nuove prenotazioni.', checked ? 'success' : 'info');
    }
  },

  onPriceChange(id, newPrice) {
    const priceNum = Math.max(0, parseInt(newPrice, 10) || 0);
    if (this._workingPackages) {
      const item = this._workingPackages.find(c => c.id === id);
      if (item) item.price = priceNum;
    }
    const config = loadPackagesConfig();
    const item = config.find(c => c.id === id);
    if (item) item.price = priceNum;
    savePackagesConfig(config);
    if (window.app && window.app.showToast) {
      window.app.showToast('💶 Quota per "' + id + '" aggiornata a € ' + priceNum + '.', 'success');
    }
  },

  saveConfig() {
    this.collectCurrentUIState();
    if (!this._workingPackages) this._workingPackages = loadPackagesConfig();

    const allServiceKeys = Object.keys(SERVICE_DB_FIELDS);
    const newLabels = {};
    allServiceKeys.forEach(sKey => {
      const inp = document.getElementById('svc-label-input-' + sKey);
      if (inp && inp.value.trim()) {
        newLabels[sKey] = inp.value.trim();
      }
    });
    if (Object.keys(newLabels).length > 0) {
      saveServicesLabelsConfig(newLabels);
    }

    savePackagesConfig(this._workingPackages);
    this.render();

    if (window.vespaAdmin && typeof window.vespaAdmin.updateBadgeLegendAndFilters === 'function') {
      window.vespaAdmin.updateBadgeLegendAndFilters();
    }

    if (window.app && window.app.showToast) {
      window.app.showToast('💾 Configurazione pacchetti, sigle, badge e servizi salvata con successo!', 'success');
    } else {
      alert('Configurazione pacchetti salvata con successo!');
    }
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('packagesConfigGrid')) {
      window.vespaPackagesUI.init();
    }
  });
}
