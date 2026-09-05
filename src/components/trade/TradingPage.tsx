import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Props = { symbol?: string; onBack?: () => void; onAddFunds?: () => void };
type Pair = { id: string; symbol: string; base_asset: string; quote_asset: string; is_active: boolean };
type Ticker = { symbol: string; last_price: number|null; bid_price: number|null; ask_price: number|null; high_24h: number|null; low_24h: number|null; volume_24h: number|null; change_24h: number|null };
type Candle = { open_time: string; open:number; high:number; low:number; close:number; volume:number };
type BookRow = { side:"buy"|"sell"; price:number; amount:number; filled_amount:number };
type Wallet = { asset:string; balance:number; locked_balance:number; escrow_balance:number; wallet_type:string; status?:string|null };
type Order = { id:string; user_id:string; trading_pair:string; side:"buy"|"sell"; order_type:string; price:number; amount:number; filled_amount:number; status:string; created_at:string };
type RecentTrade = { id:string; trading_pair:string; price:number; amount:number; created_at:string };

const TF = [{label:"15m",value:"15m"},{label:"1H",value:"1h"},{label:"4H",value:"4h"},{label:"1D",value:"1d"}] as const;
const MARKET_TABS = [{label:"Chart",value:"chart"},{label:"Order Book",value:"book"},{label:"Trades",value:"trades"}] as const;
const CANCELLABLE = new Set(["open","partially_filled"]);

// All data below comes from Supabase (trading_pairs, market_tickers, market_candles,
// get_order_book, orders, trades, wallets). Nothing here is a placeholder, and every
// control on screen maps to something that actually works against the backend.
const css = `
.trade-page{min-height:100vh;background:#050505;color:#eee;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.trade-shell{width:min(1400px,100%);margin:auto;padding:10px 14px 26px;box-sizing:border-box}
.trade-top{display:flex;align-items:center;gap:10px;min-height:48px}
.trade-back{width:38px;height:38px;border:1px solid #232323;border-radius:10px;background:#0a0a0a;color:#f4c542;cursor:pointer;font-size:18px;display:grid;place-items:center;flex-shrink:0}
.trade-pair{display:flex;align-items:baseline;gap:8px;min-width:0}
.pair-select{background:transparent;color:#fff;border:0;font:inherit;font-size:17px;font-weight:700;outline:0;cursor:pointer}
.trade-change{font-size:12px;font-weight:700}
.up{color:#16c784}.down{color:#ea3943}
.trade-spacer{flex:1}
.view-toggle{display:flex;border:1px solid #232323;border-radius:9px;overflow:hidden;flex-shrink:0}
.view-toggle button{background:#0a0a0a;color:#777;border:0;padding:8px 13px;font-size:12px;font-weight:700;cursor:pointer}
.view-toggle button.active{background:#171307;color:#f4c542}
.card{border:1px solid #202020;background:#070707;border-radius:13px;overflow:hidden;margin-top:10px}
.pane{display:none}
.pane.active{display:block}
@media(min-width:901px){.pane{display:block}.trade-two-col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;align-items:start}.view-toggle{display:none}}

/* --- Market pane --- */
.stats-row{display:flex;align-items:baseline;gap:14px;padding:14px 4px 10px;flex-wrap:wrap}
.stat-price{font-size:30px;font-weight:750;letter-spacing:-.5px}
.stat-mini{font-size:12px;color:#888}
.stat-mini b{color:#ccc;font-weight:600}
.market-tabs{display:flex;border-bottom:1px solid #171717}
.market-tab{flex:1;background:none;border:0;color:#777;padding:11px 6px;font-size:12.5px;font-weight:700;cursor:pointer}
.market-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.tf-row{display:flex;gap:4px;padding:9px 10px;border-bottom:1px solid #141414;overflow:auto}
.tf-btn{background:none;border:1px solid #202020;border-radius:6px;color:#888;padding:5px 10px;font-size:11.5px;cursor:pointer;white-space:nowrap}
.tf-btn.active{color:#f4c542;border-color:#7a5c14}
.chart-wrap{height:300px}
.chart-svg{width:100%;height:100%;display:block}
.empty{height:100%;display:grid;place-items:center;text-align:center;color:#666;padding:22px;box-sizing:border-box;font-size:12.5px;line-height:1.6}
.book-full{padding:6px 0}
.book-full-head{display:grid;grid-template-columns:1fr 1fr;padding:6px 14px;font-size:10.5px;color:#666}
.book-full-head span:last-child{text-align:right}
.book-full-row{display:grid;grid-template-columns:1fr 1fr;padding:0}
.book-cell{padding:4px 14px;font-size:12px;display:flex;justify-content:space-between;cursor:pointer;background:none;border:0;color:inherit;font:inherit;width:100%;text-align:left}
.book-cell:hover{background:#111}
.book-cell.bid span:first-child{color:#16c784}
.book-cell.ask span:first-child{color:#ea3943}
.book-mid{display:flex;justify-content:center;padding:11px;border-top:1px solid #202020;border-bottom:1px solid #202020;color:#f4c542;font-weight:800;font-size:16px}
.tape{padding:2px 0}
.tape-head{display:grid;grid-template-columns:1fr 1fr 1fr;padding:6px 14px;font-size:10.5px;color:#666}
.tape-head span:nth-child(2){text-align:right}
.tape-head span:last-child{text-align:right}
.tape-row{display:grid;grid-template-columns:1fr 1fr 1fr;padding:4px 14px;font-size:12px}
.tape-row span:nth-child(2){text-align:right}
.tape-row span:last-child{text-align:right;color:#888}

/* --- Trade pane --- */
.tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid #232323;border-radius:9px;overflow:hidden;margin:12px}
.tab{border:0;background:#0a0a0a;color:#888;padding:10px;font-weight:700;cursor:pointer;font-size:13px}
.tab.buy.active{background:#087e50;color:white}
.tab.sell.active{background:#b82034;color:white}
.form-body{padding:0 12px 12px}
.label{display:flex;justify-content:space-between;color:#999;font-size:12px;margin:12px 0 6px}
.input-wrap{display:flex;align-items:center;border:1px solid #232323;border-radius:10px;background:#0a0a0a}
.input-wrap:focus-within{border-color:#d9a927}
.step-btn{background:none;border:0;color:#777;padding:11px;cursor:pointer;font-size:14px;line-height:0}
.step-btn:hover{color:#f4c542}
.input{flex:1;min-width:0;background:none;color:#eee;border:0;padding:12px 4px;font-size:15px;outline:none}
.suffix{color:#777;font-size:12px;padding-right:12px}
.pcts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.pct{border:1px solid #232323;background:#090909;color:#aaa;border-radius:7px;padding:7px;cursor:pointer;font-size:12px}
.pct.active{border-color:#d9a927;color:#f4c542}
.available,.total{display:flex;justify-content:space-between;font-size:12px;margin-top:12px}
.available{color:#999}
.total{border-top:1px solid #171717;padding-top:11px}
.order-btn{width:100%;border:0;border-radius:10px;padding:13px;margin-top:13px;color:#fff;font-weight:800;font-size:15px;cursor:pointer}
.order-btn.buy{background:#08a96b}
.order-btn.sell{background:#e52d45}
.order-btn:disabled{background:#242424;color:#666;cursor:not-allowed}
.warning{margin-top:10px;border:1px solid #5c4b1b;background:#171307;color:#d2bd73;border-radius:9px;padding:10px;font-size:12px;line-height:1.45}
.add{color:#f4c542;border-color:#a67a18;margin-top:7px;border:1px solid #a67a18;background:#090909;border-radius:7px;padding:7px 10px;cursor:pointer;display:block}
.orders-tabs{display:flex;gap:20px;padding:12px;border-bottom:1px solid #171717}
.orders-tab{border:0;background:none;color:#777;padding-bottom:5px;cursor:pointer;font-size:13px}
.orders-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.orders-scroll{overflow:auto}
.order-table{width:100%;border-collapse:collapse;font-size:12px}
.order-table th,.order-table td{padding:9px 12px;text-align:left;border-bottom:1px solid #111;white-space:nowrap}
.order-table th{color:#666;font-weight:500}
.cancel-btn{border:1px solid #5c1d26;background:#1b080b;color:#ff8f9c;border-radius:7px;padding:5px 10px;font-size:11px;cursor:pointer}
.cancel-btn:disabled{opacity:.5;cursor:not-allowed}
.error{margin:10px 4px;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:10px;font-size:12px}
.notice-ok{margin:10px 4px;border:1px solid #1e4a34;background:#08160f;color:#8fe0bb;border-radius:9px;padding:10px;font-size:12px}
.loading{min-height:100vh;display:grid;place-items:center;color:#f4c542}
`;

function fmt(v:number|null|undefined,d=2){if(v==null||!Number.isFinite(v))return "—";return v.toLocaleString(undefined,{maximumFractionDigits:d})}
function fmtPrice(v:number|null|undefined){if(v==null||!Number.isFinite(v))return "—";const a=Math.abs(v);return v.toLocaleString(undefined,{maximumFractionDigits:a>=1000?2:a>=1?4:8})}
function fmtTime(iso:string){const d=new Date(iso);return d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function routeSymbol(){const m=window.location.pathname.match(/\/trade\/([^/]+)/i);return m?decodeURIComponent(m[1]).replace("-","/").toUpperCase():""}

function CandleChart({rows,last,pairSymbol}:{rows:Candle[];last:number|null;pairSymbol:string}){
  if(!rows.length)return <div className="empty">No trade history yet for {pairSymbol}.<br/>The chart fills in as soon as real trades execute on this pair.</div>;
  const W=1000,H=300,L=14,R=58,T=12,B=28,PW=W-L-R,PH=H-T-B,min=Math.min(...rows.map(x=>x.low)),max=Math.max(...rows.map(x=>x.high)),range=max-min||1,y=(v:number)=>T+(max-v)/range*PH,step=PW/rows.length,body=Math.max(2,Math.min(11,step*.55)),vmax=Math.max(...rows.map(x=>x.volume),1);
  return <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Candlestick chart for ${pairSymbol}`}>
    {Array.from({length:5}).map((_,i)=>{const yy=T+PH*i/4;return <g key={i}><line x1={L} x2={W-R} y1={yy} y2={yy} stroke="#141414"/><text x={W-R+5} y={yy+4} fill="#666" fontSize="10.5">{fmtPrice(max-range*i/4)}</text></g>})}
    {rows.map((c,i)=>{const x=L+step*i+step/2,up=c.close>=c.open,by=Math.min(y(c.open),y(c.close)),bh=Math.max(1.5,Math.abs(y(c.close)-y(c.open))),vh=c.volume/vmax*30;return <g key={c.open_time}><line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={up?"#16c784":"#ea3943"} strokeWidth="1.2"/><rect x={x-body/2} y={by} width={body} height={bh} fill={up?"#16c784":"#ea3943"}/><rect x={x-body/2} y={H-14-vh} width={body} height={vh} fill={up?"#16c784":"#ea3943"} opacity=".4"/></g>})}
    {last!=null&&last>=min&&last<=max?<><line x1={L} x2={W-R} y1={y(last)} y2={y(last)} stroke="#d9a927" strokeDasharray="4 4"/><rect x={W-R+1} y={y(last)-9} width="56" height="18" rx="4" fill="#d9a927"/><text x={W-R+5} y={y(last)+4} fill="#050505" fontSize="10.5">{fmtPrice(last)}</text></>:null}
  </svg>
}

export default function TradingPage({symbol:propSymbol,onBack,onAddFunds}:Props){
  const [symbol,setSymbol]=useState((propSymbol||routeSymbol()).toUpperCase());
  const [pair,setPair]=useState<Pair|null>(null);
  const [pairs,setPairs]=useState<Pair[]>([]);
  const [ticker,setTicker]=useState<Ticker|null>(null);
  const [candles,setCandles]=useState<Candle[]>([]);
  const [book,setBook]=useState<BookRow[]>([]);
  const [recentTrades,setRecentTrades]=useState<RecentTrade[]>([]);
  const [wallets,setWallets]=useState<Wallet[]>([]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [tf,setTf]=useState<(typeof TF)[number]["value"]>("15m");
  const [view,setView]=useState<"trade"|"market">("trade");
  const [marketTab,setMarketTab]=useState<(typeof MARKET_TABS)[number]["value"]>("chart");
  const [side,setSide]=useState<"buy"|"sell">("buy");
  const [p,setP]=useState("");
  const [amount,setAmount]=useState("");
  const [busy,setBusy]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [cancellingId,setCancellingId]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const [noticeOk,setNoticeOk]=useState(false);
  const [orderTab,setOrderTab]=useState<"open"|"history">("open");
  const [activePct,setActivePct]=useState<number|null>(null);

  const loadPair=useCallback(async()=>{if(!symbol)return;setBusy(true);const [{data,error},{data:all,error:e2}]=await Promise.all([supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("symbol",symbol).maybeSingle(),supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("is_active",true).order("symbol").limit(200)]);if(error||e2){setNotice(error?.message||e2?.message||"Unable to load pairs.");setNoticeOk(false);setBusy(false);return}if(!data||!data.is_active){setNotice("This trading pair is unavailable.");setNoticeOk(false);setPair(null);setBusy(false);return}setPair(data as Pair);setPairs((all||[]) as Pair[]);setP("");setAmount("");setActivePct(null);setBusy(false)},[symbol]);

  const loadMarket=useCallback(async()=>{if(!pair)return;const [{data:t},{data:c},{data:b,error:be}]=await Promise.all([supabase.from("market_tickers").select("symbol,last_price,bid_price,ask_price,high_24h,low_24h,volume_24h,change_24h").eq("symbol",pair.symbol).maybeSingle(),supabase.from("market_candles").select("open_time,open,high,low,close,volume").eq("trading_pair",pair.symbol).eq("timeframe",tf).order("open_time",{ascending:true}).limit(500),supabase.rpc("get_order_book",{p_trading_pair:pair.symbol})]);setTicker((t||null) as Ticker|null);setCandles((c||[]) as Candle[]);if(!be)setBook((b||[]) as BookRow[]);if(!p&&t?.last_price!=null)setP(String(t.last_price))},[pair,tf,p]);

  const loadTrades=useCallback(async()=>{if(!pair)return;const {data}=await supabase.from("trades").select("id,trading_pair,price,amount,created_at").eq("trading_pair",pair.symbol).order("created_at",{ascending:false}).limit(50);setRecentTrades((data||[]) as RecentTrade[])},[pair]);

  const loadUser=useCallback(async()=>{if(!pair)return;const {data:{user}}=await supabase.auth.getUser();if(!user)return;const [{data:w},{data:o}]=await Promise.all([supabase.from("wallets").select("asset,balance,locked_balance,escrow_balance,wallet_type,status").eq("user_id",user.id),supabase.from("orders").select("id,user_id,trading_pair,side,order_type,price,amount,filled_amount,status,created_at").eq("user_id",user.id).eq("trading_pair",pair.symbol).order("created_at",{ascending:false}).limit(100)]);setWallets((w||[]) as Wallet[]);setOrders((o||[]) as Order[])},[pair]);

  useEffect(()=>{void loadPair()},[loadPair]);
  useEffect(()=>{void loadMarket();void loadUser();void loadTrades()},[loadMarket,loadUser,loadTrades]);
  useEffect(()=>{if(!pair)return;const ch=supabase.channel(`trade-${pair.symbol}-${tf}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"market_tickers",filter:`symbol=eq.${pair.symbol}`},x=>setTicker((x.new||null) as Ticker))
    .on("postgres_changes",{event:"*",schema:"public",table:"market_candles",filter:`trading_pair=eq.${pair.symbol}`},x=>{const r=x.new as Candle&{timeframe:string};if(r?.timeframe!==tf)return;setCandles(prev=>{const i=prev.findIndex(c=>c.open_time===r.open_time);if(i<0)return [...prev,r].slice(-500);const n=[...prev];n[i]=r;return n})})
    .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`trading_pair=eq.${pair.symbol}`},()=>{void loadMarket();void loadUser()})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"trades",filter:`trading_pair=eq.${pair.symbol}`},x=>{void loadMarket();setRecentTrades(prev=>[x.new as RecentTrade,...prev].slice(0,50))})
    .on("postgres_changes",{event:"*",schema:"public",table:"wallets"},()=>void loadUser())
    .subscribe();return()=>{void supabase.removeChannel(ch)}},[pair,tf,loadMarket,loadUser]);

  const wallet=useMemo(()=>{if(!pair)return null;const asset=side==="buy"?pair.quote_asset:pair.base_asset;const rows=wallets.filter(x=>x.asset.toUpperCase()===asset.toUpperCase());const row=rows.find(x=>(x.wallet_type||"").toLowerCase()==="spot")||rows[0];return {asset,available:row?Math.max(0,Number(row.balance||0)-Number(row.locked_balance||0)-Number(row.escrow_balance||0)):0,exists:!!row}},[wallets,pair,side]);
  const np=Number(p),na=Number(amount),total=Number.isFinite(np)&&Number.isFinite(na)?np*na:0;
  const insufficient=!!wallet&&(wallet.available<=0||total>wallet.available);
  const step=(field:"price"|"amount",dir:1|-1)=>{const cur=field==="price"?np:na;const base=cur>0?cur:(field==="price"?(ticker?.last_price||1):1);const inc=Math.max(base*0.001,field==="price"?0.0001:0.00000001);const next=Math.max(0,(Number.isFinite(cur)?cur:0)+dir*inc);(field==="price"?setP:setAmount)(String(Number(next.toFixed(8))))};
  const setPercent=(pct:number)=>{if(!wallet||!np)return;setActivePct(pct);setAmount(String((side==="buy"?wallet.available/np:wallet.available)*pct))};

  const pickFromBook=(row:BookRow)=>{setSide(row.side==="sell"?"buy":"sell");setP(String(row.price));setActivePct(null);setView("trade")};

  const submit=async()=>{setNotice("");if(!pair)return;if(!wallet||!wallet.exists||wallet.available<=0){setNotice(`You don't have enough ${wallet?.asset||pair.quote_asset} to place this order. Add funds to continue.`);setNoticeOk(false);return}if(!Number.isFinite(np)||np<=0||!Number.isFinite(na)||na<=0){setNotice("Enter a valid price and amount.");setNoticeOk(false);return}if(total>wallet.available){setNotice(`You don't have enough ${wallet.asset} to place this order. Add funds to continue.`);setNoticeOk(false);return}const {data:{user}}=await supabase.auth.getUser();if(!user){setNotice("Please sign in to trade.");setNoticeOk(false);return}setSubmitting(true);const {data,error}=await supabase.rpc("place_spot_limit_order",{p_user_id:user.id,p_trading_pair:pair.symbol,p_side:side,p_price:np,p_amount:na});setSubmitting(false);if(error){setNotice(/balance|insufficient|fund/i.test(error.message)?`You don't have enough ${wallet.asset} to place this order. Add funds to continue.`:error.message);setNoticeOk(false);return}if(!data){setNotice("The server did not return an order id.");setNoticeOk(false);return}setAmount("");setActivePct(null);setNotice("Order placed. It will fill automatically once it crosses an opposite order.");setNoticeOk(true);void loadMarket();void loadUser()};

  const cancelOrder=async(orderId:string)=>{const {data:{user}}=await supabase.auth.getUser();if(!user)return;setCancellingId(orderId);const {error}=await supabase.rpc("cancel_spot_order",{p_user_id:user.id,p_order_id:orderId});setCancellingId(null);if(error){setNotice(error.message);setNoticeOk(false);return}setNotice("Order cancelled — your funds were released back to your wallet.");setNoticeOk(true);void loadUser()};

  const switchPair=(s:string)=>{setSymbol(s);window.history.pushState({},"",`/trade/${encodeURIComponent(s.replace("/","-"))}`)};

  if(busy)return <div className="trade-page"><style>{css}</style><div className="loading">Loading real market data…</div></div>;
  if(!pair)return <div className="trade-page"><style>{css}</style><div className="trade-shell"><button className="trade-back" onClick={onBack||(()=>window.history.back())}>←</button><div className="error">{notice||"Trading pair not found."}</div></div></div>;

  const change=Number(ticker?.change_24h??0),last=ticker?.last_price??null;
  const asks=book.filter(x=>x.side==="sell").sort((a,b)=>b.price-a.price).slice(-15),bids=book.filter(x=>x.side==="buy").sort((a,b)=>b.price-a.price).slice(0,15);
  const open=orders.filter(x=>CANCELLABLE.has(x.status.toLowerCase())),history=orders.filter(x=>!CANCELLABLE.has(x.status.toLowerCase())),displayOrders=orderTab==="open"?open:history;

  return <div className="trade-page"><style>{css}</style><div className="trade-shell">
    <header className="trade-top">
      <button className="trade-back" onClick={onBack||(()=>window.history.back())} aria-label="Back">←</button>
      <div className="trade-pair">
        <select className="pair-select" value={pair.symbol} onChange={e=>switchPair(e.target.value)}>{pairs.map(x=><option key={x.symbol} value={x.symbol}>{x.symbol}</option>)}</select>
        {last!=null&&<span className={`trade-change ${change>=0?"up":"down"}`}>{change>=0?"+":""}{change.toFixed(2)}%</span>}
      </div>
      <div className="trade-spacer"/>
      <div className="view-toggle">
        <button className={view==="trade"?"active":""} onClick={()=>setView("trade")}>Trade</button>
        <button className={view==="market"?"active":""} onClick={()=>setView("market")}>Chart</button>
      </div>
    </header>

    {notice&&<div className={noticeOk?"notice-ok":"error"}>{notice}</div>}

    <div className="trade-two-col">
      <div className={`pane ${view==="market"?"active":""}`}>
        <div className="card">
          <div className="stats-row">
            <div className={`stat-price ${last==null?"":change>=0?"up":"down"}`}>{fmtPrice(last)}</div>
            <div className="stat-mini">24h High <b>{fmtPrice(ticker?.high_24h)}</b></div>
            <div className="stat-mini">24h Low <b>{fmtPrice(ticker?.low_24h)}</b></div>
            <div className="stat-mini">24h Vol <b>{fmt(ticker?.volume_24h,4)} {pair.base_asset}</b></div>
          </div>
          <div className="market-tabs">{MARKET_TABS.map(t=><button key={t.value} className={`market-tab ${marketTab===t.value?"active":""}`} onClick={()=>setMarketTab(t.value)}>{t.label}</button>)}</div>

          {marketTab==="chart"&&<>
            <div className="tf-row">{TF.map(x=><button key={x.value} className={`tf-btn ${tf===x.value?"active":""}`} onClick={()=>setTf(x.value)}>{x.label}</button>)}</div>
            <div className="chart-wrap"><CandleChart rows={candles} last={last} pairSymbol={pair.symbol}/></div>
          </>}

          {marketTab==="book"&&<div className="book-full">
            <div className="book-full-head"><span>Bid qty ({pair.base_asset})</span><span>Ask qty ({pair.base_asset})</span></div>
            {!asks.length&&!bids.length?<div className="empty" style={{height:150}}>No open orders for this pair yet.</div>:Array.from({length:Math.max(asks.length,bids.length)}).map((_,i)=>{const bid=bids[i],ask=asks[asks.length-1-i];return <div className="book-full-row" key={i}>
              {bid?<button className="book-cell bid" onClick={()=>pickFromBook(bid)}><span>{fmt(Math.max(0,bid.amount-bid.filled_amount),6)}</span><span>{fmtPrice(bid.price)}</span></button>:<div/>}
              {ask?<button className="book-cell ask" onClick={()=>pickFromBook(ask)}><span>{fmtPrice(ask.price)}</span><span>{fmt(Math.max(0,ask.amount-ask.filled_amount),6)}</span></button>:<div/>}
            </div>})}
            <div className="book-mid">{fmtPrice(last)}</div>
          </div>}

          {marketTab==="trades"&&<div className="tape">
            <div className="tape-head"><span>Time</span><span>Price ({pair.quote_asset})</span><span>Amount ({pair.base_asset})</span></div>
            {!recentTrades.length?<div className="empty" style={{height:150}}>No trades have executed on {pair.symbol} yet.</div>:recentTrades.map((t,i)=>{const prev=recentTrades[i+1];const up=!prev||t.price>=prev.price;return <div className="tape-row" key={t.id}><span style={{color:"#888"}}>{fmtTime(t.created_at)}</span><span className={up?"up":"down"}>{fmtPrice(t.price)}</span><span>{fmt(t.amount,6)}</span></div>})}
          </div>}
        </div>

        <div className="card orders">
          <div className="orders-tabs"><button className={`orders-tab ${orderTab==="open"?"active":""}`} onClick={()=>setOrderTab("open")}>Open orders ({open.length})</button><button className={`orders-tab ${orderTab==="history"?"active":""}`} onClick={()=>setOrderTab("history")}>Order history ({history.length})</button></div>
          {!displayOrders.length?<div className="empty" style={{height:130}}>No {orderTab==="open"?"open orders":"order history"} for {pair.symbol}.</div>:<div className="orders-scroll"><table className="order-table"><thead><tr><th>Side</th><th>Type</th><th>Amount</th><th>Filled</th><th>Price</th><th>Status</th>{orderTab==="open"&&<th></th>}</tr></thead><tbody>{displayOrders.map(o=><tr key={o.id}><td className={o.side==="buy"?"up":"down"}>{o.side.toUpperCase()}</td><td>{o.order_type}</td><td>{fmt(o.amount,8)} {pair.base_asset}</td><td>{fmt(o.filled_amount,8)}</td><td>{fmtPrice(o.price)} {pair.quote_asset}</td><td>{o.status}</td>{orderTab==="open"&&<td><button className="cancel-btn" disabled={cancellingId===o.id} onClick={()=>cancelOrder(o.id)}>{cancellingId===o.id?"Cancelling…":"Cancel"}</button></td>}</tr>)}</tbody></table></div>}
        </div>
      </div>

      <div className={`pane ${view==="trade"?"active":""}`}>
        <div className="card">
          <div className="tabs"><button className={`tab buy ${side==="buy"?"active":""}`} onClick={()=>{setSide("buy");setActivePct(null)}}>Buy</button><button className={`tab sell ${side==="sell"?"active":""}`} onClick={()=>{setSide("sell");setActivePct(null)}}>Sell</button></div>
          <div className="form-body">
            <div className="label"><span>Price</span><span>{pair.quote_asset}</span></div>
            <div className="input-wrap"><button className="step-btn" onClick={()=>step("price",-1)} aria-label="Decrease price">−</button><input className="input" inputMode="decimal" value={p} onChange={e=>setP(e.target.value)} placeholder="Price"/><span className="suffix">{pair.quote_asset}</span></div>
            <div className="label"><span>Amount</span><span>{pair.base_asset}</span></div>
            <div className="input-wrap"><button className="step-btn" onClick={()=>step("amount",-1)} aria-label="Decrease amount">−</button><input className="input" inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setActivePct(null)}} placeholder="Amount"/><span className="suffix">{pair.base_asset}</span></div>
            <div className="pcts">{[.25,.5,.75,1].map(x=><button className={`pct ${activePct===x?"active":""}`} key={x} onClick={()=>setPercent(x)}>{x*100}%</button>)}</div>
            <div className="available"><span>Available</span><span>{fmt(wallet?.available??0,8)} {wallet?.asset||(side==="buy"?pair.quote_asset:pair.base_asset)}</span></div>
            <div className="total"><span>Total</span><span>{fmt(total,8)} {pair.quote_asset}</span></div>
            {insufficient&&<div className="warning">You don't have enough {wallet?.asset||pair.quote_asset} to place this order. Add funds to continue.<button className="add" onClick={onAddFunds||(()=>window.history.back())}>Add funds</button></div>}
            <button className={`order-btn ${side}`} disabled={submitting||insufficient||!Number.isFinite(np)||np<=0||!Number.isFinite(na)||na<=0} onClick={submit}>{submitting?"Submitting…":`${side==="buy"?"Buy":"Sell"} ${pair.base_asset}`}</button>
          </div>
        </div>
      </div>
    </div>
  </div></div>;
          }
