export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-black text-foreground">
          <span className="text-neon text-glow">/</span> Profile
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Your CV and skills power every outreach campaign.
        </p>
      </div>

      <ProfileForm user={user} initialProfile={profile} />
    </div>
  );
}
