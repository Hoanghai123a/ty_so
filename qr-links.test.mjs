import test from "node:test";
import assert from "node:assert/strict";
import { parseQrLinks } from "./src/qr-links.js";

test("parses Wi-Fi QR content with spaces in the network name", () => {
  assert.deepEqual(
    parseQrLinks("Mật khẩu Wi-Fi 12341234 | WIFI:T:WPA;S:H2 BILLIARDS;P:12341234;;"),
    [{
      name: "Mật khẩu Wi-Fi 12341234",
      url: "WIFI:T:WPA;S:H2 BILLIARDS;P:12341234;;",
    }],
  );
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
