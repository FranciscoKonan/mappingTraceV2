/* =========================================================
   MappingTrace — Export Center
   Fitted to the current exports.html / exports.css
   ========================================================= */

const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'PASTE_YOUR_EXISTING_PUBLIC_ANON_KEY_HERE';

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


    document
        .getElementById('burgerBtn')
        ?.addEventListener(
            'click',
            toggleMobileSidebar
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
            () => toggleAllFilter(
                'supplier'
            )
        );


    document
        .getElementById('selectAllCooperatives')
        ?.addEventListener(
            'click',
            () => toggleAllFilter(
                'cooperative'
            )
        );


    document
        .getElementById('selectAllEnumerators')
        ?.addEventListener(
            'click',
            () => toggleAllFilter(
                'enumerator'
            )
        );


    document
        .getElementById('selectAllFieldOfficers')
        ?.addEventListener(
            'click',
            () => toggleAllFilter(
                'fieldOfficer'
            )
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
                    applyFilters
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


    updateProjectHeader();
}


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
                membership =>
                    `
                    <div
                        class="dropdown-item ${
                            membership.project_id ===
                            currentProject?.id
                                ? 'selected'
                                : ''
                        }"
                        data-project-id="${
                            escapeHtml(
                                membership.project_id
                            )
                        }"
                    >
                        ${escapeHtml(
                            membership.projects?.name ||
                            membership.project_id
                        )}
                    </div>
                    `
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


    updateProjectHeader();

    await loadMembers();

    await loadFarms();

    await loadExportHistory();

    updatePermissionUI();

    applyFilters();

    renderProjectDropdown();
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


/* =========================================================
   USER / MEMBERS
   ========================================================= */

async function loadMembers() {

    const {
        data,
        error
    } = await db
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


    if (ids.length) {

        const {
            data: profiles
        } = await db
            .from('user_profiles')
            .select(
                `
                id,
                first_name,
                last_name,
                email
                `
            )
            .in(
                'id',
                ids
            );


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


        members.forEach(
            member => {

                member.profile =
                    profileMap.get(
                        member.user_id
                    ) ||
                    null;
            }
        );
    }


    const ownMembership =
        members.find(
            member =>
                member.user_id ===
                currentUser.id
        );


    if (ownMembership) {

        currentMembership =
            ownMembership;
    }


    updateUserDisplay();
}


async function updateUserDisplay() {

    const profile =
        members.find(
            member =>
                member.user_id ===
                currentUser.id
        )?.profile;


    const name =
        [
            profile?.first_name,
            profile?.last_name
        ]
            .filter(Boolean)
            .join(' ') ||
        profile?.email ||
        currentUser.email ||
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


    const avatar =
        name
            .trim()
            .charAt(0)
            .toUpperCase() ||
        'U';


    setText(
        'userAvatar',
        avatar
    );
}


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


function userCanManageExportPermissions() {

    const role =
        String(
            currentMembership?.role ||
            ''
        )
            .toLowerCase();


    return MANAGEMENT_ROLES.includes(
        role
    );
}


function updatePermissionUI() {

    const allowed =
        userCanExport();


    const manager =
        userCanManageExportPermissions();


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


    const exportButton =
        document.getElementById(
            'exportBtn'
        );


    if (exportButton) {

        exportButton.disabled =
            !allowed;
    }


    const rejectedButton =
        document.getElementById(
            'rejectedAuditBtn'
        );


    if (rejectedButton) {

        rejectedButton.classList.toggle(
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


    if (manager) {

        renderPermissionList();
    }
}


function renderPermissionList() {

    const container =
        document.getElementById(
            'permissionList'
        );


    if (!container) {
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
                            .toLowerCase();


                    const automatic =
                        MANAGEMENT_ROLES.includes(
                            role
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
                                        ''
                                    )}
                                </div>

                            </div>

                            <div
                                class="permission-role"
                            >
                                ${escapeHtml(
                                    role.replaceAll(
                                        '_',
                                        ' '
                                    )
                                )}
                            </div>

                            <div>
                                ${
                                    automatic
                                        ? 'Automatic'
                                        : 'Project permission'
                                }
                            </div>

                            <div>

                                <input
                                    type="checkbox"
                                    data-user-id="${
                                        escapeHtml(
                                            member.user_id
                                        )
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
                    () =>
                        setExportPermission(
                            input.dataset.userId,
                            input.checked
                        )
                );
            }
        );
}


async function setExportPermission(
    userId,
    enabled
) {

    if (
        !userCanManageExportPermissions()
    ) {

        notify(
            'You are not authorized to manage export permissions.',
            'error'
        );

        return;
    }


    try {

        const {
            error
        } = await db.rpc(
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


        await loadMembers();

        updatePermissionUI();


        notify(
            enabled
                ? 'Export permission granted.'
                : 'Export permission revoked.',
            'success'
        );

    } catch (error) {

        console.error(error);

        notify(
            error.message ||
            'Could not update export permission.',
            'error'
        );
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
            <div
                class="empty-filter"
            >
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
   FILTERING
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


    const officers =
        getSelectedFilterValues(
            'fieldOfficer'
        );


    const workflowStates =
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


    const quality =
        getValue(
            'qualityFilter'
        ) ||
        'all';


    filteredFarms =
        farms.filter(
            farm => {

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


                if (
                    officers.length &&
                    !officers.includes(
                        String(
                            farm.field_officer_id
                        )
                    )
                ) {

                    return false;
                }


                if (
                    workflowStates.length &&
                    !workflowStates.includes(
                        farm.workflow_state
                    )
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
                    quality ===
                    'missing_geometry' &&
                    farm.geometry
                ) {

                    return false;
                }


                if (
                    quality ===
                    'rejection_reason' &&
                    !String(
                        farm.rejection_reason ||
                        ''
                    ).trim()
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


                const dateValue =
                    farm[
                        dateBasis
                    ] ||
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


    updateKPIs();

    updateFormatAvailability();

    renderPerformance();
}


function resetFilters() {

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

                checkbox.checked =
                    false;
            }
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


    const dateBasis =
        document.getElementById(
            'dateBasis'
        );


    if (dateBasis) {

        dateBasis.value =
            'created_at';
    }


    const quality =
        document.getElementById(
            'qualityFilter'
        );


    if (quality) {

        quality.value =
            'all';
    }


    renderFilterLists();

    applyFilters();

    selectFormat(
        'excel'
    );
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
        from.value =
            '';
    }


    if (to) {
        to.value =
            '';
    }


    applyFilters();
}


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
   KPIs
   ========================================================= */

function updateKPIs() {

    const total =
        filteredFarms.length;


    const area =
        filteredFarms.reduce(
            (
                totalArea,
                farm
            ) =>
                totalArea +
                farm.area,
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


    const pending =
        total -
        validated -
        rejected;


    const validationRate =
        total
            ? validated /
              total *
              100
            : 0;


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


    setText(
        'validationRate',
        `${validationRate.toFixed(1)}%`
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
        validated.toLocaleString()
    );


    setText(
        'filteredRejected',
        rejected.toLocaleString()
    );


    setText(
        'filteredInProgress',
        pending.toLocaleString()
    );


    setText(
        'filteredValidationRate',
        `${validationRate.toFixed(1)}%`
    );


    setText(
        'selectionNote',
        `${total.toLocaleString()} record${
            total === 1
                ? ''
                : 's'
        } selected`
    );
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


    const map =
        new Map();


    filteredFarms.forEach(
        farm => {

            const key =
                farm.enumerator_id ||
                'unassigned';


            if (!map.has(key)) {

                map.set(
                    key,
                    {

                        name:
                            personName(
                                farm.enumerator_id
                            ),

                        mapped:
                            0,

                        submitted:
                            0,

                        validated:
                            0,

                        rejected:
                            0,

                        correction:
                            0,

                        pending:
                            0
                    }
                );
            }


            const row =
                map.get(
                    key
                );


            row.mapped++;


            if (
                farm.workflow_state ===
                'submitted'
            ) {

                row.submitted++;
            }


            if (
                farm.workflow_state ===
                'validated'
            ) {

                row.validated++;
            }


            if (
                farm.workflow_state ===
                'rejected'
            ) {

                row.rejected++;
            }


            if (
                farm.workflow_state ===
                'correction_required'
            ) {

                row.correction++;
            }


            if (
                ![
                    'validated',
                    'rejected'
                ]
                    .includes(
                        farm.workflow_state
                    )
            ) {

                row.pending++;
            }
        }
    );


    const rows =
        [
            ...map.values()
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.mapped -
                    a.mapped
            );


    if (!rows.length) {

        body.innerHTML =
            `
            <tr>
                <td colspan="8">
                    No matching enumerator data.
                </td>
            </tr>
            `;

        return;
    }


    body.innerHTML =
        rows
            .map(
                row => {

                    const rate =
                        row.mapped
                            ? row.validated /
                              row.mapped *
                              100
                            : 0;


                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    row.name
                                )}
                            </td>

                            <td>
                                ${row.mapped}
                            </td>

                            <td>
                                ${row.submitted}
                            </td>

                            <td>
                                ${row.validated}
                            </td>

                            <td>
                                ${row.rejected}
                            </td>

                            <td>
                                ${row.correction}
                            </td>

                            <td>
                                ${row.pending}
                            </td>

                            <td
                                class="${rateClass(
                                    rate
                                )}"
                            >
                                ${rate.toFixed(1)}%
                            </td>

                        </tr>
                    `;
                }
            )
            .join('');
}


function renderCooperativePerformance() {

    const body =
        document.getElementById(
            'cooperativePerformanceBody'
        );


    if (!body) {
        return;
    }


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

                        name:
                            key,

                        farms:
                            0,

                        area:
                            0,

                        validated:
                            0,

                        rejected:
                            0,

                        correction:
                            0,

                        pending:
                            0
                    }
                );
            }


            const row =
                map.get(
                    key
                );


            row.farms++;

            row.area +=
                farm.area;


            if (
                farm.workflow_state ===
                'validated'
            ) {

                row.validated++;
            }


            if (
                farm.workflow_state ===
                'rejected'
            ) {

                row.rejected++;
            }


            if (
                farm.workflow_state ===
                'correction_required'
            ) {

                row.correction++;
            }


            if (
                ![
                    'validated',
                    'rejected'
                ]
                    .includes(
                        farm.workflow_state
                    )
            ) {

                row.pending++;
            }
        }
    );


    const rows =
        [
            ...map.values()
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.validated -
                    a.validated
            );


    if (!rows.length) {

        body.innerHTML =
            `
            <tr>
                <td colspan="8">
                    No matching cooperative data.
                </td>
            </tr>
            `;

        return;
    }


    body.innerHTML =
        rows
            .map(
                row => {

                    const rate =
                        row.farms
                            ? row.validated /
                              row.farms *
                              100
                            : 0;


                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    row.name
                                )}
                            </td>

                            <td>
                                ${row.farms}
                            </td>

                            <td>
                                ${row.area.toFixed(
                                    2
                                )}
                            </td>

                            <td>
                                ${row.validated}
                            </td>

                            <td>
                                ${row.rejected}
                            </td>

                            <td>
                                ${row.correction}
                            </td>

                            <td>
                                ${row.pending}
                            </td>

                            <td
                                class="${rateClass(
                                    rate
                                )}"
                            >
                                ${rate.toFixed(1)}%
                            </td>

                        </tr>
                    `;
                }
            )
            .join('');
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
                                totalArea,
                                farm
                            ) =>
                                totalArea +
                                farm.area,
                            0
                        );


                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    label
                                )}
                            </td>

                            <td>
                                ${rows.length}
                            </td>

                            <td>
                                ${area.toFixed(
                                    2
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join('');
}


function renderHighlights() {

    const rows =
        buildEnumeratorStats();


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
        [
            ...rows
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.rate -
                    a.rate
            )[0];


    const workload =
        [
            ...rows
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    b.mapped -
                    a.mapped
            )[0];


    const correction =
        [
            ...rows
        ]
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
        `${top.name} · ${top.rate.toFixed(
            1
        )}%`
    );


    setText(
        'highestWorkload',
        `${workload.name} · ${workload.mapped} farms`
    );


    setText(
        'highestCorrection',
        `${correction.name} · ${correction.correctionRate.toFixed(
            1
        )}%`
    );
}


function buildEnumeratorStats() {

    const map =
        new Map();


    filteredFarms.forEach(
        farm => {

            const key =
                farm.enumerator_id ||
                'unassigned';


            if (!map.has(key)) {

                map.set(
                    key,
                    {

                        name:
                            personName(
                                farm.enumerator_id
                            ),

                        mapped:
                            0,

                        validated:
                            0,

                        correction:
                            0
                    }
                );
            }


            const row =
                map.get(
                    key
                );


            row.mapped++;


            if (
                farm.workflow_state ===
                'validated'
            ) {

                row.validated++;
            }


            if (
                farm.workflow_state ===
                'correction_required'
            ) {

                row.correction++;
            }
        }
    );


    return [
        ...map.values()
    ]
        .map(
            row => ({

                ...row,

                rate:
                    row.mapped
                        ? row.validated /
                          row.mapped *
                          100
                        : 0,

                correctionRate:
                    row.mapped
                        ? row.correction /
                          row.mapped *
                          100
                        : 0
            })
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
            element => {

                element.classList.toggle(
                    'active',
                    element.dataset.tab ===
                    tab
                );
            }
        );


    const enumerators =
        document.getElementById(
            'enumeratorPerformance'
        );


    const cooperatives =
        document.getElementById(
            'cooperativePerformance'
        );


    const workflow =
        document.getElementById(
            'workflowPerformance'
        );


    enumerators
        ?.classList.toggle(
            'hidden',
            tab !== 'enumerators'
        );


    cooperatives
        ?.classList.toggle(
            'hidden',
            tab !== 'cooperatives'
        );


    workflow
        ?.classList.toggle(
            'hidden',
            tab !== 'workflow'
        );
}


function rateClass(
    rate
) {

    if (rate >= 80) {
        return 'rate-good';
    }


    if (rate >= 60) {
        return 'rate-warning';
    }


    return 'rate-bad';
}


/* =========================================================
   EXPORT FORMAT
   ========================================================= */

function selectFormat(
    format
) {

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
            'GeoJSON and KMZ are available only when all selected records are Validated or Rejected.',
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


function isGeoExportAllowed() {

    return (
        filteredFarms.length > 0 &&
        filteredFarms.every(
            farm =>
                [
                    'validated',
                    'rejected'
                ]
                    .includes(
                        farm.workflow_state
                    )
        )
    );
}


function updateFormatAvailability() {

    const geoAllowed =
        isGeoExportAllowed();


    document
        .querySelectorAll(
            '.format-option'
        )
        .forEach(
            option => {

                const restricted =
                    [
                        'geojson',
                        'kmz'
                    ]
                        .includes(
                            option.dataset.format
                        );


                option.classList.toggle(
                    'disabled',
                    restricted &&
                    !geoAllowed
                );


                option.title =
                    restricted &&
                    !geoAllowed
                        ? 'Available only for Validated and Rejected records'
                        : '';
            }
        );


    const help =
        document.getElementById(
            'formatHelp'
        );


    if (help) {

        help.textContent =
            geoAllowed

                ? 'Validated and Rejected plots can be exported as Excel, GeoJSON, KMZ or Progress Report.'

                : 'Excel and Progress Report are available for all workflow stages. GeoJSON/KMZ require only Validated or Rejected plots.';
    }


    if (
        (
            selectedFormat ===
            'geojson' ||
            selectedFormat ===
            'kmz'
        ) &&
        !geoAllowed
    ) {

        selectFormat(
            'excel'
        );
    }
}


/* =========================================================
   MAIN EXPORT
   ========================================================= */

async function generateExport() {

    if (!userCanExport()) {

        notify(
            'You do not have export permission for this project.',
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

                exportExcel(
                    filteredFarms,
                    'MappingTrace_Export'
                );

                break;


            case 'geojson':

                if (
                    !isGeoExportAllowed()
                ) {

                    throw new Error(
                        'GeoJSON requires Validated or Rejected records only.'
                    );
                }


                exportGeoJSON(
                    filteredFarms
                );

                break;


            case 'kmz':

                if (
                    !isGeoExportAllowed()
                ) {

                    throw new Error(
                        'KMZ requires Validated or Rejected records only.'
                    );
                }


                await exportKMZ(
                    filteredFarms
                );

                break;


            case 'report':

                exportProgressReport(
                    filteredFarms
                );

                break;


            default:

                throw new Error(
                    'Unknown export format.'
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
    filenamePrefix
) {

    if (!window.XLSX) {

        throw new Error(
            'XLSX library is not loaded.'
        );
    }


    if (!window.saveAs) {

        throw new Error(
            'FileSaver library is not loaded.'
        );
    }


    const workbook =
        XLSX.utils.book_new();


    const farmSheet =
        XLSX.utils.json_to_sheet(
            rows.map(
                exportRow
            )
        );


    XLSX.utils.book_append_sheet(
        workbook,
        farmSheet,
        'Farms'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            enumeratorStatsForExport()
        ),
        'Enumerators'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            cooperativeStatsForExport()
        ),
        'Cooperatives'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            workflowStatsForExport()
        ),
        'Workflow'
    );


    XLSX.writeFile(
        workbook,
        `${filenamePrefix}_${safeName(
            currentProject.name
        )}_${dateStamp()}.xlsx`
    );
}


function exportProgressReport(
    rows
) {

    if (!window.XLSX) {

        throw new Error(
            'XLSX library is not loaded.'
        );
    }


    const total =
        rows.length;


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


    const area =
        rows.reduce(
            (
                totalArea,
                farm
            ) =>
                totalArea +
                farm.area,
            0
        );


    const workbook =
        XLSX.utils.book_new();


    const summary = [

        {
            Metric:
                'Project',

            Value:
                currentProject.name ||
                ''
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
                'Selected farms',

            Value:
                total
        },

        {
            Metric:
                'Selected area (ha)',

            Value:
                area.toFixed(2)
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
                'In progress',

            Value:
                total -
                validated -
                rejected
        },

        {
            Metric:
                'Validation rate',

            Value:
                total
                    ? `${(
                        validated /
                        total *
                        100
                    ).toFixed(1)}%`
                    : '0.0%'
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
            enumeratorStatsForExport()
        ),
        'Enumerators'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            cooperativeStatsForExport()
        ),
        'Cooperatives'
    );


    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
            workflowStatsForExport()
        ),
        'Workflow'
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

                    properties:
                        exportRow(
                            farm
                        ),

                    geometry:
                        stripZ(
                            farm.geometry
                        )
                })
            );


    if (!features.length) {

        throw new Error(
            'No valid geometry is available in the selected records.'
        );
    }


    const geojson = {

        type:
            'FeatureCollection',

        features:
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
                    'application/geo+json;charset=utf-8'
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
        await zip.generateAsync(
            {
                type:
                    'blob',

                compression:
                    'DEFLATE'
            }
        );


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


    return `
<Placemark>

<name>
${escapeXml(
    farm.farm_id ||
    farm.farmer_name ||
    'Farm'
)}
</name>

<description><![CDATA[
Farmer: ${escapeXml(
    farm.farmer_name ||
    ''
)}<br>
Cooperative: ${escapeXml(
    farm.cooperative ||
    ''
)}<br>
Enumerator: ${escapeXml(
    personName(
        farm.enumerator_id
    )
)}<br>
Field Officer: ${escapeXml(
    personName(
        farm.field_officer_id
    )
)}<br>
Area: ${farm.area.toFixed(
    2
)} ha<br>
Workflow: ${escapeXml(
    WORKFLOW[
        farm.workflow_state
    ] ||
    farm.workflow_state ||
    ''
)}<br>
Rejection reason: ${escapeXml(
    farm.rejection_reason ||
    ''
)}
]]></description>

${geometryToKML(
    geometry
)}

</Placemark>
`;
}


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
${geometry.coordinates[0]},
${geometry.coordinates[1]},
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

    if (
        !coordinates ||
        !coordinates.length
    ) {

        return '';
    }


    const outer =
        coordinates[0]
            .map(
                point =>
                    `${point[0]},${point[1]},0`
            )
            .join(' ');


    const holes =
        coordinates
            .slice(1)
            .map(
                ring => `
<innerBoundaryIs>
<LinearRing>
<coordinates>
${ring
    .map(
        point =>
            `${point[0]},${point[1]},0`
    )
    .join(' ')}
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
${outer}
</coordinates>
</LinearRing>
</outerBoundaryIs>

${holes}

</Polygon>
`;
}


/* =========================================================
   EXPORT ROW
   ========================================================= */

function exportRow(
    farm
) {

    return {

        'Farm ID':
            farm.farm_id ||
            '',

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
            WORKFLOW[
                farm.workflow_state
            ] ||
            farm.workflow_state ||
            '',

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


function enumeratorStatsForExport() {

    return buildEnumeratorStats()
        .map(
            row => ({

                Enumerator:
                    row.name,

                Mapped:
                    row.mapped,

                Validated:
                    row.validated,

                Correction:
                    row.correction,

                'Validation Rate':
                    `${row.rate.toFixed(
                        1
                    )}%`,

                'Correction Rate':
                    `${row.correctionRate.toFixed(
                        1
                    )}%`
            })
        );
}


function cooperativeStatsForExport() {

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

                        Correction:
                            0,

                        Pending:
                            0
                    }
                );
            }


            const row =
                map.get(
                    key
                );


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

                row.Correction++;
            }


            if (
                ![
                    'validated',
                    'rejected'
                ]
                    .includes(
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
                        ].toFixed(
                            2
                        )
                    ),

                'Validation Rate':
                    `${row.Farms
                        ? (
                            row.Validated /
                            row.Farms *
                            100
                        ).toFixed(1)
                        : '0.0'}%`
            })
        );
}


function workflowStatsForExport() {

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

                const rows =
                    filteredFarms.filter(
                        farm =>
                            farm.workflow_state ===
                            state
                    );


                return {

                    'Workflow Stage':
                        label,

                    Farms:
                        rows.length,

                    'Area (ha)':
                        Number(
                            rows
                                .reduce(
                                    (
                                        totalArea,
                                        farm
                                    ) =>
                                        totalArea +
                                        farm.area,
                                    0
                                )
                                .toFixed(
                                    2
                                )
                        )
                };
            }
        );
}


/* =========================================================
   PREVIEW
   ========================================================= */

function previewExport() {

    if (!userCanExport()) {

        notify(
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

        notify(
            'Preview section is not available in the current HTML.',
            'warning'
        );

        return;
    }


    header.innerHTML =
        `
        <tr>

            <th>
                Farm ID
            </th>

            <th>
                Farmer
            </th>

            <th>
                Cooperative
            </th>

            <th>
                Enumerator
            </th>

            <th>
                Area (ha)
            </th>

            <th>
                Workflow
            </th>

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
                                WORKFLOW[
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


    section.classList.remove(
        'hidden'
    );


    section.style.display =
        'block';


    section.scrollIntoView(
        {
            behavior:
                'smooth',

            block:
                'nearest'
        }
    );
}


function hidePreview() {

    const section =
        document.getElementById(
            'previewSection'
        );


    if (section) {

        section.classList.add(
            'hidden'
        );


        section.style.display =
            'none';
    }
}


window.hidePreview =
    hidePreview;


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
        } = await db
            .from(
                'export_history'
            )
            .insert(
                {

                    project_id:
                        currentProject.id,

                    user_id:
                        currentUser.id,

                    format:
                        format,

                    record_count:
                        count
                }
            );


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
        } = await db
            .from(
                'export_history'
            )
            .select(
                `
                created_at,
                format,
                record_count,
                user_id
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
            throw error;
        }


        if (!data?.length) {

            container.innerHTML =
                `
                <div
                    class="empty-history"
                >

                    <i
                        class="fas fa-box-open"
                    ></i>

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
                    row => `
                        <div
                            class="history-row"
                        >

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        formatLabel(
                                            row.format
                                        )
                                    )}
                                </strong>

                                <span>
                                    ${Number(
                                        row.record_count ||
                                        0
                                    ).toLocaleString()}
                                    records
                                </span>

                            </div>

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        personName(
                                            row.user_id
                                        )
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        new Date(
                                            row.created_at
                                        )
                                            .toLocaleString()
                                    )}
                                </span>

                            </div>

                        </div>
                    `
                )
                .join('');

    } catch (error) {

        console.warn(
            'Could not load export history:',
            error
        );


        container.innerHTML =
            `
            <div
                class="empty-history"
            >

                <i
                    class="fas fa-exclamation-circle"
                ></i>

                <p>
                    Export history unavailable
                </p>

            </div>
            `;
    }
}


/* =========================================================
   SIDEBAR
   ========================================================= */

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
        ?.classList.toggle(
            'mobile-open'
        );


    document
        .getElementById(
            'sidebarOverlay'
        )
        ?.classList.toggle(
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


/* =========================================================
   REFRESH / LOGOUT
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
            'Export data refreshed.',
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

        await db.auth.signOut();

    } finally {

        window.location.href =
            '../login.html';
    }
}


/* =========================================================
   HELPERS
   ========================================================= */

function getValue(
    id
) {

    return (
        document
            .getElementById(
                id
            )
            ?.value ||
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


function unique(
    values
) {

    return [
        ...new Set(
            values
                .map(
                    value =>
                        String(
                            value ??
                            ''
                        )
                            .trim()
                )
                .filter(Boolean)
        )
    ]
        .sort(
            (
                a,
                b
            ) =>
                a.localeCompare(
                    b
                )
        );
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


    if (!profile) {

        return userId;
    }


    return (
        [
            profile.first_name,
            profile.last_name
        ]
            .filter(Boolean)
            .join(' ') ||
        profile.email ||
        userId
    );
}


function parseGeometry(
    value
) {

    if (!value) {

        return null;
    }


    if (
        typeof value ===
        'object'
    ) {

        if (
            value.type ===
            'Feature'
        ) {

            return value.geometry;
        }


        return value;
    }


    try {

        const parsed =
            JSON.parse(
                value
            );


        if (
            parsed.type ===
            'Feature'
        ) {

            return parsed.geometry;
        }


        return parsed;

    } catch {

        return null;
    }
}


function stripZ(
    geometry
) {

    if (!geometry) {

        return null;
    }


    function cleanCoordinates(
        coordinates
    ) {

        if (
            !Array.isArray(
                coordinates
            )
        ) {

            return coordinates;
        }


        if (
            typeof coordinates[0] ===
            'number'
        ) {

            return coordinates.slice(
                0,
                2
            );
        }


        return coordinates.map(
            cleanCoordinates
        );
    }


    return {

        ...geometry,

        coordinates:
            cleanCoordinates(
                geometry.coordinates
            )
    };
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


function formatLabel(
    value
) {

    return String(
        value ||
        ''
    )
        .replaceAll(
            '_',
            ' '
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
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

                })[
                    character
                ]
        );
}


function escapeXml(
    value
) {

    return String(
        value ??
        ''
    )
        .replace(
            /[<>&'"]/g,
            character =>
                ({

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

                })[
                    character
                ]
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


function notify(
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
                        : type ===
                          'warning'
                            ? '#fef3c7'
                            : '#e0f2fe',

            color:
                type ===
                'error'
                    ? '#991b1b'
                    : type ===
                      'success'
                        ? '#166534'
                        : type ===
                          'warning'
                            ? '#92400e'
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
