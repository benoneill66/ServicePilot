interface Props {
  runningCount: number;
  totalCount: number;
  panelCount: number;
  onAddPanel: () => void;
}

export function StatusBar({ runningCount, totalCount, panelCount, onAddPanel }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-surface text-xs text-text-dim">
      <div className="flex gap-4">
        <span>[Tab] next</span>
        <span>[r] restart</span>
        <span>[s] stop</span>
        <span>[Enter] start</span>
        <span>[q] quit all</span>
        <span>[⌘\] split</span>
      </div>
      <div className="flex items-center gap-3">
        {panelCount < 4 && (
          <button
            onClick={onAddPanel}
            className="text-text-dim hover:text-text hover:bg-surface-hover px-1.5 py-0.5 rounded transition"
          >
            + Split
          </button>
        )}
        <span>
          {runningCount}/{totalCount} running
        </span>
      </div>
    </div>
  );
}
