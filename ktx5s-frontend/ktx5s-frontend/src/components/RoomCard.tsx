// Component thẻ phòng — dùng trong trang Admin danh sách phòng
import StatusBadge from "./StatusBadge";

type Room = {
  room_code: string;
  building: string;
  floor: number;
  status: "Sạch" | "Hơi bừa bộn" | "Bừa bộn" | null;
  score: number | null;
  submitted_at: string | null;
  image_url: string | null;
};

export default function RoomCard({ room, onClick }: { room: Room; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
    >
      <div>
        <p className="font-bold text-gray-800 text-lg">{room.room_code}</p>
        <p className="text-sm text-gray-500">
          Tòa {room.building} · Tầng {room.floor}
        </p>
        {room.submitted_at && (
          <p className="text-xs text-gray-400 mt-1">
            Nộp lúc: {new Date(room.submitted_at).toLocaleString("vi-VN")}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusBadge status={room.status} />
        {room.score !== null && (
          <span className="text-2xl font-bold text-gray-700">
            {room.score.toFixed(1)}
            <span className="text-sm font-normal text-gray-400">/10</span>
          </span>
        )}
      </div>
    </div>
  );
}
