"use client";

import { RefreshCcw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * (dashboard) 세그먼트 공통 ErrorBoundary.
 * WMS/OMS/PG 연동 API 장애·네트워크 지연 시 원본 에러 대신
 * 운영자 행동(재시도)을 안내한다. error.tsx는 클라이언트 컴포넌트여야 한다.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <ServerCrash className="h-10 w-10 text-zinc-300" aria-hidden />
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          데이터를 불러오지 못했습니다
        </h2>
        <p className="mt-1 max-w-md text-sm text-zinc-500">
          연동 시스템(OMS·WMS·PG) 응답이 지연되고 있습니다. 잠시 후 다시
          시도해 주세요. 문제가 계속되면 FIS팀에 문의해 주세요.
          {error.digest && (
            <span className="mt-1 block text-xs text-zinc-400">
              오류 코드: {error.digest}
            </span>
          )}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        <RefreshCcw className="h-4 w-4" aria-hidden />
        다시 시도
      </Button>
    </div>
  );
}
