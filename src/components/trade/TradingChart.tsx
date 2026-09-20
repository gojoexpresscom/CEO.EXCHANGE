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
  type LogicalRange,
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
  /** Show MA7 / MA14 / MA28 overlays */
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

/**
 * Exchange-grade candlestick chart (lightweight-charts).
 * - Bold readable candles on mobile
 * - Pinch zoom + horizontal pan (native)
 * - Incremental live updates preserve user zoom/pan
 * - MA overlays when showMA is true
 */
export default function TradingChart({
  candles,
  height = 360,
  showMA = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma7Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma14Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma28Ref = useRef<ISeriesApi<"Line"> | null>(null);

  const lastCandleTimeRef = useRef<number | null>(null);
  const didInitialFitRef = useRef(false);
  const lastFullCountRef = useRef(0);

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
        vertLines: { color: "rgba(42, 46, 57, 0.5)", style: 0 },
        horzLines: { color: "rgba(42, 46, 57, 0.5)", style: 0 },
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
        // Starts auto; drag the right price labels → vertical zoom
        // (TradingView-style: candles expand/contract in price)
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
        // Price axis drag → vertical price zoom
        // Time axis drag / pinch → horizontal candle zoom
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: {
        touch: true,
        mouse: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#14c982",
      downColor: "#f23645",
      borderVisible: false,
      borderUpColor: "#14c982",
      borderDownColor: "#f23645",
      wickUpColor: "#14c982",
      wickDownColor: "#f23645",
      wickVisible: true,
      priceLineVisible: true,
      priceLineColor: "rgba(255,255,255,0.35)",
      priceLineWidth: 1,
      lastValueVisible: true,
    });

    chart.priceScale("right").applyOptions({
      autoScale: true,
      scaleMargins: { top: 0.08, bottom: 0.22 },
    });

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

    let ma7: ISeriesApi<"Line"> | null = null;
    let ma14: ISeriesApi<"Line"> | null = null;
    let ma28: ISeriesApi<"Line"> | null = null;

    if (showMA) {
      const maOpts = {
        lineWidth: 1 as const,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      };
      ma7 = chart.addSeries(LineSeries, { ...maOpts, color: "#f0b90b" });
      ma14 = chart.addSeries(LineSeries, { ...maOpts, color: "#5b8def" });
      ma28 = chart.addSeries(LineSeries, { ...maOpts, color: "#c77dff" });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ma7Ref.current = ma7;
    ma14Ref.current = ma14;
    ma28Ref.current = ma28;

    didInitialFitRef.current = false;
    lastCandleTimeRef.current = null;
    lastFullCountRef.current = 0;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma7Ref.current = null;
      ma14Ref.current = null;
      ma28Ref.current = null;
    };
  }, [height, showMA]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    if (!candles.length) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      ma7Ref.current?.setData([]);
      ma14Ref.current?.setData([]);
      ma28Ref.current?.setData([]);
      lastCandleTimeRef.current = null;
      lastFullCountRef.current = 0;
      didInitialFitRef.current = false;
      return;
    }

    const sorted = [...candles].sort(
      (a, b) =>
        new Date(a.open_time).getTime() - new Date(b.open_time).getTime(),
    );

    const last = sorted[sorted.length - 1];
    const lastTime = toUnix(last.open_time);
    const prevTime = lastCandleTimeRef.current;
    const prevCount = lastFullCountRef.current;

    const needsFullSet =
      prevTime == null ||
      sorted.length < prevCount * 0.5 ||
      sorted.length > prevCount + 5 ||
      (prevCount > 0 &&
        Math.abs(sorted.length - prevCount) > 3 &&
        lastTime < (prevTime || 0));

    if (needsFullSet) {
      let savedRange: LogicalRange | null = null;
      if (didInitialFitRef.current) {
        try {
          savedRange = chart.timeScale().getVisibleLogicalRange();
        } catch {
          savedRange = null;
        }
      }

      candleSeries.setData(sorted.map(toCandlePoint));
      volumeSeries.setData(sorted.map(toVolumePoint));

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
                : {
                    time: toUnix(c.open_time) as LineData["time"],
                    value: vals[i] as number,
                  },
            )
            .filter((x): x is LineData => x != null);
        ma7Ref.current.setData(line(s7));
        ma14Ref.current.setData(line(s14));
        ma28Ref.current.setData(line(s28));
      }

      if (!didInitialFitRef.current) {
        chart.timeScale().fitContent();
        didInitialFitRef.current = true;
      } else if (savedRange) {
        try {
          chart.timeScale().setVisibleLogicalRange(savedRange);
        } catch {
          /* ignore */
        }
      }

      lastCandleTimeRef.current = lastTime;
      lastFullCountRef.current = sorted.length;
      return;
    }

    candleSeries.update(toCandlePoint(last));
    volumeSeries.update(toVolumePoint(last));

    if (showMA && ma7Ref.current && ma14Ref.current && ma28Ref.current) {
      const closes = sorted.map((c) => c.close);
      const lastSma = (period: number): number | null => {
        if (closes.length < period) return null;
        let sum = 0;
        for (let i = closes.length - period; i < closes.length; i++)
          sum += closes[i];
        return sum / period;
      };
      const t = lastTime as LineData["time"];
      const v7 = lastSma(7);
      const v14 = lastSma(14);
      const v28 = lastSma(28);
      if (v7 != null) ma7Ref.current.update({ time: t, value: v7 });
      if (v14 != null) ma14Ref.current.update({ time: t, value: v14 });
      if (v28 != null) ma28Ref.current.update({ time: t, value: v28 });
    }

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
      /* ignore */
    }

    lastCandleTimeRef.current = lastTime;
    lastFullCountRef.current = sorted.length;
  }, [candles, showMA]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        position: "relative",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    />
  );
}

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
