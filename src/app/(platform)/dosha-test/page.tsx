import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";

export const metadata = {
  title: "CenterWay Dosha Test",
  description: "12-question dosha test for CenterWay onboarding and personalization",
};

export default function DoshaTestPage() {
  return <GeneratedRouteScreen routeKey="dosha-test" />;
}
