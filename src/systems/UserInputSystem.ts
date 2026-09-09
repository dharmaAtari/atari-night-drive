/**
 * UserInputSystem — fans the scene's input out to every entity that wants it.
 *
 * The scene holds one authoritative `UserInput`, written by whichever device
 * system is active. This copies that state onto each entity carrying a
 * `UserInput` component, so gameplay code reads input off the entity it is
 * already working with instead of reaching back up into the scene.
 *
 * The copy is field-by-field on purpose. Assigning the button objects across
 * would leave every entity sharing one mutable object with the scene, so a
 * system that consumed an edge on one entity would silently consume it for all
 * of them.
 */
import type Entity from '../entities/Entity.js';
import { USER_INPUT, InputButton, type UserInputComponent } from '../components/index.js';

export default class UserInputSystem {
  update(entities: Entity[], sceneInput: UserInputComponent): void {
    for (const entity of entities) {
      if (!entity.active) continue;

      const target = entity.get(USER_INPUT);
      if (!target) continue;

      for (const button of Object.values(InputButton)) {
        const from = sceneInput[button];
        const to = target[button];
        to.down = from.down;
        to.justDown = from.justDown;
        to.justUp = from.justUp;
      }
    }
  }
}
