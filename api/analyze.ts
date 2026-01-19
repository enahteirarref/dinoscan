// api/analyze.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROMPT =
  '你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。' +
  '请严格遵守：不要输出推理过程，不要输出任何解释文字，只输出 JSON。' +
  '即使模糊/光线不足，也要给出最可能推测。' +
  'JSON 格式必须完全如下字段：' +
  '{ "Name":"名称","Era":"年代","Classification":"分类","Length":"长度","Rarity":"普通/稀有/传说","Confidence":95,"Note":"两句简短专业笔记" }';

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function normalizeArkBase(input?: string) {
  const base = (input || "https://ark.cn-beijing.volces.com").replace(/\/+$/, "");
  return base.endsWith("/api/v3") ? base : `${base}/api/v3`;
}

async function readJson(req: VercelRequest) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 4.2 * 1024 * 1024) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

function base64Bytes(b64: string) {
  return Math.floor((b64.length * 3) / 4);
}

function extractJson(text: string) {
  const t = (text || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("MODEL_NOT_JSON: " + t.slice(0, 240));
  }
}

/**
 * 从 Responses API 返回体里尽量拿到可用文本。
 * 优先取最终回答（message/content），没有就退到 reasoning summary。
 */
function pickAnyText(up: any): string {
  const out = up?.output;
  if (!Array.isArray(out)) return "";

  const texts: string[] = [];

  for (const o of out) {
    // 常见：type="message" content=[{type:"output_text",text:"..."}]
    const content = o?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) texts.push(c.text);
        if (typeof c?.content === "string" && c.content.trim()) texts.push(c.content);
      }
    }

    // 你这次拿到的是：type="reasoning" summary=[{type:"summary_text",text:"..."}]
    const summary = o?.summary;
    if (Array.isArray(summary)) {
      for (const s of summary) {
        if (typeof s?.text === "string" && s.text.trim()) texts.push(s.text);
      }
    }
  }

  return texts.join("\n").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const ARK_API_KEY = process.env.ARK_API_KEY;
  const ARK_MODEL = process.env.ARK_MODEL;
  const ARK_BASE = normalizeArkBase(process.env.ARK_BASE_URL);

  if (!ARK_API_KEY || !ARK_MODEL) {
    return res.status(500).json({
      error: "Missing env",
      detail: "请在 Vercel Environment Variables 配置 ARK_API_KEY 与 ARK_MODEL（Production 也要配），并重新部署。",
    });
  }

  let body: any;
  try {
    body = await readJson(req);
  } catch (e: any) {
    if (e?.message === "REQUEST_TOO_LARGE") {
      return res.status(413).json({ error: "Payload too large", detail: "base64 过大，请前端压缩图片后再传。" });
    }
    return res.status(400).json({ error: "Bad JSON", detail: String(e?.message || e) });
  }

  const imageBase64 = String(body?.imageBase64 || "");
  const mimeType = String(body?.mimeType || "image/jpeg");

  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

  const imgBytes = base64Bytes(imageBase64);
  if (imgBytes > 1.8 * 1024 * 1024) {
    return res.status(413).json({
      error: "Image too large",
      detail: `图片约 ${(imgBytes / 1024 / 1024).toFixed(2)}MB，建议 <= 1.5MB。`,
    });
  }

  const upstreamUrl = `${ARK_BASE}/responses`;

  const controller = new AbortController();
  const timeoutMs = 25_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      model: ARK_MODEL,
      // 强约束：不要推理，只输出 JSON（避免 reasoning 吃满 token）
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` },
            { type: "input_text", text: PROMPT },
          ],
        },
      ],
      temperature: 0.2,
      // 你之前 700 完全被 reasoning 吃掉了，这里提高一些
      max_output_tokens: 1200,
      // 如果 Ark 支持该字段，可进一步降低推理（不支持也没关系）
      // reasoning: { effort: "low" }
    };

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        error: "Upstream Ark error",
        upstreamStatus: upstream.status,
        upstreamBody: rawText.slice(0, 2000),
      });
    }

    let upstreamJson: any = {};
    try {
      upstreamJson = JSON.parse(rawText || "{}");
    } catch {
      return res.status(502).json({ error: "Ark returned non-JSON", upstreamBody: rawText.slice(0, 2000) });
    }

    const anyText = pickAnyText(upstreamJson);
    if (!anyText) {
      return res.status(502).json({
        error: "Empty model text",
        detail: "Ark 返回体里没拿到文本字段（可能被截断/字段结构变化）。",
        upstream: upstreamJson,
      });
    }

    const data = extractJson(anyText);
    return res.status(200).json(data);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : String(e?.message || e);
    return res.status(502).json({ error: "Function failed", detail: msg });
  } finally {
    clearTimeout(timer);
  }
}
