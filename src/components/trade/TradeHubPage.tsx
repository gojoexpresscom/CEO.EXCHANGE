import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import BottomNav from "../nav/BottomNav";
import { formatAmount } from "../../lib/format";
import { useAccountBalances } from "../../hooks/useAccountBalances";
import type { NavPage } from "../../lib/types";

type Props = {
  onNavigate: (page: NavPage) => void;
  onOpenPair: (symbol: string) => void;
};

type HubTab = "Convert" | "Spot" | "Futures" | "Options" | "Alpha";

/**
 * Trade hub — NOT the trading terminal.
 * Default tab is Convert (ChangeNOW). Spot opens pair selection path into TradingPage.
 * Futures / Options / Alpha stay honest when backend is incomplete.
 */
export default function TradeHubPage({ onNavigate, onOpenPair }: Props) {
  const [tab, setTab] = useState<HubTab>("Convert");
  const [userId, setUserId] = useState<string | null>(null);
  const [fromAsset, setFromAsset] = useState("USDT");
  const [toAsset, setToAsset] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"Instant" | "Limit">("Instant");

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { byAccount } = useAccountBalances(userId);
  const spotAssets = byAccount.spot.map((r) => r.asset);
  const available =
    byAccount.spot.find((r) => r.asset === fromAsset)?.available ?? 0;

  const requestQuote = async () => {
    setErr(null);
    setMsg(null);
    setQuote(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("changenow-swap", {
      body: {
        from_currency: fromAsset,
        to_currency: toAsset,
        amount: n,
        from: fromAsset,
        to: toAsset,
      },
    });
    setBusy(false);
    if (error) {
      setErr(
        error.message ||
          "changenow-swap unavailable. Cloud must confirm the Edge Function is deployed."
      );
      return;
    }
    if (data?.error) {
      setErr(String(data.error));
      return;
    }
    const estimated =
      data?.toAmount ??
      data?.to_amount ??
      data?.estimatedAmount ??
      data?.amount_to ??
      data?.result?.toAmount ??
      null;
    if (estimated != null) {
      setQuote(String(estimated));
      setMsg("Quote received.");
    } else {
      setErr(
        "Quote response shape not recognized. Confirm changenow-swap contract with Cloud."
      );
    }
  };

  const confirm = async () => {
    setErr(null);
    setMsg(null);
    const n = Number(amount);
    if (!quote) {
      setErr("Request a quote first.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke(
      "changenow-create-exchange",
      {
        body: {
          from_currency: fromAsset,
          to_currency: toAsset,
          amount: n,
          from: fromAsset,
          to: toAsset,
        },
      }
    );
    setBusy(false);
    if (error) {
      setErr(
        error.message ||
          "changenow-create-exchange unavailable. Confirm deployment with Cloud."
      );
      return;
    }
    if (data?.error) {
      setErr(String(data.error));
      return;
    }
    const id =
      data?.id ??
      data?.exchange_id ??
      data?.orderId ??
      data?.exchangeId ??
      null;
    const status = data?.status ?? null;
    if (!id) {
      setErr(
        "Conversion ID was not returned by changenow-create-exchange. Exchange not confirmed."
      );
      return;
    }
    setMsg(
      `Exchange submitted${status ? ` (${status})` : ""} · ${id}.`
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.topTabs}>
        {(
          ["Convert", "Spot", "Futures", "Options", "Alpha"] as HubTab[]
        ).map((t) => (
          <button
            key={t}
            type="button"
            style={{
              ...styles.topTab,
              ...(tab === t ? styles.topTabActive : {}),
            }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Convert" && (
        <div style={styles.body}>
          <div style={styles.modeRow}>
            {(["Instant", "Limit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                style={{
                  ...styles.modeBtn,
                  ...(mode === m ? styles.modeBtnActive : {}),
                }}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === "Limit" ? (
            <div style={styles.infoBox}>
              Limit convert is not available yet. Use Instant when ChangeNOW
              execution is enabled.
            </div>
          ) : (
            <>
              <label style={styles.field}>
                <span>
                  From{" "}
                  <small style={styles.avail}>
                    Available {formatAmount(available)} {fromAsset}
                  </small>
                </span>
                <div style={styles.row}>
                  <select
                    style={styles.select}
                    value={fromAsset}
                    onChange={(e) => setFromAsset(e.target.value)}
                  >
                    {(spotAssets.length
                      ? spotAssets
                      : ["USDT", "BTC", "ETH"]
                    ).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <input
                    style={styles.input}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    style={styles.max}
                    onClick={() => setAmount(String(available))}
                  >
                    Max
                  </button>
                </div>
              </label>

              <div style={styles.swap}>⇅</div>

              <label style={styles.field}>
                <span>To</span>
                <div style={styles.row}>
                  <select
                    style={styles.select}
                    value={toAsset}
                    onChange={(e) => setToAsset(e.target.value)}
                  >
                    {["BTC", "ETH", "USDT", "USDC", "SOL"].map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <div style={styles.quoteBox}>{quote ?? "—"}</div>
                </div>
              </label>

              {err && <div style={styles.err}>{err}</div>}
              {msg && <div style={styles.ok}>{msg}</div>}

              <button
                type="button"
                style={styles.primary}
                disabled={busy}
                onClick={() => void requestQuote()}
              >
                {busy ? "…" : "Quote"}
              </button>
              <button
                type="button"
                style={styles.secondary}
                disabled={busy || !quote}
                onClick={() => void confirm()}
              >
                Confirm
              </button>
              <p style={styles.note}>
                ChangeNOW via <code>changenow-swap</code> /{" "}
                <code>changenow-create-exchange</code>. No client API keys. No
                fake quotes.
              </p>
            </>
          )}
        </div>
      )}

      {tab === "Spot" && (
        <div style={styles.body}>
          <p style={styles.lead}>
            Open the spot trading terminal for a pair. Discovery lives in
            Markets; this opens the existing TradingPage.
          </p>
          <button
            type="button"
            style={styles.primary}
            onClick={() => onNavigate("markets")}
          >
            Browse markets
          </button>
          <button
            type="button"
            style={styles.secondary}
            onClick={() => onOpenPair("BTCUSDT")}
          >
            Trade BTC/USDT
          </button>
        </div>
      )}

      {tab === "Futures" && (
        <div style={styles.body}>
          <div style={styles.infoBox}>
            Futures execution, risk, liquidation, and funding settlement are
            still being completed on the backend. No fake positions or PnL are
            shown. When ready, this tab will open the futures trading flow.
          </div>
          <button
            type="button"
            style={styles.secondary}
            onClick={() => onNavigate("markets")}
          >
            View markets
          </button>
        </div>
      )}

      {tab === "Options" && (
        <div style={styles.body}>
          <div style={styles.infoBox}>
            Options are not available. No provider is integrated.
          </div>
        </div>
      )}

      {tab === "Alpha" && (
        <div style={styles.body}>
          <div style={styles.infoBox}>
            Alpha discovery is not available yet on CEO.EXCHANGE.
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
      <BottomNav active="trade" onNavigate={onNavigate} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    color: "#eee",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  topTabs: {
    display: "flex",
    gap: 4,
    padding: "14px 12px 10px",
    overflowX: "auto",
    borderBottom: "1px solid #141414",
  },
  topTab: {
    flexShrink: 0,
    background: "transparent",
    border: "none",
    color: "#777",
    fontSize: 14,
    fontWeight: 700,
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  topTabActive: {
    color: "#f5b51b",
    background: "rgba(245,181,27,0.1)",
  },
  body: { padding: "16px 16px 8px" },
  modeRow: { display: "flex", gap: 12, marginBottom: 16 },
  modeBtn: {
    background: "transparent",
    border: "none",
    color: "#777",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
  },
  modeBtnActive: { color: "#fff" },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
    fontSize: 12,
    color: "#999",
    fontWeight: 600,
  },
  avail: { color: "#666", fontWeight: 500, marginLeft: 8 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  select: {
    width: 96,
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px 8px",
    fontSize: 14,
  },
  input: {
    flex: 1,
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px",
    fontSize: 16,
    outline: "none",
  },
  max: {
    background: "transparent",
    border: "none",
    color: "#f5b51b",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  quoteBox: {
    flex: 1,
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px",
    fontSize: 16,
  },
  swap: {
    textAlign: "center",
    color: "#c9a227",
    fontSize: 18,
    margin: "6px 0 12px",
  },
  primary: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(180deg, #f5b51b 0%, #c9a227 100%)",
    color: "#111",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 10,
  },
  secondary: {
    width: "100%",
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#f5b51b",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    marginTop: 8,
  },
  err: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    marginBottom: 8,
  },
  ok: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#86efac",
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    marginBottom: 8,
  },
  note: { marginTop: 14, fontSize: 11, color: "#666", lineHeight: 1.45 },
  lead: { fontSize: 13, color: "#999", lineHeight: 1.5, marginBottom: 14 },
  infoBox: {
    background: "rgba(245,181,27,0.08)",
    border: "1px solid #2a2110",
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: "#c9a227",
    lineHeight: 1.5,
    marginBottom: 14,
  },
};

