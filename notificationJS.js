// ===========================================
// NOTIFICATIONS CENTER - REVISED
// ===========================================

/**
 * Notifications Manager
 * Handles all notification functionality including display, storage, and interactions
 */
class NotificationsManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.maxNotifications = 50;
        this.storageKey = 'mappingtrace_notifications';
        this.initialized = false;
        
        // Bind methods
        this.togglePanel = this.togglePanel.bind(this);
        this.markAsRead = this.markAsRead.bind(this);
        this.markAllAsRead = this.markAllAsRead.bind(this);
        this.closeOnClickOutside = this.closeOnClickOutside.bind(this);
    }
    
    /**
     * Initialize the notifications system
     */
    init() {
        if (this.initialized) return;
        
        console.log('🔔 Initializing notifications...');
        
        // Load saved notifications
        this.loadNotifications();
        
        // Setup event listeners
        const notifBtn = document.getElementById('notificationsBtn');
        if (notifBtn) {
            notifBtn.addEventListener('click', this.togglePanel);
        }
        
        // Add notification styles
        this.addStyles();
        
        // Update badge
        this.updateBadge();
        
        // Listen for custom events
        window.addEventListener('farms-updated', () => {
            setTimeout(() => this.refreshNotifications(), 500);
        });
        
        window.addEventListener('alerts-updated', (e) => {
            this.addAlertNotifications(e.detail?.alerts || []);
        });
        
        this.initialized = true;
        console.log('✅ Notifications initialized');
    }
    
    /**
     * Load notifications from localStorage
     */
    loadNotifications() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.notifications = data.notifications || [];
                this.unreadCount = data.unreadCount || 0;
                
                // Parse dates back to Date objects
                this.notifications.forEach(n => {
                    if (n.time) n.time = new Date(n.time);
                });
            }
        } catch (e) {
            console.warn('Could not load notifications:', e);
            this.notifications = [];
            this.unreadCount = 0;
        }
    }
    
    /**
     * Save notifications to localStorage
     */
    saveNotifications() {
        try {
            // Limit number of stored notifications
            const toStore = this.notifications.slice(0, this.maxNotifications);
            localStorage.setItem(this.storageKey, JSON.stringify({
                notifications: toStore,
                unreadCount: this.unreadCount
            }));
        } catch (e) {
            console.warn('Could not save notifications:', e);
        }
    }
    
    /**
     * Add a new notification
     */
    add(notification) {
        const newNotif = {
            id: this.generateId(),
            type: notification.type || 'info',
            title: notification.title || 'Notification',
            message: notification.message || '',
            time: new Date(),
            read: false,
            severity: notification.severity || 'info',
            data: notification.data || null,
            actionable: notification.actionable || false,
            action: notification.action || null
        };
        
        this.notifications.unshift(newNotif);
        this.unreadCount++;
        
        // Keep only max notifications
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }
        
        this.saveNotifications();
        this.updateBadge();
        this.showToast(newNotif);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('notification-added', { 
            detail: { notification: newNotif } 
        }));
        
        return newNotif.id;
    }
    
    /**
     * Show a toast notification
     */
    showToast(notification) {
        // Use the notification system if available
        if (window.notification) {
            const type = notification.severity === 'critical' ? 'error' : 
                        notification.severity === 'high' ? 'warning' : 'info';
            window.notification[type](notification.message, 4000);
            return;
        }
        
        // Fallback toast
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${notification.severity || 'info'}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${this.getIconForType(notification.type, notification.severity)}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${notification.title}</div>
                <div class="toast-message">${notification.message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
    
    /**
     * Add alert notifications from quality alerts
     */
    addAlertNotifications(alerts) {
        if (!alerts || alerts.length === 0) return;
        
        alerts.forEach(alert => {
            // Check if this alert is already in notifications
            const exists = this.notifications.some(n => 
                n.data?.alertId === alert.id && 
                n.time > new Date(Date.now() - 24 * 60 * 60 * 1000)
            );
            
            if (!exists) {
                this.add({
                    type: 'alert',
                    title: alert.title || 'Quality Alert',
                    message: alert.message || `${alert.farmerName || 'Farm'} has an issue`,
                    severity: alert.severity || 'medium',
                    data: { alertId: alert.id, ...alert }
                });
            }
        });
    }
    
    /**
     * Add a sync completion notification
     */
    addSyncNotification(status = 'success', details = {}) {
        this.add({
            type: 'system',
            title: status === 'success' ? 'Sync Complete' : 'Sync Failed',
            message: status === 'success' 
                ? `Successfully synced ${details.count || 0} farms from Kobo`
                : 'Failed to sync with Kobo. Please try again.',
            severity: status === 'success' ? 'info' : 'high'
        });
    }
    
    /**
     * Mark a notification as read
     */
    markAsRead(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.read) {
            notif.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.saveNotifications();
            this.updateBadge();
            
            // Update UI if panel is open
            this.updatePanel();
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('notification-read', { 
                detail: { id } 
            }));
        }
    }
    
    /**
     * Mark all notifications as read
     */
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.saveNotifications();
        this.updateBadge();
        this.updatePanel();
        
        // Show confirmation
        if (window.notification) {
            window.notification.success('All notifications marked as read');
        }
        
        // Close panel
        this.closePanel();
    }
    
    /**
     * Clear all notifications
     */
/**
 * Clear all notifications
 */
clearAll() {
    // Use a custom confirmation instead of confirm()
    if (window.notification) {
        // Create a confirmation toast with buttons
        const confirmationId = this.add({
            type: 'system',
            title: 'Clear All Notifications',
            message: 'Are you sure you want to clear all notifications?',
            severity: 'warning',
            actionable: true,
            action: {
                buttons: [
                    { id: 'confirm', label: 'Yes, Clear All', class: 'danger' },
                    { id: 'cancel', label: 'Cancel', class: 'secondary' }
                ],
                handlers: {
                    'confirm': () => {
                        this.notifications = [];
                        this.unreadCount = 0;
                        this.saveNotifications();
                        this.updateBadge();
                        this.updatePanel();
                        if (window.notification) {
                            window.notification.success('All notifications cleared');
                        }
                    },
                    'cancel': () => {}
                }
            }
        });
    } else {
        // Fallback to confirm if no notification system
        if (confirm('Clear all notifications?')) {
            this.notifications = [];
            this.unreadCount = 0;
            this.saveNotifications();
            this.updateBadge();
            this.updatePanel();
        }
    }
}
    /**
     * Toggle notifications panel
     */
    togglePanel(e) {
        e?.stopPropagation();
        
        const existingPanel = document.getElementById('notifications-panel');
        if (existingPanel) {
            this.closePanel();
            return;
        }
        
        this.openPanel();
    }
    
    /**
     * Open notifications panel
     */
    openPanel() {
        this.closePanel(); // Close any existing panel
        
        const panel = document.createElement('div');
        panel.id = 'notifications-panel';
        panel.className = 'notifications-panel';
        panel.innerHTML = this.getPanelHTML();
        
        // Position near the bell button
        const btn = document.getElementById('notificationsBtn');
        if (btn) {
            const rect = btn.getBoundingClientRect();
            panel.style.top = (rect.bottom + window.scrollY + 5) + 'px';
            panel.style.right = (window.innerWidth - rect.right + 10) + 'px';
        }
        
        document.body.appendChild(panel);
        
        // Add click outside listener
        setTimeout(() => {
            document.addEventListener('click', this.closeOnClickOutside);
        }, 100);
        
        // Add escape key listener
        document.addEventListener('keydown', this.handleEscapeKey);
    }
    
    /**
     * Close notifications panel
     */
    closePanel() {
        const panel = document.getElementById('notifications-panel');
        if (panel) {
            panel.remove();
            document.removeEventListener('click', this.closeOnClickOutside);
            document.removeEventListener('keydown', this.handleEscapeKey);
        }
    }
    
    /**
     * Handle escape key
     */
    handleEscapeKey = (e) => {
        if (e.key === 'Escape') {
            this.closePanel();
        }
    }
    
    /**
     * Close panel when clicking outside
     */
    closeOnClickOutside(e) {
        const panel = document.getElementById('notifications-panel');
        const btn = document.getElementById('notificationsBtn');
        
        if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
            this.closePanel();
        }
    }
    
    /**
     * Update the notifications panel if open
     */
    updatePanel() {
        const panel = document.getElementById('notifications-panel');
        if (panel) {
            panel.innerHTML = this.getPanelHTML();
        }
    }
    
    /**
     * Get panel HTML content
     */
    getPanelHTML() {
        const hasUnread = this.unreadCount > 0;
        const hasNotifications = this.notifications.length > 0;
        
        return `
            <div class="notifications-header">
                <h4>
                    <i class="fas fa-bell"></i>
                    Notifications
                    ${hasUnread ? `<span class="unread-badge">${this.unreadCount}</span>` : ''}
                </h4>
                <div class="header-actions">
                    ${hasUnread ? '<button onclick="notificationsManager.markAllAsRead()" title="Mark all as read"><i class="fas fa-check-double"></i></button>' : ''}
                    ${hasNotifications ? '<button onclick="notificationsManager.clearAll()" title="Clear all"><i class="fas fa-trash"></i></button>' : ''}
                    <button onclick="notificationsManager.closePanel()" title="Close"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="notifications-list">
                ${hasNotifications ? this.getNotificationsHTML() : this.getEmptyStateHTML()}
            </div>
            ${hasNotifications ? `
                <div class="notifications-footer">
                    <span>${this.notifications.length} notification${this.notifications.length !== 1 ? 's' : ''}</span>
                    ${this.unreadCount > 0 ? `<span>${this.unreadCount} unread</span>` : ''}
                </div>
            ` : ''}
        `;
    }
    
    /**
     * Get notifications list HTML
     */
    getNotificationsHTML() {
        return this.notifications.map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'} ${notif.severity || ''}" 
                 onclick="notificationsManager.handleNotificationClick('${notif.id}')">
                <div class="notification-icon">
                    <i class="fas ${this.getIconForType(notif.type, notif.severity)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${notif.title}
                        ${!notif.read ? '<span class="unread-dot"></span>' : ''}
                    </div>
                    <div class="notification-message">${notif.message}</div>
                    <div class="notification-time">${this.formatTimeAgo(notif.time)}</div>
                </div>
                ${notif.actionable ? `
                    <div class="notification-actions">
                        ${notif.action?.buttons?.map(btn => `
                            <button class="action-btn ${btn.class || ''}" 
                                    onclick="event.stopPropagation(); notificationsManager.executeAction('${notif.id}', '${btn.id}')">
                                ${btn.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    /**
     * Get empty state HTML
     */
    getEmptyStateHTML() {
        return `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <h4>No notifications</h4>
                <p>You're all caught up!</p>
            </div>
        `;
    }
    
    /**
     * Handle notification click
     */
    handleNotificationClick(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
            this.markAsRead(id);
            
            // Handle different notification types
            switch(notif.type) {
                case 'alert':
                    if (notif.data?.farmId && window.zoomToFarm) {
                        window.zoomToFarm(notif.data.farmId);
                    }
                    break;
                case 'system':
                    // Handle system notifications
                    break;
            }
        }
    }
    
    /**
     * Execute notification action
     */
    executeAction(notifId, actionId) {
        const notif = this.notifications.find(n => n.id === notifId);
        if (notif?.action?.handlers?.[actionId]) {
            notif.action.handlers[actionId]();
            this.markAsRead(notifId);
        }
    }
    
    /**
     * Get icon for notification type
     */
    getIconForType(type, severity) {
        const icons = {
            alert: {
                critical: 'fa-exclamation-circle',
                high: 'fa-exclamation-triangle',
                medium: 'fa-exclamation',
                low: 'fa-info-circle',
                info: 'fa-info-circle'
            },
            system: {
                success: 'fa-check-circle',
                error: 'fa-times-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            },
            info: 'fa-bell'
        };
        
        return icons[type]?.[severity] || icons.info;
    }
    
    /**
     * Format time ago string
     */
    formatTimeAgo(date) {
        if (!date) return 'just now';
        
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return 'just now';
        if (diff < 3600) {
            const mins = Math.floor(diff / 60);
            return `${mins} minute${mins > 1 ? 's' : ''} ago`;
        }
        if (diff < 86400) {
            const hours = Math.floor(diff / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        if (diff < 604800) {
            const days = Math.floor(diff / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        
        return date.toLocaleDateString();
    }
    
    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    /**
     * Update notification badge
     */
    updateBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    /**
     * Refresh notifications from external sources
     */
    refreshNotifications() {
        // Check for new alerts
        if (window.alertsData && window.alertsData.length > 0) {
            this.addAlertNotifications(window.alertsData);
        }
        
        this.updateBadge();
    }
    
    /**
     * Add notification styles to document
     */
    addStyles() {
        if (document.getElementById('notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            /* Notifications Panel */
            .notifications-panel {
                position: fixed;
                width: 380px;
                max-height: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                z-index: 10000;
                overflow: hidden;
                animation: slideDown 0.2s ease;
                border: 1px solid rgba(0,0,0,0.05);
            }
            
            .notifications-header {
                padding: 15px 20px;
                background: linear-gradient(135deg, var(--primary-dark), var(--primary-color));
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notifications-header h4 {
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 16px;
            }
            
            .notifications-header .unread-badge {
                background: white;
                color: var(--primary-color);
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
            }
            
            .header-actions {
                display: flex;
                gap: 5px;
            }
            
            .header-actions button {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .header-actions button:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .notifications-list {
                max-height: 400px;
                overflow-y: auto;
                background: #f8fafc;
            }
            
            .notification-item {
                padding: 15px 20px;
                border-bottom: 1px solid #edf2f7;
                display: flex;
                gap: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                background: white;
            }
            
            .notification-item:hover {
                background: #f8fafc;
            }
            
            .notification-item.unread {
                background: #f0f7ff;
            }
            
            .notification-item.unread:hover {
                background: #e5f0ff;
            }
            
            .notification-item.critical {
                border-left: 3px solid #ef233c;
            }
            
            .notification-item.high {
                border-left: 3px solid #ff6b35;
            }
            
            .notification-item.medium {
                border-left: 3px solid #ffc107;
            }
            
            .notification-item.low, .notification-item.info {
                border-left: 3px solid #4caf50;
            }
            
            .notification-icon {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #f0f0f0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--primary-color);
                flex-shrink: 0;
            }
            
            .notification-content {
                flex: 1;
                min-width: 0;
            }
            
            .notification-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: #1e293b;
            }
            
            .unread-dot {
                width: 8px;
                height: 8px;
                background: var(--primary-color);
                border-radius: 50%;
                display: inline-block;
            }
            
            .notification-message {
                font-size: 13px;
                color: #64748b;
                margin-bottom: 6px;
                line-height: 1.4;
                word-break: break-word;
            }
            
            .notification-time {
                font-size: 11px;
                color: #94a3b8;
            }
            
            .notification-actions {
                margin-top: 8px;
                display: flex;
                gap: 8px;
            }
            
            .notification-actions .action-btn {
                padding: 4px 10px;
                font-size: 11px;
                border: 1px solid #e2e8f0;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .notification-actions .action-btn:hover {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            
            .notifications-footer {
                padding: 12px 20px;
                background: #f8fafc;
                border-top: 1px solid #edf2f7;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                color: #64748b;
            }
            
            .no-notifications {
                padding: 60px 20px;
                text-align: center;
                color: #94a3b8;
                background: white;
            }
            
            .no-notifications i {
                font-size: 48px;
                margin-bottom: 15px;
                color: #cbd5e1;
            }
            
            .no-notifications h4 {
                margin: 0 0 5px;
                color: #475569;
            }
            
            .no-notifications p {
                margin: 0;
                font-size: 13px;
            }
            
            /* Toast Notifications */
            .toast-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                min-width: 300px;
                max-width: 400px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                padding: 15px;
                gap: 12px;
                z-index: 10001;
                animation: slideIn 0.3s ease;
                border-left: 4px solid var(--primary-color);
            }
            
            .toast-notification.toast-success {
                border-left-color: #4caf50;
            }
            
            .toast-notification.toast-error {
                border-left-color: #f44336;
            }
            
            .toast-notification.toast-warning {
                border-left-color: #ff9800;
            }
            
            .toast-notification.toast-info {
                border-left-color: #2196f3;
            }
            
            .toast-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            }
            
            .toast-success .toast-icon {
                background: #e8f5e9;
                color: #4caf50;
            }
            
            .toast-error .toast-icon {
                background: #ffebee;
                color: #f44336;
            }
            
            .toast-warning .toast-icon {
                background: #fff3e0;
                color: #ff9800;
            }
            
            .toast-info .toast-icon {
                background: #e3f2fd;
                color: #2196f3;
            }
            
            .toast-content {
                flex: 1;
            }
            
            .toast-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 2px;
                color: #1e293b;
            }
            
            .toast-message {
                font-size: 13px;
                color: #64748b;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                font-size: 12px;
            }
            
            .toast-close:hover {
                color: #475569;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
            
            /* Badge animation */
            .notification-badge {
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    transform: scale(1);
                }
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Create global instance
const notificationsManager = new NotificationsManager();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    notificationsManager.init();
    
    // Listen for sync events
    window.addEventListener('kobo-sync-complete', (e) => {
        notificationsManager.addSyncNotification('success', e.detail);
    });
    
    window.addEventListener('kobo-sync-failed', () => {
        notificationsManager.addSyncNotification('error');
    });
});

// Export for global use
window.notificationsManager = notificationsManager;
window.markAllAsRead = () => notificationsManager.markAllAsRead();
window.toggleNotifications = () => notificationsManager.togglePanel();