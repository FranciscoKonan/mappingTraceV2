/* =========================================================
   MappingTrace — Export Center
   Complete corrected version
   ========================================================= */

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1cnF1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';

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
   INITIALIZATION
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

        db = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

        bindUI();

        const {
            data,
            error
        } = await db.auth.getSession();

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

        await loadExportHistory();

        updatePermissionUI();

        applyFilters();

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


    /*
       IMPORTANT:
       Desktop burger = collapse sidebar
       Mobile burger = open sidebar drawer
    */
    document
        .getElementById('burgerBtn')
        ?.addEventListener(
            'click',
            handleBurgerClick
        );


    document
        .getElementById('sidebarOverlay')
        ?.addEventListener(
            'click',
            closeMobileSidebar
        );


    document
        .getElementById('sidebarToggle')
        ?.addEventListener(
            'click',
            toggleSidebar
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
        .getElementById('applyFiltersBtn')
        ?.addEventListener(
            'click',
            applyFilters
        );


    document
        .getElementById('resetBtn')
        ?.addEventListener(
            'click',
            resetFilters
        );


    document
        .getElementById('previewBtn')
        ?.addEventListener(
            'click',
            previewExport
        );


    document
        .getElementById('exportBtn')
        ?.addEventListener(
            'click',
            generateExport
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
            () => toggleAllFilter('supplier')
        );


    document
        .getElementById('selectAllCooperatives')
        ?.addEventListener(
            'click',
            () => toggleAllFilter('cooperative')
        );


    document
        .getElementById('selectAllEnumerators')
        ?.addEventListener(
            'click',
            () => toggleAllFilter('enumerator')
        );


    document
        .getElementById('selectAllFieldOfficers')
        ?.addEventListener(
            'click',
            () => toggleAllFilter('fieldOfficer')
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
        'fieldOfficerSearch'
    ].forEach(
        id => {

            document
                .getElementById(id)
                ?.addEventListener(
                    'input',
                    renderFilterLists
                );
        }
    );


    [
        'dateFrom',
        'dateTo',
        'dateBasis',
        'areaMin',
        'areaMax',
        'qualityFilter'
    ].forEach(
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
            '.workflow-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    'change',
                    () => {

                        updateWorkflowSelectAllLabel();

                        applyFilters();
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

                        switchPerformanceTab(
                            tab.dataset.tab
                        );
                    }
                );
            }
        );


    window.addEventListener(
        'resize',
        syncSidebarForViewport
    );


    syncSidebarForViewport();

    updateWorkflowSelectAllLabel();


    document.addEventListener(
        'click',
        event => {

            const dropdown =
                document.getElementById(
                    'customDropdown'
                );

            if (
                dropdown &&
                !dropdown.contains(
                    event.target
                )
            ) {

                document
                    .getElementById(
                        'dropdownMenu'
                    )
                    ?.classList.remove(
                        'show'
                    );
            }
        }
    );
}


/* =========================================================
   SIDEBAR
   ========================================================= */

/*
   Desktop:
   burger button collapses / expands sidebar.

   Mobile:
   burger button opens / closes the drawer.

   This fixes the previous problem where the desktop burger
   was only toggling .mobile-open.
*/

function handleBurgerClick() {

    if (
        window.matchMedia(
            '(max-width: 768px)'
        ).matches
    ) {

        toggleMobileSidebar();

    } else {

        toggleSidebar();
    }
}


function toggleSidebar() {

    const sidebar =
        document.querySelector(
            '.sidebar'
        );

    if (!sidebar) {
        return;
    }

    /*
       Desktop collapsed state
    */
    sidebar.classList.toggle(
        'collapsed'
    );

    /*
       Keep mobile-only state clean
    */
    if (
        !window.matchMedia(
            '(max-width: 768px)'
        ).matches
    ) {

        sidebar.classList.remove(
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
}


function toggleMobileSidebar() {

    const sidebar =
        document.querySelector(
            '.sidebar'
        );

    const overlay =
        document.getElementById(
            'sidebarOverlay'
        );

    if (!sidebar) {
        return;
    }

    const isOpen =
        sidebar.classList.contains(
            'mobile-open'
        );

    if (isOpen) {

        closeMobileSidebar();

    } else {

        sidebar.classList.add(
            'mobile-open'
        );

        overlay?.classList.add(
            'active'
        );
    }
}


function closeMobileSidebar() {

    document
        .querySelector(
            '.sidebar'
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


function syncSidebarForViewport() {

    const sidebar =
        document.querySelector(
            '.sidebar'
        );

    const overlay =
        document.getElementById(
            'sidebarOverlay'
        );

    if (!sidebar) {
        return;
    }


    const mobile =
        window.matchMedia(
            '(max-width: 768px)'
        ).matches;


    if (!mobile) {

        sidebar.classList.remove(
            'mobile-open'
        );

        overlay?.classList.remove(
            'active'
        );
    }
}


/* =========================================================
   PROJECTS
   ========================================================= */

async function loadProjects() {

    const {
        data,
        error
    } = await db
        .from('project_members')
        .select(
            `
            project_id,
            role,
            status,
            can_export,
            projects (
                id,
                name
            )
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


    projectMemberships =
        data || [];


    if (
        !projectMemberships.length
    ) {

        throw new Error(
            'You are not an active member of any project.'
        );
    }


    renderProjectDropdown();
}


async function selectProject() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const requestedProject =
        params.get(
            'project'
        );


    let membership =
        projectMemberships.find(
            item =>
                item.project_id ===
                requestedProject
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
        membership.projects ||
        {
            id:
                membership.project_id,

            name:
                membership.project_id
        };


    localStorage.setItem(
        `mappingtrace_project_${currentUser.id}`,
        currentProject.id
    );


    updateProjectHeader();
}


function renderProjectDropdown() {

    const container =
        document.getElementById(
            'projectDropdown'
        );

    const menu =
        document.getElementById(
            'dropdownMenu'
        );

    if (!menu) {
        return;
    }


    const projects =
        projectMemberships
            .map(
                membership => {

                    const project =
                        membership.projects ||
                        {};

                    return {
                        id:
                            membership.project_id,

                        name:
                            project.name ||
                            membership.project_id
                    };
                }
            );


    menu.innerHTML =
        `
        <div class="dropdown-search">
            <input
                type="text"
                id="projectSearch"
                placeholder="Search project..."
            >
        </div>

        ${projects
            .map(
                project => `
                    <div
                        class="dropdown-item"
                        data-project-id="${escapeHtml(
                            project.id
                        )}"
                    >
                        ${escapeHtml(
                            project.name
                        )}
                    </div>
                `
            )
            .join('')
        }
        `;


    menu
        .querySelectorAll(
            '.dropdown-item'
        )
        .forEach(
            item => {

                item.addEventListener(
                    'click',
                    async () => {

                        const id =
                            item.dataset
                                .projectId;

                        const membership =
                            projectMemberships.find(
                                m =>
                                    m.project_id ===
                                    id
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
                            currentProject.id
                        );

                        menu.classList.remove(
                            'show'
                        );

                        updateProjectHeader();

                        await loadMembers();

                        await loadFarms();

                        await loadExportHistory();

                        updatePermissionUI();

                        applyFilters();
                    }
                );
            }
        );


    updateProjectHeader();
}


function updateProjectHeader() {

    const name =
        currentProject?.name ||
        'Project';


    const selected =
        document.getElementById(
            'dropdownSelected'
        );


    if (selected) {

        const span =
            selected.querySelector(
                'span'
            );

        if (span) {
            span.textContent =
                name;
        }
    }


    const badge =
        document.querySelector(
            '.project-badge'
        );

    if (badge) {
        badge.textContent =
            name;
    }
}


function toggleProjectDropdown() {

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
            '#dropdownMenu .dropdown-item'
        )
        .forEach(
            item => {

                const visible =
                    item.textContent
                        .toLowerCase()
                        .includes(
                            query
                        );

                item.style.display =
                    visible
                        ? ''
                        : 'none';
            }
        );
}


/* =========================================================
   MEMBERS
   ========================================================= */

async function loadMembers() {

    if (!currentProject?.id) {
        return;
    }


    const {
        data,
        error
    } = await db
        .from('project_members')
        .select(
            `
            user_id,
            role,
            status,
            can_export,
            email
            `
        )
        .eq(
            'project_id',
            currentProject.id
        )
        .eq(
            'status',
            'active'
        );


    if (error) {

        console.warn(
            'Unable to load project members:',
            error
        );

        members = [];

        return;
    }


    members =
        data || [];
}


/* =========================================================
   FARMS
   ========================================================= */

async function loadFarms() {

    if (!currentProject?.id) {
        return;
    }


    showLoading(true);


    try {

        const {
            data,
            error
        } = await db
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
            farm.farm_code ||
            farm.farm_id ||
            farm.id,

        area:
            Number(
                farm.area
            ) || 0,

        workflow_state:
            normalizeWorkflow(
                farm
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
            farm.mapped_by ||
            farm.enumerator_id ||
            farm.created_by ||
            farm.submitted_by ||
            null,

        field_officer_id:
            farm.field_officer_checked_by ||
            farm.field_officer_id ||
            null,

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
        farm.workflow_state &&
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


    return 'submitted';
}


/* =========================================================
   FILTER LISTS
   ========================================================= */

function renderFilterLists() {

    renderCheckboxFilter(
        'supplierList',
        'supplier',
        unique(
            farms.map(
                farm =>
                    farm.supplier
            )
        ),
        getValue(
            'supplierSearch'
        )
    );


    renderCheckboxFilter(
        'cooperativeList',
        'cooperative',
        unique(
            farms.map(
                farm =>
                    farm.cooperative
            )
        ),
        getValue(
            'coopSearch'
        )
    );


    renderCheckboxFilter(
        'enumeratorList',
        'enumerator',
        unique(
            farms
                .map(
                    farm =>
                        farm.enumerator_id
                )
                .filter(Boolean)
        )
            .map(
                id => ({
                    value:
                        id,

                    label:
                        personName(
                            id
                        )
                })
            ),
        getValue(
            'enumeratorSearch'
        )
    );


    renderCheckboxFilter(
        'fieldOfficerList',
        'fieldOfficer',
        unique(
            farms
                .map(
                    farm =>
                        farm.field_officer_id
                )
                .filter(Boolean)
        )
            .map(
                id => ({
                    value:
                        id,

                    label:
                        personName(
                            id
                        )
                })
            ),
        getValue(
            'fieldOfficerSearch'
        )
    );


    bindDynamicFilterEvents();
}


function renderCheckboxFilter(
    containerId,
    type,
    values,
    search
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container) {
        return;
    }


    const selected =
        getSelectedFilterValues(
            type
        );


    const query =
        String(
            search ||
            ''
        )
            .toLowerCase()
            .trim();


    const filtered =
        values.filter(
            item => {

                const label =
                    typeof item ===
                    'object'
                        ? item.label
                        : item;


                return (
                    !query ||
                    String(
                        label
                    )
                        .toLowerCase()
                        .includes(
                            query
                        )
                );
            }
        );


    if (!filtered.length) {

        container.innerHTML =
            `
            <div class="empty-filter">
                No matches
            </div>
            `;

        return;
    }


    container.innerHTML =
        filtered
            .map(
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


                    return `
                        <label
                            class="checkbox-item"
                        >

                            <input
                                type="checkbox"
                                class="${type}-checkbox"
                                value="${escapeHtml(
                                    value
                                )}"
                                ${
                                    selected.includes(
                                        String(
                                            value
                                        )
                                    )
                                        ? 'checked'
                                        : ''
                                }
                            >

                            <span
                                class="checkbox-label"
                            >
                                ${escapeHtml(
                                    label
                                )}
                            </span>

                        </label>
                    `;
                }
            )
            .join('');
}


function bindDynamicFilterEvents() {

    document
        .querySelectorAll(
            `
            .supplier-checkbox,
            .cooperative-checkbox,
            .enumerator-checkbox,
            .fieldOfficer-checkbox
            `
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    'change',
                    applyFilters
                );
            }
        );
}


function getSelectedFilterValues(
    type
) {

    return [
        ...document.querySelectorAll(
            `.${type}-checkbox:checked`
        )
    ]
        .map(
            checkbox =>
                checkbox.value
        );
}


function toggleAllFilter(
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
            checkbox =>
                checkbox.checked
        );


    boxes.forEach(
        checkbox => {

            checkbox.checked =
                !allChecked;
        }
    );


    applyFilters();
}


/* =========================================================
   WORKFLOW SELECT ALL
   ========================================================= */

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


    updateWorkflowSelectAllLabel();

    applyFilters();
}


function updateWorkflowSelectAllLabel() {

    const button =
        document.getElementById(
            'selectAllWorkflow'
        );


    if (!button) {
        return;
    }


    const boxes =
        [
            ...document.querySelectorAll(
                '.workflow-checkbox'
            )
        ];


    const allChecked =
        boxes.length > 0 &&
        boxes.every(
            box =>
                box.checked
        );


    const noneChecked =
        boxes.length > 0 &&
        boxes.every(
            box =>
                !box.checked
        );


    button.textContent =
        allChecked
            ? 'Clear All'
            : 'Select All';


    button.classList.toggle(
        'filter-clear-all',
        allChecked
    );


    button.title =
        allChecked
            ? 'Clear workflow selection'
            : 'Select all workflow stages';


    /*
       Visual state when no stage is selected.
    */
    button.dataset.selection =
        noneChecked
            ? 'none'
            : allChecked
                ? 'all'
                : 'partial';
}
/* =========================================================
   FILTER APPLICATION
   ========================================================= */

function applyFilters() {

    const suppliers =
        getSelectedFilterValues(
            'supplier'
        );

    const cooperatives =
        getSelectedFilterValues(
            'cooperative'
        );

    const enumerators =
        getSelectedFilterValues(
            'enumerator'
        );

    const fieldOfficers =
        getSelectedFilterValues(
            'fieldOfficer'
        );

    const workflows =
        [
            ...document.querySelectorAll(
                '.workflow-checkbox:checked'
            )
        ]
            .map(
                checkbox =>
                    checkbox.value
            );


    const dateFrom =
        getValue('dateFrom');

    const dateTo =
        getValue('dateTo');

    const dateBasis =
        getValue('dateBasis') ||
        'created_at';

    const areaMin =
        parseOptionalNumber(
            getValue('areaMin')
        );

    const areaMax =
        parseOptionalNumber(
            getValue('areaMax')
        );

    const qualityFilter =
        getValue('qualityFilter');


    filteredFarms =
        farms.filter(
            farm => {

                /*
                   Supplier
                */
                if (
                    suppliers.length &&
                    !suppliers.includes(
                        String(
                            farm.supplier
                        )
                    )
                ) {

                    return false;
                }


                /*
                   Cooperative
                */
                if (
                    cooperatives.length &&
                    !cooperatives.includes(
                        String(
                            farm.cooperative
                        )
                    )
                ) {

                    return false;
                }


                /*
                   Enumerator
                */
                if (
                    enumerators.length &&
                    !enumerators.includes(
                        String(
                            farm.enumerator_id
                        )
                    )
                ) {

                    return false;
                }


                /*
                   Field Officer
                */
                if (
                    fieldOfficers.length &&
                    !fieldOfficers.includes(
                        String(
                            farm.field_officer_id
                        )
                    )
                ) {

                    return false;
                }


                /*
                   Workflow.

                   IMPORTANT:
                   If zero workflow stages are
                   selected, show ZERO records.
                   This makes Select All /
                   Clear All behave predictably.
                */
                if (
                    workflows.length === 0
                ) {

                    return false;
                }


                if (
                    !workflows.includes(
                        farm.workflow_state
                    )
                ) {

                    return false;
                }


                /*
                   Area
                */
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


                /*
                   Date filtering
                */
                const farmDate =
                    getFarmDate(
                        farm,
                        dateBasis
                    );


                if (
                    dateFrom &&
                    farmDate &&
                    farmDate <
                    startOfDay(
                        dateFrom
                    )
                ) {

                    return false;
                }


                if (
                    dateTo &&
                    farmDate &&
                    farmDate >
                    endOfDay(
                        dateTo
                    )
                ) {

                    return false;
                }


                /*
                   Quality filter
                */
                if (
                    qualityFilter &&
                    qualityFilter !== 'all'
                ) {

                    if (
                        !matchesQuality(
                            farm,
                            qualityFilter
                        )
                    ) {

                        return false;
                    }
                }


                return true;
            }
        );


    updateKPIs();

    updateExportSummary();

    updatePerformance();

    updateFilterCounts();

    updateWorkflowSelectAllLabel();
}


/* =========================================================
   FILTER HELPERS
   ========================================================= */

function getFarmDate(
    farm,
    basis
) {

    let value;


    switch (basis) {

        case 'updated_at':
            value =
                farm.updated_at;
            break;

        case 'submitted_at':
            value =
                farm.submitted_at ||
                farm.created_at;
            break;

        case 'validated_at':
            value =
                farm.final_validated_at ||
                farm.validated_at;
            break;

        case 'created_at':
        default:
            value =
                farm.created_at;
            break;
    }


    if (!value) {
        return null;
    }


    const date =
        new Date(value);


    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}


function startOfDay(
    value
) {

    const date =
        new Date(value);

    date.setHours(
        0,
        0,
        0,
        0
    );

    return date;
}


function endOfDay(
    value
) {

    const date =
        new Date(value);

    date.setHours(
        23,
        59,
        59,
        999
    );

    return date;
}


function parseOptionalNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ''
    ) {

        return null;
    }


    const number =
        Number(value);


    return Number.isFinite(
        number
    )
        ? number
        : null;
}


function matchesQuality(
    farm,
    quality
) {

    /*
       Keep this compatible with
       different existing quality fields.
    */

    const value =
        String(
            farm.quality_status ||
            farm.quality ||
            farm.mapping_quality ||
            farm.validation_quality ||
            ''
        )
            .toLowerCase();


    switch (quality) {

        case 'good':
        case 'approved':
        case 'pass':
            return [
                'good',
                'approved',
                'pass',
                'valid',
                'validated'
            ].includes(value);


        case 'poor':
        case 'bad':
        case 'fail':
            return [
                'poor',
                'bad',
                'fail',
                'invalid',
                'rejected'
            ].includes(value);


        case 'missing':
            return !value;


        default:
            return true;
    }
}


/* =========================================================
   RESET / CLEAR FILTERS
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
    ].forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.value = '';
            }
        }
    );


    [
        'dateBasis',
        'qualityFilter'
    ].forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (
                element &&
                element.tagName ===
                'SELECT'
            ) {

                element.selectedIndex = 0;
            }
        }
    );


    document
        .querySelectorAll(
            '.supplier-checkbox, .cooperative-checkbox, .enumerator-checkbox, .fieldOfficer-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    false;
            }
        );


    /*
       Reset workflow to ALL stages.
       This is the expected default state.
    */
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


    renderFilterLists();

    updateWorkflowSelectAllLabel();

    applyFilters();
}


function clearDates() {

    const from =
        document.getElementById(
            'dateFrom'
        );

    const to =
        document.getElementById(
            'dateTo'
        );


    if (from) {
        from.value = '';
    }

    if (to) {
        to.value = '';
    }


    applyFilters();
}


/* =========================================================
   FILTER COUNTS
   ========================================================= */

function updateFilterCounts() {

    const total =
        filteredFarms.length;


    const selectedCount =
        document.getElementById(
            'selectedCount'
        );


    if (selectedCount) {

        selectedCount.textContent =
            formatNumber(total);
    }


    /*
       Update common count elements
       if present in the HTML.
    */
    const totalFiltered =
        document.getElementById(
            'totalFiltered'
        );


    if (totalFiltered) {

        totalFiltered.textContent =
            formatNumber(total);
    }
}


/* =========================================================
   KPI CARDS
   ========================================================= */

function updateKPIs() {

    const data =
        filteredFarms;


    const total =
        data.length;


    const area =
        data.reduce(
            (
                sum,
                farm
            ) =>
                sum +
                (
                    Number(
                        farm.area
                    ) || 0
                ),
            0
        );


    const validated =
        data.filter(
            farm =>
                farm.workflow_state ===
                'validated'
        ).length;


    const rejected =
        data.filter(
            farm =>
                farm.workflow_state ===
                'rejected'
        ).length;


    const pending =
        data.filter(
            farm =>
                ![
                    'validated',
                    'rejected'
                ].includes(
                    farm.workflow_state
                )
        ).length;


    setText(
        'totalFarms',
        formatNumber(total)
    );


    setText(
        'totalArea',
        formatArea(area)
    );


    setText(
        'validatedFarms',
        formatNumber(validated)
    );


    setText(
        'pendingFarms',
        formatNumber(pending)
    );


    setText(
        'rejectedFarms',
        formatNumber(rejected)
    );
}


/* =========================================================
   EXPORT SUMMARY
   ========================================================= */

function updateExportSummary() {

    const count =
        filteredFarms.length;


    const area =
        filteredFarms.reduce(
            (
                sum,
                farm
            ) =>
                sum +
                (
                    Number(
                        farm.area
                    ) || 0
                ),
            0
        );


    const selectedFormatElement =
        document.getElementById(
            'selectedFormat'
        );


    if (selectedFormatElement) {

        selectedFormatElement.textContent =
            getFormatLabel(
                selectedFormat
            );
    }


    setText(
        'exportCount',
        formatNumber(count)
    );


    setText(
        'exportArea',
        formatArea(area)
    );


    setText(
        'summaryCount',
        formatNumber(count)
    );


    setText(
        'summaryArea',
        formatArea(area)
    );
}


/* =========================================================
   FORMAT SELECTION
   ========================================================= */

function selectFormat(
    format
) {

    const allowed =
        [
            'excel',
            'geojson',
            'kmz',
            'report'
        ];


    if (
        !allowed.includes(
            format
        )
    ) {

        format = 'excel';
    }


    /*
       GeoJSON and KMZ are geospatial
       exports and are only available
       for Validated / Rejected.
    */
    const geoAllowed =
        filteredFarms.length > 0 &&
        filteredFarms.every(
            farm =>
                [
                    'validated',
                    'rejected'
                ].includes(
                    farm.workflow_state
                )
        );


    if (
        [
            'geojson',
            'kmz'
        ].includes(
            format
        ) &&
        !geoAllowed
    ) {

        format = 'excel';
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


    updateFormatAvailability();

    updateExportSummary();
}


function updateFormatAvailability() {

    const hasData =
        filteredFarms.length > 0;


    const geospatialAllowed =
        hasData &&
        filteredFarms.every(
            farm =>
                [
                    'validated',
                    'rejected'
                ].includes(
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


                const disabled =
                    !hasData ||
                    (
                        [
                            'geojson',
                            'kmz'
                        ].includes(
                            format
                        ) &&
                        !geospatialAllowed
                    );


                option.classList.toggle(
                    'disabled',
                    disabled
                );


                option.setAttribute(
                    'aria-disabled',
                    String(
                        disabled
                    )
                );
            }
        );


    if (
        [
            'geojson',
            'kmz'
        ].includes(
            selectedFormat
        ) &&
        !geospatialAllowed
    ) {

        selectedFormat =
            'excel';


        const excel =
            document.querySelector(
                '.format-option[data-format="excel"]'
            );

        excel?.classList.add(
            'selected'
        );
    }
}


function getFormatLabel(
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
            'Progress Report'
    };


    return (
        labels[format] ||
        'Excel'
    );
}


/* =========================================================
   PERFORMANCE
   ========================================================= */

function updatePerformance() {

    renderEnumeratorPerformance();

    renderCooperativePerformance();

    renderFieldOfficerPerformance();

    updatePerformanceHighlights();
}


function renderEnumeratorPerformance() {

    const tbody =
        document.getElementById(
            'enumeratorPerformanceBody'
        );


    if (!tbody) {
        return;
    }


    const grouped =
        groupByPerson(
            filteredFarms,
            'enumerator_id'
        );


    const rows =
        Object.values(
            grouped
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.total -
                    a.total
            );


    if (!rows.length) {

        tbody.innerHTML =
            emptyTableRow(
                'No enumerator data'
            );

        return;
    }


    tbody.innerHTML =
        rows
            .map(
                row =>
                    `
                    <tr>

                        <td>
                            ${escapeHtml(
                                row.name
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.total
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.validated
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.rejected
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.pending
                            )}
                        </td>

                        <td>
                            ${formatPercent(
                                row.validated,
                                row.total
                            )}
                        </td>

                        <td>
                            ${formatArea(
                                row.area
                            )}
                        </td>

                    </tr>
                    `
            )
            .join('');
}


function renderCooperativePerformance() {

    const tbody =
        document.getElementById(
            'cooperativePerformanceBody'
        );


    if (!tbody) {
        return;
    }


    const grouped =
        groupByField(
            filteredFarms,
            'cooperative'
        );


    const rows =
        Object.values(
            grouped
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.total -
                    a.total
            );


    if (!rows.length) {

        tbody.innerHTML =
            emptyTableRow(
                'No cooperative data'
            );

        return;
    }


    tbody.innerHTML =
        rows
            .map(
                row =>
                    `
                    <tr>

                        <td>
                            ${escapeHtml(
                                row.name
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.total
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.validated
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.rejected
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.pending
                            )}
                        </td>

                        <td>
                            ${formatPercent(
                                row.validated,
                                row.total
                            )}
                        </td>

                        <td>
                            ${formatArea(
                                row.area
                            )}
                        </td>

                    </tr>
                    `
            )
            .join('');
}


function renderFieldOfficerPerformance() {

    const tbody =
        document.getElementById(
            'fieldOfficerPerformanceBody'
        );


    if (!tbody) {
        return;
    }


    const grouped =
        groupByPerson(
            filteredFarms,
            'field_officer_id'
        );


    const rows =
        Object.values(
            grouped
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.total -
                    a.total
            );


    if (!rows.length) {

        tbody.innerHTML =
            emptyTableRow(
                'No field officer data'
            );

        return;
    }


    tbody.innerHTML =
        rows
            .map(
                row =>
                    `
                    <tr>

                        <td>
                            ${escapeHtml(
                                row.name
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.total
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.validated
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.rejected
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.pending
                            )}
                        </td>

                        <td>
                            ${formatPercent(
                                row.validated,
                                row.total
                            )}
                        </td>

                        <td>
                            ${formatArea(
                                row.area
                            )}
                        </td>

                    </tr>
                    `
            )
            .join('');
}


/* =========================================================
   PERFORMANCE GROUPING
   ========================================================= */

function groupByPerson(
    data,
    field
) {

    const result = {};


    data.forEach(
        farm => {

            const id =
                farm[field] ||
                'unassigned';


            if (!result[id]) {

                result[id] = {

                    id,

                    name:
                        id ===
                        'unassigned'
                            ? 'Unassigned'
                            : personName(
                                id
                            ),

                    total: 0,

                    validated: 0,

                    rejected: 0,

                    pending: 0,

                    area: 0
                };
            }


            addPerformanceFarm(
                result[id],
                farm
            );
        }
    );


    return result;
}


function groupByField(
    data,
    field
) {

    const result = {};


    data.forEach(
        farm => {

            const name =
                farm[field] ||
                'Unassigned';


            const key =
                String(
                    name
                );


            if (!result[key]) {

                result[key] = {

                    name,

                    total: 0,

                    validated: 0,

                    rejected: 0,

                    pending: 0,

                    area: 0
                };
            }


            addPerformanceFarm(
                result[key],
                farm
            );
        }
    );


    return result;
}


function addPerformanceFarm(
    target,
    farm
) {

    target.total += 1;

    target.area +=
        Number(
            farm.area
        ) || 0;


    if (
        farm.workflow_state ===
        'validated'
    ) {

        target.validated += 1;

    } else if (
        farm.workflow_state ===
        'rejected'
    ) {

        target.rejected += 1;

    } else {

        target.pending += 1;
    }
}


/* =========================================================
   PERFORMANCE TABS
   ========================================================= */

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
        .querySelectorAll(
            '.performance-table-container'
        )
        .forEach(
            container => {

                container.classList.toggle(
                    'hidden',
                    container.dataset.tab !==
                    tab
                );
            }
        );


    /*
       Compatibility with HTML that
       uses IDs instead of data-tab.
    */
    const sections = {

        enumerators:
            'enumeratorPerformance',

        cooperatives:
            'cooperativePerformance',

        field_officers:
            'fieldOfficerPerformance'
    };


    Object.entries(
        sections
    )
        .forEach(
            (
                [
                    key,
                    id
                ]
            ) => {

                const element =
                    document.getElementById(
                        id
                    );

                if (element) {

                    element.classList.toggle(
                        'hidden',
                        key !== tab
                    );
                }
            }
        );
}


/* =========================================================
   PERFORMANCE HIGHLIGHTS
   ========================================================= */

function updatePerformanceHighlights() {

    const enumerators =
        Object.values(
            groupByPerson(
                filteredFarms,
                'enumerator_id'
            )
        )
            .filter(
                row =>
                    row.id !==
                    'unassigned'
            );


    const cooperatives =
        Object.values(
            groupByField(
                filteredFarms,
                'cooperative'
            )
        );


    const topEnumerator =
        [...enumerators]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.validated -
                    a.validated
            )[0];


    const topCooperative =
        [...cooperatives]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.validated -
                    a.validated
            )[0];


    const validationRate =
        filteredFarms.length
            ? (
                filteredFarms.filter(
                    farm =>
                        farm.workflow_state ===
                        'validated'
                ).length /
                filteredFarms.length
            ) * 100
            : 0;


    setText(
        'topEnumerator',
        topEnumerator
            ? `${topEnumerator.name} (${topEnumerator.validated})`
            : '—'
    );


    setText(
        'topCooperative',
        topCooperative
            ? `${topCooperative.name} (${topCooperative.validated})`
            : '—'
    );


    setText(
        'validationRate',
        `${validationRate.toFixed(1)}%`
    );
}


/* =========================================================
   HELPERS
   ========================================================= */

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

        return String(
            userId
        )
            .slice(
                0,
                8
            );
    }


    return (
        member.full_name ||
        member.name ||
        member.display_name ||
        member.email ||
        String(
            userId
        )
            .slice(
                0,
                8
            )
    );
}


function unique(
    values
) {

    const seen =
        new Set();

    const result = [];


    values.forEach(
        value => {

            if (
                value === null ||
                value === undefined
            ) {
                return;
            }


            const key =
                typeof value ===
                'object'
                    ? String(
                        value.value
                    )
                    : String(
                        value
                    );


            if (
                !seen.has(
                    key
                )
            ) {

                seen.add(
                    key
                );

                result.push(
                    value
                );
            }
        }
    );


    return result;
}


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

        } catch (
            error
        ) {

            return null;
        }
    }


    return null;
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


function formatNumber(
    value
) {

    return Number(
        value || 0
    )
        .toLocaleString(
            undefined,
            {
                maximumFractionDigits: 0
            }
        );
}


function formatArea(
    value
) {

    return `${Number(
        value || 0
    ).toLocaleString(
        undefined,
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )} ha`;
}


function formatPercent(
    numerator,
    denominator
) {

    if (
        !denominator
    ) {

        return '0%';
    }


    return `${(
        numerator /
        denominator *
        100
    ).toFixed(1)}%`;
}


function emptyTableRow(
    message
) {

    return `
        <tr>
            <td
                colspan="10"
                style="
                    text-align:center;
                    color:#94a3b8;
                    padding:20px;
                "
            >
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


/* =========================================================
   LOADING / NOTIFICATIONS
   ========================================================= */

function showLoading(
    visible
) {

    const spinner =
        document.querySelector(
            '.loading-spinner'
        );


    if (!spinner) {
        return;
    }


    spinner.style.display =
        visible
            ? 'flex'
            : 'none';
}


function notify(
    message,
    type = 'info'
) {

    /*
       Use existing notification system
       when present.
    */
    if (
        typeof window.showToast ===
        'function'
    ) {

        window.showToast(
            message,
            type
        );

        return;
    }


    if (
        typeof window.showNotification ===
        'function'
    ) {

        window.showNotification(
            message,
            type
        );

        return;
    }


    /*
       Lightweight fallback.
    */
    console[
        type === 'error'
            ? 'error'
            : 'log'
    ](
        message
    );
}


/* =========================================================
   ADVANCED FILTER TOGGLE
   ========================================================= */

function toggleAdvancedFilters() {

    const panel =
        document.getElementById(
            'advancedFilters'
        );


    if (!panel) {
        return;
    }


    const hidden =
        panel.classList.toggle(
            'hidden'
        );


    const button =
        document.getElementById(
            'advancedToggleBtn'
        );


    if (button) {

        button.setAttribute(
            'aria-expanded',
            String(
                !hidden
            )
        );


        const icon =
            button.querySelector(
                'i'
            );


        if (icon) {

            icon.className =
                hidden
                    ? 'fas fa-sliders-h'
                    : 'fas fa-chevron-up';
        }
    }
}
/* =========================================================
   PERMISSIONS
   ========================================================= */

function getCurrentRole() {

    return String(
        currentMembership?.role ||
        ''
    )
        .toLowerCase()
        .trim();
}


function isManagementRole() {

    return MANAGEMENT_ROLES.includes(
        getCurrentRole()
    );
}


function canExport() {

    if (!currentUser) {
        return false;
    }


    if (isManagementRole()) {
        return true;
    }


    return currentMembership?.can_export === true;
}


function updatePermissionUI() {

    const allowed =
        canExport();


    const exportButton =
        document.getElementById(
            'exportBtn'
        );


    const permissionBadge =
        document.querySelector(
            '.permission-badge'
        );


    /*
       IMPORTANT:
       Never hide the export button.

       This makes the permission state
       visible to the user.
    */
    if (exportButton) {

        exportButton.disabled =
            !allowed;

        exportButton.classList.toggle(
            'export-restricted',
            !allowed
        );


        if (allowed) {

            exportButton.innerHTML =
                `
                <i class="fas fa-download"></i>
                Generate Export
                `;

            exportButton.title =
                'Generate the selected export';

        } else {

            exportButton.innerHTML =
                `
                <i class="fas fa-lock"></i>
                Export Restricted
                `;

            exportButton.title =
                'Export access must be granted by a Manager, Owner or Super Manager';

        }
    }


    if (permissionBadge) {

        permissionBadge.textContent =
            allowed
                ? 'Export Access'
                : 'View Only';

        permissionBadge.classList.toggle(
            'allowed',
            allowed
        );

        permissionBadge.classList.toggle(
            'denied',
            !allowed
        );
    }


    /*
       Rejected audit export follows
       the same permission.
    */
    const auditButton =
        document.getElementById(
            'rejectedAuditBtn'
        );


    if (auditButton) {

        auditButton.disabled =
            !allowed;

        auditButton.title =
            allowed
                ? 'Export rejected plot audit'
                : 'Export access required';
    }


    renderPermissionManagement();
}


/* =========================================================
   MANAGER PERMISSION MANAGEMENT
   ========================================================= */

function renderPermissionManagement() {

    const section =
        document.getElementById(
            'permissionManagement'
        );


    const list =
        document.getElementById(
            'permissionList'
        );


    if (!section || !list) {
        return;
    }


    /*
       Only management roles can grant
       export access.
    */
    if (!isManagementRole()) {

        section.classList.add(
            'hidden'
        );

        return;
    }


    section.classList.remove(
        'hidden'
    );


    if (!members.length) {

        list.innerHTML =
            `
            <div class="empty-history">
                No active project members found.
            </div>
            `;

        return;
    }


    list.innerHTML =
        members
            .map(
                member => {

                    const checked =
                        member.can_export === true;


                    const role =
                        String(
                            member.role ||
                            ''
                        )
                            .replace(
                                /_/g,
                                ' '
                            );


                    return `
                        <div
                            class="permission-row"
                        >

                            <div>
                                <strong>
                                    ${escapeHtml(
                                        member.email ||
                                        member.user_id
                                    )}
                                </strong>
                            </div>

                            <div
                                class="permission-role"
                            >
                                ${escapeHtml(
                                    role
                                )}
                            </div>

                            <div>
                                ${checked
                                    ? '<span class="permission-badge allowed">Allowed</span>'
                                    : '<span class="permission-badge denied">Restricted</span>'
                                }
                            </div>

                            <div
                                class="permission-toggle"
                            >
                                <input
                                    type="checkbox"
                                    data-member-id="${escapeHtml(
                                        member.user_id
                                    )}"
                                    class="export-permission-checkbox"
                                    ${
                                        checked
                                            ? 'checked'
                                            : ''
                                    }
                                    ${
                                        member.user_id ===
                                        currentUser.id
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


    list
        .querySelectorAll(
            '.export-permission-checkbox'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    'change',
                    handlePermissionChange
                );
            }
        );
}


async function handlePermissionChange(
    event
) {

    if (!isManagementRole()) {

        event.target.checked =
            !event.target.checked;

        return;
    }


    const userId =
        event.target.dataset.memberId;


    const enabled =
        event.target.checked;


    try {

        showLoading(true);


        const {
            error
        } = await db
            .from('project_members')
            .update({
                can_export:
                    enabled
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
                enabled;
        }


        notify(
            enabled
                ? 'Export access granted.'
                : 'Export access removed.',
            'success'
        );


        renderPermissionManagement();

    } catch (error) {

        event.target.checked =
            !enabled;


        console.error(
            'Permission update error:',
            error
        );


        notify(
            error.message ||
            'Unable to update export permission.',
            'error'
        );

    } finally {

        showLoading(false);
    }
}


/* =========================================================
   EXPORT ENTRY POINT
   ========================================================= */

async function generateExport() {

    if (!canExport()) {

        notify(
            'You do not have export permission. Ask a Manager, Owner or Super Manager to grant access.',
            'error'
        );

        return;
    }


    if (!filteredFarms.length) {

        notify(
            'No records match the current filters.',
            'warning'
        );

        return;
    }


    try {

        showLoading(true);


        switch (
            selectedFormat
        ) {

            case 'excel':

                await exportExcel();

                break;


            case 'geojson':

                await exportGeoJSON();

                break;


            case 'kmz':

                await exportKMZ();

                break;


            case 'report':

                await generateProgressReport();

                break;


            default:

                throw new Error(
                    'Unsupported export format.'
                );
        }


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
   EXCEL EXPORT
   ========================================================= */

async function exportExcel() {

    if (
        typeof XLSX ===
        'undefined'
    ) {

        throw new Error(
            'Excel library is not loaded.'
        );
    }


    const rows =
        filteredFarms.map(
            farm => {

                return {

                    Farm_ID:
                        farm.farm_id,

                    Farmer_ID:
                        farm.farmer_id || '',

                    Farmer_Name:
                        farm.farmer_name || '',

                    Supplier:
                        farm.supplier || '',

                    Cooperative:
                        farm.cooperative || '',

                    Enumerator:
                        personName(
                            farm.enumerator_id
                        ),

                    Field_Officer:
                        personName(
                            farm.field_officer_id
                        ),

                    Workflow_State:
                        farm.workflow_state || '',

                    Status:
                        farm.status || '',

                    Area_ha:
                        Number(
                            farm.area || 0
                        ),

                    Correction_Reason:
                        farm.correction_reason || '',

                    Rejection_Reason:
                        farm.rejection_reason || '',

                    Created_At:
                        farm.created_at || '',

                    Updated_At:
                        farm.updated_at || '',

                    Validated_At:
                        farm.final_validated_at || ''
                };
            }
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


    /*
       Auto-size columns.
    */
    const headers =
        Object.keys(
            rows[0] || {}
        );


    worksheet['!cols'] =
        headers.map(
            header => {

                const max =
                    Math.max(
                        header.length,
                        ...rows.map(
                            row =>
                                String(
                                    row[header] ??
                                    ''
                                ).length
                        )
                    );


                return {
                    wch:
                        Math.min(
                            Math.max(
                                max + 2,
                                10
                            ),
                            35
                        )
                };
            }
        );


    const filename =
        buildFilename(
            'farms',
            'xlsx'
        );


    XLSX.writeFile(
        workbook,
        filename
    );


    await saveExportHistory(
        filename,
        'excel',
        filteredFarms.length
    );


    notify(
        `Excel export completed: ${filteredFarms.length} records.`,
        'success'
    );
}


/* =========================================================
   GEOJSON EXPORT
   ========================================================= */

async function exportGeoJSON() {

    ensureGeospatialExportAllowed();


    const features =
        filteredFarms
            .map(
                farm => {

                    const geometry =
                        parseGeometry(
                            farm.geometry
                        );


                    if (!geometry) {
                        return null;
                    }


                    return {

                        type:
                            'Feature',

                        geometry,

                        properties: {

                            farm_id:
                                farm.farm_id,

                            farmer_id:
                                farm.farmer_id || '',

                            farmer_name:
                                farm.farmer_name || '',

                            supplier:
                                farm.supplier || '',

                            cooperative:
                                farm.cooperative || '',

                            enumerator:
                                personName(
                                    farm.enumerator_id
                                ),

                            field_officer:
                                personName(
                                    farm.field_officer_id
                                ),

                            workflow_state:
                                farm.workflow_state || '',

                            status:
                                farm.status || '',

                            area_ha:
                                Number(
                                    farm.area || 0
                                ),

                            correction_reason:
                                farm.correction_reason || '',

                            rejection_reason:
                                farm.rejection_reason || ''
                        }
                    };
                }
            )
            .filter(Boolean);


    if (!features.length) {

        throw new Error(
            'No valid geometries are available for GeoJSON export.'
        );
    }


    const geojson = {

        type:
            'FeatureCollection',

        features
    };


    downloadBlob(
        JSON.stringify(
            geojson,
            null,
            2
        ),
        buildFilename(
            'farms',
            'geojson'
        ),
        'application/geo+json'
    );


    await saveExportHistory(
        buildFilename(
            'farms',
            'geojson'
        ),
        'geojson',
        features.length
    );


    notify(
        `GeoJSON export completed: ${features.length} features.`,
        'success'
    );
}


/* =========================================================
   KMZ EXPORT
   ========================================================= */

async function exportKMZ() {

    ensureGeospatialExportAllowed();


    if (
        typeof JSZip ===
        'undefined'
    ) {

        throw new Error(
            'KMZ library is not loaded.'
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


                    return geoJSONGeometryToKML(
                        geometry,
                        farm
                    );
                }
            )
            .filter(Boolean)
            .join('\n');


    if (!placemarks) {

        throw new Error(
            'No valid geometries are available for KMZ export.'
        );
    }


    const kml =
        `
        <?xml version="1.0" encoding="UTF-8"?>
        <kml
            xmlns="http://www.opengis.net/kml/2.2"
        >
            <Document>

                <name>
                    MappingTrace Export
                </name>

                ${placemarks}

            </Document>
        </kml>
        `.trim();


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

            mimeType:
                'application/vnd.google-earth.kmz'
        });


    const filename =
        buildFilename(
            'farms',
            'kmz'
        );


    downloadBlob(
        blob,
        filename
    );


    await saveExportHistory(
        filename,
        'kmz',
        filteredFarms.length
    );


    notify(
        `KMZ export completed: ${filteredFarms.length} plots.`,
        'success'
    );
}


/* =========================================================
   GEOSPATIAL EXPORT RULE
   ========================================================= */

function ensureGeospatialExportAllowed() {

    if (!filteredFarms.length) {

        throw new Error(
            'No records selected.'
        );
    }


    const invalid =
        filteredFarms.some(
            farm =>
                ![
                    'validated',
                    'rejected'
                ].includes(
                    farm.workflow_state
                )
        );


    if (invalid) {

        throw new Error(
            'GeoJSON and KMZ exports are available only for Validated or Rejected plots.'
        );
    }
}


/* =========================================================
   GEOJSON → KML
   ========================================================= */

function geoJSONGeometryToKML(
    geometry,
    farm
) {

    if (!geometry) {
        return '';
    }


    const name =
        escapeXml(
            farm.farm_id ||
            farm.farmer_name ||
            'Farm'
        );


    const description =
        escapeXml(
            [
                `Farmer: ${farm.farmer_name || ''}`,
                `Cooperative: ${farm.cooperative || ''}`,
                `Workflow: ${farm.workflow_state || ''}`,
                `Area: ${farm.area || 0} ha`
            ].join(
                '\n'
            )
        );


    let geometryKml =
        '';


    switch (
        geometry.type
    ) {

        case 'Polygon':

            geometryKml =
                polygonToKML(
                    geometry.coordinates
                );

            break;


        case 'MultiPolygon':

            geometryKml =
                multiPolygonToKML(
                    geometry.coordinates
                );

            break;


        default:

            return '';
    }


    return `
        <Placemark>

            <name>
                ${name}
            </name>

            <description>
                ${description}
            </description>

            ${geometryKml}

        </Placemark>
    `;
}


function polygonToKML(
    coordinates
) {

    if (
        !coordinates ||
        !coordinates.length
    ) {

        return '';
    }


    const outer =
        coordinates[0];


    const inner =
        coordinates
            .slice(1);


    return `
        <Polygon>

            <outerBoundaryIs>

                <LinearRing>

                    <coordinates>
                        ${coordinatesToKML(
                            outer
                        )}
                    </coordinates>

                </LinearRing>

            </outerBoundaryIs>

            ${inner
                .map(
                    ring =>
                        `
                        <innerBoundaryIs>

                            <LinearRing>

                                <coordinates>
                                    ${coordinatesToKML(
                                        ring
                                    )}
                                </coordinates>

                            </LinearRing>

                        </innerBoundaryIs>
                        `
                )
                .join('')
            }

        </Polygon>
    `;
}


function multiPolygonToKML(
    coordinates
) {

    return `
        <MultiGeometry>

            ${coordinates
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


function coordinatesToKML(
    coordinates
) {

    return coordinates
        .map(
            coordinate => {

                const lng =
                    coordinate[0];

                const lat =
                    coordinate[1];

                const altitude =
                    coordinate.length >
                    2
                        ? coordinate[2]
                        : 0;


                return `${lng},${lat},${altitude}`;
            }
        )
        .join(' ');
}


function escapeXml(
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
            '&apos;'
        );
}


/* =========================================================
   PROGRESS REPORT
   ========================================================= */

async function generateProgressReport() {

    const total =
        filteredFarms.length;


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


    const pending =
        total -
        validated -
        rejected;


    const area =
        filteredFarms.reduce(
            (
                sum,
                farm
            ) =>
                sum +
                Number(
                    farm.area || 0
                ),
            0
        );


    const validationRate =
        total
            ? (
                validated /
                total *
                100
            )
            : 0;


    const rejectionRate =
        total
            ? (
                rejected /
                total *
                100
            )
            : 0;


    const report =
        buildProgressReportText({

            total,

            validated,

            rejected,

            pending,

            area,

            validationRate,

            rejectionRate
        });


    downloadBlob(
        report,
        buildFilename(
            'progress-report',
            'txt'
        ),
        'text/plain;charset=utf-8'
    );


    await saveExportHistory(
        buildFilename(
            'progress-report',
            'txt'
        ),
        'report',
        total
    );


    notify(
        'Progress report generated.',
        'success'
    );
}


function buildProgressReportText(
    metrics
) {

    const {
        total,
        validated,
        rejected,
        pending,
        area,
        validationRate,
        rejectionRate
    } =
        metrics;


    const now =
        new Date();


    return [
        'MAPPINGTRACE — EXPORT PROGRESS REPORT',
        '======================================',
        '',
        `Project: ${currentProject?.name || ''}`,
        `Generated: ${now.toLocaleString()}`,
        '',
        'SUMMARY',
        '-------',
        `Total plots: ${total}`,
        `Total area: ${area.toFixed(2)} ha`,
        `Validated: ${validated}`,
        `Rejected: ${rejected}`,
        `In workflow: ${pending}`,
        `Validation rate: ${validationRate.toFixed(1)}%`,
        `Rejection rate: ${rejectionRate.toFixed(1)}%`,
        '',
        'WORKFLOW BREAKDOWN',
        '------------------',
        ...Object.entries(
            WORKFLOW
        )
            .map(
                (
                    [
                        key,
                        label
                    ]
                ) => {

                    const count =
                        filteredFarms.filter(
                            farm =>
                                farm.workflow_state ===
                                key
                        ).length;


                    return `${label}: ${count}`;
                }
            ),
        '',
        'FILTERED DATASET',
        '----------------',
        `Records included: ${total}`,
        '',
        'This report was generated from the MappingTrace Export Center.'
    ].join(
        '\n'
    );
}


/* =========================================================
   REJECTED AUDIT EXPORT
   ========================================================= */

async function exportRejectedAudit() {

    if (!canExport()) {

        notify(
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

        notify(
            'No rejected plots match the current filters.',
            'warning'
        );

        return;
    }


    if (
        typeof XLSX ===
        'undefined'
    ) {

        throw new Error(
            'Excel library is not loaded.'
        );
    }


    const rows =
        rejected.map(
            farm => ({

                Farm_ID:
                    farm.farm_id,

                Farmer_ID:
                    farm.farmer_id || '',

                Farmer_Name:
                    farm.farmer_name || '',

                Supplier:
                    farm.supplier || '',

                Cooperative:
                    farm.cooperative || '',

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

                Rejection_Reason:
                    farm.rejection_reason ||
                    '',

                Correction_Reason:
                    farm.correction_reason ||
                    '',

                Area_ha:
                    Number(
                        farm.area || 0
                    ),

                Rejected_At:
                    farm.final_validated_at ||
                    farm.updated_at ||
                    ''

            })
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
        'Rejected Audit'
    );


    const filename =
        buildFilename(
            'rejected-audit',
            'xlsx'
        );


    XLSX.writeFile(
        workbook,
        filename
    );


    await saveExportHistory(
        filename,
        'rejected-audit',
        rejected.length
    );


    notify(
        `Rejected audit export completed: ${rejected.length} plots.`,
        'success'
    );
}


/* =========================================================
   PREVIEW
   ========================================================= */

function previewExport() {

    const section =
        document.getElementById(
            'previewSection'
        );


    const body =
        document.getElementById(
            'previewBody'
        );


    const footer =
        document.getElementById(
            'previewFooter'
        );


    if (!section || !body) {
        return;
    }


    if (!filteredFarms.length) {

        notify(
            'No records to preview.',
            'warning'
        );

        return;
    }


    const preview =
        filteredFarms.slice(
            0,
            50
        );


    body.innerHTML =
        preview
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
                            ${escapeHtml(
                                WORKFLOW[
                                    farm.workflow_state
                                ] ||
                                farm.workflow_state ||
                                ''
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


    if (footer) {

        footer.textContent =
            `Showing ${preview.length} of ${filteredFarms.length} records`;
    }


    section.classList.remove(
        'hidden'
    );


    section.scrollIntoView({
        behavior:
            'smooth',

        block:
            'start'
    });
}


function closePreview() {

    document
        .getElementById(
            'previewSection'
        )
        ?.classList.add(
            'hidden'
        );
}


/* =========================================================
   EXPORT HISTORY
   ========================================================= */

async function saveExportHistory(
    filename,
    format,
    recordCount
) {

    /*
       If your installation has
       export_history, persist it.

       If not, don't break exports.
    */
    try {

        const {
            error
        } = await db
            .from(
                'export_history'
            )
            .insert({

                project_id:
                    currentProject?.id,

                user_id:
                    currentUser?.id,

                filename,

                format,

                record_count:
                    recordCount,

                created_at:
                    new Date()
                        .toISOString()
            });


        if (error) {

            console.warn(
                'Export history not saved:',
                error
            );
        }

    } catch (
        error
    ) {

        console.warn(
            'Export history unavailable:',
            error
        );
    }
}


async function loadExportHistory() {

    const list =
        document.getElementById(
            'historyList'
        );


    if (!list || !currentProject?.id) {
        return;
    }


    try {

        const {
            data,
            error
        } = await db
            .from(
                'export_history'
            )
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
                30
            );


        if (error) {
            throw error;
        }


        if (!data?.length) {

            list.innerHTML =
                `
                <div class="empty-history">
                    <i class="fas fa-history"></i>
                    <div>
                        No export history yet.
                    </div>
                </div>
                `;

            return;
        }


        list.innerHTML =
            data
                .map(
                    item =>
                        `
                        <div
                            class="history-item"
                        >

                            <div
                                class="history-info"
                            >

                                <div
                                    class="history-icon"
                                >
                                    <i class="fas ${
                                        getFormatIcon(
                                            item.format
                                        )
                                    }"></i>
                                </div>

                                <div
                                    class="history-details"
                                >

                                    <div
                                        class="history-filename"
                                    >
                                        ${escapeHtml(
                                            item.filename ||
                                            'Export'
                                        )}
                                    </div>

                                    <div
                                        class="history-meta"
                                    >

                                        <span>
                                            ${escapeHtml(
                                                getFormatLabel(
                                                    item.format
                                                )
                                            )}
                                        </span>

                                        <span>
                                            ${formatNumber(
                                                item.record_count ||
                                                0
                                            )} records
                                        </span>

                                        <span>
                                            ${formatDateTime(
                                                item.created_at
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
            'Unable to load export history:',
            error
        );


        list.innerHTML =
            `
            <div class="empty-history">
                Export history unavailable.
            </div>
            `;
    }
}


function getFormatIcon(
    format
) {

    switch (
        String(
            format ||
            ''
        )
            .toLowerCase()
    ) {

        case 'excel':
            return 'fa-file-excel';

        case 'geojson':
            return 'fa-map';

        case 'kmz':
            return 'fa-globe';

        case 'report':
            return 'fa-file-alt';

        default:
            return 'fa-file';
    }
}


/* =========================================================
   FILE HELPERS
   ========================================================= */

function downloadBlob(
    content,
    filename,
    mimeType
) {

    const blob =
        content instanceof Blob
            ? content
            : new Blob(
                [
                    content
                ],
                {
                    type:
                        mimeType ||
                        'application/octet-stream'
                }
            );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            'a'
        );


    link.href =
        url;

    link.download =
        filename;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );
}


function buildFilename(
    prefix,
    extension
) {

    const project =
        String(
            currentProject?.name ||
            'project'
        )
            .trim()
            .replace(
                /[^a-z0-9]+/gi,
                '_'
            )
            .replace(
                /^_+|_+$/g,
                ''
            );


    const timestamp =
        new Date()
            .toISOString()
            .replace(
                /[:.]/g,
                '-'
            );


    return `${project}_${prefix}_${timestamp}.${extension}`;
}


function formatDateTime(
    value
) {

    if (!value) {
        return '—';
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return '—';
    }


    return date.toLocaleString();
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshAll() {

    try {

        showLoading(true);


        await loadMembers();

        await loadFarms();

        await loadExportHistory();

        updatePermissionUI();

        applyFilters();


        notify(
            'Export Center refreshed.',
            'success'
        );

    } catch (error) {

        console.error(
            'Refresh error:',
            error
        );


        notify(
            error.message ||
            'Unable to refresh.',
            'error'
        );

    } finally {

        showLoading(false);
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        const {
            error
        } = await db.auth.signOut();


        if (error) {
            throw error;
        }


        window.location.href =
            '../login.html';

    } catch (error) {

        console.error(
            'Logout error:',
            error
        );


        notify(
            error.message ||
            'Unable to log out.',
            'error'
        );
    }
}


/* =========================================================
   FINAL EVENT WIRING
   ========================================================= */

/*
   Close preview button.
*/
document.addEventListener(
    'click',
    event => {

        if (
            event.target.closest(
                '#closePreview'
            ) ||
            event.target.closest(
                '.close-preview'
            )
        ) {

            closePreview();
        }
    }
);


/*
   Workflow checkbox fallback.

   This catches checkboxes that are
   dynamically inserted after initial load.
*/
document.addEventListener(
    'change',
    event => {

        if (
            event.target.matches(
                '.workflow-checkbox'
            )
        ) {

            updateWorkflowSelectAllLabel();

            applyFilters();
        }
    }
);


/*
   Format fallback for dynamically
   rendered format controls.
*/
document.addEventListener(
    'click',
    event => {

        const option =
            event.target.closest(
                '.format-option'
            );


        if (!option) {
            return;
        }


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


/*
   Keep export format availability
   synchronized after filtering.
*/
const originalApplyFilters =
    applyFilters;


/*
   Keyboard support:
   Escape closes mobile sidebar,
   dropdown and preview.
*/
document.addEventListener(
    'keydown',
    event => {

        if (
            event.key !==
            'Escape'
        ) {

            return;
        }


        closeMobileSidebar();


        document
            .getElementById(
                'dropdownMenu'
            )
            ?.classList.remove(
                'show'
            );


        closePreview();
    }
);


/* =========================================================
   END
   ========================================================= */
