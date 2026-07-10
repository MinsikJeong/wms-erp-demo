import { cn } from "@/lib/utils";

/** 로딩 스켈레톤 — loading.tsx 및 Suspense fallback에서 사용 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-zinc-200", className)}
      {...props}
    />
  );
}
