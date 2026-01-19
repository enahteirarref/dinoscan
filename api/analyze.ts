// api/analyze.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

type FossilJson = {
  Name: string;
  Era: string;
  Classification: string;
  Length: string;
  Rarity: "普通" | "稀有" | "传说";
  Confidence: number;
  Note: string;
};

function extractJson(text: string): any {
  // 允许模型偶尔在 JSON 前后夹带文字：尽量截取第一个 {...} 解析
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const maybe = text.slice(first, last + 1);
    return JSON.parse(maybe);
  }
  return JSON.parse(text);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 让你手动 OPTIONS 测试时返回 204，避免你现在看到的 500
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const apiKey = process.env.ARK_API_KEY;
    const model = process.env.ARK_MODEL;

    if (!apiKey) {
      res.status(500).send("Missing env ARK_API_KEY");
      return;
    }
    if (!model) {
      res.status(500).send("Missing env ARK_MODEL");
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const imageBase64 = body?.imageBase64 as string | undefined;
    const mimeType = (body?.mimeType as string | undefined) || "image/jpeg";

    if (!imageBase64) {
      res.status(400).send("Missing field: imageBase64");
      return;
    }

    // Ark（OpenAI 兼容）常见做法：用 data URL 传 base64 图片
    // 这类格式在大量示例里都这么用（data:image/jpeg;base64,...）。:contentReference[oaicite:1]{index=1}
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const prompt =
      "你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。" +
      "要求：即使照片模糊或光线不足，也必须给出‘最可能’的专业推测。" +
      "禁止回复“太暗/看不清/无法识别”作为结论；如果不确定也要输出推测，并把 Confidence 调低。" +
      "必须只输出 JSON，不要输出任何多余文字。" +
      'JSON 格式为：{ "Name":"名称","Era":"年代","Classification":"分类","Length":"长度","Rarity":"普通/稀有/传说","Confidence":95,"Note":"两句简短专业笔记" }';

    const upstream = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      // 把上游错误原样返回，便于你定位（余额/模型名/权限/格式等）
      res.status(upstream.status).send(text);
      return;
    }

    const json = JSON.parse(text);
    const content: string =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.delta?.content ??
      "";

    if (!content) {
      res.status(502).send("Upstream ok but empty content: " + text.slice(0, 500));
      return;
    }

    let data: FossilJson;
    try {
      data = extractJson(content) as FossilJson;
    } catch (e: any) {
      res.status(502).send(
        "Model did not return valid JSON. Raw content:\n" + content.slice(0, 1000)
      );
      return;
    }

    // 兜底字段，防止前端崩
    const safe: FossilJson = {
      Name: data.Name || "未知标本",
      Era: data.Era || "待定",
      Classification: data.Classification || "待定",
      Length: data.Length || "待定",
      Rarity: (data.Rarity as any) || "普通",
      Confidence: Number.isFinite(data.Confidence) ? data.Confidence : 50,
      Note: data.Note || "需要更多角度与更清晰纹理以提升判断精度。",
    };

    res.status(200).json(safe);
  } catch (err: any) {
    // 这类错误就是你看到的 FUNCTION_INVOCATION_FAILED 的根因，需要看 logs。:contentReference[oaicite:2]{index=2}
    res.status(500).send(err?.stack || err?.message || String(err));
  }
}
