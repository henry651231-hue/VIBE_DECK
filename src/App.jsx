import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  reconnectEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const STORAGE_KEY = "vibe-deck-project-v1";
const SETTINGS_KEY = "vibe-deck-settings-v1";

const aspectRatios = { wide: 16 / 9, standard: 4 / 3, portrait: 3 / 4 };
const instructionTypes = {
  wordCount: { label: "Content length", hint: "WORDS", color: "#7c5ce7", value: "80 words" },
  vibe: { label: "Writing direction", hint: "DIRECTION", color: "#e05d87", value: "Clear and visionary" },
  fontSize: { label: "Font size", hint: "TYPE", color: "#ed8b32", value: "24 pt" },
  samples: { label: "AI output options", hint: "OPTIONS", color: "#18a58b", value: "3 options" },
};
const NODE_WIDTH = 132;
const NODE_HEIGHT = 57;

function id() {
  return crypto.randomUUID();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function blankSlide() {
  return { id: id(), background: "#ffffff", hidden: false, elements: [], instructionNodes: [], edges: [] };
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
  },
  nodeLibrary: [],
  slides: [blankSlide()],
};

function normalizeProject(saved) {
  if (!saved) return initialProject;
  const cleanSaved = { ...saved };
  delete cleanSaved.aiConfig;
  if (Array.isArray(saved.slides) && saved.slides.length) {
    return {
      ...cleanSaved,
      nodeLibrary: Array.isArray(saved.nodeLibrary) ? saved.nodeLibrary : [],
      slides: saved.slides.map(migrateSlideGraph),
    };
  }
  const slide = blankSlide();
  slide.background = saved.background || "#ffffff";
  slide.elements = saved.elements || [];
  return {
    ...initialProject,
    ...cleanSaved,
    background: undefined,
    elements: undefined,
    slides: [slide],
  };
}

function migrateSlideGraph(slide) {
  const legacyNodes = (slide.elements || []).filter((element) => element.type === "node");
  const instructionNodes = (slide.instructionNodes || legacyNodes.map(({ connections, ...node }) => node))
    .filter((node) => instructionTypes[node.nodeKind])
    .map((node) => ({ ...node, w: node.w || 15, h: node.h || 10 }));
  const rawEdges = slide.edges || legacyNodes.flatMap((node) =>
    (node.connections || []).map((targetId) => ({
      id: id(),
      source: node.id,
      target: targetId,
      type: "smoothstep",
    })),
  );
  const nodeIds = new Set(instructionNodes.map((node) => node.id));
  const edges = rawEdges
    .filter((edge) => nodeIds.has(edge.source))
    .map((edge) => ({ ...edge, sourceHandle: edge.sourceHandle || "instruction", targetHandle: edge.targetHandle || "left" }));
  return {
    ...slide,
    background: slide.background || "#ffffff",
    elements: (slide.elements || [])
      .filter((element) => element.type !== "node")
      .map((element) => element.type === "shape"
        ? { ...element, text: "" }
        : { ...element, aiOutputs: element.aiOutputs || [], aiUnreviewed: Boolean(element.aiUnreviewed) }),
    instructionNodes,
    edges,
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
    aiOutputs: [],
    aiUnreviewed: false,
    ...overrides,
  };
}

function newShape(defaults) {
  return {
    ...newText(defaults, { type: "shape", text: "", x: 50, y: 24, w: 30, h: 24 }),
    fill: "#e9edf2",
    borderColor: "#b8c0c7",
    borderWidth: 1,
    opacity: 0,
  };
}

function newNode(kind, reusableNode = null) {
  const definition = reusableNode || instructionTypes[kind];
  return {
    id: id(),
    nodeKind: kind,
    value: definition.value,
    libraryId: reusableNode?.id || null,
    x: 67,
    y: 62,
    w: 15,
    h: 10,
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
    folder: "M3 6h7l2 2h9v11H3z",
    save: "M5 3h12l2 2v16H5zM8 3v6h8V3M8 21v-7h8v7",
    panel: "M4 4h16v16H4zM9 4v16",
    zoomIn: "M11 8v6m-3-3h6m4 7-4-4M10.5 19a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17Z",
    zoomOut: "M8 11h6m4 7-4-4M10.5 19a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17Z",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    unread: "M18 8a6 6 0 1 1-2-4.5M18 2v6h-6",
    grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
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
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [flowNodes, setFlowNodes] = useState([]);
  const [flowEdges, setFlowEdges] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 540 });
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(300);
  const [slidesCollapsed, setSlidesCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [generatingIds, setGeneratingIds] = useState([]);
  const [draggedSlideId, setDraggedSlideId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const slideDragRef = useRef(null);
  const slideDropIndexRef = useRef(null);
  const splitRef = useRef(null);
  const fileInputRef = useRef(null);

  const slide = project.slides.find((item) => item.id === currentSlideId) || project.slides[0];
  const selected = slide.elements.find((element) => element.id === selectedId);
  const selectedInstruction = slide.instructionNodes.find((node) => node.id === selectedId);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setNotice("");
    }, 250);
    return () => clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const instructionNodes = slide.instructionNodes.map((node) => ({
      id: node.id,
      type: "instruction",
      position: { x: (node.x / 100) * canvasSize.width, y: (node.y / 100) * canvasSize.height },
      data: {
        nodeKind: node.nodeKind,
        value: node.value,
        reusable: Boolean(node.libraryId),
      },
      extent: [[0, 0], [Math.max(0, canvasSize.width - NODE_WIDTH), Math.max(0, canvasSize.height - NODE_HEIGHT)]],
    }));
    const targetNodes = slide.elements.filter((element) => element.type === "text").map((element) => ({
      id: `target:${element.id}`,
      type: "objectTarget",
      position: { x: (element.x / 100) * canvasSize.width, y: (element.y / 100) * canvasSize.height },
      style: { width: (element.w / 100) * canvasSize.width, height: (element.h / 100) * canvasSize.height },
      data: { elementId: element.id },
      draggable: false,
      selectable: false,
    }));
    setFlowNodes([...instructionNodes, ...targetNodes]);
    setFlowEdges(slide.edges.map((edge) => {
      const sourceNode = slide.instructionNodes.find((node) => node.id === edge.source);
      return {
        ...edge,
        target: `target:${edge.target}`,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        reconnectable: "target",
        interactionWidth: 18,
        style: { stroke: instructionTypes[sourceNode?.nodeKind]?.color || "#6c55c9", strokeWidth: 2 },
      };
    }));
  }, [slide.id, slide.instructionNodes, slide.elements, slide.edges, canvasSize]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !editingId && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        removeElement(selectedId);
      }
      if (event.key === "Escape") {
        setEditingId(null);
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

  const selectObject = (elementId) => {
    setSelectedId(elementId);
    setEditingId(null);
    const element = slide.elements.find((item) => item.id === elementId);
    if (element?.aiUnreviewed) {
      updateCurrentSlide((current) => ({
        ...current,
        elements: current.elements.map((item) => item.id === elementId ? { ...item, aiUnreviewed: false } : item),
      }), false);
    }
  };

  const addElement = (element) => {
    updateCurrentSlide((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
    setEditingId(null);
  };

  const addInstructionNode = (node) => {
    updateCurrentSlide((current) => ({ ...current, instructionNodes: [...current.instructionNodes, node] }));
    setSelectedId(node.id);
    setEditingId(null);
  };

  const addReusableNode = (libraryNode) => {
    addInstructionNode(newNode(libraryNode.nodeKind, libraryNode));
    setNodeMenuOpen(false);
  };

  const removeElement = (elementId) => {
    updateCurrentSlide((current) => ({
      ...current,
      elements: current.elements.filter((element) => element.id !== elementId),
      instructionNodes: current.instructionNodes.filter((node) => node.id !== elementId),
      edges: current.edges.filter((edge) => edge.id !== elementId && edge.source !== elementId && edge.target !== elementId),
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
      const elementIds = new Map(copied.elements.map((element) => [element.id, id()]));
      const nodeIds = new Map(copied.instructionNodes.map((node) => [node.id, id()]));
      copied.elements = copied.elements.map((element) => ({ ...element, id: elementIds.get(element.id) }));
      copied.instructionNodes = copied.instructionNodes.map((node) => ({ ...node, id: nodeIds.get(node.id) }));
      copied.edges = copied.edges.map((edge) => ({
        ...edge,
        id: id(),
        source: nodeIds.get(edge.source),
        target: elementIds.get(edge.target),
      })).filter((edge) => edge.source && edge.target);
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

  const reorderSlide = (draggedId, insertionIndex) => {
    if (!draggedId) return;
    commit((current) => {
      const slides = [...current.slides];
      const from = slides.findIndex((item) => item.id === draggedId);
      if (from < 0) return current;
      const [moved] = slides.splice(from, 1);
      const adjustedIndex = insertionIndex > from ? insertionIndex - 1 : insertionIndex;
      slides.splice(Math.max(0, Math.min(slides.length, adjustedIndex)), 0, moved);
      return { ...current, slides };
    });
    setDraggedSlideId(null);
    setDropIndex(null);
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
    selectObject(element.id);
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
    if (slideDragRef.current) {
      const rows = [...document.querySelectorAll(".slide-row[data-slide-index]")];
      let insertionIndex = rows.length;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          insertionIndex = Number(row.dataset.slideIndex);
          break;
        }
      }
      slideDropIndexRef.current = insertionIndex;
      setDropIndex(insertionIndex);
      return;
    }
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
    if (slideDragRef.current) {
      const draggedId = slideDragRef.current.id;
      const insertionIndex = slideDropIndexRef.current;
      slideDragRef.current = null;
      slideDropIndexRef.current = null;
      if (insertionIndex !== null) reorderSlide(draggedId, insertionIndex);
    }
    if (dragRef.current) {
      const before = dragRef.current.before;
      setHistory((items) => [...items.slice(-49), before]);
      setFuture([]);
      dragRef.current = null;
    }
    splitRef.current = null;
  };

  const startSlideDrag = (event, slideId) => {
    event.preventDefault();
    event.stopPropagation();
    slideDragRef.current = { id: slideId };
    setDraggedSlideId(slideId);
    const index = project.slides.findIndex((item) => item.id === slideId);
    slideDropIndexRef.current = index;
    setDropIndex(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startSplit = (event, side) => {
    event.preventDefault();
    splitRef.current = { side, startX: event.clientX, initial: side === "left" ? leftWidth : rightWidth };
  };

  const onFlowNodesChange = useCallback((changes) => {
    setFlowNodes((nodes) => applyNodeChanges(changes, nodes));
  }, []);

  const onFlowNodeDragStop = useCallback((_event, node) => {
    if (node.type !== "instruction") return;
    const maxX = Math.max(0, canvasSize.width - (node.measured?.width || NODE_WIDTH));
    const maxY = Math.max(0, canvasSize.height - (node.measured?.height || NODE_HEIGHT));
    updateCurrentSlide((current) => ({
      ...current,
      instructionNodes: current.instructionNodes.map((item) => item.id === node.id ? {
        ...item,
        x: (Math.max(0, Math.min(maxX, node.position.x)) / canvasSize.width) * 100,
        y: (Math.max(0, Math.min(maxY, node.position.y)) / canvasSize.height) * 100,
      } : item),
    }));
  }, [canvasSize, slide.id]);

  const onFlowConnect = useCallback((connection) => {
    if (!connection.source || !connection.target?.startsWith("target:")) return;
    const target = connection.target.replace("target:", "");
    const sourceNode = slide.instructionNodes.find((node) => node.id === connection.source);
    if (!sourceNode) return;
    const duplicateType = slide.edges.some((edge) => {
      const node = slide.instructionNodes.find((item) => item.id === edge.source);
      return edge.target === target && node?.nodeKind === sourceNode.nodeKind;
    });
    if (duplicateType) {
      setNotice(`This object already has a ${instructionTypes[sourceNode.nodeKind].label} instruction`);
      return;
    }
    const edge = {
      id: id(),
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target,
      targetHandle: connection.targetHandle,
      type: "smoothstep",
    };
    updateCurrentSlide((current) => ({
      ...current,
      edges: [...current.edges, edge],
      elements: sourceNode.nodeKind === "fontSize"
        ? current.elements.map((element) => element.id === target ? {
          ...element,
          fontSize: Number.parseInt(sourceNode.value, 10) || element.fontSize,
        } : element)
        : current.elements,
    }));
  }, [slide.id, slide.edges, slide.instructionNodes]);

  const onFlowEdgesChange = useCallback((changes) => {
    setFlowEdges((edges) => applyEdgeChanges(changes, edges));
    const removed = changes.filter((change) => change.type === "remove").map((change) => change.id);
    if (removed.length) {
      updateCurrentSlide((current) => ({ ...current, edges: current.edges.filter((edge) => !removed.includes(edge.id)) }));
    }
  }, [slide.id]);

  const onFlowReconnect = useCallback((oldEdge, connection) => {
    if (!connection.source || !connection.target?.startsWith("target:")) return;
    const target = connection.target.replace("target:", "");
    const sourceNode = slide.instructionNodes.find((node) => node.id === connection.source);
    const duplicateType = slide.edges.some((edge) => {
      if (edge.id === oldEdge.id) return false;
      const node = slide.instructionNodes.find((item) => item.id === edge.source);
      return edge.target === target && node?.nodeKind === sourceNode?.nodeKind;
    });
    if (duplicateType) {
      setNotice("This object already has a writing direction");
      return;
    }
    setFlowEdges((edges) => reconnectEdge(oldEdge, connection, edges));
    updateCurrentSlide((current) => ({
      ...current,
      edges: current.edges.map((edge) => edge.id === oldEdge.id ? {
        ...edge,
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target,
        targetHandle: connection.targetHandle,
      } : edge),
    }));
  }, [slide.id, slide.edges, slide.instructionNodes]);

  const updateInstruction = (patch) => {
    const target = slide.instructionNodes.find((node) => node.id === selectedId);
    if (!target) return;
    if (target.libraryId) {
      commit((current) => ({
        ...current,
        nodeLibrary: current.nodeLibrary.map((node) => node.id === target.libraryId ? { ...node, ...patch } : node),
        slides: current.slides.map((item) => {
          const sharedNodeIds = item.instructionNodes.filter((node) => node.libraryId === target.libraryId).map((node) => node.id);
          return {
            ...item,
            instructionNodes: item.instructionNodes.map((node) => node.libraryId === target.libraryId ? { ...node, ...patch } : node),
            elements: target.nodeKind === "fontSize" && patch.value
              ? item.elements.map((element) => item.edges.some((edge) => sharedNodeIds.includes(edge.source) && edge.target === element.id)
                ? { ...element, fontSize: Number.parseInt(patch.value, 10) || element.fontSize }
                : element)
              : item.elements,
          };
        }),
      }));
      return;
    }
    updateCurrentSlide((current) => ({
      ...current,
      instructionNodes: current.instructionNodes.map((node) => node.id === selectedId ? { ...node, ...patch } : node),
      elements: target.nodeKind === "fontSize" && patch.value
        ? current.elements.map((element) => current.edges.some((edge) => edge.source === selectedId && edge.target === element.id)
          ? { ...element, fontSize: Number.parseInt(patch.value, 10) || element.fontSize }
          : element)
        : current.elements,
    }));
  };

  const setNodeReusable = (reusable) => {
    const target = slide.instructionNodes.find((node) => node.id === selectedId);
    if (!target) return;
    if (reusable && !target.libraryId) {
      const libraryNode = { id: id(), nodeKind: target.nodeKind, value: target.value };
      commit((current) => ({
        ...current,
        nodeLibrary: [...current.nodeLibrary, libraryNode],
        slides: current.slides.map((item) => item.id === slide.id ? {
          ...item,
          instructionNodes: item.instructionNodes.map((node) => node.id === selectedId ? { ...node, libraryId: libraryNode.id } : node),
        } : item),
      }));
    } else if (!reusable && target.libraryId) {
      updateCurrentSlide((current) => ({
        ...current,
        instructionNodes: current.instructionNodes.map((node) => node.id === selectedId ? { ...node, libraryId: null } : node),
      }));
    }
  };

  const requestObjectAlternatives = async (sourceSlide, element) => {
    const linkedEdges = sourceSlide.edges.filter((edge) => edge.target === element.id);
    const linkedNodeIds = new Set(linkedEdges.map((edge) => edge.source));
    const linkedNodes = sourceSlide.instructionNodes.filter((node) => linkedNodeIds.has(node.id));
    if (!linkedNodes.length) return null;
    const response = await fetch("/api/refine-object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: settings.apiKey,
        model: settings.model,
        element,
        instructionNodes: linkedNodes,
        edges: linkedEdges,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    return payload.alternatives;
  };

  const generateSelected = async (element = selected) => {
    if (!element || element.type !== "text") return;
    setBusy(true);
    setGeneratingIds([element.id]);
    setNotice("Generating this object...");
    try {
      const alternatives = await requestObjectAlternatives(slide, element);
      if (!alternatives) throw new Error("Connect at least one node to this object first.");
      updateCurrentSlide((current) => ({
        ...current,
        elements: current.elements.map((item) => item.id === element.id ? {
          ...item,
          aiOutputs: alternatives,
          aiUnreviewed: true,
        } : item),
      }));
      setNotice("New AI output is ready for review");
    } catch (error) {
      setNotice(error.message || "Could not generate alternatives");
      if (!settings.apiKey) setSettingsOpen(true);
    } finally {
      setBusy(false);
      setGeneratingIds([]);
    }
  };

  const generateScope = async (scope, requestedSlide = slide) => {
    const sourceSlides = scope === "deck" ? project.slides.filter((item) => !item.hidden) : [requestedSlide];
    const tasks = sourceSlides.flatMap((sourceSlide) => sourceSlide.elements
      .filter((element) => element.type === "text" && sourceSlide.edges.some((edge) => edge.target === element.id))
      .map((element) => ({ sourceSlide, element })));
    if (!tasks.length) {
      setNotice("Connect nodes to text objects first.");
      return;
    }
    setBusy(true);
    setGeneratingIds(tasks.map(({ element }) => element.id));
    setNotice(scope === "deck" ? "Generating the entire deck..." : "Generating this slide...");
    const updates = new Map();
    try {
      for (const { sourceSlide, element } of tasks) {
        const alternatives = await requestObjectAlternatives(sourceSlide, element);
        if (alternatives?.length) updates.set(`${sourceSlide.id}:${element.id}`, alternatives);
      }
      commit((current) => ({
        ...current,
        slides: current.slides.map((item) => ({
          ...item,
          elements: item.elements.map((element) => {
            const alternatives = updates.get(`${item.id}:${element.id}`);
            return alternatives ? { ...element, aiOutputs: alternatives, aiUnreviewed: true } : element;
          }),
        })),
      }));
      setNotice(scope === "deck" ? "Deck outputs are ready for review" : "Slide outputs are ready for review");
    } catch (error) {
      setNotice(error.message || "AI generation failed");
      if (!settings.apiKey) setSettingsOpen(true);
    } finally {
      setBusy(false);
      setGeneratingIds([]);
    }
  };

  const writeProjectFile = async (handle) => {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(project, null, 2));
    await writable.close();
    setNotice("Project file saved");
  };

  const saveProjectAs = async () => {
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${project.name || "Vibe Deck"}.vibedeck`,
          types: [{ description: "Vibe Deck project", accept: { "application/json": [".vibedeck"] } }],
        });
        await writeProjectFile(handle);
        return;
      }
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name || "Vibe Deck"}.vibedeck`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Project file downloaded");
    } catch (error) {
      if (error.name !== "AbortError") setNotice("Could not save project file");
    }
  };

  const saveProject = async () => {
    await saveProjectAs();
  };

  const loadProjectFile = async (file) => {
    try {
      const next = normalizeProject(JSON.parse(await file.text()));
      setProject(next);
      setCurrentSlideId(next.slides[0].id);
      setSelectedId(null);
      setHistory([]);
      setFuture([]);
      setNotice("Project opened");
    } catch {
      setNotice("This is not a valid Vibe Deck project");
    }
  };

  const openProject = async () => {
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Vibe Deck project", accept: { "application/json": [".vibedeck", ".json"] } }],
        });
        await loadProjectFile(await handle.getFile());
      } else {
        fileInputRef.current?.click();
      }
    } catch (error) {
      if (error.name !== "AbortError") setNotice("Could not open project file");
    }
  };

  const newProject = () => {
    if (!window.confirm("Create a new project? Your current project remains available only if you save it first.")) return;
    const next = { ...clone(initialProject), slides: [blankSlide()] };
    setProject(next);
    setCurrentSlideId(next.slides[0].id);
    setSelectedId(null);
    setHistory([]);
    setFuture([]);
    setNotice("New project");
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
  const workspaceColumns = slidesCollapsed
    ? `44px minmax(480px, 1fr) 6px ${rightWidth}px`
    : `${leftWidth}px 6px minmax(480px, 1fr) 6px ${rightWidth}px`;

  return (
    <div className="app" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={() => setContextMenu(null)}>
      <input ref={fileInputRef} className="hidden-file-input" type="file" accept=".vibedeck,.json,application/json" onChange={(event) => event.target.files?.[0] && loadProjectFile(event.target.files[0])} />
      <header className="topbar">
        <div className="brand">
          <div className="mark">V</div>
          <input value={project.name} onChange={(event) => commit((current) => ({ ...current, name: event.target.value }))} aria-label="Project name" />
          <span className="mvp">MVP</span>
          <button type="button" className="icon-button" onClick={newProject} title="New project">{icon("add")}</button>
          <button type="button" className="icon-button" onClick={openProject} title="Open project">{icon("folder")}</button>
          <button type="button" className="icon-button" onClick={saveProject} title="Save project">{icon("save")}</button>
        </div>
        <div className="toolbar">
          <button type="button" className="icon-button" onClick={undo} disabled={!history.length} title="Undo">{icon("undo")}</button>
          <button type="button" className="icon-button" onClick={redo} disabled={!future.length} title="Redo">{icon("redo")}</button>
          <span className="save-state">{notice}</span>
          <button type="button" onClick={() => setSettingsOpen(true)}>{icon("settings")} OpenAI</button>
          <button type="button" className="primary" onClick={exportPptx} disabled={busy}>{icon("download")} Export PPTX</button>
          <button type="button" className="deck-generate" onClick={() => generateScope("deck")} disabled={busy}>{icon("spark")} AI GEN ENTIRE DECK</button>
        </div>
      </header>

      <main className={`workspace ${slidesCollapsed ? "slides-collapsed" : ""}`} style={{ gridTemplateColumns: workspaceColumns }}>
        <aside className={`slides-panel panel ${slidesCollapsed ? "collapsed" : ""}`}>
          <div className="slides-header">
            {!slidesCollapsed && <div><strong>Slides</strong><span>{project.slides.length}</span></div>}
            <span className="slides-header-actions">
              {!slidesCollapsed && <button type="button" onClick={addSlide} title="Add slide after current">{icon("add")}</button>}
              <button type="button" onClick={() => setSlidesCollapsed((value) => !value)} title={slidesCollapsed ? "Show slides" : "Hide slides"}>{icon("panel")}</button>
            </span>
          </div>
          {!slidesCollapsed && <div className="slide-list">
            <SlideDropZone active={dropIndex === 0} onDragOver={() => setDropIndex(0)} onDrop={(draggedId) => reorderSlide(draggedId || draggedSlideId, 0)} />
            {project.slides.map((item, index) => (
              <div key={item.id}>
                <SlideThumbnail
                  slide={item}
                  index={index}
                  aspect={project.aspect}
                  active={item.id === slide.id}
                  dragging={item.id === draggedSlideId}
                  onDragStart={(event) => startSlideDrag(event, item.id)}
                  onSelect={() => { setCurrentSlideId(item.id); setSelectedId(null); setEditingId(null); }}
                  onGenerate={() => { setCurrentSlideId(item.id); generateScope("slide", item); }}
                  onContext={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ kind: "slide", id: item.id, x: event.clientX, y: event.clientY }); }}
                />
                <SlideDropZone active={dropIndex === index + 1} onDragOver={() => setDropIndex(index + 1)} onDrop={(draggedId) => reorderSlide(draggedId || draggedSlideId, index + 1)} />
              </div>
            ))}
          </div>}
        </aside>

        {!slidesCollapsed && <div className="split-handle" onPointerDown={(event) => startSplit(event, "left")} />}

        <section className="stage">
          <div className="canvas-toolbar">
            <button type="button" onClick={() => addElement(newText(project.defaults))}>{icon("add")} Text box</button>
            <button type="button" onClick={() => addElement(newShape(project.defaults))}>{icon("box")} Shape</button>
            <div className={`node-picker ${nodeMenuOpen ? "open" : ""}`}>
              <button type="button" onClick={() => setNodeMenuOpen((open) => !open)}>{icon("node")} Node {icon("chevron")}</button>
              <div className="node-menu">
                <small className="node-menu-label">NEW NODE</small>
                {Object.entries(instructionTypes).map(([kind, definition]) => (
                  <button type="button" key={kind} onClick={() => { addInstructionNode(newNode(kind)); setNodeMenuOpen(false); }}>
                    <i style={{ background: definition.color }} />
                    <span><strong>{definition.label}</strong><small>{definition.hint}</small></span>
                  </button>
                ))}
                {project.nodeLibrary.length > 0 && <small className="node-menu-label used-label">USED NODES</small>}
                {project.nodeLibrary.map((libraryNode) => (
                  <button type="button" key={libraryNode.id} onClick={() => addReusableNode(libraryNode)}>
                    <i style={{ background: instructionTypes[libraryNode.nodeKind].color }} />
                    <span><strong>{instructionTypes[libraryNode.nodeKind].label}</strong><small>{libraryNode.value}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <span className="canvas-hint">Drag from a node handle to any side of a text box</span>
            <button type="button" className="refine-page" onClick={() => generateScope("slide")} disabled={busy}>{icon("spark")} AI Gen Slide</button>
          </div>
          <div className="canvas-shell">
            <div className="canvas-zoom" style={{ transform: `scale(${zoom})` }}>
              <div
                className="slide-canvas"
                ref={canvasRef}
                style={canvasStyle}
                onPointerDown={() => { setSelectedId(null); setEditingId(null); }}
                onContextMenu={(event) => event.preventDefault()}
              >
              <div className="flow-overlay">
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={flowNodeTypes}
                  onNodesChange={onFlowNodesChange}
                  onNodeDragStop={onFlowNodeDragStop}
                  onEdgesChange={onFlowEdgesChange}
                  onConnect={onFlowConnect}
                  onReconnect={onFlowReconnect}
                  onNodeClick={(_event, node) => node.type === "instruction" && setSelectedId(node.id)}
                  onEdgeClick={(_event, edge) => setSelectedId(edge.id)}
                  nodesConnectable
                  edgesReconnectable
                  nodeExtent={[[0, 0], [canvasSize.width, canvasSize.height]]}
                  deleteKeyCode={["Backspace", "Delete"]}
                  panOnDrag={false}
                  zoomOnScroll={false}
                  zoomOnPinch={false}
                  zoomOnDoubleClick={false}
                  preventScrolling={false}
                  minZoom={1}
                  maxZoom={1}
                  fitView={false}
                  proOptions={{ hideAttribution: true }}
                />
              </div>
              {!slide.elements.length && (
                <div className="empty-state"><span>Blank slide</span><strong>Add a text box, shape, or direction node.</strong></div>
              )}
              {slide.elements.map((element) => (
                <SlideElement
                  key={element.id}
                  element={element}
                  assignedInstructions={slide.edges
                    .filter((edge) => edge.target === element.id)
                    .map((edge) => slide.instructionNodes.find((node) => node.id === edge.source))
                    .filter(Boolean)}
                  selected={element.id === selectedId}
                  editing={element.id === editingId}
                  onPointerDown={onElementPointerDown}
                  onDoubleClick={() => element.type !== "node" && setEditingId(element.id)}
                  onChange={(patch) => { setSelectedId(element.id); updateSelected(patch); }}
                  onGenerate={() => generateSelected(element)}
                  generating={generatingIds.includes(element.id)}
                  onContext={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedId(element.id); setContextMenu({ kind: "element", id: element.id, x: event.clientX, y: event.clientY }); }}
                />
              ))}
              </div>
            </div>
          </div>
          <div className="zoom-label">
            <span>Slide {project.slides.findIndex((item) => item.id === slide.id) + 1} · {project.aspect === "wide" ? "16:9" : project.aspect === "standard" ? "4:3" : "3:4"}</span>
            <span className="zoom-controls">
              <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((value) => Math.max(.5, value - .1))}>{icon("zoomOut")}</button>
              <b>{Math.round(zoom * 100)}%</b>
              <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((value) => Math.min(2, value + .1))}>{icon("zoomIn")}</button>
            </span>
          </div>
        </section>

        <div className="split-handle" onPointerDown={(event) => startSplit(event, "right")} />

        <aside className="right-panel panel">
          {selected || selectedInstruction ? (
            <Inspector
              element={selected || selectedInstruction}
              isInstruction={Boolean(selectedInstruction)}
              update={selectedInstruction ? updateInstruction : updateSelected}
              reusable={Boolean(selectedInstruction?.libraryId)}
              onReusableChange={setNodeReusable}
              onDelete={() => removeElement(selectedId)}
              onGenerate={selected ? generateSelected : undefined}
              busy={selected ? generatingIds.includes(selected.id) : false}
            />
          ) : (
            <>
              <div className="panel-tabs">
                <button type="button" className={panel === "context" ? "active" : ""} onClick={() => setPanel("context")}>Context</button>
                <button type="button" className={panel === "page" ? "active" : ""} onClick={() => setPanel("page")}>Page</button>
              </div>
              {panel === "context" ? (
                <div className="panel-content">
                  <CollapsibleField label="Who I am" value={project.context.whoAmI} onChange={(value) => updateContext("whoAmI", value)} placeholder="Company, role, point of view" area />
                  <CollapsibleField label="Target audience" value={project.context.audience} onChange={(value) => updateContext("audience", value)} placeholder="Who will see this deck?" area />
                  <CollapsibleField label="Purpose of deck" value={project.context.purpose} onChange={(value) => updateContext("purpose", value)} placeholder="What should this deck achieve?" area />
                  <CollapsibleField label="Key facts / stacks" value={project.context.keyStacks} onChange={(value) => updateContext("keyStacks", value)} placeholder="Facts, products, technology, constraints" area />
                  <CollapsibleField label="Vibe" value={project.context.vibe} onChange={(value) => updateContext("vibe", value)} placeholder="Editorial, bold, minimal, premium..." area />
                </div>
              ) : (
                <div className="panel-content">
                  <Select label="Aspect ratio" value={project.aspect} onChange={(value) => commit((current) => ({ ...current, aspect: value }))} options={[["wide", "16:9 Widescreen"], ["standard", "4:3 Standard"], ["portrait", "3:4 Portrait"]]} />
                  <ColorPicker label="Slide background" value={slide.background} onChange={(value) => updateCurrentSlide({ background: value })} />
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

      {settingsOpen && (
        <Modal title="OpenAI Connection" onClose={() => setSettingsOpen(false)}>
          <div className="connection-settings">
            <Field label="OpenAI API key" type="password" value={settings.apiKey} onChange={(value) => setSettings((current) => ({ ...current, apiKey: value }))} placeholder="sk-..." />
            <Field label="Model" value={settings.model} onChange={(value) => setSettings((current) => ({ ...current, model: value }))} placeholder="gpt-5.5" />
            <p className="security-note">AI uses only the writing-direction node connected to each text object.</p>
          </div>
          <button type="button" className="primary full" onClick={() => setSettingsOpen(false)}>Save settings</button>
        </Modal>
      )}
    </div>
  );
}

function InstructionFlowNode({ data, selected }) {
  const definition = instructionTypes[data.nodeKind];
  return (
    <div className={`flow-instruction-node ${selected ? "selected" : ""}`} style={{ "--node-color": definition.color }}>
      <small>{definition.hint}</small>
      <span title={data.value}>{data.value}</span>
      {data.reusable && <b className="reusable-mark">USED</b>}
      <Handle type="source" position={Position.Right} id="instruction" className="flow-source-handle" />
    </div>
  );
}

function ObjectTargetNode() {
  return (
    <div className="flow-object-target">
      <Handle type="target" position={Position.Top} id="top" className="flow-target-handle" />
      <Handle type="target" position={Position.Right} id="right" className="flow-target-handle" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="flow-target-handle" />
      <Handle type="target" position={Position.Left} id="left" className="flow-target-handle" />
    </div>
  );
}

const flowNodeTypes = {
  instruction: InstructionFlowNode,
  objectTarget: ObjectTargetNode,
};

function SlideElement({ element, assignedInstructions, selected, editing, onPointerDown, onDoubleClick, onChange, onGenerate, generating, onContext }) {
  const position = { left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%`, zIndex: selected ? 6 : element.type === "node" ? 4 : 2 };
  const shapeStyle = element.type === "shape" ? {
    background: element.fill,
    border: `${element.borderWidth || 0}px solid ${element.borderColor}`,
    opacity: 1 - (element.opacity || 0) / 100,
  } : {};
  return (
    <div className={`slide-element content-object ${element.type} ${selected ? "selected" : ""} ${editing ? "editing" : ""}`} style={{ ...position, ...shapeStyle }} onPointerDown={(event) => onPointerDown(event, element)} onDoubleClick={(event) => { event.stopPropagation(); onDoubleClick(); }} onContextMenu={onContext}>
      {element.type === "text" && <textarea
          value={element.text}
          readOnly={!editing}
          autoFocus={editing}
          onChange={(event) => onChange({ text: event.target.value })}
          onBlur={() => {}}
          onPointerDown={(event) => {
            if (editing) event.stopPropagation();
          }}
          style={{ fontFamily: element.fontFamily, fontSize: `${Math.max(8, element.fontSize * 0.72)}px`, color: element.color, fontWeight: element.bold ? 700 : 400, fontStyle: element.italic ? "italic" : "normal", textAlign: element.align }}
        />}
      {element.type === "text" && (
        <button type="button" className={`object-ai ${generating ? "generating" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onGenerate(); }} title="AI Gen this object" disabled={generating}>
          {icon(generating ? "clock" : "spark")}
        </button>
      )}
      {element.aiUnreviewed && <span className="unreviewed-output" title="New AI output">{icon("unread")}</span>}
      {assignedInstructions.length > 0 && (
        <div className="attribute-chips">
          {assignedInstructions.map((node) => (
            <span key={node.id} style={{ "--chip-color": instructionTypes[node.nodeKind].color }}>
              {instructionTypes[node.nodeKind].hint}: {node.value}
            </span>
          ))}
        </div>
      )}
      {selected && <span className="resize-handle" onPointerDown={(event) => onPointerDown(event, element, "resize")} />}
    </div>
  );
}

function SlideThumbnail({ slide, index, aspect, active, dragging, onSelect, onGenerate, onContext, onDragStart }) {
  const hasUnreviewed = slide.elements.some((element) => element.aiUnreviewed);
  return (
    <div className={`slide-row ${active ? "active" : ""} ${slide.hidden ? "hidden-slide" : ""} ${dragging ? "dragging" : ""}`} data-slide-index={index} onContextMenu={onContext}>
      <button type="button" className="slide-drag-handle" onPointerDown={onDragStart} title="Drag to reorder">{icon("grip")}<span>{index + 1}</span></button>
      <div className="thumb-stack">
        <button type="button" className="thumbnail" style={{ aspectRatio: aspectRatios[aspect], background: slide.background }} onClick={onSelect}>
          {slide.elements.filter((element) => element.type !== "node").map((element) => (
            <span key={element.id} className={`thumb-element ${element.type}`} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%`, background: element.type === "shape" ? element.fill : "transparent", color: element.color, border: element.type === "shape" ? "1px solid #ccd1d5" : 0 }}>
              {element.text}
            </span>
          ))}
          {slide.instructionNodes.map((node) => (
            <span key={node.id} className="thumb-node" style={{ left: `${node.x}%`, top: `${node.y}%`, background: instructionTypes[node.nodeKind]?.color }}>
              {node.value}
            </span>
          ))}
          {slide.hidden && <span className="hidden-badge">{icon("eyeOff")}</span>}
          {hasUnreviewed && <span className="thumbnail-unreviewed" title="New AI output">{icon("unread")}</span>}
        </button>
        <div className="slide-meta"><span>Slide {index + 1}</span><button type="button" onClick={onGenerate}>{icon("spark")} AI Gen</button></div>
      </div>
    </div>
  );
}

function SlideDropZone({ active }) {
  return <div className={`slide-drop-zone ${active ? "active" : ""}`} />;
}

function Inspector({ element, isInstruction, update, reusable, onReusableChange, onDelete, onGenerate, busy }) {
  if (isInstruction) {
    const definition = instructionTypes[element.nodeKind];
    return (
      <>
        <div className="inspector-title"><div><i style={{ background: definition.color }} /><strong>{definition.label}</strong></div><span>Node</span></div>
        <div className="panel-content">
          <Field label={definition.label} value={element.value} onChange={(value) => update({ value })} area={element.nodeKind === "vibe"} />
          <Toggle label="Used node" description="Reuse this shared node on other objects or slides." checked={reusable} onChange={onReusableChange} />
          <button type="button" className="delete-control" onClick={onDelete}>{icon("trash")} Delete node</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="inspector-title"><strong>{element.type === "text" ? "Text box" : "Shape"}</strong><span>Selected</span></div>
      <div className="panel-content">
        {element.type === "text" ? (
          <>
            <section className="inspector-card">
              <strong>Content</strong>
              <Field label="" value={element.text} onChange={(value) => update({ text: value })} area />
            </section>
            <section className="inspector-card ai-output-card">
              <div className="card-heading">
                <strong>AI Gen</strong>
                {element.aiUnreviewed && <span>{icon("unread")} New</span>}
              </div>
              <button type="button" className="generate-control" onClick={onGenerate} disabled={busy}>{icon(busy ? "clock" : "spark")} {busy ? "Generating..." : "Generate options"}</button>
              <div className="output-list">
                {(element.aiOutputs || []).map((output, index) => (
                  <article key={`${output}-${index}`}><small>OPTION {index + 1}</small><p>{output}</p></article>
                ))}
                {!element.aiOutputs?.length && <p className="empty-output">Generated text will appear here. Edit the Content card manually to use it.</p>}
              </div>
            </section>
          </>
        ) : (
          <>
            <ColorField label="Fill color" value={element.fill} onChange={(value) => update({ fill: value })} />
            <ColorField label="Border color" value={element.borderColor} onChange={(value) => update({ borderColor: value })} />
            <RangeField label="Border width" value={element.borderWidth} min="0" max="8" onChange={(value) => update({ borderWidth: Number(value) })} />
          </>
        )}
        <button type="button" className="delete-control" onClick={onDelete}>{icon("trash")} Delete object</button>
      </div>
    </>
  );
}

function Modal({ title, wide, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><small>VIBE DECK</small><h2>{title}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

function CollapsibleField(props) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`collapsible-field ${open ? "open" : ""}`}>
      <button type="button" onClick={() => setOpen((value) => !value)}>
        <span>{props.label}</span>
        <small>{props.value ? "Defined" : "Empty"}</small>
        {icon("chevron")}
      </button>
      {open && <Field {...props} label="" />}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, area, type = "text" }) {
  return <label className="field">{label && <span>{label}</span>}{area ? <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => { const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option]; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>;
}

function ColorField({ label, value, onChange }) {
  return <label className="field"><span>{label}</span><div className="color-field"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

function ColorPicker({ label, value, onChange }) {
  return <label className="field"><span>{label}</span><input className="color-picker-only" type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function RangeField({ label, value, min, max, onChange }) {
  return <label className="field range-field"><span>{label}<b>{value}</b></span><input type="range" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default App;
