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
2. Add, copy, hide, delete, and reorder slides from the thumbnail rail. A selected slide can also be deleted with the keyboard.
3. Add text boxes, shapes, and word-count, writing-direction, font-size, or output-count nodes. Use `Command+C` and `Command+V` to copy objects across slides.
4. Drag from a node handle to any side of one or more text boxes. Custom node values are saved automatically as reusable presets, and shared nodes stay synchronized across slides.
5. Generate one object, one slide, or the entire deck. Results stay in the text box's AI Gen card until the user manually edits the Content card and marks the output reviewed.
6. Export the visible slides as an editable `.pptx`.

The OpenAI API key is entered once in Settings and stored outside project files in browser local storage. The provider setting is ready for future Gemini and Claude support while the MVP uses OpenAI GPT. Projects autosave in browser local storage and can also be opened or saved as `.vibedeck` files. Saving asks for a destination every time.
Instruction nodes are editor controls only and do not appear in the exported presentation.
