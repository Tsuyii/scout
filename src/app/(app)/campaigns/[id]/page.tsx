import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!campaign) redirect("/campaigns");

  if (campaign.status === "running") {
    redirect(`/campaigns/${id}/discover`);
  } else {
    redirect(`/campaigns/${id}/review`);
  }
}
