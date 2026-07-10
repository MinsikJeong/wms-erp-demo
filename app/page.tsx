import { redirect } from "next/navigation";

/** 인트라넷 진입점 — 루트 접근 시 대시보드로 보낸다 */
export default function RootPage() {
  redirect("/dashboard");
}
