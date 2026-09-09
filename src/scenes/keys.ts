/**
 * Scene keys in one place, so scenes can hand off to each other without
 * importing each other — MenuScene starts the game and GameScene goes back to
 * the menu, which as direct imports would be a cycle.
 */
export const SceneKey = {
  MENU: 'MenuScene',
  GAME: 'GameScene',
} as const;

export type SceneKeyValue = (typeof SceneKey)[keyof typeof SceneKey];
