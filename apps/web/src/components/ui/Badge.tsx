import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'accent' | 'success' | 'error';

export default function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
