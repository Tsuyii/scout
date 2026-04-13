"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SkillTagsProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

export function SkillTags({ skills, onChange }: SkillTagsProps) {
  const [input, setInput] = useState("");

  function addSkill() {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInput("");
  }

  function removeSkill(skill: string) {
    onChange(skills.filter((s) => s !== skill));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill();
    }
    if (e.key === "Backspace" && input === "" && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-neon border border-neon/30 bg-neon/5"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="text-neon/60 hover:text-neon transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addSkill}
        placeholder="Type a skill and press Enter..."
        className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 placeholder:text-muted-foreground/40"
      />
      <p className="text-[10px] font-mono text-muted-foreground/50">
        Press Enter or comma to add. Backspace to remove last.
      </p>
    </div>
  );
}
