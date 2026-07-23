import { redirect } from "next/navigation";

export default async function LegacySignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callbackUrl: raw } = await searchParams;
  const callbackUrl = Array.isArray(raw) ? raw[0] : raw;

  const target = callbackUrl
    ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/signin";

  redirect(target);
}
