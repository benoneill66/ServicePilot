import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import Ansi from "ansi-to-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

interface Props {
  serviceName: string;
  serviceColor: string;
  lines: string[];
  onClear?: () => void;
}

// Strip ANSI escape codes for search matching
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function LogViewer({ serviceName, serviceColor, lines, onClear }: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filtered = useMemo(() => {
    if (!filter) return lines;
    const lower = filter.toLowerCase();
    return lines.filter((l) => stripAnsi(l).toLowerCase().includes(lower));
  }, [lines, filter]);

  // Auto-scroll when new lines arrive and user is at bottom
  useEffect(() => {
    if (atBottom && filtered.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: filtered.length - 1,
        behavior: "smooth",
      });
    }
  }, [filtered.length, atBottom]);

  const handleAtBottomChange = useCallback((bottom: boolean) => {
    setAtBottom(bottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: filtered.length - 1,
      behavior: "smooth",
    });
  }, [filtered.length]);

  const [copied, setCopied] = useState(false);

  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(filtered.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [filtered]);

  // Cmd+F to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => {
          const next = !prev;
          if (!next) setFilter("");
          return next;
        });
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setFilter("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch]);

  // Focus search input when it appears
  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

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
        <span className="text-xs text-text-dim ml-auto">
          {filter
            ? `${filtered.length} / ${lines.length} lines`
            : `${lines.length} lines`}
        </span>
        <button
          onClick={() => {
            setShowSearch((prev) => {
              const next = !prev;
              if (!next) setFilter("");
              return next;
            });
          }}
          className={`text-xs px-2 py-0.5 rounded transition ${
            showSearch
              ? "text-accent bg-accent/15"
              : "text-text-dim hover:text-text hover:bg-surface-hover"
          }`}
        >
          Search
        </button>
        <button
          onClick={copyAll}
          className="text-xs text-text-dim hover:text-text px-2 py-0.5 rounded hover:bg-surface-hover transition"
        >
          {copied ? "Copied!" : "Copy All"}
        </button>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-text-dim hover:text-text px-2 py-0.5 rounded hover:bg-surface-hover transition"
          >
            Clear
          </button>
        )}
      </div>
      {showSearch && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <input
            ref={searchRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs..."
            className="flex-1 bg-surface text-text text-sm px-2 py-1 rounded border border-border focus:border-accent focus:outline-none"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="text-xs text-text-dim hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-hover transition"
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div className="flex-1">
        <Virtuoso
          ref={virtuosoRef}
          totalCount={filtered.length}
          atBottomStateChange={handleAtBottomChange}
          atBottomThreshold={50}
          followOutput={filter ? false : "smooth"}
          itemContent={(index) => (
            <div className="px-4 py-px hover:bg-surface-hover leading-5 select-text cursor-text">
              <Ansi>{filtered[index]!}</Ansi>
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
