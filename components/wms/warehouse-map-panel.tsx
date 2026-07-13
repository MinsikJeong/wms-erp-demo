"use client";

import { Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWarehouseStockSummary } from "@/hooks/use-wms";
import { isSetupError } from "@/components/wms/setup-notice";
import type { UserRole } from "@/lib/types";

/**
 * 창고관리 페이지의 지도 패널.
 * Leaflet은 SSR 불가(window 의존)라 dynamic(ssr:false)로 클라이언트에서만 로드하고,
 * 로딩 동안은 동일 높이 스켈레톤으로 CLS를 방지한다.
 */
const WarehouseMap = dynamic(() => import("@/components/wms/warehouse-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-lg" />,
});

export function WarehouseMapPanel({ role }: { role: UserRole }) {
  const { data, isPending, isError, error } = useWarehouseStockSummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapIcon className="size-4 text-muted-foreground" aria-hidden />
          전국 물류 거점 지도
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="flex h-80 items-center justify-center rounded-lg bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            {isSetupError(error.message) ? (
              <>
                지도 데이터가 없습니다 —{" "}
                <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                  supabase/02-warehouse-map.sql
                </code>
                을 SQL Editor에서 실행해 주세요.
              </>
            ) : (
              `지도 데이터 조회 실패: ${error.message}`
            )}
          </p>
        ) : isPending ? (
          <Skeleton className="h-80 w-full rounded-lg" />
        ) : (
          <>
            <WarehouseMap summaries={data} role={role} />
            <p className="mt-2 text-xs text-muted-foreground">
              마커를 클릭하면 창고별 재고 요약과 상세 화면 링크가 표시됩니다.
              (지도: OpenStreetMap)
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
