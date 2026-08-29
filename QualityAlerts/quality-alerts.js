/* =========================================================
   MappingTrace — Quality Alerts
   Auth/session pattern matches the working Submissions page.
   ========================================================= */
(() => {
'use strict';

const SUPABASE_URL = 'https://crvnohvudurqfukjpisv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQXG7fo8';

let supabaseClient = null;
let currentUser = null;
let currentProject = null;
let currentProjectRole = null;
let allUserProjects = [];
let farms = [];
let qualityIssues = [];
let activeTab = 'protected';
let protectedPage = 1;
let polygonPage = 1;
const rowsPerPage = 10;
let reviewFarm = null;
let reviewMap = null;

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm = value => String(value ?? '').toLowerCase().trim();

/* -------------------- initialization -------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📌 Quality Alerts DOM loaded');
    try {
        if (!window.supabase) throw new Error('Supabase library is not loaded.');
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        setupShell();
        await loadUserAndProjects();
    } catch (error) {
        console.error('❌ Quality Alerts initialization error:', error);
        showNotification(error?.message || 'Unable to initialize Quality Alerts.', 'error');
    } finally {
        showLoading(false);
    }
});

function setupShell() {
    const sidebar = $('sidebar'), overlay = $('sidebarOverlay');
    $('burgerBtn')?.addEventListener('click', () => { sidebar?.classList.toggle('mobile-open'); overlay?.classList.toggle('active'); });
    $('sidebarToggle')?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));
    overlay?.addEventListener('click', () => { sidebar?.classList.remove('mobile-open'); overlay?.classList.remove('active'); });
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') sidebar?.classList.add('collapsed');
    sidebar?.addEventListener('transitionend', () => localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed')));
    $('dropdownSelected')?.addEventListener('click', e => { e.stopPropagation(); $('dropdownMenu')?.classList.toggle('show'); });
    $('projectSearch')?.addEventListener('input', e => filterDropdown(e.target.value));
    document.addEventListener('click', () => $('dropdownMenu')?.classList.remove('show'));
    $('refreshBtn')?.addEventListener('click', refreshAll);
    $('logoutBtn')?.addEventListener('click', async e => { e.preventDefault(); await supabaseClient.auth.signOut(); localStorage.clear(); location.href = '../login.html'; });
}

async function loadUserAndProjects() {
    showLoading(true);
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) { location.href = '../login.html'; return; }
    currentUser = session.user;

    const { data: profile, error: profileError } = await supabaseClient.from('user_profiles').select('first_name,email').eq('id', currentUser.id).maybeSingle();
    if (profileError) throw profileError;
    const firstName = profile?.first_name || '';
    const displayName = firstName || currentUser.email?.split('@')[0] || 'User';
    if ($('userName')) $('userName').textContent = displayName;
    if ($('userAvatar')) $('userAvatar').textContent = (firstName.charAt(0) || currentUser.email?.charAt(0) || 'U').toUpperCase();

    const { data: memberships, error: membershipError } = await supabaseClient
        .from('project_members').select('project_id, role, projects(*)').eq('user_id', currentUser.id).eq('status', 'active');
    if (membershipError) throw membershipError;
    if (!memberships?.length) throw new Error('You are not assigned to any active project.');
    allUserProjects = memberships;

    const requested = new URLSearchParams(location.search).get('project');
    const last = localStorage.getItem(`lastProject_${currentUser.id}`);
    const target = memberships.find(m => m.projects?.id === requested) || memberships.find(m => m.projects?.id === last) || memberships[0];
    currentProject = target.projects;
    currentProjectRole = target.role;

    if ($('userRole')) $('userRole').textContent = String(currentProjectRole || '').replace(/_/g,' ').toUpperCase();
    if ($('projectBadge')) $('projectBadge').textContent = currentProject.name;
    if ($('selectedProjectName')) $('selectedProjectName').innerHTML = `📁 ${esc(currentProject.name)}`;

    if (memberships.length > 1) {
        $('projectSelectorContainer')?.classList.remove('hidden');
        populateDropdown(memberships);
    }
    localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
    updateNavigationLinks();
    updateUrl();
    await loadQualityData();
    renderAll();
}

function populateDropdown(memberships) {
    const container = $('dropdownItems'); if (!container) return;
    container.innerHTML = memberships.filter(m => m.projects).map(m => `<div class="dropdown-item" data-value="${esc(m.projects.id)}">📁 ${esc(m.projects.name)}</div>`).join('');
    container.querySelectorAll('.dropdown-item').forEach(item => item.addEventListener('click', async e => {
        e.stopPropagation();
        const selected = memberships.find(m => m.projects?.id === item.dataset.value); if (!selected) return;
        currentProject = selected.projects; currentProjectRole = selected.role;
        localStorage.setItem(`lastProject_${currentUser.id}`, currentProject.id);
        updateUrl(); updateNavigationLinks();
        $('projectBadge').textContent = currentProject.name; $('selectedProjectName').textContent = `📁 ${currentProject.name}`;
        $('dropdownMenu')?.classList.remove('show');
        await loadQualityData(); renderAll();
    }));
}
function filterDropdown(term) { const q = norm(term); document.querySelectorAll('.dropdown-item').forEach(x => x.style.display = norm(x.textContent).includes(q) ? 'block' : 'none'); }
function updateUrl() { const u = new URL(location.href); u.searchParams.set('project', currentProject.id); history.replaceState({}, '', u); }
function updateNavigationLinks() {
    const q = `?project=${encodeURIComponent(currentProject.id)}`;
    document.querySelector('[data-page="dashboard"]')?.setAttribute('href', `../Dashboard.html${q}`);
    document.querySelector('[data-page="live-mapping"]')?.setAttribute('href', `../LiveMapping/live-mapping.html${q}`);
    document.querySelector('[data-page="submissions"]')?.setAttribute('href', `../Submissions/submissions.html${q}`);
    document.querySelector('[data-page="exports"]')?.setAttribute('href', `../Exports/exports.html${q}`);
    $('dataMgmtLink')?.setAttribute('href', `../DataManagement.html${q}`);
}

/* -------------------- quality data -------------------- */
async function loadQualityData() {
    showLoading(true);
    const { data: farmData, error: farmError } = await supabaseClient.from('farms').select('*').eq('project_id', currentProject.id).order('created_at',{ascending:false});
    if (farmError) throw farmError;
    farms = farmData || [];
    qualityIssues = [];
    for (let i=0; i<farms.length; i+=200) {
        const ids = farms.slice(i,i+200).map(f => f.id);
        if (!ids.length) continue;
        const { data, error } = await supabaseClient.from('farm_quality_issues').select('*').in('farm_id', ids);
        if (error) console.warn('Quality issues query failed:', error);
        else qualityIssues.push(...(data || []));
    }
    showLoading(false);
}

function renderAll() { renderStats(); populateSupplierFilters(); renderProtected(); renderPolygon(); }
function renderStats() {
    const c = {critical:0,high:0,medium:0,low:0};
    qualityIssues.forEach(i => { const s=norm(i.severity); if (c[s] !== undefined) c[s]++; });
    Object.entries(c).forEach(([k,v]) => { if ($(k+'Count')) $(k+'Count').textContent=v; });
    if ($('totalAlerts')) $('totalAlerts').textContent=qualityIssues.length;
    if ($('protectedBadge')) $('protectedBadge').textContent=qualityIssues.filter(isProtected).length;
    if ($('polygonBadge')) $('polygonBadge').textContent=qualityIssues.filter(i=>!isProtected(i)).length;
}
function populateSupplierFilters() {
    const suppliers=[...new Set(farms.map(f=>f.supplier).filter(Boolean))].sort();
    ['protectedSupplierFilter','polygonSupplierFilter'].forEach(id=>{ const el=$(id); if(!el)return; const old=el.value; el.innerHTML='<option value="all">All Suppliers</option>'+suppliers.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(''); if(suppliers.includes(old))el.value=old; });
}
function isProtected(i){return norm(i.issue_type)==='protected_area_conflict';}
function getFarm(i){return farms.find(f=>f.id===i.farm_id);}
function filterIssues(kind){
    let data=qualityIssues.filter(i=>kind==='protected'?isProtected(i):!isProtected(i));
    const prefix=kind==='protected'?'protected':'polygon';
    const type=$(prefix+'TypeFilter')?.value||'all', sev=$(prefix+'SeverityFilter')?.value||'all', supplier=$(prefix+'SupplierFilter')?.value||'all', status=$(prefix+'StatusFilter')?.value||'all';
    if(kind==='polygon' && type!=='all') data=data.filter(i=>norm(i.issue_type).includes(norm(type)));
    if(sev!=='all')data=data.filter(i=>norm(i.severity)===sev);
    if(supplier!=='all')data=data.filter(i=>getFarm(i)?.supplier===supplier);
    if(status!=='all')data=data.filter(i=>norm(i.status)===status);
    return data;
}
function renderProtected(){renderList('protected',filterIssues('protected'));}
function renderPolygon(){renderList('polygon',filterIssues('polygon'));}
function renderList(kind,data){
    const prefix=kind==='protected'?'protected':'polygon', page=kind==='protected'?protectedPage:polygonPage, totalPages=Math.max(1,Math.ceil(data.length/rowsPerPage)), safePage=Math.min(page,totalPages), slice=data.slice((safePage-1)*rowsPerPage,safePage*rowsPerPage);
    if(kind==='protected')protectedPage=safePage; else polygonPage=safePage;
    $(prefix+'AlertCount').textContent=`${data.length} alerts`; $(prefix+'ShowingCount').textContent=slice.length;
    $(prefix+'AlertsList').innerHTML=slice.length?slice.map(alertRow).join(''):`<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No ${kind==='protected'?'Protected Area':'Polygon Quality'} Alerts</h3><p>${kind==='protected'?'All farms are outside protected areas.':'All polygons pass quality checks.'}</p></div>`;
    $(prefix+'PageInfo').textContent=`Page ${safePage} of ${totalPages}`; $(prefix+'PrevBtn').disabled=safePage<=1; $(prefix+'NextBtn').disabled=safePage>=totalPages;
}
function alertRow(i){
    const farm=getFarm(i), name=farm?.farmer_name||'Unknown Farmer', area=Number(farm?.area_ha??farm?.area);
    return `<div class="alert-row"><div><span class="severity-badge ${esc(norm(i.severity)||'low')}">${esc(i.severity||'low')}</span></div><div class="alert-farmer"><strong>${esc(i.title||i.issue_type||'Quality Issue')}</strong><small>${esc(name)}</small></div><div class="alert-desc">${esc(i.description||'Quality issue detected.')}</div><div>${Number.isFinite(Number(i.latitude))&&Number.isFinite(Number(i.longitude))?`${Number(i.latitude).toFixed(5)}, ${Number(i.longitude).toFixed(5)}`:'—'}</div><div>${esc(i.status||'new')}</div><div><button class="alert-action" onclick="openQualityReview('${esc(i.farm_id)}')">Review</button></div></div>`;
}

/* -------------------- tab/filter handlers -------------------- */
window.switchTab = function(tab){activeTab=tab;document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-content').forEach(c=>c.classList.toggle('active',c.id===tab+'Tab'));};
window.applyProtectedFilters=()=>{protectedPage=1;renderProtected();};
window.clearProtectedFilters=()=>{['protectedSeverityFilter','protectedSupplierFilter','protectedStatusFilter'].forEach(id=>{if($(id))$(id).value='all';});protectedPage=1;renderProtected();};
window.applyPolygonFilters=()=>{polygonPage=1;renderPolygon();};
window.clearPolygonFilters=()=>{['polygonTypeFilter','polygonSeverityFilter','polygonSupplierFilter','polygonStatusFilter'].forEach(id=>{if($(id))$(id).value='all';});polygonPage=1;renderPolygon();};
window.markProtectedRead=()=>markRead('protected'); window.markPolygonRead=()=>markRead('polygon');
async function markRead(kind){const ids=filterIssues(kind).filter(i=>norm(i.status)==='new').map(i=>i.id);if(!ids.length){showNotification('No new alerts to mark as read.','info');return;}const {error}=await supabaseClient.from('farm_quality_issues').update({status:'acknowledged'}).in('id',ids);if(error){showNotification(error.message,'error');return;}await loadQualityData();renderAll();showNotification('Alerts marked as read.','success');}
window.refreshProtectedAlerts=async()=>{await refreshAll();}; window.refreshPolygonAlerts=async()=>{await refreshAll();};
window.protectedPrevPage=()=>{if(protectedPage>1){protectedPage--;renderProtected();}}; window.protectedNextPage=()=>{protectedPage++;renderProtected();};
window.polygonPrevPage=()=>{if(polygonPage>1){polygonPage--;renderPolygon();}}; window.polygonNextPage=()=>{polygonPage++;renderPolygon();};

/* -------------------- review -------------------- */
window.openQualityReview = async function(farmId){
    reviewFarm=farms.find(f=>f.id===farmId); if(!reviewFarm){showNotification('Farm not found.','error');return;}
    $('qcReviewModal').classList.remove('hidden'); $('qcReviewTitle').textContent=reviewFarm.farmer_name||'Farm Quality Review'; $('qcReviewSubtitle').textContent=`${reviewFarm.farmer_id||reviewFarm.id} · ${reviewFarm.workflow_state||reviewFarm.status||'pending'}`; $('qcReviewIssues').innerHTML='<div style="font-size:11px;color:#697386">Running GIS quality checks…</div>';
    const {data,result,error}=await runFullCheck(farmId);
    if(error){$('qcReviewIssues').innerHTML=`<div style="font-size:11px;color:#b42318">${esc(error.message)}</div>`;return;}
    await reloadFarmIssues(farmId);
    const list=qualityIssues.filter(i=>i.farm_id===farmId), scores=data?.score_details||{}, overall=Number(data?.overall_score??scores.overall_score);
    $('qcReviewScore').textContent=Number.isFinite(overall)?Math.round(overall):'—'; $('qcReviewStatus').textContent=data?.quality_status||'pending'; $('qcIssueCount').textContent=`(${list.length})`;
    $('qcComponents').innerHTML=['geometry','mapping','spatial','attribute','traceability'].map(k=>{const n=Number(scores[k+'_score']);return `<div class="qc-component"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="qc-bar"><span style="width:${Number.isFinite(n)?Math.max(0,Math.min(100,n)):0}%"></span></div><strong>${Number.isFinite(n)?Math.round(n):'—'}</strong></div>`}).join('');
    $('qcFarmInfo').innerHTML=[['Farmer',reviewFarm.farmer_name],['Farmer ID',reviewFarm.farmer_id||reviewFarm.id],['Area',Number.isFinite(Number(reviewFarm.area_ha??reviewFarm.area))?Number(reviewFarm.area_ha??reviewFarm.area).toFixed(2)+' ha':'—'],['Workflow',String(reviewFarm.workflow_state||reviewFarm.status||'pending').replaceAll('_',' ')]].map(([a,b])=>`<div><span>${esc(a)}</span><strong>${esc(b||'—')}</strong></div>`).join('');
    $('qcReviewIssues').innerHTML=list.length?list.map(i=>`<div class="qc-issue ${norm(i.severity)==='warning'?'warning':''}"><strong>${esc(i.title||i.issue_type||'Quality Issue')}</strong><p>${esc(i.description||'')}</p>${i.latitude!=null&&i.longitude!=null?`<button class="qc-locate" onclick="locateIssue(${Number(i.latitude)},${Number(i.longitude)})"><i class="fas fa-location-arrow"></i> Locate on map</button>`:''}</div>`).join(''):'<div style="font-size:11px;color:#697386">✓ No quality issues detected.</div>';
    const critical=list.some(i=>norm(i.severity)==='critical'); $('qcValidateBtn').disabled=critical; $('qcDecisionNote').textContent=critical?'Critical issue detected — resolve or correct the issue before validation.':'Review the evidence before making a decision.';
    renderReviewMap(reviewFarm,list);
};
async function runFullCheck(farmId){return await supabaseClient.rpc('run_full_quality_check',{p_farm_id:farmId});}
async function reloadFarmIssues(farmId){const {data,error}=await supabaseClient.from('farm_quality_issues').select('*').eq('farm_id',farmId);if(!error){qualityIssues=qualityIssues.filter(i=>i.farm_id!==farmId).concat(data||[]);}}
function parseGeometry(g){if(!g)return null;if(typeof g==='object')return g;try{return JSON.parse(g)}catch{return null}}
function renderReviewMap(farm,list){
    setTimeout(()=>{
        if(!window.L||!$('qcReviewMap'))return; reviewMap?.remove(); reviewMap=L.map('qcReviewMap');
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom:22,subdomains:['mt0','mt1','mt2','mt3'],attribution:'Google'}).addTo(reviewMap);
        const layers=[]; const fg=parseGeometry(farm.geometry);
        if(fg){const l=L.geoJSON(fg,{style:{color:'#245f45',weight:3,fillOpacity:.18}}).addTo(reviewMap);layers.push(l);}
        list.forEach(i=>{let g=parseGeometry(i.issue_geometry);if(!g&&i.latitude!=null&&i.longitude!=null)g={type:'Point',coordinates:[Number(i.longitude),Number(i.latitude)]};if(g){const l=L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:7,color:'#c62828',fillOpacity:.9}),style:{color:'#c62828',weight:3}}).addTo(reviewMap);layers.push(l);}});
        if(layers.length){let bounds=null;layers.forEach(l=>{if(l.getBounds?.().isValid()){bounds=bounds?bounds.extend(l.getBounds()):l.getBounds();}});if(bounds?.isValid())reviewMap.fitBounds(bounds,{padding:[20,20]});}else reviewMap.setView([7.54,-5.55],8);
        reviewMap.invalidateSize();
    },100);
}
window.locateIssue=(lat,lng)=>{if(reviewMap){reviewMap.setView([lat,lng],17);L.circleMarker([lat,lng],{radius:9,color:'#c62828',fillOpacity:.12}).addTo(reviewMap);}};
window.closeQualityReview=()=>{reviewMap?.remove();reviewMap=null;$('qcReviewModal').classList.add('hidden');};
window.qualityDecision=async function(decision){
    if(!reviewFarm)return;
    let reason=null;if(decision!=='validated'){reason=prompt(decision==='rejected'?'Rejection reason:':'Describe the correction required:');if(!reason?.trim())return;}
    if(!confirm(`${decision==='validated'?'Validate':decision==='rejected'?'Reject':'Request correction'} this farm?`))return;
    showLoading(true);
    try{
        const {data,error}=await supabaseClient.rpc('transition_farm_workflow',{p_farm_id:reviewFarm.id,p_to_state:decision,p_reason:reason?.trim()||null});
        if(error)throw error;
        showNotification('Workflow decision saved successfully.','success');window.closeQualityReview();await loadQualityData();renderAll();
        return data;
    }catch(e){showNotification(e?.message||'Workflow decision failed.','error');}finally{showLoading(false);}
};

async function refreshAll(){showLoading(true);try{await loadQualityData();renderAll();showNotification('Quality alerts refreshed.','success');}catch(e){showNotification(e.message,'error');}finally{showLoading(false);}}
function showLoading(show){$('loadingOverlay')?.classList.toggle('hidden',!show);}
function showNotification(message,type='info'){const n=document.createElement('div');n.className=`qc-toast ${type}`;n.textContent=message;n.style.cssText='position:fixed;right:20px;bottom:20px;z-index:9999;padding:10px 14px;border-radius:6px;color:#fff;font-size:11px;background:'+(type==='error'?'#b42318':type==='success'?'#23764b':'#475467')+';box-shadow:0 8px 24px #0002';document.body.appendChild(n);setTimeout(()=>n.remove(),4000);}

console.log('✅ Quality Alerts JavaScript loaded');
})();
