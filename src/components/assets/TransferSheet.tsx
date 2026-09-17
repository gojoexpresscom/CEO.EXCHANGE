import { useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { formatAmount } from "../../lib/format";
import type { AccountType } from "../../lib/types";
import type { AccountBalances } from "../../hooks/useAccountBalances";

type Props = {
  byAccount: AccountBalances["byAccount"];
  onClose: () => void;
  onDone: () => void;
};

/** Backend-supported routes only */
const SUPPORTED: Record<AccountType, AccountType[]> = {
  spot: ["funding", "futures", "earn"],
  funding: ["spot"],
  futures: ["spot"],
  earn: ["spot"],
};

export default function TransferSheet({ byAccount, onClose, onDone }: Props) {
  const [from, setFrom] = useState<AccountType>("spot");
  const [to, setTo] = useState<AccountType>("funding");
  const [asset, setAsset] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const toOptions = SUPPORTED[from] || [];

  const fromAssets = useMemo(() => {
    return byAccount[from].map((r) => r.asset);
  }, [byAccount, from]);

  const available =
    byAccount[from].find((r) => r.asset === asset)?.available ?? 0;

  const onFromChange = (nextFrom: AccountType) => {
    setFrom(nextFrom);
    const opts = SUPPORTED[nextFrom] || [];
    setTo(opts.includes(to) ? to : opts[0] || "spot");
    const assets = byAccount[nextFrom].map((r) => r.asset);
    if (assets.length && !assets.includes(asset)) {
      setAsset(assets[0]);
    }
  };

  const submit = async () => {
    setErr(null);
    setMsg(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (!toOptions.includes(to)) {
      setErr(`Transfer ${from} → ${to} is not supported.`);
      return;
    }
    if (n > available) {
      setErr("Insufficient available balance.");
      return;
    }

    setBusy(true);
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `xfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const { data, error } = await supabase.rpc("transfer_between_accounts", {
      p_asset: asset,
      p_from_account: from,
      p_to_account: to,
      p_amount: n,
      p_idempotency_key: idempotencyKey,
    });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }
    if (data && typeof data === "object" && "error" in (data as object)) {
      setErr(String((data as { error: unknown }).error));
      return;
    }
    setMsg("Transfer completed.");
    setAmount("");
    onDone();
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.sheet}>
        <div style={styles.head}>
          <h2 style={styles.title}>Transfer</h2>
          <button type="button" style={styles.close} onClick={onClose}>
            ×
          </button>
        </div>

        <label style={styles.field}>
          <span>From</span>
          <select
            style={styles.select}
            value={from}
            onChange={(e) => onFromChange(e.target.value as AccountType)}
          >
            {(["spot", "funding", "futures", "earn"] as AccountType[]).map(
              (a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              )
            )}
          </select>
        </label>

        <label style={styles.field}>
          <span>To</span>
          <select
            style={styles.select}
            value={to}
            onChange={(e) => setTo(e.target.value as AccountType)}
          >
            {toOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span>Asset</span>
          <select
            style={styles.select}
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {(fromAssets.length ? fromAssets : ["USDT"]).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <small style={styles.avail}>
            Available {formatAmount(available)} {asset}
          </small>
        </label>

        <label style={styles.field}>
          <span>Amount</span>
          <input
            style={styles.input}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>

        {err && <div style={styles.err}>{err}</div>}
        {msg && <div style={styles.ok}>{msg}</div>}

        <button
          type="button"
          style={styles.primary}
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "…" : "Confirm transfer"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 90,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    background: "#0c0c0c",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    border: "1px solid #1f1f1f",
    padding: "16px 18px calc(20px + env(safe-area-inset-bottom, 0px))",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" },
  close: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 24,
    cursor: "pointer",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
    fontSize: 12,
    color: "#999",
    fontWeight: 600,
  },
  select: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px",
    fontSize: 14,
  },
  input: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px",
    fontSize: 14,
    outline: "none",
  },
  avail: { color: "#666", fontWeight: 500 },
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
  },
};

