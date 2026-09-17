import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { formatAmount } from "../../lib/format";
import { useAccountBalances } from "../../hooks/useAccountBalances";

type Network = {
  id: string;
  network_name: string;
  is_active: boolean | null;
  withdrawal_enabled: boolean | null;
  min_withdrawal: number | null;
  withdrawal_fee: number | null;
  withdrawal_network_code: string | null;
  assets?: { symbol: string; name: string } | null;
};

type Props = {
  onClose: () => void;
  onDone?: () => void;
};

/**
 * Assets withdraw flow — same backend contracts as Home:
 * send-otp, verify-otp, get-withdrawal-fee-quote / calculate_withdrawal_fee,
 * process_crypto_withdrawal.
 */
export default function WithdrawSheet({ onClose, onDone }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState("USDT");
  const [networkId, setNetworkId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setUserId(data.session?.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { byAccount, refresh } = useAccountBalances(userId);

  const loadNetworks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("asset_networks")
      .select(
        "id,network_name,is_active,withdrawal_enabled,min_withdrawal,withdrawal_fee,withdrawal_network_code,assets(symbol,name)"
      )
      .eq("is_active", true)
      .eq("withdrawal_enabled", true);
    if (!error) setNetworks((data as Network[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadNetworks();
  }, [loadNetworks]);

  const routes = useMemo(
    () =>
      networks.filter(
        (n) =>
          n.withdrawal_enabled === true &&
          !!n.withdrawal_network_code &&
          String(n.assets?.symbol ?? "").toUpperCase() === asset.toUpperCase()
      ),
    [networks, asset]
  );

  const selected = routes.find((n) => n.id === networkId) || routes[0] || null;

  const available =
    byAccount.spot.find((r) => r.asset.toUpperCase() === asset.toUpperCase())
      ?.available ?? 0;

  const assetOptions = useMemo(() => {
    const fromSpot = byAccount.spot.map((r) => r.asset);
    const fromNet = networks
      .map((n) => String(n.assets?.symbol ?? "").toUpperCase())
      .filter(Boolean);
    return [...new Set([...fromSpot, ...fromNet])].sort();
  }, [byAccount.spot, networks]);

  const requestOtp = async () => {
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: { purpose: "withdrawal" },
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data?.error) {
      setErr(String(data.error));
      return;
    }
    setOtpSent(true);
    setMsg("OTP sent. Enter the code to confirm withdrawal.");
  };

  const quoteFee = async () => {
    setErr(null);
    if (!selected?.withdrawal_network_code) {
      setErr("Select a supported network.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    // Prefer Edge Function used by Home; fall back to RPC
    const ef = await supabase.functions.invoke("get-withdrawal-fee-quote", {
      body: {
        asset,
        network: selected.withdrawal_network_code,
        amount: n,
      },
    });
    if (!ef.error && ef.data && !ef.data.error) {
      const f =
        ef.data.fee ?? ef.data.total_fee ?? ef.data.withdrawal_fee ?? null;
      setFee(f != null ? Number(f) : null);
      setBusy(false);
      return;
    }
    const rpc = await supabase.rpc("calculate_withdrawal_fee", {
      p_amount: n,
      p_currency: asset,
      p_network: selected.withdrawal_network_code,
    });
    setBusy(false);
    if (rpc.error) {
      setErr(rpc.error.message || ef.error?.message || "Fee quote failed");
      return;
    }
    const f =
      typeof rpc.data === "number"
        ? rpc.data
        : (rpc.data as { fee?: number })?.fee ?? null;
    setFee(f != null ? Number(f) : null);
  };

  const submit = async () => {
    setErr(null);
    setMsg(null);
    if (!selected?.withdrawal_network_code) {
      setErr("Select a network.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (!address.trim()) {
      setErr("Enter destination address.");
      return;
    }
    if (!otp.trim()) {
      setErr("Enter OTP.");
      return;
    }
    setBusy(true);
    const verify = await supabase.functions.invoke("verify-otp", {
      body: { code: otp, purpose: "withdrawal" },
    });
    if (verify.error || verify.data?.error) {
      setBusy(false);
      setErr(
        verify.error?.message ||
          String(verify.data?.error) ||
          "OTP verification failed"
      );
      return;
    }
    const { data, error } = await supabase.rpc("process_crypto_withdrawal", {
      p_asset: asset,
      p_network: selected.withdrawal_network_code,
      p_amount: n,
      p_destination_address: address.trim(),
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
    setMsg("Withdrawal submitted.");
    void refresh();
    onDone?.();
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.sheet}>
        <div style={styles.head}>
          <h2 style={styles.title}>Withdraw</h2>
          <button type="button" style={styles.close} onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : (
          <>
            <label style={styles.field}>
              <span>Asset (Spot balance)</span>
              <select
                style={styles.select}
                value={asset}
                onChange={(e) => {
                  setAsset(e.target.value);
                  setNetworkId("");
                  setFee(null);
                }}
              >
                {(assetOptions.length ? assetOptions : ["USDT"]).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <small style={styles.muted}>
                Available {formatAmount(available)} {asset}
              </small>
            </label>

            <label style={styles.field}>
              <span>Network</span>
              <select
                style={styles.select}
                value={selected?.id || ""}
                onChange={(e) => {
                  setNetworkId(e.target.value);
                  setFee(null);
                }}
              >
                {routes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.network_name}
                  </option>
                ))}
              </select>
              {!routes.length && (
                <small style={styles.muted}>
                  No withdrawal-enabled network for {asset}.
                </small>
              )}
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

            <label style={styles.field}>
              <span>Destination address</span>
              <input
                style={styles.input}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Paste address"
              />
            </label>

            <button
              type="button"
              style={styles.secondary}
              disabled={busy}
              onClick={() => void quoteFee()}
            >
              Get fee quote
            </button>
            {fee != null && (
              <div style={styles.muted}>Fee: {formatAmount(fee)} {asset}</div>
            )}

            <button
              type="button"
              style={styles.secondary}
              disabled={busy}
              onClick={() => void requestOtp()}
            >
              {otpSent ? "Resend OTP" : "Send OTP"}
            </button>

            <label style={styles.field}>
              <span>OTP</span>
              <input
                style={styles.input}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Code"
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
              {busy ? "…" : "Confirm withdrawal"}
            </button>
          </>
        )}
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
    maxHeight: "90vh",
    overflow: "auto",
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
  muted: { fontSize: 12, color: "#777", fontWeight: 500 },
  empty: { padding: 24, textAlign: "center", color: "#777" },
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
    marginTop: 8,
  },
  secondary: {
    width: "100%",
    minHeight: 40,
    borderRadius: 10,
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#f5b51b",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 10,
  },
};
