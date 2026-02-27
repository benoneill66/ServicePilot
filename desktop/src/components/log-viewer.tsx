import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import Ansi from "ansi-to-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { detectLogLevel, stripAnsi, type LogLevel } from "../utils/log-levels";

interface Props {
  serviceName: string;
  serviceColor: string;
  lines: string[];
  onClear?: () => void;
  hideHeader?: boolean;
}

export function LogViewer({ serviceName, serviceColor, lines, onClear, hideHeader }: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const [enabledLevels, setEnabledLevels] = useState<Record<LogLevel, boolean>>({
    error: true,
    warn: true,
    info: true,
    debug: true,
  });

  const toggleLevel = useCallback((level: LogLevel) => {
    setEnabledLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  }, []);

  const leveledLines = useMemo(
    () => lines.map((text) => ({ text, level: detectLogLevel(text) })),
    [lines]
  );

  const filtered = useMemo(() => {
    let result = leveledLines;
    // Level filter
    const anyDisabled = Object.values(enabledLevels).some((v) => !v);
    if (anyDisabled) {
      result = result.filter(
        (l) => l.level === null || enabledLevels[l.level]
      );
    }
    // Text search filter
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter((l) =>
        stripAnsi(l.text).toLowerCase().includes(lower)
      );
    }
    return result;
  }, [leveledLines, enabledLevels, filter]);

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
    navigator.clipboard.writeText(filtered.map(l => l.text).join("\n")).then(() => {
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
        {!hideHeader && (
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="font-bold" style={{ color: serviceColor }}>
              {serviceName}
            </span>
            <span className="text-text-dim">— logs</span>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center text-text-dim">
          No output yet...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        {!hideHeader && (
          <>
            <span className="font-bold" style={{ color: serviceColor }}>
              {serviceName}
            </span>
            <span className="text-text-dim">— logs</span>
          </>
        )}
        <div className="flex items-center gap-1 ml-2">
          {(["error", "warn", "info", "debug"] as LogLevel[]).map((level) => {
            const enabled = enabledLevels[level];
            const colors: Record<LogLevel, string> = {
              error: "text-red border-red",
              warn: "text-yellow border-yellow",
              info: "text-accent border-accent",
              debug: "text-text-dim border-text-dim",
            };
            const labels: Record<LogLevel, string> = {
              error: "ERR",
              warn: "WARN",
              info: "INFO",
              debug: "DBG",
            };
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                  enabled
                    ? `${colors[level]} bg-transparent`
                    : "text-text-dim/40 border-text-dim/20 line-through"
                }`}
              >
                {labels[level]}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-text-dim ml-auto">
          {filter || Object.values(enabledLevels).some((v) => !v)
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
          itemContent={(index) => {
            const { text, level } = filtered[index]!;
            const borderClass =
              level === "error"
                ? "border-l-3 border-l-red bg-red/5"
                : level === "warn"
                  ? "border-l-3 border-l-yellow bg-yellow/5"
                  : level === "debug"
                    ? "border-l-3 border-l-text-dim"
                    : "";
            return (
              <div
                className={`px-4 py-px hover:bg-surface-hover leading-5 select-text cursor-text ${borderClass}`}
              >
                <Ansi>{text}</Ansi>
              </div>
            );
          }}
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
