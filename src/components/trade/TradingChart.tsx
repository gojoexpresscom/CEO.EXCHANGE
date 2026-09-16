// src/components/trade/TradingChart.tsx
//
// Native CEO.EXCHANGE candlestick chart. Replaces the embedded TradingView
// widget entirely — no tv.js, no iframe, no KRAKEN: symbol lookups. Renders
// ONLY the real candle data it is given (the same market_candles rows
// TradingPage already loads through the Kraken execution provider). No
// synthetic candles, no Math.random(), no placeholder price action: if
// `candles` is empty, the chart shows an empty/"No data" state instead of
// inventing anything.

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type HistogramData,
} from "lightweight-charts";

export type ChartCandle = {
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  candles: ChartCandle[];
  className?: string;
};

function toUnixSeconds(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

function toBar(c: ChartCandle): CandlestickData<UTCTimestamp> {
  return {
    time: toUnixSeconds(c.open_time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function toVolumeBar(c: ChartCandle): HistogramData<UTCTimestamp> {
  return {
    time: toUnixSeconds(c.open_time),
    value: c.volume,
    color: c.close >= c.open ? "rgba(22,199,132,0.5)" : "rgba(234,57,67,0.5)",
  };
}

// CEO.EXCHANGE chart theme: charcoal/black foundation, restrained gold accent
// on the crosshair/last-price line, neutral up/down colors matching the rest
// of the trading UI (#16c784 / #ea3943).
const UP_COLOR = "#16c784";
const DOWN_COLOR = "#ea3943";
const GOLD = "#f4c542";

export default function TradingChart({ candles, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const prevCandlesRef = useRef<ChartCandle[]>([]);

  // Create the chart once on mount; tear it down cleanly on unmount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9a9a9a",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(244,197,66,0.35)", labelBackgroundColor: "#171307", width: 1 },
        horzLine: { color: "rgba(244,197,66,0.35)", labelBackgroundColor: "#171307", width: 1 },
      },
      rightPriceScale: {
        borderColor: "#1c1c1c",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#1c1c1c",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      priceLineColor: GOLD,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "ceo-volume",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    prevCandlesRef.current = [];

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      prevCandlesRef.current = [];
    };
  }, []);

  // Push real candle data into the chart. Full setData() on a reload
  // (pair/timeframe switch, or an empty->populated transition); an
  // incremental update() for the common case of a single tail bar
  // ticking/appending from the realtime subscription, so pan/zoom state
  // isn't reset on every 60s poll.
  useEffect(() => {
    const candleSeries = seriesRef.current;
    const volumeSeries = volumeRef.current;
    if (!candleSeries || !volumeSeries) return;

    const prev = prevCandlesRef.current;
    const isReload =
      candles.length === 0 ||
      prev.length === 0 ||
      candles.length < prev.length ||
      candles[0]?.open_time !== prev[0]?.open_time ||
      candles.length - prev.length > 1;

    if (isReload) {
      candleSeries.setData(candles.map(toBar));
      volumeSeries.setData(candles.map(toVolumeBar));
      if (candles.length) chartRef.current?.timeScale().fitContent();
    } else {
      const last = candles[candles.length - 1];
      const prevLast = prev[prev.length - 1];
      if (last && (candles.length !== prev.length || last.open_time !== prevLast?.open_time || last.close !== prevLast?.close)) {
        candleSeries.update(toBar(last));
        volumeSeries.update(toVolumeBar(last));
      }
    }
    prevCandlesRef.current = candles;
  }, [candles]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
}
