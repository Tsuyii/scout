"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Zap, Sliders, Plus, User } from "lucide-react";
import type { ProfileRow } from "@/types/database";

const FIELD_OPTIONS = ["SWE", "DS/ML", "Backend", "Frontend", "Research", "DevOps"];
const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
];

interface CampaignFormProps {
  profiles: ProfileRow[];
}

export function CampaignForm({ profiles }: CampaignFormProps) {
  const router = useRouter();
  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0];

  const [profileId, setProfileId] = useState<string>(defaultProfile?.id ?? "");
  const [location, setLocation] = useState("");
  const [fields, setFields] = useState<string[]>(["SWE"]);
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [mode, setMode] = useState<"active" | "hybrid">("hybrid");
  const [targetCount, setTargetCount] = useState(20);
  const [manualCompanies, setManualCompanies] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleField(f: string) {
    setFields((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) { setError("Location is required."); return; }
    if (fields.length === 0) { setError("Select at least one field."); return; }

    setLoading(true);
    setError("");

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: location.trim(),
        fields,
        languages,
        mode,
        target_count: targetCount,
        profile_id: profileId || null,
        manual_companies: manualCompanies
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create campaign.");
      setLoading(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/campaigns/${id}/discover`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Profile selector */}
      {profiles.length > 0 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground tracking-widest uppercase">
            <User className="w-3.5 h-3.5" />
            Profile
          </label>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProfileId(p.id)}
                className={[
                  "px-3 py-1.5 font-mono text-xs tracking-wider border transition-all",
                  profileId === p.id
                    ? "border-neon bg-neon/10 text-neon glow-neon-sm"
                    : "border-border text-muted-foreground hover:border-neon/40 hover:text-foreground",
                ].join(" ")}
              >
                {p.label}
                {p.is_default && <span className="ml-1.5 opacity-50">★</span>}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground/50">
            SCOUT uses this profile when drafting outreach.
          </p>
        </div>
      )}

      {/* Location */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground tracking-widest uppercase">
          <MapPin className="w-3.5 h-3.5" />
          Location
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Paris, France — or — Remote"
          className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/60 transition-colors"
        />
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground tracking-widest uppercase">
          <Zap className="w-3.5 h-3.5" />
          Fields
        </label>
        <div className="flex flex-wrap gap-2">
          {FIELD_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggleField(f)}
              className={[
                "px-3 py-1.5 font-mono text-xs tracking-wider border transition-all",
                fields.includes(f)
                  ? "border-neon bg-neon/10 text-neon glow-neon-sm"
                  : "border-border text-muted-foreground hover:border-neon/40 hover:text-foreground",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-3">
        <label className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          Draft Languages
        </label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleLanguage(code)}
              className={[
                "px-3 py-1.5 font-mono text-xs tracking-wider border transition-all",
                languages.includes(code)
                  ? "border-neon bg-neon/10 text-neon"
                  : "border-border text-muted-foreground hover:border-neon/40 hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/50">
          SCOUT will write emails in the company&apos;s primary language.
        </p>
      </div>

      {/* Mode */}
      <div className="space-y-3">
        <label className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          Discovery Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(["active", "hybrid"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                "p-3 border text-left transition-all",
                mode === m
                  ? "border-neon bg-neon/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-neon/30",
              ].join(" ")}
            >
              <div className="font-mono text-xs font-bold tracking-widest uppercase mb-1">
                {m === "active" ? "Active Only" : "Hybrid ★"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
                {m === "active"
                  ? "Job boards only — companies actively hiring"
                  : "Job boards + AI cold search — max coverage"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Target count */}
      <div className="space-y-3">
        <label className="flex items-center justify-between font-mono text-xs text-muted-foreground tracking-widest uppercase">
          <span className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5" />
            Target Companies
          </span>
          <span className="text-neon font-bold">{targetCount}</span>
        </label>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={targetCount}
          onChange={(e) => setTargetCount(Number(e.target.value))}
          className="w-full accent-neon"
        />
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground/40">
          <span>5</span>
          <span>50</span>
        </div>
      </div>

      {/* Manual companies */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground tracking-widest uppercase">
          <Plus className="w-3.5 h-3.5" />
          Manual Companies
          <span className="text-muted-foreground/40 normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          value={manualCompanies}
          onChange={(e) => setManualCompanies(e.target.value)}
          placeholder={"Stripe\nMistral AI\nHugging Face"}
          rows={4}
          className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-neon/60 transition-colors resize-none"
        />
        <p className="font-mono text-[10px] text-muted-foreground/50">
          One per line. SCOUT will find contacts and draft messages for these too.
        </p>
      </div>

      {error && (
        <p className="font-mono text-xs text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-neon text-background font-mono text-sm font-bold tracking-widest hover:bg-neon/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors glow-neon-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⟳</span> LAUNCHING...
          </span>
        ) : (
          "LAUNCH CAMPAIGN →"
        )}
      </button>
    </form>
  );
}
