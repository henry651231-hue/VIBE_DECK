export function getObjectInstructions({ element, instructionNodes = [], edges = [] }) {
  return edges
    .filter((edge) => edge.target === element.id)
    .map((edge) => instructionNodes.find((node) => node.id === edge.source))
    .filter(Boolean);
}

export function buildObjectRefinementPrompt({ element, instructionNodes = [], edges = [] }) {
  const instructions = getObjectInstructions({ element, instructionNodes, edges });
  const sampleNode = instructions.find((node) => node.nodeKind === "samples");
  const count = Math.max(1, Math.min(5, Number.parseInt(sampleNode?.value, 10) || 3));
  const directions = instructions
    .filter((node) => node.nodeKind === "vibe" || node.nodeKind === "wordCount")
    .map((node) => `${node.nodeKind}: ${node.value.trim()}`)
    .filter(Boolean);

  return {
    count,
    prompt: `
Rewrite one presentation text object and return ${count} distinct alternatives.

Original text:
${element.text || ""}

Connected content instructions:
${directions.join("\n") || "No connected writing direction."}

Use only the original text and the connected writing direction above.
Do not use or infer deck context, slide context, hidden configuration, or unrelated instructions.
Preserve factual meaning and do not invent facts, numbers, sources, customers, or claims.
Return JSON only using {"alternatives":["text"]}.
Each alternative must be concise and directly usable in the existing text box.
`.trim(),
  };
}
