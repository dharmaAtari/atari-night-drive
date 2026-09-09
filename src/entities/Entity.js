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
 *   const highlight = new Entity('menu.highlight')
 *     .add(Transform({ x: 320, y: 240, depth: -1 }))
 *     .add(Shape({ kind: ShapeKind.RECTANGLE, width: 200, height: 28 }));
 *
 * `add` returns the entity, so a factory can build one in a single expression.
 * Subclassing works too (`class MenuItem extends Entity`) if a screen wants to
 * keep its own references tidy, but prefer plain factories in `entities/` —
 * an entity with methods on it stops being an entity.
 */

let nextId = 1;

export default class Entity {
  /**
   * @param {string} [name] optional debug label, e.g. 'menu.startButton'.
   *                        For logging and readable dumps only — never look an
   *                        entity up by it.
   */
  constructor(name = '') {
    /** @type {number} unique for the lifetime of the page */
    this.id = nextId++;

    this.name = name;

    /**
     * component key -> component. Null-prototype so a component named
     * 'constructor' or 'toString' can never collide with Object's own keys.
     * @type {Record<string, object>}
     */
    this.components = Object.create(null);

    /** Systems skip this entity when false. */
    this.active = true;
  }

  /**
   * Attach one or more components, each keyed by its own `type`. Attaching a
   * second component of the same type replaces the first.
   *
   * @param {...object} components
   * @returns {this} for chaining
   */
  add(...components) {
    for (const component of components) {
      if (!component || typeof component.type !== 'string') {
        throw new TypeError(
          `Entity ${this.describe()}: add() expects components built by a component ` +
            `factory (they carry a string 'type'), got ${JSON.stringify(component)}`,
        );
      }
      this.components[component.type] = component;
    }
    return this;
  }

  /**
   * @param {string} type a component key, e.g. `TEXT`
   * @returns {?object} the component, or null if it isn't attached
   */
  get(type) {
    return this.components[type] ?? null;
  }

  /**
   * True only when every listed component is attached — this is what systems
   * filter on.
   *
   * @param {...string} types
   */
  has(...types) {
    return types.every((type) => type in this.components);
  }

  /**
   * @param {...string} types
   * @returns {this} for chaining
   */
  remove(...types) {
    for (const type of types) {
      delete this.components[type];
    }
    return this;
  }

  /** Drop every component and mark the entity inactive. */
  destroy() {
    this.components = Object.create(null);
    this.active = false;
    return this;
  }

  /** @returns {string[]} the keys currently attached, for debugging */
  types() {
    return Object.keys(this.components);
  }

  /** @returns {string} short identifier for logs and error messages */
  describe() {
    return this.name ? `#${this.id} (${this.name})` : `#${this.id}`;
  }
}

export { Entity };
