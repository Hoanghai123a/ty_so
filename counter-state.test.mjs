import assert from "node:assert/strict";
import test from "node:test";
import {
  appendHistoryEntry,
  appendRenameHistoryEntry,
  createDefaultState,
  parseStoredState,
  resetScores,
  transferScore,
} from "./src/counter-state.js";
import { parseQrLinks, qrImageUrl } from "./src/qr-links.js";

test("đọc tên và đường link QR từ từng dòng", () => {
  assert.deepEqual(parseQrLinks(
    "Facebook | https://facebook.com/h2\nZalo\thttps://zalo.me/h2\nWebsite https://h2billiard.vn\nDòng lỗi",
  ), [
    { name: "Facebook", url: "https://facebook.com/h2" },
    { name: "Zalo", url: "https://zalo.me/h2" },
    { name: "Website", url: "https://h2billiard.vn" },
  ]);
  assert.match(qrImageUrl("https://example.com?a=1"), /data=https%3A%2F%2Fexample.com%3Fa%3D1$/);
});

test("khôi phục bộ đếm và lịch sử chung đã lưu", () => {
  const state = parseStoredState(
    JSON.stringify({
      counters: [{ id: "red", name: "Bàn đỏ", score: -2 }],
      history: [
        {
          id: "history-1",
          counterId: "red",
          counterName: "Bàn đỏ",
          delta: -2,
          score: -2,
          createdAt: "2026-10-26T12:00:00.000Z",
        },
      ],
    }),
  );

  assert.deepEqual(state.counters, [{ id: "red", name: "Bàn đỏ", score: -2 }]);
  assert.deepEqual(state.history, [
    {
      id: "history-1",
      counterId: "red",
      counterName: "Bàn đỏ",
      delta: -2,
      score: -2,
      createdAt: "2026-10-26T12:00:00.000Z",
    },
  ]);
});

test("gom lịch sử cũ của từng bộ đếm khi đọc dữ liệu cũ", () => {
  const state = parseStoredState(
    JSON.stringify([
      {
        id: "red",
        name: "Bàn đỏ",
        score: 1,
        history: [{ delta: 1, score: 1, createdAt: "2026-10-26T12:00:00.000Z" }],
      },
    ]),
  );

  assert.equal(state.history.length, 1);
  assert.deepEqual(state.history[0], {
    id: "history-1",
    counterId: "red",
    counterName: "Bàn đỏ",
    delta: 1,
    score: 1,
    createdAt: "2026-10-26T12:00:00.000Z",
  });
  assert.deepEqual(state.counters, [{ id: "red", name: "Bàn đỏ", score: 1 }]);
});

test("dữ liệu lỗi quay về trạng thái mặc định", () => {
  assert.deepEqual(parseStoredState("không phải json"), createDefaultState());
  assert.deepEqual(parseStoredState(JSON.stringify({ score: 3 })), createDefaultState());
});

test("ghi một mục lịch sử chung theo tổng thay đổi ròng", () => {
  const counter = { id: "red", name: "Bàn đỏ", score: 1 };
  const history = appendHistoryEntry([], counter, 1, "2026-10-26T12:00:00.000Z");

  assert.equal(history.length, 1);
  assert.deepEqual(history[0], {
    id: history[0].id,
    counterId: "red",
    counterName: "Bàn đỏ",
    delta: 1,
    score: 1,
    createdAt: "2026-10-26T12:00:00.000Z",
  });
});

test("chuyển điểm cập nhật hai card và ghi đủ lịch sử", () => {
  const state = {
    counters: [
      { id: "red", name: "Đội đỏ", score: 7 },
      { id: "blue", name: "Đội xanh", score: 2 },
    ],
    history: [],
    settings: { maxCardsPerRow: 2 },
  };

  const nextState = transferScore(
    state,
    "red",
    "blue",
    5,
    "2026-10-26T12:00:00.000Z",
  );

  assert.deepEqual(nextState.counters, [
    { id: "red", name: "Đội đỏ", score: 2 },
    { id: "blue", name: "Đội xanh", score: 7 },
  ]);
  assert.deepEqual(
    nextState.history.map(({ id, ...entry }) => entry),
    [
      {
        counterId: "red",
        counterName: "Đội đỏ",
        delta: -5,
        score: 2,
        createdAt: "2026-10-26T12:00:00.000Z",
      },
      {
        counterId: "blue",
        counterName: "Đội xanh",
        delta: 5,
        score: 7,
        createdAt: "2026-10-26T12:00:00.000Z",
      },
    ],
  );
  assert.equal(transferScore(state, "red", "red", 1), state);
  assert.equal(transferScore(state, "red", "blue", 0), state);
});

test("ghi và khôi phục lịch sử đổi tên trong lịch sử chung", () => {
  const counter = { id: "red", name: "Đội đỏ", score: 4 };
  const history = appendRenameHistoryEntry(
    [],
    counter,
    "Bàn đỏ",
    "2026-10-26T12:00:00.000Z",
  );

  assert.deepEqual(history[0], {
    id: history[0].id,
    type: "rename",
    counterId: "red",
    counterName: "Đội đỏ",
    previousName: "Bàn đỏ",
    score: 4,
    createdAt: "2026-10-26T12:00:00.000Z",
  });

  const restored = parseStoredState(
    JSON.stringify({
      counters: [counter],
      history,
    }),
  );
  assert.deepEqual(restored.history, history);
});

test("reset điểm giữ card, tên, lịch sử và cài đặt", () => {
  const state = {
    counters: [{ id: "red", name: "Bàn đỏ", score: 7 }],
    history: [{ id: "h1", counterId: "red", counterName: "Bàn đỏ", delta: 7, score: 7 }],
    settings: { maxCardsPerRow: 3 },
  };

  assert.deepEqual(resetScores(state), {
    ...state,
    counters: [{ id: "red", name: "Bàn đỏ", score: 0 }],
  });
});

test("trạng thái mặc định có hai card và giới hạn card mỗi hàng hợp lệ", () => {
  const state = parseStoredState(
    JSON.stringify({ counters: [], history: [], settings: { maxCardsPerRow: 99 } }),
  );

  assert.equal(state.counters.length, 0);
  assert.deepEqual(state.settings, { maxCardsPerRow: 4 });
  assert.equal(createDefaultState().counters.length, 2);
  assert.deepEqual(createDefaultState().settings, { maxCardsPerRow: 2 });
});
