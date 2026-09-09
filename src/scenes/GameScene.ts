/**
 * GameScene — where the driving will happen.
 *
 * A placeholder for now: two label entities and nothing to drive. It exists so
 * the menu has somewhere to hand off to, and so the scene switch and the input
 * handover across it can be exercised before there is any gameplay to break.
 *
 * The return-to-menu on `action` is scaffolding too — delete `updateEntities`
 * and the hint entity once real gameplay claims that button.
 */
import BaseScene from './BaseScene.js';
import { SceneKey } from './keys.js';
import Entity from '../entities/Entity.js';
import { Transform, Text, UserInput, TRANSFORM, USER_INPUT } from '../components/index.js';

/** Gap between the title and the hint under it, in pixels. */
const HINT_OFFSET = 48;

export default class GameScene extends BaseScene {
  private title!: Entity;
  private hint!: Entity;

  constructor() {
    super({ key: SceneKey.GAME });
  }

  protected override build(): void {
    this.title = this.addEntity(
      new Entity('game.title')
        .add(Transform())
        .add(
          Text({
            content: 'NIGHT DRIVE',
            fontFamily: 'monospace',
            fontSize: 28,
            color: '#ffffff',
            originX: 0.5,
            originY: 0.5,
          }),
        ),
    );

    // Carries the UserInput because it is the entity watching for the way out.
    this.hint = this.addEntity(
      new Entity('game.hint')
        .add(Transform())
        .add(
          Text({
            content: 'press SPACE to return',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#9db2ff',
            originX: 0.5,
            originY: 0.5,
          }),
        )
        .add(UserInput()),
    );
  }

  protected override layout(width: number, height: number): void {
    const centreX = width / 2;
    const centreY = height / 2;

    const title = this.title.get(TRANSFORM);
    if (title) {
      title.x = centreX;
      title.y = centreY - HINT_OFFSET / 3;
    }

    const hint = this.hint.get(TRANSFORM);
    if (hint) {
      hint.x = centreX;
      hint.y = centreY + HINT_OFFSET;
    }
  }

  protected override updateEntities(): void {
    if (this.hint.get(USER_INPUT)?.action.justDown) {
      this.scene.start(SceneKey.MENU);
    }
  }
}
