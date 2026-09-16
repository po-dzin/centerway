import { BuilderDashboard } from "@/components/builder/BuilderDashboard";

/**
 * The workshop's front door — the author's overview, not their course list.
 *
 * Same split the personal app already makes: `/profile` answers «де я», `/learn`
 * answers «що в мене є». The shelf lives at `/build/courses`.
 */
export default function BuilderHomePage() {
  return <BuilderDashboard />;
}
