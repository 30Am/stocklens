import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { PriceCandle } from '../../types';

interface Props {
  data: PriceCandle[];
  showMA20?: boolean;
  showMA50?: boolean;
  currency: 'INR' | 'USD';
}

function calcMA(data: PriceCandle[], period: number) {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, c) => s + c.close, 0) / period;
    return { time: d.time, value: +avg.toFixed(2) };
  }).filter((v): v is { time: string; value: number } => v !== null);
}

export function CandlestickChart({ data, showMA20 = false, showMA50 = false, currency }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50Ref = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#111111' },
        textColor: '#71717a',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#252525',
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
      timeScale: {
        borderColor: '#252525',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 260,
    });

    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleRef.current = candle;
    candle.setData(data.map((d) => ({ time: d.time as `${number}-${number}-${number}`, open: d.open, high: d.high, low: d.low, close: d.close })));

    // Volume pane
    const vol = chart.addHistogramSeries({
      color: '#3b82f650',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(data.map((d) => ({
      time: d.time as `${number}-${number}-${number}`,
      value: d.volume,
      color: d.close >= d.open ? '#22c55e30' : '#ef444430',
    })));

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (!candleRef.current || data.length === 0) return;
    candleRef.current.setData(data.map((d) => ({ time: d.time as `${number}-${number}-${number}`, open: d.open, high: d.high, low: d.low, close: d.close })));
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // MA20
  useEffect(() => {
    if (!chartRef.current) return;
    if (showMA20) {
      if (!ma20Ref.current) {
        ma20Ref.current = chartRef.current.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false });
      }
      ma20Ref.current.setData(calcMA(data, 20).map((d) => ({ ...d, time: d.time as `${number}-${number}-${number}` })));
    } else if (ma20Ref.current) {
      ma20Ref.current.setData([]);
    }
  }, [showMA20, data]);

  // MA50
  useEffect(() => {
    if (!chartRef.current) return;
    if (showMA50) {
      if (!ma50Ref.current) {
        ma50Ref.current = chartRef.current.addLineSeries({ color: '#a78bfa', lineWidth: 1, priceLineVisible: false });
      }
      ma50Ref.current.setData(calcMA(data, 50).map((d) => ({ ...d, time: d.time as `${number}-${number}-${number}` })));
    } else if (ma50Ref.current) {
      ma50Ref.current.setData([]);
    }
  }, [showMA50, data]);

  return (
    <div className="card overflow-hidden">
      <div ref={containerRef} className="w-full" />
      <div className="px-4 py-2 flex items-center gap-3 text-[10px] text-zinc-600 border-t border-border">
        <span>📊 Candlestick Chart — OHLCV data</span>
        {showMA20 && <span className="text-amber-400">● 20-day MA</span>}
        {showMA50 && <span className="text-violet-400">● 50-day MA overlay</span>}
        <span className="ml-auto">{currency === 'INR' ? '₹ INR' : '$ USD'}</span>
      </div>
    </div>
  );
}
