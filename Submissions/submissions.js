// ===========================================
// SIDEBAR TOGGLE LOGIC - BURGER + COLLAPSE
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
// SUBMISSIONS - COMPLETE JAVASCRIPT
// ===========================================
console.log('🚀 Submissions page initializing...');

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
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
let rowsPerPage = 10;
let sortColumn = 'created_at';
let sortDirection = 'desc';
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
        const roleText = memberships[0].role.replace('_', ' ').toUpperCase();
        document.getElementById('userRole').textContent = roleText;
        
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
        document.getElementById('projectBadge').textContent = currentProject.name;
        
        // Update navigation links
        updateNavigationLinks();
        
        // Load submissions
        await loadSubmissions(currentProject.id);
        localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('project', currentProject.id);
        window.history.replaceState({}, '', url);
        
        // Update header title
        document.querySelector('.header-title h1').innerHTML = `Submissions <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px;">${currentProject.name}</span>`;
    }
    
    showLoading(false);
}

function updateNavigationLinks() {
    const queryString = currentProject ? `?project=${currentProject.id}` : '';
    document.querySelector('a[data-page="dashboard"]').href = `../Dashboard.html${queryString}`;
    document.querySelector('a[data-page="live-mapping"]').href = `../LiveMapping/live-mapping.html${queryString}`;
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
                await loadAllProjectsSubmissions();
            } else {
                const selected = allUserProjects.find(p => p.projects.id === value);
                if (selected) {
                    currentProject = selected.projects;
                    document.getElementById('projectBadge').textContent = currentProject.name;
                    await loadSubmissions(value);
                    localStorage.setItem(`lastProject_${currentUser.id}`, value);
                    updateNavigationLinks();
                    document.querySelector('.header-title h1').innerHTML = `Submissions <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px;">${currentProject.name}</span>`;
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

async function loadAllProjectsSubmissions() {
    showLoading(true);
    
    let allFarms = [];
    for (const m of allUserProjects) {
        const { data: farms } = await supabaseClient
            .from('farms')
            .select('*')
            .eq('project_id', m.projects.id);
        if (farms) allFarms = [...allFarms, ...farms];
    }
    
    processSubmissionsData(allFarms);
    document.querySelector('.header-title h1').innerHTML = 'Submissions <span style="font-size:14px; background:#e2e8f0; padding:2px 10px; border-radius:20px;">ALL PROJECTS</span>';
    document.getElementById('projectBadge').textContent = 'ALL PROJECTS';
    showLoading(false);
}

async function loadSubmissions(projectId) {
    showLoading(true);
    
    const { data: farms, error } = await supabaseClient
        .from('farms')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error loading submissions:', error);
        showNotification('Error loading submissions', 'error');
        allSubmissions = [];
    } else {
        processSubmissionsData(farms || []);
    }
    
    showLoading(false);
}

function processSubmissionsData(farms) {
    allSubmissions = (farms || []).map(farm => ({
        id: farm.id,
        farmer_id: farm.farmer_id || farm.id.slice(0,8),
        farmer_name: farm.farmer_name || 'Unknown Farmer',
        cooperative: farm.cooperative || 'Unassigned',
        supplier: farm.supplier || 'Unknown',
        area: parseFloat(farm.area) || 0,
        status: farm.status || 'pending',
        enumerator: farm.enumerator || 'N/A',
        created_at: farm.created_at,
        geometry: farm.geometry
    }));
    
    updateFilterOptions();
    applyFilters();
}

function updateFilterOptions() {
    const suppliers = [...new Set(allSubmissions.map(s => s.supplier).filter(Boolean))];
    const supplierSelect = document.getElementById('supplierFilter');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            suppliers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredSubmissions = allSubmissions.filter(sub => {
        if (searchTerm && !sub.farmer_name.toLowerCase().includes(searchTerm) && 
            !sub.farmer_id.toLowerCase().includes(searchTerm) &&
            !sub.cooperative.toLowerCase().includes(searchTerm)) {
            return false;
        }
        if (supplier !== 'all' && sub.supplier !== supplier) return false;
        if (status !== 'all' && sub.status !== status) return false;
        return true;
    });
    
    // Apply sorting
    filteredSubmissions.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (sortColumn === 'created_at') {
            valA = new Date(valA || 0);
            valB = new Date(valB || 0);
        } else if (sortColumn === 'area') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    updateStats();
    currentPage = 1;
    renderTable();
    updatePagination();
}

function updateStats() {
    let totalArea = 0;
    let validated = 0, pending = 0, rejected = 0;
    
    filteredSubmissions.forEach(f => {
        totalArea += f.area || 0;
        if (f.status === 'validated') validated++;
        else if (f.status === 'pending') pending++;
        else if (f.status === 'rejected') rejected++;
    });
    
    document.getElementById('totalSubmissions').textContent = filteredSubmissions.length;
    document.getElementById('validatedCount').textContent = validated;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('rejectedCount').textContent = rejected;
    document.getElementById('totalCount').textContent = filteredSubmissions.length;
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredSubmissions.slice(start, end);
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:60px;"><i class="fas fa-inbox" style="font-size:48px;color:#94a3b8;"></i><p>No submissions found</p></td></tr>';
        document.getElementById('showingCount').textContent = '0-0';
        return;
    }
    
    const role = document.getElementById('userRole').textContent.toLowerCase();
    const canModify = role === 'owner' || role === 'manager' || role === 'validator';
    
    tbody.innerHTML = pageData.map(sub => `
        <tr>
            <td><strong>${escapeHtml(sub.farmer_name)}</strong></td>
            <td>${escapeHtml(sub.farmer_id)}</td>
            <td>${escapeHtml(sub.cooperative)}</td>
            <td>${escapeHtml(sub.supplier)}</td>
            <td>${sub.area.toFixed(2)}</td>
            <td>${formatDate(sub.created_at)}</td>
            <td><span class="status-badge ${sub.status}">${sub.status}</span></td>
            <td class="action-buttons">
                <button class="action-btn view-map" onclick="window.viewOnMap('${sub.id}')"><i class="fas fa-map-marker-alt"></i> View Map</button>
                ${canModify && sub.status === 'pending' ? `
                    <button class="action-btn validate" onclick="window.updateStatus('${sub.id}', 'validated')"><i class="fas fa-check"></i> Validate</button>
                    <button class="action-btn reject" onclick="window.updateStatus('${sub.id}', 'rejected')"><i class="fas fa-times"></i> Reject</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
    
    document.getElementById('showingCount').textContent = `${start + 1}-${Math.min(end, filteredSubmissions.length)}`;
}

function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    if (pageNumbers) {
        let pagesHtml = '';
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pagesHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="window.goToPage(${i})">${i}</button>`;
        }
        pageNumbers.innerHTML = pagesHtml;
    }
}

window.goToPage = function(page) {
    currentPage = page;
    renderTable();
    updatePagination();
};

window.sortTable = function(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    applyFilters();
};

function convertCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    if (coords.length === 2 && typeof coords[0] === 'number') return [coords[1], coords[0]];
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => ring.map(point => [point[1], point[0]]));
    }
    return coords;
}

window.viewOnMap = async function(submissionId) {
    const submission = allSubmissions.find(s => s.id === submissionId);
    if (!submission || !submission.geometry) {
        showNotification('No map data available', 'warning');
        return;
    }
    
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();
    
    const statusColor = submission.status === 'validated' ? '#22c55e' : 
                        submission.status === 'pending' ? '#eab308' : '#ef4444';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-map-marked-alt"></i> Farm Location - ${escapeHtml(submission.farmer_name)}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-info-circle"></i> Farm Information</div>
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Farmer Name:</div><div class="modal-value">${escapeHtml(submission.farmer_name)}</div></div>
                        <div class="modal-row"><div class="modal-label">Farmer ID:</div><div class="modal-value">${escapeHtml(submission.farmer_id)}</div></div>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(submission.cooperative)}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(submission.supplier)}</div></div>
                        <div class="modal-row"><div class="modal-label">Area:</div><div class="modal-value">${submission.area.toFixed(2)} ha</div></div>
                        <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value"><span class="status-badge ${submission.status}">${submission.status}</span></div></div>
                        <div class="modal-row"><div class="modal-label">Submission Date:</div><div class="modal-value">${formatDate(submission.created_at)}</div></div>
                    </div>
                </div>
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-draw-polygon"></i> Farm Boundary</div>
                    <div id="submissionMap"></div>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const mapContainer = document.getElementById('submissionMap');
        if (mapContainer && submission.geometry) {
            if (currentMap) currentMap.remove();
            currentMap = L.map('submissionMap').setView([7.539989, -5.547080], 14);
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 22, subdomains: ['mt0','mt1','mt2','mt3']
            }).addTo(currentMap);
            
            const coords = convertCoords(submission.geometry.coordinates);
            const polygon = L.polygon(coords, {
                color: statusColor, weight: 3, fillColor: statusColor, fillOpacity: 0.4
            }).addTo(currentMap);
            if (polygon.getBounds && polygon.getBounds().isValid()) {
                currentMap.fitBounds(polygon.getBounds(), { padding: [50, 50] });
            }
            polygon.bindPopup(`<b>${escapeHtml(submission.farmer_name)}</b><br>Area: ${submission.area.toFixed(2)} ha<br>Status: ${submission.status}`);
        }
    }, 100);
};

window.updateStatus = async function(submissionId, newStatus) {
    if (!confirm(`Mark this submission as ${newStatus}?`)) return;
    showLoading(true);
    try {
        await supabaseClient
            .from('farms')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', submissionId);
        showNotification(`Submission marked as ${newStatus}`, 'success');
        await loadSubmissions(currentProject.id);
    } catch (error) {
        showNotification('Error updating status', 'error');
    }
    showLoading(false);
};

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / 3600000);
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
}

function canExport() {
    const roleText = document.getElementById('userRole')?.textContent?.toLowerCase() || '';
    const allowedRoles = ['owner', 'manager', 'validator'];
    return allowedRoles.includes(roleText);
}

function exportToCSV() {
    if (!canExport()) {
        showNotification('Export permission denied. Only Owners, Managers, and Validators can export data.', 'error');
        return;
    }
    
    if (filteredSubmissions.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    const headers = ['Farmer Name', 'Farmer ID', 'Cooperative', 'Supplier', 'Area (ha)', 'Status', 'Submission Date'];
    const rows = filteredSubmissions.map(sub => [
        sub.farmer_name,
        sub.farmer_id,
        sub.cooperative,
        sub.supplier,
        sub.area.toFixed(2),
        sub.status,
        sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'N/A'
    ]);
    
    const csvContent = [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `submissions_${currentProject?.name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Use FileSaver or fallback
    if (typeof saveAs !== 'undefined') {
        saveAs(blob, filename);
    } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
    
    showNotification(`Exported ${filteredSubmissions.length} records to CSV`, 'success');
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('supplierFilter').value = 'all';
    document.getElementById('statusFilter').value = 'all';
    applyFilters();
    showNotification('Filters cleared', 'info');
}

function refreshData() {
    if (currentProject) {
        loadSubmissions(currentProject.id);
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function setupEventListeners() {
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    document.getElementById('exportBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('refreshTableBtn')?.addEventListener('click', refreshData);
    document.getElementById('syncKoboBtn')?.addEventListener('click', () => {
        showNotification('Refreshing data...', 'info');
        refreshData();
    });
    
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); updatePagination(); }
    });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
        if (currentPage < totalPages) { currentPage++; renderTable(); updatePagination(); }
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

// Make functions global for inline onclick handlers
window.applyFilters = applyFilters;
window.sortTable = sortTable;
window.viewOnMap = viewOnMap;
window.updateStatus = updateStatus;
window.exportToCSV = exportToCSV;
window.clearFilters = clearFilters;
window.refreshData = refreshData;
window.goToPage = goToPage;

console.log('✅ Submissions page ready');
