import { db } from "./db";

export async function getSettings(prefix?: string): Promise<Record<string, unknown>> {
  const rows = await db.setting.findMany(prefix ? { where: { key: { startsWith: prefix } } } : undefined);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getBrand() {
  const s = await getSettings("center.");
  const [classes, students] = await Promise.all([
    db.class.count({ where: { status: "OPEN" } }),
    db.student.count({ where: { status: "ACTIVE" } }),
  ]);
  return {
    title: String(s["center.sidebarTitle"] ?? "WORLDMAP EDU"),
    tagline: String(s["center.tagline"] ?? ""),
    centerName: String(s["center.name"] ?? "WorldMap EDU"),
    footer: `${classes} lớp · ${students} học sinh`,
  };
}
