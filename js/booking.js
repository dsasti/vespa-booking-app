/**
 * Vespa Club Booking System - Participant Booking Form Module
 */

class VespaBookingForm {
  constructor() {
    this.uploadedFileBase64 = null;
    this.uploadedFileName = null;
    this.uploadedFileType = null;
    this.isSubmitting = false;
    this.editingRecordId = null;
    this.editingOriginalRecord = null;
    this.currentViewRecord = null;
  }

  init() {
    const form = document.getElementById('bookingForm');
    const fileInput = document.getElementById('provaPagamentoFile');
    const fileDropArea = document.getElementById('fileDropArea');

    if (!form) return;

    // Gestione Drag & Drop per il caricamento file
    if (fileDropArea && fileInput) {
      ['dragenter', 'dragover'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, (e) => {
          e.preventDefault();
          fileDropArea.classList.add('dragover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, (e) => {
          e.preventDefault();
          fileDropArea.classList.remove('dragover');
        }, false);
      });

      fileDropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          fileInput.files = files;
          this.handleFileUpload(files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Listener per Submit del Form
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitForm();
    });
  }

  handleFileUpload(file) {
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      window.app.showToast('Errore: formato file non supportato. Caricare solo PDF o JPG/PNG.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // Max 10MB
      window.app.showToast('Errore: il file supera la dimensione massima di 10MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.uploadedFileBase64 = e.target.result;
      this.uploadedFileName = file.name;
      this.uploadedFileType = file.type;

      const previewBox = document.getElementById('filePreviewBox');
      const fileNameEl = document.getElementById('fileNameText');
      if (previewBox && fileNameEl) {
        fileNameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        previewBox.style.display = 'flex';
      }
    };
    reader.readAsDataURL(file);
  }

  removeUploadedFile() {
    this.uploadedFileBase64 = null;
    this.uploadedFileName = null;
    this.uploadedFileType = null;
    const fileInput = document.getElementById('provaPagamentoFile');
    const previewBox = document.getElementById('filePreviewBox');
    if (fileInput) fileInput.value = '';
    if (previewBox) previewBox.style.display = 'none';
  }

  // Carica i dati di una prenotazione recuperata nel modulo per permettere la modifica e il ri-salvataggio
  loadForEdit(record) {
    if (!record) return;

    this.editingRecordId = record.id;
    this.editingOriginalRecord = record;
    this.currentViewRecord = record;

    // Popola tutti i campi del modulo
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('cognome', record.cognome);
    setVal('nome', record.nome);
    setVal('dataNascita', record.dataNascita || '');
    setVal('vespaClub', record.vespaClub);
    setVal('cittaProvenienza', record.cittaProvenienza || record.citta || '');
    setVal('tesseraVci', record.tesseraVci);
    setVal('tesseraMotornext', record.tesseraMotornext);
    setVal('email', record.email);
    setVal('telefono', record.telefono);
    setVal('ruolo', record.ruolo || 'CONDUCENTE');
    setVal('modelloVespa', record.modelloVespa);
    setVal('annoVespa', record.annoVespa || '1980');
    setVal('tagliaTshirt', record.tagliaTshirt || 'L');
    setVal('modalitaPartecipazione', record.modalitaPartecipazione);
    if (typeof window.renderPackageBadgePreview === 'function') {
      window.renderPackageBadgePreview();
    }

    // Gestione ricevuta di pagamento
    if (record.ricevutaPagamento && record.ricevutaPagamento.data) {
      this.uploadedFileBase64 = record.ricevutaPagamento.data;
      this.uploadedFileName = record.ricevutaPagamento.name || 'ricevuta_bonifico';
      this.uploadedFileType = record.ricevutaPagamento.type || 'application/pdf';

      const previewBox = document.getElementById('filePreviewBox');
      const fileNameEl = document.getElementById('fileNameText');
      if (previewBox && fileNameEl) {
        fileNameEl.textContent = `${this.uploadedFileName} (Allegato salvato - puoi sostituirlo)`;
        previewBox.style.display = 'flex';
      }
    } else {
      this.removeUploadedFile();
    }

    // Mostra banner modalità modifica
    const editBanner = document.getElementById('bookingEditModeBanner');
    const editPassId = document.getElementById('bookingEditModePassId');
    if (editPassId) editPassId.textContent = record.id;
    if (editBanner) editBanner.style.display = 'block';

    // Cambia il testo del pulsante di invio
    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) {
      const editTxt = (window.vespaI18n && window.vespaI18n.get('btnSubmitEditing')) || '💾 Salva Modifiche Prenotazione';
      submitBtn.textContent = editTxt;
      submitBtn.style.background = 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)';
    }

    // Mostra la vista del form
    const bookingView = document.getElementById('booking-view');
    const confirmationView = document.getElementById('confirmation-view');
    if (confirmationView) {
      confirmationView.style.display = 'none';
      confirmationView.classList.remove('active');
    }
    if (bookingView) {
      bookingView.style.display = 'block';
      bookingView.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.app) {
      window.app.showToast(`✏️ Modalità modifica attiva per ${record.cognome} ${record.nome}. Correggi i dati e salva.`, 'info');
    }
  }

  // Modifica il ticket attualmente visualizzato
  editCurrentTicket() {
    if (this.currentViewRecord) {
      this.loadForEdit(this.currentViewRecord);
    } else {
      const ticketId = document.getElementById('ticketId')?.textContent?.trim();
      if (ticketId && window.vespaDB) {
        window.vespaDB.getById(ticketId).then(rec => {
          if (rec) this.loadForEdit(rec);
        });
      }
    }
  }

  // Annulla la modifica e torna al biglietto Pass
  cancelEdit() {
    const editBanner = document.getElementById('bookingEditModeBanner');
    if (editBanner) editBanner.style.display = 'none';

    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) {
      const defaultTxt = (window.vespaI18n && window.vespaI18n.get('btnSubmit')) || '🚀 Conferma e Invia Registrazione Online';
      submitBtn.textContent = defaultTxt;
      submitBtn.style.background = '';
    }

    const orig = this.editingOriginalRecord;
    this.editingRecordId = null;
    this.editingOriginalRecord = null;

    if (orig && window.app) {
      window.app.showTicketView(orig);
    } else {
      const form = document.getElementById('bookingForm');
      if (form) form.reset();
      this.removeUploadedFile();
    }
  }

  showDuplicateModal(cognome, nome, dup) {
    const modal = document.getElementById('duplicateModal');
    const nameEl = document.getElementById('duplicateParticipantName');
    const passEl = document.getElementById('duplicateParticipantPass');
    if (nameEl) nameEl.textContent = `${cognome.toUpperCase()} ${nome}`;
    if (passEl) passEl.textContent = `Codice Pass già emesso: ${dup.id} • Club: ${dup.vespaClub}`;
    if (modal) {
      modal.style.display = 'flex';
    } else {
      alert(`ATTENZIONE: La prenotazione per "${cognome.toUpperCase()} ${nome}" è già stata completata (Pass ${dup.id})!\n\nSe devi effettuare una nuova prenotazione devi usare un altro nome.\nPer problemi o modifiche contatta direttamente l'organizzatore del Vespa Club Asti.`);
    }
  }

  async submitForm() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const submitBtn = document.getElementById('submitBookingBtn');
    const isEditing = !!this.editingRecordId;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isEditing ? '⏳ Salvataggio modifiche...' : '⏳ Salvataggio in corso...';
    }

    try {
      const cognome = (document.getElementById('cognome')?.value || '').trim();
      const nome = (document.getElementById('nome')?.value || '').trim();

      if (!cognome || !nome) {
        window.app.showToast('Compilare tutti i campi obbligatori.', 'error');
        return;
      }

      // Controllo preventivo duplicati per lo stesso nome e cognome (ignora se stesso se in modifica)
      const allRegs = await window.vespaDB.getAllRegistrations();
      const duplicate = allRegs.find(r => 
        (!this.editingRecordId || r.id.toUpperCase() !== this.editingRecordId.toUpperCase()) &&
        r.cognome.trim().toUpperCase() === cognome.toUpperCase() &&
        r.nome.trim().toUpperCase() === nome.toUpperCase()
      );

      if (duplicate) {
        this.showDuplicateModal(cognome, nome, duplicate);
        window.app.showToast(`Prenotazione già completata per ${cognome} ${nome}!`, 'error');
        return;
      }

      const orig = this.editingOriginalRecord;

      const data = {
        ...(orig || {}),
        id: this.editingRecordId || undefined,
        cognome: cognome,
        nome: nome,
        dataNascita: (document.getElementById('dataNascita')?.value || (orig ? orig.dataNascita : '')).trim(),
        vespaClub: (document.getElementById('vespaClub')?.value || '').trim(),
        cittaProvenienza: (document.getElementById('cittaProvenienza')?.value || (orig ? (orig.cittaProvenienza || orig.citta) : '') || '').trim(),
        tesseraVci: (document.getElementById('tesseraVci')?.value || '').trim(),
        tesseraMotornext: (document.getElementById('tesseraMotornext')?.value || '').trim(),
        email: (document.getElementById('email')?.value || '').trim(),
        telefono: (document.getElementById('telefono')?.value || '').trim(),
        ruolo: document.getElementById('ruolo')?.value || 'CONDUCENTE',
        modelloVespa: (document.getElementById('modelloVespa')?.value || '').trim(),
        annoVespa: document.getElementById('annoVespa')?.value || '1980',
        tagliaTshirt: (document.getElementById('tagliaTshirt')?.disabled) ? '' : (document.getElementById('tagliaTshirt')?.value || 'L'),
        modalitaPartecipazione: document.getElementById('modalitaPartecipazione')?.value,
        importoDovuto: (function() {
          if (orig && orig.importoDovuto !== undefined && orig.importoDovuto !== null) {
            // Se stiamo modificando un record esistente e il pacchetto non è cambiato, preserva la quota originale
            const currentSelected = document.getElementById('modalitaPartecipazione')?.value;
            if (currentSelected === orig.modalitaPartecipazione) return orig.importoDovuto;
          }
          const selVal = document.getElementById('modalitaPartecipazione')?.value || '';
          if (window.VespaPkg) return window.VespaPkg.getPriceForRegistration(selVal);
          return 55;
        })(),
        ricevutaPagamento: this.uploadedFileBase64 ? {
          name: this.uploadedFileName || 'ricevuta_bonifico',
          type: this.uploadedFileType || 'application/pdf',
          data: this.uploadedFileBase64
        } : (orig ? orig.ricevutaPagamento : null),
        ricevutaPagamentoVerified: orig ? orig.ricevutaPagamentoVerified : false
      };

      // Se ha appena allegato la ricevuta che prima mancava, aggiorna lo stato pagamento
      if (data.ricevutaPagamento && data.ricevutaPagamento.data && data.statoPagamento !== 'PAGATO') {
        data.statoPagamento = 'RICEVUTA_DA_VERIFICARE';
      }

      // Salvataggio nel DB Cloud/Locale
      const record = await window.vespaDB.saveRegistration(data);

      this.currentViewRecord = record;
      this.editingRecordId = null;
      this.editingOriginalRecord = null;

      // Ripristina banner modifica e avvisi
      const editBanner = document.getElementById('bookingEditModeBanner');
      if (editBanner) editBanner.style.display = 'none';
      const recNotice = document.getElementById('ticketRecoveredNotice');
      if (recNotice) recNotice.style.display = 'none';

      if (submitBtn) {
        submitBtn.textContent = '🚀 Conferma e Invia Registrazione Online';
        submitBtn.style.background = '';
      }

      // Mostra IMMEDIATAMENTE la schermata del biglietto Pass
      const bookingView = document.getElementById('booking-view');
      const confirmationView = document.getElementById('confirmation-view');
      if (bookingView) {
        bookingView.style.display = 'none';
        bookingView.classList.remove('active');
      }
      if (confirmationView) {
        confirmationView.style.display = 'block';
        confirmationView.classList.add('active');
      }

      if (window.confetti) {
        try {
          window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
        } catch (e) {}
      }

      const toastMsg = isEditing
        ? '✅ Prenotazione e ricevuta aggiornate con successo!'
        : '✅ Prenotazione registrata! Salva o stampa il tuo Pass.';
      window.app.showToast(toastMsg, 'success');

      // Popola tutti i dati del biglietto e genera il QR
      window.app.showTicketView(record);

      // Scroll all'inizio del pass
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Reset Form
      const form = document.getElementById('bookingForm');
      if (form) form.reset();
      this.removeUploadedFile();

    } catch (err) {
      console.error(err);
      if (err.isDuplicate && err.duplicateRecord) {
        const cognome = (document.getElementById('cognome')?.value || '').trim();
        const nome = (document.getElementById('nome')?.value || '').trim();
        this.showDuplicateModal(cognome, nome, err.duplicateRecord);
      } else {
        window.app.showToast('Si è verificato un errore durante il salvataggio: ' + (err.message || ''), 'error');
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Conferma e Invia Registrazione Online';
        submitBtn.style.background = '';
      }
    }
  }

  submitRegistration() {
    return this.submitForm();
  }
}

window.vespaBookingForm = new VespaBookingForm();
window.vespaBooking = window.vespaBookingForm;

