"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Mail, Link2, Copy, ExternalLink, RefreshCw,
  Send, CheckCircle, Clock, XCircle, ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  platform: "email" | "linkedin";
  language: string;
  subject: string | null;
  body: string;
  status: "draft" | "sent" | "skipped" | "failed";
}

interface Contact {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  confidence_score: number | null;
  type: "founder" | "cto" | "engineer" | "recruiter";
  messages: Message[];
}

interface Company {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  source: "job_board" | "cold_search";
  contacts: Contact[];
}

interface ReviewPanelProps {
  campaignId: string;
  initialCompanies: Company[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function companyStatus(company: Company): "ready" | "pending" | "sent" | "skipped" {
  const messages = company.contacts.flatMap((c) => c.messages);
  if (messages.length === 0) return "pending";
  if (messages.every((m) => m.status === "sent")) return "sent";
  if (messages.some((m) => m.status === "draft")) return "ready";
  return "skipped";
}

const STATUS_CONFIG = {
  ready:   { label: "Draft Ready", icon: CheckCircle, color: "text-neon" },
  pending: { label: "Pending",     icon: Clock,       color: "text-muted-foreground" },
  sent:    { label: "Sent",        icon: Send,         color: "text-green-400" },
  skipped: { label: "Skipped",    icon: XCircle,      color: "text-muted-foreground/40" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewPanel({ campaignId, initialCompanies }: ReviewPanelProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCompanies[0]?.id ?? null
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [activePlatform, setActivePlatform] = useState<"email" | "linkedin">("email");
  const [editingBody, setEditingBody] = useState<string>("");
  const [editingSubject, setEditingSubject] = useState<string>("");
  const [bodyEdited, setBodyEdited] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedCompany = companies.find((c) => c.id === selectedId) ?? null;
  const selectedContact = selectedCompany?.contacts[0] ?? null;
  const activeMessage = selectedContact?.messages.find((m) => m.platform === activePlatform) ?? null;

  // When selecting a new company, load its message into the editor
  const selectCompany = useCallback((company: Company) => {
    setSelectedId(company.id);
    setBodyEdited(false);
    const contact = company.contacts[0];
    const msg = contact?.messages.find((m) => m.platform === activePlatform);
    setEditingBody(msg?.body ?? "");
    setEditingSubject(msg?.subject ?? "");
  }, [activePlatform]);

  // When switching platform tabs
  function switchPlatform(platform: "email" | "linkedin") {
    setActivePlatform(platform);
    setBodyEdited(false);
    const msg = selectedContact?.messages.find((m) => m.platform === platform);
    setEditingBody(msg?.body ?? "");
    setEditingSubject(msg?.subject ?? "");
  }

  // Sync editor when active message changes (e.g. on first load or company switch)
  useEffect(() => {
    if (activeMessage && !bodyEdited) {
      setEditingBody(activeMessage.body);
      setEditingSubject(activeMessage.subject ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessage?.id]);

  async function handleRegenerate() {
    if (!selectedCompany || !selectedContact) return;
    setRegenerating(true);
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        contactId: selectedContact.id,
        platform: activePlatform,
        regenerate: true,
      }),
    });
    if (res.ok) {
      const { subject, body, messageId } = await res.json();
      setEditingBody(body);
      setEditingSubject(subject ?? "");
      setBodyEdited(false);
      updateMessage(selectedContact.id, messageId, { body, subject, status: "draft" });
    }
    setRegenerating(false);
  }

  async function handleSave() {
    if (!activeMessage) return;
    await fetch(`/api/messages/${activeMessage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingBody, subject: editingSubject }),
    });
    setBodyEdited(false);
    updateMessage(selectedContact!.id, activeMessage.id, {
      body: editingBody,
      subject: editingSubject,
    });
  }

  async function handleSendEmail() {
    if (!activeMessage || !selectedContact?.email) return;
    setSending(activeMessage.id);
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: activeMessage.id,
        to: selectedContact.email,
        subject: editingSubject,
        body: editingBody,
      }),
    });
    if (res.ok) {
      updateMessage(selectedContact.id, activeMessage.id, { status: "sent" });
    }
    setSending(null);
  }

  function handleCopyLinkedIn() {
    navigator.clipboard.writeText(editingBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (selectedContact?.linkedin_url) {
      window.open(selectedContact.linkedin_url, "_blank");
    }
  }

  function updateMessage(contactId: string, messageId: string, patch: Partial<Message>) {
    setCompanies((prev) =>
      prev.map((co) => ({
        ...co,
        contacts: co.contacts.map((ct) =>
          ct.id === contactId
            ? {
                ...ct,
                messages: ct.messages.map((m) =>
                  m.id === messageId ? { ...m, ...patch } : m
                ),
              }
            : ct
        ),
      }))
    );
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllReady() {
    const readyIds = companies
      .filter((c) => companyStatus(c) === "ready")
      .map((c) => c.id);
    setCheckedIds(new Set(readyIds));
  }

  async function handleBulkSend() {
    setBulkSending(true);
    for (const id of checkedIds) {
      const company = companies.find((c) => c.id === id);
      const contact = company?.contacts[0];
      const msg = contact?.messages.find((m) => m.platform === "email");
      if (!msg || !contact?.email) continue;
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg.id,
          to: contact.email,
          subject: msg.subject,
          body: msg.body,
        }),
      });
      updateMessage(contact.id, msg.id, { status: "sent" });
    }
    setCheckedIds(new Set());
    setBulkSending(false);
  }

  const readyCount = companies.filter((c) => companyStatus(c) === "ready").length;
  const sentCount  = companies.filter((c) => companyStatus(c) === "sent").length;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: company list ───────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Summary */}
        <div className="px-4 py-3 border-b border-border flex gap-4 font-mono text-[10px]">
          <span className="text-neon">{readyCount} ready</span>
          <span className="text-green-400">{sentCount} sent</span>
          <span className="text-muted-foreground/50">{companies.length} total</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {companies.length === 0 ? (
            <div className="p-6 text-center font-mono text-xs text-muted-foreground/50">
              No companies found yet.
            </div>
          ) : (
            companies.map((company) => {
              const status = companyStatus(company);
              const meta = STATUS_CONFIG[status];
              const StatusIcon = meta.icon;
              const isSelected = company.id === selectedId;

              return (
                <div
                  key={company.id}
                  onClick={() => selectCompany(company)}
                  className={[
                    "flex items-center gap-2 px-3 py-3 cursor-pointer border-b border-border/50 transition-colors",
                    isSelected ? "bg-neon/5 border-l-2 border-l-neon" : "hover:bg-surface border-l-2 border-l-transparent",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(company.id)}
                    onChange={() => toggleCheck(company.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-neon shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-foreground truncate font-medium">
                      {company.name}
                    </div>
                    <div className={`flex items-center gap-1 mt-0.5 ${meta.color}`}>
                      <StatusIcon className="w-2.5 h-2.5 shrink-0" />
                      <span className="font-mono text-[9px] tracking-wider">{meta.label.toUpperCase()}</span>
                    </div>
                  </div>
                  {isSelected && <ChevronRight className="w-3 h-3 text-neon shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: draft editor ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedCompany && selectedContact ? (
          <>
            {/* Contact card */}
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-8 h-8 bg-neon/10 border border-neon/30 flex items-center justify-center font-mono text-sm font-bold text-neon shrink-0">
                    {(selectedContact.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {selectedContact.name ?? "Unknown"}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {selectedContact.role} · {selectedContact.type.toUpperCase()} · {selectedCompany.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {selectedContact.email && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-neon/70">
                      <Mail className="w-3 h-3" />
                      {selectedContact.email}
                      {selectedContact.confidence_score != null && (
                        <span className="text-muted-foreground/50 ml-1">
                          ({selectedContact.confidence_score}%)
                        </span>
                      )}
                    </span>
                  )}
                  {selectedContact.linkedin_url && (
                    <a
                      href={selectedContact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-neon transition-colors"
                    >
                      <Link2 className="w-3 h-3" />
                      LinkedIn
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
              {selectedCompany.website && (
                <a
                  href={selectedCompany.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-muted-foreground/50 hover:text-neon flex items-center gap-1 transition-colors shrink-0"
                >
                  {selectedCompany.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            {/* Platform tabs */}
            <div className="flex border-b border-border shrink-0">
              {(["email", "linkedin"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => switchPlatform(p)}
                  className={[
                    "flex items-center gap-2 px-5 py-3 font-mono text-xs tracking-widest border-b-2 transition-colors",
                    activePlatform === p
                      ? "border-neon text-neon"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {p === "email" ? <Mail className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  {p.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {activeMessage ? (
                <>
                  {activePlatform === "email" && (
                    <div>
                      <label className="font-mono text-[10px] text-muted-foreground/60 tracking-widest mb-1.5 block">
                        SUBJECT
                      </label>
                      <input
                        type="text"
                        value={editingSubject}
                        onChange={(e) => { setEditingSubject(e.target.value); setBodyEdited(true); }}
                        className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-neon/60 transition-colors"
                      />
                    </div>
                  )}
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground/60 tracking-widest mb-1.5 block">
                      {activePlatform === "email" ? "BODY" : "MESSAGE"}
                    </label>
                    <textarea
                      value={editingBody}
                      onChange={(e) => { setEditingBody(e.target.value); setBodyEdited(true); }}
                      rows={activePlatform === "email" ? 12 : 6}
                      className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:border-neon/60 transition-colors resize-none leading-relaxed"
                    />
                    {activePlatform === "linkedin" && (
                      <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
                        Max 300 chars · {editingBody.length}/300
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="font-mono text-sm text-muted-foreground/50">
                    No {activePlatform} draft yet.
                  </p>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="mt-4 px-4 py-2 border border-neon/40 text-neon font-mono text-xs hover:bg-neon/5 transition-colors"
                  >
                    Generate Draft
                  </button>
                </div>
              )}
            </div>

            {/* Action bar */}
            {activeMessage && (
              <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0 flex-wrap">
                {bodyEdited && (
                  <button
                    onClick={handleSave}
                    className="px-3 py-2 border border-border text-muted-foreground font-mono text-xs hover:text-foreground hover:border-neon/30 transition-colors"
                  >
                    Save
                  </button>
                )}
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border text-muted-foreground font-mono text-xs hover:text-foreground hover:border-neon/30 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${regenerating ? "animate-spin" : ""}`} />
                  Regenerate
                </button>

                <div className="flex-1" />

                {activePlatform === "email" ? (
                  <button
                    onClick={handleSendEmail}
                    disabled={!!sending || !selectedContact.email || activeMessage.status === "sent"}
                    className="flex items-center gap-2 px-5 py-2 bg-neon text-background font-mono text-xs font-bold tracking-widest hover:bg-neon/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors glow-neon-sm"
                  >
                    {sending === activeMessage.id ? (
                      <span className="animate-spin">⟳</span>
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {activeMessage.status === "sent" ? "SENT ✓" : "SEND EMAIL"}
                  </button>
                ) : (
                  <button
                    onClick={handleCopyLinkedIn}
                    className="flex items-center gap-2 px-5 py-2 bg-neon text-background font-mono text-xs font-bold tracking-widest hover:bg-neon/90 transition-colors glow-neon-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? "COPIED! ✓" : "COPY & OPEN PROFILE"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-sm text-muted-foreground/40">
              Select a company to review its draft.
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom bulk send bar ─────────────────────────────────────── */}
      {checkedIds.size > 0 && (
        <div className="fixed bottom-0 left-56 right-0 z-50 border-t border-neon/30 bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-4 animate-[fade-in_0.2s_ease-out]">
          <span className="font-mono text-xs text-muted-foreground">
            {checkedIds.size} selected
          </span>
          <button
            onClick={selectAllReady}
            className="font-mono text-xs text-neon hover:text-neon/70 transition-colors"
          >
            Select all ready ({readyCount})
          </button>
          <div className="flex-1" />
          <button
            onClick={handleBulkSend}
            disabled={bulkSending}
            className="flex items-center gap-2 px-5 py-2 bg-neon text-background font-mono text-xs font-bold tracking-widest hover:bg-neon/90 disabled:opacity-40 transition-colors glow-neon-sm"
          >
            {bulkSending ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            SEND SELECTED ({checkedIds.size})
          </button>
        </div>
      )}
    </div>
  );
}
