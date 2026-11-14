/**
 * Vespa Club Asti - Password Gate di Sessione per Pagina
 * Richiede la password al primo accesso della sessione per ciascuna pagina.
 */
(function () {
  var REQUIRED_PASSWORD = "Vespa_Asti2026!";

  function getPageKey() {
    var path = (window.location && window.location.pathname) ? window.location.pathname : "";
    var file = path.split("/").pop();
    if (!file || file === "/") file = "index.html";
    return "vespa_session_auth_" + file.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
  }

  var sessionKey = getPageKey();

  try {
    if (window.sessionStorage && window.sessionStorage.getItem(sessionKey) === "1") {
      return;
    }
  } catch (e) {
    // Se sessionStorage non è accessibile, prosegui mostrando comunque il gate
  }

  // Inietta immediatamente lo stile di blocco per nascondere la pagina prima del rendering del body
  var styleEl = document.createElement("style");
  styleEl.id = "vespa-auth-gate-style";
  styleEl.textContent =
    "body > *:not(#vespaAuthGateOverlay) { visibility: hidden !important; pointer-events: none !important; }\n" +
    "body { overflow: hidden !important; }";
  (document.head || document.documentElement).appendChild(styleEl);

  function mountGateOverlay() {
    if (!document.body || document.getElementById("vespaAuthGateOverlay")) return;

    var pageName = (document.title || "").trim() || sessionKey.replace("vespa_session_auth_", "");

    var overlay = document.createElement("div");
    overlay.id = "vespaAuthGateOverlay";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:999999",
      "background:linear-gradient(135deg, #003E6B 0%, #005A9C 55%, #0F172A 100%)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:1rem",
      "font-family:system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      "visibility:visible"
    ].join(";");

    overlay.innerHTML =
      '<div style="background:#FFFFFF; width:100%; max-width:420px; border-radius:16px; box-shadow:0 24px 50px rgba(0,0,0,0.45); border:2px solid #93C5FD; overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg, #005A9C 0%, #003E6B 100%); color:#FFFFFF; padding:1.4rem 1.5rem; text-align:center;">' +
          '<div style="font-size:2.2rem; line-height:1; margin-bottom:0.45rem;">🔒</div>' +
          '<h2 style="margin:0; font-size:1.25rem; font-weight:900; letter-spacing:0.3px; color:#FFFFFF;">Accesso Riservato</h2>' +
          '<p id="vespaAuthPageLabel" style="margin:0.35rem 0 0 0; font-size:0.82rem; opacity:0.9; color:#E0F2FE;"></p>' +
        '</div>' +
        '<form id="vespaAuthGateForm" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;" autocomplete="off">' +
          '<div>' +
            '<label for="vespaAuthGateInput" style="display:block; font-size:0.8rem; font-weight:800; color:#003E6B; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.4rem;">Password di accesso</label>' +
            '<div style="position:relative; display:flex; align-items:center;">' +
              '<input id="vespaAuthGateInput" type="password" placeholder="Inserisci la password..." autocomplete="current-password" required ' +
                'style="width:100%; padding:0.75rem 2.8rem 0.75rem 0.9rem; border:2px solid #CBD5E1; border-radius:10px; font-size:1rem; font-weight:700; color:#0F172A; outline:none; box-sizing:border-box;">' +
              '<button type="button" id="vespaAuthToggleVis" title="Mostra / Nascondi password" ' +
                'style="position:absolute; right:8px; background:transparent; border:none; cursor:pointer; font-size:1.15rem; padding:0.25rem 0.4rem; color:#475569;">👁️</button>' +
            '</div>' +
          '</div>' +
          '<div id="vespaAuthGateError" style="display:none; background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5; border-radius:8px; padding:0.6rem 0.85rem; font-size:0.85rem; font-weight:700;">' +
            '❌ Password errata. Riprova.' +
          '</div>' +
          '<button type="submit" id="vespaAuthGateSubmit" ' +
            'style="width:100%; padding:0.85rem 1.25rem; background:linear-gradient(135deg, #005A9C 0%, #003E6B 100%); color:#FFFFFF; border:none; border-radius:10px; font-size:1rem; font-weight:900; cursor:pointer; box-shadow:0 4px 12px rgba(0,90,156,0.35);">' +
            '🔓 Accedi' +
          '</button>' +
        '</form>' +
      '</div>';

    document.body.appendChild(overlay);

    var pageLabel = document.getElementById("vespaAuthPageLabel");
    if (pageLabel) pageLabel.textContent = pageName;

    var form = document.getElementById("vespaAuthGateForm");
    var input = document.getElementById("vespaAuthGateInput");
    var toggleBtn = document.getElementById("vespaAuthToggleVis");
    var errorEl = document.getElementById("vespaAuthGateError");

    // Blocca la propagazione degli eventi verso i listener della pagina sottostante
    ["click", "mousedown", "keydown", "keyup", "keypress"].forEach(function (evtName) {
      overlay.addEventListener(evtName, function (e) {
        e.stopPropagation();
      });
    });

    if (toggleBtn && input) {
      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var isPwd = input.type === "password";
        input.type = isPwd ? "text" : "password";
        toggleBtn.textContent = isPwd ? "🙈" : "👁️";
        input.focus();
      });
    }

    function tryUnlock() {
      var val = input ? input.value : "";
      if (val === REQUIRED_PASSWORD) {
        try {
          if (window.sessionStorage) {
            window.sessionStorage.setItem(sessionKey, "1");
          }
        } catch (err) {}

        var st = document.getElementById("vespa-auth-gate-style");
        if (st) st.remove();
        overlay.remove();

        if (window.vespaScanner && typeof window.vespaScanner.focusInput === "function") {
          window.vespaScanner.focusInput();
        }
      } else {
        if (errorEl) errorEl.style.display = "block";
        if (input) {
          input.style.borderColor = "#DC2626";
          input.focus();
          input.select();
        }
      }
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        tryUnlock();
      });
    }

    if (input) {
      input.addEventListener("keydown", function (e) {
        if (errorEl && errorEl.style.display !== "none" && e.key !== "Enter") {
          errorEl.style.display = "none";
          input.style.borderColor = "#CBD5E1";
        }
      });
      input.focus();
      setTimeout(function () {
        if (document.getElementById("vespaAuthGateOverlay")) input.focus();
      }, 60);
    }
  }

  if (document.body) {
    mountGateOverlay();
  } else {
    document.addEventListener("DOMContentLoaded", mountGateOverlay);
  }
})();
