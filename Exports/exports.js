```javascript
// ============================================================
// MappingTrace — Export Center
// Rebuilt on existing Export Center design
// ============================================================

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';

let supabaseClient = null;

let currentUser = null;
let currentProject = null;
let currentMembership = null;

let allUserProjects = [];
let allFarms = [];
let filteredFarms = [];

let memberDirectory = new Map();

let allSuppliers = [];
let allCooperatives = [];
let allEnumerators = [];
let allFieldOfficers = [];

let exportFormat = 'excel';

let canExportPermission = false;
let canManageExportPermissions = false;

let currentPerformanceTab = 'enumerators';

let selectedSuppliers = new Set();
let selectedCooperatives = new Set();
let selectedEnumerators = new Set();
let selectedFieldOfficers = new Set();

const MANAGEMENT_ROLES = [
    'owner',
    'manager',
    'super_manager'
];

const FINAL_GEO_STATES = new Set([
    'validated',
    'rejected'
]);

const WORKFLOW_STAGES = [
    'submitted',
    'enumerator_review',
    'field_officer_review',
    'gis_compliance_review',
    'final_validation',
    'correction_required',
    'validated',
    'rejected'
];

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


// ============================================================
// INITIALIZATION
// ============================================================

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


// ============================================================
// INITIALIZE
// ============================================================

async function initializeExportCenter() {

    showLoading(true);

    try {

        const {
            data: {
                session
            },
            error
        } =
            await supabaseClient.auth.getSession();

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

    } catch (error) {

        console.error(error);

        showNotification(
            error.message ||
            'Failed to initialize Export Center.',
            'error'
        );

    } finally {

        showLoading(false);

    }

}


// ============================================================
// USER PROFILE
// ============================================================

async function loadUserProfile() {

    const {
        data,
        error
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

    if (error) {
        console.warn(
            'Could not load user profile:',
            error.message
        );
    }

    const firstName =
        data?.first_name ||
        '';

    const lastName =
        data?.last_name ||
        '';

    const fullName =
        `${firstName} ${lastName}`
            .trim();

    const displayName =
        fullName ||
        currentUser.email
            .split('@')[0];

    setText(
        'userName',
        displayName
    );

    setText(
        'userAvatar',
        (
            firstName ||
            displayName
        )
            .charAt(0)
            .toUpperCase()
    );

}


// ============================================================
// PROJECTS
// ============================================================

async function loadProjects() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from('project_members')
            .select(`
                project_id,
                role,
                status,
                can_export,
                projects (*)
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

    if (!data?.length) {

        throw new Error(
            'You are not an active member of any project.'
        );
    }

    allUserProjects =
        data;

    populateProjectSelector();

}


// ============================================================
// PROJECT SELECTOR
// ============================================================

function populateProjectSelector() {

    const items =
        document.getElementById(
            'dropdownItems'
        );

    if (!items) {
        return;
    }

    items.innerHTML =
        allUserProjects
            .map(
                membership => {

                    const project =
                        membership.projects;

                    return `
                        <div
                            class="dropdown-item"
                            data-project-id="${escapeHtml(
                                membership.project_id
                            )}"
                        >
                            ${escapeHtml(
                                project?.name ||
                                membership.project_id
                            )}
                        </div>
                    `;
                }
            )
            .join('');

    items
        .querySelectorAll(
            '.dropdown-item'
        )
        .forEach(
            item => {

                item.addEventListener(
                    'click',
                    async () => {

                        await changeProject(
                            item.dataset.projectId
                        );

                        closeProjectDropdown();

                    }
                );

            }
        );

}


// ============================================================
// CURRENT PROJECT
// ============================================================

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


// ============================================================
// CHANGE PROJECT
// ============================================================

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


// ============================================================
// PROJECT UI
// ============================================================

function updateProjectUI() {

    setText(
        'projectBadge',
        currentProject?.name ||
        'PROJECT'
    );

    setText(
        'selectedProjectName',
        currentProject?.name ||
        'Selected Project'
    );

    const role =
        String(
            currentMembership?.role ||
            ''
        )
            .replaceAll(
                '_',
                ' '
            );

    setText(
        'userRole',
        role
            ? capitalize(role)
            : 'Member'
    );

}


// ============================================================
// PROJECT MEMBERS
// ============================================================

async function loadProjectMembers(
    projectId
) {

    const {
        data,
        error
    } =
        await supabaseClient
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
        const member of
        data || []
    ) {

        memberDirectory.set(
            member.user_id,
            member
        );

    }

    const userIds =
        [
            ...memberDirectory.keys()
        ];

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
        )
            .toLowerCase();

    canManageExportPermissions =
        MANAGEMENT_ROLES.includes(
            role
        );

    canExportPermission =
        canManageExportPermissions ||
        ownMember?.can_export === true;

}


// ============================================================
// FARMS
// ============================================================

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

    } catch (error) {

        console.error(
            'Farm loading error:',
            error
        );

        throw error;

    } finally {

        showLoading(false);

    }

}


// ============================================================
// NORMALIZE FARM DATA
// ============================================================

function processFarmsData(
    farms
) {

    allFarms =
        farms.map(
            farm => {

                const workflow =
                    normalizeWorkflow(
                        farm
                    );

                return {

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
                        workflow,

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

                    /*
                     * IMPORTANT:
                     * Do NOT reference farms.updated_at.
                     * The current database does not contain
                     * that column.
                     */

                    validated_at:
                        farm.final_validated_at ||
                        farm.validated_at ||
                        null,

                    rejected_at:
                        farm.rejected_at ||
                        null

                };

            }
        );

    buildFilterLists();

    resetSelectionSets();

    filteredFarms =
        [
            ...allFarms
        ];

    renderFilterLists();

    updateStats();

    updateActiveFilterChips();

    renderPerformance();

    updateFormatAvailability();

}


// ============================================================
// WORKFLOW NORMALIZATION
// ============================================================

function normalizeWorkflow(
    farm
) {

    const candidates = [

        farm.workflow_state,

        farm.status,

        farm.submission_status,

        farm.farm_status

    ];

    for (
        const value of
        candidates
    ) {

        if (!value) {
            continue;
        }

        const normalized =
            String(
                value
            )
                .trim()
                .toLowerCase();

        if (
            WORKFLOW_STAGES.includes(
                normalized
            )
        ) {

            return normalized;

        }

        if (
            normalized ===
            'pending'
        ) {

            return 'submitted';

        }

    }

    return 'submitted';

}


// ============================================================
// FILTER LISTS
// ============================================================

function buildFilterLists() {

    allSuppliers =
        unique(
            allFarms.map(
                farm =>
                    farm.supplier
            )
        )
            .sort(
                localeSort
            );

    allCooperatives =
        unique(
            allFarms.map(
                farm =>
                    farm.cooperative
            )
        )
            .sort(
                localeSort
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


// ============================================================
// RESET FILTER SELECTIONS
// ============================================================

function resetSelectionSets() {

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
                item =>
                    item.id
            )
        );

    selectedFieldOfficers =
        new Set(
            allFieldOfficers.map(
                item =>
                    item.id
            )
        );

}


// ============================================================
// RENDER FILTER LISTS
// ============================================================

function renderFilterLists() {

    renderCheckboxFilter(
        'supplierList',
        allSuppliers.map(
            value => ({
                value,
                label: value
            })
        ),
        selectedSuppliers
    );

    renderCheckboxFilter(
        'cooperativeList',
        allCooperatives.map(
            value => ({
                value,
                label: value
            })
        ),
        selectedCooperatives
    );

    renderCheckboxFilter(
        'enumeratorList',
        allEnumerators,
        selectedEnumerators
    );

    renderCheckboxFilter(
        'fieldOfficerList',
        allFieldOfficers,
        selectedFieldOfficers
    );

    updateFilterCount();

}


// ============================================================
// CHECKBOX FILTER
// ============================================================

function renderCheckboxFilter(
    containerId,
    values,
    selectedSet
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {
        return;
    }

    if (!values.length) {

        container.innerHTML =
            `
            <div class="empty-filter">
                No records available
            </div>
            `;

        return;
    }

    container.innerHTML =
        values
            .map(
                item => {

                    const value =
                        typeof item ===
                        'object'
                            ? item.id ||
                              item.value
                            : item;

                    const label =
                        typeof item ===
                        'object'
                            ? item.name ||
                              item.label
                            : item;

                    return `
                        <label class="checkbox-item">
                            <input
                                type="checkbox"
                                class="dynamic-filter-checkbox"
                                data-filter-value="${escapeHtml(
                                    value
                                )}"
                                ${selectedSet.has(value)
                                    ? 'checked'
                                    : ''}
                            >

                            <span class="checkbox-label">
                                ${escapeHtml(
                                    label
                                )}
                            </span>
                        </label>
                    `;
                }
            )
            .join('');

    container
        .querySelectorAll(
            'input[type="checkbox"]'
        )
        .forEach(
            input => {

                input.addEventListener(
                    'change',
                    () => {

                        const value =
                            input.dataset
                                .filterValue;

                        const set =
                            getSelectionSet(
                                containerId
                            );

                        if (
                            input.checked
                        ) {

                            set.add(
                                value
                            );

                        } else {

                            set.delete(
                                value
                            );

                        }

                        applyFilters();

                    }
                );

            }
        );

}


// ============================================================
// FILTER SET
// ============================================================

function getSelectionSet(
    containerId
) {

    if (
        containerId ===
        'supplierList'
    ) {

        return selectedSuppliers;

    }

    if (
        containerId ===
        'cooperativeList'
    ) {

        return selectedCooperatives;

    }

    if (
        containerId ===
        'enumeratorList'
    ) {

        return selectedEnumerators;

    }

    return selectedFieldOfficers;

}


// ============================================================
// APPLY FILTERS
// ============================================================

function applyFilters() {

    const workflowStates =
        getSelectedWorkflowStages();

    const dateFrom =
        getValue(
            'dateFrom'
        );

    const dateTo =
        getValue(
            'dateTo'
        );

    const areaMin =
        parseNumber(
            getValue(
                'areaMin'
            )
        );

    const areaMax =
        parseNumber(
            getValue(
                'areaMax'
            )
        );

    const dateBasis =
        getValue(
            'dateBasis'
        ) ||
        'created_at';

    const quality =
        getValue(
            'qualityFilter'
        ) ||
        'all';

    filteredFarms =
        allFarms.filter(
            farm => {

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
                    allEnumerators.length &&
                    !selectedEnumerators.has(
                        farm.enumerator_id
                    )
                ) {
                    return false;
                }

                if (
                    farm.field_officer_id &&
                    allFieldOfficers.length &&
                    !selectedFieldOfficers.has(
                        farm.field_officer_id
                    )
                ) {
                    return false;
                }

                if (
                    !workflowStates.has(
                        farm.workflow_state
                    )
                ) {
                    return false;
                }

                if (
                    areaMin !== null &&
                    farm.area < areaMin
                ) {
                    return false;
                }

                if (
                    areaMax !== null &&
                    farm.area > areaMax
                ) {
                    return false;
                }

                if (
                    dateFrom ||
                    dateTo
                ) {

                    const dateValue =
                        getFarmDate(
                            farm,
                            dateBasis
                        );

                    if (!dateValue) {
                        return false;
                    }

                    const date =
                        new Date(
                            dateValue
                        );

                    if (
                        dateFrom &&
                        date <
                        new Date(
                            `${dateFrom}T00:00:00`
                        )
                    ) {
                        return false;
                    }

                    if (
                        dateTo &&
                        date >
                        new Date(
                            `${dateTo}T23:59:59`
                        )
                    ) {
                        return false;
                    }

                }

                if (
                    quality ===
                    'missing_geometry'
                ) {

                    if (
                        parseGeometry(
                            farm.geometry
                        )
                    ) {
                        return false;
                    }

                }

                if (
                    quality ===
                    'rejection_reason'
                ) {

                    if (
                        !farm.rejection_reason
                    ) {
                        return false;
                    }

                }

                if (
                    quality ===
                    'correction_required'
                ) {

                    if (
                        farm.workflow_state !==
                            'correction_required' &&
                        !farm.correction_reason
                    ) {
                        return false;
                    }

                }

                return true;

            }
        );

    updateStats();

    updateActiveFilterChips();

    renderPerformance();

    updateFormatAvailability();

}


// ============================================================
// WORKFLOW SELECT ALL / CLEAR ALL
// ============================================================

function selectAllWorkflowStages(
    checked
) {

    document
        .querySelectorAll(
            '.workflow-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    checked;

            }
        );

    applyFilters();

    updateWorkflowStageControl();

}


// ============================================================
// WORKFLOW STAGE CONTROL
// ============================================================

function updateWorkflowStageControl() {

    const checkboxes =
        [
            ...document.querySelectorAll(
                '.workflow-checkbox'
            )
        ];

    const checked =
        checkboxes.filter(
            x =>
                x.checked
        );

    const container =
        document.getElementById(
            'workflowList'
        );

    if (!container) {
        return;
    }

    let selectAll =
        document.getElementById(
            'workflowSelectAll'
        );

    if (!selectAll) {

        selectAll =
            document.createElement(
                'label'
            );

        selectAll.id =
            'workflowSelectAll';

        selectAll.className =
            'checkbox-item workflow-select-all';

        selectAll.innerHTML =
            `
            <input
                type="checkbox"
                id="workflowSelectAllCheckbox"
            >

            <span class="checkbox-label">
                Select All Stages
            </span>
            `;

        container.prepend(
            selectAll
        );

        const input =
            selectAll.querySelector(
                'input'
            );

        input.addEventListener(
            'change',
            () => {

                selectAllWorkflowStages(
                    input.checked
                );

            }
        );

    }

    const selectAllInput =
        document.getElementById(
            'workflowSelectAllCheckbox'
        );

    if (!selectAllInput) {
        return;
    }

    selectAllInput.checked =
        checked.length ===
        checkboxes.length;

    selectAllInput.indeterminate =
        checked.length > 0 &&
        checked.length <
        checkboxes.length;

    const count =
        document.getElementById(
            'workflowStageCount'
        );

    if (count) {

        count.textContent =
            `${checked.length} of ${checkboxes.length} selected`;

    }

}


// ============================================================
// SELECTED WORKFLOW STATES
// ============================================================

function getSelectedWorkflowStages() {

    return new Set(
        [
            ...document.querySelectorAll(
                '.workflow-checkbox:checked'
            )
        ]
            .map(
                checkbox =>
                    checkbox.value
            )
    );

}


// ============================================================
// STATS
// ============================================================

function updateStats() {

    const farms =
        filteredFarms;

    const totalArea =
        farms.reduce(
            (sum, farm) =>
                sum +
                (
                    Number(
                        farm.area
                    ) || 0
                ),
            0
        );

    const validated =
        farms.filter(
            farm =>
                farm.workflow_state ===
                'validated'
        ).length;

    const rejected =
        farms.filter(
            farm =>
                farm.workflow_state ===
                'rejected'
        ).length;

    const pending =
        farms.filter(
            farm =>
                !FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        ).length;

    setText(
        'totalFarms',
        farms.length.toLocaleString()
    );

    setText(
        'totalArea',
        `${totalArea.toFixed(2)} ha`
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

    setText(
        'exportCount',
        farms.length.toLocaleString()
    );

    setText(
        'exportArea',
        `${totalArea.toFixed(2)} ha`
    );

    setText(
        'filteredValidated',
        validated.toLocaleString()
    );

    setText(
        'filteredRejected',
        rejected.toLocaleString()
    );

}


// ============================================================
// PERFORMANCE
// ============================================================

function renderPerformance() {

    if (
        currentPerformanceTab ===
        'enumerators'
    ) {

        renderEnumeratorPerformance();

    } else if (
        currentPerformanceTab ===
        'cooperatives'
    ) {

        renderCooperativePerformance();

    } else {

        renderWorkflowPerformance();

    }

    updatePerformanceHighlights();

}


// ============================================================
// ENUMERATOR PERFORMANCE
// ============================================================

function renderEnumeratorPerformance() {

    const body =
        document.getElementById(
            'enumeratorPerformanceBody'
        );

    if (!body) {
        return;
    }

    const groups =
        new Map();

    for (
        const farm of
        filteredFarms
    ) {

        const id =
            farm.enumerator_id ||
            'unassigned';

        if (!groups.has(id)) {

            groups.set(
                id,
                []
            );

        }

        groups
            .get(id)
            .push(
                farm
            );

    }

    const rows =
        [
            ...groups.entries()
        ]
            .map(
                ([id, farms]) => {

                    const mapped =
                        farms.length;

                    const submitted =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'submitted'
                        ).length;

                    const validated =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'validated'
                        ).length;

                    const rejected =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'rejected'
                        ).length;

                    const correction =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'correction_required'
                        ).length;

                    const pending =
                        farms.filter(
                            f =>
                                !FINAL_GEO_STATES.has(
                                    f.workflow_state
                                )
                        ).length;

                    const validationRate =
                        mapped > 0
                            ? (
                                validated /
                                mapped *
                                100
                            )
                            : 0;

                    return {

                        Enumerator:
                            personName(id),

                        'Farms Mapped':
                            mapped,

                        Submitted:
                            submitted,

                        Validated:
                            validated,

                        Rejected:
                            rejected,

                        'Correction Required':
                            correction,

                        Pending:
                            pending,

                        'Validation Rate %':
                            Number(
                                validationRate
                                    .toFixed(1)
                            )

                    };

                }
            )
            .sort(
                (a, b) =>
                    b['Farms Mapped'] -
                    a['Farms Mapped']
            );

    if (!rows.length) {

        body.innerHTML =
            emptyTableRow(
                8,
                'No enumerator data for the current filters.'
            );

        return;

    }

    body.innerHTML =
        rows
            .map(
                row => {

                    const validationClass =
                        rateClass(
                            row[
                                'Validation Rate %'
                            ]
                        );

                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        row.Enumerator
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${row['Farms Mapped']}
                            </td>

                            <td>
                                ${row.Submitted}
                            </td>

                            <td>
                                ${row.Validated}
                            </td>

                            <td>
                                ${row.Rejected}
                            </td>

                            <td>
                                ${row['Correction Required']}
                            </td>

                            <td>
                                ${row.Pending}
                            </td>

                            <td class="${validationClass}">
                                ${row['Validation Rate %']}%
                            </td>

                        </tr>
                    `;

                }
            )
            .join('');

    window.currentEnumeratorRows =
        rows;

}


// ============================================================
// COOPERATIVE PERFORMANCE
// ============================================================

function renderCooperativePerformance() {

    const body =
        document.getElementById(
            'cooperativePerformanceBody'
        );

    if (!body) {
        return;
    }

    const groups =
        new Map();

    for (
        const farm of
        filteredFarms
    ) {

        const name =
            farm.cooperative ||
            'Unassigned';

        if (!groups.has(name)) {

            groups.set(
                name,
                []
            );

        }

        groups
            .get(name)
            .push(
                farm
            );

    }

    const rows =
        [
            ...groups.entries()
        ]
            .map(
                ([name, farms]) => {

                    const total =
                        farms.length;

                    const area =
                        farms.reduce(
                            (sum, farm) =>
                                sum +
                                (
                                    Number(
                                        farm.area
                                    ) || 0
                                ),
                            0
                        );

                    const validated =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'validated'
                        ).length;

                    const rejected =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'rejected'
                        ).length;

                    const correction =
                        farms.filter(
                            f =>
                                f.workflow_state ===
                                'correction_required'
                        ).length;

                    const pending =
                        farms.filter(
                            f =>
                                !FINAL_GEO_STATES.has(
                                    f.workflow_state
                                )
                        ).length;

                    const validationRate =
                        total > 0
                            ? validated /
                              total *
                              100
                            : 0;

                    return {

                        Cooperative:
                            name,

                        Farms:
                            total,

                        Area:
                            area,

                        Validated:
                            validated,

                        Rejected:
                            rejected,

                        Correction:
                            correction,

                        Pending:
                            pending,

                        ValidationRate:
                            validationRate

                    };

                }
            )
            .sort(
                (a, b) =>
                    b.Farms -
                    a.Farms
            );

    if (!rows.length) {

        body.innerHTML =
            emptyTableRow(
                8,
                'No cooperative data for the current filters.'
            );

        return;

    }

    body.innerHTML =
        rows
            .map(
                row => {

                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        row.Cooperative
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${row.Farms}
                            </td>

                            <td>
                                ${row.Area.toFixed(2)}
                            </td>

                            <td>
                                ${row.Validated}
                            </td>

                            <td>
                                ${row.Rejected}
                            </td>

                            <td>
                                ${row.Correction}
                            </td>

                            <td>
                                ${row.Pending}
                            </td>

                            <td class="${rateClass(
                                row.ValidationRate
                            )}">
                                ${row.ValidationRate.toFixed(1)}%
                            </td>

                        </tr>
                    `;

                }
            )
            .join('');

    window.currentCooperativeRows =
        rows;

}


// ============================================================
// WORKFLOW PERFORMANCE
// ============================================================

function renderWorkflowPerformance() {

    const body =
        document.getElementById(
            'workflowPerformanceBody'
        );

    if (!body) {
        return;
    }

    const rows =
        WORKFLOW_STAGES
            .map(
                state => {

                    const farms =
                        filteredFarms.filter(
                            farm =>
                                farm.workflow_state ===
                                state
                        );

                    return {

                        stage:
                            workflowLabel[
                                state
                            ],

                        farms:
                            farms.length,

                        area:
                            farms.reduce(
                                (sum, farm) =>
                                    sum +
                                    (
                                        Number(
                                            farm.area
                                        ) || 0
                                    ),
                                0
                            )

                    };

                }
            );

    body.innerHTML =
        rows
            .map(
                row => `
                    <tr>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    row.stage
                                )}
                            </strong>
                        </td>

                        <td>
                            ${row.farms}
                        </td>

                        <td>
                            ${row.area.toFixed(2)}
                        </td>

                    </tr>
                `
            )
            .join('');

}


// ============================================================
// PERFORMANCE HIGHLIGHTS
// ============================================================

function updatePerformanceHighlights() {

    const rows =
        window.currentEnumeratorRows ||
        [];

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
                (
                    a,
                    b
                ) =>
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
                (
                    a,
                    b
                ) =>
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
                (
                    a,
                    b
                ) =>
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
        (
            row[
                'Correction Required'
            ] || 0
        ) /
        Math.max(
            row[
                'Farms Mapped'
            ] || 0,
            1
        ) *
        100
    );

}


// ============================================================
// FORMAT AVAILABILITY
// ============================================================

function updateFormatAvailability() {

    const hasRecords =
        filteredFarms.length >
        0;

    const finalOnly =
        hasRecords &&
        filteredFarms.every(
            farm =>
                FINAL_GEO_STATES.has(
                    farm.workflow_state
                )
        );

    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(
            option => {

                const format =
                    option.dataset.format;

                const permission =
                    hasFormatPermission(
                        format
                    );

                const geoAllowed =
                    (
                        format ===
                        'geojson' ||
                        format ===
                        'kmz'
                    ) &&
                    finalOnly;

                const disabled =
                    !permission ||
                    (
                        (
                            format ===
                            'geojson' ||
                            format ===
                            'kmz'
                        ) &&
                        !geoAllowed
                    );

                option.classList.toggle(
                    'disabled',
                    disabled
                );

                option.setAttribute(
                    'aria-disabled',
                    disabled
                );

                if (
                    !permission
                ) {

                    option.title =
                        'You do not have permission for this export format.';

                } else if (
                    (
                        format ===
                        'geojson' ||
                        format ===
                        'kmz'
                    ) &&
                    !geoAllowed
                ) {

                    option.title =
                        'GeoJSON/KMZ require only Validated and/or Rejected plots.';

                } else {

                    option.title =
                        '';

                }

            }
        );

    if (
        !hasFormatPermission(
            exportFormat
        ) ||
        (
            (
                exportFormat ===
                'geojson' ||
                exportFormat ===
                'kmz'
            ) &&
            !finalOnly
        )
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
                ? 'Validated and Rejected plots are eligible for GIS export. Other stages remain available through Excel and reporting.'
                : 'Excel and Progress Report are available for all workflow stages. GeoJSON/KMZ require only Validated and/or Rejected plots.';

    }

}


// ============================================================
// FORMAT PERMISSION
// ============================================================

function hasFormatPermission(
    format
) {

    if (
        canManageExportPermissions
    ) {

        return true;

    }

    if (
        !canExportPermission
    ) {

        return false;

    }

    /*
     * Existing project_members.can_export is
     * project-level access. Until the new granular
     * permission table exists, it grants the approved
     * project member access to the available formats.
     */

    return true;

}


// ============================================================
// SELECT FORMAT
// ============================================================

function selectFormat(
    format
) {

    if (
        !hasFormatPermission(
            format
        )
    ) {

        showNotification(
            'You do not have permission for this export format.',
            'warning'
        );

        return;

    }

    const finalOnly =
        filteredFarms.length >
        0 &&
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


// ============================================================
// EXPORT
// ============================================================

async function exportData() {

    if (
        !canExportPermission
    ) {

        showNotification(
            'You do not have export permission for this project.',
            'error'
        );

        return;

    }

    if (
        !filteredFarms.length
    ) {

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
            'Export error:',
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


// ============================================================
// EXCEL
// ============================================================

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


// ============================================================
// EXPORT ROW
// ============================================================

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
            farm.supplier ||
            '',

        'Cooperative':
            farm.cooperative ||
            '',

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
            farm.validated_at ||
            '',

        /*
         * Deliberately no Updated At.
         * farms.updated_at does not exist.
         */

        'Created At':
            farm.created_at ||
            ''

    };

}


// ============================================================
// GEOJSON
// ============================================================

function exportGeoJSON() {

    const features =
        filteredFarms
            .filter(
                farm =>
                    parseGeometry(
                        farm.geometry
                    )
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


// ============================================================
// KMZ
// ============================================================

async function exportKMZ() {

    if (
        typeof JSZip ===
        'undefined'
    ) {

        throw new Error(
            'JSZip library is not loaded.'
        );

    }

    const placemarks =
        filteredFarms
            .map(
                farm => {

                    const geometry =
                        parseGeometry(
                            farm.geometry
                        );

                    if (!geometry) {
                        return '';
                    }

                    const coordinates =
                        geometryToKmlCoordinates(
                            geometry
                        );

                    if (!coordinates) {
                        return '';
                    }

                    return `
                        <Placemark>

                            <name>
                                ${escapeXml(
                                    farm.farmer_name ||
                                    farm.farm_id ||
                                    'Farm'
                                )}
                            </name>

                            <description>
                                <![CDATA[
                                    Farm ID: ${escapeXml(
                                        farm.farm_id ||
                                        ''
                                    )}<br>
                                    Farmer: ${escapeXml(
                                        farm.farmer_name ||
                                        ''
                                    )}<br>
                                    Cooperative: ${escapeXml(
                                        farm.cooperative ||
                                        ''
                                    )}<br>
                                    Area: ${escapeXml(
                                        String(
                                            farm.area ||
                                            0
                                        )
                                    )} ha<br>
                                    Workflow: ${escapeXml(
                                        workflowLabel[
                                            farm.workflow_state
                                        ] ||
                                        farm.workflow_state ||
                                        ''
                                    )}
                                ]]>
                            </description>

                            ${coordinates}

                        </Placemark>
                    `;

                }
            )
            .join('');

    if (!placemarks.trim()) {

        throw new Error(
            'No valid geometries were found for KMZ export.'
        );

    }

    const kml = `
        <?xml version="1.0" encoding="UTF-8"?>

        <kml
            xmlns="http://www.opengis.net/kml/2.2"
        >

            <Document>

                <name>
                    MappingTrace —
                    ${escapeXml(
                        currentProject.name
                    )}
                </name>

                ${placemarks}

            </Document>

        </kml>
    `;

    const zip =
        new JSZip();

    zip.file(
        'doc.kml',
        kml
    );

    const blob =
        await zip.generateAsync(
            {
                type:
                    'blob'
            }
        );

    saveAs(
        blob,
        `MappingTrace_${safeName(
            currentProject.name
        )}_${dateStamp()}.kmz`
    );

    showNotification(
        `KMZ generated for ${filteredFarms.length.toLocaleString()} plots.`,
        'success'
    );

}


// ============================================================
// PROGRESS REPORT
// ============================================================

function exportProgressReport() {

    const total =
        filteredFarms.length;

    const validated =
        filteredFarms.filter(
            f =>
                f.workflow_state ===
                'validated'
        ).length;

    const rejected =
        filteredFarms.filter(
            f =>
                f.workflow_state ===
                'rejected'
        ).length;

    const correction =
        filteredFarms.filter(
            f =>
                f.workflow_state ===
                'correction_required'
        ).length;

    const pending =
        filteredFarms.filter(
            f =>
                !FINAL_GEO_STATES.has(
                    f.workflow_state
                )
        ).length;

    const area =
        filteredFarms.reduce(
            (sum, farm) =>
                sum +
                (
                    Number(
                        farm.area
                    ) || 0
                ),
            0
        );

    const validationRate =
        total > 0
            ? validated /
              total *
              100
            : 0;

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
                'Export Date',

            Value:
                new Date()
                    .toLocaleString()
        },

        {
            Metric:
                'Records',

            Value:
                total
        },

        {
            Metric:
                'Area (ha)',

            Value:
                Number(
                    area.toFixed(2)
                )
        },

        {
            Metric:
                'Validated',

            Value:
                validated
        },

        {
            Metric:
                'Rejected',

            Value:
                rejected
        },

        {
            Metric:
                'Correction Required',

            Value:
                correction
        },

        {
            Metric:
                'In Progress',

            Value:
                pending
        },

        {
            Metric:
                'Validation Rate (%)',

            Value:
                Number(
                    validationRate
                        .toFixed(1)
                )
        }

    ];

    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            summary
        ),
        'Progress Summary'
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
        )}_Progress_Report_${dateStamp()}.xlsx`
    );

    showNotification(
        'Progress report generated.',
        'success'
    );

}


// ============================================================
// REJECTED AUDIT
// ============================================================

async function exportRejectedAudit() {

    if (
        !canExportPermission
    ) {

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

    showLoading(true);

    try {

        const workbook =
            XLSX.utils.book_new();

        const auditRows =
            rejected.map(
                farm => ({

                    'Farm ID':
                        farm.farm_id,

                    'Farmer ID':
                        farm.farmer_id ||
                        '',

                    'Farmer Name':
                        farm.farmer_name ||
                        '',

                    'Supplier':
                        farm.supplier ||
                        '',

                    'Cooperative':
                        farm.cooperative ||
                        '',

                    'Enumerator':
                        personName(
                            farm.enumerator_id
                        ),

                    'Field Officer':
                        personName(
                            farm.field_officer_id
                        ),

                    'Area (ha)':
                        farm.area,

                    'Workflow State':
                        'Rejected',

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

                    'Created At':
                        farm.created_at ||
                        ''

                })
            );

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(
                auditRows
            ),
            'Rejected Audit'
        );

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(
                buildRejectionSummary(
                    rejected
                )
            ),
            'Summary'
        );

        XLSX.writeFile(
            workbook,
            `MappingTrace_${safeName(
                currentProject.name
            )}_Rejected_Audit_${dateStamp()}.xlsx`
        );

        await recordExport(
            'rejected_audit',
            rejected.length
        );

        await loadExportHistory();

        showNotification(
            `Rejected audit export generated for ${rejected.length.toLocaleString()} plots.`,
            'success'
        );

    } catch (error) {

        console.error(
            error
        );

        showNotification(
            error.message ||
            'Rejected audit export failed.',
            'error'
        );

    } finally {

        showLoading(false);

    }

}


// ============================================================
// PREVIEW
// ============================================================

function previewData() {

    if (
        !canExportPermission
    ) {

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
                farm => `
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
                                farm.cooperative ||
                                ''
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
                            ${Number(
                                farm.area ||
                                0
                            ).toFixed(2)}
                            ha
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
            .toLocaleString()
    );

    section.style.display =
        'block';

    section.scrollIntoView({
        behavior:
            'smooth',
        block:
            'start'
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


// ============================================================
// PERMISSION UI
// ============================================================

function updatePermissionUI() {

    const badge =
        document.getElementById(
            'exportPermissionBadge'
        );

    if (!badge) {
        return;
    }

    badge.classList.remove(
        'allowed',
        'denied'
    );

    if (
        canManageExportPermissions
    ) {

        badge.textContent =
            'Manager export access';

        badge.classList.add(
            'allowed'
        );

    } else if (
        canExportPermission
    ) {

        badge.textContent =
            'Export access granted';

        badge.classList.add(
            'allowed'
        );

    } else {

        badge.textContent =
            'Export access restricted';

        badge.classList.add(
            'denied'
        );

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

    renderPermissionList();

}


// ============================================================
// PERMISSION MANAGEMENT
// ============================================================

function renderPermissionList() {

    const container =
        document.getElementById(
            'permissionList'
        );

    if (
        !container ||
        !canManageExportPermissions
    ) {
        return;
    }

    const members =
        [
            ...memberDirectory.values()
        ]
            .filter(
                member =>
                    [
                        'validator',
                        'field_officer',
                        'enumerator'
                    ]
                        .includes(
                            String(
                                member.role
                            )
                                .toLowerCase()
                        )
            );

    if (!members.length) {

        container.innerHTML =
            `
            <div class="empty-filter">
                No eligible members found.
            </div>
            `;

        return;

    }

    container.innerHTML =
        members
            .map(
                member => {

                    const profile =
                        member.profile;

                    const name =
                        `${profile?.first_name || ''} ${
                            profile?.last_name || ''
                        }`
                            .trim() ||
                        profile?.email ||
                        member.user_id;

                    return `
                        <div class="permission-row">

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        name
                                    )}
                                </strong>

                                <div class="permission-role">
                                    ${escapeHtml(
                                        profile?.email ||
                                        member.user_id
                                    )}
                                </div>

                            </div>

                            <div class="permission-role">
                                ${escapeHtml(
                                    member.role
                                )}
                            </div>

                            <div>
                                Project permission
                            </div>

                            <div class="permission-toggle">

                                <input
                                    type="checkbox"
                                    data-user-id="${escapeHtml(
                                        member.user_id
                                    )}"
                                    ${
                                        member.can_export
                                            ? 'checked'
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


// ============================================================
// SET PERMISSION
// ============================================================

async function setExportPermission(
    userId,
    enabled
) {

    if (
        !canManageExportPermissions
    ) {

        return;

    }

    try {

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
            throw error;
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

    } catch (error) {

        console.error(
            error
        );

        showNotification(
            error.message ||
            'Unable to update export permission.',
            'error'
        );

    }

}


// ============================================================
// EXPORT HISTORY
// ============================================================

async function recordExport(
    format,
    count
) {

    if (!currentProject?.id) {
        return;
    }

    try {

        const payload = {

            project_id:
                currentProject.id,

            user_id:
                currentUser.id,

            export_type:
                format,

            record_count:
                count,

            created_at:
                new Date()
                    .toISOString()

        };

        const {
            error
        } =
            await supabaseClient
                .from('export_history')
                .insert(
                    payload
                );

        if (error) {

            console.warn(
                'Export history was not recorded:',
                error.message
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

    if (!container) {
        return;
    }

    if (!currentProject?.id) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from('export_history')
                .select('*')
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

            container.innerHTML =
                `
                <div class="empty-history">
                    <i class="fas fa-info-circle"></i>
                    <p>
                        Export history is not available.
                    </p>
                </div>
                `;

            return;

        }

        if (!data?.length) {

            container.innerHTML =
                `
                <div class="empty-history">
                    <i class="fas fa-box-open"></i>
                    <p>No exports yet</p>
                </div>
                `;

            return;

        }

        container.innerHTML =
            data
                .map(
                    item => {

                        return `
                            <div class="history-row">

                                <div>

                                    <strong>
                                        ${escapeHtml(
                                            formatLabel(
                                                item.export_type
                                            )
                                        )}
                                    </strong>

                                    <span>
                                        ${Number(
                                            item.record_count ||
                                            0
                                        ).toLocaleString()}
                                        records
                                    </span>

                                </div>

                                <div>

                                    <span>
                                        ${formatDate(
                                            item.created_at
                                        )}
                                    </span>

                                </div>

                            </div>
                        `;

                    }
                )
                .join('');

    } catch (error) {

        console.warn(
            error
        );

    }

}


// ============================================================
// BUILD STATISTICS
// ============================================================

function buildEnumeratorStats() {

    return window.currentEnumeratorRows ||
        [];

}


function buildCooperativeStats() {

    return (
        window.currentCooperativeRows ||
        []
    )
        .map(
            row => ({

                Cooperative:
                    row.Cooperative,

                Farms:
                    row.Farms,

                'Area (ha)':
                    Number(
                        row.Area.toFixed(2)
                    ),

                Validated:
                    row.Validated,

                Rejected:
                    row.Rejected,

                'Correction Required':
                    row.Correction,

                Pending:
                    row.Pending,

                'Validation Rate %':
                    Number(
                        row.ValidationRate
                            .toFixed(1)
                    )

            })
        );

}


function buildWorkflowStats() {

    return WORKFLOW_STAGES
        .map(
            state => {

                const farms =
                    filteredFarms.filter(
                        farm =>
                            farm.workflow_state ===
                            state
                    );

                return {

                    'Workflow Stage':
                        workflowLabel[
                            state
                        ],

                    Farms:
                        farms.length,

                    'Area (ha)':
                        Number(
                            farms.reduce(
                                (sum, farm) =>
                                    sum +
                                    (
                                        Number(
                                            farm.area
                                        ) || 0
                                    ),
                                0
                            )
                                .toFixed(2)
                        )

                };

            }
        );

}


function buildRejectionSummary(
    farms
) {

    const groups =
        new Map();

    farms.forEach(
        farm => {

            const reason =
                farm.rejection_reason ||
                'No reason recorded';

            groups.set(
                reason,
                (
                    groups.get(
                        reason
                    ) || 0
                ) + 1
            );

        }
    );

    return [
        ...groups.entries()
    ]
        .sort(
            (
                a,
                b
            ) =>
                b[1] -
                a[1]
        )
        .map(
            ([reason, count]) => ({

                'Rejection Reason':
                    reason,

                'Number of Plots':
                    count

            })
        );

}


// ============================================================
// DATE FILTER
// ============================================================

function getFarmDate(
    farm,
    basis
) {

    /*
     * No updated_at.
     * Fall back safely to created_at.
     */

    switch (
        basis
    ) {

        case 'validated_at':

            return (
                farm.final_validated_at ||
                farm.validated_at ||
                null
            );

        case 'rejected_at':

            return (
                farm.rejected_at ||
                null
            );

        case 'created_at':

        default:

            return (
                farm.created_at ||
                null
            );

    }

}


// ============================================================
// ACTIVE FILTER CHIPS
// ============================================================

function updateActiveFilterChips() {

    /*
     * Compatible with the existing design.
     * If an active-filter container exists,
     * populate it. Otherwise do nothing.
     */

    const container =
        document.getElementById(
            'activeFilterChips'
        );

    if (!container) {
        return;
    }

    const chips = [];

    if (
        selectedSuppliers.size <
        allSuppliers.length
    ) {

        chips.push(
            `Suppliers: ${selectedSuppliers.size}`
        );

    }

    if (
        selectedCooperatives.size <
        allCooperatives.length
    ) {

        chips.push(
            `Cooperatives: ${selectedCooperatives.size}`
        );

    }

    if (
        selectedEnumerators.size <
        allEnumerators.length
    ) {

        chips.push(
            `Enumerators: ${selectedEnumerators.size}`
        );

    }

    if (
        selectedFieldOfficers.size <
        allFieldOfficers.length
    ) {

        chips.push(
            `Field Officers: ${selectedFieldOfficers.size}`
        );

    }

    const stages =
        getSelectedWorkflowStages();

    if (
        stages.size <
        WORKFLOW_STAGES.length
    ) {

        chips.push(
            `Stages: ${stages.size}`
        );

    }

    container.innerHTML =
        chips
            .map(
                chip =>
                    `
                    <span class="filter-chip">
                        ${escapeHtml(
                            chip
                        )}
                    </span>
                    `
            )
            .join('');

}


// ============================================================
// FILTER COUNTS
// ============================================================

function updateFilterCount() {

    const fields = [

        [
            'supplierList',
            selectedSuppliers.size,
            allSuppliers.length
        ],

        [
            'cooperativeList',
            selectedCooperatives.size,
            allCooperatives.length
        ],

        [
            'enumeratorList',
            selectedEnumerators.size,
            allEnumerators.length
        ],

        [
            'fieldOfficerList',
            selectedFieldOfficers.size,
            allFieldOfficers.length
        ]

    ];

    fields.forEach(
        (
            [
                containerId,
                selected,
                total
            ]
        ) => {

            const container =
                document.getElementById(
                    containerId
                );

            if (!container) {
                return;
            }

            const parent =
                container.closest(
                    '.filter-section'
                );

            if (!parent) {
                return;
            }

            const button =
                parent.querySelector(
                    '.btn-link'
                );

            if (button) {

                button.textContent =
                    selected === total
                        ? 'Clear All'
                        : 'Select All';

            }

        }
    );

    updateWorkflowStageControl();

}


// ============================================================
// SELECT ALL FILTERS
// ============================================================

function toggleSelectionSet(
    type
) {

    let set;
    let values;

    if (
        type ===
        'supplier'
    ) {

        set =
            selectedSuppliers;

        values =
            allSuppliers;

    } else if (
        type ===
        'cooperative'
    ) {

        set =
            selectedCooperatives;

        values =
            allCooperatives;

    } else if (
        type ===
        'enumerator'
    ) {

        set =
            selectedEnumerators;

        values =
            allEnumerators.map(
                x =>
                    x.id
            );

    } else {

        set =
            selectedFieldOfficers;

        values =
            allFieldOfficers.map(
                x =>
                    x.id
            );

    }

    if (
        set.size ===
        values.length
    ) {

        set.clear();

    } else {

        values.forEach(
            value =>
                set.add(
                    value
                )
        );

    }

    renderFilterLists();

    applyFilters();

}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    document
        .getElementById(
            'refreshBtn'
        )
        ?.addEventListener(
            'click',
            async () => {

                await refreshExportCenter();

            }
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
            'resetBtn'
        )
        ?.addEventListener(
            'click',
            resetFilters
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
            'clearDates'
        )
        ?.addEventListener(
            'click',
            () => {

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
        );

    document
        .getElementById(
            'advancedToggleBtn'
        )
        ?.addEventListener(
            'click',
            toggleAdvancedFilters
        );

    document
        .getElementById(
            'sidebarToggle'
        )
        ?.addEventListener(
            'click',
            toggleSidebar
        );

    document
        .getElementById(
            'burgerBtn'
        )
        ?.addEventListener(
            'click',
            toggleMobileSidebar
        );

    document
        .getElementById(
            'sidebarOverlay'
        )
        ?.addEventListener(
            'click',
            closeMobileSidebar
        );

    document
        .getElementById(
            'dropdownSelected'
        )
        ?.addEventListener(
            'click',
            toggleProjectDropdown
        );

    document
        .getElementById(
            'projectSearch'
        )
        ?.addEventListener(
            'input',
            filterProjectDropdown
        );

    document
        .getElementById(
            'supplierSearch'
        )
        ?.addEventListener(
            'input',
            event =>
                filterCheckboxList(
                    'supplierList',
                    event.target.value
                )
        );

    document
        .getElementById(
            'coopSearch'
        )
        ?.addEventListener(
            'input',
            event =>
                filterCheckboxList(
                    'cooperativeList',
                    event.target.value
                )
        );

    document
        .getElementById(
            'enumeratorSearch'
        )
        ?.addEventListener(
            'input',
            event =>
                filterCheckboxList(
                    'enumeratorList',
                    event.target.value
                )
        );

    document
        .getElementById(
            'fieldOfficerSearch'
        )
        ?.addEventListener(
            'input',
            event =>
                filterCheckboxList(
                    'fieldOfficerList',
                    event.target.value
                )
        );

    document
        .getElementById(
            'selectAllSuppliers'
        )
        ?.addEventListener(
            'click',
            () =>
                toggleSelectionSet(
                    'supplier'
                )
        );

    document
        .getElementById(
            'selectAllCooperatives'
        )
        ?.addEventListener(
            'click',
            () =>
                toggleSelectionSet(
                    'cooperative'
                )
        );

    document
        .getElementById(
            'selectAllEnumerators'
        )
        ?.addEventListener(
            'click',
            () =>
                toggleSelectionSet(
                    'enumerator'
                )
        );

    document
        .getElementById(
            'selectAllFieldOfficers'
        )
        ?.addEventListener(
            'click',
            () =>
                toggleSelectionSet(
                    'field_officer'
                )
        );

    document
        .querySelectorAll(
            '.workflow-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    'change',
                    () => {

                        applyFilters();

                        updateWorkflowStageControl();

                    }
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
                    () => {

                        if (
                            option.classList.contains(
                                'disabled'
                            )
                        ) {
                            return;
                        }

                        selectFormat(
                            option.dataset.format
                        );

                    }
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
                    () => {

                        currentPerformanceTab =
                            tab.dataset.tab;

                        document
                            .querySelectorAll(
                                '.performance-tab'
                            )
                            .forEach(
                                button =>
                                    button.classList.toggle(
                                        'active',
                                        button ===
                                        tab
                                    )
                            );

                        document
                            .getElementById(
                                'enumeratorPerformance'
                            )
                            ?.classList.toggle(
                                'hidden',
                                currentPerformanceTab !==
                                'enumerators'
                            );

                        document
                            .getElementById(
                                'cooperativePerformance'
                            )
                            ?.classList.toggle(
                                'hidden',
                                currentPerformanceTab !==
                                'cooperatives'
                            );

                        document
                            .getElementById(
                                'workflowPerformance'
                            )
                            ?.classList.toggle(
                                'hidden',
                                currentPerformanceTab !==
                                'workflow'
                            );

                        renderPerformance();

                    }
                );

            }
        );

    document
        .getElementById(
            'logoutBtn'
        )
        ?.addEventListener(
            'click',
            logout
        );

}


// ============================================================
// REFRESH
// ============================================================

async function refreshExportCenter() {

    showLoading(true);

    try {

        await loadProjectMembers(
            currentProject.id
        );

        await loadFarms(
            currentProject.id
        );

        await loadExportHistory();

        showNotification(
            'Export Center refreshed.',
            'success'
        );

    } catch (error) {

        showNotification(
            error.message ||
            'Refresh failed.',
            'error'
        );

    } finally {

        showLoading(false);

    }

}


// ============================================================
// RESET FILTERS
// ============================================================

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
                x =>
                    x.id
            )
        );

    selectedFieldOfficers =
        new Set(
            allFieldOfficers.map(
                x =>
                    x.id
            )
        );

    document
        .querySelectorAll(
            '.workflow-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    true;

            }
        );

    setValue(
        'dateFrom',
        ''
    );

    setValue(
        'dateTo',
        ''
    );

    setValue(
        'areaMin',
        ''
    );

    setValue(
        'areaMax',
        ''
    );

    setValue(
        'qualityFilter',
        'all'
    );

    setValue(
        'dateBasis',
        'created_at'
    );

    renderFilterLists();

    filteredFarms =
        [
            ...allFarms
        ];

    updateStats();

    updateActiveFilterChips();

    renderPerformance();

    updateFormatAvailability();

    showNotification(
        'Filters reset.',
        'success'
    );

}


// ============================================================
// ADVANCED FILTERS
// ============================================================

function toggleAdvancedFilters() {

    const section =
        document.getElementById(
            'advancedFilters'
        );

    const button =
        document.getElementById(
            'advancedToggleBtn'
        );

    if (!section) {
        return;
    }

    const hidden =
        section.classList.toggle(
            'hidden'
        );

    if (button) {

        button.innerHTML =
            hidden
                ? '<i class="fas fa-chevron-down"></i> Show advanced filters'
                : '<i class="fas fa-chevron-up"></i> Hide advanced filters';

    }

}


// ============================================================
// FILTER SEARCH
// ============================================================

function filterCheckboxList(
    containerId,
    search
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {
        return;
    }

    const query =
        String(
            search ||
            ''
        )
            .toLowerCase()
            .trim();

    container
        .querySelectorAll(
            '.checkbox-item'
        )
        .forEach(
            item => {

                const text =
                    item.textContent
                        .toLowerCase();

                item.style.display =
                    text.includes(
                        query
                    )
                        ? ''
                        : 'none';

            }
        );

}


// ============================================================
// PROJECT DROPDOWN
// ============================================================

function toggleProjectDropdown() {

    const menu =
        document.getElementById(
            'dropdownMenu'
        );

    if (menu) {

        menu.classList.toggle(
            'show'
        );

    }

}


function closeProjectDropdown() {

    document
        .getElementById(
            'dropdownMenu'
        )
        ?.classList.remove(
            'show'
        );

}


function filterProjectDropdown(
    event
) {

    const query =
        event.target.value
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


// ============================================================
// SIDEBAR
// ============================================================

function toggleSidebar() {

    document
        .getElementById(
            'sidebar'
        )
        ?.classList.toggle(
            'collapsed'
        );

}


function toggleMobileSidebar() {

    document
        .getElementById(
            'sidebar'
        )
        ?.classList.add(
            'mobile-open'
        );

    document
        .getElementById(
            'sidebarOverlay'
        )
        ?.classList.add(
            'active'
        );

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


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

    document
        .querySelectorAll(
            '.sidebar a[data-page]'
        )
        .forEach(
            link => {

                link.addEventListener(
                    'click',
                    event => {

                        const page =
                            link.dataset.page;

                        if (
                            page ===
                            'exports'
                        ) {
                            return;
                        }

                        /*
                         * Preserve current project.
                         */

                        if (
                            link.href &&
                            currentProject?.id
                        ) {

                            event.preventDefault();

                            const url =
                                new URL(
                                    link.href,
                                    window.location.href
                                );

                            url.searchParams.set(
                                'project',
                                currentProject.id
                            );

                            window.location.href =
                                url.toString();

                        }

                    }
                );

            }
        );

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

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


// ============================================================
// GEOMETRY
// ============================================================

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

        if (
            geometry.type &&
            geometry.coordinates
        ) {

            return geometry;

        }

        if (
            geometry.geometry &&
            geometry.geometry.type
        ) {

            return geometry.geometry;

        }

    }

    if (
        typeof geometry ===
        'string'
    ) {

        try {

            const parsed =
                JSON.parse(
                    geometry
                );

            return parseGeometry(
                parsed
            );

        } catch {

            return null;

        }

    }

    return null;

}


// ============================================================
// KML GEOMETRY
// ============================================================

function geometryToKmlCoordinates(
    geometry
) {

    if (!geometry) {
        return '';
    }

    if (
        geometry.type ===
        'Polygon'
    ) {

        const rings =
            geometry.coordinates
                .map(
                    ring =>
                        `
                        <outerBoundaryIs>
                            <LinearRing>
                                <coordinates>
                                    ${ring
                                        .map(
                                            coordinate =>
                                                `${coordinate[0]},${coordinate[1]},${coordinate[2] || 0}`
                                        )
                                        .join(' ')}
                                </coordinates>
                            </LinearRing>
                        </outerBoundaryIs>
                        `
                )
                .join('');

        return `
            <Polygon>
                ${rings}
            </Polygon>
        `;

    }

    if (
        geometry.type ===
        'MultiPolygon'
    ) {

        return `
            <MultiGeometry>
                ${geometry.coordinates
                    .map(
                        polygon =>
                            geometryToKmlCoordinates(
                                {
                                    type:
                                        'Polygon',
                                    coordinates:
                                        polygon
                                }
                            )
                    )
                    .join('')}
            </MultiGeometry>
        `;

    }

    return '';

}


// ============================================================
// UTILITIES
// ============================================================

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

    const profile =
        member?.profile;

    const name =
        `${profile?.first_name || ''} ${
            profile?.last_name || ''
        }`
            .trim();

    return (
        name ||
        profile?.email ||
        String(id).slice(
            0,
            8
        )
    );

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
                    value !==
                    ''
            )
        )
    ];

}


function localeSort(
    a,
    b
) {

    return String(
        a
    ).localeCompare(
        String(
            b
        )
    );

}


function parseNumber(
    value
) {

    if (
        value ===
        null ||
        value ===
        undefined ||
        value ===
        ''
    ) {

        return null;

    }

    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? number
        : null;

}


function getValue(
    id
) {

    return (
        document.getElementById(
            id
        )?.value ||
        ''
    );

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


function capitalize(
    value
) {

    return String(
        value
    )
        .replace(
            /^./,
            character =>
                character.toUpperCase()
        );

}


function rateClass(
    rate
) {

    if (
        rate >=
        80
    ) {

        return 'rate-good';

    }

    if (
        rate >=
        50
    ) {

        return 'rate-warning';

    }

    return 'rate-bad';

}


function emptyTableRow(
    colspan,
    message
) {

    return `
        <tr>
            <td
                colspan="${colspan}"
                style="
                    text-align:center;
                    padding:30px;
                    color:#94a3b8;
                "
            >
                ${escapeHtml(
                    message
                )}
            </td>
        </tr>
    `;

}


function safeName(
    value
) {

    return String(
        value ||
        'Project'
    )
        .replace(
            /[^a-z0-9_\-]+/gi,
            '_'
        )
        .replace(
            /^_+|_+$/g,
            ''
        );

}


function dateStamp() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        )
            .padStart(
                2,
                '0'
            );

    const day =
        String(
            now.getDate()
        )
            .padStart(
                2,
                '0'
            );

    return `
        ${year}
        ${month}
        ${day}
    `
        .replace(
            /\s+/g,
            ''
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
    value
) {

    return String(
        value ||
        ''
    )
        .replace(
            /_/g,
            ' '
        )
        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );

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


// ============================================================
// LOADING
// ============================================================

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


// ============================================================
// NOTIFICATION
// ============================================================

function showNotification(
    message,
    type = 'info'
) {

    let container =
        document.getElementById(
            'alerts-container'
        );

    if (!container) {

        container =
            document.createElement(
                'div'
            );

        container.id =
            'alerts-container';

        container.style.position =
            'fixed';

        container.style.top =
            '80px';

        container.style.right =
            '20px';

        container.style.zIndex =
            '9999';

        container.style.width =
            '340px';

        document.body.appendChild(
            container
        );

    }

    const alert =
        document.createElement(
            'div'
        );

    const icons = {

        success:
            'fa-check-circle',

        error:
            'fa-times-circle',

        warning:
            'fa-exclamation-triangle',

        info:
            'fa-info-circle'

    };

    alert.style.background =
        '#ffffff';

    alert.style.border =
        '1px solid #e2e8f0';

    alert.style.borderLeft =
        `4px solid ${
            type === 'success'
                ? '#2c6e49'
                : type === 'error'
                    ? '#dc2626'
                    : type === 'warning'
                        ? '#f59e0b'
                        : '#3b82f6'
        }`;

    alert.style.padding =
        '12px 14px';

    alert.style.marginBottom =
        '8px';

    alert.style.borderRadius =
        '8px';

    alert.style.boxShadow =
        '0 8px 25px rgba(15,23,42,.12)';

    alert.style.fontSize =
        '12px';

    alert.innerHTML =
        `
        <div style="
            display:flex;
            align-items:center;
            gap:9px;
        ">

            <i
                class="fas ${icons[type] || icons.info}"
            ></i>

            <span>
                ${escapeHtml(
                    message
                )}
            </span>

        </div>
        `;

    container.appendChild(
        alert
    );

    setTimeout(
        () => {

            alert.style.opacity =
                '0';

            alert.style.transform =
                'translateX(20px)';

            alert.style.transition =
                '.25s ease';

            setTimeout(
                () =>
                    alert.remove(),
                300
            );

        },
        4000
    );

}


// ============================================================
// INITIAL WORKFLOW SETUP
// ============================================================

updateWorkflowStageControl();


// ============================================================
// GLOBALS
// ============================================================

window.hidePreview =
    hidePreview;

window.selectFormat =
    selectFormat;

window.previewData =
    previewData;

window.exportData =
    exportData;

window.exportRejectedAudit =
    exportRejectedAudit;
```
