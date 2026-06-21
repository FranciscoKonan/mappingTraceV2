// ===========================================
// SIDEBAR TOGGLE LOGIC
// ===========================================
const sidebar = document.getElementById('sidebar');
const burgerBtn = document.getElementById('burgerBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar() {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    } else {
        sidebar.classList.toggle('collapsed');
        const icon = sidebarToggle.querySelector('i');
        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-left';
        }
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
}

function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

window.toggleMobileSidebar = toggleSidebar;
window.closeMobileSidebar = closeMobileSidebar;

burgerBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleSidebar();
});

sidebarToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (window.innerWidth > 768) {
        toggleSidebar();
    }
});

sidebarOverlay.addEventListener('click', closeMobileSidebar);

if (window.innerWidth > 768) {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
        sidebar.classList.add('collapsed');
        sidebarToggle.querySelector('i').className = 'fas fa-chevron-right';
    }
}

window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        closeMobileSidebar();
    }
});

// ===========================================
// LIVE MAPPING - COMPLETE JAVASCRIPT
// ===========================================
console.log('🚀 Live Mapping initializing...');

// ===========================================
// SUPABASE CONFIGURATION
// ===========================================
const SUPABASE_URL = 'https://crvnohvudurqfukjpisv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let supabaseClient = null;
let currentUser = null;
let currentProject = null;
let allUserProjects = [];
let farmsData = [];
let filteredFarms = [];
let currentMap = null;
let farmLayers = [];
let protectedLayer = null;
let protectedAreas = [];
let protectedVisible = true;
let mapInitialized = false;
let overlapAlerts = [];
let qualityAlerts = [];
let uniqueSuppliers = [];
let uniqueCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📌 DOM Content Loaded');
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await loadUserAndProjects();
    setupDropdown();
    setupEventListeners();
    setupFileUpload();
});

async function loadUserAndProjects() {
    showLoading(true);
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { 
        window.location.href = '../login.html'; 
        return; 
    }
    currentUser = session.user;
    
    const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('first_name, email')
        .eq('id', currentUser.id)
        .maybeSingle();
    
    const firstName = profile?.first_name || '';
    const displayName = firstName || currentUser.email.split('@')[0];
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userAvatar').textContent = (firstName.charAt(0) || currentUser.email.charAt(0)).toUpperCase();
    
    const { data: memberships } = await supabaseClient
        .from('project_members')
        .select('project_id, role, projects(*)')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');
    
    if (memberships && memberships.length > 0) {
        allUserProjects = memberships;
        const userRole = memberships[0].role;
        document.getElementById('userRole').textContent = userRole.replace('_', ' ').toUpperCase();
        
        const roleBadge = document.createElement('span');
        roleBadge.className = `role-badge ${userRole}`;
        roleBadge.textContent = userRole.toUpperCase();
        document.querySelector('.user-info').insertBefore(roleBadge, document.querySelector('.sync-btn'));
        
        // Show admin section for owners and managers
        const isAdmin = userRole === 'owner' || userRole === 'manager';
        const adminSection = document.getElementById('adminSection');
        if (adminSection) {
            adminSection.style.display = isAdmin ? 'block' : 'none';
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        let projectIdFromUrl = urlParams.get('project');
        let targetProject = null;
        
        if (projectIdFromUrl && projectIdFromUrl !== 'all') {
            targetProject = memberships.find(m => m.projects.id === projectIdFromUrl);
        }
        if (!targetProject) {
            const lastViewed = localStorage.getItem(`lastProject_${currentUser.id}`);
            if (lastViewed) targetProject = memberships.find(m => m.projects.id === lastViewed);
            if (!targetProject) targetProject = memberships[0];
        }
        
        const isOwner = memberships.some(m => m.role === 'owner');
        if (isOwner && memberships.length > 1) {
            document.getElementById('projectSelectorContainer').classList.remove('hidden');
            await populateDropdown(memberships);
        }
        
        currentProject = targetProject.projects;
        document.getElementById('selectedProjectName').innerHTML = `📁 ${currentProject.name}`;
        document.getElementById('projectBadge').textContent = currentProject.name;
        
        await loadProjectData(currentProject.id);
        localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
        
        const url = new URL(window.location);
        url.searchParams.set('project', currentProject.id);
        window.history.replaceState({}, '', url);
    }
    
    showLoading(false);
}

async function populateDropdown(memberships) {
    const container = document.getElementById('dropdownItems');
    let html = `<div class="dropdown-item" data-value="all">📊 ALL PROJECTS</div>`;
    for (const m of memberships) {
        html += `<div class="dropdown-item" data-value="${m.projects.id}">📁 ${m.projects.name}</div>`;
    }
    container.innerHTML = html;
    
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', async () => {
            const value = item.dataset.value;
            document.getElementById('selectedProjectName').innerHTML = value === 'all' ? '📊 ALL PROJECTS' : `📁 ${item.textContent.slice(2)}`;
            document.getElementById('dropdownMenu').classList.remove('show');
            
            if (value === 'all') {
                await loadAllProjectsData();
            } else {
                const selected = allUserProjects.find(p => p.projects.id === value);
                if (selected) {
                    currentProject = selected.projects;
                    document.getElementById('projectBadge').textContent = currentProject.name;
                    await loadProjectData(value);
                    localStorage.setItem(`lastProject_${currentUser.id}`, value);
                }
            }
            
            const url = new URL(window.location);
            url.searchParams.set('project', value);
            window.history.pushState({}, '', url);
            
            document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        });
    });
}

function setupDropdown() {
    const selected = document.getElementById('dropdownSelected');
    const menu = document.getElementById('dropdownMenu');
    const search = document.getElementById('projectSearch');
    
    selected.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        menu.classList.toggle('show'); 
        if (menu.classList.contains('show')) { 
            search.value = ''; 
            filterDropdown(''); 
            search.focus(); 
        } 
    });
    
    search.addEventListener('input', (e) => filterDropdown(e.target.value.toLowerCase()));
    document.addEventListener('click', () => menu.classList.remove('show'));
}

function filterDropdown(term) {
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(term) ? 'block' : 'none';
    });
}

async function loadAllProjectsData() {
    showLoading(true);
    
    let allFarms = [];
    for (const m of allUserProjects) {
        const { data: farms } = await supabaseClient
            .from('farms')
            .select('*')
            .eq('project_id', m.projects.id);
        if (farms) allFarms = [...allFarms, ...farms];
    }
    
    farmsData = allFarms;
    filteredFarms = [...farmsData];
    
    await loadProtectedAreas();
    updateFilterOptions();
    updateMap(farmsData);
    updateStats(farmsData);
    updateTimeline(farmsData);
    updateOverlapCount();
    
    document.getElementById('projectBadge').textContent = 'ALL PROJECTS';
    showLoading(false);
}

async function loadProjectData(projectId) {
    showLoading(true);
    
    const { data: farms } = await supabaseClient
        .from('farms')
        .select('*')
        .eq('project_id', projectId);
    
    farmsData = farms || [];
    filteredFarms = [...farmsData];
    
    await loadProtectedAreas();
    updateFilterOptions();
    updateMap(farmsData);
    updateStats(farmsData);
    updateTimeline(farmsData);
    updateOverlapCount();
    
    showLoading(false);
    document.querySelector('.header-title h1').innerHTML = `Live Mapping <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px;">${currentProject.name}</span>`;
}

async function loadProtectedAreas() {
    try {
        if (!currentProject) return;
        const { data, error } = await supabaseClient
            .from('protected_areas')
            .select('*')
            .eq('project_id', currentProject.id);
        
        if (!error && data) {
            protectedAreas = data.map(area => ({ 
                id: area.id, 
                type: 'Feature', 
                geometry: area.geometry, 
                properties: { name: area.name, area_ha: area.area_ha } 
            }));
            console.log('✅ Loaded protected areas:', protectedAreas.length);
            updateProtectedStatus();
        }
    } catch (error) {
        console.error('❌ Error loading protected areas:', error);
    }
}

function updateProtectedStatus() {
    const statusEl = document.getElementById('protectedStatus');
    const dot = statusEl?.querySelector('.status-dot');
    const text = statusEl?.querySelector('span:last-child');
    
    if (protectedAreas.length > 0) {
        if (dot) { dot.className = 'status-dot active'; }
        if (text) { text.textContent = `${protectedAreas.length} areas loaded`; }
    } else {
        if (dot) { dot.className = 'status-dot'; }
        if (text) { text.textContent = 'No areas loaded'; }
    }
}

// ===========================================
// FILE UPLOAD - GEOJSON (Admin Only)
// ===========================================
function setupFileUpload() {
    document.getElementById('geoUpload').addEventListener('change', async function(e) {
        if (e.target.files && e.target.files[0]) {
            await uploadProtectedArea(e.target.files[0]);
            e.target.value = '';
        }
    });
}

async function uploadProtectedArea(file) {
    const uploadStatus = document.getElementById('uploadStatus');
    uploadStatus.textContent = 'Uploading...';
    uploadStatus.className = 'upload-status';
    showLoading(true);
    
    try {
        const text = await file.text();
        const geojson = JSON.parse(text);
        
        if (!geojson.features || geojson.features.length === 0) {
            throw new Error('No features found in GeoJSON');
        }
        
        let savedCount = 0;
        for (const feature of geojson.features) {
            if (!feature.geometry) continue;
            
            let name = feature.properties?.nom || feature.properties?.name || 
                       feature.properties?.Name || 'Protected Area';
            let areaHa = null;
            try { 
                areaHa = turf.area(feature.geometry) / 10000; 
            } catch(e) {}
            
            const { error } = await supabaseClient.from('protected_areas').insert({
                project_id: currentProject.id,
                name: name.toString().substring(0, 255),
                geometry: feature.geometry,
                area_ha: areaHa,
                uploaded_by: currentUser.id
            });
            
            if (!error) savedCount++;
        }
        
        uploadStatus.textContent = `✅ Uploaded ${savedCount} protected areas`;
        uploadStatus.className = 'upload-status success';
        showNotification(`✅ Uploaded ${savedCount} protected areas`, 'success');
        await loadProtectedAreas();
        displayProtectedAreas();
        updateProtectedStatus();
        
    } catch (err) {
        console.error('❌ Upload error:', err);
        uploadStatus.textContent = '❌ Error: ' + err.message;
        uploadStatus.className = 'upload-status error';
        showNotification('❌ Error: ' + err.message, 'error');
    }
    showLoading(false);
}

window.clearAllProtectedAreas = async function() {
    if (!confirm('Delete ALL protected areas?')) return;
    showLoading(true);
    try {
        await supabaseClient.from('protected_areas').delete().eq('project_id', currentProject.id);
        protectedAreas = [];
        if (protectedLayer && currentMap) {
            currentMap.removeLayer(protectedLayer);
            protectedLayer = null;
        }
        updateProtectedStatus();
        document.getElementById('uploadStatus').textContent = 'All areas cleared';
        document.getElementById('uploadStatus').className = 'upload-status';
        showNotification('All protected areas deleted', 'success');
    } catch (error) {
        showNotification('Error deleting: ' + error.message, 'error');
    }
    showLoading(false);
};

// ===========================================
// MAP FUNCTIONS
// ===========================================
function initMap() {
    if (mapInitialized) return;
    try {
        currentMap = L.map('map', {
            zoomControl: false
        }).setView([7.539989, -5.547080], 7);
        
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { 
            maxZoom: 20, 
            subdomains: ['mt0','mt1','mt2','mt3'] 
        }).addTo(currentMap);
        
        mapInitialized = true;
        console.log('✅ Map initialized');
        displayProtectedAreas();
    } catch(e) {
        console.error('❌ Error initializing map:', e);
    }
}

function updateMap(farms) {
    if (!currentMap) {
        initMap();
        if (!currentMap) return;
    }
    
    farmLayers.forEach(layer => { if (currentMap) currentMap.removeLayer(layer); });
    farmLayers = [];
    let bounds = L.latLngBounds();
    
    function convertCoords(c) {
        if (!c || !Array.isArray(c)) return c;
        if (c.length === 2 && typeof c[0] === 'number') return [c[1], c[0]];
        return c.map(convertCoords);
    }
    
    farms.forEach(farm => {
        if (farm.geometry?.coordinates) {
            try {
                const color = farm.status === 'validated' ? '#4CAF50' : 
                             farm.status === 'pending' ? '#FFC107' : '#F44336';
                
                const poly = L.polygon(convertCoords(farm.geometry.coordinates), { 
                    color, weight: 2, fillColor: color, fillOpacity: 0.3 
                }).addTo(currentMap);
                
                poly.farmData = farm;
                poly.bindPopup(`
                    <b>${farm.farmer_name || 'Unknown'}</b><br>
                    Area: ${farm.area || 0} ha<br>
                    Status: ${farm.status || 'pending'}
                `);
                poly.on('click', () => showFarmDetails(farm));
                farmLayers.push(poly);
                bounds.extend(poly.getBounds());
            } catch(e) {}
        }
    });
    
    displayProtectedAreas();
    
    if (bounds.isValid()) {
        currentMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

function displayProtectedAreas() {
    if (!currentMap) return;
    try {
        if (protectedLayer) {
            currentMap.removeLayer(protectedLayer);
            protectedLayer = null;
        }
        
        if (!protectedVisible || protectedAreas.length === 0) return;
        
        protectedLayer = L.geoJSON(protectedAreas, { 
            style: { 
                color: '#8B4513', 
                weight: 2, 
                fillColor: '#8B4513', 
                fillOpacity: 0.15,
                dashArray: '5,5'
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`<b>🌳 Protected Area</b><br>${feature.properties.name || 'Unnamed'}`);
            }
        });
        
        if (protectedLayer) {
            protectedLayer.addTo(currentMap);
            protectedLayer.bringToBack();
        }
    } catch(e) { console.error('Error displaying protected areas:', e); }
}

// ===========================================
// FILTER FUNCTIONS
// ===========================================
function updateFilterOptions() {
    uniqueSuppliers = [...new Set(farmsData.map(f => f.supplier).filter(Boolean))].sort();
    uniqueCooperatives = [...new Set(farmsData.map(f => f.cooperative).filter(Boolean))].sort();
    updateSupplierFilter();
    updateCooperativeFilter();
}

function updateSupplierFilter() {
    const select = document.getElementById('supplierFilter');
    if (!select) return;
    const filtered = uniqueSuppliers.filter(s => s.toLowerCase().includes(supplierSearchTerm));
    let options = '<option value="all">All Suppliers</option>';
    filtered.forEach(s => { options += `<option value="${s}">${s}</option>`; });
    select.innerHTML = options;
}

function updateCooperativeFilter() {
    const select = document.getElementById('cooperativeFilter');
    if (!select) return;
    const filtered = uniqueCooperatives.filter(c => c.toLowerCase().includes(coopSearchTerm));
    let options = '<option value="all">All Cooperatives</option>';
    filtered.forEach(c => { options += `<option value="${c}">${c}</option>`; });
    select.innerHTML = options;
}

function applyFilters() {
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    const statuses = [];
    document.querySelectorAll('.status-filter:checked').forEach(cb => statuses.push(cb.value));
    
    filteredFarms = farmsData.filter(farm => {
        if (supplier !== 'all' && farm.supplier !== supplier) return false;
        if (cooperative !== 'all' && farm.cooperative !== cooperative) return false;
        if (statuses.length > 0 && !statuses.includes(farm.status)) return false;
        return true;
    });
    
    updateMap(filteredFarms);
    updateStats(filteredFarms);
    updateTimeline(filteredFarms);
    showNotification(`Showing ${filteredFarms.length} farms`, 'info');
}

// ===========================================
// STATS FUNCTIONS
// ===========================================
function updateStats(farms) {
    let totalArea = 0, validated = 0, pending = 0, rejected = 0;
    farms.forEach(f => {
        totalArea += f.area || 0;
        if (f.status === 'validated') validated++;
        else if (f.status === 'pending') pending++;
        else if (f.status === 'rejected') rejected++;
    });
    document.getElementById('statTotal').textContent = farms.length;
    document.getElementById('statArea').textContent = totalArea.toFixed(1) + ' ha';
    document.getElementById('statAvg').textContent = farms.length ? (totalArea / farms.length).toFixed(1) + ' ha' : '0 ha';
    document.getElementById('statValidated').textContent = validated;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statRejected').textContent = rejected;
    document.getElementById('mapFarmsCount').textContent = farms.length;
    document.getElementById('mapTotalArea').textContent = totalArea.toFixed(1) + ' ha';
}

function updateOverlapCount() {
    let overlaps = 0;
    filteredFarms.forEach(farm => {
        if (!farm.geometry?.coordinates) return;
        protectedAreas.forEach(area => {
            try {
                const farmPoly = turf.polygon(farm.geometry.coordinates);
                const areaPoly = turf.polygon(area.geometry.coordinates);
                if (turf.booleanIntersects(farmPoly, areaPoly)) {
                    overlaps++;
                }
            } catch(e) {}
        });
    });
    document.getElementById('mapOverlapCount').textContent = overlaps;
}

// ===========================================
// TIMELINE FUNCTIONS
// ===========================================
function updateTimeline(farms) {
    const timeline = document.getElementById('timelineList');
    if (!timeline) return;
    
    const recent = [...farms].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
    
    if (recent.length === 0) {
        timeline.innerHTML = '<div class="empty-state">No recent submissions</div>';
        return;
    }
    
    timeline.innerHTML = recent.map(farm => {
        const statusColor = farm.status === 'validated' ? '#4CAF50' : 
                           farm.status === 'pending' ? '#FFC107' : '#F44336';
        return `
            <div class="timeline-item" onclick="window.zoomToFarm('${farm.id}')">
                <div class="timeline-icon" style="background: ${statusColor};">
                    <i class="fas fa-tractor"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${escapeHtml(farm.farmer_name || 'Unknown')}</div>
                    <div class="timeline-subtitle">${(farm.area || 0).toFixed(1)} ha • ${new Date(farm.created_at).toLocaleDateString()}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ===========================================
// FARM DETAILS
// ===========================================
function showFarmDetails(farm) {
    const panel = document.getElementById('detailsPanel');
    const content = document.getElementById('detailsContent');
    panel.classList.remove('hidden');
    
    const statusColor = farm.status === 'validated' ? '#4CAF50' : 
                       farm.status === 'pending' ? '#FFC107' : '#F44336';
    
    content.innerHTML = `
        <div class="farm-detail-card">
            <div class="detail-header" style="background: ${statusColor}15;">
                <i class="fas fa-tractor" style="color: ${statusColor};"></i>
                <h3>${escapeHtml(farm.farmer_name || 'Unknown Farmer')}</h3>
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-id-card"></i> Identification</h4>
                <div class="detail-row"><span class="detail-label">Farm ID:</span><span class="detail-value">${escapeHtml(farm.farmer_id || farm.id.slice(0,8))}</span></div>
                <div class="detail-row"><span class="detail-label">Farmer ID:</span><span class="detail-value">${escapeHtml(farm.farmer_id || 'N/A')}</span></div>
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-building"></i> Organization</h4>
                <div class="detail-row"><span class="detail-label">Cooperative:</span><span class="detail-value">${escapeHtml(farm.cooperative || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Supplier:</span><span class="detail-value">${escapeHtml(farm.supplier || '-')}</span></div>
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-ruler-combined"></i> Measurements</h4>
                <div class="detail-row"><span class="detail-label">Area:</span><span class="detail-value highlight">${(farm.area || 0).toFixed(2)} ha</span></div>
                <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-badge ${farm.status || 'pending'}">${farm.status || 'pending'}</span></span></div>
            </div>
            <div class="detail-actions">
                <button onclick="window.zoomToFarm('${farm.id}')"><i class="fas fa-search"></i> Zoom to Farm</button>
            </div>
        </div>
    `;
}

window.closeDetails = function() {
    document.getElementById('detailsPanel').classList.add('hidden');
};

window.zoomToFarm = function(farmId) {
    const farm = filteredFarms.find(f => f.id === farmId);
    if (farm && farm.geometry?.coordinates && currentMap) {
        function convert(c) {
            if (!Array.isArray(c)) return c;
            if (c.length === 2 && typeof c[0] === 'number') return [c[1], c[0]];
            return c.map(convert);
        }
        try {
            const bounds = L.latLngBounds(convert(farm.geometry.coordinates));
            currentMap.fitBounds(bounds, { padding: [30, 30] });
            showFarmDetails(farm);
            showNotification(`Zooming to ${farm.farmer_name || 'farm'}`, 'info');
        } catch(e) {}
    }
};

// ===========================================
// MAP CONTROLS
// ===========================================
window.zoomIn = function() { currentMap?.zoomIn(); };
window.zoomOut = function() { currentMap?.zoomOut(); };
window.resetView = function() { currentMap?.setView([7.539989, -5.547080], 7); };
window.locateMe = function() { currentMap?.locate({ setView: true, maxZoom: 16 }); };
window.refreshMapData = function() { currentProject ? loadProjectData(currentProject.id) : null; };
window.refreshTimeline = function() { currentProject ? loadProjectData(currentProject.id) : null; };

window.zoomToAllFarms = function() {
    if (farmLayers.length === 0) return;
    const bounds = L.latLngBounds();
    farmLayers.forEach(layer => bounds.extend(layer.getBounds()));
    currentMap?.fitBounds(bounds, { padding: [50, 50] });
};

window.toggleLegend = function() {
    const legend = document.getElementById('mapLegend');
    legend.style.display = legend.style.display === 'none' ? 'block' : 'none';
};

window.setBaseLayer = function(type) {
    if (!currentMap) return;
    currentMap.eachLayer(layer => {
        if (layer instanceof L.TileLayer) currentMap.removeLayer(layer);
    });
    if (type === 'satellite') {
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'] }).addTo(currentMap);
    } else if (type === 'streets') {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(currentMap);
    } else {
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }).addTo(currentMap);
    }
    document.querySelectorAll('.map-action-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
};

window.performSearch = function() {
    const term = document.getElementById('mapSearch').value.toLowerCase();
    if (term.length < 2) { showNotification('Enter at least 2 characters', 'warning'); return; }
    const found = filteredFarms.find(f => f.farmer_name?.toLowerCase().includes(term) || f.farmer_id?.toLowerCase().includes(term));
    if (found) window.zoomToFarm(found.id);
    else showNotification('Farm not found', 'warning');
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================
function setupEventListeners() {
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('syncKoboBtn')?.addEventListener('click', () => {
        showNotification('Refreshing data...', 'info');
        refreshMapData();
    });
    document.getElementById('toggleProtectedLayer')?.addEventListener('change', (e) => {
        protectedVisible = e.target.checked;
        displayProtectedAreas();
    });
    document.getElementById('supplierSearch')?.addEventListener('input', (e) => {
        supplierSearchTerm = e.target.value.toLowerCase();
        updateSupplierFilter();
    });
    document.getElementById('coopSearch')?.addEventListener('input', (e) => {
        coopSearchTerm = e.target.value.toLowerCase();
        updateCooperativeFilter();
    });
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

function showNotification(message, type = 'info') {
    const colors = { success: '#4CAF50', error: '#F44336', warning: '#FFC107', info: '#2196F3' };
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

console.log('✅ Live Mapping ready');
