export const SCENE_KEYS = { Game: 'Game' } as const;
export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
