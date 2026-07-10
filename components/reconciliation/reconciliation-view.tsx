"use client";

import { DatabaseZap, RefreshCcw } from "lucide-react";
import { DataTable } from "@/components/reconciliation/data-table";
import { MetricCards } from "@/components/reconciliation/metric-cards";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useReconSummary } from "@/hooks/use-reconciliations";
import type { UserRole } from "@/lib/types";

/**
 * 정산 대사 화면 본문 (클라이언트 오케스트레이터).
 *
 * - Metric Cards: recon_summary RPC(전체 집계)를 useReconSummary로 조회
 * - DataTable: 페이지 단위 조회를 컴포넌트 내부에서 자체 관리
 * 두 쿼리 모두 서버 프리페치 캐시를 하이드레이션으로 이어받아
 * 첫 렌더링은 재요청 없이 그린다.
 */
export function ReconciliationView({ role }: { role: UserRole }) {
  const { data: summary, isPending, isError, error, refetch, isRefetching } =
    useReconSummary();

  if (isError) {
    // PGRST205=테이블 없음 / PGRST202=recon_summary 함수 없음 → 세팅 안내로 분기
    const isTableMissing = error.message.includes("PGRST205");
    const isRpcMissing = error.message.includes("PGRST202");
    const setupFile = isTableMissing ? "supabase/seed.sql" : "supabase/02-server-paging.sql";

    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZap className="size-5 text-amber-500" aria-hidden />
            {isTableMissing || isRpcMissing
              ? "데이터베이스 초기화가 필요합니다"
              : "데이터 조회 실패"}
          </CardTitle>
          <CardDescription>
            {isTableMissing || isRpcMissing ? (
              <>
                <span className="font-medium text-foreground">
                  Supabase Dashboard → SQL Editor
                </span>
                에서 프로젝트의{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{setupFile}</code>{" "}
                내용을 붙여넣고 1회 실행한 뒤 아래 버튼으로 다시 불러오세요.
              </>
            ) : (
              `연동 데이터 조회 중 오류가 발생했습니다: ${error.message}`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCcw className={isRefetching ? "animate-spin" : undefined} aria-hidden />
            다시 불러오기
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 상단: 전체 집계 Metric Cards (DB 집계, 행 전체 전송 없음) */}
      {isPending || !summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <MetricCards summary={summary} role={role} />
      )}

      {/* 하단: 서버 사이드 페이지네이션 테이블 */}
      <DataTable role={role} channels={summary?.channels ?? []} />
    </div>
  );
}
