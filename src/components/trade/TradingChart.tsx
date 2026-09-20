import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type LogicalRange,
  type Time,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";

export type Candle = {
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartStyle = "candlestick" | "line";

export type IndicatorId =
  | "ma"
  | "ema"
  | "boll"
  | "sar"
  | "mavol"
  | "macd"
  | "kdj"
  | "rsi"
  | "wr";

export type ChartDisplaySettings = {
  lastTradedPrice: boolean;
  grid: boolean;
  maxPrice: boolean;
  minPrice: boolean;
  countdown: boolean;
};

export type DrawingTool =
  | "none"
  | "trend"
  | "ray"
  | "hline"
  | "vline"
  | "fib"
  | "rect"
  | "circle"
  | "brush"
  | "measure"
  | "arrow"
  | "text"
  | "eraser";

type DrawingPoint = { time: number; price: number };

type Drawing = {
  id: string;
  tool: DrawingTool;
  points: DrawingPoint[];
  text?: string;
  color: string;
};

export type CandleInfo = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number | null;
};

export type TradingChartHandle = {
  jumpToDate: (isoDate: string) => boolean;
  resetView: () => void;
  clearDrawings: () => void;
  getDrawings: () => Drawing[];
  setDrawings: (d: Drawing[]) => void;
};

export type TradeMarker = {
  time: string;
  price: number;
  side: "buy" | "sell";
  id: string;
};

export type OpenOrderLevel = {
  id: string;
  price: number;
  side: "buy" | "sell";
};

type Props = {
  candles: Candle[];
  height?: number;
  /** Active indicators (real calculations from candles) */
  activeIndicators?: IndicatorId[];
  chartStyle?: ChartStyle;
  display?: Partial<ChartDisplaySettings>;
  /** Drawing tool currently selected */
  drawingTool?: DrawingTool;
  /** Timezone for labels (IANA or offset string) — labels use local conversion */
  timeZone?: string;
  /** Interval seconds for countdown (e.g. 900 for 15m) */
  intervalSec?: number;
  onCandleInfo?: (info: CandleInfo | null) => void;
  onDrawingsChange?: (drawings: Drawing[]) => void;
  avgBuy?: number | null;
  avgSell?: number | null;
  tradeMarkers?: TradeMarker[];
  openOrderLevels?: OpenOrderLevel[];
};

const DEFAULT_DISPLAY: ChartDisplaySettings = {
  lastTradedPrice: true,
  grid: true,
  maxPrice: true,
  minPrice: true,
  countdown: false,
};

function toUnix(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prev = sum / period;
      out.push(prev);
    } else {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

function boll(
  values: number[],
  period: number,
  mult: number,
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const mid = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (mid[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - (mid[i] as number);
      sumSq += d * d;
    }
    const std = Math.sqrt(sumSq / period);
    upper.push((mid[i] as number) + mult * std);
    lower.push((mid[i] as number) - mult * std);
  }
  return { mid, upper, lower };
}

function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  if (values.length < period + 1) {
    return values.map(() => null);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      out.push(null);
      continue;
    }
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
      continue;
    }
    const d = values[i] - values[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null,
  );
  const macdNums = macdLine.map((v) => (v == null ? 0 : v));
  // Signal only meaningful where macd exists
  const sigRaw = ema(
    macdNums.map((v, i) => (macdLine[i] == null ? NaN : v)),
    signal,
  );
  // Rebuild signal properly from valid macd values
  const validMacd: number[] = [];
  const validIdx: number[] = [];
  macdLine.forEach((v, i) => {
    if (v != null) {
      validMacd.push(v);
      validIdx.push(i);
    }
  });
  const sigValid = ema(validMacd, signal);
  const signalLine: (number | null)[] = values.map(() => null);
  validIdx.forEach((idx, j) => {
    signalLine[idx] = sigValid[j];
  });
  const hist: (number | null)[] = macdLine.map((m, i) =>
    m != null && signalLine[i] != null
      ? (m as number) - (signalLine[i] as number)
      : null,
  );
  void sigRaw;
  return { macd: macdLine, signal: signalLine, hist };
}

/** Parabolic SAR */
function sar(
  highs: number[],
  lows: number[],
  afStep = 0.02,
  afMax = 0.2,
): (number | null)[] {
  const n = highs.length;
  const out: (number | null)[] = n ? [null] : [];
  if (n < 2) return highs.map(() => null);
  let bull = true;
  let ep = highs[0];
  let sarVal = lows[0];
  let af = afStep;
  out[0] = null;
  for (let i = 1; i < n; i++) {
    sarVal = sarVal + af * (ep - sarVal);
    if (bull) {
      sarVal = Math.min(sarVal, lows[i - 1], i >= 2 ? lows[i - 2] : lows[i - 1]);
      if (lows[i] < sarVal) {
        bull = false;
        sarVal = ep;
        ep = lows[i];
        af = afStep;
      } else if (highs[i] > ep) {
        ep = highs[i];
        af = Math.min(afMax, af + afStep);
      }
    } else {
      sarVal = Math.max(sarVal, highs[i - 1], i >= 2 ? highs[i - 2] : highs[i - 1]);
      if (highs[i] > sarVal) {
        bull = true;
        sarVal = ep;
        ep = highs[i];
        af = afStep;
      } else if (lows[i] < ep) {
        ep = lows[i];
        af = Math.min(afMax, af + afStep);
      }
    }
    out.push(sarVal);
  }
  return out;
}

/** Williams %R */
function williamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, highs[j]);
      ll = Math.min(ll, lows[j]);
    }
    const den = hh - ll;
    out.push(den === 0 ? 0 : ((hh - closes[i]) / den) * -100);
  }
  return out;
}

/** KDJ (stochastic) */
function kdj(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 9,
  kSmooth = 3,
  dSmooth = 3,
): { k: (number | null)[]; d: (number | null)[]; j: (number | null)[] } {
  const rsv: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < period) {
      rsv.push(null);
      continue;
    }
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, highs[j]);
      ll = Math.min(ll, lows[j]);
    }
    const den = hh - ll;
    rsv.push(den === 0 ? 50 : ((closes[i] - ll) / den) * 100);
  }
  const k = sma(
    rsv.map((v) => (v == null ? 0 : v)),
    kSmooth,
  ).map((v, i) => (rsv[i] == null ? null : v));
  // Fix k with proper smoothing only on valid
  const kOut: (number | null)[] = closes.map(() => null);
  let kPrev = 50;
  for (let i = 0; i < rsv.length; i++) {
    if (rsv[i] == null) continue;
    kPrev = (2 / 3) * kPrev + (1 / 3) * (rsv[i] as number);
    kOut[i] = kPrev;
  }
  const dOut: (number | null)[] = closes.map(() => null);
  let dPrev = 50;
  for (let i = 0; i < kOut.length; i++) {
    if (kOut[i] == null) continue;
    dPrev = (2 / 3) * dPrev + (1 / 3) * (kOut[i] as number);
    dOut[i] = dPrev;
  }
  const jOut: (number | null)[] = kOut.map((kv, i) =>
    kv != null && dOut[i] != null ? 3 * (kv as number) - 2 * (dOut[i] as number) : null,
  );
  void k;
  void dSmooth;
  return { k: kOut, d: dOut, j: jOut };
}

function toCandlePoint(c: Candle): CandlestickData {
  return {
    time: toUnix(c.open_time) as CandlestickData["time"],
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function toVolumePoint(c: Candle): HistogramData {
  return {
    time: toUnix(c.open_time) as HistogramData["time"],
    value: c.volume,
    color:
      c.close >= c.open
        ? "rgba(20, 201, 130, 0.55)"
        : "rgba(242, 54, 69, 0.55)",
  };
}

function toLine(closes: number[], times: number[], vals: (number | null)[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] == null) continue;
    out.push({ time: times[i] as LineData["time"], value: vals[i] as number });
  }
  return out;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_DRAW_KEY = "ceo_chart_drawings_v1";

const TradingChart = forwardRef<TradingChartHandle, Props>(function TradingChart(
  {
    candles,
    height = 360,
    activeIndicators = ["ma"],
    chartStyle = "candlestick",
    display: displayProp,
    drawingTool = "none",
    timeZone: _timeZone,
    intervalSec = 900,
    onCandleInfo,
    onDrawingsChange,
    avgBuy = null,
    avgSell = null,
    tradeMarkers = [],
    openOrderLevels = [],
  },
  ref,
) {
  const display = { ...DEFAULT_DISPLAY, ...displayProp };
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<"Line" | "Histogram">>>(
    new Map(),
  );

  const lastCandleTimeRef = useRef<number | null>(null);
  const didInitialFitRef = useRef(false);
  const lastFullCountRef = useRef(0);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const drawingsRef = useRef<Drawing[]>([]);
  const draftRef = useRef<DrawingPoint[]>([]);
  const toolRef = useRef(drawingTool);
  toolRef.current = drawingTool;
  const tradeMarkersRef = useRef(tradeMarkers);
  tradeMarkersRef.current = tradeMarkers;
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);

  // Load drawings from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DRAW_KEY);
      if (raw) drawingsRef.current = JSON.parse(raw) as Drawing[];
    } catch {
      /* ignore */
    }
  }, []);

  const persistDrawings = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_DRAW_KEY, JSON.stringify(drawingsRef.current));
    } catch {
      /* ignore */
    }
    onDrawingsChange?.(drawingsRef.current);
  }, [onDrawingsChange]);

  const paintDrawings = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current || lineSeriesRef.current;
    if (!canvas || !chart || !series) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const drawPath = (pts: DrawingPoint[], color: string, dashed = false) => {
      if (pts.length < 1) return;
      const coords = pts
        .map((p) => {
          const x = chart.timeScale().timeToCoordinate(p.time as Time);
          const y = series.priceToCoordinate(p.price);
          return x == null || y == null ? null : { x, y };
        })
        .filter((c): c is { x: number; y: number } => c != null);
      if (!coords.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(dashed ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      // endpoints
      for (const c of coords) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const all = [...drawingsRef.current];
    if (draftRef.current.length) {
      all.push({
        id: "draft",
        tool: toolRef.current,
        points: draftRef.current,
        color: "#f0b90b",
      });
    }

    for (const d of all) {
      const color = d.color || "#f0b90b";
      if (d.tool === "hline" && d.points[0]) {
        const y = series.priceToCoordinate(d.points[0].price);
        if (y == null) continue;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (d.tool === "vline" && d.points[0]) {
        const x = chart.timeScale().timeToCoordinate(d.points[0].time as Time);
        if (x == null) continue;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (d.tool === "fib" && d.points.length >= 2) {
        const p0 = d.points[0];
        const p1 = d.points[1];
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        for (const lv of levels) {
          const price = p0.price + (p1.price - p0.price) * lv;
          const y = series.priceToCoordinate(price);
          if (y == null) continue;
          ctx.strokeStyle = `rgba(240,185,11,${0.4 + lv * 0.4})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.fillStyle = "#f0b90b";
          ctx.font = "10px Inter, sans-serif";
          ctx.fillText(`${(lv * 100).toFixed(1)}%`, 4, y - 2);
        }
      } else if (d.tool === "rect" && d.points.length >= 2) {
        const a = d.points[0];
        const b = d.points[1];
        const x1 = chart.timeScale().timeToCoordinate(a.time as Time);
        const y1 = series.priceToCoordinate(a.price);
        const x2 = chart.timeScale().timeToCoordinate(b.time as Time);
        const y2 = series.priceToCoordinate(b.price);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        ctx.strokeStyle = color;
        ctx.fillStyle = "rgba(240,185,11,0.08)";
        ctx.lineWidth = 1;
        const rx = Math.min(x1, x2);
        const ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1);
        const rh = Math.abs(y2 - y1);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (d.tool === "circle" && d.points.length >= 2) {
        const a = d.points[0];
        const b = d.points[1];
        const x1 = chart.timeScale().timeToCoordinate(a.time as Time);
        const y1 = series.priceToCoordinate(a.price);
        const x2 = chart.timeScale().timeToCoordinate(b.time as Time);
        const y2 = series.priceToCoordinate(b.price);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const r = Math.hypot(x2 - x1, y2 - y1) / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.tool === "measure" && d.points.length >= 2) {
        drawPath(d.points, "#5b8def", true);
        const a = d.points[0];
        const b = d.points[1];
        const x1 = chart.timeScale().timeToCoordinate(a.time as Time);
        const y1 = series.priceToCoordinate(a.price);
        const x2 = chart.timeScale().timeToCoordinate(b.time as Time);
        const y2 = series.priceToCoordinate(b.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          const pct = a.price !== 0 ? ((b.price - a.price) / a.price) * 100 : 0;
          ctx.fillStyle = "#5b8def";
          ctx.font = "11px Inter, sans-serif";
          ctx.fillText(
            `${b.price - a.price >= 0 ? "+" : ""}${(b.price - a.price).toFixed(2)} (${pct.toFixed(2)}%)`,
            (x1 + x2) / 2,
            (y1 + y2) / 2 - 6,
          );
        }
      } else if (d.tool === "text" && d.points[0] && d.text) {
        const x = chart.timeScale().timeToCoordinate(d.points[0].time as Time);
        const y = series.priceToCoordinate(d.points[0].price);
        if (x == null || y == null) continue;
        ctx.fillStyle = color;
        ctx.font = "12px Inter, sans-serif";
        ctx.fillText(d.text, x, y);
      } else if (d.tool === "arrow" && d.points.length >= 2) {
        drawPath(d.points, color);
        // simple arrow head
        const a = d.points[d.points.length - 2];
        const b = d.points[d.points.length - 1];
        const x1 = chart.timeScale().timeToCoordinate(a.time as Time);
        const y1 = series.priceToCoordinate(a.price);
        const x2 = chart.timeScale().timeToCoordinate(b.time as Time);
        const y2 = series.priceToCoordinate(b.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          const ang = Math.atan2(y2 - y1, x2 - x1);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - 10 * Math.cos(ang - 0.4), y2 - 10 * Math.sin(ang - 0.4));
          ctx.lineTo(x2 - 10 * Math.cos(ang + 0.4), y2 - 10 * Math.sin(ang + 0.4));
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }
      } else if (
        (d.tool === "trend" ||
          d.tool === "ray" ||
          d.tool === "brush") &&
        d.points.length
      ) {
        drawPath(d.points, color, d.tool === "ray");
        if (d.tool === "ray" && d.points.length >= 2) {
          // extend beyond second point visually
          const a = d.points[0];
          const b = d.points[1];
          const x1 = chart.timeScale().timeToCoordinate(a.time as Time);
          const y1 = series.priceToCoordinate(a.price);
          const x2 = chart.timeScale().timeToCoordinate(b.time as Time);
          const y2 = series.priceToCoordinate(b.price);
          if (x1 != null && y1 != null && x2 != null && y2 != null) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            ctx.strokeStyle = color;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + dx * 3, y2 + dy * 3);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    }

    // Trade history markers (real user fills) — anchored to time/price
    for (const m of tradeMarkersRef.current || []) {
      const t = Math.floor(new Date(m.time).getTime() / 1000);
      const x = chart.timeScale().timeToCoordinate(t as Time);
      const y = series.priceToCoordinate(m.price);
      if (x == null || y == null) continue;
      ctx.fillStyle = m.side === "buy" ? "#14c982" : "#f23645";
      ctx.beginPath();
      if (m.side === "buy") {
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 5, y);
        ctx.lineTo(x + 5, y);
      } else {
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 5, y);
        ctx.lineTo(x + 5, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      jumpToDate: (isoDate: string) => {
        const chart = chartRef.current;
        const list = candlesRef.current;
        if (!chart || !list.length) return false;
        const target = Math.floor(new Date(isoDate).getTime() / 1000);
        if (!Number.isFinite(target)) return false;
        // Find nearest candle
        let best = list[0];
        let bestDiff = Infinity;
        for (const c of list) {
          const t = toUnix(c.open_time);
          const d = Math.abs(t - target);
          if (d < bestDiff) {
            bestDiff = d;
            best = c;
          }
        }
        const t = toUnix(best.open_time);
        try {
          chart.timeScale().setVisibleRange({
            from: (t - 40 * (intervalSec || 900)) as Time,
            to: (t + 10 * (intervalSec || 900)) as Time,
          });
          return true;
        } catch {
          return false;
        }
      },
      resetView: () => {
        chartRef.current?.timeScale().fitContent();
      },
      clearDrawings: () => {
        drawingsRef.current = [];
        draftRef.current = [];
        persistDrawings();
        paintDrawings();
      },
      getDrawings: () => drawingsRef.current.slice(),
      setDrawings: (d) => {
        drawingsRef.current = d;
        persistDrawings();
        paintDrawings();
      },
    }),
    [intervalSec, paintDrawings, persistDrawings],
  );

  // Countdown for current candle
  useEffect(() => {
    if (!display.countdown || !intervalSec) {
      setCountdownLeft(null);
      return;
    }
    const tick = () => {
      const list = candlesRef.current;
      if (!list.length) {
        setCountdownLeft(null);
        return;
      }
      const last = list[list.length - 1];
      const open = toUnix(last.open_time);
      const end = open + intervalSec;
      const left = Math.max(0, end - Math.floor(Date.now() / 1000));
      setCountdownLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [display.countdown, intervalSec, candles]);

  // Create / recreate chart when structural options change
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      width: containerRef.current.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#848e9c",
        fontSize: 11,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: {
          color: display.grid ? "rgba(42, 46, 57, 0.5)" : "transparent",
          visible: display.grid,
        },
        horzLines: {
          color: display.grid ? "rgba(42, 46, 57, 0.5)" : "transparent",
          visible: display.grid,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255, 255, 255, 0.25)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2a2e39",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.25)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2a2e39",
        },
      },
      rightPriceScale: {
        borderColor: "#1e222d",
        scaleMargins: { top: 0.08, bottom: 0.22 },
        autoScale: true,
        entireTextOnly: false,
        visible: true,
        textColor: "#848e9c",
      },
      timeScale: {
        borderColor: "#1e222d",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 10,
        minBarSpacing: 2.5,
        maxBarSpacing: 32,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: { touch: true, mouse: false },
    });

    let candleSeries: ISeriesApi<"Candlestick"> | null = null;
    let mainLine: ISeriesApi<"Line"> | null = null;

    if (chartStyle === "candlestick") {
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#14c982",
        downColor: "#f23645",
        borderVisible: false,
        borderUpColor: "#14c982",
        borderDownColor: "#f23645",
        wickUpColor: "#14c982",
        wickDownColor: "#f23645",
        wickVisible: true,
        priceLineVisible: display.lastTradedPrice,
        priceLineColor: "rgba(255,255,255,0.35)",
        priceLineWidth: 1,
        lastValueVisible: display.lastTradedPrice,
      });
    } else {
      mainLine = chart.addSeries(LineSeries, {
        color: "#14c982",
        lineWidth: 2,
        priceLineVisible: display.lastTradedPrice,
        lastValueVisible: display.lastTradedPrice,
      });
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = mainLine;
    volumeSeriesRef.current = volumeSeries;
    overlaySeriesRef.current = new Map();

    didInitialFitRef.current = false;
    lastCandleTimeRef.current = null;
    lastFullCountRef.current = 0;

    const onCrosshair = (param: {
      time?: Time;
      seriesData: Map<unknown, unknown>;
    }) => {
      if (!onCandleInfo) return;
      if (param.time == null) {
        onCandleInfo(null);
        return;
      }
      const t = param.time as number;
      const list = candlesRef.current;
      const c = list.find((x) => toUnix(x.open_time) === t);
      if (!c) {
        onCandleInfo(null);
        return;
      }
      const changePct =
        c.open !== 0 ? ((c.close - c.open) / c.open) * 100 : null;
      onCandleInfo({
        time: c.open_time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        changePct,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair as never);

    const onVisible = () => paintDrawings();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisible);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height,
      });
      if (canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = height;
      }
      paintDrawings();
    });
    ro.observe(containerRef.current);
    if (canvasRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = height;
    }

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshair as never);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisible);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      volumeSeriesRef.current = null;
      overlaySeriesRef.current.clear();
    };
    // Structural recreate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, chartStyle]);

  // Apply display settings without full recreate when possible
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      grid: {
        vertLines: {
          color: display.grid ? "rgba(42, 46, 57, 0.5)" : "transparent",
          visible: display.grid,
        },
        horzLines: {
          color: display.grid ? "rgba(42, 46, 57, 0.5)" : "transparent",
          visible: display.grid,
        },
      },
    });
    const s = candleSeriesRef.current || lineSeriesRef.current;
    s?.applyOptions({
      priceLineVisible: display.lastTradedPrice,
      lastValueVisible: display.lastTradedPrice,
    } as never);
  }, [display.grid, display.lastTradedPrice]);

  // Data + indicators
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const mainLine = lineSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !volumeSeries) return;
    if (!candleSeries && !mainLine) return;

    if (!candles.length) {
      candleSeries?.setData([]);
      mainLine?.setData([]);
      volumeSeries.setData([]);
      for (const s of overlaySeriesRef.current.values()) s.setData([]);
      lastCandleTimeRef.current = null;
      lastFullCountRef.current = 0;
      didInitialFitRef.current = false;
      return;
    }

    const sorted = [...candles].sort(
      (a, b) =>
        new Date(a.open_time).getTime() - new Date(b.open_time).getTime(),
    );
    const times = sorted.map((c) => toUnix(c.open_time));
    const closes = sorted.map((c) => c.close);
    const highs = sorted.map((c) => c.high);
    const lows = sorted.map((c) => c.low);
    const vols = sorted.map((c) => c.volume);

    const last = sorted[sorted.length - 1];
    const lastTime = times[times.length - 1];
    const prevTime = lastCandleTimeRef.current;
    const prevCount = lastFullCountRef.current;

    const needsFullSet =
      prevTime == null ||
      sorted.length < prevCount * 0.5 ||
      sorted.length > prevCount + 5 ||
      (prevCount > 0 &&
        Math.abs(sorted.length - prevCount) > 3 &&
        lastTime < (prevTime || 0));

    // Ensure overlay series exist for active indicators
    const ensureLine = (key: string, color: string, scaleId = "right") => {
      let s = overlaySeriesRef.current.get(key) as ISeriesApi<"Line"> | undefined;
      if (!s) {
        s = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          priceScaleId: scaleId,
        });
        overlaySeriesRef.current.set(key, s);
      }
      return s;
    };
    const ensureHist = (key: string) => {
      let s = overlaySeriesRef.current.get(key) as
        | ISeriesApi<"Histogram">
        | undefined;
      if (!s) {
        s = chart.addSeries(HistogramSeries, {
          priceScaleId: "macd",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("macd").applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
          borderVisible: false,
        });
        overlaySeriesRef.current.set(key, s);
      }
      return s;
    };

    // Remove inactive overlays
    const needed = new Set<string>();
    const act = new Set(activeIndicators);
    if (act.has("ma")) {
      needed.add("ma7");
      needed.add("ma14");
      needed.add("ma28");
    }
    if (act.has("ema")) {
      needed.add("ema12");
      needed.add("ema26");
    }
    if (act.has("boll")) {
      needed.add("bollM");
      needed.add("bollU");
      needed.add("bollL");
    }
    if (act.has("sar")) needed.add("sar");
    if (act.has("mavol")) needed.add("mavol");
    if (act.has("macd")) {
      needed.add("macd");
      needed.add("macdSig");
      needed.add("macdHist");
    }
    if (act.has("rsi")) needed.add("rsi");
    if (act.has("wr")) needed.add("wr");
    if (act.has("kdj")) {
      needed.add("kdjK");
      needed.add("kdjD");
      needed.add("kdjJ");
    }
    for (const [k, s] of overlaySeriesRef.current) {
      if (!needed.has(k)) {
        try {
          chart.removeSeries(s);
        } catch {
          /* ignore */
        }
        overlaySeriesRef.current.delete(k);
      }
    }

    const applyIndicators = () => {
      if (act.has("ma")) {
        ensureLine("ma7", "#f0b90b").setData(toLine(closes, times, sma(closes, 7)));
        ensureLine("ma14", "#5b8def").setData(
          toLine(closes, times, sma(closes, 14)),
        );
        ensureLine("ma28", "#c77dff").setData(
          toLine(closes, times, sma(closes, 28)),
        );
      }
      if (act.has("ema")) {
        ensureLine("ema12", "#00d4aa").setData(
          toLine(closes, times, ema(closes, 12)),
        );
        ensureLine("ema26", "#ff6b6b").setData(
          toLine(closes, times, ema(closes, 26)),
        );
      }
      if (act.has("boll")) {
        const b = boll(closes, 20, 2);
        ensureLine("bollM", "#848e9c").setData(toLine(closes, times, b.mid));
        ensureLine("bollU", "#5b8def").setData(toLine(closes, times, b.upper));
        ensureLine("bollL", "#5b8def").setData(toLine(closes, times, b.lower));
      }
      if (act.has("sar")) {
        ensureLine("sar", "#f0b90b").setData(
          toLine(closes, times, sar(highs, lows)),
        );
      }
      if (act.has("mavol")) {
        ensureLine("mavol", "#f0b90b", "vol").setData(
          toLine(vols, times, sma(vols, 5)),
        );
      }
      if (act.has("macd")) {
        const m = macd(closes);
        ensureLine("macd", "#5b8def", "macd").setData(
          toLine(closes, times, m.macd),
        );
        ensureLine("macdSig", "#f0b90b", "macd").setData(
          toLine(closes, times, m.signal),
        );
        const histData: HistogramData[] = [];
        for (let i = 0; i < m.hist.length; i++) {
          if (m.hist[i] == null) continue;
          histData.push({
            time: times[i] as HistogramData["time"],
            value: m.hist[i] as number,
            color:
              (m.hist[i] as number) >= 0
                ? "rgba(20,201,130,0.6)"
                : "rgba(242,54,69,0.6)",
          });
        }
        ensureHist("macdHist").setData(histData);
      }
      if (act.has("rsi")) {
        ensureLine("rsi", "#c77dff", "rsi").setData(
          toLine(closes, times, rsi(closes, 14)),
        );
        chart.priceScale("rsi").applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
          borderVisible: false,
        });
      }
      if (act.has("wr")) {
        ensureLine("wr", "#ff9f43", "wr").setData(
          toLine(closes, times, williamsR(highs, lows, closes, 14)),
        );
        chart.priceScale("wr").applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
          borderVisible: false,
        });
      }
      if (act.has("kdj")) {
        const k = kdj(highs, lows, closes);
        ensureLine("kdjK", "#5b8def", "kdj").setData(
          toLine(closes, times, k.k),
        );
        ensureLine("kdjD", "#f0b90b", "kdj").setData(
          toLine(closes, times, k.d),
        );
        ensureLine("kdjJ", "#c77dff", "kdj").setData(
          toLine(closes, times, k.j),
        );
        chart.priceScale("kdj").applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
          borderVisible: false,
        });
      }
    };

    // Min / max price lines
    const priceLines: { remove: () => void }[] = [];
    const clearPriceLines = () => {
      for (const pl of priceLines) {
        try {
          pl.remove();
        } catch {
          /* */
        }
      }
      priceLines.length = 0;
    };

    if (needsFullSet) {
      let savedRange: LogicalRange | null = null;
      if (didInitialFitRef.current) {
        try {
          savedRange = chart.timeScale().getVisibleLogicalRange();
        } catch {
          savedRange = null;
        }
      }

      if (candleSeries) candleSeries.setData(sorted.map(toCandlePoint));
      if (mainLine) {
        mainLine.setData(
          sorted.map((c) => ({
            time: toUnix(c.open_time) as LineData["time"],
            value: c.close,
          })),
        );
      }
      volumeSeries.setData(sorted.map(toVolumePoint));
      applyIndicators();

      clearPriceLines();
      const main = candleSeries || mainLine;
      if (main && sorted.length) {
        const maxP = Math.max(...highs);
        const minP = Math.min(...lows);
        if (display.maxPrice) {
          priceLines.push(
            main.createPriceLine({
              price: maxP,
              color: "rgba(20,201,130,0.5)",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "Max",
            }),
          );
        }
        if (display.minPrice) {
          priceLines.push(
            main.createPriceLine({
              price: minP,
              color: "rgba(242,54,69,0.5)",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: "Min",
            }),
          );
        }
      }

      if (!didInitialFitRef.current) {
        chart.timeScale().fitContent();
        didInitialFitRef.current = true;
      } else if (savedRange) {
        try {
          chart.timeScale().setVisibleLogicalRange(savedRange);
        } catch {
          /* */
        }
      }

      lastCandleTimeRef.current = lastTime;
      lastFullCountRef.current = sorted.length;
      paintDrawings();
      return () => clearPriceLines();
    }

    // Incremental update
    if (candleSeries) candleSeries.update(toCandlePoint(last));
    if (mainLine) {
      mainLine.update({
        time: lastTime as LineData["time"],
        value: last.close,
      });
    }
    volumeSeries.update(toVolumePoint(last));
    applyIndicators();

    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range && lastTime !== prevTime) {
        const dataLen = sorted.length;
        const nearRight = range.to >= dataLen - 3 && range.to <= dataLen + 2;
        if (nearRight && prevTime != null) {
          const span = range.to - range.from;
          chart.timeScale().setVisibleLogicalRange({
            from: dataLen - 1 - span,
            to: dataLen - 1 + (range.to - (dataLen - 2)),
          });
        }
      }
    } catch {
      /* */
    }

    lastCandleTimeRef.current = lastTime;
    lastFullCountRef.current = sorted.length;
    paintDrawings();
  }, [
    candles,
    activeIndicators,
    chartStyle,
    display.maxPrice,
    display.minPrice,
    paintDrawings,
  ]);

  // Real avg buy/sell + open-order price lines
  useEffect(() => {
    const series = candleSeriesRef.current || lineSeriesRef.current;
    if (!series) return;
    const lines: { remove: () => void }[] = [];
    const add = (
      price: number,
      color: string,
      title: string,
    ) => {
      try {
        lines.push(
          series.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title,
          }),
        );
      } catch {
        /* */
      }
    };
    if (avgBuy != null && Number.isFinite(avgBuy)) {
      add(avgBuy, "#14c982", "Avg Buy");
    }
    if (avgSell != null && Number.isFinite(avgSell)) {
      add(avgSell, "#f23645", "Avg Sell");
    }
    for (const o of openOrderLevels) {
      if (!Number.isFinite(o.price)) continue;
      add(
        o.price,
        o.side === "buy" ? "rgba(20,201,130,0.85)" : "rgba(242,54,69,0.85)",
        o.side === "buy" ? "Buy" : "Sell",
      );
    }
    return () => {
      for (const l of lines) {
        try {
          l.remove();
        } catch {
          /* */
        }
      }
    };
  }, [avgBuy, avgSell, openOrderLevels, candles, chartStyle]);

  useEffect(() => {
    paintDrawings();
  }, [tradeMarkers, paintDrawings, candles]);

  // Drawing interactions on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart) return;

    const hitToPoint = (clientX: number, clientY: number): DrawingPoint | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const time = chart.timeScale().coordinateToTime(x);
      const series = candleSeriesRef.current || lineSeriesRef.current;
      if (!series || time == null) return null;
      const price = series.coordinateToPrice(y);
      if (price == null) return null;
      return { time: time as number, price };
    };

    const onPointerDown = (e: PointerEvent) => {
      const tool = toolRef.current;
      if (tool === "none") return;
      e.preventDefault();
      e.stopPropagation();
      const pt = hitToPoint(e.clientX, e.clientY);
      if (!pt) return;

      if (tool === "eraser") {
        // Remove nearest drawing within threshold
        const series = candleSeriesRef.current || lineSeriesRef.current;
        if (!series) return;
        const x = chart.timeScale().timeToCoordinate(pt.time as Time);
        const y = series.priceToCoordinate(pt.price);
        if (x == null || y == null) return;
        drawingsRef.current = drawingsRef.current.filter((d) => {
          for (const p of d.points) {
            const px = chart.timeScale().timeToCoordinate(p.time as Time);
            const py = series.priceToCoordinate(p.price);
            if (px != null && py != null && Math.hypot(px - x, py - y) < 18)
              return false;
          }
          return true;
        });
        persistDrawings();
        paintDrawings();
        return;
      }

      if (tool === "hline" || tool === "vline") {
        drawingsRef.current.push({
          id: uid(),
          tool,
          points: [pt],
          color: "#f0b90b",
        });
        draftRef.current = [];
        persistDrawings();
        paintDrawings();
        return;
      }

      if (tool === "text") {
        const text = window.prompt("Annotation text", "") || "";
        if (!text.trim()) return;
        drawingsRef.current.push({
          id: uid(),
          tool,
          points: [pt],
          text: text.trim(),
          color: "#eee",
        });
        persistDrawings();
        paintDrawings();
        return;
      }

      draftRef.current = [pt];
      paintDrawings();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (toolRef.current === "none" || !draftRef.current.length) return;
      const pt = hitToPoint(e.clientX, e.clientY);
      if (!pt) return;
      if (toolRef.current === "brush") {
        draftRef.current = [...draftRef.current, pt];
      } else {
        draftRef.current = [draftRef.current[0], pt];
      }
      paintDrawings();
    };

    const onPointerUp = () => {
      const tool = toolRef.current;
      if (tool === "none" || !draftRef.current.length) return;
      if (
        tool === "trend" ||
        tool === "ray" ||
        tool === "fib" ||
        tool === "rect" ||
        tool === "circle" ||
        tool === "measure" ||
        tool === "arrow" ||
        tool === "brush"
      ) {
        if (draftRef.current.length >= 2 || tool === "brush") {
          drawingsRef.current.push({
            id: uid(),
            tool,
            points: draftRef.current.slice(),
            color: "#f0b90b",
          });
          persistDrawings();
        }
      }
      draftRef.current = [];
      paintDrawings();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [paintDrawings, persistDrawings, height, chartStyle]);

  const formatCountdown = (s: number | null) => {
    if (s == null) return "";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        width: "100%",
        height,
        position: "relative",
        touchAction: drawingTool === "none" ? "none" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", position: "relative" }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: drawingTool === "none" ? "none" : "auto",
          zIndex: 5,
        }}
      />
      {display.countdown && countdownLeft != null && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            zIndex: 6,
            background: "rgba(20,20,20,0.85)",
            color: "#f0b90b",
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatCountdown(countdownLeft)}
        </div>
      )}
    </div>
  );
});

export default TradingChart;

/** Real SMA values for the MA legend (computed from candle closes). */
export function computeMALegend(candles: Candle[]) {
  if (!candles.length)
    return {
      ma7: null as number | null,
      ma14: null as number | null,
      ma28: null as number | null,
    };
  const sorted = [...candles].sort(
    (a, b) =>
      new Date(a.open_time).getTime() - new Date(b.open_time).getTime(),
  );
  const closes = sorted.map((c) => c.close);
  const last = (period: number) => {
    if (closes.length < period) return null;
    let sum = 0;
    for (let i = closes.length - period; i < closes.length; i++)
      sum += closes[i];
    return sum / period;
  };
  return { ma7: last(7), ma14: last(14), ma28: last(28) };
}

export function intervalToSeconds(tf: string): number {
  const map: Record<string, number> = {
    "1m": 60,
    "3m": 180,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "2h": 7200,
    "4h": 14400,
    "6h": 21600,
    "12h": 43200,
    "1d": 86400,
    "1w": 604800,
    "1M": 2592000,
  };
  return map[tf] || 900;
}
