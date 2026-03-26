'use client';

import { createContext, useContext } from 'react';

export interface CosmeticsContextValue {
  symbolX: string; // default 'X'
  symbolO: string; // default 'O'
  chessSet: string; // default 'cburnett'
}

export const CosmeticsContext = createContext<CosmeticsContextValue>({
  symbolX: 'X',
  symbolO: 'O',
  chessSet: 'cburnett',
});

export function useCosmetics() {
  return useContext(CosmeticsContext);
}
