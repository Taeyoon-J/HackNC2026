import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { HistoryPoint } from "../../api/types";

/** YES price line with volume histogram. Multiple trades in one second collapse to the last. */
export function PriceChart({ points, showNo = false }: { points: HistoryPoint[]; showNo?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi>();
  const line = useRef<ISeriesApi<"Area">>();
  const vol = useRef<ISeriesApi<"Histogram">>();

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#6b7280", fontFamily: "Nunito Sans, sans-serif", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: "#efe9df" } },
      rightPriceScale: { borderColor: "#e8e1d6" },
      timeScale: { borderColor: "#e8e1d6", timeVisible: true },
      crosshair: { mode: 0 },
    });
    line.current = c.addAreaSeries({
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(0)}¢`, minMove: 1 },
    });
    vol.current = c.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    line.current.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.22 } });
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    if (!line.current || !vol.current) return;
    const color = showNo ? "#c0563b" : "#2f6f73";
    line.current.applyOptions({
      lineColor: color,
      topColor: showNo ? "rgba(192,86,59,0.18)" : "rgba(47,111,115,0.18)",
      bottomColor: "rgba(0,0,0,0)",
    });
    const bySecond = new Map<number, { price: number; quantity: number }>();
    for (const p of points) {
      const prev = bySecond.get(p.t);
      bySecond.set(p.t, { price: showNo ? 100 - p.price : p.price, quantity: (prev?.quantity ?? 0) + p.quantity });
    }
    const rows = [...bySecond.entries()].sort((a, b) => a[0] - b[0]);
    line.current.setData(rows.map(([t, r]) => ({ time: t as UTCTimestamp, value: r.price })));
    vol.current.setData(
      rows.map(([t, r]) => ({ time: t as UTCTimestamp, value: r.quantity, color: "rgba(183,121,31,0.25)" })),
    );
    chart.current?.timeScale().fitContent();
  }, [points, showNo]);

  return <div ref={el} className="h-72 w-full" />;
}
