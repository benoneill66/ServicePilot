interface Props {
  runningCount: number;
  totalCount: number;
}

export function StatusBar({ runningCount, totalCount }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-surface text-xs text-text-dim">
      <div className="flex gap-4">
        <span>[Tab] next</span>
        <span>[r] restart</span>
        <span>[s] stop</span>
        <span>[Enter] start</span>
        <span>[q] quit all</span>
      </div>
      <div>
        {runningCount}/{totalCount} running
      </div>
    </div>
  );
}
