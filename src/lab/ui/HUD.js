// @ts-nocheck
import { ELEMENTS, ELEMENT_META, BOOST_META, MAGIC_META, FIRE_META, SPELLTELEPORTS, settings } from '../config/settings.js';
import { ELEMENT_SIGILS, BOOST_SIGIL, MAGIC_SIGIL, FIRE_SIGIL } from './glyphs.js';
import {
  VARIANT_SLOTS,
  PALETTES,
  TEXTURES,
  BOLT_SIZES,
  variantState,
  applyPalette,
  applyTexture,
  applyBoltSize
} from '../config/variants.js';
import { shapeKnobs, motionKnobs, formatTune, writeTune, tuneTitle } from '../config/skillTune.js';
import { PLAY_SLOTS } from '../config/loadout.js';
import { Codex } from './Codex.js';

function variantButton(id) {
  if (!VARIANT_SLOTS.includes(id)) return '';
  return `<button type="button" class="ability-card__edit" data-variant="${id}" title="Colour & texture" aria-label="Variants">▾</button>`;
}

const TUNE_SHAPE_ICON = `<svg class="tune-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.35"/></svg>`;
const TUNE_MOTION_ICON = `<svg class="tune-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"><path d="M9 1.6 3.4 9h4.4L6.6 14.4 13 8.2H8.6L9 1.6z"/></svg>`;
const ICON_BOOK = `<svg class="play-hud__svg" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.45"><path d="M3.2 2.6h8.2v10.8H4.1A1.9 1.9 0 0 1 2.2 11.5V4.5A1.9 1.9 0 0 1 4.1 2.6"/><path d="M11.4 2.6v10.8H13.8V4.4A1.8 1.8 0 0 0 12 2.6Z"/><path d="M5.2 5.4h4.4M5.2 7.8h4.4"/></svg>`;
const ICON_CLEAR = `<svg class="play-hud__svg" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M3 4.2h10M6.1 4.2V3.2A1 1 0 0 1 7.1 2.2h1.8a1 1 0 0 1 1 1v1M4.6 4.2 5.2 13a1.2 1.2 0 0 0 1.2 1.1h3.2A1.2 1.2 0 0 0 10.8 13l.6-8.8"/></svg>`;
const ICON_HELP = `<svg class="play-hud__svg" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.45"><circle cx="8" cy="8" r="5.4"/><path d="M6.4 6.2a1.7 1.7 0 1 1 2.3 2.1c-.5.3-.9.7-.9 1.4"/><circle cx="8" cy="11.6" r=".7" fill="currentColor" stroke="none"/></svg>`;
const ICON_LAB = `<svg class="play-hud__svg" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.45"><path d="M6 2.4h4M8 2.4v5.2L4.4 13.2h7.2L8 7.6"/><path d="M5.4 10.6h5.2"/></svg>`;

function playSlotCard(slot) {
  return `
    <div class="ability-card ability-card--play play-slot" data-play-slot="${slot}">
      ${tuneButtons('')}
      <div class="ability-card__sweep" data-sweep></div>
      <div class="ability-card__key">${slot}</div>
      <div class="ability-card__glyph" data-play-glyph></div>
      <div class="ability-card__label" data-play-label></div>
    </div>`;
}

function playBuffCard(kind, meta, glyph) {
  return `
    <button type="button" class="play-hud__icon ability-card ability-card--buff ability-card--play"
            data-${kind} style="--accent:${meta.accent}" title="${meta.label} (${meta.key})">
      <div class="ability-card__sweep" data-sweep></div>
      <div class="ability-card__key">${meta.key}</div>
      <div class="ability-card__glyph">${glyph}</div>
    </button>`;
}

function playTool(attr, title, icon, label) {
  return `<button type="button" class="play-hud__icon play-hud__tool" ${attr} title="${title}" aria-label="${label}">${icon}<span>${label}</span></button>`;
}

function playEditButton(panel, title, icon, label) {
  return `<button type="button" class="play-hud__icon play-hud__edit" data-play-edit="${panel}" title="${title}" aria-label="${label}">${icon}<span>${label}</span></button>`;
}

function playHudMarkup() {
  return `
    <div class="play-hud" data-play-hud data-play-rail>
      <div class="play-hud__slots" data-play-bar>
        ${PLAY_SLOTS.map(playSlotCard).join('')}
      </div>
      <div class="play-hud__tray" data-play-tray>
        <div class="play-hud__tray-left">
          ${playEditButton('shape', 'Size, intensity, shockwave, start / finish', TUNE_SHAPE_ICON, 'Shape')}
          ${playEditButton('motion', 'Speed, lob, impact, smoke, after-effects', TUNE_MOTION_ICON, 'Motion')}
          ${playTool('data-library', 'Saves (Tab)', ICON_BOOK, 'Saves')}
          ${playTool('data-clear', 'Clear scene (C)', ICON_CLEAR, 'Clear')}
        </div>
        <div class="play-hud__tray-right">
          ${playBuffCard('boost', BOOST_META, BOOST_SIGIL)}
          ${playBuffCard('magic', MAGIC_META, MAGIC_SIGIL)}
          ${playBuffCard('fire', FIRE_META, FIRE_SIGIL)}
          ${playTool('data-help-btn', 'Help (H)', ICON_HELP, 'Help')}
          ${playTool('data-hud-toggle', 'Switch to Lab HUD', ICON_LAB, 'Lab')}
        </div>
      </div>
    </div>`;
}

function dockTools() {
  return `
    <div class="hud__tools">
      <button type="button" class="hud-tool" data-clear title="Clear scene (C)">Clear</button>
      <button type="button" class="hud-tool" data-library title="Saves (Tab)">Saves</button>
      <button type="button" class="hud-tool" data-hud-toggle title="Lab / Play HUD">Play</button>
      <button type="button" class="hud-tool" data-help-btn title="Help (H)">Help</button>
    </div>`;
}

function tuneButtons(id) {
  return `<div class="ability-card__tunes">
    <button type="button" class="ability-card__tune" data-tune="shape" data-tune-id="${id}" title="Size & shockwave" aria-label="Shape options">${TUNE_SHAPE_ICON}</button>
    <button type="button" class="ability-card__tune" data-tune="motion" data-tune-id="${id}" title="Speed & impact" aria-label="Motion options">${TUNE_MOTION_ICON}</button>
  </div>`;
}

function abilityCard(element) {
  const meta = ELEMENT_META[element];
  return `
    <div class="ability-card" data-element="${element}" style="--accent:${meta.accent}">
      ${variantButton(element)}
      ${tuneButtons(element)}
      <div class="ability-card__sweep" data-sweep></div>
      ${meta.key ? `<div class="ability-card__key">${meta.key}</div>` : ''}
      <div class="ability-card__glyph">${ELEMENT_SIGILS[element] ?? ''}</div>
      <div class="ability-card__label">${meta.label}</div>
    </div>`;
}

const COMBAT_ELEMENTS = ELEMENTS.filter((id) => !SPELLTELEPORTS.includes(id));

/**
 * Heads-up display: the ability bar, controls, live stats and toasts.
 *
 * Plain DOM — no framework. The bar is built from `ELEMENTS`, so a new ability
 * appears in it on its own; the slots are the only interactive part, and they
 * mirror the keyboard shortcuts through `onAbility`.
 *
 * The three self buffs sit at the end of the same bar but are *not* slots: they
 * are never selected and never armed, so they are held separately and their
 * sweeps show the buff draining rather than a cooldown filling.
 *
 * The cooldown sweep is a `conic-gradient` driven by a CSS custom property, so
 * updating it every frame is one `setProperty` call and never touches layout.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.onAbility = null;
    this.onBoost = null;
    this.onMagic = null;
    this.onFire = null;
    this.onClear = null;
    this.onMode = null;
    this.onLoadout = null;
    this.onSelectSkill = null;
    this.onSaveSkill = null;
    this.onBindSlot = null;
    this.onDeleteSaved = null;
    this.onArmPicked = null;
    this.getCurrentElement = null;
    this.loadout = null;
    this._toastTimer = 0;
    this._statsAccumulator = 0;
    this._frames = 0;
    this._fps = 0;
    /** Last sweep ratio pushed to the DOM, per element. */
    this._cooldownShown = new Map();
    this._armedShown = null;
    this._boostShown = { active: null, ratio: -1 };
    this._magicShown = { active: null, ratio: -1 };
    this._fireShown = { active: null, ratio: -1 };

    root.innerHTML = `
      <div class="hud__panel hud__title">
        Grudge Ability Lab
        <span data-blurb>tab saves · download last · 1–7 R F play</span>
      </div>

      <div class="hud__panel hud__stats">
        <div>FPS <b data-stat="fps">—</b></div>
        <div>Particles <b data-stat="particles">0</b></div>
        <div>Instances <b data-stat="spikes">0</b></div>
        <div>Draw calls <b data-stat="calls">0</b></div>
      </div>

      <div class="hud__panel hud__help is-hidden">
        <div><strong>Tab</strong> — saves, download last cast (JSON / JS / GLB container)</div>
        <div><strong>1 2 3 4 5 6 7 R F</strong> — play bar (bind these in Tab)</div>
        <div><strong>1</strong> — Cinder Slash &nbsp; <strong>2</strong> — Fire Bolt &nbsp; <strong>3</strong> — Frost Lance</div>
        <div><strong>4</strong> — Storm Lance &nbsp; <strong>5</strong> — Nova Beam</div>
        <div><strong>V</strong> — Fire Bend &nbsp; <strong>X</strong> — Water Bend &nbsp; <strong>Z</strong> — Air Bend</div>
        <div class="hud__help-note">
          ▾ on V and X opens colour chips and a texture (live / plasma / coal / whip
          for fire, ocean / ice / ink / foam for water). Fire is the Avatar
          volumetric stream — not a staff bolt.
        </div>
        <div><strong>Q E R F</strong> — original linear crowns</div>
        <div class="hud__help-note">
          V fire and X water are linear trails with Avatar bending impacts. Z is a far-cast circle:
          a wavy air trail runs to the selected footprint, then the tornado plants there.
          Spellteleport (gate, ring, fire portal) is click-cast from the left bar — no hotkeys.
        </div>
        <div><strong>B</strong> — Electric Boost &nbsp; <strong>M</strong> — Magic Boost</div>
        <div><strong>K</strong> — Fire Boost</div>
        <div class="hud__help-note">
          B, M and K are self buffs — nothing to aim. Press again to let go; any of them can run
          together.
        </div>
        <div><strong>Move</strong> — aim &nbsp; <strong>Left click</strong> — cast</div>
        <div><strong>Esc / right click</strong> — cancel the cast</div>
        <div><strong>Right drag</strong> — orbit &nbsp; <strong>Scroll</strong> — zoom</div>
        <div style="margin-top:6px">
          <kbd>Tab</kbd> library &nbsp; <kbd>G</kbd> editor &nbsp; <kbd>U</kbd> studio &nbsp; <kbd>P</kbd> pause &nbsp; <kbd>C</kbd> clear scene
        </div>
        <div><kbd>H</kbd> hide this</div>
        <div class="hud__help-note">
          Play HUD: the lower Shape and Motion buttons edit the selected skill. Ring is size,
          intensity and shockwave (from the AOE or out from you). Bolt is speed, lob, impact,
          particles, smoke and how long the after-effect hangs. Tab downloads the last cast as
          JSON (the knobs) and a runtime zip (the shaders) for a Three.js game — not a GLB mesh.
        </div>
      </div>

      <aside class="hud__spellteleport" data-spellteleport>
        <div class="hud__spellteleport-label">Spellteleport</div>
        <div class="hud__spellteleport-rail">
          ${SPELLTELEPORTS.map(abilityCard).join('')}
        </div>
      </aside>

      <footer class="hud__footer hud__footer--lab" data-footer-lab>
        <div class="hud__dock">
          ${dockTools()}
          <div class="hud__rail" data-rail>
            <div class="hud__abilities">
            ${COMBAT_ELEMENTS.map(abilityCard).join('')}

            <div class="ability-card ability-card--buff" data-boost
                 style="--accent:${BOOST_META.accent}">
              ${variantButton('boost')}
              <div class="ability-card__sweep" data-sweep></div>
              <div class="ability-card__key">${BOOST_META.key}</div>
              <div class="ability-card__glyph">${BOOST_SIGIL}</div>
              <div class="ability-card__label">${BOOST_META.label}</div>
            </div>

            <div class="ability-card ability-card--buff" data-magic
                 style="--accent:${MAGIC_META.accent}">
              <div class="ability-card__sweep" data-sweep></div>
              <div class="ability-card__key">${MAGIC_META.key}</div>
              <div class="ability-card__glyph">${MAGIC_SIGIL}</div>
              <div class="ability-card__label">${MAGIC_META.label}</div>
            </div>

            <div class="ability-card ability-card--buff" data-fire
                 style="--accent:${FIRE_META.accent}">
              ${variantButton('fire')}
              <div class="ability-card__sweep" data-sweep></div>
              <div class="ability-card__key">${FIRE_META.key}</div>
              <div class="ability-card__glyph">${FIRE_SIGIL}</div>
              <div class="ability-card__label">${FIRE_META.label}</div>
            </div>
          </div>
        </div>
        </div>
      </footer>

      <footer class="hud__footer hud__footer--play is-hidden" data-footer-play hidden>
        ${playHudMarkup()}
      </footer>

      <div class="variant-menu is-hidden" data-variant-menu hidden></div>
      <div class="tune-menu is-hidden" data-tune-menu hidden></div>
      <div class="codex is-hidden" data-codex hidden></div>

      <div class="hud__toast" data-toast></div>
      <div class="hud__paused" data-paused>Paused</div>
    `;

    this.cards = new Map();
    for (const card of root.querySelectorAll('.ability-card[data-element]')) {
      this.cards.set(card.dataset.element, card);
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onAbility?.(card.dataset.element);
      });
    }

    this.boostCards = [...root.querySelectorAll('[data-boost]')];
    this.magicCards = [...root.querySelectorAll('[data-magic]')];
    this.fireCards = [...root.querySelectorAll('[data-fire]')];
    this.boostCard = this.boostCards[0];
    this.magicCard = this.magicCards[0];
    this.fireCard = this.fireCards[0];
    for (const card of this.boostCards) {
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onBoost?.();
      });
    }
    for (const card of this.magicCards) {
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onMagic?.();
      });
    }
    for (const card of this.fireCards) {
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onFire?.();
      });
    }

    for (const card of root.querySelectorAll('[data-play-slot]')) {
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onLoadout?.(card.dataset.playSlot);
      });
    }

    this.variantMenu = root.querySelector('[data-variant-menu]');
    this.tuneMenu = root.querySelector('[data-tune-menu]');
    this._variantId = null;
    this._tuneId = null;
    this._tunePanel = null;
    this._onVariantDoc = (event) => {
      if (this.variantMenu.contains(event.target)) return;
      if (event.target.closest?.('.ability-card__edit')) return;
      this.closeVariantMenu();
    };
    this._onTuneDoc = (event) => {
      if (this.tuneMenu.contains(event.target)) return;
      if (event.target.closest?.('.ability-card__tune')) return;
      if (event.target.closest?.('[data-play-edit]')) return;
      this.closeTuneMenu();
    };
    this._bindVariantButtons();
    this._bindTuneButtons();
    this._syncAllAccents();

    this.stats = {
      fps: root.querySelector('[data-stat="fps"]'),
      particles: root.querySelector('[data-stat="particles"]'),
      spikes: root.querySelector('[data-stat="spikes"]'),
      calls: root.querySelector('[data-stat="calls"]')
    };
    this.help = root.querySelector('.hud__help');
    this.toast = root.querySelector('[data-toast]');
    this.pausedBadge = root.querySelector('[data-paused]');
    this.abilityBar = root.querySelector('.hud__abilities');
    this.playBar = root.querySelector('[data-play-bar]');
    this.teleportBar = root.querySelector('[data-spellteleport]');
    this.rail = root.querySelector('[data-rail]');
    this.playRail = root.querySelector('[data-play-rail]');
    this.footer = root.querySelector('[data-footer-lab]');
    this.playFooter = root.querySelector('[data-footer-play]');
    this.blurb = root.querySelector('[data-blurb]');
    this.codex = new Codex(root.querySelector('[data-codex]'), {
      onOpen: (open) => {
        this.codexOpen = open;
      },
      onMode: (mode) => this.setHudMode(mode),
      onSelect: (picked) => this.onSelectSkill?.(picked),
      onBind: (slot, bind) => this.onBindSlot?.(slot, bind),
      onSave: (name, picked) => this.onSaveSkill?.(name, picked),
      onDeleteSaved: (id) => this.onDeleteSaved?.(id),
      onArm: (picked) => this.onArmPicked?.(picked),
      onToast: (message) => this.showToast(message),
      getLastUsed: () => this.lastUsed,
      getElement: () => this.getCurrentElement?.()
    });
    this.codexOpen = false;
    this._bindDock();
  }

  _bindDock() {
    for (const clearBtn of this.root.querySelectorAll('[data-clear]')) {
      clearBtn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onClear?.();
      });
    }
    for (const helpBtn of this.root.querySelectorAll('[data-help-btn]')) {
      helpBtn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleHelp();
      });
    }
    for (const libraryBtn of this.root.querySelectorAll('[data-library]')) {
      libraryBtn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleCodex();
      });
    }
    for (const toggleBtn of this.root.querySelectorAll('[data-hud-toggle]')) {
      toggleBtn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = this.loadout?.mode === 'play' ? 'lab' : 'play';
        this.setHudMode(next);
      });
    }
    for (const editBtn of this.root.querySelectorAll('[data-play-edit]')) {
      editBtn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._openPlayTune(editBtn.dataset.playEdit, editBtn);
      });
    }
    this.footer?.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.playFooter?.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.teleportBar?.addEventListener('pointerdown', (event) => event.stopPropagation());
    const onWheel = (rail) => (event) => {
      if (!rail) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      rail.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    this.rail?.addEventListener('wheel', onWheel(this.rail), { passive: false });
    this.playRail?.addEventListener('wheel', onWheel(this.playRail), { passive: false });
  }

  _openPlayTune(panel, anchor) {
    const selected = this.playBar?.querySelector('.play-slot.is-active:not(.is-empty)')?.dataset.element;
    const onBar = this._activeElement
      ? this.playBar?.querySelector(`.play-slot[data-element="${CSS.escape(this._activeElement)}"]`)
      : null;
    const first = this.playBar?.querySelector('.play-slot:not(.is-empty)')?.dataset.element;
    const id = selected || (onBar ? this._activeElement : null) || first;
    if (!id) {
      this.showToast('Select a skill first');
      return;
    }
    if (this._tuneId === id && this._tunePanel === panel) this.closeTuneMenu();
    else this.openTuneMenu(id, panel, anchor);
  }

  attachLoadout(loadout) {
    this.loadout = loadout;
    this.codex.setLoadout(loadout);
    this.setHudMode(loadout.mode, { silent: true });
    this.refreshPlayBar();
    loadout.subscribe(() => {
      this.refreshPlayBar();
      this._syncModeChrome();
      if (this.codex.open) this.codex.paint();
    });
  }

  toggleCodex() {
    this.closeVariantMenu();
    this.closeTuneMenu();
    if (this.codex.open) this.codex.hide();
    else this.codex.show({ tab: 'saved' });
  }

  setLastUsed(last) {
    this.lastUsed = last;
    this.codex.setLastUsed(last);
  }

  setHudMode(mode, options = {}) {
    const next = mode === 'play' ? 'play' : 'lab';
    if (this.loadout && this.loadout.mode !== next) this.loadout.setMode(next);
    this.root.classList.toggle('is-play', next === 'play');
    this.footer?.classList.toggle('is-hidden', next === 'play');
    this.playFooter?.classList.toggle('is-hidden', next !== 'play');
    this.teleportBar?.classList.toggle('is-hidden', next === 'play');
    if (this.footer) this.footer.hidden = next === 'play';
    if (this.playFooter) this.playFooter.hidden = next !== 'play';
    if (this.teleportBar) this.teleportBar.hidden = next === 'play';
    if (this.blurb) {
      this.blurb.textContent =
        next === 'play'
          ? 'play bar 1–7 R F · tab saves · C clears'
          : 'tab saves · download last · C clears';
    }
    this._syncModeChrome();
    this.onMode?.(next);
    if (!options.silent) this.showToast(next === 'play' ? 'Play HUD — 1 2 3 4 5 6 7 R F' : 'Lab HUD — full dock');
  }

  _syncModeChrome() {
    const mode = this.loadout?.mode ?? 'lab';
    for (const btn of this.root.querySelectorAll('[data-hud-toggle]')) {
      const label = btn.querySelector('span');
      const text = mode === 'play' ? 'Lab' : 'Play';
      if (label) label.textContent = text;
      else btn.textContent = text;
      btn.title = mode === 'play' ? 'Switch to Lab HUD' : 'Switch to Play HUD';
    }
  }

  refreshPlayBar() {
    if (!this.loadout) return;
    for (const card of this.root.querySelectorAll('[data-play-slot]')) {
      const slot = card.dataset.playSlot;
      const resolved = this.loadout.resolve(slot);
      const glyph = card.querySelector('[data-play-glyph]');
      const label = card.querySelector('[data-play-label]');
      const element = resolved?.element ?? '';
      card.dataset.element = element;
      card.style.setProperty('--accent', resolved?.accent ?? '#7fd6ff');
      if (glyph) {
        if (resolved?.weapon?.iconUrl) {
          glyph.innerHTML = `<img class="ability-card__icon" src="${resolved.weapon.iconUrl}" alt="" referrerpolicy="no-referrer" />`;
          glyph.querySelector('img')?.addEventListener('error', () => {
            glyph.innerHTML = ELEMENT_SIGILS[element] ?? '';
          });
        } else {
          glyph.innerHTML = ELEMENT_SIGILS[element] ?? '';
        }
      }
      if (label) label.textContent = resolved?.label ?? '';
      card.classList.toggle('is-empty', !resolved);
      card.title = resolved ? `${resolved.label} (${slot})` : `Empty (${slot})`;
      for (const btn of card.querySelectorAll('[data-play-tune], .ability-card__tune')) {
        btn.dataset.tuneId = element;
        btn.disabled = !element;
        btn.hidden = !element;
      }
    }
    this._syncPlayActive();
    this._syncTuneOpen();
  }

  _syncPlayActive() {
    const current = this._activeElement;
    for (const card of this.root.querySelectorAll('[data-play-slot]')) {
      card.classList.toggle('is-active', Boolean(current) && card.dataset.element === current);
    }
  }

  /** @param {{silent?: boolean}} [options] */
  setElement(element, options = {}) {
    this._activeElement = element;
    for (const [key, card] of this.cards) {
      card.classList.toggle('is-active', key === element);
    }
    this._syncPlayActive();
    const meta = ELEMENT_META[element];
    if (meta && !options.silent) this.showToast(`${meta.hint} selected`);
  }

  /** Highlight the slot while a cast is armed. */
  setArmed(armed) {
    if (armed === this._armedShown) return;
    this._armedShown = armed;
    this.abilityBar.classList.toggle('is-armed', armed);
    this.playBar?.classList.toggle('is-armed', armed);
    this.teleportBar?.classList.toggle('is-armed', armed);
  }

  _cardForVariant(id) {
    if (id === 'boost') return this.boostCard;
    if (id === 'fire') return this.fireCard;
    return this.cards.get(id);
  }

  _bindVariantButtons() {
    for (const button of this.root.querySelectorAll('.ability-card__edit')) {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = button.dataset.variant;
        if (this._variantId === id) this.closeVariantMenu();
        else this.openVariantMenu(id, button);
      });
    }
    this.variantMenu.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.variantMenu.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-kind]');
      if (!chip || !this._variantId) return;
      const { kind, value } = chip.dataset;
      if (kind === 'palette') applyPalette(this._variantId, value);
      else if (kind === 'texture') applyTexture(this._variantId, value);
      else if (kind === 'size') applyBoltSize(value);
      this._syncCardAccent(this._variantId);
      this._paintVariantMenu(this._variantId);
    });
  }

  _syncAllAccents() {
    for (const id of VARIANT_SLOTS) this._syncCardAccent(id);
  }

  _syncCardAccent(id) {
    const card = this._cardForVariant(id);
    if (!card) return;
    const paletteId = variantState[id]?.palette;
    const palette = PALETTES[paletteId];
    const accent = palette?.swatch || ELEMENT_META[id]?.accent || card.style.getPropertyValue('--accent');
    if (accent) card.style.setProperty('--accent', accent);
  }

  openVariantMenu(id, anchor) {
    this.closeTuneMenu();
    this._variantId = id;
    this._paintVariantMenu(id);
    this.variantMenu.hidden = false;
    this.variantMenu.classList.remove('is-hidden');
    const menu = this.variantMenu;
    const phone = window.innerWidth < 720;
    menu.classList.toggle('is-sheet', phone);
    if (phone) {
      menu.style.left = '12px';
      menu.style.right = '12px';
      menu.style.width = 'auto';
      menu.style.top = 'auto';
      const dock = this._dockHeight();
      menu.style.bottom = `${dock + 8}px`;
    } else {
      menu.style.right = 'auto';
      menu.style.bottom = 'auto';
      menu.style.width = '';
      const rect = anchor.getBoundingClientRect();
      const width = 236;
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
      const height = menu.offsetHeight || 220;
      let top = rect.top - height - 10;
      if (top < 10) top = rect.bottom + 8;
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }
    document.addEventListener('pointerdown', this._onVariantDoc, true);
  }

  closeVariantMenu() {
    this._variantId = null;
    this.variantMenu.hidden = true;
    this.variantMenu.classList.add('is-hidden');
    document.removeEventListener('pointerdown', this._onVariantDoc, true);
  }

  _bindTuneButtons() {
    this.root.addEventListener(
      'pointerdown',
      (event) => {
        const button = event.target.closest?.('.ability-card__tune');
        if (!button || !this.root.contains(button)) return;
        event.preventDefault();
        event.stopPropagation();
        const id = button.dataset.tuneId;
        const panel = button.dataset.tune;
        if (!id) {
          this.showToast('Empty slot');
          return;
        }
        if (this._tuneId === id && this._tunePanel === panel) this.closeTuneMenu();
        else this.openTuneMenu(id, panel, button);
      },
      true
    );
    this.tuneMenu.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.tuneMenu.addEventListener('input', (event) => {
      const slider = event.target.closest('[data-tune-key]');
      if (!slider || !this._tuneId) return;
      const key = slider.dataset.tuneKey;
      const step = Number(slider.step) || 0.01;
      let value = Number(slider.value);
      if (key === 'startAlong') {
        const finish = settings[this._tuneId].finishAlong ?? 1;
        value = Math.min(value, finish - 0.04);
        slider.value = String(value);
      }
      if (key === 'finishAlong') {
        const start = settings[this._tuneId].startAlong ?? 0;
        value = Math.max(value, start + 0.04);
        slider.value = String(value);
      }
      writeTune(this._tuneId, key, value);
      const readout = slider.parentElement?.querySelector('[data-tune-val]');
      if (readout) readout.textContent = formatTune(value, step);
    });
    this.tuneMenu.addEventListener('click', (event) => {
      if (event.target.closest('[data-tune-close]')) {
        this.closeTuneMenu();
        return;
      }
      const chip = event.target.closest('[data-shock]');
      if (!chip || !this._tuneId) return;
      writeTune(this._tuneId, 'shockwaveFrom', chip.dataset.shock);
      this._paintTuneMenu(this._tuneId, this._tunePanel);
    });
  }

  openTuneMenu(id, panel, anchor) {
    this.closeVariantMenu();
    this._tuneId = id;
    this._tunePanel = panel;
    this._paintTuneMenu(id, panel);
    this.tuneMenu.hidden = false;
    this.tuneMenu.classList.remove('is-hidden');
    this._syncTuneOpen();
    this._placePopover(this.tuneMenu, anchor, 300);
    document.addEventListener('pointerdown', this._onTuneDoc, true);
  }

  closeTuneMenu() {
    this._tuneId = null;
    this._tunePanel = null;
    this.tuneMenu.hidden = true;
    this.tuneMenu.classList.add('is-hidden');
    this._syncTuneOpen();
    document.removeEventListener('pointerdown', this._onTuneDoc, true);
  }

  _syncTuneOpen() {
    for (const button of this.root.querySelectorAll('.ability-card__tune')) {
      const on = this._tuneId === button.dataset.tuneId && this._tunePanel === button.dataset.tune;
      button.classList.toggle('is-open', on);
    }
    for (const button of this.root.querySelectorAll('[data-play-edit]')) {
      const on = Boolean(this._tuneId) && this._tunePanel === button.dataset.playEdit;
      button.classList.toggle('is-open', on);
    }
    for (const card of this.cards.values()) {
      card.classList.toggle('is-tuning', card.dataset.element === this._tuneId);
    }
    for (const card of this.root.querySelectorAll('[data-play-slot]')) {
      card.classList.toggle('is-tuning', Boolean(this._tuneId) && card.dataset.element === this._tuneId);
    }
  }

  _dockHeight() {
    const dockEl = this.root.classList.contains('is-play') ? this.playFooter : this.footer;
    return dockEl?.offsetHeight ?? 108;
  }

  _placePopover(menu, anchor, width) {
    const pad = 12;
    const dock = this._dockHeight();
    const phone = window.innerWidth < 720;
    menu.classList.add('is-sheet');
    menu.style.top = 'auto';
    menu.style.bottom = `${dock + 8}px`;
    menu.style.maxHeight = `min(58vh, ${window.innerHeight - dock - pad * 2}px)`;
    menu.style.overflowY = 'auto';
    if (phone) {
      menu.style.left = `${pad}px`;
      menu.style.right = `${pad}px`;
      menu.style.width = 'auto';
      return;
    }
    menu.style.right = 'auto';
    const maxW = Math.min(width, window.innerWidth - pad * 2);
    menu.style.width = `${maxW}px`;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - maxW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - maxW - pad));
    menu.style.left = `${left}px`;
  }

  _paintTuneMenu(id, panel) {
    const knobs = panel === 'motion' ? motionKnobs(id) : shapeKnobs(id);
    const block = settings[id] ?? {};
    const shock = block.shockwaveFrom ?? 'target';
    const shockRow =
      panel === 'shape'
        ? `<div class="tune-menu__label">Shockwave from</div>
           <div class="tune-menu__row">
             <button type="button" class="variant-chip ${shock === 'target' ? 'is-on' : ''}" data-shock="target">AOE</button>
             <button type="button" class="variant-chip ${shock === 'caster' ? 'is-on' : ''}" data-shock="caster">Caster</button>
           </div>
           <div class="tune-menu__hint">AOE plants the ring on the impact. Caster sends it out from you.</div>`
        : '';

    const sliders = knobs
      .map((spec) => {
        const value = Number(block[spec.key] ?? spec.min);
        return `<label class="tune-slider">
          <span class="tune-slider__row">
            <span>${spec.label}</span>
            <b data-tune-val>${formatTune(value, spec.step)}</b>
          </span>
          <input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}"
                 value="${value}" data-tune-key="${spec.key}" />
        </label>`;
      })
      .join('');

    this.tuneMenu.innerHTML = `
      <div class="tune-menu__head">
        <div class="tune-menu__title">${tuneTitle(id, panel)}</div>
        <button type="button" class="tune-menu__close" data-tune-close aria-label="Close">
          <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M2 2l8 8M10 2 2 10"/>
          </svg>
        </button>
      </div>
      ${shockRow}
      ${sliders || '<div class="tune-menu__hint">No knobs on this skill.</div>'}
    `;
  }

  _paintVariantMenu(id) {
    const state = variantState[id] ?? {};
    const textures = TEXTURES[id] ?? {};
    const paletteChips = [
      `<button type="button" class="variant-chip ${state.palette === 'default' ? 'is-on' : ''}" data-kind="palette" data-value="default">
        <span class="variant-chip__swatch" style="background:#8aa0b4"></span>Default
      </button>`,
      ...Object.entries(PALETTES).map(
        ([key, pal]) =>
          `<button type="button" class="variant-chip ${state.palette === key ? 'is-on' : ''}" data-kind="palette" data-value="${key}">
            <span class="variant-chip__swatch" style="background:${pal.swatch}"></span>${pal.label}
          </button>`
      )
    ].join('');

    const textureKeys = Object.keys(textures);
    const textureRow = textureKeys.length
      ? `<div class="variant-menu__label">Texture</div>
         <div class="variant-menu__row variant-menu__row--wrap">
           ${textureKeys
             .map(
               (key) =>
                 `<button type="button" class="variant-chip ${state.texture === key ? 'is-on' : ''}" data-kind="texture" data-value="${key}">${textures[key].label}</button>`
             )
             .join('')}
         </div>`
      : '';

    const sizeRow =
      id === 'fireBolt'
        ? `<div class="variant-menu__label">Size</div>
           <div class="variant-menu__row">
             ${Object.entries(BOLT_SIZES)
               .map(
                 ([key, size]) =>
                   `<button type="button" class="variant-chip variant-chip--wide ${state.size === key ? 'is-on' : ''}" data-kind="size" data-value="${key}">
                     ${size.label}<small>${size.hint}</small>
                   </button>`
               )
               .join('')}
           </div>`
        : '';

    this.variantMenu.innerHTML = `
      <div class="variant-menu__title">${ELEMENT_META[id]?.label ?? 'Variants'}</div>
      <div class="variant-menu__label">Colour</div>
      <div class="variant-menu__row variant-menu__row--wrap">${paletteChips}</div>
      ${textureRow}
      ${sizeRow}
    `;
  }

  /**
   * Drive one slot's cooldown sweep. Cooldowns are per ability, so this is
   * called once per element each frame.
   *
   * @param {string} element
   * @param {number} remaining seconds left
   * @param {number} total     the full cooldown, for the sweep angle
   */
  setCooldown(element, remaining, total) {
    const ratio = Math.max(0, Math.min(1, remaining / Math.max(total, 0.001)));
    if (Math.abs(ratio - (this._cooldownShown.get(element) ?? -1)) < 0.01) return;
    this._cooldownShown.set(element, ratio);
    const cooling = ratio > 0.001;
    for (const card of this.root.querySelectorAll(`.ability-card[data-element="${element}"]`)) {
      card.style.setProperty('--cooldown', ratio);
      card.classList.toggle('is-cooling', cooling);
    }
  }

  /**
   * Drive one self buff's slot.
   *
   * One sweep, two meanings: while the buff holds it drains from full, and once
   * it has expired it fills back up as the cooldown runs off. They are told
   * apart by the class, not by the number — charged reads as accent and keeps
   * the glyph lit, cooling reads as the same dark wipe every other slot uses.
   *
   * @param {HTMLElement} card
   * @param {{active: boolean|null, ratio: number}} shown last state pushed
   * @param {boolean} active
   * @param {number} ratio 0..1 — buff left while active, cooldown left after
   */
  _setBuff(card, shown, active, ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (active === shown.active && Math.abs(clamped - shown.ratio) < 0.01) return;
    shown.active = active;
    shown.ratio = clamped;

    card.style.setProperty('--cooldown', clamped);
    card.classList.toggle('is-charged', active);
    card.classList.toggle('is-cooling', !active && clamped > 0.001);
  }

  _setBuffGroup(cards, shown, active, ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (active === shown.active && Math.abs(clamped - shown.ratio) < 0.01) return;
    shown.active = active;
    shown.ratio = clamped;
    for (const card of cards) {
      card.style.setProperty('--cooldown', clamped);
      card.classList.toggle('is-charged', active);
      card.classList.toggle('is-cooling', !active && clamped > 0.001);
    }
  }

  /** @see _setBuff */
  setBoost(active, ratio) {
    this._setBuffGroup(this.boostCards, this._boostShown, active, ratio);
  }

  /** @see _setBuff */
  setMagic(active, ratio) {
    this._setBuffGroup(this.magicCards, this._magicShown, active, ratio);
  }

  /** @see _setBuff */
  setFire(active, ratio) {
    this._setBuffGroup(this.fireCards, this._fireShown, active, ratio);
  }

  setPaused(paused) {
    this.pausedBadge.classList.toggle('is-visible', paused);
  }

  toggleHelp() {
    this.help.classList.toggle('is-hidden');
  }

  showToast(message, duration = 1600) {
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), duration);
  }

  /**
   * @param {number} dt
   * @param {() => {particles:number, spikes:number, calls:number}} collect
   *   Called only when the readout actually refreshes, so gathering the numbers
   *   (which means walking the particle pools) stays off the hot path.
   */
  update(dt, collect) {
    this._frames++;
    this._statsAccumulator += dt;
    if (this._statsAccumulator < 0.4) return;

    this._fps = Math.round(this._frames / this._statsAccumulator);
    this._frames = 0;
    this._statsAccumulator = 0;

    const info = collect();
    this.stats.fps.textContent = this._fps;
    this.stats.particles.textContent = info.particles;
    this.stats.spikes.textContent = info.spikes;
    this.stats.calls.textContent = info.calls;
  }
}

/** Boot screen helper. */
export class LoadingScreen {
  constructor(root) {
    this.element = root ?? document.getElementById('loader');
    this.fill = this.element?.querySelector('[data-loader-fill]') ?? document.getElementById('loader-fill');
    this.status = this.element?.querySelector('[data-loader-status]') ?? document.getElementById('loader-status');
  }

  setProgress(ratio, message) {
    if (this.fill) this.fill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    if (message && this.status) this.status.textContent = message;
  }

  hide() {
    this.setProgress(1);
    setTimeout(() => this.element?.classList.add('is-hidden'), 220);
  }

  fail(message) {
    if (this.status) {
      this.status.textContent = message;
      this.status.style.color = '#c4786a';
    }
  }
}
