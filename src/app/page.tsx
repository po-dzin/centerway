import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <h1>CenterWay Platform</h1>
      <p>Runtime is active. Product traffic is routed by host in proxy middleware.</p>
      <p>
        Health check: <Link href="/api/health">/api/health</Link>
      </p>
      <p>
        Dosha test: <Link href="/dosha-test">/dosha-test</Link>
      </p>
    </main>
  );
}
