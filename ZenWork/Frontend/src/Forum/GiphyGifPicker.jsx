import { useEffect, useMemo, useState } from "react";
import {
  getGiphyTrendingGifs,
  hasGiphyConfig,
  searchGiphyGifs,
} from "./forumService";

const panelStyle = {
  position: "absolute",
  bottom: "calc(100% + 10px)",
  left: 0,
  width: "min(360px, calc(100vw - 110px))",
  maxHeight: "min(420px, calc(100vh - 140px))",
  background: "#1f2430",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  boxShadow: "0 18px 50px rgba(0,0,0,0.4)",
  overflow: "hidden",
  zIndex: 50,
};

const headerStyle = {
  padding: 12,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "#232937",
};

const inputStyle = {
  width: "100%",
  background: "#0f172a",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
  fontSize: 14,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  padding: 12,
};

const tileStyle = {
  position: "relative",
  border: 0,
  background: "#111827",
  borderRadius: 12,
  overflow: "hidden",
  cursor: "pointer",
  padding: 0,
};

const footerStyle = {
  padding: "8px 12px 12px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  fontSize: 12,
  color: "#a5b4fc",
};

export default function GiphyGifPicker({
  open,
  onClose,
  onSelect,
  anchorLabel = "GIF",
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const enabled = useMemo(() => hasGiphyConfig(), []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = query.trim()
          ? await searchGiphyGifs(query.trim())
          : await getGiphyTrendingGifs();

        if (!cancelled) {
          setItems(data);
        }
      } catch (error) {
        if (!cancelled) {
          setItems([]);
          setErrorMessage(error.message || "Impossible de charger les GIFs.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, query.trim() ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <strong style={{ color: "#fff", fontSize: 14 }}>{anchorLabel}</strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un GIF..."
          style={inputStyle}
        />

        {!enabled && (
          <p style={{ color: "#fca5a5", margin: "10px 0 0", fontSize: 12 }}>
            GIPHY non configuré.
          </p>
        )}
      </div>

      <div style={{ maxHeight: "min(330px, calc(100vh - 220px))", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 16, color: "#cbd5e1" }}>Chargement...</div>
        ) : errorMessage ? (
          <div style={{ padding: 16, color: "#fca5a5" }}>{errorMessage}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 16, color: "#cbd5e1" }}>Aucun GIF trouvé.</div>
        ) : (
          <div style={gridStyle}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                style={tileStyle}
                onClick={() => onSelect?.(item)}
                title={item.title || "GIF"}
              >
                <img
                  src={item.previewUrl || item.gifUrl}
                  alt={item.title || "GIF"}
                  style={{
                    width: "100%",
                    height: 118,
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />

                <div
                  style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    padding: "8px 10px",
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0))",
                    color: "#fff",
                    fontSize: 12,
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title || "GIF"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={footerStyle}>Powered by GIPHY</div>
    </div>
  );
}