/**
 * 客户端 · 服务端 API 连接
 * Key 只存在服务器，前端只配置服务器地址
 */
const ApiClient = (() => {
  const LS_BASE = "sing_api_base";
  const LS_SECRET = "sing_api_secret";

  function getBaseUrl() {
    const raw = window.APP_CONFIG?.apiBaseUrl || localStorage.getItem(LS_BASE) || "";
    return raw.trim().replace(/\/$/, "");
  }

  function getApiSecret() {
    return (window.APP_CONFIG?.apiSecret || localStorage.getItem(LS_SECRET) || "").trim();
  }

  function isConfigured() {
    return Boolean(getBaseUrl());
  }

  function buildHeaders(extra = {}) {
    const headers = { ...extra };
    const secret = getApiSecret();
    if (secret) headers["X-Api-Key"] = secret;
    return headers;
  }

  async function health() {
    const base = getBaseUrl();
    if (!base) throw new Error("未配置服务器地址");
    const res = await fetch(`${base}/api/health`, { headers: buildHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `服务器不可用 (${res.status})`);
    return data;
  }

  function saveConfig(baseUrl, apiSecret = "") {
    const url = baseUrl.trim().replace(/\/$/, "");
    localStorage.setItem(LS_BASE, url);
    if (apiSecret) localStorage.setItem(LS_SECRET, apiSecret.trim());
    else localStorage.removeItem(LS_SECRET);
    window.APP_CONFIG = window.APP_CONFIG || {};
    window.APP_CONFIG.apiBaseUrl = url;
    if (apiSecret) window.APP_CONFIG.apiSecret = apiSecret.trim();
    else delete window.APP_CONFIG.apiSecret;
  }

  function clearConfig() {
    localStorage.removeItem(LS_BASE);
    localStorage.removeItem(LS_SECRET);
    delete window.APP_CONFIG?.apiBaseUrl;
    delete window.APP_CONFIG?.apiSecret;
  }

  /** 迁移：清除旧版前端 OpenAI Key */
  function migrateLegacyKeys() {
    if (localStorage.getItem("sing_openai_key")) {
      localStorage.removeItem("sing_openai_key");
      delete window.APP_CONFIG?.openaiKey;
    }
  }

  return {
    getBaseUrl,
    getApiSecret,
    isConfigured,
    buildHeaders,
    health,
    saveConfig,
    clearConfig,
    migrateLegacyKeys,
  };
})();
