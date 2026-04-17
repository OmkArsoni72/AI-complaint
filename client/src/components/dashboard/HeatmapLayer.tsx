import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export default function HeatmapLayer({ data }: { data: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Use L.heatLayer from the leaflet.heat plugin
    const heatLayerData = data.map((d) => [d[0], d[1], d[2]] as [number, number, number]);
    
    let HeatLayer: any;
    let timerId: NodeJS.Timeout;

    const initHeatLayer = () => {
      const size = map.getSize();
      if ((size && (size.x === 0 || size.y === 0)) || !size) {
        // Map is not fully initialized/sized yet. Wait.
        timerId = setTimeout(initHeatLayer, 100);
        return;
      }

      // cast L to any to avoid typescript errors since @types/leaflet.heat modifies the global L object
      HeatLayer = (L as any).heatLayer(heatLayerData, {
        radius: 20,
        blur: 15,
        maxZoom: 14,
        max: 1.0,
        gradient: {
          0.2: '#0ea5e9',
          0.4: '#10b981',
          0.6: '#f59e0b',
          0.8: '#f43f5e',
          1.0: '#e11d48'
        }
      });

      HeatLayer.addTo(map);
    };

    initHeatLayer();

    return () => {
      if (timerId) clearTimeout(timerId);
      if (HeatLayer && map.hasLayer(HeatLayer)) {
        map.removeLayer(HeatLayer);
      }
    };
  }, [map, data]);

  return null;
}
