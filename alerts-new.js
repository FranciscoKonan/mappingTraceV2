// ===========================================
// ALERTS SYSTEM - WITH REAL OVERLAP AREA AND SELF-INTERSECTION
// ===========================================

console.log('🚀 Initializing alerts system...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================

let alertsData = [];

// EXPOSE GLOBALLY for Quality Alerts page
window.globalAlertsData = []; // This will be synced with alertsData
window.dashboardAlerts = [];   // Alternative global reference

// Store processed alert keys to prevent duplicates
const processedAlertKeys = new Set();

// Check if Turf.js is available
if (typeof turf === 'undefined') {
    console.error('❌ Turf.js not loaded! Overlap detection will not work.');
} else {
    console.log('✅ Turf.js version:', turf.version || 'loaded');
}

// ===========================================
// OVERLAP DETECTION
// ===========================================

/**
 * Calculate real overlap area between two polygons
 */
function calculateOverlapArea(poly1, poly2) {
    try {
        const intersection = turf.intersect(poly1, poly2);
        if (intersection) {
            // Area in hectares (turf.area returns square meters)
            return turf.area(intersection) / 10000;
        }
        return 0;
    } catch (e) {
        console.warn('⚠️ Error calculating overlap:', e);
        return 0;
    }
}

/**
 * Determine overlap severity based on area
 * Critical: > 5 ha
 * High: = 5 ha (exactly 5)
 * Medium: 1-5 ha (but not exactly 5)
 * Low: < 1 ha
 */
function getOverlapSeverity(overlapArea) {
    if (overlapArea > 5) {
        return 'critical';
    } else if (overlapArea === 5) {
        return 'high';
    } else if (overlapArea > 1) {
        return 'medium';
    } else {
        return 'low';
    }
}

// ===========================================
// SELF-INTERSECTION DETECTION
// ===========================================

/**
 * Check for self-intersection in a polygon using multiple methods
 * Returns severity based on complexity and area
 */
function checkSelfIntersection(geometry, farm) {
    try {
        if (!geometry || !geometry.coordinates) {
            console.log(`⚠️ No geometry for farm: ${farm.farmerName || farm.farmer_name}`);
            return null;
        }
        
        console.log(`🔍 Checking self-intersection for farm: ${farm.farmerName || farm.farmer_name}`);
        
        // Create Turf polygon
        const polygon = turf.polygon(geometry.coordinates);
        
        // Method 1: Check if polygon is valid (no self-intersection)
        const isValid = turf.booleanValid(polygon);
        
        if (!isValid) {
            console.log(`⚠️ Self-intersection detected via booleanValid for: ${farm.farmerName || farm.farmer_name}`);
            
            // Method 2: Use kinks function to find self-intersection points
            let intersectionPoints = [];
            let intersectionCount = 0;
            let intersectionCoordinates = [];
            
            try {
                // turf.kinks returns points where lines intersect
                const kinks = turf.kinks(polygon);
                if (kinks && kinks.features) {
                    intersectionPoints = kinks.features;
                    intersectionCount = kinks.features.length;
                    
                    // Extract coordinates of intersection points
                    kinks.features.forEach(feature => {
                        if (feature.geometry && feature.geometry.coordinates) {
                            intersectionCoordinates.push(feature.geometry.coordinates);
                        }
                    });
                }
            } catch (e) {
                console.warn('Kinks method failed, using fallback:', e);
                
                // Method 3: Manual line intersection detection (fallback)
                const coords = geometry.coordinates[0]; // Outer ring
                for (let i = 0; i < coords.length - 2; i++) {
                    for (let j = i + 2; j < coords.length - 1; j++) {
                        // Skip adjacent segments
                        if (j === i + 1) continue;
                        
                        const line1 = turf.lineString([coords[i], coords[i + 1]]);
                        const line2 = turf.lineString([coords[j], coords[j + 1]]);
                        
                        if (turf.booleanIntersects(line1, line2)) {
                            intersectionCount++;
                            // Approximate intersection point (midpoint)
                            const midPoint = [
                                (coords[i][0] + coords[i + 1][0]) / 2,
                                (coords[i][1] + coords[i + 1][1]) / 2
                            ];
                            intersectionCoordinates.push(midPoint);
                        }
                    }
                }
            }
            
            // Calculate area to determine impact
            const area = turf.area(polygon) / 10000; // hectares
            
            // Determine severity based on complexity and area
            let severity = 'low';
            let severityReason = '';
            
            if (intersectionCount > 3) {
                severity = 'critical';
                severityReason = `Multiple self-intersections (${intersectionCount} points)`;
            } else if (intersectionCount > 1) {
                if (area > 10) {
                    severity = 'critical';
                    severityReason = `${intersectionCount} intersections with large area (${area.toFixed(1)} ha)`;
                } else if (area > 5) {
                    severity = 'high';
                    severityReason = `${intersectionCount} intersections with area ${area.toFixed(1)} ha`;
                } else if (area > 1) {
                    severity = 'high';
                    severityReason = `${intersectionCount} intersections`;
                } else {
                    severity = 'medium';
                    severityReason = `${intersectionCount} intersections`;
                }
            } else if (intersectionCount === 1) {
                if (area > 10) {
                    severity = 'critical';
                    severityReason = `Complex self-intersection with large area (${area.toFixed(1)} ha)`;
                } else if (area > 5) {
                    severity = 'high';
                    severityReason = `Self-intersection with area ${area.toFixed(1)} ha`;
                } else if (area > 1) {
                    severity = 'medium';
                    severityReason = `Self-intersection`;
                } else {
                    severity = 'low';
                    severityReason = `Minor self-intersection`;
                }
            } else {
                // Valid polygon but flagged as invalid by booleanValid? (rare case)
                severity = 'low';
                severityReason = 'Potential geometry issue';
            }
            
            console.log(`✅ Self-intersection confirmed: ${intersectionCount} points, area ${area.toFixed(2)}ha, severity ${severity}`);
            console.log(`   Reason: ${severityReason}`);
            
            // Create farm object with all necessary data
            const farmData = {
                id: farm.farm_id || farm.id,
                farm_id: farm.farm_id || farm.id,
                farmer_name: farm.farmerName || farm.farmer_name || 'Unknown',
                farmerName: farm.farmerName || farm.farmer_name || 'Unknown',
                supplier: farm.supplier || 'Unknown',
                cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
                geometry: farm.geometry
            };
            
            // Create a more descriptive title based on severity
            let title = '';
            if (severity === 'critical') {
                title = `CRITICAL Self-Intersection: ${area.toFixed(1)}ha (${intersectionCount} points)`;
            } else if (severity === 'high') {
                title = `HIGH Self-Intersection: ${area.toFixed(1)}ha (${intersectionCount} points)`;
            } else if (severity === 'medium') {
                title = `MEDIUM Self-Intersection: ${area.toFixed(1)}ha (${intersectionCount} points)`;
            } else {
                title = `Self-Intersection: ${area.toFixed(1)}ha (${intersectionCount} points)`;
            }
            
            return {
                id: `SI-${farm.farm_id || farm.id}-${Date.now()}`,
                type: 'self-intersection',
                severity: severity,
                title: title,
                message: `${farm.farmerName || farm.farmer_name}'s farm has a self-intersecting boundary`,
                description: `Self-intersecting polygon detected with ${intersectionCount} intersection point(s)`,
                farmId: farm.farm_id || farm.id,
                farm_id: farm.farm_id || farm.id,
                farm_name: farm.farmerName || farm.farmer_name || 'Unknown',
                farmerName: farm.farmerName || farm.farmer_name || 'Unknown',
                supplier: farm.supplier || 'Unknown',
                cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
                selfIntersectionCount: intersectionCount,
                self_intersection_count: intersectionCount,
                selfIntersectionArea: area.toFixed(2),
                self_intersection_area: area.toFixed(2),
                intersection_points: intersectionCoordinates,
                intersectionCoordinates: intersectionCoordinates,
                severityReason: severityReason,
                date: new Date().toISOString(),
                status: 'new',
                read: false,
                farms: [farmData],
                geometry: farm.geometry,
                intersection_geometry: null
            };
        } else {
            console.log(`✅ No self-intersection detected for: ${farm.farmerName || farm.farmer_name}`);
        }
    } catch (e) {
        console.warn('⚠️ Error in self-intersection detection:', e);
    }
    
    return null;
}

/**
 * Update global alert references and dispatch event
 */
function updateGlobalAlerts(alerts) {
    // Update all global references
    window.globalAlertsData = alerts;
    window.dashboardAlerts = alerts;
    
    // Dispatch event for Quality Alerts page
    window.dispatchEvent(new CustomEvent('alerts-updated', { 
        detail: { alerts: alerts } 
    }));
    
    // Also dispatch with alternative name
    window.dispatchEvent(new CustomEvent('dashboard-alerts-updated', { 
        detail: { alerts: alerts } 
    }));
    
    // Also update localStorage for cross-tab communication
    try {
        localStorage.setItem('mappingtrace_alerts', JSON.stringify({
            timestamp: Date.now(),
            count: alerts.length,
            alerts: alerts.slice(0, 5) // Store only first 5 for preview
        }));
    } catch (e) {
        // Ignore storage errors
    }
    
    // Update dashboard UI elements
    updateDashboardAlerts();
}

/**
 * Update dashboard UI with alert counts
 */
function updateDashboardAlerts() {
    // Update alerts badge in header
    const alertsBadge = document.getElementById('alertsBadge');
    if (alertsBadge) {
        alertsBadge.textContent = alertsData.length;
    }
    
    // Update KPI alerts count
    const alertsKPI = document.getElementById('alertsCount');
    if (alertsKPI) {
        alertsKPI.textContent = alertsData.length;
    }
    
    // Update notification badge if notifications manager exists
    if (window.notificationsManager) {
        window.notificationsManager.updateBadge();
    }
}

/**
 * Check for overlaps and self-intersections between all farms
 */
async function checkForOverlaps() {
    console.log('🔍 ========== CHECKING FOR OVERLAPS AND SELF-INTERSECTIONS ==========');
    
    if (!window.dataManager || !window.dataManager.farms) {
        console.log('⚠️ No farms data available');
        alertsData = [];
        updateGlobalAlerts([]);
        renderAlerts();
        return;
    }
    
    const farms = window.dataManager.farms;
    console.log(`📊 Got ${farms.length} farms from DataManager`);
    
    // Log first farm for debugging
    if (farms.length > 0) {
        console.log('📋 Sample farm:', {
            id: farms[0].id,
            farm_id: farms[0].farm_id,
            farmer: farms[0].farmerName,
            hasGeometry: !!farms[0].geometry,
            geometryType: farms[0].geometry?.type
        });
    }
    
    // Filter farms with valid geometry
    const farmsWithGeo = farms.filter(f => f.geometry && f.geometry.coordinates);
    console.log(`📍 Found ${farmsWithGeo.length} farms with valid geometry`);
    
    const newAlerts = [];
    const processedPairs = new Set();
    const processedFarms = new Set();
    const startTime = Date.now();
    
    // Clear processed keys periodically to prevent memory issues
    if (processedAlertKeys.size > 1000) {
        processedAlertKeys.clear();
    }
    
    // FIRST: Check EACH farm for self-intersections (even if less than 2 farms)
    console.log('🔍 Checking for self-intersections...');
    let selfIntersectionCount = 0;
    
    for (let i = 0; i < farmsWithGeo.length; i++) {
        const farm = farmsWithGeo[i];
        const farmId = farm.farm_id || farm.id;
        
        // Skip if already processed
        if (processedFarms.has(farmId)) continue;
        processedFarms.add(farmId);
        
        try {
            const selfIntersectionAlert = checkSelfIntersection(farm.geometry, farm);
            if (selfIntersectionAlert) {
                // Create unique key for self-intersection
                const alertKey = `self-${farmId}`;
                
                // Only add if not recently processed
                if (!processedAlertKeys.has(alertKey)) {
                    newAlerts.push(selfIntersectionAlert);
                    processedAlertKeys.add(alertKey);
                    selfIntersectionCount++;
                    console.log(`⚠️ Self-intersection #${selfIntersectionCount} found for farm: ${farm.farmerName || farm.farmer_name}`);
                } else {
                    console.log(`⏭️ Skipping duplicate self-intersection for farm: ${farm.farmerName || farm.farmer_name}`);
                }
            }
        } catch (e) {
            console.warn(`⚠️ Error checking self-intersection for ${farmId}:`, e);
        }
    }
    
    // SECOND: Check for overlaps only if we have at least 2 farms
    if (farmsWithGeo.length >= 2) {
        console.log('🔍 Checking for overlaps...');
        let overlapCount = 0;
        
        for (let i = 0; i < farmsWithGeo.length; i++) {
            for (let j = i + 1; j < farmsWithGeo.length; j++) {
                const farm1 = farmsWithGeo[i];
                const farm2 = farmsWithGeo[j];
                
                const farm1Id = farm1.farm_id || farm1.id;
                const farm2Id = farm2.farm_id || farm2.id;
                
                // Create a unique, stable pair ID
                const pairId = [farm1Id, farm2Id].sort().join('-');
                
                // Skip if already processed
                if (processedPairs.has(pairId)) continue;
                processedPairs.add(pairId);
                
                try {
                    // Create Turf polygons
                    const poly1 = turf.polygon(farm1.geometry.coordinates);
                    const poly2 = turf.polygon(farm2.geometry.coordinates);
                    
                    // Check if they intersect
                    if (turf.booleanIntersects(poly1, poly2)) {
                        const intersection = turf.intersect(poly1, poly2);
                        
                        if (intersection) {
                            const overlapArea = turf.area(intersection) / 10000;
                            
                            // Only report overlaps larger than 100 sq meters (0.01 ha)
                            if (overlapArea > 0.01) {
                                // Create unique key for this overlap
                                const alertKey = `overlap-${pairId}`;
                                
                                // Only add if not recently processed
                                if (!processedAlertKeys.has(alertKey)) {
                                    console.log(`⚠️ Overlap detected: ${farm1Id} (${farm1.farmerName}) & ${farm2Id} (${farm2.farmerName}) - ${overlapArea.toFixed(2)} ha`);
                                    overlapCount++;
                                    
                                    // Determine severity based on overlap area
                                    const severity = getOverlapSeverity(overlapArea);
                                    
                                    // Calculate percentage relative to smaller farm
                                    const area1 = turf.area(poly1) / 10000;
                                    const area2 = turf.area(poly2) / 10000;
                                    const smallerArea = Math.min(area1, area2);
                                    const overlapPercent = (overlapArea / smallerArea) * 100;
                                    
                                    // Create farm objects with all necessary data
                                    const farm1Data = {
                                        id: farm1Id,
                                        farm_id: farm1Id,
                                        farmer_name: farm1.farmerName || 'Unknown',
                                        farmerName: farm1.farmerName || 'Unknown',
                                        supplier: farm1.supplier || 'Unknown',
                                        geometry: farm1.geometry
                                    };
                                    
                                    const farm2Data = {
                                        id: farm2Id,
                                        farm_id: farm2Id,
                                        farmer_name: farm2.farmerName || 'Unknown',
                                        farmerName: farm2.farmerName || 'Unknown',
                                        supplier: farm2.supplier || 'Unknown',
                                        geometry: farm2.geometry
                                    };
                                    
                                    // Create comprehensive alert with all fields
                                    const alert = {
                                        id: `OL-${farm1Id}-${farm2Id}-${Date.now()}`,
                                        type: 'overlap',
                                        severity: severity,
                                        title: `${severity.toUpperCase()} Overlap: ${overlapArea.toFixed(1)}ha`,
                                        message: `${farm1.farmerName || 'Unknown'} overlaps with ${farm2.farmerName || 'Unknown'}`,
                                        description: `${farm1.farmerName}'s farm overlaps with ${farm2.farmerName}'s farm`,
                                        farmId: farm1Id,
                                        farm_id: farm1Id,
                                        farm_name: farm1.farmerName || 'Unknown',
                                        farmerName: farm1.farmerName || 'Unknown',
                                        affectedFarmId: farm2Id,
                                        affected_farm_id: farm2Id,
                                        affected_farm_name: farm2.farmerName || 'Unknown',
                                        affectedFarmerName: farm2.farmerName || 'Unknown',
                                        supplier: farm1.supplier || 'Unknown',
                                        affectedSupplier: farm2.supplier || 'Unknown',
                                        cooperative: farm1.cooperative || farm1.cooperative_name || 'Unassigned',
                                        overlapArea: Math.round(overlapArea * 100) / 100,
                                        overlap_area: overlapArea.toFixed(2),
                                        overlapPercent: overlapPercent.toFixed(1),
                                        overlap_percent: overlapPercent.toFixed(1),
                                        date: new Date().toISOString(),
                                        status: 'new',
                                        read: false,
                                        farms: [farm1Data, farm2Data],
                                        geometry: farm1.geometry,
                                        intersection_geometry: intersection.geometry,
                                        intersectionGeometry: intersection.geometry
                                    };
                                    
                                    newAlerts.push(alert);
                                    processedAlertKeys.add(alertKey);
                                } else {
                                    console.log(`⏭️ Skipping duplicate overlap for farms: ${farm1Id} and ${farm2Id}`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ Error checking overlap between ${farm1Id} and ${farm2Id}:`, e);
                }
            }
        }
        console.log(`📊 Found ${overlapCount} new overlaps`);
    } else {
        console.log('⚠️ Not enough farms with geometry to check overlaps (need at least 2)');
    }
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (newAlerts.length > 0) {
        // Merge with existing alerts, avoiding duplicates
        const existingIds = new Set(alertsData.map(a => a.id));
        const mergedAlerts = [...alertsData];
        
        newAlerts.forEach(alert => {
            if (!existingIds.has(alert.id)) {
                mergedAlerts.unshift(alert);
            }
        });
        
        // Sort by date (newest first)
        alertsData = mergedAlerts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Limit to max 50 alerts to prevent performance issues
        if (alertsData.length > 50) {
            alertsData = alertsData.slice(0, 50);
        }
        
        updateGlobalAlerts(alertsData);
        
        // Count by type for logging
        const overlaps = alertsData.filter(a => a.type === 'overlap').length;
        const selfIntersections = alertsData.filter(a => a.type === 'self-intersection').length;
        
        console.log(`⚠️⚠️⚠️ TOTAL ALERTS: ${alertsData.length} (took ${elapsedTime}s):`);
        console.log(`   - Overlaps: ${overlaps}`);
        console.log(`   - Self-Intersections: ${selfIntersections}`);
        console.log(`   - New this run: ${newAlerts.length}`);
        
        // Show notification only for new alerts
        if (newAlerts.length > 0 && window.notification) {
            let message = `${newAlerts.length} new alert${newAlerts.length > 1 ? 's' : ''} detected`;
            window.notification.warning(message, 5000);
        }
    } else {
        console.log(`✅ No new issues detected (took ${elapsedTime}s)`);
    }
    
    renderAlerts();
    updateDashboardAlerts();
}

/**
 * Check only self-intersections when not enough farms for overlaps
 */
function checkSelfIntersectionsOnly(farmsWithGeo) {
    const newAlerts = [];
    const processedFarms = new Set();
    
    console.log('🔍 Checking for self-intersections only...');
    
    for (let i = 0; i < farmsWithGeo.length; i++) {
        const farm = farmsWithGeo[i];
        const farmId = farm.farm_id || farm.id;
        
        if (processedFarms.has(farmId)) continue;
        processedFarms.add(farmId);
        
        try {
            const selfIntersectionAlert = checkSelfIntersection(farm.geometry, farm);
            if (selfIntersectionAlert) {
                const alertKey = `self-${farmId}`;
                if (!processedAlertKeys.has(alertKey)) {
                    newAlerts.push(selfIntersectionAlert);
                    processedAlertKeys.add(alertKey);
                }
            }
        } catch (e) {
            console.warn(`⚠️ Error checking self-intersection for ${farmId}:`, e);
        }
    }
    
    if (newAlerts.length > 0) {
        alertsData = [...newAlerts, ...alertsData].slice(0, 50);
        updateGlobalAlerts(alertsData);
        console.log(`⚠️⚠️⚠️ GENERATED ${newAlerts.length} SELF-INTERSECTION ALERTS`);
        
        if (window.notification) {
            window.notification.warning(
                `${newAlerts.length} self-intersection${newAlerts.length > 1 ? 's' : ''} detected`,
                5000
            );
        }
    } else {
        console.log('✅ No self-intersections detected');
    }
    
    renderAlerts();
    updateDashboardAlerts();
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render alerts in the sidebar
 */
function renderAlerts() {
    const alertsList = document.getElementById('alertsList');
    const alertsBadge = document.getElementById('alertsBadge');
    const alertsCount = document.getElementById('alertsCount');
    
    if (!alertsList) {
        console.warn('⚠️ Alerts list element not found');
        return;
    }

    // Update badges
    if (alertsBadge) alertsBadge.textContent = alertsData.length;
    if (alertsCount) alertsCount.textContent = alertsData.length;

    // Clear list
    alertsList.innerHTML = '';

    if (alertsData.length === 0) {
        alertsList.innerHTML = `
            <div class="alerts-empty-state">
                <i class="fas fa-check-circle"></i>
                <h4>No Issues Detected</h4>
                <p>All farm boundaries are valid and clear.</p>
            </div>
        `;
        return;
    }

    // Sort by severity and date (critical first, then newest)
    const sortedAlerts = [...alertsData]
        .sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return new Date(b.date) - new Date(a.date);
        })
        .slice(0, 5);

    sortedAlerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item ${alert.severity} ${alert.read ? 'read' : 'unread'}`;
        alertItem.setAttribute('data-alert-id', alert.id);
        
        const date = new Date(alert.date);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const icon = alert.type === 'overlap' ? 'fa-layer-group' : 'fa-draw-polygon';
        const typeText = alert.type === 'overlap' ? 'Boundary Overlap' : 'Self-Intersection';

        alertItem.innerHTML = `
            <div class="alert-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="alert-content">
                <div class="alert-header">
                    <span class="alert-title">${typeText}</span>
                    <span class="alert-time">${timeStr}</span>
                </div>
                <div class="alert-message">
                    ${alert.type === 'overlap' ? 
                        `<strong>${alert.farmerName || alert.farm_name}</strong> ↔ <strong>${alert.affectedFarmerName || alert.affected_farm_name}</strong>` :
                        `<strong>${alert.farmerName || alert.farm_name}</strong>`
                    }
                </div>
                <div class="alert-meta">
                    <span><i class="fas fa-ruler-combined"></i> 
                        ${alert.type === 'overlap' ? 
                            `${(alert.overlapArea || alert.overlap_area)} ha` :
                            `${alert.self_intersection_count || 1} pt(s)`
                        }
                    </span>
                    ${alert.supplier ? `<span class="supplier-badge">${alert.supplier}</span>` : ''}
                </div>
            </div>
        `;
        
        // Add click event to show details
        alertItem.addEventListener('click', () => viewAlertDetails(alert.id));
        
        alertsList.appendChild(alertItem);
    });
}

// ===========================================
// ALERT ACTIONS
// ===========================================

/**
 * View alert details
 */
function viewAlertDetails(alertId) {
    const alert = alertsData.find(a => a.id === alertId);
    if (!alert) return;
    
    const severityColor = alert.severity === 'critical' ? '#dc2626' :
                         alert.severity === 'high' ? '#f97316' :
                         alert.severity === 'medium' ? '#ca8a04' : '#0284c7';
    
    const icon = alert.type === 'overlap' ? 'fa-layer-group' : 'fa-draw-polygon';
    const typeTitle = alert.type === 'overlap' ? 'Overlap Details' : 'Self-Intersection Details';
    
    // Create modal with alert details
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header" style="background: ${severityColor};">
                <h3><i class="fas ${icon}"></i> ${typeTitle}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    ${alert.type === 'overlap' ? `
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Farm 1</label>
                                <div class="detail-card">
                                    <div><strong>${alert.farmerName || alert.farm_name}</strong></div>
                                    <div class="small">ID: ${alert.farmId || alert.farm_id}</div>
                                    <div><span class="supplier-badge">${alert.supplier}</span></div>
                                </div>
                            </div>
                            <div class="detail-item">
                                <label>Farm 2</label>
                                <div class="detail-card">
                                    <div><strong>${alert.affectedFarmerName || alert.affected_farm_name}</strong></div>
                                    <div class="small">ID: ${alert.affectedFarmId || alert.affected_farm_id}</div>
                                    <div><span class="supplier-badge">${alert.affectedSupplier}</span></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="severity-box" style="background: #fff3cd; border-left: 4px solid #ffc107;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-ruler-combined" style="color: #856404;"></i>
                                <div>
                                    <div style="font-weight: 600; color: #856404;">Overlap Area</div>
                                    <div style="font-size: 24px; font-weight: 700; color: #856404;">
                                        ${(alert.overlapArea || alert.overlap_area)} ha (${alert.overlap_percent}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="detail-card text-center">
                            <div style="text-align: center; margin-bottom: 15px;">
                                <div class="severity-icon" style="background: ${severityColor}20;">
                                    <i class="fas fa-draw-polygon" style="color: ${severityColor};"></i>
                                </div>
                                <h2>${alert.farm_name}</h2>
                                <div class="small">${alert.farm_id}</div>
                                <div><span class="supplier-badge">${alert.supplier}</span></div>
                            </div>
                        </div>
                        
                        <div class="severity-box" style="background: #fff3cd; border-left: 4px solid #ffc107;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-exclamation-triangle" style="color: #856404;"></i>
                                <div>
                                    <div style="font-weight: 600; color: #856404;">Self-Intersection</div>
                                    <div style="font-size: 16px; color: #856404;">
                                        ${alert.self_intersection_count || 1} intersection point(s) detected
                                    </div>
                                    <div style="font-size: 14px; color: #856404; margin-top: 5px;">
                                        Area affected: ${alert.self_intersection_area || 'Unknown'} ha
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}
                    
                    <div class="small" style="margin-top: 15px; color: #666;">
                        <i class="fas fa-clock"></i> Detected: ${new Date(alert.date).toLocaleString()}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                ${alert.type === 'overlap' ? `
                    <button class="btn-secondary" onclick="locateFarm('${alert.farmId || alert.farm_id}')">
                        <i class="fas fa-map-marker-alt"></i> Farm 1
                    </button>
                    <button class="btn-secondary" onclick="locateFarm('${alert.affectedFarmId || alert.affected_farm_id}')">
                        <i class="fas fa-map-marker-alt"></i> Farm 2
                    </button>
                ` : `
                    <button class="btn-secondary" onclick="locateFarm('${alert.farm_id}')">
                        <i class="fas fa-map-marker-alt"></i> View Farm
                    </button>
                `}
                <button class="btn-primary" onclick="dismissAlert('${alert.id}', true)">
                    <i class="fas fa-check"></i> Dismiss
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.remove();
    });
}

/**
 * Dismiss an alert
 */
function dismissAlert(alertId, showNotification = false) {
    const index = alertsData.findIndex(a => a.id === alertId);
    if (index !== -1) {
        alertsData.splice(index, 1);
        
        // Update global references when alert is dismissed
        updateGlobalAlerts(alertsData);
        
        renderAlerts();
        updateDashboardAlerts();
        
        if (showNotification && window.notification) {
            window.notification.success('Alert dismissed');
        }
    }
}

/**
 * Dismiss all alerts
 */
function dismissAllAlerts() {
    if (alertsData.length === 0) return;
    
    if (confirm(`Dismiss all ${alertsData.length} alerts?`)) {
        alertsData = [];
        
        // Update global references
        updateGlobalAlerts([]);
        
        renderAlerts();
        updateDashboardAlerts();
        
        // Close any open modal
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
        if (window.notification) {
            window.notification.success('All alerts dismissed');
        }
    }
}

/**
 * Locate farm on map
 */
function locateFarm(farmId) {
    if (window.zoomToFarm && typeof window.zoomToFarm === 'function') {
        window.zoomToFarm(farmId);
    } else {
        console.log('📍 Locate farm:', farmId);
    }
    
    // Close any open modal
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
}

// ===========================================
// ALERT CONTROL FUNCTIONS
// ===========================================

/**
 * Refresh alerts - manually trigger overlap check
 */
function refreshAlerts() {
    console.log('🔄 Manually refreshing alerts...');
    
    if (window.notification) {
        window.notification.info('Checking for overlaps and self-intersections...');
    }
    
    // Call the main overlap check function
    checkForOverlaps();
}

/**
 * View all alerts
 */
function viewAllAlerts() {
    if (alertsData.length === 0) {
        if (window.notification) {
            window.notification.info('No alerts to display');
        }
        return;
    }
    
    // Create a modal for all alerts
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3><i class="fas fa-exclamation-triangle"></i> All Alerts (${alertsData.length})</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="max-height: 400px; overflow-y: auto;">
                    ${alertsData.map((a, i) => `
                        <div class="alert-item ${a.severity}" style="margin-bottom: 10px; cursor: pointer; padding: 10px; border-radius: 6px;" onclick="viewAlertDetails('${a.id}')">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <i class="fas ${a.type === 'overlap' ? 'fa-layer-group' : 'fa-draw-polygon'}" style="margin-right: 8px;"></i>
                                    ${a.type === 'overlap' ? 
                                        `<strong>${a.farmerName || a.farm_name}</strong> ↔ <strong>${a.affectedFarmerName || a.affected_farm_name}</strong>` :
                                        `<strong>${a.farmerName || a.farm_name}</strong> (self-intersection)`
                                    }
                                </div>
                                <div style="font-size: 12px;">${a.type === 'overlap' ? (a.overlapArea || a.overlap_area) + ' ha' : (a.self_intersection_count || 1) + ' pts'}</div>
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 5px;">
                                ${new Date(a.date).toLocaleString()}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="dismissAllAlerts()">
                    <i class="fas fa-trash"></i> Dismiss All
                </button>
                <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ===========================================
// TEST FUNCTIONS
// ===========================================

/**
 * Test self-intersection detection with a bowtie shape
 */
window.testSelfIntersectionDetection = function() {
    console.log('🧪 Testing self-intersection detection...');
    
    // Create a self-intersecting polygon (bowtie shape)
    const selfIntersectingGeometry = {
        type: "Polygon",
        coordinates: [[
            [-5.567080, 7.519989],  // Start
            [-5.547080, 7.539989],  // Top right
            [-5.567080, 7.539989],  // Top left
            [-5.547080, 7.519989],  // Bottom right (creates intersection)
            [-5.567080, 7.519989]   // Back to start
        ]]
    };
    
    // Create test farm
    const testFarm = {
        id: 'TEST-SI-001',
        farm_id: 'TEST-SI-001',
        farmerName: 'TEST Self-Intersection Farm',
        farmer_name: 'TEST Self-Intersection Farm',
        supplier: 'TEST Supplier',
        cooperative: 'TEST Cooperative',
        geometry: selfIntersectingGeometry
    };
    
    // Check self-intersection
    const result = checkSelfIntersection(selfIntersectingGeometry, testFarm);
    
    if (result) {
        console.log('✅ Self-intersection detected!');
        console.log('Alert:', result);
        
        // Add to alerts
        alertsData.unshift(result);
        updateGlobalAlerts(alertsData);
        renderAlerts();
        
        console.log('🎯 Test alert added to the list');
    } else {
        console.log('❌ No self-intersection detected');
    }
    
    return result;
};

/**
 * Test complex self-intersection detection
 */
window.testComplexSelfIntersection = function() {
    console.log('🧪 Testing complex self-intersection detection...');
    
    // Create a complex self-intersecting polygon (star shape)
    const complexGeometry = {
        type: "Polygon",
        coordinates: [[
            [-5.567080, 7.519989],  // 1
            [-5.547080, 7.539989],  // 2
            [-5.527080, 7.519989],  // 3
            [-5.547080, 7.539989],  // 4 (repeat, creates intersection)
            [-5.567080, 7.539989],  // 5
            [-5.547080, 7.519989],  // 6
            [-5.527080, 7.539989],  // 7
            [-5.567080, 7.519989]   // 8 back to start
        ]]
    };
    
    const testFarm = {
        id: 'TEST-SI-002',
        farm_id: 'TEST-SI-002',
        farmerName: 'TEST Complex Self-Intersection Farm',
        farmer_name: 'TEST Complex Self-Intersection Farm',
        supplier: 'TEST Supplier',
        cooperative: 'TEST Cooperative',
        geometry: complexGeometry
    };
    
    const result = checkSelfIntersection(complexGeometry, testFarm);
    
    if (result) {
        console.log('✅ Complex self-intersection detected!');
        console.log('Alert:', result);
        
        alertsData.unshift(result);
        updateGlobalAlerts(alertsData);
        renderAlerts();
        
        console.log('🎯 Test alert added to the list');
    } else {
        console.log('❌ No self-intersection detected');
    }
    
    return result;
};

/**
 * Force check self-intersections on all farms
 */
window.forceSelfIntersectionCheck = function() {
    console.log('🔍 Forcing self-intersection check on all farms...');
    
    if (!window.dataManager || !window.dataManager.farms) {
        console.log('⚠️ No farms available');
        return;
    }
    
    let selfIntCount = 0;
    const results = [];
    
    window.dataManager.farms.forEach((farm, index) => {
        if (farm.geometry && farm.geometry.coordinates) {
            try {
                const polygon = turf.polygon(farm.geometry.coordinates);
                const isValid = turf.booleanValid(polygon);
                
                if (!isValid) {
                    selfIntCount++;
                    console.log(`❌ Farm ${index}: ${farm.farmerName || farm.farmer_name} - SELF-INTERSECTION DETECTED`);
                    
                    // Get kinks for details
                    const kinks = turf.kinks(polygon);
                    console.log(`   Intersection points: ${kinks.features.length}`);
                    
                    results.push({
                        farm: farm,
                        intersectionCount: kinks.features.length,
                        area: turf.area(polygon) / 10000
                    });
                } else {
                    console.log(`✅ Farm ${index}: ${farm.farmerName || farm.farmer_name} - Valid`);
                }
            } catch (e) {
                console.log(`⚠️ Farm ${index}: Error - ${e.message}`);
            }
        } else {
            console.log(`⚠️ Farm ${index}: No geometry`);
        }
    });
    
    console.log(`📊 Total self-intersections found: ${selfIntCount}`);
    
    // Generate alerts for all found self-intersections
    if (selfIntCount > 0) {
        const newAlerts = [];
        results.forEach(result => {
            const alert = checkSelfIntersection(result.farm.geometry, result.farm);
            if (alert) {
                newAlerts.push(alert);
            }
        });
        
        if (newAlerts.length > 0) {
            alertsData = [...newAlerts, ...alertsData];
            updateGlobalAlerts(alertsData);
            renderAlerts();
            console.log(`✅ Added ${newAlerts.length} self-intersection alerts`);
        }
    }
    
    return results;
};

/**
 * Create a test self-intersecting polygon for testing
 */
window.createTestSelfIntersection = function() {
    console.log('🧪 Creating test self-intersection...');
    
    if (!window.dataManager || !window.dataManager.farms || window.dataManager.farms.length === 0) {
        console.log('⚠️ No farms available');
        return;
    }
    
    // Create a self-intersecting polygon (bowtie shape)
    const selfIntersectingGeometry = {
        type: "Polygon",
        coordinates: [[
            [-5.567080, 7.519989], // Start
            [-5.547080, 7.539989], // Top right (creates intersection)
            [-5.567080, 7.539989], // Top left
            [-5.547080, 7.519989], // Bottom right (creates intersection with first segment)
            [-5.567080, 7.519989]  // Back to start
        ]]
    };
    
    // Use the first farm as a template
    const templateFarm = window.dataManager.farms[0];
    
    // Create test farm with self-intersecting geometry
    const testFarm = {
        id: `TEST-SI-${Date.now()}`,
        farm_id: `TEST-SI-${Date.now()}`,
        farmerName: 'TEST Self-Intersection Farm',
        farmer_name: 'TEST Self-Intersection Farm',
        supplier: 'TEST Supplier',
        cooperative: 'TEST Cooperative',
        geometry: selfIntersectingGeometry
    };
    
    // Temporarily add to farms array for testing
    const originalFarms = window.dataManager.farms;
    window.dataManager.farms = [...originalFarms, testFarm];
    
    console.log('✅ Test farm added with self-intersecting geometry');
    console.log('🔄 Running self-intersection check...');
    
    // Run check
    checkForOverlaps();
    
    // Restore original farms after check (optional)
    setTimeout(() => {
        window.dataManager.farms = originalFarms;
        console.log('🧹 Test farm removed');
    }, 5000);
    
    return testFarm;
};

/**
 * Inject a test self-intersection alert directly into the system
 */
window.injectTestSelfIntersection = function() {
    console.log('💉 Injecting test self-intersection alert directly...');
    
    if (!window.dataManager || !window.dataManager.farms || window.dataManager.farms.length === 0) {
        console.log('⚠️ No farms available');
        return;
    }
    
    // Create a self-intersecting polygon (bowtie shape)
    const selfIntersectingGeometry = {
        type: "Polygon",
        coordinates: [[
            [-5.567080, 7.519989],
            [-5.547080, 7.539989],
            [-5.567080, 7.539989],
            [-5.547080, 7.519989],
            [-5.567080, 7.519989]
        ]]
    };
    
    // Use the first farm as template for data
    const templateFarm = window.dataManager.farms[0];
    
    // Create farm data object
    const farmData = {
        id: `TEST-SI-${Date.now()}`,
        farm_id: `TEST-SI-${Date.now()}`,
        farmer_name: 'TEST Self-Intersection Farm',
        farmerName: 'TEST Self-Intersection Farm',
        supplier: 'TEST Supplier',
        cooperative: 'TEST Cooperative',
        geometry: selfIntersectingGeometry
    };
    
    // Create self-intersection alert
    const testAlert = {
        id: `SI-TEST-${Date.now()}`,
        type: 'self-intersection',
        severity: 'high',
        title: 'TEST Self-Intersection: 2.5ha',
        message: 'TEST Self-Intersection Farm has a self-intersecting boundary',
        description: 'Self-intersecting polygon detected for testing',
        farmId: farmData.id,
        farm_id: farmData.id,
        farm_name: farmData.farmer_name,
        farmerName: farmData.farmerName,
        supplier: farmData.supplier,
        cooperative: farmData.cooperative,
        selfIntersectionCount: 2,
        self_intersection_count: 2,
        selfIntersectionArea: '2.50',
        self_intersection_area: '2.50',
        intersection_points: [],
        date: new Date().toISOString(),
        status: 'new',
        read: false,
        farms: [farmData],
        geometry: farmData.geometry,
        intersection_geometry: null
    };
    
    // Add to alerts
    alertsData = [testAlert, ...alertsData];
    updateGlobalAlerts(alertsData);
    renderAlerts();
    
    console.log('✅ Test alert injected! Check Quality Alerts page.');
    return testAlert;
};

// ===========================================
// GETTER FUNCTIONS FOR QUALITY ALERTS PAGE
// ===========================================

/**
 * Get all alerts (for Quality Alerts page)
 */
function getAllAlerts() {
    return alertsData;
}

/**
 * Get alert by ID
 */
function getAlertById(alertId) {
    return alertsData.find(a => a.id === alertId);
}

// ===========================================
// INITIALIZATION
// ===========================================

// Initial check after DataManager is ready
setTimeout(() => {
    if (window.dataManager && window.dataManager.farms.length > 0) {
        console.log('🔄 Running initial overlap and self-intersection check...');
        checkForOverlaps();
    } else {
        console.log('⏳ Waiting for DataManager to load farms...');
    }
}, 2000);

// Listen for farm updates
window.addEventListener('farms-updated', () => {
    console.log('🔄 Farms updated event received');
    checkForOverlaps();
});

// Listen for sync completion
window.addEventListener('kobo-sync-completed', () => {
    console.log('🔄 Kobo sync completed, checking overlaps and self-intersections...');
    checkForOverlaps();
});

// ===========================================
// GLOBAL EXPORTS
// ===========================================

window.refreshAlerts = refreshAlerts;
window.viewAllAlerts = viewAllAlerts;
window.viewAlertDetails = viewAlertDetails;
window.dismissAlert = dismissAlert;
window.dismissAllAlerts = dismissAllAlerts;
window.locateFarm = locateFarm;
window.getAllAlerts = getAllAlerts;
window.getAlertById = getAlertById;
window.testSelfIntersectionDetection = testSelfIntersectionDetection;
window.testComplexSelfIntersection = testComplexSelfIntersection;
window.forceSelfIntersectionCheck = forceSelfIntersectionCheck;
window.createTestSelfIntersection = createTestSelfIntersection;
window.injectTestSelfIntersection = injectTestSelfIntersection;

console.log('✅ Alerts system ready with real overlap detection and self-intersection checking');
console.log('📊 Global alerts exposed at window.globalAlertsData and window.dashboardAlerts');
console.log('🧪 Test functions available:');
console.log('   - window.testSelfIntersectionDetection() - Test with bowtie shape');
console.log('   - window.testComplexSelfIntersection() - Test with complex shape');
console.log('   - window.forceSelfIntersectionCheck() - Check all farms for self-intersections');
console.log('   - window.createTestSelfIntersection() - Add test farm with self-intersection');
console.log('   - window.injectTestSelfIntersection() - Inject test alert directly');

// ===========================================
// CREATE VISIBLE SELF-INTERSECTION ALERT
// ===========================================

/**
 * Create a visible self-intersection alert that will show in Quality Alerts
 */
window.createVisibleSelfIntersection = function() {
    console.log('🎯 Creating visible self-intersection alert...');
    
    // Create a self-intersecting polygon (bowtie shape)
    const selfIntersectingGeometry = {
        type: "Polygon",
        coordinates: [[
            [-5.567080, 7.519989],  // Start
            [-5.547080, 7.539989],  // Top right
            [-5.567080, 7.539989],  // Top left
            [-5.547080, 7.519989],  // Bottom right (creates intersection)
            [-5.567080, 7.519989]   // Back to start
        ]]
    };
    
    // Create test farm
    const testFarm = {
        id: 'VISIBLE-SI-001',
        farm_id: 'VISIBLE-SI-001',
        farmerName: 'VISIBLE Self-Intersection Farm',
        farmer_name: 'VISIBLE Self-Intersection Farm',
        supplier: 'Test Supplier',
        cooperative: 'Test Cooperative',
        geometry: selfIntersectingGeometry
    };
    
    // Manually create alert with all required fields
    const testAlert = {
        id: `SI-VISIBLE-${Date.now()}`,
        type: 'self-intersection',
        severity: 'high',
        title: 'HIGH Self-Intersection: 2.5ha (2 points)',
        message: 'VISIBLE Self-Intersection Farm has a self-intersecting boundary',
        description: 'Self-intersecting polygon detected with 2 intersection point(s)',
        farmId: testFarm.id,
        farm_id: testFarm.id,
        farm_name: testFarm.farmerName,
        farmerName: testFarm.farmerName,
        supplier: testFarm.supplier,
        cooperative: testFarm.cooperative,
        selfIntersectionCount: 2,
        self_intersection_count: 2,
        selfIntersectionArea: '2.50',
        self_intersection_area: '2.50',
        intersection_points: [
            [-5.557080, 7.529989],
            [-5.557080, 7.529989]
        ],
        date: new Date().toISOString(),
        status: 'new',
        read: false,
        farms: [{
            id: testFarm.id,
            farm_id: testFarm.id,
            farmer_name: testFarm.farmerName,
            farmerName: testFarm.farmerName,
            supplier: testFarm.supplier,
            cooperative: testFarm.cooperative,
            geometry: selfIntersectingGeometry
        }],
        geometry: selfIntersectingGeometry,
        intersection_geometry: null
    };
    
    // Add to alerts
    alertsData = [testAlert, ...alertsData];
    updateGlobalAlerts(alertsData);
    renderAlerts();
    
    console.log('✅ Visible self-intersection alert created!');
    console.log('Alert details:', testAlert);
    
    return testAlert;
};

// ===========================================
// RESET ALERTS BEFORE NEW CHECK
// ===========================================

/**
 * Reset alerts data before running new check
 * This prevents accumulation of duplicate alerts on refresh
 */
function resetAlertsBeforeCheck() {
    console.log('🔄 Resetting alerts before new check...');
    
    // Clear the processed alert keys
    processedAlertKeys.clear();
    
    // Return the current alerts for merging later
    const currentAlerts = [...alertsData];
    
    // Optionally keep only alerts from the last 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentAlerts = currentAlerts.filter(alert => 
        new Date(alert.date).getTime() > oneWeekAgo
    );
    
    console.log(`📊 Keeping ${recentAlerts.length} recent alerts (last 7 days)`);
    
    return recentAlerts;
}