import { notFound } from "next/navigation";
import { AuthFrame } from "@/app/_components/auth-frame";
import { VraelisSignIn } from "@/components/vraelis-auth";
import { ResetPasswordForm } from "@/app/auth/reset-password/reset-password-form";
import { ResetPasswordConfirmForm } from "@/app/auth/reset-password/confirm/reset-password-confirm-form";

// Review the actual shared account components locally without reopening product access.
export default async function AccountPreview({searchParams}:{searchParams:Promise<{step?:string}>}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const {step} = await searchParams;
  return <AuthFrame workspace>{step === "reset" ? <div className="auth-recovery auth-bridge"><ResetPasswordForm /></div>
    : step === "confirm" ? <div className="auth-recovery auth-bridge"><ResetPasswordConfirmForm token="local-design-review" /></div>
    : <VraelisSignIn initialMode={step === "signup" ? "signup" : "signin"} allowSignup={step === "signup"} />}</AuthFrame>;
}
