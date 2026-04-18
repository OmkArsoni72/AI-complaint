'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Navigation, MapPin, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const CityMap = dynamic(() => import('@/components/dashboard/CityMap'), {
  ssr: false,
  loading: () => (
    <div className="glass-card h-full min-h-[400px] flex items-center justify-center">
      <div className="text-white/20 text-sm">Loading map...</div>
    </div>
  ),
});

interface Complaint {
  _id: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  location: any; // Flexible for GeoJSON or old format
  createdAt: string;
}

export default function NearbyIssuesPage() {
  const { token, t } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setError("Location access denied. Using center coordinates.");
          setLocation({ lat: 28.6139, lng: 77.209 }); // Default Delhi
        }
      );
    } else {
      setError("Geolocation not supported.");
      setLocation({ lat: 28.6139, lng: 77.209 });
    }
  }, []);

  useEffect(() => {
    const fetchNearby = async () => {
      if (!location) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/complaints/nearby?lat=${location.lat}&lng=${location.lng}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) {
          setComplaints(data.data);
        } else {
          setError(data.error || "Failed to fetch nearby issues");
        }
      } catch (err) {
        setError("Connection failed");
      } finally {
        setLoading(false);
      }
    };

    if (location) fetchNearby();
  }, [location, token]);

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-200 py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black dark:text-white text-slate-900 flex items-center gap-3">
               <Navigation className="w-8 h-8 text-blue-500" />
              {t('nearbyIssues')}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Grievances reported within 2km of your current location.</p>
          </div>
          
          {location && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400 shadow-sm">
              <MapPin className="w-3.5 h-3.5" />
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="min-h-[500px] space-y-6">
          {!loading && complaints.length === 0 && (
            <div className="text-center py-10 rounded-[2rem] dark:bg-white/[0.02] bg-slate-50/50 border-2 border-dashed dark:border-white/10 border-slate-200">
              <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              </div>
              <h3 className="text-lg font-bold dark:text-slate-400 text-slate-900 mb-1">No Nearby Issues Found</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                Everything seems quiet in your area! Great news for the community. Use the report button to log any new concerns.
              </p>
            </div>
          )}

          {loading ? (
            <div className="h-[500px] rounded-[2rem] dark:bg-white/[0.03] bg-slate-100 border dark:border-white/10 border-slate-200 animate-pulse flex items-center justify-center">
              <p className="text-slate-400 uppercase tracking-widest font-black text-xs">Initializing map...</p>
            </div>
          ) : (
            <div className="h-[600px] rounded-[2rem] border dark:border-white/10 border-slate-200 overflow-hidden shadow-2xl shadow-blue-500/5 bg-slate-50 dark:bg-slate-900/50">
              <CityMap complaints={complaints as any} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
