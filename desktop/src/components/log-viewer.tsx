import { useRef, useEffect, useState, useCallback } from "react";
import Ansi from "ansi-to-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

interface Props {
  serviceName: string;
  serviceColor: string;
  lines: string[];
  onClear?: () => void;
}

export function LogViewer({ serviceName, serviceColor, lines, onClear }: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Auto-scroll when new lines arrive and user is at bottom
  useEffect(() => {
    if (atBottom && lines.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: lines.length - 1,
        behavior: "smooth",
      });
    }
  }, [lines.length, atBottom]);

  const handleAtBottomChange = useCallback((bottom: boolean) => {
    setAtBottom(bottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: lines.length - 1,
      behavior: "smooth",
    });
  }, [lines.length]);

  if (lines.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="font-bold" style={{ color: serviceColor }}>
            {serviceName}
          </span>
          <span className="text-text-dim">— logs</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-dim">
          No output yet...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="font-bold" style={{ color: serviceColor }}>
          {serviceName}
        </span>
        <span className="text-text-dim">— logs</span>
        <span className="text-xs text-text-dim ml-auto">{lines.length} lines</span>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-text-dim hover:text-text px-2 py-0.5 rounded hover:bg-surface-hover transition"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex-1">
        <Virtuoso
          ref={virtuosoRef}
          totalCount={lines.length}
          atBottomStateChange={handleAtBottomChange}
          atBottomThreshold={50}
          followOutput="smooth"
          itemContent={(index) => (
            <div className="px-4 py-px hover:bg-surface-hover leading-5">
              <Ansi>{lines[index]!}</Ansi>
            </div>
          )}
        />
      </div>
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 bg-accent text-bg px-3 py-1.5 rounded-md text-xs font-bold shadow-lg hover:brightness-110 transition"
        >
          Jump to bottom
        </button>
      )}
    </div>
  );
}
