'use client';

import React from 'react';
import {
  Rocket, Globe, Star, Moon, Flame, Snowflake,
  Crown, Sword, Cat, Dog, Flower2, TreePine,
  Skull, Ghost, Heart, Zap, Shield, Trophy,
  Sun, Cloud, Fish, Bird, Music, Sparkles,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type IconComponent = React.FC<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  Rocket, Globe, Star, Moon, Flame, Snowflake,
  Crown, Sword, Cat, Dog, Flower2, TreePine,
  Skull, Ghost, Heart, Zap, Shield, Trophy,
  Sun, Cloud, Fish, Bird, Music, Sparkles,
};

interface PieceSymbolProps {
  symbol: string;
  color: string;
  size?: number;
}

export function PieceSymbol({ symbol, color, size = 28 }: PieceSymbolProps) {
  const IconComponent = ICON_MAP[symbol];
  if (IconComponent) {
    return <IconComponent size={size} strokeWidth={2.5} color={color} />;
  }
  return <span style={{ color }}>{symbol}</span>;
}
