
import React, { useState, useEffect, useMemo } from 'react';
import { AppScreen } from '../App';
import BottomNav from '../components/BottomNav';
import { Fossil } from '../types';

interface MapScreenProps {
  onScanClick: () => void;
  onNavigate: (screen: AppScreen) => void;
  currentScreen: AppScreen;
  collection: Fossil[];
}

const MapScreen: React.FC<MapScreenProps> = ({ onScanClick, onNavigate, currentScreen, collection }) => {
  const [initialCoords, setInitialCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setInitialCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.error("GPS Error:", err);
        // Default to a known paleontological site coordinate if GPS fails (e.g., Zigong Dinosaur Museum area)
        setInitialCoords({ lat: 29.3528, lng: 104.7781 }); 
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const amapIframeUrl = useMemo(() => {
    if (!initialCoords) return "";
    
    // Center on the most recent find, or current GPS
    const latestFind = collection.length > 0 ? collection[collection.length - 1] : null;
    const centerLat = latestFind ? latestFind.location?.lat : initialCoords.lat;
    const centerLng = latestFind ? latestFind.location?.lng : initialCoords.lng;
    const findName = latestFind ? latestFind.name : "当前考察点";
    
    /**
     * Permanent Professional Configuration:
     * style=1: Satellite / Remote Sensing mode (Best for geology)
     * viewMode=3D: Enhanced depth
     */
    return `https://m.amap.com/navi/?dest=${centerLng},${centerLat}&destName=${encodeURIComponent(findName)}&hideRouteIcon=1&key=f7626993a44f2e519c2350849c26477c&viewMode=3D&style=1`;
  }, [initialCoords, collection]);

  return (
    <div className="flex-1 flex flex-col relative bg-background-dark overflow-hidden">
      <div className="absolute inset-0 z-0 bg-background-dark">
        {initialCoords ? (
          <div className="w-full h-full relative">
            <iframe
              // Key change forces iframe recreation ensuring the marker is correctly placed every time
              key={`map-frame-${collection.length}`} 
              title="Field Map"
              width="100%"
              height="100%"
              style={{ border: 0, opacity: 1 }}
              src={amapIframeUrl}
              allowFullScreen
            ></iframe>
            {/* Professional overlay grid */}
            <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 opacity-20 bg-grid-pattern"></div>
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]"></div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary/20 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-primary text-3xl animate-pulse">satellite_alt</span>
            </div>
            <div className="text-center">
              <p className="text-primary font-black tracking-[0.4em] uppercase text-[10px]">正在建立高德卫星链路</p>
              <p className="text-gray-500 text-[8px] uppercase mt-2 tracking-widest">正在同步遥感数据...</p>
            </div>
          </div>
        )}
      </div>

      <header className="relative z-10 p-6 pt-12">
        <div className="bg-black/80 backdrop-blur-2xl rounded-[2rem] p-5 border border-white/10 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-primary/20">
              <span className="material-symbols-outlined filled">distance</span>
            </div>
            <div>
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">遥感监测系统</p>
              <h2 className="text-white font-bold text-xs tracking-tight">已锁定 {collection.length} 处关键遗迹</h2>
            </div>
          </div>
          <div className="px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
              卫星视图
            </span>
          </div>
        </div>
      </header>

      {/* Discovery Details Overlay */}
      <div className="mt-auto relative z-10 p-6 pb-28">
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-white dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-forest-green dark:text-primary uppercase tracking-[0.2em]">现场勘测路径记录</h3>
            <span className="material-symbols-outlined text-gray-300 dark:text-gray-600">more_horiz</span>
          </div>
          
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
            {collection.length > 0 ? (
              [...collection].reverse().map((item) => (
                <div 
                  key={item.id} 
                  className="shrink-0 w-64 bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-4 border border-gray-100 dark:border-gray-700 flex items-center gap-4 active:scale-[0.98] transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm bg-black">
                    <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-forest-green dark:text-white text-xs font-black truncate uppercase tracking-tight">{item.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                      {item.location?.lng.toFixed(4)}°E , {item.location?.lat.toFixed(4)}°N
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-sm filled">location_on</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full py-8 text-center flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-gray-300 dark:text-gray-700 text-4xl">map_search</span>
                <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase italic tracking-[0.15em]">
                  等待首次勘探标本定位...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav onNavigate={onNavigate} onScanClick={onScanClick} currentScreen={currentScreen} />
    </div>
  );
};

export default MapScreen;
