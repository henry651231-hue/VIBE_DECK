import test from "node:test";
import assert from "node:assert/strict";
import { buildRefinementPrompt } from "../server/refinePrompt.js";

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
      { type: "node", nodeKind: "vibe", value: "Visionary", connections: ["title"] },
    ],
  });

  assert.match(prompt, /Project AI configuration/);
  assert.match(prompt, /Output language: English/);
  assert.match(prompt, /Alternatives to consider internally: 4/);
  assert.match(prompt, /Advanced instructions: Avoid jargon\./);
  assert.match(prompt, /vibe: Visionary; apply to: Original claim/);
  assert.match(prompt, /Latest user feedback: Make it shorter\./);
});
