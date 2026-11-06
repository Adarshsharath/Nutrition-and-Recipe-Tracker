export default function SqlResultTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-white/60 border border-slate-200/60 text-xs text-slate-500 italic text-center">
        Zero rows returned by query.
      </div>
    );
  }
  const cols = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/70 shadow-xs backdrop-blur-md">
      <table className="min-w-full divide-y divide-slate-100 text-xs">
        <thead className="bg-slate-100/70">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3.5 py-2.5 text-left font-bold text-slate-700 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
              {cols.map((c) => (
                <td key={c} className="px-3.5 py-2 text-slate-700 font-mono text-[11px] whitespace-nowrap max-w-xs truncate">
                  {row[c] === null ? (
                    <span className="text-slate-400 italic">NULL</span>
                  ) : typeof row[c] === 'boolean' ? (
                    <span className={row[c] ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>
                      {String(row[c])}
                    </span>
                  ) : (
                    String(row[c])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
