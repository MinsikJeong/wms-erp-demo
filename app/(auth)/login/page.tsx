import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "로그인 | WarehouseERP",
};

export default function LoginPage() {
  return <LoginForm />;
}
