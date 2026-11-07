// Waitlist/buy-mode switch and email capture. Reads window.SITE_CONFIG (config.js).
(function () {
  "use strict";
  var cfg = window.SITE_CONFIG || {};

  document.addEventListener("DOMContentLoaded", function () {
    var buyMode = !!cfg.checkoutUrl;

    document.querySelectorAll("[data-name]").forEach(function (el) { el.textContent = cfg.productName || ""; });
    document.querySelectorAll("[data-price]").forEach(function (el) { el.textContent = cfg.price || ""; });
    document.querySelectorAll("[data-buy]").forEach(function (el) {
      el.classList.toggle("hidden", !buyMode);
      if (buyMode && el.tagName === "A") el.href = cfg.checkoutUrl;
    });
    document.querySelectorAll("[data-waitlist-only]").forEach(function (el) {
      el.classList.toggle("hidden", buyMode);
    });
    ["appStore", "googlePlay"].forEach(function (key) {
      document.querySelectorAll('[data-link="' + key + '"]').forEach(function (el) {
        if (cfg.links && cfg.links[key]) { el.href = cfg.links[key]; } else { el.classList.add("hidden"); }
      });
    });

    document.querySelectorAll("form[data-waitlist]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = form.parentNode.querySelector(".msg") || form.querySelector(".msg");
        var email = (form.elements.email.value || "").trim();
        function show(text, ok) { if (msg) { msg.textContent = text; msg.className = "msg " + (ok ? "ok" : "err"); } }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { show("Please enter a valid email address.", false); return; }
        var wl = cfg.waitlist || {};
        if (!wl.endpoint) { show("Signups are not connected yet. (Site owner: see site/README.md.)", false); return; }
        var headers = Object.assign({ "Content-Type": "application/json" }, wl.headers || {});
        var btn = form.querySelector("button");
        if (btn) btn.disabled = true;
        fetch(wl.endpoint, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ email: email, source: form.getAttribute("data-source") || "site" })
        }).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          form.reset();
          show("You're on the list. Thanks!", true);
        }).catch(function () {
          show("Something went wrong. Please try again later.", false);
        }).then(function () { if (btn) btn.disabled = false; });
      });
    });
  });
})();
