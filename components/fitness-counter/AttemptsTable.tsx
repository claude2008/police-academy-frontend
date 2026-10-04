import type { Attempt } from "@/lib/fitness-counter/types"

export default function AttemptsTable({ rows }: { rows: Attempt[] }) {
  return (
    <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-xs font-bold text-slate-800" dir="rtl">
        <thead className="sticky top-0 bg-slate-100">
          <tr>
            <th className="px-2 py-1.5 text-center">#</th>
            <th className="px-2 py-1.5 text-center">النزول</th>
            <th className="px-2 py-1.5 text-center">الصعود</th>
            <th className="px-2 py-1.5 text-center">الحالة</th>
            <th className="px-2 py-1.5 text-center">الزمن (ثانية)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-2 py-3 text-center text-slate-500">
                لا توجد محاولات
              </td>
            </tr>
          ) : (
            rows.map((a, i) => (
              <tr key={i} className={a.counted ? "bg-emerald-50" : "bg-amber-50"}>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {i + 1}
                </td>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {a.bottom}
                </td>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {a.top == null ? "—" : a.top}
                </td>
                <td className="px-2 py-1 text-center">{a.counted ? "✅" : "❌"}</td>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {(a.at / 1000).toFixed(1)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
