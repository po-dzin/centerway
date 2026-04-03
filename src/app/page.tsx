export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <h1>CenterWay Platform</h1>
      <p>Runtime is active. Product traffic is routed by host in proxy middleware.</p>
      <p>
        Health check: <a href="/api/health">/api/health</a>
      </p>
      <p>
        Dosha test: <a href="/dosha-test">/dosha-test</a>
      </p>
    </main>
  );
}
