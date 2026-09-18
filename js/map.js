let leafletMap = null;
let mapMarkers = {};

// สร้างแผนที่ Leaflet
function createMap(elementId, lat, lng, zoom = 15) {
    if (leafletMap) {
        leafletMap.remove();
    }

    leafletMap = L.map(elementId, { zoomControl: false }).setView([lat, lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMap);

    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);
    return leafletMap;
}

// ปรับจุดศูนย์กลางของแผนที่
function setMapCenter(lat, lng, zoom = 16) {
    if (leafletMap) {
        leafletMap.setView([lat, lng], zoom);
    }
}

// เพิ่มหรืออัปเดตหมุดบนแผนที่
function addMarker(id, lat, lng, title, type = 'default') {
    if (mapMarkers[id]) {
        mapMarkers[id].setLatLng([lat, lng]);
        return mapMarkers[id];
    }

    let color = '#3B82F6';
    if (type === 'user') color = '#2563EB';
    if (type === 'destination') color = '#E11D48';
    if (type === 'driver') color = '#F59E0B';

    const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: ${color}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(leafletMap).bindPopup(title);
    mapMarkers[id] = marker;
    return marker;
}

// ลบหมุดออกจากแผนที่
function removeMarker(id) {
    if (mapMarkers[id]) {
        leafletMap.removeLayer(mapMarkers[id]);
        delete mapMarkers[id];
    }
}

// เคลียร์หมุดทั้งหมด
function clearAllMarkers() {
    Object.keys(mapMarkers).forEach(id => {
        leafletMap.removeLayer(mapMarkers[id]);
    });
    mapMarkers = {};
}