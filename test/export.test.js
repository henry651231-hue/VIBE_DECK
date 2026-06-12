import test from "node:test";
import assert from "node:assert/strict";
import { buildPptx } from "../server/export.js";

test("exports an editable PowerPoint buffer", async () => {
  const buffer = await buildPptx({
    name: "Test deck",
    aspect: "wide",
    defaults: { fontFamily: "Aptos" },
    context: { purpose: "Test export" },
    slides: [
      {
        background: "#ffffff",
        elements: [
          { id: "title", type: "text", text: "Editable title", x: 10, y: 10, w: 50, h: 12, fontSize: 28, color: "#111315", bold: true },
          { id: "shape", type: "shape", text: "Editable shape", x: 10, y: 30, w: 30, h: 20, fontSize: 18, color: "#111315", fill: "#e9edf2", borderColor: "#e9edf2", borderWidth: 0 },
        ],
        instructionNodes: [{ id: "node", nodeKind: "vibe", value: "Bold" }],
        edges: [{ id: "edge", source: "node", target: "title" }],
      },
    ],
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  assert.ok(buffer.length > 1000);
});
