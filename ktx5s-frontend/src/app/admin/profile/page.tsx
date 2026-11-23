"use client";
import AppShell from "@/components/AppShell";
import UserProfileView from "@/components/UserProfileView";

export default function AdminProfilePage() {
  return (
    <AppShell role="admin" title="Thông tin tài khoản & Đổi mật khẩu">
      <UserProfileView role="admin" />
    </AppShell>
  );
}
