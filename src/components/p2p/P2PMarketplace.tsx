import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  MerchantReputation,
  P2POrder,
  P2POrderSide,
  P2PPaymentMethod,
  p2pTradeErrorMessage,
} from "../../lib/p2p-types";
import P2POrdersPanel from "./P2POrdersPanel";
import P2PAdsPanel from "./P2PAdsPanel";
import P2PTradeDetail from "./P2PTradeDetail"; 

type Props = {
  onBack?: () => void;
  onOpenTrade?: (tradeId: string) => void;
  onOpenMerchant?: (merchantId: string) => void;
};

type SortKey = "price_asc" | "price_desc" | "completion";

/**
 * P2P Marketplace — CEO Exchange
 *
 * Visual structure aligned to exchange-style mobile P2P (Buy/Sell, filters,
 * dense ad cards, bottom nav). No third-party branding or promo banners.
 *
 * All data from Supabase:
 *   p2p_orders | p2p_payment_methods | get_merchant_reputation
 *   create_p2p_trade_with_escrow
 * No mock merchants, prices, or fake success.
 */

const css = `
.p2p-page{
  min-height:100vh;min-height:100dvh;
  background:#0a0a0a;color:#eaecef;
  font-family:Inter,system-ui,-apple-system,sans-serif;
  display:flex;flex-direction:column;
  padding-bottom:calc(56px + env(safe-area-inset-bottom,0px));
  box-sizing:border-box;
}
.p2p-shell{width:100%;max-width:480px;margin:0 auto;flex:1;display:flex;flex-direction:column;min-height:0}
.p2p-header{
  display:flex;align-items:center;gap:8px;
  padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));
  border-bottom:1px solid #1a1a1a;flex-shrink:0;
}
.p2p-back{
  width:36px;height:36px;border:0;border-radius:10px;
  background:transparent;color:#eaecef;font-size:20px;cursor:pointer;
  display:grid;place-items:center;flex-shrink:0;
}
.p2p-header-title{flex:1;text-align:center;font-size:16px;font-weight:700;letter-spacing:.02em;color:#f0b90b}
.p2p-fiat-btn{
  display:flex;align-items:center;gap:4px;
  border:1px solid #2a2a2a;background:#141414;color:#eaecef;
  border-radius:16px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;
}
.p2p-fiat-btn span.chev{opacity:.6;font-size:10px}

.p2p-buy-sell{
  display:flex;align-items:center;gap:8px;
  padding:12px 12px 8px;flex-shrink:0;
}
.p2p-seg{
  display:inline-flex;border-radius:20px;background:#1a1a1a;padding:3px;border:1px solid #252525;
}
.p2p-seg-btn{
  border:0;border-radius:17px;padding:7px 22px;font-size:13px;font-weight:700;
  cursor:pointer;background:transparent;color:#848e9c;transition:background .15s,color .15s;
}
.p2p-seg-btn.buy.active{background:#0ecb81;color:#0a0a0a}
.p2p-seg-btn.sell.active{background:#f6465d;color:#fff}

.p2p-filters{
  display:flex;align-items:center;gap:6px;
  padding:0 12px 8px;overflow-x:auto;flex-shrink:0;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;
}
.p2p-filters::-webkit-scrollbar{display:none}
.p2p-chip{
  flex-shrink:0;display:inline-flex;align-items:center;gap:4px;
  border:0;background:transparent;color:#eaecef;font-size:12px;font-weight:500;
  padding:6px 2px;cursor:pointer;white-space:nowrap;
}
.p2p-chip .arr{font-size:9px;opacity:.55;margin-left:2px}
.p2p-filter-icon{
  margin-left:auto;flex-shrink:0;width:32px;height:32px;
  border:0;border-radius:8px;background:transparent;color:#848e9c;
  font-size:16px;cursor:pointer;display:grid;place-items:center;position:relative;
}
.p2p-filter-badge{
  position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;
  background:#f0b90b;color:#0a0a0a;font-size:9px;font-weight:800;
  display:grid;place-items:center;
}

.p2p-sort{
  display:flex;gap:12px;padding:0 12px 10px;overflow-x:auto;flex-shrink:0;
  scrollbar-width:none;
}
.p2p-sort::-webkit-scrollbar{display:none}
.p2p-sort-item{
  border:0;background:transparent;color:#5e6673;font-size:12px;font-weight:500;
  padding:4px 0;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;
}
.p2p-sort-item.active{color:#eaecef;border-bottom-color:#f0b90b}

.p2p-list{flex:1;overflow-y:auto;padding:0 0 8px;-webkit-overflow-scrolling:touch}
.p2p-error{
  margin:8px 12px;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;
  border-radius:8px;padding:10px;font-size:12px;
}
.p2p-loading,.p2p-empty{
  padding:48px 20px;text-align:center;color:#5e6673;font-size:13px;line-height:1.6;
}

.p2p-ad{
  width:100%;border:0;border-bottom:1px solid #1a1a1a;background:transparent;
  padding:14px 12px;text-align:left;color:inherit;font:inherit;cursor:pointer;
  box-sizing:border-box;
}
.p2p-ad:active{background:#111}
.p2p-ad-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.p2p-ad-merchant{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
.p2p-avatar{
  width:28px;height:28px;border-radius:50%;flex-shrink:0;
  background:linear-gradient(145deg,#2a2418,#1a160e);
  border:1px solid #3d3420;color:#f0b90b;
  display:grid;place-items:center;font-size:11px;font-weight:800;
}
.p2p-merchant-name{
  font-size:13px;font-weight:600;color:#eaecef;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.p2p-merchant-badges{display:inline-flex;gap:3px;margin-left:4px;vertical-align:middle}
.p2p-badge-dot{font-size:11px;line-height:1}
.p2p-ad-stats{font-size:11px;color:#5e6673;flex-shrink:0;white-space:nowrap;padding-top:2px}
.p2p-fast{
  display:inline-flex;align-items:center;gap:4px;margin-top:4px;
  font-size:11px;color:#0ecb81;
}
.p2p-fast-pill{
  background:#0a2a1c;color:#0ecb81;border-radius:4px;padding:1px 6px;
  font-size:10px;font-weight:600;
}
.p2p-ad-body{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:8px}
.p2p-ad-left{min-width:0;flex:1}
.p2p-price{
  font-size:22px;font-weight:700;color:#eaecef;letter-spacing:-.02em;line-height:1.15;
}
.p2p-price-cur{font-size:14px;font-weight:600;margin-right:2px;opacity:.9}
.p2p-meta{margin-top:6px;font-size:11px;color:#5e6673;line-height:1.55}
.p2p-meta b{color:#848e9c;font-weight:500}
.p2p-pay-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.p2p-pay-tag{
  font-size:10px;color:#848e9c;border-left:2px solid #f0b90b;padding-left:5px;
  line-height:1.2;
}
.p2p-ad-btn{
  flex-shrink:0;border:0;border-radius:6px;padding:8px 20px;
  font-size:13px;font-weight:700;cursor:pointer;min-width:72px;
}
.p2p-ad-btn.buy{background:#0ecb81;color:#0a0a0a}
.p2p-ad-btn.sell{background:#f6465d;color:#fff}

.p2p-bottom{
  position:fixed;left:0;right:0;bottom:0;z-index:40;
  background:#0a0a0a;border-top:1px solid #1a1a1a;
  padding-bottom:env(safe-area-inset-bottom,0px);
  display:flex;justify-content:center;
}
.p2p-bottom-inner{
  width:100%;max-width:480px;display:grid;grid-template-columns:repeat(4,1fr);
  height:56px;
}
.p2p-nav-item{
  border:0;background:transparent;color:#5e6673;font-size:10px;font-weight:500;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  cursor:pointer;padding:0;
}
.p2p-nav-item.active{color:#f0b90b}
.p2p-nav-icon{font-size:18px;line-height:1}

/* sheets */
.p2p-sheet-bg{
  position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);
  display:flex;align-items:flex-end;justify-content:center;
}
.p2p-sheet{
  width:100%;max-width:480px;background:#121212;border-radius:16px 16px 0 0;
  border:1px solid #2a2a2a;border-bottom:0;padding:16px 16px 24px;
  max-height:78vh;overflow-y:auto;box-sizing:border-box;
}
.p2p-sheet-title{font-size:15px;font-weight:700;margin-bottom:12px;color:#eaecef}
.p2p-sheet-opt{
  width:100%;border:0;border-bottom:1px solid #1e1e1e;background:transparent;
  padding:12px 4px;text-align:left;color:#eaecef;font-size:14px;cursor:pointer;
  display:flex;justify-content:space-between;align-items:center;
}
.p2p-sheet-opt.active{color:#f0b90b}
.p2p-sheet-input{
  width:100%;box-sizing:border-box;margin:8px 0 12px;padding:12px;
  border-radius:8px;border:1px solid #2a2a2a;background:#1a1a1a;color:#eaecef;font-size:15px;
}
.p2p-sheet-actions{display:flex;gap:8px;margin-top:8px}
.p2p-sheet-actions button{
  flex:1;border:0;border-radius:8px;padding:12px;font-weight:700;font-size:13px;cursor:pointer;
}
.p2p-sheet-cancel{background:#1a1a1a;color:#848e9c}
.p2p-sheet-ok{background:#f0b90b;color:#0a0a0a}

/* trade panel (existing flow, restyled) */
.p2p-panel-bg{
  position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.6);
  display:flex;align-items:flex-end;justify-content:center;
}
.p2p-panel{
  width:100%;max-width:480px;background:#121212;border-radius:16px 16px 0 0;
  border:1px solid #2a2a2a;border-bottom:0;padding:16px 16px 28px;
  max-height:88vh;overflow-y:auto;box-sizing:border-box;
}
.p2p-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.p2p-panel-title{font-size:16px;font-weight:700}
.p2p-panel-close{
  border:0;background:#1a1a1a;color:#848e9c;width:32px;height:32px;border-radius:8px;
  font-size:16px;cursor:pointer;
}
.p2p-panel-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#848e9c;margin:6px 0}
.p2p-panel-row b{color:#eaecef;font-weight:600}
.p2p-label{display:flex;justify-content:space-between;font-size:12px;color:#848e9c;margin-top:12px}
.p2p-input-wrap{margin-top:6px}
.p2p-input{
  width:100%;box-sizing:border-box;padding:12px;border-radius:8px;
  border:1px solid #2a2a2a;background:#1a1a1a;color:#eaecef;font-size:15px;
}
.p2p-methods-pick{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.p2p-method-btn{
  border:1px solid #2a2a2a;background:#1a1a1a;color:#eaecef;border-radius:8px;
  padding:10px 12px;text-align:left;font-size:12px;cursor:pointer;
}
.p2p-method-btn.active{border-color:#f0b90b;color:#f0b90b}
.p2p-no-methods,.p2p-rep{font-size:12px;color:#5e6673;margin-top:8px;line-height:1.5}
.p2p-panel-error{
  margin-top:10px;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;
  border-radius:8px;padding:10px;font-size:12px;
}
.p2p-submit{
  width:100%;border:0;border-radius:10px;padding:14px;margin-top:16px;
  font-weight:800;font-size:15px;cursor:pointer;color:#fff;
}
.p2p-submit.buy{background:#0ecb81;color:#0a0a0a}
.p2p-submit.sell{background:#f6465d}
.p2p-submit:disabled{background:#242424;color:#666;cursor:not-allowed}
.p2p-own-note{
  margin:12px 0;border:1px solid #232323;background:#0a0a0a;color:#999;
  border-radius:10px;padding:12px;font-size:12px;line-height:1.6;text-align:center;
}
.p2p-result{text-align:center;padding:24px 6px}
.p2p-result-icon{
  width:52px;height:52px;border-radius:50%;background:#0ecb81;color:#0a0a0a;
  display:grid;place-items:center;margin:0 auto 14px;font-size:24px;font-weight:800;
}
.p2p-result-id{font-family:ui-monospace,monospace;font-size:11px;color:#5e6673;margin-top:10px;word-break:break-all}
.p2p-result-note{color:#848e9c;font-size:12px;margin-top:12px;line-height:1.6}
.p2p-done-btn{
  width:100%;border:0;border-radius:10px;padding:13px;margin-top:16px;
  background:#1a1a1a;color:#eaecef;font-weight:700;cursor:pointer;
}
.p2p-toast{
  position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:80;
  background:#1a1a1a;border:1px solid #2a2a2a;color:#eaecef;
  border-radius:8px;padding:10px 14px;font-size:12px;max-width:90%;
}
`;

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}

function initials(name: string): string {
  return (name || "").trim().slice(0, 2).toUpperCase() || "P2";
}

function completionPct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  // Backend may store 0–1 or 0–100
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(pct)}%`;
}

function fiatSymbol(code: string): string {
  const c = (code || "").toUpperCase();
  if (c === "EUR") return "€";
  if (c === "USD" || c === "USDT") return "$";
  if (c === "GBP") return "£";
  if (c === "ETB") return "Br";
  return c ? `${c} ` : "";
}

export default function P2PMarketplace({
  onBack,
  onOpenTrade,
  onOpenMerchant,
}: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters (client-side on real rows)
  const [fiat, setFiat] = useState<string>("");
  const [asset, setAsset] = useState<string>("");
  const [amountFilter, setAmountFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("price_asc");

  const [sheet, setSheet] = useState<
    null | "fiat" | "asset" | "amount" | "payment" | "nav"
  >(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [navToast, setNavToast] = useState("");
  const [tab, setTab] = useState<"market" | "orders" | "ads" | "profile">(
    "market",
  );
  const [openTradeId, setOpenTradeId] = useState<string | null>(null);

  // Trade panel (existing flow)
  const [selected, setSelected] = useState<P2POrder | null>(null);
  const [reputation, setReputation] = useState<MerchantReputation | null>(null);
  const [ownMethods, setOwnMethods] = useState<P2PPaymentMethod[] | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [panelError, setPanelError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tradeId: string } | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    // User Buy → merchant sell ads; User Sell → merchant buy ads
    const orderSide: P2POrderSide = side === "buy" ? "sell" : "buy";
    const { data, error: err } = await supabase
      .from("p2p_orders")
      .select(
        "id,user_id,merchant_name,side,asset,fiat_currency,price,min_limit,max_limit,available_usdt,payment_methods,completion_rate,avg_release_time_minutes,is_active,status,created_at",
      )
      .eq("status", "active")
      .eq("is_active", true)
      .eq("side", orderSide)
      .gt("available_usdt", 0)
      .order("price", { ascending: side === "buy" })
      .limit(50);

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const rows = (data || []) as P2POrder[];
    setOrders(rows);

    // Default filters from real data (only when still empty)
    setFiat((prev) => {
      if (prev) return prev;
      const fiats = [
        ...new Set(rows.map((r) => r.fiat_currency).filter(Boolean)),
      ];
      return fiats[0] || prev;
    });
    setAsset((prev) => {
      if (prev) return prev;
      const assets = [
        ...new Set(rows.map((r) => r.asset).filter(Boolean)),
      ];
      return assets[0] || prev;
    });
  }, [side]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const ch = supabase
      .channel("p2p-marketplace-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "p2p_orders" },
        () => {
          void loadOrders();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadOrders]);

  const fiatOptions = useMemo(() => {
    const s = new Set(orders.map((o) => o.fiat_currency).filter(Boolean));
    return [...s].sort();
  }, [orders]);

  const assetOptions = useMemo(() => {
    const s = new Set(orders.map((o) => o.asset).filter(Boolean));
    return [...s].sort();
  }, [orders]);

  const paymentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) {
      for (const m of o.payment_methods || []) {
        if (m) s.add(m);
      }
    }
    return [...s].sort();
  }, [orders]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (amountFilter) n++;
    if (paymentFilter) n++;
    return n;
  }, [amountFilter, paymentFilter]);

  const filteredOrders = useMemo(() => {
    let list = orders.slice();
    if (fiat) list = list.filter((o) => o.fiat_currency === fiat);
    if (asset) list = list.filter((o) => o.asset === asset);
    if (paymentFilter) {
      list = list.filter((o) =>
        (o.payment_methods || []).some(
          (m) => m.toLowerCase() === paymentFilter.toLowerCase(),
        ),
      );
    }
    if (amountFilter) {
      const amt = Number(amountFilter);
      if (Number.isFinite(amt) && amt > 0) {
        // Amount is in crypto units matching min/max_limit (existing validation)
        list = list.filter((o) => amt >= o.min_limit && amt <= o.max_limit);
      }
    }
    if (sortKey === "price_asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortKey === "price_desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortKey === "completion") {
      list.sort((a, b) => (b.completion_rate || 0) - (a.completion_rate || 0));
    }
    return list;
  }, [orders, fiat, asset, paymentFilter, amountFilter, sortKey]);

  useEffect(() => {
    setSortKey(side === "buy" ? "price_asc" : "price_desc");
  }, [side]);

  const openOrder = async (order: P2POrder) => {
    setSelected(order);
    setAmount(amountFilter || "");
    setPanelError("");
    setResult(null);
    setReputation(null);
    setOwnMethods(null);
    setSelectedMethodId(null);

    void supabase
      .rpc("get_merchant_reputation", { p_merchant_user_id: order.user_id })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setReputation(row as MerchantReputation);
      });

    if (order.side === "buy") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("p2p_payment_methods")
        .select("id,bank_name,account_name,is_active")
        .eq("user_id", user.id)
        .eq("is_active", true);
      setOwnMethods((data || []) as P2PPaymentMethod[]);
    }
  };

  const closePanel = () => {
    setSelected(null);
    setResult(null);
  };

  const submitTrade = async () => {
    if (!selected) return;
    setPanelError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPanelError("Enter a valid amount.");
      return;
    }
    if (amt < selected.min_limit || amt > selected.max_limit) {
      setPanelError(
        `Amount must be between ${fmt(selected.min_limit, 8)} and ${fmt(selected.max_limit, 8)} ${selected.asset}.`,
      );
      return;
    }
    if (amt > selected.available_usdt) {
      setPanelError(
        "This order doesn't have enough liquidity remaining. Try a smaller amount.",
      );
      return;
    }
    if (selected.side === "buy" && !selectedMethodId) {
      setPanelError("Select a payment method to receive payment into.");
      return;
    }

    setSubmitting(true);
    const { data, error: err } = await supabase.rpc(
      "create_p2p_trade_with_escrow",
      {
        p_order_id: selected.id,
        p_crypto_amount: amt,
        p_payment_method_id:
          selected.side === "buy" ? selectedMethodId : null,
      },
    );
    setSubmitting(false);
    if (err) {
      setPanelError(p2pTradeErrorMessage(err.message, selected.side));
      return;
    }
    const tradeId = String(data);
    setResult({ tradeId });
    void loadOrders();
    onOpenTrade?.(tradeId);
    // After success, user can open the real trade detail
    setTimeout(() => {
      setSelected(null);
      setResult(null);
      setOpenTradeId(tradeId);
      setTab("orders");
    }, 600);
  };

  const myTurnToBuy = selected ? selected.side === "sell" : side === "buy";

  if (openTradeId) {
    return (
      <>
        <style>{css}</style>
        <P2PTradeDetail
          tradeId={openTradeId}
          userId={userId}
          onBack={() => {
            setOpenTradeId(null);
            setTab("orders");
          }}
        />
      </>
    );
  }

  return (
    <div className="p2p-page">
      <style>{css}</style>
      <div className="p2p-shell">
        {/* Header — no Express / Block Trade / promo banner */}
        <header className="p2p-header">
          <button
            type="button"
            className="p2p-back"
            aria-label="Back"
            onClick={onBack || (() => window.history.back())}
          >
            ←
          </button>
          <div className="p2p-header-title">
            {tab === "market"
              ? "P2P"
              : tab === "orders"
                ? "Orders"
                : tab === "ads"
                  ? "My Ads"
                  : "Profile"}
          </div>
          {tab === "market" ? (
            <button
              type="button"
              className="p2p-fiat-btn"
              onClick={() => setSheet("fiat")}
            >
              {fiat || "Fiat"}
              <span className="chev">▼</span>
            </button>
          ) : (
            <div style={{ width: 52 }} />
          )}
        </header>

        {tab === "orders" && (
          <P2POrdersPanel
            userId={userId}
            onOpenTrade={(id) => setOpenTradeId(id)}
          />
        )}

        {tab === "ads" && <P2PAdsPanel userId={userId} />}

        {tab === "profile" && (
          <div className="p2p-empty" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#eaecef" }}>
              P2P profile
            </div>
            {userId ? (
              <div style={{ fontSize: 12, color: "#848e9c", lineHeight: 1.6 }}>
                Signed in. Merchant reputation and verification badges appear on
                ads when returned by{" "}
                <code style={{ color: "#f0b90b" }}>get_merchant_reputation</code>
                . Payment methods are loaded when you fulfill a buy-side ad.
              </div>
            ) : (
              <div>Sign in to view your P2P profile.</div>
            )}
          </div>
        )}

        {tab === "market" && (
        <>
        {/* Buy / Sell */}
        <div className="p2p-buy-sell">
          <div className="p2p-seg">
            <button
              type="button"
              className={`p2p-seg-btn buy ${side === "buy" ? "active" : ""}`}
              onClick={() => setSide("buy")}
            >
              Buy
            </button>
            <button
              type="button"
              className={`p2p-seg-btn sell ${side === "sell" ? "active" : ""}`}
              onClick={() => setSide("sell")}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p2p-filters">
          <button
            type="button"
            className="p2p-chip"
            onClick={() => setSheet("asset")}
          >
            {asset || "Crypto"}
            <span className="arr">▼</span>
          </button>
          <button
            type="button"
            className="p2p-chip"
            onClick={() => {
              setAmountDraft(amountFilter);
              setSheet("amount");
            }}
          >
            {amountFilter ? `Amt ${amountFilter}` : "Amount"}
            <span className="arr">▼</span>
          </button>
          <button
            type="button"
            className="p2p-chip"
            onClick={() => setSheet("payment")}
          >
            {paymentFilter || "All Payment Methods"}
            <span className="arr">▼</span>
          </button>
          <button
            type="button"
            className="p2p-filter-icon"
            aria-label="Filters"
            onClick={() => {
              setAmountDraft(amountFilter);
              setSheet("amount");
            }}
          >
            ☰
            {activeFilterCount > 0 && (
              <span className="p2p-filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Sort */}
        <div className="p2p-sort">
          <button
            type="button"
            className={`p2p-sort-item ${sortKey === "price_asc" || sortKey === "price_desc" ? "active" : ""}`}
            onClick={() =>
              setSortKey(side === "buy" ? "price_asc" : "price_desc")
            }
          >
            Price ({side === "buy" ? "lowest to highest" : "highest to lowest"})
          </button>
          <button
            type="button"
            className={`p2p-sort-item ${sortKey === "completion" ? "active" : ""}`}
            onClick={() => setSortKey("completion")}
          >
            Completion Rate
          </button>
        </div>

        {error && <div className="p2p-error">{error}</div>}

        <div className="p2p-list">
          {loading ? (
            <div className="p2p-loading">Loading P2P orders…</div>
          ) : !filteredOrders.length ? (
            <div className="p2p-empty">
              No active {side === "buy" ? "sell" : "buy"} offers
              {fiat || asset ? " for these filters" : ""}.
              <br />
              Try another currency, amount, or the other tab.
            </div>
          ) : (
            filteredOrders.map((o) => {
              const fast =
                o.avg_release_time_minutes != null &&
                o.avg_release_time_minutes <= 15;
              return (
                <button
                  key={o.id}
                  type="button"
                  className="p2p-ad"
                  onClick={() => void openOrder(o)}
                >
                  <div className="p2p-ad-top">
                    <div className="p2p-ad-merchant">
                      <div
                        className="p2p-avatar"
                        role={onOpenMerchant ? "button" : undefined}
                        onClick={(e) => {
                          if (!onOpenMerchant) return;
                          e.stopPropagation();
                          onOpenMerchant(o.user_id);
                        }}
                      >
                        {initials(o.merchant_name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="p2p-merchant-name">
                          {o.merchant_name || "Merchant"}
                        </div>
                        {fast && (
                          <div className="p2p-fast">
                            <span>
                              {o.avg_release_time_minutes != null
                                ? `${Math.max(1, Math.round(o.avg_release_time_minutes))}m`
                                : ""}
                            </span>
                            <span className="p2p-fast-pill">Fast release</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p2p-ad-stats">
                      {completionPct(o.completion_rate) !== "—"
                        ? `${completionPct(o.completion_rate)}`
                        : ""}
                      {reputation && selected?.id === o.id
                        ? ""
                        : ""}
                    </div>
                  </div>

                  <div className="p2p-ad-body">
                    <div className="p2p-ad-left">
                      <div className="p2p-price">
                        <span className="p2p-price-cur">
                          {fiatSymbol(o.fiat_currency)}
                        </span>
                        {fmt(o.price, 4)}
                      </div>
                      <div className="p2p-meta">
                        Limits {fmt(o.min_limit, 4)} – {fmt(o.max_limit, 4)}{" "}
                        {o.asset}
                        <br />
                        Quantity {fmt(o.available_usdt, 4)} {o.asset}
                      </div>
                      <div className="p2p-pay-row">
                        {(o.payment_methods || []).slice(0, 4).map((m) => (
                          <span key={m} className="p2p-pay-tag">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`p2p-ad-btn ${side === "buy" ? "buy" : "sell"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void openOrder(o);
                      }}
                    >
                      {side === "buy" ? "Buy" : "Sell"}
                    </button>
                  </div>
                </button>
              );
            })
          )}
        </div>
        </>
        )}
      </div>

      <nav className="p2p-bottom" aria-label="P2P navigation">
        <div className="p2p-bottom-inner">
          <button
            type="button"
            className={`p2p-nav-item ${tab === "market" ? "active" : ""}`}
            onClick={() => setTab("market")}
          >
            <span className="p2p-nav-icon">⌂</span>
            P2P
          </button>
          <button
            type="button"
            className={`p2p-nav-item ${tab === "orders" ? "active" : ""}`}
            onClick={() => setTab("orders")}
          >
            <span className="p2p-nav-icon">☰</span>
            Orders
          </button>
          <button
            type="button"
            className={`p2p-nav-item ${tab === "ads" ? "active" : ""}`}
            onClick={() => setTab("ads")}
          >
            <span className="p2p-nav-icon">▣</span>
            Ads
          </button>
          <button
            type="button"
            className={`p2p-nav-item ${tab === "profile" ? "active" : ""}`}
            onClick={() => setTab("profile")}
          >
            <span className="p2p-nav-icon">◎</span>
            Profile
          </button>
        </div>
      </nav>

      {navToast && <div className="p2p-toast">{navToast}</div>}

      {/* Filter sheets */}
      {sheet && sheet !== "nav" && (
        <div className="p2p-sheet-bg" onClick={() => setSheet(null)}>
          <div className="p2p-sheet" onClick={(e) => e.stopPropagation()}>
            {sheet === "fiat" && (
              <>
                <div className="p2p-sheet-title">Fiat currency</div>
                {!fiatOptions.length && (
                  <div className="p2p-empty" style={{ padding: 16 }}>
                    No fiat currencies in active ads yet.
                  </div>
                )}
                {fiatOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`p2p-sheet-opt ${fiat === c ? "active" : ""}`}
                    onClick={() => {
                      setFiat(c);
                      setSheet(null);
                    }}
                  >
                    {c}
                    {fiat === c ? "✓" : ""}
                  </button>
                ))}
              </>
            )}
            {sheet === "asset" && (
              <>
                <div className="p2p-sheet-title">Crypto</div>
                {!assetOptions.length && (
                  <div className="p2p-empty" style={{ padding: 16 }}>
                    No assets in active ads yet.
                  </div>
                )}
                {assetOptions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`p2p-sheet-opt ${asset === a ? "active" : ""}`}
                    onClick={() => {
                      setAsset(a);
                      setSheet(null);
                    }}
                  >
                    {a}
                    {asset === a ? "✓" : ""}
                  </button>
                ))}
              </>
            )}
            {sheet === "payment" && (
              <>
                <div className="p2p-sheet-title">Payment method</div>
                <button
                  type="button"
                  className={`p2p-sheet-opt ${!paymentFilter ? "active" : ""}`}
                  onClick={() => {
                    setPaymentFilter("");
                    setSheet(null);
                  }}
                >
                  All Payment Methods
                  {!paymentFilter ? "✓" : ""}
                </button>
                {paymentOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`p2p-sheet-opt ${paymentFilter === m ? "active" : ""}`}
                    onClick={() => {
                      setPaymentFilter(m);
                      setSheet(null);
                    }}
                  >
                    {m}
                    {paymentFilter === m ? "✓" : ""}
                  </button>
                ))}
              </>
            )}
            {sheet === "amount" && (
              <>
                <div className="p2p-sheet-title">
                  Amount ({asset || "crypto"})
                </div>
                <input
                  className="p2p-sheet-input"
                  inputMode="decimal"
                  placeholder="Filter by amount within limits"
                  value={amountDraft}
                  onChange={(e) => setAmountDraft(e.target.value)}
                />
                <div className="p2p-sheet-actions">
                  <button
                    type="button"
                    className="p2p-sheet-cancel"
                    onClick={() => {
                      setAmountFilter("");
                      setSheet(null);
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="p2p-sheet-ok"
                    onClick={() => {
                      setAmountFilter(amountDraft.trim());
                      setSheet(null);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Trade panel — real create_p2p_trade_with_escrow */}
      {selected && (
        <div className="p2p-panel-bg" onClick={closePanel}>
          <div className="p2p-panel" onClick={(e) => e.stopPropagation()}>
            <div className="p2p-panel-head">
              <div className="p2p-panel-title">
                {myTurnToBuy ? "Buy" : "Sell"} {selected.asset}
              </div>
              <button
                type="button"
                className="p2p-panel-close"
                onClick={closePanel}
              >
                ✕
              </button>
            </div>

            {result ? (
              <div className="p2p-result">
                <div className="p2p-result-icon">✓</div>
                <div style={{ fontWeight: 700 }}>Trade created</div>
                <div className="p2p-result-id">{result.tradeId}</div>
                <div className="p2p-result-note">
                  Escrow is held on-platform. Follow payment instructions in
                  your trade details.
                </div>
                <button
                  type="button"
                  className="p2p-done-btn"
                  onClick={closePanel}
                >
                  Done
                </button>
              </div>
            ) : userId && selected.user_id === userId ? (
              <div className="p2p-own-note">
                This is your own order. You cannot trade against it.
              </div>
            ) : (
              <>
                <div className="p2p-panel-row">
                  <span>Merchant</span>
                  <b>{selected.merchant_name}</b>
                </div>
                <div className="p2p-panel-row">
                  <span>Price</span>
                  <b>
                    {fiatSymbol(selected.fiat_currency)}
                    {fmt(selected.price, 4)} {selected.fiat_currency}
                  </b>
                </div>
                <div className="p2p-panel-row">
                  <span>Limits</span>
                  <b>
                    {fmt(selected.min_limit, 4)} – {fmt(selected.max_limit, 4)}{" "}
                    {selected.asset}
                  </b>
                </div>
                <div className="p2p-panel-row">
                  <span>Available</span>
                  <b>
                    {fmt(selected.available_usdt, 4)} {selected.asset}
                  </b>
                </div>
                {reputation && (
                  <div className="p2p-rep">
                    Rating{" "}
                    {reputation.review_count > 0
                      ? `${fmt(reputation.avg_rating, 1)}★ (${reputation.review_count})`
                      : "No reviews yet"}
                  </div>
                )}

                <div className="p2p-label">
                  <span>Amount</span>
                  <span>{selected.asset}</span>
                </div>
                <div className="p2p-input-wrap">
                  <input
                    className="p2p-input"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`${fmt(selected.min_limit, 4)} – ${fmt(selected.max_limit, 4)}`}
                  />
                </div>

                {selected.side === "buy" && (
                  <>
                    <div className="p2p-label">
                      <span>Receive payment into</span>
                      <span />
                    </div>
                    {ownMethods === null ? (
                      <div className="p2p-rep">Loading your payment methods…</div>
                    ) : ownMethods.length === 0 ? (
                      <div className="p2p-no-methods">
                        You don&apos;t have an active payment method on file
                        yet. You can&apos;t fulfil a buy order until one is
                        added.
                      </div>
                    ) : (
                      <div className="p2p-methods-pick">
                        {ownMethods.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`p2p-method-btn ${selectedMethodId === m.id ? "active" : ""}`}
                            onClick={() => setSelectedMethodId(m.id)}
                          >
                            {m.bank_name || "Payment method"} —{" "}
                            {m.account_name || ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {panelError && (
                  <div className="p2p-panel-error">{panelError}</div>
                )}

                <button
                  type="button"
                  className={`p2p-submit ${myTurnToBuy ? "buy" : "sell"}`}
                  disabled={
                    submitting ||
                    (selected.side === "buy" && !ownMethods?.length)
                  }
                  onClick={() => void submitTrade()}
                >
                  {submitting
                    ? "Creating trade…"
                    : `${myTurnToBuy ? "Buy" : "Sell"} ${selected.asset}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
