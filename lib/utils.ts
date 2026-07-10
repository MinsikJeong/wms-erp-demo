import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 원화 표기 포맷터 — 재무 화면 전반에서 동일한 표기를 보장한다. */
export const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/** 숫자(건수/수량) 표기 포맷터 */
export const num = new Intl.NumberFormat("ko-KR");
