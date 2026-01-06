const crypto = require("crypto");
const express = require("express");
const path = require("path");
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.TUYA_CLIENT_ID || "";
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET || "";

const BASE_URLS = {
  cn: "https://openapi.tuyacn.com",
  eu: "https://openapi.tuyaeu.com",
  in: "https://openapi.tuyain.com",
  us: "https://openapi.tuyaus.com"
};

const tokenCache = {
  accessToken: null,
  expireAt: 0,
  baseUrl: null
};

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function sha256Hex(payload) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function hmacSha256Upper(secret, message) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex").toUpperCase();
}

function normalizeQuery(params) {
  if (!params || Object.keys(params).length === 0) {
    return "";
  }
  const sorted = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
  return sorted.join("&");
}

function buildSignedHeaders({ method, pathWithQuery, body, accessToken, clientId, clientSecret, nonce }) {
  const t = Date.now().toString();
  const bodyHash = sha256Hex(body || "");
  const stringToSign = [method, bodyHash, "", pathWithQuery].join("\n");
  const signStr = `${clientId}${accessToken || ""}${t}${nonce}${stringToSign}`;
  const sign = hmacSha256Upper(clientSecret, signStr);
  const headers = {
    "client_id": clientId,
    "sign": sign,
    "sign_method": "HMAC-SHA256",
    "t": t,
    "nonce": nonce
  };
  if (accessToken) {
    headers["access_token"] = accessToken;
  }
  return headers;
}

async function tuyaRequest({ baseUrl, method, path, query, body, accessToken }) {
  const queryString = normalizeQuery(query);
  const pathWithQuery = queryString ? `${path}?${queryString}` : path;
  const safePathWithQuery = encodeURI(pathWithQuery);
  const nonce = crypto.randomUUID();
  const payload = body ? JSON.stringify(body) : "";
  const headers = buildSignedHeaders({
    method,
    pathWithQuery: safePathWithQuery,
    body: payload,
    accessToken,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    nonce
  });
  const url = `${baseUrl}${safePathWithQuery}`;
  try {
    new URL(url);
  } catch (err) {
    const errMsg = err && err.message ? err.message : "Invalid URL";
    throw new Error(`${errMsg}: ${url}`);
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: payload || undefined
    });
  } catch (err) {
    const errMsg = err && err.message ? err.message : "Fetch failed";
    const wrapped = new Error(`${errMsg} (url: ${url})`);
    wrapped.cause = err;
    throw wrapped;
  }
  const json = await res.json();
  if (!json.success) {
    const err = new Error(json.msg || "Tuya API error");
    err.details = json;
    throw err;
  }
  return json.result;
}

function resolveStatisticsPaths(deviceId, customPaths) {
  const defaults = [
    "/v1.0/iot-03/devices/{deviceId}/statistics",
    "/v1.0/devices/{deviceId}/statistics"
  ];
  const input = Array.isArray(customPaths) && customPaths.length ? customPaths : defaults;
  return input
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace("{deviceId}", deviceId));
}

async function fetchDeviceStatistics({ baseUrl, accessToken, deviceId, query, paths }) {
  const resolvedPaths = resolveStatisticsPaths(deviceId, paths);
  let lastError = null;

  for (const path of resolvedPaths) {
    try {
      return await tuyaRequest({
        baseUrl,
        method: "GET",
        path,
        query,
        body: null,
        accessToken
      });
    } catch (err) {
      lastError = err;
      if (err.details && err.details.msg === "uri path invalid") {
        continue;
      }
      throw err;
    }
  }

  if (lastError && lastError.details && lastError.details.msg === "uri path invalid") {
    const err = new Error(
      `All statistics endpoints invalid. Tried: ${resolvedPaths.join(", ")}`
    );
    err.details = lastError.details;
    throw err;
  }

  throw lastError || new Error("Unable to fetch device statistics");
}

function resolveReportLogPaths(deviceId, customPaths) {
  const defaults = [
    "/v1.0/iot-03/devices/{deviceId}/report-logs",
    "/v1.0/devices/{deviceId}/report-logs",
    "/v2.0/cloud/thing/{deviceId}/report-logs"
  ];
  const input = Array.isArray(customPaths) && customPaths.length ? customPaths : defaults;
  return input
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace("{deviceId}", deviceId));
}

async function fetchDeviceReportLogs({ baseUrl, accessToken, deviceId, query, paths }) {
  const resolvedPaths = resolveReportLogPaths(deviceId, paths);
  let lastError = null;

  for (const path of resolvedPaths) {
    try {
      // v2.0 endpoint uses only essential parameters
      const isV2 = path.includes("/v2.0/");
      const adjustedQuery = isV2 
        ? { 
            start_time: query.start_time,
            end_time: query.end_time,
            codes: query.codes,
            size: 100
          }
        : query;
      
      return await tuyaRequest({
        baseUrl,
        method: "GET",
        path,
        query: adjustedQuery,
        body: null,
        accessToken
      });
    } catch (err) {
      lastError = err;
      // Continue to next endpoint if current one fails
      if (err.details && (err.details.msg === "uri path invalid" || err.details.msg === "illegal param")) {
        continue;
      }
      throw err;
    }
  }

  if (lastError && lastError.details && (lastError.details.msg === "uri path invalid" || lastError.details.msg === "illegal param")) {
    const err = new Error(
      `All report-log endpoints failed. Tried: ${resolvedPaths.join(", ")}`
    );
    err.details = lastError.details;
    throw err;
  }

  throw lastError || new Error("Unable to fetch device report logs");
}

async function getAccessToken(baseUrl) {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expireAt > now && tokenCache.baseUrl === baseUrl) {
    return tokenCache.accessToken;
  }
  const result = await tuyaRequest({
    baseUrl,
    method: "GET",
    path: "/v1.0/token",
    query: { grant_type: 1 },
    body: null,
    accessToken: null
  });
  tokenCache.accessToken = result.access_token;
  tokenCache.expireAt = now + (result.expire_time || 0) * 1000 - 30000;
  tokenCache.baseUrl = baseUrl;
  return tokenCache.accessToken;
}

// Directory for storing daily logs
const LOGS_DIR = path.join(__dirname, 'data', 'logs');

// Ensure logs directory exists
async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating logs directory:', error);
  }
}

// Get logs file path for a specific date
function getLogsFilePath(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  return path.join(LOGS_DIR, `${dateStr}.json`);
}

// Save device data to daily log file
async function saveDeviceLog(deviceId, data) {
  try {
    const filePath = getLogsFilePath();
    let logs = [];
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      logs = JSON.parse(fileContent);
    } catch (err) {
      logs = [];
    }
    
    logs.push({
      timestamp: new Date().toISOString(),
      ...data
    });
    
    await fs.writeFile(filePath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error saving device log:', error);
  }
}

// Load logs for a specific date
async function loadDeviceLogs(dateStr) {
  try {
    const filePath = path.join(LOGS_DIR, `${dateStr}.json`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    return [];
  }
}

// Add REST endpoints
app.get('/api/logs/:date', async (req, res) => {
  try {
    const logs = await loadDeviceLogs(req.params.date);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/energy", async (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(400).json({ error: "Missing TUYA_CLIENT_ID or TUYA_CLIENT_SECRET" });
    }
    const {
      deviceId,
      region,
      startTime,
      endTime,
      dpCode,
      statType,
      unit,
      interval,
      source,
      reportType
    } = req.body || {};

    if (!deviceId || !region) {
      return res.status(400).json({ error: "deviceId and region are required" });
    }

    const baseUrl = BASE_URLS[region];
    if (!baseUrl) {
      return res.status(400).json({ error: "Unsupported region" });
    }

    const accessToken = await getAccessToken(baseUrl);
    const safeDeviceId = encodeURIComponent(String(deviceId).trim());
    const energySource = (source || "report-logs").trim();
    let result;

    if (energySource === "statistics") {
      const query = {
        start_time: startTime,
        end_time: endTime,
        code: dpCode || "add_ele",
        type: statType || "sum",
        unit: unit || "minute",
        interval: interval || 5
      };
      const envPaths = (process.env.TUYA_STATS_PATHS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      result = await fetchDeviceStatistics({
        baseUrl,
        accessToken,
        deviceId: safeDeviceId,
        query,
        paths: envPaths.length ? envPaths : undefined
      });
    } else {
      const codeValue = (dpCode || "add_ele").trim();
      const query = {
        start_time: startTime,
        end_time: endTime,
        codes: codeValue,
        type: reportType || 1,
        size: 100
      };
      const envPaths = (process.env.TUYA_REPORT_PATHS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      result = await fetchDeviceReportLogs({
        baseUrl,
        accessToken,
        deviceId: safeDeviceId,
        query,
        paths: envPaths.length ? envPaths : undefined
      });
    }

    res.json({ data: result });
  } catch (err) {
    const payload = {
      error: err.message || "Unexpected error"
    };
    if (err.details) {
      payload.details = err.details;
    }
    res.status(500).json(payload);
  }
});

ensureLogsDir();

// Start Express server only when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ĐYO? Dashboard disponibile su http://localhost:${PORT}/dashboard.html`);
    console.log(`ĐY"S API endpoint: http://localhost:${PORT}/api/logs/:date`);
  });
}
module.exports = {
  getAccessToken,
  fetchDeviceReportLogs,
  tuyaRequest,
  BASE_URLS,
  saveDeviceLog,
  loadDeviceLogs,
  getLogsFilePath
};

