import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPptx } from "./export.js";
import { buildRefinementPrompt } from "./refinePrompt.js";

const app = express();
const port = Number(process.env.PORT || 4174);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, name: "Vibe Deck" });
});

app.post("/api/export", async (request, response) => {
  try {
    const buffer = await buildPptx(request.body);
    const filename = `${String(request.body.name || "Vibe Deck").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Vibe-Deck"}.pptx`;
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send(buffer);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "PowerPoint export failed." });
  }
});

app.post("/api/refine", async (request, response) => {
  const { apiKey, model = "gpt-5.5", context, aiConfig, feedback, elements = [] } = request.body;
  if (!apiKey) {
    return response.status(400).json({ error: "Add an OpenAI API key in Settings first." });
  }

  const prompt = buildRefinementPrompt({ context, aiConfig, feedback, elements });

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "slide_content",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                eyebrow: { type: "string" },
                title: { type: "string" },
                points: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                footer: { type: "string" },
              },
              required: ["eyebrow", "title", "points", "footer"],
            },
          },
        },
      }),
    });

    const payload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      return response.status(openaiResponse.status).json({ error: payload.error?.message || "OpenAI request failed." });
    }

    const outputText = payload.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
    response.json({ content: JSON.parse(outputText) });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Could not refine the slide. Check the API key and internet connection." });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.use((request, response, next) => {
    if (request.method !== "GET") return next();
    response.sendFile(path.join(root, "dist", "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Vibe Deck server: http://localhost:${port}`);
});
