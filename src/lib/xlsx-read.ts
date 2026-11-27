import { inflateRawSync } from "node:zlib";

/**
 * Đọc file Excel .xlsx tối giản, không cần thư viện ngoài (đủ cho bảng lương/danh sách):
 * trả về từng sheet dưới dạng mảng dòng × cột. Số giữ kiểu số, còn lại là chuỗi; ô trống là null.
 * Công thức: lấy giá trị đã tính lưu trong file.
 */
export type ReadCell = string | number | null;
export type ReadSheet = { name: string; rows: ReadCell[][] };

const u16 = (b: Buffer, o: number) => b.readUInt16LE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32LE(o);

function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (u32(buf, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Không phải file Excel (.xlsx) hợp lệ.");
  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error("File Excel bị hỏng.");
    const method = u16(buf, p + 10), csize = u32(buf, p + 20);
    const nlen = u16(buf, p + 28), elen = u16(buf, p + 30), clen = u16(buf, p + 32), local = u32(buf, p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const start = local + 30 + u16(buf, local + 26) + u16(buf, local + 28);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, inflateRawSync(raw));
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const text = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join("");
const colIndex = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export function readXlsx(input: Uint8Array): ReadSheet[] {
  const files = unzip(Buffer.from(input));
  const get = (n: string) => files.get(n)?.toString("utf8") ?? "";
  const shared = [...get("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => text(m[1] ?? ""));
  const rels = new Map([...get("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1] ?? "", target = /\bTarget="([^"]+)"/.exec(m[0])?.[1] ?? "";
    return [id, target.replace(/^\/?(xl\/)?/, "xl/")] as const;
  }));
  const sheets: ReadSheet[] = [];
  for (const m of get("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const name = unesc(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    const xml = get(rels.get(rid) ?? "");
    const rows: ReadCell[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const ri = Number(/\br="(\d+)"/.exec(r[1])?.[1] ?? rows.length + 1) - 1;
      const row: ReadCell[] = (rows[ri] ??= []);
      for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+\d+)"/.exec(c[1])?.[1];
        if (!ref) continue;
        const t = /\bt="([^"]+)"/.exec(c[1])?.[1] ?? "n";
        const body = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let val: ReadCell = null;
        if (t === "inlineStr") val = text(body);
        else if (v !== undefined) val = t === "s" ? shared[Number(v)] ?? "" : t === "str" ? unesc(v) : t === "b" ? Number(v) : t === "e" ? null : Number(v);
        row[colIndex(ref)] = val === "" ? null : val;
      }
    }
    for (let i = 0; i < rows.length; i++) rows[i] = Array.from(rows[i] ?? [], (x) => x ?? null);
    sheets.push({ name, rows });
  }
  return sheets;
}
