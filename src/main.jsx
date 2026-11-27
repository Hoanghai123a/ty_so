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
import { getCounterGrid } from "./counter-layout.js";
import { parseQrLinks, parseWifiDetails, qrImageUrl, readQrCache, writeQrCache } from "./qr-links.js";
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
  onCardClickCapture,
  onHandleClick,
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
      onClickCapture={onCardClickCapture}
      onPointerDown={(event) => onPointerDown(counter.id, event)}
    >
      <div className="counter-card__topline">
        <h2 className="counter-card__name">{counter.name}</h2>
        <div className="counter-card__tools">
          <span
            className="counter-card__drag-handle"
            role="button"
            tabIndex="0"
            aria-label={`Chuyển điểm từ ${counter.name}`}
            title="Bấm để nhập điểm chuyển hoặc kéo card"
            onClick={(event) => {
              event.stopPropagation();
              onHandleClick(counter.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onHandleClick(counter.id);
            }}
          >
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
      setQrError("Mỗi dòng cần dạng: Tên | đường link hoặc Tên | WIFI:...");
      return;
    }

    setQrError(onSaveQr(draft) ? "" : "Không thể lưu cài đặt trên thiết bị này.");
  }

  return (
    <Dialog title="Cài đặt mã QR" className="dialog-panel--settings" onClose={onClose}>
      <div className="dialog-form">
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
            placeholder={"Tên | https://duong-link\nTên Wi-Fi | WIFI:T:WPA;S:Ten Wi-Fi;P:Mat-khau;;"}
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

function QrDialog({ links, error, hasOverride, onRefresh, onClose }) {
  const [visibleQr, setVisibleQr] = useState({});
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const wifi = links.find((entry) => /^WIFI:/i.test(entry.url));
  const bill = links.find((entry) => /\/public-tables(?:[/?]|$)/i.test(entry.url));
  const camera = links.find(
    (entry) => entry !== wifi && entry !== bill && /camera/i.test(entry.name),
  );
  const otherLinks = links.filter((entry) => entry !== wifi && entry !== bill && entry !== camera);
  const wifiDetails = wifi ? parseWifiDetails(wifi.url) : null;

  async function copyValue(value, label) {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopyError("Không thể sao chép trên thiết bị này.");
    }
  }

  function toggleQr(key) {
    setVisibleQr((current) => ({ ...current, [key]: !current[key] }));
  }

  function QrPreview({ entry, label }) {
    if (!visibleQr[label]) return null;
    return (
      <div className="utility-card__qr">
        <img className="qr-image" src={qrImageUrl(entry.url)} alt={`Mã QR ${entry.name}`} />
      </div>
    );
  }

  return (
    <Dialog title="Tiện ích tại bàn" className="dialog-panel--qr" onClose={onClose}>
      <div className="qr-dialog-body">
        <div className="qr-dialog-toolbar">
          <p className="field-hint">
            {hasOverride ? "Danh sách tùy chỉnh trên thiết bị" : "Wi-Fi, bill và cắt camera"}
          </p>
          <button className="icon-button" type="button" aria-label="Làm mới mã QR" title="Làm mới" onClick={onRefresh}>
            ↻
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {links.length > 0 ? (
          <div className="utility-list">
            {wifi && wifiDetails && (
              <article className="utility-card utility-card--wifi">
                <div>
                  <span className="utility-card__eyebrow">Kết nối nhanh</span>
                  <h3>Wi-Fi {wifiDetails.ssid || wifi.name}</h3>
                  <p className="wifi-password">Mật khẩu: <strong>{wifiDetails.password || "Chưa cấu hình"}</strong></p>
                </div>
                <div className="utility-card__actions">
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => copyValue(wifiDetails.password, "wifi")}
                    disabled={!wifiDetails.password}
                  >
                    {copied === "wifi" ? "Đã sao chép" : "Sao chép mật khẩu"}
                  </button>
                  <button className="button button--secondary" type="button" onClick={() => toggleQr("wifi")}>
                    {visibleQr.wifi ? "Ẩn mã QR" : "Hiện mã QR"}
                  </button>
                </div>
                <QrPreview entry={wifi} label="wifi" />
              </article>
            )}
            {bill && (
              <article className="utility-card">
                <div>
                  <span className="utility-card__eyebrow">Thanh toán</span>
                  <h3>Bill và Thanh toán</h3>
                  <p className="utility-card__description">Mở trang bill trực tiếp trên điện thoại.</p>
                </div>
                <div className="utility-card__actions">
                  <a className="button button--primary" href={bill.url} target="_blank" rel="noreferrer">Xem bill</a>
                  <button className="button button--secondary" type="button" onClick={() => toggleQr("bill")}>
                    {visibleQr.bill ? "Ẩn mã QR" : "Hiện mã QR"}
                  </button>
                </div>
                <QrPreview entry={bill} label="bill" />
              </article>
            )}
            {camera && (
              <article className="utility-card utility-card--camera">
                <div>
                  <span className="utility-card__eyebrow">Thiết bị tại bàn</span>
                  <h3>Cắt camera</h3>
                  <p className="utility-card__description">Quét mã bằng camera điện thoại để mở.</p>
                </div>
                <div className="utility-card__qr utility-card__qr--always">
                  <img className="qr-image" src={qrImageUrl(camera.url)} alt="Mã QR cắt camera" />
                </div>
                <button className="button button--secondary" type="button" onClick={() => copyValue(camera.url, "camera")}>
                  {copied === "camera" ? "Đã sao chép địa chỉ" : "Sao chép địa chỉ"}
                </button>
              </article>
            )}
            {otherLinks.map((entry) => (
              <article className="utility-card" key={`${entry.name}-${entry.url}`}>
                <h3>{entry.name}</h3>
                <img className="qr-image" src={qrImageUrl(entry.url)} alt={`Mã QR ${entry.name}`} loading="lazy" />
                {/^https?:\/\//i.test(entry.url) && <a className="button button--secondary" href={entry.url} target="_blank" rel="noreferrer">Mở đường link</a>}
              </article>
            ))}
          </div>
        ) : (
          <p className="dialog-message">Chưa có dòng hợp lệ trong file.</p>
        )}
        {copyError && <p className="field-error">{copyError}</p>}
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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [dialog, setDialog] = useState(null);
  const [initialQrCache] = useState(() => readQrCache());
  const [qrLinks, setQrLinks] = useState(initialQrCache?.links ?? []);
  const [qrError, setQrError] = useState("");
  const [qrDefaultText, setQrDefaultText] = useState("");
  const [qrText, setQrText] = useState("");
  const [qrHasOverride, setQrHasOverride] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [draggingCounterId, setDraggingCounterId] = useState(null);
  const [dropTargetCounterId, setDropTargetCounterId] = useState(null);
  const pendingChangesRef = useRef(new Map());
  const pointerDragRef = useRef(null);
  const suppressCardClickRef = useRef(false);
  const { counters, history } = appState;
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

    if (initialQrCache && !initialQrCache.stale) {
      setQrText(initialQrCache.text);
      setQrHasOverride(initialQrCache.hasOverride);
      setQrError(initialQrCache.links.length > 0 ? "" : "Chưa có dòng hợp lệ trong cài đặt trên thiết bị.");
      setQrReady(true);
      return () => { cancelled = true; };
    }

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
        writeQrCache(parseQrLinks(savedText ?? text), undefined, Date.now(), { text: savedText ?? text, hasOverride: savedText !== null });
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
        if (savedText !== null) {
          applyQrText(savedText, true);
          writeQrCache(parseQrLinks(savedText), undefined, Date.now(), { text: savedText, hasOverride: true });
        }
        else setQrError("Không thể đọc public/qr-links.txt.");
        setQrReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeState(appState);
  }, [appState]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

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

  function handleHandleClick(counterId) {
    openTransfer(counterId);
  }

  function handleCardClickCapture(event) {
    if (!suppressCardClickRef.current) return;

    suppressCardClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerDown(counterId, event) {
    if (
      counters.length < 2 ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      event.target.closest?.("input, select, textarea, a")
    ) {
      return;
    }

    suppressCardClickRef.current = false;

    pointerDragRef.current = {
      sourceId: counterId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captureTarget: event.currentTarget,
      active: false,
    };
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

    if (!pointerDrag.active) {
      pointerDrag.captureTarget?.setPointerCapture?.(pointerDrag.pointerId);
    }
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

    const wasDragging =
      pointerDrag.active ||
      Math.hypot(
        event.clientX - pointerDrag.startX,
        event.clientY - pointerDrag.startY,
      ) >= 8;
    const sourceId = pointerDrag.sourceId;
    const targetId = counterIdAtPoint(event);
    if (pointerDrag.captureTarget?.hasPointerCapture?.(pointerDrag.pointerId)) {
      pointerDrag.captureTarget.releasePointerCapture(pointerDrag.pointerId);
    }
    setDraggingCounterId(null);
    setDropTargetCounterId(null);
    if (!wasDragging) return;

    event.preventDefault();
    suppressCardClickRef.current = true;
    if (!targetId || sourceId === targetId) return;
    changeScore(sourceId, -1);
    changeScore(targetId, 1);
  }

  function handlePointerCancel() {
    const pointerDrag = pointerDragRef.current;
    if (pointerDrag?.captureTarget?.hasPointerCapture?.(pointerDrag.pointerId)) {
      pointerDrag.captureTarget.releasePointerCapture(pointerDrag.pointerId);
    }
    pointerDragRef.current = null;
    setDraggingCounterId(null);
    setDropTargetCounterId(null);
  }

  function resetData(scope) {
    clearPendingChanges();
    setAppState(scope === "all" ? createDefaultState() : resetScores);
    setDialog(null);
  }

  function saveQrText(text) {
    try {
      localStorage.setItem(qrStorageKey, text);
      const links = parseQrLinks(text);
      applyQrText(text, true);
      writeQrCache(links, undefined, Date.now(), { text, hasOverride: true });
      return true;
    } catch {
      return false;
    }
  }

  function resetQrText() {
    try {
      localStorage.removeItem(qrStorageKey);
      applyQrText(qrDefaultText, false);
      writeQrCache(parseQrLinks(qrDefaultText), undefined, Date.now(), { text: qrDefaultText, hasOverride: false });
      return true;
    } catch {
      return false;
    }
  }

  function refreshQr() {
    fetch("/qr-links.txt", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("QR file unavailable");
        return response.text();
      })
      .then((text) => {
        setQrDefaultText(text);
        let savedText = null;
        try { savedText = localStorage.getItem(qrStorageKey); } catch {}
        const source = savedText ?? text;
        applyQrText(source, savedText !== null);
        writeQrCache(parseQrLinks(source), undefined, Date.now(), { text: source, hasOverride: savedText !== null });
        setQrReady(true);
      })
      .catch(() => setQrError("Không thể làm mới danh sách mã QR."));
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

  async function reloadApp() {
    let nextState = appState;
    for (const { counterId, delta } of takePendingChanges(
      counters.map(({ id }) => id),
    )) {
      const counter = nextState.counters.find(({ id }) => id === counterId);
      if (counter) {
        nextState = {
          ...nextState,
          history: appendHistoryEntry(nextState.history, counter, delta),
        };
      }
    }
    writeState(nextState);

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.unregister();
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.allSettled(
          keys
            .filter((key) => key.startsWith("ty-so-offline-"))
            .map((key) => caches.delete(key)),
        );
      }
    } catch {
      // Continue with a cache-busted navigation if browser cache APIs fail.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("_reload", Date.now());
    window.location.replace(url.href);
  }

  const counterGrid = getCounterGrid(counters.length);
  const transferSource =
    dialog?.type === "transfer"
      ? counters.find((counter) => counter.id === dialog.sourceId)
      : null;

  return (
    <div className="app-shell" data-grid-rows={counterGrid.rows}>
      <div className="app-frame">
        <header className="app-header">
          <div>
            <p className="eyebrow">THEO DÕI ĐIỂM</p>
            <div className="app-brand">
              <img className="app-logo" src="/h2-billiard.png" alt="H2 tỷ số" />
              <h1>Bộ đếm</h1>
            </div>
          </div>
          <div className="header-actions">
            <span className="save-status">
              <span
                className={`save-status__dot ${isOnline ? "" : "save-status__dot--offline"}`}
                aria-hidden="true"
              />
              <span role="status" aria-live="polite">
                {isOnline ? "Đang trực tuyến" : "Đang ngoại tuyến"}
              </span>
            </span>
            <button
              className="button button--qr"
              type="button"
              onClick={openQrDialog}
            >
              Mã QR{qrLinks.length > 0 ? ` (${qrLinks.length})` : ""}
            </button>
            <button
              className="icon-button header-reload"
              type="button"
              aria-label="Tải lại ứng dụng và cập nhật phiên bản mới"
              title="Tải lại để cập nhật phiên bản mới"
              onClick={reloadApp}
            >
              ↻
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
            data-rows={counterGrid.rows}
            style={{
              "--grid-columns": counterGrid.columns,
              "--grid-rows": counterGrid.rows,
            }}
          >
            {counters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                onChangeScore={changeScore}
                onCardClickCapture={handleCardClickCapture}
                onEdit={(selected) =>
                  setDialog({ type: "edit", counter: selected })
                }
                onDelete={(selected) =>
                  setDialog({ type: "delete", counter: selected })
                }
                onPointerDown={handlePointerDown}
                onHandleClick={handleHandleClick}
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
          onRefresh={refreshQr}
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

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
