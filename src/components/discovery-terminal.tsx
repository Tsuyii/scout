"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Mail, Link2 } from "lucide-react";

interface LogLine {
  id: number;
  text: string;
  type: "info" | "success" | "warn" | "error";
}

interface DiscoveredCompany {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  location: string | null;
  source: "job_board" | "cold_search";
  contact?: {
    name: string | null;
    role: string | null;
    email: string | null;
    linkedin_url: string | null;
  };
  draftReady: boolean;
}

interface DiscoveryTerminalProps {
  campaignId: string;
  targetCount: number;
}

const LINE_COLORS: Record<LogLine["type"], string> = {
  info:    "text-muted-foreground",
  success: "text-neon",
  warn:    "text-yellow-400",
  error:   "text-destructive",
};

export function DiscoveryTerminal({ campaignId, targetCount }: DiscoveryTerminalProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [companies, setCompanies] = useState<DiscoveredCompany[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const logId = useRef(0);
  const startTime = useRef<number>(Date.now());

  const addLog = useCallback((text: string, type: LogLine["type"] = "info") => {
    setLogs((prev) => [...prev, { id: logId.current++, text, type }]);
  }, []);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Start discovery
  useEffect(() => {
    if (started) return;
    setStarted(true);
    startTime.current = Date.now();
    addLog("Initializing SCOUT discovery engine...", "info");
    addLog(`Campaign ID: ${campaignId}`, "info");

    const run = async () => {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      if (!res.ok || !res.body) {
        addLog("Failed to start discovery. Check API keys in .env.local", "error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const event = JSON.parse(raw) as {
              type: "log" | "company" | "draft" | "done";
              text?: string;
              level?: LogLine["type"];
              company?: DiscoveredCompany;
            };

            if (event.type === "log" && event.text) {
              addLog(event.text, event.level ?? "info");
            } else if (event.type === "company" && event.company) {
              setCompanies((prev) => {
                if (prev.find((c) => c.id === event.company!.id)) return prev;
                return [...prev, event.company!];
              });
            } else if (event.type === "draft") {
              setDraftCount((n) => n + 1);
              setCompanies((prev) =>
                prev.map((c) =>
                  c.id === (event as { companyId?: string }).companyId
                    ? { ...c, draftReady: true }
                    : c
                )
              );
            } else if (event.type === "done") {
              addLog("Discovery complete.", "success");
              setDone(true);
            }
          } catch {
            // malformed line — skip
          }
        }
      }
      setDone(true);
    };

    run().catch((err) => {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
      setDone(true);
    });
  }, [campaignId, addLog, started]);

  const foundCount = companies.length;
  const progress = Math.min(100, Math.round((foundCount / targetCount) * 100));

  return (
    <div className="flex flex-col gap-6 flex-1">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Found", value: `${foundCount}/${targetCount}` },
          { label: "Drafts", value: String(draftCount) },
          { label: "Elapsed", value: `${elapsed}s` },
          { label: "Progress", value: `${progress}%` },
        ].map(({ label, value }) => (
          <div key={label} className="neon-frame px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground/60 tracking-widest mb-1">
              {label.toUpperCase()}
            </div>
            <div className="font-mono text-sm font-bold text-neon">{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-neon transition-all duration-500 glow-neon-sm"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Terminal log */}
      <div
        ref={logRef}
        className="neon-frame p-4 h-64 overflow-y-auto font-mono text-xs leading-relaxed"
      >
        <div className="mb-2 text-neon/60 text-[10px] tracking-widest">
          ── SCOUT TERMINAL ─────────────────────────────────
        </div>
        {logs.map((line) => (
          <div key={line.id} className={`${LINE_COLORS[line.type]} animate-[fade-in_0.1s_ease-out]`}>
            <span className="text-muted-foreground/30 select-none mr-2">›</span>
            {line.text}
          </div>
        ))}
        {!done && (
          <div className="text-neon/60 cursor-blink mt-1" />
        )}
      </div>

      {/* Company cards */}
      {companies.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[10px] text-muted-foreground/60 tracking-widest mb-3">
            ── DISCOVERED COMPANIES ────────────────────────────
          </div>
          {companies.map((company, i) => (
            <div
              key={company.id}
              className="neon-frame p-3 animate-[card-in_0.3s_ease-out_forwards]"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {company.name}
                    </span>
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                      company.source === "job_board"
                        ? "border-neon/30 text-neon/70"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}>
                      {company.source === "job_board" ? "JOB BOARD" : "COLD"}
                    </span>
                    {company.draftReady && (
                      <span className="font-mono text-[10px] text-neon bg-neon/10 px-1.5 py-0.5">
                        ✓ DRAFT READY
                      </span>
                    )}
                  </div>
                  {company.description && (
                    <p className="font-mono text-[11px] text-muted-foreground mt-1 line-clamp-1">
                      {company.description}
                    </p>
                  )}
                  {company.contact && (
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {company.contact.name && (
                        <span className="font-mono text-[10px] text-muted-foreground/70">
                          {company.contact.name} · {company.contact.role}
                        </span>
                      )}
                      {company.contact.email && (
                        <span className="flex items-center gap-1 font-mono text-[10px] text-neon/70">
                          <Mail className="w-2.5 h-2.5" />
                          {company.contact.email}
                        </span>
                      )}
                      {company.contact.linkedin_url && (
                        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60">
                          <Link2 className="w-2.5 h-2.5" />
                          LinkedIn
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground/40 hover:text-neon transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done CTA */}
      {done && (
        <div className="neon-frame p-6 text-center animate-[fade-in_0.3s_ease-out]">
          <p className="font-mono text-sm text-foreground mb-1">
            Discovery complete — <span className="text-neon font-bold">{foundCount} companies</span> found,{" "}
            <span className="text-neon font-bold">{draftCount} drafts</span> ready.
          </p>
          <p className="font-mono text-xs text-muted-foreground mb-5">
            Review and send your outreach messages.
          </p>
          <button
            onClick={() => router.push(`/campaigns/${campaignId}/review`)}
            className="px-6 py-2.5 bg-neon text-background font-mono text-sm font-bold tracking-widest hover:bg-neon/90 transition-colors glow-neon-sm"
          >
            REVIEW & SEND →
          </button>
        </div>
      )}
    </div>
  );
}
