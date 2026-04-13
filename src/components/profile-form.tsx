"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CvUpload, type ExtractedProfile } from "@/components/cv-upload";
import { SkillTags } from "@/components/skill-tags";
import { Separator } from "@/components/ui/separator";
import type { UserRow } from "@/types/database";

interface ProfileFormProps {
  user: User;
  initialProfile: UserRow | null;
}

export function ProfileForm({ user, initialProfile }: ProfileFormProps) {
  const supabase = createClient();

  const [name, setName] = useState(initialProfile?.name ?? user.user_metadata?.name ?? "");
  const [skills, setSkills] = useState<string[]>(initialProfile?.skills ?? []);
  const [education, setEducation] = useState(initialProfile?.education ?? "");
  const [experience, setExperience] = useState(initialProfile?.experience ?? "");
  const [availability, setAvailability] = useState(initialProfile?.availability ?? "");
  const [cvUrl, setCvUrl] = useState<string | null>(initialProfile?.cv_url ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleCvExtracted(url: string, profile: ExtractedProfile) {
    setCvUrl(url);
    if (profile.name && !name) setName(profile.name);
    if (profile.skills?.length) setSkills(profile.skills);
    if (profile.education) setEducation(profile.education);
    if (profile.experience) setExperience(profile.experience);
    if (profile.availability) setAvailability(profile.availability);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await supabase.from("users").upsert({
      id: user.id,
      email: user.email!,
      name,
      skills,
      education,
      experience,
      availability,
      cv_url: cvUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* CV Upload */}
      <section>
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">
          <span className="text-neon">01</span> — CV / Resume
        </h2>
        <CvUpload currentUrl={cvUrl} onUploadComplete={handleCvExtracted} />
      </section>

      <Separator className="bg-border" />

      {/* Basic info */}
      <section>
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
          <span className="text-neon">02</span> — Basic Info
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Availability
            </Label>
            <Input
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g. June–September 2026, full-time"
              className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30"
            />
          </div>
        </div>
      </section>

      <Separator className="bg-border" />

      {/* Skills */}
      <section>
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
          <span className="text-neon">03</span> — Skills
        </h2>
        <SkillTags skills={skills} onChange={setSkills} />
      </section>

      <Separator className="bg-border" />

      {/* Education & Experience */}
      <section>
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
          <span className="text-neon">04</span> — Background
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Education
            </Label>
            <Textarea
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="e.g. 3rd year CS student at École Polytechnique..."
              rows={3}
              className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Experience
            </Label>
            <Textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. Built X at Y, contributed to Z open source project..."
              rows={4}
              className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="bg-neon text-background font-mono font-semibold text-sm hover:bg-neon/90 glow-neon-sm"
        >
          {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE PROFILE →"}
        </Button>
        {saved && (
          <span className="text-xs font-mono text-neon animate-fade-in">
            Profile updated
          </span>
        )}
      </div>
    </form>
  );
}
