"use client";

import { PackageCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/components/wms/orders-table";
import { ProcessDialog } from "@/components/wms/process-dialog";
import type { Direction, WmsOrderRow } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";

/**
 * 입고처리 / 출고처리 화면.
 * SCHEDULED 상태 문서만 조회하고, 행별 "처리" 버튼으로 확정 다이얼로그를 연다.
 */
export function ProcessView({
  direction,
  role,
}: {
  direction: Direction;
  role: UserRole;
}) {
  const [target, setTarget] = useState<WmsOrderRow | null>(null);
  const label = direction === "IN" ? "입고 처리" : "출고 처리";

  return (
    <>
      <OrdersTable
        direction={direction}
        role={role}
        lockedStatus="SCHEDULED"
        action={{
          header: "처리",
          cell: (row) => (
            <Button size="sm" onClick={() => setTarget(row)}>
              <PackageCheck aria-hidden />
              {label}
            </Button>
          ),
        }}
      />
      <ProcessDialog order={target} onClose={() => setTarget(null)} />
    </>
  );
}
