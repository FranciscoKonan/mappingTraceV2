// ===========================================
// QUALITY ALERTS - COMPLETE WITH CORRECT SUPABASE
// ===========================================

console.log('🚀 Quality Alerts page initializing...');

// ===========================================
// SUPABASE CONFIGURATION - CORRECT URL
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
let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let rowsPerPage = 10;
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
        
        // Update header title
        document.querySelector('.header-title h1').innerHTML = `Quality Alerts <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px; margin-left:10px;">${currentProject.name}</span>`;
        
        // Load farms and generate alerts
        await loadFarms(currentProject.id);
        localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
        
        // Update URL
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
                await loadAllProjectsFarms();
            } else {
                const selected = allUserProjects.find(p => p.projects.id === value);
                if (selected) {
                    currentProject = selected.projects;
                    await loadFarms(value);
                    localStorage.setItem(`lastProject_${currentUser.id}`, value);
                    document.querySelector('.header-title h1').innerHTML = `Quality Alerts <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px; margin-left:10px;">${currentProject.name}</span>`;
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

async function loadAllProjectsFarms() {
    showLoading(true);
    
    let allFarmsData = [];
    for (const m of allUserProjects) {
        const { data: farms } = await supabaseClient
            .from('farms')
            .select('*')
            .eq('project_id', m.projects.id);
        if (farms) allFarmsData = [...allFarmsData, ...farms];
    }
    
    processFarmsData(allFarmsData);
    
    document.querySelector('.header-title h1').innerHTML = 'Quality Alerts <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px; margin-left:10px;">ALL PROJECTS</span>';
    
    showLoading(false);
}

async function loadFarms(projectId) {
    showLoading(true);
    
    const { data: farms, error } = await supabaseClient
        .from('farms')
        .select('*')
        .eq('project_id', projectId);
    
    if (error) {
        console.error('Error loading farms:', error);
        showNotification('Error loading farms', 'error');
        allFarms = [];
    } else {
        processFarmsData(farms || []);
    }
    
    showLoading(false);
}

function processFarmsData(farms) {
    allFarms = (farms || []).map(farm => ({
        id: farm.id,
        farmer_id: farm.farmer_id || farm.id.slice(0,8),
        farmer_name: farm.farmer_name || 'Unknown Farmer',
        farmerName: farm.farmer_name || 'Unknown Farmer',
        cooperative: farm.cooperative || 'Unassigned',
        supplier: farm.supplier || 'Unknown',
        area: parseFloat(farm.area) || 0,
        status: farm.status || 'pending',
        geometry: farm.geometry,
        created_at: farm.created_at
    }));
    
    generateAlerts();
    updateFilterOptions();
    applyFilters();
    
    showNotification(`Loaded ${allFarms.length} farms, found ${allAlerts.length} alerts`, 
                    allAlerts.length > 0 ? 'warning' : 'success');
}

function generateAlerts() {
    console.log('🔍 Generating quality alerts...');
    const alerts = [];
    
    const farmsWithGeo = allFarms.filter(f => f.geometry && f.geometry.coordinates);
    
    // Detect overlaps
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
                            
                            alerts.push({
                                id: `overlap_${farm1.id}_${farm2.id}`,
                                type: 'overlap',
                                severity: severity,
                                title: `${severity.toUpperCase()} Overlap Detected`,
                                description: `Farm "${farm1.farmer_name}" overlaps with "${farm2.farmer_name}" by ${overlapAreaHa.toFixed(2)} ha`,
                                farm1: farm1,
                                farm2: farm2,
                                overlapArea: overlapAreaHa,
                                intersectionGeo: intersection.geometry.coordinates,
                                supplier: farm1.supplier,
                                cooperative: farm1.cooperative,
                                status: 'new',
                                date: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch(e) {
                console.warn('Error checking overlap:', e);
            }
        }
    }
    
    // Check for missing geometry
    allFarms.forEach(farm => {
        if (!farm.geometry && farm.status !== 'rejected') {
            alerts.push({
                id: `missing_geom_${farm.id}`,
                type: 'data',
                severity: 'high',
                title: 'Missing Geometry Data',
                description: `Farm "${farm.farmer_name}" has no geometry data.`,
                farm: farm,
                supplier: farm.supplier,
                cooperative: farm.cooperative,
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    allAlerts = alerts;
    console.log(`✅ Generated ${alerts.length} alerts`);
}

function updateFilterOptions() {
    const suppliers = [...new Set(allAlerts.map(a => a.supplier || 'Unknown'))];
    const supplierSelect = document.getElementById('supplierFilter');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            suppliers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }
}

function applyFilters() {
    const type = document.getElementById('alertTypeFilter')?.value || 'all';
    const severity = document.getElementById('severityFilter')?.value || 'all';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredAlerts = allAlerts.filter(alert => {
        if (type !== 'all' && alert.type !== type) return false;
        if (severity !== 'all' && alert.severity !== severity) return false;
        if (supplier !== 'all' && (alert.supplier || 'Unknown') !== supplier) return false;
        if (status !== 'all' && alert.status !== status) return false;
        return true;
    });
    
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    filteredAlerts.sort((a, b) => {
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    updateStats();
    currentPage = 1;
    renderAlerts();
    updatePagination();
}

function updateStats() {
    document.getElementById('criticalCount').textContent = filteredAlerts.filter(a => a.severity === 'critical').length;
    document.getElementById('highCount').textContent = filteredAlerts.filter(a => a.severity === 'high').length;
    document.getElementById('mediumCount').textContent = filteredAlerts.filter(a => a.severity === 'medium').length;
    document.getElementById('lowCount').textContent = filteredAlerts.filter(a => a.severity === 'low').length;
    document.getElementById('totalAlerts').textContent = filteredAlerts.length;
    document.getElementById('showingCount').textContent = filteredAlerts.length;
}

function renderAlerts() {
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredAlerts.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Quality Alerts</h3>
                <p>All farms meet quality standards.</p>
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

function updatePagination() {
    const totalPages = Math.ceil(filteredAlerts.length / rowsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function getSeverityIcon(severity) {
    const icons = { critical: 'fa-skull-crossbones', high: 'fa-exclamation-triangle', medium: 'fa-exclamation', low: 'fa-info-circle' };
    return icons[severity] || 'fa-bell';
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

window.viewAlertOnMap = function(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
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
            
            if (alert.type === 'overlap') {
                let bounds = null;
                
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
                
                if (bounds && bounds.isValid()) currentMap.fitBounds(bounds, { padding: [50, 50] });
            } else if (alert.farm?.geometry?.coordinates) {
                const coords = convertCoords(alert.farm.geometry.coordinates);
                const poly = L.polygon(coords, { color: '#eab308', weight: 3, fillColor: '#eab308', fillOpacity: 0.3 }).addTo(currentMap);
                if (poly.getBounds && poly.getBounds().isValid()) currentMap.fitBounds(poly.getBounds(), { padding: [50, 50] });
            }
            
            L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
        }
    }, 150);
};

window.updateAlertStatus = function(alertId, newStatus) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.status = newStatus;
        applyFilters();
        showNotification(`Alert marked as ${newStatus}`, 'success');
    }
};

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
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('alertTypeFilter').value = 'all';
        document.getElementById('severityFilter').value = 'all';
        document.getElementById('supplierFilter').value = 'all';
        document.getElementById('statusFilter').value = 'all';
        applyFilters();
        showNotification('Filters cleared', 'info');
    });
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadFarms(currentProject.id));
    document.getElementById('refreshListBtn')?.addEventListener('click', () => loadFarms(currentProject.id));
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        if (confirm('Mark all new alerts as acknowledged?')) {
            allAlerts.forEach(a => { if (a.status === 'new') a.status = 'acknowledged'; });
            applyFilters();
            showNotification('All alerts marked as acknowledged', 'success');
        }
    });
    document.getElementById('alertTypeFilter')?.addEventListener('change', applyFilters);
    document.getElementById('severityFilter')?.addEventListener('change', applyFilters);
    document.getElementById('supplierFilter')?.addEventListener('change', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderAlerts(); updatePagination(); } });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => { const total = Math.ceil(filteredAlerts.length / rowsPerPage); if (currentPage < total) { currentPage++; renderAlerts(); updatePagination(); } });
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

// Make functions global
window.applyFilters = applyFilters;
window.viewAlertOnMap = viewAlertOnMap;
window.updateAlertStatus = updateAlertStatus;

console.log('✅ Quality Alerts page ready');