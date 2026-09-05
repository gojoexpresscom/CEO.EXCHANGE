import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Props = { symbol?: string; onBack?: () => void; onAddFunds?: () => void };
type Pair = { id: string; symbol: string; base_asset: string; quote_asset: string; is_active: boolean };
type Ticker = { symbol: string; last_price: number|null; bid_price: number|null; ask_price: number|null; high_24h: number|null; low_24h: number|null; volume_24h: number|null; change_24h: number|null };
type Candle = { open_time: string; open:number; high:number; low:number; close:number; volume:number };
type BookRow = { side:"buy"|"sell"; price:number; amount:number; filled_amount:number };
type Wallet = { asset:string; balance:number; locked_balance:number; escrow_balance:number; wallet_type:string; status?:string|null };
type Order = { id:string; user_id:string; trading_pair:string; side:"buy"|"sell"; order_type:string; price:number; amount:number; filled_amount:number; status:string; created_at:string };

const TF = [{label:"15m",value:"15m"},{label:"1H",value:"1h"},{label:"4H",value:"4h"},{label:"1D",value:"1d"}] as const;

// Styling matches the reference design: near-black background, gold accents on
// active tabs/borders, green/red for up/down and buy/sell. All numbers below
// come from real Supabase tables — nothing here is a placeholder.
const css = `
.trade-page{min-height:100vh;background:#050505;color:#eee;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.trade-shell{width:min(1450px,100%);margin:auto;padding:12px 16px 30px;box-sizing:border-box}
.trade-top{display:flex;align-items:center;gap:12px;min-height:56px}
.trade-back,.trade-icon{width:42px;height:42px;border:1px solid #30250d;border-radius:12px;background:#080808;color:#f4c542;cursor:pointer;font-size:20px;display:grid;place-items:center}
.trade-pair{display:flex;align-items:center;gap:9px;min-width:0}
.trade-pair h1{margin:0;font-size:21px;font-weight:600}
.trade-pair small{display:block;color:#777;margin-top:3px}
.pair-select{background:#080808;color:#eee;border:0;font:inherit;font-weight:600;outline:0;cursor:pointer}
.trade-change{font-size:13px;font-weight:700;padding:5px 8px;border-radius:7px}
.up{color:#16c784}.down{color:#ea3943}
.trade-change.up{background:#08291d}.trade-change.down{background:#310b12}
.trade-spacer{flex:1}
.trade-main{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:14px;margin-top:6px}
.trade-stats{display:grid;grid-template-columns:1.3fr repeat(3,1fr);gap:18px;padding:18px 2px 12px}
.trade-price{font-size:38px;font-weight:750;letter-spacing:-1px}
.trade-usd{color:#aaa;margin-top:4px;font-size:13px}
.stat-label{font-size:13px;color:#777;margin-bottom:5px}
.stat-value{font-size:15px;font-weight:600}
.card{border:1px solid #2a220f;background:#070707;border-radius:15px;overflow:hidden}
.chart-toolbar{display:flex;overflow:auto;border-bottom:1px solid #171717}
.chart-tab{background:none;border:0;color:#777;padding:13px 16px;white-space:nowrap;cursor:pointer;font-size:13px}
.chart-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.chart-wrap{height:455px}
.chart-svg{width:100%;height:100%;display:block}
.empty{height:100%;display:grid;place-items:center;text-align:center;color:#666;padding:25px;box-sizing:border-box;font-size:13px;line-height:1.6}
.panel{padding:15px;position:sticky;top:10px}
.spot-badge{display:inline-block;background:#171307;color:#f4c542;border:1px solid #a67a18;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:600;margin-bottom:12px}
.tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid #282828;border-radius:9px;overflow:hidden}
.tab{border:0;background:#0a0a0a;color:#888;padding:10px;font-weight:700;cursor:pointer;font-size:13px}
.tab.buy.active{background:#087e50;color:white}
.tab.sell.active{background:#b82034;color:white}
.label{display:flex;justify-content:space-between;color:#999;font-size:12px;margin:14px 0 7px}
.input-wrap{display:flex;align-items:center;border:1px solid #30250d;border-radius:10px;background:#0b0b0b}
.input-wrap:focus-within{border-color:#d9a927}
.step-btn{background:none;border:0;color:#777;padding:12px;cursor:pointer;font-size:14px;line-height:0}
.step-btn:hover{color:#f4c542}
.input{flex:1;min-width:0;background:none;color:#eee;border:0;padding:13px 4px;font-size:15px;outline:none}
.suffix{color:#777;font-size:12px;padding-right:12px}
.pcts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.pct{border:1px solid #30250d;background:#090909;color:#aaa;border-radius:7px;padding:7px;cursor:pointer;font-size:12px}
.pct.active{border-color:#d9a927;color:#f4c542}
.available,.total{display:flex;justify-content:space-between;font-size:12px;margin-top:13px}
.available{color:#999}
.total{border-top:1px solid #171717;padding-top:12px}
.order-btn{width:100%;border:0;border-radius:10px;padding:13px;margin-top:14px;color:#fff;font-weight:800;font-size:15px;cursor:pointer}
.order-btn.buy{background:#08a96b}
.order-btn.sell{background:#e52d45}
.order-btn:disabled{background:#242424;color:#666;cursor:not-allowed}
.warning{margin-top:10px;border:1px solid #5c4b1b;background:#171307;color:#d2bd73;border-radius:9px;padding:10px;font-size:12px;line-height:1.45}
.add{color:#f4c542;border-color:#a67a18;margin-top:7px;border:1px solid #a67a18;background:#090909;border-radius:7px;padding:7px 10px;cursor:pointer;display:block}
.book{margin-top:14px}
.book-title{padding:12px;border-bottom:1px solid #171717;font-weight:700;font-size:13px}
.book-head,.book-row{display:grid;grid-template-columns:1fr 1fr;padding:6px 12px;font-size:11px}
.book-head{color:#666}
.book-row span:last-child{text-align:right}
.ask{color:#ff4960}.bid{color:#18d88c}
.book-mid{display:flex;justify-content:space-between;padding:9px 12px;border-top:1px solid #2a210e;border-bottom:1px solid #2a210e;color:#f4c542;font-weight:800}
.orders{margin-top:14px}
.orders-tabs{display:flex;gap:20px;padding:13px;border-bottom:1px solid #171717}
.orders-tab{border:0;background:none;color:#777;padding-bottom:6px;cursor:pointer;font-size:13px}
.orders-tab.active{color:#f4c542;border-bottom:2px solid #f4c542}
.orders-scroll{overflow:auto}
.order-table{width:100%;border-collapse:collapse;font-size:12px}
.order-table th,.order-table td{padding:10px 12px;text-align:left;border-bottom:1px solid #111;white-space:nowrap}
.order-table th{color:#666;font-weight:500}
.error{margin:10px 0;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:10px;font-size:12px}
.loading{min-height:100vh;display:grid;place-items:center;color:#f4c542}
@media(max-width:900px){.trade-shell{padding:8px 10px 24px}.trade-main{grid-template-columns:1fr}.panel{position:static}.trade-stats{grid-template-columns:repeat(2,1fr);gap:12px}.trade-price-block{grid-column:1/-1}.chart-wrap{height:350px}}
@media(max-width:520px){.trade-back,.trade-icon{width:38px;height:38px}.trade-pair h1{font-size:17px}.trade-pair small{font-size:11px}.trade-price{font-size:30px}.stat-value{font-size:13px}.chart-wrap{height:300px}.chart-tab{padding:11px 13px}}
`;

function fmt(v:number|null|undefined,d=2){if(v==null||!Number.isFinite(v))return "—";return v.toLocaleString(undefined,{maximumFractionDigits:d})}
function fmtPrice(v:number|null|undefined){if(v==null||!Number.isFinite(v))return "—";const a=Math.abs(v);return v.toLocaleString(undefined,{maximumFractionDigits:a>=1000?2:a>=1?4:8})}
function routeSymbol(){const m=window.location.pathname.match(/\/trade\/([^/]+)/i);return m?decodeURIComponent(m[1]).replace("-","/").toUpperCase():""}

function CandleChart({rows,last,pairSymbol}:{rows:Candle[];last:number|null;pairSymbol:string}){
  if(!rows.length)return <div className="empty">No trade history yet for {pairSymbol}.<br/>The chart fills in as soon as real trades execute on this pair.</div>;
  const W=1000,H=455,L=18,R=62,T=16,B=42,PW=W-L-R,PH=H-T-B,min=Math.min(...rows.map(x=>x.low)),max=Math.max(...rows.map(x=>x.high)),range=max-min||1,y=(v:number)=>T+(max-v)/range*PH,step=PW/rows.length,body=Math.max(2,Math.min(11,step*.55)),vmax=Math.max(...rows.map(x=>x.volume),1);
  return <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Candlestick chart for ${pairSymbol}`}>
    {Array.from({length:7}).map((_,i)=>{const yy=T+PH*i/6;return <g key={i}><line x1={L} x2={W-R} y1={yy} y2={yy} stroke="#171717"/><text x={W-R+5} y={yy+4} fill="#666" fontSize="11">{fmtPrice(max-range*i/6)}</text></g>})}
    {rows.map((c,i)=>{const x=L+step*i+step/2,up=c.close>=c.open,by=Math.min(y(c.open),y(c.close)),bh=Math.max(1.5,Math.abs(y(c.close)-y(c.open))),vh=c.volume/vmax*45;return <g key={c.open_time}><line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={up?"#16c784":"#ea3943"} strokeWidth="1.2"/><rect x={x-body/2} y={by} width={body} height={bh} fill={up?"#16c784":"#ea3943"}/><rect x={x-body/2} y={H-20-vh} width={body} height={vh} fill={up?"#16c784":"#ea3943"} opacity=".4"/></g>})}
    {last!=null&&last>=min&&last<=max?<><line x1={L} x2={W-R} y1={y(last)} y2={y(last)} stroke="#d9a927" strokeDasharray="4 4"/><rect x={W-R+1} y={y(last)-10} width="58" height="20" rx="4" fill="#d9a927"/><text x={W-R+5} y={y(last)+4} fill="#050505" fontSize="11">{fmtPrice(last)}</text></>:null}
    <text x={L} y={H-5} fill="#777" fontSize="11">Volume</text>
  </svg>
}

export default function TradingPage({symbol:propSymbol,onBack,onAddFunds}:Props){
  const [symbol,setSymbol]=useState((propSymbol||routeSymbol()).toUpperCase());const [pair,setPair]=useState<Pair|null>(null);const [pairs,setPairs]=useState<Pair[]>([]);const [ticker,setTicker]=useState<Ticker|null>(null);const [candles,setCandles]=useState<Candle[]>([]);const [book,setBook]=useState<BookRow[]>([]);const [wallets,setWallets]=useState<Wallet[]>([]);const [orders,setOrders]=useState<Order[]>([]);const [tf,setTf]=useState<(typeof TF)[number]["value"]>("15m");const [side,setSide]=useState<"buy"|"sell">("buy");const [p,setP]=useState("");const [amount,setAmount]=useState("");const [busy,setBusy]=useState(true);const [submitting,setSubmitting]=useState(false);const [notice,setNotice]=useState("");const [orderTab,setOrderTab]=useState<"open"|"history">("open");const [activePct,setActivePct]=useState<number|null>(null);

  const loadPair=useCallback(async()=>{if(!symbol)return;setBusy(true);const [{data,error},{data:all,error:e2}]=await Promise.all([supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("symbol",symbol).maybeSingle(),supabase.from("trading_pairs").select("id,symbol,base_asset,quote_asset,is_active").eq("is_active",true).order("symbol").limit(200)]);if(error||e2){setNotice(error?.message||e2?.message||"Unable to load pairs.");setBusy(false);return}if(!data||!data.is_active){setNotice("This trading pair is unavailable.");setPair(null);setBusy(false);return}setPair(data as Pair);setPairs((all||[]) as Pair[]);setP("");setAmount("");setActivePct(null);setBusy(false)},[symbol]);
  const loadMarket=useCallback(async()=>{if(!pair)return;const [{data:t},{data:c},{data:b,error:be}]=await Promise.all([supabase.from("market_tickers").select("symbol,last_price,bid_price,ask_price,high_24h,low_24h,volume_24h,change_24h").eq("symbol",pair.symbol).maybeSingle(),supabase.from("market_candles").select("open_time,open,high,low,close,volume").eq("trading_pair",pair.symbol).eq("timeframe",tf).order("open_time",{ascending:true}).limit(500),supabase.rpc("get_order_book",{p_trading_pair:pair.symbol})]);setTicker((t||null) as Ticker|null);setCandles((c||[]) as Candle[]);if(!be)setBook((b||[]) as BookRow[]);if(!p&&t?.last_price!=null)setP(String(t.last_price))},[pair,tf,p]);
  const loadUser=useCallback(async()=>{if(!pair)return;const {data:{user}}=await supabase.auth.getUser();if(!user)return;const [{data:w},{data:o}]=await Promise.all([supabase.from("wallets").select("asset,balance,locked_balance,escrow_balance,wallet_type,status").eq("user_id",user.id),supabase.from("orders").select("id,user_id,trading_pair,side,order_type,price,amount,filled_amount,status,created_at").eq("user_id",user.id).eq("trading_pair",pair.symbol).order("created_at",{ascending:false}).limit(100)]);setWallets((w||[]) as Wallet[]);setOrders((o||[]) as Order[])},[pair]);
  useEffect(()=>{void loadPair()},[loadPair]);useEffect(()=>{void loadMarket();void loadUser()},[loadMarket,loadUser]);
  useEffect(()=>{if(!pair)return;const ch=supabase.channel(`trade-${pair.symbol}-${tf}`).on("postgres_changes",{event:"*",schema:"public",table:"market_tickers",filter:`symbol=eq.${pair.symbol}`},x=>setTicker((x.new||null) as Ticker)).on("postgres_changes",{event:"*",schema:"public",table:"market_candles",filter:`trading_pair=eq.${pair.symbol}`},x=>{const r=x.new as Candle&{timeframe:string};if(r?.timeframe!==tf)return;setCandles(prev=>{const i=prev.findIndex(c=>c.open_time===r.open_time);if(i<0)return [...prev,r].slice(-500);const n=[...prev];n[i]=r;return n})}).on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`trading_pair=eq.${pair.symbol}`},()=>{void loadMarket();void loadUser()}).on("postgres_changes",{event:"INSERT",schema:"public",table:"trades",filter:`trading_pair=eq.${pair.symbol}`},()=>void loadMarket()).on("postgres_changes",{event:"*",schema:"public",table:"wallets"},()=>void loadUser()).subscribe();return()=>{void supabase.removeChannel(ch)}},[pair,tf,loadMarket,loadUser]);

  const wallet=useMemo(()=>{if(!pair)return null;const asset=side==="buy"?pair.quote_asset:pair.base_asset;const rows=wallets.filter(x=>x.asset.toUpperCase()===asset.toUpperCase());const row=rows.find(x=>(x.wallet_type||"").toLowerCase()==="spot")||rows[0];return {asset,available:row?Math.max(0,Number(row.balance||0)-Number(row.locked_balance||0)-Number(row.escrow_balance||0)):0,exists:!!row}},[wallets,pair,side]);
  const np=Number(p),na=Number(amount),total=Number.isFinite(np)&&Number.isFinite(na)?np*na:0;const insufficient=!!wallet&&(wallet.available<=0||total>wallet.available);
  const step=(field:"price"|"amount",dir:1|-1)=>{const cur=field==="price"?np:na;const base=cur>0?cur:(field==="price"?(ticker?.last_price||1):1);const inc=Math.max(base*0.001,field==="price"?0.0001:0.00000001);const next=Math.max(0,(Number.isFinite(cur)?cur:0)+dir*inc);(field==="price"?setP:setAmount)(String(Number(next.toFixed(8))))};
  const setPercent=(pct:number)=>{if(!wallet||!np)return;setActivePct(pct);setAmount(String((side==="buy"?wallet.available/np:wallet.available)*pct))};
  const submit=async()=>{setNotice("");if(!pair)return;if(!wallet||!wallet.exists||wallet.available<=0){setNotice(`You don't have enough ${wallet?.asset||pair.quote_asset} to place this order. Add funds to continue.`);return}if(!Number.isFinite(np)||np<=0||!Number.isFinite(na)||na<=0){setNotice("Enter a valid price and amount.");return}if(total>wallet.available){setNotice(`You don't have enough ${wallet.asset} to place this order. Add funds to continue.`);return}const {data:{user}}=await supabase.auth.getUser();if(!user){setNotice("Please sign in to trade.");return}setSubmitting(true);const {data,error}=await supabase.rpc("place_spot_limit_order",{p_user_id:user.id,p_trading_pair:pair.symbol,p_side:side,p_price:np,p_amount:na});setSubmitting(false);if(error){setNotice(/balance|insufficient|fund/i.test(error.message)?`You don't have enough ${wallet.asset} to place this order. Add funds to continue.`:error.message);return}if(!data){setNotice("The server did not return an order id.");return}setAmount("");setActivePct(null);setNotice("Order placed. It will fill automatically once it crosses an opposite order.");void loadMarket();void loadUser()};
  const switchPair=(s:string)=>{setSymbol(s);window.history.pushState({},"",`/trade/${encodeURIComponent(s.replace("/","-"))}`)};

  if(busy)return <div className="trade-page"><style>{css}</style><div className="loading">Loading real market data…</div></div>;
  if(!pair)return <div className="trade-page"><style>{css}</style><div className="trade-shell"><button className="trade-back" onClick={onBack||(()=>window.history.back())}>←</button><div className="error">{notice||"Trading pair not found."}</div></div></div>;
  const change=Number(ticker?.change_24h??0),last=ticker?.last_price??null,asks=book.filter(x=>x.side==="sell").sort((a,b)=>a.price-b.price).slice(-7).reverse(),bids=book.filter(x=>x.side==="buy").sort((a,b)=>b.price-a.price).slice(0,7),open=orders.filter(x=>x.status.toLowerCase()==="open"||x.status.toLowerCase()==="partially_filled"),history=orders.filter(x=>!["open","partially_filled"].includes(x.status.toLowerCase())),displayOrders=orderTab==="open"?open:history;
  return <div className="trade-page"><style>{css}</style><div className="trade-shell">
    <header className="trade-top"><button className="trade-back" onClick={onBack||(()=>window.history.back())} aria-label="Back">←</button><div className="trade-pair"><div><h1><select className="pair-select" value={pair.symbol} onChange={e=>switchPair(e.target.value)}>{pairs.map(x=><option key={x.symbol} value={x.symbol}>{x.symbol}</option>)}</select></h1><small>{pair.base_asset} / {pair.quote_asset}</small></div>{last!=null&&<span className={`trade-change ${change>=0?"up":"down"}`}>{change>=0?"+":""}{change.toFixed(2)}%</span>}</div><div className="trade-spacer"/><button className="trade-icon" aria-label="Watchlist">☆</button><button className="trade-icon" aria-label="Price alert">⌂</button></header>
    {notice&&<div className={notice.startsWith("Order placed")?"warning":"error"}>{notice}</div>}
    <main className="trade-main"><section>
      <div className="trade-stats"><div className="trade-price-block"><div className={`trade-price ${last==null?"":change>=0?"up":"down"}`}>{fmtPrice(last)}</div><div className="trade-usd">{last==null?"No trades yet":`≈ $${fmt(last,2)}`}</div></div><div><div className="stat-label">24h high</div><div className="stat-value">{fmtPrice(ticker?.high_24h)}</div></div><div><div className="stat-label">24h low</div><div className="stat-value">{fmtPrice(ticker?.low_24h)}</div></div><div><div className="stat-label">24h volume</div><div className="stat-value">{fmt(ticker?.volume_24h,4)} {pair.base_asset}</div></div></div>
      <div className="card"><div className="chart-toolbar">{TF.map(x=><button key={x.value} className={`chart-tab ${tf===x.value?"active":""}`} onClick={()=>setTf(x.value)}>{x.label}</button>)}</div><div className="chart-wrap"><CandleChart rows={candles} last={last} pairSymbol={pair.symbol}/></div></div>
      <div className="card orders"><div className="orders-tabs"><button className={`orders-tab ${orderTab==="open"?"active":""}`} onClick={()=>setOrderTab("open")}>Open orders ({open.length})</button><button className={`orders-tab ${orderTab==="history"?"active":""}`} onClick={()=>setOrderTab("history")}>Order history ({history.length})</button></div>{!displayOrders.length?<div className="empty" style={{height:150}}>No {orderTab==="open"?"open orders":"order history"} for {pair.symbol}.</div>:<div className="orders-scroll"><table className="order-table"><thead><tr><th>Side</th><th>Type</th><th>Amount</th><th>Filled</th><th>Price</th><th>Status</th></tr></thead><tbody>{displayOrders.map(o=><tr key={o.id}><td className={o.side==="buy"?"up":"down"}>{o.side.toUpperCase()}</td><td>{o.order_type}</td><td>{fmt(o.amount,8)} {pair.base_asset}</td><td>{fmt(o.filled_amount,8)}</td><td>{fmtPrice(o.price)} {pair.quote_asset}</td><td>{o.status}</td></tr>)}</tbody></table></div>}</div>
    </section><aside>
      <div className="card panel">
        <span className="spot-badge">Spot</span>
        <div className="tabs"><button className={`tab buy ${side==="buy"?"active":""}`} onClick={()=>{setSide("buy");setActivePct(null)}}>Buy</button><button className={`tab sell ${side==="sell"?"active":""}`} onClick={()=>{setSide("sell");setActivePct(null)}}>Sell</button></div>
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
      <div className="card book"><div className="book-title">Order book</div><div className="book-head"><span>Price ({pair.quote_asset})</span><span>Amount ({pair.base_asset})</span></div>{asks.map((x,i)=><div className="book-row ask" key={`a${x.price}-${i}`}><span>{fmtPrice(x.price)}</span><span>{fmt(Math.max(0,x.amount-x.filled_amount),8)}</span></div>)}<div className="book-mid"><span>{fmtPrice(last)}</span><span>{last==null?"":`${change>=0?"+":""}${change.toFixed(2)}%`}</span></div>{bids.map((x,i)=><div className="book-row bid" key={`b${x.price}-${i}`}><span>{fmtPrice(x.price)}</span><span>{fmt(Math.max(0,x.amount-x.filled_amount),8)}</span></div>)}{!asks.length&&!bids.length&&<div className="empty" style={{height:100}}>No open orders for this pair.</div>}</div>
    </aside></main></div></div>;
    }
