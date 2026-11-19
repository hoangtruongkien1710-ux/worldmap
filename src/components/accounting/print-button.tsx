"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn print:hidden"><Printer size={16} />In</button>;
}
