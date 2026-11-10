/**
 * Vespa Club Asti - Configurazione Centralizzata Pacchetti di Iscrizione
 * =========================================================================
 * Questo file è l'unica fonte di verità per i pacchetti disponibili.
 * Tutti gli altri moduli (prenotazione, dashboard, scanner) lo leggono.
 *
 * STRUTTURA PACCHETTO:
 *   id          : chiave univoca interna (usata nei record DB)
 *   label       : nome breve per la UI
 *   description : descrizione completa con servizi inclusi
 *   defaultPrice: prezzo di listino (€)
 *   emoji       : emoji rappresentativa
 *   includesSabato   : partecipazione al sabato
 *   includesDomenica : partecipazione alla domenica
 *   services    : elenco dei campi DB dei servizi inclusi
 */

const PACKAGE_BADGE_SVGS = {
  COMPLETA: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="22" height="22" style="vertical-align:middle;display:inline-block;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.18);margin-right:4px;"><defs><linearGradient id="gC" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1D4ED8"/><stop offset="100%" stop-color="#1E40AF"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#gC)"/><rect x="1.5" y="1.5" width="41" height="41" rx="6.5" fill="none" stroke="#BFDBFE" stroke-width="2"/><text x="22" y="31" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="26" fill="#FFFFFF">C</text></svg>',
  FULL_SAB: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="22" height="22" style="vertical-align:middle;display:inline-block;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.18);margin-right:4px;"><defs><linearGradient id="gSF" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C2410C"/><stop offset="100%" stop-color="#9A3412"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#gSF)"/><rect x="1.5" y="1.5" width="41" height="41" rx="6.5" fill="none" stroke="#FDBA74" stroke-width="2"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">SF</text></svg>',
  LIGHT_SAB: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="22" height="22" style="vertical-align:middle;display:inline-block;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.18);margin-right:4px;"><defs><linearGradient id="gSL" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EA580C"/><stop offset="100%" stop-color="#C2410C"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#gSL)"/><rect x="1.5" y="1.5" width="41" height="41" rx="6.5" fill="none" stroke="#FED7AA" stroke-width="2"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">SL</text></svg>',
  FULL_DOM: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="22" height="22" style="vertical-align:middle;display:inline-block;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.18);margin-right:4px;"><defs><linearGradient id="gDF" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#15803D"/><stop offset="100%" stop-color="#166534"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#gDF)"/><rect x="1.5" y="1.5" width="41" height="41" rx="6.5" fill="none" stroke="#86EFAC" stroke-width="2"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">DF</text></svg>',
  LIGHT_DOM: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="22" height="22" style="vertical-align:middle;display:inline-block;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.18);margin-right:4px;"><defs><linearGradient id="gDL" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#16A34A"/><stop offset="100%" stop-color="#15803D"/></linearGradient></defs><rect width="44" height="44" rx="8" fill="url(#gDL)"/><rect x="1.5" y="1.5" width="41" height="41" rx="6.5" fill="none" stroke="#BBF7D0" stroke-width="2"/><text x="22" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing="-1">DL</text></svg>'
};

const VESPA_PACKAGES_DEFAULT = [
  {
    id: 'COMPLETA',
    code: 'C',
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

function getBadgeHtml(pkgOrId) {
  const pkg = typeof pkgOrId === 'string' ? resolvePackageFromRegistration(pkgOrId) : pkgOrId;
  if (!pkg) return '';
  return PACKAGE_BADGE_SVGS[pkg.id] || `<span style="display:inline-block; font-size:0.75rem; font-weight:900; padding:1px 5px; border-radius:4px; background:#1E40AF; color:#FFF;">${pkg.code || 'C'}</span>`;
}

/**
 * Mappa servizio-ID → campo DB effettivo (canonical)
 * Usata per leggere/scrivere correttamente sul record partecipante.
 */
const SERVICE_DB_FIELDS = {
  gadget:            { field: 'ritiroGadget',              alias: 'kitGadgetConsegnato',       tsField: 'ritiroGadgetTimestamp',           label: '👕 Gadget' },
  merendaSabato:     { field: 'merendaSabatoErogata',      alias: 'merenda',                   tsField: 'merendaSabatoErogataTimestamp',   label: '🧁 Merenda Sab.' },
  aperitivoSabato:   { field: 'aperitivoSabatoErogato',    alias: 'aperitivoSabatoErogato',    tsField: 'aperitivoSabatoErogatomestamp',   label: '🍹 Aperitivo Sab.' },
  cena:              { field: 'cenaSabatoErogato',          alias: 'cena',                      tsField: 'cenaSabatoErogatoTimestamp',       label: '🍽️ Cena Sab.' },
  colazioneDomenica: { field: 'colazioneDomenicaErogata',  alias: 'colazioneDomenicaErogata',  tsField: 'colazioneDomenicaErogataTimestamp',label: '🥐 Colazione Dom.' },
  aperitivoDomenica: { field: 'aperitivoDomenicaErogato',  alias: 'aperitivoDomenicaErogato',  tsField: 'aperitivoDomenicaErogatoTimestamp',label: '🍸 Aperitivo Dom.' },
  pranzo:            { field: 'pranzoDomenicaErogato',     alias: 'pranzo',                    tsField: 'pranzoTimestamp',                 label: '🥗 Pranzo Dom.' }
};

// ─── Chiave LocalStorage per configurazione organizzatore ───────────────────
const PKG_CONFIG_KEY = 'vespa_packages_config';

/**
 * Legge la configurazione corrente dall'organizzatore.
 * Ritorna array di { id, active, price } con fallback ai default.
 */
function loadPackagesConfig() {
  try {
    const raw = localStorage.getItem(PKG_CONFIG_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Merge: pacchetti nuovi non in config ricevono i default
      return VESPA_PACKAGES_DEFAULT.map(pkg => {
        const override = saved.find(s => s.id === pkg.id);
        return {
          id: pkg.id,
          active: override ? override.active : true,
          price: (override && override.price != null) ? override.price : pkg.defaultPrice
        };
      });
    }
  } catch (e) {}
  return VESPA_PACKAGES_DEFAULT.map(pkg => ({ id: pkg.id, active: true, price: pkg.defaultPrice }));
}

/**
 * Salva la configurazione in localStorage.
 */
function savePackagesConfig(config) {
  try {
    localStorage.setItem(PKG_CONFIG_KEY, JSON.stringify(config));
    // Notifica le altre schede (es. prenotazione aperta)
    localStorage.setItem('vespa_packages_config_pulse', Date.now().toString());
  } catch (e) {}
}

/**
 * Ritorna i pacchetti attivi come array di oggetti completi { ...pkg, price }
 */
function getActivePackages() {
  const config = loadPackagesConfig();
  return VESPA_PACKAGES_DEFAULT
    .filter(pkg => {
      const cfg = config.find(c => c.id === pkg.id);
      return cfg ? cfg.active : true;
    })
    .map(pkg => {
      const cfg = config.find(c => c.id === pkg.id);
      return { ...pkg, price: cfg ? cfg.price : pkg.defaultPrice };
    });
}

/**
 * Dato un id pacchetto, ritorna l'oggetto completo con prezzo corrente.
 */
function getPackageById(id) {
  const cfg = loadPackagesConfig().find(c => c.id === id);
  const pkg = VESPA_PACKAGES_DEFAULT.find(p => p.id === id);
  if (!pkg) return null;
  return { ...pkg, price: cfg ? cfg.price : pkg.defaultPrice };
}

/**
 * Dato il campo modalitaPartecipazione salvato nel record (stringa),
 * tenta di risolvere il prezzo in questo ordine:
 *   1. id univoco moderno (es. 'COMPLETA', 'FULL_SAB', ...)
 *   2. prezzi personalizzati dall'organizzatore se contiene importo
 *   3. legacy strings (backward compatibility)
 */
function getPriceForRegistration(modalitaStr) {
  if (!modalitaStr) return 55;

  // 1. id moderno esatto
  const pkg = getPackageById(modalitaStr.split('|')[0]);
  if (pkg) return pkg.price;

  // 2. Legacy backward-compat
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

/**
 * Dato modalitaPartecipazione, ritorna l'oggetto pacchetto corrispondente.
 * Supporta sia ID moderni che stringhe legacy.
 */
function resolvePackageFromRegistration(modalitaStr) {
  if (!modalitaStr) return getPackageById('COMPLETA');
  const id = modalitaStr.split('|')[0];
  let pkg = getPackageById(id);
  if (pkg) return pkg;

  const upper = modalitaStr.toUpperCase();
  if (upper.includes('COMPLETA'))                                                        return getPackageById('COMPLETA');
  if (upper.includes('FULL_SAB') || (upper.includes('FULL SABATO') && !upper.includes('DOM'))) return getPackageById('FULL_SAB');
  if (upper.includes('FULL_DOM') || (upper.includes('FULL DOMENICA') && !upper.includes('SAB'))) return getPackageById('FULL_DOM');
  if (upper.includes('LIGHT_SAB') || (upper.includes('LIGHT') && upper.includes('SAB'))) return getPackageById('LIGHT_SAB');
  if (upper.includes('LIGHT_DOM') || (upper.includes('LIGHT') && upper.includes('DOM'))) return getPackageById('LIGHT_DOM');

  // Legacy full-2-giorni → COMPLETA
  if (upper.includes('FULL 2 GIORNI')) return getPackageById('COMPLETA');
  if (upper.includes('FULL SABATO'))   return getPackageById('FULL_SAB');
  if (upper.includes('FULL DOMENICA')) return getPackageById('FULL_DOM');

  return null;
}

/**
 * Controlla se un partecipante ha il servizio incluso nel suo pacchetto.
 * serviceKey = uno dei valori in SERVICE_DB_FIELDS
 */
function participantHasService(record, serviceKey) {
  const pkg = resolvePackageFromRegistration(record.modalitaPartecipazione);
  if (!pkg) return true; // se non si riconosce, mostra tutto (safe fallback)
  return pkg.services.includes(serviceKey);
}

/**
 * Verifica se la modalità/pacchetto include la partecipazione al Sabato
 */
function packageIncludesSabato(modalitaStr) {
  const pkg = resolvePackageFromRegistration(modalitaStr);
  if (pkg) return !!pkg.includesSabato;
  const upper = (modalitaStr || '').toUpperCase();
  return upper.includes('SABATO') || upper.includes('FULL 2 GIORNI') || upper.includes('COMPLETA');
}

/**
 * Verifica se la modalità/pacchetto include la partecipazione alla Domenica
 */
function packageIncludesDomenica(modalitaStr) {
  const pkg = resolvePackageFromRegistration(modalitaStr);
  if (pkg) return !!pkg.includesDomenica;
  const upper = (modalitaStr || '').toUpperCase();
  return upper.includes('DOMENICA') || upper.includes('FULL 2 GIORNI') || upper.includes('COMPLETA');
}

// Rende disponibili globalmente
window.VespaPkg = {
  PACKAGES: VESPA_PACKAGES_DEFAULT,
  PACKAGE_BADGE_SVGS,
  getBadgeHtml,
  SERVICE_DB_FIELDS,
  loadPackagesConfig,
  savePackagesConfig,
  getActivePackages,
  getPackageById,
  getPriceForRegistration,
  resolvePackageFromRegistration,
  participantHasService,
  packageIncludesSabato,
  packageIncludesDomenica
};

/**
 * Gestione Interfaccia Dashboard per Configurazione Pacchetti & Prezzi
 */
window.vespaPackagesUI = {
  init() {
    this.render();
  },

  render() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('packagesConfigGrid');
    if (!grid) return;

    const config = loadPackagesConfig();

    grid.innerHTML = VESPA_PACKAGES_DEFAULT.map(pkg => {
      const cfg = config.find(c => c.id === pkg.id) || { active: true, price: pkg.defaultPrice };
      const isActive = cfg.active !== false;
      const currentPrice = (cfg.price !== undefined && cfg.price !== null && !isNaN(cfg.price)) ? Number(cfg.price) : pkg.defaultPrice;

      // Badge dei servizi inclusi
      const servicesBadges = pkg.services.map(s => {
        const info = SERVICE_DB_FIELDS[s];
        return `<span style="display:inline-block; font-size:0.75rem; background:#F1F5F9; color:#1E293B; border:1px solid #CBD5E1; padding:0.25rem 0.55rem; border-radius:6px; margin:2px 3px 2px 0; font-weight:600;">${info ? info.label : s}</span>`;
      }).join('');

      return `
        <div class="pkg-card" style="background:#FFF; border:2px solid ${isActive ? '#10B981' : '#E2E8F0'}; border-radius:14px; padding:1.25rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:space-between; transition:all 0.25s ease; ${isActive ? '' : 'opacity:0.78; background:#F8FAFC;'}">
          <div>
            <!-- Intestazione Pacchetto -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.75rem;">
              <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:var(--vespa-blue-dark); display:flex; align-items:center; gap:0.5rem; line-height:1.3;">
                <span>${pkg.badgeSvg}</span> ${pkg.label}
              </h3>
              <span style="font-size:0.75rem; font-weight:800; padding:0.25rem 0.65rem; border-radius:999px; white-space:nowrap; background:${isActive ? '#DCFCE7' : '#FEE2E2'}; color:${isActive ? '#15803D' : '#B91C1C'}; border:1px solid ${isActive ? '#86EFAC' : '#FCA5A5'};">
                ${isActive ? '✅ ATTIVO' : '⛔ DISATTIVATO'}
              </span>
            </div>

            <!-- Servizi Inclusi -->
            <div style="margin-bottom:1rem;">
              <div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.4rem;">
                Servizi Inclusi nel Pacchetto:
              </div>
              <div style="line-height:1.8;">${servicesBadges}</div>
            </div>
          </div>

          <!-- Sezione Controlli Organizzatore -->
          <div style="border-top:1px solid #E2E8F0; padding-top:1rem; margin-top:0.75rem; display:flex; flex-direction:column; gap:0.85rem;">
            
            <!-- Tasto Attiva / Disattiva nelle Prenotazioni -->
            <div style="display:flex; align-items:center; justify-content:space-between; background:#F8FAFC; padding:0.6rem 0.85rem; border-radius:10px; border:1px solid #E2E8F0;">
              <div>
                <label for="pkg-toggle-${pkg.id}" style="font-size:0.88rem; font-weight:800; color:#1E293B; cursor:pointer; margin:0; display:block;">
                  Disponibile per Prenotazione
                </label>
                <span style="font-size:0.75rem; color:var(--text-muted);">
                  ${isActive ? 'Visibile agli iscritti nel modulo' : 'Nascosto nel modulo di prenotazione'}
                </span>
              </div>
              <label style="position:relative; display:inline-block; width:48px; height:26px; margin:0; cursor:pointer;">
                <input type="checkbox" id="pkg-toggle-${pkg.id}" ${isActive ? 'checked' : ''} onchange="window.vespaPackagesUI.onToggleChange('${pkg.id}', this.checked)" style="opacity:0; width:0; height:0;">
                <span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:${isActive ? '#10B981' : '#CBD5E1'}; transition:.3s; border-radius:26px;">
                  <span style="position:absolute; content:''; height:20px; width:20px; left:${isActive ? '24px' : '3px'}; bottom:3px; background-color:white; transition:.3s; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>
                </span>
              </label>
            </div>

            <!-- Modifica Prezzo Quota (€) -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; background:#F8FAFC; padding:0.6rem 0.85rem; border-radius:10px; border:1px solid #E2E8F0;">
              <div>
                <label for="pkg-price-${pkg.id}" style="font-size:0.88rem; font-weight:800; color:#1E293B; margin:0; display:block;">
                  Quota Iscrizione (€)
                </label>
                <span style="font-size:0.75rem; color:var(--text-muted);">
                  Default listino: € ${pkg.defaultPrice}
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <input type="number" id="pkg-price-${pkg.id}" min="0" max="999" step="1" value="${currentPrice}" onchange="window.vespaPackagesUI.onPriceChange('${pkg.id}', this.value)" style="width:85px; padding:0.45rem 0.6rem; font-size:1.05rem; font-weight:800; border-radius:8px; border:1.5px solid var(--vespa-blue); text-align:right; color:var(--vespa-blue-dark); background:#FFF;">
                <span style="font-size:1rem; font-weight:800; color:var(--vespa-blue-dark);">€</span>
              </div>
            </div>

          </div>
        </div>
      `;
    }).join('');
  },

  onToggleChange(id, checked) {
    const config = loadPackagesConfig();
    const item = config.find(c => c.id === id);
    if (item) item.active = checked;
    savePackagesConfig(config);
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast(checked ? `✅ Pacchetto "${id}" attivato: compare nella scheda prenotazioni.` : `⛔ Pacchetto "${id}" disattivato: nascosto dalle nuove prenotazioni. Le iscrizioni già registrate restano invariate.`, checked ? 'success' : 'info');
    }
  },

  onPriceChange(id, newPrice) {
    const priceNum = Math.max(0, parseInt(newPrice, 10) || 0);
    const config = loadPackagesConfig();
    const item = config.find(c => c.id === id);
    if (item) item.price = priceNum;
    savePackagesConfig(config);
    if (window.app && window.app.showToast) {
      window.app.showToast(`💶 Quota per "${id}" aggiornata a € ${priceNum}. Le prenotazioni già effettuate mantengono la quota originale.`, 'success');
    }
  },

  saveConfig() {
    const config = [];
    VESPA_PACKAGES_DEFAULT.forEach(pkg => {
      const toggle = document.getElementById(`pkg-toggle-${pkg.id}`);
      const priceInput = document.getElementById(`pkg-price-${pkg.id}`);
      const active = toggle ? toggle.checked : true;
      const price = priceInput ? (parseInt(priceInput.value, 10) || pkg.defaultPrice) : pkg.defaultPrice;
      config.push({ id: pkg.id, active, price });
    });
    savePackagesConfig(config);
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast('💾 Configurazione pacchetti e quote salvata con successo!', 'success');
    } else {
      alert('Configurazione pacchetti e quote salvata con successo!');
    }
  }
};

// Inizializzazione automatica al caricamento
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('packagesConfigGrid')) {
      window.vespaPackagesUI.init();
    }
  });
}

