# 📋 Istruzioni Deploy: Vespa Booking App su Render & MongoDB Atlas

Questo progetto è configurato con un **backend ibrido**:
- Se è presente la variabile `MONGO_URI`, si collega al cluster cloud MongoDB Atlas.
- Se `MONGO_URI` non è impostata, usa il file locale `dati_prenotazioni.json` (funziona quindi sempre sia offline che online).

---

## 1. Configurazione MongoDB Atlas
1. Accedi alla tua dashboard di [MongoDB Atlas](https://cloud.mongodb.com).
2. Seleziona il tuo cluster e vai su **"Database"** &rarr; **"Connect"** &rarr; **"Drivers"** (Node.js).
3. Copia la stringa di connessione:
   ```
   mongodb+srv://<username>:<password>@cluster0.xyz.mongodb.net/vespa_booking?retryWrites=true&w=majority
   ```
   *(Sostituisci `<username>` e `<password>` con le credenziali del database user e inserisci `vespa_booking` come nome del database)*.
4. Assicurati che in **"Network Access"** sia consentito l'accesso da ovunque (`0.0.0.0/0`) per permettere a Render di connettersi.

---

## 2. Pubblicazione su GitHub / Git
1. Inizializza o aggiorna il repository git nella cartella del progetto:
   ```bash
   git init
   git add .
   git commit -m "Predisposizione deploy cloud Render e MongoDB Atlas"
   ```
2. Collega il tuo repository remoto su GitHub e fai il `git push`.

---

## 3. Creazione del Web Service su Render
1. Accedi a [Render Dashboard](https://dashboard.render.com).
2. Clicca su **"New +"** &rarr; **"Web Service"**.
3. Collega il tuo repository GitHub (`vespa-booking-app`).
4. Configura i parametri:
   - **Name**: `vespa-booking-app` (o quello che preferisci)
   - **Region**: `Frankfurt (EU Central)` *(la più veloce per l'Italia)*
   - **Branch**: `main` (o `master`)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

5. Nella sezione **"Environment Variables"**, aggiungi:
   - `MONGO_URI` = `mongodb+srv://...la tua stringa atlas...`
   - `ENABLE_KEEP_ALIVE` = `true`
   - `APP_URL` = `https://vespa-booking-app.onrender.com` *(l'URL che Render assegna al tuo servizio)*

6. Clicca su **"Create Web Service"**.

---

## 4. Come eliminare il Cold Start (Attesa di 50s)
Abbiamo predisposto **due livelli** di protezione anti-sleep:

1. **Auto-Ping interno**: impostando `ENABLE_KEEP_ALIVE=true` e `APP_URL`, il server stesso invia una richiesta HTTP leggera a `/api/ping` ogni 10 minuti per mantenersi sveglio.
2. **Ping esterno gratuito (Consigliato per massima affidabilità)**:
   - Registrati gratuitamente su [cron-job.org](https://cron-job.org) o [uptimerobot.com](https://uptimerobot.com).
   - Crea un monitoraggio HTTP di tipo `GET`:
     `https://tuo-servizio.onrender.com/api/ping`
   - Frequenza: **ogni 10 o 14 minuti**.
   - **Risultato:** Render non entrerà mai in modalità sleep e risponderà istantaneamente 24 ore su 24.

