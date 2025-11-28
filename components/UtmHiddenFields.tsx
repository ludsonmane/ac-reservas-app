// components/UtmHiddenFields.tsx
'use client';
import { UTM_KEYS, useUtm } from '../src/lib/utm';

export default function UtmHiddenFields() {
  const utm = useUtm();
  return (
    <>
      {UTM_KEYS.map((k) =>
        utm[k] ? <input key={k} type="hidden" name={k} value={utm[k] as string} /> : null
      )}
    </>
  );
}
