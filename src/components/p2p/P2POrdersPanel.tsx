import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  formatTradeStatus,
  P2P_TABLE,
  type P2PTrade,
} from "../../lib/p2p-types";

type Props = {
  userId: string | null;
  onOpenTrade: (tradeId: string) => void;
};

function fmt(v: unknown, d = 4): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

/**
 * Lists the signed-in user's P2P trades from p2p_trades (RLS).
 * Does not fabricate rows. If the table/columns differ, shows the real error.
 */
export default function P2POrdersPanel({ userId, onOpenTrade }: Props) {
  const [trades, setTrades] = useState<P2PTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setTrades([]);
      setLoading(false);
      setError("Sign in to see your P2P orders.");
      return;
    }
    setLoading(true);
    setError("");

    // Prefer filter by participant columns when present; fall back to select * under RLS
    let q = supabase
      .from(P2P_TABLE.trades)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data, error: err } = await q;

    if (err) {
      setLoading(false);
      setError(err.message);
      setTrades([]);
      return;
    }

    const rows = (data || []) as P2PTrade[];
    // Client-side participant filter if columns exist (RLS may already scope)
    const mine = rows.filter((t) => {
      const b = t.buyer_id != null ? String(t.buyer_id) : "";
      const s = t.seller_id != null ? String(t.seller_id) : "";
      if (!b && !s) return true; // RLS-only scope
      return b === userId || s === userId;
    });

    setTrades(mine);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`p2p-my-trades-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: P2P_TABLE.trades },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, load]);

  if (loading) {
    return <div className="p2p-loading">Loading your orders…</div>;
  }

  if (error) {
    return (
      <div className="p2p-empty" style={{ padding: 24 }}>
        <div style={{ color: "#ff9aa6", marginBottom: 8 }}>Could not load orders</div>
        <div style={{ fontSize: 12 }}>{error}</div>
        <div style={{ fontSize: 11, color: "#5e6673", marginTop: 12 }}>
          Expected table: {P2P_TABLE.trades}. If your backend uses a different
          name, update P2P_TABLE.trades in p2p-types.ts.
        </div>
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div className="p2p-empty">
        No P2P trades yet.
        <br />
        Open the marketplace and create a trade from an advertisement.
      </div>
    );
  }

  return (
    <div className="p2p-list">
      {trades.map((t) => {
        const status = formatTradeStatus(t.status);
        const asset = t.asset || "—";
        const amount = t.crypto_amount ?? t["amount"];
        return (
          <button
            key={t.id}
            type="button"
            className="p2p-ad"
            onClick={() => onOpenTrade(t.id)}
          >
            <div className="p2p-ad-top">
              <div className="p2p-merchant-name" style={{ fontSize: 13 }}>
                {status}
              </div>
              <div className="p2p-ad-stats">
                {t.created_at
                  ? new Date(String(t.created_at)).toLocaleString()
                  : ""}
              </div>
            </div>
            <div className="p2p-meta" style={{ marginTop: 8 }}>
              {fmt(amount)} {asset}
              {t.price != null ? ` · ${fmt(t.price, 4)} ${t.fiat_currency || ""}` : ""}
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#5e6673", marginTop: 4 }}>
                {t.id}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
