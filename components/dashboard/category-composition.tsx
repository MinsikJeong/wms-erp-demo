import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryShare } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { canViewAmounts } from "@/lib/rbac";
import { cn, krw, num } from "@/lib/utils";

/**
 * 카테고리별 재고 구성 (part-to-whole → 가로 스택 바).
 *
 * - 색은 카테고리컬 팔레트 고정 순서(chart-1~5)로 배정하고, 6번째 이후는
 *   새 색을 만들지 않고 '기타'(중립 회색)로 접는다.
 * - 세그먼트 사이 2px 표면 간격으로 색 경계를 분리한다.
 * - VIEWER는 금액 열람 불가 → 수량 기준으로 구성비를 계산한다.
 */
const SLOT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const OTHER_COLOR = "oklch(0.75 0.01 264)";
const MAX_SLOTS = 5;

export function CategoryComposition({ data, role }: { data: CategoryShare[]; role: UserRole }) {
  const byValue = canViewAmounts(role);
  const measure = (c: CategoryShare) => (byValue ? c.totalValue : c.totalQty);

  // 상위 5개 + 나머지는 '기타'로 폴드 (정렬은 API에서 value desc 보장)
  const ranked = byValue ? data : [...data].sort((a, b) => measure(b) - measure(a));
  const head = ranked.slice(0, MAX_SLOTS);
  const tail = ranked.slice(MAX_SLOTS);
  const segments = [
    ...head.map((c, i) => ({ ...c, color: SLOT_COLORS[i], amount: measure(c) })),
    ...(tail.length > 0
      ? [
          {
            category: `기타 (${tail.length})`,
            itemKinds: tail.reduce((s, c) => s + c.itemKinds, 0),
            totalQty: tail.reduce((s, c) => s + c.totalQty, 0),
            totalValue: tail.reduce((s, c) => s + c.totalValue, 0),
            color: OTHER_COLOR,
            amount: tail.reduce((s, c) => s + measure(c), 0),
          },
        ]
      : []),
  ];
  const total = segments.reduce((s, c) => s + c.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>카테고리별 재고 구성</CardTitle>
        <CardDescription>{byValue ? "재고자산 금액 기준" : "재고 수량 기준"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 스택 바 — 세그먼트 간 2px 간격 */}
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="카테고리별 재고 구성비">
          {segments.map((seg) => (
            <div
              key={seg.category}
              className="h-full rounded-[2px] first:rounded-l-full last:rounded-r-full"
              style={{ width: `${total > 0 ? (seg.amount / total) * 100 : 0}%`, backgroundColor: seg.color }}
              title={seg.category}
            />
          ))}
        </div>

        {/* 범례 + 직접 라벨 (색만으로 정체성을 전달하지 않는다) */}
        <ul className="space-y-2">
          {segments.map((seg) => {
            const share = total > 0 ? (seg.amount / total) * 100 : 0;
            return (
              <li key={seg.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden />
                  <span className="truncate text-foreground">{seg.category}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{seg.itemKinds}종</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className={cn("text-xs text-muted-foreground", !byValue && "hidden")}>
                    {krw.format(seg.totalValue)}
                  </span>
                  <span className={cn("text-xs text-muted-foreground", byValue && "hidden")}>
                    {num.format(seg.totalQty)}개
                  </span>
                  <span className="w-10 text-right font-medium tabular-nums text-foreground">
                    {share.toFixed(1)}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
