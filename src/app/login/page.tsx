"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-heading font-black text-neon text-glow tracking-wider">
            SCOUT
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-mono tracking-widest uppercase">
            AI Internship Outreach
          </p>
        </div>

        {/* Card */}
        <div className="neon-frame p-6">
          <div className="mb-6">
            <h2 className="text-lg font-heading font-bold text-foreground">Sign in</h2>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-neon">_</span> Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 placeholder:text-muted-foreground/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-input border-border font-mono text-sm focus:border-neon focus:ring-1 focus:ring-neon/30 placeholder:text-muted-foreground/40"
              />
            </div>

            {error && (
              <p className="text-xs font-mono text-destructive border border-destructive/20 bg-destructive/5 px-3 py-2">
                <span className="text-destructive">ERR</span> {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-neon text-background font-mono font-semibold text-sm hover:bg-neon/90 glow-neon-sm transition-all"
            >
              {loading ? "AUTHENTICATING..." : "SIGN IN →"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs font-mono text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-neon hover:text-glow transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
