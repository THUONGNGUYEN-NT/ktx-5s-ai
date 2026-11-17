// Component dùng chung ở nhiều trang — hiển thị badge màu theo trạng thái phòng
// Màu sắc theo API Spec: Sạch=Xanh, Hơi bừa bộn=Vàng, Bừa bộn=Đỏ, null=Xám

type Status = "Sạch" | "Hơi bừa bộn" | "Bừa bộn" | null;

const config: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  "Sạch":           { bg: "bg-green-100",  text: "text-green-700",  label: "✅ Sạch",          icon: "✅" },
  "Hơi bừa bộn":   { bg: "bg-yellow-100", text: "text-yellow-700", label: "⚠️ Hơi bừa bộn",  icon: "⚠️" },
  "Bừa bộn":        { bg: "bg-red-100",    text: "text-red-700",    label: "❌ Bừa bộn",        icon: "❌" },
  "null":           { bg: "bg-gray-100",   text: "text-gray-500",   label: "— Chưa nộp",       icon: "—"  },
};

export default function StatusBadge({ status }: { status: Status }) {
  const key = status ?? "null";
  const c = config[key] ?? config["null"];
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
