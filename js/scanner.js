/**
 * Vespa Club Asti A.s.D. - Suite Gestione Eventi Cloud
 * Logica centrale automatizzata per il riconoscimento banchi e smarcamento istantaneo.
 */

class VespaScanner {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.currentParticipant = null;
    this.mode = document.body.getAttribute("data-page-type") || "ACCETTAZIONE";
    this.availableCameras = [];
    this.selectedCameraId = null;
    this.currentFacingMode = "environment"; // default fotocamera posteriore
    this.lastScannedCode = null;
    this.lastScanTime = 0;
    this.audioCtx = null;
  }

  // Inizializza o riattiva l'AudioContext del browser
  getAudioContext() {
    try {
      if (!this.audioCtx) {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch(e) {}
    return this.audioCtx;
  }

  // Suono di successo: Bip squillante e pulito (tipo cassa / tornello) + vibrazione breve
  playSuccessSound() {
    try {
      if (navigator.vibrate) navigator.vibrate(120);
      var ctx = this.getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      // Bip a due frequenze ascendenti rapide: 880Hz -> 1320Hz
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch(e) {
      console.warn("[VespaScanner] Audio non disponibile:", e);
    }
  }

  // Suono di errore / già fruito: Doppio tono grave discendente (tipo din-don di errore) + doppia vibrazione
  playErrorSound() {
    try {
      if (navigator.vibrate) navigator.vibrate([150, 80, 200]);
      var ctx = this.getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sawtooth"; // Tono più aspro di rifiuto
      // Tono basso discendente: 280Hz -> 160Hz
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(180, now + 0.18);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch(e) {
      console.warn("[VespaScanner] Audio non disponibile:", e);
    }
  }

  async init(mode) {
    if (mode) this.mode = mode;

    if (window.vespaDB) {
      await window.vespaDB.ensureInit();
    }

    var manualBtn = document.getElementById("scannerManualSearchBtn");
    var manualInput = document.getElementById("scannerManualInput");
    var self = this;

    if (manualInput) {
      manualInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          self.onQrCodeScanned(manualInput.value);
        }
      });
      manualInput.addEventListener("change", function() {
        if (manualInput.value) self.onQrCodeScanned(manualInput.value);
      });
    }

    if (manualBtn && manualInput) {
      manualBtn.addEventListener("click", function() {
        self.onQrCodeScanned(manualInput.value);
      });
    }

    this.focusInput();
    document.addEventListener("click", function(e) {
      var ignore = e.target.closest("#participantSelectBox, #scannerActionButtons, #cameraControlsContainer, button, select, input, a");
      if (!ignore) self.focusInput();
    });

    await this.populateParticipantDropdown();
    this.setupCameraControlsUI();
  }

  focusInput() {
    var manualInput = document.getElementById("scannerManualInput");
    if (manualInput && document.activeElement !== manualInput) manualInput.focus();
  }

  /* ─────────────────────────────────────────────────────────────
     GESTIONE FOTOCAMERA UNIVERSALE (Smartphone, Tablet, PC)
  ───────────────────────────────────────────────────────────── */

  setupCameraControlsUI() {
    var readerDiv = document.getElementById("reader");
    if (!readerDiv) return;

    // Rimuovi se già presente
    var old = document.getElementById("cameraControlsContainer");
    if (old) old.remove();

    var controls = document.createElement("div");
    controls.id = "cameraControlsContainer";
    controls.className = "camera-controls-bar";
    // Solo un pulsante essenziale se la fotocamera non è ancora partita o necessita tocco
    controls.innerHTML =
      "<button type='button' class='camera-btn camera-btn-start' id='btnToggleCamera' style='display:none;width:100%;justify-content:center;padding:0.45rem;'>" +
        "📷 <span>Tocca qui per attivare Fotocamera</span>" +
      "</button>";

    var videoBox = readerDiv.closest(".scanner-video-box") || readerDiv;
    if (videoBox.parentNode) {
      videoBox.parentNode.insertBefore(controls, videoBox.nextSibling);
    }

    var self = this;
    var toggleBtn = document.getElementById("btnToggleCamera");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        self.getAudioContext();
        self.startScanner();
      });
    }

    // Avvio automatico immediato
    if (readerDiv.offsetParent !== null) {
      setTimeout(function() {
        if (!self.isScanning) {
          self.startScanner().catch(function() {});
        }
      }, 100);
    }
  }

  async startScanner(preferredCameraId) {
    var readerDiv = document.getElementById("reader");
    if (!readerDiv || readerDiv.offsetParent === null) return;

    if (typeof Html5Qrcode === "undefined") return;

    var self = this;
    var toggleBtn = document.getElementById("btnToggleCamera");

    if (this.isScanning && this.html5QrCode) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch(e) {}
      this.isScanning = false;
    }

    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode("reader");
      }

      var scanConfig = {
        fps: 20,
        qrbox: function(w, h) {
          var edge = Math.floor(Math.min(w, h) * 0.85);
          return { width: Math.max(edge, 160), height: Math.max(edge, 160) };
        },
        aspectRatio: 1.33
      };

      var onScanSuccess = function(decodedText) {
        var now = Date.now();
        if (decodedText === self.lastScannedCode && (now - self.lastScanTime) < 2500) return;
        self.lastScannedCode = decodedText;
        self.lastScanTime = now;
        self.onQrCodeScanned(decodedText);
      };

      // Avvia direttamente con la fotocamera posteriore
      try {
        await this.html5QrCode.start(
          { facingMode: "environment" },
          scanConfig,
          onScanSuccess,
          function() {}
        );
      } catch (errPosteriore) {
        // Fallback automatico su qualsiasi fotocamera disponibile
        await this.html5QrCode.start(
          { facingMode: "user" },
          scanConfig,
          onScanSuccess,
          function() {}
        );
      }

      this.isScanning = true;
      if (toggleBtn) toggleBtn.style.display = "none"; // Nascondi completamente barra comandi se attiva

    } catch(err) {
      console.warn("[VespaScanner] Avvio fotocamera in attesa di tocco:", err);
      this.isScanning = false;
      if (toggleBtn) {
        toggleBtn.style.display = "flex";
        toggleBtn.innerHTML = "📷 <span>Tocca per Attivare Fotocamera</span>";
      }
    }
  }

  updateCameraStatus(text, dotColor) {
    // Svuotato per non generare testo inutile a schermo
  }

  async stopScanner() {
    var toggleBtn = document.getElementById("btnToggleCamera");
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch(e) {
        console.warn("[VespaScanner] Errore stop:", e);
      }
      this.isScanning = false;
    }

    if (toggleBtn) {
      toggleBtn.className = "camera-btn camera-btn-start";
      toggleBtn.innerHTML = "📷 <span>Avvia Fotocamera</span>";
    }

    this.updateCameraStatus("⚪ Fotocamera spenta (Penna ottica attiva)", "#94a3b8");
    this.focusInput();
  }

  async flipCamera() {
    this.currentFacingMode = (this.currentFacingMode === "environment") ? "user" : "environment";
    this.selectedCameraId = null;
    await this.startScanner();
  }

  updateCameraStatus(text, dotColor) {
    var statusEl = document.getElementById("cameraStatusIndicator");
    if (!statusEl) return;
    dotColor = dotColor || "#94a3b8";
    statusEl.innerHTML =
      "<span style='display:inline-block;width:8px;height:8px;border-radius:50%;background:" + dotColor + ";'></span> " + text;
  }

  async populateParticipantDropdown() {
    var select = document.getElementById("participantSelect");
    if (!select || !window.vespaDB) return;
    try {
      await window.vespaDB.ensureInit();
      var all = await window.vespaDB.getAllRegistrations();
      var mode = this.mode;

      // Mappatura mode -> chiave servizio per filtrare i soli aventi diritto
      var modeToServiceKey = {
        "MERENDA": "merendaSabato",
        "APERITIVO_SAB": "aperitivoSabato",
        "CENA": "cena",
        "COLAZIONE": "colazioneDomenica",
        "APERITIVO_DOM": "aperitivoDomenica",
        "PRANZO": "pranzo",
        "GADGET": "gadget"
      };

      var activeSvcKey = modeToServiceKey[mode];

      // Se c'è un servizio attivo, filtra SOLO i partecipanti che hanno quel servizio compreso nel loro pacchetto
      if (activeSvcKey && window.VespaPkg && typeof window.VespaPkg.participantHasService === 'function') {
        all = all.filter(function(r) {
          return window.VespaPkg.participantHasService(r, activeSvcKey);
        });
      } else if (mode === 'ACCETTAZIONE_SABATO' || mode === 'ACCETTAZIONE_DOMENICA') {
        var isSab = (mode === 'ACCETTAZIONE_SABATO');
        all = all.filter(function(r) {
          return isSab 
            ? (window.VespaPkg ? window.VespaPkg.packageIncludesSabato(r.modalitaPartecipazione) : (r.modalitaPartecipazione || '').toUpperCase().includes('SABATO') || (r.modalitaPartecipazione || '').toUpperCase().includes('FULL 2 GIORNI'))
            : (window.VespaPkg ? window.VespaPkg.packageIncludesDomenica(r.modalitaPartecipazione) : (r.modalitaPartecipazione || '').toUpperCase().includes('DOMENICA') || (r.modalitaPartecipazione || '').toUpperCase().includes('FULL 2 GIORNI'));
        });
      }

      all.sort(function(a, b) { return (a.cognome + ' ' + a.nome).localeCompare(b.cognome + ' ' + b.nome); });
      var self = this;
      var promptText = (activeSvcKey || mode)
        ? "-- Seleziona partecipante avente diritto (" + all.length + " iscritti) --"
        : "-- Seleziona partecipante dall'elenco --";

      select.innerHTML = "<option value=\"\">" + promptText + "</option>" +
        all.map(function(r) {
          return "<option value=\"" + r.id + "\">" + r.cognome + " " + r.nome + " (" + (r.vespaClub || 'Indipendente') + ") \u2014 " + r.id + "</option>";
        }).join("");
      select.onchange = function() {
        if (select.value) {
          self.lookupParticipant(select.value);
        }
      };
    } catch(e) { console.warn("[VespaScanner] Dropdown not populated:", e); }
  }

  async onQrCodeScanned(decodedText) {
    if (!decodedText) return;
    var targetId = decodedText.toString().trim();
    try {
      var parsed = JSON.parse(decodedText);
      if (parsed.id) targetId = parsed.id.toString().trim();
    } catch(e) {}
    await this.lookupParticipant(targetId);
  }

  async lookupParticipant(query) {
    if (!query) return;
    var container = document.getElementById("scannerResultContainer");
    if (!container) return;
    var cleanQuery = query.toString().trim().toUpperCase();
    try {
      var record = null;
      if (window.vespaDB) {
        await window.vespaDB.ensureInit();
        record = await window.vespaDB.getById(cleanQuery);
      }

      if (!record) {
        try {
          var response = await fetch("/api/participant/lookup?query=" + encodeURIComponent(cleanQuery));
          if (response.ok) record = await response.json();
        } catch(e) {}
      }

      if (!record) {
        var raw = localStorage.getItem("vespa_asti_registrations");
        if (raw) {
          try {
            var list = JSON.parse(raw);
            record = list.find(function(r) {
              return (r.id && r.id.toUpperCase() === cleanQuery) ||
                     (r.cognome && r.cognome.toUpperCase() === cleanQuery) ||
                     (r.tesseraVci && r.tesseraVci.toUpperCase() === cleanQuery);
            });
          } catch(e) {}
        }
      }

      if (!record) throw new Error("Non trovato");
      this.currentParticipant = record;
      await this.validateAndProcessRegistration(record);

    } catch(err) {
      this.renderStatusFeedback("\u274c Codice o Cognome non trovato nel database.", "danger");
    }
  }

  async forceAcceptance(id) {
    if (window.vespaDB) await window.vespaDB.ensureInit();
    var record = (this.currentParticipant && this.currentParticipant.id === id)
      ? this.currentParticipant : await window.vespaDB.getById(id);
    if (!record) return;
    var timeString = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    record.statoPagamento = "PAGATO";
    record.notePagamento = (record.notePagamento || "") + " [Pagato in contanti all'accettazione alle " + timeString + "]";
    record.statoAccettazioneSabato = true;
    record.accettazioneSabatoTimestamp = timeString;
    record.statoAccettazioneDomenica = true;
    record.accettazioneDomenicaTimestamp = timeString;
    record.accettazioneConclusa = true;
    record.accettazioneTimestamp = timeString;
    if (window.vespaDB) await window.vespaDB.saveRegistration(record);
    try { localStorage.setItem('vespa_db_sync_pulse', Date.now().toString()); } catch(e) {}
    this.currentParticipant = record;
    this.renderStatusFeedback("\u2705 ACCETTAZIONE COMPLETATA: " + record.cognome + " " + record.nome + " \u2014 Pagamento registrato e ingresso convalidato.", "success", record);
  }

  async overrideAcceptance(id) {
    if (window.vespaDB) await window.vespaDB.ensureInit();
    var record = (this.currentParticipant && this.currentParticipant.id === id)
      ? this.currentParticipant : await window.vespaDB.getById(id);
    if (!record) return;
    var timeString = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    record.statoAccettazioneSabato = true;
    record.accettazioneSabatoTimestamp = timeString;
    record.statoAccettazioneDomenica = true;
    record.accettazioneDomenicaTimestamp = timeString;
    record.accettazioneConclusa = true;
    record.accettazioneTimestamp = timeString;
    record.noteOrganizzatore = (record.noteOrganizzatore || "") + " [Ingresso sbloccato manualmente alle " + timeString + " \u2014 quota ancora da verificare]";
    if (window.vespaDB) await window.vespaDB.saveRegistration(record);
    try { localStorage.setItem('vespa_db_sync_pulse', Date.now().toString()); } catch(e) {}
    this.currentParticipant = record;
    this.renderStatusFeedback("\u26a0\ufe0f INGRESSO SBLOCCATO MANUALMENTE: " + record.cognome + " " + record.nome + " \u2014 quota ancora da regolarizzare.", "warning", record);
  }

  async validateAndProcessRegistration(p) {
    // ── Cattura mode subito come variabile locale per evitare race condition async ──
    // this.mode può cambiare durante ogni await (es. utente clicca altro servizio),
    // quindi lo fissiamo qui una volta sola e usiamo solo 'mode' da qui in poi.
    var mode = this.mode;

    // ── Mappa completa: tutti i mode (banchi classici + pasti/aperitivi) ──
    var SERVICE_CONFIG = {
      // Banchi classici
      "ACCETTAZIONE":  { field: "accettazioneConclusa",      label: "Accettazione"         },
      "GADGET":        { field: "kitGadgetConsegnato",        label: "Kit Gadget"            },
      "APERITIVO":     { field: "aperitivoErogato",           label: "Aperitivo"             },
      "PRANZO":        { field: "pranzoDomenicaErogato",      label: "Pranzo (Domenica)"    },
      "CENA":          { field: "cenaSabatoErogato",          label: "Cena (Sabato)"         },
      // Banchi Pasti & Aperitivi (pasti.html)
      "MERENDA":       { field: "merendaSabatoErogata",       label: "Merenda (Sabato)"     },
      "APERITIVO_SAB": { field: "aperitivoSabatoErogato",     label: "Aperitivo (Sabato)"   },
      "APERITIVO_DOM": { field: "aperitivoDomenicaErogato",   label: "Aperitivo (Domenica)" },
      "COLAZIONE":     { field: "colazioneDomenicaErogata",   label: "Colazione (Domenica)" }
    };

    var cfg = SERVICE_CONFIG[mode];

    // Mode non riconosciuto (es. 'PASTI' prima che l'utente scelga un servizio)
    if (!cfg) {
      this.renderStatusFeedback("\u26a0\ufe0f Seleziona prima una prestazione (Merenda, Aperitivo, Cena...).", "warning", p, mode);
      return;
    }

    var currentField = cfg.field;
    var currentLabel = cfg.label;

    // ── Check "già fruito" ──
    var isAlreadyDone = false;
    if (mode === "ACCETTAZIONE") {
      isAlreadyDone = !!(p.accettazioneConclusa || p.statoAccettazioneSabato || p.statoAccettazioneDomenica);
    } else if (mode === "GADGET") {
      // Gadget unico per tutto il raduno (chi lo ritira il sabato non lo ritira la domenica)
      isAlreadyDone = !!(p.ritiroGadget || p.kitGadgetConsegnato);
    } else {
      isAlreadyDone = !!p[currentField];
    }

    if (isAlreadyDone) {
      this.renderStatusFeedback(
        "\u26a0\ufe0f GI\u00c0 FRUITO: " + currentLabel + " risulta gi\u00e0 erogato a " + p.nome + " " + p.cognome + ".",
        "warning", p, mode
      );
      return;
    }

    // ── Check pagamento (solo accettazione) ──
    if (mode === "ACCETTAZIONE" && p.statoPagamento === "NON_PAGATO") {
      this.renderPaymentBlockedFeedback(p);
      return;
    }

    // ── Check compatibilità pacchetto per ciascun servizio ──
    var modeToServiceKey = {
      "GADGET": "gadget",
      "MERENDA": "merendaSabato",
      "APERITIVO_SAB": "aperitivoSabato",
      "CENA": "cena",
      "COLAZIONE": "colazioneDomenica",
      "APERITIVO_DOM": "aperitivoDomenica",
      "PRANZO": "pranzo"
    };
    var svcKey = modeToServiceKey[mode];
    if (svcKey && window.VespaPkg && typeof window.VespaPkg.participantHasService === 'function') {
      if (!window.VespaPkg.participantHasService(p, svcKey)) {
        this.renderStatusFeedback("\u274c ERRORE PACCHETTO: L'iscrizione di " + p.nome + " non include il servizio " + currentLabel + ".", "danger", p, mode);
        return;
      }
    } else {
      var modalita = (p.modalitaPartecipazione || "").toUpperCase();
      if (mode === "CENA" && !modalita.includes("FULL 2 GIORNI") && !modalita.includes("FULL SABATO") && !modalita.includes("COMPLETA") && !modalita.includes("FULL_SAB")) {
        this.renderStatusFeedback("\u274c ERRORE PACCHETTO: L'iscrizione di " + p.nome + " non include la Cena del Sabato Sera.", "danger", p, mode);
        return;
      }
      if (mode === "PRANZO" && !modalita.includes("FULL 2 GIORNI") && !modalita.includes("FULL DOMENICA") && !modalita.includes("COMPLETA") && !modalita.includes("FULL_DOM")) {
        this.renderStatusFeedback("\u274c ERRORE PACCHETTO: L'iscrizione di " + p.nome + " non include il Pranzo della Domenica.", "danger", p, mode);
        return;
      }
    }

    // ── Segna il servizio come erogato ──
    var timeString = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    p[currentField] = true;
    p[currentField + "Timestamp"] = timeString;

    // Campi extra per retrocompatibilità con i banchi classici e sincronizzazione completa
    if (mode === "ACCETTAZIONE") {
      p.accettazioneTimestamp = timeString;
      p.accettazioneConclusa = true;
      p.statoAccettazioneSabato = true;
      p.accettazioneSabatoTimestamp = timeString;
      p.statoAccettazioneDomenica = true;
      p.accettazioneDomenicaTimestamp = timeString;
    } else if (mode === "GADGET") {
      p.ritiroGadget = true;
      p.kitGadgetConsegnato = true;
      p.ritiroGadgetTimestamp = timeString;
    } else if (mode === "APERITIVO") {
      p.aperitivo = true;
      p.aperitivoTimestamp = timeString;
    } else if (mode === "APERITIVO_SAB") {
      p.aperitivoSabatoErogato = true;
      p.aperitivoSabatoErogatoTimestamp = timeString;
      p.aperitivo = true;
    } else if (mode === "APERITIVO_DOM") {
      p.aperitivoDomenicaErogato = true;
      p.aperitivoDomenicaErogatoTimestamp = timeString;
      p.aperitivo = true;
    } else if (mode === "PRANZO") {
      p.pranzo = true;
      p.pranzoDomenicaErogato = true;
      p.pranzoTimestamp = timeString;
    } else if (mode === "CENA") {
      p.cena = true;
      p.cenaSabatoErogato = true;
      p.cenaTimestamp = timeString;
      p.cenaSabatoErogatoTimestamp = timeString;
    } else if (mode === "MERENDA") {
      p.merenda = true;
      p.merendaSabatoErogata = true;
      p.merendaTimestamp = timeString;
      p.merendaSabatoErogataTimestamp = timeString;
    } else if (mode === "COLAZIONE") {
      p.colazioneDomenicaErogata = true;
      p.colazioneDomenicaErogataTimestamp = timeString;
    }

    // ── Salva nel database (IndexedDB + LocalStorage + Broadcast) ──
    if (window.vespaDB) {
      await window.vespaDB.saveRegistration(p);
    }

    // Trigger localStorage sync pulse per aggiornare la dashboard in tempo reale
    try {
      localStorage.setItem('vespa_db_sync_pulse', Date.now().toString());
    } catch(e) {}

    fetch("/api/participant/update/" + p.id, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p)
    }).catch(function() {});

    this.renderStatusFeedback(
      "\u2705 EROGATO: " + currentLabel + " convalidato per " + p.cognome + " " + p.nome + ".",
      "success", p, mode
    );
  }

  renderPaymentBlockedFeedback(p) {
    this.playErrorSound();
    var container = document.getElementById("scannerResultContainer");
    if (!container) return;
    var price = p.importoDovuto || 55;
    var modalitaShort = (p.modalitaPartecipazione || "").split("-")[0].trim();

    container.innerHTML =
      "<div style='padding:2rem;background:#FEF2F2;border:2px solid #DC2626;border-radius:16px;box-shadow:0 4px 12px rgba(220,38,38,.15);'>" +
        "<div style='display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;'>" +
          "<span style='font-size:2.5rem;'>\uD83D\uDED1</span>" +
          "<div>" +
            "<h2 style='color:#DC2626;font-size:1.3rem;font-weight:900;margin:0;'>INGRESSO BLOCCATO \u2014 NON PAGATO</h2>" +
            "<p style='color:#991B1B;font-size:.9rem;margin:.2rem 0 0 0;'>Il partecipante risulta con quota non saldata</p>" +
          "</div>" +
        "</div>" +
        "<div style='background:#FFF;border:1px solid #FCA5A5;border-radius:10px;padding:1rem;margin-bottom:1.25rem;font-size:.95rem;line-height:1.7;'>" +
          "<p><strong>Partecipante:</strong> " + p.cognome + " " + p.nome + "</p>" +
          "<p><strong>Vespa Club:</strong> " + p.vespaClub + "</p>" +
          "<p><strong>Pacchetto:</strong> " + modalitaShort + "</p>" +
          "<p style='font-size:1.1rem;font-weight:900;color:#DC2626;'><strong>Quota da versare: \u20ac " + price + "</strong></p>" +
        "</div>" +
        "<div id='scannerActionButtons' style='display:flex;flex-direction:column;gap:.75rem;'>" +
          "<p style='font-size:.88rem;color:#7F1D1D;font-weight:700;margin:0;'>Azioni Organizzatore (solo personale autorizzato):</p>" +
          "<div style='display:flex;gap:.75rem;flex-wrap:wrap;'>" +
            "<button onclick=\"window.vespaScanner.forceAcceptance('" + p.id + "')\" " +
              "style='flex:1;min-width:200px;background:linear-gradient(135deg,#16A34A,#15803D);color:#FFF;border:none;border-radius:10px;padding:.85rem 1.25rem;font-size:.95rem;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(22,163,74,.35);'>" +
              "\uD83D\uDCB5 Pagato in Contanti \u2014 Completa Accettazione" +
            "</button>" +
            "<button onclick=\"window.vespaScanner.overrideAcceptance('" + p.id + "')\" " +
              "style='flex:1;min-width:200px;background:linear-gradient(135deg,#D97706,#B45309);color:#FFF;border:none;border-radius:10px;padding:.85rem 1.25rem;font-size:.95rem;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(217,119,6,.35);'>" +
              "\uD83D\uDD13 Sblocca Ingresso (Quota Pendente)" +
            "</button>" +
          "</div>" +
          "<p style='font-size:.78rem;color:#94A3B8;font-style:italic;margin:.25rem 0 0 0;'>" +
            "\"Pagato in contanti\" segna la quota come regolarizzata. \"Sblocca ingresso\" permette l'accesso con quota ancora da verificare." +
          "</p>" +
        "</div>" +
      "</div>";

    var manualInput = document.getElementById("scannerManualInput");
    if (manualInput) manualInput.value = "";
  }

  renderStatusFeedback(message, tone, p, activeMode) {
    if (tone === "success") {
      this.playSuccessSound();
    } else {
      this.playErrorSound();
    }

    // activeMode viene passato esplicitamente da validateAndProcessRegistration
    // per evitare di leggere this.mode (che può cambiare in async)
    var displayMode = activeMode || this.mode;
    var container = document.getElementById("scannerResultContainer");
    if (!container) return;

    var border = tone === "success" ? "#16a34a" : tone === "warning" ? "#d97706" : "#dc2626";
    var bg     = tone === "success" ? "#f0fdf4" : tone === "warning" ? "#fffbeb" : "#fef2f2";

    var gadgetLine = "";
    if (p && displayMode === "GADGET") {
      var taglia = p.tagliaTshirt || "?";
      gadgetLine = "<div style='font-size:1.2rem;color:#B91C1C;margin-top:.4rem;background:#FEE2E2;padding:.4rem .7rem;border-radius:8px;border:2px solid #FCA5A5;text-align:center;'>" +
        "<strong>👕 TAGLIA: <span style='font-size:1.5rem;letter-spacing:1px;'>" + taglia + "</span></strong></div>";
    }

    var detailsHtml = "";
    if (p) {
      detailsHtml =
        "<div class='scanner-result-details' style='margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid #cbd5e1;text-align:left;font-size:.9rem;line-height:1.4;'>" +
          "<p style='margin:0.15rem 0;'><strong>👤 Partecipante:</strong> " + p.cognome + " " + p.nome + "</p>" +
          "<p style='margin:0.15rem 0;'><strong>🛵 Vespa Club:</strong> " + p.vespaClub + " (VCI: " + p.tesseraVci + ")</p>" +
          "<p style='margin:0.15rem 0;'><strong>📦 Pacchetto:</strong> " + p.modalitaPartecipazione + "</p>" +
          gadgetLine +
        "</div>";
    }

    container.innerHTML =
      "<div class='scanner-result-card' style='padding:1rem 1.25rem;background:" + bg + ";border:2px solid " + border + ";border-radius:14px;box-shadow:0 4px 6px -1px rgba(0,0,0,.05);'>" +
        "<h2 style='color:" + border + ";font-size:1.15rem;font-weight:900;margin:0;line-height:1.3;'>" + message + "</h2>" +
        detailsHtml +
        "<div style='margin-top:0.5rem;font-size:.75rem;color:#64748b;font-style:italic;'>Banco [" + displayMode + "] attivo. Pronto per il prossimo pass...</div>" +
      "</div>";

    // Su schermi piccoli porta delicatamente in vista il risultato se necessario
    if (window.innerWidth <= 900) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    var manualInput = document.getElementById("scannerManualInput");
    if (manualInput) { manualInput.value = ""; manualInput.focus(); }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  window.vespaScanner = new VespaScanner();
  window.vespaScanner.init();
});
