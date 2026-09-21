import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { P2P_TABLE, type P2POrder } from "../../lib/p2p-types";

type Props = {
  userId: string | null;
};

function fmt(v: number | null | undefined, d = 4): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}

/**
 * Merchant's own advertisements from p2p_orders (verified table).
 * Read-only listing — no unsafe direct status mutations.
 * Activate/deactivate only if a backend RPC is added later.
 */
export default function P2PAdsPanel({ userId }: Props) {
  const [ads, setAds] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setAds([]);
      setLoading(false);
      setError("Sign in to manage your ads.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from(P2P_TABLE.orders)
      .select(
        "id,user_id,merchant_name,side,asset,fiat_currency,price,min_limit,max_limit,available_usdt,payment_methods,completion_rate,avg_release_time_minutes,is_active,status,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    setLoading(false);
    if (err) {
      setError(err.message);
      setAds([]);
      return;
    }
    setAds((data || []) as P2POrder[]);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="p2p-loading">Loading your ads…</div>;
  }

  if (error) {
    return (
      <div className="p2p-empty" style={{ padding: 24 }}>
        <div style={{ color: "#ff9aa6" }}>{error}</div>
      </div>
    );
  }

  if (!ads.length) {
    return (
      <div className="p2p-empty">
        You have no P2P advertisements yet.
        <br />
        Ad creation is managed by the backend catalog — posting new ads is not
        available in this screen until a create-ad RPC is exposed to the client.
      </div>
    );
  }

  return (
    <div className="p2p-list">
      {ads.map((o) => (
        <div key={o.id} className="p2p-ad" style={{ cursor: "default" }}>
          <div className="p2p-ad-top">
            <div className="p2p-merchant-name">
              {(o.side || "").toUpperCase()} {o.asset}/{o.fiat_currency}
            </div>
            <div className="p2p-ad-stats">
              {o.is_active && o.status === "active" ? (
                <span style={{ color: "#0ecb81" }}>Active</span>
              ) : (
                <span style={{ color: "#5e6673" }}>{o.status || "Inactive"}</span>
              )}
            </div>
          </div>
          <div className="p2p-price" style={{ marginTop: 8, fontSize: 18 }}>
            {fmt(o.price, 4)} {o.fiat_currency}
          </div>
          <div className="p2p-meta">
            Limits {fmt(o.min_limit)} – {fmt(o.max_limit)} {o.asset}
            <br />
            Available {fmt(o.available_usdt)} {o.asset}
          </div>
          <div className="p2p-pay-row">
            {(o.payment_methods || []).map((m) => (
              <span key={m} className="p2p-pay-tag">
                {m}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
 
