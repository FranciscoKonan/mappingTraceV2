// ===========================================
// AUTHENTICATION SYSTEM WITH SUPABASE - COMPLETE
// ===========================================

console.log('🔐 Auth module loading...');

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.supabase = null;
        this.initialized = false;
        
        // Wait for Supabase to be ready
        this.waitForSupabase();
    }

    waitForSupabase() {
        console.log('⏳ Auth: Waiting for Supabase...');
        
        if (window.supabase) {
            this.supabase = window.supabase;
            this.init();
        } else {
            // Listen for the custom event
            window.addEventListener('supabase-ready', () => {
                console.log('✅ Auth: Supabase ready event received');
                this.supabase = window.supabase;
                this.init();
            });
            
            // Also check periodically
            const checkInterval = setInterval(() => {
                if (window.supabase) {
                    clearInterval(checkInterval);
                    this.supabase = window.supabase;
                    this.init();
                }
            }, 200);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.supabase) {
                    console.error('❌ Auth: Supabase not available after timeout');
                }
            }, 10000);
        }
    }

    async init() {
        try {
            await this.checkSession();
            this.setupLoginForm();
            this.setupRegisterForm();
            this.setupLogoutHandler();
            this.initialized = true;
            console.log('✅ Auth system initialized');
        } catch (error) {
            console.error('❌ Auth system initialization failed:', error);
        }
    }

    async checkSession() {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not available');
            }
            
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) throw error;
            
            if (session) {
                console.log('👤 User session found:', session.user.email);
                this.currentUser = session.user;
                
                // Update UI with user info
                this.updateUserUI();
            } else {
                console.log('👤 No active session');
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            // Remove existing listeners
            const newForm = loginForm.cloneNode(true);
            if (loginForm.parentNode) {
                loginForm.parentNode.replaceChild(newForm, loginForm);
            }
            
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    }

    setupRegisterForm() {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            const newForm = registerForm.cloneNode(true);
            if (registerForm.parentNode) {
                registerForm.parentNode.replaceChild(newForm, registerForm);
            }
            
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    setupLogoutHandler() {
        // Handle logout via auth system
        document.querySelectorAll('a[href="#logout"], .logout-btn, #logoutBtn').forEach(el => {
            const newEl = el.cloneNode(true);
            if (el.parentNode) {
                el.parentNode.replaceChild(newEl, el);
            }
            
            newEl.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }

    async handleLogin() {
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const rememberMe = document.getElementById('rememberMe')?.checked;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        const submitBtn = document.querySelector('#loginForm .auth-btn');
        if (!submitBtn) return;
        
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        submitBtn.disabled = true;

        try {
            if (!this.supabase) {
                throw new Error('Supabase client not available');
            }
            
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;

            // Format user data for storage
            const userMetadata = data.user.user_metadata || {};
            const email_user = data.user.email || 'User';
            
            // Get full name with proper formatting
            let fullName = userMetadata.full_name || 
                          userMetadata.name || 
                          `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                          email_user.split('@')[0] || 
                          'User';
            
            // Capitalize each word
            fullName = fullName.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ')
                .trim();
            
            // Get role
            let role = userMetadata.role || 'user';
            const roleDisplay = {
                'field_officer': 'Field Officer',
                'validator': 'Validator',
                'admin': 'Administrator',
                'viewer': 'Viewer',
                'user': 'User'
            };
            const displayRole = roleDisplay[role] || 
                               role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // Get initials
            const initials = fullName
                .split(' ')
                .map(n => n.charAt(0))
                .join('')
                .toUpperCase()
                .substring(0, 2) || 'U';
            
            // Store user info
            const userData = {
                fullName: fullName,
                role: displayRole,
                avatar: initials,
                email: data.user.email
            };
            
            localStorage.setItem('mappingtrace_user', JSON.stringify(userData));
            
            // Store session token if remember me is checked
            if (rememberMe && data.session) {
                localStorage.setItem('supabase.auth.token', JSON.stringify({
                    currentSession: data.session,
                    expiresAt: data.session.expires_at
                }));
            }

            this.showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'Dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'Login failed';
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Please verify your email first';
            } else if (error.message.includes('rate limit')) {
                errorMessage = 'Too many attempts. Please try again later.';
            } else {
                errorMessage = error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleRegister() {
        const firstName = document.getElementById('firstName')?.value;
        const lastName = document.getElementById('lastName')?.value;
        const email = document.getElementById('email')?.value;
        const organization = document.getElementById('organization')?.value;
        const role = document.getElementById('role')?.value;
        const password = document.getElementById('password')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        const terms = document.getElementById('terms')?.checked;

        // Validation
        if (!firstName || !lastName || !email || !role || !password || !confirmPassword) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (!terms) {
            this.showNotification('Please agree to the terms and conditions', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Password strength validation
        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters long', 'error');
            return;
        }

        const submitBtn = document.querySelector('#registerForm .auth-btn');
        if (!submitBtn) return;
        
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        submitBtn.disabled = true;

        try {
            if (!this.supabase) {
                throw new Error('Supabase client not available');
            }
            
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: `${firstName} ${lastName}`,
                        role: role,
                        organization: organization || ''
                    },
                    emailRedirectTo: window.location.origin + '/Dashboard.html'
                }
            });

            if (authError) throw authError;

            if (authData?.user && authData?.session) {
                // Auto-logged in (email confirmation disabled)
                
                // Format user data for storage
                const userMetadata = authData.user.user_metadata || {};
                const email_user = authData.user.email || 'User';
                
                // Get full name
                let fullName = userMetadata.full_name || 
                              userMetadata.name || 
                              `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                              email_user.split('@')[0] || 
                              'User';
                
                // Capitalize each word
                fullName = fullName.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ')
                    .trim();
                
                // Get role
                let userRole = userMetadata.role || 'user';
                const roleDisplay = {
                    'field_officer': 'Field Officer',
                    'validator': 'Validator',
                    'admin': 'Administrator',
                    'viewer': 'Viewer',
                    'user': 'User'
                };
                const displayRole = roleDisplay[userRole] || 
                                   userRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                // Get initials
                const initials = fullName
                    .split(' ')
                    .map(n => n.charAt(0))
                    .join('')
                    .toUpperCase()
                    .substring(0, 2) || 'U';
                
                localStorage.setItem('mappingtrace_user', JSON.stringify({
                    fullName: fullName,
                    role: displayRole,
                    avatar: initials,
                    email: authData.user.email
                }));
                
                this.showNotification('Account created! Redirecting to dashboard...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'Dashboard.html';
                }, 2000);
                
            } else {
                // Email confirmation required
                this.showNotification('Account created! Please check your email for verification.', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html?registered=true';
                }, 3000);
            }

        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'Registration failed';
            if (error.message.includes('User already registered')) {
                errorMessage = 'Email already registered';
                
                // Offer to redirect to login
                setTimeout(() => {
                    if (confirm('Email already registered. Go to login page?')) {
                        window.location.href = 'login.html';
                    }
                }, 100);
            } else if (error.message.includes('Password should be at least 6 characters')) {
                errorMessage = 'Password must be at least 6 characters';
            } else if (error.message.includes('rate limit')) {
                errorMessage = 'Too many attempts. Please try again later.';
            } else {
                errorMessage = error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async logout() {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not available');
            }
            
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            
            // Clear ALL auth-related storage
            localStorage.removeItem('mappingtrace_user');
            localStorage.removeItem('supabase.auth.token');
            sessionStorage.clear();
            
            this.showNotification('Logged out successfully', 'info');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Logout failed: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Use global notification if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else if (window.notification && typeof window.notification[type] === 'function') {
            window.notification[type](message);
        } else {
            console.log(`[${type}] ${message}`);
            // Fallback notification
            const toast = document.createElement('div');
            const colors = {
                success: '#4CAF50',
                error: '#F44336',
                warning: '#FFC107',
                info: '#2196F3'
            };
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${colors[type] || colors.info};
                color: white;
                border-radius: 8px;
                z-index: 99999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                animation: slideIn 0.3s ease;
                font-family: 'Inter', sans-serif;
                font-size: 14px;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        if (!this.currentUser) return null;
        
        return {
            id: this.currentUser.id,
            email: this.currentUser.email,
            role: this.currentUser.user_metadata?.role || 'user'
        };
    }

    hasRole(requiredRole) {
        if (!this.currentUser) return false;
        
        const userRole = this.currentUser.user_metadata?.role || 'user';
        const roles = {
            'admin': 4,
            'field_officer': 3,
            'validator': 2,
            'viewer': 1
        };
        
        const userRoleLevel = roles[userRole] || 0;
        const requiredRoleLevel = roles[requiredRole] || 0;
        
        return userRoleLevel >= requiredRoleLevel;
    }

    updateUserUI() {
        // Try to get from localStorage first
        const cachedUser = localStorage.getItem('mappingtrace_user');
        if (cachedUser) {
            try {
                const user = JSON.parse(cachedUser);
                const userNameEl = document.querySelector('.user-name');
                const userRoleEl = document.querySelector('.user-role');
                const userAvatarEl = document.querySelector('.user-avatar');
                
                if (userNameEl) userNameEl.textContent = user.fullName || 'User';
                if (userRoleEl) userRoleEl.textContent = user.role || 'User';
                if (userAvatarEl) userAvatarEl.textContent = user.avatar || 'U';
                return;
            } catch (e) {}
        }
        
        // Fallback to user metadata
        if (!this.currentUser) return;
        
        const fullName = this.currentUser.user_metadata?.full_name || 
                        this.currentUser.email?.split('@')[0] || 
                        'User';
        const role = this.currentUser.user_metadata?.role || 'user';
        const displayRole = role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const initials = fullName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) || 'U';
        
        const userNameEl = document.querySelector('.user-name');
        const userRoleEl = document.querySelector('.user-role');
        const userAvatarEl = document.querySelector('.user-avatar');
        
        if (userNameEl) userNameEl.textContent = fullName;
        if (userRoleEl) userRoleEl.textContent = displayRole;
        if (userAvatarEl) userAvatarEl.textContent = initials;
    }

    async getAccessToken() {
        try {
            if (!this.supabase) return null;
            
            const { data: { session }, error } = await this.supabase.auth.getSession();
            if (error) throw error;
            return session?.access_token;
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }

    getUserId() {
        return this.currentUser?.id;
    }

    async resetPassword(email) {
        try {
            if (!this.supabase) throw new Error('Supabase client not available');
            
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password.html'
            });
            
            if (error) throw error;
            
            this.showNotification('Password reset email sent. Check your inbox.', 'success');
            
        } catch (error) {
            console.error('Password reset error:', error);
            this.showNotification('Failed to send reset email: ' + error.message, 'error');
        }
    }

    async updatePassword(newPassword) {
        try {
            if (!this.supabase) throw new Error('Supabase client not available');
            
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            
            this.showNotification('Password updated successfully', 'success');
            
        } catch (error) {
            console.error('Password update error:', error);
            this.showNotification('Failed to update password: ' + error.message, 'error');
        }
    }

    validatePassword(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };

        const score = Object.values(requirements).filter(Boolean).length;
        let strength = 'weak';
        let strengthColor = '#ef233c';
        
        if (score >= 5) {
            strength = 'strong';
            strengthColor = '#4caf50';
        } else if (score >= 4) {
            strength = 'good';
            strengthColor = '#8bc34a';
        } else if (score >= 3) {
            strength = 'fair';
            strengthColor = '#ffc107';
        }

        return {
            requirements,
            score,
            strength,
            strengthColor,
            isValid: score >= 4
        };
    }
}

// ===========================================
// GLOBAL INITIALIZATION
// ===========================================

let authInstance = null;

// Create AuthSystem after a small delay to ensure Supabase is ready
setTimeout(() => {
    authInstance = new AuthSystem();
    window.auth = authInstance;
    console.log('✅ Auth instance created and exposed globally');
}, 500);

// Global logout function for easy access
window.handleLogout = function() {
    if (window.auth) {
        window.auth.logout();
    } else {
        console.warn('Auth system not available');
        window.location.href = 'login.html';
    }
};

// ===========================================
// PROTECTED PAGE CHECK
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    // List of pages that don't require authentication
    const publicPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html'];
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'Dashboard.html';
    
    // If not on a public page, check authentication
    if (!publicPages.includes(currentPage)) {
        // Wait a bit for auth to initialize
        setTimeout(() => {
            if (!window.auth?.isAuthenticated()) {
                console.log('🔒 Not authenticated, redirecting to login');
                
                // Show notification if available
                if (window.showNotification) {
                    window.showNotification('Please log in to access this page', 'warning');
                } else if (window.notification) {
                    window.notification.warning('Please log in to access this page');
                }
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            }
        }, 1000);
    }
});

// Add animation styles if not present
if (!document.querySelector('#auth-animations')) {
    const style = document.createElement('style');
    style.id = 'auth-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ Auth module loaded and ready');
