"use client";
import AppShell from "@/components/AppShell";
import UserProfileView from "@/components/UserProfileView";

export default function StudentProfilePage() {
  return (
    <AppShell role="student" title="Thông tin tài khoản & Đổi mật khẩu">
      <UserProfileView role="student" />
    </AppShell>
  );
}
