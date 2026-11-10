/**
 * Vespa Club Asti Booking System - Multi-Language i18n Translations
 * Supported: Italiano (IT), English (EN), Deutsch (DE), Français (FR)
 */

const VESPA_I18N = {
  it: {
    langName: 'Italiano',
    flag: '🇮🇹',
    title: 'Vespa Club Asti - Modulo Prenotazione Online',
    brandBadge: '🛵 PRENOTAZIONI',
    btnRecupera: '🔍 Recupera Prenotazione',

    // View 1: Form
    cardTitle: '🛵 Modulo Prenotazione Ufficiale - Vespa Club Asti A.s.D.',
    cardSubtitle: 'Compila tutti i campi per registrare la tua partecipazione. Al termine riceverai il tuo Pass QR Code da esibire all\'accettazione.',

    editBannerPass: '✏️ MODALITÀ MODIFICA ATTIVA • PASS:',
    editBannerTitle: 'Stai modificando la tua prenotazione',
    editBannerDesc: 'Correggi qualsiasi informazione o allega la ricevuta del bonifico se non lo avevi ancora fatto. Clicca sul pulsante in fondo per salvare.',
    editBannerCancel: '✕ Annulla Modifica',

    labelCognome: 'Cognome',
    placeholderCognome: 'Es. Rossi',
    labelNome: 'Nome',
    placeholderNome: 'Es. Mario',
    labelDataNascita: 'Data di Nascita',
    helpDataNascita: 'Necessaria per recuperare o modificare la prenotazione.',

    labelVespaClub: 'Vespa Club di Appartenenza',
    placeholderVespaClub: 'Es. Vespa Club Asti',
    helpVespaClub: 'Inizia a digitare per selezionare il tuo Vespa Club dall\'elenco ufficiale italiano o scrivi il nome del club.',

    labelCittaProvenienza: 'Città di Provenienza',
    placeholderCittaProvenienza: 'Es. Asti, Torino, Milano, Roma, Berlino, Parigi...',
    helpCittaProvenienza: 'Città di residenza/partenza per il calcolo della classifica della provenienza più lontana.',

    labelTesseraVci: 'Numero Tessera VCI',
    placeholderTesseraVci: 'Es. VCI-12345 (o tessera club estero)',

    labelTesseraMotornext: 'Numero Tessera Motornext',
    placeholderTesseraMotornext: 'Es. MN-98765 (se applicabile)',

    labelEmail: 'Email',
    placeholderEmail: 'Es. mario.rossi@example.com',

    labelTelefono: 'Numero di Telefono',
    placeholderTelefono: 'Es. +39 335 1234567',

    labelRuolo: 'Ruolo Partecipante',
    roleConducente: 'CONDUCENTE',
    rolePasseggero: 'PASSEGGERO',

    labelModelloVespa: 'Modello Vespa',
    placeholderModelloVespa: 'Es. Vespa 125 Primavera ET3',
    helpModelloVespa: 'Seleziona dalla lista o digita liberamente il modello esatto della tua Vespa.',

    labelAnnoVespa: 'Anno Vespa',
    placeholderAnnoVespa: 'Es. 1978',

    labelTagliaTshirt: 'Taglia T-Shirt',

    labelModalitaPartecipazione: 'Modalità di Partecipazione & Quota',
    modeFull2Giorni: '🏆 FULL 2 GIORNI (Sabato + Cena, Domenica + Pranzo) - € 55',
    modeFullSabato: '🛵 FULL SABATO (Sabato + Cena) - € 35',
    modeFullDomenica: '🍽️ FULL DOMENICA (Domenica + Pranzo) - € 45',

    // Coordinate bancarie
    bankTitle: '🏦 Coordinate Bancarie per il Pagamento della Quota (Bonifico)',
    bankSubtitle: 'Effettua il versamento della quota tramite bonifico bancario utilizzando le coordinate sottostanti:',
    bankAccountHolderLabel: 'Intestatario del Conto:',
    bankNameLabel: 'Istituto Bancario:',
    bankNameValue: 'Banca di Asti - Filiale Sede Centrale',
    bankIbanLabel: 'Codice IBAN:',

    // File Upload
    labelAllegato: '📎 Allega Ricevuta di Pagamento (Bonifico Bancario)',
    fileDropText: 'Trascina qui la ricevuta o clicca per selezionare il file',
    fileDropSubtext: 'Se hai già effettuato il bonifico, allega la contabile (PDF, JPG o PNG - Max 10 MB) per velocizzare la convalida',
    fileReadyText: '✅ Ricevuta pronta per l\'invio',
    fileRemoveBtn: '✕ Rimuovi File',

    btnSubmit: '🚀 Conferma e Invia Registrazione Online',
    btnSubmitEditing: '💾 Salva Modifiche Prenotazione',

    // View 2: Pass
    recNoticeTitle: '🔍 PRENOTAZIONE TROVATA NEL DATABASE',
    recNoticeH3: 'Desideri modificare qualche dato o allegare la ricevuta del bonifico?',
    recNoticeDesc: 'Se avevi sbagliato qualche informazione o non avevi inizialmente allegato la contabile di pagamento, puoi modificarla adesso e salvarla nuovamente.',
    recNoticeBtn: '✏️ Modifica Dati / Allega Ricevuta',

    saveNoticeTitle: 'ATTENZIONE: SALVA O STAMPA QUESTA SCHERMATA!',
    saveNoticeDesc: 'Fai uno screenshot adesso sul telefono oppure stampa o scarica il tuo Pass.<br>Questa schermata con il QR Code è la tua copia ufficiale di prenotazione e ti servirà all\'arrivo per l\'Accettazione e per la fruizione di tutti i banchi (ritiro kit gadget/t-shirt, aperitivo, cena di sabato e pranzo di domenica).',
    btnPrint: '🖨️ Stampa o Salva PDF',
    btnDownloadQrBanner: '📥 Scarica Pass QR Code',
    btnEditBanner: '✏️ Modifica Dati / Allega Ricevuta',

    ticketSubtitle: 'Pass Ufficiale Partecipante Raduno Nazionale',
    ticketConfirmed: '✅ PRENOTAZIONE CONFERMATA & SALVATA',
    ticketQrHelp: 'Mostra questo codice QR agli operatori all\'arrivo per l\'accredito rapido all\'accettazione e a ciascun banco di servizio.',
    ticketServicesTitle: '🎫 Banchi e Servizi Abilitati con questo Pass:',
    badgeGadget: '🎁 Kit Gadget & T-Shirt',
    badgeAperitivo: '🍹 Aperitivo di Benvenuto',
    badgeCena: '🍽️ Cena Sabato',
    badgePranzo: '🍽️ Pranzo Domenica',

    lblPartecipante: 'Partecipante:',
    lblVespaClub: 'Vespa Club:',
    lblCittaProvenienza: 'Città di Provenienza:',
    lblTesseraVci: 'Tessera VCI:',
    lblTesseraMn: 'Tessera Motornext:',
    lblRuoloPartecipante: 'Ruolo Partecipante:',
    lblModelloAnno: 'Modello & Anno Vespa:',
    lblTagliaTshirt: 'Taglia T-Shirt:',
    lblStatoQuota: 'Stato Quota / Ricevuta:',
    lblPacchettoQuota: 'Pacchetto Raduno & Quota:',

    btnDownloadQrImg: '📥 Scarica Immagine QR',
    btnPrintPass: '🖨️ Stampa Pass',
    btnEditPass: '✏️ Modifica Dati / Allega Ricevuta',
    btnNewBooking: '➕ Nuova Prenotazione',

    // Modale Recupero
    modalRecuperaTitle: '🔍 Recupera la tua Prenotazione',
    modalRecuperaDesc: 'Inserisci i tuoi dati per ritrovare la prenotazione già effettuata e ristampare il Pass QR.',
    modalRecuperaBdayHelp: 'Usata per verificare la tua identità',
    modalRecuperaCancel: 'Annulla',
    modalRecuperaSubmit: '🔍 Cerca la mia Prenotazione',

    // Modale Duplicato
    modalDuplicateTitle: 'PRENOTAZIONE GIÀ COMPLETATA!',
    modalDuplicateText1: 'Risulta già una prenotazione completata per il nominativo:',
    modalDuplicateText2: 'Se devi effettuare una nuova prenotazione (ad esempio per un altro partecipante, passeggero o compagno di viaggio), devi utilizzare un altro nome.',
    modalDuplicateHelp: 'ℹ️ In caso di dubbi, modifiche o problemi con la prenotazione, contatta direttamente l\'organizzatore del Vespa Club Asti.',
    modalDuplicateClose: 'Ho Capito / Correggi Dati',

    footerText: 'Vespa Club Asti A.s.D. - Fondato nel 1950 | Suite Registrazione Conducenti e Passeggeri Cloud'
  },

  en: {
    langName: 'English',
    flag: '🇬🇧',
    title: 'Vespa Club Asti - Online Registration Form',
    brandBadge: '🛵 REGISTRATIONS',
    btnRecupera: '🔍 Retrieve Booking',

    cardTitle: '🛵 Official Registration Form - Vespa Club Asti A.s.D.',
    cardSubtitle: 'Please fill in all required fields to register for the rally. You will receive your official QR Code Pass to show upon arrival.',

    editBannerPass: '✏️ EDIT MODE ACTIVE • PASS:',
    editBannerTitle: 'You are modifying your registration',
    editBannerDesc: 'Edit any information or upload your bank transfer payment receipt if you have not done so yet. Click the button at the bottom to save.',
    editBannerCancel: '✕ Cancel Edit',

    labelCognome: 'Last Name',
    placeholderCognome: 'E.g. Smith',
    labelNome: 'First Name',
    placeholderNome: 'E.g. John',
    labelDataNascita: 'Date of Birth',
    helpDataNascita: 'Required to retrieve or modify your registration.',

    labelVespaClub: 'Vespa Club Membership',
    placeholderVespaClub: 'E.g. Vespa Club London / Vespa Club Asti',
    helpVespaClub: 'Start typing to select your club or enter your club\'s name.',

    labelCittaProvenienza: 'City of Origin',
    placeholderCittaProvenienza: 'E.g. London, Munich, Paris, Asti...',
    helpCittaProvenienza: 'Your departure city for the furthest distance award ranking.',

    labelTesseraVci: 'VCI / National Member ID',
    placeholderTesseraVci: 'E.g. VCI-12345 or national club card number',

    labelTesseraMotornext: 'Motornext Card Number',
    placeholderTesseraMotornext: 'E.g. MN-98765 (if applicable)',

    labelEmail: 'Email Address',
    placeholderEmail: 'E.g. john.smith@example.com',

    labelTelefono: 'Phone Number',
    placeholderTelefono: 'E.g. +44 7911 123456',

    labelRuolo: 'Participant Role',
    roleConducente: 'RIDER / DRIVER',
    rolePasseggero: 'PILLION / PASSENGER',

    labelModelloVespa: 'Vespa Model',
    placeholderModelloVespa: 'E.g. Vespa 125 Primavera ET3',
    helpModelloVespa: 'Select from the list or type your exact Vespa model.',

    labelAnnoVespa: 'Vespa Year',
    placeholderAnnoVespa: 'E.g. 1978',

    labelTagliaTshirt: 'T-Shirt Size',

    labelModalitaPartecipazione: 'Participation Package & Fee',
    modeFull2Giorni: '🏆 FULL 2 DAYS (Saturday + Dinner, Sunday + Lunch) - € 55',
    modeFullSabato: '🛵 FULL SATURDAY (Saturday + Dinner) - € 35',
    modeFullDomenica: '🍽️ FULL SUNDAY (Sunday + Lunch) - € 45',

    bankTitle: '🏦 Bank Details for Registration Fee Payment (Wire Transfer)',
    bankSubtitle: 'Please transfer your registration fee using the official banking details below:',
    bankAccountHolderLabel: 'Account Holder:',
    bankNameLabel: 'Bank Name:',
    bankNameValue: 'Banca di Asti - Central Headquarters Branch',
    bankIbanLabel: 'IBAN Code:',

    labelAllegato: '📎 Attach Payment Receipt (Bank Transfer)',
    fileDropText: 'Drag & drop your receipt here or click to browse',
    fileDropSubtext: 'If you already made the transfer, attach the receipt (PDF, JPG or PNG - Max 10 MB) for quick verification',
    fileReadyText: '✅ Receipt ready to be submitted',
    fileRemoveBtn: '✕ Remove File',

    btnSubmit: '🚀 Confirm and Submit Online Registration',
    btnSubmitEditing: '💾 Save Registration Changes',

    recNoticeTitle: '🔍 BOOKING FOUND IN DATABASE',
    recNoticeH3: 'Do you want to edit your details or attach your payment receipt?',
    recNoticeDesc: 'If you need to correct any details or haven\'t attached your transfer receipt yet, you can do it now and save again.',
    recNoticeBtn: '✏️ Edit Details / Attach Receipt',

    saveNoticeTitle: 'ATTENTION: SAVE OR PRINT THIS SCREEN!',
    saveNoticeDesc: 'Take a screenshot on your mobile phone right now, or print/download your Pass.<br>This screen with the QR Code is your official proof of registration and will be required upon arrival for Check-in and all event services (goodie bag/t-shirt pickup, welcome drink, Saturday dinner, and Sunday lunch).',
    btnPrint: '🖨️ Print or Save as PDF',
    btnDownloadQrBanner: '📥 Download QR Code Pass',
    btnEditBanner: '✏️ Edit Details / Attach Receipt',

    ticketSubtitle: 'Official National Rally Participant Pass',
    ticketConfirmed: '✅ REGISTRATION CONFIRMED & SAVED',
    ticketQrHelp: 'Show this QR code to the staff at check-in for instant access to all included services.',
    ticketServicesTitle: '🎫 Services & Desks Included with this Pass:',
    badgeGadget: '🎁 Goodie Bag & T-Shirt',
    badgeAperitivo: '🍹 Welcome Aperitif',
    badgeCena: '🍽️ Saturday Dinner',
    badgePranzo: '🍽️ Sunday Lunch',

    lblPartecipante: 'Participant:',
    lblVespaClub: 'Vespa Club:',
    lblCittaProvenienza: 'City of Origin:',
    lblTesseraVci: 'VCI Card:',
    lblTesseraMn: 'Motornext Card:',
    lblRuoloPartecipante: 'Role:',
    lblModelloAnno: 'Model & Year:',
    lblTagliaTshirt: 'T-Shirt Size:',
    lblStatoQuota: 'Payment Status / Receipt:',
    lblPacchettoQuota: 'Rally Package & Fee:',

    btnDownloadQrImg: '📥 Download QR Image',
    btnPrintPass: '🖨️ Print Pass',
    btnEditPass: '✏️ Edit Details / Attach Receipt',
    btnNewBooking: '➕ New Registration',

    modalRecuperaTitle: '🔍 Retrieve your Registration',
    modalRecuperaDesc: 'Enter your personal details to retrieve your existing registration and reprint your QR Pass.',
    modalRecuperaBdayHelp: 'Used to verify your identity',
    modalRecuperaCancel: 'Cancel',
    modalRecuperaSubmit: '🔍 Find my Registration',

    modalDuplicateTitle: 'REGISTRATION ALREADY COMPLETED!',
    modalDuplicateText1: 'A completed booking already exists for:',
    modalDuplicateText2: 'If you want to make an additional booking (e.g. for a passenger or traveling companion), please use a different name.',
    modalDuplicateHelp: 'ℹ️ For any questions, changes or assistance, contact the Vespa Club Asti organizers directly.',
    modalDuplicateClose: 'Understood / Correct Details',

    footerText: 'Vespa Club Asti A.s.D. - Founded in 1950 | Cloud Rider & Passenger Registration Suite'
  },

  de: {
    langName: 'Deutsch',
    flag: '🇩🇪',
    title: 'Vespa Club Asti - Online-Anmeldeformular',
    brandBadge: '🛵 ANMELDUNGEN',
    btnRecupera: '🔍 Buchung abrufen',

    cardTitle: '🛵 Offizielles Anmeldeformular - Vespa Club Asti A.s.D.',
    cardSubtitle: 'Füllen Sie alle Pflichtfelder aus, um Ihre Teilnahme zu registrieren. Sie erhalten Ihren offiziellen QR-Code-Pass für den Check-in.',

    editBannerPass: '✏️ BEARBEITUNGSMODUS AKTIV • PASS:',
    editBannerTitle: 'Sie bearbeiten Ihre Buchung',
    editBannerDesc: 'Korrigieren Sie Angaben oder laden Sie Ihren Überweisungsbeleg hoch. Klicken Sie anschließend unten auf Speichern.',
    editBannerCancel: '✕ Bearbeitung abbrechen',

    labelCognome: 'Nachname',
    placeholderCognome: 'Z.B. Müller',
    labelNome: 'Vorname',
    placeholderNome: 'Z.B. Hans',
    labelDataNascita: 'Geburtsdatum',
    helpDataNascita: 'Erforderlich zum Abrufen oder Ändern Ihrer Buchung.',

    labelVespaClub: 'Zugehöriger Vespa Club',
    placeholderVespaClub: 'Z.B. Vespa Club München / Vespa Club Asti',
    helpVespaClub: 'Beginnen Sie mit der Eingabe, um Ihren Club auszuwählen oder geben Sie den Namen ein.',

    labelCittaProvenienza: 'Herkunftsstadt',
    placeholderCittaProvenienza: 'Z.B. München, Stuttgart, Wien, Zürich...',
    helpCittaProvenienza: 'Wohnort/Startort für die Wertung der weitesten Anreise.',

    labelTesseraVci: 'VCI- / Mitgliedsnummer',
    placeholderTesseraVci: 'Z.B. VCI-12345 oder Club-Mitgliedsnummer',

    labelTesseraMotornext: 'Motornext-Kartennummer',
    placeholderTesseraMotornext: 'Z.B. MN-98765 (falls vorhanden)',

    labelEmail: 'E-Mail-Adresse',
    placeholderEmail: 'Z.B. hans.mueller@example.com',

    labelTelefono: 'Telefonnummer',
    placeholderTelefono: 'Z.B. +49 170 1234567',

    labelRuolo: 'Teilnehmer-Rolle',
    roleConducente: 'FAHRER',
    rolePasseggero: 'BEIFAHRER / SOZIUS',

    labelModelloVespa: 'Vespa-Modell',
    placeholderModelloVespa: 'Z.B. Vespa 125 Primavera ET3',
    helpModelloVespa: 'Wählen Sie aus der Liste oder tragen Sie Ihr genaues Vespa-Modell ein.',

    labelAnnoVespa: 'Baujahr der Vespa',
    placeholderAnnoVespa: 'Z.B. 1978',

    labelTagliaTshirt: 'T-Shirt-Größe',

    labelModalitaPartecipazione: 'Teilnahmepaket & Gebühr',
    modeFull2Giorni: '🏆 FULL 2 TAGE (Samstag + Abendessen, Sonntag + Mittagessen) - € 55',
    modeFullSabato: '🛵 FULL SAMSTAG (Samstag + Abendessen) - € 35',
    modeFullDomenica: '🍽️ FULL SONNTAG (Sonntag + Mittagessen) - € 45',

    bankTitle: '🏦 Bankverbindung für die Überweisung der Teilnahmegebühr',
    bankSubtitle: 'Bitte überweisen Sie die Teilnahmegebühr auf folgendes Vereinskonto:',
    bankAccountHolderLabel: 'Kontoinhaber:',
    bankNameLabel: 'Kreditinstitut:',
    bankNameValue: 'Banca di Asti - Hauptfiliale',
    bankIbanLabel: 'IBAN-Code:',

    labelAllegato: '📎 Zahlungsbeleg beifügen (Banküberweisung)',
    fileDropText: 'Beleg hierhin ziehen oder zum Auswählen klicken',
    fileDropSubtext: 'Falls Sie die Überweisung bereits getätigt haben, fügen Sie den Beleg bei (PDF, JPG, PNG - max. 10 MB)',
    fileReadyText: '✅ Zahlungsbeleg bereit zum Hochladen',
    fileRemoveBtn: '✕ Datei entfernen',

    btnSubmit: '🚀 Anmeldung verbindlich online absenden',
    btnSubmitEditing: '💾 Änderungen speichern',

    recNoticeTitle: '🔍 BUCHUNG IN DATENBANK GEFUNDEN',
    recNoticeH3: 'Möchten Sie Daten ändern oder einen Zahlungsbeleg nachreichen?',
    recNoticeDesc: 'Falls Sie Angaben korrigieren müssen oder noch keinen Beleg hochgeladen haben, können Sie dies jetzt tun.',
    recNoticeBtn: '✏️ Daten ändern / Beleg anfügen',

    saveNoticeTitle: 'ACHTUNG: DIESE SEITE SPEICHERN ODER AUSDRUCKEN!',
    saveNoticeDesc: 'Machen Sie jetzt einen Screenshot mit Ihrem Smartphone oder drucken/speichern Sie Ihren Pass.<br>Diese Seite mit dem QR-Code ist Ihre offizielle Buchungsbestätigung und wird bei der Ankunft beim Check-in und für alle Leistungen benötigt (Goodie-Bag, T-Shirt, Begrüßungsaperitif, Samstag-Abendessen, Sonntag-Mittagessen).',
    btnPrint: '🖨️ Drucken oder als PDF speichern',
    btnDownloadQrBanner: '📥 QR-Pass herunterladen',
    btnEditBanner: '✏️ Daten ändern / Beleg anfügen',

    ticketSubtitle: 'Offizieller Teilnehmer-Pass Nationales Vespa-Treffen',
    ticketConfirmed: '✅ BUCHUNG BESTÄTIGT & GESPEICHERT',
    ticketQrHelp: 'Zeigen Sie diesen QR-Code bei der Ankunft den Mitarbeitern für schnellen Check-in an allen Stationen vor.',
    ticketServicesTitle: '🎫 Mit diesem Pass enthaltene Leistungen & Stände:',
    badgeGadget: '🎁 Goodie-Bag & T-Shirt',
    badgeAperitivo: '🍹 Willkommens-Aperitif',
    badgeCena: '🍽️ Samstag Abendessen',
    badgePranzo: '🍽️ Sonntag Mittagessen',

    lblPartecipante: 'Teilnehmer:',
    lblVespaClub: 'Vespa Club:',
    lblCittaProvenienza: 'Herkunftsstadt:',
    lblTesseraVci: 'VCI-Karte:',
    lblTesseraMn: 'Motornext-Karte:',
    lblRuoloPartecipante: 'Rolle:',
    lblModelloAnno: 'Modell & Baujahr:',
    lblTagliaTshirt: 'T-Shirt-Größe:',
    lblStatoQuota: 'Zahlungsstatus / Beleg:',
    lblPacchettoQuota: 'Paket & Gebühr:',

    btnDownloadQrImg: '📥 QR-Bild herunterladen',
    btnPrintPass: '🖨️ Pass ausdrucken',
    btnEditPass: '✏️ Daten ändern / Beleg anfügen',
    btnNewBooking: '➕ Neue Anmeldung',

    modalRecuperaTitle: '🔍 Buchung wiederfinden',
    modalRecuperaDesc: 'Geben Sie Ihre Daten ein, um Ihre bestehende Anmeldung abzurufen und Ihren QR-Pass erneut auszudrucken.',
    modalRecuperaBdayHelp: 'Dient zur Bestätigung Ihrer Identität',
    modalRecuperaCancel: 'Abbrechen',
    modalRecuperaSubmit: '🔍 Meine Buchung suchen',

    modalDuplicateTitle: 'BUCHUNG BEREITS ABGESCHLOSSEN!',
    modalDuplicateText1: 'Es existiert bereits eine abgeschlossene Buchung für:',
    modalDuplicateText2: 'Falls Sie eine weitere Person anmelden möchten (z.B. Beifahrer oder Begleiter), verwenden Sie bitte einen anderen Namen.',
    modalDuplicateHelp: 'ℹ️ Bei Fragen oder Änderungswünschen wenden Sie sich bitte direkt an den Vespa Club Asti.',
    modalDuplicateClose: 'Verstanden / Daten korrigieren',

    footerText: 'Vespa Club Asti A.s.D. - Gegründet 1950 | Cloud-Plattform für Teilnehmerregistrierung'
  },

  fr: {
    langName: 'Français',
    flag: '🇫🇷',
    title: 'Vespa Club Asti - Formulaire de Réservation en Ligne',
    brandBadge: '🛵 RÉSERVATIONS',
    btnRecupera: '🔍 Retrouver ma Réservation',

    cardTitle: '🛵 Formulaire d\'Inscription Officiel - Vespa Club Asti A.s.D.',
    cardSubtitle: 'Remplissez tous les champs obligatoires pour enregistrer votre participation. Vous recevrez votre Pass QR Code officiel à présenter à l\'accueil.',

    editBannerPass: '✏️ MODE MODIFICATION ACTIF • PASS:',
    editBannerTitle: 'Vous modifiez votre inscription',
    editBannerDesc: 'Corrigez vos données ou joignez le justificatif de virement si vous ne l\'aviez pas encore fait. Cliquez en bas pour enregistrer.',
    editBannerCancel: '✕ Annuler la modification',

    labelCognome: 'Nom de Famille',
    placeholderCognome: 'Ex. Dupont',
    labelNome: 'Prénom',
    placeholderNome: 'Ex. Jean',
    labelDataNascita: 'Date de Naissance',
    helpDataNascita: 'Nécessaire pour retrouver ou modifier votre inscription.',

    labelVespaClub: 'Vespa Club d\'Appartenance',
    placeholderVespaClub: 'Ex. Vespa Club de France / Vespa Club Asti',
    helpVespaClub: 'Tapez pour sélectionner votre Vespa Club ou inscrivez son nom.',

    labelCittaProvenienza: 'Ville de Provenance',
    placeholderCittaProvenienza: 'Ex. Nice, Lyon, Paris, Marseille, Asti...',
    helpCittaProvenienza: 'Ville de départ/résidence pour le classement de la plus longue distance parcourue.',

    labelTesseraVci: 'N° Carte VCI / Club National',
    placeholderTesseraVci: 'Ex. VCI-12345 ou numéro de carte de membre',

    labelTesseraMotornext: 'Numéro de Carte Motornext',
    placeholderTesseraMotornext: 'Ex. MN-98765 (le cas échéant)',

    labelEmail: 'Adresse Email',
    placeholderEmail: 'Ex. jean.dupont@example.com',

    labelTelefono: 'Numéro de Téléphone',
    placeholderTelefono: 'Ex. +33 6 12 34 56 78',

    labelRuolo: 'Rôle du Participant',
    roleConducente: 'CONDUCTEUR / PILOTE',
    rolePasseggero: 'PASSAGER',

    labelModelloVespa: 'Modèle de Vespa',
    placeholderModelloVespa: 'Ex. Vespa 125 Primavera ET3',
    helpModelloVespa: 'Sélectionnez dans la liste ou indiquez le modèle exact de votre Vespa.',

    labelAnnoVespa: 'Année de la Vespa',
    placeholderAnnoVespa: 'Ex. 1978',

    labelTagliaTshirt: 'Taille T-Shirt',

    labelModalitaPartecipazione: 'Formule de Participation & Tarif',
    modeFull2Giorni: '🏆 FULL 2 JOURS (Samedi + Dîner, Dimanche + Déjeuner) - 55 €',
    modeFullSabato: '🛵 FULL SAMEDI (Samedi + Dîner) - 35 €',
    modeFullDomenica: '🍽️ FULL DIMANCHE (Dimanche + Déjeuner) - 45 €',

    bankTitle: '🏦 Coordonnées Bancaires pour le Virement de la Participation',
    bankSubtitle: 'Effectuez le virement bancaire en utilisant les coordonnées officielles ci-dessous :',
    bankAccountHolderLabel: 'Titulaire du Compte :',
    bankNameLabel: 'Établissement Bancaire :',
    bankNameValue: 'Banca di Asti - Siège Central',
    bankIbanLabel: 'Code IBAN :',

    labelAllegato: '📎 Joindre le Justificatif de Virement Bancaire',
    fileDropText: 'Glissez-déposez ici votre reçu ou cliquez pour sélectionner le fichier',
    fileDropSubtext: 'Si vous avez déjà effectué le virement, joignez la preuve (PDF, JPG ou PNG - Max 10 Mo) pour validation rapide',
    fileReadyText: '✅ Justificatif prêt à l\'envoi',
    fileRemoveBtn: '✕ Supprimer le fichier',

    btnSubmit: '🚀 Confirmer et Envoyer l\'Inscription en Ligne',
    btnSubmitEditing: '💾 Enregistrer les Modifications',

    recNoticeTitle: '🔍 INSCRIPTION RETROUVÉE DANS LA BASE',
    recNoticeH3: 'Souhaitez-vous modifier des données ou joindre votre reçu de virement ?',
    recNoticeDesc: 'Si vous souhaitez corriger une information ou ajouter le justificatif de paiement, vous pouvez le faire maintenant.',
    recNoticeBtn: '✏️ Modifier les Données / Joindre le Reçu',

    saveNoticeTitle: 'ATTENTION : ENREGISTREZ OU IMPRIMEZ CET ÉCRAN !',
    saveNoticeDesc: 'Prenez une capture d\'écran sur votre téléphone dès maintenant ou imprimez/téléchargez votre Pass.<br>Cet écran avec le QR Code constitue votre preuve officielle de réservation. Il sera exigé dès votre arrivée pour le contrôle et l\'accès à tous les services (kit de bienvenue, t-shirt, apéritif, dîner du samedi et déjeuner du dimanche).',
    btnPrint: '🖨️ Imprimer ou Enregistrer en PDF',
    btnDownloadQrBanner: '📥 Télécharger le Pass QR Code',
    btnEditBanner: '✏️ Modifier les Données / Joindre le Reçu',

    ticketSubtitle: 'Pass Officiel Participant Rassemblement National',
    ticketConfirmed: '✅ INSCRIPTION CONFIRMÉE & ENREGISTRÉE',
    ticketQrHelp: 'Présentez ce QR Code aux bénévoles dès votre arrivée pour un enregistrement rapide à chaque stand.',
    ticketServicesTitle: '🎫 Stands et Services Inclus avec ce Pass :',
    badgeGadget: '🎁 Kit Cadeaux & T-Shirt',
    badgeAperitivo: '🍹 Apéritif de Bienvenue',
    badgeCena: '🍽️ Dîner du Samedi',
    badgePranzo: '🍽️ Déjeuner du Dimanche',

    lblPartecipante: 'Participant :',
    lblVespaClub: 'Vespa Club :',
    lblCittaProvenienza: 'Ville de Provenance :',
    lblTesseraVci: 'Carte VCI :',
    lblTesseraMn: 'Carte Motornext :',
    lblRuoloPartecipante: 'Rôle :',
    lblModelloAnno: 'Modèle & Année :',
    lblTagliaTshirt: 'Taille T-Shirt :',
    lblStatoQuota: 'État du Paiement / Reçu :',
    lblPacchettoQuota: 'Formule & Tarif :',

    btnDownloadQrImg: '📥 Télécharger l\'Image QR',
    btnPrintPass: '🖨️ Imprimer le Pass',
    btnEditPass: '✏️ Modifier les Données / Joindre le Reçu',
    btnNewBooking: '➕ Nouvelle Inscription',

    modalRecuperaTitle: '🔍 Retrouver votre Inscription',
    modalRecuperaDesc: 'Saisissez vos coordonnées pour retrouver votre réservation et réimprimer votre Pass QR.',
    modalRecuperaBdayHelp: 'Utilisée pour vérifier votre identité',
    modalRecuperaCancel: 'Annuler',
    modalRecuperaSubmit: '🔍 Rechercher ma Réservation',

    modalDuplicateTitle: 'INSCRIPTION DÉJÀ EXISTANTE !',
    modalDuplicateText1: 'Une inscription confirmée existe déjà pour le nom :',
    modalDuplicateText2: 'Si vous souhaitez inscrire un autre participant (par exemple un passager ou un accompagnateur), veuillez utiliser un autre nom.',
    modalDuplicateHelp: 'ℹ️ Pour toute question ou modification, contactez directement l\'organisateur du Vespa Club Asti.',
    modalDuplicateClose: 'Compris / Corriger les Données',

    footerText: 'Vespa Club Asti A.s.D. - Fondé en 1950 | Plateforme d\'Inscription Pilotes et Passagers'
  }
};

class VespaI18nManager {
  constructor() {
    this.languages = [
      { code: 'it', name: 'Italiano', flag: '🇮🇹' },
      { code: 'en', name: 'English', flag: '🇬🇧' },
      { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' }
    ];
    this.currentLang = localStorage.getItem('vespa_booking_lang') || 'it';
  }

  setLanguage(langCode) {
    if (!VESPA_I18N[langCode]) langCode = 'it';
    this.currentLang = langCode;
    try {
      localStorage.setItem('vespa_booking_lang', langCode);
    } catch (e) {}
    this.applyTranslations();
    this.updateSelectorUI();
  }

  get(key) {
    const dict = VESPA_I18N[this.currentLang] || VESPA_I18N.it;
    return dict[key] || VESPA_I18N.it[key] || '';
  }

  applyTranslations() {
    const t = VESPA_I18N[this.currentLang] || VESPA_I18N.it;

    // Document title
    document.title = t.title;
    document.documentElement.lang = this.currentLang;

    // Helper text updater
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };
    const setHtml = (id, html) => {
      const el = document.getElementById(id);
      if (el && html) el.innerHTML = html;
    };
    const setAttr = (id, attr, val) => {
      const el = document.getElementById(id);
      if (el && val) el.setAttribute(attr, val);
    };

    // Header
    const brandBadge = document.querySelector('.brand-badge-prenotazione');
    if (brandBadge) brandBadge.textContent = t.brandBadge;
    const btnRec = document.getElementById('btnRecuperaPrenotazione');
    if (btnRec) btnRec.innerHTML = t.btnRecupera;

    // View 1 Card Header
    const cardTitle = document.querySelector('.card-title');
    if (cardTitle) cardTitle.textContent = t.cardTitle;
    const cardSubtitle = document.querySelector('.card-subtitle');
    if (cardSubtitle) cardSubtitle.textContent = t.cardSubtitle;

    // Edit Banner
    setHtml('bookingEditModePassId', `<span style="font-family:monospace; font-size:1rem; font-weight:900; color:#065F46;">${document.getElementById('bookingEditModePassId')?.textContent || '-'}</span>`);
    const editBannerH3 = document.querySelector('#bookingEditModeBanner h3');
    if (editBannerH3) editBannerH3.textContent = t.editBannerTitle;
    const editBannerP = document.querySelector('#bookingEditModeBanner p');
    if (editBannerP) editBannerP.textContent = t.editBannerDesc;
    const editBannerBtn = document.querySelector('#bookingEditModeBanner button');
    if (editBannerBtn) editBannerBtn.textContent = t.editBannerCancel;

    // Form Labels & Placeholders
    const updateLabel = (forId, text) => {
      const lbl = document.querySelector(`label[for="${forId}"]`);
      if (lbl) {
        lbl.innerHTML = `${text} <span class="req">*</span>`;
      }
    };

    updateLabel('cognome', t.labelCognome);
    setAttr('cognome', 'placeholder', t.placeholderCognome);

    updateLabel('nome', t.labelNome);
    setAttr('nome', 'placeholder', t.placeholderNome);

    updateLabel('dataNascita', t.labelDataNascita);
    const bdaySmall = document.querySelector('#dataNascita ~ small');
    if (bdaySmall) bdaySmall.textContent = t.helpDataNascita;

    updateLabel('vespaClub', t.labelVespaClub);
    setAttr('vespaClub', 'placeholder', t.placeholderVespaClub);
    const clubSmall = document.querySelector('#vespaClub ~ small');
    if (clubSmall) clubSmall.textContent = t.helpVespaClub;

    updateLabel('cittaProvenienza', t.labelCittaProvenienza);
    setAttr('cittaProvenienza', 'placeholder', t.placeholderCittaProvenienza);
    const citySmall = document.querySelector('#cittaProvenienza ~ small');
    if (citySmall) citySmall.textContent = t.helpCittaProvenienza;

    updateLabel('tesseraVci', t.labelTesseraVci);
    setAttr('tesseraVci', 'placeholder', t.placeholderTesseraVci);

    updateLabel('tesseraMotornext', t.labelTesseraMotornext);
    setAttr('tesseraMotornext', 'placeholder', t.placeholderTesseraMotornext);

    updateLabel('email', t.labelEmail);
    setAttr('email', 'placeholder', t.placeholderEmail);

    updateLabel('telefono', t.labelTelefono);
    setAttr('telefono', 'placeholder', t.placeholderTelefono);

    updateLabel('ruolo', t.labelRuolo);
    const ruoloSelect = document.getElementById('ruolo');
    if (ruoloSelect && ruoloSelect.options.length >= 2) {
      ruoloSelect.options[0].textContent = t.roleConducente;
      ruoloSelect.options[1].textContent = t.rolePasseggero;
    }

    updateLabel('modelloVespa', t.labelModelloVespa);
    setAttr('modelloVespa', 'placeholder', t.placeholderModelloVespa);
    const modelSmall = document.querySelector('#modelloVespa ~ small');
    if (modelSmall) modelSmall.textContent = t.helpModelloVespa;

    updateLabel('annoVespa', t.labelAnnoVespa);
    setAttr('annoVespa', 'placeholder', t.placeholderAnnoVespa);

    updateLabel('tagliaTshirt', t.labelTagliaTshirt);

    updateLabel('modalitaPartecipazione', t.labelModalitaPartecipazione);
    const modSelect = document.getElementById('modalitaPartecipazione');
    if (modSelect && modSelect.options.length >= 3) {
      modSelect.options[0].textContent = t.modeFull2Giorni;
      modSelect.options[1].textContent = t.modeFullSabato;
      modSelect.options[2].textContent = t.modeFullDomenica;
    }

    // Bank details box
    const bankH3 = document.querySelector('.payment-box h3');
    if (bankH3) bankH3.innerHTML = t.bankTitle;
    const bankP = document.querySelector('.payment-box p');
    if (bankP) bankP.textContent = t.bankSubtitle;

    const bankSpans = document.querySelectorAll('.payment-box span');
    if (bankSpans.length >= 3) {
      bankSpans[0].textContent = t.bankAccountHolderLabel;
      bankSpans[1].textContent = t.bankNameLabel;
      bankSpans[2].textContent = t.bankIbanLabel;
    }

    // File upload section
    const fileLabel = document.querySelector('label[for="provaPagamentoFile"]');
    if (fileLabel) fileLabel.textContent = t.labelAllegato;
    const dropTitle = document.querySelector('#fileDropArea > div:nth-child(2)');
    if (dropTitle) dropTitle.textContent = t.fileDropText;
    const dropSubtitle = document.querySelector('#fileDropArea > div:nth-child(3)');
    if (dropSubtitle) dropSubtitle.textContent = t.fileDropSubtext;
    const fileReady = document.querySelector('#filePreviewBox span[style*="color:var(--vespa-green)"]');
    if (fileReady) fileReady.textContent = t.fileReadyText;
    const fileRemoveBtn = document.querySelector('#filePreviewBox button');
    if (fileRemoveBtn) fileRemoveBtn.textContent = t.fileRemoveBtn;

    // Submit button
    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) {
      if (window.vespaBookingForm && window.vespaBookingForm.editingRecordId) {
        submitBtn.textContent = t.btnSubmitEditing;
      } else {
        submitBtn.textContent = t.btnSubmit;
      }
    }

    // View 2: Confirmation / Pass
    const recH3 = document.querySelector('#ticketRecoveredNotice h3');
    if (recH3) recH3.textContent = t.recNoticeH3;
    const recP = document.querySelector('#ticketRecoveredNotice p');
    if (recP) recP.textContent = t.recNoticeDesc;
    const recNoticeBtn = document.querySelector('#ticketRecoveredNotice button');
    if (recNoticeBtn) recNoticeBtn.textContent = t.recNoticeBtn;

    const saveNoticeH3 = document.querySelector('.save-notice-banner h3');
    if (saveNoticeH3) saveNoticeH3.textContent = t.saveNoticeTitle;
    const saveNoticeP = document.querySelector('.save-notice-banner p');
    if (saveNoticeP) saveNoticeP.innerHTML = t.saveNoticeDesc;

    const saveNoticeBtns = document.querySelectorAll('.save-notice-banner button');
    if (saveNoticeBtns.length >= 3) {
      saveNoticeBtns[0].textContent = t.btnPrint;
      saveNoticeBtns[1].textContent = t.btnDownloadQrBanner;
      saveNoticeBtns[2].textContent = t.btnEditBanner;
    }

    const ticketSub = document.querySelector('.ticket-header p');
    if (ticketSub) ticketSub.textContent = t.ticketSubtitle;
    const ticketBadge = document.getElementById('ticketStatusBadge');
    if (ticketBadge) ticketBadge.textContent = t.ticketConfirmed;

    const ticketQrP = document.querySelector('.ticket-body > p');
    if (ticketQrP) ticketQrP.textContent = t.ticketQrHelp;

    const ticketServicesHeader = document.querySelector('#ticketServicesList')?.previousElementSibling;
    if (ticketServicesHeader) ticketServicesHeader.textContent = t.ticketServicesTitle;

    const servicesBadges = document.querySelectorAll('#ticketServicesList > span');
    if (servicesBadges.length >= 4) {
      servicesBadges[0].textContent = t.badgeGadget;
      servicesBadges[1].textContent = t.badgeAperitivo;
      servicesBadges[2].textContent = t.badgeCena;
      servicesBadges[3].textContent = t.badgePranzo;
    }

    // Ticket info table labels
    const ticketLabels = document.querySelectorAll('.ticket-info-item .lbl');
    const labelTexts = [
      t.lblPartecipante,
      t.lblVespaClub,
      t.lblCittaProvenienza,
      t.lblTesseraVci,
      t.lblTesseraMn,
      t.lblRuoloPartecipante,
      t.lblModelloAnno,
      t.lblTagliaTshirt,
      t.lblStatoQuota,
      t.lblPacchettoQuota
    ];
    ticketLabels.forEach((lbl, idx) => {
      if (labelTexts[idx]) lbl.textContent = labelTexts[idx];
    });

    // Ticket bottom buttons
    const downloadQrBtn = document.getElementById('downloadQrBtn');
    if (downloadQrBtn) downloadQrBtn.textContent = t.btnDownloadQrImg;

    const bottomTicketBtns = document.querySelectorAll('.ticket-body div[style*="margin-top:1.5rem"] button');
    if (bottomTicketBtns.length >= 4) {
      bottomTicketBtns[0].textContent = t.btnDownloadQrImg;
      bottomTicketBtns[1].textContent = t.btnPrintPass;
      bottomTicketBtns[2].textContent = t.btnEditPass;
      bottomTicketBtns[3].textContent = t.btnNewBooking;
    }

    // Modal Recupero
    const modalRecH2 = document.querySelector('#recoverModal h2');
    if (modalRecH2) modalRecH2.textContent = t.modalRecuperaTitle;
    const modalRecP = document.querySelector('#recoverModal p');
    if (modalRecP) modalRecP.textContent = t.modalRecuperaDesc;

    const recCogLbl = document.querySelector('label[for="recoverCognome"]');
    if (recCogLbl) recCogLbl.innerHTML = `${t.labelCognome} <span class="req">*</span>`;
    const recNomLbl = document.querySelector('label[for="recoverNome"]');
    if (recNomLbl) recNomLbl.innerHTML = `${t.labelNome} <span class="req">*</span>`;
    const recDateLbl = document.querySelector('label[for="recoverDataNascita"]');
    if (recDateLbl) recDateLbl.innerHTML = `${t.labelDataNascita} <span class="req">*</span>`;
    const recDateSmall = document.querySelector('#recoverDataNascita ~ small');
    if (recDateSmall) recDateSmall.textContent = t.modalRecuperaBdayHelp;

    const recCancelBtn = document.querySelector('#recoverModal .btn-secondary');
    if (recCancelBtn) recCancelBtn.textContent = t.modalRecuperaCancel;
    const recSubBtn = document.getElementById('recoverSubmitBtn');
    if (recSubBtn) recSubBtn.textContent = t.modalRecuperaSubmit;

    // Modal Duplicate
    const dupH2 = document.querySelector('#duplicateModal h2');
    if (dupH2) dupH2.textContent = t.modalDuplicateTitle;
    const dupCloseBtn = document.querySelector('#duplicateModal button');
    if (dupCloseBtn) dupCloseBtn.textContent = t.modalDuplicateClose;

    // Footer
    const footer = document.querySelector('footer');
    if (footer) footer.textContent = t.footerText;
  }

  updateSelectorUI() {
    const btns = document.querySelectorAll('.lang-btn');
    btns.forEach(btn => {
      const code = btn.getAttribute('data-lang');
      if (code === this.currentLang) {
        btn.classList.add('active');
        btn.style.background = '#FFFFFF';
        btn.style.color = '#3B0764';
        btn.style.boxShadow = '0 3px 10px rgba(0,0,0,0.18)';
        btn.style.borderColor = '#FFFFFF';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255, 255, 255, 0.15)';
        btn.style.color = '#FFFFFF';
        btn.style.boxShadow = 'none';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.35)';
      }
    });
  }

  renderLanguageSelector(containerId = 'langSelectorContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = `
      <div class="lang-selector-bar" style="display:inline-flex; align-items:center; background:rgba(0,0,0,0.22); padding:3px; border-radius:12px; gap:4px; border:1px solid rgba(255,255,255,0.25);">
    `;

    this.languages.forEach(l => {
      const isActive = (l.code === this.currentLang);
      html += `
        <button type="button" 
          class="lang-btn ${isActive ? 'active' : ''}" 
          data-lang="${l.code}" 
          onclick="window.vespaI18n.setLanguage('${l.code}')"
          title="${l.name}"
          style="border:1px solid ${isActive ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}; background:${isActive ? '#FFFFFF' : 'rgba(255,255,255,0.15)'}; color:${isActive ? '#3B0764' : '#FFFFFF'}; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.84rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s cubic-bezier(0.4,0,0.2,1); white-space:nowrap;">
          <span style="font-size:1.15rem; line-height:1;">${l.flag}</span>
          <span style="letter-spacing:0.3px;">${l.name}</span>
        </button>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }
}

// Global instance
window.vespaI18n = new VespaI18nManager();

document.addEventListener('DOMContentLoaded', () => {
  window.vespaI18n.renderLanguageSelector('langSelectorContainer');
  window.vespaI18n.applyTranslations();
});
