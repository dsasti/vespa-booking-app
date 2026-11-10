/**
 * Vespa Club Booking System - QR Code Generator & Ticket Renderer
 */

class VespaQRGenerator {
  constructor() {
    this.qrInstance = null;
  }

  // Genera ed inserisce il QR Code nel container specificato
  renderQRCode(containerId, payload) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // Pulisce il container

    // Formato compatto per evitare overflow nella libreria QRCode
    const qrData = typeof payload === 'string' ? payload : (payload.id || JSON.stringify({
      id: payload.id,
      cognome: payload.cognome,
      nome: payload.nome
    }));

    let qrRendered = false;

    if (window.QRCode) {
      try {
        const correctLevel = (window.QRCode.CorrectLevel && window.QRCode.CorrectLevel.M !== undefined)
          ? window.QRCode.CorrectLevel.M
          : 0;

        new QRCode(container, {
          text: qrData,
          width: 220,
          height: 220,
          colorDark: "#000000",
          colorLight: "#FFFFFF",
          correctLevel: correctLevel
        });

        // Risolvi il bug di qrcode.js: qrcode.js genera sia <canvas> che <img>.
        // Se entrambi rimangono visibili (a causa di css display:block o flex), l'utente vede due QR affiancati.
        // Manteniamo visibile solo l'immagine (o il canvas se l'img non c'è).
        const imgs = container.querySelectorAll('img');
        const canvases = container.querySelectorAll('canvas');
        if (imgs.length > 0 && canvases.length > 0) {
          canvases.forEach(c => c.style.display = 'none');
          imgs.forEach(i => {
            i.style.display = 'block';
            i.style.margin = '0 auto';
          });
        }

        qrRendered = true;
      } catch (err) {
        console.warn('QRCode lib error, falling back to image:', err);
      }
    }

    if (!qrRendered) {
      // Fallback usando API standard QR con margine bianco
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=15&data=${encodeURIComponent(qrData)}`;
      img.alt = `QR Code ${payload.id || ''}`;
      img.style.maxWidth = '220px';
      img.style.height = 'auto';
      img.style.borderRadius = '8px';
      img.style.backgroundColor = '#FFFFFF';
      container.appendChild(img);
    }
  }

  // Permette al partecipante di scaricare l'immagine del proprio QR Code Pass con SPESSO BORDO BIANCO
  downloadQRPass(id, cognome, nome) {
    const qrContainer = document.getElementById('ticketQrContainer');
    if (!qrContainer) return;

    const canvas = qrContainer.querySelector('canvas');
    const img = qrContainer.querySelector('img');

    if (!canvas && !img) {
      alert("Impossibile generare l'immagine del QR Code.");
      return;
    }

    const processAndDownload = (sourceElement) => {
      try {
        const srcW = sourceElement.naturalWidth || sourceElement.width || 220;
        const srcH = sourceElement.naturalHeight || sourceElement.height || 220;

        // SPESSO BORDO BIANCO (45px di quiet zone su ogni lato per massima leggibilità ottica)
        const borderWidth = 45;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = srcW + (borderWidth * 2);
        outCanvas.height = srcH + (borderWidth * 2);

        const ctx = outCanvas.getContext('2d');
        if (!ctx) throw new Error('Contesto canvas 2D non disponibile');

        // Riempimento sfondo bianco puro al 100% (non trasparente)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

        // Disegna il QR code centrato con il generoso bordo bianco
        ctx.drawImage(sourceElement, borderWidth, borderWidth, srcW, srcH);

        const dataUrl = outCanvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = dataUrl;
        const safeCognome = (cognome || 'Partecipante').toString().trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
        const safeId = (id || 'VCA-2026').toString().trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
        a.download = `QR_Pass_${safeId}_${safeCognome}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error('Errore durante download QR con bordo bianco:', err);
        // Fallback di emergenza
        const fallbackUrl = canvas ? canvas.toDataURL("image/png") : (img ? img.src : null);
        if (fallbackUrl) {
          const a = document.createElement('a');
          a.href = fallbackUrl;
          a.download = `QR_Pass_${id || 'VCA'}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    };

    if (canvas) {
      processAndDownload(canvas);
    } else if (img) {
      if (img.complete && img.naturalWidth > 0) {
        processAndDownload(img);
      } else {
        img.onload = () => processAndDownload(img);
      }
    }
  }

  // Stampa il biglietto pass
  printTicket() {
    window.print();
  }
}

window.vespaQR = new VespaQRGenerator();
