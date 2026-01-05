require("dotenv/config");
const assert = require("assert");
const { test } = require("node:test");

const requiredEnv = [
  process.env.TUYA_CLIENT_ID,
  process.env.TUYA_CLIENT_SECRET,
  process.env.TUYA_DEVICE_ID,
  process.env.TUYA_REGION
].map((value) => (typeof value === "string" ? value.trim() : value));

test(
  "integration: fetch device statistics from Tuya",
  { skip: requiredEnv.some((value) => !value) },
  async () => {
    const { getAccessToken, fetchDeviceReportLogs, BASE_URLS } = require("../server.cjs");
    const region = (process.env.TUYA_REGION || "").trim();
    const baseUrl = BASE_URLS[region];

    assert.ok(baseUrl, "Unsupported TUYA_REGION");

    const accessToken = await getAccessToken(baseUrl);
    const deviceId = (process.env.TUYA_DEVICE_ID || "").trim();
    const day = process.env.TUYA_TEST_DATE || "2025-12-17";
    const [year, month, dayNum] = day.split("-").map(Number);
    const start = new Date(year, month - 1, dayNum, 0, 0, 0, 0);
    const end = new Date(year, month - 1, dayNum, 23, 59, 59, 999);

    const safeDeviceId = encodeURIComponent(deviceId);
    const customPaths = (process.env.TUYA_REPORT_PATHS || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    let result;
    try {
      const codes = (process.env.TUYA_REPORT_CODES || process.env.TUYA_DP_CODE || "add_ele").trim();
      result = await fetchDeviceReportLogs({
        baseUrl,
        accessToken,
        deviceId: safeDeviceId,
        query: {
          start_time: start.getTime(),
          end_time: end.getTime(),
          codes,
          type: Number(process.env.TUYA_REPORT_TYPE || 1)
        },
        paths: customPaths.length ? customPaths : undefined
      });
    } catch (err) {
      if (err.details) {
        console.error("Tuya error details:", err.details);
      }
      throw err;
    }

    assert.ok(result, "Missing result");
    assert.ok(
      Array.isArray(result) || Array.isArray(result.data) || Array.isArray(result.list),
      "Unexpected result shape"
    );
  }
);

test(
  "integration: list devices to obtain Device IDs",
  {
    skip:
      !process.env.TUYA_CLIENT_ID ||
      !process.env.TUYA_CLIENT_SECRET ||
      !process.env.TUYA_REGION ||
      !process.env.TUYA_ASSET_ID
  },
  async () => {
    const { getAccessToken, tuyaRequest, BASE_URLS } = require("../server.cjs");
    const region = process.env.TUYA_REGION;
    const baseUrl = BASE_URLS[region];

    assert.ok(baseUrl, "Unsupported TUYA_REGION");

    const accessToken = await getAccessToken(baseUrl);

    const result = await tuyaRequest({
      baseUrl,
      method: "GET",
      path: "/v1.0/iot-03/devices",
      query: {
        asset_id: process.env.TUYA_ASSET_ID,
        page_no: 1,
        page_size: 20
      },
      body: null,
      accessToken
    });

    assert.ok(result, "Missing result");
    assert.ok(
      Array.isArray(result.list),
      "Expected result.list to be an array of devices"
    );
  }
);
