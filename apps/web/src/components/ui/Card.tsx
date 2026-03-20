import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  flat?: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Card({ children, flat, compact, className, style }: CardProps) {
  const classes = [
    styles.card,
    flat ? styles.flat : '',
    compact ? styles.compact : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return <div className={classes} style={style}>{children}</div>;
}
