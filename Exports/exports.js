// ===========================================
// MappingTrace - Export Center V2
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

        const icon = sidebarToggle.querySelector('i');

        icon.className = sidebar.classList.contains('collapsed')
            ? 'fas fa-chevron-right'
            : 'fas fa-chevron-left';

        localStorage.setItem(
            'sidebarCollapsed',
            sidebar.classList.contains('collapsed')
        );
    }
}

function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

burgerBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleSidebar();
});

sidebarToggle?.addEventListener('click', e => {
    e.stopPropagation();

    if (window.innerWidth > 768) {
        toggleSidebar();
    }
});

sidebarOverlay?.addEventListener('click', closeMobileSidebar);

if (
    window.innerWidth > 768 &&
    localStorage.getItem('sidebarCollapsed') === 'true'
) {
    sidebar.classList.add('collapsed');

    sidebarToggle.querySelector('i').className =
        'fas fa-chevron-right';
}


// ===========================================
// SUPABASE
// ===========================================

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';


// ===========================================
// GLOBAL VARIABLES
// ===========================================

let supabaseClient;
let currentUser;
let currentProject;

let allUserProjects = [];
let allFarms = [];

let filteredFarms = [];

let allSuppliers = [];
let allCooperatives = [];
let allEnumerators = [];
let allFieldOfficers = [];

let selectedSuppliers = new Set();
let selectedCooperatives = new Set();
let selectedEnumerators = new Set();
let selectedFieldOfficers = new Set();

let selectedWorkflowStates = new Set([
    'submitted',
    'enumerator_review',
    'field_officer_review',
    'gis_compliance_review',
    'final_validation',
    'correction_required',
    'validated',
    'rejected'
]);

let selectedDateFrom = '';
let selectedDateTo = '';

let exportFormat = 'excel';

let currentMembership = null;

let canExportPermission = false;
let canManageExportPermissions = false;

let memberDirectory = new Map();


// ===========================================
// ROLES
// ===========================================

const MANAGEMENT_ROLES = [
    'owner',
    'manager',
    'super_manager'
];

const FINAL_GEO_STATES = new Set([
    'validated',
    'rejected'
]);

const workflowLabel = {
    submitted: 'Submitted',
    enumerator_review: 'Enumerator Review',
    field_officer_review: 'Field Officer Review',
    gis_compliance_review: 'GIS / Compliance',
    final_validation: 'Final Validation',
    correction_required: 'Correction Required',
    validated: 'Validated',
    rejected: 'Rejected'
};


// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', async () => {

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    try {

        await loadUserAndProjects();

        setupDropdown();

        setupEventListeners();

    } catch (error) {

        console.error(error);

        showNotification(
            error.message || 'Unable to initialize Export Center',
            'error'
        );
    }
});


// ===========================================
// USER / PROJECT
// ===========================================

async function loadUserAndProjects() {

    showLoading(true);

    const {
        data: { session },
        error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
        throw sessionError;
    }

    if (!session) {
        window.location.href = '../login.html';
        return;
    }

    currentUser = session.user;


    // -----------------------------------------
    // PROFILE
    // -----------------------------------------

    const { data: profile } =
        await supabaseClient
            .from('user_profiles')
            .select('first_name,email')
            .eq('id', currentUser.id)
            .maybeSingle();

    const firstName = profile?.first_name || '';

    const displayName =
        firstName ||
        currentUser.email.split('@')[0];

    document.getElementById('userName').textContent =
        displayName;

    document.getElementById('userAvatar').textContent =
        (
            firstName.charAt(0) ||
            currentUser.email.charAt(0)
        ).toUpperCase();


    // -----------------------------------------
    // MEMBERSHIPS
    // -----------------------------------------

    const {
        data: memberships,
        error: memberError
    } = await supabaseClient
        .from('project_members')
        .select(
            'project_id,role,status,can_export,projects(*)'
        )
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

    if (memberError) {
        throw memberError;
    }

    if (!memberships?.length) {

        throw new Error(
            'You are not an active member of any project.'
        );
    }

    allUserProjects = memberships;

    currentMembership = memberships[0];


    document.getElementById('userRole').textContent =
        String(currentMembership.role)
            .replaceAll('_', ' ')
            .toUpperCase();


    // -----------------------------------------
    // ROLE BADGE
    // -----------------------------------------

    const badge = document.createElement('span');

    badge.className =
        `role-badge ${currentMembership.role}`;

    badge.textContent =
        currentMembership.role.toUpperCase();

    document
        .querySelector('.user-info')
        .insertBefore(
            badge,
            document.querySelector('.sync-btn')
        );


    // -----------------------------------------
    // PROJECT
    // -----------------------------------------

    const params =
        new URLSearchParams(window.location.search);

    const projectId =
        params.get('project');

    currentMembership =
        memberships.find(
            m => m.projects?.id === projectId
        ) || currentMembership;

    currentProject =
        currentMembership.projects;


    if (memberships.length > 1) {

        document
            .getElementById(
                'projectSelectorContainer'
            )
            .classList.remove('hidden');

        await populateDropdown(
            memberships
        );
    }


    await loadProjectMembers(
        currentProject.id
    );

    await loadFarms(
        currentProject.id
    );

    updatePermissionUI();


    localStorage.setItem(
        `lastProject_${currentUser.id}`,
        currentProject.id
    );


    const url =
        new URL(window.location.href);

    url.searchParams.set(
        'project',
        currentProject.id
    );

    history.replaceState(
        {},
        '',
        url
    );


    showLoading(false);
}


// ===========================================
// PROJECT MEMBERS
// ===========================================

async function loadProjectMembers(projectId) {

    const {
        data,
        error
    } = await supabaseClient
        .from('project_members')
        .select(
            'user_id,project_id,role,status,can_export'
        )
        .eq('project_id', projectId)
        .eq('status', 'active');

    if (error) {
        throw error;
    }


    memberDirectory = new Map();


    for (const member of data || []) {

        memberDirectory.set(
            member.user_id,
            member
        );
    }


    // -----------------------------------------
    // PROFILES
    // -----------------------------------------

    const ids =
        [...memberDirectory.keys()];

    if (ids.length) {

        const {
            data: profiles
        } = await supabaseClient
            .from('user_profiles')
            .select(
                'id,first_name,last_name,email'
            )
            .in('id', ids);


        (profiles || []).forEach(profile => {

            const member =
                memberDirectory.get(profile.id);

            if (member) {
                member.profile = profile;
            }
        });
    }


    // -----------------------------------------
    // CURRENT USER
    // -----------------------------------------

    const own =
        memberDirectory.get(
            currentUser.id
        );

    const role =
        String(
            own?.role ||
            currentMembership?.role ||
            ''
        ).toLowerCase();


    canManageExportPermissions =
        MANAGEMENT_ROLES.includes(role);


    canExportPermission =
        canManageExportPermissions ||
        own?.can_export === true;
}


// ===========================================
// FARM DATA
// ===========================================

async function loadFarms(projectId) {

    showLoading(true);

    const {
        data,
        error
    } = await supabaseClient
        .from('farms')
        .select('*')
        .eq('project_id', projectId);

    if (error) {
        throw error;
    }

    processFarmsData(
        data || []
    );

    showLoading(false);
}


// ===========================================
// ALL PROJECTS
// ===========================================

async function loadAllProjectsFarms() {

    showLoading(true);

    let data = [];


    for (const membership of allUserProjects) {

        const {
            data: farms,
            error
        } = await supabaseClient
            .from('farms')
            .select('*')
            .eq(
                'project_id',
                membership.projects.id
            );

        if (error) {
            throw error;
        }

        data.push(
            ...(farms || [])
        );
    }


    processFarmsData(data);


    currentProject = null;

    document.getElementById(
        'projectBadge'
    ).textContent =
        'ALL PROJECTS';


    showLoading(false);
}


// ===========================================
// PERSON NAME
// ===========================================

function personName(id) {

    if (!id) {
        return 'Unassigned';
    }

    const member =
        memberDirectory.get(id);

    const profile =
        member?.profile;

    if (!profile) {
        return id;
    }

    return (
        [
            profile.first_name,
            profile.last_name
        ]
            .filter(Boolean)
            .join(' ') ||

        profile.email ||

        id
    );
}


// ===========================================
// WORKFLOW NORMALIZATION
// ===========================================

function normalizeWorkflow(farm) {

    if (farm.workflow_state) {
        return farm.workflow_state;
    }

    if (farm.status === 'validated') {
        return 'validated';
    }

    if (farm.status === 'rejected') {
        return 'rejected';
    }

    return 'submitted';
}


// ===========================================
// PROCESS FARMS
// ===========================================

function processFarmsData(farms) {

    allFarms =
        (farms || []).map(farm => ({

            ...farm,

            farm_id:
                farm.farm_code ||
                farm.farmer_id ||
                farm.id?.slice(0, 8),

            supplier:
                farm.supplier ||
                'Unassigned',

            cooperative:
                farm.cooperative ||
                'Unassigned',

            area:
                Number(farm.area) || 0,

            workflow_state:
                normalizeWorkflow(farm),

            enumerator_id:
                farm.mapped_by ||
                farm.enumerator_id ||
                farm.created_by ||
                farm.submitted_by ||
                null,

            field_officer_id:
                farm.field_officer_checked_by ||
                farm.field_officer_id ||
                null,

            created_at:
                farm.created_at || null
        }));


    // -----------------------------------------
    // FILTER VALUES
    // -----------------------------------------

    allSuppliers =
        [
            ...new Set(
                allFarms
                    .map(f => f.supplier)
                    .filter(Boolean)
            )
        ].sort();


    allCooperatives =
        [
            ...new Set(
                allFarms
                    .map(f => f.cooperative)
                    .filter(Boolean)
            )
        ].sort();


    const enumeratorIds =
        [
            ...new Set(
                allFarms
                    .map(f => f.enumerator_id)
                    .filter(Boolean)
            )
        ];


    const fieldOfficerIds =
        [
            ...new Set(
                allFarms
                    .map(f => f.field_officer_id)
                    .filter(Boolean)
            )
        ];


    allEnumerators =
        enumeratorIds
            .map(id => ({
                id,
                name: personName(id)
            }))
            .sort(
                (a, b) =>
                    a.name.localeCompare(b.name)
            );


    allFieldOfficers =
        fieldOfficerIds
            .map(id => ({
                id,
                name: personName(id)
            }))
            .sort(
                (a, b) =>
                    a.name.localeCompare(b.name)
            );


    // -----------------------------------------
    // DEFAULT SELECT ALL
    // -----------------------------------------

    selectedSuppliers =
        new Set(allSuppliers);

    selectedCooperatives =
        new Set(allCooperatives);

    selectedEnumerators =
        new Set(
            allEnumerators.map(
                x => x.id
            )
        );

    selectedFieldOfficers =
        new Set(
            allFieldOfficers.map(
                x => x.id
            )
        );


    renderFilters();

    applyFilters();

    renderPerformance();

    updatePermissionUI();
}


// ===========================================
// FILTER UI
// ===========================================

function renderFilters() {

    renderCheckboxList(
        'supplierList',
        allSuppliers,
        selectedSuppliers,
        'supplier'
    );


    renderCheckboxList(
        'cooperativeList',
        allCooperatives,
        selectedCooperatives,
        'cooperative'
    );


    renderCheckboxList(
        'enumeratorList',
        allEnumerators,
        selectedEnumerators,
        'enumerator',
        true
    );


    renderCheckboxList(
        'fieldOfficerList',
        allFieldOfficers,
        selectedFieldOfficers,
        'field_officer',
        true
    );
}


// ===========================================
// CHECKBOX LIST
// ===========================================

function renderCheckboxList(
    containerId,
    values,
    selected,
    type,
    objectValues = false
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {
        return;
    }


    const searchMap = {

        supplier:
            'supplierSearch',

        cooperative:
            'coopSearch',

        enumerator:
            'enumeratorSearch',

        field_officer:
            'fieldOfficerSearch'
    };


    const search =
        document.getElementById(
            searchMap[type]
        );


    const term =
        (
            search?.value || ''
        ).toLowerCase();


    const filtered =
        objectValues

            ? values.filter(
                item =>
                    item.name
                        .toLowerCase()
                        .includes(term)
            )

            : values.filter(
                item =>
                    item
                        .toLowerCase()
                        .includes(term)
            );


    if (!filtered.length) {

        container.innerHTML =
            `
            <div
                class="checkbox-item"
                style="
                    justify-content:center;
                    color:#94a3b8;
                "
            >
                No results
            </div>
            `;

        return;
    }


    container.innerHTML =
        filtered
            .map(item => {

                const value =
                    objectValues
                        ? item.id
                        : item;

                const label =
                    objectValues
                        ? item.name
                        : item;


                return `
                    <label class="checkbox-item">

                        <input
                            type="checkbox"
                            data-filter="${type}"
                            value="${escapeHtml(value)}"
                            ${selected.has(value)
                                ? 'checked'
                                : ''}
                        >

                        <span class="checkbox-label">
                            ${escapeHtml(label)}
                        </span>

                    </label>
                `;
            })
            .join('');


    container
        .querySelectorAll('input')
        .forEach(checkbox => {

            checkbox.addEventListener(
                'change',
                () => {

                    let set;

                    if (
                        type ===
                        'supplier'
                    ) {

                        set =
                            selectedSuppliers;

                    } else if (
                        type ===
                        'cooperative'
                    ) {

                        set =
                            selectedCooperatives;

                    } else if (
                        type ===
                        'enumerator'
                    ) {

                        set =
                            selectedEnumerators;

                    } else {

                        set =
                            selectedFieldOfficers;
                    }


                    if (checkbox.checked) {

                        set.add(
                            checkbox.value
                        );

                    } else {

                        set.delete(
                            checkbox.value
                        );
                    }


                    applyFilters();
                }
            );
        });
}


// ===========================================
// FILTERING
// ===========================================

function applyFilters() {

    selectedDateFrom =
        document.getElementById(
            'dateFrom'
        )?.value || '';


    selectedDateTo =
        document.getElementById(
            'dateTo'
        )?.value || '';


    filteredFarms =
        allFarms.filter(farm => {

            if (
                !selectedSuppliers.has(
                    farm.supplier
                )
            ) {
                return false;
            }


            if (
                !selectedCooperatives.has(
                    farm.cooperative
                )
            ) {
                return false;
            }


            if (
                farm.enumerator_id &&
                !selectedEnumerators.has(
                    farm.enumerator_id
                )
            ) {
                return false;
            }


            if (
                farm.field_officer_id &&
                !selectedFieldOfficers.has(
                    farm.field_officer_id
                )
            ) {
                return false;
            }


            if (
                !selectedWorkflowStates.has(
                    farm.workflow_state
                )
            ) {
                return false;
            }


            const date =
                farm.created_at
                    ? new Date(
                        farm.created_at
                    )
                    : null;


            if (
                selectedDateFrom &&
                (
                    !date ||
                    date <
                    new Date(
                        selectedDateFrom +
                        'T00:00:00'
                    )
                )
            ) {
                return false;
            }


            if (
                selectedDateTo &&
                (
                    !date ||
                    date >
                    new Date(
                        selectedDateTo +
                        'T23:59:59'
                    )
                )
            ) {
                return false;
            }


            return true;
        });


    updateStats();

    updateFormatAvailability();

    renderPerformance();
}


// ===========================================
// STATISTICS
// ===========================================

function updateStats() {

    const totalArea =
        filteredFarms.reduce(
            (sum, farm) =>
                sum + farm.area,
            0
        );


    document.getElementById(
        'totalFarms'
    ).textContent =
        allFarms.length;


    document.getElementById(
        'totalArea'
    ).textContent =
        `${allFarms
            .reduce(
                (sum, farm) =>
                    sum + farm.area,
                0
            )
            .toFixed(1)} ha`;


    document.getElementById(
        'validatedCount'
    ).textContent =
        allFarms.filter(
            farm =>
                farm.workflow_state ===
                'validated'
        ).length;


    document.getElementById(
        'pendingCount'
    ).textContent =
        allFarms.filter(
            farm =>
                !FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        ).length;


    document.getElementById(
        'rejectedCount'
    ).textContent =
        allFarms.filter(
            farm =>
                farm.workflow_state ===
                'rejected'
        ).length;


    document.getElementById(
        'exportCount'
    ).textContent =
        filteredFarms.length;


    document.getElementById(
        'exportArea'
    ).textContent =
        `${totalArea.toFixed(2)} ha`;


    document.getElementById(
        'filteredValidated'
    ).textContent =
        filteredFarms.filter(
            farm =>
                farm.workflow_state ===
                'validated'
        ).length;


    document.getElementById(
        'filteredRejected'
    ).textContent =
        filteredFarms.filter(
            farm =>
                farm.workflow_state ===
                'rejected'
        ).length;
}


// ===========================================
// FORMAT AVAILABILITY
// ===========================================

function updateFormatAvailability() {

    const states =
        [
            ...new Set(
                filteredFarms.map(
                    farm =>
                        farm.workflow_state
                )
            )
        ];


    const geoAllowed =
        states.length > 0 &&
        states.every(
            state =>
                FINAL_GEO_STATES.has(state)
        );


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(option => {

            const format =
                option.dataset.format;

            const disabled =
                (
                    format === 'geojson' ||
                    format === 'kmz'
                ) &&
                !geoAllowed;


            option.classList.toggle(
                'disabled',
                disabled
            );


            option.title =
                disabled
                    ? 'GeoJSON/KMZ are available only for Validated or Rejected records.'
                    : '';
        });


    if (
        (
            exportFormat === 'geojson' ||
            exportFormat === 'kmz'
        ) &&
        !geoAllowed
    ) {

        selectFormat('excel');
    }


    document.getElementById(
        'formatHelp'
    ).textContent =
        geoAllowed
            ? 'GeoJSON and KMZ are available because all selected records are final outcomes.'
            : 'Excel is available for all stages. GeoJSON/KMZ require only Validated and/or Rejected records.';
}


// ===========================================
// FORMAT
// ===========================================

function selectFormat(format) {

    const states =
        [
            ...new Set(
                filteredFarms.map(
                    farm =>
                        farm.workflow_state
                )
            )
        ];


    if (
        (
            format === 'geojson' ||
            format === 'kmz'
        ) &&
        !states.every(
            state =>
                FINAL_GEO_STATES.has(
                    state
                )
        )
    ) {

        return;
    }


    exportFormat = format;


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(option => {

            option.classList.toggle(
                'selected',
                option.dataset.format ===
                    format
            );
        });
}


// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {

    [
        'supplierSearch',
        'coopSearch',
        'enumeratorSearch',
        'fieldOfficerSearch'
    ]
        .forEach(id => {

            document
                .getElementById(id)
                ?.addEventListener(
                    'input',
                    () => renderFilters()
                );
        });


    document
        .querySelectorAll(
            '.workflow-checkbox'
        )
        .forEach(checkbox => {

            checkbox.addEventListener(
                'change',
                () => {

                    if (
                        checkbox.checked
                    ) {

                        selectedWorkflowStates
                            .add(
                                checkbox.value
                            );

                    } else {

                        selectedWorkflowStates
                            .delete(
                                checkbox.value
                            );
                    }


                    applyFilters();
                }
            );
        });


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(option => {

            option.addEventListener(
                'click',
                () =>
                    selectFormat(
                        option.dataset.format
                    )
            );
        });


    document
        .getElementById('dateFrom')
        ?.addEventListener(
            'change',
            applyFilters
        );


    document
        .getElementById('dateTo')
        ?.addEventListener(
            'change',
            applyFilters
        );


    document
        .getElementById('clearDates')
        ?.addEventListener(
            'click',
            () => {

                document.getElementById(
                    'dateFrom'
                ).value = '';

                document.getElementById(
                    'dateTo'
                ).value = '';

                applyFilters();
            }
        );


    document
        .getElementById('exportBtn')
        ?.addEventListener(
            'click',
            exportData
        );


    document
        .getElementById('previewBtn')
        ?.addEventListener(
            'click',
            previewData
        );


    document
        .getElementById('resetBtn')
        ?.addEventListener(
            'click',
            resetFilters
        );


    document
        .getElementById('refreshBtn')
        ?.addEventListener(
            'click',
            () =>
                currentProject &&
                loadFarms(
                    currentProject.id
                )
        );


    document
        .querySelectorAll(
            '.performance-tab'
        )
        .forEach(tab => {

            tab.addEventListener(
                'click',
                () => {

                    document
                        .querySelectorAll(
                            '.performance-tab'
                        )
                        .forEach(
                            x =>
                                x.classList
                                    .remove(
                                        'active'
                                    )
                        );


                    tab.classList.add(
                        'active'
                    );


                    document
                        .getElementById(
                            'enumeratorPerformance'
                        )
                        .classList.toggle(
                            'hidden',
                            tab.dataset.tab !==
                                'enumerators'
                        );


                    document
                        .getElementById(
                            'cooperativePerformance'
                        )
                        .classList.toggle(
                            'hidden',
                            tab.dataset.tab !==
                                'cooperatives'
                        );
                }
            );
        });


    document
        .getElementById('logoutBtn')
        ?.addEventListener(
            'click',
            async () => {

                await supabaseClient
                    .auth
                    .signOut();

                location.href =
                    '../login.html';
            }
        );
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


    container.innerHTML =
        `
        <div
            class="dropdown-item"
            data-value="all"
        >
            📊 ALL PROJECTS
        </div>

        ${
            memberships
                .map(
                    membership =>
                        `
                        <div
                            class="dropdown-item"
                            data-value="${membership.projects.id}"
                        >
                            📁 ${escapeHtml(
                                membership.projects.name
                            )}
                        </div>
                        `
                )
                .join('')
        }
        `;


    container
        .querySelectorAll(
            '.dropdown-item'
        )
        .forEach(item => {

            item.addEventListener(
                'click',
                async () => {

                    const value =
                        item.dataset.value;


                    document
                        .getElementById(
                            'dropdownMenu'
                        )
                        .classList
                        .remove(
                            'show'
                        );


                    if (
                        value === 'all'
                    ) {

                        await loadAllProjectsFarms();

                    } else {

                        const membership =
                            allUserProjects.find(
                                x =>
                                    x.projects.id ===
                                    value
                            );


                        if (membership) {

                            currentMembership =
                                membership;

                            currentProject =
                                membership.projects;


                            await loadProjectMembers(
                                value
                            );

                            await loadFarms(
                                value
                            );
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

                    history.pushState(
                        {},
                        '',
                        url
                    );


                    document.getElementById(
                        'projectBadge'
                    ).textContent =
                        value === 'all'
                            ? 'ALL PROJECTS'
                            : currentProject.name;


                    document.getElementById(
                        'selectedProjectName'
                    ).textContent =
                        value === 'all'
                            ? '📊 ALL PROJECTS'
                            : `📁 ${currentProject.name}`;


                    updatePermissionUI();
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


    selected?.addEventListener(
        'click',
        e => {

            e.stopPropagation();

            menu.classList.toggle(
                'show'
            );


            if (
                menu.classList.contains(
                    'show'
                )
            ) {

                search.focus();
            }
        }
    );


    search?.addEventListener(
        'input',
        () =>
            filterDropdown(
                search.value.toLowerCase()
            )
    );


    document.addEventListener(
        'click',
        () =>
            menu?.classList.remove(
                'show'
            )
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
// PERMISSIONS UI
// ===========================================

function updatePermissionUI() {

    const badge =
        document.getElementById(
            'exportPermissionBadge'
        );


    const exportBtn =
        document.getElementById(
            'exportBtn'
        );


    const previewBtn =
        document.getElementById(
            'previewBtn'
        );


    badge.textContent =
        canExportPermission
            ? 'Export access granted'
            : 'Export access not granted';


    badge.classList.toggle(
        'allowed',
        canExportPermission
    );


    badge.classList.toggle(
        'denied',
        !canExportPermission
    );


    if (exportBtn) {

        exportBtn.disabled =
            !canExportPermission;

        exportBtn.title =
            canExportPermission
                ? 'Generate export'
                : 'You do not have export permission';
    }


    if (previewBtn) {

        previewBtn.disabled =
            !canExportPermission;
    }


    document
        .getElementById(
            'permissionManagement'
        )
        .classList.toggle(
            'hidden',
            !canManageExportPermissions
        );


    if (
        canManageExportPermissions
    ) {

        renderPermissionList();
    }
}


// ===========================================
// PERMISSION MANAGEMENT
// ===========================================

function renderPermissionList() {

    const container =
        document.getElementById(
            'permissionList'
        );

    if (!container) {
        return;
    }


    const rows =
        [
            ...memberDirectory.values()
        ]
            .map(member => {

                const profile =
                    member.profile;


                const name =
                    profile
                        ? (
                            [
                                profile.first_name,
                                profile.last_name
                            ]
                                .filter(Boolean)
                                .join(' ') ||

                            profile.email
                        )
                        : member.user_id;


                const role =
                    String(
                        member.role
                    )
                        .replaceAll(
                            '_',
                            ' '
                        );


                const locked =
                    MANAGEMENT_ROLES.includes(
                        String(
                            member.role
                        ).toLowerCase()
                    );


                return `
                    <div class="permission-row">

                        <div>

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <div class="permission-role">
                                ${escapeHtml(
                                    profile?.email ||
                                    member.user_id
                                )}
                            </div>

                        </div>


                        <div class="permission-role">
                            ${escapeHtml(role)}
                        </div>


                        <div>
                            ${
                                locked
                                    ? 'Automatic'
                                    : 'Project permission'
                            }
                        </div>


                        <div class="permission-toggle">

                            <input
                                type="checkbox"
                                data-user-id="${member.user_id}"
                                ${
                                    locked ||
                                    member.can_export
                                        ? 'checked'
                                        : ''
                                }
                                ${
                                    locked
                                        ? 'disabled'
                                        : ''
                                }
                            >

                        </div>

                    </div>
                `;
            })
            .join('');


    container.innerHTML =
        rows ||
        '<div class="panel-subtitle">No active project members found.</div>';


    container
        .querySelectorAll(
            'input[data-user-id]'
        )
        .forEach(input => {

            input.addEventListener(
                'change',
                async () => {

                    await setExportPermission(
                        input.dataset.userId,
                        input.checked
                    );
                }
            );
        });
}


// ===========================================
// SET EXPORT PERMISSION
// ===========================================

async function setExportPermission(
    userId,
    enabled
) {

    const {
        error
    } = await supabaseClient.rpc(
        'set_project_member_export_permission',
        {
            p_project_id:
                currentProject.id,

            p_user_id:
                userId,

            p_can_export:
                enabled
        }
    );


    if (error) {

        showNotification(
            error.message,
            'error'
        );

        await loadProjectMembers(
            currentProject.id
        );

        updatePermissionUI();

        return;
    }


    await loadProjectMembers(
        currentProject.id
    );

    updatePermissionUI();


    showNotification(
        enabled
            ? 'Export permission granted.'
            : 'Export permission revoked.',
        'success'
    );
}


// ===========================================
// PREVIEW
// ===========================================

function previewData() {

    if (!canExportPermission) {

        showNotification(
            'Export permission denied.',
            'error'
        );

        return;
    }


    if (!filteredFarms.length) {

        showNotification(
            'No farms match the selected filters.',
            'warning'
        );

        return;
    }


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


    header.innerHTML =
        `
        <tr>
            <th>Farm ID</th>
            <th>Farmer</th>
            <th>Cooperative</th>
            <th>Enumerator</th>
            <th>Area</th>
            <th>Workflow</th>
        </tr>
        `;


    body.innerHTML =
        filteredFarms
            .slice(0, 10)
            .map(farm => {

                return `
                    <tr>

                        <td>
                            ${escapeHtml(
                                farm.farm_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                farm.farmer_name || ''
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                farm.cooperative
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                personName(
                                    farm.enumerator_id
                                )
                            )}
                        </td>

                        <td>
                            ${farm.area.toFixed(2)}
                        </td>

                        <td>
                            ${escapeHtml(
                                workflowLabel[
                                    farm.workflow_state
                                ] ||
                                farm.workflow_state
                            )}
                        </td>

                    </tr>
                `;
            })
            .join('');


    document.getElementById(
        'previewTotal'
    ).textContent =
        filteredFarms.length;


    section.style.display =
        'block';


    section.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}


window.hidePreview = () => {

    document.getElementById(
        'previewSection'
    ).style.display =
        'none';
};


// ===========================================
// EXPORT MAIN
// ===========================================

async function exportData() {

    if (!canExportPermission) {

        showNotification(
            'Export permission denied.',
            'error'
        );

        return;
    }


    if (!filteredFarms.length) {

        showNotification(
            'No farms match the selected filters.',
            'warning'
        );

        return;
    }


    if (
        (
            exportFormat === 'geojson' ||
            exportFormat === 'kmz'
        ) &&
        !filteredFarms.every(
            farm =>
                FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        )
    ) {

        showNotification(
            'GeoJSON/KMZ require only Validated or Rejected records.',
            'warning'
        );

        return;
    }


    showLoading(true);


    try {

        if (
            exportFormat ===
            'excel'
        ) {

            exportExcel();

        } else if (
            exportFormat ===
            'geojson'
        ) {

            exportGeoJSON();

        } else if (
            exportFormat ===
            'kmz'
        ) {

            await exportKMZ();

        } else if (
            exportFormat ===
            'report'
        ) {

            exportProgressReport();
        }


        await recordExport(
            exportFormat,
            filteredFarms.length
        );


    } catch (error) {

        console.error(error);

        showNotification(
            error.message ||
            'Export failed',
            'error'
        );


    } finally {

        showLoading(false);
    }
}


// ===========================================
// EXCEL
// ===========================================

function exportExcel() {

    const rows =
        filteredFarms.map(
            exportRow
        );


    const worksheet =
        XLSX.utils.json_to_sheet(
            rows
        );


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Farms'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            buildEnumeratorStats()
        ),
        'Enumerator Performance'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            buildCooperativeStats()
        ),
        'Cooperative Performance'
    );


    const filename =
        `MappingTrace_${safeName(
            currentProject?.name ||
            'AllProjects'
        )}_farms_${dateStamp()}.xlsx`;


    XLSX.writeFile(
        workbook,
        filename
    );


    showNotification(
        `Excel exported: ${filteredFarms.length} farms`,
        'success'
    );
}


// ===========================================
// EXPORT ROW
// ===========================================

function exportRow(farm) {

    return {

        'Farm ID':
            farm.farm_id,

        'Farmer ID':
            farm.farmer_id || '',

        'Farmer Name':
            farm.farmer_name || '',

        'Supplier':
            farm.supplier,

        'Cooperative':
            farm.cooperative,

        'Area (ha)':
            farm.area,

        'Workflow State':
            workflowLabel[
                farm.workflow_state
            ] ||
            farm.workflow_state,

        'Status':
            farm.status || '',

        'Enumerator':
            personName(
                farm.enumerator_id
            ),

        'Field Officer':
            personName(
                farm.field_officer_id
            ),

        'Created At':
            farm.created_at || ''
    };
}


// ===========================================
// GEOJSON
// ===========================================

function exportGeoJSON() {

    const features =
        filteredFarms

            .filter(
                farm =>
                    farm.geometry
            )

            .map(farm => {

                const geometry =
                    typeof farm.geometry ===
                    'string'

                        ? JSON.parse(
                            farm.geometry
                        )

                        : farm.geometry;


                return {

                    type:
                        'Feature',

                    properties:
                        exportRow(
                            farm
                        ),

                    geometry
                };
            });


    if (!features.length) {

        throw new Error(
            'No valid geometries found in the selected records.'
        );
    }


    const geojson = {

        type:
            'FeatureCollection',

        features
    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    geojson,
                    null,
                    2
                )
            ],
            {
                type:
                    'application/geo+json'
            }
        );


    const filename =
        `MappingTrace_${safeName(
            currentProject?.name ||
            'AllProjects'
        )}_${dateStamp()}.geojson`;


    saveAs(
        blob,
        filename
    );


    showNotification(
        `GeoJSON exported: ${features.length} geometries`,
        'success'
    );
}


// ===========================================
// KMZ
// ===========================================

async function exportKMZ() {

    const farms =
        filteredFarms.filter(
            farm =>
                farm.geometry
        );


    if (!farms.length) {

        throw new Error(
            'No valid geometries found in the selected records.'
        );
    }


    const kml = [

        '<?xml version="1.0" encoding="UTF-8"?>',

        '<kml xmlns="http://www.opengis.net/kml/2.2">',

        '<Document>',

        '<name>MappingTrace Farms</name>'
    ];


    for (const farm of farms) {

        const geometry =
            typeof farm.geometry ===
            'string'

                ? JSON.parse(
                    farm.geometry
                )

                : farm.geometry;


        kml.push(
            featureToKML(
                farm,
                geometry
            )
        );
    }


    kml.push(
        '</Document></kml>'
    );


    const zip =
        new JSZip();


    zip.file(
        'doc.kml',
        kml.join('')
    );


    const blob =
        await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE'
        });


    saveAs(
        blob,
        `MappingTrace_${safeName(
            currentProject?.name ||
            'AllProjects'
        )}_${dateStamp()}.kmz`
    );


    showNotification(
        `KMZ exported: ${farms.length} geometries`,
        'success'
    );
}


// ===========================================
// KML FEATURE
// ===========================================

function featureToKML(
    farm,
    geometry
) {

    const name =
        escapeXml(
            farm.farmer_name ||
            farm.farm_id ||
            'Farm'
        );


    const description =
        escapeXml(
            `Farm ID: ${farm.farm_id}; ` +
            `Cooperative: ${farm.cooperative}; ` +
            `Area: ${farm.area.toFixed(2)} ha; ` +
            `Workflow: ${
                workflowLabel[
                    farm.workflow_state
                ] ||
                farm.workflow_state
            }`
        );


    return `
        <Placemark>

            <name>
                ${name}
            </name>

            <description>
                ${description}
            </description>

            ${geometryToKML(
                geometry
            )}

        </Placemark>
    `;
}


// ===========================================
// GEOMETRY → KML
// ===========================================

function geometryToKML(
    geometry
) {

    if (!geometry) {
        return '';
    }


    const type =
        geometry.type;

    const coordinates =
        geometry.coordinates;


    const ring =
        coords =>
            coords
                .map(
                    point =>
                        `${point[0]},${point[1]},0`
                )
                .join(' ');


    if (
        type ===
        'Polygon'
    ) {

        return `
            <Polygon>

                <outerBoundaryIs>

                    <LinearRing>

                        <coordinates>
                            ${ring(
                                coordinates[0]
                            )}
                        </coordinates>

                    </LinearRing>

                </outerBoundaryIs>

            </Polygon>
        `;
    }


    if (
        type ===
        'MultiPolygon'
    ) {

        return `
            <MultiGeometry>

                ${
                    coordinates
                        .map(
                            polygon =>
                                `
                                <Polygon>

                                    <outerBoundaryIs>

                                        <LinearRing>

                                            <coordinates>
                                                ${ring(
                                                    polygon[0]
                                                )}
                                            </coordinates>

                                        </LinearRing>

                                    </outerBoundaryIs>

                                </Polygon>
                                `
                        )
                        .join('')
                }

            </MultiGeometry>
        `;
    }


    if (
        type ===
        'Point'
    ) {

        return `
            <Point>

                <coordinates>
                    ${coordinates[0]},
                    ${coordinates[1]},
                    0
                </coordinates>

            </Point>
        `;
    }


    return '';
}


// ===========================================
// PROGRESS REPORT
// ===========================================

function exportProgressReport() {

    const summary = [

        [
            'MappingTrace Progress Report',
            ''
        ],

        [
            'Project',
            currentProject?.name ||
            'All Projects'
        ],

        [
            'Generated',
            new Date().toLocaleString()
        ],

        [
            'Filtered Farms',
            filteredFarms.length
        ],

        [
            'Filtered Area (ha)',
            filteredFarms.reduce(
                (sum, farm) =>
                    sum + farm.area,
                0
            )
        ],

        [
            'Validated',
            filteredFarms.filter(
                farm =>
                    farm.workflow_state ===
                    'validated'
            ).length
        ],

        [
            'Rejected',
            filteredFarms.filter(
                farm =>
                    farm.workflow_state ===
                    'rejected'
            ).length
        ],

        [
            'Correction Required',
            filteredFarms.filter(
                farm =>
                    farm.workflow_state ===
                    'correction_required'
            ).length
        ],

        [
            'Pending / In Workflow',
            filteredFarms.filter(
                farm =>
                    !FINAL_GEO_STATES.has(
                        farm.workflow_state
                    )
            ).length
        ]
    ];


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(
            summary
        ),
        'Summary'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            buildEnumeratorStats()
        ),
        'Enumerators'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            buildCooperativeStats()
        ),
        'Cooperatives'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            buildWorkflowStats()
        ),
        'Workflow'
    );


    const filename =
        `MappingTrace_Progress_Report_${safeName(
            currentProject?.name ||
            'AllProjects'
        )}_${dateStamp()}.xlsx`;


    XLSX.writeFile(
        workbook,
        filename
    );


    showNotification(
        'Progress report exported.',
        'success'
    );
}


// ===========================================
// ENUMERATOR PERFORMANCE
// ===========================================

function buildEnumeratorStats() {

    const map =
        new Map();


    for (
        const farm of filteredFarms
    ) {

        const key =
            farm.enumerator_id ||
            'unassigned';


        const name =
            personName(
                farm.enumerator_id
            );


        if (!map.has(key)) {

            map.set(
                key,
                {

                    Enumerator:
                        name,

                    'Farms Mapped':
                        0,

                    Submitted:
                        0,

                    Validated:
                        0,

                    Rejected:
                        0,

                    'Correction Required':
                        0,

                    Pending:
                        0,

                    'Validation Rate %':
                        0
                }
            );
        }


        const row =
            map.get(key);


        row['Farms Mapped']++;


        if (
            farm.workflow_state ===
            'submitted'
        ) {

            row.Submitted++;
        }


        if (
            farm.workflow_state ===
            'validated'
        ) {

            row.Validated++;
        }


        if (
            farm.workflow_state ===
            'rejected'
        ) {

            row.Rejected++;
        }


        if (
            farm.workflow_state ===
            'correction_required'
        ) {

            row[
                'Correction Required'
            ]++;
        }


        if (
            !FINAL_GEO_STATES.has(
                farm.workflow_state
            )
        ) {

            row.Pending++;
        }
    }


    return [
        ...map.values()
    ].map(row => ({

        ...row,

        'Validation Rate %':
            row['Farms Mapped']
                ? Number(
                    (
                        row.Validated /
                        row['Farms Mapped'] *
                        100
                    ).toFixed(1)
                )
                : 0
    }));
}


// ===========================================
// COOPERATIVE PERFORMANCE
// ===========================================

function buildCooperativeStats() {

    const map =
        new Map();


    for (
        const farm of filteredFarms
    ) {

        const key =
            farm.cooperative ||
            'Unassigned';


        if (!map.has(key)) {

            map.set(
                key,
                {

                    Cooperative:
                        key,

                    Farms:
                        0,

                    'Area (ha)':
                        0,

                    Validated:
                        0,

                    Rejected:
                        0,

                    'Correction Required':
                        0,

                    Pending:
                        0,

                    'Validation Rate %':
                        0
                }
            );
        }


        const row =
            map.get(key);


        row.Farms++;

        row['Area (ha)'] +=
            farm.area;


        if (
            farm.workflow_state ===
            'validated'
        ) {

            row.Validated++;
        }


        if (
            farm.workflow_state ===
            'rejected'
        ) {

            row.Rejected++;
        }


        if (
            farm.workflow_state ===
            'correction_required'
        ) {

            row[
                'Correction Required'
            ]++;
        }


        if (
            !FINAL_GEO_STATES.has(
                farm.workflow_state
            )
        ) {

            row.Pending++;
        }
    }


    return [
        ...map.values()
    ].map(row => ({

        ...row,

        'Area (ha)':
            Number(
                row['Area (ha)']
                    .toFixed(2)
            ),

        'Validation Rate %':
            row.Farms
                ? Number(
                    (
                        row.Validated /
                        row.Farms *
                        100
                    ).toFixed(1)
                )
                : 0
    }));
}


// ===========================================
// WORKFLOW PERFORMANCE
// ===========================================

function buildWorkflowStats() {

    return Object.keys(
        workflowLabel
    ).map(state => ({

        Stage:
            workflowLabel[state],

        Farms:
            filteredFarms.filter(
                farm =>
                    farm.workflow_state ===
                    state
            ).length,

        'Area (ha)':
            Number(
                filteredFarms
                    .filter(
                        farm =>
                            farm.workflow_state ===
                            state
                    )
                    .reduce(
                        (sum, farm) =>
                            sum + farm.area,
                        0
                    )
                    .toFixed(2)
            )
    }));
}


// ===========================================
// EXPORT HISTORY
// ===========================================

async function recordExport(
    format,
    count
) {

    try {

        await supabaseClient
            .from('export_history')
            .insert({

                project_id:
                    currentProject?.id ||
                    null,

                user_id:
                    currentUser.id,

                format,

                record_count:
                    count,

                created_at:
                    new Date()
                        .toISOString()
            });

    } catch (error) {

        console.warn(
            'Export history not recorded:',
            error
        );
    }
}


// ===========================================
// RESET FILTERS
// ===========================================

function resetFilters() {

    selectedSuppliers =
        new Set(
            allSuppliers
        );


    selectedCooperatives =
        new Set(
            allCooperatives
        );


    selectedEnumerators =
        new Set(
            allEnumerators.map(
                x => x.id
            )
        );


    selectedFieldOfficers =
        new Set(
            allFieldOfficers.map(
                x => x.id
            )
        );


    selectedWorkflowStates =
        new Set(
            Object.keys(
                workflowLabel
            )
        );


    document
        .querySelectorAll(
            '.workflow-checkbox'
        )
        .forEach(
            checkbox =>
                checkbox.checked = true
        );


    [
        'supplierSearch',
        'coopSearch',
        'enumeratorSearch',
        'fieldOfficerSearch',
        'dateFrom',
        'dateTo'
    ]
        .forEach(id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.value = '';
            }
        });


    renderFilters();

    applyFilters();

    selectFormat(
        'excel'
    );
}


// ===========================================
// UTILITIES
// ===========================================

function escapeHtml(value) {

    return String(
        value ?? ''
    ).replace(
        /[&<>"']/g,
        character => ({

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

        }[character])
    );
}


function escapeXml(value) {

    return String(
        value ?? ''
    ).replace(
        /[<>&'"]/g,
        character => ({

            '<':
                '&lt;',

            '>':
                '&gt;',

            '&':
                '&amp;',

            "'":
                '&apos;',

            '"':
                '&quot;'

        }[character])
    );
}


function safeName(value) {

    return String(value)
        .replace(
            /[^a-z0-9_-]+/gi,
            '_'
        )
        .replace(
            /^_+|_+$/g,
            ''
        )
        .slice(
            0,
            70
        ) ||
        'Project';
}


function dateStamp() {

    return new Date()
        .toISOString()
        .slice(
            0,
            10
        );
}


function showLoading(
    show
) {

    const element =
        document.getElementById(
            'loadingOverlay'
        );


    if (element) {

        element.style.display =
            show
                ? 'flex'
                : 'none';
    }
}


function showNotification(
    message,
    type = 'info'
) {

    const old =
        document.querySelector(
            '.mt-notification'
        );


    if (old) {
        old.remove();
    }


    const element =
        document.createElement(
            'div'
        );


    element.className =
        `mt-notification ${type}`;


    element.textContent =
        message;


    Object.assign(
        element.style,
        {

            position:
                'fixed',

            right:
                '22px',

            bottom:
                '22px',

            zIndex:
                20000,

            padding:
                '12px 16px',

            borderRadius:
                '9px',

            background:
                type === 'error'
                    ? '#fee2e2'
                    : type === 'success'
                        ? '#dcfce7'
                        : '#e0f2fe',

            color:
                type === 'error'
                    ? '#991b1b'
                    : type === 'success'
                        ? '#166534'
                        : '#075985',

            boxShadow:
                '0 4px 14px rgba(0,0,0,.12)',

            fontSize:
                '13px'
        }
    );


    document.body.appendChild(
        element
    );


    setTimeout(
        () =>
            element.remove(),
        3500
    );
}
