import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  type DesktopAuthRequest,
  isRequestUsable,
} from "@/lib/desktop-auth";
import { DesktopApprovalCard } from "@/components/desktop-approval-card";

export const metadata: Metadata = {
  title: "Approve VRAELIS desktop",
  description:
    "Authorize the VRAELIS desktop app to sign in as your account.",
};

async function fetchRequest(
  requestId: string,
): Promise<DesktopAuthRequest | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("desktop_auth_requests" as never)
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) return null;
    return (data as unknown as DesktopAuthRequest) ?? null;
  } catch {
    return null;
  }
}

export default async function DesktopAuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestId = Array.isArray(params.request_id)
    ? params.request_id[0]
    : params.request_id;

  if (!requestId) {
    return (
      <DesktopAuthShell>
        <DesktopAuthMessage
          title="Missing request"
          body="This page should be opened from inside the VRAELIS desktop app."
        />
      </DesktopAuthShell>
    );
  }

  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    // Bounce through sign-in, then come back here with the same request_id
    const next = `/desktop-auth?request_id=${encodeURIComponent(requestId)}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(next)}`);
  }

  const req = await fetchRequest(requestId);

  if (!req) {
    return (
      <DesktopAuthShell>
        <DesktopAuthMessage
          title="Request not found"
          body="This sign-in link is invalid. Open the desktop app and try again."
        />
      </DesktopAuthShell>
    );
  }

  if (!isRequestUsable(req) || req.status === "redeemed") {
    return (
      <DesktopAuthShell>
        <DesktopAuthMessage
          title="Link expired"
          body="This sign-in link has already been used or has timed out. Open the desktop app and try again."
        />
      </DesktopAuthShell>
    );
  }

  if (req.status === "approved") {
    return (
      <DesktopAuthShell>
        <DesktopAuthMessage
          title="Already approved"
          body="The desktop app should already be signing you in. You can close this tab."
          deepLink={`VRAELIS://auth?request_id=${requestId}`}
        />
      </DesktopAuthShell>
    );
  }

  return (
    <DesktopAuthShell>
      <DesktopApprovalCard
        requestId={requestId}
        email={email}
        deviceLabel={req.device_label}
      />
    </DesktopAuthShell>
  );
}

function DesktopAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-12 pb-20 sm:px-6 sm:pt-16 sm:pb-24 lg:px-8">
      <div className="mx-auto max-w-md">{children}</div>
    </section>
  );
}

function DesktopAuthMessage({
  title,
  body,
  deepLink,
}: {
  title: string;
  body: string;
  deepLink?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
      <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
        VRAELIS desktop
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">{body}</p>
      {deepLink && (
        <a
          href={deepLink}
          className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Open desktop app
        </a>
      )}
    </div>
  );
}
