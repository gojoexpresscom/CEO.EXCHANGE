import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";

type InstrumentRow = {
  symbol: string;
  base_asset: string | null;
  quote_asset: string | null;
  provider_status: string | null;
  is_active: boolean | null;
  min_qty: number | string | null;
  max_qty: number | string | null;
  qty_step: number | string | null;
  tick_size: number | string | null;
  min_notional: number | string | null;
  synced_at: string | null;
};

type SyncResult = {
  ok?: boolean;
  provider?: string;
  symbols_processed?: number;
  symbols_upserted?: number;
  activated_by_this_sync?: number;
  total_instruments?: number;
  active_instruments?: number;
  inactive_instruments?: number;
  sync_time?: string;
  error?: string;
  message?: string;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  lastSynced: string | null;
};

function fmtNum(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(n);
}

function humanError(err: unknown, data?: SyncResult | null): string {
  const msg =
    (data && (data.message || data.error)) ||
    (err instanceof Error ? err.message : null) ||
    (typeof err === "string" ? err : null) ||
    "Sync failed";

  const upper = String(msg).toUpperCase();
  if (upper.includes("NOT_AUTHENTICATED") || upper.includes("401")) {
    return "Not authenticated. Sign in again as an admin.";
  }
  if (upper.includes("NOT_AUTHORIZED") || upper.includes("403")) {
    return "Not authorized. Admin or owner role required.";
  }
  if (upper.includes("SYNC_UPSERT_FAILED")) {
    return "Symbol sync failed while saving instruments. Try again later.";
  }
  if (upper.includes("BINANCE_EXCHANGE_INFO_EMPTY") || upper.includes("502")) {
    return "Binance returned no exchange info. Try again later.";
  }
  // Never surface secrets / JWTs
  if (/jwt|bearer|api[_-]?key|secret|signature/i.test(String(msg))) {
    return "Sync failed. Check admin access and try again.";
  }
  return String(msg).slice(0, 200);
}

export default function BinanceOperations() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    inactive: 0,
    lastSynced: null,
  });
  const [rows, setRows] = useState<InstrumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const loadInstruments = useCallback(async () => {
    setLoadError(null);
    try {
      const { count: total, error: cErr } = await supabase
        .from("binance_spot_instruments")
        .select("*", { count: "exact", head: true });

      if (cErr) throw cErr;

      const { count: active, error: aErr } = await supabase
        .from("binance_spot_instruments")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (aErr) throw aErr;

      const { data, error } = await supabase
        .from("binance_spot_instruments")
        .select(
          "symbol,base_asset,quote_asset,provider_status,is_active,min_qty,max_qty,qty_step,tick_size,min_notional,synced_at",
        )
        .order("symbol", { ascending: true })
        .limit(200);

      if (error) throw error;

      const list = (data ?? []) as InstrumentRow[];
      let lastSynced: string | null = null;
      for (const r of list) {
        if (r.synced_at && (!lastSynced || r.synced_at > lastSynced)) {
          lastSynced = r.synced_at;
        }
      }

      const t = total ?? list.length;
      const a = active ?? list.filter((r) => r.is_active === true).length;

      setStats({
        total: t,
        active: a,
        inactive: Math.max(0, t - a),
        lastSynced,
      });
      setRows(list);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load Binance instruments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstruments();
  }, [loadInstruments]);

  const syncSymbols = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "binance-spot-private",
        {
          body: { action: "sync_symbols" },
        },
      );

      const payload = (data ?? null) as SyncResult | null;

      if (error) {
        setSyncError(humanError(error, payload));
        return;
      }
      if (payload && payload.ok === false) {
        setSyncError(humanError(null, payload));
        return;
      }

      setSyncResult(payload);
      await loadInstruments();
    } catch (e) {
      setSyncError(humanError(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={wrap}>
      {/* Provider status */}
      <section style={card}>
        <div style={cardHead}>
          <h3 style={cardTitle}>Binance</h3>
          <span style={badgeOff}>Not Active</span>
        </div>
        <div style={kvGrid}>
          <div style={kv}>
            <span style={kLabel}>Provider</span>
            <span style={kValue}>Binance</span>
          </div>
          <div style={kv}>
            <span style={kLabel}>Spot Execution</span>
            <span style={{ ...kValue, color: "#f87171" }}>OFF</span>
          </div>
          <div style={kv}>
            <span style={kLabel}>Status</span>
            <span style={{ ...kValue, color: "#999" }}>Not Active</span>
          </div>
        </div>
        <p style={hint}>
          Symbol synchronization is available. Customer trading is currently
          disabled.
        </p>
        <p style={warn}>
          Trading is currently disabled. Symbol synchronization does not
          activate trading.
        </p>
      </section>

      {/* Spot instruments stats */}
      <section style={card}>
        <div style={cardHead}>
          <h3 style={cardTitle}>Binance Spot Instruments</h3>
        </div>

        {loading ? (
          <div style={{ color: "#666", padding: "12px 0", fontSize: 13 }}>
            Loading instruments…
          </div>
        ) : loadError ? (
          <div style={errBox}>
            <div>{loadError}</div>
            <button type="button" style={secondaryBtn} onClick={() => void loadInstruments()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div style={statGrid}>
              <div style={statCell}>
                <div style={statNum}>{stats.total}</div>
                <div style={statLabel}>Total Instruments</div>
              </div>
              <div style={statCell}>
                <div style={{ ...statNum, color: stats.active > 0 ? "#22c55e" : "#888" }}>
                  {stats.active}
                </div>
                <div style={statLabel}>Active Instruments</div>
              </div>
              <div style={statCell}>
                <div style={statNum}>{stats.inactive}</div>
                <div style={statLabel}>Inactive Instruments</div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
              Last sync:{" "}
              {stats.lastSynced
                ? new Date(stats.lastSynced).toLocaleString()
                : "Never"}
            </div>
            {stats.active === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
                Active instruments: 0 — provider TRADING status is not treated as
                is_active.
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            style={{
              ...primaryBtn,
              opacity: syncing ? 0.65 : 1,
              cursor: syncing ? "not-allowed" : "pointer",
            }}
            disabled={syncing}
            onClick={() => void syncSymbols()}
          >
            {syncing ? "Syncing Binance Symbols…" : "Sync Binance Symbols"}
          </button>
        </div>

        {syncError && <div style={{ ...errBox, marginTop: 14 }}>{syncError}</div>}

        {syncResult && !syncError && (
          <div style={resultBox}>
            <div style={resultTitle}>Last sync result</div>
            <div style={resultGrid}>
              <span>Symbols processed</span>
              <strong>{syncResult.symbols_processed ?? "—"}</strong>
              <span>Symbols upserted</span>
              <strong>{syncResult.symbols_upserted ?? "—"}</strong>
              <span>Active instruments</span>
              <strong>{syncResult.active_instruments ?? "—"}</strong>
              <span>Inactive instruments</span>
              <strong>{syncResult.inactive_instruments ?? "—"}</strong>
              <span>Sync time</span>
              <strong>
                {syncResult.sync_time
                  ? new Date(syncResult.sync_time).toLocaleString()
                  : "—"}
              </strong>
            </div>
          </div>
        )}
      </section>

      {/* Instrument preview */}
      <section style={card}>
        <div style={cardHead}>
          <h3 style={cardTitle}>Instrument preview</h3>
          <span style={{ fontSize: 12, color: "#666" }}>
            {rows.length ? `Showing ${rows.length}` : ""}
          </span>
        </div>

        {!loading && stats.total === 0 ? (
          <div style={empty}>
            <div style={{ color: "#aaa", fontWeight: 600, marginBottom: 8 }}>
              No Binance Spot instruments synchronized yet.
            </div>
            <div style={{ color: "#666", fontSize: 13, lineHeight: 1.45 }}>
              Synchronize Binance market metadata to populate this section.
            </div>
          </div>
        ) : (
          <div style={tableScroll}>
            <table style={table}>
              <thead>
                <tr>
                  {[
                    "Symbol",
                    "Base",
                    "Quote",
                    "Provider Status",
                    "Active",
                    "Min Qty",
                    "Max Qty",
                    "Qty Step",
                    "Tick Size",
                    "Min Notional",
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} style={{ borderBottom: "1px solid #151515" }}>
                    <td style={td}>{r.symbol}</td>
                    <td style={td}>{r.base_asset || "—"}</td>
                    <td style={td}>{r.quote_asset || "—"}</td>
                    <td style={td}>{r.provider_status || "—"}</td>
                    <td style={td}>
                      {r.is_active ? (
                        <span style={{ color: "#22c55e" }}>Active</span>
                      ) : (
                        <span style={{ color: "#888" }}>Inactive</span>
                      )}
                    </td>
                    <td style={td}>{fmtNum(r.min_qty)}</td>
                    <td style={td}>{fmtNum(r.max_qty)}</td>
                    <td style={td}>{fmtNum(r.qty_step)}</td>
                    <td style={td}>{fmtNum(r.tick_size)}</td>
                    <td style={td}>{fmtNum(r.min_notional)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
  maxWidth: 960,
  width: "100%",
};

const card: CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #1a1a1a",
  borderRadius: 14,
  padding: 20,
};

const cardHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
  flexWrap: "wrap",
};

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
};

const badgeOff: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#f87171",
  background: "rgba(248,113,113,0.12)",
  border: "1px solid rgba(248,113,113,0.25)",
  borderRadius: 999,
  padding: "4px 10px",
};

const kvGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const kv: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const kLabel: CSSProperties = { fontSize: 11, color: "#666", fontWeight: 600 };
const kValue: CSSProperties = { fontSize: 14, color: "#eee", fontWeight: 600 };

const hint: CSSProperties = {
  margin: "14px 0 0",
  fontSize: 13,
  color: "#999",
  lineHeight: 1.45,
};

const warn: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 12,
  color: "#f5b51b",
  lineHeight: 1.45,
  background: "rgba(245,181,27,0.08)",
  border: "1px solid rgba(245,181,27,0.2)",
  borderRadius: 10,
  padding: "10px 12px",
};

const statGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const statCell: CSSProperties = {
  background: "#0e0e0e",
  border: "1px solid #1c1c1c",
  borderRadius: 12,
  padding: "14px 12px",
  textAlign: "center",
};

const statNum: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#fff",
  fontVariantNumeric: "tabular-nums",
};

const statLabel: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#777",
  fontWeight: 600,
};

const primaryBtn: CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "11px 16px",
  background: "linear-gradient(180deg, #f5c542, #e0a010)",
  color: "#111",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  marginTop: 10,
  border: "1px solid #2a2110",
  background: "transparent",
  color: "#f5b51b",
  borderRadius: 8,
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const errBox: CSSProperties = {
  marginTop: 4,
  padding: 12,
  borderRadius: 10,
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.25)",
  color: "#fca5a5",
  fontSize: 13,
};

const resultBox: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  background: "#0e0e0e",
  border: "1px solid #1c1c1c",
};

const resultTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#f5b51b",
  marginBottom: 10,
};

const resultGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "8px 16px",
  fontSize: 13,
  color: "#aaa",
};

const empty: CSSProperties = {
  padding: "28px 12px",
  textAlign: "center",
};

const tableScroll: CSSProperties = {
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  margin: "0 -4px",
};

const table: CSSProperties = {
  width: "100%",
  minWidth: 720,
  borderCollapse: "collapse",
  fontSize: 12,
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  fontWeight: 600,
  color: "#777",
  borderBottom: "1px solid #1f1f1f",
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "10px 10px",
  color: "#ccc",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
