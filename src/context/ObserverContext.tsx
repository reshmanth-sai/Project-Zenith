import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface GlobalObserverLocation {
  lat: number;
  lng: number;
  name: string;
  elevationM: number;
}

interface ObserverContextType {
  globalObserverLocation: GlobalObserverLocation;
  setGlobalObserverLocation: (loc: GlobalObserverLocation | ((prev: GlobalObserverLocation) => GlobalObserverLocation)) => void;
}

const ObserverContext = createContext<ObserverContextType | undefined>(undefined);

export function ObserverProvider({ children }: { children: ReactNode }) {
  // Ground Station coords defaults to Mauna Kea
  const [globalObserverLocation, setGlobalObserverLocation] = useState<GlobalObserverLocation>({
    name: "Mauna Kea Observatory, Hawaii",
    lat: 19.8206,
    lng: -155.4681,
    elevationM: 4207
  });

  return (
    <ObserverContext.Provider value={{ globalObserverLocation, setGlobalObserverLocation }}>
      {children}
    </ObserverContext.Provider>
  );
}

export function useObserver() {
  const context = useContext(ObserverContext);
  if (!context) {
    throw new Error("useObserver must be used within an ObserverProvider");
  }
  return context;
}
