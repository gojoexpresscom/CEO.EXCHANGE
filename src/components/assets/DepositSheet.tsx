import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";

type Network = {
  id: string;
  network_name: string;
  is_active: boolean | null;
  deposit_enabled: boolean | null;
  min_deposit: number | null;
  required_confirmations: number | null;
  assets?: { symbol: string; name: string } | null;
};

type Props = {
  onClose: () => void;
};

/**
 * Assets deposit flow — same backend as Home:
 * - networks from asset_networks
 * - address via Edge Function get-deposit-address (never client-generated)
 */
export default function DepositSheet({ onClose }: Props) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [asset, setAsset] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("asset_networks")
      .select(
        "id,network_name,is_active,deposit_enabled,min_deposit,required_confirmations,assets(symbol,name)"
      )
      .eq("is_active", true)
      .eq("deposit_enabled", true);
    if (error) {
      setErr(error.message);
      setNetworks([]);
    } else {
      setNetworks((data as Network[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assets = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of networks) {
      const s = String(n.assets?.symbol ?? "").toUpperCase();
      if (s) m.set(s, String(n.assets?.name ?? s));
    }
    return [...m.entries()]
      .map(([symbol, name]) => ({ symbol, name }))
      .filter((a) =>
        `${a.symbol} ${a.name}`.toLowerCase().includes(search.trim().toLowerCase())
      )
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [networks, search]);

  const assetNetworks = useMemo(() => {
    if (!asset) return [];
    return networks.filter(
      (n) => String(n.assets?.symbol ?? "").toUpperCase() === asset
    );
  }, [networks, asset]);

  const provision = async (n: Network) => {
    setBusy(true);
    setErr(null);
    setAddress(null);
    const { data, error } = await supabase.functions.invoke(
      "get-deposit-address",
      { body: { network_id: n.id } }
    );
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data?.error) {
      setErr(String(data.error));
      return;
    }
    if (data?.address) {
      setNetwork(n);
      setAddress(String(data.address));
    } else {
      setErr(
        "No deposit address returned. Backend get-deposit-address did not provide an address."
      );
    }
  };

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.sheet}>
        <div style={styles.head}>
          <h2 style={styles.title}>Deposit</h2>
          <button type="button" style={styles.close} onClick={onClose}>
            ×
          </button>
        </div>

        {err && <div style={styles.err}>{err}</div>}

        {loading ? (
          <div style={styles.empty}>Loading networks…</div>
        ) : !asset ? (
          <>
            <input
              style={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search asset"
            />
            <div style={styles.list}>
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  type="button"
                  style={styles.row}
                  onClick={() => setAsset(a.symbol)}
                >
                  <b>{a.symbol}</b>
                  <span style={styles.muted}>{a.name}</span>
                </button>
              ))}
              {!assets.length && (
                <div style={styles.empty}>
                  No deposit-enabled networks configured in Supabase.
                </div>
              )}
            </div>
          </>
        ) : !address ? (
          <>
            <button type="button" style={styles.back} onClick={() => setAsset(null)}>
              ← {asset}
            </button>
            <p style={styles.hint}>
              Select a network. Address is provisioned by the backend (same
              get-deposit-address flow as Home).
            </p>
            <div style={styles.list}>
              {assetNetworks.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  style={styles.row}
                  disabled={busy}
                  onClick={() => void provision(n)}
                >
                  <b>{n.network_name}</b>
                  <span style={styles.muted}>
                    {n.min_deposit != null
                      ? `Min ${n.min_deposit}`
                      : "Min not set"}
                    {n.required_confirmations != null
                      ? ` · ${n.required_confirmations} conf`
                      : ""}
                  </span>
                </button>
              ))}
              {!assetNetworks.length && (
                <div style={styles.empty}>No networks for {asset}.</div>
              )}
            </div>
            {busy && <div style={styles.empty}>Provisioning address…</div>}
          </>
        ) : (
          <>
            <button
              type="button"
              style={styles.back}
              onClick={() => {
                setAddress(null);
                setNetwork(null);
              }}
            >
              ← Change network
            </button>
            <div style={styles.addrCard}>
              <div style={styles.muted}>
                {asset} · {network?.network_name}
              </div>
              <div style={styles.addr}>{address}</div>
              <button type="button" style={styles.copy} onClick={() => void copy()}>
                {copied ? "Copied" : "Copy address"}
              </button>
            </div>
            <p style={styles.hint}>
              Only send {asset} on {network?.network_name}. Address was never
              generated in the browser.
            </p>
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
    maxHeight: "88vh",
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
  search: {
    width: "100%",
    boxSizing: "border-box",
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#fff",
    padding: "12px",
    marginBottom: 10,
    fontSize: 14,
  },
  list: { display: "flex", flexDirection: "column" },
  row: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "12px 4px",
    border: "none",
    borderBottom: "1px solid #151515",
    background: "transparent",
    color: "#eee",
    cursor: "pointer",
    textAlign: "left",
  },
  muted: { fontSize: 12, color: "#777" },
  empty: { padding: 24, textAlign: "center", color: "#777", fontSize: 13 },
  back: {
    background: "transparent",
    border: "none",
    color: "#c9a227",
    fontWeight: 600,
    marginBottom: 10,
    cursor: "pointer",
  },
  hint: { fontSize: 12, color: "#777", lineHeight: 1.45 },
  err: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    marginBottom: 10,
  },
  addrCard: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  addr: {
    fontFamily: "ui-monospace, monospace",
    fontSize: 13,
    color: "#fff",
    wordBreak: "break-all",
    margin: "10px 0",
  },
  copy: {
    width: "100%",
    minHeight: 40,
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(180deg, #f5b51b 0%, #c9a227 100%)",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
  },
};
