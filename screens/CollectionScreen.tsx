
import React, { useState } from 'react';
import { Fossil } from '../types';
import { AppScreen } from '../App';
import BottomNav from '../components/BottomNav';

interface CollectionScreenProps {
  items: Fossil[];
  onScanClick: () => void;
  onNavigate: (screen: AppScreen) => void;
  currentScreen: AppScreen;
  onFossilClick: (fossil: Fossil) => void;
}

const CollectionScreen: React.FC<CollectionScreenProps> = ({ items, onScanClick, onNavigate, currentScreen, onFossilClick }) => {
  const [activeFilter, setActiveFilter] = useState('全部');
  const filters = ['全部', '侏罗纪', '白垩纪', '三叠纪'];

  const filteredItems = items.filter(item => {
    if (activeFilter === '全部') return true;
    return item.era.toLowerCase().includes(activeFilter.toLowerCase());
  });

  return (
    <div className="h-screen w-full bg-background-light dark:bg-background-dark overflow-y-auto no-scrollbar pb-32">
      <header className="sticky top-0 z-20 bg-background-light/90 dark:bg-gray-900/90 backdrop-blur-md px-5 py-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-forest-green dark:text-primary tracking-tight leading-none">勘测归档</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-1">授权现场考察数据</p>
          </div>
        </div>
      </header>

      <div className="px-5 py-6">
        <section className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm mb-8 flex flex-col gap-4 border border-gray-50 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-cream-yellow dark:bg-primary/20 rounded-2xl flex items-center justify-center font-black text-2xl text-forest-green dark:text-primary border border-primary/10">
                {items.length}
              </div>
              <div>
                <h2 className="text-sm font-black text-forest-green dark:text-white uppercase tracking-wide">发现等级</h2>
                <p className="text-xs text-primary font-bold">野外专家 • II 级</p>
              </div>
            </div>
          </div>
          <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-[35%] animate-pulse"></div>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 px-1">年代筛选</h3>
          <div className="grid grid-cols-2 gap-3">
            {filters.map((f) => (
              <button 
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`py-4 px-4 rounded-2xl font-bold text-sm border-2 transition-all active:scale-95 flex flex-col items-start gap-1 ${
                  activeFilter === f 
                  ? 'bg-forest-green dark:bg-primary text-white border-forest-green dark:border-primary shadow-xl' 
                  : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700'
                }`}
              >
                <span className="text-[9px] uppercase tracking-widest opacity-60">地质时期</span>
                <span className="text-base">{f}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-lg font-black text-forest-green dark:text-white">发现记录 ({filteredItems.length})</h3>
            <button className="text-xs font-bold text-primary active:opacity-50">按时间排序</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <FossilCard 
                key={item.id}
                name={item.name} 
                subtitle={item.era} 
                rare={item.rarity === 'Legendary'}
                image={item.imageUrl}
                onClick={() => onFossilClick(item)}
              />
            ))}
          </div>
        </section>
      </div>

      <button onClick={onScanClick} className="fixed bottom-28 right-6 bg-forest-green dark:bg-primary text-white p-5 rounded-[2rem] shadow-2xl flex items-center gap-3 transition-all active:scale-90 z-30 ring-[6px] ring-white dark:ring-gray-900">
        <span className="material-symbols-outlined text-2xl">biotech</span>
        <span className="font-black text-sm uppercase tracking-widest">启动现场扫描</span>
      </button>

      <BottomNav onNavigate={onNavigate} onScanClick={onScanClick} currentScreen={currentScreen} />
    </div>
  );
};

const FossilCard = ({ name, subtitle, image, rare = false, onClick }: any) => (
  <article onClick={onClick} className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-4 border border-gray-100 dark:border-gray-700 shadow-sm relative transition-all active:scale-95 group">
    {rare && (
      <div className="absolute top-4 right-4 z-10 bg-primary/20 text-primary px-3 py-1 rounded-full text-[8px] font-black animate-pulse">稀有</div>
    )}
    <div className="aspect-square rounded-3xl bg-cream-yellow/20 dark:bg-primary/10 overflow-hidden flex items-center justify-center p-3 mb-4 transition-colors">
      <img src={image} className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-700" alt={name} />
    </div>
    <h4 className="text-xs font-black text-forest-green dark:text-white truncate px-1 uppercase">{name}</h4>
    <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold px-1 mt-1 opacity-60">{subtitle}</p>
  </article>
);

export default CollectionScreen;
