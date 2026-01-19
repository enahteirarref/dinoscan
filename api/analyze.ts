// api/analyze.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

type Mode = "image" | "text";

const PROMPT_IMAGE =
  '你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。' +
  "请严格遵守：不要输出推理过程，不要输出任何解释文字，只输出 JSON。" +
  "即使模糊/光线不足，也要给出最可能推测。" +
  "JSON 格式必须完全如下字段：" +
  '{ "Name":"名称","Era":"年代","Classification":"分类","Length":"长度","Rarity":"普通/稀有/传说","Confidence":95,"Note":"两句简短专业笔记" }';

const PROMPT_TEXT_WRAP = (userPrompt: string) =>
  `你是一位专业且亲切的科学助理。请仅输出 JSON，不要输出推理过程，不要输出多余解释文字。\n` +
  `必须返回格式：{ "title": "...", "content": "..." }\n` +
  `用户请求如下：\n${userPrompt}`;

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

/** 简单检测：base64 解码后，检查常见图片 magic header（JPEG/PNG/WebP） */
function assertLooksLikeImageBase64(b64: string) {
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new Error("INVALID_BASE64");
  }
  if (!buf || buf.length < 16) throw new Error("IMAGE_TOO_SMALL");

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return;

  // WebP: "RIFF"...."WEBP"
  const riff = buf.toString("ascii", 0, 4) === "RIFF";
  const webp = buf.toString("ascii", 8, 12) === "WEBP";
  if (riff && webp) return;

  throw new Error("NOT_AN_IMAGE");
}

function extractJson(text: string) {
  const t = (text || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    // 容错：截取第一个 {...}（尽量小心）
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("MODEL_NOT_JSON: " + t.slice(0, 240));
  }
}

/**
 * 从 Ark Responses API 返回体里尽量拿到可用文本。
 * 优先取最终回答（message/content），没有就退到 reasoning summary。
 */
function pickAnyText(up: any): string {
  const out = up?.output;
  if (!Array.isArray(out)) return "";

  const texts: string[] = [];

  for (const o of out) {
    const content = o?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        // 常见字段：{type:"output_text", text:"..."}
        if (typeof c?.text === "string" && c.text.trim()) texts.push(c.text);
        // 兼容：{content:"..."}
        if (typeof c?.content === "string" && c.content.trim()) texts.push(c.content);
      }
    }

    const summary = o?.summary;
    if (Array.isArray(summary)) {
      for (const s of summary) {
        if (typeof s?.text === "string" && s.text.trim()) texts.push(s.text);
      }
    }
  }

  return texts.join("\n").trim();
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return null;
  }
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
      return res.status(413).json({ error: "Payload too large", detail: "请求体过大，请压缩图片或减少字段。" });
    }
    return res.status(400).json({ error: "Bad JSON", detail: String(e?.message || e) });
  }

  const mode: Mode = (body?.mode || "image") as Mode;

  // image mode fields
  const imageBase64 = String(body?.imageBase64 || "");
  const mimeType = String(body?.mimeType || "image/jpeg");

  // text mode fields
  const prompt = String(body?.prompt || "");
  const context = body?.context || {};

  // 基础校验
  if (mode === "image") {
    if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

    const imgBytes = base64Bytes(imageBase64);
    if (imgBytes > 1.8 * 1024 * 1024) {
      return res.status(413).json({
        error: "Image too large",
        detail: `图片约 ${(imgBytes / 1024 / 1024).toFixed(2)}MB，建议 <= 1.5MB。`,
      });
    }

    // 关键：避免 Ark 报 Invalid base64 image url
    try {
      assertLooksLikeImageBase64(imageBase64);
    } catch (e: any) {
      return res.status(400).json({
        error: "Invalid image",
        detail:
          e?.message === "NOT_AN_IMAGE"
            ? "imageBase64 解码后不像有效图片（请传 jpeg/png/webp 的 base64，不要用 AA== 这类测试串）。"
            : `imageBase64 校验失败：${String(e?.message || e)}`,
      });
    }
  } else if (mode === "text") {
    if (!prompt) return res.status(400).json({ error: "Missing prompt", detail: "text 模式必须提供 prompt。" });
  } else {
    return res.status(400).json({ error: "Invalid mode", detail: 'mode 只能是 "image" 或 "text"' });
  }

  const upstreamUrl = `${ARK_BASE}/responses`;

  const controller = new AbortController();
  const timeoutMs = 25_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 统一组织 payload
    const inputContent =
      mode === "image"
        ? [
            { type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` },
            { type: "input_text", text: PROMPT_IMAGE },
          ]
        : [
            {
              type: "input_text",
              text: PROMPT_TEXT_WRAP(
                // 把 context 也交给模型（可选）
                Object.keys(context || {}).length
                  ? `${prompt}\n\n附加上下文(JSON)：\n${JSON.stringify(context)}`
                  : prompt
              ),
            },
          ];

    const payload: any = {
      model: ARK_MODEL,
      input: [{ role: "user", content: inputContent }],
      temperature: 0.2,
      max_output_tokens: mode === "image" ? 1200 : 900,
      // 如 Ark 支持 JSON 输出约束，可进一步加固（不支持也不会影响；若报错你再删）
      // response_format: { type: "json_object" },
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
        hint:
          upstream.status === 400
            ? "常见原因：模型不支持该请求结构、图片不是有效 base64、或 model id/区域不匹配。"
            : "请检查 ARK_BASE_URL/ARK_MODEL/ARK_API_KEY 与网络连通性。",
      });
    }

    const upstreamJson = safeJsonParse(rawText);
    if (!upstreamJson) {
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

    // 返回结构根据 mode 对齐前端需要
    if (mode === "text") {
      // 强制兜底字段
      return res.status(200).json({
        title: data?.title || "科研简报",
        content: data?.content || "未能生成内容。",
      });
    }

    // image mode：字段名你前端 Fossil 里可能是 name/era/...，但你原 PROMPT 要求的是 Name/Era/...
    // 这里保持原样输出（前端再映射），也可做一次兼容映射
    return res.status(200).json(data);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : String(e?.message || e);
    return res.status(502).json({ error: "Function failed", detail: msg });
  } finally {
    clearTimeout(timer);
  }
}
