/**
 * Entity — an id with a bag of components, and nothing else.
 *
 * All the behaviour lives in systems; this class only exists so components have
 * somewhere to hang and so systems have something to query. Components key
 * themselves off their own `type` field, so attaching is just:
 *
 *   const title = new Entity('menu.title')
 *     .add(Transform({ x: 320, y: 120 }))
 *     .add(Text({ content: 'NIGHT DRIVE', fontSize: 32 }));
 *
 * `add` returns the entity, so a factory can build one in a single expression.
 * Subclassing works too (`class MenuItem extends Entity`) if a screen wants to
 * keep its own references tidy, but prefer plain factories in `entities/` —
 * an entity with methods on it stops being an entity.
 */
import type { AnyComponent, ComponentKey, ComponentMap } from '../components/index.js';

let nextId = 1;

export default class Entity {
  /** unique for the lifetime of the page */
  readonly id: number;

  /**
   * Optional debug label, e.g. 'menu.startButton'. For logging and readable
   * dumps only — never look an entity up by it.
   */
  name: string;

  /**
   * Component key -> component. Null-prototype so a component named
   * 'constructor' or 'toString' can never collide with Object's own keys.
   */
  components: Partial<ComponentMap>;

  /** Systems skip this entity when false. */
  active: boolean;

  constructor(name = '') {
    this.id = nextId++;
    this.name = name;
    this.components = Object.create(null) as Partial<ComponentMap>;
    this.active = true;
  }

  /**
   * Attach one or more components, each keyed by its own `type`. Attaching a
   * second component of the same type replaces the first.
   */
  add(...components: AnyComponent[]): this {
    for (const component of components) {
      if (!component || typeof component.type !== 'string') {
        throw new TypeError(
          `Entity ${this.describe()}: add() expects components built by a component ` +
            `factory (they carry a string 'type'), got ${JSON.stringify(component)}`,
        );
      }
      // The union guarantees key and value line up, but TS cannot see that
      // through a dynamic key on a discriminated union.
      (this.components as Record<string, AnyComponent>)[component.type] = component;
    }
    return this;
  }

  /** The component, or null if it isn't attached. */
  get<K extends ComponentKey>(type: K): ComponentMap[K] | null {
    return (this.components[type] as ComponentMap[K] | undefined) ?? null;
  }

  /**
   * True only when every listed component is attached — this is what systems
   * filter on.
   */
  has(...types: ComponentKey[]): boolean {
    return types.every((type) => type in this.components);
  }

  remove(...types: ComponentKey[]): this {
    for (const type of types) {
      delete this.components[type];
    }
    return this;
  }

  /** Drop every component and mark the entity inactive. */
  destroy(): this {
    this.components = Object.create(null) as Partial<ComponentMap>;
    this.active = false;
    return this;
  }

  /** The keys currently attached, for debugging. */
  types(): string[] {
    return Object.keys(this.components);
  }

  /** Short identifier for logs and error messages. */
  describe(): string {
    return this.name ? `#${this.id} (${this.name})` : `#${this.id}`;
  }
}

export { Entity };
