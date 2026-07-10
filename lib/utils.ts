import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스 병합 유틸.
 * 조건부 클래스(clsx) + 중복 유틸리티 충돌 해소(tailwind-merge).
 * Shadcn UI 컴포넌트 컨벤션과 동일한 시그니처를 사용한다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 원화 표기 포맷터 — 재무 화면 전반에서 동일한 표기를 보장한다. */
export const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/** 숫자(건수/수량) 표기 포맷터 */
export const num = new Intl.NumberFormat("ko-KR");
