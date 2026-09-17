import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import BottomNav from "../nav/BottomNav";
import { formatAmount } from "../../lib/format";
import type { NavPage } from "../../lib/types";
import { useAccountBalances } from "../../hooks/useAccountBalances";

type Props = {
  onNavigate: (page: NavPage) => void;
};

/**
 * Convert UI backed by existing ChangeNOW integration.
 * API keys stay on the backend. Execution status is shown honestly.
 */
export default function ConvertPage({ onNavigate }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [fromAsset, setFromAsset] = useState("USDT");
  const [toAsset, setToAsset] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
    // Backend audit names (not in this repo's supabase/functions tree):
    //   changenow-swap            — quote / rate
    //   changenow-create-exchange — create exchange
    // Payload is best-effort; Cloud must confirm the exact contract.
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
          "changenow-swap unavailable. Confirm the Edge Function is deployed and the request body matches Cloud's contract."
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
      setMsg("Quote received from changenow-swap.");
    } else {
      setErr(
        "changenow-swap responded without a recognizable quote field (toAmount / to_amount / estimatedAmount). Cloud needs to confirm the response shape."
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
          "changenow-create-exchange unavailable. Confirm deployment and request body with Cloud."
      );
      return;
    }
    if (data?.error) {
      setErr(String(data.error));
      return;
    }
    const id = data?.id ?? data?.exchange_id ?? data?.orderId ?? null;
    const status = data?.status ?? null;
    if (id || status) {
      setMsg(
        `Exchange submitted${status ? ` (${status})` : ""}${id ? ` · ${id}` : ""}. Status depends on ChangeNOW / backend.`
      );
    } else {
      setMsg(
        "Backend accepted the call. Final settlement depends on changenow-create-exchange response fields — verify with Cloud if status is unclear."
      );
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          style={styles.back}
          onClick={() => onNavigate("assets")}
        >
          ← Assets
        </button>
        <h1 style={styles.title}>Convert</h1>
        <span style={{ width: 64 }} />
      </header>

      <div style={styles.card}>
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
              {(spotAssets.length ? spotAssets : ["USDT", "BTC", "ETH"]).map(
                (a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                )
              )}
            </select>
            <input
              style={styles.input}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </label>

        <div style={styles.swapHint}>↓</div>

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
          {busy ? "…" : "Get quote"}
        </button>
        <button
          type="button"
          style={styles.secondary}
          disabled={busy || !quote}
          onClick={() => void confirm()}
        >
          Confirm convert
        </button>

        <p style={styles.note}>
          Uses Edge Functions <code>changenow-swap</code> (quote) and{" "}
          <code>changenow-create-exchange</code> (execute) per backend audit.
          These functions are not in the frontend repo&apos;s{" "}
          <code>supabase/functions</code> tree — Cloud must confirm they are
          deployed and document the exact request/response contract. Provider
          API keys never leave the backend. No fake success is shown.
        </p>
      </div>

      <div style={{ height: 80 }} />
      <BottomNav active="assets" onNavigate={onNavigate} />
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
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
  },
  back: {
    background: "transparent",
    border: "none",
    color: "#c9a227",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" },
  card: {
    margin: "8px 16px",
    padding: 16,
    background: "#0c0c0c",
    border: "1px solid #1a1a1a",
    borderRadius: 14,
  },
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
  row: { display: "flex", gap: 8 },
  select: {
    width: 100,
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
  quoteBox: {
    flex: 1,
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
  },
  swapHint: {
    textAlign: "center",
    color: "#c9a227",
    fontSize: 18,
    margin: "4px 0 10px",
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
    marginTop: 8,
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
  note: {
    marginTop: 14,
    fontSize: 11,
    color: "#666",
    lineHeight: 1.45,
  },
};
