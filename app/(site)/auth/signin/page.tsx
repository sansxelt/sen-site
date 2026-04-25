import { redirect } from "next/navigation";

export default function LegacySignInPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const callbackUrl = Array.isArray(searchParams.callbackUrl)
    ? searchParams.callbackUrl[0]
    : searchParams.callbackUrl;

  const target = callbackUrl
    ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/signin";

  redirect(target);
}
