"use client";

import { useState } from "react";
import { Field } from "@/components/ui/modal";

/** Chọn bộ phận; chọn “+ Thêm bộ phận mới” để nhập tên và loại chi phí hạch toán lương. */
export function DepartmentSelect({ departments, defaultValue }: { departments: { code: string; name: string }[]; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="space-y-3">
      <Field label="Bộ phận">
        <select name="department" value={v} onChange={(e) => setV(e.target.value)} className="input">
          {departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          <option value="__new">+ Thêm bộ phận mới…</option>
        </select>
      </Field>
      {v === "__new" && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <Field label="Tên bộ phận mới"><input name="newDeptName" maxLength={40} autoFocus className="input" placeholder="VD: Marketing, Tư vấn tuyển sinh" /></Field>
          <Field label="Hạch toán lương vào" hint="Quyết định khoản chi phí khi chốt bảng lương">
            <select name="newDeptCost" defaultValue="6422" className="input">
              <option value="6422">Chi phí quản lý (6422), cho bộ phận văn phòng</option>
              <option value="632">Chi phí giảng dạy (632), cho bộ phận dạy học</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}
