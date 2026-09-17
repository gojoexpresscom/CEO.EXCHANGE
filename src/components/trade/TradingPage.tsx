import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import TradingChart from "./TradingChart";
import { useBybitMarketData } from "../../trading/useBybitMarketData";

type Props = { symbol?: string; onBack?: () => void; onAddFunds?: () => void };
type Pair = { id: string; symbol: string; base_asset: string; quote_asset: string; is_active: boolean };
type Ticker = {
  symbol: string;
  last_price: number | null;
  bid_price: number | null;
  ask_price: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume_24h: number | null;
  change_24h: number | null;
};
type Candle = { open_time: string; open: number; high: number; low: number; close: number; volume: number };
type BookRow = { side: "buy" | "sell"; price: number; amount: number; filled_amount: number };
type Wallet = {
  asset: string;
  balance: number;
  locked_balance: number;
  escrow_balance: number;
  wallet_type: string;
  account_type?: string | null;
  status?: string | null;
};
type Order = {
  id: string;
  user_id: string;
  trading_pair: string;
  side: "buy" | "sell";
  order_type: string;
  price: number;
  amount: number;
  filled_amount: number;
  status: string;
  created_at: string;
};
type RecentTrade = { id: string; trading_pair?: string; price: number; amount: number; created_at: string };
type HotMarket = {
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  change: number | null;
  market_cap_rank: number;
  image?: string;
};

const TF = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
] as const;

const ACCOUNT_TABS = [
  { label: "Spot", value: "spot" },
  { label: "Futures", value: "futures" },
  { label: "Funding", value: "funding" },
] as const;

const BOTTOM_TABS = [
  { label: "Orders", value: "orders" },
  { label: "Positions", value: "positions" },
  { label: "Assets", value: "assets" },
] as const;

const CANCELLABLE = new Set(["open", "partially_filled"]);

// Data sources:
// - trading_pairs, orders, wallets (with account_type): Supabase — unchanged.
// - Order routing/cancellation: kraken-spot Edge Function — unchanged. Order
//   execution was NOT touched by the Bybit market-data migration below.
// - LIVE MARKET DATA for the Trading UI (ticker, candles, order book, recent
//   trades/tape): Bybit's PUBLIC REST API (initial snapshot) + Bybit's
//   PUBLIC WebSocket (live updates), via useBybitMarketData/BybitProvider.
//   market_tickers and market_candles are no longer read for the live
//   Trading UI. No Bybit credentials are used anywhere — public
//   market-data endpoints only.
// - CoinGecko free /coins/markets for Hot ranking — unchanged.
// No mock data, no demo buttons, no placeholder prices, no simulated candles.

const css = `
:root{
  --ceo-bg:#060606;
  --ceo-surface:#0a0a0a;
  --ceo-surface-2:#0d0d0d;
  --ceo-border:#181818;
  --ceo-border-strong:#242424;
  --ceo-text:#e8e8e8;
  --ceo-text-dim:#8a8a8a;
  --ceo-text-faint:#5c5c5c;
  --ceo-gold:#d4af5a;
  --ceo-gold-bright:#f0c766;
  --ceo-gold-dim:#7a6428;
  --ceo-up:#16c784;
  --ceo-down:#ea3943;
  --ceo-radius:8px;
}
*{box-sizing:border-box}
.trade-page{min-height:100vh;background:var(--ceo-bg);color:var(--ceo-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased;font-size:13px}
.trade-shell{width:min(1440px,100%);margin:auto;padding:0 0 60px;box-sizing:border-box}

/* Dense top bar: pair + live price inline, like a terminal ticker strip */
.trade-top{display:flex;align-items:center;gap:8px;min-height:46px;padding:7px 10px;border-bottom:1px solid var(--ceo-border);position:sticky;top:0;background:rgba(6,6,6,0.96);z-index:40}
.trade-back{width:28px;height:28px;border:1px solid var(--ceo-border-strong);border-radius:7px;background:var(--ceo-surface-2);color:var(--ceo-gold);cursor:pointer;font-size:15px;display:grid;place-items:center;flex-shrink:0}
.trade-back:hover{border-color:var(--ceo-gold-dim)}
.trade-pair{display:flex;align-items:baseline;gap:8px;min-width:0;cursor:pointer}
.pair-name{font-size:14px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:.1px}
.pair-live-price{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.pair-change{font-size:11px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.05);white-space:nowrap}
.up{color:var(--ceo-up)}.down{color:var(--ceo-down)}
.trade-spacer{flex:1}
.top-icons{display:flex;gap:5px;align-items:center}
.icon-btn{width:28px;height:28px;border:1px solid var(--ceo-border-strong);border-radius:7px;background:var(--ceo-surface-2);color:var(--ceo-text-dim);cursor:pointer;display:grid;place-items:center;font-size:12px}
.icon-btn:hover{color:var(--ceo-gold);border-color:var(--ceo-gold-dim)}

/* Account type tabs — compact underline tabs */
.account-tabs{display:flex;gap:0;padding:0 10px;border-bottom:1px solid var(--ceo-border);background:var(--ceo-surface)}
.account-tab{flex:1;background:none;border:0;color:var(--ceo-text-dim);padding:9px 6px;font-size:12px;font-weight:700;letter-spacing:.1px;cursor:pointer;position:relative}
.account-tab.active{color:var(--ceo-gold-bright)}
.account-tab.active::after{content:"";position:absolute;bottom:0;left:26%;right:26%;height:2px;background:var(--ceo-gold-bright);border-radius:2px 2px 0 0}
.account-tab.disabled{color:var(--ceo-text-faint);cursor:default}

/* Main grid */
.main-grid{display:flex;flex-direction:column;gap:0}
@media(min-width:901px){
  .main-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:0;align-items:start}
  .mobile-only{display:none!important}
  .desktop-only{display:block!important}
}
.desktop-only{display:none}
.mobile-only{display:block}

/* Chart / Book / Trades card — flat surface, thin borders, no glow */
.market-card{border-bottom:1px solid var(--ceo-border);background:var(--ceo-surface)}
.stats-row{display:flex;align-items:flex-start;gap:14px;padding:10px 12px;flex-wrap:wrap;border-bottom:1px solid var(--ceo-border)}
.stat-price{font-size:24px;font-weight:700;letter-spacing:-.3px;font-variant-numeric:tabular-nums;line-height:1.1}
.stat-mini{font-size:10px;color:var(--ceo-text-dim);line-height:1.35;min-width:72px}
.stat-mini b{color:#d4d4d4;font-weight:600;font-variant-numeric:tabular-nums;display:block;font-size:11px}
.stat-usd{font-size:11px;color:var(--ceo-text-dim);margin-top:2px}
.data-status{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid transparent;margin-left:auto}
.data-status.ok{color:var(--ceo-text-faint)}
.data-status.warn{color:var(--ceo-gold-bright);border-color:var(--ceo-gold-dim);background:rgba(212,175,90,0.08)}
.data-status.bad{color:var(--ceo-down);border-color:rgba(234,57,67,0.3);background:rgba(234,57,67,0.08)}
.market-tabs{display:flex;border-bottom:1px solid var(--ceo-border)}
.market-tab{flex:1;background:none;border:0;color:var(--ceo-text-dim);padding:8px 4px;font-size:11px;font-weight:700;letter-spacing:.1px;cursor:pointer}
.market-tab.active{color:var(--ceo-gold-bright);border-bottom:2px solid var(--ceo-gold-bright)}
.tf-row{display:flex;gap:2px;padding:6px 8px;border-bottom:1px solid var(--ceo-border);overflow:auto}
.tf-btn{background:none;border:0;border-radius:5px;color:var(--ceo-text-dim);padding:5px 11px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;min-height:28px}
.tf-btn.active{color:var(--ceo-gold-bright);background:rgba(212,175,90,0.1)}
.chart-wrap{height:280px;position:relative}
@media(min-width:601px){.chart-wrap{height:340px}}
@media(min-width:901px){.chart-wrap{height:420px}}
.chart-svg{width:100%;height:100%;display:block}
.empty{height:100%;display:grid;place-items:center;text-align:center;color:var(--ceo-text-faint);padding:20px;box-sizing:border-box;font-size:11.5px;line-height:1.5}

/* Order book — dual-column terminal: Qty(bid) | Price | Qty(ask) */
.book-wrap{padding:0;max-height:min(52vh,420px);overflow:auto;-webkit-overflow-scrolling:touch}
.book-ratio{display:flex;height:3px;margin:6px 10px 4px;border-radius:2px;overflow:hidden}
.book-ratio .buy{background:var(--ceo-up)}
.book-ratio .sell{background:var(--ceo-down)}
.book-ratio-labels{display:flex;justify-content:space-between;padding:0 10px 4px;font-size:10px;font-weight:700}
.book-head{display:grid;grid-template-columns:1fr 1.25fr 1fr;padding:2px 10px;font-size:9.5px;color:var(--ceo-text-faint);position:sticky;top:0;background:var(--ceo-surface);z-index:1}
.book-head span:first-child{text-align:left}
.book-head span:nth-child(2){text-align:center}
.book-head span:last-child{text-align:right}
.book-row{display:grid;grid-template-columns:1fr 1.25fr 1fr;padding:0 10px;font-size:11px;font-variant-numeric:tabular-nums;position:relative;cursor:pointer;height:22px;align-items:center}
.book-row:hover{background:#111}
.book-bar{position:absolute;top:0;bottom:0;opacity:.14;pointer-events:none}
.book-bar.bid{left:0;background:var(--ceo-up)}
.book-bar.ask{right:0;background:var(--ceo-down)}
.book-row .bid-qty{color:var(--ceo-text);text-align:left;position:relative;z-index:1}
.book-row .ask-qty{color:var(--ceo-text);text-align:right;position:relative;z-index:1}
.book-row .price.bid{color:var(--ceo-up);text-align:center;font-weight:600;position:relative;z-index:1}
.book-row .price.ask{color:var(--ceo-down);text-align:center;font-weight:600;position:relative;z-index:1}
.book-mid{display:flex;justify-content:center;align-items:center;gap:8px;padding:5px 10px;border-top:1px solid var(--ceo-border);border-bottom:1px solid var(--ceo-border);color:#fff;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums;background:rgba(255,255,255,0.02)}
.book-mid .chg{font-size:11px;font-weight:700}
.book-empty{text-align:center;color:var(--ceo-text-faint);font-size:11px;padding:24px 10px}

/* Trades tape */
.tape{padding:2px 0;max-height:280px;overflow:auto}
.tape-head{display:grid;grid-template-columns:1fr 1fr 1fr;padding:3px 10px;font-size:9.5px;color:var(--ceo-text-faint)}
.tape-head span:nth-child(2){text-align:right}
.tape-head span:last-child{text-align:right}
.tape-row{display:grid;grid-template-columns:1fr 1fr 1fr;padding:2px 10px;font-size:11.5px;font-variant-numeric:tabular-nums;height:20px;align-items:center}
.tape-row span:nth-child(2){text-align:right}
.tape-row span:last-child{text-align:right;color:var(--ceo-text-dim)}

/* Trade form card — flat, compact, touch-friendly CTAs */
.form-card{border-bottom:1px solid var(--ceo-border);background:var(--ceo-surface)}
.side-tabs{display:grid;grid-template-columns:1fr 1fr;margin:10px 10px 0;border:1px solid var(--ceo-border-strong);border-radius:8px;overflow:hidden;height:34px}
.side-tab{border:0;background:var(--ceo-surface-2);color:var(--ceo-text-dim);font-weight:700;cursor:pointer;font-size:12.5px}
.side-tab.buy.active{background:var(--ceo-up);color:#04140d}
.side-tab.sell.active{background:var(--ceo-down);color:#1a0506}
.form-body{padding:0 10px 12px}
.label{display:flex;justify-content:space-between;color:var(--ceo-text-dim);font-size:10.5px;margin:8px 0 4px}
.input-wrap{display:flex;align-items:center;border:1px solid var(--ceo-border-strong);border-radius:7px;background:var(--ceo-surface-2);height:38px;transition:border-color 150ms ease}
.input-wrap:focus-within{border-color:var(--ceo-gold-dim)}
.step-btn{background:none;border:0;color:var(--ceo-text-dim);padding:0 9px;cursor:pointer;font-size:13px;line-height:0;height:100%}
.step-btn:hover{color:var(--ceo-gold-bright)}
.input{flex:1;min-width:0;background:none;color:#eee;border:0;padding:0 4px;font-size:13px;font-variant-numeric:tabular-nums;outline:none;height:100%}
.suffix{color:var(--ceo-text-dim);font-size:10.5px;padding-right:9px}
.pcts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}
.pct{border:1px solid var(--ceo-border-strong);background:var(--ceo-surface-2);color:var(--ceo-text-dim);border-radius:5px;padding:5px 0;cursor:pointer;font-size:10.5px;min-height:26px}
.pct.active{border-color:var(--ceo-gold-dim);color:var(--ceo-gold-bright)}
.available,.total{display:flex;justify-content:space-between;font-size:10.5px;margin-top:8px}
.available{color:var(--ceo-text-dim)}
.total{border-top:1px solid var(--ceo-border);padding-top:7px}
.order-btn{width:100%;border:0;border-radius:999px;padding:12px;margin-top:10px;min-height:44px;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer}
.order-btn.buy{background:var(--ceo-up);color:#04140d}
.order-btn.sell{background:var(--ceo-down);color:#1a0506}
.order-btn:disabled{background:var(--ceo-border-strong);color:var(--ceo-text-faint);cursor:not-allowed}
.warning{margin-top:8px;border:1px solid #5c4b1b;background:#141006;color:#d2bd73;border-radius:7px;padding:8px;font-size:11px;line-height:1.4}
.add{color:var(--ceo-gold-bright);margin-top:6px;border:1px solid var(--ceo-gold-dim);background:var(--ceo-surface-2);border-radius:6px;padding:6px 9px;cursor:pointer;display:block;width:100%;text-align:center;font-size:11.5px}
.check-row{display:flex;gap:12px;margin-top:9px;font-size:11px;color:var(--ceo-text-dim);align-items:center}
.check-row label{display:flex;align-items:center;gap:5px;cursor:pointer}
.check-row input{accent-color:var(--ceo-gold)}

/* Bottom panel — dense table; on mobile not sticky so trade bar can own bottom */
.bottom-panel{border-top:1px solid var(--ceo-border);background:var(--ceo-surface);z-index:20}
@media(min-width:901px){.bottom-panel{position:sticky;bottom:0}}
@media(max-width:900px){.bottom-panel{margin-bottom:8px}}
.bottom-tabs{display:flex;border-bottom:1px solid var(--ceo-border)}
.bottom-tab{flex:1;background:none;border:0;color:var(--ceo-text-dim);padding:8px 4px;font-size:11.5px;font-weight:700;cursor:pointer}
.bottom-tab.active{color:var(--ceo-gold-bright);border-bottom:2px solid var(--ceo-gold-bright)}
.bottom-body{max-height:200px;overflow:auto;padding:6px 0}
.order-table{width:100%;border-collapse:collapse;font-size:11px}
.order-table th,.order-table td{padding:6px 10px;text-align:left;border-bottom:1px solid var(--ceo-border);white-space:nowrap;font-variant-numeric:tabular-nums}
.order-table th{color:var(--ceo-text-faint);font-weight:500;font-variant-numeric:normal}
.cancel-btn{border:1px solid #5c1d26;background:#150607;color:#ff8f9c;border-radius:5px;padding:4px 8px;font-size:10px;cursor:pointer}
.cancel-btn:disabled{opacity:.5;cursor:not-allowed}

/* Hot markets carousel + full list overlay — flat cards */
.hot-section{padding:8px 10px;border-bottom:1px solid var(--ceo-border);background:var(--ceo-surface)}
.hot-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.hot-title{font-size:12px;font-weight:700;color:var(--ceo-gold-bright)}
.view-more{background:none;border:0;color:var(--ceo-text-dim);font-size:11px;cursor:pointer}
.view-more:hover{color:var(--ceo-gold-bright)}
.hot-row{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.hot-card{min-width:98px;background:var(--ceo-surface-2);border:1px solid var(--ceo-border-strong);border-radius:8px;padding:7px 9px;cursor:pointer;flex-shrink:0}
.hot-card:hover{border-color:var(--ceo-gold-dim)}
.hot-card .sym{font-size:11px;font-weight:700;color:#fff}
.hot-card .px{font-size:12px;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums}
.hot-card .ch{font-size:10.5px;font-weight:700;margin-top:1px}

/* Markets overlay — dense list rows like the pair-picker reference */
.markets-overlay{position:fixed;inset:0;background:var(--ceo-bg);z-index:100;display:flex;flex-direction:column}
.markets-header{display:flex;align-items:center;gap:8px;padding:10px}
.markets-search{flex:1;background:var(--ceo-surface-2);border:1px solid var(--ceo-border-strong);border-radius:8px;color:#eee;padding:9px 11px;font-size:13px;outline:none}
.markets-search:focus{border-color:var(--ceo-gold-dim)}
.markets-close{width:32px;height:32px;border:1px solid var(--ceo-border-strong);border-radius:8px;background:var(--ceo-surface-2);color:var(--ceo-gold);cursor:pointer;font-size:14px}
.markets-tabs{display:flex;gap:0;padding:0 10px;border-bottom:1px solid var(--ceo-border)}
.markets-tab{background:none;border:0;color:var(--ceo-text-dim);padding:9px 12px;font-size:12px;font-weight:700;cursor:pointer}
.markets-tab.active{color:var(--ceo-gold-bright);border-bottom:2px solid var(--ceo-gold-bright)}
.markets-list{flex:1;overflow:auto}
.markets-row{display:grid;grid-template-columns:1.4fr 1fr 0.8fr;padding:11px 12px;border-bottom:1px solid var(--ceo-border);cursor:pointer;align-items:center;min-height:48px}
.markets-row:hover{background:#0e0e0e}
.markets-row .sym{font-weight:700;font-size:12.5px}
.markets-row .vol{font-size:10.5px;color:var(--ceo-text-faint);margin-top:1px}
.markets-row .px{text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums}
.markets-row .ch{text-align:right;font-size:11px;font-weight:700}
.markets-row .ch-pill{
  display:inline-block;min-width:62px;text-align:center;
  padding:3px 6px;border-radius:6px;font-size:11px;font-weight:700;
  font-variant-numeric:tabular-nums;
}
.markets-row .ch-pill.up{background:rgba(22,199,132,0.15);color:var(--ceo-up)}
.markets-row .ch-pill.down{background:rgba(234,57,67,0.15);color:var(--ceo-down)}
.markets-row.selected{background:rgba(212,175,90,0.08)}

/* Futures / Funding panels */
.account-panel{padding:14px 10px}
.coming-soon{text-align:center;padding:32px 16px;color:var(--ceo-text-dim)}
.coming-soon h3{color:var(--ceo-gold-bright);margin:0 0 6px;font-size:15px}
.coming-soon p{font-size:12.5px;line-height:1.5;margin:0}
.balance-card{background:var(--ceo-surface-2);border:1px solid var(--ceo-border-strong);border-radius:9px;padding:12px;margin-bottom:8px}
.balance-card .asset{font-size:13px;font-weight:700;margin-bottom:5px}
.balance-card .row{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ceo-text-dim);margin-top:3px}
.balance-card .row b{color:#eee;font-weight:600;font-variant-numeric:tabular-nums}
.transfer-btn{width:100%;margin-top:10px;border:1px solid var(--ceo-gold-dim);background:var(--ceo-surface-2);color:var(--ceo-gold-bright);border-radius:8px;padding:11px;font-weight:700;cursor:pointer;font-size:12.5px;min-height:42px}
.transfer-btn:disabled{opacity:.5;cursor:not-allowed}
.transfer-form{margin-top:10px;border:1px solid var(--ceo-border-strong);border-radius:9px;background:var(--ceo-surface-2);padding:11px}
.transfer-select,.transfer-input{width:100%;background:var(--ceo-surface);border:1px solid var(--ceo-border-strong);border-radius:7px;color:#eee;padding:9px;font-size:12.5px;margin-top:5px;box-sizing:border-box}
.transfer-select:focus,.transfer-input:focus{border-color:var(--ceo-gold-dim);outline:0}
.transfer-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.transfer-cancel{border:1px solid var(--ceo-border-strong);background:var(--ceo-surface-2);color:var(--ceo-text-dim);border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12.5px}
.transfer-confirm{border:0;background:var(--ceo-up);color:#04140d;border-radius:8px;padding:10px;font-weight:800;cursor:pointer;font-size:12.5px}
.transfer-confirm:disabled,.transfer-cancel:disabled{opacity:.5;cursor:not-allowed}

.error{margin:8px 10px;border:1px solid #5b1d26;background:#150607;color:#ff9aa6;border-radius:8px;padding:9px;font-size:11.5px}
.notice-ok{margin:8px 10px;border:1px solid #1e4a34;background:#06120c;color:#8fe0bb;border-radius:8px;padding:9px;font-size:11.5px}
.loading{min-height:100vh;display:grid;place-items:center;color:var(--ceo-gold)}
@media(max-width:900px){.trade-shell{padding-bottom:88px}.chart-wrap{height:272px}}

/* ===== Sticky bottom Buy / Quantity / Sell bar (mobile trading terminal) ===== */
.sticky-trade-bar{
  position:fixed;left:0;right:0;bottom:0;z-index:50;
  display:flex;align-items:center;gap:8px;
  padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));
  background:rgba(8,8,8,0.97);
  border-top:1px solid var(--ceo-border-strong);
  backdrop-filter:blur(12px);
}
.stb-buy,.stb-sell{
  flex:1.15;display:flex;flex-direction:column;align-items:center;justify-content:center;
  border:0;border-radius:999px;padding:8px 6px;min-height:48px;cursor:pointer;
  font-weight:800;font-size:12px;line-height:1.15;
}
.stb-buy{background:var(--ceo-up);color:#04140d}
.stb-sell{background:var(--ceo-down);color:#1a0506}
.stb-buy:active,.stb-sell:active{opacity:.88}
.stb-price{font-size:13.5px;font-variant-numeric:tabular-nums;font-weight:800;margin-top:1px}
.stb-qty{
  flex:0.7;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:var(--ceo-surface-2);border:1px solid var(--ceo-border-strong);
  border-radius:12px;padding:6px 4px;min-height:48px;color:var(--ceo-text-dim);font-size:10px;
}
.stb-qty b{color:#eee;font-size:12px;font-weight:700;margin-top:1px}
@media(min-width:901px){
  .sticky-trade-bar{position:sticky;max-width:1440px;margin:0 auto}
}
`;

function fmt(v: number | null | undefined, d = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}
function fmtPrice(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return v.toLocaleString(undefined, { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 4 : 8 });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function routeSymbol() {
  const m = window.location.pathname.match(/^\/trade\/(.+)$/i);
  return m ? decodeURIComponent(m[1]).toUpperCase() : "";
}

export default function TradingPage({ symbol: propSymbol, onBack, onAddFunds }: Props) {
  const [symbol, setSymbol] = useState((propSymbol || routeSymbol()).toUpperCase());
  const [pair, setPair] = useState<Pair | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tf, setTf] = useState<(typeof TF)[number]["value"]>("15m");
  const [marketTab, setMarketTab] = useState<"chart" | "book" | "trades">("chart");
  const [accountTab, setAccountTab] = useState<"spot" | "futures" | "funding">("spot");
  const [bottomTab, setBottomTab] = useState<"orders" | "positions" | "assets">("orders");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [p, setP] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeOk, setNoticeOk] = useState(false);
  const [orderTab, setOrderTab] = useState<"open" | "history">("open");
  const [activePct, setActivePct] = useState<number | null>(null);
  const [showMarkets, setShowMarkets] = useState(false);
  const [hotMarkets, setHotMarkets] = useState<HotMarket[]>([]);
  const [marketsFilter, setMarketsFilter] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAsset, setTransferAsset] = useState("");
  const [transferDirection, setTransferDirection] = useState<"from_spot" | "to_spot">("from_spot");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);

  // LIVE MARKET DATA — Bybit public REST snapshot + public WebSocket only.
  // Ticker/candles/order book/recent-trade tape for the Trading UI come
  // exclusively from this hook; Supabase's market_tickers/market_candles
  // tables are no longer read here. Order execution below is untouched
  // and continues to route through Kraken.
  const {
    ticker,
    candles,
    book,
    trades: recentTrades,
    status: bybitStatus,
  } = useBybitMarketData(pair?.base_asset ?? null, pair?.quote_asset ?? null, tf) as {
    ticker: Ticker | null;
    candles: Candle[];
    book: BookRow[];
    trades: RecentTrade[];
    status: "connecting" | "connected" | "disconnected" | "unsupported";
  };

  // Load pair + all active pairs
  const loadPair = useCallback(async () => {
    if (!symbol) return;
    setBusy(true);
    const [{ data, error }, { data: all, error: e2 }] = await Promise.all([
      supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("symbol", symbol).maybeSingle(),
      supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("is_active", true).order("symbol").limit(500),
    ]);
    if (error || e2) {
      setNotice(error?.message || e2?.message || "Unable to load pairs.");
      setNoticeOk(false);
      setBusy(false);
      return;
    }
    if (!data || !data.is_active) {
      setNotice("This trading pair is unavailable.");
      setNoticeOk(false);
      setPair(null);
      setBusy(false);
      return;
    }
    setPair(data as Pair);
    setPairs((all || []) as Pair[]);
    setP("");
    setAmount("");
    setActivePct(null);
    setBusy(false);
  }, [symbol]);

  const loadUser = useCallback(async () => {
    if (!pair) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: w }, { data: o }] = await Promise.all([
      supabase.from("wallets").select("asset,balance,locked_balance,escrow_balance,wallet_type,account_type,status").eq("user_id", user.id),
      supabase
        .from("orders")
        .select("id,user_id,trading_pair,side,order_type,price,amount,filled_amount,status,created_at")
        .eq("user_id", user.id)
        .eq("trading_pair", pair.symbol)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setWallets((w || []) as Wallet[]);
    setOrders((o || []) as Order[]);
  }, [pair]);

  // Hot markets: CoinGecko market-cap rank cross-matched to our active pairs
  const loadHot = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false"
      );
      if (!res.ok) return;
      const cg = (await res.json()) as Array<{
        id: string;
        symbol: string;
        name: string;
        image: string;
        market_cap_rank: number;
        current_price: number;
        price_change_percentage_24h: number;
      }>;
      // Cross-match against our active pairs (prefer USDT pairs)
      const our = pairs.length
        ? pairs
        : ((
            await supabase.from("trading_pairs").select("symbol,base_asset,quote_asset,is_active").eq("is_active", true).limit(300)
          ).data as Pair[]) || [];
      const matched: HotMarket[] = [];
      for (const coin of cg) {
        const sym = coin.symbol.toUpperCase();
        const candidates = our.filter(
          (p) => p.base_asset.toUpperCase() === sym && (p.quote_asset === "USDT" || p.quote_asset === "USD" || p.quote_asset === "USDC")
        );
        const pick = candidates.find((c) => c.quote_asset === "USDT") || candidates[0];
        if (!pick) continue;
        matched.push({
          symbol: pick.symbol,
          base: pick.base_asset,
          quote: pick.quote_asset,
          price: null,
          change: null,
          market_cap_rank: coin.market_cap_rank,
          image: coin.image,
        });
        if (matched.length >= 40) break;
      }
      // Overlay live prices from our tickers
      if (matched.length) {
        const { data: ticks } = await supabase
          .from("market_tickers")
          .select("symbol,last_price,change_24h")
          .in(
            "symbol",
            matched.map((m) => m.symbol)
          );
        const map = new Map((ticks || []).map((t: any) => [t.symbol, t]));
        for (const m of matched) {
          const t = map.get(m.symbol);
          if (t) {
            m.price = t.last_price;
            m.change = t.change_24h;
          }
        }
      }
      setHotMarkets(matched);
    } catch (e) {
      console.error("Hot markets load failed", e);
    }
  }, [pairs]);

  useEffect(() => {
    void loadPair();
  }, [loadPair]);
  useEffect(() => {
    void loadUser();
  }, [loadUser]);
  useEffect(() => {
    if (pairs.length) void loadHot();
  }, [pairs, loadHot]);
  // Pre-fill the price field with the live Bybit last price once, without
  // overwriting anything the user has already typed.
  useEffect(() => {
    if (!p && ticker?.last_price != null) setP(String(ticker.last_price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker?.last_price]);

  // Realtime: internal account data only (orders + wallets). Market data
  // (ticker/candles/book/tape) now comes live from Bybit's public
  // WebSocket via useBybitMarketData — Supabase Realtime is no longer
  // part of the live market-data path.
  useEffect(() => {
    if (!pair) return;
    const ch = supabase
      .channel(`trade-account-${pair.symbol}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `trading_pair=eq.${pair.symbol}` }, () => {
        void loadUser();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, () => void loadUser())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [pair, loadUser]);

  const wallet = useMemo(() => {
    if (!pair) return null;
    const asset = side === "buy" ? pair.quote_asset : pair.base_asset;
    const rows = wallets.filter((x) => x.asset.toUpperCase() === asset.toUpperCase());
    // Prefer spot account_type when present
    const row =
      rows.find((x) => (x.account_type || x.wallet_type || "").toLowerCase() === "spot") ||
      rows.find((x) => (x.wallet_type || "").toLowerCase() === "spot") ||
      rows[0];
    return {
      asset,
      available: row ? Math.max(0, Number(row.balance || 0) - Number(row.locked_balance || 0) - Number(row.escrow_balance || 0)) : 0,
      exists: !!row,
    };
  }, [wallets, pair, side]);

  const fundingWallets = useMemo(() => {
    return wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "funding");
  }, [wallets]);

  const futuresWallets = useMemo(() => {
    return wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "futures");
  }, [wallets]);

  const spotWallets = useMemo(() => {
    return wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "spot" || !w.account_type);
  }, [wallets]);

  const np = Number(p),
    na = Number(amount),
    total = Number.isFinite(np) && Number.isFinite(na) ? np * na : 0;
  const insufficient = !!wallet && (wallet.available <= 0 || total > wallet.available);

  const step = (field: "price" | "amount", dir: 1 | -1) => {
    const cur = field === "price" ? np : na;
    const base = cur > 0 ? cur : field === "price" ? ticker?.last_price || 1 : 1;
    const inc = Math.max(base * 0.001, field === "price" ? 0.0001 : 0.00000001);
    const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + dir * inc);
    (field === "price" ? setP : setAmount)(String(Number(next.toFixed(8))));
  };
  const setPercent = (pct: number) => {
    if (!wallet || !np) return;
    setActivePct(pct);
    setAmount(String((side === "buy" ? wallet.available / np : wallet.available) * pct));
  };

  // Fullscreen toggle — browser Fullscreen API; no-op when unsupported.
  useEffect(() => {
    const onFsChange = () => {
      const el = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(!!el);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const doc: any = document;
      const root = document.documentElement as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked on some mobile browsers — ignore.
    }
  };

  const pickFromBook = (row: BookRow) => {
    setSide(row.side === "sell" ? "buy" : "sell");
    setP(String(row.price));
    setActivePct(null);
  };

  // ===== Order execution — UNCHANGED. Still routes through Kraken. =====
  const submit = async () => {
    setNotice("");
    if (!pair) return;
    if (!wallet || !wallet.exists || wallet.available <= 0) {
      setNotice(`You don't have enough ${wallet?.asset || pair.quote_asset} to place this order. Add funds to continue.`);
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(np) || np <= 0 || !Number.isFinite(na) || na <= 0) {
      setNotice("Enter a valid price and amount.");
      setNoticeOk(false);
      return;
    }
    if (total > wallet.available) {
      setNotice(`You don't have enough ${wallet.asset} to place this order. Add funds to continue.`);
      setNoticeOk(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Please sign in to trade.");
      setNoticeOk(false);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: { action: "place_order", trading_pair: pair.symbol, side, price: np, amount: na },
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message || "Unable to reach the Kraken order routing service.");
      setNoticeOk(false);
      return;
    }
    if (data?.error) {
      setNotice(
        /balance|insufficient|fund/i.test(data.error)
          ? `You don't have enough ${wallet.asset} to place this order. Add funds to continue.`
          : data.error
      );
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Kraken live trading isn't enabled yet.");
      setNoticeOk(false);
      return;
    }
    if (!data?.order_id) {
      setNotice("The server did not return an order id.");
      setNoticeOk(false);
      return;
    }
    setAmount("");
    setActivePct(null);
    setNotice(`Order routed to Kraken (ref ${data.kraken_order_id}). It settles automatically once Kraken reports a real fill.`);
    setNoticeOk(true);
    void loadUser();
  };

  const cancelOrder = async (orderId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setCancellingId(orderId);
    const { data, error } = await supabase.functions.invoke("kraken-spot", {
      body: { action: "cancel_order", order_id: orderId },
    });
    setCancellingId(null);
    if (error) {
      setNotice(error.message || "Unable to reach the Kraken order routing service.");
      setNoticeOk(false);
      return;
    }
    if (data?.error) {
      setNotice(data.error);
      setNoticeOk(false);
      return;
    }
    if (data?.live_trading_enabled === false) {
      setNotice(data.message || "Kraken live trading isn't enabled yet.");
      setNoticeOk(false);
      return;
    }
    setNotice("Cancellation confirmed with Kraken — any unfilled amount was released back to your wallet.");
    setNoticeOk(true);
    void loadUser();
  };
  // ===== End order execution (unchanged) =====

  const switchPair = (s: string) => {
    setSymbol(s);
    setShowMarkets(false);
    window.history.pushState({}, "", `/trade/${encodeURIComponent(s.toUpperCase())}`);
  };

  // Real internal transfer via the existing transfer_between_accounts() RPC —
  // only Spot<->Funding here since this panel is the Funding tab; the RPC itself
  // enforces spot-must-be-one-side, real balance checks, and real ledger writes.
  const submitTransfer = async () => {
    setNotice("");
    const amt = Number(transferAmount);
    if (!transferAsset) {
      setNotice("Choose an asset to transfer.");
      setNoticeOk(false);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setNotice("Enter a valid transfer amount.");
      setNoticeOk(false);
      return;
    }
    const fromAccount = transferDirection === "from_spot" ? "spot" : "funding";
    const toAccount = transferDirection === "from_spot" ? "funding" : "spot";
    setTransferring(true);
    const { error } = await supabase.rpc("transfer_between_accounts", {
      p_asset: transferAsset.toUpperCase(),
      p_from_account: fromAccount,
      p_to_account: toAccount,
      p_amount: amt,
      p_idempotency_key: crypto.randomUUID(),
    });
    setTransferring(false);
    if (error) {
      setNotice(error.message);
      setNoticeOk(false);
      return;
    }
    setNotice(`Transferred ${fmt(amt, 8)} ${transferAsset.toUpperCase()} from ${fromAccount} to ${toAccount}.`);
    setNoticeOk(true);
    setTransferAmount("");
    setShowTransfer(false);
    void loadUser();
  };

  // Order book depth + ratio
  const asks = book
    .filter((x) => x.side === "sell")
    .sort((a, b) => a.price - b.price)
    .slice(0, 12);
  const bids = book
    .filter((x) => x.side === "buy")
    .sort((a, b) => b.price - a.price)
    .slice(0, 12);
  const maxAmt = Math.max(...asks.map((a) => a.amount - a.filled_amount), ...bids.map((b) => b.amount - b.filled_amount), 0.0001);
  const bidVol = bids.reduce((s, r) => s + Math.max(0, r.amount - r.filled_amount), 0);
  const askVol = asks.reduce((s, r) => s + Math.max(0, r.amount - r.filled_amount), 0);
  const totalVol = bidVol + askVol || 1;
  const bidPct = Math.round((bidVol / totalVol) * 100);
  const askPct = 100 - bidPct;

  const open = orders.filter((x) => CANCELLABLE.has(x.status.toLowerCase()));
  const history = orders.filter((x) => !CANCELLABLE.has(x.status.toLowerCase()));
  const displayOrders = orderTab === "open" ? open : history;

  const filteredMarkets = useMemo(() => {
    const q = marketsFilter.trim().toUpperCase();
    const list = pairs.filter((p) => !q || p.symbol.includes(q) || p.base_asset.includes(q));
    // Prefer hot order when no filter
    if (!q && hotMarkets.length) {
      const hotSet = new Set(hotMarkets.map((h) => h.symbol));
      const hotFirst = hotMarkets.map((h) => pairs.find((p) => p.symbol === h.symbol)).filter(Boolean) as Pair[];
      const rest = list.filter((p) => !hotSet.has(p.symbol));
      return [...hotFirst, ...rest];
    }
    return list;
  }, [pairs, marketsFilter, hotMarkets]);

  const bybitStatusLabel =
    bybitStatus === "unsupported" ? "Pair unavailable" : bybitStatus === "connecting" ? "Connecting…" : "Reconnecting…";
  const bybitStatusClass = bybitStatus === "unsupported" ? "bad" : "warn";

  if (busy)
    return (
      <div className="trade-page">
        <style>{css}</style>
        <div className="loading">Loading real market data…</div>
      </div>
    );
  if (!pair)
    return (
      <div className="trade-page">
        <style>{css}</style>
        <div className="trade-shell">
          <button className="trade-back" onClick={onBack || (() => window.history.back())}>
            ←
          </button>
          <div className="error">{notice || "Trading pair not found."}</div>
        </div>
      </div>
    );

  const change = Number(ticker?.change_24h ?? 0);
  const last = ticker?.last_price ?? null;

  return (
    <div className="trade-page">
      <style>{css}</style>
      <div className="trade-shell">
        {/* Top bar */}
        <header className="trade-top">
          <button className="trade-back" onClick={onBack || (() => window.history.back())} aria-label="Back">
            ←
          </button>
          <div className="trade-spacer" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: 0.2 }}>Trade</div>
          </div>
          <div className="top-icons">
            <button
              className="icon-btn"
              type="button"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? "⛶" : "⛶"}
            </button>
          </div>
        </header>
        {/* Pair + live price strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--ceo-border)", background: "var(--ceo-surface)" }}>
          <div className="trade-pair" onClick={() => setShowMarkets(true)} style={{ flex: 1 }}>
            <span className="pair-name">{pair.symbol} ▾</span>
            {last != null && (
              <span className={`pair-change ${change >= 0 ? "up" : "down"}`} style={{ marginLeft: 6 }}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            )}
          </div>
          {bybitStatus !== "connected" && (
            <span className={`data-status ${bybitStatusClass}`}>{bybitStatusLabel}</span>
          )}
        </div>

        {notice && <div className={noticeOk ? "notice-ok" : "error"}>{notice}</div>}

        {/* Account type tabs */}
        <div className="account-tabs">
          {ACCOUNT_TABS.map((t) => (
            <button
              key={t.value}
              className={`account-tab ${accountTab === t.value ? "active" : ""} ${t.value === "futures" ? "" : ""}`}
              onClick={() => setAccountTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== SPOT (fully live) ===== */}
        {accountTab === "spot" && (
          <>
            {/* Hot markets carousel */}
            {hotMarkets.length > 0 && (
              <div className="hot-section">
                <div className="hot-header">
                  <span className="hot-title">🔥 Hot</span>
                  <button className="view-more" onClick={() => setShowMarkets(true)}>
                    View more →
                  </button>
                </div>
                <div className="hot-row">
                  {hotMarkets.slice(0, 4).map((h) => (
                    <div key={h.symbol} className="hot-card" onClick={() => switchPair(h.symbol)}>
                      <div className="sym">{h.symbol}</div>
                      <div className="px">{fmtPrice(h.price)}</div>
                      <div className={`ch ${Number(h.change) >= 0 ? "up" : "down"}`}>
                        {h.change != null ? `${Number(h.change) >= 0 ? "+" : ""}${Number(h.change).toFixed(2)}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="main-grid">
              {/* Left / main: chart + book + trades */}
              <div>
                <div className="market-card">
                  <div className="stats-row">
                    <div>
                      <div className={`stat-price ${last == null ? "" : change >= 0 ? "up" : "down"}`}>{fmtPrice(last)}</div>
                      {last != null && <div className="stat-usd">≈ {fmtPrice(last)} USD</div>}
                    </div>
                    <div className="stat-mini">
                      24h High <b>{fmtPrice(ticker?.high_24h)}</b>
                    </div>
                    <div className="stat-mini">
                      24h Low <b>{fmtPrice(ticker?.low_24h)}</b>
                    </div>
                    <div className="stat-mini">
                      24h Turnover <b>
                        {fmt(ticker?.volume_24h, 2)}
                      </b>
                    </div>
                    {bybitStatus !== "connected" && <div className={`data-status ${bybitStatusClass}`}>{bybitStatusLabel}</div>}
                  </div>
                  <div className="market-tabs">
                    <button className={`market-tab ${marketTab === "chart" ? "active" : ""}`} onClick={() => setMarketTab("chart")}>
                      Chart
                    </button>
                    <button className={`market-tab ${marketTab === "book" ? "active" : ""}`} onClick={() => setMarketTab("book")}>
                      Order Book
                    </button>
                    <button className={`market-tab ${marketTab === "trades" ? "active" : ""}`} onClick={() => setMarketTab("trades")}>
                      Trades
                    </button>
                  </div>

                  {marketTab === "chart" && (
                    <>
                      <div className="tf-row">
                        {TF.map((x) => (
                          <button key={x.value} className={`tf-btn ${tf === x.value ? "active" : ""}`} onClick={() => setTf(x.value)}>
                            {x.label}
                          </button>
                        ))}
                      </div>
                      <div className="chart-wrap">
                        {candles.length ? (
                          <TradingChart candles={candles} />
                        ) : (
                          <div className="empty" style={{ height: "100%" }}>
                            {bybitStatus === "unsupported"
                              ? `Live data isn't available for ${pair.symbol}.`
                              : bybitStatus === "disconnected"
                              ? "Live market data is disconnected. Reconnecting…"
                              : bybitStatus === "connecting"
                              ? `Connecting to live data for ${pair.symbol}…`
                              : `No chart data available yet for ${pair.symbol} (${tf}).`}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {marketTab === "book" && (
                    <div className="book-wrap">
                      <div className="book-ratio">
                        <div className="buy" style={{ width: `${bidPct}%` }} />
                        <div className="sell" style={{ width: `${askPct}%` }} />
                      </div>
                      <div className="book-ratio-labels">
                        <span className="up">B {bidPct}%</span>
                        <span className="down">S {askPct}%</span>
                      </div>
                      <div className="book-head">
                        <span>Qty ({pair.base_asset})</span>
                        <span>Price ({pair.quote_asset})</span>
                        <span>Qty ({pair.base_asset})</span>
                      </div>
                      {/* Asks (sell) — highest first so lowest ask sits near mid; empty left qty */}
                      {[...asks].reverse().map((a) => {
                        const amt = Math.max(0, a.amount - a.filled_amount);
                        const w = Math.min(100, (amt / maxAmt) * 100);
                        return (
                          <div key={`a-${a.price}`} className="book-row" onClick={() => pickFromBook(a)}>
                            <div className="book-bar ask" style={{ width: `${w}%` }} />
                            <span className="bid-qty" />
                            <span className="price ask">{fmtPrice(a.price)}</span>
                            <span className="ask-qty">{fmt(amt, 6)}</span>
                          </div>
                        );
                      })}
                      <div className="book-mid">
                        {fmtPrice(last)}
                        {last != null && (
                          <span className={`chg ${change >= 0 ? "up" : "down"}`}>
                            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      {/* Bids — green price + left qty */}
                      {bids.map((b) => {
                        const amt = Math.max(0, b.amount - b.filled_amount);
                        const w = Math.min(100, (amt / maxAmt) * 100);
                        return (
                          <div key={`b-${b.price}`} className="book-row" onClick={() => pickFromBook(b)}>
                            <div className="book-bar bid" style={{ width: `${w}%` }} />
                            <span className="bid-qty">{fmt(amt, 6)}</span>
                            <span className="price bid">{fmtPrice(b.price)}</span>
                            <span className="ask-qty" />
                          </div>
                        );
                      })}
                      {!asks.length && !bids.length && (
                        <div className="book-empty">
                          {bybitStatus === "unsupported"
                            ? `Order book isn't available for ${pair.symbol}.`
                            : bybitStatus !== "connected"
                            ? "Order book disconnected. Reconnecting…"
                            : "No open orders for this pair yet."}
                        </div>
                      )}
                    </div>
                  )}

                  {marketTab === "trades" && (
                    <div className="tape">
                      <div className="tape-head">
                        <span>Time</span>
                        <span>Price ({pair.quote_asset})</span>
                        <span>Amount ({pair.base_asset})</span>
                      </div>
                      {!recentTrades.length ? (
                        <div className="empty" style={{ height: 120 }}>
                          {bybitStatus === "unsupported"
                            ? `Trade feed isn't available for ${pair.symbol}.`
                            : bybitStatus !== "connected"
                            ? "Trade feed disconnected. Reconnecting…"
                            : `No trades have executed on ${pair.symbol} yet.`}
                        </div>
                      ) : (
                        recentTrades.map((t, i) => {
                          const prev = recentTrades[i + 1];
                          const up = !prev || t.price >= prev.price;
                          return (
                            <div className="tape-row" key={t.id}>
                              <span style={{ color: "#888" }}>{fmtTime(t.created_at)}</span>
                              <span className={up ? "up" : "down"}>{fmtPrice(t.price)}</span>
                              <span>{fmt(t.amount, 6)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right / form column */}
              <div>
                <div className="form-card">
                  <div className="side-tabs">
                    <button
                      className={`side-tab buy ${side === "buy" ? "active" : ""}`}
                      onClick={() => {
                        setSide("buy");
                        setActivePct(null);
                      }}
                    >
                      Buy
                    </button>
                    <button
                      className={`side-tab sell ${side === "sell" ? "active" : ""}`}
                      onClick={() => {
                        setSide("sell");
                        setActivePct(null);
                      }}
                    >
                      Sell
                    </button>
                  </div>
                  <div className="form-body">
                    <div className="label">
                      <span>Price</span>
                      <span>{pair.quote_asset}</span>
                    </div>
                    <div className="input-wrap">
                      <button className="step-btn" onClick={() => step("price", -1)} aria-label="Decrease price">
                        −
                      </button>
                      <input className="input" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} placeholder="Price" />
                      <span className="suffix">{pair.quote_asset}</span>
                      <button className="step-btn" onClick={() => step("price", 1)} aria-label="Increase price">
                        +
                      </button>
                    </div>
                    <div className="label">
                      <span>Amount</span>
                      <span>{pair.base_asset}</span>
                    </div>
                    <div className="input-wrap">
                      <button className="step-btn" onClick={() => step("amount", -1)} aria-label="Decrease amount">
                        −
                      </button>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setActivePct(null);
                        }}
                        placeholder="Amount"
                      />
                      <span className="suffix">{pair.base_asset}</span>
                      <button className="step-btn" onClick={() => step("amount", 1)} aria-label="Increase amount">
                        +
                      </button>
                    </div>
                    <div className="pcts">
                      {[0.25, 0.5, 0.75, 1].map((x) => (
                        <button className={`pct ${activePct === x ? "active" : ""}`} key={x} onClick={() => setPercent(x)}>
                          {x * 100}%
                        </button>
                      ))}
                    </div>
                    <div className="available">
                      <span>Available</span>
                      <span>
                        {fmt(wallet?.available ?? 0, 8)} {wallet?.asset || (side === "buy" ? pair.quote_asset : pair.base_asset)}
                      </span>
                    </div>
                    <div className="total">
                      <span>Total</span>
                      <span>
                        {fmt(total, 8)} {pair.quote_asset}
                      </span>
                    </div>
                    <div className="check-row">
                      <label title="Take-profit / stop-loss is not supported by the current order router" style={{ opacity: 0.45, cursor: "default" }}>
                        <input type="checkbox" checked={false} disabled /> TP/SL
                      </label>
                      <label title="Post-Only is not supported by the current order router" style={{ opacity: 0.45, cursor: "default" }}>
                        <input type="checkbox" checked={false} disabled /> Post-Only
                      </label>
                      <span style={{ marginLeft: "auto", color: "#666" }} title="Orders are good-til-cancelled limit orders">
                        GTC
                      </span>
                    </div>
                    {insufficient && (
                      <div className="warning">
                        You don't have enough {wallet?.asset || pair.quote_asset} to place this order. Add funds to continue.
                        <button className="add" onClick={onAddFunds || (() => window.history.back())}>
                          Add funds
                        </button>
                      </div>
                    )}
                    <button
                      className={`order-btn ${side}`}
                      disabled={submitting || insufficient || !Number.isFinite(np) || np <= 0 || !Number.isFinite(na) || na <= 0}
                      onClick={submit}
                    >
                      {submitting ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${pair.base_asset}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom panel */}
            <div className="bottom-panel">
              <div className="bottom-tabs">
                {BOTTOM_TABS.map((t) => (
                  <button key={t.value} className={`bottom-tab ${bottomTab === t.value ? "active" : ""}`} onClick={() => setBottomTab(t.value)}>
                    {t.label}
                    {t.value === "orders" ? ` (${open.length})` : ""}
                  </button>
                ))}
              </div>
              <div className="bottom-body">
                {bottomTab === "orders" && (
                  <>
                    <div style={{ display: "flex", gap: 16, padding: "0 12px 6px" }}>
                      <button
                        className={`bottom-tab ${orderTab === "open" ? "active" : ""}`}
                        style={{ flex: "none", padding: "4px 0" }}
                        onClick={() => setOrderTab("open")}
                      >
                        Open ({open.length})
                      </button>
                      <button
                        className={`bottom-tab ${orderTab === "history" ? "active" : ""}`}
                        style={{ flex: "none", padding: "4px 0" }}
                        onClick={() => setOrderTab("history")}
                      >
                        History ({history.length})
                      </button>
                    </div>
                    {!displayOrders.length ? (
                      <div className="empty" style={{ height: 100 }}>
                        No {orderTab === "open" ? "open orders" : "order history"} for {pair.symbol}.
                      </div>
                    ) : (
                      <table className="order-table">
                        <thead>
                          <tr>
                            <th>Side</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Filled</th>
                            <th>Price</th>
                            <th>Status</th>
                            {orderTab === "open" && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {displayOrders.map((o) => (
                            <tr key={o.id}>
                              <td className={o.side === "buy" ? "up" : "down"}>{o.side.toUpperCase()}</td>
                              <td>{o.order_type}</td>
                              <td>
                                {fmt(o.amount, 6)} {pair.base_asset}
                              </td>
                              <td>{fmt(o.filled_amount, 6)}</td>
                              <td>
                                {fmtPrice(o.price)} {pair.quote_asset}
                              </td>
                              <td>{o.status}</td>
                              {orderTab === "open" && (
                                <td>
                                  <button className="cancel-btn" disabled={cancellingId === o.id} onClick={() => cancelOrder(o.id)}>
                                    {cancellingId === o.id ? "…" : "Cancel"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
                {bottomTab === "positions" && (
                  <div className="empty" style={{ height: 100 }}>
                    No open positions on Spot. Spot trades settle into your wallet balance.
                  </div>
                )}
                {bottomTab === "assets" && (
                  <div style={{ padding: "4px 12px" }}>
                    {wallets.filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "spot" || !w.account_type).length === 0 ? (
                      <div className="empty" style={{ height: 80 }}>
                        No spot balances yet.
                      </div>
                    ) : (
                      wallets
                        .filter((w) => (w.account_type || w.wallet_type || "").toLowerCase() === "spot" || !w.account_type)
                        .map((w) => (
                          <div key={w.asset} className="balance-card" style={{ marginBottom: 8 }}>
                            <div className="asset">{w.asset}</div>
                            <div className="row">
                              <span>Available</span>
                              <b>{fmt(Math.max(0, Number(w.balance) - Number(w.locked_balance) - Number(w.escrow_balance)), 8)}</b>
                            </div>
                            <div className="row">
                              <span>Locked</span>
                              <b>{fmt(Number(w.locked_balance) + Number(w.escrow_balance), 8)}</b>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== FUTURES (balance only + Coming soon) ===== */}
        {accountTab === "futures" && (
          <div className="account-panel">
            <div className="coming-soon">
              <h3>Futures — Coming soon</h3>
              <p>
                Kraken Futures integration is not yet connected. Your futures balance bucket already exists and is real; order routing will appear
                here once the backend is live.
              </p>
            </div>
            {futuresWallets.length > 0 ? (
              futuresWallets.map((w) => (
                <div key={w.asset} className="balance-card">
                  <div className="asset">{w.asset}</div>
                  <div className="row">
                    <span>Balance</span>
                    <b>{fmt(Number(w.balance), 8)}</b>
                  </div>
                  <div className="row">
                    <span>Locked</span>
                    <b>{fmt(Number(w.locked_balance) + Number(w.escrow_balance), 8)}</b>
                  </div>
                </div>
              ))
            ) : (
              <div className="balance-card">
                <div className="asset">No futures balances yet</div>
                <div className="row">
                  <span>Transfer funds from Spot or Funding when Futures goes live.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== FUNDING (real balances + transfer) ===== */}
        {accountTab === "funding" && (
          <div className="account-panel">
            <p style={{ color: "#888", fontSize: 13, margin: "0 0 14px" }}>
              Funding is your internal balance ledger. Move funds between Spot, Funding, Futures and Earn with real transfers.
            </p>
            {fundingWallets.length === 0 ? (
              <div className="balance-card">
                <div className="asset">No funding balances</div>
                <div className="row">
                  <span>Deposit or transfer from Spot to get started.</span>
                </div>
              </div>
            ) : (
              fundingWallets.map((w) => (
                <div key={w.asset} className="balance-card">
                  <div className="asset">{w.asset}</div>
                  <div className="row">
                    <span>Available</span>
                    <b>{fmt(Math.max(0, Number(w.balance) - Number(w.locked_balance) - Number(w.escrow_balance)), 8)}</b>
                  </div>
                  <div className="row">
                    <span>Locked</span>
                    <b>{fmt(Number(w.locked_balance) + Number(w.escrow_balance), 8)}</b>
                  </div>
                </div>
              ))
            )}
            {!showTransfer ? (
              <button className="transfer-btn" onClick={() => setShowTransfer(true)}>
                Transfer between accounts
              </button>
            ) : (
              <div className="transfer-form">
                <div className="label">
                  <span>Direction</span>
                </div>
                <select
                  className="transfer-select"
                  value={transferDirection}
                  onChange={(e) => setTransferDirection(e.target.value as "from_spot" | "to_spot")}
                >
                  <option value="from_spot">Spot → Funding</option>
                  <option value="to_spot">Funding → Spot</option>
                </select>
                <div className="label">
                  <span>Asset</span>
                </div>
                <select className="transfer-select" value={transferAsset} onChange={(e) => setTransferAsset(e.target.value)}>
                  <option value="">Select asset</option>
                  {Array.from(
                    new Set(
                      (transferDirection === "from_spot" ? spotWallets : fundingWallets).map((w) => w.asset.toUpperCase())
                    )
                  ).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <div className="label">
                  <span>Amount</span>
                </div>
                <input
                  className="transfer-input"
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                />
                <div className="transfer-actions">
                  <button className="transfer-cancel" onClick={() => setShowTransfer(false)} disabled={transferring}>
                    Cancel
                  </button>
                  <button className="transfer-confirm" onClick={submitTransfer} disabled={transferring}>
                    {transferring ? "Transferring…" : "Confirm transfer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom Buy / Quantity / Sell bar — real live prices */}
      {accountTab === "spot" && pair && (
        <div className="sticky-trade-bar">
          <button
            className="stb-buy"
            onClick={() => {
              setSide("buy");
              if (ticker?.ask_price != null) setP(String(ticker.ask_price));
              setActivePct(null);
              // scroll form into view on mobile
              document.querySelector(".form-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            Buy
            <span className="stb-price">{fmtPrice(ticker?.ask_price ?? last)}</span>
          </button>
          <div className="stb-qty">
            Quantity
            <b>{pair.base_asset}</b>
          </div>
          <button
            className="stb-sell"
            onClick={() => {
              setSide("sell");
              if (ticker?.bid_price != null) setP(String(ticker.bid_price));
              setActivePct(null);
              document.querySelector(".form-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            Sell
            <span className="stb-price">{fmtPrice(ticker?.bid_price ?? last)}</span>
          </button>
        </div>
      )}

      {/* Markets overlay (pair picker + full Hot list) */}
      {showMarkets && (
        <div className="markets-overlay">
          <div className="markets-header">
            <button className="markets-close" onClick={() => setShowMarkets(false)} aria-label="Close">
              ←
            </button>
            <input
              className="markets-search"
              placeholder="Search pair…"
              value={marketsFilter}
              onChange={(e) => setMarketsFilter(e.target.value)}
              autoFocus
            />
          </div>
          <div className="markets-tabs">
            <button className="markets-tab active">Crypto</button>
            <button className="markets-tab" type="button" disabled style={{ opacity: 0.45, cursor: "default" }}>
              TradFi
            </button>
          </div>
          <div className="markets-tabs" style={{ borderBottom: "1px solid var(--ceo-border)" }}>
            <button className="markets-tab active">Spot</button>
            <button className="markets-tab" type="button" disabled style={{ opacity: 0.45, cursor: "default" }}>
              Perpetual
            </button>
            <button className="markets-tab" type="button" disabled style={{ opacity: 0.45, cursor: "default" }}>
              Expiry
            </button>
          </div>
          <div className="book-head" style={{ padding: "6px 12px" }}>
            <span>Trading Pairs / Vol</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>24H Change</span>
          </div>
          <div className="markets-list">
            {filteredMarkets.map((m) => {
              const hot = hotMarkets.find((h) => h.symbol === m.symbol);
              const ch = hot?.change ?? null;
              return (
                <div key={m.symbol} className={`markets-row ${m.symbol === pair?.symbol ? "selected" : ""}`} onClick={() => switchPair(m.symbol)}>
                  <div>
                    <div className="sym">{m.base_asset} / {m.quote_asset}</div>
                    <div className="vol">{hot?.price != null ? "" : m.symbol}</div>
                  </div>
                  <div className="px">
                    {fmtPrice(hot?.price ?? null)}
                    {hot?.price != null && <div className="vol" style={{ textAlign: "right" }}>{fmtPrice(hot.price)} USD</div>}
                  </div>
                  <div className="ch">
                    {ch != null ? (
                      <span className={`ch-pill ${ch >= 0 ? "up" : "down"}`}>
                        {ch >= 0 ? "+" : ""}{Number(ch).toFixed(2)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              );
            })}
            {!filteredMarkets.length && (
              <div className="empty" style={{ height: 200 }}>
                No pairs match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
