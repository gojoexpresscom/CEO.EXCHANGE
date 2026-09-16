import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
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
};

function isValidCandle(candle: ChartCandle) {
  return (
    Number.isFinite(new Date(candle.open_time).getTime()) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume)
  );
}

function sortCandles(candles: ChartCandle[]) {
  return candles
    .filter(isValidCandle)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.open_time).getTime() - new Date(b.open_time).getTime(),
    );
}

function toUnixSeconds(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

function toBar(candle: ChartCandle): CandlestickData<UTCTimestamp> {
  return {
    time: toUnixSeconds(candle.open_time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function toVolumeBar(candle: ChartCandle): HistogramData<UTCTimestamp> {
  return {
    time: toUnixSeconds(candle.open_time),
    value: candle.volume,
    color:
      candle.close >= candle.open
        ? "rgba(22,199,132,0.5)"
        : "rgba(234,57,67,0.5)",
  };
}

const UP_COLOR = "#16c784";
const DOWN_COLOR = "#ea3943";
const GOLD = "#f4c542";

export default function TradingChart({ candles }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const previousCandlesRef = useRef<ChartCandle[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
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
        vertLine: {
          color: "rgba(244,197,66,0.35)",
          labelBackgroundColor: "#171307",
          width: 1,
        },
        horzLine: {
          color: "rgba(244,197,66,0.35)",
          labelBackgroundColor: "#171307",
          width: 1,
        },
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
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
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
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    previousCandlesRef.current = [];

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) chart.applyOptions({ width, height });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      previousCandlesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    const nextCandles = sortCandles(candles);
    const previousCandles = previousCandlesRef.current;
    const isReload =
      nextCandles.length === 0 ||
      previousCandles.length === 0 ||
      nextCandles.length < previousCandles.length ||
      nextCandles[0]?.open_time !== previousCandles[0]?.open_time ||
      nextCandles.length - previousCandles.length > 1;

    if (isReload) {
      candleSeries.setData(nextCandles.map(toBar));
      volumeSeries.setData(nextCandles.map(toVolumeBar));
      if (nextCandles.length) chart.timeScale().fitContent();
    } else {
      const last = nextCandles[nextCandles.length - 1];
      const previousLast = previousCandles[previousCandles.length - 1];
      if (
        last &&
        (!previousLast ||
          last.open_time !== previousLast.open_time ||
          last.close !== previousLast.close ||
          last.volume !== previousLast.volume)
      ) {
        candleSeries.update(toBar(last));
        volumeSeries.update(toVolumeBar(last));
      }
    }

    previousCandlesRef.current = nextCandles;
  }, [candles]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
}