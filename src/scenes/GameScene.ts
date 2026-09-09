/**
 * GameScene — wires the systems together and runs the frame.
 *
 * It contains no gameplay rules. Every rule lives in a system in `src/systems/`,
 * and this scene's job is to own the world, own the entities, and call things in
 * the right order. If a rule ends up here, it is in the wrong file.
 *
 * The order below is not arbitrary and should not be reshuffled casually:
 *
 *   countdown    the 3-2-1 — builds and lights the road, moves nothing, then goes
 *   progression  advances the clock and the speed everything else is derived from
 *   spawn        extends the road ahead using that speed
 *   track        moves the car and rebuilds the segment window around it
 *   anchor       opens and closes throw windows against the new position
 *   rope         reads input against those windows — the verb
 *   drift        applies curvature, but only when the rope is not driving x
 *   light        drains power by the distance just travelled
 *   pickup       converts this frame's attach events into light
 *   collision    the single place a run can end
 *   camera       metres become pixels, once, here
 *   views        pixels become component values on entities
 *
 * Input is already current when this runs — `BaseScene` reads the devices and
 * fans them out before calling in — so the rope sees this frame's press, not
 * last frame's.
 *
 * The car entity is what carries `UserInput`, so the rope reads its intent off
 * the entity rather than reaching back into the scene. That is what would let a
 * second car, or a replay ghost, drop in without touching `RopeSystem`.
 */
import Phaser from 'phaser';
import BaseScene from './BaseScene.js';
import { SceneKey } from './keys.js';
import { COLLISION, USER_INPUT } from '../components/index.js';
import { RunState, createWorld, resetRun, type World } from '../world.js';
import { resolveSeed } from '../rng.js';
import { difficultyAt, progressionSystem } from '../systems/ProgressionSystem.js';
import { countdownSystem } from '../systems/CountdownSystem.js';
import { createTrackSystem } from '../systems/TrackSystem.js';
import { createHazardSpawnSystem, curvatureFromHazards, type HazardSpawnSystem } from '../systems/HazardSpawnSystem.js';
import { anchorSystem } from '../systems/AnchorSystem.js';
import { ropeSystem } from '../systems/RopeSystem.js';
import { driftSystem } from '../systems/DriftSystem.js';
import { lightSystem } from '../systems/LightSystem.js';
import { createPickupSystem, type PickupSystem } from '../systems/PickupSystem.js';
import { collisionSystem } from '../systems/CollisionSystem.js';
import { loadBest, saveBest, scoreSystem } from '../systems/ScoreSystem.js';
import { cameraSystem } from '../systems/CameraSystem.js';
import RoadViewSystem from '../systems/RoadViewSystem.js';
import ActorViewSystem, { type TextureSize } from '../systems/ActorViewSystem.js';
import HudViewSystem from '../systems/HudViewSystem.js';
import AudioSystem from '../systems/AudioSystem.js';

/**
 * Longest frame the simulation will accept, in ms.
 *
 * A backgrounded tab hands back a delta of several seconds on the first frame
 * after it wakes. Fed through unclamped, the car would teleport past a hazard
 * without ever overlapping it, or straight off the road. Clamping means a stall
 * costs the player nothing rather than killing them.
 */
const MAX_DELTA_MS = 50;

/** Horizon height as a fraction of the canvas, per orientation. */
const HORIZON_LANDSCAPE = 0.45;
const HORIZON_PORTRAIT = 0.4;

export default class GameScene extends BaseScene {
  private world!: World;
  private trackSystem!: (world: World, dt: number) => void;
  private spawnSystem!: HazardSpawnSystem;
  private pickupSystem!: PickupSystem;
  private roadView!: RoadViewSystem;
  private actorView!: ActorViewSystem;
  private hudView!: HudViewSystem;
  private audio!: AudioSystem;

  /** Memoised, because the view systems ask for sizes many times per frame. */
  private readonly textureSizes = new Map<string, { width: number; height: number }>();

  constructor() {
    super({ key: SceneKey.GAME });
  }

  protected override build(): void {
    const config = this.gameConfig;

    this.world = createWorld(config);
    this.world.run.seed = resolveSeed(window.location.search, Date.now());

    this.spawnSystem = createHazardSpawnSystem(this.world.run.seed);
    // Curvature is sampled from the live hazard list, so the road bends exactly
    // where a curve hazard says it does and the two can never disagree.
    this.trackSystem = createTrackSystem(curvatureFromHazards(this.world));
    this.pickupSystem = createPickupSystem();
    this.audio = new AudioSystem(this.sound, config.audio.volume);

    const textureSize: TextureSize = (key) => this.lookupTextureSize(key);
    this.roadView = new RoadViewSystem();
    this.actorView = new ActorViewSystem(textureSize);
    this.hudView = new HudViewSystem(textureSize);

    // Registration order does not set draw order — Transform.depth does — but it
    // does set the order systems walk them in, so keep it readable.
    for (const entity of this.roadView.entities()) this.addEntity(entity);
    for (const entity of this.actorView.entities()) this.addEntity(entity);
    for (const entity of this.hudView.entities()) this.addEntity(entity);

    loadBest(this.world);

    this.cameras.main.setBackgroundColor(config.display.backgroundColor);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__NIGHT_DRIVE__ = {
        world: this.world,
        entities: this.entities,
      };
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.dispose());
  }

  protected override layout(width: number, height: number): void {
    const { viewport, config } = this.world;
    viewport.width = width;
    viewport.height = height;
    viewport.portrait = width / height < config.display.portraitBreakpoint;
    viewport.horizonY = height * (viewport.portrait ? HORIZON_PORTRAIT : HORIZON_LANDSCAPE);
  }

  protected override updateEntities(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;
    const world = this.world;

    const input = this.actorView.car.get(USER_INPUT)!;
    const held = input.action.down;
    const pressed = input.action.justDown;

    // Browsers refuse to start an AudioContext without a gesture; a press is
    // that gesture, whatever else it does.
    if (pressed) {
      this.audio.unlock();
      if (world.run.state === RunState.OVER) this.restart();
    }

    if (world.run.state === RunState.RUNNING) {
      progressionSystem(world, dt);
      this.spawnSystem.run(world, difficultyAt(world.config, world.run.elapsed));
      this.trackSystem(world, dt);
      anchorSystem(world);
      ropeSystem(world, held, pressed, dt);
      driftSystem(world, dt);
      lightSystem(world, dt, world.car.speed * dt);
      this.pickupSystem.run(world);

      const collider = this.actorView.car.get(COLLISION)!;
      if (collisionSystem(world, collider)) {
        scoreSystem(world);
        saveBest(world);
        this.cameras.main.shake(220, 0.012);
      }
    } else if (world.run.state === RunState.COUNTDOWN) {
      countdownSystem(world, dt);
      // The road ahead is built, populated and lit before anything moves, so
      // the first thing the player sees is what they are about to drive into.
      this.spawnSystem.run(world, difficultyAt(world.config, 0));
      this.trackSystem(world, 0);
      anchorSystem(world);
    } else if (world.run.state === RunState.CRASHING) {
      world.run.crashTimer -= dt;
      if (world.run.crashTimer <= 0) world.run.state = RunState.OVER;
    }

    cameraSystem(world);

    this.roadView.update(world);
    this.actorView.update(world, dt);
    this.hudView.update(world, dt);

    this.audio.update(world, dt);

    // The event queue is one frame long by contract. Everything that needed to
    // see this frame's events has run by now.
    world.events.length = 0;
  }

  /** Immediate restart from the beginning. No lives, no checkpoints. */
  private restart(): void {
    const seed = resolveSeed(window.location.search, Date.now());
    resetRun(this.world, seed);
    this.spawnSystem.reset(seed);
    this.pickupSystem.reset();
  }

  /**
   * Frame size rather than source size, so a sliced sheet reports one cell. The
   * view systems scale art to a world-derived size and would stretch a walk
   * cycle across four frames' width otherwise.
   */
  private lookupTextureSize(key: string): { width: number; height: number } {
    const cached = this.textureSizes.get(key);
    if (cached) return cached;

    if (!this.textures.exists(key)) return { width: 0, height: 0 };

    const frame = this.textures.get(key).get(0);
    const size = { width: frame.width, height: frame.height };
    this.textureSizes.set(key, size);
    return size;
  }
}
