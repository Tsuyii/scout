export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewPanel } from "@/components/review-panel";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!campaign) redirect("/campaigns");

  // Load companies with their contacts and messages
  const { data: companies } = await supabase
    .from("companies")
    .select(`
      *,
      contacts (
        *,
        messages (*)
      )
    `)
    .eq("campaign_id", id)
    .order("discovered_at", { ascending: true });

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-neon text-glow font-heading font-black text-xl">/</span>
          <h1 className="text-xl font-heading font-black">Review & Send</h1>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
          {campaign.location} · {campaign.fields.join(", ")} · {companies?.length ?? 0} companies
        </p>
      </div>

      <ReviewPanel
        campaignId={id}
        initialCompanies={companies ?? []}
      />
    </div>
  );
}
