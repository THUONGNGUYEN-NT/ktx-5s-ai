// Khung hộp nội dung (panel) theo phong cách trang quản trị
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
    <section className={`bg-white rounded-sm border-t-[3px] border-[#3c8dbc] shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <h2 className="text-[15px] text-gray-700 font-medium">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
