import { useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import type { AccountType } from "../../lib/types";
import { formatAmount } from "../../lib/format";
import type { AccountBalanceMap } from "../../hooks/useAccountBalances";

/** Supported direct transfer routes per backend reality */
const SUPPORTED: Record<AccountType, AccountType[]> = {
  spot: ["funding", "futures", "earn"],
  funding: ["spot"],
  futures: ["spot"],
  earn: ["spot"],
};

type Props = {
  byAccount: AccountBalanceMap;
  onClose: () => void;
  onDone: () => void;
};

export default function TransferSheet({ byAccount, onClose, onDone }: Props) {
  const [from, setFrom] = useState<AccountType>("spot");
  const [to, setTo] = useState<AccountType>("funding");
  const [asset, setAsset] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toOptions = SUPPORTED[from] || [];

  const assetsInFrom = useMemo(() => {
    return byAccount[from]
      .filter((r) => r.available > 0)
      .map((r) => r.asset);
  }, [byAccount, from]);

  const available = useMemo(() => {
    const row = byAccount[from].find(
      (r) => r.asset.toUpperCase() === asset.toUpperCase()
    );
    return row?.available ?? 0;
  }, [byAccount, from, asset]);

  // Keep "to" valid when "from" changes
  const ensureTo = (nextFrom: AccountType) => {
    const opts = SUPPORTED[nextFrom] || [];
    if (!opts.includes(to)) setTo(opts[0] || "spot");
  };

  const submit = async () => {
    setErr(null);
    setMsg(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (n > available) {
      setErr("Amount exceeds available balance.");
      return;
    }
    if (!toOptions.includes(to)) {
      setErr("This transfer direction is not supported.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("transfer_between_accounts", {
      p_from_account: from,
      p_to_account: to,
      p_asset: asset.toUpperCase(),
      p_amount: n,
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
        <div style={styles.sheetHead}>
          <h2 style={styles.sheetTitle}>Transfer</h2>
          <button type="button" style={styles.close} onClick={onClose}>
            ×
          </button>
        </div>

        <p style={styles.hint}>
          Internal transfer between exchange accounts. Only supported direct
          routes are available.
        </p>

        <label style={styles.field}>
          <span>From</span>
          <select
            style={styles.select}
            value={from}
            onChange={(e) => {
              const v = e.target.value as AccountType;
              setFrom(v);
              ensureTo(v);
            }}
          >
            {(["spot", "funding", "futures", "earn"] as AccountType[]).map(
              (a) => (
                <option key={a} value={a}>
                  {a.charAt(0).toUpperCase() + a.slice(1)}
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
                {a.charAt(0).toUpperCase() + a.slice(1)}
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
            {(assetsInFrom.length ? assetsInFrom : ["USDT"]).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span>
            Amount{" "}
            <button
              type="button"
              style={styles.maxBtn}
              onClick={() => setAmount(String(available))}
            >
              Max
            </button>
          </span>
          <input
            style={styles.input}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <small style={styles.avail}>
            Available: {formatAmount(available)} {asset}
          </small>
        </label>

        {err && <div style={styles.err}>{err}</div>}
        {msg && <div style={styles.ok}>{msg}</div>}

        <button
          type="button"
          style={styles.submit}
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Transferring…" : "Confirm transfer"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(0,0,0,0.65)",
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
  sheetHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#fff",
  },
  close: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 24,
    cursor: "pointer",
    lineHeight: 1,
  },
  hint: {
    margin: "0 0 14px",
    fontSize: 12,
    color: "#777",
    lineHeight: 1.45,
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
    padding: "12px 12px",
    fontSize: 14,
    outline: "none",
  },
  input: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px 12px",
    fontSize: 16,
    outline: "none",
  },
  maxBtn: {
    marginLeft: 8,
    background: "transparent",
    border: "none",
    color: "#f5b51b",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  avail: {
    color: "#666",
    fontWeight: 500,
  },
  err: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    marginBottom: 10,
  },
  ok: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#86efac",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    marginBottom: 10,
  },
  submit: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(180deg, #f5b51b 0%, #c9a227 100%)",
    color: "#111",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 4,
  },
};
