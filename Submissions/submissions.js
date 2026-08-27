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
        document.body.style.overflow =
            sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    } else {
        sidebar.classList.toggle('collapsed');

        const icon = sidebarToggle?.querySelector('i');

        if (icon) {
            icon.className = sidebar.classList.contains('collapsed')
                ? 'fas fa-chevron-right'
                : 'fas fa-chevron-left';
        }

        localStorage.setItem(
            'sidebarCollapsed',
            sidebar.classList.contains('collapsed')
        );
    }
}

function closeMobileSidebar() {
    sidebar?.classList.remove('mobile-open');
    sidebarOverlay?.classList.remove('active');
    document.body.style.overflow = '';
}

window.toggleMobileSidebar = toggleSidebar;
window.closeMobileSidebar = closeMobileSidebar;

burgerBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
});

sidebarToggle?.addEventListener('click', function (e) {
    e.stopPropagation();

    if (window.innerWidth > 768) {
        toggleSidebar();
    }
});

sidebarOverlay?.addEventListener('click', closeMobileSidebar);

if (window.innerWidth > 768 && sidebar) {
    const saved = localStorage.getItem('sidebarCollapsed');

    if (saved === 'true') {
        sidebar.classList.add('collapsed');

        const icon = sidebarToggle?.querySelector('i');

        if (icon) {
            icon.className = 'fas fa-chevron-right';
        }
    }
}

window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
        closeMobileSidebar();
    }
});


// ===========================================
// SUBMISSIONS - WORKFLOW JAVASCRIPT
// ===========================================

console.log('🚀 Submissions page initializing...');


// ===========================================
// SUPABASE CONFIGURATION
// ===========================================

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';


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

let currentProjectRole = null;

let duplicateFarmIds = new Set();


// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', async function () {

    console.log('📌 DOM Content Loaded');

    try {

        if (!window.supabase) {
            console.error('❌ Supabase library not found');
            showNotification(
                'Supabase library is not loaded.',
                'error'
            );
            return;
        }

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

        await loadUserAndProjects();

        setupDropdown();

        setupEventListeners();

    } catch (error) {

        console.error(
            '❌ Initialization error:',
            error
        );

        showNotification(
            error.message || 'Initialization failed',
            'error'
        );

    }

});


// ===========================================
// LOAD USER + PROJECTS
// ===========================================

async function loadUserAndProjects() {

    showLoading(true);

    try {

        const {
            data: { session },
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!session) {

            window.location.href =
                '../login.html';

            return;
        }

        currentUser = session.user;

        console.log(
            '👤 Current user:',
            currentUser.email
        );


        // -------------------------------------------
        // USER PROFILE
        // -------------------------------------------

        const { data: profile } =
            await supabaseClient
                .from('user_profiles')
                .select('first_name, email')
                .eq('id', currentUser.id)
                .maybeSingle();

        const firstName =
            profile?.first_name || '';

        const displayName =
            firstName ||
            currentUser.email.split('@')[0];

        const userName =
            document.getElementById('userName');

        const userAvatar =
            document.getElementById('userAvatar');

        if (userName) {
            userName.textContent =
                displayName;
        }

        if (userAvatar) {

            userAvatar.textContent =
                (
                    firstName.charAt(0) ||
                    currentUser.email.charAt(0)
                ).toUpperCase();

        }


        // -------------------------------------------
        // PROJECT MEMBERSHIPS
        // -------------------------------------------

        const {
            data: memberships,
            error: membershipError
        } = await supabaseClient
            .from('project_members')
            .select('project_id, role, projects(*)')
            .eq('user_id', currentUser.id)
            .eq('status', 'active');

        if (membershipError) {
            throw membershipError;
        }

        if (
            !memberships ||
            memberships.length === 0
        ) {

            showNotification(
                'You are not assigned to any active project.',
                'warning'
            );

            return;
        }

        allUserProjects =
            memberships;


        // -------------------------------------------
        // DISPLAY ROLE
        // -------------------------------------------

        const firstMembership =
            memberships[0];

        const roleText =
            String(firstMembership.role || '')
                .replace(/_/g, ' ')
                .toUpperCase();

        const userRole =
            document.getElementById('userRole');

        if (userRole) {
            userRole.textContent =
                roleText;
        }


        // -------------------------------------------
        // ROLE BADGE
        // -------------------------------------------

        const userInfo =
            document.querySelector('.user-info');

        const syncButton =
            document.querySelector('.sync-btn');

        if (
            userInfo &&
            !userInfo.querySelector('.role-badge')
        ) {

            const roleBadge =
                document.createElement('span');

            roleBadge.className =
                `role-badge ${firstMembership.role}`;

            roleBadge.textContent =
                String(firstMembership.role || '')
                    .replace(/_/g, ' ')
                    .toUpperCase();

            if (syncButton) {
                userInfo.insertBefore(
                    roleBadge,
                    syncButton
                );
            } else {
                userInfo.appendChild(
                    roleBadge
                );
            }

        }


        // -------------------------------------------
        // DETERMINE PROJECT
        // -------------------------------------------

        const urlParams =
            new URLSearchParams(
                window.location.search
            );

        const projectIdFromUrl =
            urlParams.get('project');

        let targetProject = null;


        if (
            projectIdFromUrl &&
            projectIdFromUrl !== 'all'
        ) {

            targetProject =
                memberships.find(
                    m =>
                        m.projects &&
                        m.projects.id ===
                        projectIdFromUrl
                );

        }


        if (!targetProject) {

            const lastViewed =
                localStorage.getItem(
                    `lastProject_${currentUser.id}`
                );

            if (lastViewed) {

                targetProject =
                    memberships.find(
                        m =>
                            m.projects &&
                            m.projects.id ===
                            lastViewed
                    );

            }

        }


        if (!targetProject) {
            targetProject =
                memberships[0];
        }


        // -------------------------------------------
        // PROJECT SELECTOR
        // -------------------------------------------

        const isOwner =
            memberships.some(
                m => m.role === 'owner'
            );

        if (
            isOwner &&
            memberships.length > 1
        ) {

            const selector =
                document.getElementById(
                    'projectSelectorContainer'
                );

            if (selector) {
                selector.classList.remove(
                    'hidden'
                );
            }

            await populateDropdown(
                memberships
            );

        }


        // -------------------------------------------
        // SET CURRENT PROJECT
        // -------------------------------------------

        currentProject =
            targetProject.projects;

        currentProjectRole =
            targetProject.role;


        const selectedProjectName =
            document.getElementById(
                'selectedProjectName'
            );

        if (selectedProjectName) {

            selectedProjectName.innerHTML =
                `📁 ${escapeHtml(
                    currentProject.name
                )}`;

        }


        const projectBadge =
            document.getElementById(
                'projectBadge'
            );

        if (projectBadge) {

            projectBadge.textContent =
                currentProject.name;

        }


        // -------------------------------------------
        // NAVIGATION
        // -------------------------------------------

        updateNavigationLinks();


        // -------------------------------------------
        // LOAD SUBMISSIONS
        // -------------------------------------------

        await loadSubmissions(
            currentProject.id
        );


        localStorage.setItem(
            `lastProject_${currentUser.id}`,
            currentProject.id
        );


        // -------------------------------------------
        // UPDATE URL
        // -------------------------------------------

        const url =
            new URL(window.location.href);

        url.searchParams.set(
            'project',
            currentProject.id
        );

        window.history.replaceState(
            {},
            '',
            url
        );


        // -------------------------------------------
        // HEADER
        // -------------------------------------------

        const headerTitle =
            document.querySelector(
                '.header-title h1'
            );

        if (headerTitle) {

            headerTitle.innerHTML =
                `Submissions
                <span style="
                    font-size:14px;
                    background:#e2e8f0;
                    padding:2px 10px;
                    border-radius:20px;
                ">
                    ${escapeHtml(
                        currentProject.name
                    )}
                </span>`;

        }


    } catch (error) {

        console.error(
            '❌ Failed loading user/projects:',
            error
        );

        showNotification(
            error.message ||
            'Unable to load project information.',
            'error'
        );

    } finally {

        showLoading(false);

    }

}


// ===========================================
// NAVIGATION
// ===========================================

function updateNavigationLinks() {

    const queryString =
        currentProject
            ? `?project=${currentProject.id}`
            : '';

    const dashboard =
        document.querySelector(
            'a[data-page="dashboard"]'
        );

    if (dashboard) {
        dashboard.href =
            `../Dashboard.html${queryString}`;
    }


    const liveMapping =
        document.querySelector(
            'a[data-page="live-mapping"]'
        );

    if (liveMapping) {
        liveMapping.href =
            `../LiveMapping/live-mapping.html${queryString}`;
    }


    const qualityAlerts =
        document.querySelector(
            'a[data-page="quality-alerts"]'
        );

    if (qualityAlerts) {
        qualityAlerts.href =
            `../QualityAlerts/quality-alerts.html${queryString}`;
    }


    const exports =
        document.querySelector(
            'a[data-page="exports"]'
        );

    if (exports) {
        exports.href =
            `../Exports/exports.html${queryString}`;
    }


    const dataManagement =
        document.getElementById(
            'dataMgmtLink'
        );

    if (dataManagement) {
        dataManagement.href =
            `../DataManagement.html${queryString}`;
    }

}


// ===========================================
// PROJECT DROPDOWN
// ===========================================

async function populateDropdown(
    memberships
) {

    const container =
        document.getElementById(
            'dropdownItems'
        );

    if (!container) return;


    let html =
        `<div
            class="dropdown-item"
            data-value="all">
            📊 ALL PROJECTS
        </div>`;


    for (const m of memberships) {

        if (!m.projects) continue;

        html +=
            `<div
                class="dropdown-item"
                data-value="${escapeHtml(
                    m.projects.id
                )}">
                📁 ${escapeHtml(
                    m.projects.name
                )}
            </div>`;

    }


    container.innerHTML =
        html;


    document
        .querySelectorAll('.dropdown-item')
        .forEach(item => {

            item.addEventListener(
                'click',
                async () => {

                    const value =
                        item.dataset.value;

                    const selectedName =
                        document.getElementById(
                            'selectedProjectName'
                        );

                    if (selectedName) {

                        selectedName.innerHTML =
                            value === 'all'
                                ? '📊 ALL PROJECTS'
                                : `📁 ${
                                    escapeHtml(
                                        item.textContent.trim()
                                    )
                                }`;

                    }


                    document
                        .getElementById(
                            'dropdownMenu'
                        )
                        ?.classList.remove(
                            'show'
                        );


                    if (value === 'all') {

                        currentProject =
                            null;

                        currentProjectRole =
                            null;

                        await loadAllProjectsSubmissions();

                    } else {

                        const selected =
                            allUserProjects.find(
                                p =>
                                    p.projects &&
                                    p.projects.id ===
                                    value
                            );

                        if (selected) {

                            currentProject =
                                selected.projects;

                            currentProjectRole =
                                selected.role;

                            const projectBadge =
                                document.getElementById(
                                    'projectBadge'
                                );

                            if (projectBadge) {
                                projectBadge.textContent =
                                    currentProject.name;
                            }

                            await loadSubmissions(
                                value
                            );

                            localStorage.setItem(
                                `lastProject_${currentUser.id}`,
                                value
                            );

                            updateNavigationLinks();

                            const headerTitle =
                                document.querySelector(
                                    '.header-title h1'
                                );

                            if (headerTitle) {

                                headerTitle.innerHTML =
                                    `Submissions
                                    <span style="
                                        font-size:14px;
                                        background:#e2e8f0;
                                        padding:2px 10px;
                                        border-radius:20px;
                                    ">
                                        ${escapeHtml(
                                            currentProject.name
                                        )}
                                    </span>`;

                            }

                        }

                    }


                    const url =
                        new URL(
                            window.location.href
                        );

                    url.searchParams.set(
                        'project',
                        value
                    );

                    window.history.pushState(
                        {},
                        '',
                        url
                    );


                    document
                        .querySelectorAll(
                            '.dropdown-item'
                        )
                        .forEach(
                            i =>
                                i.classList.remove(
                                    'selected'
                                )
                        );

                    item.classList.add(
                        'selected'
                    );

                }
            );

        });

}


// ===========================================
// DROPDOWN
// ===========================================

function setupDropdown() {

    const selected =
        document.getElementById(
            'dropdownSelected'
        );

    const menu =
        document.getElementById(
            'dropdownMenu'
        );

    const search =
        document.getElementById(
            'projectSearch'
        );


    if (!selected || !menu) {
        return;
    }


    selected.addEventListener(
        'click',
        function (e) {

            e.stopPropagation();

            menu.classList.toggle(
                'show'
            );

            if (
                menu.classList.contains(
                    'show'
                )
            ) {

                if (search) {

                    search.value = '';

                    filterDropdown('');

                    search.focus();

                }

            }

        }
    );


    search?.addEventListener(
        'input',
        function (e) {

            filterDropdown(
                e.target.value
                    .toLowerCase()
            );

        }
    );


    document.addEventListener(
        'click',
        function () {

            menu.classList.remove(
                'show'
            );

        }
    );

}


function filterDropdown(term) {

    document
        .querySelectorAll(
            '.dropdown-item'
        )
        .forEach(item => {

            item.style.display =
                item.textContent
                    .toLowerCase()
                    .includes(term)
                    ? 'block'
                    : 'none';

        });

}


// ===========================================
// LOAD ALL PROJECTS
// ===========================================

async function loadAllProjectsSubmissions() {

    showLoading(true);

    try {

        let allFarms = [];

        duplicateFarmIds =
            new Set();


        for (
            const membership
            of allUserProjects
        ) {

            if (!membership.projects) {
                continue;
            }


            const {
                data: farms,
                error
            } =
                await supabaseClient
                    .from('farms')
                    .select('*')
                    .eq(
                        'project_id',
                        membership.projects.id
                    );


            if (error) {

                console.error(
                    'Error loading project farms:',
                    error
                );

                continue;

            }


            if (farms) {

                allFarms =
                    allFarms.concat(
                        farms
                    );

            }

        }


        // Duplicate alerts for all projects
        const {
            data: duplicateAlerts,
            error: duplicateError
        } =
            await supabaseClient
                .from('farm_duplicate_alerts')
                .select(
                    'farm_id, project_id, alert_type, duplicate_count'
                );


        if (!duplicateError) {

            duplicateFarmIds =
                new Set(
                    (duplicateAlerts || [])
                        .map(a => a.farm_id)
                );

        }


        processSubmissionsData(
            allFarms
        );


        const headerTitle =
            document.querySelector(
                '.header-title h1'
            );

        if (headerTitle) {

            headerTitle.innerHTML =
                `Submissions
                <span style="
                    font-size:14px;
                    background:#e2e8f0;
                    padding:2px 10px;
                    border-radius:20px;
                ">
                    ALL PROJECTS
                </span>`;

        }


        const projectBadge =
            document.getElementById(
                'projectBadge'
            );

        if (projectBadge) {
            projectBadge.textContent =
                'ALL PROJECTS';
        }


    } catch (error) {

        console.error(
            '❌ Error loading all projects:',
            error
        );

        showNotification(
            'Unable to load all projects.',
            'error'
        );

    } finally {

        showLoading(false);

    }

}


// ===========================================
// LOAD PROJECT SUBMISSIONS
// ===========================================

async function loadSubmissions(
    projectId
) {

    showLoading(true);

    try {

        const [
            farmsResult,
            duplicateResult
        ] =
            await Promise.all([

                supabaseClient
                    .from('farms')
                    .select('*')
                    .eq(
                        'project_id',
                        projectId
                    )
                    .order(
                        'created_at',
                        {
                            ascending: false
                        }
                    ),

                supabaseClient
                    .from(
                        'farm_duplicate_alerts'
                    )
                    .select(
                        'farm_id, alert_type, duplicate_count'
                    )
                    .eq(
                        'project_id',
                        projectId
                    )

            ]);


        const {
            data: farms,
            error
        } =
            farmsResult;


        const {
            data: duplicateAlerts,
            error: duplicateError
        } =
            duplicateResult;


        duplicateFarmIds =
            new Set(
                (duplicateAlerts || [])
                    .map(
                        a => a.farm_id
                    )
            );


        if (duplicateError) {

            console.warn(
                '⚠️ Duplicate alerts unavailable:',
                duplicateError
            );

        }


        if (error) {

            console.error(
                '❌ Error loading submissions:',
                error
            );

            showNotification(
                'Error loading submissions.',
                'error'
            );

            allSubmissions = [];

            processSubmissionsData([]);

        } else {

            processSubmissionsData(
                farms || []
            );

        }

    } catch (error) {

        console.error(
            '❌ loadSubmissions error:',
            error
        );

        showNotification(
            error.message ||
            'Unable to load submissions.',
            'error'
        );

    } finally {

        showLoading(false);

    }

}


// ===========================================
// PROCESS FARM DATA
// ===========================================

function processSubmissionsData(
    farms
) {

    allSubmissions =
        (farms || []).map(
            farm => {

                const workflowState =
                    farm.workflow_state ||
                    (
                        farm.status === 'validated'
                            ? 'validated'
                            : farm.status === 'rejected'
                                ? 'rejected'
                                : 'enumerator_review'
                    );


                return {

                    id: farm.id,

                    farmer_id:
                        farm.farmer_id ||
                        String(
                            farm.id
                        ).slice(0, 8),

                    farmer_name:
                        farm.farmer_name ||
                        'Unknown Farmer',

                    cooperative:
                        farm.cooperative ||
                        'Unassigned',

                    supplier:
                        farm.supplier ||
                        'Unknown',

                    area:
                        parseFloat(
                            farm.area
                        ) || 0,

                    status:
                        farm.status ||
                        'pending',

                    workflow_state:
                        workflowState,

                    enumerator:
                        farm.enumerator ||
                        'N/A',

                    created_at:
                        farm.created_at,

                    geometry:
                        farm.geometry,

                    farm_code:
                        farm.farm_code ||
                        farm.plot_code ||
                        null,

                    plot_code:
                        farm.plot_code ||
                        null,

                    self_checked_by:
                        farm.self_checked_by ||
                        null,

                    self_checked_at:
                        farm.self_checked_at ||
                        null,

                    self_check_role:
                        farm.self_check_role ||
                        null,

                    self_check_reason:
                        farm.self_check_reason ||
                        null,

                    field_officer_checked_by:
                        farm.field_officer_checked_by ||
                        null,

                    field_officer_checked_at:
                        farm.field_officer_checked_at ||
                        null,

                    gis_checked_by:
                        farm.gis_checked_by ||
                        null,

                    gis_checked_at:
                        farm.gis_checked_at ||
                        null,

                    final_validated_by:
                        farm.final_validated_by ||
                        null,

                    final_validated_at:
                        farm.final_validated_at ||
                        null,

                    correction_reason:
                        farm.correction_reason ||
                        null,

                    rejection_reason:
                        farm.rejection_reason ||
                        null,

                    duplicate_alert:
                        duplicateFarmIds.has(
                            farm.id
                        )

                };

            }
        );


    updateFilterOptions();

    applyFilters();

}


// ===========================================
// FILTER OPTIONS
// ===========================================

function updateFilterOptions() {

    const suppliers =
        [
            ...new Set(
                allSubmissions
                    .map(
                        s => s.supplier
                    )
                    .filter(Boolean)
            )
        ];


    const supplierSelect =
        document.getElementById(
            'supplierFilter'
        );


    if (!supplierSelect) {
        return;
    }


    supplierSelect.innerHTML =
        '<option value="all">All Suppliers</option>' +
        suppliers
            .map(
                supplier =>
                    `<option value="${escapeHtml(
                        supplier
                    )}">
                        ${escapeHtml(
                            supplier
                        )}
                    </option>`
            )
            .join('');

}


// ===========================================
// FILTERS
// ===========================================

function applyFilters() {

    const searchTerm =
        document.getElementById(
            'searchInput'
        )?.value
            ?.toLowerCase()
            ?.trim() || '';


    const supplier =
        document.getElementById(
            'supplierFilter'
        )?.value ||
        'all';


    const workflow =
        document.getElementById(
            'statusFilter'
        )?.value ||
        'all';


    filteredSubmissions =
        allSubmissions.filter(
            submission => {

                const searchable =
                    [
                        submission.farmer_name,
                        submission.farmer_id,
                        submission.cooperative,
                        submission.supplier,
                        submission.enumerator,
                        submission.farm_code
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();


                if (
                    searchTerm &&
                    !searchable.includes(
                        searchTerm
                    )
                ) {
                    return false;
                }


                if (
                    supplier !== 'all' &&
                    submission.supplier !==
                        supplier
                ) {
                    return false;
                }


                if (
                    workflow !== 'all' &&
                    submission.workflow_state !==
                        workflow
                ) {
                    return false;
                }


                return true;

            }
        );


    // -------------------------------------------
    // SORT
    // -------------------------------------------

    filteredSubmissions.sort(
        (a, b) => {

            let valueA =
                a[sortColumn];

            let valueB =
                b[sortColumn];


            if (
                sortColumn ===
                'created_at'
            ) {

                valueA =
                    new Date(
                        valueA || 0
                    );

                valueB =
                    new Date(
                        valueB || 0
                    );

            } else if (
                sortColumn ===
                'area'
            ) {

                valueA =
                    parseFloat(
                        valueA
                    ) || 0;

                valueB =
                    parseFloat(
                        valueB
                    ) || 0;

            } else {

                valueA =
                    String(
                        valueA || ''
                    ).toLowerCase();

                valueB =
                    String(
                        valueB || ''
                    ).toLowerCase();

            }


            if (
                valueA <
                valueB
            ) {

                return sortDirection ===
                    'asc'
                    ? -1
                    : 1;

            }


            if (
                valueA >
                valueB
            ) {

                return sortDirection ===
                    'asc'
                    ? 1
                    : -1;

            }


            return 0;

        }
    );


    updateStats();

    currentPage = 1;

    renderTable();

    updatePagination();

}


// ===========================================
// OPERATIONAL WORKFLOW COUNTERS
// ===========================================

function updateStats() {

    const counts = {

        selfCheck: 0,

        fieldOfficer: 0,

        gis: 0,

        final: 0,

        correction: 0,

        duplicates: 0

    };


    filteredSubmissions.forEach(
        submission => {

            const state =
                submission.workflow_state ||
                'enumerator_review';


            if (
                state === 'submitted' ||
                state === 'enumerator_review'
            ) {
                counts.selfCheck++;
            }


            if (
                state ===
                'field_officer_review'
            ) {
                counts.fieldOfficer++;
            }


            if (
                state ===
                'gis_compliance_review'
            ) {
                counts.gis++;
            }


            if (
                state ===
                'final_validation'
            ) {
                counts.final++;
            }


            if (
                state ===
                'correction_required'
            ) {
                counts.correction++;
            }


            if (
                submission.duplicate_alert
            ) {
                counts.duplicates++;
            }

        }
    );


    setText(
        'selfCheckCount',
        counts.selfCheck
    );

    setText(
        'fieldOfficerCount',
        counts.fieldOfficer
    );

    setText(
        'gisCount',
        counts.gis
    );

    setText(
        'finalCount',
        counts.final
    );

    setText(
        'correctionCount',
        counts.correction
    );

    setText(
        'duplicateCount',
        counts.duplicates
    );


    setText(
        'totalSubmissions',
        allSubmissions.length
    );

    setText(
        'totalCount',
        filteredSubmissions.length
    );

}


// ===========================================
// WORKFLOW LABEL
// ===========================================

function workflowLabel(
    state
) {

    const labels = {

        submitted:
            'Submitted',

        enumerator_review:
            'To Self-Check',

        field_officer_review:
            'Field Officer Review',

        gis_compliance_review:
            'GIS / Compliance',

        final_validation:
            'Final Validation',

        correction_required:
            'Correction Required',

        validated:
            'Validated',

        rejected:
            'Rejected'

    };


    return (
        labels[state] ||
        'To Self-Check'
    );

}


// ===========================================
// CURRENT ROLE
// ===========================================

function currentRole() {

    return String(
        currentProjectRole ||
        document.getElementById(
            'userRole'
        )?.textContent ||
        ''
    )
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');

}


// ===========================================
// WORKFLOW ACTIONS
// ===========================================

function workflowActions(
    submission
) {

    const state =
        submission.workflow_state ||
        'enumerator_review';

    const role =
        currentRole();

    const buttons = [];


    // -------------------------------------------
    // ENUMERATOR REVIEW
    // -------------------------------------------

    if (
        state === 'submitted' ||
        state === 'enumerator_review'
    ) {

        // Enumerator normal self-check
        if (
            role === 'enumerator'
        ) {

            buttons.push(`
                <button
                    class="action-btn workflow-next"
                    onclick="
                        window.transitionWorkflow(
                            '${submission.id}',
                            'field_officer_review'
                        )
                    "
                    title="Complete self-check">
                    <i class="fas fa-check"></i>
                    Self-Check Complete
                </button>
            `);

        }


        // Field Officer override
        if (
            [
                'field_officer',
                'owner',
                'manager',
                'super_manager'
            ].includes(role)
        ) {

            buttons.push(`
                <button
                    class="action-btn takeover"
                    onclick="
                        window.fieldOfficerTakeover(
                            '${submission.id}'
                        )
                    "
                    title="Take over this review">
                    <i class="fas fa-user-shield"></i>
                    Take Over & Check
                </button>
            `);

        }

    }


    // -------------------------------------------
    // FIELD OFFICER REVIEW
    // -------------------------------------------

    if (
        state ===
        'field_officer_review' &&
        [
            'field_officer',
            'owner',
            'manager',
            'super_manager',
            'validator'
        ].includes(role)
    ) {

        buttons.push(`
            <button
                class="action-btn workflow-next"
                onclick="
                    window.transitionWorkflow(
                        '${submission.id}',
                        'gis_compliance_review'
                    )
                "
                title="Pass to GIS / Compliance">
                <i class="fas fa-arrow-right"></i>
                Pass to GIS
            </button>
        `);

    }


    // -------------------------------------------
    // GIS / COMPLIANCE
    // -------------------------------------------

    if (
        state ===
        'gis_compliance_review' &&
        [
            'validator',
            'owner',
            'manager',
            'super_manager'
        ].includes(role)
    ) {

        buttons.push(`
            <button
                class="action-btn workflow-next"
                onclick="
                    window.transitionWorkflow(
                        '${submission.id}',
                        'final_validation'
                    )
                "
                title="Pass to final validation">
                <i class="fas fa-arrow-right"></i>
                Pass to Final
            </button>
        `);

    }


    // -------------------------------------------
    // FINAL VALIDATION
    // -------------------------------------------

    if (
        state ===
        'final_validation' &&
        [
            'validator',
            'owner',
            'manager',
            'super_manager'
        ].includes(role)
    ) {

        buttons.push(`
            <button
                class="action-btn final-validate"
                onclick="
                    window.transitionWorkflow(
                        '${submission.id}',
                        'validated'
                    )
                "
                title="Validate farm">
                <i class="fas fa-check-circle"></i>
                Validate
            </button>
        `);


        buttons.push(`
            <button
                class="action-btn reject"
                onclick="
                    window.transitionWorkflow(
                        '${submission.id}',
                        'rejected',
                        true
                    )
                "
                title="Reject farm">
                <i class="fas fa-times"></i>
                Reject
            </button>
        `);

    }


    // -------------------------------------------
    // CORRECTION REQUIRED
    // -------------------------------------------

    if (
        state ===
        'correction_required' &&
        [
            'enumerator',
            'field_officer',
            'owner',
            'manager',
            'super_manager'
        ].includes(role)
    ) {

        buttons.push(`
            <button
                class="action-btn workflow-next"
                onclick="
                    window.transitionWorkflow(
                        '${submission.id}',
                        'enumerator_review'
                    )
                "
                title="Resubmit after correction">
                <i class="fas fa-redo"></i>
                Resubmit
            </button>
        `);

    }


    // -------------------------------------------
    // REQUEST CORRECTION
    // -------------------------------------------

    if (
        [
            'submitted',
            'enumerator_review',
            'field_officer_review',
            'gis_compliance_review',
            'final_validation'
        ].includes(state) &&
        [
            'enumerator',
            'field_officer',
            'owner',
            'manager',
            'super_manager',
            'validator'
        ].includes(role)
    ) {

        buttons.push(`
            <button
                class="action-btn correction"
                onclick="
                    window.requestCorrection(
                        '${submission.id}'
                    )
                "
                title="Request correction">
                <i class="fas fa-undo"></i>
                Correction
            </button>
        `);

    }


    return buttons.join('');

}


// ===========================================
// DATABASE WORKFLOW TRANSITION
// ===========================================

window.transitionWorkflow =
    async function (
        farmId,
        toState,
        requireReason = false,
        customReason = null
    ) {

        let reason =
            customReason;


        // -------------------------------------------
        // REQUIRE REASON
        // -------------------------------------------

        if (
            requireReason &&
            !reason
        ) {

            reason =
                window.prompt(
                    'Please enter a reason:'
                );


            if (
                !reason ||
                !reason.trim()
            ) {

                return;

            }

        }


        // -------------------------------------------
        // CONFIRM
        // -------------------------------------------

        const confirmed =
            window.confirm(
                `Move this farm to "${workflowLabel(
                    toState
                )}"?`
            );


        if (!confirmed) {
            return;
        }


        showLoading(true);


        try {

            console.log(
                '🔄 Workflow transition:',
                {
                    farmId,
                    toState,
                    reason
                }
            );


            const {
                data,
                error
            } =
                await supabaseClient.rpc(
                    'transition_farm_workflow',
                    {
                        p_farm_id:
                            farmId,

                        p_to_state:
                            toState,

                        p_reason:
                            reason ||
                            null
                    }
                );


            if (error) {
                throw error;
            }


            console.log(
                '✅ Workflow transition successful:',
                data
            );


            showNotification(
                `Farm moved to ${workflowLabel(
                    toState
                )}.`,
                'success'
            );


            // -------------------------------------------
            // IMPORTANT:
            // RELOAD DATA SO COUNTERS DECREASE/INCREASE
            // AUTOMATICALLY.
            // -------------------------------------------

            if (
                currentProject &&
                currentProject.id
            ) {

                await loadSubmissions(
                    currentProject.id
                );

            }


            return data;


        } catch (error) {

            console.error(
                '❌ Workflow transition failed:',
                error
            );


            showNotification(
                error?.message ||
                'Workflow transition failed.',
                'error'
            );


        } finally {

            showLoading(false);

        }

    };


// ===========================================
// FIELD OFFICER TAKEOVER
// ===========================================

window.fieldOfficerTakeover =
    async function (
        farmId
    ) {

        const reason =
            window.prompt(
                'Why is the Field Officer performing the self-check?\n\nExample: Enumerator unavailable or busy.'
            );


        if (
            !reason ||
            !reason.trim()
        ) {

            return;

        }


        return window.transitionWorkflow(
            farmId,
            'field_officer_review',
            false,
            reason.trim()
        );

    };


// ===========================================
// REQUEST CORRECTION
// ===========================================

window.requestCorrection =
    async function (
        farmId
    ) {

        const reason =
            window.prompt(
                'Describe the correction required:'
            );


        if (
            !reason ||
            !reason.trim()
        ) {

            return;

        }


        return window.transitionWorkflow(
            farmId,
            'correction_required',
            false,
            reason.trim()
        );

    };


// ===========================================
// RENDER TABLE
// ===========================================

function renderTable() {

    const tbody =
        document.getElementById(
            'tableBody'
        );


    if (!tbody) {
        return;
    }


    const start =
        (
            currentPage - 1
        ) * rowsPerPage;


    const pageData =
        filteredSubmissions.slice(
            start,
            start + rowsPerPage
        );


    if (
        pageData.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:60px;
                    ">
                    No submissions found
                </td>
            </tr>
        `;


        setText(
            'showingCount',
            '0-0'
        );


        return;

    }


    tbody.innerHTML =
        pageData
            .map(
                submission => {

                    const workflowState =
                        submission.workflow_state ||
                        'enumerator_review';


                    const duplicateBadge =
                        submission.duplicate_alert
                            ? `
                                <span
                                    class="duplicate-badge"
                                    title="Possible duplicate farm code or exact duplicate geometry">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    Duplicate
                                </span>
                              `
                            : '';


                    return `
                        <tr
                            ${
                                submission.duplicate_alert
                                    ? 'style="background:#fffbeb;"'
                                    : ''
                            }
                        >

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        submission.farmer_name
                                    )}
                                </strong>
                            </td>

                            <td>
                                <code>
                                    ${escapeHtml(
                                        submission.farmer_id
                                    )}
                                </code>
                            </td>

                            <td>
                                ${escapeHtml(
                                    submission.cooperative
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    submission.supplier
                                )}
                            </td>

                            <td>
                                ${submission.area.toFixed(
                                    2
                                )}
                            </td>

                            <td>
                                ${formatDate(
                                    submission.created_at
                                )}
                            </td>

                            <td>

                                <span
                                    class="workflow-badge ${workflowState}">
                                    ${workflowLabel(
                                        workflowState
                                    )}
                                </span>

                                ${duplicateBadge}

                            </td>

                            <td class="action-buttons">

                                <button
                                    class="action-btn view-map"
                                    onclick="
                                        window.viewOnMap(
                                            '${submission.id}'
                                        )
                                    "
                                    title="View farm on map">

                                    <i class="fas fa-map-marker-alt"></i>
                                    View Map

                                </button>

                                ${workflowActions(
                                    submission
                                )}

                            </td>

                        </tr>
                    `;

                }
            )
            .join('');


    setText(
        'showingCount',
        `${start + 1}-${Math.min(
            start + pageData.length,
            filteredSubmissions.length
        )}`
    );

}


// ===========================================
// PAGINATION
// ===========================================

function updatePagination() {

    const totalPages =
        Math.ceil(
            filteredSubmissions.length /
            rowsPerPage
        );


    const pageNumbers =
        document.getElementById(
            'pageNumbers'
        );

    const prevBtn =
        document.getElementById(
            'prevPageBtn'
        );

    const nextBtn =
        document.getElementById(
            'nextPageBtn'
        );


    if (prevBtn) {

        prevBtn.disabled =
            currentPage <= 1;

    }


    if (nextBtn) {

        nextBtn.disabled =
            currentPage >= totalPages ||
            totalPages === 0;

    }


    if (!pageNumbers) {
        return;
    }


    let pagesHtml = '';

    const maxVisible = 5;

    let startPage =
        Math.max(
            1,
            currentPage -
                Math.floor(
                    maxVisible / 2
                )
        );


    let endPage =
        Math.min(
            totalPages,
            startPage +
                maxVisible -
                1
        );


    if (
        endPage -
            startPage +
            1 <
        maxVisible
    ) {

        startPage =
            Math.max(
                1,
                endPage -
                    maxVisible +
                    1
            );

    }


    for (
        let page = startPage;
        page <= endPage;
        page++
    ) {

        pagesHtml += `
            <button
                class="page-number ${
                    page === currentPage
                        ? 'active'
                        : ''
                }"
                onclick="
                    window.goToPage(
                        ${page}
                    )
                ">
                ${page}
            </button>
        `;

    }


    pageNumbers.innerHTML =
        pagesHtml;

}


window.goToPage =
    function (
        page
    ) {

        currentPage =
            page;

        renderTable();

        updatePagination();

    };


// ===========================================
// SORT TABLE
// ===========================================

window.sortTable =
    function (
        column
    ) {

        if (
            sortColumn ===
            column
        ) {

            sortDirection =
                sortDirection ===
                    'asc'
                    ? 'desc'
                    : 'asc';

        } else {

            sortColumn =
                column;

            sortDirection =
                'asc';

        }


        applyFilters();

    };


// ===========================================
// MAP COORDINATES
// ===========================================

function convertCoords(
    coords
) {

    if (
        !coords ||
        !Array.isArray(coords)
    ) {

        return coords;

    }


    // Single coordinate
    if (
        coords.length === 2 &&
        typeof coords[0] ===
            'number'
    ) {

        return [
            coords[1],
            coords[0]
        ];

    }


    // Polygon / MultiPolygon rings
    if (
        Array.isArray(
            coords[0]
        )
    ) {

        try {

            return coords.map(
                ring => {

                    if (
                        Array.isArray(
                            ring
                        ) &&
                        Array.isArray(
                            ring[0]
                        ) &&
                        typeof ring[0][0] ===
                            'number'
                    ) {

                        return ring.map(
                            point => [
                                point[1],
                                point[0]
                            ]
                        );

                    }


                    if (
                        Array.isArray(
                            ring
                        )
                    ) {

                        return ring.map(
                            polygon =>
                                Array.isArray(
                                    polygon
                                )
                                    ? polygon.map(
                                        p => [
                                            p[1],
                                            p[0]
                                        ]
                                    )
                                    : polygon
                        );

                    }


                    return ring;

                }
            );

        } catch (error) {

            console.warn(
                'Coordinate conversion failed:',
                error
            );

        }

    }


    return coords;

}


// ===========================================
// VIEW FARM ON MAP
// ===========================================

window.viewOnMap =
    async function (
        submissionId
    ) {

        const submission =
            allSubmissions.find(
                s =>
                    s.id ===
                    submissionId
            );


        if (
            !submission ||
            !submission.geometry
        ) {

            showNotification(
                'No map data available.',
                'warning'
            );

            return;

        }


        const existingModal =
            document.querySelector(
                '.modal-overlay'
            );


        if (existingModal) {
            existingModal.remove();
        }


        const workflowColor =
            getWorkflowColor(
                submission.workflow_state
            );


        const modal =
            document.createElement(
                'div'
            );


        modal.className =
            'modal-overlay';


        modal.innerHTML = `

            <div class="modal-content">

                <div class="modal-header">

                    <h3>
                        <i class="fas fa-map-marked-alt"></i>
                        Farm Location -
                        ${escapeHtml(
                            submission.farmer_name
                        )}
                    </h3>

                    <button
                        class="modal-close"
                        onclick="
                            this.closest(
                                '.modal-overlay'
                            ).remove()
                        "
                        title="Close">

                        <i class="fas fa-times"></i>

                    </button>

                </div>


                <div class="modal-body">

                    <div class="modal-section">

                        <div class="modal-section-title">
                            <i class="fas fa-info-circle"></i>
                            Farm Information
                        </div>


                        <div class="modal-grid">

                            <div class="modal-row">
                                <div class="modal-label">
                                    Farmer Name:
                                </div>

                                <div class="modal-value">
                                    ${escapeHtml(
                                        submission.farmer_name
                                    )}
                                </div>
                            </div>


                            <div class="modal-row">
                                <div class="modal-label">
                                    Farmer ID:
                                </div>

                                <div class="modal-value">
                                    ${escapeHtml(
                                        submission.farmer_id
                                    )}
                                </div>
                            </div>


                            <div class="modal-row">
                                <div class="modal-label">
                                    Cooperative:
                                </div>

                                <div class="modal-value">
                                    ${escapeHtml(
                                        submission.cooperative
                                    )}
                                </div>
                            </div>


                            <div class="modal-row">
                                <div class="modal-label">
                                    Supplier:
                                </div>

                                <div class="modal-value">
                                    ${escapeHtml(
                                        submission.supplier
                                    )}
                                </div>
                            </div>


                            <div class="modal-row">
                                <div class="modal-label">
                                    Area:
                                </div>

                                <div class="modal-value">
                                    ${submission.area.toFixed(
                                        2
                                    )} ha
                                </div>
                            </div>


                            <div class="modal-row">
                                <div class="modal-label">
                                    Workflow:
                                </div>

                                <div class="modal-value">

                                    <span
                                        class="workflow-badge ${
                                            submission.workflow_state
                                        }">

                                        ${workflowLabel(
                                            submission.workflow_state
                                        )}

                                    </span>

                                </div>
                            </div>


                            <div class="modal-row">
                                <div class="modal-label">
                                    Submission Date:
                                </div>

                                <div class="modal-value">
                                    ${formatDate(
                                        submission.created_at
                                    )}
                                </div>
                            </div>


                            ${
                                submission.duplicate_alert
                                    ? `
                                        <div class="modal-row">
                                            <div class="modal-label">
                                                Alert:
                                            </div>

                                            <div class="modal-value"
                                                style="color:#b45309;font-weight:600;">
                                                <i class="fas fa-exclamation-triangle"></i>
                                                Possible duplicate
                                            </div>
                                        </div>
                                      `
                                    : ''
                            }

                        </div>

                    </div>


                    <div class="modal-section">

                        <div class="modal-section-title">
                            <i class="fas fa-draw-polygon"></i>
                            Farm Boundary
                        </div>

                        <div id="submissionMap"></div>

                    </div>


                    <div class="modal-actions">

                        <button
                            class="modal-btn secondary"
                            onclick="
                                this.closest(
                                    '.modal-overlay'
                                ).remove()
                            ">

                            Close

                        </button>

                    </div>

                </div>

            </div>

        `;


        document.body.appendChild(
            modal
        );


        setTimeout(
            () => {

                const mapContainer =
                    document.getElementById(
                        'submissionMap'
                    );


                if (
                    !mapContainer ||
                    !submission.geometry
                ) {

                    return;

                }


                try {

                    if (
                        currentMap
                    ) {

                        currentMap.remove();

                    }


                    currentMap =
                        L.map(
                            'submissionMap'
                        ).setView(
                            [
                                7.539989,
                                -5.547080
                            ],
                            14
                        );


                    L.tileLayer(
                        'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                        {
                            maxZoom: 22,
                            subdomains: [
                                'mt0',
                                'mt1',
                                'mt2',
                                'mt3'
                            ]
                        }
                    ).addTo(
                        currentMap
                    );


                    const geometry =
                        submission.geometry;


                    let coords =
                        geometry.coordinates;


                    coords =
                        convertCoords(
                            coords
                        );


                    let polygon;


                    if (
                        geometry.type ===
                        'MultiPolygon'
                    ) {

                        polygon =
                            L.polygon(
                                coords,
                                {
                                    color:
                                        workflowColor,
                                    weight: 3,
                                    fillColor:
                                        workflowColor,
                                    fillOpacity:
                                        0.4
                                }
                            ).addTo(
                                currentMap
                            );

                    } else {

                        polygon =
                            L.polygon(
                                coords,
                                {
                                    color:
                                        workflowColor,
                                    weight: 3,
                                    fillColor:
                                        workflowColor,
                                    fillOpacity:
                                        0.4
                                }
                            ).addTo(
                                currentMap
                            );

                    }


                    if (
                        polygon &&
                        polygon.getBounds &&
                        polygon
                            .getBounds()
                            .isValid()
                    ) {

                        currentMap.fitBounds(
                            polygon.getBounds(),
                            {
                                padding:
                                    [
                                        50,
                                        50
                                    ]
                            }
                        );

                    }


                    if (polygon) {

                        polygon.bindPopup(
                            `
                                <b>
                                    ${escapeHtml(
                                        submission.farmer_name
                                    )}
                                </b>
                                <br>
                                Area:
                                ${submission.area.toFixed(
                                    2
                                )} ha
                                <br>
                                Workflow:
                                ${workflowLabel(
                                    submission.workflow_state
                                )}
                            `
                        );

                    }

                } catch (error) {

                    console.error(
                        '❌ Map rendering error:',
                        error
                    );

                    showNotification(
                        'Unable to display farm geometry.',
                        'error'
                    );

                }

            },
            100
        );

    };


// ===========================================
// WORKFLOW COLOR
// ===========================================

function getWorkflowColor(
    state
) {

    const colors = {

        submitted:
            '#eab308',

        enumerator_review:
            '#eab308',

        field_officer_review:
            '#4f46e5',

        gis_compliance_review:
            '#2563eb',

        final_validation:
            '#9333ea',

        correction_required:
            '#f59e0b',

        validated:
            '#22c55e',

        rejected:
            '#ef4444'

    };


    return (
        colors[state] ||
        '#64748b'
    );

}


// ===========================================
// DATE FORMAT
// ===========================================

function formatDate(
    dateString
) {

    if (!dateString) {
        return 'N/A';
    }


    const date =
        new Date(
            dateString
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return 'N/A';

    }


    const now =
        new Date();


    const diffHours =
        Math.floor(
            (
                now -
                date
            ) /
            3600000
        );


    if (
        diffHours < 1
    ) {

        return 'Just now';

    }


    if (
        diffHours < 24
    ) {

        return `${diffHours} hours ago`;

    }


    if (
        diffHours < 48
    ) {

        return 'Yesterday';

    }


    return date.toLocaleDateString();

}


// ===========================================
// EXPORT PERMISSION
// ===========================================

function canExport() {

    const role =
        currentRole();


    return [
        'owner',
        'manager',
        'super_manager',
        'validator'
    ].includes(
        role
    );

}


// ===========================================
// CSV EXPORT
// ===========================================

function exportToCSV() {

    if (!canExport()) {

        showNotification(
            'Export permission denied. Only Owners, Managers, Super Managers, and Validators can export data.',
            'error'
        );

        return;

    }


    if (
        filteredSubmissions.length ===
        0
    ) {

        showNotification(
            'No data to export.',
            'warning'
        );

        return;

    }


    const headers = [

        'Farmer Name',

        'Farmer ID',

        'Farm Code',

        'Cooperative',

        'Supplier',

        'Area (ha)',

        'Workflow State',

        'Status',

        'Submission Date',

        'Duplicate Alert'

    ];


    const rows =
        filteredSubmissions.map(
            submission => [

                submission.farmer_name,

                submission.farmer_id,

                submission.farm_code ||
                    '',

                submission.cooperative,

                submission.supplier,

                submission.area.toFixed(
                    2
                ),

                workflowLabel(
                    submission.workflow_state
                ),

                submission.status,

                submission.created_at
                    ? new Date(
                        submission.created_at
                    ).toLocaleDateString()
                    : 'N/A',

                submission.duplicate_alert
                    ? 'YES'
                    : 'NO'

            ]
        );


    const csvContent =
        [
            headers,
            ...rows
        ]
            .map(
                row =>
                    row
                        .map(
                            cell =>
                                `"${String(
                                    cell ?? ''
                                ).replace(
                                    /"/g,
                                    '""'
                                )}"`
                        )
                        .join(',')
            )
            .join('\n');


    const blob =
        new Blob(
            [
                '\uFEFF' +
                csvContent
            ],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );


    const filename =
        `submissions_${
            currentProject?.name ||
            'export'
        }_${
            new Date()
                .toISOString()
                .split('T')[0]
        }.csv`;


    if (
        typeof saveAs !==
        'undefined'
    ) {

        saveAs(
            blob,
            filename
        );

    } else {

        const link =
            document.createElement(
                'a'
            );

        link.href =
            URL.createObjectURL(
                blob
            );

        link.download =
            filename;

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        setTimeout(
            () =>
                URL.revokeObjectURL(
                    link.href
                ),
            100
        );

    }


    showNotification(
        `Exported ${
            filteredSubmissions.length
        } records to CSV.`,
        'success'
    );

}


// ===========================================
// CLEAR FILTERS
// ===========================================

function clearFilters() {

    const search =
        document.getElementById(
            'searchInput'
        );

    const supplier =
        document.getElementById(
            'supplierFilter'
        );

    const workflow =
        document.getElementById(
            'statusFilter'
        );


    if (search) {
        search.value = '';
    }


    if (supplier) {
        supplier.value = 'all';
    }


    if (workflow) {
        workflow.value = 'all';
    }


    applyFilters();


    showNotification(
        'Filters cleared.',
        'info'
    );

}


// ===========================================
// REFRESH
// ===========================================

async function refreshData() {

    if (!currentProject) {

        await loadAllProjectsSubmissions();

        return;

    }


    await loadSubmissions(
        currentProject.id
    );

}


// ===========================================
// NOTIFICATION
// ===========================================

function showNotification(
    message,
    type = 'info'
) {

    const colors = {

        success:
            '#4CAF50',

        error:
            '#F44336',

        warning:
            '#FFC107',

        info:
            '#2196F3'

    };


    const notification =
        document.createElement(
            'div'
        );


    notification.style.cssText = `

        position:fixed;

        bottom:20px;

        right:20px;

        padding:12px 24px;

        background:${colors[type] ||
            colors.info};

        color:white;

        border-radius:8px;

        z-index:10001;

        font-size:13px;

        font-weight:500;

        display:flex;

        align-items:center;

        gap:8px;

        box-shadow:
            0 4px 12px
            rgba(0,0,0,0.15);

    `;


    const icon =
        type === 'success'
            ? 'fa-check-circle'
            : type === 'warning'
                ? 'fa-exclamation-triangle'
                : type === 'error'
                    ? 'fa-times-circle'
                    : 'fa-info-circle';


    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        ${escapeHtml(
            String(message)
        )}
    `;


    document.body.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        3500
    );

}


// ===========================================
// LOADING
// ===========================================

function showLoading(
    show
) {

    const overlay =
        document.getElementById(
            'loadingOverlay'
        );


    if (overlay) {

        overlay.style.display =
            show
                ? 'flex'
                : 'none';

    }

}


// ===========================================
// SAFE TEXT
// ===========================================

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return '';

    }


    return String(value)
        .replace(
            /[&<>"']/g,
            character =>
                ({
                    '&':
                        '&amp;',

                    '<':
                        '&lt;',

                    '>':
                        '&gt;',

                    '"':
                        '&quot;',

                    "'":
                        '&#039;'

                }[
                    character
                ])
        );

}


// ===========================================
// SET TEXT HELPER
// ===========================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {

    document
        .getElementById(
            'applyFiltersBtn'
        )
        ?.addEventListener(
            'click',
            applyFilters
        );


    document
        .getElementById(
            'clearFiltersBtn'
        )
        ?.addEventListener(
            'click',
            clearFilters
        );


    document
        .getElementById(
            'exportBtn'
        )
        ?.addEventListener(
            'click',
            exportToCSV
        );


    document
        .getElementById(
            'refreshTableBtn'
        )
        ?.addEventListener(
            'click',
            refreshData
        );


    document
        .getElementById(
            'syncKoboBtn'
        )
        ?.addEventListener(
            'click',
            async function () {

                showNotification(
                    'Refreshing data...',
                    'info'
                );

                await refreshData();

            }
        );


    // -------------------------------------------
    // PAGINATION
    // -------------------------------------------

    document
        .getElementById(
            'prevPageBtn'
        )
        ?.addEventListener(
            'click',
            function () {

                if (
                    currentPage >
                    1
                ) {

                    currentPage--;

                    renderTable();

                    updatePagination();

                }

            }
        );


    document
        .getElementById(
            'nextPageBtn'
        )
        ?.addEventListener(
            'click',
            function () {

                const totalPages =
                    Math.ceil(
                        filteredSubmissions.length /
                        rowsPerPage
                    );


                if (
                    currentPage <
                    totalPages
                ) {

                    currentPage++;

                    renderTable();

                    updatePagination();

                }

            }
        );


    // -------------------------------------------
    // ENTER KEY SEARCH
    // -------------------------------------------

    document
        .getElementById(
            'searchInput'
        )
        ?.addEventListener(
            'keydown',
            function (event) {

                if (
                    event.key ===
                    'Enter'
                ) {

                    applyFilters();

                }

            }
        );


    // -------------------------------------------
    // LOGOUT
    // -------------------------------------------

    document
        .getElementById(
            'logoutBtn'
        )
        ?.addEventListener(
            'click',
            async function () {

                try {

                    await supabaseClient
                        .auth
                        .signOut();

                } finally {

                    localStorage.clear();

                    window.location.href =
                        '../login.html';

                }

            }
        );

}


// ===========================================
// GLOBAL FUNCTIONS
// ===========================================

window.applyFilters =
    applyFilters;

window.sortTable =
    window.sortTable;

window.viewOnMap =
    window.viewOnMap;

window.exportToCSV =
    exportToCSV;

window.clearFilters =
    clearFilters;

window.refreshData =
    refreshData;

window.goToPage =
    window.goToPage;


// ===========================================
// READY
// ===========================================

console.log(
    '✅ Submissions workflow JavaScript loaded'
);
