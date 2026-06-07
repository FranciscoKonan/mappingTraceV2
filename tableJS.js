// ===========================================
// TABLE DATA MANAGEMENT
// Supplier → Cooperative → Plots Hierarchy
// ===========================================

let currentPage = 1;
let itemsPerPage = 10;
let currentSort = { column: 'supplier', direction: 'asc' };
let filteredData = [];
let searchTerm = '';
let tableData = [];
let hierarchicalData = [];

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Debounce function for search input
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize table
 */
function initTable() {
    console.log('📊 Initializing hierarchical table...');
    loadTableData();
    setupSearchAndFilters();
}

/**
 * Setup search and filter event listeners
 */
function setupSearchAndFilters() {
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            searchTerm = e.target.value.toLowerCase();
            currentPage = 1;
            filterAndSortData();
        }, 300));
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentPage = 1;
            filterAndSortData();
        });
    }
}

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load table data from DataManager
 */
function loadTableData() {
    if (window.dataManager && window.dataManager.farms) {
        const farms = window.dataManager.farms;
        console.log(`📊 Loading ${farms.length} farms from DataManager`);
        
        tableData = farms.map(farm => ({
            id: farm.id,
            farmId: farm.farm_id || farm.id,
            farmerName: farm.farmerName || 'Unknown',
            farmerId: farm.farmerId || '',
            cooperative: farm.cooperative || 'Unassigned',
            supplier: farm.supplier || 'Unknown',
            declaredArea: farm.declaredArea || 0,
            realArea: farm.realArea || 0,
            area: farm.realArea || farm.area || farm.declaredArea || 0,
            areaDifference: farm.areaDifference || 0,
            status: farm.status || 'pending',
            submissionDate: farm.submissionDate || new Date().toISOString(),
            enumerator: farm.enumerator || 'N/A'
        }));
        
        buildHierarchy();
        filterAndSortData();
    } else {
        console.log('⚠️ DataManager not available, loading mock data');
        loadMockData();
    }
}

/**
 * Build hierarchical data structure
 */
function buildHierarchy() {
    // Group by Supplier first, then by Cooperative
    const hierarchy = {};
    
    tableData.forEach(farm => {
        const supplier = farm.supplier || 'Unknown Supplier';
        const cooperative = farm.cooperative || 'Unknown Cooperative';
        
        if (!hierarchy[supplier]) {
            hierarchy[supplier] = {
                name: supplier,
                cooperatives: {},
                totalFarms: 0,
                totalArea: 0,
                expanded: true // Default expanded
            };
        }
        
        if (!hierarchy[supplier].cooperatives[cooperative]) {
            hierarchy[supplier].cooperatives[cooperative] = {
                name: cooperative,
                farms: [],
                totalFarms: 0,
                totalArea: 0,
                expanded: true
            };
        }
        
        hierarchy[supplier].cooperatives[cooperative].farms.push(farm);
        hierarchy[supplier].cooperatives[cooperative].totalFarms++;
        hierarchy[supplier].cooperatives[cooperative].totalArea += farm.realArea || farm.declaredArea || 0;
        hierarchy[supplier].totalFarms++;
        hierarchy[supplier].totalArea += farm.realArea || farm.declaredArea || 0;
    });
    
    hierarchicalData = hierarchy;
    console.log('📊 Hierarchy built:', Object.keys(hierarchicalData).length, 'suppliers');
}

// ===========================================
// FILTERING & SORTING
// ===========================================

/**
 * Filter and sort data based on current filters
 */
function filterAndSortData() {
    // Apply filters to the raw data first
    let filtered = [...tableData];
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && statusFilter.value !== 'all') {
        filtered = filtered.filter(item => item.status === statusFilter.value);
    }
    
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter && supplierFilter.value !== 'all') {
        filtered = filtered.filter(item => item.supplier === supplierFilter.value);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(item => 
            (item.farmerName && item.farmerName.toLowerCase().includes(searchTerm)) ||
            (item.farmId && item.farmId.toLowerCase().includes(searchTerm)) ||
            (item.cooperative && item.cooperative.toLowerCase().includes(searchTerm)) ||
            (item.supplier && item.supplier.toLowerCase().includes(searchTerm))
        );
    }
    
    // Rebuild hierarchy with filtered data
    const tempHierarchy = {};
    filtered.forEach(farm => {
        const supplier = farm.supplier;
        const cooperative = farm.cooperative;
        
        if (!tempHierarchy[supplier]) {
            tempHierarchy[supplier] = {
                name: supplier,
                cooperatives: {},
                totalFarms: 0,
                totalArea: 0,
                expanded: true
            };
        }
        
        if (!tempHierarchy[supplier].cooperatives[cooperative]) {
            tempHierarchy[supplier].cooperatives[cooperative] = {
                name: cooperative,
                farms: [],
                totalFarms: 0,
                totalArea: 0,
                expanded: true
            };
        }
        
        tempHierarchy[supplier].cooperatives[cooperative].farms.push(farm);
        tempHierarchy[supplier].cooperatives[cooperative].totalFarms++;
        tempHierarchy[supplier].cooperatives[cooperative].totalArea += farm.realArea || farm.declaredArea || 0;
        tempHierarchy[supplier].totalFarms++;
        tempHierarchy[supplier].totalArea += farm.realArea || farm.declaredArea || 0;
    });
    
    hierarchicalData = tempHierarchy;
    renderHierarchicalTable();
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render hierarchical table
 */
function renderHierarchicalTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (Object.keys(hierarchicalData).length === 0) {
        showEmptyState(tbody);
        return;
    }
    
    // Sort suppliers
    const suppliers = Object.keys(hierarchicalData).sort();
    
    suppliers.forEach(supplierName => {
        const supplier = hierarchicalData[supplierName];
        
        // Supplier row
        const supplierRow = createSupplierRow(supplier);
        tbody.appendChild(supplierRow);
        
        if (supplier.expanded) {
            // Sort cooperatives within supplier
            const cooperatives = Object.keys(supplier.cooperatives).sort();
            
            cooperatives.forEach(coopName => {
                const cooperative = supplier.cooperatives[coopName];
                
                // Cooperative row
                const coopRow = createCooperativeRow(supplierName, cooperative);
                tbody.appendChild(coopRow);
                
                if (cooperative.expanded) {
                    // Sort farms within cooperative
                    const farms = cooperative.farms.sort((a, b) => 
                        a.farmerName.localeCompare(b.farmerName)
                    );
                    
                    // Farm rows
                    farms.forEach(farm => {
                        const farmRow = createFarmRow(farm, supplierName, cooperative.name);
                        tbody.appendChild(farmRow);
                    });
                }
            });
        }
    });
    
    updateStats();
}

/**
 * Create supplier row
 */
function createSupplierRow(supplier) {
    const row = document.createElement('tr');
    row.className = 'supplier-row';
    // Escape supplier name for onclick
    const escapedName = supplier.name.replace(/'/g, "\\'");
    row.innerHTML = `
        <td colspan="7">
            <div class="supplier-header">
                <span class="toggle-icon" onclick="toggleSupplier('${escapedName}')">
                    <i class="fas fa-${supplier.expanded ? 'chevron-down' : 'chevron-right'}"></i>
                </span>
                <i class="fas fa-building"></i>
                <strong>${supplier.name}</strong>
                <span class="badge supplier-badge">
                    <i class="fas fa-tractor"></i> ${supplier.totalFarms} farms
                </span>
                <span class="badge area-badge">
                    <i class="fas fa-ruler-combined"></i> ${supplier.totalArea.toFixed(1)} ha
                </span>
                <span class="badge coop-badge">
                    <i class="fas fa-users"></i> ${Object.keys(supplier.cooperatives).length} cooperatives
                </span>
            </div>
        </td>
    `;
    return row;
}

/**
 * Create cooperative row
 */
function createCooperativeRow(supplierName, cooperative) {
    const row = document.createElement('tr');
    row.className = 'cooperative-row';
    // Escape names for onclick
    const escapedSupplier = supplierName.replace(/'/g, "\\'");
    const escapedCoop = cooperative.name.replace(/'/g, "\\'");
    row.innerHTML = `
        <td colspan="7">
            <div class="cooperative-header" style="margin-left: 30px;">
                <span class="toggle-icon" onclick="toggleCooperative('${escapedSupplier}', '${escapedCoop}')">
                    <i class="fas fa-${cooperative.expanded ? 'chevron-down' : 'chevron-right'}"></i>
                </span>
                <i class="fas fa-users"></i>
                <strong>${cooperative.name}</strong>
                <span class="badge">
                    <i class="fas fa-tractor"></i> ${cooperative.totalFarms} farms
                </span>
                <span class="badge area-badge">
                    <i class="fas fa-ruler-combined"></i> ${cooperative.totalArea.toFixed(1)} ha
                </span>
            </div>
        </td>
    `;
    return row;
}

/**
 * Create farm row
 */
function createFarmRow(farm, supplierName, cooperativeName) {
    const row = document.createElement('tr');
    row.className = 'farm-row';
    row.setAttribute('data-farm-id', farm.id);
    row.setAttribute('data-supplier', supplierName);
    row.setAttribute('data-cooperative', cooperativeName);
    
    const statusConfig = {
        validated: { icon: 'fa-check-circle', class: 'status-validated' },
        pending: { icon: 'fa-clock', class: 'status-pending' },
        rejected: { icon: 'fa-times-circle', class: 'status-rejected' }
    };
    
    const status = statusConfig[farm.status] || statusConfig.pending;
    
    // Calculate display area
    const displayArea = farm.realArea > 0 ? farm.realArea : (farm.area > 0 ? farm.area : farm.declaredArea || 0);
    
    row.innerHTML = `
        <td>
            <div style="margin-left: 60px;">
                <strong>${farm.farmId}</strong>
                <div class="text-muted">${farm.enumerator}</div>
            </div>
        </td>
        <td>
            <div class="farmer-cell">
                <div class="farmer-name">${farm.farmerName}</div>
                <div class="text-muted">ID: ${farm.farmerId || 'N/A'}</div>
            </div>
        </td>
        <td>${cooperativeName}</td>
        <td>
            <strong>${displayArea.toFixed(1)}</strong> ha
            ${farm.realArea > 0 && farm.declaredArea > 0 && Math.abs(farm.realArea - farm.declaredArea) > 0.1 ? 
                `<div class="text-muted small">declared: ${farm.declaredArea.toFixed(1)} ha</div>` : ''}
        </td>
        <td>${window.utils ? window.utils.formatDate(farm.submissionDate, 'DD/MM/YYYY') : farm.submissionDate}</td>
        <td>
            <span class="status-badge ${status.class}">
                <i class="fas ${status.icon}"></i> 
                ${farm.status.charAt(0).toUpperCase() + farm.status.slice(1)}
            </span>
        </td>
        <td>
            <div class="action-buttons">
                <button class="action-btn view" onclick="viewSubmission('${farm.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn map" onclick="locateOnMap('${farm.id}')" title="Show on Map">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
            </div>
        </td>
    `;
    
    row.addEventListener('click', (e) => {
        if (!e.target.closest('.action-buttons')) {
            selectTableRow(farm.id);
        }
    });
    
    return row;
}

// ===========================================
// VIEW TOGGLE FUNCTIONALITY
// ===========================================

let groupedView = true; // Default to grouped/hierarchical view

/**
 * Toggle between hierarchical and flat table view
 */
function toggleView() {
    console.log('🔄 Toggling view mode. Current:', groupedView ? 'hierarchical' : 'flat');
    
    groupedView = !groupedView;
    
    // Update button icon
    const toggleBtn = document.getElementById('toggleViewBtn');
    if (toggleBtn) {
        toggleBtn.innerHTML = groupedView ? 
            '<i class="fas fa-layer-group"></i>' : 
            '<i class="fas fa-list"></i>';
        toggleBtn.title = groupedView ? 'Switch to flat view' : 'Switch to grouped view';
    }
    
    // Render the appropriate view
    if (groupedView) {
        renderHierarchicalTable();
    } else {
        renderFlatTable();
    }
    
    if (window.notification) {
        window.notification.info(`Switched to ${groupedView ? 'grouped' : 'flat'} view`);
    }
}

/**
 * Render flat table (non-hierarchical)
 */
function renderFlatTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (tableData.length === 0) {
        showEmptyState(tbody);
        return;
    }
    
    // Get current filtered data
    let data = [...tableData];
    
    // Apply current filters
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && statusFilter.value !== 'all') {
        data = data.filter(item => item.status === statusFilter.value);
    }
    
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter && supplierFilter.value !== 'all') {
        data = data.filter(item => item.supplier === supplierFilter.value);
    }
    
    if (searchTerm) {
        data = data.filter(item => 
            (item.farmerName && item.farmerName.toLowerCase().includes(searchTerm)) ||
            (item.farmId && item.farmId.toLowerCase().includes(searchTerm)) ||
            (item.cooperative && item.cooperative.toLowerCase().includes(searchTerm)) ||
            (item.supplier && item.supplier.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply sorting
    data.sort((a, b) => {
        let aVal = a[currentSort.column] || '';
        let bVal = b[currentSort.column] || '';
        
        if (currentSort.column === 'area' || currentSort.column === 'declaredArea' || currentSort.column === 'realArea') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (currentSort.column === 'submissionDate') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        return currentSort.direction === 'asc' ? 
            (aVal > bVal ? 1 : -1) : 
            (aVal < bVal ? 1 : -1);
    });
    
    // Paginate
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, data.length);
    const pageData = data.slice(start, end);
    
    // Render rows
    pageData.forEach(farm => {
        const row = createFlatRow(farm);
        tbody.appendChild(row);
    });
    
    // Update pagination
    updatePagination(Math.ceil(data.length / itemsPerPage));
    
    // Update stats
    document.getElementById('totalCount').textContent = data.length;
    document.getElementById('showingCount').textContent = 
        `${start + 1}-${end} of ${data.length}`;
}

/**
 * Create flat table row
 */
function createFlatRow(farm) {
    const row = document.createElement('tr');
    row.setAttribute('data-farm-id', farm.id);
    
    const statusConfig = {
        validated: { icon: 'fa-check-circle', class: 'status-validated' },
        pending: { icon: 'fa-clock', class: 'status-pending' },
        rejected: { icon: 'fa-times-circle', class: 'status-rejected' }
    };
    
    const status = statusConfig[farm.status] || statusConfig.pending;
    const displayArea = farm.realArea > 0 ? farm.realArea : (farm.area > 0 ? farm.area : farm.declaredArea || 0);
    
    row.innerHTML = `
        <td>
            <strong>${farm.farmId}</strong>
            <div class="text-muted">${farm.enumerator}</div>
            <small class="supplier-badge">${farm.supplier}</small>
        </td>
        <td>
            <div class="farmer-name">${farm.farmerName}</div>
            <div class="text-muted">ID: ${farm.farmerId || 'N/A'}</div>
        </td>
        <td>${farm.cooperative}</td>
        <td>
            <strong>${displayArea.toFixed(1)}</strong> ha
        </td>
        <td>${window.utils ? window.utils.formatDate(farm.submissionDate, 'DD/MM/YYYY') : farm.submissionDate}</td>
        <td>
            <span class="status-badge ${status.class}">
                <i class="fas ${status.icon}"></i> 
                ${farm.status.charAt(0).toUpperCase() + farm.status.slice(1)}
            </span>
        </td>
        <td>
            <div class="action-buttons">
                <button class="action-btn view" onclick="viewSubmission('${farm.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn map" onclick="locateOnMap('${farm.id}')" title="Show on Map">
                    <i class="fas fa-map-marker-alt"></i>
                </button>
            </div>
        </td>
    `;
    
    row.addEventListener('click', (e) => {
        if (!e.target.closest('.action-buttons')) {
            selectTableRow(farm.id);
        }
    });
    
    return row;
}

/**
 * Update pagination controls
 */
function updatePagination(totalPages) {
    const pageNumbers = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (!pageNumbers) return;
    
    // Update button states
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    if (totalPages === 0) {
        pageNumbers.innerHTML = '<span class="page-number active">1</span>';
        return;
    }
    
    // Generate page numbers
    let pageHtml = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page
    if (startPage > 1) {
        pageHtml += `<span class="page-number" onclick="goToPage(1)">1</span>`;
        if (startPage > 2) {
            pageHtml += `<span class="page-ellipsis">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        pageHtml += `
            <span class="page-number ${i === currentPage ? 'active' : ''}" 
                  onclick="goToPage(${i})">
                ${i}
            </span>
        `;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageHtml += `<span class="page-ellipsis">...</span>`;
        }
        pageHtml += `<span class="page-number" onclick="goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = pageHtml;
}

// ===========================================
// ACTION FUNCTIONS
// ===========================================

/**
 * View farm submission details
 */
function viewSubmission(farmId) {
    const farm = tableData.find(f => f.id === farmId);
    if (!farm) return;
    
    const details = `
        Farm: ${farm.farmId}
        Farmer: ${farm.farmerName}
        ID: ${farm.farmerId}
        Cooperative: ${farm.cooperative}
        Supplier: ${farm.supplier}
        Area: ${farm.realArea || farm.declaredArea} ha
        Status: ${farm.status}
        Date: ${farm.submissionDate}
        Enumerator: ${farm.enumerator}
    `;
    alert(details);
}

/**
 * Edit farm submission
 */
function editSubmission(farmId) {
    if (window.notification) {
        window.notification.info(`Edit functionality for ${farmId} - Coming soon`);
    }
}

/**
 * Save farm changes
 */
function saveFarmChanges(farmId) {
    if (window.notification) {
        window.notification.info(`Save changes for ${farmId} - Coming soon`);
    }
}

/**
 * Validate farm submission
 */
function validateSubmission(farmId) {
    const farm = tableData.find(f => f.id === farmId);
    if (farm && farm.status !== 'validated') {
        farm.status = 'validated';
        if (window.dataManager) {
            const dataFarm = window.dataManager.farms.find(f => f.id === farmId);
            if (dataFarm) dataFarm.status = 'validated';
        }
        filterAndSortData();
        if (window.notification) {
            window.notification.success(`Farm ${farmId} validated`);
        }
    }
}

/**
 * Reject farm submission
 */
function rejectSubmission(farmId) {
    const farm = tableData.find(f => f.id === farmId);
    if (farm && farm.status !== 'rejected') {
        farm.status = 'rejected';
        if (window.dataManager) {
            const dataFarm = window.dataManager.farms.find(f => f.id === farmId);
            if (dataFarm) dataFarm.status = 'rejected';
        }
        filterAndSortData();
        if (window.notification) {
            window.notification.success(`Farm ${farmId} rejected`);
        }
    }
}

/**
 * Locate farm on map
 */
function locateOnMap(farmId) {
    if (window.zoomToFarm) {
        window.zoomToFarm(farmId);
    } else {
        console.log('📍 Locate on map:', farmId);
    }
}

/**
 * Select table row
 */
function selectTableRow(farmId) {
    // Remove previous selection
    document.querySelectorAll('tbody tr.farm-row').forEach(row => {
        row.classList.remove('selected');
    });
    
    // Select new row
    const row = document.querySelector(`tr.farm-row[data-farm-id="${farmId}"]`);
    if (row) {
        row.classList.add('selected');
        locateOnMap(farmId);
    }
}

// ===========================================
// EXPORT FUNCTIONALITY - TABLE
// ===========================================

/**
 * Export table data - called from button
 */
function exportTableData() {
    console.log('📤 Opening export modal');
    
    // Create export modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'export-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-download" style="color: #2c6e49;"></i> Export Farm Data</h3>
                <button class="modal-close" onclick="document.getElementById('export-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px;">Choose export format:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
                    <button class="export-option" onclick="performTableExport('csv')">
                        <i class="fas fa-file-csv"></i>
                        <span>CSV</span>
                        <small style="display: block; font-size: 11px;">Table data</small>
                    </button>
                    <button class="export-option" onclick="performTableExport('json')">
                        <i class="fas fa-file-code"></i>
                        <span>JSON</span>
                        <small style="display: block; font-size: 11px;">Full data</small>
                    </button>
                    <button class="export-option" onclick="performTableExport('geojson')">
                        <i class="fas fa-draw-polygon"></i>
                        <span>GeoJSON</span>
                        <small style="display: block; font-size: 11px;">With geometry</small>
                    </button>
                </div>
                <p class="text-muted small" style="margin-top: 15px;">
                    <i class="fas fa-info-circle"></i> 
                    Exporting ${tableData.length} farms
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Perform table export
 */
function performTableExport(format) {
    // Close modal
    const modal = document.getElementById('export-modal');
    if (modal) modal.remove();
    
    if (window.notification) {
        window.notification.info(`Preparing ${format.toUpperCase()} export...`);
    }
    
    // Get data to export
    const exportData = filteredData.length > 0 ? filteredData : tableData;
    
    if (exportData.length === 0) {
        if (window.notification) {
            window.notification.warning('No data to export');
        }
        return;
    }
    
    // Small delay to show notification
    setTimeout(() => {
        try {
            let dataStr;
            let filename;
            let mimeType;
            
            switch(format) {
                case 'csv':
                    dataStr = convertToCSV(exportData);
                    filename = `farms_${new Date().toISOString().split('T')[0]}.csv`;
                    mimeType = 'text/csv';
                    break;
                case 'json':
                    dataStr = convertToJSON(exportData);
                    filename = `farms_${new Date().toISOString().split('T')[0]}.json`;
                    mimeType = 'application/json';
                    break;
                case 'geojson':
                    dataStr = convertToGeoJSON(exportData);
                    filename = `farms_${new Date().toISOString().split('T')[0]}.geojson`;
                    mimeType = 'application/geo+json';
                    break;
                default:
                    throw new Error('Invalid format');
            }
            
            // Download file
            downloadFile(dataStr, filename, mimeType);
            
            if (window.notification) {
                window.notification.success(`Exported ${exportData.length} farms as ${format.toUpperCase()}`);
            }
            
        } catch (error) {
            console.error('Export error:', error);
            if (window.notification) {
                window.notification.error('Export failed: ' + error.message);
            }
        }
    }, 500);
}

/**
 * Convert to CSV
 */
function convertToCSV(data) {
    const headers = ['Farm ID', 'Farmer Name', 'Farmer ID', 'Cooperative', 'Supplier', 'Area (ha)', 'Status', 'Submission Date', 'Enumerator'];
    
    const rows = data.map(farm => [
        farm.farmId || farm.id || '',
        farm.farmerName || '',
        farm.farmerId || '',
        farm.cooperative || '',
        farm.supplier || '',
        (farm.realArea || farm.area || farm.declaredArea || 0).toFixed(1),
        farm.status || '',
        farm.submissionDate ? new Date(farm.submissionDate).toLocaleDateString() : '',
        farm.enumerator || ''
    ]);
    
    return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
}

/**
 * Convert to JSON
 */
function convertToJSON(data) {
    const cleanData = data.map(farm => ({
        farmId: farm.farmId || farm.id,
        farmerName: farm.farmerName,
        farmerId: farm.farmerId,
        cooperative: farm.cooperative,
        supplier: farm.supplier,
        area: farm.realArea || farm.area || farm.declaredArea || 0,
        status: farm.status,
        submissionDate: farm.submissionDate,
        enumerator: farm.enumerator
    }));
    
    return JSON.stringify(cleanData, null, 2);
}

/**
 * Convert to GeoJSON
 */
function convertToGeoJSON(data) {
    // Get farms with geometry from DataManager
    const farmsWithGeo = window.dataManager?.farms?.filter(f => f.geometry && f.geometry.coordinates) || [];
    
    // Create a map for quick lookup
    const farmMap = new Map();
    farmsWithGeo.forEach(f => farmMap.set(f.id || f.farm_id, f));
    
    const features = data
        .map(farm => {
            // Try to find matching farm with geometry
            const geoFarm = farmMap.get(farm.id) || farmMap.get(farm.farmId);
            
            if (geoFarm?.geometry) {
                return {
                    type: "Feature",
                    geometry: geoFarm.geometry,
                    properties: {
                        farmId: farm.farmId || farm.id,
                        farmerName: farm.farmerName,
                        farmerId: farm.farmerId,
                        cooperative: farm.cooperative,
                        supplier: farm.supplier,
                        area: farm.realArea || farm.area || farm.declaredArea || 0,
                        status: farm.status,
                        submissionDate: farm.submissionDate
                    }
                };
            }
            return null;
        })
        .filter(f => f !== null);
    
    return JSON.stringify({
        type: "FeatureCollection",
        features: features
    }, null, 2);
}

/**
 * Download file helper
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Add export option styles if not already present
function addExportStyles() {
    const styleId = 'export-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .export-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 15px;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .export-option:hover {
            border-color: #2c6e49;
            transform: translateY(-2px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .export-option i {
            font-size: 32px;
            color: #2c6e49;
            margin-bottom: 5px;
        }
        .export-option span {
            font-weight: 600;
            color: #212529;
        }
    `;
    document.head.appendChild(style);
}

// Call this when the module loads
addExportStyles();

// ===========================================
// TABLE CONTROL FUNCTIONS
// ===========================================

/**
 * Refresh table data
 */
function refreshTable() {
    loadTableData();
    if (window.notification) {
        window.notification.success('Table refreshed');
    }
}

/**
 * Filter table
 */
function filterTable() {
    filterAndSortData();
}

/**
 * Sort table by column
 */
function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    filterAndSortData();
}

/**
 * Go to specific page
 */
function goToPage(page) {
    currentPage = page;
    renderHierarchicalTable();
}

/**
 * Go to previous page
 */
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderHierarchicalTable();
    }
}

/**
 * Go to next page
 */
function nextPage() {
    const totalPages = Math.ceil(tableData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderHierarchicalTable();
    }
}

// ===========================================
// UI HELPER FUNCTIONS
// ===========================================

/**
 * Show empty state
 */
function showEmptyState(tbody) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td colspan="7" class="text-center empty-state">
            <i class="fas fa-inbox fa-3x"></i>
            <p>No submissions found</p>
            <small>Try adjusting your filters</small>
        </td>
    `;
    tbody.appendChild(row);
}

/**
 * Update table statistics
 */
function updateStats() {
    const totalFarms = tableData.length;
    const showingEl = document.getElementById('totalCount');
    const countEl = document.getElementById('showingCount');
    
    if (showingEl) {
        showingEl.textContent = totalFarms;
    }
    if (countEl) {
        countEl.textContent = `${Math.min(itemsPerPage, totalFarms)} of ${totalFarms}`;
    }
}

// ===========================================
// SELECTION FUNCTIONS
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


// ===========================================
// TOGGLE FUNCTIONS
// ===========================================

/**
 * Toggle supplier expansion
 */
function toggleSupplier(supplierName) {
    console.log('🔄 Toggle supplier:', supplierName);
    
    try {
        // Clean the supplier name (remove any escaped quotes)
        const cleanName = supplierName.replace(/\\'/g, "'");
        
        // Try exact match first
        if (hierarchicalData[cleanName]) {
            hierarchicalData[cleanName].expanded = !hierarchicalData[cleanName].expanded;
            renderHierarchicalTable();
            return;
        }
        
        // Try case-insensitive match
        const matchingKey = Object.keys(hierarchicalData).find(
            key => key.toLowerCase() === cleanName.toLowerCase()
        );
        
        if (matchingKey) {
            hierarchicalData[matchingKey].expanded = !hierarchicalData[matchingKey].expanded;
            renderHierarchicalTable();
            return;
        }
        
        console.warn('⚠️ Supplier not found:', cleanName);
        
    } catch (error) {
        console.error('❌ Error toggling supplier:', error);
    }
}

/**
 * Toggle cooperative expansion
 */
function toggleCooperative(supplierName, coopName) {
    console.log('🔄 Toggle cooperative:', supplierName, coopName);
    
    try {
        // Clean the names (remove any escaped quotes)
        const cleanSupplier = supplierName.replace(/\\'/g, "'");
        const cleanCoop = coopName.replace(/\\'/g, "'");
        
        // Check if supplier exists
        if (!hierarchicalData[cleanSupplier]) {
            console.warn('⚠️ Supplier not found:', cleanSupplier);
            return;
        }
        
        // Check if cooperative exists
        if (hierarchicalData[cleanSupplier].cooperatives[cleanCoop]) {
            hierarchicalData[cleanSupplier].cooperatives[cleanCoop].expanded = 
                !hierarchicalData[cleanSupplier].cooperatives[cleanCoop].expanded;
            renderHierarchicalTable();
        } else {
            // Try case-insensitive match for cooperative
            const matchingCoop = Object.keys(hierarchicalData[cleanSupplier].cooperatives).find(
                key => key.toLowerCase() === cleanCoop.toLowerCase()
            );
            
            if (matchingCoop) {
                hierarchicalData[cleanSupplier].cooperatives[matchingCoop].expanded = 
                    !hierarchicalData[cleanSupplier].cooperatives[matchingCoop].expanded;
                renderHierarchicalTable();
            } else {
                console.warn('⚠️ Cooperative not found:', cleanCoop);
            }
        }
    } catch (error) {
        console.error('❌ Error toggling cooperative:', error);
    }
}

/**
 * Filter by supplier
 */
function filterBySupplier() {
    const supplierFilter = document.getElementById('supplierFilter');
    if (!supplierFilter) return;
    
    const supplier = supplierFilter.value;
    let filtered = [...tableData];
    
    if (supplier !== 'all') {
        filtered = filtered.filter(item => item.supplier === supplier);
    }
    
    // Apply status filter if active
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && statusFilter.value !== 'all') {
        filtered = filtered.filter(item => item.status === statusFilter.value);
    }
    
    // Apply search term if active
    if (searchTerm) {
        filtered = filtered.filter(item => 
            (item.farmerName && item.farmerName.toLowerCase().includes(searchTerm)) ||
            (item.farmId && item.farmId.toLowerCase().includes(searchTerm)) ||
            (item.cooperative && item.cooperative.toLowerCase().includes(searchTerm))
        );
    }
    
    // Rebuild hierarchy with filtered data
    const tempHierarchy = {};
    filtered.forEach(farm => {
        const supplier = farm.supplier;
        const cooperative = farm.cooperative;
        
        if (!tempHierarchy[supplier]) {
            tempHierarchy[supplier] = {
                name: supplier,
                cooperatives: {},
                totalFarms: 0,
                totalArea: 0,
                expanded: true
            };
        }
        
        if (!tempHierarchy[supplier].cooperatives[cooperative]) {
            tempHierarchy[supplier].cooperatives[cooperative] = {
                name: cooperative,
                farms: [],
                totalFarms: 0,
                totalArea: 0,
                expanded: true
            };
        }
        
        tempHierarchy[supplier].cooperatives[cooperative].farms.push(farm);
        tempHierarchy[supplier].cooperatives[cooperative].totalFarms++;
        tempHierarchy[supplier].cooperatives[cooperative].totalArea += farm.realArea || farm.declaredArea || 0;
        tempHierarchy[supplier].totalFarms++;
        tempHierarchy[supplier].totalArea += farm.realArea || farm.declaredArea || 0;
    });
    
    hierarchicalData = tempHierarchy;
    renderHierarchicalTable();
}

// ===========================================
// MOCK DATA
// ===========================================

/**
 * Load mock data for testing
 */
function loadMockData() {
    tableData = [
        { id: 'FARM001', farmId: 'FARM001', farmerName: 'John Doe', farmerId: 'P001', cooperative: 'Green Valley', supplier: 'SITAPA', declaredArea: 12.5, realArea: 12.8, area: 12.8, status: 'validated', submissionDate: '2024-01-15', enumerator: 'ENUM001' },
        { id: 'FARM002', farmId: 'FARM002', farmerName: 'Jane Smith', farmerId: 'P002', cooperative: 'Green Valley', supplier: 'SITAPA', declaredArea: 8.3, realArea: 8.1, area: 8.1, status: 'pending', submissionDate: '2024-01-18', enumerator: 'ENUM002' },
        { id: 'FARM003', farmId: 'FARM003', farmerName: 'Robert Johnson', farmerId: 'P003', cooperative: 'Sunrise', supplier: 'GCC', declaredArea: 15.2, realArea: 15.5, area: 15.5, status: 'validated', submissionDate: '2024-01-10', enumerator: 'ENUM003' },
        { id: 'FARM004', farmId: 'FARM004', farmerName: 'Maria Garcia', farmerId: 'P004', cooperative: 'Sunrise', supplier: 'GCC', declaredArea: 6.8, realArea: 6.7, area: 6.7, status: 'rejected', submissionDate: '2024-01-05', enumerator: 'ENUM001' }
    ];
    
    buildHierarchy();
    renderHierarchicalTable();
}

// ===========================================
// GLOBAL EXPORTS
// ===========================================

// Make all functions globally available
window.tableData = {
    renderTable: renderHierarchicalTable,
    refreshTable,
    filterTable,
    sortTable,
    goToPage,
    prevPage,
    nextPage,
    highlightTableRow: selectTableRow
};

window.viewSubmission = viewSubmission;
window.editSubmission = editSubmission;
window.saveFarmChanges = saveFarmChanges;
window.validateSubmission = validateSubmission;
window.rejectSubmission = rejectSubmission;
window.locateOnMap = locateOnMap;
window.refreshTable = refreshTable;
window.filterTable = filterTable;
window.sortTable = sortTable;
window.goToPage = goToPage;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.selectTableRow = selectTableRow;
window.toggleSupplier = toggleSupplier;
window.toggleCooperative = toggleCooperative;
window.filterBySupplier = filterBySupplier;
window.exportTableData = exportTableData;
window.performTableExport = performTableExport;
window.clearSelection = clearSelection;

// ===========================================
// INITIALIZATION
// ===========================================

// Initialize table on load
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure DataManager is loaded
    setTimeout(initTable, 200);
});

console.log('✅ Table module loaded with hierarchical view and export functionality');