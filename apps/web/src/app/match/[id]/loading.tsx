export default function MatchLoading() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[160, 240, 80, 200].map((w, i) => (
        <div key={i} style={{ width: w, height: 24, background: 'var(--bg-subtle)', borderRadius: 4 }} />
      ))}
    </div>
  );
}
