// Khung Card hiện đại (Modern SaaS Navy-Blue Theme) — bo góc mềm, bóng nhẹ, hiển thị đẹp trên cả Desktop & Mobile
import { ReactNode } from "react";

export default function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[15px] sm:text-base font-bold text-slate-800 leading-snug">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
