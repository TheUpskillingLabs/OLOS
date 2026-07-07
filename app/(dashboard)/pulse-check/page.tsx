import { redirect } from "next/navigation";

// The weekly pulse check was replaced by the Learning Log (the dashboard's
// weekly gate). This legacy member route is retired — it had no inbound links
// and still showed a now-false "your access will be paused" warning — so it
// redirects to the dashboard. Historical `pulse_checks` rows remain untouched
// for the Poderator surface.
export default function PulseCheckPage() {
  redirect("/dashboard");
}
