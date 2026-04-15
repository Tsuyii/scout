import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/campaigns — list user's campaigns
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/campaigns — create a campaign and kick off discovery
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    location: string;
    fields: string[];
    languages?: string[];
    mode: "active" | "hybrid";
    target_count: number;
    profile_id?: string | null;
    manual_companies?: string[];
  };

  if (!body.location?.trim()) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }
  if (!body.fields?.length) {
    return NextResponse.json({ error: "fields are required" }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      user_id:      user.id,
      profile_id:   body.profile_id ?? null,
      location:     body.location.trim(),
      fields:       body.fields,
      languages:    body.languages ?? ["en"],
      mode:         body.mode ?? "hybrid",
      target_count: body.target_count ?? 20,
      status:       "running",
    })
    .select()
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: error?.message ?? "Failed to create campaign" }, { status: 500 });
  }

  // If manual companies were provided, pre-populate them
  if (body.manual_companies?.length) {
    const rows = body.manual_companies.map((name) => ({
      campaign_id: campaign.id,
      name,
      source: "cold_search" as const,
    }));
    await supabase.from("companies").insert(rows);
  }

  return NextResponse.json({ id: campaign.id });
}
