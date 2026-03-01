"use strict";

function safeRequire(moduleName) {
  try {
    // eslint-disable-next-line global-require
    return require(moduleName);
  } catch {
    return null;
  }
}

const fs = safeRequire("fs");
const path = safeRequire("path");

let embeddedProviderUrls = {};
try {
  // Bootstrap defaults from JSON (bundled in provider builds, RN-safe).
  // eslint-disable-next-line global-require
  embeddedProviderUrls = require("../provider_urls.json");
} catch {
  embeddedProviderUrls = {};
}

const env =
  typeof process !== "undefined" &&
  process &&
  typeof process.env === "object" &&
  process.env
    ? process.env
    : {};

const configuredProviderUrlsFile = String(env.PROVIDER_URLS_FILE || "").trim();
const defaultProviderUrlsFile =
  path && typeof __dirname !== "undefined"
    ? path.resolve(__dirname, "..", "provider_urls.json")
    : "";

const PROVIDER_URLS_FILE = configuredProviderUrlsFile
  ? path
    ? path.resolve(configuredProviderUrlsFile)
    : configuredProviderUrlsFile
  : defaultProviderUrlsFile;

const RELOAD_INTERVAL_MS = Number.parseInt(String(env.PROVIDER_URLS_RELOAD_MS || "1500"), 10) || 1500;
const DEFAULT_PROVIDER_URLS_URL = "https://raw.githubusercontent.com/realbestia1/easystreams/refs/heads/main/provider_urls.json";
const PROVIDER_URLS_URL = String(env.PROVIDER_URLS_URL || DEFAULT_PROVIDER_URLS_URL).trim();
const REMOTE_RELOAD_INTERVAL_MS = Number.parseInt(String(env.PROVIDER_URLS_REMOTE_RELOAD_MS || "10000"), 10) || 10000;
const REMOTE_FETCH_TIMEOUT_MS = Number.parseInt(String(env.PROVIDER_URLS_REMOTE_TIMEOUT_MS || "5000"), 10) || 5000;

const ALIASES = {
  animeunity: ["animeunuty", "anime_unity"],
  animeworld: ["anime_world"],
  animesaturn: ["anime_saturn"],
  streamingcommunity: ["streaming_community"],
  guardahd: ["guarda_hd"],
  guardaserie: ["guarda_serie"],
  guardoserie: ["guardo_serie"],
  mapping_api: ["mappingapi", "mapping_api_url", "mapping_url"]
};

let lastCheckAt = 0;
let lastMtimeMs = -1;
let lastData = {};
let lastRemoteCheckAt = 0;
let remoteInFlight = null;

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase();
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace(/\/+$/, "");
}

function toNormalizedMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeKey(key);
    const normalizedValue = normalizeUrl(value);
    if (!normalizedKey || !normalizedValue) continue;
    out[normalizedKey] = normalizedValue;
  }
  return out;
}

function reloadProviderUrlsIfNeeded(force = false) {
  if (!fs || !PROVIDER_URLS_FILE) return;

  const now = Date.now();
  if (!force && now - lastCheckAt < RELOAD_INTERVAL_MS) return;
  lastCheckAt = now;

  let stat;
  try {
    stat = fs.statSync(PROVIDER_URLS_FILE);
  } catch {
    if (lastMtimeMs !== -1) {
      lastMtimeMs = -1;
      lastData = {};
    }
    return;
  }

  if (!force && stat.mtimeMs === lastMtimeMs) return;

  try {
    const raw = fs.readFileSync(PROVIDER_URLS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    lastData = toNormalizedMap(parsed);
    lastMtimeMs = stat.mtimeMs;
  } catch {
    lastData = {};
    lastMtimeMs = stat.mtimeMs;
  }
}

function getFetchImpl() {
  if (typeof fetch === "function") return fetch.bind(globalThis);
  return null;
}

async function refreshProviderUrlsFromRemoteIfNeeded(force = false) {
  if (!PROVIDER_URLS_URL) return;
  if (remoteInFlight) return;

  const now = Date.now();
  if (!force && now - lastRemoteCheckAt < REMOTE_RELOAD_INTERVAL_MS) return;
  lastRemoteCheckAt = now;

  const fetchImpl = getFetchImpl();
  if (!fetchImpl) return;

  remoteInFlight = (async () => {
    let timeoutId = null;
    let signal;
    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
    }

    try {
      const response = await fetchImpl(PROVIDER_URLS_URL, {
        signal,
        headers: {
          "accept": "application/json"
        }
      });
      if (!response || !response.ok) return;
      const payload = await response.json();
      const parsed = toNormalizedMap(payload);
      if (Object.keys(parsed).length > 0) {
        lastData = parsed;
      }
    } catch {
      // Ignore remote refresh errors: keep last known values.
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      remoteInFlight = null;
    }
  })();
}

function findFromJson(providerKey) {
  reloadProviderUrlsIfNeeded(false);
  refreshProviderUrlsFromRemoteIfNeeded(false);
  const key = normalizeKey(providerKey);
  const candidates = [key, ...(ALIASES[key] || [])].map(normalizeKey);
  for (const candidate of candidates) {
    const value = normalizeUrl(lastData[candidate]);
    if (value) return value;
  }
  return "";
}

function findFromEnv(envKeys = []) {
  for (const envKey of envKeys) {
    const value = normalizeUrl(process.env[envKey]);
    if (value) return value;
  }
  return "";
}

function getProviderUrl(providerKey, envKeys = []) {
  const safeEnvKeys = Array.isArray(envKeys) ? envKeys : [];
  const fromJson = findFromJson(providerKey);
  if (fromJson) return fromJson;

  const fromEnv = findFromEnv(safeEnvKeys);
  if (fromEnv) return fromEnv;

  return "";
}

function getProviderUrlsFilePath() {
  return PROVIDER_URLS_FILE;
}

function getProviderUrlsSourceUrl() {
  return PROVIDER_URLS_URL;
}

module.exports = {
  getProviderUrl,
  reloadProviderUrlsIfNeeded,
  getProviderUrlsFilePath,
  getProviderUrlsSourceUrl
};

// Initialize from embedded JSON immediately.
lastData = toNormalizedMap(embeddedProviderUrls);
