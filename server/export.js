import pptxgen from "pptxgenjs";

const ASPECTS = {
  wide: { width: 13.333, height: 7.5 },
  standard: { width: 10, height: 7.5 },
  portrait: { width: 7.5, height: 10 },
};

function cleanHex(value, fallback = "FFFFFF") {
  const color = String(value || "").replace("#", "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(color) ? color : fallback;
}

export async function buildPptx(project) {
  const pptx = new pptxgen();
  const size = ASPECTS[project.aspect] || ASPECTS.wide;
  pptx.defineLayout({ name: "VIBE_DECK", width: size.width, height: size.height });
  pptx.layout = "VIBE_DECK";
  pptx.author = "Vibe Deck";
  pptx.subject = project.context?.purpose || "AI-assisted presentation";
  pptx.title = project.name || "Vibe Deck";
  pptx.company = project.context?.whoAmI || "";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: project.defaults?.fontFamily || "Aptos Display",
    bodyFontFace: project.defaults?.fontFamily || "Aptos",
    lang: "en-US",
  };

  const sourceSlides = project.slides?.length
    ? project.slides
    : [{ background: project.background, elements: project.elements || [] }];

  for (const sourceSlide of sourceSlides) {
    if (sourceSlide.hidden) continue;
    const slide = pptx.addSlide();
    slide.background = { color: cleanHex(sourceSlide.background) };

    for (const element of sourceSlide.elements || []) {
      if (element.type === "node") continue;
      const x = (element.x / 100) * size.width;
      const y = (element.y / 100) * size.height;
      const w = (element.w / 100) * size.width;
      const h = (element.h / 100) * size.height;

      if (element.type === "shape") {
        slide.addShape(pptx.ShapeType.rect, {
          x,
          y,
          w,
          h,
          fill: { color: cleanHex(element.fill, "E8EAED"), transparency: element.opacity ?? 0 },
          line: { color: cleanHex(element.borderColor, element.fill || "E8EAED"), transparency: element.borderWidth ? 0 : 100, width: element.borderWidth || 0 },
        });
      }

      slide.addText(element.text || "", {
        x,
        y,
        w,
        h,
        fontFace: element.fontFamily || project.defaults?.fontFamily || "Aptos",
        fontSize: Number(element.fontSize) || 24,
        color: cleanHex(element.color, "111315"),
        bold: Boolean(element.bold),
        italic: Boolean(element.italic),
        margin: element.type === "shape" ? 0.08 : 0,
        valign: element.valign || "mid",
        align: element.align || "left",
        fit: "shrink",
        transparency: 0,
      });
    }
  }

  return pptx.write({ outputType: "nodebuffer" });
}
