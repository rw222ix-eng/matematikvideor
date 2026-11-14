// Inloggningen till spelen (Rickard 2026-11-14: skolans Google-konto i stället för klassnyckeln).
//
// Sidan frågar spelservern vem eleven är (GET /spel/inlogg), visar Googles knapp (Google Identity Services) och skickar
// det id-token Google ger till servern (POST /spel/inlogg). Servern kontrollerar tokenet, slår upp klassen och sätter en
// kaka som skript inte kan läsa. Sidan sparar ingenting själv: varken token, adress eller namn.
//
// Kontraktet med spelservern (geogebra-guidens repo, server/):
// (version 1, står överst i server/src/inlogg.js):
//   GET  /spel/inlogg      { inloggad, klass, klientId, nonce, prov }   klass är null utanför klasslistorna
//   POST /spel/inlogg      { token }  ger { inloggad: true, klass } eller { fel, text }
//                          fel: token, nonce, doman, adress, takt, avstangd, google. text är en färdig mening.
//   POST /spel/inlogg/ut   tar bort kakan
//   GET  /spel/inlogg/provtoken?epost=…&nonce=…   bara lokalt: ett provtoken som POST tar emot som Googles
// klientId är appens klient-id hos Google (inte hemligt), tomt tills det finns. Utan det visas ingen knapp, och eleven
// spelar som gäst. nonce går till Googles knapp och kommer tillbaka i tokenet. Servern jämför den med en kaka, så att
// ett token inte går att använda i en annan webbläsare. Den gäller en timme: svarar servern fel "nonce" hämtas en ny
// och knappen ritas om. prov: servern tar emot provkonton (bara lokalt), och då visas provfältet på localhost.
(function () {
  "use strict";
  var VAG = "/spel/inlogg", GSI = "https://accounts.google.com/gsi/client";
  var LOKAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var $ = function (id) { return document.getElementById(id); };
  var lage = $("lage"), google = $("google"), fel = $("fel"), ut = $("ut"), tillbaka = $("tillbaka"), gast = $("gast"), prov = $("prov");

  // Vart eleven ska efteråt: bara en väg på den här sidan. Allt annat blir fliken Spel.
  var till = (function () {
    var t = new URLSearchParams(location.search).get("till") || "";
    if (!/^\/(?![\/\\])[A-Za-z0-9\-._~\/#?=&%]*$/.test(t)) return "/#spel";
    try { return new URL(t, location.origin).origin === location.origin ? t : "/#spel"; } catch (e) { return "/#spel"; }
  })();
  tillbaka.href = till;

  var ny = function (tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  var visaFel = function (t) { fel.textContent = t || ""; };
  // Servern skickar en färdig mening (text). De här står bara när svaret saknas eller inte har någon.
  var FEL = {
    token: "Inloggningen gick inte igenom. Försök en gång till.",
    nonce: "Sidan har stått öppen för länge. Tryck på knappen en gång till.",
    doman: "Det där var inte ett skolkonto. Välj kontot du har i skolan, eller spela som gäst.",
    takt: "För många försök just nu. Vänta en minut och försök igen.",
    avstangd: "Inloggningen är inte påslagen än. Spela som gäst så länge.",
    google: "Google svarar inte just nu. Försök igen om en stund, eller spela som gäst.",
    server: "Spelservern svarar inte just nu. Du kan spela som gäst och logga in senare.",
  };
  var nonce = null;

  var anrop = function (vag, kropp) {
    var o = { cache: "no-store", credentials: "same-origin" };
    if (kropp !== undefined) { o.method = "POST"; o.headers = { "Content-Type": "application/json" }; o.body = JSON.stringify(kropp); }
    return fetch(vag, o).then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, svar: j }; }); })
      .catch(function () { return { ok: false, status: 0, svar: null }; });
  };

  // Läget ritas om från början varje gång, så att snabba tryck aldrig lämnar två lägen på sidan.
  var upptagen = false, lamnar = null;
  function rita(s) {
    var inne = !!(s && s.inloggad);
    lage.className = inne ? "lage klart" : "lage";
    lage.replaceChildren();
    ut.hidden = !inne; ut.disabled = false;
    google.hidden = inne; prov.hidden = inne || !(LOKAL && s && s.prov);
    gast.hidden = inne;
    if (inne) {
      lage.append(ny("span", s.klass ? "Inloggad · " + s.klass : "Inloggad", "stor"),
        ny("span", s.klass ? "Dina poäng räknas på klassens topplista." : "Din klass finns inte med än. Du spelar och står på den allmänna listan. Säg till din lärare, så läggs klassen in."));
      tillbaka.textContent = "Till spelen";
    } else {
      tillbaka.textContent = "Spela som gäst";
    }
  }

  // ── Googles knapp ──
  var gsiLaddad = null;
  function laddaGsi() {
    if (gsiLaddad) return gsiLaddad;
    gsiLaddad = new Promise(function (klar, nej) {
      var s = document.createElement("script");
      s.src = GSI; s.async = true;
      s.onload = function () { (window.google && window.google.accounts && window.google.accounts.id) ? klar() : nej(); };
      s.onerror = nej;
      document.head.appendChild(s);
    });
    return gsiLaddad;
  }
  function visaKnapp(s) {
    if (!s || !s.klientId) {
      google.hidden = true;
      if (!(LOKAL && s && s.prov)) lage.textContent = s ? FEL.avstangd : FEL.server;
      return;
    }
    laddaGsi().then(function () {
      var id = window.google.accounts.id, inst = { client_id: s.klientId, callback: tokenFranGoogle, auto_select: false, ux_mode: "popup", use_fedcm_for_button: false };
      if (s.nonce) inst.nonce = s.nonce;
      id.initialize(inst);
      google.replaceChildren();
      id.renderButton(google, { type: "standard", theme: "filled_blue", size: "large", shape: "pill", text: "signin_with", logo_alignment: "left", locale: "sv", width: Math.max(200, Math.min(320, google.clientWidth || 320)) });
    }, function () {
      gsiLaddad = null; google.hidden = true;
      lage.textContent = "Googles inloggning går inte att nå härifrån. Spela som gäst, eller försök på ett annat nät.";
    });
  }
  function tokenFranGoogle(svar) {
    if (!svar || typeof svar.credential !== "string") { visaFel(FEL.token); return; }
    loggaIn(svar.credential);
  }

  function loggaIn(token) {
    if (upptagen) return;
    upptagen = true; visaFel("");
    lage.textContent = "Loggar in …";
    anrop(VAG, { token: token }).then(function (r) {
      upptagen = false;
      if (r.ok && r.svar && r.svar.inloggad) {
        rita(r.svar);
        lage.append(ny("span", " Du skickas tillbaka till spelen …"));
        clearTimeout(lamnar);
        lamnar = setTimeout(function () { location.replace(till); }, 1600);
        tillbaka.focus();
        return;
      }
      var kod = (r.svar && r.svar.fel) || "";
      visaFel((r.svar && typeof r.svar.text === "string" && r.svar.text) || FEL[kod] || (r.status === 0 || r.status >= 500 ? FEL.server : FEL.token));
      // Noncen är förbrukad eller för gammal: hämta en ny och rita om knappen, så att nästa tryck går igenom.
      if (kod === "nonce") start(true); else lage.textContent = "";
    });
  }

  ut.addEventListener("click", function () {
    if (upptagen) return;
    upptagen = true; ut.disabled = true; clearTimeout(lamnar); visaFel("");
    anrop(VAG + "/ut", {}).then(function (r) {
      upptagen = false;
      if (!r.ok) { ut.disabled = false; visaFel(FEL.server); return; }
      // Google ska inte välja samma konto av sig självt nästa gång på en delad dator.
      try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (e) {}
      start();
    });
  });

  prov.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("provkonto").value.trim();
    if (!v) { $("provkonto").focus(); return; }
    if (upptagen) return;
    // Som Googles knapp: servern ger ett token för provkontot, och det skickas in på samma väg.
    anrop(VAG + "/provtoken?" + new URLSearchParams({ epost: v, nonce: nonce || "" })).then(function (r) {
      if (r.ok && r.svar && typeof r.svar.token === "string") loggaIn(r.svar.token);
      else visaFel((r.svar && r.svar.text) || "Provkontot gick inte att hämta.");
    });
  });

  // behallFel: felet från förra försöket står kvar medan knappen ritas om.
  var startNr = 0;
  function start(behallFel) {
    var nr = ++startNr;
    if (behallFel !== true) visaFel("");
    lage.className = "lage"; lage.textContent = "Hämtar …";
    anrop(VAG).then(function (r) {
      if (nr !== startNr) return;
      var s = r.ok && r.svar && typeof r.svar.inloggad === "boolean" ? r.svar : null;
      nonce = s && typeof s.nonce === "string" ? s.nonce : null;
      rita(s);
      if (!s || !s.inloggad) visaKnapp(s);
    });
  }
  // Tillbaka-knappen i webbläsaren kan visa en sparad sida: fråga om, så att läget stämmer.
  addEventListener("pageshow", function (e) { if (e.persisted) start(); });
  start();
})();
