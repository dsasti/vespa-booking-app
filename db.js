/**
 * Vespa Club Asti Booking System - Database & Cloud Sync Engine
 */

class VespaDB {
  constructor() {
    this.dbName = 'VespaClubAstiBookingDB';
    this.storeName = 'registrations';
    this.version = 2;
    this.db = null;
    this._initPromise = null;
    this.listeners = [];

    try {
      this.broadcast = new BroadcastChannel('vespa_club_asti_sync_channel');
      this.broadcast.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_UPDATED') {
          this.notifyListeners(event.data);
        }
      };
    } catch (e) {
      this.broadcast = null;
    }

    // Ascolta anche gli eventi storage cross-tab/cross-window in qualsiasi contesto
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'vespa_asti_registrations' || e.key === 'vespa_db_sync_pulse') {
          this.notifyListeners({ type: 'DATA_UPDATED', action: 'STORAGE_EVENT' });
        }
      });
    }

    // Inizializza automaticamente in background
    this.ensureInit();
  }

  static inferCityFromClub(club) {
    if (!club) return '';
    const clean = club.replace(/vespa\s+club/gi, '').replace(/a\.?s\.?d\.?/gi, '').trim();
    return clean || 'Asti';
  }

  static getPriceForMode(modeStr) {
    // Se VespaPkg è disponibile (packages.js caricato) usa la funzione centralizzata
    if (window.VespaPkg) return window.VespaPkg.getPriceForRegistration(modeStr);
    if (!modeStr) return 55;
    // Legacy fallback
    if (modeStr.includes('COMPLETA'))      return 95;
    if (modeStr.includes('FULL_SAB') || (modeStr.includes('FULL') && modeStr.includes('SABATO') && !modeStr.includes('DOMENICA'))) return 60;
    if (modeStr.includes('FULL_DOM') || (modeStr.includes('FULL') && modeStr.includes('DOMENICA') && !modeStr.includes('SABATO'))) return 50;
    if (modeStr.includes('LIGHT_SAB') || (modeStr.includes('LIGHT') && modeStr.includes('SAB'))) return 15;
    if (modeStr.includes('LIGHT_DOM') || (modeStr.includes('LIGHT') && modeStr.includes('DOM'))) return 20;
    if (modeStr.includes('FULL 2 GIORNI') || modeStr.includes('55')) return 55;
    if (modeStr.includes('FULL SABATO') || modeStr.includes('35')) return 35;
    if (modeStr.includes('FULL DOMENICA') || modeStr.includes('45')) return 45;
    return 55;
  }

  async ensureInit() {
    if (this.db) return true;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this.init();
    return this._initPromise;
  }

  async init() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            store.createIndex('cognome', 'cognome', { unique: false });
            store.createIndex('tesseraVci', 'tesseraVci', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };

        request.onsuccess = async (e) => {
          this.db = e.target.result;
          await this.hydrateIndexedDBFromLocalStorageIfEmpty();
          await this.syncFromBackendIfAvailable();
          // Carica i dati demo solo la primissima volta in assoluto (se non è mai stato fatto un reset intenzionale)
          if (!localStorage.getItem('vespa_db_initialized') && !localStorage.getItem('vespa_db_wiped')) {
            await this.seedDemoDataIfEmpty();
            localStorage.setItem('vespa_db_initialized', 'true');
          }
          resolve(true);
        };

        request.onerror = async (e) => {
          console.warn('IndexedDB fallback LocalStorage', e);
          await this.syncFromBackendIfAvailable();
          if (!localStorage.getItem('vespa_db_initialized') && !localStorage.getItem('vespa_db_wiped')) {
            await this.seedDemoDataIfEmpty();
            localStorage.setItem('vespa_db_initialized', 'true');
          }
          resolve(false);
        };
      } catch (err) {
        console.warn('IndexedDB non disponibile, uso LocalStorage:', err);
        resolve(false);
      }
    });
  }

  async hydrateIndexedDBFromLocalStorageIfEmpty() {
    if (!this.db) return;
    try {
      const count = await new Promise((res) => {
        const tx = this.db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).count();
        req.onsuccess = () => res(req.result || 0);
        req.onerror = () => res(0);
      });
      if (count === 0) {
        const localItems = this.getLocalStorageAll();
        if (localItems.length > 0) {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          localItems.forEach(item => store.put(item));
        }
      }
    } catch(e) {}
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach((fn) => {
      try { fn(data); } catch(err) { console.warn('Listener error:', err); }
    });
  }

  generateId() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `VCA-2026-${randomNum}`;
  }

  async saveRegistration(data) {
    await this.ensureInit();

    const id = (data.id || this.generateId()).trim();
    const now = new Date().toISOString();
    const modalita = data.modalitaPartecipazione || 'COMPLETA Sabato + Domenica - € 95';

    const cognomeNorm = (data.cognome || '').trim().toUpperCase();
    const nomeNorm = (data.nome || '').trim().toUpperCase();

    // BLOCCO PRENOTAZIONI DOPPIE: controlla SOLO se l'ID è diverso (permette modifica e aggiornamenti)
    const allExisting = await this.getAllRegistrations();
    const duplicate = allExisting.find(r => 
      r.id.toUpperCase() !== id.toUpperCase() &&
      (r.cognome || '').trim().toUpperCase() === cognomeNorm &&
      (r.nome || '').trim().toUpperCase() === nomeNorm
    );

    if (duplicate) {
      const err = new Error(`La prenotazione a nome di "${data.cognome} ${data.nome}" è già stata completata (Codice Pass: ${duplicate.id}). Se devi effettuare una nuova prenotazione devi usare un altro nome. Per problemi contattare l'organizzatore.`);
      err.isDuplicate = true;
      err.duplicateRecord = duplicate;
      throw err;
    }

    const existingRecord = allExisting.find(r => r.id.toUpperCase() === id.toUpperCase());
    const importoDovuto = data.importoDovuto !== undefined
      ? data.importoDovuto
      : (existingRecord && existingRecord.importoDovuto !== undefined
          ? existingRecord.importoDovuto
          : VespaDB.getPriceForMode(modalita));
    let statoPagamento = data.statoPagamento || (existingRecord ? existingRecord.statoPagamento : null);
    if (!statoPagamento) {
      if (data.ricevutaPagamentoVerified || data.pagato) {
        statoPagamento = 'PAGATO';
      } else if (data.ricevutaPagamento && data.ricevutaPagamento.data) {
        statoPagamento = 'RICEVUTA_DA_VERIFICARE';
      } else {
        statoPagamento = 'NON_PAGATO';
      }
    }

    // Merge accurato: non sovrascrivere o perdere MAI lo stato dei servizi né campi addizionali!
    const record = {
      ...(existingRecord || {}),
      ...data,
      id: id,
      createdAt: data.createdAt || (existingRecord ? existingRecord.createdAt : now),
      updatedAt: now,
      cognome: cognomeNorm,
      nome: (data.nome !== undefined ? data.nome : (existingRecord ? existingRecord.nome : '')).trim(),
      dataNascita: data.dataNascita !== undefined ? data.dataNascita : (existingRecord ? existingRecord.dataNascita : ''),
      vespaClub: (data.vespaClub !== undefined ? data.vespaClub : (existingRecord ? existingRecord.vespaClub : '')).trim(),
      cittaProvenienza: ((data.cittaProvenienza !== undefined ? data.cittaProvenienza : (existingRecord ? (existingRecord.cittaProvenienza || existingRecord.citta) : '')) || VespaDB.inferCityFromClub(data.vespaClub || (existingRecord ? existingRecord.vespaClub : ''))).trim(),
      tesseraVci: (data.tesseraVci !== undefined ? data.tesseraVci : (existingRecord ? existingRecord.tesseraVci : '')).trim(),
      tesseraMotornext: (data.tesseraMotornext !== undefined ? data.tesseraMotornext : (existingRecord ? existingRecord.tesseraMotornext : '')).trim(),
      email: (data.email !== undefined ? data.email : (existingRecord ? existingRecord.email : '')).trim().toLowerCase(),
      telefono: (data.telefono !== undefined ? data.telefono : (existingRecord ? existingRecord.telefono : '')).trim(),
      ruolo: data.ruolo || (existingRecord ? existingRecord.ruolo : 'CONDUCENTE'),
      modelloVespa: (data.modelloVespa !== undefined ? data.modelloVespa : (existingRecord ? existingRecord.modelloVespa : '')).trim(),
      annoVespa: parseInt(data.annoVespa || (existingRecord ? existingRecord.annoVespa : new Date().getFullYear()), 10) || 1980,
      tagliaTshirt: data.tagliaTshirt || (existingRecord ? existingRecord.tagliaTshirt : 'L'),
      modalitaPartecipazione: modalita,
      importoDovuto: importoDovuto,
      statoPagamento: statoPagamento,
      ricevutaPagamento: data.ricevutaPagamento !== undefined ? data.ricevutaPagamento : (existingRecord ? existingRecord.ricevutaPagamento : null),
      ricevutaPagamentoVerified: statoPagamento === 'PAGATO',

      // Presenze separate Sabato e Domenica
      // NOTA: se il chiamante passa esplicitamente false, lo rispettiamo SEMPRE (non facciamo fallback all'existing record).
      statoAccettazioneSabato: data.statoAccettazioneSabato !== undefined
        ? !!data.statoAccettazioneSabato
        : (existingRecord ? !!existingRecord.statoAccettazioneSabato : false),
      accettazioneSabatoTimestamp: data.accettazioneSabatoTimestamp !== undefined
        ? data.accettazioneSabatoTimestamp
        : (existingRecord ? existingRecord.accettazioneSabatoTimestamp : null),
      statoAccettazioneDomenica: data.statoAccettazioneDomenica !== undefined
        ? !!data.statoAccettazioneDomenica
        : (existingRecord ? !!existingRecord.statoAccettazioneDomenica : false),
      accettazioneDomenicaTimestamp: data.accettazioneDomenicaTimestamp !== undefined
        ? data.accettazioneDomenicaTimestamp
        : (existingRecord ? existingRecord.accettazioneDomenicaTimestamp : null),
      // accettazioneConclusa = true SOLO se entrambi i giorni risultano true nel record che stiamo salvando
      accettazioneConclusa: (function() {
        var sab = data.statoAccettazioneSabato !== undefined
          ? !!data.statoAccettazioneSabato
          : (existingRecord ? !!existingRecord.statoAccettazioneSabato : false);
        var dom = data.statoAccettazioneDomenica !== undefined
          ? !!data.statoAccettazioneDomenica
          : (existingRecord ? !!existingRecord.statoAccettazioneDomenica : false);
        // Se il chiamante forza esplicitamente accettazioneConclusa, rispettalo solo se coerente
        if (data.accettazioneConclusa !== undefined) {
          // Se almeno uno dei due giorni è false, non possiamo concludere l'accettazione
          return !!data.accettazioneConclusa && (sab || dom);
        }
        return sab && dom;
      })(),
      accettazioneTimestamp: data.accettazioneTimestamp !== undefined
        ? data.accettazioneTimestamp
        : (existingRecord ? existingRecord.accettazioneTimestamp : null),

      // Servizi
      ritiroGadget: (data.ritiroGadget !== undefined ? !!data.ritiroGadget : (data.kitGadgetConsegnato !== undefined ? !!data.kitGadgetConsegnato : (existingRecord ? (!!existingRecord.ritiroGadget || !!existingRecord.kitGadgetConsegnato) : false))),
      kitGadgetConsegnato: (data.kitGadgetConsegnato !== undefined ? !!data.kitGadgetConsegnato : (data.ritiroGadget !== undefined ? !!data.ritiroGadget : (existingRecord ? (!!existingRecord.kitGadgetConsegnato || !!existingRecord.ritiroGadget) : false))),
      ritiroGadgetTimestamp: data.ritiroGadgetTimestamp !== undefined ? data.ritiroGadgetTimestamp : (existingRecord ? existingRecord.ritiroGadgetTimestamp : null),

      aperitivo: (data.aperitivo !== undefined ? !!data.aperitivo : (data.aperitivoErogato !== undefined ? !!data.aperitivoErogato : (existingRecord ? (!!existingRecord.aperitivo || !!existingRecord.aperitivoErogato) : false))),
      aperitivoErogato: (data.aperitivoErogato !== undefined ? !!data.aperitivoErogato : (data.aperitivo !== undefined ? !!data.aperitivo : (existingRecord ? (!!existingRecord.aperitivoErogato || !!existingRecord.aperitivo) : false))),
      aperitivoTimestamp: data.aperitivoTimestamp !== undefined ? data.aperitivoTimestamp : (existingRecord ? existingRecord.aperitivoTimestamp : null),

      aperitivoSabatoErogato: (data.aperitivoSabatoErogato !== undefined ? !!data.aperitivoSabatoErogato : (existingRecord ? !!existingRecord.aperitivoSabatoErogato : false)),
      aperitivoSabatoErogatoTimestamp: data.aperitivoSabatoErogatoTimestamp !== undefined ? data.aperitivoSabatoErogatoTimestamp : (existingRecord ? existingRecord.aperitivoSabatoErogatoTimestamp : null),

      aperitivoDomenicaErogato: (data.aperitivoDomenicaErogato !== undefined ? !!data.aperitivoDomenicaErogato : (existingRecord ? !!existingRecord.aperitivoDomenicaErogato : false)),
      aperitivoDomenicaErogatoTimestamp: data.aperitivoDomenicaErogatoTimestamp !== undefined ? data.aperitivoDomenicaErogatoTimestamp : (existingRecord ? existingRecord.aperitivoDomenicaErogatoTimestamp : null),

      colazioneDomenicaErogata: (data.colazioneDomenicaErogata !== undefined ? !!data.colazioneDomenicaErogata : (existingRecord ? !!existingRecord.colazioneDomenicaErogata : false)),
      colazioneDomenicaErogataTimestamp: data.colazioneDomenicaErogataTimestamp !== undefined ? data.colazioneDomenicaErogataTimestamp : (existingRecord ? existingRecord.colazioneDomenicaErogataTimestamp : null),

      pranzo: (data.pranzo !== undefined ? !!data.pranzo : (data.pranzoDomenicaErogato !== undefined ? !!data.pranzoDomenicaErogato : (existingRecord ? (!!existingRecord.pranzo || !!existingRecord.pranzoDomenicaErogato) : false))),
      pranzoDomenicaErogato: (data.pranzoDomenicaErogato !== undefined ? !!data.pranzoDomenicaErogato : (data.pranzo !== undefined ? !!data.pranzo : (existingRecord ? (!!existingRecord.pranzoDomenicaErogato || !!existingRecord.pranzo) : false))),
      pranzoTimestamp: data.pranzoTimestamp !== undefined ? data.pranzoTimestamp : (existingRecord ? existingRecord.pranzoTimestamp : null),

      cena: (data.cena !== undefined ? !!data.cena : (data.cenaSabatoErogato !== undefined ? !!data.cenaSabatoErogato : (existingRecord ? (!!existingRecord.cena || !!existingRecord.cenaSabatoErogato) : false))),
      cenaSabatoErogato: (data.cenaSabatoErogato !== undefined ? !!data.cenaSabatoErogato : (data.cena !== undefined ? !!data.cena : (existingRecord ? (!!existingRecord.cenaSabatoErogato || !!existingRecord.cena) : false))),
      cenaTimestamp: data.cenaTimestamp !== undefined ? data.cenaTimestamp : (existingRecord ? existingRecord.cenaTimestamp : null),

      merenda: (data.merenda !== undefined ? !!data.merenda : (data.merendaSabatoErogata !== undefined ? !!data.merendaSabatoErogata : (existingRecord ? (!!existingRecord.merenda || !!existingRecord.merendaSabatoErogata) : false))),
      merendaSabatoErogata: (data.merendaSabatoErogata !== undefined ? !!data.merendaSabatoErogata : (data.merenda !== undefined ? !!data.merenda : (existingRecord ? (!!existingRecord.merendaSabatoErogata || !!existingRecord.merenda) : false))),
      merendaTimestamp: data.merendaTimestamp !== undefined ? data.merendaTimestamp : (data.merendaSabatoErogataTimestamp !== undefined ? data.merendaSabatoErogataTimestamp : (existingRecord ? (existingRecord.merendaTimestamp || existingRecord.merendaSabatoErogataTimestamp) : null)),
      merendaSabatoErogataTimestamp: data.merendaSabatoErogataTimestamp !== undefined ? data.merendaSabatoErogataTimestamp : (data.merendaTimestamp !== undefined ? data.merendaTimestamp : (existingRecord ? (existingRecord.merendaSabatoErogataTimestamp || existingRecord.merendaTimestamp) : null)),

      noteOrganizzatore: data.noteOrganizzatore !== undefined ? data.noteOrganizzatore : (existingRecord ? existingRecord.noteOrganizzatore : ''),
      notePagamento: data.notePagamento !== undefined ? data.notePagamento : (existingRecord ? existingRecord.notePagamento : '')
    };

    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.put(record);
          req.onsuccess = () => resolve(true);
          req.onerror = (err) => reject(err);
        });
      } catch (errDb) {
        console.warn('Errore scrittura IndexedDB, salvataggio su LocalStorage:', errDb);
      }
    }

    const all = this.getLocalStorageAll();
    const existingIndex = all.findIndex(r => r.id.toUpperCase() === id.toUpperCase());
    if (existingIndex >= 0) all[existingIndex] = record;
    else all.unshift(record);

    try {
      localStorage.setItem('vespa_asti_registrations', JSON.stringify(all));
      localStorage.setItem('vespa_db_sync_pulse', Date.now().toString());
    } catch (e) {
      console.warn('Errore localStorage:', e);
    }

    this.syncToServer(record);

    // Salva automaticamente il backup cumulativo di tutte le prenotazioni
    this.saveAutoBackup(all);

    if (this.broadcast) {
      try { this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'SAVE', record }); } catch(e) {}
    }
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'SAVE', record });

    return record;
  }

  async setPaymentStatus(id, newStatus) {
    await this.ensureInit();
    const record = await this.getById(id);
    if (!record) throw new Error('Partecipante non trovato: ' + id);

    record.statoPagamento = newStatus;
    record.ricevutaPagamentoVerified = (newStatus === 'PAGATO');

    return await this.saveRegistration(record);
  }

  async getAllRegistrations() {
    await this.ensureInit();
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => {
            const res = req.result || [];
            if (res.length > 0) {
              res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              resolve(res);
            } else {
              resolve(this.getLocalStorageAll());
            }
          };
          req.onerror = () => resolve(this.getLocalStorageAll());
        } catch (e) {
          resolve(this.getLocalStorageAll());
        }
      });
    }
    return this.getLocalStorageAll();
  }

  async getById(id) {
    if (!id) return null;
    await this.ensureInit();
    const cleanId = id.toString().trim().toUpperCase();
    const all = await this.getAllRegistrations();
    return all.find(r => 
      (r.id && r.id.toUpperCase() === cleanId) || 
      (r.cognome && r.cognome.toUpperCase() === cleanId) || 
      (r.tesseraVci && r.tesseraVci.toUpperCase() === cleanId)
    ) || null;
  }

  async toggleServiceStatus(id, serviceKey) {
    const record = await this.getById(id);
    if (!record) throw new Error('Partecipante non trovato con ID: ' + id);

    const now = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const currentVal = !!(record[serviceKey]);
    const newVal = !currentVal;

    record[serviceKey] = newVal;
    record[`${serviceKey}Timestamp`] = newVal ? now : null;

    if (serviceKey === 'ritiroGadget' || serviceKey === 'kitGadgetConsegnato') {
      record.ritiroGadget = newVal;
      record.kitGadgetConsegnato = newVal;
      record.ritiroGadgetTimestamp = newVal ? now : null;
    } else if (serviceKey === 'aperitivoSabatoErogato') {
      record.aperitivoSabatoErogato = newVal;
      record.aperitivoSabatoErogatoTimestamp = newVal ? now : null;
      record.aperitivo = !!(record.aperitivoSabatoErogato || record.aperitivoDomenicaErogato);
    } else if (serviceKey === 'aperitivoDomenicaErogato') {
      record.aperitivoDomenicaErogato = newVal;
      record.aperitivoDomenicaErogatoTimestamp = newVal ? now : null;
      record.aperitivo = !!(record.aperitivoSabatoErogato || record.aperitivoDomenicaErogato);
    } else if (serviceKey === 'colazioneDomenicaErogata') {
      record.colazioneDomenicaErogata = newVal;
      record.colazioneDomenicaErogataTimestamp = newVal ? now : null;
    } else if (serviceKey === 'aperitivo' || serviceKey === 'aperitivoErogato') {
      record.aperitivo = newVal;
      record.aperitivoErogato = newVal;
      record.aperitivoTimestamp = newVal ? now : null;
    } else if (serviceKey === 'pranzo' || serviceKey === 'pranzoDomenicaErogato') {
      record.pranzo = newVal;
      record.pranzoDomenicaErogato = newVal;
      record.pranzoTimestamp = newVal ? now : null;
    } else if (serviceKey === 'cena' || serviceKey === 'cenaSabatoErogato') {
      record.cena = newVal;
      record.cenaSabatoErogato = newVal;
      record.cenaTimestamp = newVal ? now : null;
    } else if (serviceKey === 'merenda' || serviceKey === 'merendaSabatoErogata') {
      record.merenda = newVal;
      record.merendaSabatoErogata = newVal;
      record.merendaTimestamp = newVal ? now : null;
      record.merendaSabatoErogataTimestamp = newVal ? now : null;
    } else if (serviceKey === 'statoAccettazioneSabato') {
      record.statoAccettazioneSabato = newVal;
      record.accettazioneSabatoTimestamp = newVal ? now : null;
      // Ricalcola accettazioneConclusa: true solo se ENTRAMBI i giorni sono true
      record.accettazioneConclusa = !!(record.statoAccettazioneSabato && record.statoAccettazioneDomenica);
      if (!record.accettazioneConclusa) record.accettazioneTimestamp = null;
      else if (!record.accettazioneTimestamp) record.accettazioneTimestamp = now;
    } else if (serviceKey === 'statoAccettazioneDomenica') {
      record.statoAccettazioneDomenica = newVal;
      record.accettazioneDomenicaTimestamp = newVal ? now : null;
      // Ricalcola accettazioneConclusa: true solo se ENTRAMBI i giorni sono true
      record.accettazioneConclusa = !!(record.statoAccettazioneSabato && record.statoAccettazioneDomenica);
      if (!record.accettazioneConclusa) record.accettazioneTimestamp = null;
      else if (!record.accettazioneTimestamp) record.accettazioneTimestamp = now;
    }

    return await this.saveRegistration(record);
  }

  async deleteRegistration(id) {
    if (this.db) {
      await new Promise((resolve) => {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
      });
    }
    const all = this.getLocalStorageAll().filter(r => r.id !== id);
    localStorage.setItem('vespa_asti_registrations', JSON.stringify(all));

    // Aggiorna backup cumulativo
    this.saveAutoBackup(all);

    // Notifica eliminazione via REST server
    fetch(`/api/registrations/${id}`, { method: 'DELETE' }).catch(() => {});

    this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'DELETE', id });
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'DELETE', id });
  }

  getLocalStorageAll() {
    try {
      const data = localStorage.getItem('vespa_asti_registrations');
      const list = data ? JSON.parse(data) : [];
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      return [];
    }
  }

  syncToServer(record) {
    fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => {});
  }

  async syncFromBackendIfAvailable() {
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          // Sincronizza SEMPRE i record remoti dal database cloud
          for (const item of list) {
            await this.saveRegistration(item);
          }
        }
      }
    } catch (e) {}
  }

  // 100 ISCRIZIONI DEMO DIVERSIFICATE E REALISTICHE (ITALIA ED ESTERO) PER IL VESPA CLUB ASTI
  async seedDemoDataIfEmpty(force = false) {
    if (!force) {
      const current = await this.getAllRegistrations();
      if (current && current.length > 0) return;
    }

    const demoItems = [
  {
    "id": "VCA-2026-1001",
    "createdAt": "2026-09-14T15:52:00.051Z",
    "cognome": "ROSSI",
    "nome": "Marco",
    "vespaClub": "Vespa Club Asti",
    "cittaProvenienza": "Asti",
    "tesseraVci": "VCI-10000",
    "tesseraMotornext": "MN-30000",
    "email": "marco.rossi@gmail.com",
    "telefono": "+39 320 1000000",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 98",
    "annoVespa": 1946,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Asti (Vespa Club Asti)."
  },
  {
    "id": "VCA-2026-1002",
    "createdAt": "2026-09-15T03:52:00.054Z",
    "cognome": "BIANCHI",
    "nome": "Giulia",
    "vespaClub": "Vespa Club Alfieri Asti",
    "cittaProvenienza": "Asti",
    "tesseraVci": "VCI-10137",
    "tesseraMotornext": "MN-30241",
    "email": "giulia.bianchi@email.it",
    "telefono": "+39 327 1098765",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Bacchetta",
    "annoVespa": 1948,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_bianchi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Asti (Vespa Club Alfieri Asti)."
  },
  {
    "id": "VCA-2026-1003",
    "createdAt": "2026-09-15T15:52:00.054Z",
    "cognome": "FERRARI",
    "nome": "Martino",
    "vespaClub": "Vespa Club Canelli",
    "cittaProvenienza": "Canelli",
    "tesseraVci": "VCI-10274",
    "tesseraMotornext": "MN-30482",
    "email": "martino.ferrari@gmail.com",
    "telefono": "+39 334 1197530",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 \"Vacanze Romane\"",
    "annoVespa": 1953,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_ferrari.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Canelli (Vespa Club Canelli)."
  },
  {
    "id": "VCA-2026-1004",
    "createdAt": "2026-09-16T03:52:00.054Z",
    "cognome": "RUSSO",
    "nome": "Alessandro",
    "vespaClub": "Vespa Club Alba",
    "cittaProvenienza": "Alba",
    "tesseraVci": "VCI-10411",
    "tesseraMotornext": "MN-30723",
    "email": "alessandro.russo@email.it",
    "telefono": "+39 341 1296295",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 GS (Grand Sport)",
    "annoVespa": 1955,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_russo.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Alba (Vespa Club Alba)."
  },
  {
    "id": "VCA-2026-1005",
    "createdAt": "2026-09-16T15:52:00.054Z",
    "cognome": "ESPOSITO",
    "nome": "Chiara",
    "vespaClub": "Vespa Club Alessandria",
    "cittaProvenienza": "Alessandria",
    "tesseraVci": "VCI-10548",
    "tesseraMotornext": "MN-30964",
    "email": "chiara.esposito@gmail.com",
    "telefono": "+39 348 1395060",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Struzzo",
    "annoVespa": 1956,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_esposito.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Alessandria (Vespa Club Alessandria)."
  },
  {
    "id": "VCA-2026-1006",
    "createdAt": "2026-09-17T03:52:00.054Z",
    "cognome": "COLOMBO",
    "nome": "Roberto",
    "vespaClub": "Vespa Club Bra",
    "cittaProvenienza": "Bra",
    "tesseraVci": "VCI-10685",
    "tesseraMotornext": "MN-31205",
    "email": "roberto.colombo@email.it",
    "telefono": "+39 355 1493825",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 VNB",
    "annoVespa": 1961,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_colombo.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Bra (Vespa Club Bra)."
  },
  {
    "id": "VCA-2026-1007",
    "createdAt": "2026-09-17T15:52:00.054Z",
    "cognome": "ROMANO",
    "nome": "Elena",
    "vespaClub": "Vespa Club Carmagnola",
    "cittaProvenienza": "Carmagnola",
    "tesseraVci": "VCI-10822",
    "tesseraMotornext": "MN-31446",
    "email": "elena.romano@gmail.com",
    "telefono": "+39 362 1592590",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 N",
    "annoVespa": 1963,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_romano.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Carmagnola (Vespa Club Carmagnola)."
  },
  {
    "id": "VCA-2026-1008",
    "createdAt": "2026-09-18T03:52:00.054Z",
    "cognome": "RICCI",
    "nome": "Davide",
    "vespaClub": "Vespa Club Chieri",
    "cittaProvenienza": "Chieri",
    "tesseraVci": "VCI-10959",
    "tesseraMotornext": "MN-31687",
    "email": "davide.ricci@email.it",
    "telefono": "+39 369 1691355",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Sprint",
    "annoVespa": 1965,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Chieri (Vespa Club Chieri)."
  },
  {
    "id": "VCA-2026-1009",
    "createdAt": "2026-09-18T15:52:00.054Z",
    "cognome": "GALLO",
    "nome": "Sara",
    "vespaClub": "Vespa Club Casale Monferrato",
    "cittaProvenienza": "Casale Monferrato",
    "tesseraVci": "VCI-11096",
    "tesseraMotornext": "MN-31928",
    "email": "sara.gallo@gmail.com",
    "telefono": "+39 376 1790120",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Super Sport",
    "annoVespa": 1966,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_gallo.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Casale Monferrato (Vespa Club Casale Monferrato)."
  },
  {
    "id": "VCA-2026-1010",
    "createdAt": "2026-09-19T03:52:00.054Z",
    "cognome": "GRECO",
    "nome": "Valentina",
    "vespaClub": "Vespa Club Moncalieri",
    "cittaProvenienza": "Moncalieri",
    "tesseraVci": "VCI-11233",
    "tesseraMotornext": "MN-32169",
    "email": "valentina.greco@email.it",
    "telefono": "+39 383 1888885",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera",
    "annoVespa": 1968,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_greco.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Moncalieri (Vespa Club Moncalieri)."
  },
  {
    "id": "VCA-2026-1011",
    "createdAt": "2026-09-19T15:52:00.054Z",
    "cognome": "CONTI",
    "nome": "Fabio",
    "vespaClub": "Vespa Club Torino",
    "cittaProvenienza": "Torino",
    "tesseraVci": "VCI-11370",
    "tesseraMotornext": "MN-32410",
    "email": "fabio.conti@gmail.com",
    "telefono": "+39 320 1987650",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Rally",
    "annoVespa": 1968,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_conti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Torino (Vespa Club Torino)."
  },
  {
    "id": "VCA-2026-1012",
    "createdAt": "2026-09-20T03:52:00.054Z",
    "cognome": "DE LUCA",
    "nome": "Antonio",
    "vespaClub": "Vespa Club Acqui Terme",
    "cittaProvenienza": "Acqui Terme",
    "tesseraVci": "VCI-11507",
    "tesseraMotornext": "MN-32651",
    "email": "antonio.deluca@email.it",
    "telefono": "+39 327 2086415",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Special",
    "annoVespa": 1970,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_deluca.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Acqui Terme (Vespa Club Acqui Terme)."
  },
  {
    "id": "VCA-2026-1013",
    "createdAt": "2026-09-20T15:52:00.054Z",
    "cognome": "MANCINI",
    "nome": "Matteo",
    "vespaClub": "Vespa Club Settimo Torinese",
    "cittaProvenienza": "Settimo Torinese",
    "tesseraVci": "VCI-11644",
    "tesseraMotornext": "MN-32892",
    "email": "matteo.mancini@gmail.com",
    "telefono": "+39 334 2185180",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 200 Rally Elettronica",
    "annoVespa": 1972,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_mancini.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Settimo Torinese (Vespa Club Settimo Torinese)."
  },
  {
    "id": "VCA-2026-1014",
    "createdAt": "2026-09-21T03:52:00.054Z",
    "cognome": "COSTA",
    "nome": "Martina",
    "vespaClub": "Vespa Club Rivoli",
    "cittaProvenienza": "Rivoli",
    "tesseraVci": "VCI-11781",
    "tesseraMotornext": "MN-33133",
    "email": "martina.costa@email.it",
    "telefono": "+39 341 2283945",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera ET3",
    "annoVespa": 1976,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_costa.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Rivoli (Vespa Club Rivoli)."
  },
  {
    "id": "VCA-2026-1015",
    "createdAt": "2026-09-21T15:52:00.054Z",
    "cognome": "GIORDANO",
    "nome": "Lorenzo",
    "vespaClub": "Vespa Club Pinerolo",
    "cittaProvenienza": "Pinerolo",
    "tesseraVci": "VCI-11918",
    "tesseraMotornext": "MN-33374",
    "email": "lorenzo.giordano@gmail.com",
    "telefono": "+39 348 2382710",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 125",
    "annoVespa": 1978,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Pinerolo (Vespa Club Pinerolo)."
  },
  {
    "id": "VCA-2026-1016",
    "createdAt": "2026-09-22T03:52:00.054Z",
    "cognome": "RIZZO",
    "nome": "Francesca",
    "vespaClub": "Vespa Club Vercelli",
    "cittaProvenienza": "Vercelli",
    "tesseraVci": "VCI-12055",
    "tesseraMotornext": "MN-33615",
    "email": "francesca.rizzo@email.it",
    "telefono": "+39 355 2481475",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 150 E",
    "annoVespa": 1981,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_rizzo.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Vercelli (Vespa Club Vercelli)."
  },
  {
    "id": "VCA-2026-1017",
    "createdAt": "2026-09-22T15:52:00.054Z",
    "cognome": "LOMBARDI",
    "nome": "Pietro",
    "vespaClub": "Vespa Club Cuneo",
    "cittaProvenienza": "Cuneo",
    "tesseraVci": "VCI-12192",
    "tesseraMotornext": "MN-33856",
    "email": "pietro.lombardi@gmail.com",
    "telefono": "+39 362 2580240",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 200 E Arcobaleno",
    "annoVespa": 1984,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_lombardi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Cuneo (Vespa Club Cuneo)."
  },
  {
    "id": "VCA-2026-1018",
    "createdAt": "2026-09-23T03:52:00.054Z",
    "cognome": "MORETTI",
    "nome": "Silvia",
    "vespaClub": "Vespa Club Novara",
    "cittaProvenienza": "Novara",
    "tesseraVci": "VCI-12329",
    "tesseraMotornext": "MN-34097",
    "email": "silvia.moretti@email.it",
    "telefono": "+39 369 2679005",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa T5 Pole Position",
    "annoVespa": 1985,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_moretti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Novara (Vespa Club Novara)."
  },
  {
    "id": "VCA-2026-1019",
    "createdAt": "2026-09-23T15:52:00.054Z",
    "cognome": "BARBIERI",
    "nome": "Christian",
    "vespaClub": "Vespa Club Ivrea",
    "cittaProvenienza": "Ivrea",
    "tesseraVci": "VCI-12466",
    "tesseraMotornext": "MN-34338",
    "email": "christian.barbieri@gmail.com",
    "telefono": "+39 376 2777770",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Cosa 200",
    "annoVespa": 1990,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_barbieri.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Ivrea (Vespa Club Ivrea)."
  },
  {
    "id": "VCA-2026-1020",
    "createdAt": "2026-09-24T03:52:00.054Z",
    "cognome": "BRUNO",
    "nome": "Gabriele",
    "vespaClub": "Vespa Club Biella",
    "cittaProvenienza": "Biella",
    "tesseraVci": "VCI-12603",
    "tesseraMotornext": "MN-34579",
    "email": "gabriele.bruno@email.it",
    "telefono": "+39 383 2876535",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Revival",
    "annoVespa": 1991,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_bruno.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Biella (Vespa Club Biella)."
  },
  {
    "id": "VCA-2026-1021",
    "createdAt": "2026-09-24T15:52:00.054Z",
    "cognome": "FONTANA",
    "nome": "Lucia",
    "vespaClub": "Vespa Club Verbania",
    "cittaProvenienza": "Verbania",
    "tesseraVci": "VCI-12740",
    "tesseraMotornext": "MN-34820",
    "email": "lucia.fontana@gmail.com",
    "telefono": "+39 320 2975300",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa ET4 150",
    "annoVespa": 1998,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_fontana.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Verbania (Vespa Club Verbania)."
  },
  {
    "id": "VCA-2026-1022",
    "createdAt": "2026-09-25T03:52:00.054Z",
    "cognome": "SANTORO",
    "nome": "Michele",
    "vespaClub": "Vespa Club Savona",
    "cittaProvenienza": "Savona",
    "tesseraVci": "VCI-12877",
    "tesseraMotornext": "MN-35061",
    "email": "michele.santoro@email.it",
    "telefono": "+39 327 3074065",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Granturismo 200 L",
    "annoVespa": 2003,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Savona (Vespa Club Savona)."
  },
  {
    "id": "VCA-2026-1023",
    "createdAt": "2026-09-25T15:52:00.054Z",
    "cognome": "MARINI",
    "nome": "Federica",
    "vespaClub": "Vespa Club Genova",
    "cittaProvenienza": "Genova",
    "tesseraVci": "VCI-13014",
    "tesseraMotornext": "MN-35302",
    "email": "federica.marini@gmail.com",
    "telefono": "+39 334 3172830",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 250 i.e.",
    "annoVespa": 2006,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_marini.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Genova (Vespa Club Genova)."
  },
  {
    "id": "VCA-2026-1024",
    "createdAt": "2026-09-26T03:52:00.054Z",
    "cognome": "RINALDI",
    "nome": "Simone",
    "vespaClub": "Vespa Club Imperia",
    "cittaProvenienza": "Imperia",
    "tesseraVci": "VCI-13151",
    "tesseraMotornext": "MN-35543",
    "email": "simone.rinaldi@email.it",
    "telefono": "+39 341 3271595",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 300 Super",
    "annoVespa": 2012,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_rinaldi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Imperia (Vespa Club Imperia)."
  },
  {
    "id": "VCA-2026-1025",
    "createdAt": "2026-09-26T15:52:00.054Z",
    "cognome": "CARUSO",
    "nome": "Giacomo",
    "vespaClub": "Vespa Club Sanremo",
    "cittaProvenienza": "Sanremo",
    "tesseraVci": "VCI-13288",
    "tesseraMotornext": "MN-35784",
    "email": "giacomo.caruso@gmail.com",
    "telefono": "+39 348 3370360",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 946",
    "annoVespa": 2013,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_caruso.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Sanremo (Vespa Club Sanremo)."
  },
  {
    "id": "VCA-2026-1026",
    "createdAt": "2026-09-27T03:52:00.054Z",
    "cognome": "FERRARA",
    "nome": "Alessia",
    "vespaClub": "Vespa Club La Spezia",
    "cittaProvenienza": "La Spezia",
    "tesseraVci": "VCI-13425",
    "tesseraMotornext": "MN-36025",
    "email": "alessia.ferrara@email.it",
    "telefono": "+39 355 3469125",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Primavera 125 i-get",
    "annoVespa": 2018,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_ferrara.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da La Spezia (Vespa Club La Spezia)."
  },
  {
    "id": "VCA-2026-1027",
    "createdAt": "2026-09-27T15:52:00.054Z",
    "cognome": "GALLI",
    "nome": "Andrea",
    "vespaClub": "Vespa Club Aosta",
    "cittaProvenienza": "Aosta",
    "tesseraVci": "VCI-13562",
    "tesseraMotornext": "MN-36266",
    "email": "andrea.galli@gmail.com",
    "telefono": "+39 362 3567890",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 300 Super Sport HPE",
    "annoVespa": 2023,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_galli.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Aosta (Vespa Club Aosta)."
  },
  {
    "id": "VCA-2026-1028",
    "createdAt": "2026-09-28T03:52:00.054Z",
    "cognome": "MARTINI",
    "nome": "Camilla",
    "vespaClub": "Vespa Club Pavia",
    "cittaProvenienza": "Pavia",
    "tesseraVci": "VCI-13699",
    "tesseraMotornext": "MN-36507",
    "email": "camilla.martini@email.it",
    "telefono": "+39 369 3666655",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Gtv 300 Sei Giorni",
    "annoVespa": 2024,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_martini.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Pavia (Vespa Club Pavia)."
  },
  {
    "id": "VCA-2026-1029",
    "createdAt": "2026-09-28T15:52:00.054Z",
    "cognome": "LEONE",
    "nome": "Federico",
    "vespaClub": "Vespa Club Vigevano",
    "cittaProvenienza": "Vigevano",
    "tesseraVci": "VCI-13836",
    "tesseraMotornext": "MN-36748",
    "email": "federico.leone@gmail.com",
    "telefono": "+39 376 3765420",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 98",
    "annoVespa": 1946,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Vigevano (Vespa Club Vigevano)."
  },
  {
    "id": "VCA-2026-1030",
    "createdAt": "2026-09-29T03:52:00.054Z",
    "cognome": "LONGO",
    "nome": "Beatrice",
    "vespaClub": "Vespa Club Milano",
    "cittaProvenienza": "Milano",
    "tesseraVci": "VCI-13973",
    "tesseraMotornext": "MN-36989",
    "email": "beatrice.longo@email.it",
    "telefono": "+39 383 3864185",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Bacchetta",
    "annoVespa": 1948,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_longo.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Milano (Vespa Club Milano)."
  },
  {
    "id": "VCA-2026-1031",
    "createdAt": "2026-09-29T15:52:00.054Z",
    "cognome": "GENTILE",
    "nome": "Luca",
    "vespaClub": "Vespa Club Lodi",
    "cittaProvenienza": "Lodi",
    "tesseraVci": "VCI-14110",
    "tesseraMotornext": "MN-37230",
    "email": "luca.gentile@gmail.com",
    "telefono": "+39 320 3962950",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 \"Vacanze Romane\"",
    "annoVespa": 1953,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_gentile.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Lodi (Vespa Club Lodi)."
  },
  {
    "id": "VCA-2026-1032",
    "createdAt": "2026-09-30T03:52:00.054Z",
    "cognome": "MARTINELLI",
    "nome": "Sofia",
    "vespaClub": "Vespa Club Monza",
    "cittaProvenienza": "Monza",
    "tesseraVci": "VCI-14247",
    "tesseraMotornext": "MN-37471",
    "email": "sofia.martinelli@email.it",
    "telefono": "+39 327 4061715",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 GS (Grand Sport)",
    "annoVespa": 1955,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_martinelli.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Monza (Vespa Club Monza)."
  },
  {
    "id": "VCA-2026-1033",
    "createdAt": "2026-09-30T15:52:00.054Z",
    "cognome": "VITALE",
    "nome": "Daniele",
    "vespaClub": "Vespa Club Varese",
    "cittaProvenienza": "Varese",
    "tesseraVci": "VCI-14384",
    "tesseraMotornext": "MN-37712",
    "email": "daniele.vitale@gmail.com",
    "telefono": "+39 334 4160480",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Struzzo",
    "annoVespa": 1956,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_vitale.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Varese (Vespa Club Varese)."
  },
  {
    "id": "VCA-2026-1034",
    "createdAt": "2026-10-01T03:52:00.054Z",
    "cognome": "SERRA",
    "nome": "Irene",
    "vespaClub": "Vespa Club Cremona",
    "cittaProvenienza": "Cremona",
    "tesseraVci": "VCI-14521",
    "tesseraMotornext": "MN-37953",
    "email": "irene.serra@email.it",
    "telefono": "+39 341 4259245",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 VNB",
    "annoVespa": 1961,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_serra.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Cremona (Vespa Club Cremona)."
  },
  {
    "id": "VCA-2026-1035",
    "createdAt": "2026-10-01T15:52:00.054Z",
    "cognome": "COPPOLA",
    "nome": "Massimo",
    "vespaClub": "Vespa Club Como",
    "cittaProvenienza": "Como",
    "tesseraVci": "VCI-14658",
    "tesseraMotornext": "MN-38194",
    "email": "massimo.coppola@gmail.com",
    "telefono": "+39 348 4358010",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 N",
    "annoVespa": 1963,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_coppola.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Como (Vespa Club Como)."
  },
  {
    "id": "VCA-2026-1036",
    "createdAt": "2026-10-02T03:52:00.054Z",
    "cognome": "DE ANGELIS",
    "nome": "Monica",
    "vespaClub": "Vespa Club Bergamo",
    "cittaProvenienza": "Bergamo",
    "tesseraVci": "VCI-14795",
    "tesseraMotornext": "MN-38435",
    "email": "monica.deangelis@email.it",
    "telefono": "+39 355 4456775",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Sprint",
    "annoVespa": 1965,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Bergamo (Vespa Club Bergamo)."
  },
  {
    "id": "VCA-2026-1037",
    "createdAt": "2026-10-02T15:52:00.054Z",
    "cognome": "PARISI",
    "nome": "Stefano",
    "vespaClub": "Vespa Club Lecco",
    "cittaProvenienza": "Lecco",
    "tesseraVci": "VCI-14932",
    "tesseraMotornext": "MN-38676",
    "email": "stefano.parisi@gmail.com",
    "telefono": "+39 362 4555540",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 180 Super Sport",
    "annoVespa": 1966,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_parisi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Lecco (Vespa Club Lecco)."
  },
  {
    "id": "VCA-2026-1038",
    "createdAt": "2026-10-03T03:52:00.054Z",
    "cognome": "VILLA",
    "nome": "Serena",
    "vespaClub": "Vespa Club Brescia",
    "cittaProvenienza": "Brescia",
    "tesseraVci": "VCI-15069",
    "tesseraMotornext": "MN-38917",
    "email": "serena.villa@email.it",
    "telefono": "+39 369 4654305",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera",
    "annoVespa": 1968,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_villa.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Brescia (Vespa Club Brescia)."
  },
  {
    "id": "VCA-2026-1039",
    "createdAt": "2026-10-03T15:52:00.054Z",
    "cognome": "CONTE",
    "nome": "Claudio",
    "vespaClub": "Vespa Club Mantova",
    "cittaProvenienza": "Mantova",
    "tesseraVci": "VCI-15206",
    "tesseraMotornext": "MN-39158",
    "email": "claudio.conte@gmail.com",
    "telefono": "+39 376 4753070",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Rally",
    "annoVespa": 1968,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_conte.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Mantova (Vespa Club Mantova)."
  },
  {
    "id": "VCA-2026-1040",
    "createdAt": "2026-10-04T03:52:00.054Z",
    "cognome": "FERRARO",
    "nome": "Giorgia",
    "vespaClub": "Vespa Club Piacenza",
    "cittaProvenienza": "Piacenza",
    "tesseraVci": "VCI-15343",
    "tesseraMotornext": "MN-39399",
    "email": "giorgia.ferraro@email.it",
    "telefono": "+39 383 4851835",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Special",
    "annoVespa": 1970,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_ferraro.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Piacenza (Vespa Club Piacenza)."
  },
  {
    "id": "VCA-2026-1041",
    "createdAt": "2026-10-04T15:52:00.054Z",
    "cognome": "MARCHETTI",
    "nome": "Alberto",
    "vespaClub": "Vespa Club Parma",
    "cittaProvenienza": "Parma",
    "tesseraVci": "VCI-15480",
    "tesseraMotornext": "MN-39640",
    "email": "alberto.marchetti@gmail.com",
    "telefono": "+39 320 4950600",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 200 Rally Elettronica",
    "annoVespa": 1972,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_marchetti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Parma (Vespa Club Parma)."
  },
  {
    "id": "VCA-2026-1042",
    "createdAt": "2026-10-05T03:52:00.054Z",
    "cognome": "PELLEGRINI",
    "nome": "Carlotta",
    "vespaClub": "Vespa Club Reggio Emilia",
    "cittaProvenienza": "Reggio Emilia",
    "tesseraVci": "VCI-15617",
    "tesseraMotornext": "MN-39881",
    "email": "carlotta.pellegrini@email.it",
    "telefono": "+39 327 5049365",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera ET3",
    "annoVespa": 1976,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_pellegrini.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Reggio Emilia (Vespa Club Reggio Emilia)."
  },
  {
    "id": "VCA-2026-1043",
    "createdAt": "2026-10-05T15:52:00.054Z",
    "cognome": "VALENTINI",
    "nome": "Valerio",
    "vespaClub": "Vespa Club Modena",
    "cittaProvenienza": "Modena",
    "tesseraVci": "VCI-15754",
    "tesseraMotornext": "MN-40122",
    "email": "valerio.valentini@gmail.com",
    "telefono": "+39 334 5148130",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 125",
    "annoVespa": 1978,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Modena (Vespa Club Modena)."
  },
  {
    "id": "VCA-2026-1044",
    "createdAt": "2026-10-06T03:52:00.054Z",
    "cognome": "CARBONE",
    "nome": "Elisa",
    "vespaClub": "Vespa Club Bologna",
    "cittaProvenienza": "Bologna",
    "tesseraVci": "VCI-15891",
    "tesseraMotornext": "MN-40363",
    "email": "elisa.carbone@email.it",
    "telefono": "+39 341 5246895",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 150 E",
    "annoVespa": 1981,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_carbone.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Bologna (Vespa Club Bologna)."
  },
  {
    "id": "VCA-2026-1045",
    "createdAt": "2026-10-06T15:52:00.054Z",
    "cognome": "FABBRI",
    "nome": "Paolo",
    "vespaClub": "Vespa Club Ferrara",
    "cittaProvenienza": "Ferrara",
    "tesseraVci": "VCI-16028",
    "tesseraMotornext": "MN-40604",
    "email": "paolo.fabbri@gmail.com",
    "telefono": "+39 348 5345660",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 200 E Arcobaleno",
    "annoVespa": 1984,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_fabbri.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Ferrara (Vespa Club Ferrara)."
  },
  {
    "id": "VCA-2026-1046",
    "createdAt": "2026-10-07T03:52:00.054Z",
    "cognome": "MAZZA",
    "nome": "Michela",
    "vespaClub": "Vespa Club Ravenna",
    "cittaProvenienza": "Ravenna",
    "tesseraVci": "VCI-16165",
    "tesseraMotornext": "MN-40845",
    "email": "michela.mazza@email.it",
    "telefono": "+39 355 5444425",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa T5 Pole Position",
    "annoVespa": 1985,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_mazza.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Ravenna (Vespa Club Ravenna)."
  },
  {
    "id": "VCA-2026-1047",
    "createdAt": "2026-10-07T15:52:00.054Z",
    "cognome": "SILVESTRI",
    "nome": "Emanuele",
    "vespaClub": "Vespa Club Rimini",
    "cittaProvenienza": "Rimini",
    "tesseraVci": "VCI-16302",
    "tesseraMotornext": "MN-41086",
    "email": "emanuele.silvestri@gmail.com",
    "telefono": "+39 362 5543190",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Cosa 200",
    "annoVespa": 1990,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_silvestri.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Rimini (Vespa Club Rimini)."
  },
  {
    "id": "VCA-2026-1048",
    "createdAt": "2026-10-08T03:52:00.054Z",
    "cognome": "GIULIANI",
    "nome": "Noemi",
    "vespaClub": "Vespa Club Verona",
    "cittaProvenienza": "Verona",
    "tesseraVci": "VCI-16439",
    "tesseraMotornext": "MN-41327",
    "email": "noemi.giuliani@email.it",
    "telefono": "+39 369 5641955",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Revival",
    "annoVespa": 1991,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_giuliani.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Verona (Vespa Club Verona)."
  },
  {
    "id": "VCA-2026-1049",
    "createdAt": "2026-10-08T15:52:00.054Z",
    "cognome": "BASILE",
    "nome": "Maurizio",
    "vespaClub": "Vespa Club Vicenza",
    "cittaProvenienza": "Vicenza",
    "tesseraVci": "VCI-16576",
    "tesseraMotornext": "MN-41568",
    "email": "maurizio.basile@gmail.com",
    "telefono": "+39 376 5740720",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa ET4 150",
    "annoVespa": 1998,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_basile.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Vicenza (Vespa Club Vicenza)."
  },
  {
    "id": "VCA-2026-1050",
    "createdAt": "2026-10-09T03:52:00.054Z",
    "cognome": "D'ANGELO",
    "nome": "Daniela",
    "vespaClub": "Vespa Club Padova",
    "cittaProvenienza": "Padova",
    "tesseraVci": "VCI-16713",
    "tesseraMotornext": "MN-41809",
    "email": "daniela.dangelo@email.it",
    "telefono": "+39 383 5839485",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Granturismo 200 L",
    "annoVespa": 2003,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Padova (Vespa Club Padova)."
  },
  {
    "id": "VCA-2026-1051",
    "createdAt": "2026-10-09T15:52:00.054Z",
    "cognome": "DUMONT",
    "nome": "Jean-Pierre",
    "vespaClub": "Vespa Club Nice Côte d'Azur",
    "cittaProvenienza": "Nizza (Francia)",
    "tesseraVci": "VCI-16850",
    "tesseraMotornext": "MN-42050",
    "email": "jeanpierre.dumont@gmail.com",
    "telefono": "+39 320 5938250",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 250 i.e.",
    "annoVespa": 2006,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_dumont.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Nizza (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1052",
    "createdAt": "2026-10-10T03:52:00.054Z",
    "cognome": "BERNARD",
    "nome": "Céline",
    "vespaClub": "Vespa Club Lyon",
    "cittaProvenienza": "Lione (Francia)",
    "tesseraVci": "VCI-16987",
    "tesseraMotornext": "MN-42291",
    "email": "cline.bernard@email.it",
    "telefono": "+39 327 6037015",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 300 Super",
    "annoVespa": 2012,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_bernard.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Lione (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1053",
    "createdAt": "2026-10-10T15:52:00.054Z",
    "cognome": "LEFEVRE",
    "nome": "Laurent",
    "vespaClub": "Vespa Club Paris",
    "cittaProvenienza": "Parigi (Francia)",
    "tesseraVci": "VCI-17124",
    "tesseraMotornext": "MN-42532",
    "email": "laurent.lefevre@gmail.com",
    "telefono": "+39 334 6135780",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 946",
    "annoVespa": 2013,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_lefevre.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Parigi (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1054",
    "createdAt": "2026-10-11T03:52:00.054Z",
    "cognome": "DUBOIS",
    "nome": "Sophie",
    "vespaClub": "Vespa Club Marseille",
    "cittaProvenienza": "Marsiglia (Francia)",
    "tesseraVci": "VCI-17261",
    "tesseraMotornext": "MN-42773",
    "email": "sophie.dubois@email.it",
    "telefono": "+39 341 6234545",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Primavera 125 i-get",
    "annoVespa": 2018,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_dubois.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Marsiglia (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1055",
    "createdAt": "2026-10-11T15:52:00.054Z",
    "cognome": "MÜLLER",
    "nome": "Hans",
    "vespaClub": "Vespa Club Genève",
    "cittaProvenienza": "Ginevra (Svizzera)",
    "tesseraVci": "VCI-17398",
    "tesseraMotornext": "MN-43014",
    "email": "hans.mller@gmail.com",
    "telefono": "+39 348 6333310",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 300 Super Sport HPE",
    "annoVespa": 2023,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_mller.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Ginevra (Svizzera). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1056",
    "createdAt": "2026-10-12T03:52:00.054Z",
    "cognome": "SCHNEIDER",
    "nome": "Klaus",
    "vespaClub": "Vespa Club Zürich",
    "cittaProvenienza": "Zurigo (Svizzera)",
    "tesseraVci": "VCI-17535",
    "tesseraMotornext": "MN-43255",
    "email": "klaus.schneider@email.it",
    "telefono": "+39 355 6432075",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Gtv 300 Sei Giorni",
    "annoVespa": 2024,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_schneider.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Zurigo (Svizzera). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1057",
    "createdAt": "2026-10-12T15:52:00.054Z",
    "cognome": "WEBER",
    "nome": "Urs",
    "vespaClub": "Vespa Club Lugano",
    "cittaProvenienza": "Lugano (Svizzera)",
    "tesseraVci": "VCI-17672",
    "tesseraMotornext": "MN-43496",
    "email": "urs.weber@gmail.com",
    "telefono": "+39 362 6530840",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 98",
    "annoVespa": 1946,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Lugano (Svizzera). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1058",
    "createdAt": "2026-10-13T03:52:00.054Z",
    "cognome": "FISCHER",
    "nome": "Beat",
    "vespaClub": "Vespa Club München",
    "cittaProvenienza": "Monaco di Baviera (Germania)",
    "tesseraVci": "VCI-17809",
    "tesseraMotornext": "MN-43737",
    "email": "beat.fischer@email.it",
    "telefono": "+39 369 6629605",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Bacchetta",
    "annoVespa": 1948,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_fischer.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Monaco di Baviera (Germania). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1059",
    "createdAt": "2026-10-13T15:52:00.054Z",
    "cognome": "HUBER",
    "nome": "Markus",
    "vespaClub": "Vespa Club Stuttgart",
    "cittaProvenienza": "Stoccarda (Germania)",
    "tesseraVci": "VCI-17946",
    "tesseraMotornext": "MN-43978",
    "email": "markus.huber@gmail.com",
    "telefono": "+39 376 6728370",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 \"Vacanze Romane\"",
    "annoVespa": 1953,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_huber.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Stoccarda (Germania). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1060",
    "createdAt": "2026-10-14T03:52:00.054Z",
    "cognome": "GRUBER",
    "nome": "Franz",
    "vespaClub": "Vespa Club Wien",
    "cittaProvenienza": "Vienna (Austria)",
    "tesseraVci": "VCI-18083",
    "tesseraMotornext": "MN-44219",
    "email": "franz.gruber@email.it",
    "telefono": "+39 383 6827135",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 GS (Grand Sport)",
    "annoVespa": 1955,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_gruber.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Vienna (Austria). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1061",
    "createdAt": "2026-10-14T15:52:00.054Z",
    "cognome": "WAGNER",
    "nome": "Stefan",
    "vespaClub": "Vespa Club Innsbruck",
    "cittaProvenienza": "Innsbruck (Austria)",
    "tesseraVci": "VCI-18220",
    "tesseraMotornext": "MN-44460",
    "email": "stefan.wagner@gmail.com",
    "telefono": "+39 320 6925900",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 150 Struzzo",
    "annoVespa": 1956,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_wagner.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Innsbruck (Austria). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1062",
    "createdAt": "2026-10-15T03:52:00.054Z",
    "cognome": "PEETERS",
    "nome": "Luc",
    "vespaClub": "Vespa Club Bruxelles",
    "cittaProvenienza": "Bruxelles (Belgio)",
    "tesseraVci": "VCI-18357",
    "tesseraMotornext": "MN-44701",
    "email": "luc.peeters@email.it",
    "telefono": "+39 327 7024665",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 VNB",
    "annoVespa": 1961,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_peeters.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Bruxelles (Belgio). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1063",
    "createdAt": "2026-10-15T15:52:00.054Z",
    "cognome": "GARCIA",
    "nome": "Javier",
    "vespaClub": "Vespa Club Barcelona",
    "cittaProvenienza": "Barcellona (Spagna)",
    "tesseraVci": "VCI-18494",
    "tesseraMotornext": "MN-44942",
    "email": "javier.garcia@gmail.com",
    "telefono": "+39 334 7123430",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 N",
    "annoVespa": 1963,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_garcia.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Barcellona (Spagna). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1064",
    "createdAt": "2026-10-16T03:52:00.054Z",
    "cognome": "RODRIGUEZ",
    "nome": "Manuel",
    "vespaClub": "Vespa Club London",
    "cittaProvenienza": "Londra (UK)",
    "tesseraVci": "VCI-18631",
    "tesseraMotornext": "MN-45183",
    "email": "manuel.rodriguez@email.it",
    "telefono": "+39 341 7222195",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Sprint",
    "annoVespa": 1965,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Londra (UK). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1065",
    "createdAt": "2026-10-16T15:52:00.054Z",
    "cognome": "SMITH",
    "nome": "Oliver",
    "vespaClub": "Vespa Club Ancona",
    "cittaProvenienza": "Ancona",
    "tesseraVci": "VCI-18768",
    "tesseraMotornext": "MN-45424",
    "email": "oliver.smith@gmail.com",
    "telefono": "+39 348 7320960",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Super Sport",
    "annoVespa": 1966,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_smith.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Ancona (Vespa Club Ancona)."
  },
  {
    "id": "VCA-2026-1066",
    "createdAt": "2026-10-17T03:52:00.054Z",
    "cognome": "BROWN",
    "nome": "James",
    "vespaClub": "Vespa Club Pesaro",
    "cittaProvenienza": "Pesaro",
    "tesseraVci": "VCI-18905",
    "tesseraMotornext": "MN-45665",
    "email": "james.brown@email.it",
    "telefono": "+39 355 7419725",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera",
    "annoVespa": 1968,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_brown.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Pesaro (Vespa Club Pesaro)."
  },
  {
    "id": "VCA-2026-1067",
    "createdAt": "2026-10-17T15:52:00.054Z",
    "cognome": "TESTA",
    "nome": "Enrico",
    "vespaClub": "Vespa Club Ascoli Piceno",
    "cittaProvenienza": "Ascoli Piceno",
    "tesseraVci": "VCI-19042",
    "tesseraMotornext": "MN-45906",
    "email": "enrico.testa@gmail.com",
    "telefono": "+39 362 7518490",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Rally",
    "annoVespa": 1968,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_testa.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Ascoli Piceno (Vespa Club Ascoli Piceno)."
  },
  {
    "id": "VCA-2026-1068",
    "createdAt": "2026-10-18T03:52:00.054Z",
    "cognome": "GRASSO",
    "nome": "Vincenzo",
    "vespaClub": "Vespa Club Roma",
    "cittaProvenienza": "Roma",
    "tesseraVci": "VCI-19179",
    "tesseraMotornext": "MN-46147",
    "email": "vincenzo.grasso@email.it",
    "telefono": "+39 369 7617255",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Special",
    "annoVespa": 1970,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_grasso.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Roma (Vespa Club Roma)."
  },
  {
    "id": "VCA-2026-1069",
    "createdAt": "2026-10-18T15:52:00.054Z",
    "cognome": "FALCONE",
    "nome": "Domenico",
    "vespaClub": "Vespa Club Viterbo",
    "cittaProvenienza": "Viterbo",
    "tesseraVci": "VCI-19316",
    "tesseraMotornext": "MN-46388",
    "email": "domenico.falcone@gmail.com",
    "telefono": "+39 376 7716020",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 200 Rally Elettronica",
    "annoVespa": 1972,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_falcone.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Viterbo (Vespa Club Viterbo)."
  },
  {
    "id": "VCA-2026-1070",
    "createdAt": "2026-10-19T03:52:00.054Z",
    "cognome": "SALA",
    "nome": "Guido",
    "vespaClub": "Vespa Club Latina",
    "cittaProvenienza": "Latina",
    "tesseraVci": "VCI-19453",
    "tesseraMotornext": "MN-46629",
    "email": "guido.sala@email.it",
    "telefono": "+39 383 7814785",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera ET3",
    "annoVespa": 1976,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_sala.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Latina (Vespa Club Latina)."
  },
  {
    "id": "VCA-2026-1071",
    "createdAt": "2026-10-19T15:52:00.054Z",
    "cognome": "MONTI",
    "nome": "Corrado",
    "vespaClub": "Vespa Club L'Aquila",
    "cittaProvenienza": "L'Aquila",
    "tesseraVci": "VCI-19590",
    "tesseraMotornext": "MN-46870",
    "email": "corrado.monti@gmail.com",
    "telefono": "+39 320 7913550",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 125",
    "annoVespa": 1978,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da L'Aquila (Vespa Club L'Aquila)."
  },
  {
    "id": "VCA-2026-1072",
    "createdAt": "2026-10-20T03:52:00.054Z",
    "cognome": "ORLANDO",
    "nome": "Fabrizio",
    "vespaClub": "Vespa Club Pescara",
    "cittaProvenienza": "Pescara",
    "tesseraVci": "VCI-19727",
    "tesseraMotornext": "MN-47111",
    "email": "fabrizio.orlando@email.it",
    "telefono": "+39 327 8012315",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 150 E",
    "annoVespa": 1981,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_orlando.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Pescara (Vespa Club Pescara)."
  },
  {
    "id": "VCA-2026-1073",
    "createdAt": "2026-10-20T15:52:00.054Z",
    "cognome": "BORGHI",
    "nome": "Gianluca",
    "vespaClub": "Vespa Club Campobasso",
    "cittaProvenienza": "Campobasso",
    "tesseraVci": "VCI-19864",
    "tesseraMotornext": "MN-47352",
    "email": "gianluca.borghi@gmail.com",
    "telefono": "+39 334 8111080",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa PX 200 E Arcobaleno",
    "annoVespa": 1984,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_borghi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Campobasso (Vespa Club Campobasso)."
  },
  {
    "id": "VCA-2026-1074",
    "createdAt": "2026-10-21T03:52:00.054Z",
    "cognome": "GATTI",
    "nome": "Cesare",
    "vespaClub": "Vespa Club Napoli",
    "cittaProvenienza": "Napoli",
    "tesseraVci": "VCI-20001",
    "tesseraMotornext": "MN-47593",
    "email": "cesare.gatti@email.it",
    "telefono": "+39 341 8209845",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa T5 Pole Position",
    "annoVespa": 1985,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_gatti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Napoli (Vespa Club Napoli)."
  },
  {
    "id": "VCA-2026-1075",
    "createdAt": "2026-10-21T15:52:00.054Z",
    "cognome": "NEGRI",
    "nome": "Edoardo",
    "vespaClub": "Vespa Club Salerno",
    "cittaProvenienza": "Salerno",
    "tesseraVci": "VCI-20138",
    "tesseraMotornext": "MN-47834",
    "email": "edoardo.negri@gmail.com",
    "telefono": "+39 348 8308610",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Cosa 200",
    "annoVespa": 1990,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_negri.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Salerno (Vespa Club Salerno)."
  },
  {
    "id": "VCA-2026-1076",
    "createdAt": "2026-10-22T03:52:00.054Z",
    "cognome": "BARONE",
    "nome": "Tiziano",
    "vespaClub": "Vespa Club Caserta",
    "cittaProvenienza": "Caserta",
    "tesseraVci": "VCI-20275",
    "tesseraMotornext": "MN-48075",
    "email": "tiziano.barone@email.it",
    "telefono": "+39 355 8407375",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Revival",
    "annoVespa": 1991,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_barone.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Caserta (Vespa Club Caserta)."
  },
  {
    "id": "VCA-2026-1077",
    "createdAt": "2026-10-22T15:52:00.054Z",
    "cognome": "SORRENTINO",
    "nome": "Gennaro",
    "vespaClub": "Vespa Club Avellino",
    "cittaProvenienza": "Avellino",
    "tesseraVci": "VCI-20412",
    "tesseraMotornext": "MN-48316",
    "email": "gennaro.sorrentino@gmail.com",
    "telefono": "+39 362 8506140",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa ET4 150",
    "annoVespa": 1998,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_sorrentino.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Avellino (Vespa Club Avellino)."
  },
  {
    "id": "VCA-2026-1078",
    "createdAt": "2026-10-23T03:52:00.054Z",
    "cognome": "DAMICO",
    "nome": "Fabrizio",
    "vespaClub": "Vespa Club Bari",
    "cittaProvenienza": "Bari",
    "tesseraVci": "VCI-20549",
    "tesseraMotornext": "MN-48557",
    "email": "fabrizio.damico@email.it",
    "telefono": "+39 369 8604905",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Granturismo 200 L",
    "annoVespa": 2003,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Bari (Vespa Club Bari)."
  },
  {
    "id": "VCA-2026-1079",
    "createdAt": "2026-10-23T15:52:00.054Z",
    "cognome": "RUGGIERO",
    "nome": "Giuseppe",
    "vespaClub": "Vespa Club Foggia",
    "cittaProvenienza": "Foggia",
    "tesseraVci": "VCI-20686",
    "tesseraMotornext": "MN-48798",
    "email": "giuseppe.ruggiero@gmail.com",
    "telefono": "+39 376 8703670",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 250 i.e.",
    "annoVespa": 2006,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_ruggiero.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Foggia (Vespa Club Foggia)."
  },
  {
    "id": "VCA-2026-1080",
    "createdAt": "2026-10-24T03:52:00.054Z",
    "cognome": "PALUMBO",
    "nome": "Carmine",
    "vespaClub": "Vespa Club Taranto",
    "cittaProvenienza": "Taranto",
    "tesseraVci": "VCI-20823",
    "tesseraMotornext": "MN-49039",
    "email": "carmine.palumbo@email.it",
    "telefono": "+39 383 8802435",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 300 Super",
    "annoVespa": 2012,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_palumbo.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Taranto (Vespa Club Taranto)."
  },
  {
    "id": "VCA-2026-1081",
    "createdAt": "2026-10-24T15:52:00.054Z",
    "cognome": "SARTORI",
    "nome": "Mario",
    "vespaClub": "Vespa Club Brindisi",
    "cittaProvenienza": "Brindisi",
    "tesseraVci": "VCI-20960",
    "tesseraMotornext": "MN-49280",
    "email": "mario.sartori@gmail.com",
    "telefono": "+39 320 8901200",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 946",
    "annoVespa": 2013,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_sartori.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Brindisi (Vespa Club Brindisi)."
  },
  {
    "id": "VCA-2026-1082",
    "createdAt": "2026-10-25T03:52:00.054Z",
    "cognome": "ROSSETTI",
    "nome": "Angelo",
    "vespaClub": "Vespa Club Lecce",
    "cittaProvenienza": "Lecce",
    "tesseraVci": "VCI-21097",
    "tesseraMotornext": "MN-49521",
    "email": "angelo.rossetti@email.it",
    "telefono": "+39 327 8999965",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Primavera 125 i-get",
    "annoVespa": 2018,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_rossetti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Lecce (Vespa Club Lecce)."
  },
  {
    "id": "VCA-2026-1083",
    "createdAt": "2026-10-25T15:52:00.054Z",
    "cognome": "CASINI",
    "nome": "Riccardo",
    "vespaClub": "Vespa Club Potenza",
    "cittaProvenienza": "Potenza",
    "tesseraVci": "VCI-21234",
    "tesseraMotornext": "MN-49762",
    "email": "riccardo.casini@gmail.com",
    "telefono": "+39 334 9098730",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa GTS 300 Super Sport HPE",
    "annoVespa": 2023,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_casini.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Potenza (Vespa Club Potenza)."
  },
  {
    "id": "VCA-2026-1084",
    "createdAt": "2026-10-26T03:52:00.054Z",
    "cognome": "PIRAS",
    "nome": "Gavino",
    "vespaClub": "Vespa Club Matera",
    "cittaProvenienza": "Matera",
    "tesseraVci": "VCI-21371",
    "tesseraMotornext": "MN-50003",
    "email": "gavino.piras@email.it",
    "telefono": "+39 341 9197495",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa Gtv 300 Sei Giorni",
    "annoVespa": 2024,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_piras.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Matera (Vespa Club Matera)."
  },
  {
    "id": "VCA-2026-1085",
    "createdAt": "2026-10-26T15:52:00.054Z",
    "cognome": "MELIS",
    "nome": "Efisio",
    "vespaClub": "Vespa Club Cosenza",
    "cittaProvenienza": "Cosenza",
    "tesseraVci": "VCI-21508",
    "tesseraMotornext": "MN-50244",
    "email": "efisio.melis@gmail.com",
    "telefono": "+39 348 9296260",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 98",
    "annoVespa": 1946,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Cosenza (Vespa Club Cosenza)."
  },
  {
    "id": "VCA-2026-1086",
    "createdAt": "2026-10-27T03:52:00.054Z",
    "cognome": "SANNA",
    "nome": "Nicola",
    "vespaClub": "Vespa Club Catanzaro",
    "cittaProvenienza": "Catanzaro",
    "tesseraVci": "VCI-21645",
    "tesseraMotornext": "MN-50485",
    "email": "nicola.sanna@email.it",
    "telefono": "+39 355 9395025",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Bacchetta",
    "annoVespa": 1948,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_sanna.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Catanzaro (Vespa Club Catanzaro)."
  },
  {
    "id": "VCA-2026-1087",
    "createdAt": "2026-10-27T15:52:00.054Z",
    "cognome": "LIPPI",
    "nome": "Marcello",
    "vespaClub": "Vespa Club Reggio Calabria",
    "cittaProvenienza": "Reggio Calabria",
    "tesseraVci": "VCI-21782",
    "tesseraMotornext": "MN-50726",
    "email": "marcello.lippi@gmail.com",
    "telefono": "+39 362 9493790",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 \"Vacanze Romane\"",
    "annoVespa": 1953,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_lippi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Reggio Calabria (Vespa Club Reggio Calabria)."
  },
  {
    "id": "VCA-2026-1088",
    "createdAt": "2026-10-28T03:52:00.054Z",
    "cognome": "BONETTI",
    "nome": "Pierluigi",
    "vespaClub": "Vespa Club Palermo",
    "cittaProvenienza": "Palermo",
    "tesseraVci": "VCI-21919",
    "tesseraMotornext": "MN-50967",
    "email": "pierluigi.bonetti@email.it",
    "telefono": "+39 369 9592555",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 GS (Grand Sport)",
    "annoVespa": 1955,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_bonetti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Palermo (Vespa Club Palermo)."
  },
  {
    "id": "VCA-2026-1089",
    "createdAt": "2026-10-28T15:52:00.054Z",
    "cognome": "BERTI",
    "nome": "Renato",
    "vespaClub": "Vespa Club Catania",
    "cittaProvenienza": "Catania",
    "tesseraVci": "VCI-22056",
    "tesseraMotornext": "MN-51208",
    "email": "renato.berti@gmail.com",
    "telefono": "+39 376 9691320",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Struzzo",
    "annoVespa": 1956,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_berti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Catania (Vespa Club Catania)."
  },
  {
    "id": "VCA-2026-1090",
    "createdAt": "2026-10-29T03:52:00.054Z",
    "cognome": "FARINA",
    "nome": "Massimiliano",
    "vespaClub": "Vespa Club Messina",
    "cittaProvenienza": "Messina",
    "tesseraVci": "VCI-22193",
    "tesseraMotornext": "MN-51449",
    "email": "massimiliano.farina@email.it",
    "telefono": "+39 383 9790085",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 VNB",
    "annoVespa": 1961,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_farina.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Messina (Vespa Club Messina)."
  },
  {
    "id": "VCA-2026-1091",
    "createdAt": "2026-10-29T15:52:00.054Z",
    "cognome": "VALLI",
    "nome": "Silvio",
    "vespaClub": "Vespa Club Siracusa",
    "cittaProvenienza": "Siracusa",
    "tesseraVci": "VCI-22330",
    "tesseraMotornext": "MN-51690",
    "email": "silvio.valli@gmail.com",
    "telefono": "+39 320 9888850",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 N",
    "annoVespa": 1963,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_valli.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Siracusa (Vespa Club Siracusa)."
  },
  {
    "id": "VCA-2026-1092",
    "createdAt": "2026-10-30T03:52:00.054Z",
    "cognome": "BRAMBILLA",
    "nome": "Ambrogio",
    "vespaClub": "Vespa Club Trapani",
    "cittaProvenienza": "Trapani",
    "tesseraVci": "VCI-22467",
    "tesseraMotornext": "MN-51931",
    "email": "ambrogio.brambilla@email.it",
    "telefono": "+39 327 9987615",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 150 Sprint",
    "annoVespa": 1965,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Trapani (Vespa Club Trapani)."
  },
  {
    "id": "VCA-2026-1093",
    "createdAt": "2026-10-30T15:52:00.054Z",
    "cognome": "FUMAGALLI",
    "nome": "Carlo",
    "vespaClub": "Vespa Club Agrigento",
    "cittaProvenienza": "Agrigento",
    "tesseraVci": "VCI-22604",
    "tesseraMotornext": "MN-52172",
    "email": "carlo.fumagalli@gmail.com",
    "telefono": "+39 334 1086380",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Super Sport",
    "annoVespa": 1966,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_fumagalli.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Agrigento (Vespa Club Agrigento)."
  },
  {
    "id": "VCA-2026-1094",
    "createdAt": "2026-10-31T03:52:00.054Z",
    "cognome": "PAGANI",
    "nome": "Giulio",
    "vespaClub": "Vespa Club Cagliari",
    "cittaProvenienza": "Cagliari",
    "tesseraVci": "VCI-22741",
    "tesseraMotornext": "MN-52413",
    "email": "giulio.pagani@email.it",
    "telefono": "+39 341 1185145",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera",
    "annoVespa": 1968,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_pagani.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Cagliari (Vespa Club Cagliari)."
  },
  {
    "id": "VCA-2026-1095",
    "createdAt": "2026-10-31T15:52:00.054Z",
    "cognome": "BERETTA",
    "nome": "Sergio",
    "vespaClub": "Vespa Club Sassari",
    "cittaProvenienza": "Sassari",
    "tesseraVci": "VCI-22878",
    "tesseraMotornext": "MN-52654",
    "email": "sergio.beretta@gmail.com",
    "telefono": "+39 348 1283910",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 180 Rally",
    "annoVespa": 1968,
    "tagliaTshirt": "XXL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_beretta.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Sassari (Vespa Club Sassari)."
  },
  {
    "id": "VCA-2026-1096",
    "createdAt": "2026-11-01T03:52:00.054Z",
    "cognome": "CASTIGLIONI",
    "nome": "Walter",
    "vespaClub": "Vespa Club Olbia",
    "cittaProvenienza": "Olbia",
    "tesseraVci": "VCI-23015",
    "tesseraMotornext": "MN-52895",
    "email": "walter.castiglioni@email.it",
    "telefono": "+39 355 1382675",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 50 Special",
    "annoVespa": 1970,
    "tagliaTshirt": "3XL",
    "modalitaPartecipazione": "COMPLETA Sabato + Domenica - € 95",
    "importoDovuto": 95,
    "statoPagamento": "RICEVUTA_DA_VERIFICARE",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": {
      "name": "ricevuta_castiglioni.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Iscrizione confermata da Olbia (Vespa Club Olbia)."
  },
  {
    "id": "VCA-2026-1097",
    "createdAt": "2026-11-01T15:52:00.054Z",
    "cognome": "PIROVANO",
    "nome": "Franco",
    "vespaClub": "Vespa Club Nice Côte d'Azur",
    "cittaProvenienza": "Nizza (Francia)",
    "tesseraVci": "VCI-23152",
    "tesseraMotornext": "MN-53136",
    "email": "franco.pirovano@gmail.com",
    "telefono": "+39 362 1481440",
    "ruolo": "PASSEGGERO",
    "modelloVespa": "Vespa 200 Rally Elettronica",
    "annoVespa": 1972,
    "tagliaTshirt": "S",
    "modalitaPartecipazione": "FULL Sabato - € 60",
    "importoDovuto": 60,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_pirovano.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Nizza (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1098",
    "createdAt": "2026-11-02T03:52:00.054Z",
    "cognome": "ZANETTI",
    "nome": "Tarcisio",
    "vespaClub": "Vespa Club Lyon",
    "cittaProvenienza": "Lione (Francia)",
    "tesseraVci": "VCI-23289",
    "tesseraMotornext": "MN-53377",
    "email": "tarcisio.zanetti@email.it",
    "telefono": "+39 369 1580205",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa 125 Primavera ET3",
    "annoVespa": 1976,
    "tagliaTshirt": "M",
    "modalitaPartecipazione": "FULL Domenica - € 50",
    "importoDovuto": 50,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_zanetti.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Lione (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1099",
    "createdAt": "2026-11-02T15:52:00.054Z",
    "cognome": "BENETTON",
    "nome": "Luciano",
    "vespaClub": "Vespa Club Paris",
    "cittaProvenienza": "Parigi (Francia)",
    "tesseraVci": "VCI-23426",
    "tesseraMotornext": "MN-53618",
    "email": "luciano.benetton@gmail.com",
    "telefono": "+39 376 1678970",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 125",
    "annoVespa": 1978,
    "tagliaTshirt": "L",
    "modalitaPartecipazione": "LIGHT Sabato - € 15",
    "importoDovuto": 15,
    "statoPagamento": "NON_PAGATO",
    "ricevutaPagamentoVerified": false,
    "ricevutaPagamento": null,
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Parigi (Francia). Arrivo confermato."
  },
  {
    "id": "VCA-2026-1100",
    "createdAt": "2026-11-03T03:52:00.054Z",
    "cognome": "CREPALDI",
    "nome": "Attilio",
    "vespaClub": "Vespa Club Marseille",
    "cittaProvenienza": "Marsiglia (Francia)",
    "tesseraVci": "VCI-23563",
    "tesseraMotornext": "MN-53859",
    "email": "attilio.crepaldi@email.it",
    "telefono": "+39 383 1777735",
    "ruolo": "CONDUCENTE",
    "modelloVespa": "Vespa PX 150 E",
    "annoVespa": 1981,
    "tagliaTshirt": "XL",
    "modalitaPartecipazione": "LIGHT Domenica - € 20",
    "importoDovuto": 20,
    "statoPagamento": "PAGATO",
    "ricevutaPagamentoVerified": true,
    "ricevutaPagamento": {
      "name": "ricevuta_crepaldi.svg",
      "type": "image/svg+xml",
      "data": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"200\"><rect width=\"600\" height=\"200\" fill=\"%23f0fdf4\"/><text x=\"20\" y=\"80\" fill=\"%23166534\" font-size=\"20\" font-family=\"Arial\">BONIFICO REGISTRATO</text></svg>"
    },
    "statoAccettazioneSabato": false,
    "accettazioneSabatoTimestamp": null,
    "statoAccettazioneDomenica": false,
    "accettazioneDomenicaTimestamp": null,
    "accettazioneConclusa": false,
    "accettazioneTimestamp": null,
    "ritiroGadget": false,
    "kitGadgetConsegnato": false,
    "ritiroGadgetTimestamp": null,
    "merenda": false,
    "merendaSabatoErogata": false,
    "merendaTimestamp": null,
    "merendaSabatoErogataTimestamp": null,
    "aperitivo": false,
    "aperitivoErogato": false,
    "aperitivoTimestamp": null,
    "aperitivoSabatoErogato": false,
    "aperitivoSabatoErogatoTimestamp": null,
    "aperitivoDomenicaErogato": false,
    "aperitivoDomenicaErogatoTimestamp": null,
    "cena": false,
    "cenaSabatoErogato": false,
    "cenaTimestamp": null,
    "colazioneDomenicaErogata": false,
    "colazioneDomenicaErogataTimestamp": null,
    "pranzo": false,
    "pranzoDomenicaErogato": false,
    "pranzoTimestamp": null,
    "noteOrganizzatore": "Partecipante Internazionale proveniente da Marsiglia (Francia). Arrivo confermato."
  }
];

    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          demoItems.forEach(item => store.put(item));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch(e) { resolve(false); }
      });
    }

    localStorage.setItem('vespa_asti_registrations', JSON.stringify(demoItems));
    localStorage.removeItem('vespa_db_wiped');
    localStorage.setItem('vespa_db_initialized', 'true');
    localStorage.setItem('vespa_db_sync_pulse', Date.now().toString());
    this.saveAutoBackup(demoItems);

    // Salva sul server backend
    fetch('/api/registrations/batch-restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demoItems)
    }).catch(() => {});

    if (this.broadcast) {
      try { this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'RESET' }); } catch(e) {}
    }
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'RESET' });
  }

  // Salva automaticamente tutte le prenotazioni in un backup cumulativo unico nel localStorage
  saveAutoBackup(list) {
    try {
      if (Array.isArray(list)) {
        localStorage.setItem('vespa_asti_backup_latest', JSON.stringify({
          timestamp: new Date().toISOString(),
          count: list.length,
          data: list
        }));
      }
    } catch (e) {
      console.warn('Errore salvataggio backup cumulativo locale:', e);
    }
  }

  // AZZERA SOLO LA FRUIZIONE DEI SERVIZI (mantiene anagrafiche, pacchetti, pagato/non pagato)
  async resetServicesOnly() {
    const list = await this.getAllRegistrations();
    if (list.length === 0) {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Nessuna prenotazione presente nel database.', 'info');
      } else {
        alert('Nessuna prenotazione presente nel database.');
      }
      return;
    }

    const confirmMsg = `Sei sicuro di voler AZZERARE la fruizione di TUTTI i servizi per ${list.length} iscritti?\n\n` +
      `- Tutti i servizi (accettazione, gadget, merenda, aperitivi, cena, colazione, pranzo) torneranno a "DA EROGARE / NON CONSEGNATO".\n` +
      `- Tutte le anagrafiche, pacchetti e gli stati "PAGATO / NON PAGATO" rimarranno INTATTI.\n` +
      `- Verrà salvato preventivamente un file di backup JSON sul tuo computer.`;

    if (!confirm(confirmMsg)) return;

    // 1. Salva preventivamente il backup JSON scaricabile
    try {
      await this.exportJSON();
    } catch (e) {
      console.warn('Errore durante download backup preventivo:', e);
    }

    // 2. Salva anche snapshot nel backup cumulativo automatico
    this.saveAutoBackup(list);

    // 3. Resetta tutti i flag e timestamp dei servizi su ciascun partecipante
    const updatedList = list.map(r => {
      return {
        ...r,
        statoAccettazioneSabato: false,
        accettazioneSabatoTimestamp: null,
        statoAccettazioneDomenica: false,
        accettazioneDomenicaTimestamp: null,
        accettazioneConclusa: false,
        accettazioneTimestamp: null,

        ritiroGadget: false,
        kitGadgetConsegnato: false,
        ritiroGadgetTimestamp: null,

        merenda: false,
        merendaSabatoErogata: false,
        merendaTimestamp: null,
        merendaSabatoErogataTimestamp: null,

        aperitivo: false,
        aperitivoErogato: false,
        aperitivoTimestamp: null,
        aperitivoSabatoErogato: false,
        aperitivoSabatoErogatoTimestamp: null,
        aperitivoDomenicaErogato: false,
        aperitivoDomenicaErogatoTimestamp: null,

        cena: false,
        cenaSabatoErogato: false,
        cenaTimestamp: null,
        cenaSabatoErogatoTimestamp: null,

        colazioneDomenicaErogata: false,
        colazioneDomenicaErogataTimestamp: null,

        pranzo: false,
        pranzoDomenicaErogato: false,
        pranzoTimestamp: null
      };
    });

    // Salva nel database (IndexedDB e LocalStorage)
    await this.ensureInit();
    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          updatedList.forEach(item => store.put(item));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) { resolve(false); }
      });
    }

    this.setLocalStorageAll(updatedList);
    localStorage.setItem('vespa_db_sync_pulse', Date.now().toString());

    // Sincronizza con server backend
    try {
      await fetch('/api/registrations/batch-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedList)
      });
    } catch (e) {}

    // Salva nuovo snapshot con i servizi azzerati
    this.saveAutoBackup(updatedList);

    // Notifica broadcast
    if (this.broadcast) {
      try { this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'RESET_SERVICES' }); } catch(e) {}
    }
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'RESET_SERVICES' });

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`✅ Servizi azzerati con successo per tutti i ${updatedList.length} iscritti! Dati e pagamenti mantenuti.`, 'success');
    } else {
      alert(`Servizi azzerati con successo per tutti i ${updatedList.length} iscritti! Dati e pagamenti mantenuti.`);
    }
    // Ricarica la pagina dopo l'operazione
    setTimeout(() => location.reload(), 1200);
  }

  // AZZERA COMPLETAMENTE IL DATABASE (senza ricaricare le 20 prenotazioni demo)
  async wipeDatabase() {
    const count = (await this.getAllRegistrations()).length;
    const confirmMsg = count > 0
      ? `ATTENZIONE: Stai per CANCELLARE TUTTE le ${count} prenotazioni presenti nel database!\n\nVerrà salvato preventivamente un file di backup JSON sul tuo computer.\nSei sicuro di voler proseguire e AZZERARE il database?`
      : `Il database è già vuoto. Vuoi eseguire il reset?`;

    if (!confirm(confirmMsg)) return;

    // Salva un backup di emergenza prima di cancellare (non bloccante)
    if (count > 0) {
      try {
        await this.exportJSON();
      } catch (err) {
        console.warn('Backup export preventivo non riuscito:', err);
      }
    }

    // 1. Pulisce IndexedDB
    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch(e) { resolve(false); }
      });
    }

    // 2. Pulisce LocalStorage registrazioni ma PRESERVA il file di backup recuperabile
    localStorage.removeItem('vespa_asti_registrations');
    localStorage.setItem('vespa_db_wiped', 'true'); // Flag per impedire il ripopolamento automatico delle demo
    localStorage.setItem('vespa_db_sync_pulse', Date.now().toString());

    // 3. Notifica il backend per svuotare il file server
    try {
      await fetch('/api/registrations', { method: 'DELETE' });
    } catch (e) {}

    // 4. Notifica tutti i componenti e le schede aperte
    if (this.broadcast) {
      try { this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'WIPE' }); } catch(e) {}
    }
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'WIPE' });

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('✅ Database azzerato con successo! Tutte le prenotazioni sono state cancellate.', 'info');
    } else {
      alert("Database azzerato con successo! Tutte le prenotazioni sono state cancellate.");
    }
    // Ricarica la pagina dopo l'operazione
    setTimeout(() => location.reload(), 1200);
  }

  // Ricarica esplicitamente le 100 prenotazioni di test demo (Italia + Estero)
  async loadDemoData() {
    if (!confirm("Vuoi caricare le 100 iscrizioni demo di test (Italia ed estero) nel database?")) return;
    
    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          tx.oncomplete = () => resolve(true);
        } catch(e) { resolve(false); }
      });
    }
    localStorage.removeItem('vespa_asti_registrations');
    localStorage.removeItem('vespa_db_wiped');
    localStorage.setItem('vespa_db_initialized', 'true');
    await this.seedDemoDataIfEmpty(true);
    
    if (this.broadcast) {
      try { this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'RESET' }); } catch(e) {}
    }
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'RESET' });
    alert("100 iscrizioni demo caricate con successo!");
    // Ricarica la pagina dopo l'operazione
    setTimeout(() => location.reload(), 800);
  }

  // Alias retrocompatibile
  async resetTo20DemoData() {
    return await this.loadDemoData();
  }

// Salva un backup dandogli un nome personalizzato, salvandolo sul server (cartella backups/) e offrendo il download locale
  async saveNamedBackup() {
    await this.ensureInit();
    const list = await this.getAllRegistrations();
    if (!list || list.length === 0) {
      alert("Nessuna prenotazione presente da salvare nel backup.");
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const defaultName = `backup_raduno_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;

    const customName = prompt("Inserisci il nome da assegnare a questo backup:", defaultName);
    if (!customName || !customName.trim()) {
      return; // Annullato dall'utente
    }

    const cleanName = customName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim();
    const fileName = cleanName.toLowerCase().endsWith('.json') ? cleanName : `${cleanName}.json`;
    const nowIso = new Date().toISOString();

    const backupPayload = {
      timestamp: nowIso,
      name: cleanName.replace(/\.json$/i, ''),
      count: list.length,
      data: list
    };

    // 1. Salva sul server nella cartella /backups
    let serverSaved = false;
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName, data: list })
      });
      if (res.ok) {
        serverSaved = true;
      }
    } catch (e) {
      console.warn('Server endpoint /api/backups non raggiungibile:', e);
    }

    // 2. Salva nel registro cronologia dei backup in LocalStorage (così è sempre visibile)
    try {
      const historyRaw = localStorage.getItem('vespa_asti_named_backups');
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      // Se esiste già con lo stesso nome lo rimpiazza, altrimenti aggiunge in cima
      const filtered = history.filter(b => b.name !== backupPayload.name);
      filtered.unshift(backupPayload);
      // Mantiene fino a 20 backup nominati in locale
      localStorage.setItem('vespa_asti_named_backups', JSON.stringify(filtered.slice(0, 20)));
    } catch (e) {
      console.warn('Errore salvataggio backup locale history:', e);
    }

    // 3. Salva anche come ultimo auto-backup
    this.saveAutoBackup(list);

    // 4. Download file JSON direttamente per l'utente sul computer
    try {
      const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) {
      console.warn('Download browser file non riuscito:', e);
    }

    const msg = serverSaved 
      ? `✅ Backup "${fileName}" salvato con successo nella cartella dell'app e scaricato!`
      : `✅ Backup "${fileName}" generato e scaricato con successo!`;

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(msg, 'success');
    } else {
      alert(msg);
    }
  }

  // Mostra il modale o la lista dei backup per scegliere quale ripristinare
  async triggerRestoreBackup() {
    await this.ensureInit();
    const modal = document.getElementById('restoreBackupModal');
    if (modal) {
      modal.style.display = 'flex';
      await this.loadBackupsIntoModal();
      return;
    }

    // Fallback con prompt/confirm se il modale non è presente
    const backups = await this.fetchAllAvailableBackups();
    if (backups.length === 0) {
      this.pickAndRestoreBackupFile();
      return;
    }

    let menu = "Seleziona il numero del backup da ripristinare:\n\n";
    backups.forEach((b, idx) => {
      const dateStr = b.createdAt ? new Date(b.createdAt).toLocaleString('it-IT') : '';
      menu += `[${idx + 1}] ${b.name} (${b.count} iscritti - ${dateStr})\n`;
    });
    menu += `\n[0] Carica un file dal computer\n\nInserisci il numero:`;

    const choice = prompt(menu, "1");
    if (choice === null) return;
    const num = parseInt(choice, 10);
    if (num === 0) {
      this.pickAndRestoreBackupFile();
    } else if (num > 0 && num <= backups.length) {
      const chosen = backups[num - 1];
      await this.restoreBackupItem(chosen);
    }
  }

  closeRestoreBackupModal() {
    const modal = document.getElementById('restoreBackupModal');
    if (modal) modal.style.display = 'none';
  }

  // Recupera tutti i backup sia dal server (cartella backups/) che da localStorage
  async fetchAllAvailableBackups() {
    const map = new Map();

    // 1. Dal server API
    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.backups)) {
          json.backups.forEach(b => {
            map.set(b.name, {
              source: 'server',
              name: b.name,
              filename: b.filename,
              count: b.count || 0,
              createdAt: b.createdAt,
              data: null
            });
          });
        }
      }
    } catch (e) {}

    // 2. Dalla cronologia salvata in localStorage
    try {
      const historyRaw = localStorage.getItem('vespa_asti_named_backups');
      if (historyRaw) {
        const history = JSON.parse(historyRaw);
        if (Array.isArray(history)) {
          history.forEach(b => {
            const existing = map.get(b.name);
            map.set(b.name, {
              source: existing ? 'both' : 'local',
              name: b.name,
              filename: (b.name.endsWith('.json') ? b.name : b.name + '.json'),
              count: b.count || (Array.isArray(b.data) ? b.data.length : 0),
              createdAt: b.timestamp || (existing ? existing.createdAt : new Date().toISOString()),
              data: b.data || null
            });
          });
        }
      }
    } catch (e) {}

    // 3. Ultimo backup automatico se presente
    try {
      const autoRaw = localStorage.getItem('vespa_asti_backup_latest');
      if (autoRaw) {
        const auto = JSON.parse(autoRaw);
        if (auto && Array.isArray(auto.data) && auto.data.length > 0) {
          const autoKey = 'Ultimo Backup Automatico';
          if (!map.has(autoKey)) {
            map.set(autoKey, {
              source: 'auto',
              name: autoKey,
              filename: 'auto_backup.json',
              count: auto.count || auto.data.length,
              createdAt: auto.timestamp,
              data: auto.data
            });
          }
        }
      }
    } catch(e) {}

    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }

  // Popola la lista all'interno del modale
  async loadBackupsIntoModal() {
    const container = document.getElementById('backupListContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#94a3b8; font-size:0.9rem;">Caricamento elenco backup in corso...</div>';

    const backups = await this.fetchAllAvailableBackups();
    if (backups.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:#64748b; font-size:0.9rem; background:#f8fafc; border-radius:8px;">
          Nessun backup memorizzato nella cartella dell'app o nel browser.<br>
          Puoi salvare un nuovo backup cliccando su <strong>"Salva Backup"</strong> oppure usare <strong>"Sfoglia File..."</strong> in alto per caricare un file JSON.
        </div>
      `;
      return;
    }

    container.innerHTML = backups.map((b, idx) => {
      const dateStr = b.createdAt ? new Date(b.createdAt).toLocaleString('it-IT') : 'Data non disponibile';
      const isAuto = (b.source === 'auto');
      const badgeSource = isAuto 
        ? '<span style="background:#fef3c7; color:#92400e; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px;">Automatico</span>'
        : '<span style="background:#e0f2fe; color:#0369a1; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px;">📁 Cartella App</span>';

      return `
        <div style="background:#FFF; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:1rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <span style="font-weight:800; color:#0f172a; font-size:0.95rem; word-break:break-all;">${b.name}</span>
              ${badgeSource}
            </div>
            <div style="font-size:0.8rem; color:#64748b; margin-top:3px;">
              👥 <strong>${b.count}</strong> partecipanti &bull; 🕒 ${dateStr}
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.vespaDB.restoreBackupByIndex(${idx})" style="font-weight:700; white-space:nowrap; padding:0.4rem 0.9rem;">
            🔄 Ripristina
          </button>
        </div>
      `;
    }).join('');

    this._cachedModalBackups = backups;
  }

  async restoreBackupByIndex(idx) {
    if (!this._cachedModalBackups || !this._cachedModalBackups[idx]) return;
    const backup = this._cachedModalBackups[idx];
    this.closeRestoreBackupModal();
    await this.restoreBackupItem(backup);
  }

  async restoreBackupItem(backup) {
    const confirmMsg = `Sei sicuro di voler ripristinare il backup "${backup.name}" (${backup.count} partecipanti)?\n\nI dati correnti verranno sostituiti con quelli di questo backup.`;
    if (!confirm(confirmMsg)) return;

    // Se ha già i dati
    if (Array.isArray(backup.data) && backup.data.length > 0) {
      await this.restoreFromList(backup.data);
      return;
    }

    // Altrimenti scarica dal server
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(backup.filename || backup.name + '.json')}`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : null);
        if (list) {
          await this.restoreFromList(list);
          return;
        }
      }
      alert("Impossibile recuperare i dati del backup dal server.");
    } catch (e) {
      alert("Errore durante il recupero del backup: " + e.message);
    }
  }

  // Apertura file dialog per caricare file JSON locale
  pickAndRestoreBackupFile() {
    this.closeRestoreBackupModal();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          let parsed = JSON.parse(evt.target.result);
          const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.data) ? parsed.data : null);
          if (Array.isArray(list)) {
            await this.restoreFromList(list);
          } else {
            alert("Il file selezionato non contiene una lista valida di prenotazioni.");
          }
        } catch (err) {
          alert("Errore lettura file di backup: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // Esegue l'importazione effettiva della lista di backup nel DB
  async restoreFromList(list) {
    if (!Array.isArray(list) || list.length === 0) {
      alert("Nessun dato valido da ripristinare.");
      return;
    }

    await this.ensureInit();
    localStorage.removeItem('vespa_db_wiped');
    localStorage.setItem('vespa_db_initialized', 'true');

    // Svuota prima lo stato corrente per non mescolare dati cancellati
    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          tx.oncomplete = () => resolve(true);
        } catch(e) { resolve(false); }
      });
    }
    localStorage.removeItem('vespa_asti_registrations');

    // Salva sul server in modalità batch se disponibile
    try {
      await fetch('/api/registrations/batch-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      });
    } catch (e) {}

    // Inserisce ciascun record nel database
    for (const item of list) {
      await this.saveRegistration(item);
    }

    // Salva subito il nuovo backup cumulativo
    this.saveAutoBackup(list);

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(`✅ Ripristinate con successo ${list.length} prenotazioni!`, 'success');
    } else {
      alert(`Ripristinate con successo ${list.length} prenotazioni!`);
    }

    if (this.broadcast) {
      try { this.broadcast.postMessage({ type: 'DATA_UPDATED', action: 'RESTORE' }); } catch(e) {}
    }
    this.notifyListeners({ type: 'DATA_UPDATED', action: 'RESTORE' });
    // Ricarica la pagina dopo l'operazione
    setTimeout(() => location.reload(), 1200);
  }

  // Apre il modale di scelta ordinamento per l'esportazione PDF
  async exportPDFList() {
    try {
      await this.ensureInit();
      const list = await this.getAllRegistrations();
      if (!list || list.length === 0) {
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Nessuna prenotazione presente per l\'esportazione.', 'warning');
        } else {
          alert("Nessuna prenotazione presente per l'esportazione.");
        }
        return;
      }

      const modal = document.getElementById('pdfSortModal');
      if (modal) {
        modal.style.display = 'flex';
        return;
      }

      // Se il modal non è presente nel DOM, genera direttamente ordinato per Cognome
      await this.renderAndPrintSortedPDF('cognome', 'asc');
    } catch (err) {
      console.error('Errore exportPDFList:', err);
      alert("Errore durante l'apertura dell'esportazione: " + err.message);
    }
  }

  closePdfSortModal() {
    const modal = document.getElementById('pdfSortModal');
    if (modal) modal.style.display = 'none';
  }

  async confirmExportPDF() {
    const colSelect = document.getElementById('pdfSortColumnSelect');
    const dirSelect = document.getElementById('pdfSortDirectionSelect');
    const sortCol = colSelect ? colSelect.value : 'cognome';
    const sortDir = dirSelect ? dirSelect.value : 'asc';

    this.closePdfSortModal();
    await this.renderAndPrintSortedPDF(sortCol, sortDir);
  }

  // Genera ed esegue la stampa del PDF applicando l'ordinamento richiesto
  async renderAndPrintSortedPDF(sortColumn = 'cognome', sortDirection = 'asc') {
    try {
      await this.ensureInit();
      const rawList = await this.getAllRegistrations();
      if (!rawList || rawList.length === 0) {
        alert("Nessuna prenotazione presente per l'esportazione.");
        return;
      }

      // Mappa etichette colonna per la testata
      const colLabels = {
        'cognome': 'Cognome & Nome',
        'vespaClub': 'Vespa Club',
        'cittaProvenienza': 'Città di Provenienza',
        'id': 'ID Pass',
        'tagliaTshirt': 'Taglia T-Shirt',
        'modalitaPartecipazione': 'Pacchetto Raduno & Quota',
        'statoPagamento': 'Stato Pagamento',
        'statoAccettazioneSabato': 'Presenza Sabato',
        'statoAccettazioneDomenica': 'Presenza Domenica',
        'ritiroGadget': 'Ritiro Kit Gadget',
        'merenda': 'Merenda Sabato',
        'aperitivoSabatoErogato': 'Aperitivo Sabato',
        'cena': 'Cena Sabato',
        'colazioneDomenicaErogata': 'Colazione Domenica',
        'aperitivoDomenicaErogato': 'Aperitivo Domenica',
        'pranzo': 'Pranzo Domenica'
      };
      const sortLabel = colLabels[sortColumn] || sortColumn;

      // Ordina la lista prima di generare il PDF
      const list = [...rawList].sort((a, b) => {
        let valA, valB;

        if (sortColumn === 'cognome') {
          valA = `${a.cognome || ''} ${a.nome || ''}`.trim().toLowerCase();
          valB = `${b.cognome || ''} ${b.nome || ''}`.trim().toLowerCase();
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB, 'it', { sensitivity: 'base' })
            : valB.localeCompare(valA, 'it', { sensitivity: 'base' });
        } else if (sortColumn === 'tagliaTshirt') {
          const order = { 'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, '3XL': 6 };
          valA = order[(a.tagliaTshirt || '').toUpperCase()] !== undefined ? order[(a.tagliaTshirt || '').toUpperCase()] : 99;
          valB = order[(b.tagliaTshirt || '').toUpperCase()] !== undefined ? order[(b.tagliaTshirt || '').toUpperCase()] : 99;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else if (sortColumn === 'ritiroGadget') {
          valA = (a.ritiroGadget || a.kitGadgetConsegnato) ? 1 : 0;
          valB = (b.ritiroGadget || b.kitGadgetConsegnato) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'statoAccettazioneSabato') {
          valA = (a.statoAccettazioneSabato || a.accettazioneConclusa) ? 1 : 0;
          valB = (b.statoAccettazioneSabato || b.accettazioneConclusa) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'statoAccettazioneDomenica') {
          valA = a.statoAccettazioneDomenica ? 1 : 0;
          valB = b.statoAccettazioneDomenica ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'merenda') {
          valA = (a.merenda || a.merendaSabatoErogata) ? 1 : 0;
          valB = (b.merenda || b.merendaSabatoErogata) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'aperitivo' || sortColumn === 'aperitivoSabatoErogato') {
          valA = (a.aperitivoSabatoErogato || a.aperitivo || a.aperitivoErogato) ? 1 : 0;
          valB = (b.aperitivoSabatoErogato || b.aperitivo || b.aperitivoErogato) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'aperitivoDomenicaErogato') {
          valA = (a.aperitivoDomenicaErogato) ? 1 : 0;
          valB = (b.aperitivoDomenicaErogato) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'colazioneDomenicaErogata') {
          valA = (a.colazioneDomenicaErogata) ? 1 : 0;
          valB = (b.colazioneDomenicaErogata) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'pranzo') {
          valA = (a.pranzo || a.pranzoDomenicaErogato) ? 1 : 0;
          valB = (b.pranzo || b.pranzoDomenicaErogato) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'cena') {
          valA = (a.cena || a.cenaSabatoErogato) ? 1 : 0;
          valB = (b.cena || b.cenaSabatoErogato) ? 1 : 0;
          return sortDirection === 'asc' ? valB - valA : valA - valB;
        } else if (sortColumn === 'cittaProvenienza') {
          valA = (a.cittaProvenienza || a.citta || VespaDB.inferCityFromClub(a.vespaClub) || '').toString().toLowerCase();
          valB = (b.cittaProvenienza || b.citta || VespaDB.inferCityFromClub(b.vespaClub) || '').toString().toLowerCase();
        } else {
          valA = (a[sortColumn] || '').toString().toLowerCase();
          valB = (b[sortColumn] || '').toString().toLowerCase();
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB, 'it', { numeric: true, sensitivity: 'base' })
            : valB.localeCompare(valA, 'it', { numeric: true, sensitivity: 'base' });
        }
      });

      const rowsHtml = list.map((r, i) => {
        const modeStr = r.modalitaPartecipazione || '';
        const price = r.importoDovuto || (window.VespaPkg ? window.VespaPkg.getPriceForRegistration(modeStr) : VespaDB.getPriceForMode(modeStr));

        const hasSabato   = window.VespaPkg ? window.VespaPkg.packageIncludesSabato(modeStr)   : (modeStr.includes('SABATO') || modeStr.includes('FULL 2 GIORNI') || modeStr.includes('COMPLETA'));
        const hasDomenica = window.VespaPkg ? window.VespaPkg.packageIncludesDomenica(modeStr) : (modeStr.includes('DOMENICA') || modeStr.includes('FULL 2 GIORNI') || modeStr.includes('COMPLETA'));
        const hasLunch    = window.VespaPkg ? window.VespaPkg.participantHasService(r, 'pranzo') : (hasDomenica && !modeStr.includes('LIGHT'));
        const hasDinner   = window.VespaPkg ? window.VespaPkg.participantHasService(r, 'cena') : (hasSabato && !modeStr.includes('LIGHT'));
        const hasMerenda  = window.VespaPkg ? window.VespaPkg.participantHasService(r, 'merendaSabato') : hasSabato;
        const hasApeSab   = window.VespaPkg ? window.VespaPkg.participantHasService(r, 'aperitivoSabato') : hasSabato;
        const hasColaz    = window.VespaPkg ? window.VespaPkg.participantHasService(r, 'colazioneDomenica') : hasDomenica;
        const hasApeDom   = window.VespaPkg ? window.VespaPkg.participantHasService(r, 'aperitivoDomenica') : hasDomenica;

        // Formattazione colori tenui per giorno di prenotazione
        // Entrambi i giorni: Tenue Azzurro (#EFF6FF)
        // Solo Sabato:       Tenue Arancione (#FFF7ED)
        // Solo Domenica:     Tenue Verde/Smeraldo (#F0FDF4)
        let rowBg = '#FFFFFF';
        let rowBadge = '';
        if (hasSabato && hasDomenica) {
          rowBg = '#EFF6FF';
        } else if (hasSabato) {
          rowBg = '#FFF7ED';
        } else if (hasDomenica) {
          rowBg = '#F0FDF4';
        }

        const badgeSvg = (window.VespaPkg && typeof window.VespaPkg.getBadgeHtml === 'function')
          ? window.VespaPkg.getBadgeHtml(modeStr)
          : '';
        rowBadge = badgeSvg ? `<span style="margin-left:4px; vertical-align:middle; display:inline-block;">${badgeSvg}</span>` : '';

        const isPaid = (r.statoPagamento === 'PAGATO');
        const isToVerify = (r.statoPagamento === 'RICEVUTA_DA_VERIFICARE');
        const payLabel = isPaid ? 'PAGATO' : (isToVerify ? 'DA VERIFICARE' : 'NON PAGATO');
        const payStyle = isPaid ? 'color:#15803D; font-weight:bold;' : (isToVerify ? 'color:#D97706; font-weight:bold;' : 'color:#DC2626; font-weight:bold;');

        // Ordine servizi: Sabato (Acc.Sab, Merenda, Ape.Sab, Cena) -> Domenica (Acc.Dom, Colazione, Ape.Dom, Pranzo) -> Gadget (Unico)
        const sabVal    = hasSabato   ? ((r.statoAccettazioneSabato || r.accettazioneConclusa) ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';
        const merVal    = hasMerenda  ? ((r.merenda || r.merendaSabatoErogata) ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';
        const apeSabVal = hasApeSab   ? ((r.aperitivoSabatoErogato || (!r.aperitivoDomenicaErogato && (r.aperitivo || r.aperitivoErogato))) ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';
        const dinVal    = hasDinner   ? ((r.cena || r.cenaSabatoErogato) ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';

        const domVal    = hasDomenica ? (r.statoAccettazioneDomenica ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';
        const colDomVal = hasColaz    ? (r.colazioneDomenicaErogata ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';
        const apeDomVal = hasApeDom   ? (r.aperitivoDomenicaErogato ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';
        const lunVal    = hasLunch    ? ((r.pranzo || r.pranzoDomenicaErogato) ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>') : '<span style="color:#cbd5e1;">-</span>';

        const gadVal    = (r.ritiroGadget || r.kitGadgetConsegnato) ? '<b style="color:#15803D;">SÌ</b>' : '<span style="color:#94a3b8;">NO</span>';

        const pkgClean = modeStr.includes('|') ? modeStr.split('|')[1].trim() : modeStr.split('-')[0].trim();

        return `
          <tr style="background:${rowBg};">
            <td style="padding:4px 5px; border:1px solid #cbd5e1; font-weight:bold; text-align:center;">${i + 1}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#005A9C; font-family:monospace; white-space:nowrap;">${r.id}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; font-weight:bold; color:#0f172a; white-space:nowrap;">${r.cognome} ${r.nome} ${rowBadge}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1;">${r.vespaClub || '-'}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; font-size:9.5px;">${(r.cittaProvenienza || r.citta || VespaDB.inferCityFromClub(r.vespaClub) || '-')}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${r.tagliaTshirt || '-'}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; font-size:9.5px; white-space:nowrap;">${pkgClean} (€ ${price})</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center; font-size:9px; ${payStyle}">${payLabel}</td>

            <!-- SERVIZI SABATO -->
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${sabVal}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${merVal}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${apeSabVal}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${dinVal}</td>

            <!-- SERVIZI DOMENICA -->
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${domVal}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${colDomVal}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${apeDomVal}</td>
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${lunVal}</td>

            <!-- GADGET RADUNO -->
            <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${gadVal}</td>
          </tr>
        `;
      }).join('');

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Vespa Club Asti - Elenco Partecipanti e Servizi</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 8mm;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
              margin: 0; 
              padding: 10px; 
              font-size: 10px; 
              color: #0f172a; 
              background: #fff;
            }
            .header-box {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #005A9C;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            h1 { 
              color: #005A9C; 
              margin: 0 0 2px 0; 
              font-size: 16px; 
              font-weight: 900;
              letter-spacing: 0.5px;
            }
            .meta { 
              margin: 0; 
              color: #475569; 
              font-size: 10px; 
            }
            .sort-indicator {
              background: #e0f2fe;
              color: #0369a1;
              padding: 2px 8px;
              border-radius: 4px;
              font-weight: 800;
              font-size: 10px;
              display: inline-block;
              margin-top: 3px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 6px; 
            }
            th { 
              background: #005A9C; 
              color: #ffffff; 
              padding: 6px 4px; 
              border: 1px solid #004578; 
              text-align: center; 
              font-size: 9.5px; 
              font-weight: 800;
              letter-spacing: 0.2px;
              white-space: nowrap;
            }
            th.th-left { text-align: left; padding-left: 6px; }
            th.th-sorted { background: #0284c7; }
            tr:nth-child(even) { background: #f8fafc; }
            tr:hover { background: #f1f5f9; }
            .legend {
              margin-top: 8px;
              font-size: 9px;
              color: #64748b;
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
            }
            .no-print-bar {
              background: #0F172A;
              color: #FFF;
              padding: 8px 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-radius: 8px;
              margin-bottom: 12px;
              font-size: 12px;
            }
            .print-btn {
              background: #2563EB;
              color: #FFF;
              border: none;
              padding: 6px 16px;
              border-radius: 6px;
              font-weight: bold;
              cursor: pointer;
            }
            @media print {
              .no-print-bar { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print-bar">
            <span>📄 Vespa Club Asti — Elenco Partecipanti Raduno pronto per la stampa</span>
            <button class="print-btn" onclick="window.print()">🖨️ Stampa PDF</button>
          </div>

          <div class="header-box">
            <div>
              <h1>VESPA CLUB ASTI A.S.D. — RIEPILOGO PARTECIPANTI &amp; SERVIZI RADUNO</h1>
              <p class="meta">
                Elenco generale con stato accoglienza, pagamenti e fruizione di tutti i servizi.
                <span class="sort-indicator">Ordinamento applicato: ${sortLabel} (${sortDirection === 'asc' ? 'Crescente' : 'Decrescente'})</span>
              </p>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:bold; color:#005A9C; font-size:11px;">TOTALE ISCRITTI: ${list.length}</div>
              <div class="meta">Stampato il: ${new Date().toLocaleString('it-IT')}</div>
            </div>
          </div>

          <table>
            <thead>
              <!-- RIGA 1: GRUPPI SERVIZI -->
              <tr>
                <th colspan="8" style="background:#004578; border-right:2px solid #ffffff;">DATI PARTECIPANTE</th>
                <th colspan="4" style="background:#0891b2; border-right:2px solid #ffffff;">SABATO</th>
                <th colspan="4" style="background:#0284c7; border-right:2px solid #ffffff;">DOMENICA</th>
                <th colspan="1" style="background:#475569;">GADGET</th>
              </tr>
              <!-- RIGA 2: COLONNE DI DETTAGLIO -->
              <tr>
                <th>#</th>
                <th class="${sortColumn === 'id' ? 'th-sorted' : ''}">Pass ID</th>
                <th class="th-left ${sortColumn === 'cognome' ? 'th-sorted' : ''}">Partecipante</th>
                <th class="th-left ${sortColumn === 'vespaClub' ? 'th-sorted' : ''}">Vespa Club</th>
                <th class="th-left ${sortColumn === 'cittaProvenienza' ? 'th-sorted' : ''}">Provenienza</th>
                <th class="${sortColumn === 'tagliaTshirt' ? 'th-sorted' : ''}">Taglia</th>
                <th class="th-left ${sortColumn === 'modalitaPartecipazione' ? 'th-sorted' : ''}">Pacchetto &amp; Quota</th>
                <th class="${sortColumn === 'statoPagamento' ? 'th-sorted' : ''}">Pagamento</th>

                <!-- SABATO -->
                <th class="${sortColumn === 'statoAccettazioneSabato' ? 'th-sorted' : ''}" style="background:#0891b2;">Acc. Sab</th>
                <th class="${sortColumn === 'merenda' ? 'th-sorted' : ''}" style="background:#0891b2;">Merenda</th>
                <th class="${sortColumn === 'aperitivoSabatoErogato' ? 'th-sorted' : ''}" style="background:#0891b2;">Ape. Sab</th>
                <th class="${sortColumn === 'cena' ? 'th-sorted' : ''}" style="background:#0891b2;">Cena Sab</th>

                <!-- DOMENICA -->
                <th class="${sortColumn === 'statoAccettazioneDomenica' ? 'th-sorted' : ''}" style="background:#0284c7;">Acc. Dom</th>
                <th class="${sortColumn === 'colazioneDomenicaErogata' ? 'th-sorted' : ''}" style="background:#0284c7;">Colaz. Dom</th>
                <th class="${sortColumn === 'aperitivoDomenicaErogato' ? 'th-sorted' : ''}" style="background:#0284c7;">Ape. Dom</th>
                <th class="${sortColumn === 'pranzo' ? 'th-sorted' : ''}" style="background:#0284c7;">Pranzo Dom</th>

                <!-- GADGET -->
                <th class="${sortColumn === 'ritiroGadget' ? 'th-sorted' : ''}" style="background:#475569;">Gadget (Unico)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="legend">
            <span><strong>Legenda:</strong> <strong>SÌ</strong> = Servizio Erogato / Presente</span>
            <span><strong>NO</strong> = Da Erogare / Non Ancora Registrato</span>
            <span><strong>-</strong> = Non Incluso nel pacchetto prescelto</span>
            <span><span style="display:inline-block; width:10px; height:10px; background:#EFF6FF; border:1px solid #93C5FD; vertical-align:middle; margin-right:3px;"></span> Sabato + Domenica</span>
            <span><span style="display:inline-block; width:10px; height:10px; background:#FFF7ED; border:1px solid #FDBA74; vertical-align:middle; margin-right:3px;"></span> Solo Sabato</span>
            <span><span style="display:inline-block; width:10px; height:10px; background:#F0FDF4; border:1px solid #86EFAC; vertical-align:middle; margin-right:3px;"></span> Solo Domenica</span>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("Impossibile aprire la finestra di stampa. Verifica che i popup non siano bloccati dal browser.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
    } catch (err) {
      console.error('Errore renderAndPrintSortedPDF:', err);
      alert("Errore durante la generazione della stampa PDF: " + err.message);
    }
  }
}

window.vespaDB = new VespaDB();
