
import React from 'react';
import { AppScreen } from '../App';

interface BottomNavProps {
  onNavigate: (screen: AppScreen) => void;
  onScanClick: () => void;
  currentScreen: AppScreen;
}

const BottomNav: React.FC<BottomNavProps> = ({ onNavigate, onScanClick, currentScreen }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-[90px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border-t border-gray-100 dark:border-gray-800 flex items-center justify-around px-4 pb-4 z-40">
      <NavItem 
        icon="home" 
        label="首页" 
        active={currentScreen === AppScreen.HOME} 
        onClick={() => onNavigate(AppScreen.HOME)} 
      />
      <NavItem 
        icon="backpack" 
        label="日志" 
        active={currentScreen === AppScreen.COLLECTION} 
        onClick={() => onNavigate(AppScreen.COLLECTION)} 
      />
      <div className="w-16"></div>
      <NavItem 
        icon="explore" 
        label="地图" 
        active={currentScreen === AppScreen.MAP} 
        onClick={() => onNavigate(AppScreen.MAP)} 
      />
      <NavItem 
        icon="account_circle" 
        label="我的" 
        active={currentScreen === AppScreen.PROFILE} 
        onClick={() => onNavigate(AppScreen.PROFILE)} 
      />
      
      <button 
        onClick={onScanClick}
        className="absolute -top-7 left-1/2 -translate-x-1/2 w-16 h-16 bg-primary rounded-full shadow-[0_10px_20px_rgba(128,176,109,0.4)] border-[5px] border-white dark:border-gray-900 flex items-center justify-center text-white transition-all active:scale-90 active:rotate-12"
      >
        <span className="material-symbols-outlined text-3xl">photo_camera</span>
      </button>
    </nav>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
  >
    <span className={`material-symbols-outlined text-[28px] transition-all ${active ? 'filled scale-110' : ''}`}>{icon}</span>
    <span className={`text-[10px] font-bold uppercase tracking-tighter transition-all ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

export default BottomNav;
