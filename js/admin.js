/**
 * Vespa Club Asti - Cloud Admin Dashboard Module
 */

class VespaAdminDashboard {
  constructor() {
    this.currentEditingId = null;
    this.currentReceiptId = null;
    this.allRegistrations = [];
    this.sortColumn = 'cognome';
    this.sortAscending = true;
    this.activeRankingTab = 'oldest';
    this.rankingClubFilter = 'ALL';
    this.clubRankingSortBy = 'total'; // 'total' oppure 'distance'
    this.clubRankingSortAsc = false;   // default decrescente (maggior numero / maggiore distanza)
  }

  async init() {
    await this.refreshData();

    const searchInput = document.getElementById('adminSearchInput');
    const modeFilter = document.getElementById('adminModeFilter');
    const statusFilter = document.getElementById('adminStatusFilter');

    if (searchInput) searchInput.addEventListener('input', () => this.applyFilters());
    if (modeFilter) modeFilter.addEventListener('change', () => this.applyFilters());
    if (statusFilter) statusFilter.addEventListener('change', () => this.applyFilters());

    window.vespaDB.onChange(async () => {
      await this.refreshData();
    });
  }

  async refreshData() {
    this.allRegistrations = await window.vespaDB.getAllRegistrations();
    this.renderStats();
    this.applyFilters();
    this.populateRankingClubsFilter();
    this.renderRankings();

    // Se la scheda del cliente è aperta, aggiorna all'istante i suoi dati e lo stato dei servizi in tempo reale
    if (this.currentEditingId) {
      const modal = document.getElementById('editParticipantModal');
      if (modal && modal.style.display !== 'none') {
        const currentRec = this.allRegistrations.find(r => r.id === this.currentEditingId);
        if (currentRec) {
          this.populateEditModalFields(currentRec);
        }
      }
    }
  }

  // Cambia la colonna di ordinamento A-Z / Z-A
  sortBy(columnName) {
    if (this.sortColumn === columnName) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = columnName;
      this.sortAscending = true;
    }
    this.applyFilters();
  }

  renderStats() {
    const totalCount = this.allRegistrations.length;
    
    let totalExpected = 0;
    let totalPaid = 0;
    let presenceSabatoCount = 0;
    let presenceDomenicaCount = 0;

    const tshirts = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 };

    this.allRegistrations.forEach(r => {
      const price = r.importoDovuto || VespaDB.getPriceForMode(r.modalitaPartecipazione);
      totalExpected += price;

      if (r.statoPagamento === 'PAGATO') {
        totalPaid += price;
      }

      if (r.statoAccettazioneSabato) presenceSabatoCount++;
      if (r.statoAccettazioneDomenica) presenceDomenicaCount++;

      if (tshirts[r.tagliaTshirt] !== undefined) tshirts[r.tagliaTshirt]++;
    });

    const totalPending = totalExpected - totalPaid;

    const elTotal = document.getElementById('statTotalParticipants');
    const elPaidEuro = document.getElementById('statTotalPaidEuro');
    const elPendingEuro = document.getElementById('statTotalPendingEuro');
    const elPresenceBreakdown = document.getElementById('statPresenceBreakdown');
    const elTshirts = document.getElementById('statTshirtBreakdown');

    if (elTotal) elTotal.textContent = totalCount;
    if (elPaidEuro) elPaidEuro.textContent = `€ ${totalPaid} (su € ${totalExpected})`;
    if (elPendingEuro) elPendingEuro.textContent = `€ ${totalPending}`;
    if (elPresenceBreakdown) elPresenceBreakdown.textContent = `Sab: ${presenceSabatoCount} | Dom: ${presenceDomenicaCount}`;

    if (elTshirts) {
      elTshirts.innerHTML = Object.entries(tshirts)
        .map(([size, cnt]) => `<span class="badge badge-info" style="font-size:0.8rem;">${size}: <strong>${cnt}</strong></span>`)
        .join(' ');
    }
  }

  applyFilters() {
    const query = (document.getElementById('adminSearchInput')?.value || '').toLowerCase();
    const modeVal = document.getElementById('adminModeFilter')?.value || 'ALL';
    const statusVal = document.getElementById('adminStatusFilter')?.value || 'ALL';

    let filtered = this.allRegistrations.filter(r => {
      const matchQuery = !query || 
        r.cognome.toLowerCase().includes(query) ||
        r.nome.toLowerCase().includes(query) ||
        r.vespaClub.toLowerCase().includes(query) ||
        r.tesseraVci.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query) ||
        r.telefono.includes(query);

      let matchMode = modeVal === 'ALL';
      if (!matchMode) {
        if (window.VespaPkg) {
          const resolved = window.VespaPkg.resolvePackageFromRegistration(r.modalitaPartecipazione);
          matchMode = resolved ? (resolved.id === modeVal) : (r.modalitaPartecipazione || '').includes(modeVal);
        } else {
          matchMode = (r.modalitaPartecipazione || '').includes(modeVal);
        }
      }

      let matchStatus = true;
      if (statusVal === 'PAGATO') matchStatus = r.statoPagamento === 'PAGATO';
      if (statusVal === 'NON_PAGATO') matchStatus = r.statoPagamento === 'NON_PAGATO';
      if (statusVal === 'UNVERIFIED') matchStatus = r.statoPagamento === 'RICEVUTA_DA_VERIFICARE';

      return matchQuery && matchMode && matchStatus;
    });

    // Ordinamento A-Z / Z-A
    const col = this.sortColumn;
    const asc = this.sortAscending ? 1 : -1;

    filtered.sort((a, b) => {
      let valA = a[col] || '';
      let valB = b[col] || '';

      if (col === 'importoDovuto') {
        valA = a.importoDovuto || VespaDB.getPriceForMode(a.modalitaPartecipazione);
        valB = b.importoDovuto || VespaDB.getPriceForMode(b.modalitaPartecipazione);
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return -1 * asc;
      if (valA > valB) return 1 * asc;
      return 0;
    });

    this.renderTableHeader();
    this.renderTable(filtered);
  }

  renderTableHeader() {
    const thead = document.getElementById('adminTableHead');
    if (!thead) return;

    const getIndicator = (colName) => {
      if (this.sortColumn === colName) {
        return this.sortAscending ? ' ▲' : ' ▼';
      }
      return '';
    };

    thead.innerHTML = `
      <tr>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('id')">ID PASS${getIndicator('id')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('cognome')">PARTECIPANTE${getIndicator('cognome')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('vespaClub')">VESPA CLUB${getIndicator('vespaClub')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('tagliaTshirt')">TAGLIA${getIndicator('tagliaTshirt')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('importoDovuto')">PACCHETTO & QUOTA${getIndicator('importoDovuto')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('statoPagamento')">STATO PAGAMENTO${getIndicator('statoPagamento')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('statoAccettazioneSabato')">PRESENZA SABATO${getIndicator('statoAccettazioneSabato')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('statoAccettazioneDomenica')">PRESENZA DOMENICA${getIndicator('statoAccettazioneDomenica')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('ritiroGadget')">GADGET${getIndicator('ritiroGadget')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('merenda')">MERENDA SAB.${getIndicator('merenda')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('aperitivoSabatoErogato')">APERITIVO SAB.${getIndicator('aperitivoSabatoErogato')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('cenaSabatoErogato')">CENA SAB.${getIndicator('cenaSabatoErogato')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('colazioneDomenicaErogata')">COLAZ. DOM.${getIndicator('colazioneDomenicaErogata')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('aperitivoDomenicaErogato')">APERITIVO DOM.${getIndicator('aperitivoDomenicaErogato')}</th>
        <th style="cursor:pointer;" onclick="window.vespaAdmin.sortBy('pranzo')">PRANZO DOM.${getIndicator('pranzo')}</th>
        <th>AZIONI</th>
      </tr>
    `;
  }

  renderTable(list) {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nessuna prenotazione trovata.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(r => {
      const modeStr = r.modalitaPartecipazione || '';
      const price = r.importoDovuto || (window.VespaPkg ? window.VespaPkg.getPriceForRegistration(modeStr) : 55);

      // Risolve il pacchetto tramite VespaPkg (supporta ID moderni e stringhe legacy)
      const pkg = window.VespaPkg ? window.VespaPkg.resolvePackageFromRegistration(modeStr) : null;
      const hasSabato   = pkg ? pkg.includesSabato   : (modeStr.includes('SABATO') || modeStr.includes('FULL 2 GIORNI') || modeStr.includes('COMPLETA'));
      const hasDomenica = pkg ? pkg.includesDomenica  : (modeStr.includes('DOMENICA') || modeStr.includes('FULL 2 GIORNI') || modeStr.includes('COMPLETA'));
      const hasSvc = (key) => pkg ? pkg.services.includes(key) : true;

      let payBadge = '';
      const hasReceipt = !!(r.ricevutaPagamento && r.ricevutaPagamento.data);
      const icon = hasReceipt ? '📎' : '📄';

      if (r.statoPagamento === 'PAGATO') {
        payBadge = `<span class="badge badge-success clickable-badge" title="Clicca per visualizzare o gestire la ricevuta / stato pagamento" onclick="window.vespaAdmin.viewReceipt('${r.id}')">${icon} PAGATO (€ ${price})</span>`;
      } else if (r.statoPagamento === 'RICEVUTA_DA_VERIFICARE') {
        payBadge = `<span class="badge badge-warning clickable-badge" title="Clicca per verificare la ricevuta allegata e confermare il pagamento" onclick="window.vespaAdmin.viewReceipt('${r.id}')">📎 Da Verificare</span>`;
      } else {
        payBadge = `<span class="badge badge-danger clickable-badge" title="Clicca per visualizzare dettagli o segnare come pagato" onclick="window.vespaAdmin.viewReceipt('${r.id}')">❌ NON PAGATO (€ ${price})</span>`;
      }

      const verifyBtn = r.statoPagamento === 'PAGATO'
        ? `<button class="btn btn-secondary btn-sm" onclick="window.vespaAdmin.togglePayment('${r.id}', 'NON_PAGATO')">🔄 Segna Non Pagato</button>`
        : `<button class="btn btn-success btn-sm" onclick="window.vespaAdmin.togglePayment('${r.id}', 'PAGATO')">✅ SEGNA PAGATO</button>`;

      // Helper: bottone servizio con N.A. se non incluso nel pacchetto
      const svcBtn = (serviceKey, field, alias, labelSì, labelNo, toggleKey) => {
        if (!hasSvc(serviceKey)) return `<span style="color:var(--text-dim); font-size:0.8rem;">- Non Incluso -</span>`;
        const done = !!(r[field] || (alias && r[alias]));
        return `<button class="btn ${done ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="window.vespaAdmin.toggleService('${r.id}', '${toggleKey || field}')">${done ? labelSì : labelNo}</button>`;
      };

      // Colori tenui di riga per pacchetto/giorni di iscrizione (coerenti con il PDF)
      // Sabato + Domenica: #EFF6FF (tenue azzurro)
      // Solo Sabato:       #FFF7ED (tenue crema / arancio)
      // Solo Domenica:     #F0FDF4 (tenue menta / smeraldo)
      let rowBg = '#FFFFFF';
      let rowStickyIdBg = '#EFF6FF';
      let rowStickyNameBg = '#F8FAFC';
      let rowBadge = '';

      if (hasSabato && hasDomenica) {
        rowBg = '#EFF6FF';
        rowStickyIdBg = '#DBEAFE';
        rowStickyNameBg = '#EFF6FF';
      } else if (hasSabato) {
        rowBg = '#FFF7ED';
        rowStickyIdBg = '#FFEDD5';
        rowStickyNameBg = '#FFF7ED';
      } else if (hasDomenica) {
        rowBg = '#F0FDF4';
        rowStickyIdBg = '#DCFCE7';
        rowStickyNameBg = '#F0FDF4';
      }

      // Mini immagine badge stilizzata per ciascun pacchetto (C, SF, SL, DF, DL)
      const badgeSvg = (window.VespaPkg && typeof window.VespaPkg.getBadgeHtml === 'function')
        ? window.VespaPkg.getBadgeHtml(pkg || modeStr)
        : '';
      rowBadge = badgeSvg ? `<span style="margin-left:5px; vertical-align:middle; display:inline-block;">${badgeSvg}</span>` : '';

      const pkgCleanName = pkg ? pkg.label : modeStr.split('-')[0].trim();
      const pkgLabel = badgeSvg ? `${badgeSvg} ${pkgCleanName}` : `${pkg ? pkg.emoji + ' ' : ''}${pkgCleanName}`;

      return `
        <tr style="background:${rowBg};" class="pkg-row">
          <td style="background:${rowStickyIdBg};"><strong style="color:var(--vespa-blue); font-family:monospace;">${r.id}</strong></td>
          <td style="background:${rowStickyNameBg}; cursor:pointer;" onclick="window.vespaAdmin.openEditModal('${r.id}')" title="Clicca per aprire la scheda partecipante">
            <strong style="color:var(--vespa-blue-dark); text-decoration:underline;">${r.cognome}</strong> ${r.nome} ${rowBadge}
          </td>
          <td>${r.vespaClub}</td>
          <td><span class="badge badge-info">${r.tagliaTshirt}</span></td>
          <td><strong>${pkgLabel}</strong> (€ ${price})</td>
          <td>${payBadge}</td>

          <!-- PRESENZA SABATO -->
          <td>
            ${hasSabato ? `
              <button class="btn ${(r.statoAccettazioneSabato || r.accettazioneConclusa) ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="window.vespaAdmin.toggleService('${r.id}', 'statoAccettazioneSabato')">
                ${(r.statoAccettazioneSabato || r.accettazioneConclusa) ? `SÌ (${r.accettazioneSabatoTimestamp || r.accettazioneTimestamp || 'OK'})` : 'NO'}
              </button>
            ` : `<span style="color:var(--text-dim); font-size:0.8rem;">- N.A. -</span>`}
          </td>

          <!-- PRESENZA DOMENICA -->
          <td>
            ${hasDomenica ? `
              <button class="btn ${r.statoAccettazioneDomenica ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="window.vespaAdmin.toggleService('${r.id}', 'statoAccettazioneDomenica')">
                ${r.statoAccettazioneDomenica ? `SÌ (${r.accettazioneDomenicaTimestamp || 'OK'})` : 'NO'}
              </button>
            ` : `<span style="color:var(--text-dim); font-size:0.8rem;">- N.A. -</span>`}
          </td>

          <!-- GADGET (unico: sabato o domenica, non entrambe) -->
          <td>
            <button class="btn ${(r.ritiroGadget || r.kitGadgetConsegnato) ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="window.vespaAdmin.toggleService('${r.id}', 'ritiroGadget')">
              ${(r.ritiroGadget || r.kitGadgetConsegnato) ? 'RITIRATO' : 'DA CONSEGNARE'}
            </button>
          </td>

          <!-- MERENDA SABATO -->
          <td>${svcBtn('merendaSabato', 'merendaSabatoErogata', 'merenda', 'FRUITA', 'DA EROGARE', 'merenda')}</td>

          <!-- APERITIVO SABATO -->
          <td>${svcBtn('aperitivoSabato', 'aperitivoSabatoErogato', null, 'FRUITO', 'DA EROGARE', 'aperitivoSabatoErogato')}</td>

          <!-- CENA SABATO -->
          <td>${svcBtn('cena', 'cenaSabatoErogato', 'cena', 'FRUITA', 'DA EROGARE', 'cena')}</td>

          <!-- COLAZIONE DOMENICA -->
          <td>${svcBtn('colazioneDomenica', 'colazioneDomenicaErogata', null, 'FRUITA', 'DA EROGARE', 'colazioneDomenicaErogata')}</td>

          <!-- APERITIVO DOMENICA -->
          <td>${svcBtn('aperitivoDomenica', 'aperitivoDomenicaErogato', null, 'FRUITO', 'DA EROGARE', 'aperitivoDomenicaErogato')}</td>

          <!-- PRANZO DOMENICA -->
          <td>${svcBtn('pranzo', 'pranzoDomenicaErogato', 'pranzo', 'FRUITO', 'DA EROGARE', 'pranzo')}</td>

          <td>
            <div style="display:flex; gap:0.35rem; align-items:center; justify-content:center;">
              <button class="btn btn-sm" onclick="window.vespaAdmin.deleteRegistration('${r.id}', '${r.cognome}')" style="background:#EF4444; color:#FFF; border:none; padding:0.35rem 0.65rem; font-weight:700;" title="Elimina Iscrizione">
                🗑️ Elimina
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async deleteRegistration(id, cognome) {
    if (confirm(`Sei sicuro di voler eliminare definitivamente la registrazione di ${cognome} (${id})?`)) {
      await window.vespaDB.deleteRegistration(id);
      window.app.showToast(`Iscrizione ${id} eliminata con successo!`, 'info');
      await this.refreshData();
    }
  }

  async togglePayment(id, newStatus) {
    try {
      await window.vespaDB.setPaymentStatus(id, newStatus);
      const msg = newStatus === 'PAGATO' ? 'Pagamento verificato e segnato come PAGATO!' : 'Stato aggiornato a Non Pagato.';
      window.app.showToast(msg, newStatus === 'PAGATO' ? 'success' : 'info');
      await this.refreshData();
    } catch (e) {
      window.app.showToast(e.message, 'error');
    }
  }

  async toggleService(id, key) {
    try {
      await window.vespaDB.toggleServiceStatus(id, key);
      await this.refreshData();
    } catch (e) {
      console.error(e);
    }
  }

  populateEditModalFields(record) {
    if (!record) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    setVal('editId', record.id);
    setVal('editCognome', record.cognome);
    setVal('editNome', record.nome);
    setVal('editVespaClub', record.vespaClub);
    setVal('editCittaProvenienza', record.cittaProvenienza || record.citta || '');
    setVal('editTesseraVci', record.tesseraVci);
    setVal('editTesseraMotornext', record.tesseraMotornext);
    setVal('editEmail', record.email);
    setVal('editTelefono', record.telefono);
    setVal('editRuolo', record.ruolo || 'CONDUCENTE');
    setVal('editModelloVespa', record.modelloVespa);
    setVal('editAnnoVespa', record.annoVespa);
    setVal('editTagliaTshirt', record.tagliaTshirt);
    const modalitaEl = document.getElementById('editModalitaPartecipazione');
    if (modalitaEl && window.VespaPkg) {
      const currentMod = record.modalitaPartecipazione || '';
      const resolved = window.VespaPkg.resolvePackageFromRegistration(currentMod);
      const allPkgs = window.VespaPkg.PACKAGES;
      const config = window.VespaPkg.loadPackagesConfig();

      let optionsHtml = allPkgs.map(pkg => {
        const cfg = config.find(c => c.id === pkg.id) || { price: pkg.defaultPrice };
        const price = cfg.price;
        const val = `${pkg.id}|${pkg.label} - € ${price}`;
        const isSelected = resolved && resolved.id === pkg.id;
        return `<option value="${val}" ${isSelected ? 'selected' : ''}>${pkg.emoji} ${pkg.label} — € ${price}</option>`;
      }).join('');

      if (!resolved && currentMod) {
        optionsHtml = `<option value="${currentMod}" selected>⚠️ ${currentMod}</option>` + optionsHtml;
      }
      modalitaEl.innerHTML = optionsHtml;
    } else {
      setVal('editModalitaPartecipazione', record.modalitaPartecipazione);
    }
    setVal('editStatoPagamento', record.statoPagamento || 'NON_PAGATO');
    setVal('editNoteOrganizzatore', record.noteOrganizzatore || '');

    const setSelect = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.value = val ? 'true' : 'false';
    };
    const setTime = (elId, time) => {
      const el = document.getElementById(elId);
      if (el) el.textContent = time ? `Ore ${time}` : '';
    };

    setSelect('editAccettazioneSabato', record.statoAccettazioneSabato || record.accettazioneConclusa);
    setTime('editAccettazioneSabatoTime', record.accettazioneSabatoTimestamp || record.accettazioneTimestamp);

    setSelect('editAccettazioneDomenica', record.statoAccettazioneDomenica);
    setTime('editAccettazioneDomenicaTime', record.accettazioneDomenicaTimestamp);

    setSelect('editRitiroGadget', record.ritiroGadget || record.kitGadgetConsegnato);
    setTime('editRitiroGadgetTime', record.ritiroGadgetTimestamp);

    setSelect('editAperitivoSabato', record.aperitivoSabatoErogato);
    setTime('editAperitivoSabatoTime', record.aperitivoSabatoErogatoTimestamp);

    setSelect('editAperitivoDomenica', record.aperitivoDomenicaErogato);
    setTime('editAperitivoDomenicaTime', record.aperitivoDomenicaErogatoTimestamp);

    setSelect('editColazioneDomenica', record.colazioneDomenicaErogata);
    setTime('editColazioneDomenicaTime', record.colazioneDomenicaErogataTimestamp);

    setSelect('editCena', record.cena || record.cenaSabatoErogato);
    setTime('editCenaTime', record.cenaTimestamp);

    setSelect('editMerenda', record.merenda || record.merendaSabatoErogata);
    setTime('editMerendaTime', record.merendaTimestamp || record.merendaSabatoErogataTimestamp);

    setSelect('editPranzo', record.pranzo || record.pranzoDomenicaErogato);
    setTime('editPranzoTime', record.pranzoTimestamp);

    const payProofContainer = document.getElementById('editPayProofContainer');
    if (payProofContainer) {
      if (record.ricevutaPagamento && record.ricevutaPagamento.data) {
        payProofContainer.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; background:#F1F5F9; padding:0.5rem 1rem; border-radius:8px;">
            <span>📄 ${record.ricevutaPagamento.name || 'Ricevuta allegata'}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.vespaAdmin.viewPaymentProof('${record.id}')">
              👁️ Visualizza Ricevuta Allegata
            </button>
          </div>
        `;
      } else {
        payProofContainer.innerHTML = `<span style="color:var(--text-muted); font-size:0.85rem;">Nessun allegato presente. (Puoi comunque impostare lo stato PAGATO sopra).</span>`;
      }
    }
  }

  async openEditModal(id) {
    const record = await window.vespaDB.getById(id);
    if (!record) return;

    this.currentEditingId = id;
    this.populateEditModalFields(record);

    const modal = document.getElementById('editParticipantModal');
    if (modal) modal.style.display = 'flex';
  }

  closeEditModal() {
    const modal = document.getElementById('editParticipantModal');
    if (modal) modal.style.display = 'none';
    this.currentEditingId = null;
  }

  async saveEditModal() {
    if (!this.currentEditingId) {
      window.app.showToast('Errore: nessuna registrazione selezionata per la modifica.', 'error');
      return;
    }

    // Visual feedback: disabilita il pulsante durante il salvataggio
    const saveBtn = document.querySelector('#editParticipantModal .btn-primary');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ Salvataggio in corso...';
    }

    try {
      if (window.vespaDB) {
        await window.vespaDB.ensureInit();
      }

      const record = await window.vespaDB.getById(this.currentEditingId);
      if (!record) {
        throw new Error(`Registrazione ${this.currentEditingId} non trovata nel database.`);
      }

      // Legge tutti i campi del modulo
      const cognomeEl = document.getElementById('editCognome');
      const nomeEl = document.getElementById('editNome');
      const clubEl = document.getElementById('editVespaClub');
      const cittaEl = document.getElementById('editCittaProvenienza');
      const vciEl = document.getElementById('editTesseraVci');
      const mnEl = document.getElementById('editTesseraMotornext');
      const emailEl = document.getElementById('editEmail');
      const telEl = document.getElementById('editTelefono');
      const ruoloEl = document.getElementById('editRuolo');
      const modelloEl = document.getElementById('editModelloVespa');
      const annoEl = document.getElementById('editAnnoVespa');
      const tagliaEl = document.getElementById('editTagliaTshirt');
      const modalitaEl = document.getElementById('editModalitaPartecipazione');
      const pagamentoEl = document.getElementById('editStatoPagamento');
      const noteEl = document.getElementById('editNoteOrganizzatore');

      if (!cognomeEl || !nomeEl) {
        throw new Error('Campi del modulo non trovati. Ricarica la pagina.');
      }

      // Aggiorna il record con i valori dal modulo
      record.cognome = cognomeEl.value.trim().toUpperCase();
      record.nome = nomeEl.value.trim();
      record.vespaClub = clubEl ? clubEl.value.trim() : record.vespaClub;
      record.cittaProvenienza = cittaEl ? cittaEl.value.trim() : (record.cittaProvenienza || '');
      record.tesseraVci = vciEl ? vciEl.value.trim() : record.tesseraVci;
      record.tesseraMotornext = mnEl ? mnEl.value.trim() : record.tesseraMotornext;
      record.email = emailEl ? emailEl.value.trim() : record.email;
      record.telefono = telEl ? telEl.value.trim() : record.telefono;
      record.ruolo = ruoloEl ? ruoloEl.value : record.ruolo;
      record.modelloVespa = modelloEl ? modelloEl.value.trim() : record.modelloVespa;
      record.annoVespa = annoEl ? annoEl.value : record.annoVespa;
      record.tagliaTshirt = tagliaEl ? tagliaEl.value : record.tagliaTshirt;
      const prevMod = record.modalitaPartecipazione;
      const newMod = modalitaEl ? modalitaEl.value : record.modalitaPartecipazione;
      record.modalitaPartecipazione = newMod;
      if (modalitaEl && newMod !== prevMod) {
        record.importoDovuto = window.VespaPkg ? window.VespaPkg.getPriceForRegistration(newMod) : VespaDB.getPriceForMode(newMod);
      } else {
        record.importoDovuto = record.importoDovuto || (window.VespaPkg ? window.VespaPkg.getPriceForRegistration(newMod) : VespaDB.getPriceForMode(newMod));
      }
      record.statoPagamento = pagamentoEl ? pagamentoEl.value : record.statoPagamento;
      record.ricevutaPagamentoVerified = (record.statoPagamento === 'PAGATO');
      record.noteOrganizzatore = noteEl ? noteEl.value.trim() : record.noteOrganizzatore;

      // Aggiorna i servizi dalla scheda del partecipante
      const nowTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      const sabEl = document.getElementById('editAccettazioneSabato');
      if (sabEl) {
        const sabVal = sabEl.value === 'true';
        if (sabVal !== !!record.statoAccettazioneSabato) {
          record.statoAccettazioneSabato = sabVal;
          record.accettazioneSabatoTimestamp = sabVal ? nowTime : null;
          if (sabVal) record.accettazioneConclusa = true;
        }
      }

      const domEl = document.getElementById('editAccettazioneDomenica');
      if (domEl) {
        const domVal = domEl.value === 'true';
        if (domVal !== !!record.statoAccettazioneDomenica) {
          record.statoAccettazioneDomenica = domVal;
          record.accettazioneDomenicaTimestamp = domVal ? nowTime : null;
        }
      }

      const gadEl = document.getElementById('editRitiroGadget');
      if (gadEl) {
        const gadVal = gadEl.value === 'true';
        if (gadVal !== !!record.ritiroGadget) {
          record.ritiroGadget = gadVal;
          record.kitGadgetConsegnato = gadVal;
          record.ritiroGadgetTimestamp = gadVal ? nowTime : null;
        }
      }

      const apeSabEl = document.getElementById('editAperitivoSabato');
      if (apeSabEl) {
        const apeSabVal = apeSabEl.value === 'true';
        if (apeSabVal !== !!record.aperitivoSabatoErogato) {
          record.aperitivoSabatoErogato = apeSabVal;
          record.aperitivoSabatoErogatoTimestamp = apeSabVal ? nowTime : null;
        }
      }

      const apeDomEl = document.getElementById('editAperitivoDomenica');
      if (apeDomEl) {
        const apeDomVal = apeDomEl.value === 'true';
        if (apeDomVal !== !!record.aperitivoDomenicaErogato) {
          record.aperitivoDomenicaErogato = apeDomVal;
          record.aperitivoDomenicaErogatoTimestamp = apeDomVal ? nowTime : null;
        }
      }

      const colDomEl = document.getElementById('editColazioneDomenica');
      if (colDomEl) {
        const colDomVal = colDomEl.value === 'true';
        if (colDomVal !== !!record.colazioneDomenicaErogata) {
          record.colazioneDomenicaErogata = colDomVal;
          record.colazioneDomenicaErogataTimestamp = colDomVal ? nowTime : null;
        }
      }

      const cenEl = document.getElementById('editCena');
      if (cenEl) {
        const cenVal = cenEl.value === 'true';
        if (cenVal !== !!record.cena) {
          record.cena = cenVal;
          record.cenaSabatoErogato = cenVal;
          record.cenaSabatoErogatoTimestamp = cenVal ? nowTime : null;
          record.cenaTimestamp = cenVal ? nowTime : null;
        }
      }

      const merEl = document.getElementById('editMerenda');
      if (merEl) {
        const merVal = merEl.value === 'true';
        if (merVal !== !!(record.merenda || record.merendaSabatoErogata)) {
          record.merenda = merVal;
          record.merendaSabatoErogata = merVal;
          record.merendaTimestamp = merVal ? nowTime : null;
          record.merendaSabatoErogataTimestamp = merVal ? nowTime : null;
        }
      }

      const praEl = document.getElementById('editPranzo');
      if (praEl) {
        const praVal = praEl.value === 'true';
        if (praVal !== !!record.pranzo) {
          record.pranzo = praVal;
          record.pranzoDomenicaErogato = praVal;
          record.pranzoTimestamp = praVal ? nowTime : null;
        }
      }

      // Salva nel database
      await window.vespaDB.saveRegistration(record);

      window.app.showToast(`✅ Registrazione di ${record.cognome} ${record.nome} salvata con successo!`, 'success');
      this.closeEditModal();

      // Aggiorna la tabella se siamo nella dashboard
      if (typeof this.refreshData === 'function') {
        await this.refreshData();
      }

      if (window.vespaScanner && window.vespaScanner.currentParticipant &&
          window.vespaScanner.currentParticipant.id === record.id) {
        window.vespaScanner.currentParticipant = record;
        if (typeof window.vespaScanner.renderEntitlementsCard === 'function') {
          window.vespaScanner.renderEntitlementsCard(record);
        }
      }

    } catch (err) {
      console.error('[saveEditModal] Errore durante il salvataggio:', err);
      window.app.showToast(`❌ Errore salvataggio: ${err.message}`, 'error');
    } finally {
      // Ripristina il pulsante
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }
  }

  async viewReceipt(id) {
    this.currentReceiptId = id;
    const record = await window.vespaDB.getById(id);
    if (!record) {
      window.app.showToast('Partecipante non trovato.', 'error');
      return;
    }

    const modal = document.getElementById('receiptModal');
    if (!modal) return;

    // Aggiorna riepilogo
    const nameEl = document.getElementById('receiptModalName');
    const idEl = document.getElementById('receiptModalId');
    const clubEl = document.getElementById('receiptModalClub');
    const amountEl = document.getElementById('receiptModalAmount');
    const statusEl = document.getElementById('receiptModalStatus');

    if (nameEl) nameEl.textContent = `${record.cognome} ${record.nome} (${record.ruolo})`;
    if (idEl) idEl.textContent = record.id;
    if (clubEl) clubEl.textContent = record.vespaClub;
    const price = record.importoDovuto || VespaDB.getPriceForMode(record.modalitaPartecipazione);
    if (amountEl) amountEl.textContent = `€ ${price} - ${record.modalitaPartecipazione.split('-')[0].trim()}`;

    let statusHtml = '';
    if (record.statoPagamento === 'PAGATO') {
      statusHtml = '<span class="badge badge-success" style="font-size:0.85rem;">✅ PAGATO</span>';
    } else if (record.statoPagamento === 'RICEVUTA_DA_VERIFICARE') {
      statusHtml = '<span class="badge badge-warning" style="font-size:0.85rem;">📙 DA VERIFICARE</span>';
    } else {
      statusHtml = '<span class="badge badge-danger" style="font-size:0.85rem;">❌ NON PAGATO</span>';
    }
    if (statusEl) statusEl.innerHTML = statusHtml;

    // Container ricevuta
    const container = document.getElementById('receiptContentContainer');
    const actionsContainer = document.getElementById('receiptFileActions');
    if (container) container.innerHTML = '';
    if (actionsContainer) actionsContainer.innerHTML = '';

    if (record.ricevutaPagamento && record.ricevutaPagamento.data) {
      const { name, type, data } = record.ricevutaPagamento;

      if (actionsContainer) {
        actionsContainer.innerHTML = `
          <button type="button" class="btn btn-primary btn-sm" onclick="window.vespaAdmin.downloadReceiptFile('${record.id}')" style="display:inline-flex; align-items:center; gap:0.4rem;">
            📥 Scarica File Ricevuta (${name || 'allegato'})
          </button>
        `;
      }

      if (container) {
        if (type && type.includes('pdf')) {
          container.innerHTML = `
            <div style="width:100%; height:100%; min-height:420px; display:flex; flex-direction:column;">
              <div style="color:#FFF; font-size:0.85rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
                <span>📄 Documento Ricevuta Bonifico: <strong>${name}</strong></span>
                <button type="button" onclick="window.vespaAdmin.openReceiptInNewTab('${record.id}')" style="background:transparent; border:none; color:#60A5FA; text-decoration:underline; font-weight:700; cursor:pointer; font-size:0.88rem; padding:0;">
                  Apri PDF in nuova scheda ↗
                </button>
              </div>
              <iframe src="${data}" style="width:100%; height:400px; border:none; border-radius:8px; background:#FFF;" title="Ricevuta PDF"></iframe>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div style="text-align:center; max-height:460px; overflow-y:auto; width:100%;">
              <div style="color:#FFF; font-size:0.85rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
                <span>🖼️ File Immagine Ricevuta: <strong>${name || 'ricevuta_bonifico.png'}</strong></span>
                <button type="button" onclick="window.vespaAdmin.openReceiptInNewTab('${record.id}')" style="background:transparent; border:none; color:#60A5FA; text-decoration:underline; font-size:0.85rem; font-weight:700; cursor:pointer; padding:0;">
                  Visualizza Immagine ↗
                </button>
              </div>
              <img src="${data}" alt="Ricevuta di Pagamento" style="max-width:100%; max-height:360px; object-fit:contain; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.5); background:#FFF;" />
            </div>
          `;
        }
      }
    } else {
      if (container) {
        container.innerHTML = `
          <div style="text-align:center; padding:2.5rem 1rem; color:#94A3B8;">
            <div style="font-size:3.5rem; margin-bottom:0.75rem;">📂</div>
            <h3 style="color:#FFF; margin-bottom:0.5rem; font-size:1.2rem;">Nessuna Ricevuta Allegata</h3>
            <p style="font-size:0.9rem; max-width:460px; margin:0 auto 1.25rem auto; line-height:1.5; color:#CBD5E1;">
              Il partecipante non ha allegato un file durante la registrazione (potrebbe pagare in contanti all'accettazione o avere inviato il bonifico tramite altri canali).
            </p>
            <span class="badge badge-info" style="font-size:0.85rem; padding:0.4rem 0.9rem;">
              Puoi verificare il conto del Club e contrassegnare la quota come Pagata qui sotto.
            </span>
          </div>
        `;
      }
    }

    modal.style.display = 'flex';
  }

  closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.style.display = 'none';
    this.currentReceiptId = null;
  }

  async setPaymentFromModal(newStatus) {
    if (!this.currentReceiptId) return;
    try {
      await window.vespaDB.setPaymentStatus(this.currentReceiptId, newStatus);
      const statoText = newStatus === 'PAGATO' ? 'PAGATO' : (newStatus === 'RICEVUTA_DA_VERIFICARE' ? 'DA VERIFICARE' : 'NON PAGATO');
      window.app.showToast(`Stato pagamento aggiornato a: ${statoText}`, 'success');
      this.closeReceiptModal();
      await this.refreshData();
    } catch (err) {
      console.error(err);
      window.app.showToast('Errore durante l\'aggiornamento del pagamento', 'error');
    }
  }

  // Helper per convertire un dataURI (base64 o testo/url-encoded come SVG) in Blob nativo
  dataURItoBlob(dataURI, defaultType = 'application/pdf') {
    if (!dataURI) return null;
    const parts = dataURI.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const data = parts.slice(1).join(',');
    
    // Rileva mime type
    let mimeType = defaultType;
    const mimeMatch = header.match(/:(.*?);/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    } else {
      const mimeMatchEnd = header.match(/:(.*)$/);
      if (mimeMatchEnd) mimeType = mimeMatchEnd[1];
    }

    const isBase64 = header.includes(';base64');
    if (isBase64) {
      const byteCharacters = atob(data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } else {
      // Testo o URL encoded (es. SVG)
      let decoded = '';
      try {
        decoded = decodeURIComponent(data);
      } catch (e) {
        decoded = data;
      }
      return new Blob([decoded], { type: mimeType });
    }
  }

  // Apertura sicura del file ricevuta in una nuova scheda senza blocco dei browser su data: URI
  async openReceiptInNewTab(id) {
    if (!id) return;
    try {
      if (window.vespaDB) await window.vespaDB.ensureInit();
      const record = await window.vespaDB.getById(id);
      if (!record || !record.ricevutaPagamento || !record.ricevutaPagamento.data) {
        if (window.app && window.app.showToast) {
          window.app.showToast('Nessun file di ricevuta disponibile.', 'error');
        } else {
          alert('Nessun file di ricevuta disponibile.');
        }
        return;
      }

      const { name, type, data } = record.ricevutaPagamento;
      const effectiveType = type || (name && name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');

      // Converti in Blob URL nativo per bypassare il blocco di Chrome/Firefox/Edge su schede aperte con 'data:'
      try {
        const blob = this.dataURItoBlob(data, effectiveType);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const newTab = window.open(blobUrl, '_blank');
          if (!newTab) {
            window.location.href = blobUrl;
          }
          return;
        }
      } catch (blobErr) {
        console.warn('Conversione Blob fallita, fallback su finestra visualizzatore HTML:', blobErr);
      }

      // Fallback: visualizzatore iframe/img in nuova scheda se createObjectURL non disponibile
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>${name || 'Ricevuta Pagamento'}</title>
              <style>
                body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #0F172A; display: flex; flex-direction: column; }
                header { background: #1E293B; color: #FFF; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; font-family: sans-serif; }
                .btn { background: #2563EB; color: #FFF; padding: 6px 14px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; }
                .content { flex: 1; width: 100%; height: calc(100% - 50px); display: flex; justify-content: center; align-items: center; }
                iframe, img, object { width: 100%; height: 100%; border: none; }
                img { max-width: 90%; max-height: 90%; object-fit: contain; }
              </style>
            </head>
            <body>
              <header>
                <div><strong>📄 Ricevuta:</strong> ${name || 'Documento'}</div>
                <a class="btn" href="${data}" download="${name || 'ricevuta'}">📥 Scarica File</a>
              </header>
              <div class="content">
                ${effectiveType.includes('pdf') 
                  ? `<iframe src="${data}"></iframe>` 
                  : `<img src="${data}" alt="Ricevuta">`}
              </div>
            </body>
          </html>
        `);
        newWin.document.close();
      }
    } catch (err) {
      console.error('Errore durante l\'apertura della ricevuta:', err);
      if (window.app && window.app.showToast) {
        window.app.showToast('Impossibile aprire la ricevuta.', 'error');
      }
    }
  }

  // Download diretto del file della ricevuta
  async downloadReceiptFile(id) {
    if (!id) return;
    try {
      if (window.vespaDB) await window.vespaDB.ensureInit();
      const record = await window.vespaDB.getById(id);
      if (!record || !record.ricevutaPagamento || !record.ricevutaPagamento.data) {
        if (window.app && window.app.showToast) {
          window.app.showToast('Nessun file di ricevuta disponibile per il download.', 'error');
        }
        return;
      }

      const { name, type, data } = record.ricevutaPagamento;
      const effectiveType = type || (name && name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');
      const filename = name || `ricevuta_${record.cognome || 'iscritto'}_${record.id || 'doc'}.${effectiveType.includes('pdf') ? 'pdf' : 'png'}`;

      try {
        const blob = this.dataURItoBlob(data, effectiveType);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          return;
        }
      } catch (blobErr) {
        console.warn('Download Blob fallito, fallback su link dataURI:', blobErr);
      }

      const link = document.createElement('a');
      link.href = data;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Errore download ricevuta:', err);
    }
  }


  // Stampa Badge / Pass Formato VCARD Standard Europeo (85 x 55 mm)
  async printVCard(id) {
    if (!id) return;
    try {
      if (window.vespaDB) await window.vespaDB.ensureInit();
      const record = await window.vespaDB.getById(id);
      if (!record) {
        if (window.app && window.app.showToast) {
          window.app.showToast('Partecipante non trovato.', 'error');
        } else {
          alert('Partecipante non trovato.');
        }
        return;
      }

      // Ricava dati per la card
      const modeStr = record.modalitaPartecipazione || '';
      const price = record.importoDovuto || (window.VespaDB ? VespaDB.getPriceForMode(modeStr) : 55);
      const isPaid = (record.statoPagamento === 'PAGATO');
      const payStatusText = isPaid ? 'PAGATO' : (record.statoPagamento === 'RICEVUTA_DA_VERIFICARE' ? 'RICEVUTA IN VERIFICA' : 'NON PAGATO');
      const payColor = isPaid ? '#16A34A' : '#DC2626';

      // Risolvi pacchetto tramite VespaPkg (canonico)
      const pkg = window.VespaPkg ? window.VespaPkg.resolvePackageFromRegistration(modeStr) : null;
      const hasSabato   = pkg ? pkg.includesSabato   : (modeStr.includes('SABATO') || modeStr.includes('FULL 2 GIORNI') || modeStr.includes('COMPLETA'));
      const hasDomenica = pkg ? pkg.includesDomenica  : (modeStr.includes('DOMENICA') || modeStr.includes('FULL 2 GIORNI') || modeStr.includes('COMPLETA'));
      const hasSvc = (key) => pkg ? (pkg.services || []).includes(key) : true;

      // Costruisci lista servizi inclusi nel pacchetto (Sabato → Domenica → Gadget)
      const serviceItems = [];
      if (hasSabato)                                    serviceItems.push({ emoji: '🌅', label: 'Acc. Sabato',    color: '#0891b2' });
      if (hasSabato && hasSvc('merendaSabato'))         serviceItems.push({ emoji: '🥐', label: 'Merenda Sab',   color: '#d97706' });
      if (hasSabato && hasSvc('aperitivoSabato'))       serviceItems.push({ emoji: '🍹', label: 'Aperitivo Sab', color: '#7c3aed' });
      if (hasSabato && hasSvc('cenaSabato'))            serviceItems.push({ emoji: '🍝', label: 'Cena Sab',      color: '#dc2626' });
      if (hasDomenica)                                  serviceItems.push({ emoji: '🌄', label: 'Acc. Domenica', color: '#059669' });
      if (hasDomenica && hasSvc('colazioneDomenica'))   serviceItems.push({ emoji: '☕', label: 'Colazione Dom', color: '#b45309' });
      if (hasDomenica && hasSvc('aperitivoDomenica'))   serviceItems.push({ emoji: '🥂', label: 'Aperitivo Dom', color: '#7c3aed' });
      if (hasDomenica && hasSvc('pranzo'))              serviceItems.push({ emoji: '🍽️', label: 'Pranzo Dom',    color: '#16a34a' });
      serviceItems.push({ emoji: '🎁', label: 'Kit Gadget', color: '#0284c7' });

      const servicesBadgesHtml = serviceItems.map(s =>
        `<span style="display:inline-flex; align-items:center; gap:2px; background:${s.color}18; color:${s.color}; border:1px solid ${s.color}40; border-radius:4px; padding:1px 5px; font-size:6.5px; font-weight:800; white-space:nowrap;">${s.emoji} ${s.label}</span>`
      ).join(' ');

      const safeCognome = (record.cognome || 'PARTECIPANTE').toUpperCase();
      const safeNome = (record.nome || '').trim();
      const club = (record.vespaClub || 'Vespa Club Asti').trim();
      const tVci = record.tesseraVci || '-';
      const tMn = record.tesseraMotornext || '-';
      const ruolo = (record.ruolo || 'CONDUCENTE').toUpperCase();
      const vespaMod = record.modelloVespa ? `${record.modelloVespa} (${record.annoVespa || '-'})` : '-';
      const tshirt = record.tagliaTshirt ? `T-Shirt: ${record.tagliaTshirt}` : '';
      const shortMode = modeStr ? modeStr.split('-')[0].trim() : 'FULL';

      // QR Data e API fallback con margine bianco
      const qrData = record.id;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(qrData)}`;

      // Crea finestra popup per la stampa isolata in formato esatto 85x55 mm
      const win = window.open('', '_blank', 'width=600,height=500');
      if (!win) {
        alert("Attenzione: il browser ha bloccato il popup di stampa. Abilita i popup per stampare la VCARD.");
        return;
      }

      win.document.write(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>VCARD Pass - ${record.id} - ${safeCognome}</title>
  <style>
    /* Dimensioni standard ISO/IEC 7810 ID-1 / VCARD: 85mm x 55mm */
    @page {
      size: 85mm 55mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 85mm;
      height: 55mm;
      background: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      overflow: hidden;
    }

    .vcard-container {
      width: 85mm;
      height: 55mm;
      padding: 2.2mm 2.8mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid #CBD5E1;
      background: #FFFFFF;
      position: relative;
    }

    /* Testata */
    .vcard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #005A9C;
      padding-bottom: 1.2mm;
    }

    .vcard-brand {
      display: flex;
      align-items: center;
      gap: 1.5mm;
    }

    .vcard-logo {
      width: 8mm;
      height: 8mm;
      object-fit: contain;
    }

    .vcard-club-name {
      font-size: 8.5px;
      font-weight: 900;
      color: #005A9C;
      letter-spacing: 0.3px;
      line-height: 1.1;
    }

    .vcard-club-sub {
      font-size: 6.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }

    .vcard-id-pill {
      background: #005A9C;
      color: #FFFFFF;
      font-family: monospace;
      font-size: 8.5px;
      font-weight: 900;
      padding: 1.2px 4mm;
      border-radius: 3px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    /* Corpo centrale a 2 colonne: Dati (60mm) + QR Code (22mm) */
    .vcard-body {
      display: flex;
      gap: 2mm;
      align-items: center;
      flex: 1;
      margin: 1.2mm 0;
    }

    .vcard-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
    }

    .vcard-name {
      font-size: 11px;
      font-weight: 900;
      color: #0F172A;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .vcard-club-user {
      font-size: 7.5px;
      font-weight: 800;
      color: #1E3A8A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.1;
    }

    .vcard-grid-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6mm 1.5mm;
      font-size: 6.5px;
      line-height: 1.15;
      margin-top: 0.4mm;
    }

    .vcard-meta-item strong {
      color: #475569;
      font-weight: 700;
    }

    .vcard-package-row {
      font-size: 7px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.15;
      background: #F1F5F9;
      padding: 1px 3px;
      border-radius: 3px;
      margin-top: 0.4mm;
    }

    /* Colonna QR Code */
    .vcard-qr-box {
      width: 22mm;
      height: 22mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 0.8mm;
    }

    .vcard-qr-img {
      width: 20mm;
      height: 20mm;
      display: block;
    }

    /* Footer: banchi & stato pagamento */
    .vcard-footer {
      border-top: 1px dashed #CBD5E1;
      padding-top: 1mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5mm;
    }

    .vcard-services {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5px;
      flex: 1;
    }

    .vcard-pay-badge {
      font-size: 7px;
      font-weight: 900;
      color: ${payColor};
      border: 1px solid ${payColor};
      padding: 1px 3.5px;
      border-radius: 3px;
      white-space: nowrap;
    }

    @media screen {
      body {
        background: #E2E8F0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        width: 100vw;
        gap: 12px;
        padding: 20px;
      }
      .vcard-container {
        box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        border-radius: 8px;
      }
      .screen-actions {
        display: flex;
        gap: 10px;
      }
      .screen-btn {
        background: #005A9C;
        color: #FFF;
        font-weight: 800;
        font-size: 13px;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
      }
    }
    @media print {
      .screen-actions {
        display: none !important;
      }
      .vcard-container {
        border: 1px solid #94A3B8;
      }
    }
  </style>
</head>
<body>
  <div class="screen-actions">
    <button class="screen-btn" onclick="window.print()">🖨️ Stampa VCARD (85 × 55 mm)</button>
    <button class="screen-btn" onclick="window.close()" style="background:#64748B;">✕ Chiudi</button>
  </div>

  <div class="vcard-container">
    <!-- Testata -->
    <div class="vcard-header">
      <div class="vcard-brand">
        <img src="https://primary.jwwb.nl/public/s/q/g/temp-ycombtvaxsaviqalrdpe/nuovo-frecce-high.png" alt="Logo" class="vcard-logo">
        <div>
          <div class="vcard-club-name">VESPA CLUB ASTI A.s.D.</div>
          <div class="vcard-club-sub">Pass Raduno Nazionale</div>
        </div>
      </div>
      <div class="vcard-id-pill">${record.id}</div>
    </div>

    <!-- Centro Dati + QR -->
    <div class="vcard-body">
      <div class="vcard-details">
        <div class="vcard-name">${safeCognome} ${safeNome}</div>
        <div class="vcard-club-user">🛵 ${club}${record.cittaProvenienza ? ` • 📍 ${record.cittaProvenienza}` : ''}</div>

        <div class="vcard-grid-meta">
          <div class="vcard-meta-item"><strong>Ruolo:</strong> ${ruolo}</div>
          <div class="vcard-meta-item"><strong>VCI:</strong> ${tVci}</div>
          <div class="vcard-meta-item"><strong>Motornext:</strong> ${tMn}</div>
          <div class="vcard-meta-item"><strong>${tshirt || 'Taglia: N/D'}</strong></div>
          <div class="vcard-meta-item" style="grid-column: 1 / -1;"><strong>Vespa:</strong> ${vespaMod}</div>
        </div>

        <div class="vcard-package-row">
          🎫 ${shortMode} (€ ${price})
        </div>
      </div>

      <!-- QR Box -->
      <div class="vcard-qr-box">
        <img src="${qrApiUrl}" alt="QR" class="vcard-qr-img">
      </div>
    </div>

    <!-- Footer Banchi + Pagamento -->
    <div class="vcard-footer">
      <div class="vcard-services">
        ${servicesBadgesHtml}
      </div>
      <div class="vcard-pay-badge">${payStatusText}</div>
    </div>
  </div>

  <script>
    // Trigger stampa automatico
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 350);
    });
  <\/script>
</body>
</html>`);

      win.document.close();

    } catch (err) {
      console.error('[printVCard] Errore stampa VCARD:', err);
      if (window.app && window.app.showToast) {
        window.app.showToast('Errore durante la generazione della VCARD: ' + err.message, 'error');
      } else {
        alert('Errore durante la generazione della VCARD: ' + err.message);
      }
    }
  }

  // Gestione Tab Classifiche Raduno
  switchRankingTab(tabName) {
    this.activeRankingTab = tabName;
    const tabs = [
      { id: 'tabBtnOldest', key: 'oldest' },
      { id: 'tabBtnDistance', key: 'distance' },
      { id: 'tabBtnClub', key: 'club' }
    ];

    tabs.forEach(t => {
      const btn = document.getElementById(t.id);
      if (btn) {
        if (t.key === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    this.renderRankings();
  }

  // Filtro Club per le Classifiche
  filterRankingsByClub(clubName) {
    this.rankingClubFilter = clubName;
    this.renderRankings();
  }

  populateRankingClubsFilter() {
    const select = document.getElementById('rankingClubFilter');
    if (!select) return;

    const currentVal = this.rankingClubFilter || 'ALL';
    const clubs = [...new Set(this.allRegistrations.map(r => (r.vespaClub || '').trim()).filter(Boolean))].sort();

    select.innerHTML = '<option value="ALL">🌟 Tutti i Vespa Club</option>' +
      clubs.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
  }

  renderRankings() {
    const tableHead = document.getElementById('rankingTableHead');
    const tableBody = document.getElementById('rankingTableBody');
    const podiumContainer = document.getElementById('podiumContainer');

    if (!tableHead || !tableBody || !podiumContainer) return;

    let participants = [...this.allRegistrations];

    // Se c'è un filtro per Club attivo
    if (this.rankingClubFilter && this.rankingClubFilter !== 'ALL') {
      participants = participants.filter(r => (r.vespaClub || '').trim() === this.rankingClubFilter);
    }

    if (this.activeRankingTab === 'oldest') {
      this.renderOldestVespaRanking(participants, tableHead, tableBody, podiumContainer);
    } else if (this.activeRankingTab === 'distance') {
      this.renderDistanceRanking(participants, tableHead, tableBody, podiumContainer);
    } else if (this.activeRankingTab === 'club') {
      this.renderClubRanking(this.allRegistrations, tableHead, tableBody, podiumContainer);
    }
  }

  renderOldestVespaRanking(list, thead, tbody, podium) {
    // Filtra e ordina per annoVespa ASC (dal più vecchio al più recente)
    const valid = list
      .filter(r => r.annoVespa && parseInt(r.annoVespa, 10) > 1900)
      .sort((a, b) => {
        const diff = parseInt(a.annoVespa, 10) - parseInt(b.annoVespa, 10);
        if (diff !== 0) return diff;
        return a.cognome.localeCompare(b.cognome);
      });

    // Podio (Top 3)
    const top3 = valid.slice(0, 3);
    if (top3.length > 0) {
      podium.innerHTML = `
        <div class="podium-grid">
          ${top3[0] ? `
            <div class="podium-card first">
              <div class="podium-rank">🥇 1° Posto</div>
              <div class="podium-title">${top3[0].modelloVespa}</div>
              <div class="podium-subtitle">Anno Immatricolazione: <strong>${top3[0].annoVespa}</strong><br>${top3[0].cognome} ${top3[0].nome} (${top3[0].vespaClub})</div>
              <div class="podium-metric">👑 Vespa d'Epoca più Antica</div>
            </div>
          ` : ''}
          ${top3[1] ? `
            <div class="podium-card second">
              <div class="podium-rank">🥈 2° Posto</div>
              <div class="podium-title">${top3[1].modelloVespa}</div>
              <div class="podium-subtitle">Anno Immatricolazione: <strong>${top3[1].annoVespa}</strong><br>${top3[1].cognome} ${top3[1].nome} (${top3[1].vespaClub})</div>
              <div class="podium-metric" style="background:#64748B;">🥈 2ª più Antica</div>
            </div>
          ` : ''}
          ${top3[2] ? `
            <div class="podium-card third">
              <div class="podium-rank">🥉 3° Posto</div>
              <div class="podium-title">${top3[2].modelloVespa}</div>
              <div class="podium-subtitle">Anno Immatricolazione: <strong>${top3[2].annoVespa}</strong><br>${top3[2].cognome} ${top3[2].nome} (${top3[2].vespaClub})</div>
              <div class="podium-metric" style="background:#B45309;">🥉 3ª più Antica</div>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      podium.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nessun partecipante trovato per il filtro selezionato.</div>';
    }

    thead.innerHTML = `
      <tr>
        <th style="width:70px; text-align:center;">POS.</th>
        <th>MODELLO VESPA</th>
        <th style="text-align:center;">ANNO IMMATRICOLAZIONE</th>
        <th>CONDUCENTE / PARTECIPANTE</th>
        <th>VESPA CLUB</th>
        <th style="text-align:center;">STATO PAGAMENTO</th>
        <th style="text-align:center;">ID PASS</th>
      </tr>
    `;

    if (valid.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Nessuna Vespa registrata trovata.</td></tr>';
      return;
    }

    tbody.innerHTML = valid.map((r, idx) => {
      let posBadge = `<span style="font-weight:900; color:var(--text-muted);">#${idx + 1}</span>`;
      if (idx === 0) posBadge = '<span style="font-size:1.3rem;">🥇</span>';
      else if (idx === 1) posBadge = '<span style="font-size:1.3rem;">🥈</span>';
      else if (idx === 2) posBadge = '<span style="font-size:1.3rem;">🥉</span>';

      let payBadge = '';
      if (r.statoPagamento === 'PAGATO') {
        payBadge = `<span class="badge badge-success clickable-badge" onclick="window.vespaAdmin.viewReceipt('${r.id}')" title="Clicca per visualizzare la ricevuta">✅ PAGATO</span>`;
      } else if (r.statoPagamento === 'RICEVUTA_DA_VERIFICARE') {
        payBadge = `<span class="badge badge-warning clickable-badge" onclick="window.vespaAdmin.viewReceipt('${r.id}')" title="Clicca per verificare la ricevuta">📎 Da Verificare</span>`;
      } else {
        payBadge = `<span class="badge badge-danger clickable-badge" onclick="window.vespaAdmin.viewReceipt('${r.id}')" title="Clicca per aprire">❌ Non Pagato</span>`;
      }

      return `
        <tr>
          <td style="text-align:center;">${posBadge}</td>
          <td><strong>${r.modelloVespa}</strong></td>
          <td style="text-align:center;"><span class="badge badge-warning" style="font-size:0.95rem; font-weight:900; background:#FEF3C7; color:#92400E; border:1px solid #FCD34D;">${r.annoVespa}</span></td>
          <td><strong>${r.cognome}</strong> ${r.nome} <span style="font-size:0.75rem; color:var(--text-dim);">(${r.ruolo})</span></td>
          <td>${r.vespaClub}</td>
          <td style="text-align:center;">${payBadge}</td>
          <td style="text-align:center;"><strong style="color:var(--vespa-blue); font-size:0.85rem;">${r.id}</strong></td>
        </tr>
      `;
    }).join('');
  }

  renderDistanceRanking(list, thead, tbody, podium) {
    // Calcola la distanza per ciascun partecipante basata sulla sua città di provenienza
    const enriched = list.map(r => {
      const originCity = (r.cittaProvenienza || r.citta || '').trim();
      const geo = getCityAndDistance(originCity, r.vespaClub);
      return {
        ...r,
        originCity: originCity || geo.city,
        city: geo.city,
        distance: geo.distance
      };
    }).sort((a, b) => {
      const diff = b.distance - a.distance; // Dal più lontano al più vicino
      if (diff !== 0) return diff;
      return a.cognome.localeCompare(b.cognome);
    });

    const top3 = enriched.slice(0, 3);
    if (top3.length > 0) {
      podium.innerHTML = `
        <div class="podium-grid">
          ${top3[0] ? `
            <div class="podium-card first">
              <div class="podium-rank">🥇 1° Posto</div>
              <div class="podium-title">${top3[0].distance} Km da Asti</div>
              <div class="podium-subtitle">📍 <strong>Città: ${top3[0].originCity}</strong><br>Partecipante: <strong>${top3[0].cognome} ${top3[0].nome}</strong> (${top3[0].vespaClub})<br><small style="color:var(--text-muted);">${top3[0].modelloVespa || ''}</small></div>
              <div class="podium-metric">📍 Provenienza più Lontana</div>
            </div>
          ` : ''}
          ${top3[1] ? `
            <div class="podium-card second">
              <div class="podium-rank">🥈 2° Posto</div>
              <div class="podium-title">${top3[1].distance} Km da Asti</div>
              <div class="podium-subtitle">📍 <strong>Città: ${top3[1].originCity}</strong><br>Partecipante: <strong>${top3[1].cognome} ${top3[1].nome}</strong> (${top3[1].vespaClub})<br><small style="color:var(--text-muted);">${top3[1].modelloVespa || ''}</small></div>
              <div class="podium-metric" style="background:#64748B;">🥈 2° per Distanza</div>
            </div>
          ` : ''}
          ${top3[2] ? `
            <div class="podium-card third">
              <div class="podium-rank">🥉 3° Posto</div>
              <div class="podium-title">${top3[2].distance} Km da Asti</div>
              <div class="podium-subtitle">📍 <strong>Città: ${top3[2].originCity}</strong><br>Partecipante: <strong>${top3[2].cognome} ${top3[2].nome}</strong> (${top3[2].vespaClub})<br><small style="color:var(--text-muted);">${top3[2].modelloVespa || ''}</small></div>
              <div class="podium-metric" style="background:#B45309;">🥉 3° per Distanza</div>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      podium.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nessun partecipante trovato.</div>';
    }

    thead.innerHTML = `
      <tr>
        <th style="width:70px; text-align:center;">POS.</th>
        <th>CONDUCENTE / PARTECIPANTE</th>
        <th>CITTÀ DI PROVENIENZA</th>
        <th style="text-align:center;">DISTANZA DA ASTI</th>
        <th>VESPA CLUB</th>
        <th>MODELLO VESPA</th>
        <th style="text-align:center;">STATO PAGAMENTO</th>
      </tr>
    `;

    if (enriched.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Nessun dato trovato.</td></tr>';
      return;
    }

    tbody.innerHTML = enriched.map((r, idx) => {
      let posBadge = `<span style="font-weight:900; color:var(--text-muted);">#${idx + 1}</span>`;
      if (idx === 0) posBadge = '<span style="font-size:1.3rem;">🥇</span>';
      else if (idx === 1) posBadge = '<span style="font-size:1.3rem;">🥈</span>';
      else if (idx === 2) posBadge = '<span style="font-size:1.3rem;">🥉</span>';

      let payBadge = '';
      if (r.statoPagamento === 'PAGATO') {
        payBadge = `<span class="badge badge-success clickable-badge" onclick="window.vespaAdmin.viewReceipt('${r.id}')" title="Clicca per visualizzare la ricevuta">✅ PAGATO</span>`;
      } else if (r.statoPagamento === 'RICEVUTA_DA_VERIFICARE') {
        payBadge = `<span class="badge badge-warning clickable-badge" onclick="window.vespaAdmin.viewReceipt('${r.id}')" title="Clicca per verificare la ricevuta">📎 Da Verificare</span>`;
      } else {
        payBadge = `<span class="badge badge-danger clickable-badge" onclick="window.vespaAdmin.viewReceipt('${r.id}')" title="Clicca per aprire">❌ Non Pagato</span>`;
      }

      return `
        <tr>
          <td style="text-align:center;">${posBadge}</td>
          <td><strong>${r.cognome}</strong> ${r.nome} <span style="font-size:0.75rem; color:var(--text-dim);">(${r.ruolo})</span></td>
          <td><span class="badge badge-info" style="font-weight:800; font-size:0.85rem;">📍 ${r.originCity}</span></td>
          <td style="text-align:center;"><strong style="color:var(--vespa-blue); font-size:1.05rem;">${r.distance} Km</strong></td>
          <td>${r.vespaClub}</td>
          <td>${r.modelloVespa || '-'} (${r.annoVespa || '-'})</td>
          <td style="text-align:center;">${payBadge}</td>
        </tr>
      `;
    }).join('');
  }

    // Metodo per cambiare l'ordinamento della classifica Vespa Club
  sortClubRanking(column) {
    if (this.clubRankingSortBy === column) {
      this.clubRankingSortAsc = !this.clubRankingSortAsc;
    } else {
      this.clubRankingSortBy = column;
      this.clubRankingSortAsc = false; // default desc (più iscritti o più lontano)
    }
    this.renderRankings();
  }

  renderClubRanking(allList, thead, tbody, podium) {
    // Raggruppa per Vespa Club
    const clubMap = {};
    allList.forEach(r => {
      const club = (r.vespaClub || 'Vespa Club Asti').trim();
      if (!clubMap[club]) {
        const geo = getCityAndDistance(club);
        clubMap[club] = {
          clubName: club,
          city: geo.city,
          distance: geo.distance,
          total: 0,
          conducenti: 0,
          passeggeri: 0,
          paidCount: 0
        };
      }
      clubMap[club].total++;
      if (r.ruolo === 'CONDUCENTE') clubMap[club].conducenti++;
      else if (r.ruolo === 'PASSEGGERO') clubMap[club].passeggeri++;
      if (r.statoPagamento === 'PAGATO') clubMap[club].paidCount++;
    });

    let clubs = Object.values(clubMap);

    // Se filtrato per club
    if (this.rankingClubFilter && this.rankingClubFilter !== 'ALL') {
      clubs = clubs.filter(c => c.clubName === this.rankingClubFilter);
    }

    // Ordinamento dinamico in base a distanza o iscritti totali
    const sortBy = this.clubRankingSortBy || 'total';
    const isAsc = !!this.clubRankingSortAsc;

    clubs.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'distance') {
        diff = isAsc ? (a.distance - b.distance) : (b.distance - a.distance);
        if (diff !== 0) return diff;
        return b.total - a.total;
      } else {
        // default 'total'
        diff = isAsc ? (a.total - b.total) : (b.total - a.total);
        if (diff !== 0) return diff;
        return b.distance - a.distance;
      }
    });

    const isDistSort = (sortBy === 'distance');
    const metricText = (c) => isDistSort
      ? `📍 ${c.distance} Km da Asti`
      : `👥 ${c.total} Partecipanti Iscritti`;

    const top3 = clubs.slice(0, 3);
    if (top3.length > 0) {
      podium.innerHTML = `
        <div class="podium-grid">
          ${top3[0] ? `
            <div class="podium-card first">
              <div class="podium-rank">🥇 1° Posto</div>
              <div class="podium-title">${top3[0].clubName}</div>
              <div class="podium-subtitle">Città: <strong>${top3[0].city}</strong> (${top3[0].distance} km da Asti)<br>${top3[0].conducenti} Conducenti, ${top3[0].passeggeri} Passeggeri • ${top3[0].total} Iscritti</div>
              <div class="podium-metric">${metricText(top3[0])}</div>
            </div>
          ` : ''}
          ${top3[1] ? `
            <div class="podium-card second">
              <div class="podium-rank">🥈 2° Posto</div>
              <div class="podium-title">${top3[1].clubName}</div>
              <div class="podium-subtitle">Città: <strong>${top3[1].city}</strong> (${top3[1].distance} km da Asti)<br>${top3[1].conducenti} Conducenti, ${top3[1].passeggeri} Passeggeri • ${top3[1].total} Iscritti</div>
              <div class="podium-metric" style="background:#64748B;">${metricText(top3[1])}</div>
            </div>
          ` : ''}
          ${top3[2] ? `
            <div class="podium-card third">
              <div class="podium-rank">🥉 3° Posto</div>
              <div class="podium-title">${top3[2].clubName}</div>
              <div class="podium-subtitle">Città: <strong>${top3[2].city}</strong> (${top3[2].distance} km da Asti)<br>${top3[2].conducenti} Conducenti, ${top3[2].passeggeri} Passeggeri • ${top3[2].total} Iscritti</div>
              <div class="podium-metric" style="background:#B45309;">${metricText(top3[2])}</div>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      podium.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nessun Vespa Club trovato per il filtro.</div>';
    }

    const distIndicator = (sortBy === 'distance') ? (isAsc ? ' ▲' : ' ▼') : ' ⇅';
    const totalIndicator = (sortBy === 'total') ? (isAsc ? ' ▲' : ' ▼') : ' ⇅';
    const distActiveStyle = (sortBy === 'distance') ? 'background:rgba(255,255,255,0.25); border-radius:6px; padding:3px 6px;' : '';
    const totalActiveStyle = (sortBy === 'total') ? 'background:rgba(255,255,255,0.25); border-radius:6px; padding:3px 6px;' : '';

    thead.innerHTML = `
      <tr>
        <th style="width:70px; text-align:center;">POS.</th>
        <th>VESPA CLUB</th>
        <th>CITTÀ CLUB</th>
        <th style="text-align:center; cursor:pointer; user-select:none;" onclick="window.vespaAdmin.sortClubRanking('distance')" title="Clicca per ordinare per distanza da Asti">
          <span style="${distActiveStyle}">DISTANZA DA ASTI <strong style="font-size:1.1rem; color:#FEF08A;">${distIndicator}</strong></span>
        </th>
        <th style="text-align:center; cursor:pointer; user-select:none;" onclick="window.vespaAdmin.sortClubRanking('total')" title="Clicca per ordinare per numero di iscritti totali">
          <span style="${totalActiveStyle}">ISCRITTI TOTALI <strong style="font-size:1.1rem; color:#FEF08A;">${totalIndicator}</strong></span>
        </th>
        <th style="text-align:center;">CONDUCENTI</th>
        <th style="text-align:center;">PASSEGGERI</th>
        <th style="text-align:center;">PAGAMENTI REGOLARIZZATI</th>
      </tr>
    `;

    if (clubs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nessun Vespa Club registrato.</td></tr>';
      return;
    }

    tbody.innerHTML = clubs.map((c, idx) => {
      let posBadge = `<span style="font-weight:900; color:var(--text-muted);">#${idx + 1}</span>`;
      if (idx === 0) posBadge = '<span style="font-size:1.3rem;">🥇</span>';
      else if (idx === 1) posBadge = '<span style="font-size:1.3rem;">🥈</span>';
      else if (idx === 2) posBadge = '<span style="font-size:1.3rem;">🥉</span>';

      return `
        <tr>
          <td style="text-align:center;">${posBadge}</td>
          <td><strong style="color:var(--vespa-blue-dark); font-size:1.02rem;">${c.clubName}</strong></td>
          <td><span class="badge badge-info">${c.city}</span></td>
          <td style="text-align:center;"><strong>${c.distance} Km</strong></td>
          <td style="text-align:center;"><span class="badge badge-success" style="font-weight:900; font-size:0.95rem; padding:0.35rem 0.8rem;">${c.total} iscritti</span></td>
          <td style="text-align:center;"><strong>${c.conducenti}</strong></td>
          <td style="text-align:center;"><strong>${c.passeggeri}</strong></td>
          <td style="text-align:center;"><span class="badge badge-info">${c.paidCount} / ${c.total}</span></td>
        </tr>
      `;
    }).join('');
  }
}

// Database chilometrico ufficiale da Asti per città Vespa Club
const CITY_DISTANCES_FROM_ASTI = {
  'Asti': 0,
  'Alfieri Asti': 0,
  'Canelli': 30,
  'Alba': 32,
  'Alessandria': 36,
  'Bra': 42,
  'Carmagnola': 46,
  'Chieri': 48,
  'Casale Monferrato': 49,
  'Moncalieri': 52,
  'Torino': 56,
  'Acqui Terme': 58,
  'Settimo Torinese': 62,
  'Rivoli': 68,
  'Pinerolo': 75,
  'Vigevano': 76,
  'Vercelli': 78,
  'Cuneo': 88,
  'Pavia': 94,
  'Novara': 102,
  'Ivrea': 104,
  'Biella': 108,
  'Savona': 112,
  'Genova': 118,
  'Milano': 128,
  'Lodi': 130,
  'Piacenza': 135,
  'Monza': 142,
  'Varese': 145,
  'Verbania': 155,
  'Cremona': 155,
  'Imperia': 158,
  'Como': 160,
  'Aosta': 165,
  'Bergamo': 175,
  'Lecco': 175,
  'Sanremo': 180,
  'Parma': 185,
  'Brescia': 195,
  'La Spezia': 210,
  'Reggio Emilia': 210,
  'Mantova': 225,
  'Modena': 235,
  'Verona': 245,
  'Bologna': 280,
  'Pisa': 285,
  'Livorno': 295,
  'Vicenza': 295,
  'Ferrara': 310,
  'Padova': 325,
  'Trento': 335,
  'Ravenna': 355,
  'Venezia': 360,
  'Firenze': 360,
  'Treviso': 370,
  'Rimini': 390,
  'Bolzano': 390,
  'Siena': 415,
  'Trieste': 475,
  'Ancona': 490,
  'Perugia': 510,
  'Roma': 620,
  'Cagliari': 720,
  'Napoli': 810,
  'Bari': 950,
  'Palermo': 1380,
  // Città europee (distanze stradali approssimative da Asti in km)
  // Francia
  'Nizza': 195,
  'Nice': 195,
  'Monaco': 220,
  'Cannes': 240,
  'Marsiglia': 420,
  'Marseille': 420,
  'Tolone': 390,
  'Toulon': 390,
  'Montpellier': 530,
  'Lione': 310,
  'Lyon': 310,
  'Grenoble': 230,
  'Chambery': 195,
  'Annecy': 215,
  'Perpignan': 680,
  'Bordeaux': 900,
  'Toulouse': 760,
  'Nantes': 1100,
  'Paris': 1050,
  'Parigi': 1050,
  'Strasburgo': 650,
  'Strasbourg': 650,
  'Lilla': 1050,
  'Lille': 1050,
  // Svizzera
  'Lugano': 115,
  'Locarno': 135,
  'Bellinzona': 120,
  'Ginevra': 275,
  'Geneva': 275,
  'Geneve': 275,
  'Losanna': 250,
  'Lausanne': 250,
  'Berna': 310,
  'Berne': 310,
  'Zurigo': 350,
  'Zurich': 350,
  'Basilea': 400,
  'Basel': 400,
  'Lucerna': 365,
  'Lucerne': 365,
  'Friburgo': 335,
  'Fribourg': 335,
  'San Gallo': 425,
  'St. Gallen': 425,
  // Germania
  'Monaco di Baviera': 530,
  'Monaco di Baviera (Germania)': 530,
  'Munich': 530,
  'Muenchen': 530,
  'Stoccarda': 580,
  'Stuttgart': 580,
  'Friburgo in Brisgovia': 490,
  'Freiburg': 490,
  'Augsburg': 570,
  'Augsburgo': 570,
  'Norimberga': 680,
  'Nürnberg': 680,
  'Francoforte': 820,
  'Frankfurt': 820,
  'Colonia': 980,
  'Köln': 980,
  'Dusseldorf': 1010,
  'Amburgo': 1250,
  'Hamburg': 1250,
  'Berlino': 1350,
  'Berlin': 1350,
  // Austria
  'Innsbruck': 350,
  'Salisburgo': 540,
  'Salzburg': 540,
  'Vienna': 820,
  'Wien': 820,
  'Graz': 710,
  'Linz': 700,
  'Klagenfurt': 480,
  // Spagna
  'Barcellona': 850,
  'Barcelona': 850,
  'Girona': 790,
  'Valencia': 1150,
  'Madrid': 1500,
  'Siviglia': 1850,
  'Bilbao': 1150,
  'Saragozza': 1050,
  'Zaragoza': 1050,
  // Belgio
  'Bruxelles': 980,
  'Brussel': 980,
  'Brussels': 980,
  'Liegi': 960,
  'Liège': 960,
  'Gand': 1050,
  'Ghent': 1050,
  'Bruges': 1050,
  'Anversa': 1050,
  'Antwerp': 1050,
  'Namur': 950,
  // Olanda
  'Amsterdam': 1140,
  'Rotterdam': 1140,
  'L\'Aia': 1200,
  'Den Haag': 1200,
  'Utrecht': 1150,
  'Eindhoven': 1100,
  // Lussemburgo
  'Lussemburgo': 950,
  'Luxembourg': 950,
  // UK
  'Londra': 1550,
  'London': 1550,
  'Birmingham': 1700,
  'Manchester': 1800,
  'Edimburgo': 2000,
  'Edinburgh': 2000,
  // Portogallo
  'Lisbona': 2000,
  'Lisboa': 2000,
  'Porto': 1850,
  // Polonia
  'Varsavia': 1800,
  'Warsaw': 1800,
  'Cracovia': 1500,
  'Krakow': 1500,
  // Repubblica Ceca
  'Praga': 1050,
  'Prague': 1050,
  // Slovacchia
  'Bratislava': 850,
  // Ungheria
  'Budapest': 950,
  // Slovenia
  'Lubiana': 500,
  'Ljubljana': 500,
  // Croazia
  'Zagabria': 580,
  'Zagreb': 580,
  'Spalato': 870,
  'Split': 870,
  // Grecia
  'Atene': 2600,
  'Athens': 2600,
  'Salonicco': 2200,
  'Thessaloniki': 2200,
  // Romania
  'Bucarest': 1800,
  'Bucharest': 1800,
  // Danimarca
  'Copenaghen': 1700,
  'Copenhagen': 1700,
  // Svezia
  'Stoccolma': 2200,
  'Stockholm': 2200,
  // Norvegia
  'Oslo': 2300,
  // Finlandia
  'Helsinki': 2700,
  // Malta
  'La Valletta': 1500,
  'Valletta': 1500,
  // San Marino
  'San Marino': 400
};

// Dizionario di alias/nomi alternativi che puntano alle chiavi del database (gestisce formati tipo "Nizza (Francia)")
const CITY_ALIASES = {
  'nizza (francia)': 'Nizza',
  'lione (francia)': 'Lione',
  'marsiglia (francia)': 'Marsiglia',
  'parigi (francia)': 'Parigi',
  'bordeaux (francia)': 'Bordeaux',
  'tolosa (francia)': 'Toulouse',
  'strasburgo (francia)': 'Strasburgo',
  'lilla (francia)': 'Lilla',
  'ginevra (svizzera)': 'Ginevra',
  'zurigo (svizzera)': 'Zurigo',
  'lugano (svizzera)': 'Lugano',
  'berna (svizzera)': 'Berna',
  'basilea (svizzera)': 'Basilea',
  'losanna (svizzera)': 'Losanna',
  'lucerna (svizzera)': 'Lucerna',
  'monaco di baviera (germania)': 'Monaco di Baviera',
  'stoccarda (germania)': 'Stoccarda',
  'francoforte (germania)': 'Francoforte',
  'berlino (germania)': 'Berlino',
  'amburgo (germania)': 'Amburgo',
  'colonia (germania)': 'Colonia',
  'norimberga (germania)': 'Norimberga',
  'innsbruck (austria)': 'Innsbruck',
  'vienna (austria)': 'Vienna',
  'salisburgo (austria)': 'Salisburgo',
  'graz (austria)': 'Graz',
  'klagenfurt (austria)': 'Klagenfurt',
  'barcellona (spagna)': 'Barcellona',
  'madrid (spagna)': 'Madrid',
  'valencia (spagna)': 'Valencia',
  'siviglia (spagna)': 'Siviglia',
  'bilbao (spagna)': 'Bilbao',
  'bruxelles (belgio)': 'Bruxelles',
  'liegi (belgio)': 'Liegi',
  'bruges (belgio)': 'Bruges',
  'gand (belgio)': 'Gand',
  'amsterdam (olanda)': 'Amsterdam',
  'amsterdam (paesi bassi)': 'Amsterdam',
  'rotterdam (olanda)': 'Rotterdam',
  'rotterdam (paesi bassi)': 'Rotterdam',
  'londra (uk)': 'Londra',
  'londra (inghilterra)': 'Londra',
  'londra (gran bretagna)': 'Londra',
  'parigi (fr)': 'Parigi',
  'lisbona (portogallo)': 'Lisbona',
  'porto (portogallo)': 'Porto',
  'praga (rep. ceca)': 'Praga',
  'praga (repubblica ceca)': 'Praga',
  'budapest (ungheria)': 'Budapest',
  'bratislava (slovacchia)': 'Bratislava',
  'lubiana (slovenia)': 'Lubiana',
  'zagabria (croazia)': 'Zagabria',
  'atene (grecia)': 'Atene',
  'bucarest (romania)': 'Bucarest',
  'varsavia (polonia)': 'Varsavia',
  'cracovia (polonia)': 'Cracovia',
  'copenaghen (danimarca)': 'Copenaghen',
  'stoccolma (svezia)': 'Stoccolma',
  'oslo (norvegia)': 'Oslo',
  'helsinki (finlandia)': 'Helsinki',
};

function getCityAndDistance(cityOrClub, fallbackClub) {
  const rawTarget = (cityOrClub || fallbackClub || '').trim();
  if (!rawTarget) return { city: 'Asti', distance: 0 };

  // 0. Controlla gli alias (formati tipo "Nizza (Francia)") prima di tutto
  const targetLow = rawTarget.toLowerCase();
  if (CITY_ALIASES[targetLow]) {
    const aliasKey = CITY_ALIASES[targetLow];
    if (CITY_DISTANCES_FROM_ASTI[aliasKey] !== undefined) {
      return { city: rawTarget, distance: CITY_DISTANCES_FROM_ASTI[aliasKey] };
    }
  }

  // 0b. Estrai la parte prima della parentesi (es. "Nizza (Francia)" => "Nizza") e riprova
  const beforeParen = rawTarget.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (beforeParen && beforeParen !== rawTarget) {
    if (CITY_DISTANCES_FROM_ASTI[beforeParen] !== undefined) {
      return { city: rawTarget, distance: CITY_DISTANCES_FROM_ASTI[beforeParen] };
    }
    // Case-insensitive
    for (const [city, dist] of Object.entries(CITY_DISTANCES_FROM_ASTI)) {
      if (city.toLowerCase() === beforeParen.toLowerCase()) {
        return { city: rawTarget, distance: dist };
      }
    }
  }

  const target = rawTarget;

  // 1. Controlla corrispondenza esatta (case-insensitive) con le città del database chilometrico
  for (const [city, dist] of Object.entries(CITY_DISTANCES_FROM_ASTI)) {
    if (city.toLowerCase() === target.toLowerCase()) {
      return { city, distance: dist };
    }
  }

  // 2. Controlla presenza della parola chiave città nella stringa
  for (const [city, dist] of Object.entries(CITY_DISTANCES_FROM_ASTI)) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(target)) {
      return { city: target, distance: dist };
    }
  }

  // 3. Se era specificata una città ma non è stata trovata, prova sul fallbackClub se fornito
  if (fallbackClub && fallbackClub.trim() && fallbackClub.trim() !== target) {
    for (const [city, dist] of Object.entries(CITY_DISTANCES_FROM_ASTI)) {
      const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(fallbackClub)) {
        return { city: target, distance: dist };
      }
    }
  }

  // 4. Fallback con rimozione prefissi se è un nome di club
  let guessedCity = target
    .replace(/vespa\s+club/gi, '')
    .replace(/a\.?s\.?d\.?/gi, '')
    .replace(/v\.?c\.?/gi, '')
    .trim();

  if (!guessedCity) guessedCity = 'Asti';
  if (guessedCity.toLowerCase() === 'asti') return { city: 'Asti', distance: 0 };
  // Per città non trovate: usa una stima generica "straniera" se contiene indicazioni di paese
  const foreignIndicators = /\b(Francia|France|Svizzera|Switzerland|Germania|Germany|Austria|Spagna|Spain|Belgio|Belgium|Olanda|Netherlands|UK|Inghilterra|England|Portogallo|Portugal|Polonia|Poland|Grecia|Greece|Romania|Danimarca|Denmark|Svezia|Sweden|Norvegia|Norway|Finlandia|Finland|Croazia|Croatia|Slovenia|Ungheria|Hungary|Rep\.?\s*Ceca|Czech)\b/i;
  if (foreignIndicators.test(target)) {
    return { city: guessedCity, distance: 500 }; // stima generica estera (500 km)
  }
  return { city: guessedCity, distance: 150 };
}

// ============================================================
// PAYMENT CONFIG & RICH EDITOR METHODS
// (gestione scheda "Metodo di Pagamento" nella dashboard)
// ============================================================

VespaAdminDashboard.prototype.switchConfigTab = function(tab) {
  const tabs = ['pacchetti', 'pagamento'];
  tabs.forEach(t => {
    const content = document.getElementById('configTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn = document.getElementById('configTabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (content) content.style.display = (t === tab) ? '' : 'none';
    if (btn) {
      if (t === tab) {
        btn.style.borderBottomColor = '#1d4ed8';
        btn.style.color = '#1d4ed8';
      } else {
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = '#64748b';
      }
    }
  });
  // Quando si apre la tab pagamento, carica i dati salvati
  if (tab === 'pagamento') {
    this.loadPaymentConfig();
  }
};

VespaAdminDashboard.prototype.loadPaymentConfig = function() {
  try {
    const raw = localStorage.getItem('vespa_payment_config');
    const cfg = raw ? JSON.parse(raw) : {};

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('paymentConfigIntestatario', cfg.intestatario || 'Vespa Club Asti A.s.D.');
    set('paymentConfigBanca',        cfg.banca        || 'Banca di Asti - Filiale Sede Centrale');
    set('paymentConfigIban',         cfg.iban         || 'IT 76 AA 03069 10300 000012345678');
    set('paymentConfigCausale',      cfg.causale      || '');

    // Carica il contenuto dell'editor ricco
    const editor = document.getElementById('paymentConfigRichEditor');
    if (editor) {
      editor.innerHTML = cfg.richExtra || '';
    }

    this.updatePaymentPreview();
  } catch (e) {
    console.warn('Errore caricamento config pagamento:', e);
  }
};

VespaAdminDashboard.prototype.savePaymentConfig = function() {
  try {
    const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const editor = document.getElementById('paymentConfigRichEditor');
    const richExtra = editor ? editor.innerHTML : '';

    const cfg = {
      intestatario: get('paymentConfigIntestatario') || 'Vespa Club Asti A.s.D.',
      banca:        get('paymentConfigBanca')        || 'Banca di Asti - Filiale Sede Centrale',
      iban:         get('paymentConfigIban')         || '',
      causale:      get('paymentConfigCausale')      || '',
      richExtra:    richExtra
    };

    localStorage.setItem('vespa_payment_config', JSON.stringify(cfg));

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('✅ Configurazione pagamento salvata! Visibile subito nella scheda prenotazione.', 'success');
    } else {
      alert('✅ Configurazione pagamento salvata con successo!');
    }
  } catch (e) {
    console.warn('Errore salvataggio config pagamento:', e);
    alert('Errore durante il salvataggio: ' + e.message);
  }
};

VespaAdminDashboard.prototype.updatePaymentPreview = function() {
  const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const editor = document.getElementById('paymentConfigRichEditor');
  const richExtra = editor ? editor.innerHTML : '';

  const intestatario = get('paymentConfigIntestatario');
  const banca        = get('paymentConfigBanca');
  const iban         = get('paymentConfigIban');
  const causale      = get('paymentConfigCausale');

  const setPreview = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  setPreview('payPrevIntestatario', intestatario);
  setPreview('payPrevBanca',        banca);
  setPreview('payPrevIban',         iban);

  const causaleWrap = document.getElementById('payPrevCausaleWrap');
  if (causaleWrap) {
    causaleWrap.style.display = causale ? '' : 'none';
    const el = document.getElementById('payPrevCausale');
    if (el) el.textContent = causale;
  }

  const extraEl = document.getElementById('payPrevExtra');
  if (extraEl) {
    extraEl.innerHTML = richExtra;
    extraEl.style.display = richExtra && richExtra.trim() && richExtra !== '<br>' ? '' : 'none';
  }
};

VespaAdminDashboard.prototype.insertPaymentLink = function() {
  const url = prompt('Inserisci l\'URL del link (es. https://paypal.me/vespaclubasti):', 'https://');
  if (url && url !== 'https://') {
    document.execCommand('createLink', false, url);
    // Rendi il link apribile in nuova tab
    const editor = document.getElementById('paymentConfigRichEditor');
    if (editor) {
      editor.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    }
    this.updatePaymentPreview();
  }
};

// Estende init() per caricare la config pagamento all'avvio se la tab è già aperta
const _originalAdminInit = VespaAdminDashboard.prototype.init;
VespaAdminDashboard.prototype.init = async function() {
  await _originalAdminInit.call(this);
  // Precarica subito la config per popolare i campi se il pannello viene aperto
  // (non serve fare il render dell'anteprima finché la tab non è attiva)
};

window.vespaAdmin = new VespaAdminDashboard();
