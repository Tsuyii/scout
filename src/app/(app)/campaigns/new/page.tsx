export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignForm } from "@/components/campaign-form";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-black text-foreground">
          <span className="text-neon text-glow">/</span> New Campaign
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Configure your target and SCOUT will find companies + draft outreach.
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
