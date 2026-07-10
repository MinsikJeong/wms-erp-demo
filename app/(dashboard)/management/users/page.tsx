import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";

export const metadata: Metadata = {
  title: "사용자/권한 관리 | NewSelect FIS",
};

/** 데모용 구성원 목록 — 실제로는 사내 계정 디렉터리 API에서 조회 */
const MEMBERS: { name: string; email: string; role: UserRole }[] = [
  { name: "정민식", email: "minsik.jeong@newselect.co.kr", role: "ADMIN" },
  { name: "김하영", email: "hayoung.kim@newselect.co.kr", role: "OPERATOR" },
  { name: "이준호", email: "junho.lee@newselect.co.kr", role: "OPERATOR" },
  { name: "박서연", email: "seoyeon.park@newselect.co.kr", role: "VIEWER" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "관리자",
  OPERATOR: "운영자",
  VIEWER: "조회 전용",
};

/**
 * 사용자/권한 관리 (ADMIN 전용).
 * 서버에서 권한을 검증하고 미달 시 즉시 리다이렉트 — 화면 데이터가
 * 클라이언트로 전송되기 전에 차단된다.
 */
export default async function UsersManagementPage() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          사용자/권한 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          인트라넷 구성원의 권한 등급(ADMIN · OPERATOR · VIEWER)을 관리합니다.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
              <th className="px-4 py-2.5 font-semibold">이름</th>
              <th className="px-4 py-2.5 font-semibold">이메일</th>
              <th className="px-4 py-2.5 font-semibold">권한</th>
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((member) => (
              <tr key={member.email} className="border-b border-zinc-100 text-zinc-700">
                <td className="px-4 py-2.5 font-medium text-zinc-900">{member.name}</td>
                <td className="px-4 py-2.5">{member.email}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={member.role === "ADMIN" ? "default" : "outline"}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
