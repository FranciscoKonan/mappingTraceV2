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
let currentAlerts = [];
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
});

async function loadUserAndProjects() {
    showLoading(true);
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { 
        window.location.href = '../login.html'; 
        return; 
    }
    currentUser = session.user;
    
    // Get user profile
    const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('first_name, email')
        .eq('id', currentUser.id)
        .maybeSingle();
    
    const firstName = profile?.first_name || '';
    const displayName = firstName || currentUser.email.split('@')[0];
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userAvatar').textContent = (firstName.charAt(0) || currentUser.email.charAt(0)).toUpperCase();
    
    // Get user's projects
    const { data: memberships } = await supabaseClient
        .from('project_members')
        .select('project_id, role, projects(*)')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');
    
    if (memberships && memberships.length > 0) {
        allUserProjects = memberships;
        document.getElementById('userRole').textContent = memberships[0].role.replace('_', ' ').toUpperCase();
        
        // Add role badge
        const roleBadge = document.createElement('span');
        roleBadge.className = `role-badge ${memberships[0].role}`;
        roleBadge.textContent = memberships[0].role.toUpperCase();
        document.querySelector('.user-info').insertBefore(roleBadge, document.querySelector('.sync-btn'));
        
        // Get project from URL or localStorage
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
        
        // Show project selector for owners with multiple projects
        const isOwner = memberships.some(m => m.role === 'owner');
        if (isOwner && memberships.length > 1) {
            document.getElementById('projectSelectorContainer').classList.remove('hidden');
            await populateDropdown(memberships);
        }
        
        currentProject = targetProject.projects;
        document.getElementById('selectedProjectName').innerHTML = `📁 ${currentProject.name}`;
        
        // Update navigation links
        updateNavigationLinks();
        
        // Load project data
        await loadProjectData(currentProject.id);
        localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('project', currentProject.id);
        window.history.replaceState({}, '', url);
    }
    
    showLoading(false);
}

function updateNavigationLinks() {
    const queryString = currentProject ? `?project=${currentProject.id}` : '';
    document.querySelector('a[data-page="dashboard"]').href = `../Dashboard.html${queryString}`;
    document.querySelector('a[data-page="submissions"]').href = `../Submissions/submissions.html${queryString}`;
    document.querySelector('a[data-page="quality-alerts"]').href = `../QualityAlerts/quality-alerts.html${queryString}`;
    document.querySelector('a[data-page="exports"]').href = `../Exports/exports.html${queryString}`;
    document.getElementById('dataMgmtLink').href = `../DataManagement.html${queryString}`;
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
                    await loadProjectData(value);
                    localStorage.setItem(`lastProject_${currentUser.id}`, value);
                    updateNavigationLinks();
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

async function loadProjectData(projectId) {
    showLoading(true);
    
    const { data: farms } = await supabaseClient
        .from('farms')
        .select('*')
        .eq('project_id', projectId);
    
    farmsData = farms || [];
    filteredFarms = [...farmsData];
    
    // Update filter options
    updateFilterOptions();
    
    // Update UI
    updateMap(farmsData);
    updateStats(farmsData);
    updateTimeline(farmsData);
    
    showLoading(false);
    document.querySelector('.header-title h1').innerHTML = `Live Mapping <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px;">${currentProject.name}</span>`;
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
    
    updateFilterOptions();
    updateMap(allFarms);
    updateStats(allFarms);
    updateTimeline(allFarms);
    
    showLoading(false);
    document.querySelector('.header-title h1').innerHTML = 'Live Mapping <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px;">ALL PROJECTS</span>';
}

function updateFilterOptions() {
    uniqueSuppliers = [...new Set(farmsData.map(f => f.supplier).filter(Boolean))].sort();
    uniqueCooperatives = [...new Set(farmsData.map(f => f.cooperative).filter(Boolean))].sort();
    
    updateSupplierFilter();
    updateCooperativeFilter();
}

function updateSupplierFilter() {
    const select = document.getElementById('supplierFilter');
    if (!select) return;
    
    const filtered = uniqueSuppliers.filter(s => 
        s.toLowerCase().includes(supplierSearchTerm)
    );
    
    let options = '<option value="all">All Suppliers</option>';
    filtered.forEach(s => {
        options += `<option value="${s}">${s}</option>`;
    });
    select.innerHTML = options;
}

function updateCooperativeFilter() {
    const select = document.getElementById('cooperativeFilter');
    if (!select) return;
    
    const filtered = uniqueCooperatives.filter(c => 
        c.toLowerCase().includes(coopSearchTerm)
    );
    
    let options = '<option value="all">All Cooperatives</option>';
    filtered.forEach(c => {
        options += `<option value="${c}">${c}</option>`;
    });
    select.innerHTML = options;
}

function applyFilters() {
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    
    const statuses = [];
    document.querySelectorAll('.status-filter:checked').forEach(cb => {
        statuses.push(cb.value);
    });
    
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

function updateStats(farms) {
    let totalArea = 0;
    let validated = 0, pending = 0, rejected = 0;
    
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

function convertCoords(c) {
    if (!c || !Array.isArray(c)) return c;
    if (c.length === 2 && typeof c[0] === 'number') return [c[1], c[0]];
    return c.map(convertCoords);
}

function updateMap(farms) {
    if (currentMap) currentMap.remove();
    
    currentMap = L.map('map').setView([7.539989, -5.547080], 7);
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { 
        maxZoom: 20, 
        subdomains: ['mt0','mt1','mt2','mt3'] 
    }).addTo(currentMap);
    
    farmLayers = [];
    let bounds = L.latLngBounds();
    
    farms.forEach(farm => {
        if (farm.geometry?.coordinates) {
            try {
                const coords = convertCoords(farm.geometry.coordinates);
                const color = farm.status === 'validated' ? '#4CAF50' : 
                             farm.status === 'pending' ? '#FFC107' : '#F44336';
                
                const poly = L.polygon(coords, { 
                    color, 
                    weight: 2, 
                    fillColor: color, 
                    fillOpacity: 0.3 
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
            } catch(e) {
                console.error('Error adding farm polygon:', e);
            }
        }
    });
    
    if (bounds.isValid()) {
        currentMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

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
                <div class="detail-row">
                    <span class="detail-label">Farm ID:</span>
                    <span class="detail-value">${escapeHtml(farm.farmer_id || farm.id.slice(0,8))}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Farmer ID:</span>
                    <span class="detail-value">${escapeHtml(farm.farmer_id || 'N/A')}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-building"></i> Organization</h4>
                <div class="detail-row">
                    <span class="detail-label">Cooperative:</span>
                    <span class="detail-value">${escapeHtml(farm.cooperative || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Supplier:</span>
                    <span class="detail-value">${escapeHtml(farm.supplier || '-')}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-ruler-combined"></i> Measurements</h4>
                <div class="detail-row">
                    <span class="detail-label">Area:</span>
                    <span class="detail-value highlight">${(farm.area || 0).toFixed(2)} ha</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status-badge ${farm.status || 'pending'}">${farm.status || 'pending'}</span>
                    </span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-calendar"></i> Submission</h4>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${new Date(farm.created_at).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Enumerator:</span>
                    <span class="detail-value">${escapeHtml(farm.enumerator || 'N/A')}</span>
                </div>
            </div>
            
            <div class="detail-actions">
                <button onclick="window.zoomToFarm('${farm.id}')">
                    <i class="fas fa-search"></i> Zoom to Farm
                </button>
            </div>
        </div>
    `;
}

function updateTimeline(farms) {
    const timeline = document.getElementById('timelineList');
    if (!timeline) return;
    
    const recent = [...farms]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6);
    
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
// MAP CONTROL FUNCTIONS
// ===========================================
window.zoomIn = () => currentMap?.zoomIn();
window.zoomOut = () => currentMap?.zoomOut();
window.resetView = () => currentMap?.setView([7.539989, -5.547080], 7);
window.locateMe = () => currentMap?.locate({ setView: true, maxZoom: 16 });
window.refreshMapData = () => currentProject ? loadProjectData(currentProject.id) : null;
window.refreshTimeline = () => currentProject ? loadProjectData(currentProject.id) : null;
window.closeDetails = () => document.getElementById('detailsPanel').classList.add('hidden');

window.setBaseLayer = (type) => {
    if (!currentMap) return;
    
    currentMap.eachLayer(layer => {
        if (layer instanceof L.TileLayer) currentMap.removeLayer(layer);
    });
    
    if (type === 'satellite') {
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { 
            maxZoom: 20, 
            subdomains: ['mt0','mt1','mt2','mt3'] 
        }).addTo(currentMap);
    } else if (type === 'streets') {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            maxZoom: 19 
        }).addTo(currentMap);
    } else {
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { 
            maxZoom: 17 
        }).addTo(currentMap);
    }
    
    // Update active button styling
    document.querySelectorAll('.map-action-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
};

window.zoomToAllFarms = () => {
    if (farmLayers.length === 0) return;
    
    const bounds = L.latLngBounds();
    farmLayers.forEach(layer => bounds.extend(layer.getBounds()));
    currentMap?.fitBounds(bounds, { padding: [50, 50] });
};

window.zoomToFarm = (farmId) => {
    const farm = filteredFarms.find(f => f.id === farmId);
    if (farm && farm.geometry?.coordinates) {
        const coords = convertCoords(farm.geometry.coordinates);
        const bounds = L.latLngBounds(coords);
        currentMap?.fitBounds(bounds, { padding: [30, 30] });
        showFarmDetails(farm);
    }
};

window.toggleLegend = () => {
    const legend = document.getElementById('mapLegend');
    legend.style.display = legend.style.display === 'none' ? 'block' : 'none';
};

window.performSearch = () => {
    const term = document.getElementById('mapSearch').value.toLowerCase();
    if (term.length < 2) {
        showNotification('Enter at least 2 characters', 'warning');
        return;
    }
    
    const found = filteredFarms.filter(farm => 
        (farm.farmer_name || '').toLowerCase().includes(term) ||
        (farm.farmer_id || '').toLowerCase().includes(term)
    );
    
    if (found.length === 1) {
        zoomToFarm(found[0].id);
        showNotification('Farm found', 'success');
    } else if (found.length > 1) {
        showNotification(`Found ${found.length} farms`, 'info');
    } else {
        showNotification('No farms found', 'warning');
    }
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================
function setupEventListeners() {
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('syncKoboBtn')?.addEventListener('click', () => {
        showNotification('Syncing with Kobo...', 'info');
        setTimeout(() => loadProjectData(currentProject.id), 1500);
    });
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
    
    document.getElementById('supplierSearch')?.addEventListener('input', (e) => {
        supplierSearchTerm = e.target.value.toLowerCase();
        updateSupplierFilter();
    });
    
    document.getElementById('coopSearch')?.addEventListener('input', (e) => {
        coopSearchTerm = e.target.value.toLowerCase();
        updateCooperativeFilter();
    });
}

function showNotification(message, type = 'info') {
    const colors = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FFC107',
        info: '#2196F3'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${colors[type]};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideIn 0.3s ease;
        font-size: 13px;
        font-weight: 500;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// Add animation styles if not present
if (!document.getElementById('live-mapping-animations')) {
    const style = document.createElement('style');
    style.id = 'live-mapping-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ Live Mapping ready');