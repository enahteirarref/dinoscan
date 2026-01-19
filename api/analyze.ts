// api/analyze.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PROMPT =
  '你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。即使照片略有模糊或光线不足，也请基于可见特征给出最可能的专业推测。请提供：1.中文名称 2.地质年代 3.分类 4.预估长度 5.稀有度（普通、稀有、或传说） 6.置信度(0-100) 7.一段2句简短的专业笔记。请务必使用简体中文回答。以 JSON 格式返回: { "Name": "名称", "Era": "年代", "Classification": "分类", "Length": "长度", "Rarity": "稀有度", "Confidence": 95, "Note": "笔记内容" }';

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function normalizeArkBase(input?: string) {
  // 允许你传：
  // 1) https://ark.cn-beijing.volces.com
  // 2) https://ark.cn-beijing.volces.com/api/v3
  const base = (input || "https://ark.cn-beijing.volces.com").replace(/\/+$/, "");
  return base.endsWith("/api/v3") ? base : `${base}/api/v3`;
}

/** 读取 JSON（兼容 Vercel 是否自动解析 req.body） */
async function readJson(req: VercelRequest) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    // 提前拦截：避免上传过大导致函数直接崩
    if (total > 4.2 * 1024 * 1024) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

/** 粗略估算 base64 字节数 */
function base64Bytes(b64: string) {
  return Math.floor((b64.length * 3) / 4);
}

/** 从模型输出里提取 JSON（兼容“前后夹杂说明文字”的情况） */
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

/** 尽可能从 Ark 的 responses/chat 返回体里拿到文本 */
function pickModelText(obj: any): string {
  // 兼容 OpenAI chat/completions 风格
  const c = obj?.choices?.[0]?.message?.content;
  if (typeof c === "string" && c.trim()) return c;

  // 兼容 responses 风格：output[].content[].text
  const out = obj?.output;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const o of out) {
      const content = o?.content;
      if (Array.isArray(content)) {
        for (const p of content) {
          if (typeof p?.text === "string" && p.text.trim()) parts.push(p.text);
          if (typeof p?.content === "string" && p.content.trim()) parts.push(p.content);
        }
      }
    }
    if (parts.length) return parts.join("\n");
  }

  // 兜底
  if (typeof obj?.output_text === "string") return obj.output_text;
  if (typeof obj?.text === "string") return obj.text;

  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const ARK_API_KEY = process.env.ARK_API_KEY;
  const ARK_MODEL = process.env.ARK_MODEL; // 例如 doubao-seed-1-6-vision-250815
  const ARK_BASE = normalizeArkBase(process.env.ARK_BASE_URL);

  if (!ARK_API_KEY || !ARK_MODEL) {
    return res.status(500).json({
      error: "Missing env",
      detail: "请在 Vercel Environment Variables 配置 ARK_API_KEY 与 ARK_MODEL（Production 环境也要配）。",
    });
  }

  let body: any;
  try {
    body = await readJson(req);
  } catch (e: any) {
    if (e?.message === "REQUEST_TOO_LARGE") {
      return res.status(413).json({
        error: "Payload too large",
        detail: "你传到 /api/analyze 的 base64 过大，超过函数可承受范围。请在前端压缩/降分辨率后再传。",
      });
    }
    return res.status(400).json({ error: "Bad JSON", detail: String(e?.message || e) });
  }

  const imageBase64 = String(body?.imageBase64 || "");
  const mimeType = String(body?.mimeType || "image/jpeg");

  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

  // 建议更保守：<= 1.5MB 更稳（Vercel + 跨境调用）
  const imgBytes = base64Bytes(imageBase64);
  if (imgBytes > 1.8 * 1024 * 1024) {
    return res.status(413).json({
      error: "Image too large",
      detail: `图片约 ${(imgBytes / 1024 / 1024).toFixed(2)}MB。请把截图分辨率/质量再降一点（建议 <= 1.5MB）。`,
    });
  }

  // 用官方示例同款 Responses API：/api/v3/responses
  const upstreamUrl = `${ARK_BASE}/responses`;

  // 超时控制：避免 Vercel 卡死变 502
  const controller = new AbortController();
  const timeoutMs = 18_000; // 你配了 maxDuration 后可适当加大
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      model: ARK_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              // data URL 方式：避免你还要先把图片传到公网
              image_url: `data:${mimeType};base64,${imageBase64}`,
            },
            { type: "input_text", text: PROMPT },
          ],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 700,
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

    // 关键：把 Ark 的真实错误透传回前端（你就不会只看到 500/502 了）
    if (!upstream.ok) {
      console.error("[ARK_UPSTREAM_ERROR]", upstream.status, rawText.slice(0, 1200));
      return res.status(502).json({
        error: "Upstream Ark error",
        upstreamStatus: upstream.status,
        upstreamBody: rawText.slice(0, 2000),
        hint:
          "常见原因：ARK_MODEL 写错/没开通；Key 权限或余额；跨区域超时。请先看 upstreamBody 的真实报错内容。",
      });
    }

    let upstreamJson: any = {};
    try {
      upstreamJson = JSON.parse(rawText || "{}");
    } catch {
      // 如果 Ark 返回了非 JSON（理论上不该），直接把原文吐回去方便你排查
      console.error("[ARK_NON_JSON]", rawText.slice(0, 1200));
      return res.status(502).json({
        error: "Ark returned non-JSON",
        upstreamBody: rawText.slice(0, 2000),
      });
    }

    const modelText = pickModelText(upstreamJson);
    if (!modelText) {
      console.error("[ARK_EMPTY_TEXT]", JSON.stringify(upstreamJson).slice(0, 1200));
      return res.status(502).json({
        error: "Empty model text",
        detail: "Ark 返回体里没拿到文本字段（可能字段结构变化或被安全策略拦截）。",
        upstream: upstreamJson,
      });
    }

    // 让模型输出 JSON；如果夹杂文字，就用 extractJson 抠出来
    const data = extractJson(modelText);

    return res.status(200).json(data);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : String(e?.message || e);
    console.error("[ANALYZE_FATAL]", msg);
    return res.status(502).json({
      error: "Function failed",
      detail: msg,
      hint:
        "如果是 Timeout，多半是 Vercel(美国) → 北京 Ark 跨境延迟导致。按下面第 3 步把 regions 切到亚洲通常立刻改善。",
    });
  } finally {
    clearTimeout(timer);
  }
}
