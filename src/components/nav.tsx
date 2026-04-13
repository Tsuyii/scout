"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Briefcase, LogOut, Zap } from "lucide-react";

const navItems = [
  { href: "/profile", label: "PROFILE", icon: User },
  { href: "/campaigns", label: "CAMPAIGNS", icon: Briefcase },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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
      <div className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 px-3 py-2 text-xs font-mono tracking-widest transition-all",
                active
                  ? "text-neon bg-neon/5 border-l-2 border-neon pl-[10px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface border-l-2 border-transparent pl-[10px]",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
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
