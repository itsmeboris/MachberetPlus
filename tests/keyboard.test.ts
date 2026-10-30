import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Keyboard } from "../src/components/Keyboard";

describe("math keypad", () => {
  it("offers a decimal point and a compact three-digit first scan row", () => {
    const html = renderToStaticMarkup(
      createElement(Keyboard, { text: false, onKey: () => {} }),
    );
    expect(html).toContain('aria-label="נקודה עשרונית"');
    expect(html).toContain('aria-label="ספרות 1 עד 3"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain(">x</button>");
  });
});
