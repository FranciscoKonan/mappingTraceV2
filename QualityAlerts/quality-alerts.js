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
// QUALITY ALERTS - COMPLETE JAVASCRIPT
// ===========================================
console.log('🚀 Quality Alerts page initializing...');

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
let allFarms = [];
let protectedAreas = [];

// Protected alerts
let protectedAlerts = [];
let filteredProtectedAlerts = [];
let protectedPage = 1;

// Polygon alerts
let polygonAlerts = [];
let filteredPolygonAlerts = [];
let polygonPage = 1;

const rowsPerPage = 10;
let currentMap = null;

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
        document.getElementById('userRole').textContent = memberships[0].role.replace('_', ' ').toUpperCase();
        
        const roleBadge = document.createElement('span');
        roleBadge.className = `role-badge ${memberships[0].role}`;
        roleBadge.textContent = memberships[0].role.toUpperCase();
        document.querySelector('.user-info').insertBefore(roleBadge, document.querySelector('.sync-btn'));
        
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
        
        console.log('📁 Loading project:', currentProject.id, currentProject.name);
        
        // Load farms and protected areas in parallel
        await Promise.all([
            loadFarms(currentProject.id),
            loadProtectedAreas(currentProject.id)
        ]);
        
        // Generate alerts after both are loaded
        generateAlerts();
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
                    await Promise.all([
                        loadFarms(value),
                        loadProtectedAreas(value)
                    ]);
                    generateAlerts();
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
    
    let allFarmsData = [];
    let allProtectedData = [];
    for (const m of allUserProjects) {
        const { data: farms } = await supabaseClient
            .from('farms')
            .select('*')
            .eq('project_id', m.projects.id);
        if (farms) allFarmsData = [...allFarmsData, ...farms];
        
        const { data: protected } = await supabaseClient
            .from('protected_areas')
            .select('*')
            .eq('project_id', m.projects.id);
        if (protected) allProtectedData = [...allProtectedData, ...protected];
    }
    
    allFarms = allFarmsData;
    protectedAreas = allProtectedData;
    console.log('📊 All Projects - Farms:', allFarms.length, 'Protected Areas:', protectedAreas.length);
    generateAlerts();
    document.getElementById('projectBadge').textContent = 'ALL PROJECTS';
    showLoading(false);
}

async function loadFarms(projectId) {
    console.log('🔍 Loading farms for project:', projectId);
    const { data: farms, error } = await supabaseClient
        .from('farms')
        .select('*')
        .eq('project_id', projectId);
    
    if (error) {
        console.error('❌ Error loading farms:', error);
        allFarms = [];
    } else {
        allFarms = farms || [];
        console.log('✅ Loaded farms:', allFarms.length);
    }
    return allFarms;
}

async function loadProtectedAreas(projectId) {
    console.log('🔍 Loading protected areas for project:', projectId);
    try {
        const { data, error } = await supabaseClient
            .from('protected_areas')
            .select('*')
            .eq('project_id', projectId);
        
        if (error) {
            console.error('❌ Error loading protected areas:', error);
            protectedAreas = [];
        } else {
            protectedAreas = data || [];
            console.log('✅ Loaded protected areas:', protectedAreas.length);
            if (protectedAreas.length > 0) {
                console.log('📋 Protected areas:', protectedAreas.map(a => a.name || 'Unnamed'));
            }
        }
    } catch (error) {
        console.error('❌ Error loading protected areas:', error);
        protectedAreas = [];
    }
    return protectedAreas;
}

// ===========================================
// ALERT GENERATION - FIXED FOR PROTECTED AREAS
// ===========================================
function generateAlerts() {
    console.log('🔍 Generating quality alerts...');
    console.log('📊 Total farms:', allFarms.length);
    console.log('📊 Protected areas:', protectedAreas.length);
    
    protectedAlerts = [];
    polygonAlerts = [];
    
    // Filter farms with valid geometry
    const farmsWithGeo = allFarms.filter(f => f.geometry && f.geometry.coordinates);
    console.log('📊 Farms with geometry:', farmsWithGeo.length);
    
    // ===========================================
    // PROTECTED AREA ALERTS - MAIN FOCUS
    // ===========================================
    if (protectedAreas.length > 0 && farmsWithGeo.length > 0) {
        console.log('🔍 Checking protected area overlaps...');
        
        // Log sample of protected areas for debugging
        protectedAreas.forEach((area, idx) => {
            if (idx < 3) {
                console.log(`  Protected area ${idx+1}:`, area.name || 'Unnamed', 
                           'Type:', area.geometry?.type, 
                           'Has coords:', !!area.geometry?.coordinates);
            }
        });
        
        let overlapCount = 0;
        
        farmsWithGeo.forEach(farm => {
            protectedAreas.forEach(area => {
                try {
                    // Skip if area has no geometry
                    if (!area.geometry || !area.geometry.coordinates) {
                        return;
                    }
                    
                    // Handle different geometry types
                    let areaCoords = area.geometry.coordinates;
                    let farmCoords = farm.geometry.coordinates;
                    
                    // If it's a Polygon, wrap in array for turf
                    if (area.geometry.type === 'Polygon') {
                        areaCoords = [areaCoords];
                    }
                    if (farm.geometry.type === 'Polygon') {
                        farmCoords = [farmCoords];
                    }
                    
                    // Create turf polygons
                    try {
                        const farmPoly = turf.polygon(farm.geometry.coordinates);
                        const areaPoly = turf.polygon(area.geometry.coordinates);
                        
                        // Check if they intersect
                        if (turf.booleanIntersects(farmPoly, areaPoly)) {
                            const intersection = turf.intersect(farmPoly, areaPoly);
                            if (intersection) {
                                const overlapAreaHa = turf.area(intersection) / 10000;
                                // Only count significant overlaps (> 0.01 ha)
                                if (overlapAreaHa > 0.01) {
                                    overlapCount++;
                                    
                                    let severity = 'medium';
                                    if (overlapAreaHa > 10) severity = 'critical';
                                    else if (overlapAreaHa > 5) severity = 'high';
                                    else if (overlapAreaHa > 1) severity = 'medium';
                                    else severity = 'low';
                                    
                                    console.log(`⚠️ Overlap: ${farm.farmer_name} overlaps ${area.name || 'Unnamed'} by ${overlapAreaHa.toFixed(2)} ha (${severity})`);
                                    
                                    protectedAlerts.push({
                                        id: `protected_overlap_${farm.id}_${area.id}`,
                                        type: 'protected_overlap',
                                        severity: severity,
                                        title: 'Protected Area Overlap',
                                        description: `Farm "${farm.farmer_name || 'Unknown'}" overlaps protected area "${area.name || 'Unnamed'}" by ${overlapAreaHa.toFixed(2)} ha`,
                                        farm: farm,
                                        protectedArea: area,
                                        overlapArea: overlapAreaHa,
                                        intersectionGeo: intersection.geometry.coordinates,
                                        supplier: farm.supplier || 'Unknown',
                                        cooperative: farm.cooperative || 'Unassigned',
                                        status: 'new',
                                        date: new Date().toISOString()
                                    });
                                }
                            }
                        }
                    } catch (turfError) {
                        // Skip individual turf errors
                    }
                } catch(e) {
                    // Skip errors
                }
            });
        });
        
        console.log(`✅ Found ${overlapCount} protected area overlaps`);
        console.log(`✅ Generated ${protectedAlerts.length} protected area alerts`);
        
    } else {
        if (protectedAreas.length === 0) {
            console.log('ℹ️ No protected areas loaded for this project');
        }
        if (farmsWithGeo.length === 0) {
            console.log('ℹ️ No farms with geometry data');
        }
    }
    
    // ===========================================
    // POLYGON QUALITY ALERTS
    // ===========================================
    console.log('🔍 Checking polygon quality...');
    
    // 1. Self-intersection
    farmsWithGeo.forEach(farm => {
        try {
            const poly = turf.polygon(farm.geometry.coordinates);
            if (!turf.booleanValid(poly)) {
                polygonAlerts.push({
                    id: `self_intersection_${farm.id}`,
                    type: 'self_intersection',
                    severity: 'high',
                    title: 'Self-Intersection Detected',
                    description: `Farm "${farm.farmer_name || 'Unknown'}" has self-intersecting polygon boundaries.`,
                    farm: farm,
                    supplier: farm.supplier || 'Unknown',
                    cooperative: farm.cooperative || 'Unassigned',
                    status: 'new',
                    date: new Date().toISOString()
                });
            }
        } catch(e) {
            polygonAlerts.push({
                id: `invalid_geom_${farm.id}`,
                type: 'self_intersection',
                severity: 'critical',
                title: 'Invalid Geometry',
                description: `Farm "${farm.farmer_name || 'Unknown'}" has invalid geometry.`,
                farm: farm,
                supplier: farm.supplier || 'Unknown',
                cooperative: farm.cooperative || 'Unassigned',
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    // 2. Duplicate farmer IDs
    const seenIds = {};
    allFarms.forEach(farm => {
        if (farm.farmer_id) {
            if (seenIds[farm.farmer_id]) {
                if (!polygonAlerts.some(a => a.farm?.id === farm.id && a.type === 'duplicate')) {
                    polygonAlerts.push({
                        id: `duplicate_${farm.id}`,
                        type: 'duplicate',
                        severity: 'high',
                        title: 'Duplicate Farmer ID',
                        description: `Farmer ID "${farm.farmer_id}" appears in multiple farms.`,
                        farm: farm,
                        supplier: farm.supplier || 'Unknown',
                        cooperative: farm.cooperative || 'Unassigned',
                        duplicateId: farm.farmer_id,
                        status: 'new',
                        date: new Date().toISOString()
                    });
                }
            }
            seenIds[farm.farmer_id] = true;
        }
    });
    
    // 3. Overlap between farms
    for (let i = 0; i < farmsWithGeo.length; i++) {
        for (let j = i + 1; j < farmsWithGeo.length; j++) {
            const farm1 = farmsWithGeo[i];
            const farm2 = farmsWithGeo[j];
            
            try {
                const poly1 = turf.polygon(farm1.geometry.coordinates);
                const poly2 = turf.polygon(farm2.geometry.coordinates);
                
                if (turf.booleanIntersects(poly1, poly2)) {
                    const intersection = turf.intersect(poly1, poly2);
                    
                    if (intersection) {
                        const overlapAreaHa = turf.area(intersection) / 10000;
                        
                        if (overlapAreaHa > 0.01) {
                            let severity = 'low';
                            if (overlapAreaHa > 5) severity = 'critical';
                            else if (overlapAreaHa >= 3) severity = 'high';
                            else if (overlapAreaHa > 1) severity = 'medium';
                            
                            polygonAlerts.push({
                                id: `overlap_${farm1.id}_${farm2.id}`,
                                type: 'overlap',
                                severity: severity,
                                title: `${severity.toUpperCase()} Overlap Detected`,
                                description: `Farm "${farm1.farmer_name}" overlaps with "${farm2.farmer_name}" by ${overlapAreaHa.toFixed(2)} ha`,
                                farm1: farm1,
                                farm2: farm2,
                                overlapArea: overlapAreaHa,
                                intersectionGeo: intersection.geometry.coordinates,
                                supplier: farm1.supplier || 'Unknown',
                                cooperative: farm1.cooperative || 'Unassigned',
                                status: 'new',
                                date: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch(e) {}
        }
    }
    
    console.log(`✅ Generated ${protectedAlerts.length} protected area alerts and ${polygonAlerts.length} polygon alerts`);
    
    // Update UI
    updateBadges();
    updateSupplierFilters();
    applyProtectedFilters();
    applyPolygonFilters();
    updateStats();
}

function updateBadges() {
    document.getElementById('protectedBadge').textContent = protectedAlerts.length;
    document.getElementById('polygonBadge').textContent = polygonAlerts.length;
    
    // Highlight if critical
    const criticalProtected = protectedAlerts.filter(a => a.severity === 'critical').length;
    const criticalPolygon = polygonAlerts.filter(a => a.severity === 'critical').length;
    
    const protectedBadge = document.getElementById('protectedBadge');
    const polygonBadge = document.getElementById('polygonBadge');
    
    if (criticalProtected > 0) protectedBadge.classList.add('critical');
    else protectedBadge.classList.remove('critical');
    
    if (criticalPolygon > 0) polygonBadge.classList.add('critical');
    else polygonBadge.classList.remove('critical');
}

function updateSupplierFilters() {
    // Protected alerts suppliers
    const protectedSuppliers = [...new Set(protectedAlerts.map(a => a.supplier || 'Unknown'))];
    const protectedSelect = document.getElementById('protectedSupplierFilter');
    if (protectedSelect) {
        protectedSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            protectedSuppliers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }
    
    // Polygon alerts suppliers
    const polygonSuppliers = [...new Set(polygonAlerts.map(a => a.supplier || 'Unknown'))];
    const polygonSelect = document.getElementById('polygonSupplierFilter');
    if (polygonSelect) {
        polygonSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            polygonSuppliers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }
}

function updateStats() {
    const allAlerts = [...protectedAlerts, ...polygonAlerts];
    document.getElementById('criticalCount').textContent = allAlerts.filter(a => a.severity === 'critical').length;
    document.getElementById('highCount').textContent = allAlerts.filter(a => a.severity === 'high').length;
    document.getElementById('mediumCount').textContent = allAlerts.filter(a => a.severity === 'medium').length;
    document.getElementById('lowCount').textContent = allAlerts.filter(a => a.severity === 'low').length;
    document.getElementById('totalAlerts').textContent = allAlerts.length;
}

// ===========================================
// PROTECTED AREA FILTERS
// ===========================================
function applyProtectedFilters() {
    const severity = document.getElementById('protectedSeverityFilter')?.value || 'all';
    const supplier = document.getElementById('protectedSupplierFilter')?.value || 'all';
    const status = document.getElementById('protectedStatusFilter')?.value || 'all';
    
    filteredProtectedAlerts = protectedAlerts.filter(alert => {
        if (severity !== 'all' && alert.severity !== severity) return false;
        if (supplier !== 'all' && (alert.supplier || 'Unknown') !== supplier) return false;
        if (status !== 'all' && alert.status !== status) return false;
        return true;
    });
    
    protectedPage = 1;
    renderProtectedAlerts();
    updateProtectedPagination();
}

function renderProtectedAlerts() {
    const container = document.getElementById('protectedAlertsList');
    if (!container) return;
    
    const start = (protectedPage - 1) * rowsPerPage;
    const pageData = filteredProtectedAlerts.slice(start, start + rowsPerPage);
    
    document.getElementById('protectedAlertCount').textContent = `${filteredProtectedAlerts.length} alerts`;
    document.getElementById('protectedShowingCount').textContent = filteredProtectedAlerts.length;
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Protected Area Alerts</h3>
                <p>All farms are outside protected areas.</p>
                ${protectedAreas.length === 0 ? '<p style="font-size:12px;color:#94a3b8;margin-top:8px;">Tip: Upload a GeoJSON file in Live Mapping to define protected areas.</p>' : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageData.map(alert => `
        <div class="alert-item ${alert.status}" onclick="viewAlertOnMap('${alert.id}')">
            <div class="alert-header">
                <div class="alert-severity ${alert.severity}">
                    <i class="fas ${getSeverityIcon(alert.severity)}"></i>
                </div>
                <div class="alert-title">${escapeHtml(alert.title)}</div>
                <span class="alert-type-badge protected_overlap">Protected Overlap</span>
                <span class="alert-badge ${alert.status}">${alert.status}</span>
                <div class="alert-date">${formatDate(alert.date)}</div>
            </div>
            <div class="alert-details">
                <p>${escapeHtml(alert.description)}</p>
                <p><strong>Supplier:</strong> ${escapeHtml(alert.supplier || 'N/A')} • <strong>Cooperative:</strong> ${escapeHtml(alert.cooperative || 'N/A')}</p>
                <p><strong>Protected Area:</strong> ${escapeHtml(alert.protectedArea?.name || 'Unnamed')}</p>
            </div>
            <div class="alert-actions">
                <button class="action-btn view-map" onclick="event.stopPropagation(); viewAlertOnMap('${alert.id}')">
                    <i class="fas fa-map-marker-alt"></i> View on Map
                </button>
                ${alert.status === 'new' ? `
                    <button class="action-btn acknowledge" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'acknowledged')">
                        <i class="fas fa-check"></i> Acknowledge
                    </button>
                    <button class="action-btn resolve" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'resolved')">
                        <i class="fas fa-check-double"></i> Resolve
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateProtectedPagination() {
    const totalPages = Math.ceil(filteredProtectedAlerts.length / rowsPerPage);
    document.getElementById('protectedPageInfo').textContent = `Page ${protectedPage} of ${totalPages || 1}`;
    document.getElementById('protectedPrevBtn').disabled = protectedPage === 1;
    document.getElementById('protectedNextBtn').disabled = protectedPage === totalPages || totalPages === 0;
}

window.protectedPrevPage = function() {
    if (protectedPage > 1) { protectedPage--; renderProtectedAlerts(); updateProtectedPagination(); }
};

window.protectedNextPage = function() {
    const total = Math.ceil(filteredProtectedAlerts.length / rowsPerPage);
    if (protectedPage < total) { protectedPage++; renderProtectedAlerts(); updateProtectedPagination(); }
};

function clearProtectedFilters() {
    document.getElementById('protectedSeverityFilter').value = 'all';
    document.getElementById('protectedSupplierFilter').value = 'all';
    document.getElementById('protectedStatusFilter').value = 'all';
    applyProtectedFilters();
}

function markProtectedRead() {
    if (confirm('Mark all new protected area alerts as acknowledged?')) {
        filteredProtectedAlerts.forEach(a => { if (a.status === 'new') a.status = 'acknowledged'; });
        protectedAlerts.forEach(a => { if (a.status === 'new') a.status = 'acknowledged'; });
        renderProtectedAlerts();
        updateBadges();
        showNotification('All protected area alerts marked as acknowledged', 'success');
    }
}

// ===========================================
// POLYGON QUALITY FILTERS
// ===========================================
function applyPolygonFilters() {
    const type = document.getElementById('polygonTypeFilter')?.value || 'all';
    const severity = document.getElementById('polygonSeverityFilter')?.value || 'all';
    const supplier = document.getElementById('polygonSupplierFilter')?.value || 'all';
    const status = document.getElementById('polygonStatusFilter')?.value || 'all';
    
    filteredPolygonAlerts = polygonAlerts.filter(alert => {
        if (type !== 'all' && alert.type !== type) return false;
        if (severity !== 'all' && alert.severity !== severity) return false;
        if (supplier !== 'all' && (alert.supplier || 'Unknown') !== supplier) return false;
        if (status !== 'all' && alert.status !== status) return false;
        return true;
    });
    
    polygonPage = 1;
    renderPolygonAlerts();
    updatePolygonPagination();
}

function renderPolygonAlerts() {
    const container = document.getElementById('polygonAlertsList');
    if (!container) return;
    
    const start = (polygonPage - 1) * rowsPerPage;
    const pageData = filteredPolygonAlerts.slice(start, start + rowsPerPage);
    
    document.getElementById('polygonAlertCount').textContent = `${filteredPolygonAlerts.length} alerts`;
    document.getElementById('polygonShowingCount').textContent = filteredPolygonAlerts.length;
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Polygon Quality Alerts</h3>
                <p>All polygons pass quality checks.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageData.map(alert => `
        <div class="alert-item ${alert.status}" onclick="viewAlertOnMap('${alert.id}')">
            <div class="alert-header">
                <div class="alert-severity ${alert.severity}">
                    <i class="fas ${getSeverityIcon(alert.severity)}"></i>
                </div>
                <div class="alert-title">${escapeHtml(alert.title)}</div>
                <span class="alert-type-badge ${alert.type}">${getTypeLabel(alert.type)}</span>
                <span class="alert-badge ${alert.status}">${alert.status}</span>
                <div class="alert-date">${formatDate(alert.date)}</div>
            </div>
            <div class="alert-details">
                <p>${escapeHtml(alert.description)}</p>
                <p><strong>Supplier:</strong> ${escapeHtml(alert.supplier || 'N/A')} • <strong>Cooperative:</strong> ${escapeHtml(alert.cooperative || 'N/A')}</p>
            </div>
            <div class="alert-actions">
                <button class="action-btn view-map" onclick="event.stopPropagation(); viewAlertOnMap('${alert.id}')">
                    <i class="fas fa-map-marker-alt"></i> View on Map
                </button>
                ${alert.status === 'new' ? `
                    <button class="action-btn acknowledge" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'acknowledged')">
                        <i class="fas fa-check"></i> Acknowledge
                    </button>
                    <button class="action-btn resolve" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'resolved')">
                        <i class="fas fa-check-double"></i> Resolve
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updatePolygonPagination() {
    const totalPages = Math.ceil(filteredPolygonAlerts.length / rowsPerPage);
    document.getElementById('polygonPageInfo').textContent = `Page ${polygonPage} of ${totalPages || 1}`;
    document.getElementById('polygonPrevBtn').disabled = polygonPage === 1;
    document.getElementById('polygonNextBtn').disabled = polygonPage === totalPages || totalPages === 0;
}

window.polygonPrevPage = function() {
    if (polygonPage > 1) { polygonPage--; renderPolygonAlerts(); updatePolygonPagination(); }
};

window.polygonNextPage = function() {
    const total = Math.ceil(filteredPolygonAlerts.length / rowsPerPage);
    if (polygonPage < total) { polygonPage++; renderPolygonAlerts(); updatePolygonPagination(); }
};

function clearPolygonFilters() {
    document.getElementById('polygonTypeFilter').value = 'all';
    document.getElementById('polygonSeverityFilter').value = 'all';
    document.getElementById('polygonSupplierFilter').value = 'all';
    document.getElementById('polygonStatusFilter').value = 'all';
    applyPolygonFilters();
}

function markPolygonRead() {
    if (confirm('Mark all new polygon quality alerts as acknowledged?')) {
        filteredPolygonAlerts.forEach(a => { if (a.status === 'new') a.status = 'acknowledged'; });
        polygonAlerts.forEach(a => { if (a.status === 'new') a.status = 'acknowledged'; });
        renderPolygonAlerts();
        updateBadges();
        showNotification('All polygon quality alerts marked as acknowledged', 'success');
    }
}

// ===========================================
// TAB SWITCHING
// ===========================================
window.switchTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tab + 'Tab');
    });
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================
function getSeverityIcon(severity) {
    const icons = { critical: 'fa-skull-crossbones', high: 'fa-exclamation-triangle', medium: 'fa-exclamation', low: 'fa-info-circle' };
    return icons[severity] || 'fa-bell';
}

function getTypeLabel(type) {
    const labels = { 
        overlap: 'Overlap', 
        duplicate: 'Duplicate', 
        self_intersection: 'Self-Intersection', 
        protected_overlap: 'Protected Overlap' 
    };
    return labels[type] || type;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / 3600000);
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
}

function convertCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    if (coords.length === 2 && typeof coords[0] === 'number') return [coords[1], coords[0]];
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => ring.map(point => [point[1], point[0]]));
    }
    return coords;
}

// ===========================================
// VIEW ALERT ON MAP
// ===========================================
window.viewAlertOnMap = function(alertId) {
    const allAlerts = [...protectedAlerts, ...polygonAlerts];
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) {
        showNotification('Alert not found', 'error');
        return;
    }
    
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();
    
    const severityColors = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    if (alert.type === 'overlap' && alert.farm1 && alert.farm2) {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header" style="background: linear-gradient(135deg, ${severityColors[alert.severity]}, #7f1d1d);">
                    <h3><i class="fas fa-exclamation-triangle"></i> Overlap Analysis - ${alert.severity.toUpperCase()}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Overlap Area:</div><div class="modal-value">${alert.overlapArea?.toFixed(2)} ha</div></div>
                        <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value"><span class="alert-badge ${alert.status}">${alert.status}</span></div></div>
                    </div>
                    <div class="two-farm-layout">
                        <div class="farm-card">
                            <h4><i class="fas fa-tractor"></i> Farm 1: ${escapeHtml(alert.farm1.farmer_name)}</h4>
                            <div><strong>Supplier:</strong> ${escapeHtml(alert.farm1.supplier || 'N/A')}</div>
                            <div><strong>Cooperative:</strong> ${escapeHtml(alert.farm1.cooperative || 'N/A')}</div>
                            <div><strong>Area:</strong> ${(alert.farm1.area || 0).toFixed(2)} ha</div>
                        </div>
                        <div class="farm-card">
                            <h4><i class="fas fa-tractor"></i> Farm 2: ${escapeHtml(alert.farm2.farmer_name)}</h4>
                            <div><strong>Supplier:</strong> ${escapeHtml(alert.farm2.supplier || 'N/A')}</div>
                            <div><strong>Cooperative:</strong> ${escapeHtml(alert.farm2.cooperative || 'N/A')}</div>
                            <div><strong>Area:</strong> ${(alert.farm2.area || 0).toFixed(2)} ha</div>
                        </div>
                    </div>
                    <div id="alertMap"></div>
                    <div class="modal-actions">
                        ${alert.status === 'new' ? `
                            <button class="modal-btn acknowledge" onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()">
                                <i class="fas fa-check"></i> Acknowledge
                            </button>
                            <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()">
                                <i class="fas fa-check-double"></i> Resolve
                            </button>
                        ` : ''}
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
    } else if (alert.type === 'protected_overlap' && alert.farm) {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header" style="background: linear-gradient(135deg, ${severityColors[alert.severity]}, #7f1d1d);">
                    <h3><i class="fas fa-shield-alt"></i> Protected Area Overlap - ${alert.severity.toUpperCase()}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Overlap Area:</div><div class="modal-value">${alert.overlapArea?.toFixed(2)} ha</div></div>
                        <div class="modal-row"><div class="modal-label">Protected Area:</div><div class="modal-value">${escapeHtml(alert.protectedArea?.name || 'Unnamed')}</div></div>
                        <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value"><span class="alert-badge ${alert.status}">${alert.status}</span></div></div>
                    </div>
                    <div class="farm-card">
                        <h4><i class="fas fa-tractor"></i> Farm: ${escapeHtml(alert.farm.farmer_name)}</h4>
                        <div><strong>Supplier:</strong> ${escapeHtml(alert.farm.supplier || 'N/A')}</div>
                        <div><strong>Cooperative:</strong> ${escapeHtml(alert.farm.cooperative || 'N/A')}</div>
                        <div><strong>Area:</strong> ${(alert.farm.area || 0).toFixed(2)} ha</div>
                        <div><strong>Overlap:</strong> ${alert.overlapArea?.toFixed(2)} ha</div>
                    </div>
                    <div id="alertMap"></div>
                    <div class="modal-actions">
                        ${alert.status === 'new' ? `
                            <button class="modal-btn acknowledge" onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()">
                                <i class="fas fa-check"></i> Acknowledge
                            </button>
                            <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()">
                                <i class="fas fa-check-double"></i> Resolve
                            </button>
                        ` : ''}
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-map-marker-alt"></i> Alert Details</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div id="alertMap"></div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const mapContainer = document.getElementById('alertMap');
        if (mapContainer) {
            if (currentMap) currentMap.remove();
            
            currentMap = L.map('alertMap').setView([7.539989, -5.547080], 14);
            L.control.zoom({ position: 'topright' }).addTo(currentMap);
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 22, subdomains: ['mt0','mt1','mt2','mt3']
            }).addTo(currentMap);
            
            let bounds = null;
            
            if (alert.type === 'overlap') {
                if (alert.farm1?.geometry?.coordinates) {
                    const coords = convertCoords(alert.farm1.geometry.coordinates);
                    const poly = L.polygon(coords, { color: '#22c55e', weight: 3, fillColor: '#22c55e', fillOpacity: 0.3 }).addTo(currentMap);
                    if (poly.getBounds && poly.getBounds().isValid()) bounds = bounds ? bounds.extend(poly.getBounds()) : poly.getBounds();
                }
                
                if (alert.farm2?.geometry?.coordinates) {
                    const coords = convertCoords(alert.farm2.geometry.coordinates);
                    const poly = L.polygon(coords, { color: '#f97316', weight: 3, fillColor: '#f97316', fillOpacity: 0.3 }).addTo(currentMap);
                    if (poly.getBounds && poly.getBounds().isValid()) bounds = bounds ? bounds.extend(poly.getBounds()) : poly.getBounds();
                }
                
                if (alert.intersectionGeo) {
                    const overlapCoords = convertCoords(alert.intersectionGeo);
                    L.polygon(overlapCoords, { color: '#dc2626', weight: 4, fillColor: '#dc2626', fillOpacity: 0.6 }).addTo(currentMap);
                }
            } else if (alert.type === 'protected_overlap' && alert.farm?.geometry?.coordinates) {
                // Show farm polygon in red
                const coords = convertCoords(alert.farm.geometry.coordinates);
                const poly = L.polygon(coords, { 
                    color: '#dc2626', 
                    weight: 3, 
                    fillColor: '#dc2626', 
                    fillOpacity: 0.4 
                }).addTo(currentMap);
                if (poly.getBounds && poly.getBounds().isValid()) bounds = poly.getBounds();
                
                // Show protected area with dashed border
                if (alert.protectedArea?.geometry) {
                    let areaCoords;
                    if (alert.protectedArea.geometry.type === 'Polygon') {
                        areaCoords = convertCoords([alert.protectedArea.geometry.coordinates]);
                    } else {
                        areaCoords = convertCoords(alert.protectedArea.geometry.coordinates);
                    }
                    L.polygon(areaCoords, { 
                        color: '#8B4513', 
                        weight: 2, 
                        fillColor: '#8B4513', 
                        fillOpacity: 0.15,
                        dashArray: '5,5'
                    }).addTo(currentMap);
                    
                    // Add label for protected area
                    const center = turf.center(alert.protectedArea.geometry);
                    if (center) {
                        L.marker([center.geometry.coordinates[1], center.geometry.coordinates[0]], {
                            icon: L.divIcon({
                                className: 'protected-label',
                                html: `<div style="background:rgba(139,69,19,0.8);color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${escapeHtml(alert.protectedArea.name || 'Protected')}</div>`,
                                iconSize: [100, 20],
                                iconAnchor: [50, 10]
                            })
                        }).addTo(currentMap);
                    }
                }
            } else if (alert.farm?.geometry?.coordinates) {
                const coords = convertCoords(alert.farm.geometry.coordinates);
                const poly = L.polygon(coords, { color: '#eab308', weight: 3, fillColor: '#eab308', fillOpacity: 0.3 }).addTo(currentMap);
                if (poly.getBounds && poly.getBounds().isValid()) bounds = poly.getBounds();
            }
            
            if (bounds && bounds.isValid()) {
                currentMap.fitBounds(bounds, { padding: [50, 50] });
            } else {
                currentMap.setView([7.539989, -5.547080], 7);
            }
            
            L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
        }
    }, 150);
};

// ===========================================
// UPDATE ALERT STATUS
// ===========================================
window.updateAlertStatus = function(alertId, newStatus) {
    const allAlerts = [...protectedAlerts, ...polygonAlerts];
    const alert = allAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.status = newStatus;
        // Update in both arrays
        const pAlert = protectedAlerts.find(a => a.id === alertId);
        if (pAlert) pAlert.status = newStatus;
        const poAlert = polygonAlerts.find(a => a.id === alertId);
        if (poAlert) poAlert.status = newStatus;
        
        applyProtectedFilters();
        applyPolygonFilters();
        updateBadges();
        showNotification(`Alert marked as ${newStatus}`, 'success');
    }
};

// ===========================================
// REFRESH FUNCTIONS
// ===========================================
function refreshProtectedAlerts() {
    if (currentProject) {
        showLoading(true);
        Promise.all([
            loadFarms(currentProject.id),
            loadProtectedAreas(currentProject.id)
        ]).then(() => {
            generateAlerts();
            showLoading(false);
        });
    }
}

function refreshPolygonAlerts() {
    if (currentProject) {
        showLoading(true);
        Promise.all([
            loadFarms(currentProject.id),
            loadProtectedAreas(currentProject.id)
        ]).then(() => {
            generateAlerts();
            showLoading(false);
        });
    }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================
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

function setupEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        if (currentProject) {
            showLoading(true);
            Promise.all([
                loadFarms(currentProject.id),
                loadProtectedAreas(currentProject.id)
            ]).then(() => {
                generateAlerts();
                showLoading(false);
            });
        }
    });
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

// Make functions global
window.applyProtectedFilters = applyProtectedFilters;
window.applyPolygonFilters = applyPolygonFilters;
window.clearProtectedFilters = clearProtectedFilters;
window.clearPolygonFilters = clearPolygonFilters;
window.markProtectedRead = markProtectedRead;
window.markPolygonRead = markPolygonRead;
window.viewAlertOnMap = viewAlertOnMap;
window.updateAlertStatus = updateAlertStatus;
window.refreshProtectedAlerts = refreshProtectedAlerts;
window.refreshPolygonAlerts = refreshPolygonAlerts;
window.switchTab = switchTab;
window.protectedPrevPage = protectedPrevPage;
window.protectedNextPage = protectedNextPage;
window.polygonPrevPage = polygonPrevPage;
window.polygonNextPage = polygonNextPage;

console.log('✅ Quality Alerts page ready');
