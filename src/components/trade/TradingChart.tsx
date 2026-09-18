import { useEffect, useRef } from "react";
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

type Props = {
  candles: Candle[];
  height?: number;
  showMA?: boolean;
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

export default function TradingChart({ candles, height = 320, showMA = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma7Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma14Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma28Ref = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#8b8b8b",
      },
      grid: {
        vertLines: { color: "#161616" },
        horzLines: { color: "#161616" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1a1a1a" },
      timeScale: { borderColor: "#1a1a1a", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16c784",
      downColor: "#ea3943",
      borderUpColor: "#16c784",
      borderDownColor: "#ea3943",
      wickUpColor: "#16c784",
      wickDownColor: "#ea3943",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    let ma7: ISeriesApi<"Line"> | null = null;
    let ma14: ISeriesApi<"Line"> | null = null;
    let ma28: ISeriesApi<"Line"> | null = null;

    if (showMA) {
      ma7 = chart.addSeries(LineSeries, {
        color: "#f0b90b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma14 = chart.addSeries(LineSeries, {
        color: "#3861fb",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma28 = chart.addSeries(LineSeries, {
        color: "#e91e8c",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ma7Ref.current = ma7;
    ma14Ref.current = ma14;
    ma28Ref.current = ma28;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [height, showMA]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (!candles.length) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      ma7Ref.current?.setData([]);
      ma14Ref.current?.setData([]);
      ma28Ref.current?.setData([]);
      return;
    }

    const sorted = [...candles].sort(
      (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
    );

    const candleData: CandlestickData[] = sorted.map((c) => ({
      time: toUnix(c.open_time) as CandlestickData["time"],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData[] = sorted.map((c) => ({
      time: toUnix(c.open_time) as HistogramData["time"],
      value: c.volume,
      color: c.close >= c.open ? "rgba(22,199,132,0.45)" : "rgba(234,57,67,0.45)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    if (showMA && ma7Ref.current && ma14Ref.current && ma28Ref.current) {
      const closes = sorted.map((c) => c.close);
      const s7 = sma(closes, 7);
      const s14 = sma(closes, 14);
      const s28 = sma(closes, 28);

      const line = (vals: (number | null)[]): LineData[] =>
        sorted
          .map((c, i) =>
            vals[i] == null
              ? null
              : { time: toUnix(c.open_time) as LineData["time"], value: vals[i] as number }
          )
          .filter((x): x is LineData => x != null);

      ma7Ref.current.setData(line(s7));
      ma14Ref.current.setData(line(s14));
      ma28Ref.current.setData(line(s28));
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles, showMA]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height, position: "relative" }}
    />
  );
}

/** Real SMA values for the MA legend (computed from candle closes). */
export function computeMALegend(candles: Candle[]) {
  if (!candles.length) return { ma7: null as number | null, ma14: null as number | null, ma28: null as number | null };
  const sorted = [...candles].sort(
    (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
  );
  const closes = sorted.map((c) => c.close);
  const last = (period: number) => {
    if (closes.length < period) return null;
    let sum = 0;
    for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
    return sum / period;
  };
  return { ma7: last(7), ma14: last(14), ma28: last(28) };
}
