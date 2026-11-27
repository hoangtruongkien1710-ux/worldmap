import { canExport, fileName, queryOf, trialSheets } from "@/lib/accounting/export";
import { loadTrial, TRIAL_TYPES } from "@/lib/accounting/loaders";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  if (!(await canExport("accounting.view"))) return new Response("Không có quyền", { status: 403 });
  const d = await loadTrial(queryOf(req));
  return xlsxResponse(fileName("tong-hop", d.period), trialSheets(d, TRIAL_TYPES));
}
