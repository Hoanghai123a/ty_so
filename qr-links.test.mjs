import test from "node:test";
import assert from "node:assert/strict";
import { parseQrLinks, parseWifiDetails, readQrCache, writeQrCache } from "./src/qr-links.js";

test("parses Wi-Fi QR content with spaces in the network name", () => {
  assert.deepEqual(
    parseQrLinks("Mật khẩu Wi-Fi 12341234 | WIFI:T:WPA;S:H2 BILLIARDS;P:12341234;;"),
    [{
      name: "Mật khẩu Wi-Fi 12341234",
      url: "WIFI:T:WPA;S:H2 BILLIARDS;P:12341234;;",
    }],
  );
});

test("stores parsed QR data with a seven-day freshness window", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const links = parseQrLinks("Wi-Fi | WIFI:T:WPA;S:Hall;P:1234;;");
  writeQrCache(links, storage, 1000, { text: "Wi-Fi | WIFI:T:WPA;S:Hall;P:1234;;", hasOverride: true });
  assert.deepEqual(readQrCache(storage, 1000).links, links);
  assert.equal(readQrCache(storage, 1000 + 7 * 24 * 60 * 60 * 1000).stale, true);
});

test("keeps web links compatible", () => {
  assert.deepEqual(
    parseQrLinks("Cắt camera | http://192.168.1.7:8080/channels/1/cut-cam"),
    [{
      name: "Cắt camera",
      url: "http://192.168.1.7:8080/channels/1/cut-cam",
    }],
  );
});

test("extracts Wi-Fi details for the quick connect card", () => {
  assert.deepEqual(
    parseWifiDetails("WIFI:T:WPA;S:H2 BILLIARDS;P:12341234;;"),
    { ssid: "H2 BILLIARDS", password: "12341234" },
  );
});
