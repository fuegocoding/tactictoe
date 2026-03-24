'use client';

import { createContext, useContext } from 'react';

export interface CosmeticsContextValue {
  symbolX: string; // default 'X'
  symbolO: string; // default 'O'
}

export const CosmeticsContext = createContext<CosmeticsContextValue>({
  symbolX: 'X',
  symbolO: 'O',
});

export function useCosmetics() {
  return useContext(CosmeticsContext);
}
