import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId, to, subject, body } = await request.json() as {
    messageId: string;
    to:        string;
    subject:   string;
    body:      string;
  };

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  // Load Gmail OAuth token for this user
  const { data: profile } = await supabase
    .from("users")
    .select("gmail_token, email, name")
    .eq("id", user.id)
    .single();

  if (!profile?.gmail_token) {
    return NextResponse.json({ error: "Gmail not connected — add your Gmail OAuth token in Profile" }, { status: 400 });
  }

  let tokenData: { app_password?: string; access_token?: string; refresh_token?: string };
  try {
    tokenData = JSON.parse(profile.gmail_token) as typeof tokenData;
  } catch {
    return NextResponse.json({ error: "Invalid Gmail token format" }, { status: 400 });
  }

  let transporter: ReturnType<typeof nodemailer.createTransport>;

  if (tokenData.app_password) {
    // App Password SMTP (recommended — no OAuth setup needed)
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: profile.email, pass: tokenData.app_password },
    });
  } else if (tokenData.access_token) {
    // OAuth2 fallback
    let accessToken = tokenData.access_token;
    if (tokenData.refresh_token && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      try {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: tokenData.refresh_token,
            grant_type:    "refresh_token",
          }),
        });
        if (refreshRes.ok) {
          const refreshed = await refreshRes.json() as { access_token?: string };
          if (refreshed.access_token) {
            accessToken = refreshed.access_token;
            await supabase
              .from("users")
              .update({ gmail_token: JSON.stringify({ ...tokenData, access_token: accessToken }) })
              .eq("id", user.id);
          }
        }
      } catch { /* use existing token */ }
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2", user: profile.email, accessToken,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: tokenData.refresh_token,
      },
    });
  } else {
    return NextResponse.json({ error: "Gmail not connected — add your App Password in Profile" }, { status: 400 });
  }

  try {
    await transporter.sendMail({
      from:    `"${profile.name ?? "SCOUT"}" <${profile.email}>`,
      to,
      subject,
      text:    body,
      html:    body.replace(/\n/g, "<br>"),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }

  // Mark message as sent
  await supabase
    .from("messages")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", messageId);

  return NextResponse.json({ ok: true });
}
