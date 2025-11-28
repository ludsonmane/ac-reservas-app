// src/app/UtmBootstrap.tsx
'use client';

import { useEffect } from 'react';
import { persistUtmFromUrlOnce } from '@/lib/utm';

export default function UtmBootstrap() {
  useEffect(() => {
    try {
      persistUtmFromUrlOnce?.();
    } catch {
      // silencia qualquer erro de inicialização
    }
  }, []);

  return null;
}
