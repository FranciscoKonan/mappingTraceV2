/* =========================================================
   MAPPINGTRACE — EXPORT CENTER
   CLEAN VERSION
   Matched to current exports.html
   ========================================================= */

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';

let db = null;

let currentUser = null;
let currentProject = null;
let currentMembership = null;

let projectMemberships = [];
let members = [];

let farms = [];
let filteredFarms = [];

let selectedFormat = 'excel';

const WORKFLOW = {
    submitted: 'Submitted',
    enumerator_review: 'Enumerator Review',
    field_officer_review: 'Field Officer Review',
    gis_compliance_review: 'GIS / Compliance',
    final_validation: 'Final Validation',
    correction_required: 'Correction Required',
    validated: 'Validated',
    rejected: 'Rejected'
};

const MANAGEMENT_ROLES = [
    'owner',
    'manager',
    'super_manager'
];


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    init
);


async function init() {

    try {

        if (!window.supabase) {
            throw new Error(
                'Supabase library is not loaded.'
            );
        }

        db =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );


        bindUI();


        const {
            data,
            error
        } =
            await db.auth.getSession();


        if (error) {
            throw error;
        }


        if (!data.session) {

            window.location.href =
                '../login.html';

            return;
        }


        currentUser =
            data.session.user;


        await loadProjects();


        await selectProject();


        await loadMembers();


        await loadFarms();


        updateUserHeader();


        updatePermissionUI();


        applyFilters();


        await loadExportHistory();


        syncSidebarForViewport();

    } catch (error) {

        console.error(
            'Export Center initialization error:',
            error
        );


        notify(
            error.message ||
            'Unable to initialize Export Center.',
            'error'
        );
    }
}


/* =========================================================
   UI BINDING
   ========================================================= */

function bindUI() {

    document
        .getElementById('refreshBtn')
        ?.addEventListener(
            'click',
            refreshAll
        );


    document
        .getElementById('logoutBtn')
        ?.addEventListener(
            'click',
            logout
        );


    document
        .getElementById('burgerBtn')
        ?.addEventListener(
            'click',
            handleBurger
        );


    document
        .getElementById('sidebarToggle')
        ?.addEventListener(
            'click',
            toggleDesktopSidebar
        );


    document
        .getElementById('sidebarOverlay')
        ?.addEventListener(
            'click',
            closeMobileSidebar
        );


    document
        .getElementById('dropdownSelected')
        ?.addEventListener(
            'click',
            toggleProjectDropdown
        );


    document
        .getElementById('projectSearch')
        ?.addEventListener(
            'input',
            filterProjectDropdown
        );


    document
        .getElementById('advancedToggleBtn')
        ?.addEventListener(
            'click',
            toggleAdvancedFilters
        );


    document
        .getElementById('exportBtn')
        ?.addEventListener(
            'click',
            generateExport
        );


    document
        .getElementById('previewBtn')
        ?.addEventListener(
            'click',
            previewExport
        );


    document
        .getElementById('resetBtn')
        ?.addEventListener(
            'click',
            resetFilters
        );


    document
        .getElementById('rejectedAuditBtn')
        ?.addEventListener(
            'click',
            exportRejectedAudit
        );


    document
        .getElementById('refreshHistoryBtn')
        ?.addEventListener(
            'click',
            loadExportHistory
        );


    document
        .getElementById('clearDates')
        ?.addEventListener(
            'click',
            clearDates
        );


    document
        .getElementById('selectAllSuppliers')
        ?.addEventListener(
            'click',
            () =>
                toggleFilterGroup(
                    'supplier'
                )
        );


    document
        .getElementById('selectAllCooperatives')
        ?.addEventListener(
            'click',
            () =>
                toggleFilterGroup(
                    'cooperative'
                )
        );


    document
        .getElementById('selectAllEnumerators')
        ?.addEventListener(
            'click',
            () =>
                toggleFilterGroup(
                    'enumerator'
                )
        );


    document
        .getElementById('selectAllFieldOfficers')
        ?.addEventListener(
            'click',
            () =>
                toggleFilterGroup(
                    'fieldOfficer'
                )
        );


    document
        .getElementById('selectAllWorkflow')
        ?.addEventListener(
            'click',
            toggleAllWorkflow
        );


    [
        'supplierSearch',
        'coopSearch',
        'enumeratorSearch',
        'fieldOfficerSearch',
        'dateFrom',
        'dateTo',
        'areaMin',
        'areaMax'
    ]
        .forEach(
            id => {

                document
                    .getElementById(id)
                    ?.addEventListener(
                        'input',
                        applyFilters
                    );
            }
        );


    [
        'dateBasis',
        'qualityFilter'
    ]
        .forEach(
            id => {

                document
                    .getElementById(id)
                    ?.addEventListener(
                        'change',
                        applyFilters
                    );
            }
        );


    document
        .querySelectorAll(
            '.performance-tab'
        )
        .forEach(
            tab => {

                tab.addEventListener(
                    'click',
                    () =>
                        switchPerformanceTab(
                            tab.dataset.tab
                        )
                );
            }
        );


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(
            option => {

                option.addEventListener(
                    'click',
                    () =>
                        selectFormat(
                            option.dataset.format
                        )
                );
            }
        );


    document.addEventListener(
        'change',
        event => {

            if (
                event.target.matches(
                    '.supplier-checkbox,' +
                    '.cooperative-checkbox,' +
                    '.enumerator-checkbox,' +
                    '.fieldOfficer-checkbox,' +
                    '.workflow-checkbox'
                )
            ) {

                updateWorkflowButton();

                applyFilters();
            }
        }
    );


    window.addEventListener(
        'resize',
        syncSidebarForViewport
    );


    document.addEventListener(
        'click',
        event => {

            const dropdown =
                document.getElementById(
                    'customDropdown'
                );

            const menu =
                document.getElementById(
                    'dropdownMenu'
                );

            if (
                dropdown &&
                menu &&
                !dropdown.contains(
                    event.target
                )
            ) {

                menu.classList.remove(
                    'show'
                );
            }
        }
    );
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function handleBurger() {

    const sidebar =
        document.getElementById(
            'sidebar'
        );

    if (!sidebar) {
        return;
    }


    if (
        window.innerWidth <= 768
    ) {

        const isOpen =
            sidebar.classList.toggle(
                'mobile-open'
            );


        document
            .getElementById(
                'sidebarOverlay'
            )
            ?.classList.toggle(
                'active',
                isOpen
            );

    } else {

        sidebar.classList.toggle(
            'collapsed'
        );
    }
}


function toggleDesktopSidebar() {

    if (
        window.innerWidth <= 768
    ) {

        return;
    }


    document
        .getElementById(
            'sidebar'
        )
        ?.classList.toggle(
            'collapsed'
        );
}


function syncSidebarForViewport() {

    const sidebar =
        document.getElementById(
            'sidebar'
        );

    const overlay =
        document.getElementById(
            'sidebarOverlay'
        );


    if (!sidebar) {
        return;
    }


    if (
        window.innerWidth > 768
    ) {

        sidebar.classList.remove(
            'mobile-open'
        );

        overlay?.classList.remove(
            'active'
        );
    }
}


function closeMobileSidebar() {

    document
        .getElementById(
            'sidebar'
        )
        ?.classList.remove(
            'mobile-open'
        );


    document
        .getElementById(
            'sidebarOverlay'
        )
        ?.classList.remove(
            'active'
        );
}


/* =========================================================
   PROJECTS
   ========================================================= */

async function loadProjects() {

    const {
        data,
        error
    } =
        await db
            .from('project_members')
            .select(`
                project_id,
                role,
                status,
                can_export,
                projects (
                    id,
                    name
                )
            `)
            .eq(
                'user_id',
                currentUser.id
            )
            .eq(
                'status',
                'active'
            );


    if (error) {
        throw error;
    }


    projectMemberships =
        data || [];


    if (
        !projectMemberships.length
    ) {

        throw new Error(
            'You are not an active member of any project.'
        );
    }
}


async function selectProject() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const requested =
        params.get(
            'project'
        );


    let membership =
        projectMemberships.find(
            item =>
                item.project_id ===
                requested
        );


    if (!membership) {

        const saved =
            localStorage.getItem(
                `mappingtrace_project_${currentUser.id}`
            );


        membership =
            projectMemberships.find(
                item =>
                    item.project_id ===
                    saved
            );
    }


    if (!membership) {

        membership =
            projectMemberships[0];
    }


    currentMembership =
        membership;


    currentProject =
        membership.projects;


    localStorage.setItem(
        `mappingtrace_project_${currentUser.id}`,
        currentProject.id
    );


    const url =
        new URL(
            window.location.href
        );


    url.searchParams.set(
        'project',
        currentProject.id
    );


    history.replaceState(
        {},
        '',
        url
    );


    renderProjectDropdown();


    updateProjectHeader();
}


function renderProjectDropdown() {

    const container =
        document.getElementById(
            'dropdownItems'
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        projectMemberships
            .map(
                membership => {

                    const selected =
                        membership.project_id ===
                        currentProject?.id;


                    return `
                        <div
                            class="dropdown-item ${selected ? 'selected' : ''}"
                            data-project-id="${escapeHtml(
                                membership.project_id
                            )}"
                        >
                            ${escapeHtml(
                                membership.projects?.name ||
                                membership.project_id
                            )}
                        </div>
                    `;
                }
            )
            .join('');


    container
        .querySelectorAll(
            '.dropdown-item'
        )
        .forEach(
            item => {

                item.addEventListener(
                    'click',
                    () =>
                        changeProject(
                            item.dataset.projectId
                        )
                );
            }
        );
}


function toggleProjectDropdown(
    event
) {

    event?.stopPropagation();


    document
        .getElementById(
            'dropdownMenu'
        )
        ?.classList.toggle(
            'show'
        );
}


function filterProjectDropdown(
    event
) {

    const query =
        String(
            event.target.value ||
            ''
        )
            .toLowerCase()
            .trim();


    document
        .querySelectorAll(
            '#dropdownItems .dropdown-item'
        )
        .forEach(
            item => {

                item.style.display =
                    item.textContent
                        .toLowerCase()
                        .includes(
                            query
                        )
                        ? ''
                        : 'none';
            }
        );
}


async function changeProject(
    projectId
) {

    const membership =
        projectMemberships.find(
            item =>
                item.project_id ===
                projectId
        );


    if (!membership) {
        return;
    }


    currentMembership =
        membership;


    currentProject =
        membership.projects;


    localStorage.setItem(
        `mappingtrace_project_${currentUser.id}`,
        projectId
    );


    const url =
        new URL(
            window.location.href
        );


    url.searchParams.set(
        'project',
        projectId
    );


    history.pushState(
        {},
        '',
        url
    );


    document
        .getElementById(
            'dropdownMenu'
        )
        ?.classList.remove(
            'show'
        );


    await loadMembers();

    await loadFarms();

    updateProjectHeader();

    updatePermissionUI();

    applyFilters();

    await loadExportHistory();

    renderProjectDropdown();
}


/* =========================================================
   HEADER / MEMBERS
   ========================================================= */

function updateProjectHeader() {

    setText(
        'projectBadge',
        currentProject?.name ||
        'Project'
    );


    setText(
        'selectedProjectName',
        currentProject?.name ||
        'Project'
    );
}


async function loadMembers() {

    const {
        data,
        error
    } =
        await db
            .from('project_members')
            .select(`
                user_id,
                project_id,
                role,
                status,
                can_export
            `)
            .eq(
                'project_id',
                currentProject.id
            )
            .eq(
                'status',
                'active'
            );


    if (error) {
        throw error;
    }


    members =
        data || [];


    const ids =
        members
            .map(
                member =>
                    member.user_id
            )
            .filter(Boolean);


    if (!ids.length) {

        updateUserHeader();

        renderPermissionList();

        return;
    }


    const {
        data: profiles,
        error: profileError
    } =
        await db
            .from('user_profiles')
            .select(`
                id,
                first_name,
                last_name,
                email
            `)
            .in(
                'id',
                ids
            );


    if (profileError) {

        console.warn(
            'Profiles could not be loaded:',
            profileError
        );
    }


    const profileMap =
        new Map(
            (profiles || [])
                .map(
                    profile =>
                        [
                            profile.id,
                            profile
                        ]
                )
        );


    members =
        members.map(
            member => ({

                ...member,

                profile:
                    profileMap.get(
                        member.user_id
                    )

            })
        );


    updateUserHeader();

    renderPermissionList();
}


function updateUserHeader() {

    const profile =
        members.find(
            member =>
                member.user_id ===
                currentUser?.id
        )?.profile;


    const name =
        [
            profile?.first_name,
            profile?.last_name
        ]
            .filter(Boolean)
            .join(' ') ||
        profile?.email ||
        currentUser?.email ||
        'User';


    setText(
        'userName',
        name
    );


    const role =
        String(
            currentMembership?.role ||
            'user'
        )
            .replaceAll(
                '_',
                ' '
            );


    setText(
        'userRole',
        role
    );


    setText(
        'userAvatar',
        name
            .trim()
            .charAt(0)
            .toUpperCase() ||
        'U'
    );
}


/* =========================================================
   PERMISSIONS
   ========================================================= */

function userCanExport() {

    const role =
        String(
            currentMembership?.role ||
            ''
        )
            .toLowerCase();


    return (
        MANAGEMENT_ROLES.includes(
            role
        ) ||
        currentMembership?.can_export === true
    );
}


function userCanManagePermissions() {

    return MANAGEMENT_ROLES.includes(
        String(
            currentMembership?.role ||
            ''
        )
            .toLowerCase()
    );
}


function updatePermissionUI() {

    const allowed =
        userCanExport();


    const manager =
        userCanManagePermissions();


    const badge =
        document.getElementById(
            'exportPermissionBadge'
        );


    if (badge) {

        badge.textContent =
            allowed
                ? 'Export access granted'
                : 'Export access restricted';


        badge.classList.toggle(
            'allowed',
            allowed
        );


        badge.classList.toggle(
            'denied',
            !allowed
        );
    }


    const button =
        document.getElementById(
            'exportBtn'
        );


    if (button) {

        /*
           Keep the button visible.
           This makes it obvious that export
           exists but may require permission.
        */
        button.disabled =
            !allowed;


        button.innerHTML =
            allowed
                ? '<i class="fas fa-download"></i> Generate Export'
                : '<i class="fas fa-lock"></i> Export Restricted';
    }


    const audit =
        document.getElementById(
            'rejectedAuditBtn'
        );


    if (audit) {

        audit.classList.toggle(
            'hidden',
            !allowed
        );
    }


    const management =
        document.getElementById(
            'permissionManagement'
        );


    if (management) {

        management.classList.toggle(
            'hidden',
            !manager
        );
    }


    renderPermissionList();
}


function renderPermissionList() {

    const container =
        document.getElementById(
            'permissionList'
        );


    if (!container) {
        return;
    }


    if (
        !userCanManagePermissions()
    ) {

        container.innerHTML =
            '';

        return;
    }


    container.innerHTML =
        members
            .map(
                member => {

                    const profile =
                        member.profile;


                    const name =
                        [
                            profile?.first_name,
                            profile?.last_name
                        ]
                            .filter(Boolean)
                            .join(' ') ||
                        profile?.email ||
                        member.user_id;


                    const role =
                        String(
                            member.role ||
                            ''
                        )
                            .replaceAll(
                                '_',
                                ' '
                            );


                    const allowed =
                        member.can_export ===
                        true;


                    const self =
                        member.user_id ===
                        currentUser.id;


                    return `
                        <div class="permission-row">

                            <div>
                                <strong>
                                    ${escapeHtml(
                                        name
                                    )}
                                </strong>
                            </div>

                            <div class="permission-role">
                                ${escapeHtml(
                                    role
                                )}
                            </div>

                            <div>
                                <span
                                    class="permission-badge ${
                                        allowed
                                            ? 'allowed'
                                            : 'denied'
                                    }"
                                >
                                    ${
                                        allowed
                                            ? 'Allowed'
                                            : 'Restricted'
                                    }
                                </span>
                            </div>

                            <div class="permission-toggle">

                                <input
                                    type="checkbox"
                                    class="export-permission-checkbox"
                                    data-user-id="${escapeHtml(
                                        member.user_id
                                    )}"
                                    ${
                                        allowed
                                            ? 'checked'
                                            : ''
                                    }
                                    ${
                                        self
                                            ? 'disabled'
                                            : ''
                                    }
                                >

                            </div>

                        </div>
                    `;
                }
            )
            .join('');


    container
        .querySelectorAll(
            '.export-permission-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    'change',
                    updateMemberExportPermission
                );
            }
        );
}


async function updateMemberExportPermission(
    event
) {

    if (
        !userCanManagePermissions()
    ) {

        event.target.checked =
            !event.target.checked;

        return;
    }


    const userId =
        event.target.dataset.userId;


    const value =
        event.target.checked;


    try {

        showLoading(true);


        const {
            error
        } =
            await db
                .from('project_members')
                .update({
                    can_export:
                        value
                })
                .eq(
                    'project_id',
                    currentProject.id
                )
                .eq(
                    'user_id',
                    userId
                );


        if (error) {
            throw error;
        }


        const member =
            members.find(
                item =>
                    item.user_id ===
                    userId
            );


        if (member) {
            member.can_export =
                value;
        }


        renderPermissionList();


        notify(
            value
                ? 'Export access granted.'
                : 'Export access removed.',
            'success'
        );

    } catch (error) {

        event.target.checked =
            !value;


        console.error(
            error
        );


        notify(
            error.message ||
            'Could not update permission.',
            'error'
        );

    } finally {

        showLoading(false);
    }
}


/* =========================================================
   FARMS
   ========================================================= */

async function loadFarms() {

    showLoading(true);


    try {

        const {
            data,
            error
        } =
            await db
                .from('farms')
                .select('*')
                .eq(
                    'project_id',
                    currentProject.id
                );


        if (error) {
            throw error;
        }


        farms =
            (data || [])
                .map(
                    normalizeFarm
                );


        renderFilterLists();


    } finally {

        showLoading(false);
    }
}


function normalizeFarm(
    farm
) {

    return {

        ...farm,

        farm_id:
            farm.farm_id ||
            farm.farm_code ||
            farm.id,

        farmer_id:
            farm.farmer_id ||
            '',

        farmer_name:
            farm.farmer_name ||
            '',

        area:
            Number(
                farm.area ||
                farm.area_ha ||
                0
            ),

        supplier:
            farm.supplier ||
            farm.supplier_name ||
            farm.company ||
            'Unassigned',

        cooperative:
            farm.cooperative ||
            farm.cooperative_name ||
            'Unassigned',

        enumerator_id:
            farm.enumerator_id ||
            farm.mapped_by ||
            farm.created_by ||
            farm.submitted_by ||
            null,

        field_officer_id:
            farm.field_officer_id ||
            farm.field_officer_checked_by ||
            null,

        workflow_state:
            normalizeWorkflow(
                farm
            ),

        geometry:
            parseGeometry(
                farm.geometry
            )
    };
}


function normalizeWorkflow(
    farm
) {

    if (
        WORKFLOW[
            farm.workflow_state
        ]
    ) {

        return farm.workflow_state;
    }


    if (
        farm.status ===
        'validated'
    ) {

        return 'validated';
    }


    if (
        farm.status ===
        'rejected'
    ) {

        return 'rejected';
    }


    return (
        farm.workflow_state ||
        'submitted'
    );
}


/* =========================================================
   FILTER LISTS
   ========================================================= */

function renderFilterLists() {

    renderCheckboxFilter(
        'supplierList',
        'supplier',
        'supplier-checkbox'
    );


    renderCheckboxFilter(
        'cooperativeList',
        'cooperative',
        'cooperative-checkbox'
    );


    renderCheckboxFilter(
        'enumeratorList',
        'enumerator',
        'enumerator-checkbox'
    );


    renderCheckboxFilter(
        'fieldOfficerList',
        'fieldOfficer',
        'fieldOfficer-checkbox'
    );


    updateWorkflowButton();
}


function renderCheckboxFilter(
    elementId,
    field,
    className
) {

    const container =
        document.getElementById(
            elementId
        );


    if (!container) {
        return;
    }


    let values;


    if (
        field ===
        'enumerator'
    ) {

        values =
            unique(
                farms.map(
                    farm =>
                        personName(
                            farm.enumerator_id
                        )
                )
            );

    } else if (
        field ===
        'fieldOfficer'
    ) {

        values =
            unique(
                farms.map(
                    farm =>
                        personName(
                            farm.field_officer_id
                        )
                )
            );

    } else {

        values =
            unique(
                farms.map(
                    farm =>
                        farm[field] ||
                        'Unassigned'
                )
            );
    }


    values =
        values
            .filter(Boolean)
            .sort(
                (a, b) =>
                    String(a)
                        .localeCompare(
                            String(b)
                        )
            );


    container.innerHTML =
        values
            .map(
                value =>
                    `
                    <label class="checkbox-item">

                        <input
                            type="checkbox"
                            class="${className}"
                            value="${escapeHtml(
                                value
                            )}"
                            checked
                        >

                        <span class="checkbox-label">
                            ${escapeHtml(
                                value
                            )}
                        </span>

                    </label>
                    `
            )
            .join('');


    applyFilterSearch(
        field
    );
}


function applyFilterSearch(
    field
) {

    const map = {

        supplier:
            [
                'supplierSearch',
                'supplierList'
            ],

        cooperative:
            [
                'coopSearch',
                'cooperativeList'
            ],

        enumerator:
            [
                'enumeratorSearch',
                'enumeratorList'
            ],

        fieldOfficer:
            [
                'fieldOfficerSearch',
                'fieldOfficerList'
            ]
    };


    const pair =
        map[field];


    if (!pair) {
        return;
    }


    const input =
        document.getElementById(
            pair[0]
        );


    const list =
        document.getElementById(
            pair[1]
        );


    input?.addEventListener(
        'input',
        () => {

            const query =
                input.value
                    .toLowerCase()
                    .trim();


            list
                ?.querySelectorAll(
                    '.checkbox-item'
                )
                .forEach(
                    item => {

                        item.style.display =
                            item.textContent
                                .toLowerCase()
                                .includes(
                                    query
                                )
                                ? ''
                                : 'none';
                    }
                );
        }
    );
}


/* =========================================================
   SELECT ALL
   ========================================================= */

function toggleFilterGroup(
    type
) {

    const boxes =
        [
            ...document.querySelectorAll(
                `.${type}-checkbox`
            )
        ];


    if (!boxes.length) {
        return;
    }


    const allChecked =
        boxes.every(
            box =>
                box.checked
        );


    boxes.forEach(
        box => {

            box.checked =
                !allChecked;
        }
    );


    applyFilters();
}


function toggleAllWorkflow() {

    const boxes =
        [
            ...document.querySelectorAll(
                '.workflow-checkbox'
            )
        ];


    if (!boxes.length) {
        return;
    }


    const allChecked =
        boxes.every(
            box =>
                box.checked
        );


    boxes.forEach(
        box => {

            box.checked =
                !allChecked;
        }
    );


    updateWorkflowButton();

    applyFilters();
}


function updateWorkflowButton() {

    const button =
        document.getElementById(
            'selectAllWorkflow'
        );


    const boxes =
        [
            ...document.querySelectorAll(
                '.workflow-checkbox'
            )
        ];


    if (!button) {
        return;
    }


    const allChecked =
        boxes.length > 0 &&
        boxes.every(
            box =>
                box.checked
        );


    button.textContent =
        allChecked
            ? 'Clear All'
            : 'Select All';


    button.title =
        allChecked
            ? 'Clear workflow selection'
            : 'Select all workflow stages';
}


/* =========================================================
   FILTERING
   ========================================================= */

function applyFilters() {

    const suppliers =
        selectedValues(
            '.supplier-checkbox'
        );


    const cooperatives =
        selectedValues(
            '.cooperative-checkbox'
        );


    const enumerators =
        selectedValues(
            '.enumerator-checkbox'
        );


    const officers =
        selectedValues(
            '.fieldOfficer-checkbox'
        );


    const workflows =
        selectedValues(
            '.workflow-checkbox'
        );


    const searchSupplier =
        valueOf(
            'supplierSearch'
        );


    const searchCoop =
        valueOf(
            'coopSearch'
        );


    const searchEnumerator =
        valueOf(
            'enumeratorSearch'
        );


    const searchOfficer =
        valueOf(
            'fieldOfficerSearch'
        );


    const dateFrom =
        valueOf(
            'dateFrom'
        );


    const dateTo =
        valueOf(
            'dateTo'
        );


    const dateBasis =
        valueOf(
            'dateBasis'
        ) ||
        'created_at';


    const minArea =
        Number(
            valueOf(
                'areaMin'
            )
        );


    const maxArea =
        Number(
            valueOf(
                'areaMax'
            )
        );


    const quality =
        valueOf(
            'qualityFilter'
        ) ||
        'all';


    filteredFarms =
        farms.filter(
            farm => {

                if (
                    suppliers.length &&
                    !suppliers.includes(
                        farm.supplier
                    )
                ) {
                    return false;
                }


                if (
                    cooperatives.length &&
                    !cooperatives.includes(
                        farm.cooperative
                    )
                ) {
                    return false;
                }


                const enumerator =
                    personName(
                        farm.enumerator_id
                    );


                if (
                    enumerators.length &&
                    !enumerators.includes(
                        enumerator
                    )
                ) {
                    return false;
                }


                const officer =
                    personName(
                        farm.field_officer_id
                    );


                if (
                    officers.length &&
                    !officers.includes(
                        officer
                    )
                ) {
                    return false;
                }


                if (
                    workflows.length &&
                    !workflows.includes(
                        farm.workflow_state
                    )
                ) {
                    return false;
                }


                if (
                    searchSupplier &&
                    !farm.supplier
                        .toLowerCase()
                        .includes(
                            searchSupplier
                        )
                ) {
                    return false;
                }


                if (
                    searchCoop &&
                    !farm.cooperative
                        .toLowerCase()
                        .includes(
                            searchCoop
                        )
                ) {
                    return false;
                }


                if (
                    searchEnumerator &&
                    !enumerator
                        .toLowerCase()
                        .includes(
                            searchEnumerator
                        )
                ) {
                    return false;
                }


                if (
                    searchOfficer &&
                    !officer
                        .toLowerCase()
                        .includes(
                            searchOfficer
                        )
                ) {
                    return false;
                }


                if (
                    !isDateInRange(
                        farm,
                        dateBasis,
                        dateFrom,
                        dateTo
                    )
                ) {
                    return false;
                }


                if (
                    valueOf(
                        'areaMin'
                    ) !== '' &&
                    farm.area <
                    minArea
                ) {
                    return false;
                }


                if (
                    valueOf(
                        'areaMax'
                    ) !== '' &&
                    farm.area >
                    maxArea
                ) {
                    return false;
                }


                if (
                    quality ===
                    'missing_geometry' &&
                    farm.geometry
                ) {
                    return false;
                }


                if (
                    quality ===
                    'rejection_reason' &&
                    !farm.rejection_reason
                ) {
                    return false;
                }


                if (
                    quality ===
                    'correction_required' &&
                    farm.workflow_state !==
                    'correction_required'
                ) {
                    return false;
                }


                return true;
            }
        );


    updateKPIs();

    updateFormatAvailability();

    renderPerformance();

    updateSummary();
}


function selectedValues(
    selector
) {

    return [
        ...document.querySelectorAll(
            selector
        )
    ]
        .filter(
            box =>
                box.checked
        )
        .map(
            box =>
                box.value
        );
}


function isDateInRange(
    farm,
    basis,
    from,
    to
) {

    if (!from && !to) {
        return true;
    }


    const value =
        farm[basis] ||
        farm.created_at;


    if (!value) {
        return false;
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return false;
    }


    if (from) {

        const start =
            new Date(
                `${from}T00:00:00`
            );


        if (date < start) {
            return false;
        }
    }


    if (to) {

        const end =
            new Date(
                `${to}T23:59:59`
            );


        if (date > end) {
            return false;
        }
    }


    return true;
}


/* =========================================================
   KPI
   ========================================================= */

function updateKPIs() {

    const total =
        filteredFarms.length;


    const area =
        filteredFarms.reduce(
            (
                sum,
                farm
            ) =>
                sum +
                Number(
                    farm.area ||
                    0
                ),
            0
        );


    const validated =
        countWorkflow(
            'validated'
        );


    const rejected =
        countWorkflow(
            'rejected'
        );


    const pending =
        total -
        validated -
        rejected;


    setText(
        'totalFarms',
        total.toLocaleString()
    );


    setText(
        'totalArea',
        `${area.toFixed(2)} ha`
    );


    setText(
        'validatedCount',
        validated.toLocaleString()
    );


    setText(
        'pendingCount',
        pending.toLocaleString()
    );


    setText(
        'rejectedCount',
        rejected.toLocaleString()
    );
}


function updateSummary() {

    const total =
        filteredFarms.length;


    const area =
        filteredFarms.reduce(
            (
                sum,
                farm
            ) =>
                sum +
                Number(
                    farm.area ||
                    0
                ),
            0
        );


    setText(
        'exportCount',
        total.toLocaleString()
    );


    setText(
        'exportArea',
        `${area.toFixed(2)} ha`
    );


    setText(
        'filteredValidated',
        countWorkflow(
            'validated'
        ).toLocaleString()
    );


    setText(
        'filteredRejected',
        countWorkflow(
            'rejected'
        ).toLocaleString()
    );
}


function countWorkflow(
    state
) {

    return filteredFarms.filter(
        farm =>
            farm.workflow_state ===
            state
    ).length;
}


/* =========================================================
   FORMAT
   ========================================================= */

function selectFormat(
    format
) {

    if (
        ![
            'excel',
            'geojson',
            'kmz',
            'report'
        ].includes(
            format
        )
    ) {
        return;
    }


    if (
        (
            format ===
            'geojson' ||
            format ===
            'kmz'
        ) &&
        !isGeoExportAllowed()
    ) {

        notify(
            'GeoJSON and KMZ are available only when the selected dataset contains Validated or Rejected plots.',
            'warning'
        );


        return;
    }


    selectedFormat =
        format;


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(
            option => {

                option.classList.toggle(
                    'selected',
                    option.dataset.format ===
                    format
                );
            }
        );
}


function updateFormatAvailability() {

    const allowed =
        isGeoExportAllowed();


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(
            option => {

                const format =
                    option.dataset.format;


                const restricted =
                    (
                        format ===
                        'geojson' ||
                        format ===
                        'kmz'
                    );


                option.classList.toggle(
                    'disabled',
                    restricted &&
                    !allowed
                );
            }
        );


    if (
        !allowed &&
        (
            selectedFormat ===
            'geojson' ||
            selectedFormat ===
            'kmz'
        )
    ) {

        selectFormat(
            'excel'
        );
    }


    setText(
        'formatHelp',
        allowed
            ? 'Excel, GeoJSON and KMZ are available for the selected final-outcome dataset.'
            : 'Excel is available for all workflow stages. GeoJSON/KMZ require Validated or Rejected records.'
    );
}


function isGeoExportAllowed() {

    if (
        !filteredFarms.length
    ) {
        return false;
    }


    return filteredFarms.every(
        farm =>
            [
                'validated',
                'rejected'
            ].includes(
                farm.workflow_state
            )
    );
}


/* =========================================================
   ADVANCED FILTERS
   ========================================================= */

function toggleAdvancedFilters() {

    const panel =
        document.getElementById(
            'advancedFilters'
        );


    const button =
        document.getElementById(
            'advancedToggleBtn'
        );


    if (!panel) {
        return;
    }


    const hidden =
        panel.classList.toggle(
            'hidden'
        );


    if (button) {

        button.innerHTML =
            hidden
                ? '<i class="fas fa-chevron-down"></i> Show advanced filters'
                : '<i class="fas fa-chevron-up"></i> Hide advanced filters';
    }
}


/* =========================================================
   PERFORMANCE
   ========================================================= */

function renderPerformance() {

    renderEnumeratorPerformance();

    renderCooperativePerformance();

    renderWorkflowPerformance();

    renderHighlights();
}


function renderEnumeratorPerformance() {

    const body =
        document.getElementById(
            'enumeratorPerformanceBody'
        );


    if (!body) {
        return;
    }


    const groups =
        groupBy(
            filteredFarms,
            farm =>
                personName(
                    farm.enumerator_id
                )
        );


    body.innerHTML =
        Object.entries(
            groups
        )
            .sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b.length -
                    a.length
            )
            .map(
                (
                    [
                        name,
                        rows
                    ]
                ) => {

                    const submitted =
                        rows.filter(
                            farm =>
                                [
                                    'submitted',
                                    'enumerator_review',
                                    'field_officer_review',
                                    'gis_compliance_review',
                                    'final_validation',
                                    'validated',
                                    'rejected',
                                    'correction_required'
                                ].includes(
                                    farm.workflow_state
                                )
                        ).length;


                    const validated =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'validated'
                        ).length;


                    const rejected =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'rejected'
                        ).length;


                    const correction =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'correction_required'
                        ).length;


                    const pending =
                        rows.length -
                        validated -
                        rejected;


                    const rate =
                        submitted
                            ? (
                                validated /
                                submitted *
                                100
                            )
                            : 0;


                    return `
                        <tr>
                            <td>
                                ${escapeHtml(
                                    name
                                )}
                            </td>
                            <td>${rows.length}</td>
                            <td>${submitted}</td>
                            <td>${validated}</td>
                            <td>${rejected}</td>
                            <td>${correction}</td>
                            <td>${pending}</td>
                            <td>${rate.toFixed(1)}%</td>
                        </tr>
                    `;
                }
            )
            .join('');


    if (!body.innerHTML) {

        body.innerHTML =
            emptyTableRow(
                8,
                'No enumerator data.'
            );
    }
}


function renderCooperativePerformance() {

    const body =
        document.getElementById(
            'cooperativePerformanceBody'
        );


    if (!body) {
        return;
    }


    const groups =
        groupBy(
            filteredFarms,
            farm =>
                farm.cooperative ||
                'Unassigned'
        );


    body.innerHTML =
        Object.entries(
            groups
        )
            .sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b.length -
                    a.length
            )
            .map(
                (
                    [
                        name,
                        rows
                    ]
                ) => {

                    const area =
                        rows.reduce(
                            (
                                sum,
                                farm
                            ) =>
                                sum +
                                Number(
                                    farm.area ||
                                    0
                                ),
                            0
                        );


                    const validated =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'validated'
                        ).length;


                    const rejected =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'rejected'
                        ).length;


                    const correction =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'correction_required'
                        ).length;


                    const pending =
                        rows.length -
                        validated -
                        rejected;


                    const rate =
                        rows.length
                            ? (
                                validated /
                                rows.length *
                                100
                            )
                            : 0;


                    return `
                        <tr>
                            <td>${escapeHtml(name)}</td>
                            <td>${rows.length}</td>
                            <td>${area.toFixed(2)}</td>
                            <td>${validated}</td>
                            <td>${rejected}</td>
                            <td>${correction}</td>
                            <td>${pending}</td>
                            <td>${rate.toFixed(1)}%</td>
                        </tr>
                    `;
                }
            )
            .join('');


    if (!body.innerHTML) {

        body.innerHTML =
            emptyTableRow(
                8,
                'No cooperative data.'
            );
    }
}


function renderWorkflowPerformance() {

    const body =
        document.getElementById(
            'workflowPerformanceBody'
        );


    if (!body) {
        return;
    }


    body.innerHTML =
        Object.entries(
            WORKFLOW
        )
            .map(
                (
                    [
                        state,
                        label
                    ]
                ) => {

                    const rows =
                        filteredFarms.filter(
                            farm =>
                                farm.workflow_state ===
                                state
                        );


                    const area =
                        rows.reduce(
                            (
                                sum,
                                farm
                            ) =>
                                sum +
                                Number(
                                    farm.area ||
                                    0
                                ),
                            0
                        );


                    return `
                        <tr>
                            <td>${escapeHtml(label)}</td>
                            <td>${rows.length}</td>
                            <td>${area.toFixed(2)}</td>
                        </tr>
                    `;
                }
            )
            .join('');
}


function renderHighlights() {

    const groups =
        groupBy(
            filteredFarms,
            farm =>
                personName(
                    farm.enumerator_id
                )
        );


    const stats =
        Object.entries(
            groups
        )
            .map(
                (
                    [
                        name,
                        rows
                    ]
                ) => {

                    const validated =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'validated'
                        ).length;


                    const correction =
                        rows.filter(
                            farm =>
                                farm.workflow_state ===
                                'correction_required'
                        ).length;


                    return {

                        name,

                        workload:
                            rows.length,

                        validationRate:
                            rows.length
                                ? validated /
                                  rows.length *
                                  100
                                : 0,

                        correctionRate:
                            rows.length
                                ? correction /
                                  rows.length *
                                  100
                                : 0
                    };
                }
            );


    const top =
        [...stats]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.validationRate -
                    a.validationRate
            )[0];


    const workload =
        [...stats]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.workload -
                    a.workload
            )[0];


    const correction =
        [...stats]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.correctionRate -
                    a.correctionRate
            )[0];


    setText(
        'topPerformer',
        top
            ? `${top.name} (${top.validationRate.toFixed(1)}%)`
            : '—'
    );


    setText(
        'highestWorkload',
        workload
            ? `${workload.name} (${workload.workload})`
            : '—'
    );


    setText(
        'highestCorrection',
        correction
            ? `${correction.name} (${correction.correctionRate.toFixed(1)}%)`
            : '—'
    );
}


function switchPerformanceTab(
    tab
) {

    document
        .querySelectorAll(
            '.performance-tab'
        )
        .forEach(
            button => {

                button.classList.toggle(
                    'active',
                    button.dataset.tab ===
                    tab
                );
            }
        );


    document
        .getElementById(
            'enumeratorPerformance'
        )
        ?.classList.toggle(
            'hidden',
            tab !==
            'enumerators'
        );


    document
        .getElementById(
            'cooperativePerformance'
        )
        ?.classList.toggle(
            'hidden',
            tab !==
            'cooperatives'
        );


    document
        .getElementById(
            'workflowPerformance'
        )
        ?.classList.toggle(
            'hidden',
            tab !==
            'workflow'
        );
}


/* =========================================================
   EXPORT
   ========================================================= */

async function generateExport() {

    if (!userCanExport()) {

        notify(
            'Export access is restricted for your account.',
            'error'
        );

        return;
    }


    if (!filteredFarms.length) {

        notify(
            'No records match the selected filters.',
            'warning'
        );

        return;
    }


    try {

        showLoading(true);


        if (
            selectedFormat ===
            'excel'
        ) {

            exportExcel(
                filteredFarms,
                'MappingTrace_Export'
            );

        } else if (
            selectedFormat ===
            'geojson'
        ) {

            if (
                !isGeoExportAllowed()
            ) {

                throw new Error(
                    'GeoJSON is available only for Validated or Rejected records.'
                );
            }


            exportGeoJSON(
                filteredFarms
            );

        } else if (
            selectedFormat ===
            'kmz'
        ) {

            if (
                !isGeoExportAllowed()
            ) {

                throw new Error(
                    'KMZ is available only for Validated or Rejected records.'
                );
            }


            await exportKMZ(
                filteredFarms
            );

        } else if (
            selectedFormat ===
            'report'
        ) {

            exportProgressReport(
                filteredFarms
            );
        }


        await recordExport(
            selectedFormat,
            filteredFarms.length
        );


        await loadExportHistory();


        notify(
            'Export generated successfully.',
            'success'
        );

    } catch (error) {

        console.error(
            'Export error:',
            error
        );


        notify(
            error.message ||
            'Export failed.',
            'error'
        );

    } finally {

        showLoading(false);
    }
}


/* =========================================================
   EXCEL
   ========================================================= */

function exportExcel(
    rows,
    prefix
) {

    if (!window.XLSX) {

        throw new Error(
            'Excel library is not loaded.'
        );
    }


    const workbook =
        XLSX.utils.book_new();


    const farmsSheet =
        XLSX.utils.json_to_sheet(
            rows.map(
                exportRow
            )
        );


    XLSX.utils.book_append_sheet(
        workbook,
        farmsSheet,
        'Farms'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            enumeratorExportStats(
                rows
            )
        ),
        'Enumerators'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            cooperativeExportStats(
                rows
            )
        ),
        'Cooperatives'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            workflowExportStats(
                rows
            )
        ),
        'Workflow'
    );


    XLSX.writeFile(
        workbook,
        `${safeName(prefix)}_${dateStamp()}.xlsx`
    );
}


/* =========================================================
   GEOJSON
   ========================================================= */

function exportGeoJSON(
    rows
) {

    if (!window.saveAs) {

        throw new Error(
            'FileSaver library is not loaded.'
        );
    }


    const features =
        rows
            .filter(
                farm =>
                    farm.geometry
            )
            .map(
                farm => ({

                    type:
                        'Feature',

                    geometry:
                        stripZ(
                            farm.geometry
                        ),

                    properties:
                        exportRow(
                            farm
                        )
                })
            );


    if (!features.length) {

        throw new Error(
            'No valid geometry is available.'
        );
    }


    const blob =
        new Blob(
            [
                JSON.stringify(
                    {
                        type:
                            'FeatureCollection',

                        features
                    },
                    null,
                    2
                )
            ],
            {
                type:
                    'application/geo+json'
            }
        );


    saveAs(
        blob,
        `MappingTrace_${safeName(
            currentProject.name
        )}_${dateStamp()}.geojson`
    );
}


/* =========================================================
   KMZ
   ========================================================= */

async function exportKMZ(
    rows
) {

    if (!window.JSZip) {

        throw new Error(
            'JSZip library is not loaded.'
        );
    }


    if (!window.saveAs) {

        throw new Error(
            'FileSaver library is not loaded.'
        );
    }


    const placemarks =
        rows
            .filter(
                farm =>
                    farm.geometry
            )
            .map(
                farm =>
                    farmToKML(
                        farm
                    )
            )
            .join('');


    if (!placemarks) {

        throw new Error(
            'No valid polygon geometry is available.'
        );
    }


    const kml =
        `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <name>${escapeXml(
                    currentProject?.name ||
                    'MappingTrace'
                )}</name>
                ${placemarks}
            </Document>
        </kml>`;


    const zip =
        new JSZip();


    zip.file(
        'doc.kml',
        kml
    );


    const blob =
        await zip.generateAsync({
            type:
                'blob',

            compression:
                'DEFLATE'
        });


    saveAs(
        blob,
        `MappingTrace_${safeName(
            currentProject.name
        )}_${dateStamp()}.kmz`
    );
}


function farmToKML(
    farm
) {

    const geometry =
        stripZ(
            farm.geometry
        );


    let geometryKml =
        '';


    if (
        geometry.type ===
        'Polygon'
    ) {

        geometryKml =
            polygonKML(
                geometry.coordinates
            );

    } else if (
        geometry.type ===
        'MultiPolygon'
    ) {

        geometryKml =
            geometry.coordinates
                .map(
                    polygonKML
                )
                .join('');
    }


    return `
        <Placemark>

            <name>
                ${escapeXml(
                    farm.farm_id
                )}
            </name>

            <description>
                Farmer: ${escapeXml(
                    farm.farmer_name
                )}<br/>
                Cooperative: ${escapeXml(
                    farm.cooperative
                )}<br/>
                Workflow: ${escapeXml(
                    WORKFLOW[
                        farm.workflow_state
                    ] ||
                    farm.workflow_state
                )}<br/>
                Area: ${Number(
                    farm.area ||
                    0
                ).toFixed(2)} ha
            </description>

            ${geometryKml}

        </Placemark>
    `;
}


function polygonKML(
    coordinates
) {

    const outer =
        coordinates[0];


    const holes =
        coordinates.slice(
            1
        );


    return `
        <Polygon>

            <outerBoundaryIs>
                <LinearRing>
                    <coordinates>
                        ${coordsKML(
                            outer
                        )}
                    </coordinates>
                </LinearRing>
            </outerBoundaryIs>

            ${holes
                .map(
                    hole =>
                        `
                        <innerBoundaryIs>
                            <LinearRing>
                                <coordinates>
                                    ${coordsKML(
                                        hole
                                    )}
                                </coordinates>
                            </LinearRing>
                        </innerBoundaryIs>
                        `
                )
                .join('')}

        </Polygon>
    `;
}


function coordsKML(
    coordinates
) {

    return coordinates
        .map(
            point =>
                `${point[0]},${point[1]},${point[2] || 0}`
        )
        .join(' ');
}


/* =========================================================
   PROGRESS REPORT
   ========================================================= */

function exportProgressReport(
    rows
) {

    if (!window.XLSX) {

        throw new Error(
            'Excel library is not loaded.'
        );
    }


    const total =
        rows.length;


    const validated =
        rows.filter(
            row =>
                row.workflow_state ===
                'validated'
        ).length;


    const rejected =
        rows.filter(
            row =>
                row.workflow_state ===
                'rejected'
        ).length;


    const pending =
        total -
        validated -
        rejected;


    const area =
        rows.reduce(
            (
                sum,
                row
            ) =>
                sum +
                Number(
                    row.area ||
                    0
                ),
            0
        );


    const workbook =
        XLSX.utils.book_new();


    const summary =
        [

            {
                KPI:
                    'Total Farms',

                Value:
                    total
            },

            {
                KPI:
                    'Total Area (ha)',

                Value:
                    Number(
                        area.toFixed(
                            2
                        )
                    )
            },

            {
                KPI:
                    'Validated',

                Value:
                    validated
            },

            {
                KPI:
                    'Rejected',

                Value:
                    rejected
            },

            {
                KPI:
                    'Pending',

                Value:
                    pending
            },

            {
                KPI:
                    'Validation Rate',

                Value:
                    total
                        ? `${(
                            validated /
                            total *
                            100
                        ).toFixed(1)}%`
                        : '0%'
            }

        ];


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            summary
        ),
        'Summary'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            workflowExportStats(
                rows
            )
        ),
        'Workflow'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            enumeratorExportStats(
                rows
            )
        ),
        'Enumerators'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            cooperativeExportStats(
                rows
            )
        ),
        'Cooperatives'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            rows.map(
                exportRow
            )
        ),
        'Selected Farms'
    );


    XLSX.writeFile(
        workbook,
        `MappingTrace_Progress_Report_${safeName(
            currentProject.name
        )}_${dateStamp()}.xlsx`
    );
}


/* =========================================================
   REJECTED AUDIT
   ========================================================= */

async function exportRejectedAudit() {

    if (!userCanExport()) {

        notify(
            'Export access is restricted.',
            'error'
        );

        return;
    }


    const rejected =
        filteredFarms.filter(
            farm =>
                farm.workflow_state ===
                'rejected'
        );


    if (!rejected.length) {

        notify(
            'No rejected plots match the current filters.',
            'warning'
        );

        return;
    }


    try {

        showLoading(true);


        exportExcel(
            rejected,
            'MappingTrace_Rejected_Audit'
        );


        await recordExport(
            'rejected_audit',
            rejected.length
        );


        await loadExportHistory();


        notify(
            `Rejected audit exported: ${rejected.length.toLocaleString()} plots.`,
            'success'
        );

    } catch (error) {

        notify(
            error.message ||
            'Rejected audit export failed.',
            'error'
        );

    } finally {

        showLoading(false);
    }
}


/* =========================================================
   PREVIEW
   ========================================================= */

function previewExport() {

    const section =
        document.getElementById(
            'previewSection'
        );


    const header =
        document.getElementById(
            'previewHeader'
        );


    const body =
        document.getElementById(
            'previewBody'
        );


    const total =
        document.getElementById(
            'previewTotal'
        );


    if (
        !section ||
        !header ||
        !body
    ) {
        return;
    }


    const rows =
        filteredFarms.slice(
            0,
            10
        );


    header.innerHTML =
        `
        <tr>
            <th>Farm ID</th>
            <th>Farmer</th>
            <th>Cooperative</th>
            <th>Enumerator</th>
            <th>Workflow</th>
            <th>Area (ha)</th>
        </tr>
        `;


    body.innerHTML =
        rows
            .map(
                farm =>
                    `
                    <tr>
                        <td>${escapeHtml(
                            farm.farm_id
                        )}</td>

                        <td>${escapeHtml(
                            farm.farmer_name
                        )}</td>

                        <td>${escapeHtml(
                            farm.cooperative
                        )}</td>

                        <td>${escapeHtml(
                            personName(
                                farm.enumerator_id
                            )
                        )}</td>

                        <td>
                            ${escapeHtml(
                                WORKFLOW[
                                    farm.workflow_state
                                ] ||
                                farm.workflow_state
                            )}
                        </td>

                        <td>
                            ${Number(
                                farm.area ||
                                0
                            ).toFixed(2)}
                        </td>
                    </tr>
                    `
            )
            .join('');


    setText(
        'previewTotal',
        filteredFarms.length
    );


    section.style.display =
        'block';


    section.scrollIntoView({
        behavior:
            'smooth'
    });
}


function hidePreview() {

    const section =
        document.getElementById(
            'previewSection'
        );


    if (section) {

        section.style.display =
            'none';
    }
}


/* =========================================================
   EXPORT HISTORY
   ========================================================= */

async function recordExport(
    format,
    count
) {

    try {

        const {
            error
        } =
            await db
                .from(
                    'export_history'
                )
                .insert({

                    project_id:
                        currentProject.id,

                    user_id:
                        currentUser.id,

                    format,

                    record_count:
                        count
                });


        if (error) {

            console.warn(
                'Export history insert failed:',
                error
            );
        }

    } catch (error) {

        console.warn(
            'Export history error:',
            error
        );
    }
}


async function loadExportHistory() {

    const container =
        document.getElementById(
            'historyList'
        );


    if (
        !container ||
        !currentProject
    ) {
        return;
    }


    try {

        const {
            data,
            error
        } =
            await db
                .from(
                    'export_history'
                )
                .select(`
                    created_at,
                    format,
                    record_count,
                    user_id
                `)
                .eq(
                    'project_id',
                    currentProject.id
                )
                .order(
                    'created_at',
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    15
                );


        if (error) {
            throw error;
        }


        if (!data?.length) {

            container.innerHTML =
                `
                <div class="empty-history">

                    <i class="fas fa-box-open"></i>

                    <p>
                        No exports yet
                    </p>

                </div>
                `;

            return;
        }


        container.innerHTML =
            data
                .map(
                    row =>
                        `
                        <div class="history-item">

                            <div class="history-info">

                                <div class="history-icon">

                                    <i class="fas ${
                                        formatIcon(
                                            row.format
                                        )
                                    }"></i>

                                </div>

                                <div class="history-details">

                                    <div class="history-filename">
                                        ${escapeHtml(
                                            formatLabel(
                                                row.format
                                            )
                                        )}
                                    </div>

                                    <div class="history-meta">

                                        <span>
                                            ${Number(
                                                row.record_count ||
                                                0
                                            ).toLocaleString()}
                                            records
                                        </span>

                                        <span>
                                            ${formatDate(
                                                row.created_at
                                            )}
                                        </span>

                                    </div>

                                </div>

                            </div>

                        </div>
                        `
                )
                .join('');

    } catch (error) {

        console.warn(
            'Export history unavailable:',
            error
        );


        container.innerHTML =
            `
            <div class="empty-history">
                <i class="fas fa-exclamation-circle"></i>
                <p>Export history unavailable</p>
            </div>
            `;
    }
}


/* =========================================================
   RESET
   ========================================================= */

function resetFilters() {

    [
        'supplierSearch',
        'coopSearch',
        'enumeratorSearch',
        'fieldOfficerSearch',
        'dateFrom',
        'dateTo',
        'areaMin',
        'areaMax'
    ]
        .forEach(
            id => {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {
                    element.value =
                        '';
                }
            }
        );


    [
        'supplier-checkbox',
        'cooperative-checkbox',
        'enumerator-checkbox',
        'fieldOfficer-checkbox',
        'workflow-checkbox'
    ]
        .forEach(
            className => {

                document
                    .querySelectorAll(
                        `.${className}`
                    )
                    .forEach(
                        box => {

                            box.checked =
                                true;
                        }
                    );
            }
        );


    updateWorkflowButton();

    selectFormat(
        'excel'
    );


    applyFilters();


    hidePreview();


    notify(
        'Filters reset.',
        'success'
    );
}


function clearDates() {

    setValue(
        'dateFrom',
        ''
    );


    setValue(
        'dateTo',
        ''
    );


    applyFilters();
}


/* =========================================================
   EXPORT DATA
   ========================================================= */

function exportRow(
    farm
) {

    return {

        Farm_ID:
            farm.farm_id,

        Farmer_ID:
            farm.farmer_id,

        Farmer_Name:
            farm.farmer_name,

        Supplier:
            farm.supplier,

        Cooperative:
            farm.cooperative,

        Enumerator:
            personName(
                farm.enumerator_id
            ),

        Field_Officer:
            personName(
                farm.field_officer_id
            ),

        Workflow_State:
            farm.workflow_state,

        Status:
            farm.status ||
            '',

        Area_ha:
            Number(
                farm.area ||
                0
            ),

        Rejection_Reason:
            farm.rejection_reason ||
            '',

        Correction_Reason:
            farm.correction_reason ||
            '',

        Created_At:
            farm.created_at ||
            '',

        Updated_At:
            farm.updated_at ||
            ''
    };
}


function enumeratorExportStats(
    rows
) {

    const groups =
        groupBy(
            rows,
            farm =>
                personName(
                    farm.enumerator_id
                )
        );


    return Object.entries(
        groups
    )
        .map(
            (
                [
                    name,
                    items
                ]
            ) => {

                const validated =
                    items.filter(
                        item =>
                            item.workflow_state ===
                            'validated'
                    ).length;


                return {

                    Enumerator:
                        name,

                    Mapped:
                        items.length,

                    Validated:
                        validated,

                    Rejected:
                        items.filter(
                            item =>
                                item.workflow_state ===
                                'rejected'
                        ).length,

                    Correction:
                        items.filter(
                            item =>
                                item.workflow_state ===
                                'correction_required'
                        ).length,

                    Pending:
                        items.length -
                        validated -
                        items.filter(
                            item =>
                                item.workflow_state ===
                                'rejected'
                        ).length,

                    Validation_Rate:
                        items.length
                            ? `${(
                                validated /
                                items.length *
                                100
                            ).toFixed(1)}%`
                            : '0%'
                };
            }
        );
}


function cooperativeExportStats(
    rows
) {

    const groups =
        groupBy(
            rows,
            farm =>
                farm.cooperative ||
                'Unassigned'
        );


    return Object.entries(
        groups
    )
        .map(
            (
                [
                    name,
                    items
                ]
            ) => {

                const validated =
                    items.filter(
                        item =>
                            item.workflow_state ===
                            'validated'
                    ).length;


                const area =
                    items.reduce(
                        (
                            sum,
                            item
                        ) =>
                            sum +
                            Number(
                                item.area ||
                                0
                            ),
                        0
                    );


                return {

                    Cooperative:
                        name,

                    Farms:
                        items.length,

                    Area_ha:
                        Number(
                            area.toFixed(
                                2
                            )
                        ),

                    Validated:
                        validated,

                    Rejected:
                        items.filter(
                            item =>
                                item.workflow_state ===
                                'rejected'
                        ).length,

                    Correction:
                        items.filter(
                            item =>
                                item.workflow_state ===
                                'correction_required'
                        ).length,

                    Pending:
                        items.length -
                        validated -
                        items.filter(
                            item =>
                                item.workflow_state ===
                                'rejected'
                        ).length,

                    Validation_Rate:
                        items.length
                            ? `${(
                                validated /
                                items.length *
                                100
                            ).toFixed(1)}%`
                            : '0%'
                };
            }
        );
}


function workflowExportStats(
    rows
) {

    return Object.entries(
        WORKFLOW
    )
        .map(
            (
                [
                    state,
                    label
                ]
            ) => {

                const items =
                    rows.filter(
                        row =>
                            row.workflow_state ===
                            state
                    );


                return {

                    Workflow_Stage:
                        label,

                    Farms:
                        items.length,

                    Area_ha:
                        Number(
                            items.reduce(
                                (
                                    sum,
                                    item
                                ) =>
                                    sum +
                                    Number(
                                        item.area ||
                                        0
                                    ),
                                0
                            ).toFixed(
                                2
                            )
                        )
                };
            }
        );
}


/* =========================================================
   HELPERS
   ========================================================= */

function parseGeometry(
    geometry
) {

    if (!geometry) {
        return null;
    }


    if (
        typeof geometry ===
        'object'
    ) {

        return geometry;
    }


    if (
        typeof geometry ===
        'string'
    ) {

        try {

            return JSON.parse(
                geometry
            );

        } catch {

            return null;
        }
    }


    return null;
}


function stripZ(
    geometry
) {

    if (!geometry) {
        return null;
    }


    const clone =
        JSON.parse(
            JSON.stringify(
                geometry
            )
        );


    function clean(
        value
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            if (
                value.length &&
                typeof value[0] ===
                'number'
            ) {

                return value.slice(
                    0,
                    2
                );
            }


            return value.map(
                clean
            );
        }


        return value;
    }


    clone.coordinates =
        clean(
            clone.coordinates
        );


    return clone;
}


function personName(
    userId
) {

    if (!userId) {
        return 'Unassigned';
    }


    const member =
        members.find(
            item =>
                item.user_id ===
                userId
        );


    if (!member) {
        return userId;
    }


    const profile =
        member.profile;


    return (
        [
            profile?.first_name,
            profile?.last_name
        ]
            .filter(Boolean)
            .join(' ') ||
        profile?.email ||
        userId
    );
}


function groupBy(
    rows,
    callback
) {

    return rows.reduce(
        (
            groups,
            row
        ) => {

            const key =
                callback(
                    row
                );


            if (!groups[key]) {
                groups[key] = [];
            }


            groups[key].push(
                row
            );


            return groups;
        },
        {}
    );
}


function unique(
    values
) {

    return [
        ...new Set(
            values
        )
    ];
}


function valueOf(
    id
) {

    return (
        document
            .getElementById(
                id
            )?.value ||
        ''
    )
        .trim()
        .toLowerCase();
}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {
        element.value =
            value;
    }
}


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


function emptyTableRow(
    columns,
    message
) {

    return `
        <tr>
            <td colspan="${columns}">
                ${escapeHtml(
                    message
                )}
            </td>
        </tr>
    `;
}


function escapeHtml(
    value
) {

    return String(
        value ??
        ''
    )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );
}


function escapeXml(
    value
) {

    return escapeHtml(
        value
    );
}


function safeName(
    value
) {

    return String(
        value ||
        'project'
    )
        .replace(
            /[^a-z0-9]+/gi,
            '_'
        )
        .replace(
            /^_+|_+$/g,
            '');
}


function dateStamp() {

    return new Date()
        .toISOString()
        .slice(
            0,
            19
        )
        .replace(
            /[:T]/g,
            '-'
        );
}


function formatDate(
    value
) {

    if (!value) {
        return '—';
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '—';
    }


    return date.toLocaleString();
}


function formatLabel(
    format
) {

    const labels = {

        excel:
            'Excel',

        geojson:
            'GeoJSON',

        kmz:
            'KMZ',

        report:
            'Progress Report',

        rejected_audit:
            'Rejected Audit'
    };


    return (
        labels[
            format
        ] ||
        format ||
        'Export'
    );
}


function formatIcon(
    format
) {

    const icons = {

        excel:
            'fa-file-excel',

        geojson:
            'fa-draw-polygon',

        kmz:
            'fa-map',

        report:
            'fa-file-alt',

        rejected_audit:
            'fa-file-signature'
    };


    return (
        icons[
            format
        ] ||
        'fa-file'
    );
}


function showLoading(
    show
) {

    const overlay =
        document.getElementById(
            'loadingOverlay'
        );


    if (!overlay) {
        return;
    }


    overlay.style.display =
        show
            ? 'flex'
            : 'none';
}


function notify(
    message,
    type = 'info'
) {

    console.log(
        `[${type}]`,
        message
    );


    /*
       Use your existing notification
       system if one exists.
       This fallback keeps the page
       functional without it.
    */

    let container =
        document.getElementById(
            'mtNotification'
        );


    if (!container) {

        container =
            document.createElement(
                'div'
            );


        container.id =
            'mtNotification';


        container.style.cssText =
            `
            position:fixed;
            right:20px;
            bottom:20px;
            z-index:99999;
            padding:12px 16px;
            border-radius:8px;
            background:#0f172a;
            color:#fff;
            font:13px Inter,sans-serif;
            box-shadow:0 8px 24px rgba(0,0,0,.18);
            `;


        document.body.appendChild(
            container
        );
    }


    container.textContent =
        message;


    clearTimeout(
        container._timer
    );


    container._timer =
        setTimeout(
            () => {

                container.remove();

            },
            3500
        );
}


/* =========================================================
   REFRESH / LOGOUT
   ========================================================= */

async function refreshAll() {

    try {

        showLoading(true);


        await loadMembers();

        await loadFarms();

        updateProjectHeader();

        updateUserHeader();

        updatePermissionUI();

        applyFilters();

        await loadExportHistory();


        notify(
            'Export Center refreshed.',
            'success'
        );

    } catch (error) {

        console.error(
            error
        );


        notify(
            error.message ||
            'Refresh failed.',
            'error'
        );

    } finally {

        showLoading(false);
    }
}


async function logout() {

    try {

        const {
            error
        } =
            await db.auth.signOut();


        if (error) {
            throw error;
        }


        window.location.href =
            '../login.html';

    } catch (error) {

        notify(
            error.message ||
            'Unable to log out.',
            'error'
        );
    }
}


/* =========================================================
   END
   ========================================================= */
