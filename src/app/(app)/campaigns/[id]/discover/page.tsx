export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoveryTerminal } from "@/components/discovery-terminal";

export default async function DiscoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!campaign) redirect("/campaigns");

  // If already complete, go straight to review
  if (campaign.status === "complete") redirect(`/campaigns/${id}/review`);

  return (
    <div className="flex flex-col h-full min-h-screen px-6 py-8 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-neon text-glow font-heading font-black text-2xl">/</span>
          <h1 className="text-2xl font-heading font-black">Discovery</h1>
          <span className="ml-2 w-2 h-2 rounded-full bg-neon animate-[glow-pulse_2s_ease-in-out_infinite]" />
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {campaign.location} · {campaign.fields.join(", ")} · Target {campaign.target_count} companies
        </p>
      </div>

      <DiscoveryTerminal campaignId={id} targetCount={campaign.target_count} />
    </div>
  );
}
