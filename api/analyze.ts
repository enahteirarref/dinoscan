// api/analyze.ts
export default async function handler(req: any, res: any) {
  // 预检请求：一定先放行，避免你现在 OPTIONS 也 500
  if (req.method === "OPTIONS") return res.status(204).end();

  // 你用浏览器直接打开 /api/analyze 会是 GET，这里返回 405 而不是崩溃
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) return res.status(400).send("Missing imageBase64");

    // 先验证环境变量是否存在（下一步你要在 Vercel 配 ARK_API_KEY）
    const apiKey = process.env.ARK_API_KEY;
    const model = process.env.ARK_MODEL || "doubao-seed-1-6-vision-250815";
    if (!apiKey) return res.status(500).send("Missing ARK_API_KEY");

    // 允许传纯 base64；如果误传 dataURL，这里剥掉前缀
    let b64 = imageBase64;
    if (typeof b64 === "string" && b64.startsWith("data:")) {
      const comma = b64.indexOf(",");
      b64 = comma >= 0 ? b64.slice(comma + 1) : b64;
    }

    // 火山方舟 Responses API 支持图像 base64 形态输入（image_url 可为 base64/data URL 形式）:contentReference[oaicite:2]{index=2}
    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${b64}`;

    const prompt =
      "你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。即使照片略有模糊或光线不足，也请基于可见特征给出最可能的专业推测。" +
      "请提供：1.中文名称 2.地质年代 3.分类 4.预估长度 5.稀有度（普通、稀有、或传说） 6.置信度(0-100) 7.一段2句简短的专业笔记。" +
      '只返回 JSON：{ "Name":"名称","Era":"年代","Classification":"分类","Length":"长度","Rarity":"稀有度","Confidence":95,"Note":"笔记内容" }';

    const upstream = await fetch("https://ark.cn-beijing.volces.com/api/v3/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: dataUrl },
              { type: "input_text", text: prompt },
            ],
          },
        ],
      }),
    });

    const rawText = await upstream.text();
    if (!upstream.ok) return res.status(502).send(`Upstream ${upstream.status}: ${rawText}`);

    const upstreamJson = JSON.parse(rawText);

    // 抽取模型输出文本（多路兜底）
    const outText =
      upstreamJson?.output_text ||
      upstreamJson?.output?.[0]?.content?.find((c: any) => c?.type === "output_text")?.text ||
      "";

    if (!outText) return res.status(502).json({ error: "No output text", raw: upstreamJson });

    // 解析 JSON；解析失败就把原文塞进 Note，保证前端不炸
    let data: any;
    try {
      data = JSON.parse(outText);
    } catch {
      data = {
        Name: "未知标本",
        Era: "待定",
        Classification: "待定",
        Length: "待定",
        Rarity: "普通",
        Confidence: 50,
        Note: String(outText).slice(0, 200),
      };
    }

    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).send("Server error: " + (e?.message || String(e)));
  }
}
