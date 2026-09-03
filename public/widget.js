/**
 * Kate — pöytävarauswidget.
 *
 * Ajetaan ravintolan omalla verkkosivulla:
 *
 *   <div id="kate-reservation"></div>
 *   <script src="https://…/widget.js" data-restaurant="ravintolan-slug"></script>
 *
 * ---------------------------------------------------------------------
 * MIKSI SHADOW DOM
 * ---------------------------------------------------------------------
 *
 * Widget laskeutuu sivustolle jonka CSS:ää emme ole nähneet. Jossain
 * on `input { width: 100% !important }` ja jossain `* { box-sizing:
 * content-box }`. Ilman varjopuuta widget näyttäisi eri ravintolassa
 * eri tavalla, ja rikkoutuisi juuri sillä sivulla jota emme testanneet.
 *
 * Eristys menee molempiin suuntiin: widgetin tyylit eivät myöskään
 * vuoda ravintolan sivulle.
 *
 * ---------------------------------------------------------------------
 * MIKSI FONTTIA EI ASETETA
 * ---------------------------------------------------------------------
 *
 * Widgetin pitää näyttää ravintolan omalta osalta eikä upotetulta
 * palvelulta. Yksi asia riittää siihen enemmän kuin mikään muu:
 * kirjasin peritään sivustolta. Väri ja kulmien pyöristys tulevat
 * asetuksista, loput seuraa sivustoa.
 *
 * ---------------------------------------------------------------------
 * MITÄ TÄMÄ EI TARKISTA
 * ---------------------------------------------------------------------
 *
 * Ei mitään. Vapaat ajat ovat ehdotus siitä hetkestä jolloin ne
 * haettiin; salissa istuutuva walk-in vie ajan sekunnissa. Varauksen
 * hyväksyy palvelin, ja tämä näyttää vastauksen. Jos aika ehti mennä,
 * asiakas saa siitä selkeän viestin eikä rikkinäistä sivua.
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Mistä widget tietää kuka ja missä                                   */
  /* ------------------------------------------------------------------ */

  /*
   * currentScript toimii tavallisella script-tagilla. async- tai
   * module-latauksessa se on null, joten haetaan tagi tunnisteella.
   */
  var script =
    document.currentScript || document.querySelector("script[data-restaurant]");
  if (!script) return;

  var slug = script.getAttribute("data-restaurant");
  if (!slug) return;

  /* API on samassa paikassa kuin tämä tiedosto. */
  var origin = new URL(script.src, location.href).origin;
  var api = origin + "/api/varaus";

  /*
   * Kiinnityskohta etsitään vasta kun sivu on luettu.
   *
   * Ravintolan sivupohja voi laittaa skriptin <head>-osaan, jolloin
   * div ei ole vielä olemassa kun tämä ajetaan. Ilman odotusta widget
   * ei ilmestyisi lainkaan juuri niillä sivustoilla joilla skriptit
   * ladataan siististi ylhäällä.
   */
  var mount, root, wrap;

  function etsiJuuri() {
    return (
      document.getElementById("kate-reservation") ||
      document.querySelector("[data-kate-reservation]")
    );
  }

  /* ------------------------------------------------------------------ */
  /* Kieli                                                               */
  /* ------------------------------------------------------------------ */

  /*
   * Sanakirja on tässä tiedostossa eikä jaettuna moduulina.
   *
   * Widget ei voi tuoda mitään: se on yksi tiedosto joka ladataan
   * vieraalta sivulta. Kopio on tietoinen hinta siitä että widget on
   * riippumaton — ja testi tarkistaa että kaikilla kielillä on samat
   * avaimet.
   */
  var TEKSTIT = {
    fi: {
      heading: "Varaa pöytä",
      guests: "Henkilömäärä",
      person: "henkilö",
      people: "henkilöä",
      date: "Päivä",
      time: "Aika",
      loading: "Haetaan vapaita aikoja…",
      noTimes: "Tälle päivälle ei ole vapaita aikoja.",
      noTimesHint: "Kokeile toista päivää tai pienempää seuruetta.",
      name: "Nimi",
      phone: "Puhelin",
      email: "Sähköposti",
      optional: "vapaaehtoinen",
      note: "Toiveet",
      notePlaceholder: "Esimerkiksi pöytätoive tai juhlan aihe",
      allergies: "Allergiat",
      allergiesPlaceholder: "Esimerkiksi pähkinä, gluteeni, laktoosi",
      reference: "Varausnumero",
      cancelUntil: "Voit perua varauksen verkossa {tunnit} tuntia ennen varausaikaa. Sen jälkeen soita ravintolaan.",
      submit: "Vahvista varaus",
      submitting: "Lähetetään…",
      confirmed: "Varaus vahvistettu",
      confirmedTables: "Pöytä",
      cancelTitle: "Peru varaus",
      cancelHint: "Tallenna tämä linkki. Sillä voit perua varauksen.",
      closed: "Verkkovaraus ei ole tällä hetkellä käytössä.",
      newBooking: "Tee uusi varaus",
      errGeneric: "Varaus ei onnistunut. Yritä hetken kuluttua uudelleen.",
      errTaken: "Aika ehti varautua. Valitse toinen aika.",
      errParty: "Tämä seurueen koko ei käy verkkovaraukseen.",
      errDate: "Tämä päivä ei ole varattavissa.",
      errTooLate: "Aika on liian lähellä. Soita ravintolaan.",
      errTooMany: "Sinulla on jo useita voimassa olevia varauksia.",
      errClosed: "Ravintola ei ota varauksia tähän aikaan.",
      errName: "Kirjoita nimi.",
      errPhone: "Kirjoita puhelinnumero.",
      errNetwork: "Yhteys ei toiminut. Tarkista verkkoyhteys.",
    },
    en: {
      heading: "Book a table",
      guests: "Party size",
      person: "person",
      people: "people",
      date: "Date",
      time: "Time",
      loading: "Looking for free times…",
      noTimes: "There are no free times on this day.",
      noTimesHint: "Try another day or a smaller party.",
      name: "Name",
      phone: "Phone",
      email: "Email",
      optional: "optional",
      note: "Requests",
      notePlaceholder: "For example a table wish or an occasion",
      allergies: "Allergies",
      allergiesPlaceholder: "For example nuts, gluten, lactose",
      reference: "Booking number",
      cancelUntil: "You can cancel online up to {tunnit} hours before the booking. After that, please call the restaurant.",
      submit: "Confirm booking",
      submitting: "Sending…",
      confirmed: "Booking confirmed",
      confirmedTables: "Table",
      cancelTitle: "Cancel booking",
      cancelHint: "Save this link. You can cancel the booking with it.",
      closed: "Online booking is not available at the moment.",
      newBooking: "Make another booking",
      errGeneric: "The booking did not go through. Please try again shortly.",
      errTaken: "That time was just taken. Choose another one.",
      errParty: "That party size cannot be booked online.",
      errDate: "That day cannot be booked.",
      errTooLate: "That time is too soon. Please call the restaurant.",
      errTooMany: "You already have several bookings.",
      errClosed: "The restaurant does not take bookings at that time.",
      errName: "Please write a name.",
      errPhone: "Please write a phone number.",
      errNetwork: "The connection failed. Check your network.",
    },
    sv: {
      heading: "Boka bord",
      guests: "Antal gäster",
      person: "gäst",
      people: "gäster",
      date: "Dag",
      time: "Tid",
      loading: "Söker lediga tider…",
      noTimes: "Det finns inga lediga tider den här dagen.",
      noTimesHint: "Prova en annan dag eller ett mindre sällskap.",
      name: "Namn",
      phone: "Telefon",
      email: "E-post",
      optional: "frivillig",
      note: "Önskemål",
      notePlaceholder: "Till exempel bordsönskemål eller ett firande",
      allergies: "Allergier",
      allergiesPlaceholder: "Till exempel nötter, gluten, laktos",
      reference: "Bokningsnummer",
      cancelUntil: "Du kan avboka på nätet fram till {tunnit} timmar före bokningen. Därefter, ring restaurangen.",
      submit: "Bekräfta bokningen",
      submitting: "Skickar…",
      confirmed: "Bokningen är bekräftad",
      confirmedTables: "Bord",
      cancelTitle: "Avboka",
      cancelHint: "Spara den här länken. Med den kan du avboka.",
      closed: "Webbokning är inte i bruk just nu.",
      newBooking: "Gör en ny bokning",
      errGeneric: "Bokningen gick inte igenom. Försök igen om en stund.",
      errTaken: "Tiden hann bli bokad. Välj en annan tid.",
      errParty: "Det sällskapet går inte att boka på webben.",
      errDate: "Den dagen går inte att boka.",
      errTooLate: "Tiden är för nära. Ring restaurangen.",
      errTooMany: "Du har redan flera bokningar.",
      errClosed: "Restaurangen tar inte bokningar den tiden.",
      errName: "Skriv ett namn.",
      errPhone: "Skriv ett telefonnummer.",
      errNetwork: "Anslutningen fungerade inte. Kontrollera nätverket.",
    },
    da: {
      heading: "Book et bord",
      guests: "Antal gæster",
      person: "gæst",
      people: "gæster",
      date: "Dag",
      time: "Tid",
      loading: "Finder ledige tider…",
      noTimes: "Der er ingen ledige tider denne dag.",
      noTimesHint: "Prøv en anden dag eller et mindre selskab.",
      name: "Navn",
      phone: "Telefon",
      email: "E-mail",
      optional: "valgfri",
      note: "Ønsker",
      notePlaceholder: "For eksempel bordønske eller en anledning",
      allergies: "Allergier",
      allergiesPlaceholder: "For eksempel nødder, gluten, laktose",
      reference: "Reservationsnummer",
      cancelUntil: "Du kan afbestille online indtil {tunnit} timer før reservationen. Derefter, ring til restauranten.",
      submit: "Bekræft bestillingen",
      submitting: "Sender…",
      confirmed: "Bestillingen er bekræftet",
      confirmedTables: "Bord",
      cancelTitle: "Afbestil",
      cancelHint: "Gem dette link. Med det kan du afbestille.",
      closed: "Onlinebestilling er ikke i brug lige nu.",
      newBooking: "Lav en ny bestilling",
      errGeneric: "Bestillingen gik ikke igennem. Prøv igen om lidt.",
      errTaken: "Tiden nåede at blive booket. Vælg en anden tid.",
      errParty: "Det selskab kan ikke bestilles online.",
      errDate: "Den dag kan ikke bestilles.",
      errTooLate: "Tiden er for tæt på. Ring til restauranten.",
      errTooMany: "Du har allerede flere bestillinger.",
      errClosed: "Restauranten tager ikke bestillinger på det tidspunkt.",
      errName: "Skriv et navn.",
      errPhone: "Skriv et telefonnummer.",
      errNetwork: "Forbindelsen virkede ikke. Tjek dit netværk.",
    },
    tr: {
      heading: "Masa ayırt",
      guests: "Kişi sayısı",
      person: "kişi",
      people: "kişi",
      date: "Gün",
      time: "Saat",
      loading: "Boş saatler aranıyor…",
      noTimes: "Bu gün için boş saat yok.",
      noTimesHint: "Başka bir gün ya da daha küçük bir grup deneyin.",
      name: "Ad",
      phone: "Telefon",
      email: "E-posta",
      optional: "isteğe bağlı",
      note: "İstekler",
      notePlaceholder: "Örneğin masa tercihi ya da özel bir gün",
      allergies: "Alerjiler",
      allergiesPlaceholder: "Örneğin fındık, gluten, laktoz",
      reference: "Rezervasyon numarası",
      cancelUntil: "Rezervasyondan {tunnit} saat öncesine kadar internetten iptal edebilirsiniz. Sonrasında lütfen restoranı arayın.",
      submit: "Rezervasyonu onayla",
      submitting: "Gönderiliyor…",
      confirmed: "Rezervasyon onaylandı",
      confirmedTables: "Masa",
      cancelTitle: "Rezervasyonu iptal et",
      cancelHint: "Bu bağlantıyı saklayın. Rezervasyonu onunla iptal edebilirsiniz.",
      closed: "Çevrimiçi rezervasyon şu anda kullanımda değil.",
      newBooking: "Yeni rezervasyon yap",
      errGeneric: "Rezervasyon yapılamadı. Biraz sonra tekrar deneyin.",
      errTaken: "Bu saat az önce doldu. Başka bir saat seçin.",
      errParty: "Bu grup büyüklüğü çevrimiçi ayırtılamaz.",
      errDate: "Bu gün ayırtılamaz.",
      errTooLate: "Saat çok yakın. Lütfen restoranı arayın.",
      errTooMany: "Zaten birkaç rezervasyonunuz var.",
      errClosed: "Restoran bu saatte rezervasyon almıyor.",
      errName: "Bir ad yazın.",
      errPhone: "Bir telefon numarası yazın.",
      errNetwork: "Bağlantı çalışmadı. Ağınızı kontrol edin.",
    },
    et: {
      heading: "Broneeri laud",
      guests: "Külaliste arv",
      person: "külaline",
      people: "külalist",
      date: "Päev",
      time: "Kellaaeg",
      loading: "Otsime vabu aegu…",
      noTimes: "Sellel päeval ei ole vabu aegu.",
      noTimesHint: "Proovi teist päeva või väiksemat seltskonda.",
      name: "Nimi",
      phone: "Telefon",
      email: "E-post",
      optional: "vabatahtlik",
      note: "Soovid",
      notePlaceholder: "Näiteks lauasoov või tähtpäev",
      allergies: "Allergiad",
      allergiesPlaceholder: "Näiteks pähklid, gluteen, laktoos",
      reference: "Broneeringu number",
      cancelUntil: "Saad broneeringu veebis tühistada kuni {tunnit} tundi enne broneeringut. Pärast seda helista restorani.",
      submit: "Kinnita broneering",
      submitting: "Saadame…",
      confirmed: "Broneering on kinnitatud",
      confirmedTables: "Laud",
      cancelTitle: "Tühista broneering",
      cancelHint: "Salvesta see link. Sellega saad broneeringu tühistada.",
      closed: "Veebibroneerimine ei ole praegu kasutusel.",
      newBooking: "Tee uus broneering",
      errGeneric: "Broneering ei õnnestunud. Proovi hetke pärast uuesti.",
      errTaken: "Aeg jõuti ära broneerida. Vali teine aeg.",
      errParty: "Sellist seltskonda ei saa veebis broneerida.",
      errDate: "Seda päeva ei saa broneerida.",
      errTooLate: "Aeg on liiga lähedal. Helista restorani.",
      errTooMany: "Sul on juba mitu broneeringut.",
      errClosed: "Restoran ei võta sel ajal broneeringuid.",
      errName: "Kirjuta nimi.",
      errPhone: "Kirjuta telefoninumber.",
      errNetwork: "Ühendus ei töötanud. Kontrolli võrku.",
    },
  };

  var kieli = (script.getAttribute("data-lang") || "").toLowerCase();
  if (!TEKSTIT[kieli]) {
    kieli = (navigator.language || "fi").slice(0, 2).toLowerCase();
  }
  if (!TEKSTIT[kieli]) kieli = "fi";

  var t = TEKSTIT[kieli];
  var locale = { fi: "fi-FI", en: "en-GB", sv: "sv-SE", da: "da-DK", tr: "tr-TR", et: "et-EE" }[kieli];

  /* ------------------------------------------------------------------ */
  /* Apureita                                                            */
  /* ------------------------------------------------------------------ */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    for (var k in props || {}) {
      if (k === "class") node.className = props[k];
      /* textContent eikä innerHTML: sisältö voi olla ravintolan nimi. */
      else if (k === "text") node.textContent = props[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== null && props[k] !== undefined) node.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (kid) {
      if (kid) node.appendChild(kid);
    });
    return node;
  }

  function pvmTeksti(iso) {
    var osat = iso.split("-");
    var d = new Date(Number(osat[0]), Number(osat[1]) - 1, Number(osat[2]));
    return d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function lisaaPaivia(iso, n) {
    var osat = iso.split("-");
    var d = new Date(Number(osat[0]), Number(osat[1]) - 1, Number(osat[2]));
    d.setDate(d.getDate() + n);
    var kk = String(d.getMonth() + 1);
    var pp = String(d.getDate());
    return d.getFullYear() + "-" + (kk.length < 2 ? "0" : "") + kk + "-" + (pp.length < 2 ? "0" : "") + pp;
  }

  var VIRHEET = {
    taken: "errTaken",
    party: "errParty",
    date: "errDate",
    too_late: "errTooLate",
    too_many: "errTooMany",
    closed: "errClosed",
    name: "errName",
    phone: "errPhone",
  };

  function virheteksti(koodi) {
    return t[VIRHEET[koodi]] || t.errGeneric;
  }

  /* ------------------------------------------------------------------ */
  /* Tyylit                                                              */
  /* ------------------------------------------------------------------ */

  var CSS = [
    ":host { display: block; }",
    "*, *::before, *::after { box-sizing: border-box; }",

    /*
     * Kirjasin peritään sivustolta, värit eivät.
     *
     * Peritty väri olisi arpapeli: widget voi olla vaalealla tai
     * tummalla pohjalla, ja peritty tekstiväri katoaisi jommallakummalla.
     */
    ".w { font: inherit; color: var(--k-text); background: var(--k-bg);",
    "  line-height: 1.45; max-width: 34rem; }",

    ".h { margin: 0 0 1.25rem; font-size: 1.35rem; font-weight: 600;",
    "  letter-spacing: -0.01em; }",

    ".row { display: grid; gap: 0.875rem; grid-template-columns: 1fr 1fr; }",
    "@media (max-width: 26rem) { .row { grid-template-columns: 1fr; } }",

    ".f { display: block; margin-bottom: 0.875rem; }",
    ".l { display: block; margin-bottom: 0.375rem; font-size: 0.8125rem;",
    "  font-weight: 600; letter-spacing: 0.01em; }",
    ".opt { font-weight: 400; color: var(--k-dim); }",

    "input, select, textarea { width: 100%; font: inherit; font-size: 1rem;",
    "  padding: 0.6875rem 0.75rem; color: var(--k-text); background: var(--k-field);",
    "  border: 1px solid var(--k-line); border-radius: var(--k-r);",
    "  -webkit-appearance: none; appearance: none; }",
    "select { background-image: none; }",
    "textarea { min-height: 4.5rem; resize: vertical; }",
    "input:focus-visible, select:focus-visible, textarea:focus-visible,",
    "button:focus-visible, .slot:focus-within {",
    "  outline: 2px solid var(--k-accent); outline-offset: 2px; }",

    ".slots { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.125rem; }",
    ".slot { position: relative; }",
    ".slot input { position: absolute; opacity: 0; width: 1px; height: 1px; }",
    ".slot span { display: block; padding: 0.5rem 0.875rem; font-size: 0.9375rem;",
    "  font-variant-numeric: tabular-nums; border: 1px solid var(--k-line);",
    "  border-radius: var(--k-r); cursor: pointer; background: var(--k-field); }",
    ".slot input:checked + span { background: var(--k-accent); color: var(--k-on-accent);",
    "  border-color: var(--k-accent); }",

    ".msg { font-size: 0.9375rem; color: var(--k-dim); margin: 0.25rem 0 0; }",
    ".err { font-size: 0.9375rem; color: var(--k-bad); margin: 0.75rem 0 0; }",

    "button { font: inherit; font-size: 1rem; font-weight: 600; cursor: pointer;",
    "  width: 100%; padding: 0.8125rem 1rem; margin-top: 0.5rem;",
    "  color: var(--k-on-accent); background: var(--k-accent);",
    "  border: 1px solid var(--k-accent); border-radius: var(--k-r); }",
    "button[disabled] { opacity: 0.55; cursor: default; }",
    "button.ghost { color: var(--k-text); background: transparent;",
    "  border-color: var(--k-line); }",

    ".done { border: 1px solid var(--k-line); border-radius: var(--k-r);",
    "  padding: 1.25rem; }",
    ".done h3 { margin: 0 0 0.5rem; font-size: 1.125rem; font-weight: 600; }",
    ".done dl { margin: 0 0 1rem; display: grid; grid-template-columns: auto 1fr;",
    "  gap: 0.25rem 1rem; font-size: 0.9375rem; }",
    ".done dt { color: var(--k-dim); }",
    ".done dd { margin: 0; }",
    ".done a { color: var(--k-accent); }",
    ".hint { font-size: 0.8125rem; color: var(--k-dim); margin: 0.5rem 0 0; }",

    ".hidden { display: none; }",
    "fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }",
    "legend { padding: 0; }",
  ].join("\n");

  /* ------------------------------------------------------------------ */
  /* Rakenne                                                             */
  /* ------------------------------------------------------------------ */

  function alusta() {
    mount = etsiJuuri();
    if (!mount) return false;

    /*
     * Varjojuuri on merkki siitä että widget on jo tässä.
     *
     * Aiemmin tässä oli data-kate-ready-attribuutti, mutta se on
     * virhe kahdesta syystä. Kiinnityskohta voi olla Reactin
     * renderöimä — Katen oma varaussivu on — ja kolmannen osapuolen
     * lisäämä attribuutti rikkoo hydraation. Ja tieto on jo olemassa:
     * attachShadow heittää jos varjojuuri on, joten sen olemassaolo
     * kertoo saman ilman että DOM:iin kirjoitetaan mitään.
     */
    if (mount.shadowRoot) return false;

    root = mount.attachShadow ? mount.attachShadow({ mode: "open" }) : mount;

    var style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    wrap = el("div", { class: "w" });
    root.appendChild(wrap);
    return true;
  }

  function tyhjenna() {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  }

  function teema(theme) {
    var vari = (theme && theme.color) || "#1f6f5c";
    var tumma = !!(theme && theme.dark);
    var r = theme && typeof theme.radius === "number" ? theme.radius : 12;

    var arvot = tumma
      ? {
          "--k-bg": "transparent",
          "--k-text": "#f2f3f5",
          "--k-dim": "#a0a6ad",
          "--k-line": "#3a3f46",
          "--k-field": "#20242a",
          "--k-bad": "#f08a80",
        }
      : {
          "--k-bg": "transparent",
          "--k-text": "#15181d",
          "--k-dim": "#606870",
          "--k-line": "#d9dde2",
          "--k-field": "#ffffff",
          "--k-bad": "#b3261e",
        };

    arvot["--k-accent"] = vari;
    arvot["--k-on-accent"] = luettavaPaalla(vari);
    arvot["--k-r"] = r + "px";

    for (var k in arvot) wrap.style.setProperty(k, arvot[k]);
  }

  /*
   * Teksti painikkeen päällä: musta vai valkoinen.
   *
   * Ravintola valitsee korostusvärin, ja vaalealle keltaiselle
   * kirjoitettu valkoinen teksti on lukukelvoton. Suhteellinen
   * luminanssi ratkaisee sen laskemalla eikä arvaamalla.
   */
  function luettavaPaalla(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "#ffffff";
    var n = parseInt(m[1], 16);
    var kanavat = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * kanavat[0] + 0.7152 * kanavat[1] + 0.0722 * kanavat[2];
    return L > 0.45 ? "#15181d" : "#ffffff";
  }

  /* ------------------------------------------------------------------ */
  /* Tila                                                                */
  /* ------------------------------------------------------------------ */

  var config = null;
  var valittuAika = null;
  var hakuNro = 0;

  function haeJSON(url, asetukset) {
    return fetch(url, asetukset).then(function (vastaus) {
      return vastaus.json();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Näkymä                                                              */
  /* ------------------------------------------------------------------ */

  function piirraSuljettu() {
    tyhjenna();
    wrap.appendChild(el("p", { class: "msg", text: t.closed }));
  }

  function piirraLomake() {
    tyhjenna();
    valittuAika = null;

    /*
     * Ravintolan nimeä ei toisteta.
     *
     * Widget on ravintolan omalla sivulla, jossa nimi on jo logossa ja
     * otsikossa. Toistettuna se näyttäisi siltä mitä upotetut palvelut
     * näyttävät: omalta laatikoltaan toisen sivun päällä.
     */
    wrap.appendChild(el("h2", { class: "h", text: t.heading }));

    var form = el("form", { novalidate: "" });
    wrap.appendChild(form);

    // --- Seurue ja päivä ---------------------------------------------
    var seurue = el("select", { id: "k-party", name: "party" });
    for (var n = config.minParty; n <= config.maxParty; n++) {
      seurue.appendChild(
        el("option", {
          value: String(n),
          text: n + " " + (n === 1 ? t.person : t.people),
        }),
      );
    }
    /* Kahden hengen pöytä on tavallisin, jos se on sallittu. */
    seurue.value = String(Math.min(Math.max(2, config.minParty), config.maxParty));

    var paiva = el("input", {
      type: "date",
      id: "k-date",
      name: "date",
      value: config.today,
      min: config.today,
      max: lisaaPaivia(config.today, config.maxDaysAhead),
    });

    var rivi = el("div", { class: "row" }, [
      el("div", { class: "f" }, [
        el("label", { class: "l", for: "k-party", text: t.guests }),
        seurue,
      ]),
      el("div", { class: "f" }, [
        el("label", { class: "l", for: "k-date", text: t.date }),
        paiva,
      ]),
    ]);
    form.appendChild(rivi);

    // --- Ajat ---------------------------------------------------------
    var aikaKentta = el("fieldset", { class: "f" });
    var aikaOtsikko = el("legend", { class: "l", text: t.time });
    var aikaLista = el("div", {
      class: "slots",
      role: "radiogroup",
      "aria-label": t.time,
    });
    var aikaViesti = el("p", {
      class: "msg",
      /* Vapaat ajat vaihtuvat itsestään; ruudunlukija saa tiedon. */
      "aria-live": "polite",
      text: t.loading,
    });
    aikaKentta.appendChild(aikaOtsikko);
    aikaKentta.appendChild(aikaLista);
    aikaKentta.appendChild(aikaViesti);
    form.appendChild(aikaKentta);

    // --- Yhteystiedot -------------------------------------------------
    var tiedot = el("div", { class: "hidden" });

    var nimi = el("input", {
      type: "text",
      id: "k-name",
      name: "name",
      maxlength: "120",
      autocomplete: "name",
      required: "",
    });
    var puhelin = el("input", {
      type: "tel",
      id: "k-phone",
      name: "phone",
      maxlength: "40",
      autocomplete: "tel",
      required: "",
    });
    var sposti = el("input", {
      type: "email",
      id: "k-email",
      name: "email",
      maxlength: "160",
      autocomplete: "email",
    });
    var toive = el("textarea", {
      id: "k-note",
      name: "note",
      maxlength: "500",
      placeholder: t.notePlaceholder,
    });

    /*
     * Allergiat omana kenttänään.
     *
     * Ne kulkivat ennen toivekentässä yhdessä pöytätoiveiden kanssa, ja
     * keittiö luki lauseen "ikkunapöytä jos mahdollista, yksi kasvis,
     * Villellä synttärit" toiveena. Oma kenttä on se ero jonka takia
     * salinäkymä voi näyttää allergian varoituksena.
     */
    var allergiat = el("input", {
      type: "text",
      id: "k-allergies",
      name: "allergies",
      maxlength: "200",
      placeholder: t.allergiesPlaceholder,
    });

    tiedot.appendChild(
      el("div", { class: "row" }, [
        el("div", { class: "f" }, [
          el("label", { class: "l", for: "k-name", text: t.name }),
          nimi,
        ]),
        el("div", { class: "f" }, [
          el("label", { class: "l", for: "k-phone", text: t.phone }),
          puhelin,
        ]),
      ]),
    );

    var spostiOtsikko = el("label", { class: "l", for: "k-email", text: t.email + " " });
    spostiOtsikko.appendChild(el("span", { class: "opt", text: "(" + t.optional + ")" }));

    tiedot.appendChild(el("div", { class: "f" }, [spostiOtsikko, sposti]));

    var toiveOtsikko = el("label", { class: "l", for: "k-note", text: t.note + " " });
    toiveOtsikko.appendChild(el("span", { class: "opt", text: "(" + t.optional + ")" }));

    tiedot.appendChild(el("div", { class: "f" }, [toiveOtsikko, toive]));

    var allergiaOtsikko = el("label", {
      class: "l",
      for: "k-allergies",
      text: t.allergies + " ",
    });
    allergiaOtsikko.appendChild(
      el("span", { class: "opt", text: "(" + t.optional + ")" }),
    );

    tiedot.appendChild(
      el("div", { class: "f" }, [allergiaOtsikko, allergiat]),
    );

    var laheta = el("button", { type: "submit", text: t.submit });
    var virhe = el("p", { class: "err hidden", role: "alert" });
    tiedot.appendChild(laheta);
    tiedot.appendChild(virhe);
    form.appendChild(tiedot);

    // --- Aikojen haku -------------------------------------------------
    function haeAjat() {
      /*
       * Juokseva numero jokaiselle haulle.
       *
       * Käyttäjä voi vaihtaa päivää nopeammin kuin verkko vastaa, ja
       * hitaampi vastaus saapuisi tuoreemman jälkeen. Numero kertoo
       * kumpi on viimeisin; vanhentunut vastaus hylätään.
       */
      var oma = ++hakuNro;
      valittuAika = null;
      tiedot.className = "hidden";
      while (aikaLista.firstChild) aikaLista.removeChild(aikaLista.firstChild);
      aikaViesti.textContent = t.loading;
      aikaViesti.className = "msg";

      haeJSON(
        api +
          "?toiminto=ajat&r=" +
          encodeURIComponent(slug) +
          "&pvm=" +
          encodeURIComponent(paiva.value) +
          "&hlo=" +
          encodeURIComponent(seurue.value),
      )
        .then(function (data) {
          if (oma !== hakuNro) return;
          naytaAjat(data.slots || []);
        })
        .catch(function () {
          if (oma !== hakuNro) return;
          aikaViesti.textContent = t.errNetwork;
        });
    }

    function naytaAjat(ajat) {
      if (!ajat.length) {
        aikaViesti.textContent = t.noTimes + " " + t.noTimesHint;
        return;
      }

      aikaViesti.textContent = "";
      ajat.forEach(function (aika) {
        var radio = el("input", { type: "radio", name: "slot", value: aika });
        radio.addEventListener("change", function () {
          valittuAika = aika;
          tiedot.className = "";
          virhe.className = "err hidden";
        });

        var nimio = el("label", { class: "slot" }, [
          radio,
          el("span", { text: aika }),
        ]);
        aikaLista.appendChild(nimio);
      });
    }

    seurue.addEventListener("change", haeAjat);
    paiva.addEventListener("change", haeAjat);
    haeAjat();

    // --- Lähetys ------------------------------------------------------
    form.addEventListener("submit", function (tapahtuma) {
      tapahtuma.preventDefault();
      if (!valittuAika) return;

      if (!nimi.value.trim()) return naytaVirhe(t.errName, nimi);
      if (!puhelin.value.trim()) return naytaVirhe(t.errPhone, puhelin);

      laheta.disabled = true;
      laheta.textContent = t.submitting;
      virhe.className = "err hidden";

      haeJSON(api + "?toiminto=luo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: slug,
          date: paiva.value,
          time: valittuAika,
          partySize: Number(seurue.value),
          name: nimi.value.trim(),
          phone: puhelin.value.trim(),
          email: sposti.value.trim() || null,
          /* Vahvistus lähtee samalla kielellä jolla asiakas varasi. */
          locale: kieli,
          note: toive.value.trim() || null,
          allergies: allergiat.value.trim() || null,
        }),
      })
        .then(function (data) {
          if (data && data.ok) {
            piirraValmis(data);
            return;
          }

          laheta.disabled = false;
          laheta.textContent = t.submit;
          naytaVirhe(virheteksti(data && data.error));

          /*
           * Varattu aika: haetaan lista uudelleen.
           *
           * Muuten asiakas näkisi yhä sen ajan jota ei enää ole ja
           * yrittäisi samaa uudestaan.
           */
          if (data && data.error === "taken") haeAjat();
        })
        .catch(function () {
          laheta.disabled = false;
          laheta.textContent = t.submit;
          naytaVirhe(t.errNetwork);
        });
    });

    function naytaVirhe(teksti, kentta) {
      virhe.textContent = teksti;
      virhe.className = "err";
      if (kentta) kentta.focus();
    }
  }

  function piirraValmis(data) {
    tyhjenna();

    var laatikko = el("div", { class: "done", tabindex: "-1" });
    laatikko.appendChild(el("h3", { text: t.confirmed }));

    var dl = el("dl");
    function rivi(otsikko, arvo) {
      dl.appendChild(el("dt", { text: otsikko }));
      dl.appendChild(el("dd", { text: arvo }));
    }
    rivi(t.date, pvmTeksti(data.date));
    rivi(t.time, data.time);
    rivi(
      t.guests,
      data.partySize + " " + (data.partySize === 1 ? t.person : t.people),
    );
    if (data.tables && data.tables.length) {
      rivi(t.confirmedTables, data.tables.join(", "));
    }

    /*
     * Varausnumero vahvistukseen.
     *
     * Se on se merkkijono jonka asiakas lukee puhelimessa ääneen, ja
     * ilman sitä ravintola etsii varauksen nimellä — mikä on hidasta
     * silloin kun nimiä on kolme samanlaista.
     */
    if (data.reference) {
      rivi(t.reference, data.reference);
    }
    laatikko.appendChild(dl);

    var linkki = origin + "/varaus/" + data.cancelToken;
    laatikko.appendChild(
      el("p", {}, [el("a", { href: linkki, text: t.cancelTitle })]),
    );
    laatikko.appendChild(el("p", { class: "hint", text: t.cancelHint }));

    /*
     * Peruutusraja sanotaan heti eikä vasta peruutusyrityksessä.
     *
     * Asiakas joka lukee tämän tietää soittaa; asiakas joka saa saman
     * tiedon tuntia ennen varausta on jo myöhässä. Nollaa ei sanota:
     * "voit perua 0 tuntia ennen" olisi hämmentävämpi kuin vaikeneminen.
     */
    if (data.cancelCutoffHours > 0) {
      laatikko.appendChild(
        el("p", {
          class: "hint",
          text: t.cancelUntil.replace("{tunnit}", String(data.cancelCutoffHours)),
        }),
      );
    }

    wrap.appendChild(laatikko);
    wrap.appendChild(
      el("button", {
        type: "button",
        class: "ghost",
        text: t.newBooking,
        onclick: piirraLomake,
      }),
    );

    /* Kohdistus vahvistukseen: ruudunlukija lukee sen heti. */
    laatikko.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Käynnistys                                                          */
  /* ------------------------------------------------------------------ */

  function kaynnista() {
    if (!alusta()) return;

    haeJSON(api + "?toiminto=asetukset&r=" + encodeURIComponent(slug))
      .then(function (data) {
        if (!data || !data.enabled) {
          teema(null);
          piirraSuljettu();
          return;
        }
        config = data;
        teema(data.theme);
        piirraLomake();
      })
      .catch(function () {
        teema(null);
        tyhjenna();
        wrap.appendChild(el("p", { class: "msg", text: t.errNetwork }));
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kaynnista);
  } else {
    kaynnista();
  }
})();
