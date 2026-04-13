export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, Briefcase, CheckCircle, Loader2, PauseCircle } from "lucide-react";
import type { CampaignRow } from "@/types/database";

const STATUS_META: Record<CampaignRow["status"], { label: string; icon: typeof Loader2; color: string }> = {
  running:  { label: "Running",  icon: Loader2,      color: "text-neon" },
  complete: { label: "Complete", icon: CheckCircle,  color: "text-green-400" },
  paused:   { label: "Paused",   icon: PauseCircle,  color: "text-muted-foreground" },
};

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading font-black text-foreground">
            <span className="text-neon text-glow">/</span> Campaigns
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Each campaign targets a location + field combination.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-neon text-background font-mono text-xs font-bold tracking-widest hover:bg-neon/90 transition-colors glow-neon-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          NEW
        </Link>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="neon-frame p-12 text-center">
          <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
          <p className="font-mono text-sm text-muted-foreground">No campaigns yet.</p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">
            Create one to start discovering companies.
          </p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-neon text-background font-mono text-xs font-bold tracking-widest hover:bg-neon/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            NEW CAMPAIGN
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const meta = STATUS_META[c.status];
            const StatusIcon = meta.icon;
            const href = c.status === "running"
              ? `/campaigns/${c.id}/discover`
              : `/campaigns/${c.id}/review`;

            return (
              <Link
                key={c.id}
                href={href}
                className="block neon-frame p-4 hover:bg-neon/5 transition-colors animate-[fade-in_0.2s_ease-out]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-foreground font-semibold">
                        {c.location}
                      </span>
                      <span className="text-muted-foreground/40 font-mono text-xs">·</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.fields.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="font-mono text-[10px] text-muted-foreground/60 border border-border px-1.5 py-0.5">
                        {c.mode.toUpperCase()}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        TARGET {c.target_count} co.
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 shrink-0 ${meta.color}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${c.status === "running" ? "animate-spin" : ""}`} />
                    <span className="font-mono text-[10px] tracking-widest">{meta.label.toUpperCase()}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
