// Extracción de requerimientos desde un documento de consulta real (PDF/MD/TXT
// o texto pegado). El documento es CONTENIDO, nunca instrucciones. La clave de
// Gemini nunca sale del servidor. Nunca se sustituye el resultado por un fixture
// en silencio. specs/ai-spec.md, specs/features/document-processing.md
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CATALOG } from "@/lib/fixtures";
import {
  extractRequirementsFromText,
  extractWithGemini,
  curatedRequirements,
  reconcileWithCatalog,
  toRequirements,
} from "@/lib/extract";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const OK_EXT = [".pdf", ".md", ".markdown", ".txt", ".text"];

async function pdfToText(bytes: Uint8Array): Promise<string | null> {
  try {
    const mod = await import("unpdf");
    const { text } = await mod.extractText(await mod.getDocumentProxy(bytes), {
      mergePages: true,
    });
    const merged = Array.isArray(text) ? (text as string[]).join("\n") : (text as string);
    return typeof merged === "string" && merged.trim() ? merged : null;
  } catch {
    return null; // unpdf ausente o PDF ilegible
  }
}

export async function POST(req: Request) {
  const projectId = "project-demo";
  const documentId = `doc-${Date.now().toString(36)}`;
  const ct = req.headers.get("content-type") ?? "";

  let text = "";
  let origin = "";

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();

      if (form.get("example") === "true") {
        const p = path.join(process.cwd(), "..", "..", "data", "demo-document.md");
        text = await readFile(p, "utf8");
        origin = "ejemplo";
      } else if (typeof form.get("text") === "string" && (form.get("text") as string).trim()) {
        text = form.get("text") as string;
        origin = "pegado";
      } else {
        const file = form.get("file");
        if (!(file instanceof File)) {
          return NextResponse.json({ error: "Falta el archivo o el texto." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return NextResponse.json({ error: "El archivo supera 10 MB." }, { status: 413 });
        }
        const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
        if (!OK_EXT.includes(ext)) {
          return NextResponse.json(
            { error: `Formato no soportado (${ext || "sin extensión"}). Usa PDF, Markdown o texto.` },
            { status: 415 },
          );
        }
        origin = file.name;
        if (ext === ".pdf") {
          const t = await pdfToText(new Uint8Array(await file.arrayBuffer()));
          if (t === null) {
            return NextResponse.json(
              { error: "No se pudo leer el PDF. Conviértelo a texto o pega el contenido." },
              { status: 422 },
            );
          }
          text = t;
        } else {
          text = await file.text();
        }
      }
    } else {
      const b = await req.json().catch(() => ({}));
      if (typeof b.text === "string") {
        text = b.text;
        origin = "pegado";
      }
    }
  } catch {
    return NextResponse.json({ error: "No se pudo procesar el documento." }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "El documento está vacío o es ilegible." },
      { status: 422 },
    );
  }

  // --- extracción: IA -> analizador -> conjunto demo curado ---
  let source: "gemini" | "parser" | "demo" = "parser";
  let raws: Awaited<ReturnType<typeof extractWithGemini>> = null;

  const key = process.env.GEMINI_API_KEY;
  const useGemini = !!key && process.env.USE_AI_MOCK !== "true";
  const usable = (rs: { quantity: number | null }[] | null) => !!rs && rs.length >= 3;

  if (useGemini) {
    const g = await extractWithGemini(text, {
      apiKey: key!,
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      timeoutMs: 12000,
    });
    raws = g ? reconcileWithCatalog(g, CATALOG) : null;
  }
  if (usable(raws)) {
    source = "gemini";
  } else {
    const parsed = extractRequirementsFromText(text, CATALOG);
    if (usable(parsed)) {
      raws = parsed;
      source = "parser";
    } else {
      raws = curatedRequirements(CATALOG);
      source = "demo";
    }
  }

  const requirements = toRequirements(raws ?? [], projectId, documentId);

  return NextResponse.json({
    source,
    requirements,
    notice:
      requirements.length === 0
        ? "Sin requerimientos detectados en el documento."
        : source === "gemini"
          ? "Expediente interpretado con IA y validado."
          : "Expediente interpretado.",
    meta: { engine: source, origin, chars: text.length, requirements: requirements.length },
  });
}
