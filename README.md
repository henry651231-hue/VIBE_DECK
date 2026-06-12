# Vibe Deck

A local, browser-based AI presentation editor for macOS. Vibe Deck supports multiple slides, direct text and shape editing, connected writing-direction nodes, project files, scoped OpenAI generation, and editable PowerPoint export.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5177`.

## MVP workflow

1. Define the presenter, audience, purpose, key facts, and vibe in collapsible context fields.
2. Add, copy, hide, delete, and reorder slides from the thumbnail rail.
3. Add text boxes, shapes, and writing-direction nodes to a slide.
4. Drag from a node handle to any side of one or more text boxes.
5. Generate one object, one slide, or the entire deck. AI uses only the direction node connected to each object.
6. Export the visible slides as an editable `.pptx`.

The OpenAI API key is entered on the OpenAI screen and stored in browser local storage. Projects autosave in browser local storage and can also be opened or saved as `.vibedeck` files.
Instruction nodes are editor controls only and do not appear in the exported presentation.
