import { Skeleton } from "@/components/ui/skeleton";

/**
 * (dashboard) 전 라우트 공용 로딩 스켈레톤.
 *
 * 모든 페이지가 동적 렌더링(세션 쿠키 의존)이라 이 바운더리가 없으면
 * 서버 응답이 올 때까지 이전 화면이 그대로 남아 "클릭 후 멈춤"으로 느껴진다.
 * loading.tsx가 있으면 ① 클릭 즉시 스켈레톤으로 전환되고
 * ② 프로덕션에서는 동적 라우트도 부분 프리페치(레이아웃+로딩)된다.
 * 형태는 목록 화면 공통 구조(제목 → 필터 바 → 테이블)를 따른다.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy aria-label="페이지 로딩 중">
      {/* 페이지 제목 + 설명 */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* 필터 바 + 테이블 카드 */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
        <div className="space-y-2.5 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
