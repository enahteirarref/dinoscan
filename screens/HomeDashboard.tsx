import React, { useState } from 'react';
import { AppScreen } from '../App';
import BottomNav from '../components/BottomNav';
import { Fossil } from '../types';

interface HomeDashboardProps {
  onScanClick: () => void;
  onNavigate: (screen: AppScreen) => void;
  currentScreen: AppScreen;
  onFossilClick: (fossil: Fossil) => void;
}

type Insight = { title: string; content: string };

async function callBackendText(prompt: string, context?: Record<string, any>): Promise<Insight> {
  const r = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'text',
      prompt,
      context: context || {},
    }),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`API ${r.status}: ${text}`);

  try {
    return JSON.parse(text);
  } catch {
    console.error('Invalid JSON from /api/analyze:', text);
    throw new Error(`Invalid JSON from /api/analyze: ${text.slice(0, 200)}`);
  }
}

const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onScanClick,
  onNavigate,
  currentScreen,
  onFossilClick,
}) => {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGeologySync = async () => {
    setLoading(true);
    setInsight({
      title: '正在获取地理坐标...',
      content: '正在通过卫星定位您当前的岩层位置并查询地质数据库...',
    });

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const { latitude, longitude } = pos.coords;

      const prompt = `你是一位地质学和古生物学专家。当前坐标为：纬度 ${latitude.toFixed(
        4
      )}, 经度 ${longitude.toFixed(4)}。
请结合该位置的公开地理与地质信息（允许基于常识推断，并注明不确定性），分析：
1) 该区域更可能出现的岩性类型（沉积岩/火成岩/变质岩，必要时举例砂岩、泥岩等）
2) 可能的地质年代范围（如侏罗纪/白垩纪等，给出理由）
3) 在该处发现恐龙化石的可能性评估（低/中/高）与依据
务必使用专业且亲切的简体中文回答。
返回 JSON 格式：{ "title": "地层综合评估", "content": "详细分析..." }`;

      const data = await callBackendText(prompt, {
        scene: 'geology_sync',
        latitude,
        longitude,
      });

      setInsight({
        title: data.title || '地层分析报告',
        content: data.content || '无法获取当前位置的具体地层数据。',
      });
    } catch (e: any) {
      setInsight({
        title: '同步失败',
        content: e?.message?.includes('Geolocation')
          ? '无法获取您的 GPS 信号（请检查浏览器定位权限）。'
          : '定位或后端分析失败，请稍后再试。',
      });
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInsightClick = async (topic: string) => {
    setLoading(true);
    setInsight({ title: '正在同步存档...', content: `正在查询关于 ${topic} 的科研资料...` });

    try {
      const prompt = `你是一位古生物学家。请针对“${topic}”提供一段真实、温暖的科学简报。
要求：信息尽量基于通识科学与常见研究结论；如涉及不确定点请明确说明。
必须使用简体中文。
返回 JSON 格式：{ "title": "...", "content": "..." }`;

      const data = await callBackendText(prompt, { scene: 'toolbox_brief', topic });

      setInsight({
        title: data.title || `${topic} 简报`,
        content: data.content || '未能获取到简报内容。',
      });
    } catch (e: any) {
      setInsight({ title: '同步中断', content: e?.message || '归档连接失败。' });
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark transition-colors duration-500">
      <header className="px-6 pt-12 pb-6 flex justify-between items-end bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-forest-green dark:text-primary tracking-tighter leading-none">
            探寻<span className="text-primary dark:text-white">助手</span>
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
            野外科研协作平台 v3.6
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar">
        <section className="mb-8">
          <div
            onClick={handleGeologySync}
            className="bg-forest-green dark:bg-primary/20 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all border border-white/10"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
              <span className="material-symbols-outlined text-[140px]">architecture</span>
            </div>
            <div className="relative z-10">
              <span className="bg-primary/30 text-primary px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-primary/40">
                实时 GPS 地层同步
              </span>
              <h2 className="text-3xl font-bold leading-tight mt-6">
                地层与岩性 <br />
                深度探测
              </h2>
              <p className="text-white/60 text-xs mt-4 leading-relaxed max-w-[80%]">
                点击此处，系统将根据您当前坐标分析岩石属性及化石蕴藏潜力。
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-xs font-black text-forest-green dark:text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            科研工具箱
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InsightButton icon="biotech" label="生物矿化" onClick={() => handleInsightClick('生物矿化')} />
            <InsightButton
              icon="precision_manufacturing"
              label="化石修复"
              onClick={() => handleInsightClick('化石修复')}
            />
            <InsightButton icon="history_edu" label="考察日志" onClick={() => onNavigate(AppScreen.COLLECTION)} />
            <InsightButton icon="monitoring" label="激光雷达" onClick={() => handleInsightClick('激光雷达探测')} />
          </div>
        </section>
      </main>

      {insight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-[3rem] shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar pb-12">
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center z-10">
              <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">深度分析报告</h3>
              <button
                onClick={() => setInsight(null)}
                className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined dark:text-white">close</span>
              </button>
            </div>

            <div className="p-8">
              {loading ? (
                <div className="py-20 flex flex-col items-center gap-6 text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-xs font-black text-forest-green dark:text-primary uppercase tracking-widest">
                      {insight.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">{insight.content}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fadeIn">
                  <h2 className="text-2xl font-black text-forest-green dark:text-white leading-tight">{insight.title}</h2>
                  <div className="h-1 w-12 bg-primary rounded-full"></div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-medium">{insight.content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav onNavigate={onNavigate} onScanClick={onScanClick} currentScreen={currentScreen} />
    </div>
  );
};

const InsightButton = ({ icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className="bg-white dark:bg-gray-800/50 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center active:scale-95 transition-all hover:border-primary/50 group overflow-hidden h-32"
  >
    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-forest-green dark:text-primary mb-3">
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center">
      {label}
    </span>
  </button>
);

export default HomeDashboard;
