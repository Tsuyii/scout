import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    subject?: string | null;
    body?:    string;
    status?:  "draft" | "sent" | "skipped" | "failed";
  };

  // Verify ownership via campaign
  const { data: message } = await supabase
    .from("messages")
    .select("id, campaigns!inner(user_id)")
    .eq("id", id)
    .single();

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("messages")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
