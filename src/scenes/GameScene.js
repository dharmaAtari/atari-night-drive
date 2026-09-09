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
import { Transform, Text, UserInput, USER_INPUT } from '../components/index.js';

export default class GameScene extends BaseScene {
  constructor() {
    super({ key: SceneKey.GAME });
  }

  build() {
    const { width, height } = this.scale.gameSize;
    const centreX = width / 2;

    this.addEntity(
      new Entity('game.title')
        .add(Transform({ x: centreX, y: height / 2 - 16 }))
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
        .add(Transform({ x: centreX, y: height / 2 + 32 }))
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

  updateEntities() {
    if (this.hint.get(USER_INPUT).action.justDown) {
      this.scene.start(SceneKey.MENU);
    }
  }
}
