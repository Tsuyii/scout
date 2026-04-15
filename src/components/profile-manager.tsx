"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ProfileForm } from "@/components/profile-form";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ProfileRow, UserRow } from "@/types/database";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

interface ProfileManagerProps {
  user: User;
  initialProfiles: ProfileRow[];
  userRow: UserRow | null;
}

export function ProfileManager({ user, initialProfiles, userRow }: ProfileManagerProps) {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<ProfileRow[]>(initialProfiles);
  // expandedId: a profile id, "new", or null
  const [expandedId, setExpandedId] = useState<string | null>(
    initialProfiles.length === 0 ? "new" : null
  );

  const [gmailAppPassword, setGmailAppPassword] = useState<string>(() => {
    try {
      const t = userRow?.gmail_token ? JSON.parse(userRow.gmail_token) as { app_password?: string } : null;
      return t?.app_password ?? "";
    } catch { return ""; }
  });
  const [savingGmail, setSavingGmail] = useState(false);
  const [savedGmail, setSavedGmail] = useState(false);

  async function saveGmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingGmail(true);
    await supabase.from("users").upsert({
      id: user.id,
      email: user.email!,
      gmail_token: gmailAppPassword ? JSON.stringify({ app_password: gmailAppPassword }) : null,
      updated_at: new Date().toISOString(),
    });
    setSavingGmail(false);
    setSavedGmail(true);
    setTimeout(() => setSavedGmail(false), 2000);
  }

  function handleSaved(saved: ProfileRow) {
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      let next = idx >= 0
        ? prev.map((p, i) => (i === idx ? saved : p))
        : [...prev, saved];
      // Keep is_default consistent client-side
      if (saved.is_default) next = next.map((p) => (p.id === saved.id ? p : { ...p, is_default: false }));
      return next;
    });
    // After creating new, expand the saved profile
    if (expandedId === "new") setExpandedId(saved.id);
  }

  function handleDeleted(id: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setExpandedId(null);
  }

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-8">
      {/* ── Gmail (global) ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
          <span className="text-neon">01</span> — Gmail
        </h2>
        <form onSubmit={saveGmail} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              App Password
            </Label>
            <Input
              type="password"
              value={gmailAppPassword}
              onChange={(e) => setGmailAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30"
            />
            <p className="text-xs font-mono text-muted-foreground">
              Generate at{" "}
              <span className="text-neon">myaccount.google.com → Security → App Passwords</span>
              {" "}(requires 2FA).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={savingGmail}
              className="bg-neon text-background font-mono font-semibold text-sm hover:bg-neon/90 glow-neon-sm"
            >
              {savingGmail ? "SAVING..." : savedGmail ? "SAVED ✓" : "SAVE GMAIL →"}
            </Button>
          </div>
        </form>
      </section>

      <Separator className="bg-border" />

      {/* ── Profiles ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <span className="text-neon">02</span> — Profiles
          </h2>
          <button
            type="button"
            onClick={() => setExpandedId("new")}
            className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-neon transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Profile
          </button>
        </div>

        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="border border-border">
              {/* Card header */}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm text-foreground truncate">{p.label}</span>
                  {p.is_default && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-neon border border-neon/40 px-1.5 py-0.5 shrink-0">
                      default
                    </span>
                  )}
                  {p.skills.length > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground/60 truncate hidden sm:block">
                      {p.skills.slice(0, 4).join(" · ")}
                    </span>
                  )}
                </div>
                {expandedId === p.id
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                }
              </button>

              {/* Expanded form */}
              {expandedId === p.id && (
                <div className="border-t border-border px-4 pb-6">
                  <ProfileForm
                    userId={user.id}
                    profile={p}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                    onCancel={() => setExpandedId(null)}
                    canDelete={profiles.length > 1}
                  />
                </div>
              )}
            </div>
          ))}

          {/* New profile form */}
          {expandedId === "new" && (
            <div className="border border-neon/40 bg-neon/5">
              <div className="px-4 py-3 border-b border-neon/20">
                <span className="font-mono text-xs text-neon uppercase tracking-widest">New Profile</span>
              </div>
              <div className="px-4 pb-6">
                <ProfileForm
                  userId={user.id}
                  profile={null}
                  onSaved={handleSaved}
                  onDeleted={handleDeleted}
                  onCancel={() => setExpandedId(null)}
                />
              </div>
            </div>
          )}

          {profiles.length === 0 && expandedId !== "new" && (
            <p className="text-xs font-mono text-muted-foreground/60 py-4 text-center border border-dashed border-border">
              No profiles yet.{" "}
              <button
                type="button"
                onClick={() => setExpandedId("new")}
                className="text-neon hover:underline"
              >
                Create one
              </button>{" "}
              to use in campaigns.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
