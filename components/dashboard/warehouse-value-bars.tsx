import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WarehouseStockSummary } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { canViewAmounts } from "@/lib/rbac";
import { krw, num } from "@/lib/utils";

/**
 * 창고별 재고자산 바 리스트 (크기 비교 → 단일 색조 가로 막대 + 직접 라벨).
 *
 * 단일 계열이므로 범례는 없고 제목이 계열을 명명한다. 값은 막대 우측에
 * 직접 라벨로 병기한다. VIEWER는 금액 마스킹 대상 → 수량 기준으로 전환.
 */
export function WarehouseValueBars({
  data,
  role,
}: {
  data: WarehouseStockSummary[];
  role: UserRole;
}) {
  const byValue = canViewAmounts(role);
  const measure = (w: WarehouseStockSummary) => (byValue ? w.totalValue : w.totalQty);
  const sorted = [...data].sort((a, b) => measure(b) - measure(a));
  const max = sorted.length > 0 ? measure(sorted[0]) : 0;
  const grandTotal = sorted.reduce((s, w) => s + w.totalValue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>창고별 재고자산</CardTitle>
        <CardDescription>{byValue ? "현재고 × 품목 단가 합계" : "현재고 수량 합계 (금액은 권한 필요)"}</CardDescription>
        <CardAction>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-tight tabular-nums text-foreground">
              {byValue ? krw.format(grandTotal) : "₩ ***,***"}
            </p>
            <p className="text-xs text-muted-foreground">전 창고 합계</p>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {sorted.map((w) => {
            const amount = measure(w);
            const width = max > 0 ? Math.max((amount / max) * 100, 2) : 0;
            return (
              <li key={w.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate font-medium text-foreground">{w.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {w.code} · {w.itemKinds}종
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-foreground">
                    {byValue ? krw.format(w.totalValue) : `${num.format(w.totalQty)}개`}
                  </span>
                </div>
                {/* 단일 색조(chart-1) — 크기 비교라 색이 아니라 길이가 값을 나른다 */}
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: "var(--chart-1)" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
