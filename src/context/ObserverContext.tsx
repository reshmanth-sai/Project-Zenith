import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

  // Automatically acquire the observer's live location on first page load
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setGlobalObserverLocation({
            name: `My Live Location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
            lat: latitude,
            lng: longitude,
            elevationM: 100 // standard elevation baseline
          });
        },
        (error) => {
          console.warn("Geolocation access denied or failed. Defaulting to Mauna Kea Observatory.", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []);

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
