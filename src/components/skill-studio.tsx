import { useMemo, useState } from "react";
import {
  DELIVERY_GROUPS,
  SKILL_CATALOG,
  exportAllSkills,
  exportSkillPrefab,
} from "@/lab/config/skillCatalog.js";
import { ELEMENT_META, settings } from "@/lab/config/settings.js";

const TABS = ["Pipeline", "Linear", "Weapon", "AOE", "Delivery", "Export"] as const;
type Tab = (typeof TABS)[number];

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SkillStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Pipeline");
  const groups = useMemo(() => {
    return {
      Linear: SKILL_CATALOG.filter((s) => s.family === "linear"),
      Weapon: SKILL_CATALOG.filter((s) => s.family === "weapon"),
      AOE: SKILL_CATALOG.filter((s) => s.family === "aoe"),
    };
  }, []);

  if (!open) return null;

  return (
    <aside className="studio-sheet" onPointerDown={(e) => e.stopPropagation()}>
      <h2>Skill authoring</h2>
      <p>
        LinearAbilityExt concepts — live knobs, five aim shapes, pooled casts — plus weapon
        and AOE production ids from Casting.
      </p>
      <div className="studio-tabs">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            className={tab === name ? "is-on" : undefined}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Pipeline" && (
        <div>
          <div className="studio-row">
            <b>Settings SSOT</b>
            <span>sampled every frame</span>
          </div>
          <div className="studio-row">
            <b>Aim shapes</b>
            <span>line · zone · gate · ring · scribe</span>
          </div>
          <div className="studio-row">
            <b>Phases</b>
            <span>travel → impact → fade</span>
          </div>
          <div className="studio-row">
            <b>Editor</b>
            <span>G — live, even paused</span>
          </div>
          <div className="studio-row">
            <b>Catalog</b>
            <span>never invent skill ids</span>
          </div>
        </div>
      )}

      {(tab === "Linear" || tab === "Weapon" || tab === "AOE") &&
        groups[tab].map((skill) => {
          const meta = ELEMENT_META[skill.id as keyof typeof ELEMENT_META];
          const cfg = settings[skill.id as keyof typeof settings] as {
            range?: number;
            zoneRadius?: number;
            cooldown?: number;
          };
          return (
            <div className="studio-row" key={skill.id}>
              <b>
                {meta?.key} {meta?.label}
              </b>
              <span>
                {skill.delivery} · {cfg?.range ?? 0}m
                {cfg?.zoneRadius ? ` · r${cfg.zoneRadius}` : ""} · {cfg?.cooldown}s
              </span>
            </div>
          );
        })}

      {tab === "Delivery" &&
        Object.entries(DELIVERY_GROUPS).map(([group, patterns]) => (
          <div className="studio-row" key={group}>
            <b>{group}</b>
            <span>{patterns.join(" · ")}</span>
          </div>
        ))}

      {tab === "Export" && (
        <p>Writes Casting production-override JSON. Same contract as weapon-skills host.</p>
      )}

      <div className="studio-actions">
        <button
          type="button"
          className="primary"
          onClick={() => download("casting-lab-skills.json", exportAllSkills())}
        >
          Export all
        </button>
        <button
          type="button"
          onClick={() => {
            const armed = (window as unknown as { app?: { element?: string } }).app?.element;
            const prefab = armed ? exportSkillPrefab(armed) : exportAllSkills();
            download(`${armed ?? "skills"}.json`, prefab);
          }}
        >
          Export armed
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}
