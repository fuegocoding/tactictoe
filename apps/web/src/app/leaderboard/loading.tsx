export default function LeaderboardLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ width: 200, height: 36, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      <div style={{ width: 160, height: 40, background: 'var(--bg-subtle)', borderRadius: 999 }} />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ height: 44, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      ))}
    </div>
  );
}
