'use client';

interface Props {
  calories:   number; targetCal:   number;
  protein:    number; targetProt:  number;
  carbs:      number; targetCarbs: number;
  fat:        number; targetFat:   number;
}

function Bar({
  label,
  value,
  target,
  unit = 'g',
  gradient,
  glowColor,
  icon,
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  gradient: string;
  glowColor: string;
  icon: string;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const isOver = target > 0 && value > target;

  return (
    <div className="space-y-1.5 group">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <span>{icon}</span> {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-900">{Math.round(value)}</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">{Math.round(target)} {unit}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            isOver ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {Math.round((value / (target || 1)) * 100)}%
          </span>
        </div>
      </div>
      <div className="h-3 w-full bg-slate-100/90 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${gradient} ${glowColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MacroBars({ calories, targetCal, protein, targetProt, carbs, targetCarbs, fat, targetFat }: Props) {
  return (
    <div className="space-y-4">
      <Bar
        label="Calories"
        value={calories}
        target={targetCal}
        unit="kcal"
        gradient="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
        glowColor="shadow-[0_0_12px_rgba(249,115,22,0.4)]"
        icon="🔥"
      />
      <Bar
        label="Protein"
        value={protein}
        target={targetProt}
        unit="g"
        gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
        glowColor="shadow-[0_0_12px_rgba(59,130,246,0.4)]"
        icon="🥩"
      />
      <Bar
        label="Carbohydrates"
        value={carbs}
        target={targetCarbs}
        unit="g"
        gradient="bg-gradient-to-r from-emerald-500 to-teal-400"
        glowColor="shadow-[0_0_12px_rgba(16,185,129,0.4)]"
        icon="🌾"
      />
      <Bar
        label="Healthy Fats"
        value={fat}
        target={targetFat}
        unit="g"
        gradient="bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500"
        glowColor="shadow-[0_0_12px_rgba(236,72,153,0.4)]"
        icon="🥑"
      />
    </div>
  );
}
