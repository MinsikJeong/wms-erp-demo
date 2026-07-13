"use client";

import { useMemo } from "react";
import type { ZoneStock } from "@/lib/wms/types";
import { cn, num } from "@/lib/utils";

/**
 * 창고 평면도 (순수 SVG — 외부 의존성 없음).
 *
 * 창고 내부를 A~C 3열 × 6칸 = 18존 고정 격자로 그리고,
 * 존별 재고량을 상대 히트맵(창고 내 최대 존 대비)으로 칠한다.
 * 존 클릭 → 하단 재고 테이블이 해당 존으로 필터링된다 (재클릭 시 해제).
 * DB의 wms_default_zone 규칙(A~C × 01~06)과 격자 정의가 일치해야 한다.
 */

const ROWS = ["A", "B", "C"] as const;
const COLS = 6;

/* SVG 좌표 상수 — viewBox 기준 고정 도면 */
const CELL_W = 86;
const CELL_H = 78;
const GAP = 10;
const ORIGIN_X = 52;
const ORIGIN_Y = 34;
const DOCK_X = ORIGIN_X + COLS * (CELL_W + GAP) + 8;
const VIEW_W = DOCK_X + 92;
const VIEW_H = ORIGIN_Y + ROWS.length * (CELL_H + GAP) + 26;

export function FloorPlan({
  zones,
  selectedZone,
  onSelectZone,
}: {
  zones: ZoneStock[];
  /** "" = 선택 없음 */
  selectedZone: string;
  /** 같은 존 재클릭 시 "" 로 호출(토글)된다 */
  onSelectZone: (zoneCode: string) => void;
}) {
  const zoneMap = useMemo(
    () => new Map(zones.map((z) => [z.zoneCode, z])),
    [zones],
  );
  // 상대 히트맵 기준 — 이 창고에서 가장 많이 쌓인 존
  const maxQty = useMemo(
    () => Math.max(1, ...zones.map((z) => z.totalQty)),
    [zones],
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="min-w-160 w-full"
        role="group"
        aria-label="창고 평면도 — 존을 클릭하면 재고 목록이 필터링됩니다"
      >
        {/* 외곽 벽 */}
        <rect
          x={ORIGIN_X - 14}
          y={ORIGIN_Y - 14}
          width={COLS * (CELL_W + GAP) - GAP + 28}
          height={ROWS.length * (CELL_H + GAP) - GAP + 28}
          className="fill-muted/30 stroke-border"
          strokeWidth={2}
          rx={8}
        />

        {/* 열(행) 라벨 A/B/C */}
        {ROWS.map((row, rowIdx) => (
          <text
            key={row}
            x={ORIGIN_X - 28}
            y={ORIGIN_Y + rowIdx * (CELL_H + GAP) + CELL_H / 2 + 4}
            className="fill-muted-foreground text-[13px] font-semibold"
          >
            {row}
          </text>
        ))}

        {/* 존 격자 */}
        {ROWS.map((row, rowIdx) =>
          Array.from({ length: COLS }).map((_, colIdx) => {
            const code = `${row}-${String(colIdx + 1).padStart(2, "0")}`;
            const stock = zoneMap.get(code);
            const qty = stock?.totalQty ?? 0;
            const ratio = qty / maxQty;
            const selected = selectedZone === code;
            const x = ORIGIN_X + colIdx * (CELL_W + GAP);
            const y = ORIGIN_Y + rowIdx * (CELL_H + GAP);
            // 적재율이 높을수록 글자가 배경(primary)에 묻히므로 밝은 글자로 전환
            const denseFill = ratio > 0.45;

            return (
              <g
                key={code}
                onClick={() => onSelectZone(selected ? "" : code)}
                className="cursor-pointer"
                role="button"
                aria-pressed={selected}
                aria-label={`존 ${code}: 품목 ${stock?.itemKinds ?? 0}종, ${qty}개`}
              >
                {/* 네이티브 툴팁 — 호버 시 존 상세 */}
                <title>
                  {`${code} · 품목 ${num.format(stock?.itemKinds ?? 0)}종 · ${num.format(qty)}개${selected ? " (클릭하여 필터 해제)" : ""}`}
                </title>
                <rect
                  x={x}
                  y={y}
                  width={CELL_W}
                  height={CELL_H}
                  rx={6}
                  className={cn(
                    "fill-primary stroke-border transition-[fill-opacity]",
                    selected && "stroke-primary",
                  )}
                  fillOpacity={0.06 + ratio * 0.66}
                  strokeWidth={selected ? 2.5 : 1}
                />
                <text
                  x={x + 10}
                  y={y + 22}
                  className={cn(
                    "text-[12px] font-semibold",
                    denseFill ? "fill-primary-foreground" : "fill-foreground",
                  )}
                >
                  {code}
                </text>
                <text
                  x={x + 10}
                  y={y + 42}
                  className={cn(
                    "text-[11px] tabular-nums",
                    denseFill ? "fill-primary-foreground/80" : "fill-muted-foreground",
                  )}
                >
                  {num.format(qty)}개
                </text>
                <text
                  x={x + 10}
                  y={y + 60}
                  className={cn(
                    "text-[10px] tabular-nums",
                    denseFill ? "fill-primary-foreground/70" : "fill-muted-foreground/80",
                  )}
                >
                  {num.format(stock?.itemKinds ?? 0)}종
                </text>
              </g>
            );
          }),
        )}

        {/* 입고장/출고장 (도크) */}
        <g>
          <rect
            x={DOCK_X}
            y={ORIGIN_Y - 14}
            width={72}
            height={CELL_H + 14}
            rx={6}
            className="fill-emerald-100 stroke-emerald-300"
            strokeWidth={1}
          />
          <text x={DOCK_X + 12} y={ORIGIN_Y + 28} className="fill-emerald-800 text-[11px] font-semibold">
            입고장
          </text>
          <rect
            x={DOCK_X}
            y={ORIGIN_Y + 2 * (CELL_H + GAP)}
            width={72}
            height={CELL_H + 14}
            rx={6}
            className="fill-amber-100 stroke-amber-300"
            strokeWidth={1}
          />
          <text
            x={DOCK_X + 12}
            y={ORIGIN_Y + 2 * (CELL_H + GAP) + 42}
            className="fill-amber-800 text-[11px] font-semibold"
          >
            출고장
          </text>
        </g>

        {/* 범례 */}
        <g>
          <rect x={ORIGIN_X} y={VIEW_H - 16} width={12} height={12} rx={3} className="fill-primary" fillOpacity={0.72} />
          <text x={ORIGIN_X + 18} y={VIEW_H - 6} className="fill-muted-foreground text-[10px]">
            적재율 높음
          </text>
          <rect x={ORIGIN_X + 92} y={VIEW_H - 16} width={12} height={12} rx={3} className="fill-primary stroke-border" fillOpacity={0.06} />
          <text x={ORIGIN_X + 110} y={VIEW_H - 6} className="fill-muted-foreground text-[10px]">
            여유 (존 클릭 = 재고 필터)
          </text>
        </g>
      </svg>
    </div>
  );
}
