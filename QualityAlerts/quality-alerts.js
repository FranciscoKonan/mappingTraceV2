(() => {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const SUPABASE_URL =
    "https://crvnohvudurqfukjpisv5.supabase.co";

  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8";


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
  // HELPERS
  // ============================================================

  const $ = id =>
    document.getElementById(id);

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

  const t = value =>
    String(value || "").toLowerCase();

  const sev = issue =>
    t(issue?.severity);

  const kind = issue =>
    t(issue?.issue_type);


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

      // --------------------------------------------------------
      // Supabase
      // --------------------------------------------------------

      if (!window.supabase?.createClient) {
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
      // Authentication
      // --------------------------------------------------------

      const sessionResult =
        await supabaseClient.auth.getSession();

      if (sessionResult.error) {
        throw sessionResult.error;
      }

      const session =
        sessionResult.data?.session;

      if (!session?.user) {
        location.href = "../login.html";
        return;
      }

      currentUser =
        session.user;


      // --------------------------------------------------------
      // Profile / Project
      // --------------------------------------------------------

      await loadProfile();

      await resolveProject();


      // --------------------------------------------------------
      // Role authorization
      // --------------------------------------------------------

      const allowedRoles = [
        "validator",
        "manager",
        "owner",
        "super_manager"
      ];

      if (
        !allowedRoles.includes(
          currentProjectUserRole
        )
      ) {

        notify(
          "You do not have access to GIS Quality Review.",
          "error"
        );

        setTimeout(() => {

          location.href =
            "/Dashboard.html?project=" +
            encodeURIComponent(
              currentProject.id
            );

        }, 1000);

        return;
      }


      // --------------------------------------------------------
      // Load data
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
  // USER PROFILE
  // ============================================================

  async function loadProfile() {

    const result =
      await supabaseClient
        .from("user_profiles")
        .select("first_name,email")
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
          item.project_id ===
          urlProject
      ) ||

      result.data.find(
        item =>
          item.project_id ===
          savedProject
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
      String(
        membership.role || ""
      ).toLowerCase();


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
  }


  // ============================================================
  // QUALITY DATA
  // ============================================================

  async function loadQualityData() {

    console.log(
      "=== QUALITY DEBUG ==="
    );

    console.log(
      "Current project:",
      currentProject
    );

    console.log(
      "Current project ID:",
      currentProject?.id
    );

    console.log(
      "Current role:",
      currentProjectUserRole
    );


    // ----------------------------------------------------------
    // Farms
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
    // Quality Issues
    // ----------------------------------------------------------

    issues = [];


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
  // EVENT BINDING
  // ============================================================

  function bind() {

    [
      "qcStatusFilter",
      "qcTypeFilter"
    ].forEach(id => {

      $(id)?.addEventListener(
        "change",
        renderQueue
      );

    });


    $("refreshBtn")?.addEventListener(
      "click",
      refreshAll
    );


    $("logoutBtn")?.addEventListener(
      "click",
      async event => {

        event.preventDefault();

        await supabaseClient.auth.signOut();

        location.href =
          "../login.html";

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

    const issueMap =
      new Map();


    issues.forEach(issue => {

      if (
        !issueMap.has(
          issue.farm_id
        )
      ) {

        issueMap.set(
          issue.farm_id,
          []
        );

      }

      issueMap
        .get(issue.farm_id)
        .push(issue);

    });


    let critical = 0;
    let warning = 0;
    let passed = 0;
    let pending = 0;


    farms.forEach(farm => {

      const workflow =
        t(
          farm.workflow_state ||
          farm.status
        );


      // QC page concerns GIS-review farms.
      if (
        workflow !==
        "gis_compliance_review"
      ) {
        return;
      }


      const farmIssues =
        issueMap.get(
          farm.id
        ) || [];


      if (
        farmIssues.some(
          issue =>
            sev(issue) ===
            "critical"
        )
      ) {

        critical++;

      } else if (
        farmIssues.some(
          issue =>
            [
              "warning",
              "high",
              "medium"
            ].includes(
              sev(issue)
            )
        )
      ) {

        warning++;

      } else {

        passed++;

      }


      pending++;

    });


    if ($("pendingCount")) {

      $("pendingCount").textContent =
        pending;

    }


    if ($("criticalCount")) {

      $("criticalCount").textContent =
        critical;

    }


    if ($("warningCount")) {

      $("warningCount").textContent =
        warning;

    }


    if ($("passedCount")) {

      $("passedCount").textContent =
        passed;

    }


    // Total project farms
    if ($("totalFarmsCount")) {

      $("totalFarmsCount").textContent =
        farms.length;

    }
  }


  // ============================================================
  // ISSUE TYPE FILTER
  // ============================================================

  function matchesIssue(issue, type) {

    const value =
      kind(issue);


    if (type === "protected") {

      return value.includes(
        "protected"
      );

    }


    if (type === "overlap") {

      return value.includes(
        "overlap"
      );

    }


    if (type === "geometry") {

      return (
        value.includes("geometry") ||
        value.includes("spike") ||
        value.includes("self")
      );

    }


    return (
      !value.includes("protected") &&
      !value.includes("overlap") &&
      !value.includes("geometry") &&
      !value.includes("spike") &&
      !value.includes("self")
    );
  }


  // ============================================================
  // QUALITY QUEUE
  // ============================================================

  function renderQueue() {

    const statusFilter =
      $("qcStatusFilter")?.value ||
      "all";


    const typeFilter =
      $("qcTypeFilter")?.value ||
      "all";


    const rows = [];


    farms.forEach(farm => {

      const workflow =
        t(
          farm.workflow_state ||
          farm.status
        );


      // Validator / GIS queue:
      // only farms awaiting GIS compliance review.
      if (
        workflow !==
        "gis_compliance_review"
      ) {

        return;

      }


      const farmIssues =
        issues.filter(
          issue =>
            issue.farm_id ===
            farm.id
        );


      const critical =
        farmIssues.some(
          issue =>
            sev(issue) ===
            "critical"
        );


      const warning =
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
        critical
          ? "critical"
          : warning
            ? "warning"
            : "passed";


      const pending = true;


      // Status filter
      if (
        statusFilter ===
        "pending" &&
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


      // Issue type filter
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

        status: status,

        pending: pending

      });

    });


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
            <h3>Queue is clear</h3>
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
        onclick="openQualityReview('${esc(item.f.id)}')"
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
                item.status === "passed"
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

          <span
            class="qc-pill pending"
          >
            ${item.pending
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
              ? Number(area).toFixed(2) +
                " ha"
              : "—"
          }
        </div>


        <div>

          <button
            class="qc-row-action"
            onclick="
              event.stopPropagation();
              openQualityReview('${esc(item.f.id)}')
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
          farm.id === id
      );


    if (!currentFarm) {

      notify(
        "Farm not found in the loaded project.",
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


    $("qcComponents").innerHTML =
      `
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
            ? Number(area).toFixed(2) +
              " ha"
            : "—"
        ],
        [
          "Workflow",
          currentFarm.workflow_state ||
          currentFarm.status ||
          "pending"
        ]
      ]
        .map(
          row =>
            `
              <div>
                <span>
                  ${esc(row[0])}
                </span>
                <strong>
                  ${esc(row[1] || "—")}
                </strong>
              </div>
            `
        )
        .join("");


    $("qcReviewIssues").innerHTML =
      `
        <div
          style="
            padding:8px;
            font-size:9px;
            color:#8993a2
          "
        >
          Loading existing quality issues…
        </div>
      `;


    try {

      // --------------------------------------------------------
      // Existing quality issues
      // --------------------------------------------------------

      const issueResult =
        await supabaseClient
          .from("farm_quality_issues")
          .select("*")
          .eq(
            "farm_id",
            id
          );


      if (!issueResult.error) {

        issues =
          issues
            .filter(
              issue =>
                issue.farm_id !== id
            )
            .concat(
              issueResult.data || []
            );

      }


      renderReviewShell(
        currentFarm,
        issues.filter(
          issue =>
            issue.farm_id === id
        ),
        null
      );


      // --------------------------------------------------------
      // Authoritative QC check
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
        await Promise.race([
          rpcPromise,
          timeout
        ]);


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

          // Keep original value.

        }
      }


      currentResult =
        data;


      // --------------------------------------------------------
      // Refresh issues after QC RPC
      // --------------------------------------------------------

      const fresh =
        await supabaseClient
          .from("farm_quality_issues")
          .select("*")
          .eq(
            "farm_id",
            id
          );


      if (!fresh.error) {

        issues =
          issues
            .filter(
              issue =>
                issue.farm_id !== id
            )
            .concat(
              fresh.data || []
            );

      }


      populateReview();


    } catch (error) {

      console.error(
        "Farm quality review:",
        error
      );


      $("qcReviewStatus").textContent =
        "Review required";


      $("qcComponents").innerHTML =
        `
          <div
            style="
              padding:8px;
              font-size:9px;
              color:#b42318
            "
          >
            ${esc(
              error.message ||
              error
            )}
          </div>
        `;


      const list =
        issues.filter(
          issue =>
            issue.farm_id === id
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
                issue =>
                  `
                    <div class="qc-issue ${
                      [
                        "warning",
                        "medium",
                        "high"
                      ].includes(
                        sev(issue)
                      )
                        ? "warning"
                        : ""
                    }">

                      <strong>
                        ${esc(
                          issue.title ||
                          kind(issue)
                        )}
                      </strong>

                      <p>
                        ${esc(
                          issue.description ||
                          "Quality issue detected."
                        )}
                      </p>

                    </div>
                  `
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


      $("qcDecisionNote").innerHTML =
        `
          <i class="fas fa-circle-exclamation"></i>
          Live QC check did not complete.
          Do not validate until the check succeeds.
        `;


      $("qcValidateBtn").disabled =
        true;
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
      result?.score_details || {};


    $("qcComponents").innerHTML =
      [
        "geometry",
        "mapping",
        "spatial",
        "attribute",
        "traceability"
      ]
        .map(key => {

          const score =
            Number(
              details[
                key + "_score"
              ]
            );


          return `
            <div
              class="qc-component"
            >

              <span>
                ${
                  key[0].toUpperCase() +
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
                        ? score
                        : 0
                    }%
                  "
                ></span>

              </div>

              <b>
                ${
                  Number.isFinite(score)
                    ? Math.round(score)
                    : "—"
                }
              </b>

            </div>
          `;

        })
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
              issue =>
                `
                  <div
                    class="qc-issue ${
                      [
                        "warning",
                        "medium",
                        "high"
                      ].includes(
                        sev(issue)
                      )
                        ? "warning"
                        : ""
                    }"
                  >

                    <strong>
                      ${esc(
                        issue.title ||
                        kind(issue)
                      )}
                    </strong>

                    <p>
                      ${esc(
                        issue.description ||
                        "Quality issue detected."
                      )}
                    </p>

                  </div>
                `
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
  // POPULATE REVIEW
  // ============================================================

  function populateReview() {

    const details =
      currentResult?.score_details ||
      {};


    const list =
      issues.filter(
        issue =>
          issue.farm_id ===
          currentFarm.id
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


    const protectedCritical =
      list.some(
        issue =>
          sev(issue) === "critical" &&
          (
            kind(issue).includes(
              "protected"
            ) ||
            t(issue.title).includes(
              "protected area"
            )
          )
      );


    const otherCritical =
      list.some(
        issue =>
          sev(issue) === "critical" &&
          !(
            kind(issue).includes(
              "protected"
            ) ||
            t(issue.title).includes(
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


    $("qcValidateBtn").disabled =
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


    $("qcComponents").innerHTML =
      [
        "geometry",
        "mapping",
        "spatial",
        "attribute",
        "traceability"
      ]
        .map(key => {

          const score =
            Number(
              details[
                key + "_score"
              ]
            );


          return `
            <div
              class="qc-component"
            >

              <span>
                ${
                  key[0].toUpperCase() +
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
                        ? score
                        : 0
                    }%
                  "
                ></span>

              </div>

              <b>
                ${
                  Number.isFinite(score)
                    ? Math.round(score)
                    : "—"
                }
              </b>

            </div>
          `;

        })
        .join("");


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
            ? Number(area).toFixed(2) +
              " ha"
            : "—"
        ],
        [
          "Workflow",
          currentFarm.workflow_state ||
          currentFarm.status
        ]
      ]
        .map(
          row =>
            `
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
              issue =>
                `
                  <div
                    class="qc-issue ${
                      [
                        "warning",
                        "medium",
                        "high"
                      ].includes(
                        sev(issue)
                      )
                        ? "warning"
                        : ""
                    }"
                  >

                    <strong>
                      ${esc(
                        issue.title ||
                        kind(issue)
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
                                ${Number(issue.latitude)},
                                ${Number(issue.longitude)}
                              )
                            "
                          >
                            Locate evidence
                          </button>
                        `

                        : ""
                    }

                  </div>
                `
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

  function renderMap(list) {

    setTimeout(() => {

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


      let geometry =
        currentFarm.geometry;


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

          geometry = null;

        }
      }


      if (geometry) {

        layers.push(
          L.geoJSON(
            geometry,
            {
              style: {
                color: "#245f45",
                weight: 3,
                fillOpacity: 0.12
              }
            }
          ).addTo(
            currentMap
          )
        );

      }


      list.forEach(issue => {

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

            geometry = null;

          }
        }


        if (
          !geometry &&
          issue.latitude != null &&
          issue.longitude != null
        ) {

          geometry = {
            type: "Point",
            coordinates: [
              +issue.longitude,
              +issue.latitude
            ]
          };

        }


        if (geometry) {

          layers.push(
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
            )
          );

        }

      });


      if (layers.length) {

        let bounds =
          layers[0]
            .getBounds();


        layers
          .slice(1)
          .forEach(layer => {

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

          });


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

        currentMap.setView(
          [
            7.54,
            -5.55
          ],
          7
        );

      }


      currentMap.invalidateSize();

    }, 100);
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


    const list =
      issues.filter(
        issue =>
          issue.farm_id ===
          currentFarm.id
      );


    const protectedCritical =
      list.some(
        issue =>
          sev(issue) === "critical" &&
          (
            kind(issue).includes(
              "protected"
            ) ||
            t(issue.title).includes(
              "protected area"
            )
          )
      );


    const otherCritical =
      list.some(
        issue =>
          sev(issue) === "critical" &&
          !(
            kind(issue).includes(
              "protected"
            ) ||
            t(issue.title).includes(
              "protected area"
            )
          )
      );


    // ----------------------------------------------------------
    // VALIDATION CHECKS
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
          $("qcLegalVerified")?.checked;


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
    // CONFIRM
    // ----------------------------------------------------------

    const confirmed =
      confirm(
        decision === "validated"

          ? "Approve and continue to Final Validation?"

          : decision === "rejected"

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
            .value
            .trim()
        }. Validator comment: ${
          $("qcValidatorComment")
            .value
            .trim()
        }`;

    } else if (
      decision !==
      "validated"
    ) {

      reason =
        prompt(
          decision === "rejected"
            ? "Rejection reason:"
            : "Correction reason:"
        );


      if (!reason?.trim()) {
        return;
      }
    }


    // ----------------------------------------------------------
    // WORKFLOW TRANSITION
    // ----------------------------------------------------------

    try {

      const nextState =
        decision === "validated"

          ? "final_validation"

          : decision === "rejected"

            ? "rejected"

            : "correction_required";


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
          error.message ||
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

      notify(
        error.message ||
        error,
        "error"
      );

    } finally {

      showLoading(false);

    }
  }


  // ============================================================
  // UI HELPERS
  // ============================================================

  function showLoading(value) {

    const overlay =
      $("loadingOverlay");


    if (overlay) {

      overlay.style.display =
        value
          ? "flex"
          : "none";

    }
  }


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


    notification.style.cssText =
      `
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
  // HTML INLINE HANDLER EXPORTS
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
