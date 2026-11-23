"use client";
// Trang THỐNG KÊ TUẦN của cán bộ — Chọn trong 12 tuần, thống kê theo 4 tòa & 10 tầng
import { useEffect, useMemo, useState, type ElementType } from "react";
import { Building2, CheckCircle2, AlertTriangle, XCircle, Star, Calendar } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getDashboard, getRooms } from "@/lib/api";
import { TILE_ORDER, TILE_STYLES, WEEKS, FLOORS, tileKeyOf, type Room, type TileKey } from "@/components/status";

type DashboardData = {
  week: string;
  summary: { total_rooms: number; submitted: number; not_submitted: number; submission_rate_percent: number };
  breakdown: { clean: number; slightly_messy: number; messy: number };
  avg_score: number;
  deadline: string;
  top_violations: { room_code: string; score: number; status: string }[];
};

function InfoBox({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: ElementType;
  color: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white shadow-sm rounded-sm flex">
      <div className={`${color} w-20 flex items-center justify-center text-white`}>
        <Icon size={32} />
      </div>
      <div className="p-3">
        <p className="text-xs uppercase text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [week, setWeek] = useState(WEEKS[0].value);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    getDashboard(week).then((r) => setDash(r.data));
    getRooms({ week }).then((r) => setRooms(r.data.rooms));
  }, [week]);

  const byBuilding = useMemo(() => {
    const map: Record<string, Record<TileKey, number> & { total: number; sum: number; scored: number }> = {};
    rooms.forEach((r) => {
      map[r.building] ??= {
        clean: 0,
        slightly_messy: 0,
        messy: 0,
        fraud: 0,
        overridden: 0,
        not_submitted: 0,
        total: 0,
        sum: 0,
        scored: 0,
      };
      const m = map[r.building];
      m[tileKeyOf(r)]++;
      m.total++;
      if (r.score !== null) {
        m.sum += r.score;
        m.scored++;
      }
    });
    return map;
  }, [rooms]);

  const byFloor = useMemo(() => {
    const list: { floor: number; clean: number; slightly_messy: number; messy: number; not_submitted: number; avg: string }[] = [];
    for (let f = 1; f <= FLOORS; f++) {
      const fRooms = rooms.filter((r) => r.floor === f);
      const scored = fRooms.filter((r) => r.score !== null);
      const avg = scored.length
        ? (scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length).toFixed(1)
        : "—";
      list.push({
        floor: f,
        clean: fRooms.filter((r) => r.status === "Sạch").length,
        slightly_messy: fRooms.filter((r) => r.status === "Hơi bừa bộn").length,
        messy: fRooms.filter((r) => r.status === "Bừa bộn").length,
        not_submitted: fRooms.filter((r) => !r.status).length,
        avg,
      });
    }
    return list;
  }, [rooms]);

  const totals = useMemo(() => {
    const c = Object.fromEntries(TILE_ORDER.map((k) => [k, 0])) as Record<TileKey, number>;
    rooms.forEach((r) => c[tileKeyOf(r)]++);
    return c;
  }, [rooms]);

  return (
    <AppShell role="admin" title="Thống kê tuần">
      {/* Thanh chọn tuần */}
      <div className="bg-white rounded-sm shadow-sm p-3 mb-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#3c8dbc]">
        <span className="font-semibold text-gray-700 flex items-center gap-2">
          <Calendar size={16} className="text-[#3c8dbc]" />
          Báo cáo thống kê 200 phòng (4 tòa × 10 tầng)
        </span>
        <label className="flex items-center gap-2">
          <span className="font-semibold text-xs text-gray-600">Chọn tuần:</span>
          <select
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="border border-gray-300 rounded-sm px-2.5 py-1.5 bg-white font-medium"
          >
            {WEEKS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dash && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <InfoBox
            icon={Building2}
            color="bg-[#3c8dbc]"
            label="Tỷ lệ nộp ảnh"
            value={`${dash.summary.submission_rate_percent}% (${dash.summary.submitted}/${dash.summary.total_rooms})`}
          />
          <InfoBox icon={CheckCircle2} color="bg-[#00a65a]" label="Phòng sạch" value={totals.clean} />
          <InfoBox icon={AlertTriangle} color="bg-[#f39c12]" label="Hơi bừa bộn" value={totals.slightly_messy} />
          <InfoBox icon={XCircle} color="bg-[#dd4b39]" label="Bừa bộn" value={totals.messy} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Phân bổ trạng thái theo 4 tòa & 10 tầng" className="lg:col-span-2">
          <div className="flex flex-col gap-3">
            {TILE_ORDER.map((k) => {
              const pct = rooms.length ? Math.round((totals[k] / rooms.length) * 100) : 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{TILE_STYLES[k].label}</span>
                    <span>
                      <b>{totals[k]}</b> phòng ({pct}%)
                    </span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-sm">
                    <div
                      className={`${TILE_STYLES[k].bg} h-4 rounded-sm transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bảng theo Tòa */}
          <h3 className="font-semibold text-gray-700 mt-6 mb-2">Tổng hợp theo Tòa nhà</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">Tòa</th>
                <th className="p-2 text-center">Tổng</th>
                {TILE_ORDER.map((k) => (
                  <th key={k} className={`p-2 text-center ${TILE_STYLES[k].text}`}>
                    {TILE_STYLES[k].label}
                  </th>
                ))}
                <th className="p-2 text-center">Điểm TB</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byBuilding).map(([b, m]) => (
                <tr key={b} className="border-t border-gray-100">
                  <td className="p-2 font-semibold">Tòa {b}</td>
                  <td className="p-2 text-center">{m.total}</td>
                  {TILE_ORDER.map((k) => (
                    <td key={k} className="p-2 text-center">
                      {m[k]}
                    </td>
                  ))}
                  <td className="p-2 text-center font-semibold">
                    {m.scored ? (m.sum / m.scored).toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bảng theo 10 tầng */}
          <h3 className="font-semibold text-gray-700 mt-6 mb-2">Tổng hợp theo 10 Tầng (toàn KTX)</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">Tầng</th>
                <th className="p-2 text-center text-[#00a65a]">Sạch</th>
                <th className="p-2 text-center text-[#f39c12]">Hơi bừa</th>
                <th className="p-2 text-center text-[#dd4b39]">Bừa bộn</th>
                <th className="p-2 text-center text-[#3c8dbc]">Chưa nộp</th>
                <th className="p-2 text-center">Điểm TB</th>
              </tr>
            </thead>
            <tbody>
              {byFloor.map((row) => (
                <tr key={row.floor} className="border-t border-gray-100">
                  <td className="p-2 font-semibold">Tầng {row.floor}</td>
                  <td className="p-2 text-center">{row.clean}</td>
                  <td className="p-2 text-center">{row.slightly_messy}</td>
                  <td className="p-2 text-center font-semibold text-[#dd4b39]">{row.messy}</td>
                  <td className="p-2 text-center">{row.not_submitted}</td>
                  <td className="p-2 text-center font-semibold">{row.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Top phòng vi phạm trong tuần">
          {dash?.top_violations.map((v, i) => (
            <div
              key={v.room_code}
              className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
            >
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#dd4b39] text-white text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>{" "}
                Phòng <b>{v.room_code}</b>
              </span>
              <span className="text-[#dd4b39] font-bold">{v.score}/10</span>
            </div>
          ))}
          {dash && (
            <div className="mt-4 bg-gray-50 p-3 rounded-sm flex items-center gap-2">
              <Star size={16} className="text-[#f39c12]" /> Điểm trung bình toàn KTX:{" "}
              <b>{dash.avg_score}</b>/10
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
