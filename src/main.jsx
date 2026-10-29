import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  appendHistoryEntry,
  appendRenameHistoryEntry,
  createCounterId,
  createDefaultState,
  readState,
  resetScores,
  transferScore,
  writeState,
} from "./counter-state.js";
import { parseQrLinks, qrImageUrl } from "./qr-links.js";
import "./styles.css";

function formatScore(score) {
  return score.toLocaleString("vi-VN");
}

function scoreClassName(displayScore) {
  if (displayScore.length <= 1) return "";
  if (displayScore.length === 2) return "score--two-digits";
  if (displayScore.length === 3) return "score--three-digits";
  if (displayScore.length <= 5) return "score--long";
  return "score--very-long";
}

function CounterCard({
  counter,
  onChangeScore,
  onEdit,
  onDelete,
  onPointerDown,
  isDragging,
  isDropTarget,
  canTransfer,
}) {
  const displayScore = formatScore(counter.score);
  const cardClassName = [
    "counter-card",
    canTransfer ? "counter-card--draggable" : "",
    isDragging ? "counter-card--dragging" : "",
    isDropTarget ? "counter-card--drop-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cardClassName}
      draggable={false}
      data-counter-id={counter.id}
      aria-label={`Card ${counter.name}. Kéo để chuyển điểm.`}
      aria-grabbed={isDragging}
      onPointerDown={(event) => onPointerDown(counter.id, event)}
    >
      <div className="counter-card__topline">
        <h2 className="counter-card__name">{counter.name}</h2>
        <div className="counter-card__tools">
          <span className="counter-card__drag-handle" aria-hidden="true" title="Kéo card">
            ⠿
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label={`Chỉnh sửa ${counter.name}`}
            title="Chỉnh sửa"
            onClick={() => onEdit(counter)}
          >
            ✎
          </button>
          <button
            className="icon-button icon-button--danger"
            type="button"
            aria-label={`Xóa ${counter.name}`}
            title="Xóa"
            onClick={() => onDelete(counter)}
          >
            ×
          </button>
        </div>
      </div>

      <div className="score-row">
        <button
          className="score-button score-button--decrease"
          type="button"
          aria-label={`Giảm điểm ${counter.name} một điểm`}
          onClick={() => onChangeScore(counter.id, -1)}
        >
          −
        </button>
        <div className="score-slot">
          <div
            className={`score ${scoreClassName(displayScore)}`}
            aria-live="polite"
            aria-label={`Điểm ${counter.name}`}
          >
            {displayScore}
          </div>
        </div>
        <button
          className="score-button score-button--increase"
          type="button"
          aria-label={`Tăng điểm ${counter.name} một điểm`}
          onClick={() => onChangeScore(counter.id, 1)}
        >
          +
        </button>
      </div>
    </article>
  );
}

function formatHistoryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDelta(delta) {
  return delta > 0
    ? `+${formatScore(delta)}`
    : formatScore(delta).replace("-", "−");
}

function HistoryDialog({ history, onClose }) {
  const entries = [...history].reverse();

  return (
    <Dialog title="Lịch sử thay đổi" onClose={onClose}>
      <div className="history-dialog-body">
        {entries.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty__mark" aria-hidden="true">
              ↶
            </div>
            <p>Chưa có lịch sử thay đổi.</p>
          </div>
        ) : (
          <ol className="history-list">
            {entries.map((entry, index) => (
              <li
                className="history-item"
                key={entry.id || `${entry.createdAt}-${index}`}
              >
                <div className="history-item__main">
                  {entry.type === "rename" ? (
                    <>
                      <strong className="history-change history-change--rename">
                        Đổi tên
                      </strong>
                      <span className="history-name-change">
                        {entry.previousName} → {entry.counterName}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong className="history-counter">
                        {entry.counterName}
                      </strong>
                      <strong
                        className={
                          entry.delta > 0
                            ? "history-change history-change--up"
                            : "history-change history-change--down"
                        }
                      >
                        {formatDelta(entry.delta)}
                      </strong>
                    </>
                  )}
                  <span className="history-time">
                    {formatHistoryTime(entry.createdAt)}
                  </span>
                </div>
                <span className="history-result">Điểm: {formatScore(entry.score)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Dialog>
  );
}

function SettingsDialog({
  maxCardsPerRow,
  onChange,
  qrText,
  qrDefaultText,
  qrHasOverride,
  qrReady,
  onSaveQr,
  onResetQr,
  onClose,
}) {
  const [draft, setDraft] = useState(qrText);
  const [qrError, setQrError] = useState("");

  function saveQrSettings(event) {
    event.preventDefault();
    const links = parseQrLinks(draft);
    const rows = draft.split(/\r?\n/).filter((line) => line.trim());
    if (!links.length || links.length !== rows.length) {
      setQrError("Mỗi dòng cần đúng định dạng: Tên | https://duong-link");
      return;
    }

    setQrError(onSaveQr(draft) ? "" : "Không thể lưu cài đặt trên thiết bị này.");
  }

  return (
    <Dialog title="Cài đặt hiển thị" className="dialog-panel--settings" onClose={onClose}>
      <div className="dialog-form">
        <label className="field-label" htmlFor="max-cards-per-row">
          Số card tối đa mỗi hàng
        </label>
        <select
          id="max-cards-per-row"
          className="select-input"
          value={maxCardsPerRow}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {[1, 2, 3, 4].map((value) => (
            <option key={value} value={value}>
              {value} card mỗi hàng
            </option>
          ))}
        </select>
        <p className="field-hint">
          Màn hình hẹp sẽ tự chuyển về một cột để dễ thao tác.
        </p>
        <form className="qr-settings" onSubmit={saveQrSettings}>
          <label className="field-label" htmlFor="qr-links-settings">
            Danh sách mã QR
          </label>
          <textarea
            id="qr-links-settings"
            className="text-input qr-settings__input"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setQrError("");
            }}
            placeholder="Tên | https://duong-link"
            disabled={!qrReady}
            spellCheck="false"
          />
          <p className="field-hint">
            {qrReady
              ? qrHasOverride
                ? "Đang dùng danh sách đã lưu riêng trên thiết bị này."
                : "Đang dùng mặc định từ public/qr-links.txt."
              : "Đang tải cấu hình mặc định..."}
          </p>
          {qrError && <p className="field-error">{qrError}</p>}
          <div className="dialog-actions qr-settings__actions">
            {qrHasOverride && (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  if (!onResetQr()) setQrError("Không thể khôi phục cài đặt trên thiết bị này.");
                  else {
                    setDraft(qrDefaultText);
                    setQrError("");
                  }
                }}
                disabled={!qrReady}
              >
                Dùng mặc định
              </button>
            )}
            <button className="button button--primary" type="submit" disabled={!qrReady}>
              Lưu mã QR
            </button>
          </div>
        </form>
        <div className="dialog-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function QrDialog({ links, error, hasOverride, onClose }) {
  return (
    <Dialog title="Mã QR" className="dialog-panel--qr" onClose={onClose}>
      <div className="qr-dialog-body">
        <div className="qr-dialog-toolbar">
          <p className="field-hint">
            {hasOverride ? "Danh sách tùy chỉnh trên thiết bị" : "Mặc định: public/qr-links.txt"}
          </p>
        </div>
        {error && <p className="field-error">{error}</p>}
        {links.length > 0 ? (
          <div className="qr-grid">
            {links.map((entry) => (
              <article className="qr-card" key={`${entry.name}-${entry.url}`}>
                <img
                  className="qr-image"
                  src={qrImageUrl(entry.url)}
                  alt={`Mã QR ${entry.name}`}
                  loading="lazy"
                />
                <strong className="qr-card__name">{entry.name}</strong>
                <a
                  className="qr-card__link"
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở đường link
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="dialog-message">Chưa có dòng hợp lệ trong file.</p>
        )}
      </div>
    </Dialog>
  );
}

function ResetDialog({ onClose, onReset }) {
  return (
    <Dialog title="Đặt lại điểm" onClose={onClose}>
      <div className="dialog-form">
        <p className="dialog-message">Chọn phạm vi dữ liệu muốn đặt lại.</p>
        <div className="reset-options">
          <button
            className="reset-option"
            type="button"
            onClick={() => onReset("scores")}
          >
            <strong>Chỉ xóa điểm</strong>
            <span>Đưa tất cả điểm về 0, giữ nguyên tên, card và lịch sử.</span>
          </button>
          <button
            className="reset-option reset-option--danger"
            type="button"
            onClick={() => onReset("all")}
          >
            <strong>Xóa toàn bộ</strong>
            <span>
              Trở về 2 card mặc định, xóa tên tùy chỉnh, điểm và lịch sử.
            </span>
          </button>
        </div>
        <div className="dialog-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
          >
            Hủy
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function CounterDialog({ mode, initialName, initialScore = 0, onClose, onSave }) {
  const [name, setName] = useState(initialName);
  const [score, setScore] = useState(String(initialScore));
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError("Vui lòng nhập tên bộ đếm.");
      return;
    }

    const nextScore = Number(score);
    if (mode === "edit" && (!score.trim() || !Number.isInteger(nextScore))) {
      setError("Điểm phải là số nguyên.");
      return;
    }

    onSave({ name: nextName, score: mode === "edit" ? nextScore : 0 });
  }

  return (
    <Dialog
      title={mode === "edit" ? "Chỉnh sửa bộ đếm" : "Thêm bộ đếm"}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="counter-name">
          Tên bộ đếm
        </label>
        <input
          ref={inputRef}
          id="counter-name"
          className="text-input"
          value={name}
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Ví dụ: Đội xanh"
        />
        {mode === "edit" && (
          <>
            <label
              className="field-label field-label--secondary"
              htmlFor="counter-score"
            >
              Điểm hiện tại
            </label>
            <input
              id="counter-score"
              className="text-input"
              type="number"
              inputMode="numeric"
              step="1"
              value={score}
              onChange={(event) => {
                setScore(event.target.value);
                setError("");
              }}
            />
          </>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="dialog-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button button--primary" type="submit">
            Lưu
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function TransferDialog({
  source,
  counters,
  initialTargetId,
  onClose,
  onTransfer,
}) {
  const targets = counters.filter((counter) => counter.id !== source.id);
  const [targetId, setTargetId] = useState(
    targets.some((counter) => counter.id === initialTargetId)
      ? initialTargetId
      : targets[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const nextAmount = Number(amount);
    if (!targetId) {
      setError("Vui lòng chọn card nhận điểm.");
      return;
    }
    if (!amount.trim() || !Number.isInteger(nextAmount) || nextAmount <= 0) {
      setError("Số điểm phải là số nguyên dương.");
      return;
    }

    onTransfer({ sourceId: source.id, targetId, amount: nextAmount });
  }

  const target = targets.find((counter) => counter.id === targetId);

  return (
    <Dialog title="Chuyển điểm" onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit}>
        <div className="transfer-summary">
          <strong>{source.name}</strong>
          <span aria-hidden="true">→</span>
          <strong>{target?.name || "Card nhận điểm"}</strong>
        </div>
        <label className="field-label" htmlFor="transfer-target">
          Card nhận điểm
        </label>
        <select
          id="transfer-target"
          className="select-input"
          value={targetId}
          onChange={(event) => {
            setTargetId(event.target.value);
            setError("");
          }}
          disabled={targets.length === 0}
        >
          {targets.map((counter) => (
            <option key={counter.id} value={counter.id}>
              {counter.name} ({formatScore(counter.score)} điểm)
            </option>
          ))}
        </select>
        <label className="field-label field-label--secondary" htmlFor="transfer-amount">
          Số điểm chuyển
        </label>
        <input
          ref={inputRef}
          id="transfer-amount"
          className="text-input"
          type="number"
          inputMode="numeric"
          step="1"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError("");
          }}
          placeholder="Ví dụ: 10"
        />
        <p className="field-hint">
          {source.name} sẽ bị trừ và card nhận sẽ được cộng số điểm này.
        </p>
        {error && <p className="field-error">{error}</p>}
        <div className="dialog-actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="button button--primary" type="submit" disabled={!targets.length}>
            Chuyển điểm
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ counter, onClose, onConfirm }) {
  return (
    <Dialog title="Xóa bộ đếm?" onClose={onClose}>
      <div className="dialog-form">
        <p className="dialog-message">
          Bộ đếm <strong>{counter.name}</strong> và điểm hiện tại sẽ bị xóa.
        </p>
        <div className="dialog-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="button button--danger"
            type="button"
            onClick={onConfirm}
          >
            Xóa bộ đếm
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Dialog({ title, onClose, children, className = "" }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`dialog-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Đóng hộp thoại"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function App() {
  const [appState, setAppState] = useState(() => readState());
  const [dialog, setDialog] = useState(null);
  const [qrLinks, setQrLinks] = useState([]);
  const [qrError, setQrError] = useState("");
  const [qrDefaultText, setQrDefaultText] = useState("");
  const [qrText, setQrText] = useState("");
  const [qrHasOverride, setQrHasOverride] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [draggingCounterId, setDraggingCounterId] = useState(null);
  const [dropTargetCounterId, setDropTargetCounterId] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const pendingChangesRef = useRef(new Map());
  const pointerDragRef = useRef(null);
  const { counters, history, settings } = appState;
  const qrStorageKey = "ty_so.qr_links.v1";

  function applyQrText(text, hasOverride) {
    const parsedLinks = parseQrLinks(text);
    setQrText(text);
    setQrLinks(parsedLinks);
    setQrHasOverride(hasOverride);
    setQrError(
      parsedLinks.length > 0
        ? ""
        : "Chưa có dòng hợp lệ trong " +
            (hasOverride ? "cài đặt trên thiết bị." : "public/qr-links.txt."),
    );
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/qr-links.txt", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("QR file unavailable");
        return response.text();
      })
      .then((text) => {
        if (cancelled) return;
        setQrDefaultText(text);
        let savedText = null;
        try {
          savedText = localStorage.getItem(qrStorageKey);
        } catch {
          // Use the admin defaults when local storage is unavailable.
        }
        applyQrText(savedText ?? text, savedText !== null);
        setQrReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        let savedText = null;
        try {
          savedText = localStorage.getItem(qrStorageKey);
        } catch {
          // Keep the error visible when neither source can be read.
        }
        if (savedText !== null) applyQrText(savedText, true);
        else setQrError("Không thể đọc public/qr-links.txt.");
        setQrReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  useEffect(() => {
    writeState(appState);
  }, [appState]);

  useEffect(() => {
    return () => {
      for (const pending of pendingChangesRef.current.values()) {
        window.clearTimeout(pending.timer);
      }
    };
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [counters]);

  function changeScore(id, amount) {
    setAppState((current) => ({
      ...current,
      counters: current.counters.map((counter) =>
        counter.id === id
          ? { ...counter, score: counter.score + amount }
          : counter,
      ),
    }));

    const currentPending = pendingChangesRef.current.get(id);
    if (currentPending) window.clearTimeout(currentPending.timer);

    const pending = {
      delta: (currentPending?.delta ?? 0) + amount,
      timer: window.setTimeout(() => {
        const completed = pendingChangesRef.current.get(id);
        pendingChangesRef.current.delete(id);
        if (!completed?.delta) return;

        setAppState((current) => {
          const counter = current.counters.find((item) => item.id === id);
          if (!counter) return current;

          return {
            ...current,
            history: appendHistoryEntry(
              current.history,
              counter,
              completed.delta,
            ),
          };
        });
      }, 3000),
    };
    pendingChangesRef.current.set(id, pending);
  }

  function clearPendingChanges() {
    for (const pending of pendingChangesRef.current.values()) {
      window.clearTimeout(pending.timer);
    }
    pendingChangesRef.current.clear();
  }

  function takePendingChanges(counterIds) {
    const pendingChanges = [];
    for (const counterId of new Set(counterIds)) {
      const pending = pendingChangesRef.current.get(counterId);
      if (!pending) continue;

      window.clearTimeout(pending.timer);
      pendingChangesRef.current.delete(counterId);
      if (pending.delta) pendingChanges.push({ counterId, delta: pending.delta });
    }
    return pendingChanges;
  }

  function transferPoints({ sourceId, targetId, amount }) {
    const pendingChanges = takePendingChanges([sourceId, targetId]);
    setAppState((current) => {
      let nextState = current;
      for (const pending of pendingChanges) {
        const counter = nextState.counters.find((item) => item.id === pending.counterId);
        if (!counter) continue;
        nextState = {
          ...nextState,
          history: appendHistoryEntry(
            nextState.history,
            counter,
            pending.delta,
          ),
        };
      }
      return transferScore(nextState, sourceId, targetId, amount);
    });
    setDialog(null);
  }

  function openTransfer(sourceId, targetId) {
    const source = counters.find((counter) => counter.id === sourceId);
    if (!source || counters.length < 2) return;

    const validTargetId = counters.some(
      (counter) => counter.id === targetId && counter.id !== sourceId,
    )
      ? targetId
      : undefined;
    setDialog({ type: "transfer", sourceId, targetId: validTargetId });
  }

  function handlePointerDown(counterId, event) {
    if (
      counters.length < 2 ||
      !event.isPrimary ||
      (event.pointerType === "touch" &&
        !event.target.closest?.(".counter-card__drag-handle")) ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      event.target.closest?.("button, input, select, textarea, a")
    ) {
      return;
    }

    pointerDragRef.current = {
      sourceId: counterId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    event.preventDefault();
  }

  function counterIdAtPoint(event) {
    return document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-counter-id]")
      ?.dataset.counterId;
  }

  function handlePointerMove(event) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(
      event.clientX - pointerDrag.startX,
      event.clientY - pointerDrag.startY,
    );
    if (!pointerDrag.active && distance < 8) return;

    pointerDrag.active = true;
    event.preventDefault();
    setDraggingCounterId(pointerDrag.sourceId);
    const counterId = counterIdAtPoint(event);
    setDropTargetCounterId(
      counterId && pointerDrag.sourceId !== counterId ? counterId : null,
    );
  }

  function handlePointerUp(event) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    pointerDragRef.current = null;

    const wasDragging = pointerDrag.active;
    const sourceId = pointerDrag.sourceId;
    const targetId = counterIdAtPoint(event);
    setDraggingCounterId(null);
    setDropTargetCounterId(null);
    if (!wasDragging || !targetId || sourceId === targetId) return;

    event.preventDefault();
    openTransfer(sourceId, targetId);
  }

  function handlePointerCancel() {
    pointerDragRef.current = null;
    setDraggingCounterId(null);
    setDropTargetCounterId(null);
  }

  function resetData(scope) {
    clearPendingChanges();
    setAppState(scope === "all" ? createDefaultState() : resetScores);
    setDialog(null);
  }

  function updateMaxCardsPerRow(maxCardsPerRow) {
    setAppState((current) => ({
      ...current,
      settings: { ...current.settings, maxCardsPerRow },
    }));
  }

  function saveQrText(text) {
    try {
      localStorage.setItem(qrStorageKey, text);
      applyQrText(text, true);
      return true;
    } catch {
      return false;
    }
  }

  function resetQrText() {
    try {
      localStorage.removeItem(qrStorageKey);
      applyQrText(qrDefaultText, false);
      return true;
    } catch {
      return false;
    }
  }

  function saveCounter({ name, score }) {
    const editingCounterId = dialog?.type === "edit" ? dialog.counter.id : null;
    const pending = editingCounterId
      ? pendingChangesRef.current.get(editingCounterId)
      : null;
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingChangesRef.current.delete(editingCounterId);
    }

    setAppState((current) => {
      if (dialog?.type === "edit") {
        const currentCounter = current.counters.find(
          (counter) => counter.id === dialog.counter.id,
        );
        if (!currentCounter) return current;

        const nextCounter = { ...currentCounter, name, score };
        let nextHistory = current.history;
        if (pending?.delta) {
          nextHistory = appendHistoryEntry(
            nextHistory,
            currentCounter,
            pending.delta,
          );
        }
        if (name !== currentCounter.name) {
          nextHistory = appendRenameHistoryEntry(
            nextHistory,
            nextCounter,
            currentCounter.name,
          );
        }
        if (score !== currentCounter.score) {
          nextHistory = appendHistoryEntry(
            nextHistory,
            nextCounter,
            score - currentCounter.score,
          );
        }

        return {
          ...current,
          counters: current.counters.map((counter) =>
            counter.id === dialog.counter.id ? nextCounter : counter,
          ),
          history: nextHistory,
        };
      }

      return {
        ...current,
        counters: [
          ...current.counters,
          { id: createCounterId(), name, score },
        ],
      };
    });
    setDialog(null);
  }

  function deleteCounter() {
    if (dialog?.type !== "delete") return;
    const pending = pendingChangesRef.current.get(dialog.counter.id);
    if (pending) window.clearTimeout(pending.timer);
    pendingChangesRef.current.delete(dialog.counter.id);
    setAppState((current) => ({
      ...current,
      counters: current.counters.filter(
        (counter) => counter.id !== dialog.counter.id,
      ),
    }));
    setDialog(null);
  }

  function openQrDialog() {
    setDialog({ type: "qr" });
  }

  const availableWidth = Math.min(
    1180,
    viewportWidth - (viewportWidth <= 760 ? 32 : 48),
  );
  const columnsThatFit =
    viewportWidth <= 760
      ? 1
      : Math.max(1, Math.floor((availableWidth + 16) / (256 + 16)));
  const cardsPerRow = Math.min(
    settings.maxCardsPerRow,
    columnsThatFit,
    Math.max(counters.length, 1),
  );
  const gridRows = Math.max(1, Math.ceil(counters.length / cardsPerRow));
  const transferSource =
    dialog?.type === "transfer"
      ? counters.find((counter) => counter.id === dialog.sourceId)
      : null;

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <div>
            <p className="eyebrow">THEO DÕI ĐIỂM</p>
            <div className="app-brand">
              <img className="app-logo" src="/h2-billiard.png" alt="H2 Billiard" />
              <h1>Bộ đếm</h1>
            </div>
          </div>
          <div className="header-actions">
            <span className="save-status">
              <span className="save-status__dot" aria-hidden="true" />
              Tự lưu trên thiết bị
            </span>
            <button
              className="button button--qr"
              type="button"
              onClick={openQrDialog}
            >
              Mã QR{qrLinks.length > 0 ? ` (${qrLinks.length})` : ""}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setDialog({ type: "settings" })}
            >
              Cài đặt
            </button>
            <button
              className="button button--history"
              type="button"
              aria-label="Xem lịch sử thay đổi"
              onClick={() => setDialog({ type: "history" })}
            >
              Lịch sử
            </button>
            <button
              className="button button--reset"
              type="button"
              onClick={() => setDialog({ type: "reset" })}
            >
              Đặt lại
            </button>
            <button
              className="button button--primary button--add"
              type="button"
              onClick={() => setDialog({ type: "add" })}
            >
              <span aria-hidden="true">+</span>
              Thêm bộ đếm
            </button>
          </div>
        </header>

        {counters.length > 0 ? (
          <main
            className="counter-grid"
            style={{
              "--max-cards-per-row": cardsPerRow,
              "--grid-rows": gridRows,
            }}
          >
            {counters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                onChangeScore={changeScore}
                onEdit={(selected) =>
                  setDialog({ type: "edit", counter: selected })
                }
                onDelete={(selected) =>
                  setDialog({ type: "delete", counter: selected })
                }
                onPointerDown={handlePointerDown}
                isDragging={draggingCounterId === counter.id}
                isDropTarget={dropTargetCounterId === counter.id}
                canTransfer={counters.length > 1}
              />
            ))}
          </main>
        ) : (
          <main className="empty-state">
            <div className="empty-state__mark" aria-hidden="true">
              0
            </div>
            <h2>Chưa có bộ đếm</h2>
            <p>Tạo bộ đếm đầu tiên để bắt đầu.</p>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setDialog({ type: "add" })}
            >
              Thêm bộ đếm
            </button>
          </main>
        )}

        <footer className="app-footer">
          <span>{counters.length} bộ đếm</span>
          <span aria-hidden="true">•</span>
          <span>Điểm có thể âm</span>
        </footer>
      </div>

      {dialog?.type === "add" && (
        <CounterDialog
          mode="add"
          initialName={`Bộ đếm ${counters.length + 1}`}
          initialScore={0}
          onClose={() => setDialog(null)}
          onSave={saveCounter}
        />
      )}
      {dialog?.type === "edit" && (
        <CounterDialog
          mode="edit"
          initialName={dialog.counter.name}
          initialScore={dialog.counter.score}
          onClose={() => setDialog(null)}
          onSave={saveCounter}
        />
      )}
      {transferSource && (
        <TransferDialog
          key={`${transferSource.id}-${dialog.targetId || "default"}`}
          source={transferSource}
          counters={counters}
          initialTargetId={dialog.targetId}
          onClose={() => setDialog(null)}
          onTransfer={transferPoints}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteDialog
          counter={dialog.counter}
          onClose={() => setDialog(null)}
          onConfirm={deleteCounter}
        />
      )}
      {dialog?.type === "history" && (
        <HistoryDialog history={history} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "settings" && (
        <SettingsDialog
          maxCardsPerRow={settings.maxCardsPerRow}
          onChange={updateMaxCardsPerRow}
          qrText={qrText}
          qrDefaultText={qrDefaultText}
          qrHasOverride={qrHasOverride}
          qrReady={qrReady}
          onSaveQr={saveQrText}
          onResetQr={resetQrText}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "qr" && (
        <QrDialog
          links={qrLinks}
          error={qrError}
          hasOverride={qrHasOverride}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "reset" && (
        <ResetDialog onClose={() => setDialog(null)} onReset={resetData} />
      )}
    </div>
  );
}

const root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);
