interface Props {
  marge_pct: number;
  label?: string;
}

export function WeightedMarginBar({ marge_pct, label }: Props) {
  const percentage = Math.min(Math.max(marge_pct * 100, -10), 60);
  const barWidth = Math.max(0, ((percentage + 10) / 70) * 100);
  const targetPos = ((25 + 10) / 70) * 100; // 25% target line position

  let barColor = 'bg-red-500';
  if (marge_pct >= 0.25) barColor = 'bg-green-500';
  else if (marge_pct >= 0.15) barColor = 'bg-yellow-500';

  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-gray-500">{label}</div>}
      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${barWidth}%` }}
        />
        {/* 25% target line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-800 opacity-40"
          style={{ left: `${targetPos}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 mix-blend-multiply">
          {(marge_pct * 100).toFixed(1)}%
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-1">
        <span>-10%</span>
        <span className="font-medium text-gray-600">25% doel</span>
        <span>60%</span>
      </div>
    </div>
  );
}
