import { Skeleton } from "@/components/ui/skeleton";

/**
 * 정산 대사 페이지 로딩 스켈레톤.
 * 실제 레이아웃(제목 → Metric Cards 5장 → 테이블)과 골격을 일치시켜
 * 로딩 → 콘텐츠 전환 시 화면 요동(CLS)을 방지한다.
 */
export default function ReconciliationLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-40" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
