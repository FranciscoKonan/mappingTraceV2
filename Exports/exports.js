// ===========================================
// EXPORTS - COMPLETE WITH VALIDATOR PERMISSION
// ===========================================

console.log('🚀 Exports page initializing...');

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
let filteredFarms = [];
let selectedSuppliers = new Set();
let selectedCooperatives = new Set();
let selectedStatuses = new Set(['validated', 'pending', 'rejected']);
let exportFormat = 'csv';
let allSuppliers = [];
let allCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';

// ===========================================
// PERMISSION CHECK FUNCTIONS
// ===========================================
function getUserRole() {
    const roleText = document.getElementById('userRole')?.textContent?.toLowerCase() || '';
    // Handle both formats: "OWNER" and "owner"
    const role = roleText.toLowerCase();
    return role;
}

function canExport() {
    const role = getUserRole();
    // Allow owners, managers, and validators to export
    const allowedRoles = ['owner', 'manager', 'validator'];
    const hasPermission = allowedRoles.includes(role);
    
    if (!hasPermission) {
        console.log(`Export denied: User role "${role}" does not have export permission`);
    }
    
    return hasPermission;
}

function canPreview() {
    const role = getUserRole();
    const allowedRoles = ['owner', 'manager', 'validator'];
    return allowedRoles.includes(role);
}

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📌 DOM Content Loaded');
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await loadUserAndProjects();
    setupDropdown();
    setupEventListeners();
    updateExportUIByRole();
});

function updateExportUIByRole() {
    const hasPermission = canExport();
    const exportBtn = document.getElementById('exportBtn');
    const previewBtn = document.getElementById('previewBtn');
    
    if (!hasPermission) {
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.5';
            exportBtn.style.cursor = 'not-allowed';
            exportBtn.title = 'Export permission denied. Only Owners, Managers, and Validators can export data.';
        }
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.style.opacity = '0.5';
            previewBtn.style.cursor = 'not-allowed';
            previewBtn.title = 'Preview permission denied. Only Owners, Managers, and Validators can preview data.';
        }
        showNotification('Export access: Owners, Managers, and Validators only', 'info');
    } else {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.style.opacity = '1';
            exportBtn.style.cursor = 'pointer';
            exportBtn.title = 'Export data';
        }
        if (previewBtn) {
            previewBtn.disabled = false;
            previewBtn.style.opacity = '1';
            previewBtn.style.cursor = 'pointer';
            previewBtn.title = 'Preview data';
        }
    }
}

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
        const userRole = memberships[0].role.replace('_', ' ').toUpperCase();
        document.getElementById('userRole').textContent = userRole;
        
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
        document.querySelector('.header-title h1').innerHTML = `Exports <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px; margin-left:10px;">${currentProject.name}</span>`;
        
        await loadFarms(currentProject.id);
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
                await loadAllProjectsFarms();
            } else {
                const selected = allUserProjects.find(p => p.projects.id === value);
                if (selected) {
                    currentProject = selected.projects;
                    await loadFarms(value);
                    localStorage.setItem(`lastProject_${currentUser.id}`, value);
                    document.querySelector('.header-title h1').innerHTML = `Exports <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px; margin-left:10px;">${currentProject.name}</span>`;
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
    document.querySelector('.header-title h1').innerHTML = 'Exports <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px; margin-left:10px;">ALL PROJECTS</span>';
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
        farm_id: farm.farmer_id || farm.id.slice(0,8),
        farmer_name: farm.farmer_name || 'Unknown Farmer',
        supplier: farm.supplier || 'Unknown',
        cooperative: farm.cooperative || 'Unassigned',
        area: parseFloat(farm.area) || 0,
        status: farm.status || 'pending',
        created_at: farm.created_at,
        geometry: farm.geometry
    }));
    
    allSuppliers = [...new Set(allFarms.map(f => f.supplier).filter(Boolean))].sort();
    allCooperatives = [...new Set(allFarms.map(f => f.cooperative).filter(Boolean))].sort();
    
    updateStats();
    populateFilters();
    updateExportCount();
    updateExportUIByRole();
    showLoading(false);
}

function updateStats() {
    document.getElementById('totalFarms').textContent = allFarms.length;
    const totalArea = allFarms.reduce((sum, f) => sum + (f.area || 0), 0);
    document.getElementById('totalArea').textContent = `${totalArea.toFixed(1)} ha`;
    document.getElementById('validatedCount').textContent = allFarms.filter(f => f.status === 'validated').length;
    document.getElementById('pendingCount').textContent = allFarms.filter(f => f.status === 'pending').length;
    document.getElementById('rejectedCount').textContent = allFarms.filter(f => f.status === 'rejected').length;
}

function populateFilters() {
    selectedSuppliers = new Set(allSuppliers);
    selectedCooperatives = new Set(allCooperatives);
    
    updateSupplierList();
    updateCooperativeList();
    
    document.getElementById('selectAllSuppliers')?.addEventListener('click', () => toggleAll('supplier', true));
    document.getElementById('selectAllCooperatives')?.addEventListener('click', () => toggleAll('cooperative', true));
    
    document.querySelectorAll('.status-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedStatuses.add(e.target.value);
            else selectedStatuses.delete(e.target.value);
            updateSelectedFilters();
        });
    });
    
    document.querySelectorAll('.format-option').forEach(opt => {
        opt.addEventListener('click', () => selectFormat(opt.dataset.format));
    });
    
    document.getElementById('supplierSearch')?.addEventListener('input', (e) => {
        supplierSearchTerm = e.target.value.toLowerCase();
        updateSupplierList();
    });
    
    document.getElementById('coopSearch')?.addEventListener('input', (e) => {
        coopSearchTerm = e.target.value.toLowerCase();
        updateCooperativeList();
    });
}

function updateSupplierList() {
    const container = document.getElementById('supplierList');
    if (!container) return;
    
    const filtered = allSuppliers.filter(s => s.toLowerCase().includes(supplierSearchTerm));
    if (filtered.length === 0 && supplierSearchTerm) {
        container.innerHTML = '<div class="checkbox-item" style="justify-content:center; color:#94a3b8;">No suppliers found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(supplier => `
        <label class="checkbox-item">
            <input type="checkbox" class="supplier-checkbox" value="${supplier}" ${selectedSuppliers.has(supplier) ? 'checked' : ''}>
            <span class="checkbox-label">${supplier}</span>
        </label>
    `).join('');
    
    document.querySelectorAll('.supplier-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedSuppliers.add(e.target.value);
            else selectedSuppliers.delete(e.target.value);
            updateSelectedFilters();
        });
    });
}

function updateCooperativeList() {
    const container = document.getElementById('cooperativeList');
    if (!container) return;
    
    const filtered = allCooperatives.filter(c => c.toLowerCase().includes(coopSearchTerm));
    if (filtered.length === 0 && coopSearchTerm) {
        container.innerHTML = '<div class="checkbox-item" style="justify-content:center; color:#94a3b8;">No cooperatives found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(coop => `
        <label class="checkbox-item">
            <input type="checkbox" class="cooperative-checkbox" value="${coop}" ${selectedCooperatives.has(coop) ? 'checked' : ''}>
            <span class="checkbox-label">${coop}</span>
        </label>
    `).join('');
    
    document.querySelectorAll('.cooperative-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedCooperatives.add(e.target.value);
            else selectedCooperatives.delete(e.target.value);
            updateSelectedFilters();
        });
    });
}

function toggleAll(type, checked) {
    if (type === 'supplier') {
        selectedSuppliers = checked ? new Set(allSuppliers) : new Set();
        updateSupplierList();
    } else if (type === 'cooperative') {
        selectedCooperatives = checked ? new Set(allCooperatives) : new Set();
        updateCooperativeList();
    }
    updateSelectedFilters();
}

function selectFormat(format) {
    exportFormat = format;
    document.querySelectorAll('.format-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.format === format);
    });
}

function updateSelectedFilters() {
    filteredFarms = allFarms.filter(farm => {
        if (!selectedSuppliers.has(farm.supplier)) return false;
        if (!selectedCooperatives.has(farm.cooperative)) return false;
        if (!selectedStatuses.has(farm.status)) return false;
        return true;
    });
    
    updateExportCount();
}

function updateExportCount() {
    document.getElementById('exportCount').textContent = filteredFarms.length;
    const totalArea = filteredFarms.reduce((sum, f) => sum + (f.area || 0), 0);
    document.getElementById('exportArea').textContent = `${totalArea.toFixed(2)} ha`;
}

// ===========================================
// PREVIEW FUNCTION WITH PERMISSION CHECK
// ===========================================
function previewData() {
    if (!canPreview()) {
        showNotification('Preview permission denied. Only Owners, Managers, and Validators can preview data.', 'error');
        return;
    }
    
    const previewSection = document.getElementById('previewSection');
    const previewHeader = document.getElementById('previewHeader');
    const previewBody = document.getElementById('previewBody');
    const previewTotal = document.getElementById('previewTotal');
    
    if (filteredFarms.length === 0) {
        showNotification('No farms to preview', 'warning');
        return;
    }
    
    previewHeader.innerHTML = `<tr><th>Farm ID</th><th>Farmer Name</th><th>Supplier</th><th>Cooperative</th><th>Area (ha)</th><th>Status</th><tr>`;
    previewBody.innerHTML = filteredFarms.slice(0, 10).map(farm => `
        <tr>
            <td>${farm.farm_id}</span></div></td>
            <td>${farm.farmer_name}</span></div></td>
            <td>${farm.supplier}</span></div></td>
            <td>${farm.cooperative}</span></div></td>
            <td>${farm.area.toFixed(2)}</span></div></td>
            <td><span class="status-badge ${farm.status}">${farm.status}</span></td>
        </tr>
    `).join('');
    
    previewTotal.textContent = filteredFarms.length;
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.hidePreview = function() {
    document.getElementById('previewSection').style.display = 'none';
};

// ===========================================
// EXPORT FUNCTION WITH PERMISSION CHECK
// ===========================================
function exportData() {
    if (!canExport()) {
        showNotification('Export permission denied. Only Owners, Managers, and Validators can export data.', 'error');
        return;
    }
    
    if (filteredFarms.length === 0) {
        showNotification('No farms selected for export', 'warning');
        return;
    }
    
    switch(exportFormat) {
        case 'csv': exportToCSV(); break;
        case 'excel': exportToExcel(); break;
        case 'geojson': exportToGeoJSON(); break;
        case 'kml': exportToKML(); break;
    }
}

function exportToCSV() {
    const headers = ['Farm ID', 'Farmer Name', 'Supplier', 'Cooperative', 'Area (ha)', 'Status'];
    const rows = filteredFarms.map(f => [f.farm_id, f.farmer_name, f.supplier, f.cooperative, f.area.toFixed(2), f.status]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `farms_export_${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(blob, filename);
    addToHistory(filename, filteredFarms.length, 'CSV');
    showNotification(`Exported ${filteredFarms.length} farms to CSV`, 'success');
}

function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(filteredFarms.map(f => ({
        'Farm ID': f.farm_id,
        'Farmer Name': f.farmer_name,
        'Supplier': f.supplier,
        'Cooperative': f.cooperative,
        'Area (ha)': f.area,
        'Status': f.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farms');
    const filename = `farms_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    addToHistory(filename, filteredFarms.length, 'Excel');
    showNotification(`Exported ${filteredFarms.length} farms to Excel`, 'success');
}

function exportToGeoJSON() {
    const features = filteredFarms.map(f => ({
        type: 'Feature',
        properties: {
            farm_id: f.farm_id,
            farmer_name: f.farmer_name,
            supplier: f.supplier,
            cooperative: f.cooperative,
            area: f.area,
            status: f.status
        },
        geometry: f.geometry || { type: 'Point', coordinates: [0, 0] }
    }));
    const geojson = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const filename = `farms_export_${new Date().toISOString().split('T')[0]}.geojson`;
    saveAs(blob, filename);
    addToHistory(filename, filteredFarms.length, 'GeoJSON');
    showNotification(`Exported ${filteredFarms.length} farms to GeoJSON`, 'success');
}

function exportToKML() {
    let kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Farms Export</name>`;
    kml += filteredFarms.map(f => `
        <Placemark>
            <name>${f.farmer_name}</name>
            <description>Supplier: ${f.supplier}\nCooperative: ${f.cooperative}\nArea: ${f.area} ha\nStatus: ${f.status}</description>
            <Point><coordinates>0,0</coordinates></Point>
        </Placemark>
    `).join('');
    kml += `</Document></kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const filename = `farms_export_${new Date().toISOString().split('T')[0]}.kml`;
    saveAs(blob, filename);
    addToHistory(filename, filteredFarms.length, 'KML');
    showNotification(`Exported ${filteredFarms.length} farms to KML`, 'success');
}

function addToHistory(filename, count, format) {
    const history = document.getElementById('historyList');
    if (history.querySelector('.empty-history')) history.innerHTML = '';
    const icon = format === 'CSV' ? 'file-csv' : format === 'Excel' ? 'file-excel' : 'file';
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-info">
            <div class="history-icon"><i class="fas fa-${icon}"></i></div>
            <div class="history-details">
                <div class="history-filename">${filename}</div>
                <div class="history-meta">
                    <span><i class="fas fa-layer-group"></i> ${count} farms</span>
                    <span><i class="fas fa-clock"></i> ${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
        <button class="history-download" onclick="window.open('${filename}')"><i class="fas fa-download"></i></button>
    `;
    history.insertBefore(item, history.firstChild);
    while (history.children.length > 10) history.removeChild(history.lastChild);
}

function resetFilters() {
    supplierSearchTerm = '';
    coopSearchTerm = '';
    document.getElementById('supplierSearch').value = '';
    document.getElementById('coopSearch').value = '';
    selectedSuppliers = new Set(allSuppliers);
    selectedCooperatives = new Set(allCooperatives);
    selectedStatuses = new Set(['validated', 'pending', 'rejected']);
    document.querySelectorAll('.status-checkbox').forEach(cb => cb.checked = true);
    updateSupplierList();
    updateCooperativeList();
    updateSelectedFilters();
    showNotification('Filters reset', 'success');
}

function refreshData() {
    if (currentProject) {
        loadFarms(currentProject.id);
    }
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

function setupEventListeners() {
    document.getElementById('exportBtn')?.addEventListener('click', exportData);
    document.getElementById('previewBtn')?.addEventListener('click', previewData);
    document.getElementById('resetBtn')?.addEventListener('click', resetFilters);
    document.getElementById('refreshBtn')?.addEventListener('click', refreshData);
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

console.log('✅ Exports page ready - Owners, Managers, and Validators can export data');