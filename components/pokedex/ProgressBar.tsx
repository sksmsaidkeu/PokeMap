type ProgressBarProps = {
  pct: number; // 0~1
};

// 70%/100% 기준선은 도 해금·전설 등장 트리거 지점이라 항상 함께 보여야 한다(PRD §8.5, §18~19)
export function ProgressBar({ pct }: ProgressBarProps) {
  const percent = Math.round(pct * 100);

  return (
    <div className="relative h-3 w-full rounded-full border border-black bg-white">
      <div
        className="h-full rounded-full bg-[#e3350d] transition-[width]"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
      <div className="absolute inset-y-0 left-[70%] w-px bg-black/40" title="70% 해금 기준" />
      <div className="absolute -top-5 left-[70%] -translate-x-1/2 text-[10px] font-bold text-zinc-500">
        70%
      </div>
      <div className="absolute -top-5 right-0 text-[10px] font-bold text-zinc-500">100%</div>
      <span className="sr-only">{percent}% 완료</span>
    </div>
  );
}
