import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
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
  // Real simple-moving-average overlay, computed from the same candle
  // closes already on screen — no synthetic data. Defaults to on, matching
  // the reference design's MA7/MA14/MA28 legend.
  showMovingAverages?: boolean;
  // Real crosshair toggle — a native lightweight-charts behavior, not a
  // cosmetic-only switch.
  showCrosshair?: boolean;
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

// Real simple moving average over closing prices. Returns one point per
// candle once enough history exists for the window (no padding/fake values).
export function computeSMA(
  candles: ChartCandle[],
  period: number,
): LineData<UTCTimestamp>[] {
  const sorted = sortCandles(candles);
  const out: LineData<UTCTimestamp>[] = [];
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].close;
    if (i >= period) sum -= sorted[i - period].close;
    if (i >= period - 1) {
      out.push({ time: toUnixSeconds(sorted[i].open_time), value: sum / period });
    }
  }
  return out;
}

// Latest MA7/14/28 values for the text legend above the chart — same real
// closes, just the last point of each series.
export function latestMAs(candles: ChartCandle[]) {
  const ma7 = computeSMA(candles, 7);
  const ma14 = computeSMA(candles, 14);
  const ma28 = computeSMA(candles, 28);
  return {
    ma7: ma7.length ? ma7[ma7.length - 1].value : null,
    ma14: ma14.length ? ma14[ma14.length - 1].value : null,
    ma28: ma28.length ? ma28[ma28.length - 1].value : null,
  };
}

const UP_COLOR = "#16c784";
const DOWN_COLOR = "#ea3943";
const GOLD = "#f4c542";
const MA7_COLOR = "#f0b90b";
const MA14_COLOR = "#4fa8e0";
const MA28_COLOR = "#c86ee0";

export default function TradingChart({ candles, showMovingAverages = true, showCrosshair = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma14SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma28SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
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
        mode: showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden,
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

    const ma7Series = chart.addSeries(LineSeries, {
      color: MA7_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ma14Series = chart.addSeries(LineSeries, {
      color: MA14_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ma28Series = chart.addSeries(LineSeries, {
      color: MA28_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ma7SeriesRef.current = ma7Series;
    ma14SeriesRef.current = ma14Series;
    ma28SeriesRef.current = ma28Series;
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
      ma7SeriesRef.current = null;
      ma14SeriesRef.current = null;
      ma28SeriesRef.current = null;
      previousCandlesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crosshair mode can change without a full chart teardown.
  useEffect(() => {
    chartRef.current?.applyOptions({
      crosshair: { mode: showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden },
    });
  }, [showCrosshair]);

  // Show/hide the MA lines without recomputing on every toggle.
  useEffect(() => {
    const opts = { visible: showMovingAverages };
    ma7SeriesRef.current?.applyOptions(opts);
    ma14SeriesRef.current?.applyOptions(opts);
    ma28SeriesRef.current?.applyOptions(opts);
  }, [showMovingAverages]);

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
      ma7SeriesRef.current?.setData(computeSMA(nextCandles, 7));
      ma14SeriesRef.current?.setData(computeSMA(nextCandles, 14));
      ma28SeriesRef.current?.setData(computeSMA(nextCandles, 28));
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
        const ma7 = computeSMA(nextCandles, 7);
        const ma14 = computeSMA(nextCandles, 14);
        const ma28 = computeSMA(nextCandles, 28);
        if (ma7.length) ma7SeriesRef.current?.update(ma7[ma7.length - 1]);
        if (ma14.length) ma14SeriesRef.current?.update(ma14[ma14.length - 1]);
        if (ma28.length) ma28SeriesRef.current?.update(ma28[ma28.length - 1]);
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
