import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { serviceAreaAPI } from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function AdminGeoFence() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#e91e8c');
  const [vertices, setVertices] = useState([]);
  const [saving, setSaving] = useState(false);

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const polygonRef = useRef(null);
  const areaLayersRef = useRef([]);
  const verticesRef = useRef([]);

  const fetchAreas = useCallback(async () => {
    try {
      const res = await serviceAreaAPI.getAll();
      setAreas(res.data.data.areas);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load service areas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [31.5204, 74.3587],
      zoom: 11,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const renderAreaPolygons = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const l of areaLayersRef.current) map.removeLayer(l);
    areaLayersRef.current = [];
    for (const area of areas) {
      if (!area.coordinates || area.coordinates.length < 3) continue;
      const coords = area.coordinates.map(([lat, lng]) => [lat, lng]);
      const poly = L.polygon(coords, {
        color: area.color || '#e91e8c',
        weight: 2,
        opacity: 0.8,
        fillColor: area.color || '#e91e8c',
        fillOpacity: 0.12,
      }).addTo(map);
      poly.bindPopup(`<strong>${area.name}</strong>`);
      areaLayersRef.current.push(poly);
    }
  }, [areas]);

  useEffect(() => {
    renderAreaPolygons();
  }, [renderAreaPolygons]);

  const clearDrawing = () => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of vertexMarkersRef.current) map.removeLayer(m);
    vertexMarkersRef.current = [];
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    renderAreaPolygons();
  };

  const clickHandlerRef = useRef(null);

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setNewName('');
    setNewColor('#e91e8c');
    setVertices([]);
    verticesRef.current = [];
    clearDrawing();

    const map = mapRef.current;
    if (!map) return;

    const handler = (e) => {
      const { lat, lng } = e.latlng;
      const updated = [...verticesRef.current, { lat, lng }];
      verticesRef.current = updated;
      setVertices(updated);
      const map = mapRef.current;
      if (!map) return;

      const marker = L.marker([lat, lng]).addTo(map);
      vertexMarkersRef.current.push(marker);

      if (polygonRef.current) map.removeLayer(polygonRef.current);
      if (updated.length >= 3) {
        const coords = updated.map((v) => [v.lat, v.lng]);
        polygonRef.current = L.polygon(coords, {
          color: newColor,
          weight: 2,
          fillColor: newColor,
          fillOpacity: 0.2,
        }).addTo(map);
      }
    };

    clickHandlerRef.current = handler;
    map.on('click', handler);
  };

  const cancelAdd = () => {
    const map = mapRef.current;
    if (map) {
      if (clickHandlerRef.current) {
        map.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
      clearDrawing();
    }
    setAdding(false);
    setVertices([]);
    verticesRef.current = [];
    setNewName('');
  };

  const saveArea = async () => {
    if (!newName.trim()) { setError('Please enter a name for the service area.'); return; }
    if (vertices.length < 3) { setError('Please draw at least 3 points on the map.'); return; }
    setSaving(true);
    setError('');
    try {
      const coords = vertices.map((v) => [v.lat, v.lng]);
      await serviceAreaAPI.create({ name: newName.trim(), coordinates: coords, color: newColor });
      setMessage(`Service area "${newName.trim()}" created.`);
      cancelAdd();
      await fetchAreas();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create service area.');
    } finally {
      setSaving(false);
    }
  };

  const deleteArea = async (id, name) => {
    if (!window.confirm(`Delete service area "${name}"?`)) return;
    try {
      await serviceAreaAPI.remove(id);
      setMessage(`Service area "${name}" deleted.`);
      await fetchAreas();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete.');
    }
  };

  const toggleActive = async (area) => {
    try {
      await serviceAreaAPI.update(area.id, { isActive: !area.isActive });
      await fetchAreas();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update.');
    }
  };

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      {loading && <div className="flex items-center justify-center min-h-[60vh] text-text-light text-sm">Loading...</div>}
      {!loading && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Service Areas</h1>
            <p className="text-[0.95rem] text-text-muted mt-1 m-0">Manage geo-fence boundaries</p>
          </div>
          {!adding && (
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-4 py-2 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark" onClick={startAdd}>
              + Add Area
            </button>
          )}
        </div>
      )}

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}
      {message && <p className="bg-[#f1faf1] text-success border border-[#c8e6c9] px-3.5 py-2.5 rounded-sm text-sm mb-2">{message}</p>}

      <div ref={containerRef} className="w-full h-[350px] rounded-sm border-2 border-border overflow-hidden mb-6" />

      {adding && (
        <div className="bg-white border border-border rounded-sm p-4 mb-6">
          <h3 className="font-display text-base font-semibold text-plum m-0 mb-3">New Service Area</h3>
          <p className="text-sm text-text-muted mb-3">Click on the map to draw polygon vertices (at least 3).</p>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <input
              className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-border rounded-sm bg-white text-text placeholder:text-text-light focus:outline-none focus:border-pink"
              placeholder="Area name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-text-muted">
              Color:
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 border-none rounded cursor-pointer" />
            </label>
            <span className="text-xs text-text-muted">{vertices.length} vertices placed</span>
          </div>
          <div className="flex gap-2">
            <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-4 py-2 cursor-pointer transition" onClick={cancelAdd}>Cancel</button>
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-4 py-2 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark disabled:opacity-50 disabled:cursor-not-allowed" onClick={saveArea} disabled={saving || vertices.length < 3 || !newName.trim()}>
              {saving ? 'Saving...' : 'Save Area'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {areas.length === 0 && (
          <div className="text-center p-8">
            <p className="text-sm text-text-muted">No service areas defined yet. Click "+ Add Area" to create one.</p>
          </div>
        )}
        {areas.map((area) => (
          <div key={area.id} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-border rounded-sm">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: area.color || '#e91e8c' }} />
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-plum">{area.name}</span>
              <span className="text-xs text-text-muted">{area.coordinates.length} vertices &middot; {area.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <button
              className={`px-2.5 py-1 text-xs font-semibold border rounded-sm cursor-pointer transition ${
                area.isActive
                  ? 'bg-[#fff8e1] text-warning border-[#ffe082] hover:bg-[#ffecb3]'
                  : 'bg-[#e8f5e9] text-success border-[#c8e6c9] hover:bg-[#c8e6c9]'
              }`}
              onClick={() => toggleActive(area)}
            >
              {area.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button
              className="px-2.5 py-1 text-xs font-semibold border border-border rounded-sm text-text-muted bg-transparent hover:text-error hover:border-error cursor-pointer transition"
              onClick={() => deleteArea(area.id, area.name)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminGeoFence;
