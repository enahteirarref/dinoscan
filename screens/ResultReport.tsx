import React, { useState } from 'react';
import { Fossil } from '../types';

interface ResultReportProps {
  fossil: Fossil;
  onBack: () => void;
  onSave: () => void;
}

interface ResearchData {
  scientificOverview: string;
  habitat: string;
  funFacts: string[];
  diet: string;
  youtubeQuery: string;
}

/**
 * 调用后端 /api/analyze（文本模式）
 * 约定请求：
 *  {
 *    mode: "text",
 *    prompt: "...",
 *    context: {...}
 *  }
 * 约定返回（JSON）：
 *  {
 *    scientificOverview: "...",
 *    habitat: "...",
 *    funFacts: ["...", "...", "..."],
 *    diet: "...",
 *    youtubeQuery: "..."
 *  }
 */
async function callBackendResearch(payload: {
  prompt: string;
  context?: Record<string, any>;
}): Promise<ResearchData> {
  const r = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'text',
      prompt: payload.prompt,
      context: payload.context || {},
    }),
  });

  const text = await r.text();

  if (!r.ok) {
    throw new Error(`API ${r.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    // 便于排查：返回的不是 JSON 时，把原始内容截断出来
    console.error('Invalid JSON from /api/analyze:', text);
    throw new Error(`Invalid JSON from /api/analyze: ${text.slice(0, 200)}`);
  }
}

const ResultReport: React.FC<ResultReportProps> = ({ fossil, onBack, onSave }) => {
  const [isResearching, setIsResearching] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  const handleLearnMore = async () => {
    setIsResearching(true);
    setShowModal(true);
    setResearchData(null);
    setResearchError(null);

    const prompt = `请为恐龙 "${fossil.name}" 提供详细的古生物学简报。
要求包含:
1. 科学综述 (2-3句话)。
2. 典型的栖息地描述。
3. 3个独特且有趣的冷知识。
4. 饮食类型。
5. 一个特定的 YouTube 搜索关键词，用于寻找该物种的高质量科学复原或 CGI 视频。

务必使用简体中文。
返回 JSON 格式:
{
  "scientificOverview": "...",
  "habitat": "...",
  "funFacts": ["...", "...", "..."],
  "diet": "...",
  "youtubeQuery": "..."
}`;

    try {
      const data = await callBackendResearch({
        prompt,
        context: {
          scene: 'result_report_research',
          fossilName: fossil.name,
          fossilEra: fossil.era,
          fossilClassification: fossil.classification,
        },
      });

      // 基础兜底，避免 UI 崩
      const safe: ResearchData = {
        scientificOverview: data?.scientificOverview || '暂无科学综述。',
        habitat: data?.habitat || '暂无栖息地信息。',
        funFacts: Array.isArray(data?.funFacts) ? data.funFacts.slice(0, 3) : [],
        diet: data?.diet || '未知',
        youtubeQuery: data?.youtubeQuery || `${fossil.name} 科学复原`,
      };

      if (safe.funFacts.length === 0) {
        safe.funFacts = ['暂无冷知识（后端未返回 funFacts）。', '你可以稍后重试。', '或检查后端 text 模式输出格式。'];
      }

      setResearchData(safe);
    } catch (error: any) {
      console.error('Research failed', error);
      setResearchError(error?.message || 'Research failed');
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background-light dark:bg-background-dark overflow-y-auto no-scrollbar pb-32 relative">
      <header className="sticky top-0 z-30 bg-background-light/80 dark:bg-gray-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-sm font-bold text-forest-green dark:text-primary uppercase tracking-widest">
          化石分析报告
        </h1>
        <button className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform">
          <span className="material-symbols-outlined dark:text-white">ios_share</span>
        </button>
      </header>

      <main className="px-6 pt-2">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-1">
            <span className="text-4xl font-extrabold text-primary tracking-tighter">
              {fossil.matchConfidence}% 匹配度
            </span>
            <span className="absolute -right-6 top-1 flex h-3 w-3">
              <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative h-3 w-3 rounded-full bg-primary"></span>
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 tracking-wider uppercase">生物特征已验证</p>
        </div>

        <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl ring-4 ring-white dark:ring-gray-800 mb-8 group">
          <img
            src={fossil.imageUrl}
            className="w-full h-full object-cover grayscale-[10%] group-hover:scale-110 transition-transform duration-1000"
            alt="Result"
          />
          <div className="absolute inset-0 scan-grid opacity-30"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-6 left-6 right-6">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-5 rounded-3xl flex justify-between items-center shadow-lg border border-white/40 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-black text-forest-green dark:text-white leading-none mb-1 uppercase tracking-tight">
                  {fossil.name}
                </h2>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                  {fossil.classification}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white">
                <span className="material-symbols-outlined filled text-2xl">verified</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard icon="history" label="地质年代" value={fossil.era} color="bg-cream-yellow" />
          <StatCard
            icon="category"
            label="分类"
            value={fossil.classification}
            color="bg-green-50"
            iconColor="text-primary"
          />
          <StatCard icon="straighten" label="预估长度" value={fossil.length} color="bg-gray-100" />
          <StatCard
            icon="stars"
            label="稀有程度"
            value={fossil.rarity}
            color="bg-yellow-50"
            iconColor="text-yellow-600"
            isFilled
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm mb-12 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">description</span>
            </div>
            <h3 className="text-sm font-black text-forest-green dark:text-white uppercase tracking-widest">
              现场观察笔记
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed italic bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border-l-4 border-primary/40">
            "{fossil.note}"
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 flex gap-4 z-40">
        <button
          onClick={handleLearnMore}
          className="flex-1 bg-gray-100 dark:bg-gray-800 py-4 rounded-2xl font-black text-forest-green dark:text-white text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-xl">school</span>
          深入研究
        </button>
        <button
          onClick={onSave}
          className="flex-[1.5] bg-primary py-4 rounded-2xl font-black text-white text-xs uppercase tracking-widest shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-xl">inventory_2</span>
          保存至日志
        </button>
      </footer>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-[3rem] shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar pb-12">
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-forest-green dark:text-white uppercase tracking-widest">
                    AI 研究简报
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">{fossil.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined dark:text-white">close</span>
              </button>
            </div>

            <div className="p-6">
              {isResearching ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-forest-green dark:text-primary font-black uppercase tracking-[0.2em] text-xs">
                    正在调取古生物数据库...
                  </p>
                </div>
              ) : researchError ? (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-sm font-black text-forest-green dark:text-white">获取失败</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                    {researchError}
                  </p>
                  <div className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-line">
                    排查建议：
                    {'\n'}1) 确认后端 /api/analyze 支持 mode:"text"
                    {'\n'}2) 确认后端返回的是 JSON（不是一段纯文本）
                    {'\n'}3) 若 Vercel 日志显示 Ark status:"incomplete"，后端需要兼容抽取 summary 字段或重试
                  </div>
                </div>
              ) : researchData ? (
                <div className="space-y-8 animate-fadeIn">
                  <section>
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">
                      科学综述
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-medium">
                      {researchData.scientificOverview}
                    </p>
                  </section>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">食性</p>
                      <p className="text-sm font-bold text-forest-green dark:text-white flex items-center gap-2">
                        {researchData.diet}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">栖息地</p>
                      <p className="text-sm font-bold text-forest-green dark:text-white flex items-center gap-2">
                        {researchData.habitat}
                      </p>
                    </div>
                  </div>

                  <section>
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">
                      你不知道的冷知识
                    </h4>
                    <ul className="space-y-3">
                      {researchData.funFacts.map((fact, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
                          <span className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] shrink-0 font-black">
                            {i + 1}
                          </span>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">
                      YouTube 搜索关键词
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {researchData.youtubeQuery}
                    </p>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  color,
  iconColor = 'text-forest-green',
  isFilled = false,
}: any) => (
  <div
    className={`rounded-3xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-50 dark:border-gray-700 flex flex-col gap-3 transition-all hover:-translate-y-1`}
  >
    <div className={`w-10 h-10 ${color} rounded-2xl flex items-center justify-center ${iconColor}`}>
      <span className={`material-symbols-outlined text-xl ${isFilled ? 'filled' : ''}`}>{icon}</span>
    </div>
    <div>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-xs font-bold text-forest-green dark:text-white truncate">{value}</p>
    </div>
  </div>
);

export default ResultReport;
