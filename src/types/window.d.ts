// src/types/window.d.ts
export {};

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
    __manePixels?: {
      loadedIds: Set<string>;
      activeId?: string;            // padrão único
      scriptLoaded?: boolean;
      debug?: boolean;
    };
  }
}
