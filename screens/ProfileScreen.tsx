
import React, { useState } from 'react';
import { AppScreen } from '../App';
import BottomNav from '../components/BottomNav';

interface ProfileScreenProps {
  onScanClick: () => void;
  onNavigate: (screen: AppScreen) => void;
  currentScreen: AppScreen;
  stats: { finds: number };
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onScanClick, onNavigate, currentScreen, stats }) => {
  const [showTools, setShowTools] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [toolStatus, setToolStatus] = useState<string | null>(null);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleToolAction = (action: string) => {
    const statusMap: Record<string, string> = {
      "Data Export": "正在导出加密日志...",
      "Sync AI": "正在同步AI数据库...",
      "Purge Cache": "正在清除系统缓存...",
      "Uplink": "正在建立上行链路...",
      "View Logs": "正在获取系统日志..."
    };
    
    setToolStatus(statusMap[action] || `正在执行 ${action}...`);
    setTimeout(() => {
      setToolStatus(`${action} 执行成功。`);
      setTimeout(() => setToolStatus(null), 2000);
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark pb-24 overflow-y-auto no-scrollbar transition-colors">
      <header className="p-8 pt-20 bg-forest-green dark:bg-gray-900 text-white rounded-b-[4rem] relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center border-4 border-white/10 mb-6 shadow-inner">
            <span className="material-symbols-outlined text-4xl text-primary">shield_person</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">个人私密工作站</h2>
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mt-2">野外勘测加密通道已开启</p>
        </div>
      </header>

      <div className="px-6 -mt-12 relative z-20">
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center mb-8 border border-white dark:border-gray-700 transition-colors">
          <p className="text-5xl font-black text-forest-green dark:text-primary mb-2">{stats.finds}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">已在日志中记录的化石标本</p>
        </div>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-forest-green/30 dark:text-primary/30 uppercase tracking-[0.3em] ml-4">基站核心设置</h3>
          
          <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-[2rem] flex items-center justify-between shadow-sm border border-gray-50 dark:border-gray-700">
             <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-background-light dark:bg-gray-700 rounded-2xl flex items-center justify-center text-forest-green dark:text-primary">
                  <span className="material-symbols-outlined text-2xl">{isDarkMode ? 'dark_mode' : 'light_mode'}</span>
                </div>
                <span className="font-bold text-forest-green dark:text-white text-sm">黑夜模式 (光敏保护)</span>
             </div>
             <button 
                onClick={toggleDarkMode}
                className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${isDarkMode ? 'bg-primary' : 'bg-gray-200'}`}
             >
                <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
             </button>
          </div>

          <ProfileButton 
            icon="database" 
            label="导出加密考察日志" 
            onClick={() => handleToolAction("Data Export")} 
          />
          <ProfileButton 
            icon="settings" 
            label="系统深度诊断" 
            onClick={() => setShowTools(true)} 
          />
        </section>
      </div>

      {showTools && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-white dark:border-gray-800">
            <h3 className="text-lg font-black text-forest-green dark:text-primary uppercase tracking-widest mb-6 text-center">系统维护工具</h3>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <ToolIcon icon="cloud_sync" label="云端同步" active={toolStatus?.includes("Sync AI")} onClick={() => handleToolAction("Sync AI")} />
              <ToolIcon icon="memory" label="清理缓存" active={toolStatus?.includes("Purge Cache")} onClick={() => handleToolAction("Purge Cache")} />
              <ToolIcon icon="satellite_alt" label="链路增强" active={toolStatus?.includes("Uplink")} onClick={() => handleToolAction("Uplink")} />
              <ToolIcon icon="terminal" label="系统日志" active={toolStatus?.includes("View Logs")} onClick={() => handleToolAction("View Logs")} />
            </div>
            
            {toolStatus && (
              <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-xl text-center text-[10px] font-black text-primary uppercase animate-pulse">
                {toolStatus}
              </div>
            )}

            <button 
              onClick={() => setShowTools(false)}
              className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-forest-green dark:text-white font-black rounded-2xl active:scale-95 transition-transform uppercase text-xs tracking-widest"
            >
              关闭诊断窗口
            </button>
          </div>
        </div>
      )}

      <BottomNav onNavigate={onNavigate} onScanClick={onScanClick} currentScreen={currentScreen} />
    </div>
  );
};

const ProfileButton = ({ icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full bg-white dark:bg-gray-800 p-6 rounded-[2rem] flex items-center gap-5 shadow-sm border border-gray-50 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700 active:scale-[0.99] transition-all"
  >
    <div className="w-12 h-12 bg-background-light dark:bg-gray-700 rounded-2xl flex items-center justify-center text-forest-green dark:text-primary">
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <span className="flex-1 text-left font-bold text-forest-green dark:text-white text-sm tracking-tight">{label}</span>
    <span className="material-symbols-outlined text-gray-300">chevron_right</span>
  </button>
);

const ToolIcon = ({ icon, label, onClick, active }: any) => (
  <button 
    onClick={onClick}
    className={`p-5 rounded-3xl flex flex-col items-center gap-2 border transition-all active:scale-90 ${active ? 'bg-primary border-primary text-white' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}
  >
    <span className={`material-symbols-outlined ${active ? 'text-white' : 'text-primary'}`}>{icon}</span>
    <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
  </button>
);

export default ProfileScreen;
