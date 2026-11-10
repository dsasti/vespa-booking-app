/**
 * Vespa Club Asti - Main Application Controller
 */

class VespaApp {
  constructor() {
    this.currentView = 'admin-view';
  }

  async init() {
    // Inizializzazione DB
    if (window.vespaDB) {
      await window.vespaDB.init();
    }

    // Inizializzazione sicura dei sottomoduli (solo se presenti nella pagina corrente)
    if (window.vespaBookingForm && typeof window.vespaBookingForm.init === 'function') {
      window.vespaBookingForm.init();
    }
    
    if (window.vespaAdmin && typeof window.vespaAdmin.init === 'function') {
      await window.vespaAdmin.init();
    }
    
    // NOTA: vespaScanner.init() viene chiamato con la modalità corretta
    // da ogni singola pagina (accettazione.html -> 'ACCETTAZIONE', servizi.html -> 'SERVIZI')
    // NON chiamare qui vespaScanner.init() per evitare di sovrascrivere la modalità.

    // Event Listener per pulsanti di navigazione (.nav-btn)
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetView = btn.dataset.view;
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });

    console.log("Vespa Club Asti System Controller Pronto!");
  }

  switchView(viewId) {
    // Se si esce dalla vista scanner, ferma la fotocamera
    if (this.currentView === 'scanner-view' && viewId !== 'scanner-view') {
      if (window.vespaScanner && typeof window.vespaScanner.stopScanner === 'function') {
        window.vespaScanner.stopScanner();
      }
    }

    // Aggiorna classe active sulle sezioni e stile display
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
      sec.style.display = 'none';
    });

    let targetSection = document.getElementById(viewId);
    if (!targetSection && (viewId === 'ticket-view' || viewId === 'confirmation-view')) {
      targetSection = document.getElementById('confirmation-view') || document.getElementById('ticket-view');
    }

    if (targetSection) {
      targetSection.classList.add('active');
      targetSection.style.display = 'block';
      this.currentView = viewId;
    }

    // Aggiorna stato pulsanti nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Se si accede ad Admin o Scanner, rinfresca i dati
    if (viewId === 'admin-view' && window.vespaAdmin) {
      window.vespaAdmin.refreshData();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Visualizza il Biglietto Pass QR Code
  showTicketView(record) {
    if (!record) return;

    // Passa immediatamente alla vista del biglietto Pass
    this.switchView('ticket-view');

    const elId = document.getElementById('ticketId');
    if (elId) elId.textContent = record.id;

    const elName = document.getElementById('ticketCognomeNome');
    if (elName) elName.textContent = `${record.cognome} ${record.nome}`;

    const elClub = document.getElementById('ticketVespaClub');
    if (elClub) elClub.textContent = record.vespaClub;

    const elCitta = document.getElementById('ticketCittaProvenienza');
    if (elCitta) elCitta.textContent = record.cittaProvenienza || record.citta || '-';

    const elVci = document.getElementById('ticketTesseraVci');
    if (elVci) elVci.textContent = record.tesseraVci || '-';

    const elRuolo = document.getElementById('ticketRuolo');
    if (elRuolo) elRuolo.textContent = record.ruolo || 'CONDUCENTE';

    const elTshirt = document.getElementById('ticketTshirt');
    if (elTshirt) elTshirt.textContent = record.tagliaTshirt || 'L';

    const elModalita = document.getElementById('ticketModalita');
    if (elModalita) elModalita.textContent = record.modalitaPartecipazione;

    const elModel = document.getElementById('ticketVespaModel');
    if (elModel) elModel.textContent = `${record.modelloVespa} (${record.annoVespa})`;

    const elMn = document.getElementById('ticketTesseraMn');
    if (elMn) elMn.textContent = record.tesseraMotornext || '-';

    const payEl = document.getElementById('ticketPaymentSummary');
    if (payEl) {
      const isPaid = (record.statoPagamento === 'PAGATO');
      const hasReceipt = (record.ricevutaPagamento && record.ricevutaPagamento.data);
      const curLang = (window.vespaI18n && window.vespaI18n.currentLang) || 'it';

      let paidTxt = '✅ Quota Pagata Regolarmente';
      let verifyTxt = '📙 Ricevuta Bonifico Allegata (In Verifica)';
      let unpaidTxt = '❌ Quota da Saldare all\'Arrivo';

      if (curLang === 'en') {
        paidTxt = '✅ Fee Paid Officially';
        verifyTxt = '📙 Bank Receipt Attached (Pending Verification)';
        unpaidTxt = '❌ Fee to be Settled upon Arrival';
      } else if (curLang === 'de') {
        paidTxt = '✅ Gebühr ordnungsgemäß bezahlt';
        verifyTxt = '📙 Überweisungsbeleg angehängt (in Prüfung)';
        unpaidTxt = '❌ Gebühr vor Ort bei Ankunft zu zahlen';
      } else if (curLang === 'fr') {
        paidTxt = '✅ Frais Réglés avec Succès';
        verifyTxt = '📙 Justificatif Joint (En Cours de Vérification)';
        unpaidTxt = '❌ Frais à Régler sur Place à l\'Arrivée';
      }

      if (isPaid) {
        payEl.innerHTML = `<span class="badge badge-success">${paidTxt}</span>`;
      } else if (hasReceipt) {
        payEl.innerHTML = `<span class="badge badge-warning">${verifyTxt}</span>`;
      } else {
        payEl.innerHTML = `<span class="badge badge-danger">${unpaidTxt}</span>`;
      }
    }

    const mode = record.modalitaPartecipazione || '';
    const cenaBadge = document.getElementById('ticketBadgeCena');
    const pranzoBadge = document.getElementById('ticketBadgePranzo');
    if (cenaBadge) {
      cenaBadge.style.display = (mode.includes('SABATO') || mode.includes('FULL 2 GIORNI')) ? 'inline-block' : 'none';
    }
    if (pranzoBadge) {
      pranzoBadge.style.display = (mode.includes('DOMENICA') || mode.includes('FULL 2 GIORNI')) ? 'inline-block' : 'none';
    }

    try {
      if (window.vespaQR && typeof window.vespaQR.renderQRCode === 'function') {
        window.vespaQR.renderQRCode('ticketQrContainer', record);
      }
    } catch (qrErr) {
      console.warn('QR Code rendering fallback:', qrErr);
    }

    const downloadAction = () => {
      try {
        if (window.vespaQR && typeof window.vespaQR.downloadQRPass === 'function') {
          window.vespaQR.downloadQRPass(record.id, record.cognome, record.nome);
        }
      } catch (e) {
        console.warn('Download error:', e);
      }
    };

    const downloadBtn = document.getElementById('downloadQrBtn');
    if (downloadBtn) downloadBtn.onclick = downloadAction;

    const bannerDownloadBtn = document.getElementById('bannerDownloadQrBtn');
    if (bannerDownloadBtn) bannerDownloadBtn.onclick = downloadAction;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new VespaApp();
  window.app.init();
});
