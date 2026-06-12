export function buildRefinementPrompt({ context = {}, aiConfig = {}, feedback = "", elements = [], instructionNodes = [], edges = [] }) {
  const textElements = elements.filter((element) => element.type === "text" || element.type === "shape");
  const existingContent = textElements.map((element) => element.text).filter(Boolean);
  const textById = new Map(textElements.map((element) => [element.id, element.text || ""]));
  const nodeDirections = instructionNodes
    .map((node) => {
      const linkedText = edges.filter((edge) => edge.source === node.id).map((edge) => textById.get(edge.target)).filter(Boolean);
      const scope = aiConfig.respectNodeScope === false ? "entire slide" : linkedText.join(" | ") || "no object linked";
      return `${node.nodeKind}: ${node.value}; apply to: ${scope}`;
    })
    .join("\n");

  return `
You are the content editor inside Vibe Deck, a presentation creation tool.
Create concise content for exactly one presentation slide. Return JSON only.

Follow this instruction priority, highest to lowest:
1. Safety and factual integrity rules.
2. Project AI configuration.
3. Deck context.
4. Connected slide nodes.
5. The user's latest refinement feedback.

PROJECT AI CONFIGURATION
Output language: ${aiConfig.language || "Match source"}
Factuality mode: ${aiConfig.factuality || "Strict"}
Preserve original meaning: ${aiConfig.preserveMeaning === false ? "No" : "Yes"}
Do not invent facts: ${aiConfig.noInventedFacts === false ? "No" : "Yes"}
Respect connected node scope: ${aiConfig.respectNodeScope === false ? "No" : "Yes"}
Alternatives to consider internally: ${aiConfig.defaultSamples || 3}
Advanced instructions: ${aiConfig.advancedInstructions || "None"}

DECK CONTEXT
Presenter: ${context.whoAmI || "Not provided"}
Target audience: ${context.audience || "Not provided"}
Purpose: ${context.purpose || "Not provided"}
Key facts or stacks: ${context.keyStacks || "Not provided"}
Desired vibe: ${context.vibe || "Clear and modern"}
Tone: ${context.tone || "Confident"}
Talking points: ${context.talkingPoints || "Not provided"}
Content size: ${context.contentSize || "Medium"}

SLIDE INPUT
Existing slide text: ${existingContent.join(" | ") || "The slide is blank."}
Connected node directions:
${nodeDirections || "No direction nodes."}
Latest user feedback: ${feedback || "Create the first draft."}

Use this exact JSON shape:
{"eyebrow":"short section label","title":"one strong claim, maximum 12 words","points":["2-4 concise supporting points"],"footer":"optional short source or takeaway"}
Do not use markdown.
Consider the requested number of alternatives internally, then return only the strongest result.
${aiConfig.noInventedFacts === false ? "" : "Do not invent statistics, sources, customers, or factual claims not present in the input."}
`.trim();
}

export function getObjectInstructions({ element, instructionNodes = [], edges = [] }) {
  return edges
    .filter((edge) => edge.target === element.id)
    .map((edge) => instructionNodes.find((node) => node.id === edge.source))
    .filter(Boolean);
}

export function buildObjectRefinementPrompt({ context = {}, aiConfig = {}, feedback = "", element, instructionNodes = [], edges = [] }) {
  const instructions = getObjectInstructions({ element, instructionNodes, edges });
  const sampleNode = instructions.find((node) => node.nodeKind === "samples");
  const requested = Math.max(1, Math.min(5, Number.parseInt(sampleNode?.value, 10) || aiConfig.defaultSamples || 3));
  const directions = instructions
    .filter((node) => node.nodeKind !== "fontSize" && node.nodeKind !== "samples")
    .map((node) => `${node.nodeKind}: ${node.value}`)
    .join("\n");

  return {
    count: requested,
    prompt: `
Rewrite one presentation object and return ${requested} distinct alternatives.

Original text: ${element.text || ""}
Audience: ${context.audience || "Not provided"}
Purpose: ${context.purpose || "Not provided"}
Deck tone: ${context.tone || "Confident"}
Output language: ${aiConfig.language || "Match source"}
Factuality: ${aiConfig.factuality || "Strict"}
Preserve meaning: ${aiConfig.preserveMeaning === false ? "No" : "Yes"}
Advanced project instructions: ${aiConfig.advancedInstructions || "None"}
Connected object instructions:
${directions || "No AI writing instructions."}
Latest feedback: ${feedback || "Improve the content."}

Return JSON only using {"alternatives":["text"]}.
Each alternative must be concise and usable directly in the existing text box.
${aiConfig.noInventedFacts === false ? "" : "Do not invent facts, numbers, sources, customers, or claims."}
`.trim(),
  };
}
