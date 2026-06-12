import test from "node:test";
import assert from "node:assert/strict";
import { buildObjectRefinementPrompt, buildRefinementPrompt } from "../server/refinePrompt.js";

test("applies the AI configuration hierarchy and connected node scope", () => {
  const prompt = buildRefinementPrompt({
    context: { audience: "Board", tone: "Confident" },
    aiConfig: {
      language: "English",
      factuality: "Strict",
      preserveMeaning: true,
      noInventedFacts: true,
      respectNodeScope: true,
      defaultSamples: 4,
      advancedInstructions: "Avoid jargon.",
    },
    feedback: "Make it shorter.",
    elements: [
      { id: "title", type: "text", text: "Original claim" },
    ],
    instructionNodes: [{ id: "vibe-node", nodeKind: "vibe", value: "Visionary" }],
    edges: [{ id: "edge", source: "vibe-node", target: "title" }],
  });

  assert.match(prompt, /Project AI configuration/);
  assert.match(prompt, /Output language: English/);
  assert.match(prompt, /Alternatives to consider internally: 4/);
  assert.match(prompt, /Advanced instructions: Avoid jargon\./);
  assert.match(prompt, /vibe: Visionary; apply to: Original claim/);
  assert.match(prompt, /Latest user feedback: Make it shorter\./);
});

test("creates object alternatives from connected nodes", () => {
  const result = buildObjectRefinementPrompt({
    element: { id: "title", text: "Original claim" },
    aiConfig: { defaultSamples: 2, noInventedFacts: true },
    instructionNodes: [
      { id: "length", nodeKind: "wordCount", value: "20 words" },
      { id: "samples", nodeKind: "samples", value: "4 samples" },
    ],
    edges: [
      { source: "length", target: "title" },
      { source: "samples", target: "title" },
    ],
  });

  assert.equal(result.count, 4);
  assert.match(result.prompt, /wordCount: 20 words/);
  assert.doesNotMatch(result.prompt, /samples: 4 samples/);
});
