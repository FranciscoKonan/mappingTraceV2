// ===========================================
// SIDEBAR TOGGLE LOGIC
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

        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-left';
        }

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

window.toggleMobileSidebar = toggleSidebar;
window.closeMobileSidebar = closeMobileSidebar;

burgerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
});

sidebarToggle.addEventListener('click', function (e) {
    e.stopPropagation();

    if (window.innerWidth > 768) {
        toggleSidebar();
    }
});

sidebarOverlay.addEventListener(
    'click',
    closeMobileSidebar
);

if (window.innerWidth > 768) {
    const saved =
        localStorage.getItem('sidebarCollapsed');

    if (saved === 'true') {
        sidebar.classList.add('collapsed');

        sidebarToggle.querySelector('i').className =
            'fas fa-chevron-right';
    }
}

window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
        closeMobileSidebar();
    }
});


// ===========================================
// QUALITY ALERTS
// ===========================================
console.log(
    '🚀 Quality Alerts page initializing...'
);


// ===========================================
// SUPABASE CONFIGURATION
// ===========================================
const SUPABASE_URL =
    'https://crvnohvudurqfukjpisv.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI6IkNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';


// ===========================================
// GLOBAL VARIABLES
// ===========================================
let supabaseClient = null;

let currentUser = null;
let currentProject = null;
let currentProjectRole = null;

let allUserProjects = [];

let allFarms = [];
let protectedAreas = [];

let protectedAlerts = [];
let filteredProtectedAlerts = [];
let protectedPage = 1;

let polygonAlerts = [];
let filteredPolygonAlerts = [];
let polygonPage = 1;

const rowsPerPage = 10;

let currentMap = null;


// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener(
    'DOMContentLoaded',
    async function () {

        console.log(
            '📌 DOM Content Loaded'
        );

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

        await loadUserAndProjects();

        setupDropdown();

        setupEventListeners();
    }
);


// ===========================================
// LOAD USER + PROJECTS
// ===========================================
async function loadUserAndProjects() {

    showLoading(true);

    const {
        data: { session }
    } =
        await supabaseClient.auth.getSession();

    if (!session) {

        window.location.href =
            '../login.html';

        return;
    }

    currentUser =
        session.user;


    // -----------------------------------------
    // USER PROFILE
    // -----------------------------------------
    const { data: profile } =
        await supabaseClient
            .from('user_profiles')
            .select(
                'first_name, email'
            )
            .eq(
                'id',
                currentUser.id
            )
            .maybeSingle();

    const firstName =
        profile?.first_name || '';

    const displayName =
        firstName ||
        currentUser.email.split('@')[0];

    const userName =
        document.getElementById(
            'userName'
        );

    const userAvatar =
        document.getElementById(
            'userAvatar'
        );

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


    // -----------------------------------------
    // PROJECT MEMBERSHIPS
    // -----------------------------------------
    const {
        data: memberships
    } =
        await supabaseClient
            .from('project_members')
            .select(
                'project_id, role, projects(*)'
            )
            .eq(
                'user_id',
                currentUser.id
            )
            .eq(
                'status',
                'active'
            );


    if (
        memberships &&
        memberships.length > 0
    ) {

        allUserProjects =
            memberships;


        currentProjectRole =
            memberships[0].role;

        window.currentProjectRole =
            currentProjectRole;


        const userRole =
            document.getElementById(
                'userRole'
            );

        if (userRole) {
            userRole.textContent =
                memberships[0]
                    .role
                    .replace('_', ' ')
                    .toUpperCase();
        }


        // -------------------------------------
        // ROLE BADGE
        // -------------------------------------
        const roleBadge =
            document.createElement('span');

        roleBadge.className =
            `role-badge ${memberships[0].role}`;

        roleBadge.textContent =
            memberships[0]
                .role
                .toUpperCase();

        const userInfo =
            document.querySelector(
                '.user-info'
            );

        const syncBtn =
            document.querySelector(
                '.sync-btn'
            );

        if (
            userInfo &&
            syncBtn
        ) {
            userInfo.insertBefore(
                roleBadge,
                syncBtn
            );
        }


        // -------------------------------------
        // PROJECT FROM URL
        // -------------------------------------
        const urlParams =
            new URLSearchParams(
                window.location.search
            );

        const projectIdFromUrl =
            urlParams.get(
                'project'
            );

        let targetProject = null;


        if (
            projectIdFromUrl &&
            projectIdFromUrl !== 'all'
        ) {

            targetProject =
                memberships.find(
                    m =>
                        m.projects?.id ===
                        projectIdFromUrl
                );
        }


        // -------------------------------------
        // LAST PROJECT
        // -------------------------------------
        if (!targetProject) {

            const lastViewed =
                localStorage.getItem(
                    `lastProject_${currentUser.id}`
                );

            if (lastViewed) {

                targetProject =
                    memberships.find(
                        m =>
                            m.projects?.id ===
                            lastViewed
                    );
            }
        }


        // -------------------------------------
        // DEFAULT PROJECT
        // -------------------------------------
        if (!targetProject) {
            targetProject =
                memberships[0];
        }


        // -------------------------------------
        // PROJECT SELECTOR
        // -------------------------------------
        const isOwner =
            memberships.some(
                m =>
                    m.role === 'owner'
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


        // -------------------------------------
        // SET CURRENT PROJECT
        // -------------------------------------
        currentProject =
            targetProject.projects;


        window.currentProject =
            currentProject;


        const projectName =
            document.getElementById(
                'selectedProjectName'
            );

        if (projectName) {
            projectName.innerHTML =
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


        console.log(
            '📁 Loading project:',
            currentProject.id,
            currentProject.name
        );


        // -------------------------------------
        // LOAD DATA
        // -------------------------------------
        await Promise.all([
            loadFarms(
                currentProject.id
            ),
            loadProtectedAreas(
                currentProject.id
            )
        ]);


        generateAlerts();

        renderQualityQueue();


        localStorage.setItem(
            `lastProject_${currentUser.id}`,
            currentProject.id
        );


        const url =
            new URL(window.location);

        url.searchParams.set(
            'project',
            currentProject.id
        );

        window.history.replaceState(
            {},
            '',
            url
        );
    }


    showLoading(false);
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

    if (!container) {
        return;
    }


    let html =
        `<div class="dropdown-item"
              data-value="all">
              📊 ALL PROJECTS
          </div>`;


    for (
        const m of memberships
    ) {

        html += `
            <div
                class="dropdown-item"
                data-value="${escapeHtml(
                    m.projects.id
                )}"
            >
                📁 ${escapeHtml(
                    m.projects.name
                )}
            </div>
        `;
    }


    container.innerHTML =
        html;


    document
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
                            'selectedProjectName'
                        )
                        .innerHTML =
                        value === 'all'
                            ? '📊 ALL PROJECTS'
                            : `📁 ${escapeHtml(
                                item.textContent
                                    .slice(2)
                                    .trim()
                            )}`;


                    document
                        .getElementById(
                            'dropdownMenu'
                        )
                        .classList
                        .remove(
                            'show'
                        );


                    if (
                        value ===
                        'all'
                    ) {

                        await loadAllProjectsData();

                    } else {

                        const selected =
                            allUserProjects.find(
                                p =>
                                    p.projects.id ===
                                    value
                            );


                        if (selected) {

                            currentProject =
                                selected.projects;

                            window.currentProject =
                                currentProject;


                            document
                                .getElementById(
                                    'projectBadge'
                                )
                                .textContent =
                                currentProject.name;


                            currentProjectRole =
                                selected.role;

                            window.currentProjectRole =
                                currentProjectRole;


                            await Promise.all([
                                loadFarms(
                                    value
                                ),
                                loadProtectedAreas(
                                    value
                                )
                            ]);


                            generateAlerts();

                            renderQualityQueue();


                            localStorage.setItem(
                                `lastProject_${currentUser.id}`,
                                value
                            );
                        }
                    }


                    const url =
                        new URL(
                            window.location
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
// DROPDOWN SETUP
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


    if (
        !selected ||
        !menu ||
        !search
    ) {
        return;
    }


    selected.addEventListener(
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

                search.value =
                    '';

                filterDropdown('');

                search.focus();
            }
        }
    );


    search.addEventListener(
        'input',
        e =>
            filterDropdown(
                e.target.value
                    .toLowerCase()
            )
    );


    document.addEventListener(
        'click',
        () =>
            menu.classList.remove(
                'show'
            )
    );
}


function filterDropdown(term) {

    document
        .querySelectorAll(
            '.dropdown-item'
        )
        .forEach(
            item => {

                item.style.display =
                    item.textContent
                        .toLowerCase()
                        .includes(term)
                        ? 'block'
                        : 'none';
            }
        );
}


// ===========================================
// LOAD ALL PROJECTS
// ===========================================
async function loadAllProjectsData() {

    showLoading(true);

    let allFarmsData = [];
    let allProtectedData = [];


    for (
        const m of allUserProjects
    ) {

        const {
            data: farms
        } =
            await supabaseClient
                .from('farms')
                .select('*')
                .eq(
                    'project_id',
                    m.projects.id
                );


        if (farms) {

            allFarmsData =
                allFarmsData.concat(
                    farms
                );
        }


        const {
            data: protectedData
        } =
            await supabaseClient
                .from('protected_areas')
                .select('*')
                .eq(
                    'project_id',
                    m.projects.id
                );


        if (protectedData) {

            allProtectedData =
                allProtectedData.concat(
                    protectedData
                );
        }
    }


    allFarms =
        allFarmsData;

    protectedAreas =
        allProtectedData;


    generateAlerts();

    renderQualityQueue();

    showLoading(false);
}


// ===========================================
// LOAD FARMS
// ===========================================
async function loadFarms(
    projectId
) {

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

        console.error(
            'Error loading farms:',
            error
        );

        allFarms = [];

        return;
    }


    allFarms =
        data || [];


    window.farmsData =
        allFarms;


    console.log(
        `✅ Loaded ${allFarms.length} farms`
    );
}


// ===========================================
// LOAD PROTECTED AREAS
// ===========================================
async function loadProtectedAreas(
    projectId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from('protected_areas')
            .select('*')
            .eq(
                'project_id',
                projectId
            );


    if (error) {

        console.error(
            'Error loading protected areas:',
            error
        );

        protectedAreas = [];

        return;
    }


    protectedAreas =
        data || [];


    console.log(
        `✅ Loaded ${protectedAreas.length} protected areas`
    );
}


// ===========================================
// GENERATE ALERTS
// ===========================================
function generateAlerts() {

    protectedAlerts = [];

    polygonAlerts = [];


    const farmsWithGeo =
        allFarms.filter(
            farm =>
                farm.geometry &&
                farm.geometry.coordinates
        );


    // -----------------------------------------
    // 1. INVALID GEOMETRY
    // -----------------------------------------
    allFarms.forEach(
        farm => {

            if (
                !farm.geometry ||
                !farm.geometry.coordinates
            ) {

                polygonAlerts.push({
                    id:
                        `invalid_geom_${farm.id}`,

                    type:
                        'self_intersection',

                    severity:
                        'critical',

                    title:
                        'Invalid Geometry',

                    description:
                        `Farm "${
                            farm.farmer_name ||
                            'Unknown'
                        }" has invalid geometry.`,

                    farm:
                        farm,

                    supplier:
                        farm.supplier ||
                        'Unknown',

                    cooperative:
                        farm.cooperative ||
                        'Unassigned',

                    status:
                        'new',

                    date:
                        new Date().toISOString()
                });

                return;
            }


            try {

                if (
                    typeof turf !==
                    'undefined'
                ) {

                    const feature =
                        turf.feature(
                            farm.geometry
                        );

                    if (
                        !turf.booleanValid(
                            feature
                        )
                    ) {

                        polygonAlerts.push({
                            id:
                                `self_intersection_${farm.id}`,

                            type:
                                'self_intersection',

                            severity:
                                'critical',

                            title:
                                'Invalid Geometry',

                            description:
                                `Farm "${
                                    farm.farmer_name ||
                                    'Unknown'
                                }" has invalid geometry.`,

                            farm:
                                farm,

                            supplier:
                                farm.supplier ||
                                'Unknown',

                            cooperative:
                                farm.cooperative ||
                                'Unassigned',

                            status:
                                'new',

                            date:
                                new Date().toISOString()
                        });
                    }

                }

            } catch (e) {

                polygonAlerts.push({
                    id:
                        `invalid_geom_${farm.id}`,

                    type:
                        'self_intersection',

                    severity:
                        'critical',

                    title:
                        'Invalid Geometry',

                    description:
                        `Farm "${
                            farm.farmer_name ||
                            'Unknown'
                        }" has invalid geometry.`,

                    farm:
                        farm,

                    supplier:
                        farm.supplier ||
                        'Unknown',

                    cooperative:
                        farm.cooperative ||
                        'Unassigned',

                    status:
                        'new',

                    date:
                        new Date().toISOString()
                });
            }
        }
    );


    // -----------------------------------------
    // 2. DUPLICATE FARMER IDS
    // -----------------------------------------
    const seenIds = {};


    allFarms.forEach(
        farm => {

            if (!farm.farmer_id) {
                return;
            }


            if (
                seenIds[
                    farm.farmer_id
                ]
            ) {

                if (
                    !polygonAlerts.some(
                        a =>
                            a.farm?.id ===
                            farm.id &&
                            a.type ===
                            'duplicate'
                    )
                ) {

                    polygonAlerts.push({

                        id:
                            `duplicate_${farm.id}`,

                        type:
                            'duplicate',

                        severity:
                            'high',

                        title:
                            'Duplicate Farmer ID',

                        description:
                            `Farmer ID "${
                                farm.farmer_id
                            }" appears in multiple farms.`,

                        farm:
                            farm,

                        supplier:
                            farm.supplier ||
                            'Unknown',

                        cooperative:
                            farm.cooperative ||
                            'Unassigned',

                        duplicateId:
                            farm.farmer_id,

                        status:
                            'new',

                        date:
                            new Date().toISOString()
                    });
                }
            }


            seenIds[
                farm.farmer_id
            ] = true;
        }
    );


    // -----------------------------------------
    // 3. FARM OVERLAPS
    // -----------------------------------------
    for (
        let i = 0;
        i < farmsWithGeo.length;
        i++
    ) {

        for (
            let j = i + 1;
            j < farmsWithGeo.length;
            j++
        ) {

            const farm1 =
                farmsWithGeo[i];

            const farm2 =
                farmsWithGeo[j];


            try {

                const poly1 =
                    turf.polygon(
                        farm1.geometry.coordinates
                    );

                const poly2 =
                    turf.polygon(
                        farm2.geometry.coordinates
                    );


                if (
                    turf.booleanIntersects(
                        poly1,
                        poly2
                    )
                ) {

                    const intersection =
                        turf.intersect(
                            poly1,
                            poly2
                        );


                    if (intersection) {

                        const overlapAreaHa =
                            turf.area(
                                intersection
                            ) / 10000;


                        if (
                            overlapAreaHa >
                            0.01
                        ) {

                            let severity =
                                'low';


                            if (
                                overlapAreaHa >
                                5
                            ) {

                                severity =
                                    'critical';

                            } else if (
                                overlapAreaHa >=
                                3
                            ) {

                                severity =
                                    'high';

                            } else if (
                                overlapAreaHa >
                                1
                            ) {

                                severity =
                                    'medium';
                            }


                            polygonAlerts.push({

                                id:
                                    `overlap_${farm1.id}_${farm2.id}`,

                                type:
                                    'overlap',

                                severity:
                                    severity,

                                title:
                                    `${severity.toUpperCase()} Overlap Detected`,

                                description:
                                    `Farm "${
                                        farm1.farmer_name ||
                                        'Unknown'
                                    }" overlaps with "${
                                        farm2.farmer_name ||
                                        'Unknown'
                                    }" by ${
                                        overlapAreaHa.toFixed(
                                            2
                                        )
                                    } ha`,

                                farm1:
                                    farm1,

                                farm2:
                                    farm2,

                                overlapArea:
                                    overlapAreaHa,

                                intersectionGeo:
                                    intersection
                                        .geometry
                                        .coordinates,

                                supplier:
                                    farm1.supplier ||
                                    'Unknown',

                                cooperative:
                                    farm1.cooperative ||
                                    'Unassigned',

                                status:
                                    'new',

                                date:
                                    new Date().toISOString()
                            });
                        }
                    }
                }

            } catch (e) {

                console.warn(
                    'Overlap check failed:',
                    e
                );
            }
        }
    }


    // -----------------------------------------
    // 4. PROTECTED AREA INTERSECTIONS
    // -----------------------------------------
    if (
        typeof turf !==
        'undefined'
    ) {

        allFarms.forEach(
            farm => {

                if (
                    !farm.geometry ||
                    !farm.geometry.coordinates
                ) {
                    return;
                }


                protectedAreas.forEach(
                    area => {

                        if (
                            !area.geometry ||
                            !area.geometry.coordinates
                        ) {
                            return;
                        }


                        try {

                            const farmFeature =
                                turf.feature(
                                    farm.geometry
                                );

                            const areaFeature =
                                turf.feature(
                                    area.geometry
                                );


                            if (
                                turf.booleanIntersects(
                                    farmFeature,
                                    areaFeature
                                )
                            ) {

                                const intersection =
                                    turf.intersect(
                                        farmFeature,
                                        areaFeature
                                    );


                                if (
                                    intersection
                                ) {

                                    const areaHa =
                                        turf.area(
                                            intersection
                                        ) / 10000;


                                    if (
                                        areaHa >
                                        0.01
                                    ) {

                                        let severity =
                                            'medium';


                                        if (
                                            areaHa >
                                            5
                                        ) {

                                            severity =
                                                'critical';

                                        } else if (
                                            areaHa >=
                                            3
                                        ) {

                                            severity =
                                                'high';

                                        } else if (
                                            areaHa >
                                            1
                                        ) {

                                            severity =
                                                'medium';
                                        }


                                        protectedAlerts.push({

                                            id:
                                                `protected_overlap_${farm.id}_${area.id}`,

                                            type:
                                                'protected_area',

                                            severity:
                                                severity,

                                            title:
                                                'Protected Area Overlap',

                                            description:
                                                `Farm "${
                                                    farm.farmer_name ||
                                                    'Unknown'
                                                }" intersects protected area "${
                                                    area.name ||
                                                    'Unnamed'
                                                }" by ${
                                                    areaHa.toFixed(
                                                        2
                                                    )
                                                } ha`,

                                            farm:
                                                farm,

                                            protectedArea:
                                                area,

                                            overlapArea:
                                                areaHa,

                                            intersectionGeo:
                                                intersection
                                                    .geometry
                                                    .coordinates,

                                            supplier:
                                                farm.supplier ||
                                                'Unknown',

                                            cooperative:
                                                farm.cooperative ||
                                                'Unassigned',

                                            status:
                                                'new',

                                            date:
                                                new Date().toISOString()
                                        });
                                    }
                                }
                            }

                        } catch (e) {

                            console.warn(
                                'Protected area check failed:',
                                e
                            );
                        }
                    }
                );
            }
        );
    }


    // -----------------------------------------
    // UPDATE ARRAYS
    // -----------------------------------------
    filteredProtectedAlerts =
        [...protectedAlerts];

    filteredPolygonAlerts =
        [...polygonAlerts];


    updateBadges();
    updateSupplierFilters();

    applyProtectedFilters();
    applyPolygonFilters();

    updateStats();

    renderQualityQueue();


    console.log(
        `✅ Generated ${
            protectedAlerts.length
        } protected alerts and ${
            polygonAlerts.length
        } polygon alerts`
    );
}


// ===========================================
// BADGES
// ===========================================
function updateBadges() {

    const protectedBadge =
        document.getElementById(
            'protectedBadge'
        );

    const polygonBadge =
        document.getElementById(
            'polygonBadge'
        );


    if (protectedBadge) {
        protectedBadge.textContent =
            protectedAlerts.length;
    }

    if (polygonBadge) {
        polygonBadge.textContent =
            polygonAlerts.length;
    }


    const criticalProtected =
        protectedAlerts.filter(
            a =>
                a.severity ===
                'critical'
        ).length;


    const criticalPolygon =
        polygonAlerts.filter(
            a =>
                a.severity ===
                'critical'
        ).length;


    if (protectedBadge) {

        protectedBadge.classList.toggle(
            'critical',
            criticalProtected > 0
        );
    }


    if (polygonBadge) {

        polygonBadge.classList.toggle(
            'critical',
            criticalPolygon > 0
        );
    }
}


// ===========================================
// SUPPLIER FILTERS
// ===========================================
function updateSupplierFilters() {

    const protectedSuppliers =
        [
            ...new Set(
                protectedAlerts.map(
                    a =>
                        a.supplier ||
                        'Unknown'
                )
            )
        ];


    const polygonSuppliers =
        [
            ...new Set(
                polygonAlerts.map(
                    a =>
                        a.supplier ||
                        'Unknown'
                )
            )
        ];


    const protectedSelect =
        document.getElementById(
            'protectedSupplierFilter'
        );


    const polygonSelect =
        document.getElementById(
            'polygonSupplierFilter'
        );


    if (protectedSelect) {

        protectedSelect.innerHTML =
            '<option value="all">All Suppliers</option>' +
            protectedSuppliers
                .map(
                    s =>
                        `<option value="${escapeHtml(
                            s
                        )}">
                            ${escapeHtml(s)}
                         </option>`
                )
                .join('');
    }


    if (polygonSelect) {

        polygonSelect.innerHTML =
            '<option value="all">All Suppliers</option>' +
            polygonSuppliers
                .map(
                    s =>
                        `<option value="${escapeHtml(
                            s
                        )}">
                            ${escapeHtml(s)}
                         </option>`
                )
                .join('');
    }
}


// ===========================================
// STATISTICS
// ===========================================
function updateStats() {

    const allAlerts =
        [
            ...protectedAlerts,
            ...polygonAlerts
        ];


    const setText = (
        id,
        value
    ) => {

        const el =
            document.getElementById(
                id
            );

        if (el) {
            el.textContent =
                value;
        }
    };


    setText(
        'criticalCount',
        allAlerts.filter(
            a =>
                a.severity ===
                'critical'
        ).length
    );


    setText(
        'highCount',
        allAlerts.filter(
            a =>
                a.severity ===
                'high'
        ).length
    );


    setText(
        'mediumCount',
        allAlerts.filter(
            a =>
                a.severity ===
                'medium'
        ).length
    );


    setText(
        'lowCount',
        allAlerts.filter(
            a =>
                a.severity ===
                'low'
        ).length
    );


    setText(
        'totalAlerts',
        allAlerts.length
    );
}


// ===========================================
// PROTECTED FILTERS
// ===========================================
function applyProtectedFilters() {

    const severity =
        document.getElementById(
            'protectedSeverityFilter'
        )?.value ||
        'all';


    const supplier =
        document.getElementById(
            'protectedSupplierFilter'
        )?.value ||
        'all';


    const status =
        document.getElementById(
            'protectedStatusFilter'
        )?.value ||
        'all';


    filteredProtectedAlerts =
        protectedAlerts.filter(
            alert => {

                if (
                    severity !==
                    'all' &&
                    alert.severity !==
                    severity
                ) {
                    return false;
                }


                if (
                    supplier !==
                    'all' &&
                    (
                        alert.supplier ||
                        'Unknown'
                    ) !==
                    supplier
                ) {
                    return false;
                }


                if (
                    status !==
                    'all' &&
                    alert.status !==
                    status
                ) {
                    return false;
                }


                return true;
            }
        );


    protectedPage =
        1;


    renderProtectedAlerts();

    updateProtectedPagination();
}


// ===========================================
// PROTECTED ALERT RENDER
// ===========================================
function renderProtectedAlerts() {

    const container =
        document.getElementById(
            'protectedAlertsList'
        );


    if (!container) {
        return;
    }


    const start =
        (
            protectedPage -
            1
        ) *
        rowsPerPage;


    const pageData =
        filteredProtectedAlerts.slice(
            start,
            start + rowsPerPage
        );


    const count =
        document.getElementById(
            'protectedShowingCount'
        );


    if (count) {
        count.textContent =
            filteredProtectedAlerts.length;
    }


    if (
        pageData.length ===
        0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Protected Area Alerts</h3>
                <p>All farms are outside protected areas.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        pageData
            .map(
                alert => `
                <div
                    class="alert-item ${escapeHtml(
                        alert.status
                    )}"
                    onclick="viewAlertOnMap('${escapeHtml(
                        alert.id
                    )}')"
                >

                    <div class="alert-header">

                        <div class="alert-severity ${escapeHtml(
                            alert.severity
                        )}">
                            <i class="fas ${getSeverityIcon(
                                alert.severity
                            )}"></i>
                        </div>

                        <div class="alert-title">
                            ${escapeHtml(
                                alert.title
                            )}
                        </div>

                        <span class="alert-type-badge">
                            Protected Area
                        </span>

                        <span class="alert-badge ${escapeHtml(
                            alert.status
                        )}">
                            ${escapeHtml(
                                alert.status
                            )}
                        </span>

                        <div class="alert-date">
                            ${formatDate(
                                alert.date
                            )}
                        </div>

                    </div>


                    <div class="alert-details">

                        <p>
                            ${escapeHtml(
                                alert.description
                            )}
                        </p>

                        <p>
                            <strong>Supplier:</strong>
                            ${escapeHtml(
                                alert.supplier ||
                                'N/A'
                            )}

                            •

                            <strong>Cooperative:</strong>
                            ${escapeHtml(
                                alert.cooperative ||
                                'N/A'
                            )}
                        </p>

                        <p>
                            <strong>
                                Protected Area:
                            </strong>

                            ${escapeHtml(
                                alert.protectedArea
                                    ?.name ||
                                'Unnamed'
                            )}
                        </p>

                    </div>


                    <div class="alert-actions">

                        <button
                            type="button"
                            class="action-btn view-map"
                            onclick="
                                event.stopPropagation();
                                viewAlertOnMap(
                                    '${escapeHtml(
                                        alert.id
                                    )}'
                                )
                            "
                        >
                            <i class="fas fa-map-marker-alt"></i>
                            View on Map
                        </button>


                        ${
                            alert.status ===
                            'new'
                                ? `
                                    <button
                                        type="button"
                                        class="action-btn acknowledge"
                                        onclick="
                                            event.stopPropagation();
                                            updateAlertStatus(
                                                '${escapeHtml(
                                                    alert.id
                                                )}',
                                                'acknowledged'
                                            )
                                        "
                                    >
                                        <i class="fas fa-check"></i>
                                        Acknowledge
                                    </button>

                                    <button
                                        type="button"
                                        class="action-btn resolve"
                                        onclick="
                                            event.stopPropagation();
                                            updateAlertStatus(
                                                '${escapeHtml(
                                                    alert.id
                                                )}',
                                                'resolved'
                                            )
                                        "
                                    >
                                        <i class="fas fa-check-double"></i>
                                        Resolve
                                    </button>
                                `
                                : ''
                        }

                    </div>

                </div>
            `
            )
            .join('');
}


// ===========================================
// PROTECTED PAGINATION
// ===========================================
function updateProtectedPagination() {

    const totalPages =
        Math.ceil(
            filteredProtectedAlerts.length /
            rowsPerPage
        );


    const pageInfo =
        document.getElementById(
            'protectedPageInfo'
        );


    const prev =
        document.getElementById(
            'protectedPrevBtn'
        );


    const next =
        document.getElementById(
            'protectedNextBtn'
        );


    if (pageInfo) {

        pageInfo.textContent =
            `Page ${
                protectedPage
            } of ${
                totalPages || 1
            }`;
    }


    if (prev) {

        prev.disabled =
            protectedPage === 1;
    }


    if (next) {

        next.disabled =
            protectedPage ===
                totalPages ||
            totalPages === 0;
    }
}


window.protectedPrevPage =
    function () {

        if (
            protectedPage >
            1
        ) {

            protectedPage--;

            renderProtectedAlerts();

            updateProtectedPagination();
        }
    };


window.protectedNextPage =
    function () {

        const total =
            Math.ceil(
                filteredProtectedAlerts.length /
                rowsPerPage
            );


        if (
            protectedPage <
            total
        ) {

            protectedPage++;

            renderProtectedAlerts();

            updateProtectedPagination();
        }
    };


// ===========================================
// CLEAR PROTECTED FILTERS
// ===========================================
function clearProtectedFilters() {

    const severity =
        document.getElementById(
            'protectedSeverityFilter'
        );

    const supplier =
        document.getElementById(
            'protectedSupplierFilter'
        );

    const status =
        document.getElementById(
            'protectedStatusFilter'
        );


    if (severity) {
        severity.value =
            'all';
    }

    if (supplier) {
        supplier.value =
            'all';
    }

    if (status) {
        status.value =
            'all';
    }


    applyProtectedFilters();
}


// ===========================================
// MARK PROTECTED READ
// ===========================================
function markProtectedRead() {

    if (
        !confirm(
            'Mark all new protected area alerts as acknowledged?'
        )
    ) {
        return;
    }


    filteredProtectedAlerts.forEach(
        a => {

            if (
                a.status ===
                'new'
            ) {
                a.status =
                    'acknowledged';
            }
        }
    );


    protectedAlerts.forEach(
        a => {

            if (
                a.status ===
                'new'
            ) {
                a.status =
                    'acknowledged';
            }
        }
    );


    renderProtectedAlerts();

    updateBadges();

    showNotification(
        'All protected area alerts marked as acknowledged',
        'success'
    );
}


// ===========================================
// POLYGON FILTERS
// ===========================================
function applyPolygonFilters() {

    const type =
        document.getElementById(
            'polygonTypeFilter'
        )?.value ||
        'all';


    const severity =
        document.getElementById(
            'polygonSeverityFilter'
        )?.value ||
        'all';


    const supplier =
        document.getElementById(
            'polygonSupplierFilter'
        )?.value ||
        'all';


    const status =
        document.getElementById(
            'polygonStatusFilter'
        )?.value ||
        'all';


    filteredPolygonAlerts =
        polygonAlerts.filter(
            alert => {

                if (
                    type !==
                    'all' &&
                    alert.type !==
                    type
                ) {
                    return false;
                }


                if (
                    severity !==
                    'all' &&
                    alert.severity !==
                    severity
                ) {
                    return false;
                }


                if (
                    supplier !==
                    'all' &&
                    (
                        alert.supplier ||
                        'Unknown'
                    ) !==
                    supplier
                ) {
                    return false;
                }


                if (
                    status !==
                    'all' &&
                    alert.status !==
                    status
                ) {
                    return false;
                }


                return true;
            }
        );


    polygonPage =
        1;


    renderPolygonAlerts();

    updatePolygonPagination();
}


// ===========================================
// POLYGON ALERT RENDER
// ===========================================
function renderPolygonAlerts() {

    const container =
        document.getElementById(
            'polygonAlertsList'
        );


    if (!container) {
        return;
    }


    const start =
        (
            polygonPage -
            1
        ) *
        rowsPerPage;


    const pageData =
        filteredPolygonAlerts.slice(
            start,
            start + rowsPerPage
        );


    const count =
        document.getElementById(
            'polygonShowingCount'
        );


    if (count) {

        count.textContent =
            filteredPolygonAlerts.length;
    }


    if (
        pageData.length ===
        0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Polygon Quality Alerts</h3>
                <p>All polygons pass quality checks.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        pageData
            .map(
                alert => `

                <div
                    class="alert-item ${escapeHtml(
                        alert.status
                    )}"
                    onclick="
                        viewAlertOnMap(
                            '${escapeHtml(
                                alert.id
                            )}'
                        )
                    "
                >

                    <div class="alert-header">

                        <div class="alert-severity ${escapeHtml(
                            alert.severity
                        )}">
                            <i class="fas ${getSeverityIcon(
                                alert.severity
                            )}"></i>
                        </div>

                        <div class="alert-title">
                            ${escapeHtml(
                                alert.title
                            )}
                        </div>

                        <span class="alert-type-badge">
                            ${getTypeLabel(
                                alert.type
                            )}
                        </span>

                        <span class="alert-badge ${escapeHtml(
                            alert.status
                        )}">
                            ${escapeHtml(
                                alert.status
                            )}
                        </span>

                        <div class="alert-date">
                            ${formatDate(
                                alert.date
                            )}
                        </div>

                    </div>


                    <div class="alert-details">

                        <p>
                            ${escapeHtml(
                                alert.description
                            )}
                        </p>

                        <p>
                            <strong>Supplier:</strong>
                            ${escapeHtml(
                                alert.supplier ||
                                'N/A'
                            )}

                            •

                            <strong>Cooperative:</strong>
                            ${escapeHtml(
                                alert.cooperative ||
                                'N/A'
                            )}
                        </p>

                    </div>


                    <div class="alert-actions">

                        <button
                            type="button"
                            class="action-btn view-map"
                            onclick="
                                event.stopPropagation();
                                viewAlertOnMap(
                                    '${escapeHtml(
                                        alert.id
                                    )}'
                                )
                            "
                        >
                            <i class="fas fa-map-marker-alt"></i>
                            View on Map
                        </button>


                        ${
                            alert.status ===
                            'new'
                                ? `
                                    <button
                                        type="button"
                                        class="action-btn acknowledge"
                                        onclick="
                                            event.stopPropagation();
                                            updateAlertStatus(
                                                '${escapeHtml(
                                                    alert.id
                                                )}',
                                                'acknowledged'
                                            )
                                        "
                                    >
                                        <i class="fas fa-check"></i>
                                        Acknowledge
                                    </button>

                                    <button
                                        type="button"
                                        class="action-btn resolve"
                                        onclick="
                                            event.stopPropagation();
                                            updateAlertStatus(
                                                '${escapeHtml(
                                                    alert.id
                                                )}',
                                                'resolved'
                                            )
                                        "
                                    >
                                        <i class="fas fa-check-double"></i>
                                        Resolve
                                    </button>
                                `
                                : ''
                        }

                    </div>

                </div>
            `
            )
            .join('');
}


// ===========================================
// POLYGON PAGINATION
// ===========================================
function updatePolygonPagination() {

    const totalPages =
        Math.ceil(
            filteredPolygonAlerts.length /
            rowsPerPage
        );


    const pageInfo =
        document.getElementById(
            'polygonPageInfo'
        );


    const prev =
        document.getElementById(
            'polygonPrevBtn'
        );


    const next =
        document.getElementById(
            'polygonNextBtn'
        );


    if (pageInfo) {

        pageInfo.textContent =
            `Page ${
                polygonPage
            } of ${
                totalPages || 1
            }`;
    }


    if (prev) {

        prev.disabled =
            polygonPage === 1;
    }


    if (next) {

        next.disabled =
            polygonPage ===
                totalPages ||
            totalPages === 0;
    }
}


window.polygonPrevPage =
    function () {

        if (
            polygonPage >
            1
        ) {

            polygonPage--;

            renderPolygonAlerts();

            updatePolygonPagination();
        }
    };


window.polygonNextPage =
    function () {

        const total =
            Math.ceil(
                filteredPolygonAlerts.length /
                rowsPerPage
            );


        if (
            polygonPage <
            total
        ) {

            polygonPage++;

            renderPolygonAlerts();

            updatePolygonPagination();
        }
    };


// ===========================================
// CLEAR POLYGON FILTERS
// ===========================================
function clearPolygonFilters() {

    const type =
        document.getElementById(
            'polygonTypeFilter'
        );

    const severity =
        document.getElementById(
            'polygonSeverityFilter'
        );

    const supplier =
        document.getElementById(
            'polygonSupplierFilter'
        );

    const status =
        document.getElementById(
            'polygonStatusFilter'
        );


    if (type) {
        type.value =
            'all';
    }

    if (severity) {
        severity.value =
            'all';
    }

    if (supplier) {
        supplier.value =
            'all';
    }

    if (status) {
        status.value =
            'all';
    }


    applyPolygonFilters();
}


// ===========================================
// MARK POLYGON READ
// ===========================================
function markPolygonRead() {

    if (
        !confirm(
            'Mark all new polygon alerts as acknowledged?'
        )
    ) {
        return;
    }


    filteredPolygonAlerts.forEach(
        a => {

            if (
                a.status ===
                'new'
            ) {
                a.status =
                    'acknowledged';
            }
        }
    );


    polygonAlerts.forEach(
        a => {

            if (
                a.status ===
                'new'
            ) {
                a.status =
                    'acknowledged';
            }
        }
    );


    renderPolygonAlerts();

    updateBadges();

    showNotification(
        'All polygon alerts marked as acknowledged',
        'success'
    );
}


// ===========================================
// ALERT MAP
// ===========================================
function viewAlertOnMap(
    alertId
) {

    const alert =
        [
            ...protectedAlerts,
            ...polygonAlerts
        ].find(
            a =>
                a.id ===
                alertId
        );


    if (!alert) {

        showNotification(
            'Alert not found.',
            'error'
        );

        return;
    }


    const modal =
        document.createElement(
            'div'
        );

    modal.className =
        'map-modal-overlay';


    modal.innerHTML = `
        <div class="map-modal">

            <div class="map-modal-header">

                <div>
                    <h3>
                        ${escapeHtml(
                            alert.title
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            alert.description
                        )}
                    </p>
                </div>

                <button
                    class="modal-close"
                    type="button"
                >
                    ×
                </button>

            </div>

            <div
                id="alertMap"
                class="alert-map"
            ></div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    modal
        .querySelector(
            '.modal-close'
        )
        .addEventListener(
            'click',
            () => {

                if (
                    currentMap
                ) {

                    currentMap.remove();

                    currentMap =
                        null;
                }

                modal.remove();
            }
        );


    setTimeout(
        () => {

            currentMap =
                L.map(
                    'alertMap'
                );


            L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                {
                    attribution:
                        '&copy; OpenStreetMap contributors'
                }
            ).addTo(
                currentMap
            );


            let bounds =
                null;


            // ---------------------------------
            // FARM
            // ---------------------------------
            if (
                alert.farm?.geometry
            ) {

                const coords =
                    convertCoords(
                        alert.farm.geometry
                    );


                const poly =
                    L.polygon(
                        coords,
                        {
                            color:
                                '#eab308',

                            weight:
                                3,

                            fillColor:
                                '#eab308',

                            fillOpacity:
                                0.3
                        }
                    ).addTo(
                        currentMap
                    );


                if (
                    poly.getBounds()
                        .isValid()
                ) {

                    bounds =
                        poly.getBounds();
                }
            }


            // ---------------------------------
            // FARM 1 / FARM 2
            // ---------------------------------
            if (
                alert.farm1?.geometry
            ) {

                const coords =
                    convertCoords(
                        alert.farm1.geometry
                    );


                const poly =
                    L.polygon(
                        coords,
                        {
                            weight:
                                3,

                            fillOpacity:
                                0.25
                        }
                    ).addTo(
                        currentMap
                    );


                if (
                    poly.getBounds()
                        .isValid()
                ) {

                    bounds =
                        poly.getBounds();
                }
            }


            if (
                alert.farm2?.geometry
            ) {

                const coords =
                    convertCoords(
                        alert.farm2.geometry
                    );


                const poly =
                    L.polygon(
                        coords,
                        {
                            weight:
                                3,

                            fillOpacity:
                                0.25
                        }
                    ).addTo(
                        currentMap
                    );


                if (
                    poly.getBounds()
                        .isValid()
                ) {

                    bounds =
                        bounds
                            ? bounds.extend(
                                poly.getBounds()
                            )
                            : poly.getBounds();
                }
            }


            // ---------------------------------
            // INTERSECTION
            // ---------------------------------
            if (
                alert.intersectionGeo
            ) {

                try {

                    const intersection =
                        L.geoJSON({
                            type:
                                'MultiPolygon',

                            coordinates:
                                alert.intersectionGeo
                        });


                    intersection
                        .addTo(
                            currentMap
                        );


                    if (
                        intersection
                            .getBounds()
                            .isValid()
                    ) {

                        bounds =
                            intersection
                                .getBounds();
                    }

                } catch (e) {

                    console.warn(
                        'Intersection display error:',
                        e
                    );
                }
            }


            // ---------------------------------
            // PROTECTED AREA
            // ---------------------------------
            if (
                alert.protectedArea
                    ?.geometry
            ) {

                const protectedLayer =
                    L.geoJSON(
                        alert.protectedArea
                            .geometry,
                        {
                            style: {
                                weight:
                                    2,

                                fillOpacity:
                                    0.15,

                                dashArray:
                                    '5,5'
                            }
                        }
                    ).addTo(
                        currentMap
                    );


                if (
                    protectedLayer
                        .getBounds()
                        .isValid()
                ) {

                    bounds =
                        bounds
                            ? bounds.extend(
                                protectedLayer
                                    .getBounds()
                            )
                            : protectedLayer
                                .getBounds();
                }
            }


            if (
                bounds &&
                bounds.isValid()
            ) {

                currentMap.fitBounds(
                    bounds,
                    {
                        padding:
                            [40, 40]
                    }
                );

            } else {

                currentMap.setView(
                    [
                        7.539989,
                        -5.547080
                    ],
                    7
                );
            }


            L.control
                .scale({
                    metric:
                        true,

                    imperial:
                        false
                })
                .addTo(
                    currentMap
                );

        },
        100
    );
}


// ===========================================
// COORDINATE CONVERTER
// ===========================================
function convertCoords(
    geometry
) {

    if (!geometry) {
        return [];
    }


    if (
        geometry.type ===
        'Polygon'
    ) {

        return geometry.coordinates
            .map(
                ring =>
                    ring.map(
                        coord =>
                            [
                                coord[1],
                                coord[0]
                            ]
                    )
            );
    }


    if (
        geometry.type ===
        'MultiPolygon'
    ) {

        return geometry.coordinates
            .flat(
                1
            )
            .map(
                ring =>
                    ring.map(
                        coord =>
                            [
                                coord[1],
                                coord[0]
                            ]
                    )
            );
    }


    return [];
}


// ===========================================
// ALERT STATUS
// ===========================================
window.updateAlertStatus =
    function (
        alertId,
        newStatus
    ) {

        const allAlerts =
            [
                ...protectedAlerts,
                ...polygonAlerts
            ];


        const alert =
            allAlerts.find(
                a =>
                    a.id ===
                    alertId
            );


        if (!alert) {
            return;
        }


        alert.status =
            newStatus;


        const protectedAlert =
            protectedAlerts.find(
                a =>
                    a.id ===
                    alertId
            );


        if (
            protectedAlert
        ) {
            protectedAlert.status =
                newStatus;
        }


        const polygonAlert =
            polygonAlerts.find(
                a =>
                    a.id ===
                    alertId
            );


        if (
            polygonAlert
        ) {
            polygonAlert.status =
                newStatus;
        }


        applyProtectedFilters();

        applyPolygonFilters();

        updateBadges();

        renderQualityQueue();


        showNotification(
            `Alert marked as ${newStatus}`,
            'success'
        );
    };


// ===========================================
// REFRESH
// ===========================================
function refreshProtectedAlerts() {

    if (!currentProject) {
        return;
    }


    showLoading(true);


    Promise.all([
        loadFarms(
            currentProject.id
        ),

        loadProtectedAreas(
            currentProject.id
        )
    ])
        .then(
            () => {

                generateAlerts();

                showLoading(false);
            }
        )
        .catch(
            error => {

                console.error(
                    error
                );

                showLoading(false);

                showNotification(
                    'Unable to refresh alerts.',
                    'error'
                );
            }
        );
}


function refreshPolygonAlerts() {

    if (!currentProject) {
        return;
    }


    showLoading(true);


    Promise.all([
        loadFarms(
            currentProject.id
        ),

        loadProtectedAreas(
            currentProject.id
        )
    ])
        .then(
            () => {

                generateAlerts();

                showLoading(false);
            }
        )
        .catch(
            error => {

                console.error(
                    error
                );

                showLoading(false);

                showNotification(
                    'Unable to refresh alerts.',
                    'error'
                );
            }
        );
}


// ===========================================
// HELPERS
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


    notification.style.cssText =
        `
        position:fixed;
        bottom:20px;
        right:20px;
        padding:12px 24px;
        background:${colors[type]};
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


    notification.innerHTML =
        `
        <i class="fas ${
            type === 'success'
                ? 'fa-check-circle'
                : 'fa-exclamation-circle'
        }"></i>
        ${escapeHtml(message)}
        `;


    document.body.appendChild(
        notification
    );


    setTimeout(
        () =>
            notification.remove(),
        3000
    );
}


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


function formatDate(
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


    return date.toLocaleDateString(
        undefined,
        {
            year:
                'numeric',

            month:
                'short',

            day:
                'numeric'
        }
    );
}


function getSeverityIcon(
    severity
) {

    switch (
        String(
            severity || ''
        ).toLowerCase()
    ) {

        case 'critical':
            return 'fa-times-circle';

        case 'high':
            return 'fa-exclamation-triangle';

        case 'medium':
            return 'fa-exclamation-circle';

        default:
            return 'fa-info-circle';
    }
}


function getTypeLabel(
    type
) {

    const labels = {

        overlap:
            'Overlap',

        self_intersection:
            'Invalid Geometry',

        duplicate:
            'Duplicate',

        protected_area:
            'Protected Area'
    };


    return labels[type] ||
        type ||
        'Quality';
}


// ===========================================
// TABS
// ===========================================
function switchTab(
    tab
) {

    document
        .querySelectorAll(
            '.tab-content'
        )
        .forEach(
            content =>
                content.classList.remove(
                    'active'
                )
        );


    document
        .querySelectorAll(
            '.tab-btn'
        )
        .forEach(
            button =>
                button.classList.remove(
                    'active'
                )
        );


    const content =
        document.getElementById(
            `${tab}Tab`
        );


    if (content) {
        content.classList.add(
            'active'
        );
    }


    const button =
        document.querySelector(
            `[data-tab="${tab}"]`
        );


    if (button) {
        button.classList.add(
            'active'
        );
    }
}


// ===========================================
// EVENT LISTENERS
// ===========================================
function setupEventListeners() {

    document
        .getElementById(
            'refreshBtn'
        )
        ?.addEventListener(
            'click',
            () => {

                if (
                    !currentProject
                ) {
                    return;
                }


                showLoading(true);


                Promise.all([
                    loadFarms(
                        currentProject.id
                    ),

                    loadProtectedAreas(
                        currentProject.id
                    )
                ])
                    .then(
                        () => {

                            generateAlerts();

                            showLoading(false);
                        }
                    )
                    .catch(
                        error => {

                            console.error(
                                error
                            );

                            showLoading(false);
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
            async () => {

                await supabaseClient
                    .auth
                    .signOut();

                localStorage.clear();

                window.location.href =
                    '../login.html';
            }
        );
}


// ===========================================
// GLOBAL FUNCTIONS
// ===========================================
window.applyProtectedFilters =
    applyProtectedFilters;

window.applyPolygonFilters =
    applyPolygonFilters;

window.clearProtectedFilters =
    clearProtectedFilters;

window.clearPolygonFilters =
    clearPolygonFilters;

window.markProtectedRead =
    markProtectedRead;

window.markPolygonRead =
    markPolygonRead;

window.viewAlertOnMap =
    viewAlertOnMap;

window.refreshProtectedAlerts =
    refreshProtectedAlerts;

window.refreshPolygonAlerts =
    refreshPolygonAlerts;

window.switchTab =
    switchTab;

window.protectedPrevPage =
    window.protectedPrevPage;

window.protectedNextPage =
    window.protectedNextPage;

window.polygonPrevPage =
    window.polygonPrevPage;

window.polygonNextPage =
    window.polygonNextPage;


// ===========================================
// QUALITY REVIEW MODULE
// ===========================================

const GIS_QUALITY_ROLES = [
    'gis',
    'gis_specialist',
    'gis_lead',
    'validator',
    'manager',
    'owner'
];

const READ_ONLY_ROLES = [
    'super_manager',
    'viewer'
];

let qualityReviewFarm = null;
let qualityReviewResult = null;
let qualityReviewMap = null;
let qualityIssueLayers = [];


// ===========================================
// QUALITY ROLE
// ===========================================
function getCurrentQualityRole() {

    const role =
        window.currentProjectRole ||
        currentProjectRole ||
        document
            .getElementById(
                'userRole'
            )?.textContent ||
        '';


    return String(role)
        .toLowerCase()
        .trim()
        .replace(
            /\s+/g,
            '_'
        );
}


function canReviewQuality() {

    return GIS_QUALITY_ROLES.includes(
        getCurrentQualityRole()
    );
}


function isSuperManager() {

    return (
        getCurrentQualityRole() ===
        'super_manager'
    );
}


// ===========================================
// QUALITY REVIEW ENTRY
// ===========================================
window.openGISQualityReview =
    async function (
        farmId
    ) {

        if (
            !canReviewQuality()
        ) {

            showNotification(
                'You do not have permission to perform GIS quality review.',
                'error'
            );

            return;
        }


        let farm =
            (
                window.farmsData ||
                allFarms ||
                []
            ).find(
                f =>
                    String(f.id) ===
                    String(farmId)
            );


        if (!farm) {

            try {

                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .from('farms')
                        .select('*')
                        .eq(
                            'id',
                            farmId
                        )
                        .maybeSingle();


                if (error) {
                    throw error;
                }


                farm =
                    data;

            } catch (
                error
            ) {

                console.error(
                    error
                );

                showNotification(
                    'Unable to load farm: ' +
                    error.message,
                    'error'
                );

                return;
            }
        }


        if (!farm) {

            showNotification(
                'Farm not found.',
                'error'
            );

            return;
        }


        qualityReviewFarm =
            farm;


        createQualityModal();


        await runQualityCheck(
            farm.id
        );
    };


// ===========================================
// CREATE QUALITY MODAL
// ===========================================
function createQualityModal() {

    const existing =
        document.getElementById(
            'gisQualityModal'
        );


    if (existing) {
        existing.remove();
    }


    const modal =
        document.createElement(
            'div'
        );


    modal.id =
        'gisQualityModal';

    modal.className =
        'gis-quality-modal';


    modal.innerHTML = `
        <div class="gis-quality-modal-content">

            <div class="gis-quality-header">

                <div>
                    <div class="eyebrow">
                        GIS QUALITY REVIEW
                    </div>

                    <h2>
                        ${escapeHtml(
                            qualityReviewFarm
                                ?.farmer_name ||
                            'Farm Review'
                        )}
                    </h2>

                    <p>
                        Review geometry,
                        mapping,
                        spatial,
                        attributes and
                        traceability quality.
                    </p>
                </div>

                <button
                    type="button"
                    class="quality-close"
                    onclick="closeGISQualityReview()"
                >
                    ×
                </button>

            </div>


            <div class="gis-quality-summary">

                <div class="quality-score-card">

                    <span>
                        Overall Score
                    </span>

                    <strong
                        id="gisQualityScore"
                    >
                        —
                    </strong>

                    <span
                        id="gisQualityStatus"
                        class="quality-status-badge pending"
                    >
                        PENDING
                    </span>

                </div>


                <div
                    id="gisQualityComponents"
                    class="quality-components"
                ></div>

            </div>


            <div class="gis-quality-grid">

                <div
                    id="gisQualityIssues"
                    class="gis-quality-issues"
                >
                    <div class="quality-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        Running GIS quality checks...
                    </div>
                </div>


                <div
                    id="gisQualityMap"
                    class="gis-quality-map"
                ></div>

            </div>


            <div
                class="gis-quality-actions"
                id="gisQualityActions"
            >

                <button
                    type="button"
                    class="quality-action correction"
                    onclick="
                        requestGISCorrection()
                    "
                >
                    <i class="fas fa-edit"></i>
                    Request Correction
                </button>


                <button
                    type="button"
                    class="quality-action reject"
                    onclick="
                        makeGISQualityDecision(
                            'rejected'
                        )
                    "
                >
                    <i class="fas fa-times"></i>
                    Reject
                </button>


                <button
                    type="button"
                    class="quality-action validate"
                    onclick="
                        makeGISQualityDecision(
                            'validated'
                        )
                    "
                >
                    <i class="fas fa-check"></i>
                    Validate
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    initializeQualityReviewMap();
}


// ===========================================
// RUN QUALITY CHECK
// ===========================================
async function runQualityCheck(
    farmId
) {

    const issueBox =
        document.getElementById(
            'gisQualityIssues'
        );


    if (issueBox) {

        issueBox.innerHTML = `
            <div class="quality-loading">
                <i class="fas fa-spinner fa-spin"></i>
                Running GIS quality checks...
            </div>
        `;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.rpc(
                'run_full_quality_check',
                {
                    p_farm_id:
                        farmId
                }
            );


        if (error) {
            throw error;
        }


        qualityReviewResult =
            data;


        renderQualityResult(
            data
        );


        await loadQualityIssues(
            farmId
        );


        renderQualityReviewMap();

    } catch (
        error
    ) {

        console.error(
            'GIS Quality Check Error:',
            error
        );


        if (issueBox) {

            issueBox.innerHTML = `
                <div class="quality-error">

                    <i class="fas fa-exclamation-circle"></i>

                    <strong>
                        Quality check failed
                    </strong>

                    <span>
                        ${escapeHtml(
                            error.message
                        )}
                    </span>

                </div>
            `;
        }


        showNotification(
            'Quality check failed: ' +
            error.message,
            'error'
        );
    }
}


// ===========================================
// RENDER QUALITY RESULT
// ===========================================
function renderQualityResult(
    result
) {

    const score =
        Number(
            result?.overall_score
        );


    const status =
        result?.quality_status ||
        'pending';


    const scoreBox =
        document.getElementById(
            'gisQualityScore'
        );


    const statusBox =
        document.getElementById(
            'gisQualityStatus'
        );


    if (scoreBox) {

        scoreBox.textContent =
            Number.isFinite(score)
                ? score.toFixed(0)
                : '—';
    }


    if (statusBox) {

        statusBox.className =
            `quality-status-badge ${
                qualityStatusClass(
                    status
                )
            }`;


        statusBox.textContent =
            status ===
            'passed'
                ? 'PASSED'
                : status ===
                    'review_required'
                    ? 'REVIEW REQUIRED'
                    : status ===
                        'issues_detected'
                        ? 'ISSUES DETECTED'
                        : status.toUpperCase();
    }


    const scoreDetails =
        result?.score_details ||
        {};


    const components =
        document.getElementById(
            'gisQualityComponents'
        );


    if (!components) {
        return;
    }


    const rows = [

        [
            'Geometry',
            scoreDetails.geometry_score
        ],

        [
            'Mapping',
            scoreDetails.mapping_score
        ],

        [
            'Spatial',
            scoreDetails.spatial_score
        ],

        [
            'Attributes',
            scoreDetails.attribute_score
        ],

        [
            'Traceability',
            scoreDetails.traceability_score
        ]

    ];


    components.innerHTML =
        rows
            .map(
                ([label, value]) => `

                    <div class="quality-component">

                        <span>
                            ${escapeHtml(
                                label
                            )}
                        </span>

                        <strong>
                            ${
                                Number.isFinite(
                                    Number(value)
                                )
                                    ? Number(value).toFixed(0)
                                    : '—'
                            }
                        </strong>

                    </div>
                `
            )
            .join('');
}


// ===========================================
// QUALITY STATUS
// ===========================================
function qualityStatusClass(
    status
) {

    switch (
        String(
            status || ''
        ).toLowerCase()
    ) {

        case 'passed':
            return 'passed';

        case 'review_required':
            return 'review';

        case 'issues_detected':
            return 'failed';

        default:
            return 'pending';
    }
}


// ===========================================
// QUALITY ISSUES
// ===========================================
async function loadQualityIssues(
    farmId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                'farm_quality_issues'
            )
            .select('*')
            .eq(
                'farm_id',
                farmId
            )
            .order(
                'severity',
                {
                    ascending:
                        true
                }
            );


    if (error) {

        console.error(
            'Unable to load quality issues:',
            error
        );

        return;
    }


    window._gisQualityIssues =
        data || [];


    renderQualityIssues(
        data || []
    );
}


function renderQualityIssues(
    issues
) {

    const box =
        document.getElementById(
            'gisQualityIssues'
        );


    if (!box) {
        return;
    }


    if (
        !issues ||
        issues.length === 0
    ) {

        box.innerHTML = `
            <div class="quality-empty">

                <i class="fas fa-check-circle"></i>

                <strong>
                    No quality issues detected
                </strong>

                <span>
                    This farm passed the
                    available GIS issue checks.
                </span>

            </div>
        `;

        return;
    }


    box.innerHTML = `
        <div class="quality-issues-title">
            Quality Issues
            <span>
                ${issues.length}
            </span>
        </div>

        <div class="quality-issue-list">

            ${
                issues
                    .map(
                        issue => `

                            <div
                                class="quality-issue-item ${escapeHtml(
                                    String(
                                        issue.severity ||
                                        'info'
                                    ).toLowerCase()
                                )}"
                            >

                                <div class="issue-icon">
                                    ${severityIcon(
                                        issue.severity
                                    )}
                                </div>

                                <div class="issue-body">

                                    <strong>
                                        ${escapeHtml(
                                            issue.issue_type ||
                                            issue.type ||
                                            'Quality Issue'
                                        )}
                                    </strong>

                                    <p>
                                        ${escapeHtml(
                                            issue.description ||
                                            issue.message ||
                                            ''
                                        )}
                                    </p>

                                </div>

                            </div>
                        `
                    )
                    .join('')
            }

        </div>
    `;
}


// ===========================================
// SEVERITY
// ===========================================
function severityIcon(
    severity
) {

    switch (
        String(
            severity || ''
        ).toLowerCase()
    ) {

        case 'critical':
            return '🔴';

        case 'major':
            return '🟠';

        case 'high':
            return '🟠';

        case 'warning':
            return '🟡';

        default:
            return '🔵';
    }
}


// ===========================================
// QUALITY REVIEW MAP
// ===========================================
function initializeQualityReviewMap() {

    const mapElement =
        document.getElementById(
            'gisQualityMap'
        );


    if (
        !mapElement ||
        typeof L ===
            'undefined'
    ) {
        return;
    }


    qualityReviewMap =
        L.map(
            mapElement
        );


    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(
        qualityReviewMap
    );
}


function renderQualityReviewMap() {

    if (
        !qualityReviewMap ||
        !qualityReviewFarm
    ) {
        return;
    }


    qualityIssueLayers.forEach(
        layer => {

            try {
                qualityReviewMap.removeLayer(
                    layer
                );
            } catch (_) {}
        }
    );


    qualityIssueLayers =
        [];


    const farm =
        qualityReviewFarm;


    if (
        farm.geometry
    ) {

        const farmLayer =
            L.geoJSON(
                farm.geometry,
                {
                    style: {
                        weight:
                            3,

                        fillOpacity:
                            0.25
                    }
                }
            ).addTo(
                qualityReviewMap
            );


        qualityIssueLayers.push(
            farmLayer
        );


        if (
            farmLayer
                .getBounds()
                .isValid()
        ) {

            qualityReviewMap.fitBounds(
                farmLayer.getBounds(),
                {
                    padding:
                        [30, 30]
                }
            );
        }
    }


    const issues =
        window._gisQualityIssues ||
        [];


    issues.forEach(
        issue => {

            if (
                !issue.geometry
            ) {
                return;
            }


            try {

                const layer =
                    L.geoJSON(
                        issue.geometry,
                        {
                            style: {
                                weight:
                                    3,

                                fillOpacity:
                                    0.35
                            }
                        }
                    ).addTo(
                        qualityReviewMap
                    );


                qualityIssueLayers.push(
                    layer
                );

            } catch (
                error
            ) {

                console.warn(
                    'Issue geometry error:',
                    error
                );
            }
        }
    );


    setTimeout(
        () =>
            qualityReviewMap.invalidateSize(),
        100
    );
}


// ===========================================
// DECISION
// ===========================================
window.makeGISQualityDecision =
    async function (
        decision
    ) {

        if (
            !qualityReviewFarm
        ) {
            return;
        }


        const issues =
            window._gisQualityIssues ||
            [];


        const critical =
            issues.some(
                issue =>
                    String(
                        issue.severity ||
                        ''
                    ).toLowerCase() ===
                    'critical'
            );


        if (
            decision ===
                'validated' &&
            critical
        ) {

            showNotification(
                'Validation blocked: critical quality issue detected.',
                'error'
            );

            return;
        }


        let reason =
            '';


        if (
            decision ===
            'rejected'
        ) {

            reason =
                prompt(
                    'Enter rejection reason:'
                );


            if (
                !reason ||
                !reason.trim()
            ) {
                return;
            }
        }


        if (
            !confirm(
                decision ===
                    'validated'
                    ? 'Validate this farm?'
                    : 'Reject this farm?'
            )
        ) {
            return;
        }


        await executeQualityDecision(
            decision,
            reason.trim()
        );
    };


// ===========================================
// REQUEST CORRECTION
// ===========================================
window.requestGISCorrection =
    async function () {

        if (
            !qualityReviewFarm
        ) {
            return;
        }


        const reason =
            prompt(
                'Enter correction reason:'
            );


        if (
            !reason ||
            !reason.trim()
        ) {
            return;
        }


        await executeQualityDecision(
            'correction_required',
            reason.trim()
        );
    };


// ===========================================
// EXECUTE QUALITY DECISION
// ===========================================
async function executeQualityDecision(
    decision,
    reason
) {

    try {

        showLoading(true);


        const {
            data,
            error
        } =
            await supabaseClient.rpc(
                'quality_decision',
                {
                    p_farm_id:
                        qualityReviewFarm.id,

                    p_decision:
                        decision,

                    p_reason:
                        reason ||
                        null
                }
            );


        if (error) {
            throw error;
        }


        console.log(
            'Quality decision:',
            data
        );


        showNotification(
            decision ===
                'validated'
                ? 'Farm quality validated successfully.'
                : decision ===
                    'rejected'
                    ? 'Farm rejected successfully.'
                    : 'Correction requested successfully.',
            'success'
        );


        closeGISQualityReview();


        if (
            typeof loadProjectData ===
                'function' &&
            window.currentProject
        ) {

            await loadProjectData(
                window.currentProject.id
            );

        } else if (
            typeof loadSubmissions ===
                'function' &&
            window.currentProject
        ) {

            await loadSubmissions(
                window.currentProject.id
            );
        }


    } catch (
        error
    ) {

        console.error(
            'Quality decision error:',
            error
        );


        showNotification(
            'Quality decision failed: ' +
            error.message,
            'error'
        );


    } finally {

        showLoading(false);
    }
}


// ===========================================
// CLOSE QUALITY REVIEW
// ===========================================
window.closeGISQualityReview =
    function () {

        const modal =
            document.getElementById(
                'gisQualityModal'
            );


        if (
            qualityReviewMap
        ) {

            qualityReviewMap.remove();

            qualityReviewMap =
                null;
        }


        if (modal) {
            modal.remove();
        }


        qualityReviewFarm =
            null;

        qualityReviewResult =
            null;

        qualityIssueLayers =
            [];
    };


// ===========================================
// QUALITY QUEUE
// ===========================================
function renderQualityQueue() {

    const container =
        document.getElementById(
            'qualityQueue'
        );


    if (!container) {
        return;
    }


    const alerts =
        [
            ...protectedAlerts,
            ...polygonAlerts
        ];


    if (
        alerts.length ===
        0
    ) {

        container.innerHTML = `
            <div class="empty-state">

                <i class="fas fa-check-circle"></i>

                <h3>
                    No Quality Alerts
                </h3>

                <p>
                    All farms currently pass
                    the available alert checks.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        alerts
            .map(
                alert => `

                    <div
                        class="quality-queue-row"
                        data-alert-id="${escapeHtml(
                            alert.id
                        )}"
                    >

                        <div class="queue-main">

                            <strong>
                                ${escapeHtml(
                                    alert.title
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    alert.supplier ||
                                    'Unknown'
                                )}
                            </span>

                        </div>


                        <span
                            class="queue-severity ${escapeHtml(
                                alert.severity
                            )}"
                        >
                            ${escapeHtml(
                                alert.severity
                            )}
                        </span>


                        <span
                            class="queue-status ${escapeHtml(
                                alert.status
                            )}"
                        >
                            ${escapeHtml(
                                alert.status
                            )}
                        </span>


                        <button
                            type="button"
                            class="queue-review-btn"
                            onclick="
                                event.stopPropagation();
                                openQualityFromAlertId(
                                    '${escapeHtml(
                                        alert.id
                                    )}'
                                )
                            "
                        >
                            <i class="fas fa-shield-alt"></i>
                            Review
                        </button>

                    </div>
                `
            )
            .join('');
}


// ===========================================
// ALERT → QUALITY REVIEW BRIDGE
// ===========================================
function farmIdFromAlertId(
    alertId
) {

    const id =
        String(
            alertId || ''
        );


    if (
        id.startsWith(
            'self_intersection_'
        )
    ) {

        return id.substring(
            'self_intersection_'
                .length
        );
    }


    if (
        id.startsWith(
            'invalid_geom_'
        )
    ) {

        return id.substring(
            'invalid_geom_'
                .length
        );
    }


    if (
        id.startsWith(
            'duplicate_'
        )
    ) {

        return id.substring(
            'duplicate_'
                .length
        );
    }


    if (
        id.startsWith(
            'protected_overlap_'
        )
    ) {

        const rest =
            id.substring(
                'protected_overlap_'
                    .length
            );


        return rest.split('_')[0] ||
            null;
    }


    if (
        id.startsWith(
            'overlap_'
        )
    ) {

        const rest =
            id.substring(
                'overlap_'
                    .length
            );


        return rest.split('_')[0] ||
            null;
    }


    return null;
}


window.openQualityFromAlertId =
    async function (
        alertId
    ) {

        const farmId =
            farmIdFromAlertId(
                alertId
            );


        if (!farmId) {

            showNotification(
                'Could not identify the farm for this alert.',
                'error'
            );

            return;
        }


        let farm =
            allFarms.find(
                f =>
                    String(f.id) ===
                    String(farmId)
            );


        if (!farm) {

            try {

                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .from('farms')
                        .select('*')
                        .eq(
                            'id',
                            farmId
                        )
                        .maybeSingle();


                if (error) {
                    throw error;
                }


                farm =
                    data;

            } catch (
                error
            ) {

                console.error(
                    error
                );

                showNotification(
                    'Unable to load farm: ' +
                    error.message,
                    'error'
                );

                return;
            }
        }


        if (!farm) {

            showNotification(
                'Farm not found.',
                'error'
            );

            return;
        }


        openGISQualityReview(
            farm.id
        );
    };


// ===========================================
// REVIEW BUTTON IN ALERT CARDS
// ===========================================
function addReviewButtons() {

    document
        .querySelectorAll(
            '.alert-actions'
        )
        .forEach(
            actions => {

                if (
                    actions.querySelector(
                        '.review-quality-btn'
                    )
                ) {
                    return;
                }


                const alertItem =
                    actions.closest(
                        '.alert-item'
                    );


                if (!alertItem) {
                    return;
                }


                const mapButton =
                    actions.querySelector(
                        '.view-map'
                    );


                if (!mapButton) {
                    return;
                }


                const match =
                    mapButton
                        .getAttribute(
                            'onclick'
                        )
                        ?.match(
                            /viewAlertOnMap\(['"]([^'"]+)['"]\)/
                        );


                if (!match) {
                    return;
                }


                const alertId =
                    match[1];


                const button =
                    document.createElement(
                        'button'
                    );


                button.type =
                    'button';


                button.className =
                    'action-btn review-quality-btn';


                button.innerHTML =
                    `
                    <i class="fas fa-shield-alt"></i>
                    Review Quality
                    `;


                button.addEventListener(
                    'click',
                    function (
                        event
                    ) {

                        event.stopPropagation();

                        window.openQualityFromAlertId(
                            alertId
                        );
                    }
                );


                actions.appendChild(
                    button
                );
            }
        );
}


// ===========================================
// MUTATION OBSERVER
// ===========================================
const qualityAlertObserver =
    new MutationObserver(
        addReviewButtons
    );


function startQualityBridge() {

    addReviewButtons();


    const protectedList =
        document.getElementById(
            'protectedAlertsList'
        );


    const polygonList =
        document.getElementById(
            'polygonAlertsList'
        );


    if (
        protectedList
    ) {

        qualityAlertObserver.observe(
            protectedList,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    if (
        polygonList
    ) {

        qualityAlertObserver.observe(
            polygonList,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }
}


if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        startQualityBridge
    );

} else {

    startQualityBridge();
}


// ===========================================
// FINAL GLOBAL EXPORTS
// ===========================================
window.generateAlerts =
    generateAlerts;

window.renderQualityQueue =
    renderQualityQueue;

window.getCurrentQualityRole =
    getCurrentQualityRole;

window.canReviewQuality =
    canReviewQuality;


console.log(
    '✅ Quality Alerts + GIS Quality Review module ready'
);
