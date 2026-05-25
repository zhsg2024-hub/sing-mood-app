/**
 * iPhone / iPad 检测与安装引导
 */
const IOSApp = (() => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIPad = isIOS && (/\biPad\b/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  const isSecure = window.isSecureContext;

  function applyBodyClasses() {
    document.body.classList.toggle("ios", isIOS);
    document.body.classList.toggle("ipad", isIPad);
    document.body.classList.toggle("standalone", isStandalone);
  }

  function canInstallPWA() {
    return isIOS && !isStandalone && "serviceWorker" in navigator;
  }

  function showInstallBanner() {
    const banner = document.getElementById("iosInstallBanner");
    if (!banner || !canInstallPWA()) return;
    banner.hidden = false;
  }

  function showDesktopRecommend() {
    const card = document.getElementById("mobileRecommend");
    if (!card || isIOS) return;
    card.hidden = false;
    const urlEl = document.getElementById("mobileAccessUrl");
    if (urlEl) {
      const host = location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        urlEl.textContent = "https://你的域名  或  用 ngrok 生成 HTTPS 链接";
      } else {
        urlEl.textContent = location.origin + location.pathname.replace(/[^/]*$/, "");
      }
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function init() {
    applyBodyClasses();
    registerServiceWorker();
    showInstallBanner();
    showDesktopRecommend();

    document.getElementById("dismissInstallBtn")?.addEventListener("click", () => {
      const b = document.getElementById("iosInstallBanner");
      if (b) b.hidden = true;
      localStorage.setItem("ios_install_dismissed", "1");
    });

    if (localStorage.getItem("ios_install_dismissed") === "1") {
      const b = document.getElementById("iosInstallBanner");
      if (b) b.hidden = true;
    }

    document.getElementById("openTextSearchFromRecommend")?.addEventListener("click", () => {
      document.getElementById("textFallbackBtn")?.click();
    });
  }

  return {
    isIOS,
    isIPad,
    isStandalone,
    isSecure,
    init,
    canInstallPWA,
  };
})();
