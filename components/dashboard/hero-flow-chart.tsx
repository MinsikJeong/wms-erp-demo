"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { DailyFlow } from "@/lib/wms/types";
import { cn, num } from "@/lib/utils";

/**
 * 대시보드 히어로 차트 — 물동량 추이 (입·출고 예정 수량, 예정일 기준).
 *
 * 인터랙션 3종 (모두 클라이언트 상태 — 서버 재요청 없이 즉시 반응):
 * 1. 기간 세그먼트(7/14/30일): 서버가 내려준 60일치를 렌더 시점에 슬라이스
 * 2. 스탯 블록 = 범례 토글: 클릭으로 계열 표시/숨김 (마지막 1개는 숨김 불가)
 * 3. 크로스헤어 툴팁: 날짜별 상세 값
 *
 * 색상은 CVD 검증 팔레트 고정 슬롯(chart-1/2). 헤더의 합계·증감 텍스트가
 * 대비 부족 색상(aqua)의 relief 역할을 겸한다.
 */
const RANGES = [7, 14, 30] as const;
type RangeDays = (typeof RANGES)[number];

const SERIES = [
  { key: "inbound", label: "입고", color: "var(--chart-1)", gradientId: "hero-inbound" },
  { key: "outbound", label: "출고", color: "var(--chart-2)", gradientId: "hero-outbound" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

/** "YYYY-MM-DD" → "M.D" */
function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

function sumBy(rows: DailyFlow[], key: SeriesKey): number {
  return rows.reduce((s, r) => s + r[key], 0);
}

/** 직전 동일 기간 대비 증감률 뱃지 (기준 0이면 표시 생략) */
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-emerald-600" : "text-red-500",
      )}
      title="직전 동일 기간 대비"
    >
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function HeroFlowChart({ data }: { data: DailyFlow[] }) {
  const [range, setRange] = useState<RangeDays>(14);
  const [hidden, setHidden] = useState<ReadonlySet<SeriesKey>>(new Set());

  // 60일치 원본에서 현재 기간 / 직전 동일 기간을 잘라낸다
  const { window, prevWindow } = useMemo(() => {
    return {
      window: data.slice(-range),
      prevWindow: data.slice(-(range * 2), -range),
    };
  }, [data, range]);

  const toggleSeries = (key: SeriesKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      // 모든 계열을 숨기면 빈 차트가 되므로 마지막 1개는 유지
      else if (next.size < SERIES.length - 1) next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">물동량 추이</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                최근 {range}일 예정 수량 · 직전 {range}일과 비교
              </p>
            </div>

            {/* 스탯 블록 = 인터랙티브 범례 (클릭으로 계열 토글) */}
            <div className="flex gap-4">
              {SERIES.map((s) => {
                const isHidden = hidden.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSeries(s.key)}
                    aria-pressed={!isHidden}
                    className={cn(
                      "rounded-lg px-2 py-1 text-left transition-opacity hover:bg-muted",
                      isHidden && "opacity-40",
                    )}
                    title={isHidden ? `${s.label} 계열 표시` : `${s.label} 계열 숨김`}
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                      {s.label}
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold tracking-tight tabular-nums text-foreground">
                        {num.format(sumBy(window, s.key))}개
                      </span>
                      <DeltaBadge current={sumBy(window, s.key)} previous={sumBy(prevWindow, s.key)} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 기간 세그먼트 컨트롤 */}
          <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="조회 기간">
            {RANGES.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRange(days)}
                aria-pressed={range === days}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  range === days
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {days}일
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={window} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                dy={6}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="mb-1 font-medium text-foreground">{shortDate(String(label))}</p>
                      {payload.map((item) => (
                        <p key={String(item.dataKey)} className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                            aria-hidden
                          />
                          {item.name}{" "}
                          <span className="font-medium text-foreground">
                            {num.format(Number(item.value))}개
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#${s.gradientId})`}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
