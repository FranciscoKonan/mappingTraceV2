// ===========================================
// FARM VISUALIZATION UTILITIES
// ===========================================

console.log('✅ Farm visualization utilities loaded');

// ===========================================
// FARM HIGHLIGHTING
// ===========================================

/**
 * Highlight a farm on the map when clicked from table
 */
function highlightFarmOnMap(farmId) {
    console.log(`🔍 Highlighting farm: ${farmId}`);
    
    if (window.zoomToFarm && typeof window.zoomToFarm === 'function') {
        window.zoomToFarm(farmId);
    } else {
        console.warn('⚠️ zoomToFarm function not available');
        if (window.notification) {
            window.notification.warning('Map function not available');
        }
    }
}

/**
 * Show farm details in a modal
 */
function showFarmDetails(farmId) {
    console.log(`📋 Showing details for farm: ${farmId}`);
    
    if (window.showFarmDetails && typeof window.showFarmDetails === 'function') {
        window.showFarmDetails(farmId);
    } else {
        // Fallback: try to get farm data from DataManager
        getFarmDetailsFallback(farmId);
    }
}

/**
 * Fallback method to display farm details
 */
function getFarmDetailsFallback(farmId) {
    // Try multiple sources to find the farm
    let farm = null;
    
    // Check DataManager
    if (window.dataManager && window.dataManager.farms) {
        farm = window.dataManager.farms.find(f => 
            f.id === farmId || f.farm_id === farmId || f.farmer_id === farmId
        );
    }
    
    // Check tableData
    if (!farm && window.tableData) {
        farm = window.tableData.find(f => 
            f.id === farmId || f.farm_id === farmId || f.farmer_id === farmId
        );
    }
    
    // Check alertsData
    if (!farm && window.alertsData) {
        const alert = window.alertsData.find(a => 
            a.farmId === farmId || a.farm_id === farmId || a.id === farmId
        );
        if (alert && alert.farms && alert.farms.length > 0) {
            farm = alert.farms[0];
        }
    }
    
    if (farm) {
        displayFarmDetailsModal(farm);
    } else {
        console.log(`ℹ️ No details available for farm: ${farmId}`);
        if (window.notification) {
            window.notification.info(`Farm details not available`);
        }
    }
}

// ===========================================
// FARM DETAILS MODAL
// ===========================================

/**
 * Display farm details in a modal
 */
function displayFarmDetailsModal(farm) {
    // Remove any existing modal
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();
    
    // Normalize farm data structure
    const normalizedFarm = {
        id: farm.id || farm.farm_id || 'N/A',
        farm_id: farm.farm_id || farm.id,
        farmerName: farm.farmerName || farm.farmer_name || 'Unknown',
        farmerId: farm.farmerId || farm.farmer_id || 'N/A',
        cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
        supplier: farm.supplier || 'Unknown',
        status: farm.status || 'pending',
        realArea: farm.realArea || farm.area || farm.real_area || 0,
        declaredArea: farm.declaredArea || farm.declared_area || null,
        submissionDate: farm.submissionDate || farm.submission_date || farm.created_at,
        enumerator: farm.enumerator || 'N/A',
        geometry: farm.geometry
    };
    
    // Format dates
    const submissionDate = normalizedFarm.submissionDate 
        ? new Date(normalizedFarm.submissionDate).toLocaleDateString() 
        : 'N/A';
    
    // Determine area display
    const displayArea = normalizedFarm.realArea 
        ? parseFloat(normalizedFarm.realArea).toFixed(1) 
        : '0.0';
    const declaredArea = normalizedFarm.declaredArea 
        ? parseFloat(normalizedFarm.declaredArea).toFixed(1) 
        : null;
    
    const statusColor = getFarmColor(normalizedFarm.status);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header" style="background: ${statusColor}20;">
                <h3><i class="fas fa-tractor" style="color: ${statusColor};"></i> Farm Details</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                        <i class="fas fa-id-card" style="color: ${statusColor}; font-size: 24px; margin-bottom: 5px;"></i>
                        <div style="font-size: 12px; color: #666;">Farm ID</div>
                        <div style="font-weight: 600; word-break: break-all;">${normalizedFarm.id}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                        <i class="fas fa-tag" style="color: ${statusColor}; font-size: 24px; margin-bottom: 5px;"></i>
                        <div style="font-size: 12px; color: #666;">Status</div>
                        <div><span class="status-badge ${normalizedFarm.status}" style="background: ${statusColor}20; color: ${statusColor};">${normalizedFarm.status}</span></div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: 600; margin-bottom: 10px; color: ${statusColor};">Farmer Information</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <div>
                            <div style="font-size: 12px; color: #666;">Name</div>
                            <div><strong>${normalizedFarm.farmerName}</strong></div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #666;">ID</div>
                            <div><strong>${normalizedFarm.farmerId}</strong></div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: 600; margin-bottom: 10px; color: ${statusColor};">Organization</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                        <div>
                            <div style="font-size: 12px; color: #666;">Cooperative</div>
                            <div><strong>${normalizedFarm.cooperative}</strong></div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #666;">Supplier</div>
                            <div><strong>${normalizedFarm.supplier}</strong></div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: 600; margin-bottom: 10px; color: ${statusColor};">Area Information</div>
                    <div style="background: ${statusColor}10; padding: 15px; border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span><i class="fas fa-ruler-combined" style="color: ${statusColor};"></i> Calculated Area:</span>
                            <span style="font-size: 20px; font-weight: 700; color: ${statusColor};">${displayArea} ha</span>
                        </div>
                        ${declaredArea && Math.abs(parseFloat(displayArea) - parseFloat(declaredArea)) > 0.1 ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #666;">
                            <span>Declared Area:</span>
                            <span>${declaredArea} ha</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; color: #666; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                    <div><i class="fas fa-calendar"></i> Submitted: ${submissionDate}</div>
                    <div><i class="fas fa-user-check"></i> Enumerator: ${normalizedFarm.enumerator}</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="highlightFarmOnMap('${normalizedFarm.id}')">
                    <i class="fas fa-map-marker-alt"></i> View on Map
                </button>
                <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ===========================================
// FARM COLOR UTILITIES
// ===========================================

/**
 * Get color based on farm status
 */
function getFarmColor(status) {
    const colors = {
        validated: '#4CAF50',
        pending: '#FFC107',
        rejected: '#F44336'
    };
    return colors[status] || '#2196F3';
}

/**
 * Get color based on supplier
 */
function getSupplierColor(supplier) {
    const colors = {
        'SITAPA': '#2c6e49',
        'GCC': '#2196f3',
        'Other': '#ff9800'
    };
    return colors[supplier] || '#6c757d';
}

// ===========================================
// FARM STATISTICS
// ===========================================

/**
 * Calculate statistics for a set of farms
 */
function calculateFarmStats(farms) {
    if (!farms || farms.length === 0) {
        return {
            total: 0,
            totalArea: 0,
            validated: 0,
            pending: 0,
            rejected: 0,
            suppliers: {},
            averageArea: 0
        };
    }
    
    const stats = {
        total: farms.length,
        totalArea: farms.reduce((sum, f) => sum + (f.realArea || f.area || f.declaredArea || 0), 0),
        validated: farms.filter(f => f.status === 'validated').length,
        pending: farms.filter(f => f.status === 'pending').length,
        rejected: farms.filter(f => f.status === 'rejected').length,
        suppliers: {}
    };
    
    stats.averageArea = stats.total > 0 ? stats.totalArea / stats.total : 0;
    
    // Count by supplier
    farms.forEach(farm => {
        const supplier = farm.supplier || 'Unknown';
        if (!stats.suppliers[supplier]) {
            stats.suppliers[supplier] = {
                count: 0,
                area: 0
            };
        }
        stats.suppliers[supplier].count++;
        stats.suppliers[supplier].area += (farm.realArea || farm.area || farm.declaredArea || 0);
    });
    
    return stats;
}

// ===========================================
// EXPORT FUNCTIONS
// ===========================================

/**
 * Export farm data as GeoJSON
 */
function exportFarmsAsGeoJSON(farms) {
    const features = farms
        .filter(f => f.geometry && f.geometry.coordinates)
        .map(f => ({
            type: "Feature",
            geometry: f.geometry,
            properties: {
                id: f.id,
                farm_id: f.farm_id,
                farmer_name: f.farmerName || f.farmer_name,
                farmer_id: f.farmerId || f.farmer_id,
                cooperative: f.cooperative || f.cooperative_name,
                supplier: f.supplier,
                area: parseFloat(f.realArea || f.area || f.declaredArea || 0),
                status: f.status,
                submission_date: f.submissionDate || f.submission_date,
                enumerator: f.enumerator
            }
        }));
    
    return {
        type: "FeatureCollection",
        features: features
    };
}

/**
 * Download farm data as file
 */
function downloadFarmData(farms, format = 'geojson') {
    let content, filename, mimeType;
    
    switch(format) {
        case 'geojson':
            content = JSON.stringify(exportFarmsAsGeoJSON(farms), null, 2);
            filename = `farms_${new Date().toISOString().split('T')[0]}.geojson`;
            mimeType = 'application/geo+json';
            break;
        case 'csv':
            content = convertFarmsToCSV(farms);
            filename = `farms_${new Date().toISOString().split('T')[0]}.csv`;
            mimeType = 'text/csv';
            break;
        default:
            console.error('Unsupported format:', format);
            return;
    }
    
    const blob = new Blob([content], { type: mimeType });
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
 * Convert farms to CSV
 */
function convertFarmsToCSV(farms) {
    const headers = ['Farm ID', 'Farmer Name', 'Farmer ID', 'Cooperative', 'Supplier', 'Area (ha)', 'Status', 'Submission Date', 'Enumerator'];
    
    const rows = farms.map(f => [
        f.farm_id || f.id || '',
        f.farmerName || f.farmer_name || '',
        f.farmerId || f.farmer_id || '',
        f.cooperative || f.cooperative_name || '',
        f.supplier || '',
        (f.realArea || f.area || f.declaredArea || 0).toFixed(2),
        f.status || '',
        f.submissionDate || f.submission_date || '',
        f.enumerator || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )].join('\n');
}

// ===========================================
// GLOBAL EXPORTS
// ===========================================

window.highlightFarmOnMap = highlightFarmOnMap;
window.showFarmDetails = showFarmDetails;
window.getFarmColor = getFarmColor;
window.getSupplierColor = getSupplierColor;
window.calculateFarmStats = calculateFarmStats;
window.exportFarmsAsGeoJSON = exportFarmsAsGeoJSON;
window.downloadFarmData = downloadFarmData;

console.log('✅ Farm visualization utilities enhanced');