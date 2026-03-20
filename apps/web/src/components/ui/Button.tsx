import { forwardRef } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  as?: 'button' | 'a';
  href?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', full, loading, className, children, disabled, ...props }, ref) => {
    const classes = [
      styles.btn,
      styles[variant],
      size !== 'md' ? styles[size] : '',
      full ? styles.full : '',
      className ?? '',
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading ? <span style={{ opacity: 0.6 }}>Loading…</span> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export default Button;
