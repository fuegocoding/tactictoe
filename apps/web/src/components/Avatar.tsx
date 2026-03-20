interface AvatarProps {
  username: string;
  size?: number;
}

function usernameHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}

export default function Avatar({ username, size = 36 }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();
  const hue = usernameHue(username);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue}, 60%, 45%)`,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, size * 0.38),
        fontWeight: 700,
        flexShrink: 0,
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
