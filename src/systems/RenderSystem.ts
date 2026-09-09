/**
 * RenderSystem — draws entities that have a `Transform` and something visible.
 *
 * Phaser game objects are created the first time an entity is seen and then
 * kept in the view maps, keyed by entity id. Every later frame only syncs the
 * changed fields onto the existing object — rebuilding them each frame would
 * thrash the display list.
 *
 * Consequence worth knowing: a shape's `kind` and a circle's `radius` are read
 * once, at creation. Change those and you need a new entity. `Transform`,
 * colours, visibility, text content and rectangle size all sync every frame.
 */
import Phaser from 'phaser';
import type Entity from '../entities/Entity.js';
import {
  TRANSFORM,
  SHAPE,
  TEXT,
  ShapeKind,
  type ShapeComponent,
  type TextComponent,
  type TransformComponent,
} from '../components/index.js';

/** The Phaser shape objects we build, all of which share the Shape base API. */
type ShapeView = Phaser.GameObjects.Shape;

export default class RenderSystem {
  private readonly scene: Phaser.Scene;
  private readonly shapeViews = new Map<number, ShapeView>();
  private readonly textViews = new Map<number, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(entities: Entity[]): void {
    for (const entity of entities) {
      const transform = entity.get(TRANSFORM);
      if (!transform) continue;

      const shape = entity.get(SHAPE);
      if (shape) {
        let view = this.shapeViews.get(entity.id);
        if (!view) {
          view = this.createShapeView(shape);
          this.shapeViews.set(entity.id, view);
        }
        this.applyTransform(view, transform);
        this.applyShape(view, shape);
        view.setVisible(entity.active && shape.visible);
      }

      const text = entity.get(TEXT);
      if (text) {
        let view = this.textViews.get(entity.id);
        if (!view) {
          view = this.createTextView(text);
          this.textViews.set(entity.id, view);
        }
        this.applyTransform(view, transform);
        this.applyText(view, text);
        view.setVisible(entity.active && text.visible);
      }
    }
  }

  /** Tear down every game object this system made. Call on scene shutdown. */
  destroy(): void {
    for (const view of this.shapeViews.values()) view.destroy();
    for (const view of this.textViews.values()) view.destroy();
    this.shapeViews.clear();
    this.textViews.clear();
  }

  /** Drop the views for one entity, e.g. after `entity.destroy()`. */
  forget(entityId: number): void {
    this.shapeViews.get(entityId)?.destroy();
    this.textViews.get(entityId)?.destroy();
    this.shapeViews.delete(entityId);
    this.textViews.delete(entityId);
  }

  // --- creation -----------------------------------------------------------

  private createShapeView(shape: ShapeComponent): ShapeView {
    const add = this.scene.add;
    // Phaser reads "no fill" as an undefined colour, while our components say null.
    const fill = shape.fillColor ?? undefined;
    const points = shape.points;
    const origin = { x: 0, y: 0 };

    switch (shape.kind) {
      case ShapeKind.RECTANGLE:
        return add.rectangle(0, 0, shape.width, shape.height, fill, shape.fillAlpha);
      case ShapeKind.CIRCLE:
        return add.circle(0, 0, shape.radius, fill, shape.fillAlpha);
      case ShapeKind.ELLIPSE:
        return add.ellipse(0, 0, shape.width, shape.height, fill, shape.fillAlpha);
      case ShapeKind.LINE: {
        const [a = origin, b = origin] = points;
        return add.line(0, 0, a.x, a.y, b.x, b.y, shape.strokeColor ?? 0xffffff, shape.strokeAlpha);
      }
      case ShapeKind.TRIANGLE: {
        const [a = origin, b = origin, c = origin] = points;
        return add.triangle(0, 0, a.x, a.y, b.x, b.y, c.x, c.y, fill, shape.fillAlpha);
      }
      case ShapeKind.POLYGON:
        return add.polygon(0, 0, points.flatMap((p) => [p.x, p.y]), fill, shape.fillAlpha);
      default: {
        const unreachable: never = shape.kind;
        throw new Error(`RenderSystem: unknown shape kind '${String(unreachable)}'`);
      }
    }
  }

  private createTextView(text: TextComponent): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, text.content, this.textStyle(text));
  }

  private textStyle(text: TextComponent): Phaser.Types.GameObjects.Text.TextStyle {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: text.fontFamily,
      fontSize: `${text.fontSize}px`,
      fontStyle: text.fontStyle,
      color: text.color,
      align: text.align,
    };
    if (text.strokeColor !== null && text.strokeWidth > 0) {
      style.stroke = text.strokeColor;
      style.strokeThickness = text.strokeWidth;
    }
    return style;
  }

  // --- per-frame sync -----------------------------------------------------

  private applyTransform(
    view: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth,
    transform: TransformComponent,
  ): void {
    view.setPosition(transform.x, transform.y);
    view.setRotation(transform.rotation);
    view.setScale(transform.scaleX, transform.scaleY);
    view.setDepth(transform.depth);
  }

  private applyShape(view: ShapeView, shape: ShapeComponent): void {
    view.setOrigin(shape.originX, shape.originY);

    if (shape.fillColor === null) view.setFillStyle();
    else view.setFillStyle(shape.fillColor, shape.fillAlpha);

    // Line takes its width through a different setter than the other shapes.
    if (shape.kind === ShapeKind.LINE) {
      if (shape.strokeWidth > 0) {
        (view as Phaser.GameObjects.Line).setLineWidth(shape.strokeWidth);
      }
    } else if (shape.strokeColor === null || shape.strokeWidth <= 0) {
      view.setStrokeStyle();
    } else {
      view.setStrokeStyle(shape.strokeWidth, shape.strokeColor, shape.strokeAlpha);
    }

    // Rectangles are the ones that get resized in practice (selection boxes,
    // bars). Other kinds keep the size they were created with. `setSize` lives
    // on Rectangle rather than the Shape base, hence the cast.
    if (
      shape.kind === ShapeKind.RECTANGLE &&
      (view.width !== shape.width || view.height !== shape.height)
    ) {
      (view as Phaser.GameObjects.Rectangle).setSize(shape.width, shape.height);
    }
  }

  private applyText(view: Phaser.GameObjects.Text, text: TextComponent): void {
    if (text.dirty || view.text !== text.content) {
      view.setText(text.content);
      text.dirty = false;
    }
    view.setOrigin(text.originX, text.originY);
    view.setAlpha(text.alpha);
  }
}
