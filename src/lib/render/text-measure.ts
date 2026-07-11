import Konva from "konva";
import type { TextObject } from "@/lib/document/schema";
import { textNodeConfig } from "./node-configs";

/**
 * Text measurement (browser only). The document stores heightMm for every
 * object; for text it is derived from the wrap width + font metrics, so any
 * command that changes text-affecting props re-measures through here.
 * Fonts MUST be loaded (lib/fonts loadFont) before measuring.
 */
export function measureTextHeightMm(obj: TextObject): number {
  const node = new Konva.Text({
    ...textNodeConfig(obj),
    visible: true,
    opacity: 1,
    rotation: 0,
  });
  const height = node.height();
  node.destroy();
  return Math.max(height, 0.1);
}
