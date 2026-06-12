import test from "node:test";
import assert from "node:assert/strict";
import { buildObjectRefinementPrompt, getObjectInstructions } from "../server/refinePrompt.js";

test("uses only writing-direction nodes connected to the object", () => {
  const element = { id: "title", type: "text", text: "Original claim" };
  const instructionNodes = [
    { id: "linked", nodeKind: "vibe", value: "Direct and visionary" },
    { id: "unlinked", nodeKind: "vibe", value: "Do not use this" },
    { id: "legacy", nodeKind: "wordCount", value: "20 words" },
  ];
  const edges = [
    { source: "linked", target: "title" },
    { source: "legacy", target: "title" },
    { source: "unlinked", target: "other" },
  ];

  assert.deepEqual(getObjectInstructions({ element, instructionNodes, edges }).map((node) => node.id), ["linked"]);

  const result = buildObjectRefinementPrompt({ element, instructionNodes, edges });
  assert.equal(result.count, 3);
  assert.match(result.prompt, /Original claim/);
  assert.match(result.prompt, /Direct and visionary/);
  assert.doesNotMatch(result.prompt, /Do not use this/);
  assert.doesNotMatch(result.prompt, /20 words/);
  assert.match(result.prompt, /Do not use or infer deck context/);
});
