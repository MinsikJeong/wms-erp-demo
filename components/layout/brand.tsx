import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 서비스 브랜드 블록 (사이드바 / 모바일 Sheet 헤더 공용).
 * 로고 마크(인디고 그라데이션) + 워드마크 + 시스템 설명.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-indigo-700 shadow-sm">
        <Warehouse className="size-4.5 text-white" aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-foreground">StockFlow</p>
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
          WMS · 창고관리 시스템
        </p>
      </div>
    </div>
  );
}
