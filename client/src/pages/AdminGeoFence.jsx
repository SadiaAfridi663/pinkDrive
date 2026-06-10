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
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#e91e8c');
  const [vertices, setVertices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const polygonRef = useRef(null);
  const areaLayersRef = useRef([]);
  const verticesRef = useRef([]);
  const clickHandlerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

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

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

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
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
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
        color: area.color || '#e91e8c', weight: 2, opacity: 0.8,
        fillColor: area.color || '#e91e8c', fillOpacity: 0.12,
      }).addTo(map);
      poly.bindPopup(`<strong>${area.name}</strong>`);
      areaLayersRef.current.push(poly);
    }
  }, [areas]);

  useEffect(() => { renderAreaPolygons(); }, [renderAreaPolygons]);

  const clearDrawing = () => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of vertexMarkersRef.current) map.removeLayer(m);
    vertexMarkersRef.current = [];
    if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null; }
    renderAreaPolygons();
  };

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
          color: newColor, weight: 2, fillColor: newColor, fillOpacity: 0.2,
        }).addTo(map);
      }
    };

    clickHandlerRef.current = handler;
    map.on('click', handler);
  };

  const cancelAdd = () => {
    const map = mapRef.current;
    if (map) {
      if (clickHandlerRef.current) { map.off('click', clickHandlerRef.current); clickHandlerRef.current = null; }
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
    } catch (err) { setError(err.response?.data?.message || 'Failed to create service area.'); }
    finally { setSaving(false); }
  };

  const deleteArea = async (id, name) => {
    if (!window.confirm(`Delete service area "${name}"?`)) return;
    try {
      await serviceAreaAPI.remove(id);
      setMessage(`Service area "${name}" deleted.`);
      await fetchAreas();
    } catch (err) { setError(err.response?.data?.message || 'Failed to delete.'); }
  };

  const toggleActive = async (area) => {
    try {
      await serviceAreaAPI.update(area.id, { isActive: !area.isActive });
      await fetchAreas();
    } catch (err) { setError(err.response?.data?.message || 'Failed to update.'); }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) { setSearchResults([]); return; }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=pk`
        );
        const data = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const selectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const map = mapRef.current;
    if (map) map.flyTo([lat, lon], 14);
    setSearchQuery(result.display_name.split(',')[0]);
    setSearchResults([]);
  };

  return (
    <div className="page-wide">
      <div className="page-header page-header-accent">
        <h1>Service Areas</h1>
        <p>Manage geo-fence boundaries</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {message && <p className="msg msg-success">{message}</p>}

      {/* Place Search */}
      <div className="relative mb-3">
        <input
          className="input pr-10"
          placeholder="Search for a place..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone">Searching...</span>}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-border rounded-sm shadow-lg mt-1">
            {searchResults.map((r, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2 text-sm text-charcoal hover:bg-coral-light transition cursor-pointer border-none"
                onClick={() => selectResult(r)}
              >
                <span className="block truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-center py-12 text-stone-light text-sm">Loading...</div>}

      {!loading && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-stone m-0">{areas.length} area{areas.length !== 1 ? 's' : ''} defined</p>
          {!adding && (
            <button className="btn btn-primary btn-sm" onClick={startAdd}>+ Add Area</button>
          )}
        </div>
      )}

      <div ref={containerRef} className="w-full h-[350px] rounded-sm border-2 border-border overflow-hidden mb-6" />

      {adding && (
        <div className="card p-4 mb-6">
          <h3 className="font-display text-base font-semibold text-navy m-0 mb-3">New Service Area</h3>
          <p className="text-sm text-stone mb-3">Click on the map to draw polygon vertices (at least 3).</p>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <input className="input flex-1 min-w-[200px]" placeholder="Area name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-stone">
              Color:
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 border-none rounded cursor-pointer" />
            </label>
            <span className="text-xs text-stone">{vertices.length} vertices placed</span>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={cancelAdd}>Cancel</button>
            <button className="btn btn-primary" onClick={saveArea} disabled={saving || vertices.length < 3 || !newName.trim()}>
              {saving ? 'Saving...' : 'Save Area'}
            </button>
          </div>
        </div>
      )}

      {areas.length === 0 && !adding && (
        <div className="empty-state">
          <p className="text-sm text-stone">No service areas defined yet. Click "+ Add Area" to create one.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {areas.map((area) => (
          <div key={area.id} className="card-list flex items-center gap-3">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: area.color || '#e91e8c' }} />
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-navy">{area.name}</span>
              <span className="text-xs text-stone">{area.coordinates.length} vertices &middot; {area.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <button
              className={`px-2.5 py-1 text-xs font-semibold border rounded-sm cursor-pointer transition ${area.isActive ? 'bg-[#fff8e1] text-warning border-[#ffe082] hover:bg-[#ffecb3]' : 'bg-[#e8f5e9] text-success border-[#c8e6c9] hover:bg-[#c8e6c9]'}`}
              onClick={() => toggleActive(area)}
            >
              {area.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button className="px-2.5 py-1 text-xs font-semibold border border-border rounded-sm text-stone bg-transparent hover:text-error hover:border-error cursor-pointer transition" onClick={() => deleteArea(area.id, area.name)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminGeoFence;
