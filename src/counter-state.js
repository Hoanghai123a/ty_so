export const STORAGE_KEY = "ty_so.counters.v1";
export const DEFAULT_MAX_CARDS_PER_ROW = 2;

export function createDefaultCounters() {
  return [
    { id: "counter-a", name: "Đội A", score: 0 },
    { id: "counter-b", name: "Đội B", score: 0 },
  ];
}

export function createDefaultState() {
  return {
    counters: createDefaultCounters(),
    history: [],
    settings: { maxCardsPerRow: DEFAULT_MAX_CARDS_PER_ROW },
  };
}

function normalizeCounter(value, index) {
  if (!value || typeof value !== "object") return null;

  const name = typeof value.name === "string" ? value.name.trim().slice(0, 40) : "";
  const score = Number.isFinite(value.score) ? Math.trunc(value.score) : 0;
  const id = typeof value.id === "string" && value.id.trim() ? value.id : `counter-${index + 1}`;

  return {
    id,
    name: name || `Bộ đếm ${index + 1}`,
    score,
  };
}

function normalizeCounters(values) {
  const counters = [];
  const legacyHistory = [];
  const seenIds = new Set();

  values.forEach((value, index) => {
    const counter = normalizeCounter(value, index);
    if (!counter || seenIds.has(counter.id)) return;

    seenIds.add(counter.id);
    counters.push(counter);

    if (value && typeof value === "object" && Array.isArray(value.history)) {
      legacyHistory.push(
        ...value.history.map((entry) => ({
          ...entry,
          counterId: counter.id,
          counterName: counter.name,
        })),
      );
    }
  });

  return { counters, legacyHistory };
}

function normalizeHistory(value, counters) {
  if (!Array.isArray(value)) return [];

  const counterNames = new Map(counters.map((counter) => [counter.id, counter.name]));
  return value.reduce((result, item, index) => {
    if (!item || typeof item !== "object") return result;

    const score = Number.isFinite(item.score) ? Math.trunc(item.score) : null;
    const createdAt = typeof item.createdAt === "string" ? item.createdAt : "";
    if (score === null || Number.isNaN(Date.parse(createdAt))) return result;

    const counterId = typeof item.counterId === "string" ? item.counterId : "";
    const counterName =
      typeof item.counterName === "string" && item.counterName.trim()
        ? item.counterName.trim()
        : counterNames.get(counterId) || "Bộ đếm";
    const id =
      typeof item.id === "string" && item.id.trim() ? item.id : `history-${index + 1}`;

    if (item.type === "rename") {
      const previousName =
        typeof item.previousName === "string" ? item.previousName.trim() : "";
      if (!previousName || previousName === counterName) return result;

      result.push({
        id,
        type: "rename",
        counterId,
        counterName,
        previousName,
        score,
        createdAt,
      });
      return result;
    }

    const delta = Number.isFinite(item.delta) ? Math.trunc(item.delta) : 0;
    if (!delta) return result;

    result.push({
      id,
      counterId,
      counterName,
      delta,
      score,
      createdAt,
    });
    return result;
  }, []);
}

function normalizeSettings(value) {
  const candidate = value && typeof value === "object" ? value.maxCardsPerRow : null;
  const maxCardsPerRow = Number.isFinite(candidate)
    ? Math.trunc(candidate)
    : DEFAULT_MAX_CARDS_PER_ROW;

  return {
    maxCardsPerRow: Math.min(4, Math.max(1, maxCardsPerRow)),
  };
}

export function parseStoredState(raw) {
  if (!raw) return createDefaultState();

  try {
    const parsed = JSON.parse(raw);
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray(parsed.counters)
        ? parsed.counters
        : null;
    if (!values) return createDefaultState();

    const { counters, legacyHistory } = normalizeCounters(values);
    const storedHistory = !Array.isArray(parsed) && Array.isArray(parsed.history)
      ? parsed.history
      : legacyHistory;

    return {
      counters,
      history: normalizeHistory(storedHistory, counters),
      settings: normalizeSettings(!Array.isArray(parsed) ? parsed.settings : null),
    };
  } catch {
    return createDefaultState();
  }
}

export function readState(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    return parseStoredState(target?.getItem(STORAGE_KEY));
  } catch {
    return createDefaultState();
  }
}

export function writeState(state, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    target?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing; the current session still works.
  }
}

export function createCounterId() {
  return `counter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendHistoryEntry(history, counter, delta, createdAt = new Date().toISOString()) {
  const normalizedDelta = Math.trunc(delta);
  if (!normalizedDelta) return history;

  return [
    ...history,
    {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      counterId: counter.id,
      counterName: counter.name,
      delta: normalizedDelta,
      score: counter.score,
      createdAt,
    },
  ];
}

export function transferScore(
  state,
  sourceId,
  targetId,
  amount,
  createdAt = new Date().toISOString(),
) {
  const normalizedAmount = Number(amount);
  if (
    sourceId === targetId ||
    !Number.isInteger(normalizedAmount) ||
    normalizedAmount <= 0
  ) {
    return state;
  }

  const source = state.counters.find((counter) => counter.id === sourceId);
  const target = state.counters.find((counter) => counter.id === targetId);
  if (!source || !target) return state;

  const nextSource = { ...source, score: source.score - normalizedAmount };
  const nextTarget = { ...target, score: target.score + normalizedAmount };
  let nextHistory = appendHistoryEntry(
    state.history,
    nextSource,
    -normalizedAmount,
    createdAt,
  );
  nextHistory = appendHistoryEntry(
    nextHistory,
    nextTarget,
    normalizedAmount,
    createdAt,
  );

  return {
    ...state,
    counters: state.counters.map((counter) => {
      if (counter.id === sourceId) return nextSource;
      if (counter.id === targetId) return nextTarget;
      return counter;
    }),
    history: nextHistory,
  };
}

export function appendRenameHistoryEntry(
  history,
  counter,
  previousName,
  createdAt = new Date().toISOString(),
) {
  const nextName = typeof counter.name === "string" ? counter.name.trim() : "";
  const oldName = typeof previousName === "string" ? previousName.trim() : "";
  if (!nextName || !oldName || nextName === oldName) return history;

  return [
    ...history,
    {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "rename",
      counterId: counter.id,
      counterName: nextName,
      previousName: oldName,
      score: Math.trunc(counter.score),
      createdAt,
    },
  ];
}

export function resetScores(state) {
  return {
    ...state,
    counters: state.counters.map((counter) => ({ ...counter, score: 0 })),
  };
}
