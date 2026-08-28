/* =========================================================
   MappingTrace — GIS QUALITY REVIEW MODULE
   Version: 1.0
   Uses:
     - run_full_quality_check()
     - farm_quality
     - farm_quality_issues
     - quality_decision()
   ========================================================= */

(function () {

    console.log('🧭 GIS Quality Review module loading...');

    /* =====================================================
       CONFIGURATION
       ===================================================== */

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

    /* =====================================================
       ROLE
       ===================================================== */

    function getCurrentQualityRole() {

        const role =
            window.currentProjectRole ||
            document.getElementById('userRole')?.textContent ||
            '';

        return String(role)
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_');
    }


    function canReviewQuality() {

        return GIS_QUALITY_ROLES.includes(
            getCurrentQualityRole()
        );

    }


    function isSuperManager() {

        return getCurrentQualityRole() === 'super_manager';

    }


    /* =====================================================
       SAFE HTML
       ===================================================== */

    function safe(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    function number(value, decimals = 2) {

        const n = Number(value);

        if (!Number.isFinite(n)) {
            return '—';
        }

        return n.toFixed(decimals);

    }


    /* =====================================================
       QUALITY STATUS
       ===================================================== */

    function qualityStatusClass(status) {

        switch (
            String(status || '').toLowerCase()
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


    function severityClass(severity) {

        switch (
            String(severity || '').toLowerCase()
        ) {

            case 'critical':
                return 'critical';

            case 'major':
                return 'major';

            case 'warning':
                return 'warning';

            default:
                return 'info';

        }

    }


    function severityIcon(severity) {

        switch (
            String(severity || '').toLowerCase()
        ) {

            case 'critical':
                return '🔴';

            case 'major':
                return '🟠';

            case 'warning':
                return '🟡';

            default:
                return '🔵';

        }

    }


    /* =====================================================
       OPEN QUALITY REVIEW
       ===================================================== */

    window.openGISQualityReview = async function (farmId) {

        const farm =
            (window.farmsData || []).find(
                f => f.id === farmId
            );

        if (!farm) {

            showNotification(
                'Farm not found.',
                'error'
            );

            return;

        }

        qualityReviewFarm = farm;

        createQualityModal();

        await runQualityCheck(farmId);

    };


    /* =====================================================
       CREATE MODAL
       ===================================================== */

    function createQualityModal() {

        document
            .getElementById('gisQualityModal')
            ?.remove();

        const modal =
            document.createElement('div');

        modal.id =
            'gisQualityModal';

        modal.innerHTML = `

            <div class="gis-quality-backdrop"
                 onclick="closeGISQualityReview(event)">

                <div class="gis-quality-panel"
                     onclick="event.stopPropagation()">

                    <div class="gis-quality-header">

                        <div>

                            <div class="gis-quality-kicker">
                                GIS QUALITY CONTROL
                            </div>

                            <h2>
                                <i class="fas fa-shield-alt"></i>
                                Quality Review
                            </h2>

                            <div
                                class="gis-quality-farm-name"
                                id="gisQualityFarmName">
                                Loading...
                            </div>

                        </div>

                        <button
                            class="gis-quality-close"
                            onclick="closeGISQualityReview()">

                            <i class="fas fa-times"></i>

                        </button>

                    </div>


                    <div class="gis-quality-body">

                        <div class="gis-quality-grid">


                            <!-- FARM INFORMATION -->

                            <div class="gis-quality-card">

                                <div class="gis-quality-card-title">
                                    <i class="fas fa-clipboard"></i>
                                    Farm Information
                                </div>

                                <div
                                    id="gisQualityFarmInfo">
                                    Loading...
                                </div>

                            </div>


                            <!-- SCORE -->

                            <div class="gis-quality-card score-card">

                                <div class="gis-quality-card-title">
                                    <i class="fas fa-chart-line"></i>
                                    Quality Score
                                </div>

                                <div
                                    id="gisQualityScore"
                                    class="quality-score-large">
                                    —
                                </div>

                                <div
                                    id="gisQualityStatus"
                                    class="quality-status-badge">
                                    Checking...
                                </div>

                            </div>


                        </div>


                        <!-- COMPONENT SCORES -->

                        <div class="gis-quality-card">

                            <div class="gis-quality-card-title">
                                <i class="fas fa-layer-group"></i>
                                Quality Components
                            </div>

                            <div
                                id="gisQualityComponents"
                                class="quality-components">
                            </div>

                        </div>


                        <!-- MAP -->

                        <div class="gis-quality-card">

                            <div class="gis-quality-card-title">

                                <span>
                                    <i class="fas fa-map-marked-alt"></i>
                                    GIS Review Map
                                </span>

                                <button
                                    class="quality-refresh-btn"
                                    onclick="runCurrentGISQualityCheck()">

                                    <i class="fas fa-sync-alt"></i>
                                    Run Check

                                </button>

                            </div>

                            <div
                                id="gisQualityMap"
                                class="gis-quality-map">
                            </div>

                        </div>


                        <!-- ISSUES -->

                        <div class="gis-quality-card">

                            <div class="gis-quality-card-title">

                                <span>
                                    <i class="fas fa-exclamation-triangle"></i>
                                    Detected Issues
                                </span>

                                <span
                                    id="gisQualityIssueCount"
                                    class="issue-count">
                                    0
                                </span>

                            </div>

                            <div
                                id="gisQualityIssues"
                                class="gis-quality-issues">
                            </div>

                        </div>


                    </div>


                    <!-- ACTIONS -->

                    <div
                        id="gisQualityActions"
                        class="gis-quality-actions">
                    </div>

                </div>

            </div>
        `;

        document.body.appendChild(modal);
renderFarmHeader();

    }


    /* =====================================================
       FARM HEADER
       ===================================================== */

    function renderFarmHeader() {

        if (!qualityReviewFarm) {
            return;
        }

        const farm =
            qualityReviewFarm;

        const name =
            farm.farmer_name ||
            'Unknown Farmer';

        const info =
            document.getElementById(
                'gisQualityFarmInfo'
            );

        const title =
            document.getElementById(
                'gisQualityFarmName'
            );

        if (title) {

            title.textContent =
                name;

        }

        if (info) {

            info.innerHTML = `

                <div class="quality-info-row">
                    <span>Farmer</span>
                    <strong>${safe(name)}</strong>
                </div>

                <div class="quality-info-row">
                    <span>Farmer ID</span>
                    <strong>${safe(farm.farmer_id || '—')}</strong>
                </div>

                <div class="quality-info-row">
                    <span>Cooperative</span>
                    <strong>${safe(farm.cooperative || '—')}</strong>
                </div>

                <div class="quality-info-row">
                    <span>Area</span>
                    <strong>${number(farm.area)} ha</strong>
                </div>

                <div class="quality-info-row">
                    <span>Workflow</span>
                    <strong>${safe(
                        workflowLabelForQuality(
                            farm.workflow_state
                        )
                    )}</strong>
                </div>

            `;

        }

    }


    function workflowLabelForQuality(state) {

        const labels = {

            submitted:
                'Submitted',

            enumerator_review:
                'Enumerator Review',

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

        return labels[state] ||
            state ||
            'Unknown';

    }


    /* =====================================================
       RUN FULL QUALITY CHECK
       ===================================================== */

    async function runQualityCheck(farmId) {

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
            } = await supabaseClient.rpc(
                'run_full_quality_check',
                {
                    p_farm_id: farmId
                }
            );

            if (error) {
                throw error;
            }

            qualityReviewResult =
                data;

            renderQualityResult(data);

            await loadQualityIssues(farmId);

        } catch (error) {

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
                            ${safe(error.message)}
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


    window.runCurrentGISQualityCheck =
        function () {

            if (
                !qualityReviewFarm
            ) {
                return;
            }

            runQualityCheck(
                qualityReviewFarm.id
            );

        };


    /* =====================================================
       RENDER SCORE
       ===================================================== */

    function renderQualityResult(result) {

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
                    qualityStatusClass(status)
                }`;

            statusBox.textContent =
                status === 'passed'
                    ? 'PASSED'
                    : status === 'review_required'
                        ? 'REVIEW REQUIRED'
                        : status === 'issues_detected'
                            ? 'ISSUES DETECTED'
                            : status.toUpperCase();

        }


        const scoreDetails =
            result?.score_details || {};

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
            rows.map(
                ([label, value]) => {

                    const n =
                        Number(value);

                    return `

                        <div class="quality-component">

                            <div class="quality-component-top">

                                <span>
                                    ${safe(label)}
                                </span>

                                <strong>
                                    ${
                                        Number.isFinite(n)
                                            ? n.toFixed(0)
                                            : '—'
                                    }
                                </strong>

                            </div>

                            <div class="quality-progress">

                                <div
                                    class="quality-progress-bar"
                                    style="width:${
                                        Math.max(
                                            0,
                                            Math.min(
                                                100,
                                                Number.isFinite(n)
                                                    ? n
                                                    : 0
                                            )
                                        )
                                    }%">
                                </div>

                            </div>

                        </div>

                    `;

                }
            ).join('');

    }


    /* =====================================================
       LOAD ISSUES
       ===================================================== */

    async function loadQualityIssues(
        farmId
    ) {

        const {
            data,
            error
        } = await supabaseClient
            .from('farm_quality_issues')
            .select('*')
            .eq('farm_id', farmId)
            .order(
                'severity',
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                'Issue loading error:',
                error
            );

            return;

        }

        const issues =
            data || [];

        renderQualityIssues(
            issues
        );

        renderQualityIssueMap(
            issues
        );

        renderQualityActions(
            issues
        );

    }


    /* =====================================================
       RENDER ISSUES
       ===================================================== */

    function renderQualityIssues(
        issues
    ) {

        const container =
            document.getElementById(
                'gisQualityIssues'
            );

        const count =
            document.getElementById(
                'gisQualityIssueCount'
            );

        if (count) {

            count.textContent =
                issues.length;

        }

        if (!container) {
            return;
        }

        if (!issues.length) {

            container.innerHTML = `

                <div class="quality-no-issues">

                    <i class="fas fa-check-circle"></i>

                    <div>

                        <strong>
                            No open quality issues detected
                        </strong>

                        <span>
                            Geometry and spatial checks passed.
                        </span>

                    </div>

                </div>

            `;

            return;

        }

        container.innerHTML =
            issues.map(
                (issue, index) => {

                    const severity =
                        severityClass(
                            issue.severity
                        );

                    return `

                        <div
                            class="quality-issue ${severity}"
                            data-issue-index="${index}">

                            <div class="quality-issue-main">

                                <div class="quality-issue-icon">

                                    ${severityIcon(
                                        issue.severity
                                    )}

                                </div>

                                <div>

                                    <div
                                        class="quality-issue-title">

                                        ${safe(
                                            issue.title ||
                                            issue.issue_type ||
                                            'Quality Issue'
                                        )}

                                    </div>

                                    <div
                                        class="quality-issue-description">

                                        ${safe(
                                            issue.description ||
                                            ''
                                        )}

                                    </div>

                                </div>

                            </div>

                            <div class="quality-issue-meta">

                                <span>
                                    ${safe(
                                        issue.severity ||
                                        'warning'
                                    )}
                                </span>

                                ${
                                    issue.latitude &&
                                    issue.longitude
                                        ? `
                                            <button
                                                onclick="locateGISQualityIssue(${index})"
                                                class="locate-issue-btn">

                                                <i class="fas fa-crosshairs"></i>
                                                Locate

                                            </button>
                                          `
                                        : ''
                                }

                            </div>

                        </div>

                    `;

                }
            ).join('');

        window._gisQualityIssues =
            issues;

    }


    /* =====================================================
       ISSUE MAP
       ===================================================== */

    function renderQualityIssueMap(
        issues
    ) {

        const container =
            document.getElementById(
                'gisQualityMap'
            );

        if (!container) {
            return;
        }

        if (
            typeof L === 'undefined'
        ) {

            container.innerHTML =
                '<div class="quality-error">Leaflet is not loaded.</div>';

            return;

        }

        if (qualityReviewMap) {

            qualityReviewMap.remove();

            qualityReviewMap =
                null;

        }

        qualityIssueLayers = [];

        qualityReviewMap =
            L.map(
                container,
                {
                    zoomControl: true
                }
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
            qualityReviewMap
        );

        const bounds =
            L.latLngBounds();


        /* Farm boundary */

        if (
            qualityReviewFarm?.geometry
        ) {

            try {

                const farmLayer =
                    L.geoJSON(
                        {
                            type: 'Feature',
                            geometry:
                                qualityReviewFarm.geometry,
                            properties: {}
                        },
                        {
                            style: {
                                color: '#2563eb',
                                weight: 3,
                                fillOpacity: 0.08
                            }
                        }
                    ).addTo(
                        qualityReviewMap
                    );

                if (
                    farmLayer.getBounds().isValid()
                ) {

                    bounds.extend(
                        farmLayer.getBounds()
                    );

                }

            } catch (error) {

                console.warn(
                    'Farm geometry could not be displayed',
                    error
                );

            }

        }


        /* Issue points */

        issues.forEach(
            (issue, index) => {

                const lat =
                    Number(
                        issue.latitude
                    );

                const lng =
                    Number(
                        issue.longitude
                    );

                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lng)
                ) {
                    return;
                }

                const color =
                    String(
                        issue.severity
                    ).toLowerCase() === 'critical'
                        ? '#dc2626'
                        : String(
                            issue.severity
                        ).toLowerCase() === 'major'
                            ? '#f97316'
                            : '#eab308';

                const marker =
                    L.circleMarker(
                        [lat, lng],
                        {
                            radius: 8,
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.9,
                            weight: 2
                        }
                    )
                    .addTo(
                        qualityReviewMap
                    );

                marker.bindPopup(`

                    <strong>
                        ${safe(
                            issue.title ||
                            issue.issue_type
                        )}
                    </strong>

                    <br>

                    ${safe(
                        issue.description ||
                        ''
                    )}

                    <br><br>

                    <strong>
                        ${lat.toFixed(6)},
                        ${lng.toFixed(6)}
                    </strong>

                `);

                marker._qualityIssueIndex =
                    index;

                qualityIssueLayers.push(
                    marker
                );

                bounds.extend(
                    [lat, lng]
                );

            }
        );


        if (
            bounds.isValid()
        ) {

            qualityReviewMap.fitBounds(
                bounds,
                {
                    padding: [
                        40,
                        40
                    ]
                }
            );

        } else {

            qualityReviewMap.setView(
                [7.54, -5.55],
                7
            );

        }

        setTimeout(
            () => qualityReviewMap.invalidateSize(),
            200
        );

    }


    /* =====================================================
       LOCATE ISSUE
       ===================================================== */

    window.locateGISQualityIssue =
        function (index) {

            const issue =
                (
                    window._gisQualityIssues ||
                    []
                )[index];

            if (
                !issue ||
                !qualityReviewMap
            ) {
                return;
            }

            const lat =
                Number(
                    issue.latitude
                );

            const lng =
                Number(
                    issue.longitude
                );

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {
                return;
            }

            qualityReviewMap.setView(
                [lat, lng],
                18,
                {
                    animate: true
                }
            );

            const marker =
                qualityIssueLayers.find(
                    m =>
                        m._qualityIssueIndex ===
                        index
                );

            if (marker) {

                marker.openPopup();

            }

        };


    /* =====================================================
       ACTION BUTTONS
       ===================================================== */

    function renderQualityActions(
        issues
    ) {

        const container =
            document.getElementById(
                'gisQualityActions'
            );

        if (!container) {
            return;
        }

        const role =
            getCurrentQualityRole();

        const critical =
            issues.some(
                i =>
                    String(
                        i.severity
                    ).toLowerCase() ===
                    'critical'
            );

        const workflow =
            qualityReviewFarm?.workflow_state;

        /*
         * Super Manager is READ ONLY.
         */

        if (
            isSuperManager() ||
            READ_ONLY_ROLES.includes(role)
        ) {

            container.innerHTML = `

                <div class="quality-readonly">

                    <i class="fas fa-eye"></i>

                    Read-only quality view

                </div>

            `;

            return;

        }


        /*
         * Only GIS / Validator / Manager
         * can make quality decisions.
         */

        if (
            !GIS_QUALITY_ROLES.includes(role)
        ) {

            container.innerHTML = `

                <div class="quality-readonly">

                    <i class="fas fa-lock"></i>

                    You do not have permission
                    to make GIS quality decisions.

                </div>

            `;

            return;

        }


        /*
         * If critical issue exists:
         * validation is blocked.
         */

        const validateDisabled =
            critical ||
            ![
                'gis_compliance_review',
                'final_validation'
            ].includes(
                workflow
            );


        container.innerHTML = `

            <div class="quality-action-info">

                ${
                    critical
                        ? `
                            <span class="blocked">
                                <i class="fas fa-ban"></i>
                                Validation blocked:
                                critical issue detected
                            </span>
                          `
                        : `
                            <span class="allowed">
                                <i class="fas fa-check-circle"></i>
                                No critical quality issue detected
                            </span>
                          `
                }

            </div>


            <div class="quality-action-buttons">

                <button
                    class="quality-btn correction"
                    onclick="requestGISQualityCorrection()">

                    <i class="fas fa-redo"></i>

                    Request Correction

                </button>


                <button
                    class="quality-btn reject"
                    onclick="makeGISQualityDecision('rejected')">

                    <i class="fas fa-times"></i>

                    Reject

                </button>


                <button
                    class="quality-btn validate"
                    ${
                        validateDisabled
                            ? 'disabled title="Validation blocked"'
                            : ''
                    }
                    onclick="makeGISQualityDecision('validated')">

                    <i class="fas fa-check-circle"></i>

                    Validate

                </button>

            </div>

        `;

    }


    /* =====================================================
       REQUEST CORRECTION
       ===================================================== */

    window.requestGISQualityCorrection =
        async function () {

            if (!qualityReviewFarm) {
                return;
            }

            const reason =
                prompt(
                    'Enter the correction reason:'
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


    /* =====================================================
       QUALITY DECISION
       ===================================================== */

    window.makeGISQualityDecision =
        async function (decision) {

            if (!qualityReviewFarm) {
                return;
            }

            const issues =
                window._gisQualityIssues ||
                [];

            const critical =
                issues.some(
                    i =>
                        String(
                            i.severity
                        ).toLowerCase() ===
                        'critical'
                );

            if (
                decision === 'validated' &&
                critical
            ) {

                showNotification(
                    'Validation blocked: critical quality issue detected.',
                    'error'
                );

                return;

            }

            let reason = '';

            if (
                decision === 'rejected'
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
                    decision === 'validated'
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


    /* =====================================================
       EXECUTE DECISION
       ===================================================== */

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
                            reason || null
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
                decision === 'validated'
                    ? 'Farm quality validated successfully.'
                    : decision === 'rejected'
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

        } catch (error) {

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


    /* =====================================================
       CLOSE
       ===================================================== */

    window.closeGISQualityReview =
        function () {

            const modal =
                document.getElementById(
                    'gisQualityModal'
                );

            if (qualityReviewMap) {

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

        };


    /* =====================================================
       UPGRADE EXISTING VIEW FARM BUTTON
       ===================================================== */

    window.viewFarm =
        function (farmId) {

            openGISQualityReview(
                farmId
            );

        };


    /* =====================================================
       INITIALIZATION SAFETY
       ===================================================== */

    console.log(
        '✅ GIS Quality Review module ready'
    );

})();

    /* =====================================================
       ALERT → GIS QUALITY REVIEW BRIDGE
       Keeps the existing Quality Alerts dashboard intact,
       but adds a direct Review Quality action to every alert.
       ===================================================== */
    (function () {

        function farmIdFromAlertId(alertId) {
            const id = String(alertId || '');

            if (id.startsWith('self_intersection_')) {
                return id.substring('self_intersection_'.length);
            }

            if (id.startsWith('invalid_geom_')) {
                return id.substring('invalid_geom_'.length);
            }

            if (id.startsWith('duplicate_')) {
                return id.substring('duplicate_'.length);
            }

            if (id.startsWith('protected_overlap_')) {
                const rest = id.substring('protected_overlap_'.length);
                const parts = rest.split('_');
                return parts[0] || null;
            }

            if (id.startsWith('overlap_')) {
                const rest = id.substring('overlap_'.length);
                const parts = rest.split('_');
                return parts[0] || null;
            }

            return null;
        }

        window.openQualityFromAlertId = async function (alertId) {

            const farmId = farmIdFromAlertId(alertId);

            if (!farmId) {
                showNotification('Could not identify the farm for this alert.', 'error');
                return;
            }

            /* Prefer already loaded farm data. */
            let farm = null;

            try {
                if (typeof allFarms !== 'undefined' && Array.isArray(allFarms)) {
                    farm = allFarms.find(f => String(f.id) === String(farmId));
                }
            } catch (_) {}

            /* Fallback to Supabase if the farm isn't in memory. */
            if (!farm) {
                try {
                    const { data, error } = await supabaseClient
                        .from('farms')
                        .select('*')
                        .eq('id', farmId)
                        .maybeSingle();

                    if (error) throw error;
                    farm = data;
                } catch (error) {
                    console.error('Unable to load farm for quality review:', error);
                    showNotification('Unable to load farm: ' + error.message, 'error');
                    return;
                }
            }

            if (!farm) {
                showNotification('Farm not found.', 'error');
                return;
            }

            openGISQualityReview(farm.id);
        };

        function addReviewButtons() {
            document.querySelectorAll('.alert-actions').forEach(actions => {

                if (actions.querySelector('.review-quality-btn')) return;

                const alertItem = actions.closest('.alert-item');
                if (!alertItem) return;

                const mapButton = actions.querySelector('.view-map');
                if (!mapButton) return;

                const match = mapButton.getAttribute('onclick')?.match(
                    /viewAlertOnMap\(['"]([^'"]+)['"]\)/
                );

                if (!match) return;

                const alertId = match[1];
                const button = document.createElement('button');

                button.type = 'button';
                button.className = 'action-btn review-quality-btn';
                button.innerHTML = '<i class="fas fa-shield-alt"></i> Review Quality';
                button.addEventListener('click', function (event) {
                    event.stopPropagation();
                    window.openQualityFromAlertId(alertId);
                });

                actions.appendChild(button);
            });
        }

        const observer = new MutationObserver(addReviewButtons);

        function startQualityBridge() {
            addReviewButtons();

            const protectedList = document.getElementById('protectedAlertsList');
            const polygonList = document.getElementById('polygonAlertsList');

            if (protectedList) {
                observer.observe(protectedList, { childList: true, subtree: true });
            }

            if (polygonList) {
                observer.observe(polygonList, { childList: true, subtree: true });
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startQualityBridge);
        } else {
            startQualityBridge();
        }

    })();
