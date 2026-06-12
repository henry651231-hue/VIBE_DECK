export function getObjectInstructions({ element, instructionNodes = [], edges = [] }) {
  return edges
    .filter((edge) => edge.target === element.id)
    .map((edge) => instructionNodes.find((node) => node.id === edge.source))
    .filter((node) => node?.nodeKind === "vibe");
}

export function buildObjectRefinementPrompt({ element, instructionNodes = [], edges = [] }) {
  const directions = getObjectInstructions({ element, instructionNodes, edges })
    .map((node) => node.value.trim())
    .filter(Boolean);

  return {
    count: 3,
    prompt: `
Rewrite one presentation text object and return 3 distinct alternatives.

Original text:
${element.text || ""}

Writing direction from connected nodes:
${directions.join("\n") || "No connected writing direction."}

Use only the original text and the connected writing direction above.
Do not use or infer deck context, slide context, hidden configuration, or unrelated instructions.
Preserve factual meaning and do not invent facts, numbers, sources, customers, or claims.
Return JSON only using {"alternatives":["text"]}.
Each alternative must be concise and directly usable in the existing text box.
`.trim(),
  };
}
