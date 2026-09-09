/**
 * MenuScene — PLAY / QUIT with a box highlighting the current option.
 *
 * Three entities:
 *   PLAY           Transform + Text
 *   QUIT           Transform + Text
 *   selection box  Transform + Shape + UserInput
 *
 * Only the box carries `UserInput`, because it is the only one the player
 * moves. `updateEntities` reads up/down off that component, advances the
 * selected index, and writes the chosen option's position into the box's
 * `Transform` — the labels never move.
 *
 * Each row pairs its entity with what activating it does. The handler lives on
 * the scene rather than the entity: entities stay data, and the scene is what
 * has the authority to change scenes.
 */
import BaseScene from './BaseScene.js';
import { SceneKey } from './keys.js';
import type Entity from '../entities/Entity.js';
import menuOption from '../entities/menuOption.js';
import selectionBox from '../entities/selectionBox.js';
import titleMark from '../entities/titleMark.js';
import { SPRITE, TRANSFORM, USER_INPUT } from '../components/index.js';

/** Vertical gap between menu rows, in pixels. */
const ROW_SPACING = 56;

/** Title mark width, as a fraction of the canvas. */
const TITLE_WIDTH_RATIO = 0.42;

interface MenuRow {
  entity: Entity;
  activate: () => void;
}

export default class MenuScene extends BaseScene {
  private rows: MenuRow[] = [];
  private box!: Entity;
  private title!: Entity;

  /** Index into `rows` of the highlighted option. */
  private selected = 0;

  constructor() {
    super({ key: SceneKey.MENU });
  }

  protected override build(): void {
    this.title = this.addEntity(titleMark());

    // Positions are set by layout(), which also re-runs on resize.
    this.rows = [
      {
        entity: this.addEntity(menuOption({ label: 'PLAY', x: 0, y: 0 })),
        activate: () => this.startGame(),
      },
      {
        entity: this.addEntity(menuOption({ label: 'QUIT', x: 0, y: 0 })),
        activate: () => this.quitGame(),
      },
    ];

    this.box = this.addEntity(selectionBox({ x: 0, y: 0 }));
    this.selected = 0;
  }

  protected override layout(width: number, height: number): void {
    const centreX = width / 2;
    const firstY = height / 2 + ROW_SPACING;

    this.layoutTitle(centreX, height * 0.3, width);

    this.rows.forEach((row, index) => {
      const transform = row.entity.get(TRANSFORM);
      if (!transform) return;
      transform.x = centreX;
      transform.y = firstY + index * ROW_SPACING;
    });

    this.moveBoxToSelection();
  }

  /** Scales the mark to a fraction of the canvas, from its own texture size. */
  private layoutTitle(centreX: number, y: number, width: number): void {
    const transform = this.title.get(TRANSFORM);
    const sprite = this.title.get(SPRITE);
    if (!transform || !sprite) return;

    transform.x = centreX;
    transform.y = y;

    if (!this.textures.exists(sprite.texture)) return;
    const source = this.textures.get(sprite.texture).get(0);
    const scale = source.width > 0 ? (width * TITLE_WIDTH_RATIO) / source.width : 1;
    transform.scaleX = scale;
    transform.scaleY = scale;
  }

  protected override updateEntities(): void {
    const input = this.box.get(USER_INPUT);
    if (!input) return;

    const count = this.rows.length;

    // justDown, not down: one row per press, or holding a key would run the
    // whole list past in three frames.
    if (input.up.justDown) {
      this.selected = (this.selected - 1 + count) % count;
    }
    if (input.down.justDown) {
      this.selected = (this.selected + 1) % count;
    }

    this.moveBoxToSelection();

    if (input.action.justDown) {
      this.rows[this.selected]?.activate();
    }
  }

  /** Parks the highlight on the selected option. */
  private moveBoxToSelection(): void {
    const target = this.rows[this.selected]?.entity.get(TRANSFORM);
    const box = this.box.get(TRANSFORM);
    if (!target || !box) return;
    box.x = target.x;
    box.y = target.y;
  }

  private startGame(): void {
    this.events.emit('menu:selected', 'PLAY');
    this.scene.start(SceneKey.GAME);
  }

  /**
   * Placeholder: a page cannot close itself unless it opened itself, so this
   * only announces the choice for whatever is hosting the game to act on.
   */
  private quitGame(): void {
    this.events.emit('menu:selected', 'QUIT');
    console.log('[night-drive] quit selected');
  }
}
