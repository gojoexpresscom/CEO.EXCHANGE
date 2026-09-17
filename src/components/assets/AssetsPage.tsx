import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { useAccountBalances } from "../../hooks/useAccountBalances";
import BottomNav from "../nav/BottomNav";
import TransferSheet from "./TransferSheet";
import {
  formatAmount,
  iconUrl,
  shortAddress,
} from "../../lib/format";
import type { AccountType, NavPage, Web3Wallet } from "../../lib/types";

type Props = {
  onNavigate: (page: NavPage) => void;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenEarn?: () => void;
  onOpenConvert?: () => void;
};

type AssetTab = "Overview" | AccountType | "Wallet";

const ACCOUNT_TABS: { id: AssetTab; label: string }[] = [
  { id: "Overview", label: "Overview" },
  { id: "spot", label: "Spot" },
  { id: "funding", label: "Funding" },
  { id: "futures", label: "Futures" },
  { id: "earn", label: "Earn" },
  { id: "Wallet", label: "Wallet" },
];

export default function AssetsPage({
  onNavigate,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenEarn,
  onOpenConvert,
}: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<AssetTab>("Overview");
  const [showTransfer, setShowTransfer] = useState(false);
  const [hideBal, setHideBal] = useState(false);
  const [web3, setWeb3] = useState<Web3Wallet[]>([]);
  const [web3Msg, setWeb3Msg] = useState<string | null>(null);

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

  const { byAccount, totals, loading, error, refresh } =
    useAccountBalances(userId);

  // Rough overview total in "units" of native balances (not USD-converted unless prices exist)
  // We do NOT invent FX rates. Show sum of available quantities only as informational.
  const overviewUnits = useMemo(() => {
    return (
      totals.spot + totals.funding + totals.futures + totals.earn
    );
  }, [totals]);

  useEffect(() => {
    if (!userId || tab !== "Wallet") return;
    void (async () => {
      const { data, error: e } = await supabase
        .from("web3_wallets")
        .select("id,user_id,address,chain_id,provider,created_at")
        .eq("user_id", userId);
      if (e) {
        setWeb3Msg(
          "Web3 wallet records are not available yet, or the table is not exposed."
        );
        setWeb3([]);
      } else {
        setWeb3((data as Web3Wallet[]) ?? []);
        setWeb3Msg(null);
      }
    })();
  }, [userId, tab]);

  const accountRows =
    tab === "spot" ||
    tab === "funding" ||
    tab === "futures" ||
    tab === "earn"
      ? byAccount[tab]
      : [];

  const action = (
    label: string,
    onClick: () => void,
    primary = false
  ) => (
    <button
      type="button"
      style={{
        ...styles.actionBtn,
        ...(primary ? styles.actionPrimary : {}),
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Assets</h1>
        <button type="button" style={styles.eye} onClick={() => setHideBal((v) => !v)}>
          {hideBal ? "Show" : "Hide"}
        </button>
      </header>

      <div style={styles.hero}>
        <div style={styles.heroLabel}>Total (all accounts)</div>
        <div style={styles.heroValue}>
          {hideBal
            ? "••••"
            : loading
            ? "…"
            : formatAmount(overviewUnits, 4)}
        </div>
        <div style={styles.heroSub}>
          Spot · Funding · Futures · Earn kept separate — not a single merged wallet.
        </div>
      </div>

      <div style={styles.actions}>
        {action("Deposit", () => onOpenDeposit?.() ?? onNavigate("home"), true)}
        {action("Withdraw", () => onOpenWithdraw?.() ?? onNavigate("home"))}
        {action("Transfer", () => setShowTransfer(true))}
        {action("Convert", () => onOpenConvert?.() ?? onNavigate("home"))}
        {action("Earn", () => onOpenEarn?.() ?? onNavigate("earn"))}
      </div>

      <div style={styles.tabs}>
        {ACCOUNT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            style={{
              ...styles.tab,
              ...(tab === t.id ? styles.tabActive : {}),
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={styles.errorBar}>
          {error}
          <button type="button" style={styles.retry} onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {tab === "Overview" && (
        <div style={styles.section}>
          {(
            [
              ["spot", "Spot"],
              ["funding", "Funding"],
              ["futures", "Futures"],
              ["earn", "Earn"],
            ] as [AccountType, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              style={styles.overviewCard}
              onClick={() => setTab(key)}
            >
              <div>
                <div style={styles.overviewLabel}>{label}</div>
                <div style={styles.overviewHint}>
                  {byAccount[key].length
                    ? `${byAccount[key].length} asset(s)`
                    : "No balances"}
                </div>
              </div>
              <div style={styles.overviewBal}>
                {hideBal ? "••••" : formatAmount(totals[key], 4)}
              </div>
            </button>
          ))}
          <p style={styles.note}>
            Balances come from Supabase wallets. Futures PnL, liquidation, and
            funding settlement are not fabricated here.
          </p>
        </div>
      )}

      {(tab === "spot" ||
        tab === "funding" ||
        tab === "futures" ||
        tab === "earn") && (
        <div style={styles.section}>
          {loading && !accountRows.length ? (
            <div style={styles.empty}>Loading balances…</div>
          ) : !accountRows.length ? (
            <div style={styles.empty}>
              No {tab} balances yet. Deposit or transfer into this account.
            </div>
          ) : (
            accountRows.map((r) => (
              <div key={r.asset} style={styles.assetRow}>
                <img
                  src={iconUrl(r.asset)}
                  alt=""
                  width={32}
                  height={32}
                  style={styles.assetIcon}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <div style={styles.assetInfo}>
                  <b>{r.asset}</b>
                  <small>
                    Available {hideBal ? "••••" : formatAmount(r.available)} · Locked{" "}
                    {hideBal ? "••••" : formatAmount(r.locked)}
                  </small>
                </div>
                <div style={styles.assetBal}>
                  {hideBal ? "••••" : formatAmount(r.total)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Wallet" && (
        <div style={styles.section}>
          <p style={styles.note}>
            External Web3 wallets are separate from Spot / Funding / Futures /
            Earn balances. Connecting does not move funds automatically.
          </p>
          {web3Msg && <div style={styles.infoBox}>{web3Msg}</div>}
          {!web3.length && !web3Msg && (
            <div style={styles.empty}>
              No connected Web3 wallets on record. Use your existing Reown /
              wallet-connect flow when available to link an address.
            </div>
          )}
          {web3.map((w) => (
            <div key={w.id} style={styles.assetRow}>
              <div style={styles.walletDot} />
              <div style={styles.assetInfo}>
                <b>{shortAddress(w.address)}</b>
                <small>
                  {[w.provider, w.chain_id].filter(Boolean).join(" · ") ||
                    "Connected"}
                </small>
              </div>
            </div>
          ))}
          <button
            type="button"
            style={styles.connectBtn}
            onClick={() =>
              setWeb3Msg(
                "Reown / Web3 connect is handled by the existing wallet infrastructure. No second wallet architecture is added here."
              )
            }
          >
            Connect Web3 Wallet
          </button>
        </div>
      )}

      <div style={{ height: 80 }} />
      <BottomNav active="assets" onNavigate={onNavigate} />

      {showTransfer && (
        <TransferSheet
          byAccount={byAccount}
          onClose={() => setShowTransfer(false)}
          onDone={() => {
            void refresh();
          }}
        />
      )}
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
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "#fff",
  },
  eye: {
    background: "transparent",
    border: "1px solid #2a2110",
    color: "#c9a227",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  hero: {
    padding: "12px 16px 8px",
  },
  heroLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: 600,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.03em",
    marginTop: 4,
  },
  heroSub: {
    fontSize: 11,
    color: "#666",
    marginTop: 6,
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    gap: 8,
    padding: "10px 16px 14px",
    overflowX: "auto",
  },
  actionBtn: {
    flexShrink: 0,
    minWidth: 72,
    minHeight: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #222",
    background: "#121212",
    color: "#ddd",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  actionPrimary: {
    background: "linear-gradient(180deg, #f5b51b 0%, #c9a227 100%)",
    borderColor: "#c9a227",
    color: "#111",
  },
  tabs: {
    display: "flex",
    gap: 4,
    padding: "0 12px 10px",
    overflowX: "auto",
    borderBottom: "1px solid #141414",
  },
  tab: {
    flexShrink: 0,
    background: "transparent",
    border: "none",
    color: "#777",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  tabActive: {
    color: "#f5b51b",
    background: "rgba(245,181,27,0.1)",
  },
  section: {
    padding: "8px 16px 16px",
  },
  overviewCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 14px",
    marginBottom: 8,
    background: "#0e0e0e",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    color: "#eee",
    cursor: "pointer",
    textAlign: "left",
  },
  overviewLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },
  overviewHint: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  overviewBal: {
    fontSize: 15,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  assetRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #121212",
  },
  assetIcon: {
    borderRadius: "50%",
    background: "#1a1a1a",
  },
  assetInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  assetBal: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  empty: {
    padding: "32px 8px",
    textAlign: "center",
    color: "#777",
    fontSize: 13,
  },
  note: {
    fontSize: 11,
    color: "#666",
    lineHeight: 1.45,
    marginTop: 12,
  },
  infoBox: {
    background: "rgba(245,181,27,0.08)",
    border: "1px solid #2a2110",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12,
    color: "#c9a227",
    marginBottom: 10,
  },
  walletDot: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2a2110, #f5b51b)",
  },
  connectBtn: {
    width: "100%",
    marginTop: 14,
    minHeight: 44,
    borderRadius: 12,
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#f5b51b",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  errorBar: {
    margin: "8px 16px",
    padding: "10px 12px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10,
    color: "#fca5a5",
    fontSize: 13,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  retry: {
    border: "1px solid #2a2110",
    background: "transparent",
    color: "#f5b51b",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
};
