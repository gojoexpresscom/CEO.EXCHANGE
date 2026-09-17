import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import BottomNav from "../nav/BottomNav";
import { formatAmount, formatPct, iconUrl } from "../../lib/format";
import type { NavPage, StakingPosition, StakingProduct } from "../../lib/types";

type Props = {
  onNavigate: (page: NavPage) => void;
};

export default function EarnPage({ onNavigate }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<StakingProduct[]>([]);
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    // Try common table names used by staking backends; fail honestly if missing
    const prodRes = await supabase
      .from("staking_products")
      .select(
        "id,asset,name,apr,apy,lock_period_days,min_amount,is_active"
      )
      .eq("is_active", true);

    if (prodRes.error) {
      // Alternate table name
      const alt = await supabase
        .from("earn_products")
        .select(
          "id,asset,name,apr,apy,lock_period_days,min_amount,is_active"
        )
        .eq("is_active", true);
      if (alt.error) {
        setProducts([]);
        setInfo(
          "Earn / staking products are not available from the backend yet."
        );
      } else {
        setProducts((alt.data as StakingProduct[]) ?? []);
      }
    } else {
      setProducts((prodRes.data as StakingProduct[]) ?? []);
    }

    if (userId) {
      const posRes = await supabase
        .from("staking_positions")
        .select(
          "id,user_id,product_id,asset,amount,rewards,unlock_at,status,created_at"
        )
        .eq("user_id", userId);
      if (posRes.error) {
        const altPos = await supabase
          .from("earn_positions")
          .select(
            "id,user_id,product_id,asset,amount,rewards,unlock_at,status,created_at"
          )
          .eq("user_id", userId);
        setPositions(
          altPos.error ? [] : ((altPos.data as StakingPosition[]) ?? [])
        );
      } else {
        setPositions((posRes.data as StakingPosition[]) ?? []);
      }
    } else {
      setPositions([]);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Earn</h1>
        <button type="button" style={styles.refresh} onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <p style={styles.lead}>
        Stake supported assets using real backend products and positions. APYs
        are never invented.
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {info && <div style={styles.info}>{info}</div>}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Your positions</h2>
        {loading && !positions.length ? (
          <div style={styles.empty}>Loading…</div>
        ) : !positions.length ? (
          <div style={styles.empty}>No active staking positions.</div>
        ) : (
          positions.map((p) => (
            <div key={p.id} style={styles.card}>
              <div style={styles.cardTop}>
                <img
                  src={iconUrl(p.asset)}
                  alt=""
                  width={28}
                  height={28}
                  style={styles.icon}
                />
                <b>{p.asset}</b>
                <span style={styles.badge}>{p.status || "active"}</span>
              </div>
              <div style={styles.row}>
                <span>Staked</span>
                <span>{formatAmount(p.amount)}</span>
              </div>
              <div style={styles.row}>
                <span>Rewards</span>
                <span>{formatAmount(p.rewards ?? 0)}</span>
              </div>
              {p.unlock_at && (
                <div style={styles.row}>
                  <span>Unlock</span>
                  <span>{new Date(p.unlock_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Products</h2>
        {!products.length && !loading ? (
          <div style={styles.empty}>
            No staking products returned by the backend.
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} style={styles.card}>
              <div style={styles.cardTop}>
                <img
                  src={iconUrl(p.asset)}
                  alt=""
                  width={28}
                  height={28}
                  style={styles.icon}
                />
                <div>
                  <b>{p.name || p.asset}</b>
                  <div style={styles.sub}>{p.asset}</div>
                </div>
                <div style={styles.apr}>
                  {p.apy != null
                    ? formatPct(p.apy)
                    : p.apr != null
                    ? formatPct(p.apr)
                    : "—"}
                  <small> APY/APR</small>
                </div>
              </div>
              <div style={styles.meta}>
                {p.lock_period_days != null && (
                  <span>Lock {p.lock_period_days}d</span>
                )}
                {p.min_amount != null && (
                  <span>Min {formatAmount(p.min_amount)}</span>
                )}
              </div>
              <button
                type="button"
                style={styles.stakeBtn}
                onClick={() =>
                  setInfo(
                    "Stake / unstake actions will call the existing staking backend when execution endpoints are confirmed. No fake stake is performed."
                  )
                }
              >
                Stake
              </button>
            </div>
          ))
        )}
      </section>

      <div style={{ height: 80 }} />
      <BottomNav active="earn" onNavigate={onNavigate} />
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
    padding: "14px 16px 4px",
  },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" },
  refresh: {
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#c9a227",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  lead: {
    margin: "4px 16px 12px",
    fontSize: 12,
    color: "#777",
    lineHeight: 1.45,
  },
  section: { padding: "4px 16px 12px" },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 14,
    fontWeight: 700,
    color: "#ccc",
  },
  card: {
    background: "#0e0e0e",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  icon: { borderRadius: "50%", background: "#1a1a1a" },
  badge: {
    marginLeft: "auto",
    fontSize: 10,
    fontWeight: 700,
    color: "#c9a227",
    background: "rgba(245,181,27,0.1)",
    padding: "3px 8px",
    borderRadius: 6,
    textTransform: "uppercase",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#aaa",
    marginBottom: 4,
  },
  apr: {
    marginLeft: "auto",
    fontWeight: 800,
    color: "#22c55e",
    fontSize: 15,
  },
  sub: { fontSize: 11, color: "#666" },
  meta: {
    display: "flex",
    gap: 12,
    fontSize: 11,
    color: "#777",
    marginBottom: 10,
  },
  stakeBtn: {
    width: "100%",
    minHeight: 40,
    borderRadius: 10,
    border: "1px solid #2a2110",
    background: "rgba(245,181,27,0.12)",
    color: "#f5b51b",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  empty: {
    padding: "20px 8px",
    textAlign: "center",
    color: "#777",
    fontSize: 13,
  },
  error: {
    margin: "0 16px 10px",
    padding: 10,
    borderRadius: 8,
    background: "rgba(239,68,68,0.1)",
    color: "#fca5a5",
    fontSize: 13,
  },
  info: {
    margin: "0 16px 10px",
    padding: 10,
    borderRadius: 8,
    background: "rgba(245,181,27,0.08)",
    border: "1px solid #2a2110",
    color: "#c9a227",
    fontSize: 12,
  },
};
