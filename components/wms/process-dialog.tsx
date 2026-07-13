"use client";

import { Loader2, PackageCheck } from "lucide-react";
import { useState } from "react";
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
import { useOrderLines, useProcessOrder } from "@/hooks/use-wms";
import type { WmsOrderRow } from "@/lib/wms/types";
import { num } from "@/lib/utils";

/**
 * 입·출고 처리 다이얼로그.
 *
 * 예정 문서의 품목 라인을 보여주고 실물 수량을 확정한다 (기본값 = 예정수량,
 * 검수 차이 시 하향 조정 가능). 확정 시 wms_process_order RPC가
 * 수량 확정 + 재고 반영 + 상태 변경을 원자적으로 수행한다.
 * 출고 시 재고 부족이면 DB가 전체 롤백하고 오류를 반환한다 → 토스트로 안내.
 */
export function ProcessDialog({
  order,
  onClose,
}: {
  /** null 이면 닫힘 */
  order: WmsOrderRow | null;
  onClose: () => void;
}) {
  const { data: lines, isPending } = useOrderLines(order?.id ?? null);
  const processMutation = useProcessOrder();

  // 사용자가 수정한 라인만 저장하고, 기본값(예정수량)은 렌더 시점에 파생한다.
  // order_item_id는 문서마다 유일하므로 문서 간 값이 섞이지 않는다 —
  // effect로 초기화하면 캐스케이딩 렌더가 생겨 파생 방식을 쓴다.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const qtyOf = (lineId: string, expectedQty: number) =>
    overrides[lineId] ?? String(expectedQty);

  const handleClose = () => {
    setOverrides({});
    onClose();
  };

  const isIn = order?.direction === "IN";
  const actionLabel = isIn ? "입고 처리" : "출고 처리";

  const parsedLines = (lines ?? []).map((line) => ({
    orderItemId: line.id,
    qty: Number.parseInt(qtyOf(line.id, line.expectedQty), 10),
  }));
  const invalid = parsedLines.some((l) => !Number.isInteger(l.qty) || l.qty < 0);

  const handleConfirm = () => {
    if (!order || invalid) return;
    processMutation.mutate(
      { orderId: order.id, lines: parsedLines },
      { onSuccess: handleClose },
    );
  };

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-5 text-muted-foreground" aria-hidden />
            {actionLabel} — {order?.orderNo}
          </DialogTitle>
          <DialogDescription>
            {order?.warehouseName} · {order?.partner} · 예정일 {order?.expectedDate}
            <br />
            실물 검수 결과에 맞게 수량을 조정한 뒤 확정하세요. 확정 즉시 재고에
            반영됩니다.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-2" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs">품목</TableHead>
                  <TableHead className="text-right text-xs">예정수량</TableHead>
                  <TableHead className="w-28 text-right text-xs">확정수량</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lines ?? []).map((line) => (
                  <TableRow key={line.id}>
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
                        value={qtyOf(line.id, line.expectedQty)}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                        className="h-8 text-right tabular-nums"
                        aria-label={`${line.itemName} 확정수량`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processMutation.isPending}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || invalid || processMutation.isPending}
          >
            {processMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {actionLabel} 확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
