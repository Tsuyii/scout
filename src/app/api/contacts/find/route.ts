import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, domain, firstName, lastName } = await request.json() as {
    companyId:  string;
    domain:     string;
    firstName:  string;
    lastName:   string;
  };

  const key = process.env.HUNTER_API_KEY;
  if (!key) return NextResponse.json({ error: "HUNTER_API_KEY not set" }, { status: 503 });

  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${key}`;

  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: "Hunter.io request failed" }, { status: 502 });

  const json = await res.json() as { data?: { email: string; score: number } };
  const email      = json.data?.email ?? null;
  const confidence = json.data?.score  ?? 0;

  if (email) {
    await supabase
      .from("contacts")
      .update({ email, confidence_score: confidence })
      .eq("id", companyId);
  }

  return NextResponse.json({ email, confidence });
}
