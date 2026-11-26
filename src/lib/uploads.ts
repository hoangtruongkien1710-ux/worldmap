import path from "node:path";

/** Thư mục lưu file tải lên (Docker: /app/uploads; VPS pm2: ./uploads trong thư mục app). */
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

export const MATERIAL_MAX_MB = 20;
export const MATERIAL_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  mp3: "audio/mpeg", zip: "application/zip",
};
export const MATERIAL_ACCEPT = Object.keys(MATERIAL_EXT).map((e) => `.${e}`).join(",");
