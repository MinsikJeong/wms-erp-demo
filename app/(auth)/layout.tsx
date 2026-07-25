import { Warehouse } from "lucide-react";

/**
 * 인증 화면 공통 레이아웃 ((auth) 라우트 그룹 — 사이드바/헤더 없음).
 * 토스 스타일: 옅은 그레이 캔버스 위, 화면 중앙에 브랜드 + 카드형 폼.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[400px]">
        {/* 브랜드 */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-[1.1rem] bg-primary shadow-[0_10px_28px_-8px] shadow-primary/50">
            <Warehouse className="size-7 text-white" aria-hidden />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground">WarehouseERP</p>
            <p className="mt-1 text-sm text-muted-foreground">창고관리 시스템</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
