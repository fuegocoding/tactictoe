import styles from './page.module.css';

export default function ProfileLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-subtle)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 180, height: 24, background: 'var(--bg-subtle)', borderRadius: 4 }} />
          <div style={{ width: 120, height: 16, background: 'var(--bg-subtle)', borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ width: 200, height: 96, background: 'var(--bg-subtle)', borderRadius: 10 }} />
    </div>
  );
}
