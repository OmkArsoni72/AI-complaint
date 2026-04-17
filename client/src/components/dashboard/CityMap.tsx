'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { DELHI_CENTER, PRIORITY_COLORS, CATEGORY_ICONS } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';
import HeatmapLayer from './HeatmapLayer';

interface Complaint {
  _id?: string;
  complaintId?: string;
  description: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  location: { 
    lat?: number; 
    lng?: number; 
    coordinates?: [number, number];
    area?: string; 
    district?: string 
  };
}

const markerColors: Record<string, string> = {
  HIGH: '#f43f5e',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

export default function CityMap({ complaints }: { complaints: Complaint[] }) {
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers');

  const markers = useMemo(() => {
    return (complaints || []).filter((c) => {
      if (!c || !c.location) return false;
      if (typeof c.location.lat === 'number' && typeof c.location.lng === 'number') return true;
      if (Array.isArray(c.location.coordinates) && c.location.coordinates.length === 2) return true;
      return false;
    });
  }, [complaints]);

  const heatData = useMemo(() => {
    return markers.map((c) => {
      let position: [number, number] = [DELHI_CENTER.lat, DELHI_CENTER.lng];
      if (c.location && typeof c.location === 'object') {
        if (typeof c.location.lat === 'number' && typeof c.location.lng === 'number') {
          position = [c.location.lat, c.location.lng];
        } else if (Array.isArray(c.location.coordinates) && c.location.coordinates.length === 2) {
          position = [c.location.coordinates[1], c.location.coordinates[0]];
        }
      }
      const intensity = c.priority === 'HIGH' ? 1.0 : c.priority === 'MEDIUM' ? 0.6 : 0.3;
      return [...position, intensity] as [number, number, number];
    });
  }, [markers]);

  return (
    <div className="glass-card overflow-hidden flex flex-col h-full min-h-[450px]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-white">Live Complaint Map</h3>
          <p className="text-xs text-white/40">Delhi NCR Region • Real-time tracking</p>
        </div>
        <div className="flex items-center gap-6">
          {viewMode === 'markers' && (
            <div className="flex items-center gap-4">
              {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                <div key={p} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: markerColors[p] }} />
                  <span className="text-[10px] text-white/50 uppercase">{p}</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center p-0.5 bg-black/40 rounded-lg border border-white/10">
            <button
              onClick={() => setViewMode('markers')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                viewMode === 'markers'
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              Pins
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                viewMode === 'heatmap'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              Heatmap
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full relative min-h-[400px]">
        <MapContainer
          center={[DELHI_CENTER.lat, DELHI_CENTER.lng]}
          zoom={11}
          className="absolute inset-0 h-full w-full"
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {viewMode === 'heatmap' && <HeatmapLayer data={heatData} />}
          
          {viewMode === 'markers' && markers.map((c, idx) => {
            let position: [number, number] = [DELHI_CENTER.lat, DELHI_CENTER.lng];
            
            if (c.location && typeof c.location === 'object') {
              if (typeof c.location.lat === 'number' && typeof c.location.lng === 'number') {
                position = [c.location.lat, c.location.lng];
              } else if (Array.isArray(c.location.coordinates) && c.location.coordinates.length === 2) {
                position = [c.location.coordinates[1], c.location.coordinates[0]];
              }
            }

            return (
              <CircleMarker
                key={c._id || c.complaintId || idx}
                center={position}
                radius={c.priority === 'HIGH' ? 10 : c.priority === 'MEDIUM' ? 7 : 5}
                pathOptions={{
                  color: markerColors[c.priority] || markerColors.MEDIUM,
                  fillColor: markerColors[c.priority] || markerColors.MEDIUM,
                  fillOpacity: 0.6,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[200px] p-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{CATEGORY_ICONS[c.category] || '📋'}</span>
                      <span className="font-semibold text-white">{c.category}</span>
                    </div>
                    <p className="text-white/70 text-xs mb-2 line-clamp-2">{c.description}</p>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                      <span className="text-white/50">
                        📍 {typeof c.location === 'object' ? c.location.area : (c.location || 'Unknown Area')}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          (PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW).bg
                        } ${(PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW).text}`}
                      >
                        {c.priority}
                      </span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
