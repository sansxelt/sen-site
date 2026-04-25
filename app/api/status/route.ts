import { NextResponse } from "next/server";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../lib/supabase-admin";

export async function GET() {
  const dbConfigured = isDatabaseConfigured();
  const authConfigured = Boolean(process.env.AUTH_SECRET);
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
  });
}
