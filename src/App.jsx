import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "vibe-deck-project-v1";
const SETTINGS_KEY = "vibe-deck-settings-v1";

const aspectRatios = { wide: 16 / 9, standard: 4 / 3, portrait: 3 / 4 };
const nodeTypes = {
  wordCount: { label: "Content length", hint: "WORDS", color: "#7c5ce7", value: "80 words" },
  vibe: { label: "Writing direction", hint: "VIBE", color: "#e05d87", value: "Clear and visionary" },
  fontSize: { label: "Font size", hint: "TYPE", color: "#ed8b32", value: "24 pt" },
  samples: { label: "AI samples", hint: "OPTIONS", color: "#18a58b", value: "3 samples" },
};

function id() {
  return crypto.randomUUID();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function blankSlide() {
  return { id: id(), name: "Untitled slide", background: "#ffffff", hidden: false, elements: [] };
}

const initialProject = {
  name: "Vibe Deck",
  aspect: "wide",
  defaults: { fontFamily: "Aptos", fontSize: 24, color: "#111315" },
  context: {
    whoAmI: "",
    audience: "",
    purpose: "",
    keyStacks: "",
    vibe: "",
    contentSize: "Medium",
    talkingPoints: "",
    tone: "Confident",
  },
  slides: [blankSlide()],
};

function normalizeProject(saved) {
  if (!saved) return initialProject;
  if (Array.isArray(saved.slides) && saved.slides.length) return saved;
  const slide = blankSlide();
  slide.background = saved.background || "#ffffff";
  slide.elements = saved.elements || [];
  return {
    ...initialProject,
    ...saved,
    background: undefined,
    elements: undefined,
    slides: [slide],
  };
}

function newText(defaults, overrides = {}) {
  return {
    id: id(),
    type: "text",
    text: "Type something",
    x: 12,
    y: 18,
    w: 38,
    h: 12,
    fontFamily: defaults.fontFamily,
    fontSize: defaults.fontSize,
    color: defaults.color,
    bold: false,
    italic: false,
    align: "left",
    connections: [],
    ...overrides,
  };
}

function newShape(defaults) {
  return {
    ...newText(defaults, { type: "shape", text: "Shape text", x: 50, y: 24, w: 30, h: 24 }),
    fill: "#e9edf2",
    borderColor: "#b8c0c7",
    borderWidth: 1,
    opacity: 0,
  };
}

function newNode(kind) {
  const definition = nodeTypes[kind];
  return {
    id: id(),
    type: "node",
    nodeKind: kind,
    value: definition.value,
    x: 67,
    y: 62,
    w: 22,
    h: 12,
    connections: [],
  };
}

const icon = (name) => {
  const paths = {
    add: "M12 5v14M5 12h14",
    box: "M4 5h16v14H4z",
    node: "M5 5h10v10H5zM15 10h4v9h-9v-4",
    undo: "M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6",
    redo: "m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6",
    trash: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
    download: "M12 3v12m0 0 5-5m-5 5-5-5M5 21h14",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6-1.4 1.4M7.4 16.6 6 18m12 0-1.4-1.4M7.4 7.4 6 6",
    spark: "m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Zm6 10 .7 2.3L21 16l-2.3.7L18 19l-.7-2.3L15 16l2.3-.7L18 13Z",
    eyeOff: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A10.7 10.7 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.1 3M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7a9 9 0 0 0 3-.5",
    copy: "M8 8h11v11H8zM5 16H4V5h11v1",
    chevron: "m8 10 4 4 4-4",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
};

function App() {
  const [project, setProject] = useState(() => {
    try {
      return normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return initialProject;
    }
  });
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { apiKey: "", model: "gpt-5.5" };
    } catch {
      return { apiKey: "", model: "gpt-5.5" };
    }
  });
  const [currentSlideId, setCurrentSlideId] = useState(project.slides[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [panel, setPanel] = useState("context");
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [notice, setNotice] = useState("All changes saved locally");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [linkingNodeId, setLinkingNodeId] = useState(null);
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(300);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const splitRef = useRef(null);

  const slide = project.slides.find((item) => item.id === currentSlideId) || project.slides[0];
  const selected = slide.elements.find((element) => element.id === selectedId);
  const contentObjects = slide.elements.filter((element) => element.type !== "node");
  const nodeObjects = slide.elements.filter((element) => element.type === "node");

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setNotice("All changes saved locally");
    }, 250);
    setNotice("Saving...");
    return () => clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !editingId && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        removeElement(selectedId);
      }
      if (event.key === "Escape") {
        setEditingId(null);
        setLinkingNodeId(null);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const commit = useCallback((producer) => {
    setProject((current) => {
      setHistory((items) => [...items.slice(-49), clone(current)]);
      setFuture([]);
      return typeof producer === "function" ? producer(current) : producer;
    });
  }, []);

  const updateSlide = (slideId, updater, record = true) => {
    const apply = (current) => ({
      ...current,
      slides: current.slides.map((item) => item.id === slideId ? (typeof updater === "function" ? updater(item) : { ...item, ...updater }) : item),
    });
    record ? commit(apply) : setProject(apply);
  };

  const updateCurrentSlide = (updater, record = true) => updateSlide(slide.id, updater, record);
  const updateContext = (key, value) => commit((current) => ({ ...current, context: { ...current.context, [key]: value } }));
  const updateSelected = (patch, record = true) => updateCurrentSlide((current) => ({
    ...current,
    elements: current.elements.map((element) => element.id === selectedId ? { ...element, ...patch } : element),
  }), record);

  const addElement = (element) => {
    updateCurrentSlide((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
    setEditingId(null);
  };

  const removeElement = (elementId) => {
    updateCurrentSlide((current) => ({
      ...current,
      elements: current.elements
        .filter((element) => element.id !== elementId)
        .map((element) => element.type === "node" ? { ...element, connections: element.connections.filter((target) => target !== elementId) } : element),
    }));
    setSelectedId(null);
    setEditingId(null);
    setContextMenu(null);
  };

  const addSlide = () => {
    const next = blankSlide();
    commit((current) => {
      const index = current.slides.findIndex((item) => item.id === currentSlideId);
      const slides = [...current.slides];
      slides.splice(index + 1, 0, next);
      return { ...current, slides };
    });
    setCurrentSlideId(next.id);
    setSelectedId(null);
  };

  const copySlide = (slideId) => {
    let copied;
    commit((current) => {
      const index = current.slides.findIndex((item) => item.id === slideId);
      copied = clone(current.slides[index]);
      copied.id = id();
      copied.name = `${copied.name} copy`;
      copied.elements = copied.elements.map((element) => ({ ...element, id: id(), connections: [] }));
      const slides = [...current.slides];
      slides.splice(index + 1, 0, copied);
      return { ...current, slides };
    });
    setCurrentSlideId(copied.id);
    setContextMenu(null);
  };

  const deleteSlide = (slideId) => {
    if (project.slides.length === 1) return;
    const index = project.slides.findIndex((item) => item.id === slideId);
    const fallback = project.slides[index - 1] || project.slides[index + 1];
    commit((current) => ({ ...current, slides: current.slides.filter((item) => item.id !== slideId) }));
    if (currentSlideId === slideId) setCurrentSlideId(fallback.id);
    setContextMenu(null);
  };

  const toggleHideSlide = (slideId) => {
    updateSlide(slideId, (current) => ({ ...current, hidden: !current.hidden }));
    setContextMenu(null);
  };

  const reorderSlide = (draggedId, targetId) => {
    if (draggedId === targetId) return;
    commit((current) => {
      const slides = [...current.slides];
      const from = slides.findIndex((item) => item.id === draggedId);
      const to = slides.findIndex((item) => item.id === targetId);
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return { ...current, slides };
    });
  };

  const undo = () => {
    if (!history.length) return;
    const previous = history.at(-1);
    setFuture((items) => [clone(project), ...items].slice(0, 50));
    setHistory((items) => items.slice(0, -1));
    setProject(previous);
    if (!previous.slides.some((item) => item.id === currentSlideId)) setCurrentSlideId(previous.slides[0].id);
    setSelectedId(null);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory((items) => [...items, clone(project)].slice(-50));
    setFuture((items) => items.slice(1));
    setProject(next);
    setSelectedId(null);
  };

  const onElementPointerDown = (event, element, mode = "move") => {
    event.preventDefault();
    event.stopPropagation();
    if (linkingNodeId && element.type !== "node") {
      updateCurrentSlide((current) => ({
        ...current,
        elements: current.elements.map((item) => item.id === linkingNodeId
          ? { ...item, connections: item.connections.includes(element.id) ? item.connections.filter((target) => target !== element.id) : [...item.connections, element.id] }
          : item),
      }));
      setLinkingNodeId(null);
      return;
    }
    setSelectedId(element.id);
    if (editingId !== element.id) setEditingId(null);
    if (editingId === element.id) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      initial: clone(element),
      rect,
      before: clone(project),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (splitRef.current) {
      const { side, startX, initial } = splitRef.current;
      const delta = event.clientX - startX;
      if (side === "left") setLeftWidth(Math.max(150, Math.min(380, initial + delta)));
      else setRightWidth(Math.max(240, Math.min(430, initial - delta)));
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
    const patch = drag.mode === "resize"
      ? { w: Math.max(6, Math.min(100 - drag.initial.x, drag.initial.w + dx)), h: Math.max(5, Math.min(100 - drag.initial.y, drag.initial.h + dy)) }
      : { x: Math.max(0, Math.min(100 - drag.initial.w, drag.initial.x + dx)), y: Math.max(0, Math.min(100 - drag.initial.h, drag.initial.y + dy)) };
    updateCurrentSlide((current) => ({
      ...current,
      elements: current.elements.map((element) => element.id === drag.id ? { ...element, ...patch } : element),
    }), false);
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      const before = dragRef.current.before;
      setHistory((items) => [...items.slice(-49), before]);
      setFuture([]);
      dragRef.current = null;
    }
    splitRef.current = null;
  };

  const startSplit = (event, side) => {
    event.preventDefault();
    splitRef.current = { side, startX: event.clientX, initial: side === "left" ? leftWidth : rightWidth };
  };

  const applyAiContent = (content) => {
    const retainedNodes = slide.elements.filter((element) => element.type === "node");
    const elements = [
      newText(project.defaults, { text: content.eyebrow, x: 7, y: 8, w: 28, h: 6, fontSize: 14, color: "#1687c8", bold: true }),
      newText(project.defaults, { text: content.title, x: 7, y: 17, w: 70, h: 15, fontSize: 30, bold: true }),
      ...content.points.map((point, index) => newText(project.defaults, { text: `•  ${point}`, x: 9, y: 40 + index * 12, w: 68, h: 9, fontSize: 18 })),
    ];
    if (content.footer) elements.push(newText(project.defaults, { text: content.footer, x: 7, y: 89, w: 76, h: 5, fontSize: 9, color: "#6b7075" }));
    updateCurrentSlide((current) => ({ ...current, elements: [...elements, ...retainedNodes.map((node) => ({ ...node, connections: [] }))] }));
    setSelectedId(null);
  };

  const refine = async () => {
    setBusy(true);
    setNotice("OpenAI is refining this slide...");
    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          model: settings.model,
          context: project.context,
          feedback,
          elements: slide.elements,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      applyAiContent(payload.content);
      setFeedback("");
      setRefineOpen(false);
      setNotice("AI draft applied to the current slide");
    } catch (error) {
      setNotice(error.message || "AI refinement failed");
      if (!settings.apiKey) {
        setRefineOpen(false);
        setSettingsOpen(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const exportPptx = async () => {
    setBusy(true);
    setNotice("Building editable PowerPoint...");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      if (!response.ok) throw new Error("PowerPoint export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name || "Vibe Deck"}.pptx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Editable PowerPoint downloaded");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const canvasStyle = useMemo(() => ({ aspectRatio: aspectRatios[project.aspect], background: slide.background }), [project.aspect, slide.background]);

  return (
    <div className="app" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={() => setContextMenu(null)}>
      <header className="topbar">
        <div className="brand">
          <div className="mark">V</div>
          <input value={project.name} onChange={(event) => commit((current) => ({ ...current, name: event.target.value }))} aria-label="Project name" />
          <span className="mvp">MVP</span>
        </div>
        <div className="toolbar">
          <button type="button" className="icon-button" onClick={undo} disabled={!history.length} title="Undo">{icon("undo")}</button>
          <button type="button" className="icon-button" onClick={redo} disabled={!future.length} title="Redo">{icon("redo")}</button>
          <span className="save-state">{notice}</span>
          <button type="button" onClick={() => setSettingsOpen(true)}>{icon("settings")} Settings</button>
          <button type="button" className="primary" onClick={exportPptx} disabled={busy}>{icon("download")} Export PPTX</button>
        </div>
      </header>

      <main className="workspace" style={{ gridTemplateColumns: `${leftWidth}px 6px minmax(480px, 1fr) 6px ${rightWidth}px` }}>
        <aside className="slides-panel panel">
          <div className="slides-header">
            <div><strong>Slides</strong><span>{project.slides.length}</span></div>
            <button type="button" onClick={addSlide} title="Add slide after current">{icon("add")}</button>
          </div>
          <div className="slide-list">
            {project.slides.map((item, index) => (
              <SlideThumbnail
                key={item.id}
                slide={item}
                index={index}
                aspect={project.aspect}
                active={item.id === slide.id}
                onSelect={() => { setCurrentSlideId(item.id); setSelectedId(null); setEditingId(null); }}
                onRefine={() => { setCurrentSlideId(item.id); setRefineOpen(true); }}
                onContext={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ kind: "slide", id: item.id, x: event.clientX, y: event.clientY }); }}
                onDrop={(draggedId) => reorderSlide(draggedId, item.id)}
              />
            ))}
          </div>
        </aside>

        <div className="split-handle" onPointerDown={(event) => startSplit(event, "left")} />

        <section className="stage">
          <div className="canvas-toolbar">
            <button type="button" onClick={() => addElement(newText(project.defaults))}>{icon("add")} Text box</button>
            <button type="button" onClick={() => addElement(newShape(project.defaults))}>{icon("box")} Shape</button>
            <div className={`node-picker ${nodeMenuOpen ? "open" : ""}`}>
              <button type="button" onClick={() => setNodeMenuOpen((open) => !open)}>{icon("node")} Node {icon("chevron")}</button>
              <div className="node-menu">
                {Object.entries(nodeTypes).map(([kind, definition]) => (
                  <button type="button" key={kind} onClick={() => { addElement(newNode(kind)); setNodeMenuOpen(false); }}>
                    <i style={{ background: definition.color }} />
                    <span><strong>{definition.label}</strong><small>{definition.hint}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <span className="canvas-hint">{linkingNodeId ? "Click an object to connect it to the node" : "Double-click an object to edit"}</span>
            <button type="button" className="refine-page" onClick={() => setRefineOpen(true)}>{icon("spark")} Refine Page</button>
          </div>
          <div className="canvas-shell">
            <div
              className="slide-canvas"
              ref={canvasRef}
              style={canvasStyle}
              onPointerDown={() => { setSelectedId(null); setEditingId(null); }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <ConnectionLayer nodes={nodeObjects} objects={contentObjects} />
              {!slide.elements.length && (
                <div className="empty-state"><span>Blank slide</span><strong>Add a text box, shape, or direction node.</strong></div>
              )}
              {slide.elements.map((element) => (
                <SlideElement
                  key={element.id}
                  element={element}
                  selected={element.id === selectedId}
                  editing={element.id === editingId}
                  linking={element.id === linkingNodeId}
                  onPointerDown={onElementPointerDown}
                  onDoubleClick={() => element.type !== "node" && setEditingId(element.id)}
                  onChange={(patch) => { setSelectedId(element.id); updateSelected(patch); }}
                  onLink={() => { setSelectedId(element.id); setLinkingNodeId(linkingNodeId === element.id ? null : element.id); }}
                  onContext={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedId(element.id); setContextMenu({ kind: "element", id: element.id, x: event.clientX, y: event.clientY }); }}
                />
              ))}
            </div>
          </div>
          <div className="zoom-label">Slide {project.slides.findIndex((item) => item.id === slide.id) + 1} · {project.aspect === "wide" ? "16:9" : project.aspect === "standard" ? "4:3" : "3:4"}</div>
        </section>

        <div className="split-handle" onPointerDown={(event) => startSplit(event, "right")} />

        <aside className="right-panel panel">
          {selected ? (
            <Inspector element={selected} update={updateSelected} onDelete={() => removeElement(selected.id)} />
          ) : (
            <>
              <div className="panel-tabs">
                <button type="button" className={panel === "context" ? "active" : ""} onClick={() => setPanel("context")}>Context</button>
                <button type="button" className={panel === "page" ? "active" : ""} onClick={() => setPanel("page")}>Page</button>
              </div>
              {panel === "context" ? (
                <div className="panel-content">
                  <Field label="Who I am" value={project.context.whoAmI} onChange={(value) => updateContext("whoAmI", value)} placeholder="Company, role, point of view" />
                  <Field label="Target audience" value={project.context.audience} onChange={(value) => updateContext("audience", value)} placeholder="Who will see this deck?" />
                  <Field label="Purpose of deck" value={project.context.purpose} onChange={(value) => updateContext("purpose", value)} placeholder="What should this deck achieve?" area />
                  <Field label="Key facts / stacks" value={project.context.keyStacks} onChange={(value) => updateContext("keyStacks", value)} placeholder="Facts, products, technology, constraints" area />
                  <Field label="Vibe" value={project.context.vibe} onChange={(value) => updateContext("vibe", value)} placeholder="Editorial, bold, minimal, premium..." area />
                  <div className="two-column">
                    <Select label="Tone" value={project.context.tone} onChange={(value) => updateContext("tone", value)} options={["Confident", "Visionary", "Analytical", "Friendly", "Urgent"]} />
                    <Select label="Content size" value={project.context.contentSize} onChange={(value) => updateContext("contentSize", value)} options={["Short", "Medium", "Detailed"]} />
                  </div>
                  <Field label="Talking points" value={project.context.talkingPoints} onChange={(value) => updateContext("talkingPoints", value)} placeholder="One point per line" area />
                </div>
              ) : (
                <div className="panel-content">
                  <Select label="Aspect ratio" value={project.aspect} onChange={(value) => commit((current) => ({ ...current, aspect: value }))} options={[["wide", "16:9 Widescreen"], ["standard", "4:3 Standard"], ["portrait", "3:4 Portrait"]]} />
                  <ColorField label="Slide background" value={slide.background} onChange={(value) => updateCurrentSlide({ background: value })} />
                  <Field label="Slide name" value={slide.name} onChange={(value) => updateCurrentSlide({ name: value })} />
                  <Select label="Default font" value={project.defaults.fontFamily} onChange={(value) => commit((current) => ({ ...current, defaults: { ...current.defaults, fontFamily: value } }))} options={["Aptos", "Arial", "Helvetica Neue", "Georgia", "Times New Roman", "Courier New"]} />
                  <RangeField label="Default text size" value={project.defaults.fontSize} min="8" max="72" onChange={(value) => commit((current) => ({ ...current, defaults: { ...current.defaults, fontSize: Number(value) } }))} />
                </div>
              )}
            </>
          )}
        </aside>
      </main>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.kind === "slide" ? (
            <>
              <button type="button" onClick={() => copySlide(contextMenu.id)}>{icon("copy")} Copy slide</button>
              <button type="button" onClick={() => toggleHideSlide(contextMenu.id)}>{icon("eyeOff")} {project.slides.find((item) => item.id === contextMenu.id)?.hidden ? "Show slide" : "Hide slide"}</button>
              <button type="button" className="danger" disabled={project.slides.length === 1} onClick={() => deleteSlide(contextMenu.id)}>{icon("trash")} Delete slide</button>
            </>
          ) : (
            <button type="button" className="danger" onClick={() => removeElement(contextMenu.id)}>{icon("trash")} Delete object</button>
          )}
        </div>
      )}

      {refineOpen && (
        <Modal title="Refine current page" onClose={() => setRefineOpen(false)}>
          <p className="modal-copy">AI will use the deck context, the text on this slide, and every connected node as direction.</p>
          <Field label="Your feedback" value={feedback} onChange={setFeedback} placeholder="Make the message shorter, more strategic, and more confident..." area />
          <button type="button" className="primary full" onClick={refine} disabled={busy}>{icon("spark")} {busy ? "Refining..." : "Refine Page"}</button>
        </Modal>
      )}

      {settingsOpen && (
        <Modal title="Settings" onClose={() => setSettingsOpen(false)}>
          <Field label="OpenAI API key" type="password" value={settings.apiKey} onChange={(value) => setSettings((current) => ({ ...current, apiKey: value }))} placeholder="sk-..." />
          <Field label="Model" value={settings.model} onChange={(value) => setSettings((current) => ({ ...current, model: value }))} placeholder="gpt-5.5" />
          <p className="security-note">The key stays in this browser and is sent through your local server only when you refine a page.</p>
          <button type="button" className="primary full" onClick={() => setSettingsOpen(false)}>Save settings</button>
        </Modal>
      )}
    </div>
  );
}

function ConnectionLayer({ nodes, objects }) {
  const lines = nodes.flatMap((node) => node.connections.map((targetId) => {
    const target = objects.find((object) => object.id === targetId);
    if (!target) return null;
    return {
      key: `${node.id}-${target.id}`,
      color: nodeTypes[node.nodeKind].color,
      x1: node.x,
      y1: node.y + node.h / 2,
      x2: target.x + target.w,
      y2: target.y + target.h / 2,
    };
  }).filter(Boolean));
  return (
    <svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="none">
      {lines.map((line) => (
        <g key={line.key}>
          <path d={`M ${line.x1} ${line.y1} C ${line.x1 - 8} ${line.y1}, ${line.x2 + 8} ${line.y2}, ${line.x2} ${line.y2}`} stroke={line.color} />
          <circle cx={line.x2} cy={line.y2} r=".65" fill={line.color} />
        </g>
      ))}
    </svg>
  );
}

function SlideElement({ element, selected, editing, linking, onPointerDown, onDoubleClick, onChange, onLink, onContext }) {
  const position = { left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%`, zIndex: selected ? 6 : element.type === "node" ? 4 : 2 };
  if (element.type === "node") {
    const definition = nodeTypes[element.nodeKind];
    return (
      <div className={`slide-element direction-node ${selected ? "selected" : ""} ${linking ? "linking" : ""}`} style={{ ...position, "--node-color": definition.color }} onPointerDown={(event) => onPointerDown(event, element)} onContextMenu={onContext}>
        <small>{definition.hint}</small>
        <strong>{definition.label}</strong>
        <span>{element.value}</span>
        <button type="button" className="node-port" title="Connect this node to an object" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onLink(); }} />
        {selected && <span className="resize-handle" onPointerDown={(event) => onPointerDown(event, element, "resize")} />}
      </div>
    );
  }
  const shapeStyle = element.type === "shape" ? {
    background: element.fill,
    border: `${element.borderWidth || 0}px solid ${element.borderColor}`,
    opacity: 1 - (element.opacity || 0) / 100,
  } : {};
  return (
    <div className={`slide-element content-object ${element.type} ${selected ? "selected" : ""} ${editing ? "editing" : ""}`} style={{ ...position, ...shapeStyle }} onPointerDown={(event) => onPointerDown(event, element)} onDoubleClick={(event) => { event.stopPropagation(); onDoubleClick(); }} onContextMenu={onContext}>
      <textarea
        value={element.text}
        readOnly={!editing}
        autoFocus={editing}
        onChange={(event) => onChange({ text: event.target.value })}
        onBlur={() => {}}
        onPointerDown={(event) => {
          if (editing) event.stopPropagation();
        }}
        style={{ fontFamily: element.fontFamily, fontSize: `${Math.max(8, element.fontSize * 0.72)}px`, color: element.color, fontWeight: element.bold ? 700 : 400, fontStyle: element.italic ? "italic" : "normal", textAlign: element.align }}
      />
      {selected && <span className="resize-handle" onPointerDown={(event) => onPointerDown(event, element, "resize")} />}
    </div>
  );
}

function SlideThumbnail({ slide, index, aspect, active, onSelect, onRefine, onContext, onDrop }) {
  return (
    <div className={`slide-row ${active ? "active" : ""} ${slide.hidden ? "hidden-slide" : ""}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/slide-id", slide.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(event.dataTransfer.getData("text/slide-id")); }} onContextMenu={onContext}>
      <span className="slide-number">{index + 1}</span>
      <div className="thumb-stack">
        <button type="button" className="thumbnail" style={{ aspectRatio: aspectRatios[aspect], background: slide.background }} onClick={onSelect}>
          {slide.elements.filter((element) => element.type !== "node").map((element) => (
            <span key={element.id} className={`thumb-element ${element.type}`} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%`, background: element.type === "shape" ? element.fill : "transparent", color: element.color, border: element.type === "shape" ? "1px solid #ccd1d5" : 0 }}>
              {element.text}
            </span>
          ))}
          {slide.hidden && <span className="hidden-badge">{icon("eyeOff")}</span>}
        </button>
        <div className="slide-meta"><span>{slide.name}</span><button type="button" onClick={onRefine}>{icon("spark")} Refine</button></div>
      </div>
    </div>
  );
}

function Inspector({ element, update, onDelete }) {
  if (element.type === "node") {
    const definition = nodeTypes[element.nodeKind];
    return (
      <>
        <div className="inspector-title"><div><i style={{ background: definition.color }} /><strong>{definition.label}</strong></div><span>Node</span></div>
        <div className="panel-content">
          <Field label="Direction" value={element.value} onChange={(value) => update({ value })} area={element.nodeKind === "vibe"} />
          <div className="node-help">Use the colored connector on the node, then click one or more objects that share this direction.</div>
          <PositionGrid element={element} update={update} />
          <button type="button" className="delete-control" onClick={onDelete}>{icon("trash")} Delete node</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="inspector-title"><strong>{element.type === "text" ? "Text box" : "Shape"}</strong><span>Selected</span></div>
      <div className="panel-content">
        <Field label="Content" value={element.text} onChange={(value) => update({ text: value })} area />
        <Select label="Font" value={element.fontFamily} onChange={(value) => update({ fontFamily: value })} options={["Aptos", "Arial", "Helvetica Neue", "Georgia", "Times New Roman", "Courier New"]} />
        <RangeField label="Font size" value={element.fontSize} min="8" max="72" onChange={(value) => update({ fontSize: Number(value) })} />
        <ColorField label="Text color" value={element.color} onChange={(value) => update({ color: value })} />
        <div className="format-row">
          <button type="button" className={element.bold ? "active" : ""} onClick={() => update({ bold: !element.bold })}><b>B</b></button>
          <button type="button" className={element.italic ? "active" : ""} onClick={() => update({ italic: !element.italic })}><i>I</i></button>
          {["left", "center", "right"].map((align) => <button type="button" key={align} className={element.align === align ? "active" : ""} onClick={() => update({ align })}>{align[0].toUpperCase()}</button>)}
        </div>
        {element.type === "shape" && (
          <>
            <ColorField label="Fill color" value={element.fill} onChange={(value) => update({ fill: value })} />
            <ColorField label="Border color" value={element.borderColor} onChange={(value) => update({ borderColor: value })} />
            <RangeField label="Border width" value={element.borderWidth} min="0" max="8" onChange={(value) => update({ borderWidth: Number(value) })} />
          </>
        )}
        <PositionGrid element={element} update={update} />
        <button type="button" className="delete-control" onClick={onDelete}>{icon("trash")} Delete object</button>
      </div>
    </>
  );
}

function PositionGrid({ element, update }) {
  return <div className="position-grid">{["x", "y", "w", "h"].map((key) => <label key={key}><span>{key.toUpperCase()}</span><input type="number" value={Math.round(element[key] * 10) / 10} onChange={(event) => update({ [key]: Number(event.target.value) })} /></label>)}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><small>VIBE DECK</small><h2>{title}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, area, type = "text" }) {
  return <label className="field"><span>{label}</span>{area ? <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => { const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option]; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>;
}

function ColorField({ label, value, onChange }) {
  return <label className="field"><span>{label}</span><div className="color-field"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

function RangeField({ label, value, min, max, onChange }) {
  return <label className="field range-field"><span>{label}<b>{value}</b></span><input type="range" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} /></label>;
}

export default App;
