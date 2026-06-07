async function loadUserAndProjects() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '../login.html';
        return;
    }
    currentUser = session.user;
    
    // Update user info in header
    const metadata = currentUser.user_metadata || {};
    const firstName = metadata.first_name || '';
    const lastName = metadata.last_name || '';
    const fullName = metadata.full_name || `${firstName} ${lastName}`.trim() || currentUser.email.split('@')[0];
    const avatarInitial = (firstName.charAt(0) || currentUser.email.charAt(0)).toUpperCase();
    
    document.getElementById('userName').textContent = fullName;
    document.getElementById('userAvatar').textContent = avatarInitial;
    
    // Get user's projects and role
    const { data: memberships, error } = await supabaseClient
        .from('project_members')
        .select('project_id, role, projects(*)')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');
    
    if (error) {
        console.error('Error loading memberships:', error);
        return;
    }
    
    if (memberships && memberships.length > 0) {
        allUserProjects = memberships;
        const isOwner = memberships.some(m => m.role === 'owner');
        currentUserRole = memberships[0].role;
        
        // Update role in header
        const roleDisplay = { 'owner': 'Owner', 'manager': 'Manager', 'validator': 'Validator', 'field_officer': 'Field Officer', 'viewer': 'Viewer' };
        document.getElementById('userRole').textContent = roleDisplay[currentUserRole] || 'User';
        
        // Add role badge
        const roleBadge = document.createElement('span');
        roleBadge.className = `role-badge ${currentUserRole}`;
        roleBadge.textContent = currentUserRole.replace('_', ' ').toUpperCase();
        const existingBadge = document.querySelector('.role-badge');
        if (existingBadge) existingBadge.remove();
        document.querySelector('.user-info').insertBefore(roleBadge, document.querySelector('.sync-btn'));
        
        // Get project ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        let projectIdFromUrl = urlParams.get('project');
        
        console.log('URL Project ID:', projectIdFromUrl);
        console.log('Available projects:', memberships.map(m => ({ id: m.projects.id, name: m.projects.name })));
        
        let targetProject = null;
        
        // If there's a project ID in URL
        if (projectIdFromUrl && projectIdFromUrl !== 'all') {
            // Find the project in memberships
            targetProject = memberships.find(m => m.projects.id === projectIdFromUrl);
            if (targetProject) {
                console.log('Found project from URL:', targetProject.projects.name);
            } else {
                console.log('Project not found in memberships, user may not have access');
                // Show access denied message
                document.getElementById('pageContent').innerHTML = `
                    <div class="alert-card" style="border-left-color: #dc2626; text-align: center; padding: 40px;">
                        <i class="fas fa-lock" style="font-size: 48px; color: #dc2626; margin-bottom: 16px;"></i>
                        <h3>Access Denied</h3>
                        <p>You don't have permission to view this project.</p>
                        <button onclick="window.location.href='Dashboard.html'" class="btn-primary" style="margin-top: 16px;">Go to My Projects</button>
                    </div>
                `;
                showLoading(false);
                return;
            }
        }
        
        // If no URL project or project not found, use last viewed or first
        if (!targetProject) {
            const lastViewed = localStorage.getItem(`lastProject_${currentUser.id}`);
            if (lastViewed && lastViewed !== 'all') {
                targetProject = memberships.find(m => m.projects.id === lastViewed);
            }
            if (!targetProject) {
                targetProject = memberships[0];
            }
            console.log('Using project:', targetProject.projects.name);
        }
        
        // For owners with multiple projects, show dropdown
        if (isOwner && memberships.length > 1) {
            document.getElementById('projectSelectorContainer').classList.remove('hidden');
            await populateProjectDropdown(memberships);
        }
        
        // Load the selected project
        if (targetProject) {
            currentViewMode = 'single';
            currentProject = targetProject.projects;
            document.getElementById('selectedProjectName').innerHTML = `📁 ${currentProject.name}`;
            await loadSingleProjectData(currentProject.id);
            localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
        }
        
        // Update URL to match current state
        const url = new URL(window.location);
        if (currentProject) {
            url.searchParams.set('project', currentProject.id);
        }
        window.history.replaceState({}, '', url);
        
        // Highlight selected dropdown item
        setTimeout(() => {
            const dropdownItems = document.querySelectorAll('.dropdown-item');
            dropdownItems.forEach(item => {
                if (currentProject && item.dataset.value === currentProject.id) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }, 100);
        
        updateNavigationLinks();
    } else {
        // No projects found
        document.getElementById('pageContent').innerHTML = `
            <div class="alert-card" style="text-align: center; padding: 40px;">
                <i class="fas fa-folder-open" style="font-size: 48px; color: #64748b; margin-bottom: 16px;"></i>
                <h3>No Projects Found</h3>
                <p>You don't have access to any projects yet.</p>
                <button onclick="window.location.href='../index.html'" class="btn-primary" style="margin-top: 16px;">Go to Project Selector</button>
            </div>
        `;
        showLoading(false);
    }
}