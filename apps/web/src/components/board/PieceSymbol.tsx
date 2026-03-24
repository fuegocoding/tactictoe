import React from 'react';
import * as Icons from 'lucide-react';

interface PieceSymbolProps {
  symbol: string;
  color: string;
  size?: number;
}

export function PieceSymbol({ symbol, color, size = 28 }: PieceSymbolProps) {
  const IconComponent = (Icons as Record<string, any>)[symbol];
  if (IconComponent && typeof IconComponent === 'function') {
    return <IconComponent size={size} strokeWidth={2.5} color={color} />;
  }
  return <span style={{ color }}>{symbol}</span>;
}
