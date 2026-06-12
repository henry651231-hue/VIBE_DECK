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
3. Add text boxes, shapes, and word-count, writing-direction, font-size, or output-count nodes.
4. Drag from a node handle to any side of one or more text boxes. Mark nodes as **Used node** to reuse and synchronize them across slides.
5. Generate one object, one slide, or the entire deck. Results stay in the text box's AI Gen card until the user manually edits the Content card.
6. Export the visible slides as an editable `.pptx`.

The OpenAI API key is entered once on the OpenAI screen and stored outside project files in browser local storage. Projects autosave in browser local storage and can also be opened or saved as `.vibedeck` files. Saving asks for a destination every time.
Instruction nodes are editor controls only and do not appear in the exported presentation.
