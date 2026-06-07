// ===========================================
// MAP INITIALIZATION AND CONFIGURATION
// ===========================================

let map = null;
let farmLayers = new Map();
let selectedFarm = null;
let drawnItems = null;
let mapInitialized = false; // Flag to prevent double initialization
const apiBaseUrl = 'http://localhost:3000/api';

// Expose globally for other scripts
window.farmLayers = farmLayers;
window.selectedFarm = selectedFarm;

// ===========================================
// MAP INITIALIZATION
// ===========================================

/**
 * Initialize the Leaflet map
 */
function initMap() {
    // Prevent double initialization
    if (mapInitialized) {
        console.log('🗺️ Map already initialized, skipping...');
        return;
    }
    
    console.log('🗺️ Initializing map...');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ Map element not found');
        // Try again in 500ms
        setTimeout(initMap, 500);
        return;
    }
    
    // Check if map already exists on the element
    if (window.map && window.map instanceof L.Map) {
        console.log('🗺️ Map instance already exists, reusing...');
        map = window.map;
        mapInitialized = true;
        
        // Trigger event for other scripts
        window.dispatchEvent(new CustomEvent('map-ready'));
        return;
    }
    
    try {
        // Create map centered on Côte d'Ivoire
        map = L.map('map', {
            center: [7.5, -5.5],
            zoom: 7,
            zoomControl: false,
            attributionControl: true
        });
        
        // Verify map was created correctly
        if (!map || typeof map.addLayer !== 'function') {
            throw new Error('Map creation failed - invalid map object');
        }
        
        // Store map globally
        window.map = map;

        // Add satellite base layer as default
        const satelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: 'Google Satellite'
        });
        
        satelliteLayer.addTo(map);

        // Add scale control
        L.control.scale({ imperial: false, metric: true }).addTo(map);
        
        // Initialize drawn items layer for drawing
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        window.drawnItems = drawnItems;

        // Add zoom control to bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Mark as initialized
        mapInitialized = true;
        
        console.log('✅ Map initialized successfully');
        
        // Trigger event for other scripts
        window.dispatchEvent(new CustomEvent('map-ready'));
        
        // Load farms after map is ready
        setTimeout(() => {
            if (window.dataManager?.farms?.length) {
                displayFarms(window.dataManager.farms);
            } else {
                loadFarms();
            }
        }, 500);
        
        return map;
        
    } catch (error) {
        console.error('❌ Map initialization failed:', error);
        mapInitialized = false;
        window.map = null;
        
        // Try again in 1 second
        setTimeout(initMap, 1000);
    }
}

// Initialize when DOM is ready - with debouncing
let initTimeout = null;
document.addEventListener('DOMContentLoaded', function() {
    // Clear any pending timeout
    if (initTimeout) clearTimeout(initTimeout);
    
    // Small delay to ensure everything is ready
    initTimeout = setTimeout(function() {
        initMap();
    }, 200);
});

// ===========================================
// FARM LOADING
// ===========================================

/**
 * Load farms from DataManager or API
 */
async function loadFarms() {
    console.log('📡 Loading farms...');
    
    if (!map) {
        console.warn('⚠️ Map not ready yet, waiting...');
        setTimeout(loadFarms, 500);
        return;
    }
    
    if (window.dataManager?.farms?.length) {
        console.log(`📊 Loading ${window.dataManager.farms.length} farms from DataManager`);
        displayFarms(window.dataManager.farms);
    } else {
        console.log('📡 No farms in DataManager, fetching from API');
        await loadFarmsFromAPI();
    }
}

/**
 * Display farms on map
 */
function displayFarms(farms) {
    if (!map) {
        console.warn('⚠️ Map not initialized yet');
        return;
    }
    
    // Check if map has addLayer method
    if (typeof map.addLayer !== 'function') {
        console.error('❌ Map object is invalid:', map);
        return;
    }
    
    clearAllFarmLayers();
    let valid = 0;
    
    farms.forEach(farm => {
        if (farm.geometry?.coordinates) {
            // Handle different geometry formats
            let coords = [];
            
            try {
                if (farm.geometry.type === 'Polygon') {
                    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
                    coords = farm.geometry.coordinates[0].map(c => [c[1], c[0]]);
                } else if (farm.geometry.type === 'MultiPolygon') {
                    // Handle multipolygon (take first polygon)
                    coords = farm.geometry.coordinates[0][0].map(c => [c[1], c[0]]);
                }
            } catch (e) {
                console.warn('Error parsing geometry:', e);
            }
            
            if (coords.length) {
                addFarmToMap({ 
                    ...farm, 
                    coordinates: coords,
                    farmerName: farm.farmer_name || farm.farmerName || 'Unknown',
                    farmId: farm.farm_id || farm.id,
                    cooperative: farm.cooperative_name || farm.cooperative || 'Unassigned',
                    supplier: farm.supplier || 'Unknown',
                    area: farm.area || farm.real_area || 0,
                    status: farm.status || 'pending'
                });
                valid++;
            }
        }
    });
    
    console.log(`✅ Added ${valid} farms to map`);
    if (valid) setTimeout(zoomToAllFarms, 500);
    updateMapStats();
}

/**
 * Load farms directly from API (fallback)
 */
async function loadFarmsFromAPI() {
    try {
        console.log('🔍 Fetching farms from API:', `${apiBaseUrl}/polygons`);
        
        const response = await fetch(`${apiBaseUrl}/polygons`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const geojson = await response.json();
        console.log(`📦 Received ${geojson.features?.length || 0} features from API`);
        
        if (geojson.features?.length) {
            clearAllFarmLayers();
            geojson.features.forEach(f => {
                const farm = convertGeoJSONToFarm(f);
                if (farm.coordinates?.length) addFarmToMap(farm);
            });
            console.log(`✅ Added ${geojson.features.length} farms from API`);
            
            if (window.notification) {
                window.notification.success(`Loaded ${geojson.features.length} farms from API`);
            }
        } else {
            console.log('⚠️ No farms found in API, loading samples');
            loadSampleFarms();
        }
    } catch (error) {
        console.error('❌ Error loading farms from API:', error);
        console.log('⚠️ Using sample farms as fallback');
        loadSampleFarms();
    }
    updateMapStats();
}

/**
 * Convert GeoJSON feature to farm object
 */
function convertGeoJSONToFarm(f) {
    const props = f.properties || {};
    let coords = [];
    
    if (f.geometry?.coordinates?.length) {
        try {
            if (f.geometry.type === 'Polygon') {
                // Convert [lng, lat] to [lat, lng] for Leaflet
                coords = f.geometry.coordinates[0].map(c => [c[1], c[0]]);
            } else if (f.geometry.type === 'MultiPolygon') {
                coords = f.geometry.coordinates[0][0].map(c => [c[1], c[0]]);
            }
        } catch (e) {
            console.warn('Error converting coordinates:', e);
        }
    }
    
    return {
        id: props.id || props.farm_id || `farm-${Date.now()}`,
        farmId: props.farm_id,
        farmerName: props.farmer_name || 'Unknown',
        farmerId: props.farmer_id,
        cooperative: props.cooperative_name || 'Unassigned',
        supplier: props.supplier || 'Unknown',
        area: props.real_area || props.declared_area || props.area || 0,
        status: props.status || 'pending',
        submissionDate: props.submission_date,
        enumerator: props.enumerator,
        coordinates: coords
    };
}

// ===========================================
// SAMPLE FARMS (FALLBACK)
// ===========================================

/**
 * Load sample farms for testing/offline mode
 */
function loadSampleFarms() {
    if (!map) {
        console.warn('⚠️ Map not ready for sample farms');
        return;
    }
    
    const samples = [
        { 
            id: 'FARM001', 
            farmId: 'FARM001',
            farmerName: 'Koffi Jean', 
            farmerId: 'P001',
            cooperative: 'GCC Cooperative', 
            supplier: 'GCC',
            area: 12.5, 
            status: 'validated', 
            submissionDate: '2024-01-15',
            enumerator: 'ENUM001',
            coordinates: [[7.5,-5.5],[7.55,-5.55],[7.55,-5.45],[7.5,-5.45],[7.5,-5.5]] 
        },
        { 
            id: 'FARM002', 
            farmId: 'FARM002',
            farmerName: 'Konan Marie', 
            farmerId: 'P002',
            cooperative: 'SITAPA Cooperative', 
            supplier: 'SITAPA',
            area: 8.3, 
            status: 'pending', 
            submissionDate: '2024-01-18',
            enumerator: 'ENUM002',
            coordinates: [[7.6,-5.4],[7.65,-5.4],[7.65,-5.35],[7.6,-5.35],[7.6,-5.4]] 
        },
        {
            id: 'FARM003',
            farmId: 'FARM003',
            farmerName: 'N\'Guessan Paul',
            farmerId: 'P003',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            area: 15.2,
            status: 'rejected',
            submissionDate: '2024-01-10',
            enumerator: 'ENUM003',
            coordinates: [[7.45,-5.6],[7.5,-5.6],[7.5,-5.55],[7.45,-5.55],[7.45,-5.6]]
        },
        {
            id: 'FARM004',
            farmId: 'FARM004',
            farmerName: 'Amoakon Thérèse',
            farmerId: 'P004',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 10.7,
            status: 'validated',
            submissionDate: '2024-01-12',
            enumerator: 'ENUM001',
            coordinates: [[7.4,-5.7],[7.45,-5.7],[7.45,-5.65],[7.4,-5.65],[7.4,-5.7]]
        }
    ];
    
    clearAllFarmLayers();
    samples.forEach(f => addFarmToMap(f));
    
    if (window.notification) {
        window.notification.info('Loaded sample farms');
    }
    
    console.log('✅ Added 4 sample farms to map');
    setTimeout(zoomToAllFarms, 500);
    updateMapStats();
}

// ===========================================
// MAP MANIPULATION
// ===========================================

/**
 * Add a farm to the map
 */
function addFarmToMap(farm) {
    if (!map) {
        console.warn('⚠️ Map not initialized, cannot add farm');
        return;
    }
    
    if (typeof map.addLayer !== 'function') {
        console.error('❌ Map object is invalid - cannot add layer');
        return;
    }
    
    if (!farm.coordinates?.length) {
        console.warn(`⚠️ Farm ${farm.id} has no coordinates, skipping`);
        return;
    }
    
    try {
        const polygon = L.polygon(farm.coordinates, {
            color: getStatusColor(farm.status),
            weight: 2,
            fillOpacity: 0.3,
            smoothFactor: 1
        });
        
        polygon.farmData = farm;
        polygon.bindPopup(createFarmPopup(farm));
        polygon.on('click', () => selectFarm(farm.id));
        
        farmLayers.set(farm.id, polygon);
        polygon.addTo(map);
    } catch (error) {
        console.error('❌ Error adding farm to map:', error);
    }
}

/**
 * Get color based on farm status
 */
function getStatusColor(status) {
    const colors = { 
        validated: '#4CAF50', 
        pending: '#FFC107', 
        rejected: '#F44336' 
    };
    return colors[status] || '#2196F3';
}

/**
 * Create popup HTML for farm
 */
function createFarmPopup(farm) {
    const statusClass = `status-${farm.status}`;
    const displayArea = farm.area ? parseFloat(farm.area).toFixed(1) : 'N/A';
    
    return `
        <div class="farm-popup" style="min-width: 250px; padding: 10px;">
            <h4 style="margin: 0 0 10px 0; color: #2c6e49;">Farm Details</h4>
            <div class="farm-details" style="font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Farm ID:</strong> <span>${farm.farmId || farm.id?.substring(0,8) || 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Farmer:</strong> <span>${farm.farmerName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Cooperative:</strong> <span>${farm.cooperative}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Supplier:</strong> <span>${farm.supplier}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Area:</strong> <span><strong>${displayArea} ha</strong></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Status:</strong> 
                    <span class="status-badge ${farm.status}" style="padding: 2px 8px; border-radius: 12px; background: ${getStatusColor(farm.status)}20; color: ${getStatusColor(farm.status)}; font-weight: 600;">
                        ${farm.status}
                    </span>
                </div>
                ${farm.submissionDate ? `
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <strong>Submitted:</strong> <span>${new Date(farm.submissionDate).toLocaleDateString()}</span>
                </div>
                ` : ''}
            </div>
            <div style="display: flex; gap: 8px; margin-top: 15px;">
                <button class="btn-primary btn-sm" onclick="zoomToFarm('${farm.id}')" style="flex: 1; padding: 6px;">
                    <i class="fas fa-search"></i> Zoom
                </button>
                <button class="btn-secondary btn-sm" onclick="showFarmDetails('${farm.id}')" style="flex: 1; padding: 6px;">
                    <i class="fas fa-info-circle"></i> Info
                </button>
            </div>
        </div>
    `;
}

/**
 * Select a farm on the map
 */
function selectFarm(farmId) {
    // Deselect previous farm
    if (selectedFarm) {
        const prevLayer = farmLayers.get(selectedFarm);
        if (prevLayer) {
            prevLayer.setStyle({ 
                weight: 2,
                color: getStatusColor(prevLayer.farmData?.status)
            });
        }
    }
    
    // Select new farm
    selectedFarm = farmId;
    const layer = farmLayers.get(farmId);
    
    if (layer) {
        layer.setStyle({ weight: 4, color: '#FF6B35' });
        layer.openPopup();
        
        const selectedFarmEl = document.getElementById('selectedFarmName');
        if (selectedFarmEl) {
            selectedFarmEl.textContent = farmId.substring(0, 8);
        }
        
        // Update window reference
        window.selectedFarm = farmId;
    }
}

/**
 * Clear all farm layers from map
 */
function clearAllFarmLayers() {
    if (!map) return;
    
    if (typeof map.removeLayer === 'function') {
        farmLayers.forEach(l => map.removeLayer(l));
    }
    farmLayers.clear();
    selectedFarm = null;
    window.selectedFarm = null;
}

/**
 * Update map statistics display
 */
function updateMapStats() {
    const farmsCountEl = document.getElementById('mapFarmsCount');
    const totalAreaEl = document.getElementById('mapTotalArea');
    
    if (farmsCountEl) {
        farmsCountEl.textContent = farmLayers.size;
    }
    
    if (totalAreaEl) {
        // Calculate total area from farm data
        let totalArea = 0;
        farmLayers.forEach(layer => {
            if (layer.farmData?.area) {
                totalArea += parseFloat(layer.farmData.area) || 0;
            }
        });
        totalAreaEl.textContent = totalArea > 0 ? totalArea.toFixed(1) + ' ha' : '0 ha';
    }
}

// ===========================================
// ZOOM FUNCTIONS
// ===========================================

/**
 * Zoom to a specific farm
 */
function zoomToFarm(farmId) {
    const layer = farmLayers.get(farmId);
    if (layer && map) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        selectFarm(farmId);
    }
}

/**
 * Zoom to show all farms
 */
function zoomToAllFarms() {
    if (!farmLayers.size) {
        if (window.notification) {
            window.notification.info('No farms to zoom to');
        }
        return;
    }
    
    const group = L.featureGroup(Array.from(farmLayers.values()));
    map.fitBounds(group.getBounds().pad(0.1));
    
    if (window.notification) {
        window.notification.info(`Showing all ${farmLayers.size} farms`);
    }
}

/**
 * Refresh map layers
 */
function refreshMapLayers() { 
    loadFarms(); 
}

/**
 * Show farm details (opens popup)
 */
function showFarmDetails(farmId) {
    const layer = farmLayers.get(farmId);
    if (layer) {
        layer.openPopup();
    }
}

// ===========================================
// GLOBAL EXPORTS
// ===========================================

window.zoomToFarm = zoomToFarm;
window.showFarmDetails = showFarmDetails;
window.refreshMapLayers = refreshMapLayers;
window.zoomToAllFarms = zoomToAllFarms;
window.getStatusColor = getStatusColor;
window.initMap = initMap;
window.loadFarms = loadFarms;
window.selectFarm = selectFarm;

console.log('🗺️ Map module loaded');