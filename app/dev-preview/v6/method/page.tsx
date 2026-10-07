import { redirect } from "next/navigation";
import { V6_BASE } from "@/lib/v6-routes";

export default function Method() { redirect(`${V6_BASE}/goals`); }
