import test from "node:test";
import assert from "node:assert/strict";
import { buildObjectRefinementPrompt, getObjectInstructions } from "../server/refinePrompt.js";

test("uses connected content nodes and output option count", () => {
  const element = { id: "title", type: "text", text: "Original claim" };
  const instructionNodes = [
    { id: "linked", nodeKind: "vibe", value: "Direct and visionary" },
    { id: "unlinked", nodeKind: "vibe", value: "Do not use this" },
    { id: "length", nodeKind: "wordCount", value: "20 words" },
    { id: "samples", nodeKind: "samples", value: "4 options" },
    { id: "font", nodeKind: "fontSize", value: "32 pt" },
  ];
  const edges = [
    { source: "linked", target: "title" },
    { source: "length", target: "title" },
    { source: "samples", target: "title" },
    { source: "font", target: "title" },
    { source: "unlinked", target: "other" },
  ];

  assert.deepEqual(getObjectInstructions({ element, instructionNodes, edges }).map((node) => node.id), ["linked", "length", "samples", "font"]);

  const result = buildObjectRefinementPrompt({ element, instructionNodes, edges });
  assert.equal(result.count, 4);
  assert.match(result.prompt, /Original claim/);
  assert.match(result.prompt, /Direct and visionary/);
  assert.doesNotMatch(result.prompt, /Do not use this/);
  assert.match(result.prompt, /wordCount: 20 words/);
  assert.doesNotMatch(result.prompt, /32 pt/);
  assert.match(result.prompt, /Do not use or infer deck context/);
});
