(function () {
  var cases = window.CASES || [];
  var base = window.MEDIA_BASE || "";
  var list = document.getElementById("cases");
  var modal = document.getElementById("modal");
  var content = document.getElementById("modal-content");
  var closeBtn = document.getElementById("modal-close");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lastFocus = null;

  document.getElementById("year").textContent = new Date().getFullYear();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function media(item, label, eager) {
    if (!item || !item.src) {
      return '<div class="placeholder" aria-hidden="true"><span>' + esc(label) + "</span></div>";
    }
    var url = base + item.src;
    if (item.type === "video") {
      var poster = item.poster ? ' poster="' + esc(base + item.poster) + '"' : "";
      var auto = reduceMotion ? "" : " autoplay";
      return '<video src="' + esc(url) + '"' + poster + auto + ' muted loop playsinline preload="metadata"></video>';
    }
    return '<img src="' + esc(url) + '" alt="' + esc(item.alt || label) + '"' +
      (eager ? "" : ' loading="lazy"') + ' decoding="async">';
  }

  list.innerHTML = cases.map(function (c, i) {
    return (
      '<li class="case">' +
        '<a href="#' + esc(c.id) + '" class="case-link" data-id="' + esc(c.id) + '">' +
          '<div class="case-media">' + media(c.cover, c.name, i < 2) + "</div>" +
          '<div class="case-meta">' +
            '<span class="case-name">' + esc(c.name) + (c.wip ? ' <em class="wip">In progress</em>' : "") + "</span>" +
            '<span class="case-sector">' + esc(c.sector) + "</span>" +
          "</div>" +
        "</a>" +
      "</li>"
    );
  }).join("");

  function open(id) {
    var c = cases.find(function (x) { return x.id === id; });
    if (!c) return;
    var gallery = c.gallery.length
      ? c.gallery.map(function (g) { return '<div class="gallery-item">' + media(g, c.name) + "</div>"; }).join("")
      : '<div class="gallery-item">' + media(c.cover, c.name) + "</div>";
    content.innerHTML =
      '<div class="modal-head">' +
        '<h2 id="modal-title">' + esc(c.name) + "</h2>" +
        '<p class="modal-sector">' + esc(c.sector) + "</p>" +
        '<ul class="tags">' + c.services.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" +
        '<p class="modal-desc">' + esc(c.description) + "</p>" +
      "</div>" +
      '<div class="gallery">' + gallery + "</div>";
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.scrollTop = 0;
    closeBtn.focus();
  }

  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    content.innerHTML = "";
    document.body.classList.remove("modal-open");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus) lastFocus.focus();
  }

  // Ссылка вида o-dio.design/#avorio сразу открывает кейс — удобно для писем.
  function fromHash() {
    var id = location.hash.slice(1);
    if (cases.some(function (c) { return c.id === id; })) open(id); else close();
  }

  window.addEventListener("hashchange", fromHash);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  fromHash();
})();
