import { redirect } from "next/navigation";

// The proxy (src/proxy.ts) normally sends `/` to Log in or Dashboard before
// this runs. This is the fallback if it ever doesn't; logged-in users are then
// sent on from Log in to Dashboard by the proxy.
export default function Home() {
  redirect("/login");
}
