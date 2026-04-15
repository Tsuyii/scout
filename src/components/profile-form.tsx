"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CvUpload, type ExtractedProfile } from "@/components/cv-upload";
import { SkillTags } from "@/components/skill-tags";
import { Separator } from "@/components/ui/separator";
import type { ProfileRow } from "@/types/database";

interface ProfileFormProps {
  userId: string;
  profile: ProfileRow | null; // null = creating new
  onSaved: (profile: ProfileRow) => void;
  onDeleted?: (id: string) => void;
  onCancel?: () => void;
  canDelete?: boolean;
}

export function ProfileForm({ userId, profile, onSaved, onDeleted, onCancel, canDelete }: ProfileFormProps) {
  const supabase = createClient();

  const [label, setLabel] = useState(profile?.label ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [education, setEducation] = useState(profile?.education ?? "");
  const [experience, setExperience] = useState(profile?.experience ?? "");
  const [availability, setAvailability] = useState(profile?.availability ?? "");
  const [cvUrl, setCvUrl] = useState<string | null>(profile?.cv_url ?? null);
  const [isDefault, setIsDefault] = useState(profile?.is_default ?? false);
  const [autoFill, setAutoFill] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleCvExtracted(url: string, extracted: ExtractedProfile | null) {
    setCvUrl(url);
    if (!autoFill || !extracted) return;
    if (extracted.name) setName(extracted.name);
    if (extracted.skills?.length) setSkills(extracted.skills);
    if (extracted.education) setEducation(extracted.education);
    if (extracted.experience) setExperience(extracted.experience);
    if (extracted.availability) setAvailability(extracted.availability);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const now = new Date().toISOString();

    if (profile?.id) {
      // If setting as default, clear other profiles first
      if (isDefault) {
        await supabase.from("profiles").update({ is_default: false }).eq("user_id", userId).neq("id", profile.id);
      }
      const { data } = await supabase
        .from("profiles")
        .update({ label: label || "Profile", name, skills, education, experience, availability, cv_url: cvUrl, is_default: isDefault, updated_at: now })
        .eq("id", profile.id)
        .select()
        .single();
      if (data) onSaved(data as ProfileRow);
    } else {
      if (isDefault) {
        await supabase.from("profiles").update({ is_default: false }).eq("user_id", userId);
      }
      const { data } = await supabase
        .from("profiles")
        .insert({ user_id: userId, label: label || "New Profile", name, skills, education, experience, availability, cv_url: cvUrl, is_default: isDefault, created_at: now, updated_at: now })
        .select()
        .single();
      if (data) onSaved(data as ProfileRow);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete() {
    if (!profile?.id) return;
    setDeleting(true);
    await supabase.from("profiles").delete().eq("id", profile.id);
    onDeleted?.(profile.id);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pt-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Profile Name
        </Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. SWE Focus, ML Research, Default"
          className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30"
        />
      </div>

      <Separator className="bg-border" />

      {/* CV Upload */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <span className="text-neon">CV</span> / Resume
          </h3>
          <button
            type="button"
            onClick={() => setAutoFill((v) => !v)}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{autoFill ? "AI AUTO-FILL ON" : "AI AUTO-FILL OFF"}</span>
            <div className={["w-8 h-4 rounded-full transition-colors relative", autoFill ? "bg-neon/80" : "bg-border"].join(" ")}>
              <div className={["absolute top-0.5 w-3 h-3 rounded-full bg-background transition-all", autoFill ? "left-[18px]" : "left-0.5"].join(" ")} />
            </div>
          </button>
        </div>
        <CvUpload currentUrl={cvUrl} onUploadComplete={handleCvExtracted} />
      </section>

      {/* Basic info */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Availability</Label>
          <Input
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="e.g. June–September 2026, full-time"
            className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30"
          />
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Skills</Label>
        <SkillTags skills={skills} onChange={setSkills} />
      </div>

      {/* Background */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Education</Label>
          <Textarea
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder="e.g. 3rd year CS student at École Polytechnique..."
            rows={2}
            className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Experience</Label>
          <Textarea
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="e.g. Built X at Y, contributed to Z open source project..."
            rows={3}
            className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 resize-none"
          />
        </div>
      </div>

      {/* Default toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => setIsDefault((v) => !v)}
          className={["w-8 h-4 rounded-full transition-colors relative cursor-pointer", isDefault ? "bg-neon/80" : "bg-border"].join(" ")}
        >
          <div className={["absolute top-0.5 w-3 h-3 rounded-full bg-background transition-all", isDefault ? "left-[18px]" : "left-0.5"].join(" ")} />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Default profile for new campaigns
        </span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={saving}
          className="bg-neon text-background font-mono font-semibold text-sm hover:bg-neon/90 glow-neon-sm"
        >
          {saving ? "SAVING..." : saved ? "SAVED ✓" : profile?.id ? "SAVE →" : "CREATE →"}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            cancel
          </button>
        )}
        {canDelete && profile?.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto text-xs font-mono text-destructive/70 hover:text-destructive transition-colors"
          >
            {deleting ? "deleting..." : "delete profile"}
          </button>
        )}
      </div>
    </form>
  );
}
