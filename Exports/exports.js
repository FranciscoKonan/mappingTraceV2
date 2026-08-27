```javascript
// ===========================================
// MappingTrace — Export Center V3
// ===========================================

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';

let supabaseClient;
let currentUser = null;
let currentProject = null;
let currentMembership = null;

let allUserProjects = [];
let allFarms = [];
let filteredFarms = [];

let allSuppliers = [];
let allCooperatives = [];
let allEnumerators = [];
let allFieldOfficers = [];

let memberDirectory = new Map();

let canExportPermission = false;
let canManageExportPermissions = false;

let exportFormat = 'excel';

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

    try {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

        setupNavigation();

        setupEventListeners();

        await initializeExportCenter();

    } catch (error) {

        console.error(
            'Export Center initialization error:',
            error
        );

        showNotification(
            error.message ||
            'Unable to initialize Export Center.',
            'error'
        );
    }
});


// ===========================================
// INITIALIZE
// ===========================================

async function initializeExportCenter() {

    showLoading(true);

    try {

        const {
            data: {
                session
            },
            error
        } =
            await supabaseClient
                .auth
                .getSession();

        if (error) {
            throw error;
        }

        if (!session) {

            window.location.href =
                '../login.html';

            return;
        }

        currentUser =
            session.user;


        await loadUserProfile();

        await loadProjects();

        await loadCurrentProject();

        if (!currentProject) {

            throw new Error(
                'No project selected.'
            );
        }

        await loadProjectMembers(
            currentProject.id
        );

        await loadFarms(
            currentProject.id
        );

        updatePermissionUI();

        await loadExportHistory();

    } finally {

        showLoading(false);
    }
}


// ===========================================
// USER PROFILE
// ===========================================

async function loadUserProfile() {

    const {
        data
    } =
        await supabaseClient
            .from('user_profiles')
            .select(
                'id,first_name,last_name,email'
            )
            .eq(
                'id',
                currentUser.id
            )
            .maybeSingle();


    const firstName =
        data?.first_name || '';

    const lastName =
        data?.last_name || '';

    const fullName =
        `${firstName} ${lastName}`
            .trim();


    const displayName =
        fullName ||
        currentUser.email
            .split('@')[0];


    const nameElement =
        document.getElementById(
            'userName'
        );

    if (nameElement) {

        nameElement.textContent =
            displayName;
    }


    const avatar =
        document.getElementById(
            'userAvatar'
        );

    if (avatar) {

        avatar.textContent =
            (
                firstName ||
                currentUser.email
            )
                .charAt(0)
                .toUpperCase();
    }
}


// ===========================================
// PROJECTS
// ===========================================

async function loadProjects() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from('project_members')
            .select(
                `
                project_id,
                role,
                status,
                can_export,
                projects (*)
                `
            )
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


    if (!data?.length) {

        throw new Error(
            'You are not an active member of any project.'
        );
    }


    allUserProjects =
        data;


    populateProjectSelector();
}


// ===========================================
// CURRENT PROJECT
// ===========================================

async function loadCurrentProject() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const requestedId =
        params.get(
            'project'
        );


    let membership =
        allUserProjects.find(
            item =>
                item.project_id ===
                requestedId
        );


    if (!membership) {

        const saved =
            localStorage.getItem(
                `lastProject_${currentUser.id}`
            );


        membership =
            allUserProjects.find(
                item =>
                    item.project_id ===
                    saved
            );
    }


    if (!membership) {

        membership =
            allUserProjects[0];
    }


    if (!membership) {
        return;
    }


    currentMembership =
        membership;


    currentProject =
        membership.projects;


    localStorage.setItem(
        `lastProject_${currentUser.id}`,
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


    updateProjectUI();
}


// ===========================================
// PROJECT SELECTOR
// ===========================================

function populateProjectSelector() {

    const selector =
        document.getElementById(
            'projectSelector'
        );


    if (!selector) {
        return;
    }


    selector.innerHTML =
        allUserProjects
            .map(
                membership =>
                    `
                    <option value="${escapeHtml(
                        membership.project_id
                    )}">
                        ${escapeHtml(
                            membership.projects?.name ||
                            membership.project_id
                        )}
                    </option>
                    `
            )
            .join('');
}


function updateProjectUI() {

    const selector =
        document.getElementById(
            'projectSelector'
        );


    if (selector) {

        selector.value =
            currentProject.id;
    }


    const badge =
        document.getElementById(
            'projectBadge'
        );


    if (badge) {

        badge.textContent =
            currentProject.name ||
            'PROJECT';
    }


    const projectName =
        document.getElementById(
            'selectedProjectName'
        );


    if (projectName) {

        projectName.textContent =
            currentProject.name ||
            'Selected Project';
    }
}


// ===========================================
// PROJECT CHANGE
// ===========================================

async function changeProject(
    projectId
) {

    const membership =
        allUserProjects.find(
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
        `lastProject_${currentUser.id}`,
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


    updateProjectUI();

    await loadProjectMembers(
        projectId
    );

    await loadFarms(
        projectId
    );

    await loadExportHistory();

    updatePermissionUI();
}


// ===========================================
// PROJECT MEMBERS
// ===========================================

async function loadProjectMembers(
    projectId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from('project_members')
            .select(
                `
                user_id,
                project_id,
                role,
                status,
                can_export
                `
            )
            .eq(
                'project_id',
                projectId
            )
            .eq(
                'status',
                'active'
            );


    if (error) {
        throw error;
    }


    memberDirectory =
        new Map();


    for (
        const member of data || []
    ) {

        memberDirectory.set(
            member.user_id,
            member
        );
    }


    const userIds =
        [...memberDirectory.keys()];


    if (userIds.length) {

        const {
            data: profiles
        } =
            await supabaseClient
                .from('user_profiles')
                .select(
                    'id,first_name,last_name,email'
                )
                .in(
                    'id',
                    userIds
                );


        for (
            const profile of
            profiles || []
        ) {

            const member =
                memberDirectory.get(
                    profile.id
                );


            if (member) {

                member.profile =
                    profile;
            }
        }
    }


    const ownMember =
        memberDirectory.get(
            currentUser.id
        );


    const role =
        String(
            ownMember?.role ||
            currentMembership?.role ||
            ''
        ).toLowerCase();


    canManageExportPermissions =
        MANAGEMENT_ROLES.includes(
            role
        );


    canExportPermission =
        canManageExportPermissions ||
        ownMember?.can_export === true;
}


// ===========================================
// LOAD FARMS
// ===========================================

async function loadFarms(
    projectId
) {

    showLoading(true);


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from('farms')
                .select('*')
                .eq(
                    'project_id',
                    projectId
                );


        if (error) {
            throw error;
        }


        processFarmsData(
            data || []
        );

    } finally {

        showLoading(false);
    }
}


// ===========================================
// PROCESS FARMS
// ===========================================

function processFarmsData(
    farms
) {

    allFarms =
        farms.map(
            farm => ({

                ...farm,

                farm_id:
                    farm.farm_code ||
                    farm.farmer_id ||
                    farm.id,

                supplier:
                    farm.supplier ||
                    'Unassigned',

                cooperative:
                    farm.cooperative ||
                    'Unassigned',

                area:
                    Number(
                        farm.area
                    ) || 0,

                workflow_state:
                    normalizeWorkflow(
                        farm
                    ),

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
                    farm.created_at ||
                    null,

                updated_at:
                    farm.updated_at ||
                    null,

                validated_at:
                    farm.final_validated_at ||
                    farm.validated_at ||
                    null,

                rejected_at:
                    farm.rejected_at ||
                    null
            })
        );


    buildFilterLists();


    filteredFarms =
        [...allFarms];


    populateAdvancedFilters();

    updateStats();

    updateActiveFilterChips();

    renderPerformance();

    updateFormatAvailability();
}


// ===========================================
// FILTER LISTS
// ===========================================

function buildFilterLists() {

    allSuppliers =
        unique(
            allFarms.map(
                farm =>
                    farm.supplier
            )
        );


    allCooperatives =
        unique(
            allFarms.map(
                farm =>
                    farm.cooperative
            )
        );


    const enumeratorIds =
        unique(
            allFarms
                .map(
                    farm =>
                        farm.enumerator_id
                )
                .filter(Boolean)
        );


    const fieldOfficerIds =
        unique(
            allFarms
                .map(
                    farm =>
                        farm.field_officer_id
                )
                .filter(Boolean)
        );


    allEnumerators =
        enumeratorIds
            .map(
                id => ({
                    id,
                    name:
                        personName(id)
                })
            )
            .sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );


    allFieldOfficers =
        fieldOfficerIds
            .map(
                id => ({
                    id,
                    name:
                        personName(id)
                })
            )
            .sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );
}


// ===========================================
// FILTER UI
// ===========================================

function populateAdvancedFilters() {

    populateSelect(
        'coopQuickFilter',
        allCooperatives,
        'All cooperatives'
    );


    populateSelect(
        'enumeratorQuickFilter',
        allEnumerators.map(
            x => ({
                value: x.id,
                label: x.name
            })
        ),
        'All enumerators'
    );


    populateSelect(
        'workflowQuickFilter',
        Object.keys(
            workflowLabel
        ).map(
            key => ({
                value: key,
                label:
                    workflowLabel[key]
            })
        ),
        'All stages'
    );


    populateSelect(
        'supplierAdvanced',
        allSuppliers,
        'All suppliers'
    );


    populateSelect(
        'fieldOfficerAdvanced',
        allFieldOfficers.map(
            x => ({
                value: x.id,
                label: x.name
            })
        ),
        'All field officers'
    );
}


function populateSelect(
    id,
    values,
    allLabel
) {

    const select =
        document.getElementById(
            id
        );


    if (!select) {
        return;
    }


    const oldValue =
        select.value ||
        'all';


    select.innerHTML =
        `<option value="all">${escapeHtml(
            allLabel
        )}</option>`;


    values.forEach(
        item => {

            const value =
                typeof item ===
                'object'
                    ? item.value
                    : item;


            const label =
                typeof item ===
                'object'
                    ? item.label
                    : item;


            select.insertAdjacentHTML(
                'beforeend',
                `
                <option value="${escapeHtml(
                    value
                )}">
                    ${escapeHtml(
                        label
                    )}
                </option>
                `
            );
        }
    );


    if (
        [...select.options]
            .some(
                option =>
                    option.value ===
                    oldValue
            )
    ) {

        select.value =
            oldValue;
    }
}


// ===========================================
// APPLY FILTERS
// ===========================================

function applyFilters() {

    const cooperative =
        getValue(
            'coopQuickFilter'
        );


    const enumerator =
        getValue(
            'enumeratorQuickFilter'
        );


    const workflow =
        getValue(
            'workflowQuickFilter'
        );


    const supplier =
        getValue(
            'supplierAdvanced'
        );


    const fieldOfficer =
        getValue(
            'fieldOfficerAdvanced'
        );


    const areaMin =
        parseFloat(
            getValue(
                'areaMin'
            )
        );


    const areaMax =
        parseFloat(
            getValue(
                'areaMax'
            )
        );


    const dateFrom =
        getValue(
            'dateFrom'
        );


    const dateTo =
        getValue(
            'dateTo'
        );


    const dateBasis =
        getValue(
            'dateBasis'
        ) ||
        'created_at';


    const duplicate =
        checked(
            'qualityDuplicate'
        );


    const correction =
        checked(
            'qualityCorrection'
        );


    const missingGeometry =
        checked(
            'qualityMissingGeometry'
        );


    const rejectionReason =
        checked(
            'qualityRejectedReason'
        );


    filteredFarms =
        allFarms.filter(
            farm => {

                if (
                    cooperative !==
                    'all' &&
                    farm.cooperative !==
                    cooperative
                ) {
                    return false;
                }


                if (
                    enumerator !==
                    'all' &&
                    farm.enumerator_id !==
                    enumerator
                ) {
                    return false;
                }


                if (
                    workflow !==
                    'all' &&
                    farm.workflow_state !==
                    workflow
                ) {
                    return false;
                }


                if (
                    supplier !==
                    'all' &&
                    farm.supplier !==
                    supplier
                ) {
                    return false;
                }


                if (
                    fieldOfficer !==
                    'all' &&
                    farm.field_officer_id !==
                    fieldOfficer
                ) {
                    return false;
                }


                if (
                    !Number.isNaN(
                        areaMin
                    ) &&
                    farm.area <
                    areaMin
                ) {
                    return false;
                }


                if (
                    !Number.isNaN(
                        areaMax
                    ) &&
                    farm.area >
                    areaMax
                ) {
                    return false;
                }


                if (
                    duplicate &&
                    !(
                        farm.duplicate_alert ||
                        farm.has_duplicate ||
                        Number(
                            farm.duplicate_count
                        ) > 1
                    )
                ) {
                    return false;
                }


                if (
                    correction &&
                    farm.workflow_state !==
                    'correction_required'
                ) {
                    return false;
                }


                if (
                    missingGeometry &&
                    farm.geometry
                ) {
                    return false;
                }


                if (
                    rejectionReason &&
                    !(
                        farm.rejection_reason ||
                        farm.rejected_by
                    )
                ) {
                    return false;
                }


                const dateValue =
                    farm[dateBasis] ||
                    farm.created_at;


                if (
                    dateFrom &&
                    (
                        !dateValue ||
                        new Date(
                            dateValue
                        ) <
                        new Date(
                            `${dateFrom}T00:00:00`
                        )
                    )
                ) {
                    return false;
                }


                if (
                    dateTo &&
                    (
                        !dateValue ||
                        new Date(
                            dateValue
                        ) >
                        new Date(
                            `${dateTo}T23:59:59`
                        )
                    )
                ) {
                    return false;
                }


                return true;
            }
        );


    updateStats();

    updateActiveFilterChips();

    renderPerformance();

    updateFormatAvailability();
}


// ===========================================
// RESET
// ===========================================

function resetFilters() {

    [
        'coopQuickFilter',
        'enumeratorQuickFilter',
        'workflowQuickFilter',
        'supplierAdvanced',
        'fieldOfficerAdvanced'
    ]
        .forEach(
            id => {

                const el =
                    document.getElementById(
                        id
                    );

                if (el) {
                    el.value =
                        'all';
                }
            }
        );


    [
        'dateFrom',
        'dateTo',
        'areaMin',
        'areaMax'
    ]
        .forEach(
            id => {

                const el =
                    document.getElementById(
                        id
                    );

                if (el) {
                    el.value =
                        '';
                }
            }
        );


    [
        'qualityDuplicate',
        'qualityCorrection',
        'qualityMissingGeometry',
        'qualityRejectedReason'
    ]
        .forEach(
            id => {

                const el =
                    document.getElementById(
                        id
                    );

                if (el) {
                    el.checked =
                        false;
                }
            }
        );


    filteredFarms =
        [...allFarms];


    updateStats();

    updateActiveFilterChips();

    renderPerformance();

    selectFormat(
        'excel'
    );

    updateFormatAvailability();
}


// ===========================================
// ACTIVE FILTER CHIPS
// ===========================================

function updateActiveFilterChips() {

    const container =
        document.getElementById(
            'activeFilterChips'
        );


    if (!container) {
        return;
    }


    const chips = [];


    addSelectChip(
        chips,
        'Cooperative',
        'coopQuickFilter'
    );


    addSelectChip(
        chips,
        'Enumerator',
        'enumeratorQuickFilter'
    );


    addSelectChip(
        chips,
        'Workflow',
        'workflowQuickFilter'
    );


    addSelectChip(
        chips,
        'Supplier',
        'supplierAdvanced'
    );


    addSelectChip(
        chips,
        'Field Officer',
        'fieldOfficerAdvanced'
    );


    const from =
        getValue(
            'dateFrom'
        );


    const to =
        getValue(
            'dateTo'
        );


    if (from || to) {

        chips.push(
            `<span class="filter-chip">
                Date:
                ${escapeHtml(
                    from || '...'
                )}
                →
                ${escapeHtml(
                    to || '...'
                )}
            </span>`
        );
    }


    const qualityLabels = [

        [
            'qualityDuplicate',
            'Duplicate alert'
        ],

        [
            'qualityCorrection',
            'Correction required'
        ],

        [
            'qualityMissingGeometry',
            'Missing geometry'
        ],

        [
            'qualityRejectedReason',
            'Has rejection reason'
        ]
    ];


    qualityLabels.forEach(
        ([id, label]) => {

            if (
                checked(id)
            ) {

                chips.push(
                    `<span class="filter-chip">
                        ${escapeHtml(label)}
                    </span>`
                );
            }
        }
    );


    container.innerHTML =
        chips.length
            ? chips.join('')
            : '<span class="empty-filter">All project data</span>';
}


function addSelectChip(
    chips,
    label,
    id
) {

    const select =
        document.getElementById(
            id
        );


    if (
        select &&
        select.value !==
        'all'
    ) {

        const selected =
            select.selectedOptions[0];


        chips.push(
            `<span class="filter-chip">
                ${escapeHtml(label)}:
                ${escapeHtml(
                    selected?.textContent.trim() ||
                    select.value
                )}
            </span>`
        );
    }
}


// ===========================================
// KPI
// ===========================================

function updateStats() {

    const total =
        filteredFarms.length;


    const area =
        filteredFarms.reduce(
            (sum, farm) =>
                sum + farm.area,
            0
        );


    const validated =
        filteredFarms.filter(
            farm =>
                farm.workflow_state ===
                'validated'
        ).length;


    const rejected =
        filteredFarms.filter(
            farm =>
                farm.workflow_state ===
                'rejected'
        ).length;


    const inProgress =
        filteredFarms.filter(
            farm =>
                !FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        ).length;


    const validationRate =
        total
            ? (
                validated /
                total *
                100
            ).toFixed(1)
            : '0.0';


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
        validated.toLocaleString()
    );


    setText(
        'filteredRejected',
        rejected.toLocaleString()
    );


    setText(
        'filteredInProgress',
        inProgress.toLocaleString()
    );


    setText(
        'filteredValidationRate',
        `${validationRate}%`
    );


    setText(
        'selectionNote',
        `${total.toLocaleString()} record${
            total === 1 ? '' : 's'
        } selected`
    );
}


// ===========================================
// PERFORMANCE
// ===========================================

function renderPerformance() {

    const enumerators =
        buildEnumeratorStats();


    const cooperatives =
        buildCooperativeStats();


    const workflow =
        buildWorkflowStats();


    setHTML(
        'enumeratorPerformance',
        performanceTable(
            [
                'Enumerator',
                'Farms',
                'Validated',
                'Rejected',
                'Correction',
                'Pending',
                'Validation rate'
            ],
            enumerators.map(
                row => [

                    row.Enumerator,

                    row['Farms Mapped'],

                    row.Validated,

                    row.Rejected,

                    row[
                        'Correction Required'
                    ],

                    row.Pending,

                    `${row[
                        'Validation Rate %'
                    ]}%`
                ]
            )
        )
    );


    setHTML(
        'cooperativePerformance',
        performanceTable(
            [
                'Cooperative',
                'Farms',
                'Area (ha)',
                'Validated',
                'Rejected',
                'Correction',
                'Pending',
                'Validation rate'
            ],
            cooperatives.map(
                row => [

                    row.Cooperative,

                    row.Farms,

                    row[
                        'Area (ha)'
                    ],

                    row.Validated,

                    row.Rejected,

                    row[
                        'Correction Required'
                    ],

                    row.Pending,

                    `${row[
                        'Validation Rate %'
                    ]}%`
                ]
            )
        )
    );


    setHTML(
        'workflowPerformance',
        performanceTable(
            [
                'Workflow stage',
                'Farms',
                'Area (ha)'
            ],
            workflow.map(
                row => [

                    row.Stage,

                    row.Farms,

                    row[
                        'Area (ha)'
                    ]
                ]
            )
        )
    );


    updatePerformanceSummary(
        enumerators
    );
}


// ===========================================
// ENUMERATOR STATS
// ===========================================

function buildEnumeratorStats() {

    const map =
        new Map();


    filteredFarms.forEach(
        farm => {

            const id =
                farm.enumerator_id ||
                'unassigned';


            if (!map.has(id)) {

                map.set(
                    id,
                    {

                        Enumerator:
                            personName(
                                farm.enumerator_id
                            ),

                        'Farms Mapped':
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
                map.get(id);


            row[
                'Farms Mapped'
            ]++;


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
    );


    return [
        ...map.values()
    ]
        .map(
            row => ({

                ...row,

                'Validation Rate %':
                    row[
                        'Farms Mapped'
                    ]
                        ? Number(
                            (
                                row.Validated /
                                row[
                                    'Farms Mapped'
                                ] *
                                100
                            ).toFixed(1)
                        )
                        : 0
            })
        )
        .sort(
            (a, b) =>
                b[
                    'Farms Mapped'
                ] -
                a[
                    'Farms Mapped'
                ]
        );
}


// ===========================================
// COOPERATIVE STATS
// ===========================================

function buildCooperativeStats() {

    const map =
        new Map();


    filteredFarms.forEach(
        farm => {

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
                            0
                    }
                );
            }


            const row =
                map.get(key);


            row.Farms++;

            row[
                'Area (ha)'
            ] +=
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
    );


    return [
        ...map.values()
    ]
        .map(
            row => ({

                ...row,

                'Area (ha)':
                    Number(
                        row[
                            'Area (ha)'
                        ].toFixed(2)
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
            })
        )
        .sort(
            (a, b) =>
                b[
                    'Validation Rate %'
                ] -
                a[
                    'Validation Rate %'
                ]
        );
}


// ===========================================
// WORKFLOW STATS
// ===========================================

function buildWorkflowStats() {

    return Object.keys(
        workflowLabel
    ).map(
        state => ({

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
                                sum +
                                farm.area,
                            0
                        )
                        .toFixed(2)
                )
        })
    );
}


// ===========================================
// PERFORMANCE SUMMARY
// ===========================================

function updatePerformanceSummary(
    rows
) {

    if (!rows.length) {

        setText(
            'topPerformer',
            '—'
        );

        setText(
            'highestWorkload',
            '—'
        );

        setText(
            'highestCorrection',
            '—'
        );

        return;
    }


    const top =
        rows
            .slice()
            .sort(
                (a, b) =>
                    b[
                        'Validation Rate %'
                    ] -
                    a[
                        'Validation Rate %'
                    ]
            )[0];


    const workload =
        rows
            .slice()
            .sort(
                (a, b) =>
                    b[
                        'Farms Mapped'
                    ] -
                    a[
                        'Farms Mapped'
                    ]
            )[0];


    const correction =
        rows
            .slice()
            .sort(
                (a, b) =>
                    correctionRate(b) -
                    correctionRate(a)
            )[0];


    setText(
        'topPerformer',
        `${top.Enumerator} · ${
            top[
                'Validation Rate %'
            ]
        }%`
    );


    setText(
        'highestWorkload',
        `${workload.Enumerator} · ${
            workload[
                'Farms Mapped'
            ]
        } farms`
    );


    setText(
        'highestCorrection',
        `${correction.Enumerator} · ${
            correctionRate(
                correction
            ).toFixed(1)
        }%`
    );
}


function correctionRate(
    row
) {

    return (
        row[
            'Correction Required'
        ] /
        Math.max(
            row[
                'Farms Mapped'
            ],
            1
        ) *
        100
    );
}


// ===========================================
// FORMAT AVAILABILITY
// ===========================================

function updateFormatAvailability() {

    const finalOnly =
        filteredFarms.length > 0 &&
        filteredFarms.every(
            farm =>
                FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        );


    document
        .querySelectorAll(
            '.export-option'
        )
        .forEach(
            option => {

                const format =
                    option.dataset.format;


                const disabled =
                    (
                        format ===
                        'geojson' ||
                        format ===
                        'kmz'
                    ) &&
                    !finalOnly;


                option.classList.toggle(
                    'disabled',
                    disabled
                );


                option.setAttribute(
                    'aria-disabled',
                    disabled
                );


                option.title =
                    disabled
                        ? 'GeoJSON/KMZ require only Validated and/or Rejected records.'
                        : '';
            }
        );


    if (
        (
            exportFormat ===
            'geojson' ||
            exportFormat ===
            'kmz'
        ) &&
        !finalOnly
    ) {

        selectFormat(
            'excel'
        );
    }


    const help =
        document.getElementById(
            'formatHelp'
        );


    if (help) {

        help.textContent =
            finalOnly

                ? 'Final geospatial export enabled: Validated and Rejected plots are eligible for GIS and audit use.'

                : 'Excel and Progress Report are available for all workflow stages. GeoJSON/KMZ require only Validated or Rejected records.';
    }
}


// ===========================================
// SELECT FORMAT
// ===========================================

function selectFormat(
    format
) {

    const finalOnly =
        filteredFarms.length > 0 &&
        filteredFarms.every(
            farm =>
                FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        );


    if (
        (
            format ===
            'geojson' ||
            format ===
            'kmz'
        ) &&
        !finalOnly
    ) {

        showNotification(
            'GeoJSON/KMZ require only Validated and/or Rejected plots.',
            'warning'
        );

        return;
    }


    exportFormat =
        format;


    document
        .querySelectorAll(
            '.export-option'
        )
        .forEach(
            option =>
                option.classList.toggle(
                    'selected',
                    option.dataset.format ===
                    format
                )
        );
}


// ===========================================
// EXPORT
// ===========================================

async function exportData() {

    if (!canExportPermission) {

        showNotification(
            'You do not have export permission for this project.',
            'error'
        );

        return;
    }


    if (!filteredFarms.length) {

        showNotification(
            'No records match the selected filters.',
            'warning'
        );

        return;
    }


    const finalOnly =
        filteredFarms.every(
            farm =>
                FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        );


    if (
        (
            exportFormat ===
            'geojson' ||
            exportFormat ===
            'kmz'
        ) &&
        !finalOnly
    ) {

        showNotification(
            'GeoJSON/KMZ require only Validated and/or Rejected plots.',
            'warning'
        );

        return;
    }


    showLoading(true);


    try {

        switch (
            exportFormat
        ) {

            case 'excel':

                exportExcel();

                break;


            case 'geojson':

                exportGeoJSON();

                break;


            case 'kmz':

                await exportKMZ();

                break;


            case 'report':

                exportProgressReport();

                break;


            default:

                throw new Error(
                    'Unknown export format.'
                );
        }


        await recordExport(
            exportFormat,
            filteredFarms.length
        );


        await loadExportHistory();

    } catch (error) {

        console.error(
            error
        );

        showNotification(
            error.message ||
            'Export failed.',
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


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            rows
        ),
        'Farms'
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


    XLSX.writeFile(
        workbook,
        `MappingTrace_${safeName(
            currentProject.name
        )}_Export_${dateStamp()}.xlsx`
    );


    showNotification(
        `Excel export generated for ${filteredFarms.length.toLocaleString()} records.`,
        'success'
    );
}


// ===========================================
// EXPORT ROW
// ===========================================

function exportRow(
    farm
) {

    return {

        'Farm ID':
            farm.farm_id,

        'Farmer ID':
            farm.farmer_id ||
            '',

        'Farmer Name':
            farm.farmer_name ||
            '',

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
            farm.status ||
            '',

        'Enumerator':
            personName(
                farm.enumerator_id
            ),

        'Field Officer':
            personName(
                farm.field_officer_id
            ),

        'Rejection Reason':
            farm.rejection_reason ||
            '',

        'Correction Reason':
            farm.correction_reason ||
            '',

        'Rejected By':
            personName(
                farm.rejected_by
            ),

        'Rejected At':
            farm.rejected_at ||
            '',

        'Validated By':
            personName(
                farm.final_validated_by
            ),

        'Validated At':
            farm.final_validated_at ||
            '',

        'Created At':
            farm.created_at ||
            '',

        'Updated At':
            farm.updated_at ||
            ''
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
            .map(
                farm => {

                    const geometry =
                        parseGeometry(
                            farm.geometry
                        );


                    return {

                        type:
                            'Feature',

                        properties:
                            exportRow(
                                farm
                            ),

                        geometry
                    };
                }
            );


    if (!features.length) {

        throw new Error(
            'No valid geometries were found.'
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


    saveAs(
        blob,
        `MappingTrace_${safeName(
            currentProject.name
        )}_${dateStamp()}.geojson`
    );


    showNotification(
        `GeoJSON generated for ${features.length.toLocaleString()} plots.`,
        'success'
    );
}


// ===========================================
// KMZ
// ===========================================

async function exportKMZ() {

    if (
        typeof JSZip ===
        'undefined'
    ) {

        throw new Error(
            'JSZip is not loaded. Add JSZip before exports.js.'
        );
    }


    const farms =
        filteredFarms.filter(
            farm =>
                farm.geometry
        );


    if (!farms.length) {

        throw new Error(
            'No valid geometries were found.'
        );
    }


    const placemarks =
        farms
            .map(
                farm =>
                    farmToKML(
                        farm
                    )
            )
            .join('');


    const kml =
        `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <name>${escapeXml(
                    currentProject.name ||
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


    showNotification(
        `KMZ generated for ${farms.length.toLocaleString()} plots.`,
        'success'
    );
}


// ===========================================
// FARM → KML
// ===========================================

function farmToKML(
    farm
) {

    const geometry =
        parseGeometry(
            farm.geometry
        );


    return `
        <Placemark>

            <name>
                ${escapeXml(
                    farm.farm_id ||
                    farm.farmer_name ||
                    'Farm'
                )}
            </name>

            <description>
                ${escapeXml(
                    buildKMLDescription(
                        farm
                    )
                )}
            </description>

            ${geometryToKML(
                geometry
            )}

        </Placemark>
    `;
}


function buildKMLDescription(
    farm
) {

    return [

        `Farmer: ${
            farm.farmer_name || ''
        }`,

        `Cooperative: ${
            farm.cooperative || ''
        }`,

        `Enumerator: ${
            personName(
                farm.enumerator_id
            )
        }`,

        `Area: ${
            farm.area.toFixed(2)
        } ha`,

        `Workflow: ${
            workflowLabel[
                farm.workflow_state
            ] ||
            farm.workflow_state
        }`,

        `Rejection reason: ${
            farm.rejection_reason || ''
        }`,

        `Correction reason: ${
            farm.correction_reason || ''
        }`,

        `Rejected by: ${
            personName(
                farm.rejected_by
            )
        }`,

        `Rejected at: ${
            farm.rejected_at || ''
        }`
    ].join('\n');
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


    if (
        geometry.type ===
        'Polygon'
    ) {

        return polygonToKML(
            geometry.coordinates
        );
    }


    if (
        geometry.type ===
        'MultiPolygon'
    ) {

        return `
            <MultiGeometry>
                ${
                    geometry.coordinates
                        .map(
                            polygon =>
                                polygonToKML(
                                    polygon
                                )
                        )
                        .join('')
                }
            </MultiGeometry>
        `;
    }


    if (
        geometry.type ===
        'Point'
    ) {

        return `
            <Point>
                <coordinates>
                    ${
                        geometry.coordinates[0]
                    },
                    ${
                        geometry.coordinates[1]
                    },
                    0
                </coordinates>
            </Point>
        `;
    }


    return '';
}


function polygonToKML(
    coordinates
) {

    const outer =
        coordinates[0];


    const outerText =
        outer
            .map(
                point =>
                    `${point[0]},${point[1]},0`
            )
            .join(' ');


    const holes =
        coordinates
            .slice(1)
            .map(
                ring =>
                    `
                    <innerBoundaryIs>
                        <LinearRing>
                            <coordinates>
                                ${
                                    ring
                                        .map(
                                            point =>
                                                `${point[0]},${point[1]},0`
                                        )
                                        .join(' ')
                                }
                            </coordinates>
                        </LinearRing>
                    </innerBoundaryIs>
                    `
            )
            .join('');


    return `
        <Polygon>

            <outerBoundaryIs>
                <LinearRing>
                    <coordinates>
                        ${outerText}
                    </coordinates>
                </LinearRing>
            </outerBoundaryIs>

            ${holes}

        </Polygon>
    `;
}


// ===========================================
// PROGRESS REPORT
// ===========================================

function exportProgressReport() {

    const workbook =
        XLSX.utils.book_new();


    const summary = [

        {
            Metric:
                'Project',

            Value:
                currentProject.name
        },

        {
            Metric:
                'Generated',

            Value:
                new Date()
                    .toLocaleString()
        },

        {
            Metric:
                'Selected Farms',

            Value:
                filteredFarms.length
        },

        {
            Metric:
                'Selected Area (ha)',

            Value:
                filteredFarms
                    .reduce(
                        (sum, farm) =>
                            sum +
                            farm.area,
                        0
                    )
                    .toFixed(2)
        },

        {
            Metric:
                'Validated',

            Value:
                filteredFarms.filter(
                    f =>
                        f.workflow_state ===
                        'validated'
                ).length
        },

        {
            Metric:
                'Rejected',

            Value:
                filteredFarms.filter(
                    f =>
                        f.workflow_state ===
                        'rejected'
                ).length
        },

        {
            Metric:
                'In Progress',

            Value:
                filteredFarms.filter(
                    f =>
                        !FINAL_GEO_STATES.has(
                            f.workflow_state
                        )
                ).length
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


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            filteredFarms.map(
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


    showNotification(
        'Progress report generated.',
        'success'
    );
}


// ===========================================
// REJECTED AUDIT EXPORT
// ===========================================

async function exportRejectedAudit() {

    if (!canExportPermission) {

        showNotification(
            'You do not have export permission.',
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

        showNotification(
            'No rejected plots match the current filters.',
            'warning'
        );

        return;
    }


    const old =
        filteredFarms;


    filteredFarms =
        rejected;


    try {

        exportExcel();

        await recordExport(
            'rejected_audit',
            rejected.length
        );

        await loadExportHistory();

    } finally {

        filteredFarms =
            old;

        updateStats();

        renderPerformance();
    }
}


// ===========================================
// EXPORT HISTORY
// ===========================================

async function recordExport(
    format,
    recordCount
) {

    try {

        await supabaseClient
            .from(
                'export_history'
            )
            .insert({

                project_id:
                    currentProject.id,

                user_id:
                    currentUser.id,

                format:

                    format,

                record_count:
                    recordCount,

                created_at:
                    new Date()
                        .toISOString()
            });

    } catch (error) {

        console.warn(
            'Export history failed:',
            error
        );
    }
}


async function loadExportHistory() {

    const body =
        document.getElementById(
            'exportHistoryBody'
        );


    if (
        !body ||
        !currentProject
    ) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                'export_history'
            )
            .select(
                `
                created_at,
                format,
                record_count,
                user_id,
                project_id
                `
            )
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

        body.innerHTML =
            `
            <tr>
                <td
                    colspan="5"
                    class="empty-history"
                >
                    Export history is not available.
                </td>
            </tr>
            `;

        return;
    }


    if (!data?.length) {

        body.innerHTML =
            `
            <tr>
                <td
                    colspan="5"
                    class="empty-history"
                >
                    No exports recorded yet.
                </td>
            </tr>
            `;

        return;
    }


    body.innerHTML =
        data
            .map(
                row =>
                    `
                    <tr>

                        <td>
                            ${escapeHtml(
                                new Date(
                                    row.created_at
                                )
                                    .toLocaleString()
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                row.format
                            )}
                        </td>

                        <td>
                            ${Number(
                                row.record_count ||
                                0
                            )
                                .toLocaleString()}
                        </td>

                        <td>
                            ${escapeHtml(
                                personName(
                                    row.user_id
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                currentProject.name
                            )}
                        </td>

                    </tr>
                    `
            )
            .join('');
}


// ===========================================
// PERMISSIONS
// ===========================================

function updatePermissionUI() {

    const badge =
        document.getElementById(
            'exportPermissionBadge'
        );


    if (badge) {

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
    }


    const exportButton =
        document.getElementById(
            'exportBtn'
        );


    if (exportButton) {

        exportButton.disabled =
            !canExportPermission;
    }


    const management =
        document.getElementById(
            'permissionManagement'
        );


    if (management) {

        management.classList.toggle(
            'hidden',
            !canManageExportPermissions
        );
    }


    if (
        canManageExportPermissions
    ) {

        renderPermissionList();
    }
}


// ===========================================
// PERMISSION LIST
// ===========================================

function renderPermissionList() {

    const container =
        document.getElementById(
            'permissionList'
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        [...memberDirectory.values()]
            .map(
                member => {

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


                    const automatic =
                        MANAGEMENT_ROLES.includes(
                            String(
                                member.role
                            ).toLowerCase()
                        );


                    return `
                        <div
                            class="permission-row"
                        >

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        name
                                    )}
                                </strong>

                                <div
                                    class="permission-role"
                                >
                                    ${escapeHtml(
                                        profile?.email ||
                                        member.user_id
                                    )}
                                </div>

                            </div>


                            <div
                                class="permission-role"
                            >
                                ${escapeHtml(
                                    role
                                )}
                            </div>


                            <div>
                                ${
                                    automatic
                                        ? 'Automatic'
                                        : 'Project permission'
                                }
                            </div>


                            <div
                                class="permission-toggle"
                            >

                                <input
                                    type="checkbox"
                                    data-user-id="${
                                        member.user_id
                                    }"
                                    ${
                                        automatic ||
                                        member.can_export
                                            ? 'checked'
                                            : ''
                                    }
                                    ${
                                        automatic
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
            'input[data-user-id]'
        )
        .forEach(
            input => {

                input.addEventListener(
                    'change',
                    async () => {

                        await setExportPermission(
                            input.dataset.userId,
                            input.checked
                        );
                    }
                );
            }
        );
}


// ===========================================
// SET PERMISSION
// ===========================================

async function setExportPermission(
    userId,
    enabled
) {

    if (
        !canManageExportPermissions
    ) {

        return;
    }


    const {
        error
    } =
        await supabaseClient
            .rpc(
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
            'You do not have export permission.',
            'error'
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


    if (
        !section ||
        !header ||
        !body
    ) {
        return;
    }


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
            .slice(
                0,
                10
            )
            .map(
                farm =>
                    `
                    <tr>

                        <td>
                            ${escapeHtml(
                                farm.farm_id
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                farm.farmer_name ||
                                ''
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
                            ${farm.area.toFixed(
                                2
                            )}
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
                    `
            )
            .join('');


    setText(
        'previewTotal',
        filteredFarms.length
    );


    section.classList.remove(
        'hidden'
    );


    section.scrollIntoView({
        behavior:
            'smooth',
        block:
            'nearest'
    });
}


window.hidePreview =
    function () {

        document
            .getElementById(
                'previewSection'
            )
            ?.classList.add(
                'hidden'
            );
    };


// ===========================================
// NAVIGATION
// ===========================================

function setupNavigation() {

    const sidebar =
        document.getElementById(
            'sidebar'
        );


    const overlay =
        document.getElementById(
            'sidebarOverlay'
        );


    const burger =
        document.getElementById(
            'burgerBtn'
        );


    const toggle =
        document.getElementById(
            'sidebarToggle'
        );


    const toggleSidebar =
        () => {

            if (
                window.innerWidth <=
                768
            ) {

                sidebar?.classList.toggle(
                    'mobile-open'
                );

                overlay?.classList.toggle(
                    'active'
                );

            } else {

                sidebar?.classList.toggle(
                    'collapsed'
                );
            }
        };


    burger?.addEventListener(
        'click',
        toggleSidebar
    );


    toggle?.addEventListener(
        'click',
        toggleSidebar
    );


    overlay?.addEventListener(
        'click',
        () => {

            sidebar?.classList.remove(
                'mobile-open'
            );

            overlay?.classList.remove(
                'active'
            );
        }
    );
}


// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {

    document
        .getElementById(
            'projectSelector'
        )
        ?.addEventListener(
            'change',
            event =>
                changeProject(
                    event.target.value
                )
        );


    document
        .getElementById(
            'advancedFiltersBtn'
        )
        ?.addEventListener(
            'click',
            () => {

                document
                    .getElementById(
                        'advancedPanel'
                    )
                    ?.classList.toggle(
                        'hidden'
                    );
            }
        );


    [
        'coopQuickFilter',
        'enumeratorQuickFilter',
        'workflowQuickFilter',
        'dateFrom',
        'dateTo',
        'dateBasis',
        'supplierAdvanced',
        'fieldOfficerAdvanced',
        'areaMin',
        'areaMax'
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


    [
        'qualityDuplicate',
        'qualityCorrection',
        'qualityMissingGeometry',
        'qualityRejectedReason'
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
        .getElementById(
            'applyFiltersBtn'
        )
        ?.addEventListener(
            'click',
            applyFilters
        );


    document
        .getElementById(
            'resetBtn'
        )
        ?.addEventListener(
            'click',
            resetFilters
        );


    document
        .querySelectorAll(
            '.tab-btn'
        )
        .forEach(
            tab => {

                tab.addEventListener(
                    'click',
                    () => {

                        document
                            .querySelectorAll(
                                '.tab-btn'
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        'active'
                                    )
                            );


                        tab.classList.add(
                            'active'
                        );


                        [
                            'enumeratorPerformance',
                            'cooperativePerformance',
                            'workflowPerformance'
                        ]
                            .forEach(
                                id =>
                                    document
                                        .getElementById(
                                            id
                                        )
                                        ?.classList.add(
                                            'hidden'
                                        )
                            );


                        const target =
                            tab.dataset.tab ===
                            'enumerators'

                                ? 'enumeratorPerformance'

                                : tab.dataset.tab ===
                                  'cooperatives'

                                    ? 'cooperativePerformance'

                                    : 'workflowPerformance';


                        document
                            .getElementById(
                                target
                            )
                            ?.classList.remove(
                                'hidden'
                            );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            '.export-option'
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


    document
        .getElementById(
            'exportBtn'
        )
        ?.addEventListener(
            'click',
            exportData
        );


    document
        .getElementById(
            'previewBtn'
        )
        ?.addEventListener(
            'click',
            previewData
        );


    document
        .getElementById(
            'rejectedAuditBtn'
        )
        ?.addEventListener(
            'click',
            exportRejectedAudit
        );


    document
        .getElementById(
            'refreshHistoryBtn'
        )
        ?.addEventListener(
            'click',
            loadExportHistory
        );


    document
        .getElementById(
            'refreshBtn'
        )
        ?.addEventListener(
            'click',
            async () => {

                if (
                    currentProject
                ) {

                    await loadFarms(
                        currentProject.id
                    );

                    await loadExportHistory();
                }
            }
        );


    document
        .getElementById(
            'logoutBtn'
        )
        ?.addEventListener(
            'click',
            async () => {

                await supabaseClient
                    .auth
                    .signOut();

                window.location.href =
                    '../login.html';
            }
        );
}


// ===========================================
// UTILITIES
// ===========================================

function normalizeWorkflow(
    farm
) {

    if (
        farm.workflow_state
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


    return 'submitted';
}


function personName(
    id
) {

    if (!id) {
        return 'Unassigned';
    }


    const member =
        memberDirectory.get(
            id
        );


    if (!member) {
        return id;
    }


    const profile =
        member.profile;


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


function parseGeometry(
    geometry
) {

    if (
        typeof geometry ===
        'string'
    ) {

        try {

            return JSON.parse(
                geometry
            );

        } catch {

            throw new Error(
                'Invalid geometry JSON.'
            );
        }
    }


    return geometry;
}


function performanceTable(
    headers,
    rows
) {

    if (!rows.length) {

        return `
            <div
                class="empty-history"
            >
                No matching records.
            </div>
        `;
    }


    return `
        <table
            class="performance-table"
        >

            <thead>

                <tr>

                    ${
                        headers
                            .map(
                                header =>
                                    `<th>
                                        ${escapeHtml(
                                            header
                                        )}
                                    </th>`
                            )
                            .join('')
                    }

                </tr>

            </thead>

            <tbody>

                ${
                    rows
                        .map(
                            row =>
                                `
                                <tr>

                                    ${
                                        row
                                            .map(
                                                value => {

                                                    const text =
                                                        String(
                                                            value ??
                                                            ''
                                                        );


                                                    const rate =
                                                        text.endsWith(
                                                            '%'
                                                        );


                                                    const number =
                                                        parseFloat(
                                                            text
                                                        );


                                                    const cls =
                                                        rate

                                                            ? (
                                                                number >=
                                                                80
                                                                    ? 'rate-good'
                                                                    : number >=
                                                                      60
                                                                        ? 'rate-warning'
                                                                        : 'rate-bad'
                                                            )

                                                            : '';


                                                    return `
                                                        <td
                                                            class="${cls}"
                                                        >
                                                            ${escapeHtml(
                                                                text
                                                            )}
                                                        </td>
                                                    `;
                                                }
                                            )
                                            .join('')
                                    }

                                </tr>
                                `
                        )
                        .join('')
                }

            </tbody>

        </table>
    `;
}


function unique(
    values
) {

    return [
        ...new Set(
            values.filter(
                value =>
                    value !==
                    null &&
                    value !==
                    undefined &&
                    String(
                        value
                    ).trim() !==
                    ''
            )
        )
    ].sort(
        (a, b) =>
            String(a)
                .localeCompare(
                    String(b)
                )
    );
}


function getValue(
    id
) {

    return (
        document
            .getElementById(id)
            ?.value ||
        ''
    );
}


function checked(
    id
) {

    return Boolean(
        document
            .getElementById(id)
            ?.checked
    );
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


function setHTML(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.innerHTML =
            value;
    }
}


function safeName(
    value
) {

    return String(
        value ||
        'Project'
    )
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
            80
        );
}


function dateStamp() {

    return new Date()
        .toISOString()
        .slice(
            0,
            10
        );
}


function escapeHtml(
    value
) {

    return String(
        value ??
        ''
    ).replace(
        /[&<>"']/g,
        char => ({

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

        }[char])
    );
}


function escapeXml(
    value
) {

    return String(
        value ??
        ''
    ).replace(
        /[<>&'"]/g,
        char => ({

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

        }[char])
    );
}


function showLoading(
    visible
) {

    const overlay =
        document.getElementById(
            'loadingOverlay'
        );


    if (overlay) {

        overlay.style.display =
            visible
                ? 'flex'
                : 'none';
    }
}


function showNotification(
    message,
    type = 'info'
) {

    document
        .querySelector(
            '.mt-notification'
        )
        ?.remove();


    const notification =
        document.createElement(
            'div'
        );


    notification.className =
        `mt-notification ${type}`;


    notification.textContent =
        message;


    Object.assign(
        notification.style,
        {

            position:
                'fixed',

            right:
                '22px',

            bottom:
                '22px',

            zIndex:
                '99999',

            padding:
                '12px 16px',

            borderRadius:
                '9px',

            background:
                type ===
                'error'

                    ? '#fee2e2'

                    : type ===
                      'success'

                        ? '#dcfce7'

                        : '#e0f2fe',

            color:
                type ===
                'error'

                    ? '#991b1b'

                    : type ===
                      'success'

                        ? '#166534'

                        : '#075985',

            boxShadow:
                '0 4px 14px rgba(0,0,0,.12)',

            fontSize:
                '13px',

            fontWeight:
                '600'
        }
    );


    document.body.appendChild(
        notification
    );


    setTimeout(
        () =>
            notification.remove(),
        4000
    );
}
```
