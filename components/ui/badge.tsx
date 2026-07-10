import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "outline";

/**
 * Shadcn UI 스타일 Badge.
 * ERP 무채색 테마 원칙에 따라 기본은 회색, 검증 포인트(경고/오류)에만
 * 포인트 컬러를 사용한다.
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "border-transparent bg-zinc-900 text-zinc-50",
  success: "border-transparent bg-emerald-100 text-emerald-800",
  warning: "border-transparent bg-amber-100 text-amber-800",
  destructive: "border-transparent bg-red-100 text-red-800",
  outline: "border-zinc-300 text-zinc-600",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
