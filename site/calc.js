// Pure calculator functions (testable) plus DOM wiring for /tools.
(function (root) {
  "use strict";

  // ---- pure math -----------------------------------------------------------

  // Net payout for one sale on each channel. Rates are percentages (e.g. 15).
  function feeCalc(o) {
    var price = num(o.price);
    var rows = [
      { channel: "Apple App Store", fee: price * num(o.appleRate) / 100 },
      { channel: "Google Play", fee: price * num(o.googleRate) / 100 },
      { channel: "Web checkout (Stripe-style)", fee: price * num(o.webPct) / 100 + num(o.webFixed) }
    ];
    var sales = num(o.sales);
    return rows.map(function (r) {
      var net = price - r.fee;
      return {
        channel: r.channel,
        fee: r.fee,
        net: net,
        netPct: price > 0 ? net / price * 100 : 0,
        monthly: net * sales
      };
    });
  }

  // formats: [{ imps: impressions per daily user per day, ecpm: $ per 1000 }]
  function adCalc(o) {
    var arpdau = 0;
    (o.formats || []).forEach(function (f) {
      arpdau += num(f.imps) * num(f.ecpm) / 1000;
    });
    var days = 30;
    var dau = num(o.dau);
    var target = num(o.target);
    return {
      arpdau: arpdau,
      daily: dau * arpdau,
      monthly: dau * arpdau * days,
      dauForTarget: arpdau > 0 ? target / (arpdau * days) : Infinity
    };
  }

  function ltvCalc(o) {
    var price = num(o.price);
    var feePct = num(o.feePct);
    var churn = num(o.churnPct) / 100;
    var cac = num(o.cac);
    var netMonthly = price * (1 - feePct / 100);
    var lifetimeMonths = churn > 0 ? 1 / churn : Infinity;
    var ltv = netMonthly * lifetimeMonths;
    return {
      netMonthly: netMonthly,
      lifetimeMonths: lifetimeMonths,
      ltv: ltv,
      ratio: cac > 0 ? ltv / cac : Infinity,
      paybackMonths: netMonthly > 0 ? cac / netMonthly : Infinity
    };
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function money(n) {
    if (!isFinite(n)) return "n/a";
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
  }
  function pct(n) { return isFinite(n) ? n.toFixed(1) + "%" : "n/a"; }
  function fixed(n, d) { return isFinite(n) ? n.toFixed(d) : "n/a"; }

  root.Calc = { feeCalc: feeCalc, adCalc: adCalc, ltvCalc: ltvCalc };

  // ---- DOM wiring ----------------------------------------------------------

  if (typeof document === "undefined") return;
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value : ""; }
  function set(id, text) { var el = $(id); if (el) el.textContent = text; }

  function renderFees() {
    var rows = feeCalc({
      price: val("fee-price"), appleRate: val("fee-apple"), googleRate: val("fee-google"),
      webPct: val("fee-webpct"), webFixed: val("fee-webfixed"), sales: val("fee-sales")
    });
    var body = rows.map(function (r) {
      return "<tr><td>" + r.channel + "</td><td>" + money(r.fee) + "</td><td>" + money(r.net) +
        "</td><td>" + pct(r.netPct) + "</td><td>" + money(r.monthly) + "</td></tr>";
    }).join("");
    $("fee-body").innerHTML = body;
  }

  function renderAds() {
    var r = adCalc({
      dau: val("ad-dau"), target: val("ad-target"),
      formats: [
        { imps: val("ad-banner-imps"), ecpm: val("ad-banner-ecpm") },
        { imps: val("ad-inter-imps"), ecpm: val("ad-inter-ecpm") },
        { imps: val("ad-reward-imps"), ecpm: val("ad-reward-ecpm") }
      ]
    });
    set("ad-arpdau", money(r.arpdau));
    set("ad-monthly", money(r.monthly));
    set("ad-need", isFinite(r.dauForTarget) ? Math.ceil(r.dauForTarget).toLocaleString("en-US") : "n/a");
  }

  function renderLtv() {
    var r = ltvCalc({
      price: val("ltv-price"), feePct: val("ltv-fee"), churnPct: val("ltv-churn"), cac: val("ltv-cac")
    });
    set("ltv-net", money(r.netMonthly));
    set("ltv-life", isFinite(r.lifetimeMonths) ? fixed(r.lifetimeMonths, 1) + " mo" : "n/a");
    set("ltv-ltv", money(r.ltv));
    set("ltv-ratio", isFinite(r.ratio) ? fixed(r.ratio, 1) + "x" : "n/a");
    set("ltv-payback", isFinite(r.paybackMonths) ? fixed(r.paybackMonths, 1) + " mo" : "n/a");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var map = [["fee", renderFees], ["ad", renderAds], ["ltv", renderLtv]];
    map.forEach(function (m) {
      var section = $(m[0] + "-calc");
      if (!section) return;
      section.addEventListener("input", m[1]);
      m[1]();
    });
  });
})(typeof window !== "undefined" ? window : globalThis);
