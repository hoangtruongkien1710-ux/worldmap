import { FileSpreadsheet } from "lucide-react";
import { qs } from "./period-bar";

/** Nút Xuất Excel: xuất đúng khoảng thời gian, bộ lọc và thứ tự sắp xếp đang xem. */
export function ExportLink({ base, params }: { base: string; params: Record<string, string | undefined> }) {
  return (
    <a href={`${base}/xuat${qs(params)}`} className="btn print:hidden" title="Tải file Excel theo bộ lọc đang xem">
      <FileSpreadsheet size={16} /> Xuất Excel
    </a>
  );
}
