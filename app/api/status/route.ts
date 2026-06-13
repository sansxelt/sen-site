import { NextResponse } from "next/server";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../lib/supabase-admin";

export async function GET() {
  const dbConfigured = isDatabaseConfigured();
  const authConfigured = Boolean(process.env.AUTH_SECRET);
  // Without ANTHROPIC_API_KEY the AI agent silently degrades to canned
  // replies (never qualifies, never raises payment), so surface it.
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  let dbConnected = false;

  if (dbConfigured) {
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from("user_profiles" as never)
        .select("email")
        .limit(1);
      dbConnected = !error;
    } catch {
      dbConnected = false;
    }
  }

  const healthy = dbConnected && authConfigured;

  return NextResponse.json({
    status: healthy ? "healthy" : "degraded",
    database: {
      configured: dbConfigured,
      connected: dbConnected,
    },
    auth: {
      configured: authConfigured,
    },
    ai: {
      configured: aiConfigured,
    },
  });
}
