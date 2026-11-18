import type { Tone } from "@/components/layout/nav";

// Viết đầy đủ tên class để Tailwind nhận diện được.
export const TONE: Record<Tone, { tile: string; text: string; solid: string; ring: string }> = {
  blue: { tile: "bg-blue-50", text: "text-blue-600", solid: "bg-blue-600", ring: "ring-blue-100" },
  violet: { tile: "bg-violet-50", text: "text-violet-600", solid: "bg-violet-600", ring: "ring-violet-100" },
  indigo: { tile: "bg-indigo-50", text: "text-indigo-600", solid: "bg-indigo-600", ring: "ring-indigo-100" },
  sky: { tile: "bg-sky-50", text: "text-sky-600", solid: "bg-sky-600", ring: "ring-sky-100" },
  emerald: { tile: "bg-emerald-50", text: "text-emerald-600", solid: "bg-emerald-600", ring: "ring-emerald-100" },
  amber: { tile: "bg-amber-50", text: "text-amber-600", solid: "bg-amber-500", ring: "ring-amber-100" },
  rose: { tile: "bg-rose-50", text: "text-rose-600", solid: "bg-rose-600", ring: "ring-rose-100" },
  orange: { tile: "bg-orange-50", text: "text-orange-600", solid: "bg-orange-500", ring: "ring-orange-100" },
  teal: { tile: "bg-teal-50", text: "text-teal-600", solid: "bg-teal-600", ring: "ring-teal-100" },
  slate: { tile: "bg-slate-100", text: "text-slate-600", solid: "bg-slate-700", ring: "ring-slate-200" },
  cyan: { tile: "bg-cyan-50", text: "text-cyan-600", solid: "bg-cyan-600", ring: "ring-cyan-100" },
  fuchsia: { tile: "bg-fuchsia-50", text: "text-fuchsia-600", solid: "bg-fuchsia-600", ring: "ring-fuchsia-100" },
};
