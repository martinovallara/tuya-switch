require("dotenv/config");
const assert = require("assert");
const { test, beforeEach } = require("node:test");

const {
  sha256Hex,
  hmacSha256Upper,
  normalizeQuery,
  buildSignedHeaders,
  tuyaRequest
} = require("../server");

beforeEach(() => {
  delete global.fetch;
});

test("normalizeQuery orders keys and skips empty values", () => {
  const query = normalizeQuery({ b: 2, a: "1", c: "", d: null, e: undefined });
  assert.strictEqual(query, "a=1&b=2");
});

test("sha256Hex returns hex digest", () => {
  const digest = sha256Hex("hello");
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test("hmacSha256Upper returns uppercase hex", () => {
  const sig = hmacSha256Upper("secret", "message");
  assert.match(sig, /^[A-F0-9]{64}$/);
});

test("buildSignedHeaders includes required fields", () => {
  const headers = buildSignedHeaders({
    method: "GET",
    pathWithQuery: "/v1.0/token?grant_type=1",
    body: "",
    accessToken: "",
    clientId: "abc",
    clientSecret: "def",
    nonce: "nonce-1"
  });

  assert.ok(headers.client_id);
  assert.ok(headers.sign);
  assert.strictEqual(headers.sign_method, "HMAC-SHA256");
  assert.ok(headers.t);
  assert.strictEqual(headers.nonce, "nonce-1");
});

test("tuyaRequest throws on failed response", async () => {
  global.fetch = async () => ({
    json: async () => ({ success: false, msg: "Denied" })
  });

  await assert.rejects(
    () =>
      tuyaRequest({
        baseUrl: "https://openapi.tuyaeu.com",
        method: "GET",
        path: "/v1.0/token",
        query: { grant_type: 1 },
        body: null,
        accessToken: null
      }),
    /Denied/
  );
});

test("tuyaRequest returns result on success", async () => {
  global.fetch = async () => ({
    json: async () => ({ success: true, result: { access_token: "abc" } })
  });

  const result = await tuyaRequest({
    baseUrl: "https://openapi.tuyaeu.com",
    method: "GET",
    path: "/v1.0/token",
    query: { grant_type: 1 },
    body: null,
    accessToken: null
  });

  assert.deepStrictEqual(result, { access_token: "abc" });
});
