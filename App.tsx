
import React, { useState, useEffect, useMemo } from 'react';
import SplashScreen from './screens/SplashScreen';
import HomeDashboard from './screens/HomeDashboard';
import CameraScanner from './screens/CameraScanner';
import ResultReport from './screens/ResultReport';
import CollectionScreen from './screens/CollectionScreen';
import MapScreen from './screens/MapScreen';
import ProfileScreen from './screens/ProfileScreen';
import { Fossil } from './types';

export enum AppScreen {
  SPLASH = 'SPLASH',
  HOME = 'HOME',
  SCANNER = 'SCANNER',
  RESULT = 'RESULT',
  COLLECTION = 'COLLECTION',
  MAP = 'MAP',
  PROFILE = 'PROFILE'
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(AppScreen.SPLASH);
  const [currentResult, setCurrentResult] = useState<Fossil | null>(null);
  const [collection, setCollection] = useState<Fossil[]>([]);
  
  // Simplified stats for professional privacy
  const stats = useMemo(() => {
    return {
      finds: collection.length
    };
  }, [collection]);

  useEffect(() => {
    if (screen === AppScreen.SPLASH) {
      const timer = setTimeout(() => setScreen(AppScreen.HOME), 3000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  const handleScanComplete = (fossil: Fossil) => {
    setCurrentResult(fossil);
    setScreen(AppScreen.RESULT);
  };

  const handleSaveToJournal = (fossil: Fossil) => {
    setCollection(prev => [...prev, fossil]);
    setScreen(AppScreen.COLLECTION);
  };

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen">
      <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        {screen === AppScreen.SPLASH && <SplashScreen />}
        
        {screen === AppScreen.HOME && (
          <HomeDashboard 
            onScanClick={() => setScreen(AppScreen.SCANNER)} 
            onNavigate={(s) => setScreen(s as AppScreen)}
            currentScreen={screen}
            onFossilClick={(f) => { setCurrentResult(f); setScreen(AppScreen.RESULT); }}
          />
        )}

        {screen === AppScreen.SCANNER && (
          <CameraScanner 
            onBack={() => setScreen(AppScreen.HOME)} 
            onResult={handleScanComplete}
          />
        )}

        {screen === AppScreen.RESULT && currentResult && (
          <ResultReport 
            fossil={currentResult} 
            onBack={() => setScreen(AppScreen.SCANNER)} 
            onSave={() => handleSaveToJournal(currentResult)}
          />
        )}

        {screen === AppScreen.COLLECTION && (
          <CollectionScreen 
            items={collection} 
            onScanClick={() => setScreen(AppScreen.SCANNER)}
            onNavigate={(s) => setScreen(s as AppScreen)}
            currentScreen={screen}
            onFossilClick={(f) => { setCurrentResult(f); setScreen(AppScreen.RESULT); }}
          />
        )}

        {screen === AppScreen.MAP && (
          <MapScreen 
            onScanClick={() => setScreen(AppScreen.SCANNER)}
            onNavigate={(s) => setScreen(s as AppScreen)}
            currentScreen={screen}
            collection={collection}
          />
        )}

        {screen === AppScreen.PROFILE && (
          <ProfileScreen 
            onScanClick={() => setScreen(AppScreen.SCANNER)}
            onNavigate={(s) => setScreen(s as AppScreen)}
            currentScreen={screen}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
}
