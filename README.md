# Vibe Deck

A local, browser-based AI presentation editor for macOS. Vibe Deck supports multiple slides, direct text and shape editing, AI direction nodes, local autosave, page refinement with OpenAI, and editable PowerPoint export.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5177`.

## MVP workflow

1. Define the presenter, audience, purpose, key facts, vibe, tone, content size, and talking points.
2. Add, copy, hide, delete, and reorder slides from the thumbnail rail.
3. Add text boxes, shapes, and colored AI instruction nodes to a slide.
4. Drag from a node handle to one or more object handles to assign word count, writing direction, font size, or sample count.
5. Select an object and use **Generate Selected** to review alternatives, or use **Refine Page** for the full slide.
6. Export the visible slides as an editable `.pptx`.

The OpenAI API key is entered on the Settings screen and stored in browser local storage. Projects autosave in browser local storage.
Instruction nodes are editor controls only and do not appear in the exported presentation.

## AI control hierarchy

Open **AI Instructions** to configure output language, factuality, meaning preservation, unsupported-fact protection, node scope, alternatives considered, and advanced project instructions. Refinement follows this priority:

1. Safety and factual integrity
2. Project AI rules
3. Deck context
4. Connected nodes
5. Latest page feedback
