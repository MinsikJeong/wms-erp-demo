"use client";

import { ListChecks } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/components/wms/orders-table";
import { PickingDialog } from "@/components/wms/picking-dialog";
import type { WmsOrderRow } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";

/**
 * 출고 피킹 화면.
 * 피킹 미시작(SCHEDULED) + 진행중(PICKING) 출고 문서만 조회하고,
 * 행별 "피킹" 버튼으로 존 순서 피킹 리스트 다이얼로그를 연다.
 * 저장된 피킹 실적은 이후 출고처리 화면의 확정수량 기본값으로 이어진다.
 */
export function PickingView({ role }: { role: UserRole }) {
  const [target, setTarget] = useState<WmsOrderRow | null>(null);

  return (
    <>
      <OrdersTable
        direction="OUT"
        role={role}
        lockedStatus={["SCHEDULED", "PICKING"]}
        emptyMessage="피킹 대상 문서가 없습니다."
        action={{
          header: "피킹",
          cell: (row) => (
            <Button size="sm" variant="outline" onClick={() => setTarget(row)}>
              <ListChecks aria-hidden />
              피킹
            </Button>
          ),
        }}
      />
      <PickingDialog order={target} onClose={() => setTarget(null)} />
    </>
  );
}
