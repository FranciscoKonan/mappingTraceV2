// ===========================================
// MAP CONTROL FUNCTIONS
// ===========================================

/**
 * Zoom in on the map
 */
function zoomIn() { 
    if (window.map) {
        window.map.zoomIn();
        console.log('🔍 Zoomed in');
    }
}

/**
 * Zoom out on the map
 */
function zoomOut() { 
    if (window.map) {
        window.map.zoomOut();
        console.log('🔍 Zoomed out');
    }
}

/**
 * Reset map view to default
 */
function resetView() { 
    if (window.map) {
        window.map.setView([7.5, -5.5], 7); // Centered on Côte d'Ivoire
        if (window.notification) window.notification.info('Map view reset');
        console.log('🗺️ Map view reset');
    }
}

/**
 * Locate user's current position
 */
function locateMe() {
    if (!navigator.geolocation) {
        if (window.notification) window.notification.error('Geolocation not supported');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        pos => {
            const latlng = [pos.coords.latitude, pos.coords.longitude];
            
            if (window.map) {
                window.map.setView(latlng, 15);
                L.marker(latlng)
                    .addTo(window.map)
                    .bindPopup('You are here!')
                    .openPopup();
                
                if (window.notification) window.notification.success('Location found');
                console.log('📍 Location found:', latlng);
            }
        },
        err => {
            console.error('Geolocation error:', err);
            
            let errorMessage = 'Location failed: ';
            switch(err.code) {
                case err.PERMISSION_DENIED:
                    errorMessage += 'Permission denied';
                    break;
                case err.POSITION_UNAVAILABLE:
                    errorMessage += 'Position unavailable';
                    break;
                case err.TIMEOUT:
                    errorMessage += 'Request timeout';
                    break;
                default:
                    errorMessage += err.message;
            }
            
            if (window.notification) window.notification.error(errorMessage);
        }
    );
}

/**
 * Toggle map legend visibility
 */
function toggleLegend() {
    const legend = document.getElementById('mapLegend');
    if (legend) {
        const isHidden = legend.style.display === 'none' || !legend.style.display;
        legend.style.display = isHidden ? 'block' : 'none';
        
        if (window.notification) {
            window.notification.info(isHidden ? 'Legend shown' : 'Legend hidden');
        }
        console.log('📊 Legend toggled:', isHidden ? 'shown' : 'hidden');
    }
}

/**
 * Perform search on map
 */
async function performSearch() {
    const input = document.getElementById('mapSearch');
    if (!input) return;
    
    const query = input.value.trim();
    if (!query) {
        if (window.notification) window.notification.warning('Enter search term');
        return;
    }
    
    console.log(`🔍 Searching for: "${query}"`);
    
    const searchTerm = query.toLowerCase();
    let found = false;
    
    // Search in farm layers
    if (window.farmLayers && window.farmLayers.size > 0) {
        for (const [id, layer] of window.farmLayers) {
            if (!layer.farmData) continue;
            
            const farm = layer.farmData;
            
            // Check multiple fields
            if (farm.farmerName?.toLowerCase().includes(searchTerm) ||
                farm.farmId?.toLowerCase().includes(searchTerm) ||
                id?.toLowerCase().includes(searchTerm) ||
                farm.cooperative?.toLowerCase().includes(searchTerm) ||
                farm.supplier?.toLowerCase().includes(searchTerm)) {
                
                // Found a match
                if (window.zoomToFarm) {
                    window.zoomToFarm(id);
                    found = true;
                    
                    // Highlight the farm
                    layer.setStyle({ weight: 4, color: '#FF5722' });
                    setTimeout(() => {
                        layer.setStyle({ weight: 2, color: window.getStatusColor ? window.getStatusColor(farm.status) : '#3388ff' });
                    }, 2000);
                    
                    if (window.notification) {
                        window.notification.success(`Found: ${farm.farmerName}`);
                    }
                    break;
                }
            }
        }
    }
    
    // If not found locally, try geocoding with OpenStreetMap Nominatim
    if (!found) {
        try {
            console.log('🌍 No local match, trying geocoding...');
            
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'MappingTrace-Dashboard/1.0'
                    }
                }
            );
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                if (!isNaN(lat) && !isNaN(lon) && window.map) {
                    window.map.setView([lat, lon], 14);
                    
                    // Add temporary marker
                    L.marker([lat, lon])
                        .addTo(window.map)
                        .bindPopup(`<b>${result.display_name}</b>`)
                        .openPopup();
                    
                    if (window.notification) {
                        window.notification.success(`Location found: ${result.display_name.split(',')[0]}`);
                    }
                    found = true;
                }
            } else {
                if (window.notification) {
                    window.notification.info('No matching farms or locations found');
                }
            }
        } catch (error) {
            console.error('❌ Geocoding error:', error);
            if (window.notification) {
                window.notification.error('Search failed: ' + error.message);
            }
        }
    }
    
    if (!found && window.notification) {
        window.notification.info('No results found');
    }
}

/**
 * Toggle draw mode (placeholder)
 */
function toggleDrawMode() {
    if (window.notification) {
        window.notification.info('Draw mode - Click on map to draw polygon');
    }
    console.log('✏️ Draw mode toggled');
}

/**
 * Refresh map data
 */
function refreshMapData() {
    if (window.refreshMapLayers && typeof window.refreshMapLayers === 'function') {
        window.refreshMapLayers();
        if (window.notification) {
            window.notification.info('Refreshing map data...');
        }
    } else {
        console.warn('⚠️ refreshMapLayers function not available');
        if (window.notification) {
            window.notification.error('Map refresh not available');
        }
    }
}

/**
 * Set base layer (satellite, streets, terrain)
 */
function setBaseLayer(type) {
    if (!window.map) {
        console.warn('⚠️ Map not initialized');
        return;
    }
    
    console.log(`🗺️ Switching to ${type} layer`);
    
    // Update button states
    document.getElementById('btnSatellite')?.classList.remove('active');
    document.getElementById('btnStreets')?.classList.remove('active');
    document.getElementById('btnTerrain')?.classList.remove('active');
    
    const activeBtn = document.getElementById(`btn${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Remove existing tile layers
    window.map.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer) {
            window.map.removeLayer(layer);
        }
    });
    
    // Add new base layer
    switch(type) {
        case 'satellite':
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: 'Google Satellite'
            }).addTo(window.map);
            break;
        case 'streets':
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(window.map);
            break;
        case 'terrain':
            L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: '© OpenTopoMap'
            }).addTo(window.map);
            break;
        default:
            // Default to satellite
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(window.map);
    }
    
    if (window.notification) {
        window.notification.info(`Switched to ${type} view`);
    }
}

// ===========================================
// ADDITIONAL MAP CONTROL FUNCTIONS
// ===========================================

/**
 * Clear the current farm selection on map
 */
function clearSelection() {
    console.log('🗑️ Clearing farm selection');
    
    if (window.selectedFarm) {
        // Reset style of previously selected farm
        const prevLayer = window.farmLayers?.get(window.selectedFarm);
        if (prevLayer) {
            prevLayer.setStyle({ 
                weight: 2,
                color: window.getStatusColor ? window.getStatusColor(prevLayer.farmData?.status) : '#3388ff'
            });
        }
        
        window.selectedFarm = null;
        
        // Update UI
        const selectedFarmEl = document.getElementById('selectedFarmName');
        if (selectedFarmEl) {
            selectedFarmEl.textContent = 'None';
        }
        
        if (window.notification) {
            window.notification.info('Selection cleared');
        }
    }
}

/**
 * Zoom to specific farm
 */
function zoomToFarm(farmId) {
    if (!window.farmLayers || !window.map) return;
    
    const layer = window.farmLayers.get(farmId);
    if (layer && layer.getBounds) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
            window.map.fitBounds(bounds, { padding: [50, 50] });
            
            // Highlight the farm
            layer.setStyle({ weight: 4, color: '#FF5722' });
            setTimeout(() => {
                layer.setStyle({ weight: 2, color: window.getStatusColor ? window.getStatusColor(layer.farmData?.status) : '#3388ff' });
            }, 2000);
            
            console.log(`📍 Zoomed to farm: ${farmId}`);
        }
    }
}

/**
 * Get status color for farm
 */
function getStatusColor(status) {
    switch(status) {
        case 'validated': return '#4CAF50';
        case 'pending': return '#FFC107';
        case 'rejected': return '#F44336';
        default: return '#2196F3';
    }
}

// ===========================================
// MAP EXPORT FUNCTIONALITY
// ===========================================

/**
 * Export map data (called from map toolbar)
 */
function exportMapData() {
    console.log('🗺️ Opening map export options');
    
    // Close any existing modal
    document.getElementById('map-export-modal')?.remove();
    
    // Create export modal for map
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'map-export-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-download" style="color: #2c6e49;"></i> Export Map Data</h3>
                <button class="modal-close" onclick="document.getElementById('map-export-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px;">Choose export format:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
                    <button class="export-option" onclick="exportAsGeoJSON()" style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-draw-polygon" style="font-size: 24px; color: #2c6e49; margin-bottom: 8px;"></i>
                        <span style="display: block; font-weight: 600;">GeoJSON</span>
                        <small style="display: block; font-size: 11px; color: #64748b;">All farm boundaries</small>
                    </button>
                    <button class="export-option" onclick="exportAsKML()" style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-map" style="font-size: 24px; color: #2c6e49; margin-bottom: 8px;"></i>
                        <span style="display: block; font-weight: 600;">KML</span>
                        <small style="display: block; font-size: 11px; color: #64748b;">Google Earth</small>
                    </button>
                    <button class="export-option" onclick="exportAsImage()" style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-camera" style="font-size: 24px; color: #2c6e49; margin-bottom: 8px;"></i>
                        <span style="display: block; font-weight: 600;">Image</span>
                        <small style="display: block; font-size: 11px; color: #64748b;">Map screenshot</small>
                    </button>
                </div>
                <p class="text-muted small" style="margin-top: 15px;">
                    <i class="fas fa-info-circle"></i> 
                    Exporting ${window.farmLayers?.size || 0} farms from map
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Download file helper
 */
function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export as GeoJSON
 */
function exportAsGeoJSON() {
    // Close modal
    document.getElementById('map-export-modal')?.remove();
    
    if (window.notification) window.notification.info('Preparing GeoJSON export...');
    
    setTimeout(() => {
        try {
            // Get farms from DataManager or map layers
            const farms = window.dataManager?.farms || [];
            
            const features = farms
                .filter(f => f.geometry && f.geometry.coordinates)
                .map(f => ({
                    type: "Feature",
                    geometry: f.geometry,
                    properties: {
                        farmId: f.farm_id || f.id,
                        farmerName: f.farmerName || f.farmer_name,
                        farmerId: f.farmerId || f.farmer_id,
                        cooperative: f.cooperative || f.cooperative_name,
                        supplier: f.supplier,
                        area: f.realArea || f.area || 0,
                        status: f.status
                    }
                }));
            
            const geojson = {
                type: "FeatureCollection",
                features: features
            };
            
            const dataStr = JSON.stringify(geojson, null, 2);
            const filename = `map_farms_${new Date().toISOString().split('T')[0]}.geojson`;
            
            downloadFile(dataStr, filename, 'application/geo+json');
            
            if (window.notification) window.notification.success(`Exported ${features.length} farms as GeoJSON`);
            
        } catch (error) {
            console.error('GeoJSON export error:', error);
            if (window.notification) window.notification.error('Export failed: ' + error.message);
        }
    }, 500);
}

/**
 * Export as KML
 */
function exportAsKML() {
    // Close modal
    document.getElementById('map-export-modal')?.remove();
    
    if (window.notification) window.notification.info('Preparing KML export...');
    
    setTimeout(() => {
        try {
            const farms = window.dataManager?.farms || [];
            
            let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
            kml += '<Document>\n';
            kml += '  <name>MappingTrace Farms</name>\n';
            
            farms.forEach(farm => {
                if (farm.geometry && farm.geometry.coordinates) {
                    // Convert GeoJSON to KML (simplified)
                    const coords = farm.geometry.coordinates[0]
                        .map(c => `${c[0]},${c[1]},0`)
                        .join(' ');
                    
                    kml += '  <Placemark>\n';
                    kml += `    <name>${farm.farmerName || farm.farmer_name || 'Farm'}</name>\n`;
                    kml += '    <ExtendedData>\n';
                    kml += `      <Data name="farmId"><value>${farm.farm_id || farm.id}</value></Data>\n`;
                    kml += `      <Data name="cooperative"><value>${farm.cooperative || farm.cooperative_name || ''}</value></Data>\n`;
                    kml += `      <Data name="supplier"><value>${farm.supplier || ''}</value></Data>\n`;
                    kml += `      <Data name="area"><value>${farm.realArea || farm.area || 0}</value></Data>\n`;
                    kml += `      <Data name="status"><value>${farm.status || ''}</value></Data>\n`;
                    kml += '    </ExtendedData>\n';
                    kml += '    <Polygon>\n';
                    kml += '      <outerBoundaryIs>\n';
                    kml += '        <LinearRing>\n';
                    kml += `          <coordinates>${coords}</coordinates>\n`;
                    kml += '        </LinearRing>\n';
                    kml += '      </outerBoundaryIs>\n';
                    kml += '    </Polygon>\n';
                    kml += '  </Placemark>\n';
                }
            });
            
            kml += '</Document>\n';
            kml += '</kml>';
            
            const filename = `map_farms_${new Date().toISOString().split('T')[0]}.kml`;
            downloadFile(kml, filename, 'application/vnd.google-earth.kml+xml');
            
            if (window.notification) window.notification.success(`Exported ${farms.length} farms as KML`);
            
        } catch (error) {
            console.error('KML export error:', error);
            if (window.notification) window.notification.error('Export failed: ' + error.message);
        }
    }, 500);
}

/**
 * Export as Image (map screenshot)
 */
function exportAsImage() {
    // Close modal
    document.getElementById('map-export-modal')?.remove();
    
    if (window.notification) window.notification.info('Image export coming soon...');
    
    // This would require html2canvas or leaflet-image library
    console.log('📸 Image export requested');
}

// ===========================================
// GLOBAL EXPORTS
// ===========================================

window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetView = resetView;
window.locateMe = locateMe;
window.toggleLegend = toggleLegend;
window.performSearch = performSearch;
window.toggleDrawMode = toggleDrawMode;
window.refreshMapData = refreshMapData;
window.setBaseLayer = setBaseLayer;
window.exportMapData = exportMapData;
window.exportAsGeoJSON = exportAsGeoJSON;
window.exportAsKML = exportAsKML;
window.exportAsImage = exportAsImage;
window.clearSelection = clearSelection;
window.zoomToFarm = zoomToFarm;
window.getStatusColor = getStatusColor;

// Export for mapControls object
window.mapControls = {
    zoomIn,
    zoomOut,
    resetView,
    locateMe,
    toggleLegend,
    performSearch,
    toggleDrawMode,
    refreshMapData,
    setBaseLayer,
    exportMapData,
    clearSelection,
    zoomToFarm,
    getStatusColor
};

console.log('✅ Map control functions loaded');