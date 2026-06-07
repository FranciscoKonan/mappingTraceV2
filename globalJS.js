// ===========================================
// GLOBAL UTILITIES & DATA MANAGER
// ===========================================

console.log('🌍 Global JS loading...');

// ===========================================
// NOTIFICATION SYSTEM
// ===========================================

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert-notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <div class="alert-notification-icon"><i class="${icons[type]}"></i></div>
            <div class="alert-notification-content">
                <div class="alert-notification-title">${this.getTitle(type)}</div>
                <div class="alert-notification-message">${message}</div>
            </div>
            <button class="alert-notification-close"><i class="fas fa-times"></i></button>
        `;

        this.container.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        if (duration > 0) setTimeout(() => this.remove(notification), duration);
        
        const closeBtn = notification.querySelector('.alert-notification-close');
        closeBtn.addEventListener('click', () => this.remove(notification));
        return notification;
    }

    getTitle(type) {
        const titles = { 
            success: 'Success', 
            error: 'Error', 
            warning: 'Warning', 
            info: 'Information' 
        };
        return titles[type] || 'Notification';
    }

    remove(notification) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }

    success(message, d) { return this.show(message, 'success', d); }
    error(message, d) { return this.show(message, 'error', d); }
    warning(message, d) { return this.show(message, 'warning', d); }
    info(message, d) { return this.show(message, 'info', d); }
}

// Create global notification instance
window.notification = new NotificationSystem();

// ===========================================
// DATA MANAGER - SUPABASE VERSION
// ===========================================

class DataManager {
    constructor() {
        this.farms = [];
        this.alerts = [];
        this.stats = { 
            totalFarms: 0, 
            totalArea: 0, 
            activePlots: 0, 
            qualityAlerts: 0 
        };
        this.refreshInterval = null;
        this.supabaseReady = false;
    }

    async init() {
        console.log('🚀 Initializing DataManager...');
        
        // Wait for Supabase to be ready
        if (window.supabase && window.supabase.auth) {
            this.supabaseReady = true;
            await this.loadFarms();
            await this.loadAlerts();
            this.calculateStats();
            this.setupAutoRefresh();
        } else {
            window.addEventListener('supabase-ready', async () => {
                console.log('✅ DataManager: Supabase ready');
                this.supabaseReady = true;
                await this.loadFarms();
                await this.loadAlerts();
                this.calculateStats();
                this.setupAutoRefresh();
            });
        }
    }

    async loadFarms() {
        if (!this.supabaseReady || !window.supabase) {
            console.log('⚠️ Supabase not ready, using mock data');
            this.loadMockData();
            return this.farms;
        }
        
        try {
            console.log('🔍 Fetching farms from Supabase...');
            
            // Check session
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) {
                console.log('⚠️ No session, redirecting to login');
                window.location.href = 'login.html';
                return [];
            }
            
            const { data: farms, error } = await window.supabase
                .from('farms')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (farms && farms.length > 0) {
                console.log(`✅ Loaded ${farms.length} farms from Supabase`);
                
                // Transform farms data
                this.farms = farms.map(farm => {
                    // Get cooperative name
                    let cooperative = 'Unassigned';
                    if (farm.cooperative_name) cooperative = farm.cooperative_name;
                    else if (farm.cooperative) cooperative = farm.cooperative;
                    else if (farm.coop) cooperative = farm.coop;
                    
                    // Get supplier
                    let supplier = farm.supplier || 'Unknown';
                    
                    // Get status
                    let status = farm.status || 'pending';
                    
                    // Get area
                    let area = farm.area || 0;
                    
                    return {
                        id: farm.id,
                        farm_id: farm.farmer_id || farm.id,
                        farmerName: farm.farmer_name || 'Unknown Farmer',
                        farmerId: farm.farmer_id || 'N/A',
                        cooperative: cooperative,
                        supplier: supplier,
                        declaredArea: area,
                        realArea: area,
                        area: area,
                        areaDifference: 0,
                        status: status,
                        submissionDate: farm.submission_date || farm.created_at || new Date().toISOString(),
                        enumerator: farm.enumerator || 'N/A',
                        geometry: farm.geometry,
                        created_at: farm.created_at
                    };
                });
                
                // Dispatch farms-updated event for alerts system
                window.dispatchEvent(new CustomEvent('farms-updated', { detail: { farms: this.farms } }));
                
                // Trigger map update
                if (window.refreshMapLayers && typeof window.refreshMapLayers === 'function') {
                    window.refreshMapLayers();
                }
                
                return this.farms;
                
            } else {
                console.log('⚠️ No farms found in Supabase');
                this.loadMockData();
                return this.farms;
            }
            
        } catch (error) {
            console.error('❌ Error loading farms:', error);
            window.notification?.error('Error loading farms: ' + error.message);
            this.loadMockData();
            return this.farms;
        }
    }

    async loadAlerts() {
        // Generate alerts from farms
        if (!this.farms || this.farms.length === 0) {
            this.alerts = [];
            return this.alerts;
        }
        
        this.alerts = this.generateAlerts(this.farms);
        
        // Dispatch alerts-updated event
        window.dispatchEvent(new CustomEvent('alerts-updated', { 
            detail: { alerts: this.alerts } 
        }));
        
        return this.alerts;
    }

    generateAlerts(farms) {
        const alerts = [];
        
        farms.forEach(farm => {
            // Check for missing geometry
            if (!farm.geometry) {
                alerts.push({
                    id: `missing_geom_${farm.id}`,
                    type: 'data',
                    severity: 'high',
                    title: 'Missing Geometry Data',
                    description: `Farm "${farm.farmerName}" has no geometry data. Cannot display on map.`,
                    farmId: farm.id,
                    farm_id: farm.farm_id,
                    farmerName: farm.farmerName,
                    supplier: farm.supplier,
                    cooperative: farm.cooperative,
                    date: new Date().toISOString(),
                    status: 'new'
                });
            }
            
            // Check for missing required fields
            if (!farm.farmerName || farm.farmerName === 'Unknown Farmer') {
                alerts.push({
                    id: `missing_name_${farm.id}`,
                    type: 'data',
                    severity: 'medium',
                    title: 'Missing Farmer Name',
                    description: `Farm is missing farmer name information.`,
                    farmId: farm.id,
                    farm_id: farm.farm_id,
                    farmerName: farm.farmerName,
                    supplier: farm.supplier,
                    cooperative: farm.cooperative,
                    date: new Date().toISOString(),
                    status: 'new'
                });
            }
            
            // Check for area issues
            if (farm.area === 0) {
                alerts.push({
                    id: `zero_area_${farm.id}`,
                    type: 'area',
                    severity: 'medium',
                    title: 'Zero Area',
                    description: `Farm area is 0. Please verify the farm boundaries.`,
                    farmId: farm.id,
                    farm_id: farm.farm_id,
                    farmerName: farm.farmerName,
                    supplier: farm.supplier,
                    cooperative: farm.cooperative,
                    area: farm.area,
                    date: new Date().toISOString(),
                    status: 'new'
                });
            } else if (farm.area > 100) {
                alerts.push({
                    id: `large_area_${farm.id}`,
                    type: 'area',
                    severity: 'low',
                    title: 'Unusually Large Area',
                    description: `Farm area is ${farm.area.toFixed(2)} ha, which is unusually large. Please verify.`,
                    farmId: farm.id,
                    farm_id: farm.farm_id,
                    farmerName: farm.farmerName,
                    supplier: farm.supplier,
                    cooperative: farm.cooperative,
                    area: farm.area,
                    date: new Date().toISOString(),
                    status: 'new'
                });
            }
        });
        
        console.log(`📊 Generated ${alerts.length} alerts from farms`);
        return alerts;
    }

    calculateStats() {
        this.stats = {
            totalFarms: this.farms.length,
            totalArea: this.farms.reduce((sum, f) => sum + (parseFloat(f.area) || 0), 0),
            activePlots: this.farms.filter(f => f.status === 'validated').length,
            qualityAlerts: this.alerts.length
        };
        this.updateDashboardKPIs();
        return this.stats;
    }

    updateDashboardKPIs() {
        this.updateText('farmsCount', this.stats.totalFarms);
        this.updateText('totalArea', this.stats.totalArea.toFixed(1));
        this.updateText('activePlots', this.stats.activePlots);
        this.updateText('alertsCount', this.stats.qualityAlerts);
        this.updateText('mapFarmsCount', this.stats.totalFarms);
        this.updateText('mapTotalArea', this.stats.totalArea.toFixed(1) + ' ha');
        this.updateText('alertsBadge', this.stats.qualityAlerts);
        
        // Update notification badge
        if (window.updateNotificationBadge) {
            window.updateNotificationBadge(this.stats.qualityAlerts);
        }
    }

    updateText(id, text) { 
        const el = document.getElementById(id); 
        if (el) el.textContent = text; 
    }

    setupAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(async () => {
            if (this.supabaseReady) {
                await this.refreshData();
            }
        }, 300000); // 5 minutes
    }

    async refreshData() {
        console.log('🔄 Refreshing data...');
        try {
            await this.loadFarms();
            await this.loadAlerts();
            this.calculateStats();
            
            // Trigger table refresh
            if (window.tableData && typeof window.tableData.renderTable === 'function') {
                window.tableData.renderTable();
            }
            
            // Trigger map refresh
            if (window.refreshMapLayers && typeof window.refreshMapLayers === 'function') {
                window.refreshMapLayers();
            }
            
            window.notification?.success('Data refreshed');
            console.log('✅ Data refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            window.notification?.error('Error refreshing data');
        }
    }

    async syncWithKobo() {
        window.notification?.info('Syncing with KoboCollect...');
        
        // Simulate sync
        setTimeout(async () => {
            await this.refreshData();
            window.notification?.success('Sync completed');
        }, 2000);
    }

    loadMockData() {
        console.log('📊 Loading mock data (offline mode)');
        
        this.farms = [
            { 
                id: 'FARM001', 
                farm_id: 'FARM001',
                farmerName: 'John Doe', 
                farmerId: 'P001',
                cooperative: 'Green Valley Coop', 
                supplier: 'SITAPA',
                declaredArea: 12.5, 
                realArea: 12.8,
                area: 12.5,
                status: 'validated', 
                submissionDate: '2024-01-15', 
                enumerator: 'ENUM001', 
                geometry: { 
                    type: 'Polygon', 
                    coordinates: [[[-0.09,51.505],[-0.09,51.51],[-0.08,51.51],[-0.08,51.505],[-0.09,51.505]]] 
                } 
            },
            { 
                id: 'FARM002', 
                farm_id: 'FARM002',
                farmerName: 'Jane Smith', 
                farmerId: 'P002',
                cooperative: 'Sunrise Farmers', 
                supplier: 'SITAPA',
                declaredArea: 8.3, 
                realArea: 8.1,
                area: 8.3,
                status: 'pending', 
                submissionDate: '2024-01-18', 
                enumerator: 'ENUM002', 
                geometry: { 
                    type: 'Polygon', 
                    coordinates: [[[-0.095,51.51],[-0.095,51.515],[-0.085,51.515],[-0.085,51.51],[-0.095,51.51]]] 
                } 
            },
            { 
                id: 'FARM003', 
                farm_id: 'FARM003',
                farmerName: 'Robert Johnson', 
                farmerId: 'P003',
                cooperative: 'Organic Harvest', 
                supplier: 'GCC',
                declaredArea: 15.2, 
                realArea: 15.5,
                area: 15.2,
                status: 'validated', 
                submissionDate: '2024-01-10', 
                enumerator: 'ENUM003', 
                geometry: { 
                    type: 'Polygon', 
                    coordinates: [[[-0.085,51.5],[-0.085,51.505],[-0.075,51.505],[-0.075,51.5],[-0.085,51.5]]] 
                } 
            },
            { 
                id: 'FARM004', 
                farm_id: 'FARM004',
                farmerName: 'Sarah Williams', 
                farmerId: 'P004',
                cooperative: 'Green Valley Coop', 
                supplier: 'GCC',
                declaredArea: 5.2, 
                realArea: 5.0,
                area: 5.2,
                status: 'pending', 
                submissionDate: '2024-01-20', 
                enumerator: 'ENUM001', 
                geometry: null 
            }
        ];
        
        this.alerts = this.generateAlerts(this.farms);
        this.calculateStats();
        window.notification?.info('Using mock data (offline mode)');
    }

    destroy() { 
        if (this.refreshInterval) clearInterval(this.refreshInterval); 
    }
}

// ===========================================
// GLOBAL INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, initializing DataManager...');
    
    window.dataManager = new DataManager();
    window.dataManager.init().catch(console.error);
    
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    }
    
    // Sync button
    const syncButton = document.getElementById('syncKoboBtn');
    if (syncButton) {
        syncButton.addEventListener('click', async () => window.dataManager?.syncWithKobo());
    }
    
    // Notifications button
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', () => {
            window.notification?.info(`You have ${window.dataManager?.stats?.qualityAlerts || 0} alerts`);
        });
    }
});

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

window.utils = {
    formatDate: (date, format = 'DD/MM/YYYY') => {
        if (!date) return 'N/A';
        const d = new Date(date);
        const pad = n => n.toString().padStart(2, '0');
        return format
            .replace('DD', pad(d.getDate()))
            .replace('MM', pad(d.getMonth() + 1))
            .replace('YYYY', d.getFullYear());
    },
    
    debounce: (func, wait) => { 
        let t; 
        return (...args) => { 
            clearTimeout(t); 
            t = setTimeout(() => func(...args), wait); 
        }; 
    },
    
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    exportToFile: (data, filename, type = 'application/json') => {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            window.notification?.success('Copied to clipboard');
            return true;
        } catch (err) {
            window.notification?.error('Failed to copy');
            return false;
        }
    },
    
    getUrlParams: () => {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },
    
    safeJSONParse: (str, fallback = null) => {
        try {
            return JSON.parse(str);
        } catch {
            return fallback;
        }
    },
    
    getStatusColor: (status) => {
        const colors = {
            validated: '#4CAF50',
            pending: '#FFC107',
            rejected: '#F44336'
        };
        return colors[status] || '#2196F3';
    }
};

// ===========================================
// GLOBAL FUNCTIONS
// ===========================================

window.manualSync = async () => window.dataManager?.syncWithKobo();
window.refreshData = async () => window.dataManager?.refreshData();
window.refreshAlerts = async () => {
    await window.dataManager?.loadAlerts();
    window.dataManager?.calculateStats();
    window.notification?.success('Alerts refreshed');
};
window.viewAllAlerts = () => {
    const count = window.dataManager?.stats?.qualityAlerts || 0;
    if (count === 0) {
        window.notification?.info('No alerts to display');
    } else {
        window.notification?.info(`Total Alerts: ${count}\n\nCheck farms with missing data or geometry issues.`);
    }
};

// Expose notification for other scripts
window.showNotification = (message, type) => {
    if (window.notification) {
        window.notification[type](message);
    }
};

console.log('🚀 Global utilities and DataManager loaded');
