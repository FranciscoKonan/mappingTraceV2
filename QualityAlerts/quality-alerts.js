(() => {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const SUPABASE_URL =
    "https://crvnohvudurqfukjpisv.supabase.co";

  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8";


  // ============================================================
  // APPLICATION STATE
  // ============================================================

  let supabaseClient = null;

  let currentUser = null;
  let currentProject = null;
  let currentProjectUserRole = null;

  let farms = [];
  let issues = [];

  let currentFarm = null;
  let currentResult = null;
  let currentMap = null;


  // ============================================================
  // DOM HELPERS
  // ============================================================

  const $ = id => document.getElementById(id);


  // ============================================================
  // GENERAL HELPERS
  // ============================================================

  const esc = value =>
    String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
    );


  const lower = value =>
    String(value ?? "").trim().toLowerCase();


  const sev = issue =>
    lower(issue?.severity);


  const kind = issue =>
    lower(issue?.issue_type);


  const workflowOf = farm =>
    lower(
      farm?.workflow_state ||
      farm?.status
    );


  // ============================================================
  // ROLE / WORKFLOW CONFIGURATION
  // ============================================================

  /*
   * These are the workflow states used by the application.
   *
   * The important point is that the queue is no longer
   * hard-coded to gis_compliance_review.
   */

  const ROLE_STATES = {

    enumerator: [
      "enumerator_review",
      "correction_required"
    ],

    field_officer: [
      "field_officer_review",
      "correction_required"
    ],

    validator: [
      "gis_compliance_review"
    ],

    manager: [
      "final_validation",
      "gis_compliance_review"
    ],

    owner: [
      "enumerator_review",
      "field_officer_review",
      "gis_compliance_review",
      "final_validation",
      "correction_required"
    ],

    super_manager: [
      "enumerator_review",
      "field_officer_review",
      "gis_compliance_review",
      "final_validation",
      "correction_required"
    ]
  };


  /*
   * Roles allowed to open the Quality Review page.
   */

  const ALLOWED_ROLES = [
    "enumerator",
    "field_officer",
    "validator",
    "manager",
    "owner",
    "super_manager"
  ];


  function getRoleStates() {

    const role =
      currentProjectUserRole;

    return ROLE_STATES[role] || [];
  }


  function farmBelongsToCurrentQueue(farm) {

    const workflow =
      workflowOf(farm);

    return getRoleStates()
      .includes(workflow);
  }


  // ============================================================
  // DECISION PERMISSIONS
  // ============================================================

  /*
   * Decision permissions are deliberately conservative.
   *
   * Enumerator / Field Officer:
   *     can request correction.
   *
   * Validator:
   *     can request correction, reject or validate.
   *
   * Manager / Owner / Super Manager:
   *     can use the same decision controls.
   */

  function canRequestCorrection() {

    return [
      "enumerator",
      "field_officer",
      "validator",
      "manager",
      "owner",
      "super_manager"
    ].includes(
      currentProjectUserRole
    );
  }


  function canReject() {

    return [
      "validator",
      "manager",
      "owner",
      "super_manager"
    ].includes(
      currentProjectUserRole
    );
  }


  function canValidate() {

    return [
      "validator",
      "manager",
      "owner",
      "super_manager"
    ].includes(
      currentProjectUserRole
    );
  }


  // ============================================================
  // INITIALIZATION
  // ============================================================

  document.addEventListener(
    "DOMContentLoaded",
    init
  );


  async function init() {

    showLoading(true);

    try {

      initializeSidebar();

      // --------------------------------------------------------
      // SUPABASE
      // --------------------------------------------------------

      if (
        !window.supabase ||
        !window.supabase.createClient
      ) {

        throw new Error(
          "Supabase library did not load."
        );
      }


      supabaseClient =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY
        );


      // --------------------------------------------------------
      // AUTHENTICATION
      // --------------------------------------------------------

      const sessionResult =
        await supabaseClient.auth.getSession();


      if (sessionResult.error) {
        throw sessionResult.error;
      }


      const session =
        sessionResult.data?.session;


      if (!session?.user) {

        location.href =
          "../login.html";

        return;
      }


      currentUser =
        session.user;


      // --------------------------------------------------------
      // PROFILE
      // --------------------------------------------------------

      await loadProfile();


      // --------------------------------------------------------
      // PROJECT / ROLE
      // --------------------------------------------------------

      await resolveProject();


      // --------------------------------------------------------
      // ROLE AUTHORIZATION
      // --------------------------------------------------------

      if (
        !ALLOWED_ROLES.includes(
          currentProjectUserRole
        )
      ) {

        notify(
          "You do not have access to Quality Review.",
          "error"
        );

        setTimeout(() => {

          location.href =
            "../Dashboard.html";

        }, 1000);

        return;
      }


      // --------------------------------------------------------
      // UPDATE UI FOR ROLE
      // --------------------------------------------------------

      updateRoleUI();


      // --------------------------------------------------------
      // LOAD DATA
      // --------------------------------------------------------

      await loadQualityData();


      bind();

      render();


    } catch (error) {

      console.error(
        "Quality Control initialization error:",
        error
      );

      notify(
        error?.message ||
        String(error),
        "error"
      );

    } finally {

      showLoading(false);

    }
  }


  // ============================================================
  // PROFILE
  // ============================================================

  async function loadProfile() {

    const result =
      await supabaseClient
        .from("user_profiles")
        .select(
          "first_name,email"
        )
        .eq(
          "id",
          currentUser.id
        )
        .maybeSingle();


    if (result.error) {

      throw new Error(
        "user_profiles: " +
        result.error.message
      );

    }


    const firstName =
      result.data?.first_name ||
      currentUser.email?.split("@")[0] ||
      "User";


    if ($("userName")) {

      $("userName").textContent =
        firstName;

    }


    if ($("userAvatar")) {

      $("userAvatar").textContent =
        firstName
          .slice(0, 2)
          .toUpperCase();

    }
  }


  // ============================================================
  // PROJECT / ROLE
  // ============================================================

  async function resolveProject() {

    const result =
      await supabaseClient
        .from("project_members")
        .select(
          "project_id,role,projects(*)"
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .eq(
          "status",
          "active"
        );


    if (result.error) {

      throw new Error(
        "project_members: " +
        result.error.message
      );

    }


    if (!result.data?.length) {

      throw new Error(
        "No active project membership found."
      );

    }


    const urlProject =
      new URLSearchParams(
        location.search
      ).get("project");


    const savedProject =
      localStorage.getItem(
        "lastProject_" +
        currentUser.id
      );


    const membership =
      result.data.find(
        item =>
          String(item.project_id) ===
          String(urlProject)
      ) ||

      result.data.find(
        item =>
          String(item.project_id) ===
          String(savedProject)
      ) ||

      result.data[0];


    if (!membership) {

      throw new Error(
        "No valid project membership found."
      );

    }


    currentProject =
      membership.projects;


    currentProjectUserRole =
      lower(
        membership.role
      );


    localStorage.setItem(
      "lastProject_" +
      currentUser.id,
      currentProject.id
    );


    if ($("projectBadge")) {

      $("projectBadge").textContent =
        currentProject.name;

    }


    if ($("selectedProjectName")) {

      $("selectedProjectName").textContent =
        currentProject.name;

    }


    if ($("userRole")) {

      $("userRole").textContent =
        currentProjectUserRole
          .replaceAll("_", " ")
          .toUpperCase();

    }


    const url =
      new URL(location.href);

    url.searchParams.set(
      "project",
      currentProject.id
    );

    history.replaceState(
      {},
      "",
      url
    );


    console.log(
      "Quality Review role:",
      currentProjectUserRole
    );

    console.log(
      "Quality Review project:",
      currentProject?.id
    );
  }


  // ============================================================
  // ROLE UI
  // ============================================================

  function updateRoleUI() {

    const role =
      currentProjectUserRole;


    /*
     * If the current role is not allowed to validate,
     * disable the validation button.
     */

    const validateBtn =
      $("qcValidateBtn");


    if (validateBtn) {

      validateBtn.style.display =
        canValidate()
          ? ""
          : "none";

    }


    /*
     * Reject is validator/manager level.
     */

    const rejectButtons =
      document.querySelectorAll(
        ".qc-decision.reject"
      );


    rejectButtons.forEach(button => {

      button.style.display =
        canReject()
          ? ""
          : "none";

    });


    /*
     * Correction is available to all operational
     * review roles.
     */

    const correctionButtons =
      document.querySelectorAll(
        ".qc-decision.correction"
      );


    correctionButtons.forEach(button => {

      button.style.display =
        canRequestCorrection()
          ? ""
          : "none";

    });


    console.log(
      "Role configuration applied:",
      role
    );
  }


  // ============================================================
  // LOAD QUALITY DATA
  // ============================================================

  async function loadQualityData() {

    console.log(
      "=== QUALITY REVIEW DATA ==="
    );

    console.log(
      "Project:",
      currentProject?.id
    );

    console.log(
      "Role:",
      currentProjectUserRole
    );

    console.log(
      "Allowed workflow states:",
      getRoleStates()
    );


    // ----------------------------------------------------------
    // FARMS
    // ----------------------------------------------------------

    const farmResult =
      await supabaseClient
        .from("farms")
        .select("*")
        .eq(
          "project_id",
          currentProject.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (farmResult.error) {

      console.error(
        "Farms query error:",
        farmResult.error
      );

      throw farmResult.error;

    }


    farms =
      farmResult.data || [];


    console.log(
      "Loaded farms:",
      farms.length
    );


    // ----------------------------------------------------------
    // QUALITY ISSUES
    // ----------------------------------------------------------

    issues = [];


    /*
     * Keep batches reasonably small.
     */

    for (
      let index = 0;
      index < farms.length;
      index += 200
    ) {

      const farmIds =
        farms
          .slice(
            index,
            index + 200
          )
          .map(
            farm => farm.id
          );


      if (!farmIds.length) {
        continue;
      }


      const issueResult =
        await supabaseClient
          .from("farm_quality_issues")
          .select("*")
          .in(
            "farm_id",
            farmIds
          );


      if (issueResult.error) {

        throw issueResult.error;

      }


      issues.push(
        ...(issueResult.data || [])
      );
    }


    console.log(
      "Loaded quality issues:",
      issues.length
    );
  }


  // ============================================================
  // EVENTS
  // ============================================================

  function bind() {

    $("qcStatusFilter")
      ?.addEventListener(
        "change",
        renderQueue
      );


    $("qcTypeFilter")
      ?.addEventListener(
        "change",
        renderQueue
      );


    $("refreshBtn")
      ?.addEventListener(
        "click",
        refreshAll
      );


    $("logoutBtn")
      ?.addEventListener(
        "click",
        async event => {

          event.preventDefault();

          await supabaseClient.auth.signOut();

          location.href =
            "../login.html";

        }
      );


    /*
     * Escape key closes modal.
     */

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape"
        ) {

          closeQualityReview();

        }

      }
    );
  }


  // ============================================================
  // SIDEBAR
  // ============================================================

  function initializeSidebar() {

    const sidebar =
      $("sidebar");

    const toggle =
      $("sidebarToggle");

    const overlay =
      $("sidebarOverlay");


    toggle?.addEventListener(
      "click",
      () => {

        sidebar?.classList.toggle(
          "collapsed"
        );

      }
    );


    overlay?.addEventListener(
      "click",
      () => {

        sidebar?.classList.remove(
          "mobile-open"
        );

        overlay?.classList.remove(
          "active"
        );

      }
    );
  }


  // ============================================================
  // RENDER
  // ============================================================

  function render() {

    renderStats();

    renderQueue();

  }


  // ============================================================
  // STATISTICS
  // ============================================================

 function renderStats() {
  const issueMap = new Map();

  issues.forEach(issue => {
    if (!issueMap.has(issue.farm_id)) {
      issueMap.set(issue.farm_id, []);
    }

    issueMap.get(issue.farm_id).push(issue);
  });

  let critical = 0;
  let warning = 0;
  let passed = 0;
  let pending = 0;

  /*
   * IMPORTANT:
   * Statistics are project-wide.
   *
   * Validator must be able to see the complete QC picture,
   * not only farms currently in gis_compliance_review.
   */
  farms.forEach(farm => {
    const farmIssues =
      issueMap.get(farm.id) || [];

    const hasCritical =
      farmIssues.some(
        issue => sev(issue) === "critical"
      );

    const hasWarning =
      farmIssues.some(
        issue =>
          ["warning", "high", "medium"]
            .includes(sev(issue))
      );

    /*
     * "Pending Review" means this farm is currently
     * waiting for the logged-in user's workflow stage.
     */
    if (farmBelongsToCurrentQueue(farm)) {
      pending++;
    }

    /*
     * QC severity is calculated for ALL project farms.
     */
    if (hasCritical) {
      critical++;
    } else if (hasWarning) {
      warning++;
    } else {
      passed++;
    }
  });

  if ($("pendingCount")) {
    $("pendingCount").textContent = pending;
  }

  if ($("criticalCount")) {
    $("criticalCount").textContent = critical;
  }

  if ($("warningCount")) {
    $("warningCount").textContent = warning;
  }

  if ($("passedCount")) {
    $("passedCount").textContent = passed;
  }

  if ($("totalFarmsCount")) {
    $("totalFarmsCount").textContent =
      farms.length;
  }
}

  // ============================================================
  // ISSUE TYPE FILTER
  // ============================================================

  function matchesIssue(
    issue,
    type
  ) {

    const value =
      kind(issue);


    if (
      type === "protected"
    ) {

      return value.includes(
        "protected"
      );

    }


    if (
      type === "overlap"
    ) {

      return value.includes(
        "overlap"
      );

    }


    if (
      type === "geometry"
    ) {

      return (
        value.includes(
          "geometry"
        ) ||

        value.includes(
          "spike"
        ) ||

        value.includes(
          "self"
        )
      );

    }


    /*
     * Other QC.
     */

    if (
      type === "other"
    ) {

      return (
        !value.includes(
          "protected"
        ) &&

        !value.includes(
          "overlap"
        ) &&

        !value.includes(
          "geometry"
        ) &&

        !value.includes(
          "spike"
        ) &&

        !value.includes(
          "self"
        )
      );

    }


    return true;
  }


  // ============================================================
  // QUALITY QUEUE
  // ============================================================

function renderQueue() {
  const statusFilter =
    $("qcStatusFilter")?.value || "all";

  const typeFilter =
    $("qcTypeFilter")?.value || "all";

  const rows = [];

  farms.forEach(farm => {
    const workflow =
      workflowOf(farm);

    /*
     * OWNER / SUPER MANAGER:
     * See the complete QC queue.
     *
     * VALIDATOR:
     * See all QC results, but farms requiring
     * Validator action are naturally prioritized.
     *
     * ENUMERATOR / FIELD OFFICER:
     * See their own workflow queue.
     */

    const isAdminRole =
      [
        "owner",
        "super_manager",
        "manager"
      ].includes(
        currentProjectUserRole
      );

    const isValidator =
      currentProjectUserRole ===
      "validator";

    const isCurrentQueue =
      farmBelongsToCurrentQueue(
        farm
      );

    /*
     * Validator can VIEW all farms.
     * Other operational roles remain limited
     * to their assigned review states.
     */
    if (
      !isAdminRole &&
      !isValidator &&
      !isCurrentQueue
    ) {
      return;
    }

    const farmIssues =
      issues.filter(
        issue =>
          String(issue.farm_id) ===
          String(farm.id)
      );

    const hasCritical =
      farmIssues.some(
        issue =>
          sev(issue) === "critical"
      );

    const hasWarning =
      farmIssues.some(
        issue =>
          [
            "warning",
            "high",
            "medium"
          ].includes(
            sev(issue)
          )
      );

    const status =
      hasCritical
        ? "critical"
        : hasWarning
          ? "warning"
          : "passed";

    /*
     * Pending means the farm is awaiting action
     * from the current user's workflow stage.
     *
     * For Validator this means:
     * gis_compliance_review
     */
    const pending =
      isCurrentQueue;

    // ----------------------------------------------------------
    // STATUS FILTER
    // ----------------------------------------------------------

    if (
      statusFilter === "pending" &&
      !pending
    ) {
      return;
    }

    if (
      statusFilter !== "all" &&
      statusFilter !== "pending" &&
      statusFilter !== status
    ) {
      return;
    }

    // ----------------------------------------------------------
    // ISSUE TYPE FILTER
    // ----------------------------------------------------------

    if (
      typeFilter !== "all" &&
      !farmIssues.some(
        issue =>
          matchesIssue(
            issue,
            typeFilter
          )
      )
    ) {
      return;
    }

    rows.push({
      f: farm,
      a: farmIssues,
      status,
      pending,
      currentQueue: isCurrentQueue
    });
  });

  /*
   * Put farms requiring Validator action first.
   *
   * This means Validator still gets the complete
   * Quality Alerts view, but the actionable queue
   * stays at the top.
   */
  if (
    currentProjectUserRole ===
    "validator"
  ) {
    rows.sort(
      (a, b) =>
        Number(b.currentQueue) -
        Number(a.currentQueue)
    );
  }

  const container =
    $("qcQueueBody");

  if (!container) {
    return;
  }

  container.innerHTML =
    rows.length

      ? rows
          .map(queueRow)
          .join("")

      : `
        <div class="qc-empty">
          <i class="fas fa-circle-check"></i>

          <h3>
            Queue is clear
          </h3>

          <p>
            No farms match the current QC filters.
          </p>
        </div>
      `;
}


  // ============================================================
  // QUEUE ROW
  // ============================================================

  function queueRow(item) {

    const issue =
      item.a[0] || {};


    const area =
      item.f.area_ha ??
      item.f.area;


    return `

      <div
        class="qc-table-row qc-row"
        onclick="
          openQualityReview(
            '${esc(item.f.id)}'
          )
        "
      >

        <div class="qc-farmer">

          <strong>
            ${esc(
              item.f.farmer_name ||
              "Unnamed farmer"
            )}
          </strong>

          <small>
            ${esc(
              item.f.farmer_id ||
              item.f.id
            )}
          </small>

        </div>


        <div class="qc-issue-title">

          <strong>
            ${esc(
              issue.title ||

              (
                item.status ===
                "passed"

                  ? "No quality issues"

                  : "Quality issue detected"
              )
            )}
          </strong>

          <small>
            ${esc(
              issue.description ||
              "Farm requires routine quality review."
            )}
          </small>

        </div>


        <div>

          <span
            class="qc-pill ${item.status}"
          >
            ${item.status}
          </span>

        </div>


        <div>

        <span class="qc-pill ${item.pending ? "pending" : item.status}">
          ${
            item.pending
              ? "Pending review"
              : item.status === "passed"
                ? "Passed"
                : "Needs review"
          }
        </span>

        </div>


        <div>

          ${
            area != null

              ? Number(area)
                  .toFixed(2) +
                " ha"

              : "—"
          }

        </div>


        <div>

          <button
            class="qc-row-action"
            onclick="
              event.stopPropagation();
              openQualityReview(
                '${esc(item.f.id)}'
              )
            "
          >
            Review
          </button>

        </div>

      </div>
    `;
  }


  // ============================================================
  // OPEN QUALITY REVIEW
  // ============================================================

  async function openQualityReview(id) {

    currentFarm =
      farms.find(
        farm =>
          String(farm.id) ===
          String(id)
      );


    if (!currentFarm) {

      notify(
        "Farm not found in the loaded project.",
        "error"
      );

      return;
    }


    /*
     * Security/UI check:
     *
     * Do not open a farm that isn't in the
     * current user's queue.
     */

    if (
      !farmBelongsToCurrentQueue(
        currentFarm
      )
    ) {

      notify(
        "This farm is not currently assigned to your review queue.",
        "error"
      );

      return;
    }


    const modal =
      $("qcReviewModal");


    if (!modal) {

      notify(
        "Review modal is missing from the page.",
        "error"
      );

      return;
    }


    modal.classList.remove(
      "hidden"
    );


    $("qcReviewTitle").textContent =
      currentFarm.farmer_name ||
      "Farm Review";


    $("qcReviewSubtitle").textContent =
      currentFarm.farmer_id ||
      currentFarm.id;


    const area =
      currentFarm.area_ha ??
      currentFarm.area;


    $("qcReviewScore").textContent =
      "—";


    $("qcReviewStatus").textContent =
      "Running checks…";


    $("qcComponents").innerHTML = `

      <div
        style="
          padding:8px;
          font-size:9px;
          color:#8993a2
        "
      >

        <i class="fas fa-spinner fa-spin"></i>

        Running GIS quality checks…

      </div>
    `;


    $("qcFarmInfo").innerHTML =
      [

        [
          "Farmer",
          currentFarm.farmer_name
        ],

        [
          "Farmer ID",
          currentFarm.farmer_id ||
          currentFarm.id
        ],

        [
          "Area",
          area != null
            ? Number(area)
                .toFixed(2) +
              " ha"
            : "—"
        ],

        [
          "Workflow",
          currentFarm.workflow_state ||
          currentFarm.status ||
          "pending"
        ],

        [
          "Reviewer role",
          currentProjectUserRole
            .replaceAll(
              "_",
              " "
            )
        ]

      ]

        .map(
          row => `

            <div>

              <span>
                ${esc(row[0])}
              </span>

              <strong>
                ${esc(
                  row[1] ||
                  "—"
                )}
              </strong>

            </div>
          `
        )
        .join("");


    $("qcReviewIssues").innerHTML = `

      <div
        style="
          padding:8px;
          font-size:9px;
          color:#8993a2
        "
      >

        <i class="fas fa-spinner fa-spin"></i>

        Loading existing quality issues…

      </div>
    `;


    try {

      // --------------------------------------------------------
      // EXISTING ISSUES
      // --------------------------------------------------------

      const issueResult =
        await supabaseClient
          .from(
            "farm_quality_issues"
          )
          .select("*")
          .eq(
            "farm_id",
            id
          );


      if (issueResult.error) {
        throw issueResult.error;
      }


      /*
       * Replace old issues for this farm.
       */

      issues =
        issues
          .filter(
            issue =>
              String(issue.farm_id) !==
              String(id)
          )
          .concat(
            issueResult.data || []
          );


      renderReviewShell(
        currentFarm,

        issues.filter(
          issue =>
            String(issue.farm_id) ===
            String(id)
        ),

        null
      );


      // --------------------------------------------------------
      // AUTHORITATIVE QUALITY CHECK
      // --------------------------------------------------------

      const rpcPromise =
        supabaseClient.rpc(
          "run_full_quality_check",
          {
            p_farm_id: id
          }
        );


      const timeout =
        new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Quality check is taking longer than expected. Existing results are shown; use Refresh and try again."
                  )
                ),
              10000
            )
        );


      const result =
        await Promise.race(
          [
            rpcPromise,
            timeout
          ]
        );


      if (result.error) {
        throw result.error;
      }


      let data =
        result.data || {};


      if (
        typeof data ===
        "string"
      ) {

        try {

          data =
            JSON.parse(data);

        } catch {

          console.warn(
            "QC RPC returned non-JSON string."
          );

        }
      }


      currentResult =
        data;


      // --------------------------------------------------------
      // REFRESH ISSUES AFTER QC
      // --------------------------------------------------------

      const fresh =
        await supabaseClient
          .from(
            "farm_quality_issues"
          )
          .select("*")
          .eq(
            "farm_id",
            id
          );


      if (fresh.error) {
        throw fresh.error;
      }


      issues =
        issues
          .filter(
            issue =>
              String(issue.farm_id) !==
              String(id)
          )
          .concat(
            fresh.data || []
          );


      populateReview();


    } catch (error) {

      console.error(
        "Farm quality review:",
        error
      );


      showExistingIssuesAfterError(
        id,
        error
      );
    }
  }


  // ============================================================
  // REVIEW SHELL
  // ============================================================

  function renderReviewShell(
    farm,
    list,
    result
  ) {

    const details =
      result?.score_details ||
      {};


    renderComponents(
      details
    );


    $("qcIssueCount").textContent =
      list.length +
      " issue" +
      (
        list.length === 1
          ? ""
          : "s"
      );


    $("qcReviewIssues").innerHTML =
      list.length

        ? list
            .map(
              renderIssue
            )
            .join("")

        : `

          <div
            style="
              padding:8px;
              color:#28734f;
              font-size:9px
            "
          >

            ✓ No stored quality issues.

          </div>
        `;
  }


  // ============================================================
  // COMPONENTS
  // ============================================================

  function renderComponents(
    details
  ) {

    $("qcComponents").innerHTML =

      [
        "geometry",
        "mapping",
        "spatial",
        "attribute",
        "traceability"
      ]

        .map(
          key => {

            const score =
              Number(
                details[
                  key +
                  "_score"
                ]
              );


            return `

              <div
                class="qc-component"
              >

                <span>
                  ${
                    key[0]
                      .toUpperCase() +
                    key.slice(1)
                  }
                </span>

                <div
                  class="qc-bar"
                >

                  <span
                    style="
                      width:${
                        Number.isFinite(
                          score
                        )
                          ? Math.max(
                              0,
                              Math.min(
                                100,
                                score
                              )
                            )
                          : 0
                      }%
                    "
                  ></span>

                </div>

                <b>
                  ${
                    Number.isFinite(
                      score
                    )
                      ? Math.round(score)
                      : "—"
                  }
                </b>

              </div>
            `;
          }
        )
        .join("");
  }


  // ============================================================
  // ISSUE RENDERER
  // ============================================================

  function renderIssue(
    issue
  ) {

    const warning =
      [
        "warning",
        "medium",
        "high"
      ].includes(
        sev(issue)
      );


    return `

      <div
        class="qc-issue ${
          warning
            ? "warning"
            : ""
        }"
      >

        <strong>

          ${esc(
            issue.title ||
            kind(issue) ||
            "Quality issue"
          )}

        </strong>

        <p>

          ${esc(
            issue.description ||
            "Quality issue detected."
          )}

        </p>

        ${
          issue.latitude != null &&
          issue.longitude != null

            ? `

              <button
                class="qc-locate"
                onclick="
                  locateIssue(
                    ${Number(
                      issue.latitude
                    )},
                    ${Number(
                      issue.longitude
                    )}
                  )
                "
              >

                Locate evidence

              </button>
            `

            : ""
        }

      </div>
    `;
  }


  // ============================================================
  // ERROR DISPLAY
  // ============================================================

  function showExistingIssuesAfterError(
    id,
    error
  ) {

    $("qcReviewStatus").textContent =
      "Review required";


    $("qcComponents").innerHTML = `

      <div
        style="
          padding:8px;
          font-size:9px;
          color:#b42318
        "
      >

        ${esc(
          error?.message ||
          error
        )}

      </div>
    `;


    const list =
      issues.filter(
        issue =>
          String(issue.farm_id) ===
          String(id)
      );


    $("qcIssueCount").textContent =
      list.length +
      " issue" +
      (
        list.length === 1
          ? ""
          : "s"
      );


    $("qcReviewIssues").innerHTML =
      list.length

        ? list
            .map(
              renderIssue
            )
            .join("")

        : `

          <div
            style="
              padding:8px;
              color:#7d8796;
              font-size:9px
            "
          >

            No stored quality issues.

            The live quality check could not
            be completed.

          </div>
        `;


    $("qcDecisionNote").innerHTML = `

      <i class="fas fa-circle-exclamation"></i>

      Live QC check did not complete.
      Do not validate until the check succeeds.

    `;


    $("qcValidateBtn").disabled =
      true;


    renderMap(list);
  }


  // ============================================================
  // POPULATE REVIEW
  // ============================================================

  function populateReview() {

    const details =
      currentResult?.score_details ||
      {};


    const list =
      issues.filter(
        issue =>
          String(issue.farm_id) ===
          String(currentFarm.id)
      );


    const critical =
      list.some(
        issue =>
          sev(issue) ===
          "critical"
      );


    const score =
      Number(
        currentResult?.overall_score ??
        details.overall_score
      );


    $("qcReviewScore").textContent =
      Number.isFinite(score)
        ? Math.round(score)
        : "—";


    $("qcReviewStatus").textContent =
      currentResult?.quality_status ||
      "review";


    // ----------------------------------------------------------
    // PROTECTED AREA
    // ----------------------------------------------------------

    const protectedCritical =
      list.some(
        issue =>
          sev(issue) ===
            "critical" &&

          (
            kind(issue)
              .includes(
                "protected"
              ) ||

            lower(issue.title)
              .includes(
                "protected area"
              )
          )
      );


    const otherCritical =
      list.some(
        issue =>
          sev(issue) ===
            "critical" &&

          !(
            kind(issue)
              .includes(
                "protected"
              ) ||

            lower(issue.title)
              .includes(
                "protected area"
              )
          )
      );


    const assessment =
      $("qcProtectedAssessment");


    if (assessment) {

      assessment.style.display =
        protectedCritical
          ? "block"
          : "none";

    }


    /*
     * Validation is blocked for critical issues.
     *
     * For protected areas, the existing legal assessment
     * remains required.
     */

    $("qcValidateBtn").disabled =
      !canValidate() ||
      otherCritical ||
      protectedCritical;


    $("qcDecisionNote").innerHTML =

      critical

        ? `

          <i class="fas fa-triangle-exclamation"></i>

          Critical issue detected —
          validation is blocked.

        `

        : `

          <i class="fas fa-circle-info"></i>

          Review all evidence before deciding.

        `;


    renderComponents(
      details
    );


    const area =
      currentFarm.area_ha ??
      currentFarm.area;


    $("qcFarmInfo").innerHTML =

      [

        [
          "Farmer",
          currentFarm.farmer_name
        ],

        [
          "Farmer ID",
          currentFarm.farmer_id ||
          currentFarm.id
        ],

        [
          "Area",
          area != null
            ? Number(area)
                .toFixed(2) +
              " ha"
            : "—"
        ],

        [
          "Workflow",
          currentFarm.workflow_state ||
          currentFarm.status
        ],

        [
          "Reviewer",
          currentProjectUserRole
            .replaceAll(
              "_",
              " "
            )
        ]

      ]

        .map(
          row => `

            <div>

              <span>
                ${esc(row[0])}
              </span>

              <strong>
                ${esc(
                  row[1] ||
                  "—"
                )}
              </strong>

            </div>

          `
        )
        .join("");


    $("qcIssueCount").textContent =
      list.length +
      " issue" +
      (
        list.length === 1
          ? ""
          : "s"
      );


    $("qcReviewIssues").innerHTML =
      list.length

        ? list
            .map(
              renderIssue
            )
            .join("")

        : `

          <div
            style="
              padding:8px;
              color:#28734f;
              font-size:10px
            "
          >

            ✓ No quality issues detected.

          </div>
        `;


    renderMap(list);
  }


  // ============================================================
  // MAP
  // ============================================================

  function renderMap(
    list
  ) {

    setTimeout(
      () => {

        if (!window.L) {
          return;
        }


        currentMap?.remove();


        currentMap =
          L.map(
            "qcReviewMap"
          );


        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Tiles © Esri"
          }
        ).addTo(
          currentMap
        );


        const layers = [];


        let farmGeometry =
          currentFarm?.geometry;


        if (
          typeof farmGeometry ===
          "string"
        ) {

          try {

            farmGeometry =
              JSON.parse(
                farmGeometry
              );

          } catch {

            farmGeometry =
              null;

          }
        }


        if (farmGeometry) {

          try {

            const layer =
              L.geoJSON(
                farmGeometry,
                {
                  style: {
                    color: "#245f45",
                    weight: 3,
                    fillOpacity: 0.12
                  }
                }
              ).addTo(
                currentMap
              );


            layers.push(
              layer
            );

          } catch (error) {

            console.warn(
              "Farm geometry could not be displayed:",
              error
            );

          }
        }


        list.forEach(
          issue => {

            let geometry =
              issue.issue_geometry;


            if (
              typeof geometry ===
              "string"
            ) {

              try {

                geometry =
                  JSON.parse(
                    geometry
                  );

              } catch {

                geometry =
                  null;

              }
            }


            if (
              !geometry &&

              issue.latitude != null &&

              issue.longitude != null
            ) {

              geometry = {

                type:
                  "Point",

                coordinates: [

                  Number(
                    issue.longitude
                  ),

                  Number(
                    issue.latitude
                  )

                ]

              };

            }


            if (!geometry) {
              return;
            }


            try {

              const layer =
                L.geoJSON(
                  geometry,
                  {

                    pointToLayer:
                      (
                        feature,
                        latlng
                      ) =>

                        L.circleMarker(
                          latlng,
                          {
                            radius: 7,
                            color: "#dc2626",
                            fillOpacity: 0.9
                          }
                        ),

                    style: {
                      color: "#dc2626",
                      weight: 3
                    }

                  }
                ).addTo(
                  currentMap
                );


              layers.push(
                layer
              );

            } catch (error) {

              console.warn(
                "Issue geometry could not be displayed:",
                error
              );

            }
          }
        );


        if (layers.length) {

          let bounds =
            layers[0]
              .getBounds();


          layers
            .slice(1)
            .forEach(
              layer => {

                const layerBounds =
                  layer.getBounds();


                if (
                  layerBounds.isValid()
                ) {

                  bounds =
                    bounds.extend(
                      layerBounds
                    );

                }

              }
            );


          if (
            bounds.isValid()
          ) {

            currentMap.fitBounds(
              bounds,
              {
                padding: [
                  25,
                  25
                ]
              }
            );

          }

        } else {

          /*
           * Côte d'Ivoire fallback.
           */

          currentMap.setView(
            [
              7.54,
              -5.55
            ],
            7
          );

        }


        currentMap.invalidateSize();

      },
      100
    );
  }


  // ============================================================
  // LOCATE ISSUE
  // ============================================================

  function locateIssue(
    latitude,
    longitude
  ) {

    if (!currentMap) {
      return;
    }


    currentMap.setView(
      [
        latitude,
        longitude
      ],
      17
    );


    L.circleMarker(
      [
        latitude,
        longitude
      ],
      {
        radius: 9,
        color: "#dc2626",
        fillOpacity: 0.1
      }
    ).addTo(
      currentMap
    );
  }


  // ============================================================
  // CLOSE REVIEW
  // ============================================================

  function closeQualityReview() {

    currentMap?.remove();

    currentMap = null;


    const modal =
      $("qcReviewModal");


    if (modal) {

      modal.classList.add(
        "hidden"
      );

    }


    currentFarm = null;

    currentResult = null;
  }


  // ============================================================
  // QUALITY DECISION
  // ============================================================

  async function qualityDecision(
    decision
  ) {

    if (!currentFarm) {
      return;
    }


    const workflow =
      workflowOf(
        currentFarm
      );


    const list =
      issues.filter(
        issue =>
          String(issue.farm_id) ===
          String(currentFarm.id)
      );


    // ----------------------------------------------------------
    // PERMISSION
    // ----------------------------------------------------------

    if (
      decision ===
      "validated" &&
      !canValidate()
    ) {

      notify(
        "You do not have permission to approve this farm.",
        "error"
      );

      return;
    }


    if (
      decision ===
      "rejected" &&
      !canReject()
    ) {

      notify(
        "You do not have permission to reject this farm.",
        "error"
      );

      return;
    }


    if (
      decision ===
      "correction_required" &&
      !canRequestCorrection()
    ) {

      notify(
        "You do not have permission to request correction.",
        "error"
      );

      return;
    }


    // ----------------------------------------------------------
    // PROTECTED / CRITICAL CHECKS
    // ----------------------------------------------------------

    const protectedCritical =
      list.some(
        issue =>
          sev(issue) ===
            "critical" &&

          (
            kind(issue)
              .includes(
                "protected"
              ) ||

            lower(issue.title)
              .includes(
                "protected area"
              )
          )
      );


    const otherCritical =
      list.some(
        issue =>
          sev(issue) ===
            "critical" &&

          !(
            kind(issue)
              .includes(
                "protected"
              ) ||

            lower(issue.title)
              .includes(
                "protected area"
              )
          )
      );


    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (
      decision ===
      "validated"
    ) {

      if (otherCritical) {

        notify(
          "Approval blocked: a critical non-protected-area issue must be resolved first.",
          "error"
        );

        return;
      }


      if (protectedCritical) {

        const verified =
          $("qcLegalVerified")
            ?.checked;


        const reference =
          $("qcAuthorizationRef")
            ?.value
            .trim() ||
          "";


        const comment =
          $("qcValidatorComment")
            ?.value
            .trim() ||
          "";


        if (!verified) {

          notify(
            "Verify the legal authorization before approving this protected-area case.",
            "error"
          );

          return;
        }


        if (!reference) {

          notify(
            "Enter the authorization / document reference.",
            "error"
          );

          return;
        }


        if (!comment) {

          notify(
            "Enter a validator comment for the protected-area decision.",
            "error"
          );

          return;
        }
      }
    }


    // ----------------------------------------------------------
    // SAME-STATE PROTECTION
    // ----------------------------------------------------------

    /*
     * This specifically prevents:
     *
     * correction_required
     *          ↓
     * correction_required
     *
     * which was causing your previous RPC error.
     */

    if (
      decision ===
      "correction_required" &&

      workflow ===
      "correction_required"
    ) {

      notify(
        "This farm is already marked as correction required. It must first return to the appropriate review stage.",
        "error"
      );

      return;
    }


    // ----------------------------------------------------------
    // CONFIRM
    // ----------------------------------------------------------

    const confirmed =
      confirm(

        decision ===
        "validated"

          ? "Approve and continue to Final Validation?"

          : decision ===
            "rejected"

            ? "Reject this farm?"

            : "Request correction for this farm?"
      );


    if (!confirmed) {
      return;
    }


    // ----------------------------------------------------------
    // REASON
    // ----------------------------------------------------------

    let reason = null;


    if (
      decision ===
        "validated" &&

      protectedCritical
    ) {

      reason =
        `Protected Area reviewed; legal authorization verified. Document: ${
          $("qcAuthorizationRef")
            ?.value
            .trim()
        }. Validator comment: ${
          $("qcValidatorComment")
            ?.value
            .trim()
        }`;

    } else if (
      decision !==
      "validated"
    ) {

      reason =
        prompt(
          decision ===
            "rejected"

            ? "Rejection reason:"

            : "Correction reason:"
        );


      if (!reason?.trim()) {
        return;
      }
    }


    // ----------------------------------------------------------
    // TARGET WORKFLOW
    // ----------------------------------------------------------

    let nextState;


    if (
      decision ===
      "validated"
    ) {

      nextState =
        "final_validation";

    } else if (
      decision ===
      "rejected"
    ) {

      nextState =
        "rejected";

    } else {

      nextState =
        "correction_required";

    }


    console.log(
      "Workflow transition:",
      {
        farm_id:
          currentFarm.id,

        from:
          workflow,

        to:
          nextState,

        role:
          currentProjectUserRole
      }
    );


    // ----------------------------------------------------------
    // DATABASE TRANSITION
    // ----------------------------------------------------------

    try {

      const result =
        await supabaseClient.rpc(
          "transition_farm_workflow",
          {
            p_farm_id:
              currentFarm.id,

            p_to_state:
              nextState,

            p_reason:
              reason?.trim() ||
              null
          }
        );


      if (result.error) {
        throw result.error;
      }


      notify(
        "QC decision saved.",
        "success"
      );


      closeQualityReview();


      await refreshAll();


    } catch (error) {

      console.error(
        "QC decision error:",
        error
      );


      notify(
        "Decision failed: " +
        (
          error?.message ||
          error
        ),
        "error"
      );
    }
  }


  // ============================================================
  // REFRESH
  // ============================================================

  async function refreshAll() {

    showLoading(true);


    try {

      await loadQualityData();

      render();


      notify(
        "Quality queue refreshed.",
        "success"
      );


    } catch (error) {

      console.error(
        "Refresh error:",
        error
      );


      notify(
        error?.message ||
        error,
        "error"
      );


    } finally {

      showLoading(false);

    }
  }


  // ============================================================
  // LOADING
  // ============================================================

  function showLoading(
    value
  ) {

    const overlay =
      $("loadingOverlay");


    if (overlay) {

      overlay.style.display =
        value
          ? "flex"
          : "none";

    }
  }


  // ============================================================
  // NOTIFICATION
  // ============================================================

  function notify(
    message,
    kindValue
  ) {

    const notification =
      document.createElement(
        "div"
      );


    notification.textContent =
      message;


    notification.style.cssText = `

      position:fixed;

      right:20px;

      bottom:20px;

      z-index:9999;

      background:${
        kindValue === "error"
          ? "#b42318"
          : "#23764b"
      };

      color:#fff;

      padding:10px 14px;

      border-radius:6px;

      font-size:10px;

      max-width:420px;

      box-shadow:
        0 6px 20px
        rgba(0,0,0,.18);

    `;


    document.body.appendChild(
      notification
    );


    setTimeout(
      () =>
        notification.remove(),
      3500
    );
  }


  // ============================================================
  // GLOBAL HANDLERS
  // ============================================================

  window.openQualityReview =
    openQualityReview;


  window.closeQualityReview =
    closeQualityReview;


  window.qualityDecision =
    qualityDecision;


  window.locateIssue =
    locateIssue;


})();
