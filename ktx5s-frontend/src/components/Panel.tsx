// Khung hộp nội dung (panel) theo phong cách trang quản trị, tối ưu hiển thị trên cả điện thoại và máy tính
import { ReactNode } from "react";

export default function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-md md:rounded-sm border-t-[3px] border-[#3c8dbc] shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-3 border-b border-gray-100">
          <h2 className="text-[15px] sm:text-base text-gray-800 font-bold leading-snug">{title}</h2>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-3.5 sm:p-4">{children}</div>
    </section>
  );
}
