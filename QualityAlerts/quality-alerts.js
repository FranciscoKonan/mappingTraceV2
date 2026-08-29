
/* MappingTrace — Quality Control
   Clean architecture:
   HTML = structure
   CSS  = presentation
   JS   = Supabase + QC workflow + map
*/
(() => {
'use strict';

const SUPABASE_URL = 'https://crvnohvudurqfukjpisv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2IiwiaWF0IjoxNzc4NDU1MTczLCJleHAiOjIwOTQwMzExNzN9.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8';

let supabaseClient;
let currentUser = null;
let currentProject = null;
let currentRole = '';
let memberships = [];
let farms = [];
let qualityByFarm = new Map();
let issuesByFarm = new Map();
let filtered = [];
let page = 1;
let sortField = 'priority';
let sortDirection = 'desc';
let reviewMap = null;
let quickMap = null;

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupShell();
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '../login.html';
    return;
  }
  currentUser = session.user;
  await loadIdentity();
  await loadProjects();
  setupFilters();
}

function setupShell() {
  $('burgerBtn')?.addEventListener('click', () => {
    $('sidebar')?.classList.toggle('mobile-open');
    $('sidebarOverlay')?.classList.toggle('active');
  });
  $('sidebarOverlay')?.addEventListener('click', () => {
    $('sidebar')?.classList.remove('mobile-open');
    $('sidebarOverlay')?.classList.remove('active');
  });
  $('sidebarToggle')?.addEventListener('click', () => {
    $('sidebar')?.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', $('sidebar').classList.contains('collapsed'));
  });
  if (localStorage.getItem('sidebarCollapsed') === 'true') $('sidebar')?.classList.add('collapsed');

  $('refreshBtn')?.addEventListener('click', refreshData);
  $('qcRefreshTop')?.addEventListener('click', refreshData);
  $('qcRefreshIcon')?.addEventListener('click', refreshData);
  $('qcApply')?.addEventListener('click', () => applyFilters(true));
  $('qcClear')?.addEventListener('click', clearFilters);
  $('qcResetTop')?.addEventListener('click', clearFilters);
  $('advancedToggle')?.addEventListener('click', () => $('qcAdvanced')?.classList.toggle('hidden'));
  $('qcSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(true); });
  $('qcPrev')?.addEventListener('click', () => { if (page > 1) { page--; renderTable(); }});
  $('qcNext')?.addEventListener('click', () => { const pages = Math.ceil(filtered.length / 10); if (page < pages) { page++; renderTable(); }});
  document.querySelectorAll('.quality-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => sortBy(th.dataset.sort));
  });
  $('logoutBtn')?.addEventListener('click', async e => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = '../login.html';
  });
}

async function loadIdentity() {
  const { data: profile } = await supabaseClient.from('user_profiles')
    .select('first_name,email').eq('id', currentUser.id).maybeSingle();
  const name = profile?.first_name || currentUser.email?.split('@')[0] || 'User';
  $('userName').textContent = name;
  $('userAvatar').textContent = name.charAt(0).toUpperCase();
}

async function loadProjects() {
  const result = await supabaseClient.from('project_members')
    .select('project_id,role,projects(*)')
    .eq('user_id', currentUser.id).eq('status', 'active');

  if (result.error) {
    console.error('project_members error:', result.error);
    showToast(`Unable to load project membership (${result.error.code || '401'}).`, 'error');
    return;
  }

  memberships = result.data || [];
  if (!memberships.length) {
    showToast('No active project membership was found for this account.', 'warning');
    return;
  }

  const params = new URLSearchParams(location.search);
  const requested = params.get('project');
  let selected = requested && requested !== 'all'
    ? memberships.find(m => m.projects?.id === requested)
    : null;
  if (!selected) {
    const last = localStorage.getItem(`lastProject_${currentUser.id}`);
    selected = memberships.find(m => m.projects?.id === last) || memberships[0];
  }

  currentProject = selected.projects;
  currentRole = selected.role || '';
  $('userRole').textContent = currentRole.replaceAll('_',' ').toUpperCase();
  $('projectBadge').textContent = currentProject.name;
  $('selectedProjectName').textContent = currentProject.name;

  const query = `?project=${encodeURIComponent(currentProject.id)}`;
  document.querySelector('[data-page="dashboard"]')?.setAttribute('href', `../Dashboard.html${query}`);
  document.querySelector('[data-page="live-mapping"]')?.setAttribute('href', `../LiveMapping/live-mapping.html${query}`);
  document.querySelector('[data-page="submissions"]')?.setAttribute('href', `../Submissions/submissions.html${query}`);
  document.querySelector('[data-page="exports"]')?.setAttribute('href', `../Exports/exports.html${query}`);
  $('dataMgmtLink')?.setAttribute('href', `../DataManagement.html${query}`);

  if (memberships.length > 1 && memberships.some(m => m.role === 'owner')) {
    $('projectSelectorContainer')?.classList.remove('hidden');
    renderProjectDropdown();
  }

  localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
  history.replaceState({}, '', `${location.pathname}?project=${encodeURIComponent(currentProject.id)}`);
  await refreshData();
}

function renderProjectDropdown() {
  const box = $('dropdownItems');
  box.innerHTML = `<div class="dropdown-item" data-value="all">📊 ALL PROJECTS</div>` +
    memberships.map(m => `<div class="dropdown-item" data-value="${esc(m.projects.id)}">📁 ${esc(m.projects.name)}</div>`).join('');
  $('dropdownSelected')?.addEventListener('click', e => {
    e.stopPropagation();
    $('dropdownMenu')?.classList.toggle('show');
    $('projectSearch').value = '';
  });
  $('projectSearch')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    box.querySelectorAll('.dropdown-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(q) ? '' : 'none');
  });
  document.addEventListener('click', () => $('dropdownMenu')?.classList.remove('show'), { once: false });
  box.querySelectorAll('.dropdown-item').forEach(item => item.addEventListener('click', async () => {
    if (item.dataset.value === 'all') {
      showToast('Use a specific project for GIS quality review.', 'warning');
      return;
    }
    const m = memberships.find(x => x.projects?.id === item.dataset.value);
    if (!m) return;
    currentProject = m.projects;
    currentRole = m.role || '';
    $('userRole').textContent = currentRole.replaceAll('_',' ').toUpperCase();
    $('projectBadge').textContent = currentProject.name;
    $('selectedProjectName').textContent = currentProject.name;
    $('dropdownMenu').classList.remove('show');
    localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
    history.pushState({}, '', `${location.pathname}?project=${encodeURIComponent(currentProject.id)}`);
    await refreshData();
  }));
}

async function refreshData() {
  if (!currentProject?.id) return;
  setLoading(true);
  try {
    const { data, error } = await supabaseClient.from('farms').select('*')
      .eq('project_id', currentProject.id).order('created_at', { ascending: false });
    if (error) throw error;
    farms = data || [];
    await loadQualityData();
    applyFilters(true);
  } catch (e) {
    console.error(e);
    showToast(`Unable to load Quality Control data: ${e.message}`, 'error');
    farms = [];
    qualityByFarm.clear();
    issuesByFarm.clear();
    applyFilters(true);
  } finally {
    setLoading(false);
  }
}

async function loadQualityData() {
  qualityByFarm.clear();
  issuesByFarm.clear();
  const ids = farms.map(f => f.id);
  if (!ids.length) return;

  const q = await supabaseClient.from('farm_quality')
    .select('farm_id,geometry_score,mapping_score,spatial_score,attribute_score,traceability_score,overall_score,quality_status')
    .in('farm_id', ids);
  if (!q.error) (q.data || []).forEach(r => qualityByFarm.set(r.farm_id, r));

  // Issues are loaded in chunks to avoid oversized REST URLs.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const r = await supabaseClient.from('farm_quality_issues')
      .select('id,farm_id,issue_type,severity,title,description,latitude,longitude,issue_geometry,created_at')
      .in('farm_id', chunk);
    if (!r.error) (r.data || []).forEach(issue => {
      if (!issuesByFarm.has(issue.farm_id)) issuesByFarm.set(issue.farm_id, []);
      issuesByFarm.get(issue.farm_id).push(issue);
    });
  }
}

function setupFilters() {
  ['qcStatus','qcSeverity','qcIssueType','qcMinScore'].forEach(id => $(id)?.addEventListener('change', () => applyFilters(true)));
}

function buildRows() {
  return farms.map(f => {
    const q = qualityByFarm.get(f.id);
    const issues = issuesByFarm.get(f.id) || [];
    const score = q?.overall_score == null ? null : Number(q.overall_score);
    const critical = issues.filter(i => String(i.severity).toLowerCase() === 'critical').length;
    const qualityStatus = q?.quality_status || 'not_checked';
    return {
      ...f, score, quality_status: qualityStatus, issues, critical,
      issue_count: issues.length,
      priority: (critical * 100000) + ((100 - (score ?? 0)) * 100) + issues.length
    };
  });
}

function applyFilters(resetPage = false) {
  const search = ($('qcSearch')?.value || '').trim().toLowerCase();
  const status = $('qcStatus')?.value || 'all';
  const severity = $('qcSeverity')?.value || 'all';
  const type = $('qcIssueType')?.value || 'all';
  const min = $('qcMinScore')?.value === '' ? null : Number($('qcMinScore')?.value);

  filtered = buildRows().filter(r => {
    if (search && ![r.farmer_name,r.farmer_id,r.cooperative,r.supplier,r.id].some(v => String(v || '').toLowerCase().includes(search))) return false;
    if (status !== 'all' && r.quality_status !== status) return false;
    if (severity !== 'all' && !r.issues.some(i => String(i.severity).toLowerCase() === severity)) return false;
    if (type !== 'all' && !r.issues.some(i => normalizeIssueType(i.issue_type) === type)) return false;
    if (min !== null && (r.score === null || r.score < min)) return false;
    return true;
  });

  filtered.sort((a,b) => compareRows(a,b,sortField,sortDirection));
  if (resetPage) page = 1;
  updateStats(filtered);
  renderTable();
}

function compareRows(a,b,field,direction) {
  let av,bv;
  if (field === 'farmer') { av = String(a.farmer_name || '').toLowerCase(); bv = String(b.farmer_name || '').toLowerCase(); }
  else if (field === 'score') { av = a.score ?? -1; bv = b.score ?? -1; }
  else { av = a.priority; bv = b.priority; }
  if (av === bv) return 0;
  const n = av < bv ? -1 : 1;
  return direction === 'asc' ? n : -n;
}

function sortBy(field) {
  if (sortField === field) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  else { sortField = field; sortDirection = 'asc'; }
  applyFilters(false);
}

function updateStats(rows) {
  $('qcTotal').textContent = rows.length;
  $('qcPassed').textContent = rows.filter(r => r.quality_status === 'passed').length;
  $('qcReview').textContent = rows.filter(r => ['review_required','not_checked'].includes(r.quality_status)).length;
  $('qcCritical').textContent = rows.filter(r => r.critical > 0).length;
  const scores = rows.map(r => r.score).filter(Number.isFinite);
  $('qcAvgScore').textContent = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '—';
}

function renderTable() {
  const body = $('qualityQueueBody');
  const start = (page - 1) * 10;
  const rows = filtered.slice(start, start + 10);
  $('qcShowing').textContent = filtered.length ? `${start + 1}–${Math.min(start + 10, filtered.length)}` : '0';
  $('qcShowingFooter').textContent = filtered.length ? `${start + 1}–${Math.min(start + 10, filtered.length)}` : '0';
  $('qcTotalFooter').textContent = filtered.length;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="loading-cell"><i class="fas fa-inbox"></i><p>No farms match the current filters.</p></td></tr>`;
    updatePagination();
    return;
  }

  body.innerHTML = rows.map(r => {
    const statusClass = r.quality_status === 'passed' ? 'passed' : r.quality_status === 'issues_detected' ? 'failed' : r.quality_status === 'review_required' ? 'review' : 'pending';
    const statusLabel = labelStatus(r.quality_status);
    const issueText = r.issue_count ? `${r.issue_count} ${r.issues[0]?.title || labelIssue(r.issues[0]?.issue_type)}` : 'No issues recorded';
    return `<tr>
      <td><div class="qc-farmer"><strong>${esc(r.farmer_name || 'Unknown Farmer')}</strong><span>${esc(r.farmer_id || r.id.slice(0,8))}</span></div></td>
      <td>${esc(r.cooperative || 'Unassigned')}</td>
      <td>${esc(r.supplier || 'Unknown')}</td>
      <td class="qc-score">${r.score == null ? '—' : Math.round(r.score)}<span style="font-weight:500;color:#94a3b8"> / 100</span></td>
      <td><span class="qc-status ${statusClass}">${esc(statusLabel)}</span></td>
      <td><div class="qc-issue-summary">${r.issue_count ? `<strong>${r.issue_count}</strong> ${esc(issueText)}` : `<span class="muted">${esc(issueText)}</span>`}</div></td>
      <td class="qc-workflow">${esc(String(r.workflow_state || r.status || 'pending').replaceAll('_',' '))}</td>
      <td><div class="qc-actions">
        <button class="qc-action review" type="button" data-review="${esc(r.id)}"><i class="fas fa-clipboard-check"></i> Review</button>
        <button class="qc-action map" type="button" title="View map" data-map="${esc(r.id)}"><i class="fas fa-map-marker-alt"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('[data-review]').forEach(b => b.addEventListener('click', () => openReview(b.dataset.review)));
  body.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => openQuickMap(b.dataset.map)));
  updatePagination();
}

function updatePagination() {
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  $('qcPageInfo').textContent = `Page ${page} of ${pages}`;
  $('qcPrev').disabled = page <= 1;
  $('qcNext').disabled = page >= pages;
}

async function openReview(farmId) {
  const farm = farms.find(f => f.id === farmId);
  if (!farm) return;
  const modal = document.createElement('div');
  modal.className = 'qc-modal-overlay';
  modal.innerHTML = `<div class="qc-modal">
    <div class="qc-modal-header">
      <div class="qc-modal-title"><div class="icon"><i class="fas fa-clipboard-check"></i></div><div>
        <h2>${esc(farm.farmer_name || 'Farm Quality Review')}</h2>
        <p>${esc(farm.farmer_id || farm.id)} · ${esc(farm.cooperative || 'Unassigned')} · ${esc(String(farm.workflow_state || farm.status || 'pending').replaceAll('_',' '))}</p>
      </div></div>
      <button class="modal-close" type="button"><i class="fas fa-times"></i></button>
    </div>
    <div class="qc-modal-body"><div id="reviewContent"><div class="loading-cell"><i class="fas fa-spinner fa-spin"></i><p>Running GIS quality checks...</p></div></div></div>
    <div id="reviewFooter" class="qc-modal-footer"></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
  try {
    const { data, error } = await supabaseClient.rpc('run_full_quality_check', { p_farm_id: farm.id });
    if (error) throw error;
    const result = data || {};
    await loadFreshIssues(farm.id);
    renderReview(modal, farm, result);
  } catch (e) {
    console.error('run_full_quality_check:', e);
    modal.querySelector('#reviewContent').innerHTML = `<div class="empty-issues"><i class="fas fa-exclamation-triangle" style="color:#dc2626"></i><div><strong>Quality check failed</strong></div><div>${esc(e.message)}</div></div>`;
    modal.querySelector('#reviewFooter').innerHTML = `<div class="decision-note">The farm was not changed.</div>`;
  }
}

async function loadFreshIssues(farmId) {
  const r = await supabaseClient.from('farm_quality_issues').select('id,farm_id,issue_type,severity,title,description,latitude,longitude,issue_geometry,created_at').eq('farm_id', farmId);
  if (!r.error) issuesByFarm.set(farmId, r.data || []);
}

function renderReview(modal, farm, result) {
  const score = Number(result.overall_score ?? result.score_details?.overall_score);
  const status = result.quality_status || 'pending';
  const details = result.score_details || {};
  const issues = issuesByFarm.get(farm.id) || [];
  const critical = issues.some(i => String(i.severity).toLowerCase() === 'critical');
  modal.querySelector('#reviewContent').innerHTML = `
    <div class="review-top">
      <div class="score-panel">
        <span class="score-label">Overall Quality Score</span>
        <div class="score-number">${Number.isFinite(score) ? Math.round(score) : '—'}</div>
        <span class="qc-status ${status === 'passed' ? 'passed' : status === 'issues_detected' ? 'failed' : 'review'}">${esc(labelStatus(status))}</span>
        <div class="score-sub">${critical ? 'Validation blocked by critical issue' : 'GIS assessment complete'}</div>
      </div>
      <div class="component-panel">
        <h3>Quality Components</h3>
        ${componentRow('Geometry', details.geometry_score)}
        ${componentRow('Mapping', details.mapping_score)}
        ${componentRow('Spatial', details.spatial_score)}
        ${componentRow('Attributes', details.attribute_score)}
        ${componentRow('Traceability', details.traceability_score)}
      </div>
    </div>
    <div class="review-main">
      <div class="left-review">
        <div class="farm-info-panel"><div style="padding:16px"><h3>Farm Information</h3><div class="farm-info-grid">
          ${info('Farmer', farm.farmer_name)}${info('Farmer ID', farm.farmer_id || farm.id)}${info('Cooperative', farm.cooperative)}${info('Supplier', farm.supplier)}${info('Area', farm.area != null ? `${Number(farm.area).toFixed(2)} ha` : '—')}${info('Mapped By', farm.enumerator || '—')}
        </div></div></div>
        <div class="issues-panel"><h3>Quality Issues <span style="color:#94a3b8;font-weight:500">(${issues.length})</span></h3>
          ${issues.length ? issues.map((i,idx) => issueCard(i,idx)).join('') : `<div class="empty-issues"><i class="fas fa-check-circle"></i><div><strong>No quality issues detected</strong></div><div>This farm passed the available checks.</div></div>`}
        </div>
      </div>
      <div class="map-panel"><div id="reviewMap" class="review-map"></div></div>
    </div>`;
  renderReviewMap(farm, issues);
  const footer = modal.querySelector('#reviewFooter');
  const canDecide = !['viewer','super_manager'].includes(normalizeRole(currentRole));
  footer.innerHTML = `<div class="decision-note">${critical ? 'Critical issue detected — Validate is blocked.' : 'Review the evidence before making a decision.'}</div>
    <div class="decision-actions">
      <button class="decision-btn correction" data-decision="correction_required" ${canDecide?'':'disabled'}><i class="fas fa-edit"></i> Request Correction</button>
      <button class="decision-btn reject" data-decision="rejected" ${canDecide?'':'disabled'}><i class="fas fa-times"></i> Reject</button>
      <button class="decision-btn validate" data-decision="validated" ${canDecide && !critical ? '' : 'disabled'}><i class="fas fa-check"></i> Validate</button>
    </div>`;
  footer.querySelectorAll('[data-decision]').forEach(btn => btn.addEventListener('click', () => makeDecision(farm.id, btn.dataset.decision, modal)));
}

function componentRow(label,value) {
  const n = Number(value); const valid = Number.isFinite(n); const cls = valid && n < 70 ? 'bad' : valid && n < 90 ? 'warn' : '';
  return `<div class="component-row"><span>${esc(label)}</span><div class="component-bar"><div class="component-fill ${cls}" style="width:${valid ? Math.max(0,Math.min(100,n)) : 0}%"></div></div><strong class="component-value">${valid ? Math.round(n) : '—'}</strong></div>`;
}
function info(label,value){return `<div class="info-item"><span>${esc(label)}</span><strong>${esc(value == null || value === '' ? '—' : value)}</strong></div>`;}
function issueCard(issue,idx) {
  const sev = normalizeRole(issue.severity || 'low');
  return `<div class="issue-card ${esc(sev)}"><div class="issue-dot"></div><div class="issue-content"><strong>${esc(issue.title || labelIssue(issue.issue_type))}</strong><p>${esc(issue.description || 'Quality issue detected.')}</p></div>${hasIssueGeometry(issue) ? `<button class="issue-locate" type="button" data-locate="${idx}"><i class="fas fa-location-arrow"></i> Locate</button>` : ''}</div>`;
}

function renderReviewMap(farm, issues) {
  setTimeout(() => {
    const el = document.getElementById('reviewMap');
    if (!el || typeof L === 'undefined') return;
    reviewMap?.remove();
    reviewMap = L.map(el);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(reviewMap);
    let layers = [];
    if (farm.geometry) {
      const farmLayer = L.geoJSON(farm.geometry,{style:{color:'#2563eb',weight:3,fillOpacity:.16}}).addTo(reviewMap);
      layers.push(farmLayer);
    }
    issues.forEach(issue => {
      const geo = parseGeo(issue.issue_geometry);
      if (!geo) return;
      const layer = L.geoJSON(geo,{pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:7,color:'#dc2626',fillOpacity:.9}),style:{color:'#dc2626',weight:3}}).addTo(reviewMap);
      layers.push(layer);
    });
    const allBounds = layers.map(l=>l.getBounds?.()).filter(b=>b?.isValid?.());
    if (allBounds.length) {
      let b = allBounds[0]; allBounds.slice(1).forEach(x=>b=b.extend(x)); reviewMap.fitBounds(b,{padding:[30,30]});
    } else reviewMap.setView([7.54,-5.55],7);
    reviewMap.invalidateSize();
    document.querySelectorAll('[data-locate]').forEach(btn => btn.addEventListener('click',()=>{
      const issue = issues[Number(btn.dataset.locate)];
      const geo = parseGeo(issue.issue_geometry);
      if (!geo) return;
      const layer = L.geoJSON(geo);
      const b = layer.getBounds();
      if (b.isValid()) reviewMap.fitBounds(b,{maxZoom:17,padding:[80,80]});
    }));
  },50);
}

function openQuickMap(farmId) {
  const farm = farms.find(f=>f.id===farmId); if(!farm) return;
  const modal=document.createElement('div'); modal.className='qc-modal-overlay map-only';
  modal.innerHTML=`<div class="qc-modal"><div class="qc-modal-header"><div class="qc-modal-title"><div class="icon"><i class="fas fa-map-marked-alt"></i></div><div><h2>Farm Location</h2><p>${esc(farm.farmer_name || 'Unknown Farmer')} · ${esc(farm.farmer_id || farm.id)}</p></div></div><button class="modal-close"><i class="fas fa-times"></i></button></div><div class="qc-modal-body"><div id="quickMap" class="quick-map"></div><div class="map-caption"><strong>Area:</strong> ${farm.area != null ? Number(farm.area).toFixed(2) : '—'} ha · <strong>Workflow:</strong> ${esc(String(farm.workflow_state || farm.status || 'pending').replaceAll('_',' '))}</div></div></div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close').addEventListener('click',()=>closeModal(modal));
  setTimeout(()=>{
    quickMap=L.map('quickMap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(quickMap);
    if(farm.geometry){
      const layer=L.geoJSON(farm.geometry,{style:{color:'#2563eb',weight:3,fillOpacity:.2}}).addTo(quickMap);
      if(layer.getBounds().isValid()) quickMap.fitBounds(layer.getBounds(),{padding:[35,35]});
    } else quickMap.setView([7.54,-5.55],7);
    quickMap.invalidateSize();
  },50);
}

async function makeDecision(farmId, decision, modal) {
  let reason = '';
  if (decision !== 'validated') {
    reason = window.prompt(decision === 'rejected' ? 'Enter rejection reason:' : 'Enter correction reason:') || '';
    if (!reason.trim()) return;
  }
  if (!window.confirm(decision === 'validated' ? 'Validate this farm?' : decision === 'rejected' ? 'Reject this farm?' : 'Request correction for this farm?')) return;
  setLoading(true);
  try {
    const {data,error}=await supabaseClient.rpc('quality_decision',{p_farm_id:farmId,p_decision:decision,p_reason:reason.trim()||null});
    if(error) throw error;
    showToast(decision==='validated'?'Farm validated successfully.':decision==='rejected'?'Farm rejected successfully.':'Correction requested successfully.','success');
    closeModal(modal);
    await refreshData();
  } catch(e) {
    console.error(e);
    showToast(`Decision failed: ${e.message}`,'error');
  } finally { setLoading(false); }
}

function closeModal(modal){
  if(reviewMap){reviewMap.remove();reviewMap=null}
  if(quickMap){quickMap.remove();quickMap=null}
  if(modal){
    modal.remove();
  }
}

function clearFilters(){
  $('qcSearch').value=''; $('qcStatus').value='all'; $('qcSeverity').value='all'; $('qcIssueType').value='all'; $('qcMinScore').value='';
  applyFilters(true);
}

function normalizeIssueType(v){
  const s=String(v||'').toLowerCase();
  if(s.includes('protected')) return 'protected_area_conflict';
  if(s.includes('overlap')) return 'overlap_detected';
  if(s.includes('spike')) return 'spike_detected';
  if(s.includes('duplicate')) return 'duplicate_detected';
  return s;
}
function labelIssue(v){
  const s=normalizeIssueType(v);
  return ({self_intersection:'Self-intersection',protected_area_conflict:'Protected area conflict',overlap_detected:'Farm overlap',spike_detected:'Geometry spike',duplicate_detected:'Duplicate'})[s] || String(v||'Quality issue').replaceAll('_',' ');
}
function labelStatus(v){
  return ({passed:'Passed',review_required:'Review Required',issues_detected:'Issues Detected',not_checked:'Not Checked',pending:'Pending'})[v] || String(v||'Pending').replaceAll('_',' ');
}
function normalizeRole(v){return String(v||'').toLowerCase().replaceAll(' ','_');}
function hasIssueGeometry(i){return !!parseGeo(i.issue_geometry) || Number.isFinite(Number(i.latitude)) && Number.isFinite(Number(i.longitude));}
function parseGeo(g){
  if(!g)return null;
  if(typeof g==='string'){try{g=JSON.parse(g)}catch{return null}}
  if(g.type && g.coordinates) return g;
  return null;
}
function esc(v){
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
}
function setLoading(on){$('loadingOverlay')?.classList.toggle('hidden',!on)}
function showToast(message,type='success'){
  const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; $('toastContainer').appendChild(el);
  setTimeout(()=>el.remove(),4500);
}
})();
