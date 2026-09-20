import { useCallback, useEffect, useRef, useState } from "react";
import { SkillStudio } from "@/components/skill-studio";

type LabApp = {
  load: () => Promise<void>;
  dispose: () => void;
  editor: { toggle: () => void };
};

export function AbilityLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<LabApp | null>(null);
  const [entered, setEntered] = useState(false);
  const [studio, setStudio] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const boot = useCallback(async () => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    const loader = loaderRef.current;
    if (!canvas || !hud || !loader) return;
    const { App } = await import("@/lab/core/App.js");
    const app = new App(canvas, { hud, loader }) as LabApp;
    appRef.current = app;
    (window as unknown as { app: LabApp }).app = app;
    try {
      await app.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start the lab";
      setBootError(message);
      console.error("[lab] boot failed", error);
    }
  }, []);

  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await boot();
    })();
    return () => {
      cancelled = true;
      appRef.current?.dispose();
      appRef.current = null;
    };
  }, [entered, boot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "KeyU") {
        event.preventDefault();
        setStudio((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas id="viewport" ref={canvasRef} />

      <div id="loader" className={entered ? "loader" : "loader is-hidden"} ref={loaderRef}>
        <div className="loader__inner">
          <div className="loader__sigil">
            <span className="sigil sigil--a" />
            <span className="sigil sigil--b" />
            <span className="sigil sigil--c" />
            <span className="sigil sigil--d" />
          </div>
          <h1 className="loader__title">Ability Lab</h1>
          <div className="loader__bar">
            <i id="loader-fill" data-loader-fill />
          </div>
          <p className="loader__status" id="loader-status" data-loader-status>
            {bootError ?? "Compiling the crowns…"}
          </p>
        </div>
      </div>

      <div id="hud" className="hud" aria-live="polite" ref={hudRef} />

      {entered ? (
        <>
          <button type="button" className="studio-toggle" onClick={() => setStudio((v) => !v)}>
            Studio
          </button>
          <SkillStudio open={studio} onClose={() => setStudio(false)} />
        </>
      ) : (
        <div className="lab-gate">
          <div className="lab-gate__card">
            <p className="lab-gate__kicker">Grudge Studio</p>
            <h1 className="lab-gate__title">Ability Lab</h1>
            <p className="lab-gate__lead">
              Arm a skill, aim, click. ▾ on Fire Bend and Water Bend opens
              colour and texture. Tab opens saves.
            </p>
            <div className="lab-gate__keys">
              <div>
                <b>Tab</b> library · save · bind hotkeys
              </div>
              <div>
                <b>1 2 3 4 5 6 7 R F</b> play bar
              </div>
              <div>
                <b>V X Z</b> fire · water · air bend
              </div>
              <div>
                <b>Q E</b> crowns · <b>B M K</b> buffs · <b>C</b> clear
              </div>
            </div>
            <button type="button" className="lab-gate__enter" onClick={() => setEntered(true)}>
              Enter the lab
            </button>
            <p className="lab-gate__hint">Aim with the mouse. Left click to cast. Right drag to orbit.</p>
          </div>
        </div>
      )}
    </main>
  );
}
