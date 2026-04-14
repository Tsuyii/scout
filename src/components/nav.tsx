"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Briefcase, LogOut, Zap, Circle } from "lucide-react";

type Campaign = { id: string; location: string; fields: string[]; status: string };

const STATUS_DOT: Record<string, string> = {
  running:  "text-yellow-400",
  complete: "text-neon",
  paused:   "text-muted-foreground",
};

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const onCampaigns = pathname.startsWith("/campaigns");

  useEffect(() => {
    if (!onCampaigns) return;
    supabase
      .from("campaigns")
      .select("id, location, fields, status")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setCampaigns((data as Campaign[]) ?? []));
  }, [onCampaigns]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-neon" strokeWidth={2.5} />
          <span className="text-lg font-heading font-black text-neon text-glow tracking-widest">
            SCOUT
          </span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/60 tracking-widest uppercase mt-0.5 pl-6">
          AI Outreach
        </p>
      </div>

      {/* Nav links */}
      <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {/* Profile */}
        {(() => {
          const active = pathname.startsWith("/profile");
          return (
            <Link
              href="/profile"
              className={[
                "flex items-center gap-3 px-3 py-2 text-xs font-mono tracking-widest transition-all",
                active
                  ? "text-neon bg-neon/5 border-l-2 border-neon pl-[10px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface border-l-2 border-transparent pl-[10px]",
              ].join(" ")}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              PROFILE
            </Link>
          );
        })()}

        {/* Campaigns + sub-items */}
        {(() => {
          const active = onCampaigns;
          return (
            <>
              <Link
                href="/campaigns"
                className={[
                  "flex items-center gap-3 px-3 py-2 text-xs font-mono tracking-widest transition-all",
                  active
                    ? "text-neon bg-neon/5 border-l-2 border-neon pl-[10px]"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface border-l-2 border-transparent pl-[10px]",
                ].join(" ")}
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                CAMPAIGNS
              </Link>

              {active && campaigns.length > 0 && (
                <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5">
                  {campaigns.map((c) => {
                    const href = c.status === "complete"
                      ? `/campaigns/${c.id}/review`
                      : `/campaigns/${c.id}/discover`;
                    const isCurrent = pathname.startsWith(`/campaigns/${c.id}`);
                    const dotColor = STATUS_DOT[c.status] ?? "text-muted-foreground";
                    return (
                      <Link
                        key={c.id}
                        href={href}
                        className={[
                          "flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono tracking-wide transition-all rounded-sm",
                          isCurrent
                            ? "text-neon bg-neon/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface",
                        ].join(" ")}
                      >
                        <Circle className={`w-1.5 h-1.5 shrink-0 fill-current ${dotColor}`} />
                        <span className="truncate">
                          {c.location} · {c.fields[0]}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Sign out */}
      <div className="p-2 border-t border-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono text-muted-foreground hover:text-destructive tracking-widest transition-colors border-l-2 border-transparent pl-[10px]"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          SIGN OUT
        </button>
      </div>
    </nav>
  );
}
