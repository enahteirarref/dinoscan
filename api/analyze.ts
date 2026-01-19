// api/analyze.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROMPT =
  '你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。即使照片略有模糊或光线不足，也请基于可见特征给出最可能的专业推测。' +
  '请提供：1.中文名称 2.地质年代 3.分类 4.预估长度 5.稀有度（普通、稀有、或传说） 6.置信度(0-100) 7.一段2句简短的专业笔记。' +
  '请务必使用简体中文回答。' +
  '只输出 JSON：{ "Name":"名称","Era":"年代","Classification":"分类","Length":"长度","Rarity":"普通/稀有/传说","Confidence":95,"Note":"两句简短专业笔记" }。' +
  '注意：禁止输出除 JSON 外的任何文本。';

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

/** 读取 JSON（避免依赖 req.body 是否被自动解析） */
async function readJson(req: VercelRequest) {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;

    // 4.5MB 是 Vercel Function 的硬上限；这里提前拦截更友好
    if (total > 4.2 * 1024 * 1024) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

function base64Bytes(b64: string) {
  return Math.floor((b64.length * 3) / 4);
}

/** 尽量从模型输出里抠出 JSON */
function extractJson(text: string) {
  const t = (text || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("MODEL_NOT_JSON: " + t.slice(0, 200));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const ARK_API_KEY = process.env.ARK_API_KEY;
  const ARK_MODEL = process.env.ARK_MODEL; // 例如 doubao-seed-1-6-vision-250815
  const ARK_BASE = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com";

  if (!ARK_API_KEY || !ARK_MODEL) {
    return res.status(500).json({
      error: "Missing env",
      detail: "请在 Vercel Environment Variables 配置 ARK_API_KEY 与 ARK_MODEL，然后重新部署。",
    });
  }

  let body: any;
  try {
    body = await readJson(req);
  } catch (e: any) {
    if (e?.message === "REQUEST_TOO_LARGE") {
      return res.status(413).json({
        error: "Payload too large",
        detail: "你传到 /api/analyze 的图片 base64 过大，超过 Vercel Function 限制。请前端压缩/降分辨率。",
      });
    }
    return res.status(400).json({ error: "Bad JSON", detail: String(e?.message || e) });
  }

  const imageBase64 = (body?.imageBase64 || "").toString();
  const mimeType = (body?.mimeType || "image/jpeg").toString();

  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

  // 建议把图片压到 1.5MB 以内更稳
  const imgBytes = base64Bytes(imageBase64);
  if (imgBytes > 1.8 * 1024 * 1024) {
    return res.status(413).json({
      error: "Image too large",
      detail: `图片过大（约 ${(imgBytes / 1024 / 1024).toFixed(2)}MB）。请降低分辨率/质量（建议 <= 1.5MB）。`,
    });
  }

  const upstreamUrl = `${ARK_BASE}/api/v3/chat/completions`;

  try {
    const payload = {
      model: ARK_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    };

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        error: "Upstream error",
        status: upstream.status,
        detail: rawText.slice(0, 1200),
      });
    }

    let modelText = "";
    try {
      const j = JSON.parse(rawText);
      modelText = j?.choices?.[0]?.message?.content || "";
    } catch {
      modelText = rawText;
    }

    const data = extractJson(modelText);

    return res.status(200).json({
      Name: data.Name ?? "未知标本",
      Era: data.Era ?? "待定",
      Classification: data.Classification ?? "待定",
      Length: data.Length ?? "待定",
      Rarity: data.Rarity ?? "普通",
      Confidence: Number(data.Confidence ?? 70),
      Note: data.Note ?? "标本特征正在进一步比对中。",
    });
  } catch (e: any) {
    return res.status(500).json({
      error: "Function failed",
      detail: String(e?.message || e),
    });
  }
}
