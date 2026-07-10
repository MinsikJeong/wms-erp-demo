"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * 전역 클라이언트 Provider.
 *
 * QueryClient는 useState 초기화 함수로 생성해 리렌더링 간 인스턴스를 유지하되,
 * 요청(사용자)마다 새로 만들어 SSR 시 사용자 간 캐시 오염을 방지한다.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 재무 데이터는 30초간 fresh 취급 — 페이지 재방문 시 불필요한 재요청 방지
            staleTime: 30_000,
            // 창 포커스마다 재검증하면 대사 작업 중 화면이 출렁이므로 비활성화
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {children}
        {/* 처리/전표 등 Mutation 결과 피드백용 전역 토스트 */}
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
