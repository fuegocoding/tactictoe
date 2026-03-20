import Badge from './ui/Badge';

interface RatingBadgeProps {
  rating: number;
  rd: number;   // ratings deviation — lower = more certain
  wins?: number;
  losses?: number;
}

export default function RatingBadge({ rating, rd, wins, losses }: RatingBadgeProps) {
  // RD > 100 = uncertain (provisional), < 75 = established
  const isProvisional = rd > 100;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
        {rating}
      </span>
      {isProvisional && (
        <Badge variant="default">?</Badge>
      )}
      {wins !== undefined && losses !== undefined && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {wins}W {losses}L
        </span>
      )}
    </span>
  );
}
