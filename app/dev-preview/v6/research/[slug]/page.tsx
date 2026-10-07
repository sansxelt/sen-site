import { redirect } from "next/navigation";
import { V6_BASE } from "@/lib/v6-routes";
export default function Page() { redirect(`${V6_BASE}/research`); }
