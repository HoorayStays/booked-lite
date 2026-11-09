/*!
 * B👀KED Lite embed widget · MIT · Built by CoHost Studio (https://cohoststudio.com)
 *
 * Paste ONE of these on any website:
 *   Inline:   <div data-booked="inline" data-url="https://YOUR-SITE/you/event"></div>
 *   Floating: <div data-booked="floating" data-url="https://YOUR-SITE/you/event" data-text="Book a call" data-color="#4f46e5"></div>
 *   Button:   <a href="https://YOUR-SITE/you/event" data-booked="popup">Book a call</a>
 * followed by:
 *   <script src="https://YOUR-SITE/embed.js" async></script>
 */
(function () {
  "use strict";
  if (window.Booked && window.Booked.scan) {
    window.Booked.scan();
    return;
  }

  var script =
    document.currentScript ||
    [].slice.call(document.querySelectorAll('script[src*="embed.js"]')).pop();
  var ORIGIN = script ? new URL(script.src, location.href).origin : location.origin;
  var frames = [];

  function embedUrl(url) {
    var u = new URL(url || "/", ORIGIN);
    u.searchParams.set("embed", "1");
    return u.toString();
  }

  function inkFor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "#fff";
    var n = parseInt(m[1], 16);
    var lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? "#111827" : "#fff";
  }

  var css =
    ".booked-inline{width:100%;border:0;display:block;min-height:640px;background:transparent;color-scheme:normal}" +
    ".booked-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .15s}" +
    ".booked-overlay.booked-open{opacity:1}" +
    ".booked-panel{position:relative;width:100%;max-width:1020px;height:min(760px,92vh);background:#f6f7f9;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}" +
    ".booked-panel iframe{width:100%;height:100%;border:0;display:block}" +
    ".booked-close{position:absolute;top:10px;right:10px;width:40px;height:40px;border-radius:999px;border:0;background:#fff;color:#111827;font:600 22px/40px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:1}" +
    ".booked-float{position:fixed;right:20px;bottom:20px;z-index:2147483645;border:0;border-radius:999px;padding:14px 22px;font:600 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2)}" +
    ".booked-float:hover{filter:brightness(1.07)}" +
    "@media (max-width:640px){.booked-overlay{padding:0}.booked-panel{height:100%;max-width:none;border-radius:0}.booked-float{right:14px;bottom:14px}}";

  function addStyles() {
    if (document.getElementById("booked-embed-css")) return;
    var s = document.createElement("style");
    s.id = "booked-embed-css";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function open(url) {
    addStyles();
    var overlay = document.createElement("div");
    overlay.className = "booked-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Book a time");
    var panel = document.createElement("div");
    panel.className = "booked-panel";
    var close = document.createElement("button");
    close.className = "booked-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";
    var iframe = document.createElement("iframe");
    iframe.src = embedUrl(url);
    iframe.title = "Book a time";
    panel.appendChild(close);
    panel.appendChild(iframe);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { overlay.classList.add("booked-open"); });
    function shut() {
      overlay.remove();
      document.documentElement.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") shut(); }
    close.addEventListener("click", shut);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) shut(); });
    document.addEventListener("keydown", onKey);
    close.focus();
  }

  function setup(el) {
    if (el.getAttribute("data-booked-ready")) return;
    el.setAttribute("data-booked-ready", "1");
    var kind = el.getAttribute("data-booked");
    var url = el.getAttribute("data-url") || el.getAttribute("href");
    var color = el.getAttribute("data-color") || "#4f46e5";
    addStyles();
    if (kind === "inline") {
      var iframe = document.createElement("iframe");
      iframe.className = "booked-inline";
      iframe.src = embedUrl(url);
      iframe.title = "Book a time";
      iframe.loading = "lazy";
      el.innerHTML = "";
      el.appendChild(iframe);
      frames.push(iframe);
    } else if (kind === "floating") {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "booked-float";
      btn.textContent = el.getAttribute("data-text") || "Book a call";
      btn.style.background = color;
      btn.style.color = inkFor(color);
      btn.addEventListener("click", function () { open(url); });
      document.body.appendChild(btn);
    } else if (kind === "popup") {
      el.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let people open it in a new tab
        e.preventDefault();
        open(url);
      });
    }
  }

  function scan() {
    [].forEach.call(document.querySelectorAll("[data-booked]"), setup);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !e.data || typeof e.data !== "object") return;
    if (e.data.type === "booked:height") {
      frames.forEach(function (f) {
        if (f.contentWindow === e.source) {
          f.style.minHeight = "0";
          f.style.height = Math.max(300, Number(e.data.height) || 0) + "px";
        }
      });
    }
    if (e.data.type === "booked:scheduled") {
      try { window.dispatchEvent(new CustomEvent("booked:scheduled")); } catch (e2) { void e2; }
    }
  });

  window.Booked = { open: open, scan: scan };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
