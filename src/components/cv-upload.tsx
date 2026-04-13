"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";

interface CvUploadProps {
  currentUrl: string | null;
  onUploadComplete: (url: string, extractedProfile: ExtractedProfile) => void;
}

export interface ExtractedProfile {
  name: string;
  skills: string[];
  education: string;
  experience: string;
  availability: string;
}

export function CvUpload({ currentUrl, onUploadComplete }: CvUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    const validTypes = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a PDF, DOC, or DOCX file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      return;
    }

    setError(null);
    setUploading(true);
    setProgress("Uploading CV...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/extract-cv", { method: "POST", body: formData });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
      setError(error || "Upload failed");
      setUploading(false);
      setProgress(null);
      return;
    }

    setProgress("Extracting profile with AI...");
    const { url, profile } = await res.json();
    onUploadComplete(url, profile);
    setUploading(false);
    setProgress(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "relative border-2 border-dashed p-8 text-center cursor-pointer transition-all",
          dragging
            ? "border-neon bg-neon/5"
            : uploading
            ? "border-border cursor-not-allowed opacity-60"
            : "border-border hover:border-neon/50 hover:bg-surface",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-neon animate-spin" />
            <p className="text-xs font-mono text-neon">{progress}</p>
          </div>
        ) : currentUrl ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-6 h-6 text-neon" />
            <p className="text-xs font-mono text-neon">CV uploaded — click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm font-mono text-muted-foreground">
              Drop CV here or <span className="text-neon">click to upload</span>
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
              PDF · DOC · DOCX · Max 10MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-mono text-destructive">
          <span className="text-destructive">ERR</span> {error}
        </p>
      )}
    </div>
  );
}
