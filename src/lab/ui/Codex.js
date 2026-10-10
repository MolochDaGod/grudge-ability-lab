// @ts-nocheck
import { ELEMENTS, ELEMENT_META, BOOST_META, MAGIC_META, FIRE_META, SPELLTELEPORTS } from '../config/settings.js';
import { ELEMENT_SIGILS, BOOST_SIGIL, MAGIC_SIGIL, FIRE_SIGIL } from './glyphs.js';
import { PLAY_SLOTS, snapshotAbility } from '../config/loadout.js';
import { weaponCatalog } from '../config/weaponCatalog.js';
import {
  buildSkillPack,
  packFromSaved,
  downloadSkillPack,
  parseImportedPack,
  lastFallback,
  downloadRuntimeGuide,
  downloadRuntimeZip,
  downloadLabZip
} from '../config/skillPack.js';

const COMBAT = ELEMENTS.filter((id) => !SPELLTELEPORTS.includes(id));

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function bindChips(kind, id, loadout) {
  const current = loadout?.slotOf(kind, id) ?? '';
  return PLAY_SLOTS.map(
    (slot) =>
      `<button type="button" class="codex-chip ${current === slot ? 'is-on' : ''}" data-bind-slot="${slot}" data-bind-kind="${kind}" data-bind-id="${esc(id)}">${slot}</button>`
  ).join('');
}

/**
 * Tab library: every lab skill, named saves, and canonical weapon skills.
 * Opening it never arms a slot. Bind chips write the play bar (1–7 R F).
 */
export class Codex {
  constructor(root, hooks = {}) {
    this.root = root;
    this.hooks = hooks;
    this.loadout = hooks.loadout ?? null;
    this.open = false;
    this.tab = 'saved';
    this.query = '';
    this.weaponType = 'SWORD';
    this.weaponSlot = 'all';
    this.picked = null;
    this.dlKind = 'json';
    this.lastUsed = null;

    root.innerHTML = `
      <div class="codex__veil" data-codex-veil></div>
      <div class="codex__sheet" role="dialog" aria-label="Abilities">
        <header class="codex__head">
          <div>
            <h2>Saves</h2>
            <p>Tab opens saves. Download last cast as JSON, or the runtime zip for another Three.js game.</p>
          </div>
          <div class="codex__head-actions">
            <div class="codex__mode" data-codex-mode>
              <button type="button" class="codex-chip" data-hud-mode="lab">Lab</button>
              <button type="button" class="codex-chip" data-hud-mode="play">Play</button>
            </div>
            <button type="button" class="codex__close" data-codex-close aria-label="Close">
              <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M2 2l8 8M10 2 2 10"/>
              </svg>
            </button>
          </div>
        </header>

        <nav class="codex__tabs" data-codex-tabs>
          <button type="button" class="codex-tab is-on" data-tab="saved">Saved</button>
          <button type="button" class="codex-tab" data-tab="lab">Lab</button>
          <button type="button" class="codex-tab" data-tab="weapons">Weapons</button>
        </nav>

        <div class="codex__toolbar">
          <input class="codex__search" data-codex-search type="search" placeholder="Search skills" autocomplete="off" spellcheck="false" />
          <div class="codex__filters" data-codex-filters></div>
        </div>

        <div class="codex__grid" data-codex-grid></div>

        <footer class="codex__foot">
          <label class="codex__save">
            <span>Save as</span>
            <input data-codex-name type="text" maxlength="40" placeholder="My skill" autocomplete="off" />
          </label>
          <button type="button" class="codex-btn" data-codex-save>Save current</button>
          <button type="button" class="codex-btn" data-codex-dl-last>Download last</button>
          <button type="button" class="codex-btn codex-btn--ghost" data-codex-guide>README</button>
          <button type="button" class="codex-btn codex-btn--ghost" data-codex-runtime>Runtime zip</button>
          <button type="button" class="codex-btn codex-btn--ghost" data-codex-labzip>Lab zip</button>
          <button type="button" class="codex-btn codex-btn--ghost" data-codex-arm>Arm</button>
          <label class="codex-btn codex-btn--ghost codex-import">
            Import
            <input data-codex-import type="file" accept="application/json,.json,.js,text/javascript" hidden />
          </label>
          <div class="codex__hint" data-codex-hint>JSON is knobs. Runtime zip is the VFX. In another game: createSkillRuntime({ scene, camera }) then cast / apply / step. Repo is on the README.</div>
        </footer>
      </div>
    `;

    this.sheet = root.querySelector('.codex__sheet');
    this.grid = root.querySelector('[data-codex-grid]');
    this.filters = root.querySelector('[data-codex-filters]');
    this.search = root.querySelector('[data-codex-search]');
    this.nameInput = root.querySelector('[data-codex-name]');
    this.hint = root.querySelector('[data-codex-hint]');

    this._onKey = (event) => {
      if (!this.open) return;
      if (event.code === 'Escape' || event.code === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        this.hide();
      }
    };
    this._bind();
    this.hide();
  }

  setLoadout(loadout) {
    this.loadout = loadout;
    this.paint();
  }

  onCatalog() {
    if (this.tab === 'weapons') this.paint();
  }

  _bind() {
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.root.querySelector('[data-codex-veil]')?.addEventListener('pointerdown', () => this.hide());
    this.root.querySelector('[data-codex-close]')?.addEventListener('click', () => this.hide());

    this.root.querySelector('[data-codex-tabs]')?.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (!tab) return;
      this.tab = tab.dataset.tab;
      this.picked = null;
      this.paint();
    });

    this.root.querySelector('[data-codex-mode]')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-hud-mode]');
      if (!btn) return;
      this.hooks.onMode?.(btn.dataset.hudMode);
      this._syncMode();
    });

    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.paint();
    });

    this.filters.addEventListener('click', (event) => {
      const type = event.target.closest('[data-weapon-type]');
      const slot = event.target.closest('[data-weapon-slot]');
      if (type) this.weaponType = type.dataset.weaponType;
      if (slot) this.weaponSlot = slot.dataset.weaponSlot;
      if (type || slot) this.paint();
    });

    this.grid.addEventListener('error', (event) => {
      if (event.target?.tagName === 'IMG') event.target.remove();
    }, true);

    this.grid.addEventListener('click', (event) => {
      const bind = event.target.closest('[data-bind-slot]');
      if (bind) {
        event.preventDefault();
        this.hooks.onBind?.(bind.dataset.bindSlot, {
          kind: bind.dataset.bindKind,
          id: bind.dataset.bindId
        });
        this.paint();
        return;
      }
      const del = event.target.closest('[data-saved-del]');
      if (del) {
        this.hooks.onDeleteSaved?.(del.dataset.savedDel);
        if (this.picked?.id === del.dataset.savedDel) this.picked = null;
        this.paint();
        return;
      }
      const dl = event.target.closest('[data-saved-dl]');
      if (dl) {
        event.preventDefault();
        this._downloadSaved(dl.dataset.savedDl);
        return;
      }
      const lastDl = event.target.closest('[data-last-dl]');
      if (lastDl) {
        event.preventDefault();
        this.dlKind = lastDl.dataset.lastDl;
        this._downloadLast();
        this.paint();
        return;
      }
      const kindChip = event.target.closest('[data-dl-kind]');
      if (kindChip) {
        this.dlKind = kindChip.dataset.dlKind;
        this.paint();
        return;
      }
      const card = event.target.closest('[data-codex-card]');
      if (!card) return;
      this.picked = {
        kind: card.dataset.kind,
        id: card.dataset.id,
        element: card.dataset.element
      };
      this.hooks.onSelect?.(this.picked);
      this.paint();
    });

    this.root.querySelector('[data-codex-save]')?.addEventListener('click', () => {
      const name = this.nameInput.value.trim();
      this.hooks.onSave?.(name, this.picked);
      this.nameInput.value = '';
      this.tab = 'saved';
      this.paint();
    });

    this.root.querySelector('[data-codex-arm]')?.addEventListener('click', () => {
      if (!this.picked) return;
      this.hooks.onArm?.(this.picked);
      this.hide();
    });

    this.root.querySelector('[data-codex-dl-last]')?.addEventListener('click', () => {
      this._downloadLast();
    });

    this.root.querySelector('[data-codex-guide]')?.addEventListener('click', () => {
      downloadRuntimeGuide();
      this.hooks.onToast?.('Downloaded runtime README');
    });

    this.root.querySelector('[data-codex-runtime]')?.addEventListener('click', () => {
      downloadRuntimeZip();
      this.hooks.onToast?.('Downloaded Ability runtime zip');
    });

    this.root.querySelector('[data-codex-labzip]')?.addEventListener('click', () => {
      downloadLabZip();
      this.hooks.onToast?.('Downloaded lab source zip');
    });

    this.root.querySelector('[data-codex-import]')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const pack = parseImportedPack(String(reader.result ?? ''));
        if (!pack) {
          this.hooks.onToast?.('Could not read that file');
          return;
        }
        const item = this.loadout?.importPack(pack);
        if (!item) {
          this.hooks.onToast?.('Unknown skill in pack');
          return;
        }
        this.tab = 'saved';
        this.picked = { kind: 'saved', id: item.id, element: item.sourceId };
        this.paint();
        this.hooks.onToast?.(`Imported “${item.name}”`);
      };
      reader.readAsText(file);
    });
  }

  setLastUsed(last) {
    this.lastUsed = last;
    if (this.open && this.tab === 'saved') this.paint();
  }

  _resolveLast() {
    return this.lastUsed || this.hooks.getLastUsed?.() || lastFallback(this.hooks.getElement?.());
  }

  _downloadPack(pack) {
    if (!pack) {
      this.hooks.onToast?.('Nothing to download — cast a skill first');
      return;
    }
    if (downloadSkillPack(pack, this.dlKind)) {
      const kind = this.dlKind === 'js' ? 'JS module' : this.dlKind === 'glb' ? 'GLB container' : 'JSON';
      this.hooks.onToast?.(`Downloaded ${pack.name} (${kind})`);
    }
  }

  _downloadLast() {
    const last = this._resolveLast();
    if (!last?.element) {
      this.hooks.onToast?.('Cast a skill first');
      return;
    }
    const pack = buildSkillPack({
      labId: last.element,
      name: last.label,
      snapshot: snapshotAbility(last.element)
    });
    this._downloadPack(pack);
  }

  _downloadSaved(id) {
    const item = this.loadout?.getSaved(id);
    this._downloadPack(packFromSaved(item));
  }

  show(options = {}) {
    this.open = true;
    this.tab = options.tab || 'saved';
    this.root.hidden = false;
    this.root.classList.remove('is-hidden');
    this.paint();
    this.search.focus();
    window.addEventListener('keydown', this._onKey, true);
    this.hooks.onOpen?.(true);
  }

  hide() {
    this.open = false;
    this.root.hidden = true;
    this.root.classList.add('is-hidden');
    window.removeEventListener('keydown', this._onKey, true);
    this.hooks.onOpen?.(false);
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  paint() {
    if (!this.root) return;
    for (const tab of this.root.querySelectorAll('[data-tab]')) {
      tab.classList.toggle('is-on', tab.dataset.tab === this.tab);
    }
    this._syncMode();
    if (this.tab === 'lab') {
      this.filters.innerHTML = '';
      this.grid.innerHTML = this._labGrid();
    } else if (this.tab === 'saved') {
      this.filters.innerHTML = '';
      this.grid.innerHTML = this._savedGrid();
    } else {
      this.filters.innerHTML = this._weaponFilters();
      this.grid.innerHTML = this._weaponGrid();
    }
    this._syncHint();
  }

  _syncMode() {
    const mode = this.loadout?.mode ?? 'lab';
    for (const btn of this.root.querySelectorAll('[data-hud-mode]')) {
      btn.classList.toggle('is-on', btn.dataset.hudMode === mode);
    }
  }

  _syncHint() {
    if (!this.picked) {
      this.hint.textContent = 'Pick a skill. Bind does not arm it.';
      return;
    }
    const label =
      this.picked.kind === 'lab'
        ? ELEMENT_META[this.picked.id]?.label
        : this.picked.kind === 'saved'
          ? this.loadout?.getSaved(this.picked.id)?.name
          : weaponCatalog.byId.get(this.picked.id)?.name;
    this.hint.textContent = `${label ?? 'Skill'} · JSON for Three.js, JS to apply(), GLB extras only.`;
  }

  _matches(text) {
    if (!this.query) return true;
    return String(text).toLowerCase().includes(this.query);
  }

  _labGrid() {
    const groups = [
      { title: 'Combat', ids: COMBAT, kind: 'lab' },
      { title: 'Spellteleport', ids: SPELLTELEPORTS, kind: 'lab' }
    ];
    const cards = [];
    for (const group of groups) {
      const items = group.ids.filter((id) => {
        const meta = ELEMENT_META[id];
        return this._matches(`${meta?.label ?? id} ${id} ${meta?.key ?? ''}`);
      });
      if (!items.length) continue;
      cards.push(`<div class="codex-group">${esc(group.title)}</div>`);
      for (const id of items) cards.push(this._labCard(id));
    }

    const buffs = [
      { id: 'boost', meta: BOOST_META, glyph: BOOST_SIGIL },
      { id: 'magic', meta: MAGIC_META, glyph: MAGIC_SIGIL },
      { id: 'fire', meta: FIRE_META, glyph: FIRE_SIGIL }
    ].filter((row) => this._matches(`${row.meta.label} ${row.meta.key}`));
    if (buffs.length) {
      cards.push(`<div class="codex-group">Buffs</div>`);
      for (const row of buffs) {
        cards.push(`<article class="codex-card is-buff" style="--accent:${row.meta.accent}">
          <div class="codex-card__key">${esc(row.meta.key)}</div>
          <div class="codex-card__glyph">${row.glyph}</div>
          <div class="codex-card__name">${esc(row.meta.label)}</div>
          <div class="codex-card__meta">self buff · ${esc(row.meta.key)}</div>
        </article>`);
      }
    }
    return cards.join('') || `<div class="codex-empty">No lab skills match.</div>`;
  }

  _labCard(id) {
    const meta = ELEMENT_META[id];
    const on = this.picked?.kind === 'lab' && this.picked.id === id;
    return `<article class="codex-card ${on ? 'is-on' : ''}" data-codex-card data-kind="lab" data-id="${id}" data-element="${id}" style="--accent:${meta.accent}">
      <div class="codex-card__key">${esc(meta.key || 'click')}</div>
      <div class="codex-card__glyph">${ELEMENT_SIGILS[id] ?? ''}</div>
      <div class="codex-card__name">${esc(meta.label)}</div>
      <div class="codex-card__meta">${SPELLTELEPORTS.includes(id) ? 'spellteleport' : 'lab vfx'}</div>
      <div class="codex-card__binds">${bindChips('lab', id, this.loadout)}</div>
    </article>`;
  }

  _lastBanner() {
    const last = this._resolveLast();
    const label = last?.label || last?.element || 'None yet';
    const via = last?.via === 'cast' ? 'last cast' : last?.via === 'selected' ? 'selected' : 'ready';
    return `<div class="codex-last">
      <div class="codex-last__copy">
        <b>Last used</b>
        <span>${esc(label)}</span>
        <small>${esc(via)} · JSON is the skill. JS applies it. GLB holds extras, not the mesh.</small>
      </div>
      <div class="codex-last__formats">
        <button type="button" class="codex-chip ${this.dlKind === 'json' ? 'is-on' : ''}" data-dl-kind="json">JSON</button>
        <button type="button" class="codex-chip ${this.dlKind === 'js' ? 'is-on' : ''}" data-dl-kind="js">JS</button>
        <button type="button" class="codex-chip ${this.dlKind === 'glb' ? 'is-on' : ''}" data-dl-kind="glb">GLB</button>
      </div>
      <button type="button" class="codex-btn" data-last-dl="${this.dlKind}">Download last</button>
    </div>`;
  }

  _savedGrid() {
    const items = (this.loadout?.saved ?? []).filter((row) =>
      this._matches(`${row.name} ${row.sourceId} ${row.weaponId ?? ''}`)
    );
    const cards = items.length
      ? items
          .map((row) => {
            const meta = ELEMENT_META[row.sourceId];
            const on = this.picked?.kind === 'saved' && this.picked.id === row.id;
            return `<article class="codex-card ${on ? 'is-on' : ''}" data-codex-card data-kind="saved" data-id="${esc(row.id)}" data-element="${row.sourceId}" style="--accent:${meta?.accent ?? '#7fd6ff'}">
          <div class="codex-card__key">${esc(this.loadout?.slotOf('saved', row.id) ?? '')}</div>
          <div class="codex-card__glyph">${ELEMENT_SIGILS[row.sourceId] ?? ''}</div>
          <div class="codex-card__name">${esc(row.name)}</div>
          <div class="codex-card__meta">${esc(meta?.label ?? row.sourceId)}${row.weaponId ? ` · ${esc(row.weaponId)}` : ''}</div>
          <div class="codex-card__binds">${bindChips('saved', row.id, this.loadout)}</div>
          <div class="codex-card__row">
            <button type="button" class="codex-card__del" data-saved-dl="${esc(row.id)}">Download</button>
            <button type="button" class="codex-card__del" data-saved-del="${esc(row.id)}" aria-label="Delete saved skill">Delete</button>
          </div>
        </article>`;
          })
          .join('')
      : `<div class="codex-empty">Nothing saved yet. Cast, tune Shape / Motion, then Save current. Download last still works without saving.</div>`;
    return `${this._lastBanner()}${cards}`;
  }

  _weaponFilters() {
    const types = ['ALL', ...(weaponCatalog.types ?? [])];
    const slots = ['all', 'primary', 'secondary', 'ability', 'ultimate'];
    const typeChips = types
      .map(
        (type) =>
          `<button type="button" class="codex-chip ${this.weaponType === type ? 'is-on' : ''}" data-weapon-type="${type}">${type === 'ALL' ? 'All' : type}</button>`
      )
      .join('');
    const slotChips = slots
      .map(
        (slot) =>
          `<button type="button" class="codex-chip ${this.weaponSlot === slot ? 'is-on' : ''}" data-weapon-slot="${slot}">${slot === 'all' ? 'All slots' : slot}</button>`
      )
      .join('');
    return `<div class="codex-chip-row">${typeChips}</div><div class="codex-chip-row">${slotChips}</div>`;
  }

  _weaponGrid() {
    if (!weaponCatalog.loaded) return `<div class="codex-empty">Loading canonical weapons…</div>`;
    const list = weaponCatalog.skills.filter((skill) => {
      if (this.weaponType !== 'ALL' && skill.weaponType !== this.weaponType) return false;
      if (this.weaponSlot !== 'all' && skill.slotType !== this.weaponSlot) return false;
      return this._matches(`${skill.name} ${skill.id} ${skill.weaponType} ${skill.slotType} ${skill.damageType} ${skill.description}`);
    });
    if (!list.length) return `<div class="codex-empty">No weapon skills match.</div>`;
    return list
      .map((skill) => {
        const meta = ELEMENT_META[skill.labId];
        const on = this.picked?.kind === 'weapon' && this.picked.id === skill.id;
        const icon = skill.iconUrl
          ? `<img class="codex-card__icon" src="${esc(skill.iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : `<div class="codex-card__glyph">${ELEMENT_SIGILS[skill.labId] ?? ''}</div>`;
        return `<article class="codex-card ${on ? 'is-on' : ''}" data-codex-card data-kind="weapon" data-id="${esc(skill.id)}" data-element="${skill.labId}" style="--accent:${meta?.accent ?? '#7fd6ff'}">
          <div class="codex-card__key">${esc(skill.slotType)}</div>
          ${icon}
          <div class="codex-card__name">${esc(skill.name)}</div>
          <div class="codex-card__meta">${esc(skill.weaponType)} · ${esc(skill.damageType)} · → ${esc(meta?.label ?? skill.labId)}</div>
          <div class="codex-card__binds">${bindChips('weapon', skill.id, this.loadout)}</div>
        </article>`;
      })
      .join('');
  }
}
