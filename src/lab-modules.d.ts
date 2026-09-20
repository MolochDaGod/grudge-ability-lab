declare module "@/lab/core/App.js" {
  export class App {
    constructor(
      canvas: HTMLCanvasElement,
      options?: { hud?: HTMLElement | null; loader?: HTMLElement | null },
    );
    load(): Promise<void>;
    dispose(): void;
    editor: { toggle: () => void };
    element?: string;
  }
}

declare module "@/lab/config/settings.js" {
  export const settings: Record<string, any>;
  export const ELEMENTS: string[];
  export const ELEMENT_META: Record<
    string,
    { label: string; accent: string; key: string; hint: string; cast?: string }
  >;
  export const CastShape: Record<string, string>;
}

declare module "@/lab/config/skillCatalog.js" {
  export const SKILL_CATALOG: Array<{
    id: string;
    catalogId: string;
    family: string;
    delivery: string;
    weaponTypeId: string;
    animRole: string;
    statuses: unknown[];
  }>;
  export const DELIVERY_GROUPS: Record<string, string[]>;
  export function exportSkillPrefab(id: string): unknown;
  export function exportAllSkills(): unknown;
}
