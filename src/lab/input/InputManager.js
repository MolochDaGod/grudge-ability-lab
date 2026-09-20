// @ts-nocheck
import { Vector2 } from 'three';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Normalises pointer + keyboard input into a small event vocabulary.
 *
 * Events:
 *   `pointer:move` (ndc)          — every move, armed or not
 *   `pointer:confirm` (ndc)       — left click on the viewport
 *   `action` (name, slot)         — everything else, already named by intent.
 *                                   `ability` carries the 0-based slot index,
 *                                   which App maps through `ELEMENTS`; `boost`
 *                                   and `magic` carry nothing, because the self
 *                                   buffs have no slot and nothing to aim.
 *
 * Pointer events that begin on top of DOM UI (the editor, the HUD) are ignored
 * so dragging a slider never fires the ability.
 */
export class InputManager extends EventEmitter {
  constructor(domElement) {
    super();
    this.dom = domElement;
    this.pointer = new Vector2(); // NDC
    this.keys = new Set();
    this.enabled = true;
    /** `lab` uses Q E R F V X Z 1–5. `play` uses the bound 1–7 R F bar. */
    this.mode = 'lab';
    /** When the Tab library is open, ability keys are ignored. */
    this.blocked = false;

    this._bind();
  }

  _bind() {
    this.dom.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.dom.addEventListener('contextmenu', this._onContextMenu);
  }

  _onContextMenu = (event) => event.preventDefault();

  _updatePointer(event) {
    this.pointer.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
  }

  _onPointerDown = (event) => {
    if (!this.enabled) return;
    if (event.target !== this.dom) return; // started on UI

    this._updatePointer(event);

    if (event.button === 0) {
      this.emit('pointer:confirm', this.pointer);
    } else if (event.button === 2) {
      // Right button also orbits (OrbitControls owns the drag); putting an armed
      // cast away on the same press is the convention players expect.
      this.emit('action', 'cancel');
    }
  };

  _onPointerMove = (event) => {
    this._updatePointer(event);
    this.emit('pointer:move', this.pointer);
  };

  _onKeyDown = (event) => {
    if (event.repeat) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    this.keys.add(event.code);

    if (event.code === 'Tab') {
      event.preventDefault();
      this.emit('action', 'toggleCodex');
      return;
    }

    const uiKey =
      event.code === 'Escape' ||
      event.code === 'KeyH' ||
      event.code === 'KeyG' ||
      event.code === 'KeyC' ||
      event.code === 'KeyP';
    if (this.blocked && !uiKey) return;

    if (this.mode === 'play') {
      this._playKey(event.code);
      return;
    }

    switch (event.code) {
      // Letter keys: Q E R F original crowns, V X Z bending streams.
      // Digit 1–5 are the combat test row: slash, bolt, nova, pyre, earth.
      case 'KeyQ':
        this.emit('action', 'ability', 0);
        break;
      case 'Digit1':
        this.emit('action', 'ability', 7); // cinderSlash
        break;
      case 'KeyE':
        this.emit('action', 'ability', 1);
        break;
      case 'Digit2':
        this.emit('action', 'ability', 8); // fireBolt
        break;
      case 'KeyR':
        this.emit('action', 'ability', 2);
        break;
      case 'Digit3':
        this.emit('action', 'ability', 9); // ice — Frost Lance
        break;
      case 'KeyF':
        this.emit('action', 'ability', 3);
        break;
      case 'Digit4':
        this.emit('action', 'ability', 10); // thunder — Storm Lance
        break;
      case 'KeyV':
        this.emit('action', 'ability', 12); // fireBend
        break;
      case 'Digit5':
        this.emit('action', 'ability', 11); // beam — Nova Beam
        break;
      case 'KeyX':
        this.emit('action', 'ability', 13); // waterBend
        break;
      case 'KeyZ':
        this.emit('action', 'ability', 14); // airBend
        break;
      case 'KeyT':
      case 'Digit8':
        this.emit('action', 'ability', 7);
        break;
      case 'KeyY':
      case 'Digit9':
        this.emit('action', 'ability', 8);
        break;
      case 'KeyN':
      case 'Digit0':
        this.emit('action', 'ability', 9);
        break;
      case 'KeyB':
        this.emit('action', 'boost');
        break;
      case 'KeyM':
        this.emit('action', 'magic');
        break;
      case 'KeyK':
        this.emit('action', 'fire');
        break;
      case 'Escape':
        this.emit('action', 'cancel');
        break;
      case 'KeyH':
        this.emit('action', 'toggleHelp');
        break;
      case 'KeyG':
        this.emit('action', 'toggleEditor');
        break;
      case 'KeyC':
        this.emit('action', 'clear');
        break;
      case 'KeyP':
        this.emit('action', 'togglePause');
        break;
      default:
        break;
    }
  };

  _playKey(code) {
    const slotOf = {
      Digit1: '1',
      Digit2: '2',
      Digit3: '3',
      Digit4: '4',
      Digit5: '5',
      Digit6: '6',
      Digit7: '7',
      KeyR: 'R',
      KeyF: 'F'
    };
    const slot = slotOf[code];
    if (slot) {
      this.emit('action', 'loadout', slot);
      return;
    }
    switch (code) {
      case 'KeyB':
        this.emit('action', 'boost');
        break;
      case 'KeyM':
        this.emit('action', 'magic');
        break;
      case 'KeyK':
        this.emit('action', 'fire');
        break;
      case 'Escape':
        this.emit('action', 'cancel');
        break;
      case 'KeyH':
        this.emit('action', 'toggleHelp');
        break;
      case 'KeyG':
        this.emit('action', 'toggleEditor');
        break;
      case 'KeyC':
        this.emit('action', 'clear');
        break;
      case 'KeyP':
        this.emit('action', 'togglePause');
        break;
      default:
        break;
    }
  }

  _onKeyUp = (event) => {
    this.keys.delete(event.code);
  };

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    this.clear();
  }
}
