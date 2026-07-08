import { redirect } from "next/navigation";

// The old "Sample Decision Package" demo was the retired human-eval product. The live sample
// is the AI output check at /r/check, so send visitors there.
export default function Demo() {
  redirect("/r/check");
}
