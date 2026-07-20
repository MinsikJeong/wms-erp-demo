"use client";

import { ListChecks, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrderLines, useRecordPicking } from "@/hooks/use-wms";
import type { WmsOrderRow } from "@/lib/wms/types";
import { cn, num } from "@/lib/utils";

/**
 * 출고 피킹 다이얼로그.
 *
 * 문서의 품목 라인을 존(zone_code) 오름차순 — 즉 창고 동선 순서 — 으로 보여주고,
 * 실물로 집어온 수량을 입력해 저장한다. 저장은 wms_record_picking RPC로 재고에는
 * 영향을 주지 않고 picked_qty만 기록하며, 최초 저장 시 문서 상태가
 * SCHEDULED → PICKING으로 바뀐다. 저장 후에도 계속 열어 두고 이어서 피킹할 수 있다
 * (부분 피킹 → 나중에 재방문해 마저 채우는 실무 동선을 지원).
 */
export function PickingDialog({
  order,
  onClose,
}: {
  /** null 이면 닫힘 */
  order: WmsOrderRow | null;
  onClose: () => void;
}) {
  const { data: lines, isPending } = useOrderLines(order?.id ?? null);
  const recordMutation = useRecordPicking();

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const qtyOf = (lineId: string, expectedQty: number, pickedQty: number | null) =>
    overrides[lineId] ?? String(pickedQty ?? expectedQty);

  const handleClose = () => {
    setOverrides({});
    onClose();
  };

  const parsedLines = (lines ?? []).map((line) => ({
    orderItemId: line.id,
    pickedQty: Number.parseInt(qtyOf(line.id, line.expectedQty, line.pickedQty), 10),
  }));
  const invalid = parsedLines.some((l) => !Number.isInteger(l.pickedQty) || l.pickedQty < 0);

  // 진행률 — 저장 여부와 무관하게 "지금 입력창에 있는 값" 기준으로 실시간 계산
  const progress = useMemo(() => {
    const totalExpected = (lines ?? []).reduce((sum, l) => sum + l.expectedQty, 0);
    const totalEntered = parsedLines.reduce(
      (sum, l) => sum + (Number.isFinite(l.pickedQty) ? l.pickedQty : 0),
      0,
    );
    const completedLines = (lines ?? []).filter((l, i) => {
      const qty = parsedLines[i]?.pickedQty ?? 0;
      return qty >= l.expectedQty;
    }).length;
    return { totalExpected, totalEntered, completedLines, totalLines: lines?.length ?? 0 };
  }, [lines, parsedLines]);

  const handleSave = () => {
    if (!order || invalid) return;
    recordMutation.mutate({ orderId: order.id, lines: parsedLines }, { onSuccess: handleClose });
  };

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-muted-foreground" aria-hidden />
            출고 피킹 — {order?.orderNo}
          </DialogTitle>
          <DialogDescription>
            {order?.warehouseName} · {order?.partner} · 예정일 {order?.expectedDate}
            <br />
            존(로케이션) 순서대로 이동하며 실제로 집은 수량을 입력하세요. 부족하면
            낮춰서 저장해도 되고, 나중에 다시 열어 이어서 채울 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-2" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              진행률{" "}
              <span className="font-semibold text-foreground">
                {progress.completedLines}/{progress.totalLines}
              </span>
              개 품목 완료 · 수량{" "}
              <span className="font-semibold text-foreground">
                {num.format(progress.totalEntered)}/{num.format(progress.totalExpected)}
              </span>
            </p>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs">존</TableHead>
                    <TableHead className="text-xs">품목</TableHead>
                    <TableHead className="text-right text-xs">예정수량</TableHead>
                    <TableHead className="w-28 text-right text-xs">피킹수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lines ?? []).map((line) => {
                    const entered = Number.parseInt(
                      qtyOf(line.id, line.expectedQty, line.pickedQty),
                      10,
                    );
                    const complete = Number.isFinite(entered) && entered >= line.expectedQty;
                    const short = Number.isFinite(entered) && entered > 0 && entered < line.expectedQty;
                    return (
                      <TableRow key={line.id}>
                        <TableCell>
                          {line.zoneCode ? (
                            <Badge variant="outline" className="font-mono">
                              {line.zoneCode}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">미배정</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">{line.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.sku} · {line.unit}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num.format(line.expectedQty)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={qtyOf(line.id, line.expectedQty, line.pickedQty)}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [line.id]: e.target.value }))
                            }
                            className={cn(
                              "h-8 text-right tabular-nums",
                              complete && "border-emerald-400 text-emerald-700",
                              short && "border-amber-400 text-amber-700",
                            )}
                            aria-label={`${line.itemName} 피킹수량`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={recordMutation.isPending}>
            닫기
          </Button>
          <Button onClick={handleSave} disabled={isPending || invalid || recordMutation.isPending}>
            {recordMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
            피킹 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
