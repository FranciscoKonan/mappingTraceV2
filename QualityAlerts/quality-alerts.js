(() => {
"use strict";

const SUPABASE_URL="https://crvnohvudurqfukjpisv.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjcnZub2h2dXVkcnFmdWtqcGlzdiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NDU1MTczLCJleHAiOjIwOTQwMzExNzN9.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8";

let db,currentUser,currentProject,allProjects=[];
let farms=[],filtered=[],quality=new Map(),issues=new Map();
let page=1,sortCol="farmer",sortDir="asc",map=null;

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const statusLabel=s=>({passed:"Passed",issues_detected:"Issues detected",review_required:"Review required",not_checked:"Not checked"}[s]||String(s||"Pending").replaceAll("_"," "));
const issueLabel=s=>({self_intersection:"Self-intersection",protected_area_conflict:"Protected area conflict",overlap_detected:"Farm overlap",spike_detected:"Geometry spike",duplicate_detected:"Duplicate geometry"}[s]||String(s||"Quality issue").replaceAll("_"," "));

document.addEventListener("DOMContentLoaded",init);

async function init(){
 db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 bindShell();
 const {data:{session}}=await db.auth.getSession();
 if(!session){location.href="../login.html";return}
 currentUser=session.user;
 await loadUserProjects();
}

function bindShell(){
 $("sidebarToggle")?.addEventListener("click",()=>{$("sidebar").classList.toggle("collapsed")});
 $("burgerBtn")?.addEventListener("click",()=>{$("sidebar").classList.toggle("mobile-open");$("sidebarOverlay").classList.toggle("active")});
 $("sidebarOverlay")?.addEventListener("click",()=>{$("sidebar").classList.remove("mobile-open");$("sidebarOverlay").classList.remove("active")});
 $("logoutBtn")?.addEventListener("click",async e=>{e.preventDefault();await db.auth.signOut();location.href="../login.html"});
 $("refreshTableBtn")?.addEventListener("click",refreshData);
 $("qcRefreshIcon")?.addEventListener("click",refreshData);
 $("qcApplyFilters")?.addEventListener("click",()=>applyFilters(true));
 $("qcClearFilters")?.addEventListener("click",clearFilters);
 $("qcSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter")applyFilters(true)});
 ["qcStatus","qcSeverity","qcIssueType"].forEach(id=>$(id)?.addEventListener("change",()=>applyFilters(true)));
 $("qcPrev")?.addEventListener("click",()=>{if(page>1){page--;renderTable()}});
 $("qcNext")?.addEventListener("click",()=>{if(page<Math.ceil(filtered.length/10)){page++;renderTable()}});
 document.querySelectorAll("th[data-sort]").forEach(th=>th.addEventListener("click",()=>sortBy(th.dataset.sort)));
}

async function loadUserProjects(){
 showLoading(true);
 const {data:profile}=await db.from("user_profiles").select("first_name,email").eq("id",currentUser.id).maybeSingle();
 const name=profile?.first_name||currentUser.email?.split("@")[0]||"User";
 $("userName").textContent=name;$("userAvatar").textContent=name[0].toUpperCase();

 const {data,error}=await db.from("project_members").select("project_id,role,projects(*)").eq("user_id",currentUser.id).eq("status","active");
 if(error){toast("Unable to load project membership: "+error.message,"error");showLoading(false);return}
 allProjects=data||[];
 if(!allProjects.length){toast("No active project membership found.","warning");showLoading(false);return}
 $("userRole").textContent=(allProjects[0].role||"").replaceAll("_"," ").toUpperCase();

 const requested=new URLSearchParams(location.search).get("project");
 const last=localStorage.getItem(`lastProject_${currentUser.id}`);
 const member=allProjects.find(x=>x.projects?.id===requested)||allProjects.find(x=>x.projects?.id===last)||allProjects[0];
 currentProject=member.projects;
 $("projectBadge").textContent=currentProject.name;
 $("selectedProjectName").textContent="📁 "+currentProject.name;
 updateNav();

 if(allProjects.some(x=>x.role==="owner")&&allProjects.length>1) setupProjectSelector();
 localStorage.setItem(`lastProject_${currentUser.id}`,currentProject.id);
 const u=new URL(location.href);u.searchParams.set("project",currentProject.id);history.replaceState({}, "", u);

 await refreshData();
 showLoading(false);
}

function updateNav(){
 const q=`?project=${encodeURIComponent(currentProject.id)}`;
 document.querySelector('[data-page="dashboard"]')?.setAttribute("href","../Dashboard.html"+q);
 document.querySelector('[data-page="live-mapping"]')?.setAttribute("href","../LiveMapping/live-mapping.html"+q);
 document.querySelector('[data-page="submissions"]')?.setAttribute("href","../Submissions/submissions.html"+q);
 document.querySelector('[data-page="quality-alerts"]')?.setAttribute("href","quality-alerts.html"+q);
 document.querySelector('[data-page="exports"]')?.setAttribute("href","../Exports/exports.html"+q);
 $("dataMgmtLink")?.setAttribute("href","../DataManagement.html"+q);
}

function setupProjectSelector(){
 $("projectSelectorContainer").classList.remove("hidden");
 $("dropdownItems").innerHTML=allProjects.map(m=>`<div class="dropdown-item" data-id="${esc(m.projects.id)}">📁 ${esc(m.projects.name)}</div>`).join("");
 $("dropdownSelected").addEventListener("click",e=>{e.stopPropagation();$("dropdownMenu").classList.toggle("show")});
 $("projectSearch").addEventListener("input",e=>document.querySelectorAll(".dropdown-item").forEach(x=>x.style.display=x.textContent.toLowerCase().includes(e.target.value.toLowerCase())?"":"none"));
 document.querySelectorAll(".dropdown-item").forEach(item=>item.addEventListener("click",async()=>{const m=allProjects.find(x=>x.projects.id===item.dataset.id);if(!m)return;currentProject=m.projects;$("projectBadge").textContent=currentProject.name;$("selectedProjectName").textContent="📁 "+currentProject.name;$("dropdownMenu").classList.remove("show");localStorage.setItem(`lastProject_${currentUser.id}`,currentProject.id);updateNav();await refreshData()}));
 document.addEventListener("click",()=>$("dropdownMenu").classList.remove("show"));
}

async function refreshData(){
 if(!currentProject?.id)return;
 showLoading(true);
 const {data,error}=await db.from("farms").select("*").eq("project_id",currentProject.id).order("created_at",{ascending:false});
 if(error){toast("Error loading farms: "+error.message,"error");showLoading(false);return}
 farms=data||[];quality.clear();issues.clear();
 const ids=farms.map(f=>f.id);
 if(ids.length){
   const q=await db.from("farm_quality").select("*").in("farm_id",ids);
   (q.data||[]).forEach(x=>quality.set(x.farm_id,x));
   for(let i=0;i<ids.length;i+=200){
     const r=await db.from("farm_quality_issues").select("*").in("farm_id",ids.slice(i,i+200));
     (r.data||[]).forEach(x=>{if(!issues.has(x.farm_id))issues.set(x.farm_id,[]);issues.get(x.farm_id).push(x)});
   }
 }
 applyFilters(true);showLoading(false);
}

function applyFilters(reset){
 const s=$("qcSearch").value.trim().toLowerCase(),st=$("qcStatus").value,se=$("qcSeverity").value,ty=$("qcIssueType").value;
 filtered=farms.map(f=>row(f)).filter(r=>{
   if(s&&!`${r.farmer_name} ${r.farmer_id} ${r.cooperative} ${r.id}`.toLowerCase().includes(s))return false;
   if(st!=="all"&&r.status!==st)return false;
   if(se!=="all"&&!r.issues.some(i=>String(i.severity).toLowerCase()===se))return false;
   if(ty!=="all"&&!r.issues.some(i=>i.issue_type===ty))return false;
   return true;
 });
 filtered.sort((a,b)=>compare(a,b));
 if(reset)page=1;
 updateStats();renderTable();
}

function row(f){
 const q=quality.get(f.id)||{},is=issues.get(f.id)||[],score=Number.isFinite(Number(q.overall_score))?Number(q.overall_score):null;
 const critical=is.filter(x=>String(x.severity).toLowerCase()==="critical").length;
 return {...f,score,status:q.quality_status||"not_checked",issues:is,critical,priority:critical*100000+(100-(score??0))*100+is.length};
}
function compare(a,b){
 let x=sortCol==="score"?a.score??-1:String(a.farmer_name||"").toLowerCase(),y=sortCol==="score"?b.score??-1:String(b.farmer_name||"").toLowerCase();
 return (x===y?0:x<y?-1:1)*(sortDir==="asc"?1:-1);
}
function sortBy(c){if(sortCol===c)sortDir=sortDir==="asc"?"desc":"asc";else{sortCol=c;sortDir="asc"}applyFilters(false)}

function updateStats(){
 $("qcTotal").textContent=filtered.length;
 $("qcPassed").textContent=filtered.filter(x=>x.status==="passed").length;
 $("qcReview").textContent=filtered.filter(x=>["review_required","not_checked"].includes(x.status)).length;
 $("qcCritical").textContent=filtered.filter(x=>x.critical>0).length;
 const a=filtered.map(x=>x.score).filter(Number.isFinite);$("qcAvgScore").textContent=a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):"—";
 $("navAlertCount").textContent=filtered.filter(x=>x.critical>0).length;
}

function renderTable(){
 const body=$("qualityQueueBody"),start=(page-1)*10,rows=filtered.slice(start,start+10);
 if(!rows.length){body.innerHTML=`<tr><td colspan="8" class="loading-cell"><i class="fas fa-inbox"></i> No farms match the current filters.</td></tr>`}
 else body.innerHTML=rows.map(r=>{
   const sc=r.status==="passed"?"passed":r.status==="issues_detected"?"failed":r.status==="review_required"?"review":"pending";
   const area=Number(r.area_ha??r.area??0);
   return `<tr>
    <td><div class="qc-farmer"><strong>${esc(r.farmer_name||"Unknown")}</strong><span>${esc(r.farmer_id||r.id)}</span></div></td>
    <td>${esc(r.cooperative||"Unassigned")}</td>
    <td>${area?area.toFixed(2):"—"} ha</td>
    <td class="score">${r.score==null?"—":Math.round(r.score)} / 100</td>
    <td><span class="status-badge ${sc}">${esc(statusLabel(r.status))}</span></td>
    <td>${r.issues.length?`<span class="issue-chip">${r.issues.length} issue${r.issues.length>1?"s":""}</span>`:`<span style="color:#8792a2">None</span>`}</td>
    <td>${esc(String(r.workflow_state||r.status||"pending").replaceAll("_"," "))}</td>
    <td><div class="action-group"><button class="row-action primary" onclick="openQualityReview('${r.id}')">Review</button><button class="row-action" onclick="viewFarmMap('${r.id}')" title="Map"><i class="fas fa-map"></i></button></div></td>
   </tr>`}).join("");
 $("qcShowing").textContent=filtered.length?`${start+1}–${Math.min(start+10,filtered.length)}`:"0";
 $("qcTotalFooter").textContent=filtered.length;
 const pages=Math.max(1,Math.ceil(filtered.length/10));$("qcPageInfo").textContent=`Page ${page} of ${pages}`;$("qcPrev").disabled=page<=1;$("qcNext").disabled=page>=pages;
}

async function openQualityReview(id){
 const farm=farms.find(x=>x.id===id);if(!farm)return;
 const overlay=document.createElement("div");overlay.className="qc-modal-overlay";overlay.id="activeQcModal";
 overlay.innerHTML=`<div class="qc-modal"><div class="qc-modal-header"><div class="modal-title"><div><h2>Farm Quality Review</h2><p>${esc(farm.farmer_name||"Unknown")} · ${esc(farm.farmer_id||farm.id)}</p></div></div><button class="modal-close" onclick="closeQcModal()">×</button></div><div class="qc-modal-body" id="reviewBody"><div class="loading-cell"><i class="fas fa-spinner fa-spin"></i> Running quality checks...</div></div><div class="qc-modal-footer" id="reviewFooter"></div></div>`;
 document.body.appendChild(overlay);
 const {data,error}=await db.rpc("run_full_quality_check",{p_farm_id:id});
 if(error){$("reviewBody").innerHTML=`<div class="loading-cell" style="color:#b42318"><i class="fas fa-triangle-exclamation"></i> ${esc(error.message)}</div>`;return}
 await reloadIssues(id);
 const result=data||{},q=result.score_details||quality.get(id)||{},is=issues.get(id)||[];
 const score=Number(result.overall_score??q.overall_score),critical=is.some(x=>String(x.severity).toLowerCase()==="critical");
 $("reviewBody").innerHTML=`
 <div class="review-summary">
  <div class="score-box"><span class="label">Overall Quality Score</span><div class="big-score">${Number.isFinite(score)?Math.round(score):"—"}<small style="font-size:14px;color:#8993a3"> / 100</small></div><span class="status-badge ${result.quality_status==="passed"?"passed":critical?"failed":"review"}">${esc(statusLabel(result.quality_status))}</span></div>
  <div class="checks-box">${["geometry","mapping","spatial","attribute","traceability"].map(k=>checkRow(k,q[k+"_score"])).join("")}</div>
 </div>
 <div class="review-grid">
  <div>
   <div class="farm-info-box"><h3>Farm Information</h3><div class="info-grid">${info("Farmer",farm.farmer_name)}${info("Farmer ID",farm.farmer_id||farm.id)}${info("Area",(farm.area_ha??farm.area)!=null?`${Number(farm.area_ha??farm.area).toFixed(2)} ha`:"—")}${info("Workflow",String(farm.workflow_state||farm.status||"pending").replaceAll("_"," "))}</div></div>
   <div class="issues-box" style="margin-top:14px"><h3>Quality Issues (${is.length})</h3>${is.length?is.map((x,i)=>`<div class="issue-card ${x.severity==="warning"?"warning":""}"><div class="issue-title">${esc(x.title||issueLabel(x.issue_type))}</div><div class="issue-description">${esc(x.description||"Quality issue detected.")}</div>${x.latitude!=null&&x.longitude!=null?`<button class="locate-btn" onclick="locateIssue(${Number(x.latitude)},${Number(x.longitude)})"><i class="fas fa-location-arrow"></i> Locate on map</button>`:""}</div>`).join(""):`<div style="font-size:11px;color:#718096"><i class="fas fa-circle-check" style="color:#2f7d59"></i> No quality issues detected.</div>`}</div>
  </div>
  <div class="map-box"><div id="reviewMap" class="review-map"></div></div>
 </div>`;
 $("reviewFooter").innerHTML=`<div class="decision-note">${critical?"Critical issue detected — Validate is blocked.":"Review the evidence before making a decision."}</div><div class="decision-actions"><button class="decision-btn correction" onclick="qualityDecision('${id}','correction_required')">Request Correction</button><button class="decision-btn reject" onclick="qualityDecision('${id}','rejected')">Reject</button><button class="decision-btn validate" ${critical?"disabled":""} onclick="qualityDecision('${id}','validated')">✓ Validate</button></div>`;
 renderMap(farm,is);
}

function checkRow(k,v){const n=Number(v);return `<div class="check-row"><span>${k==="attribute"?"Attributes":k[0].toUpperCase()+k.slice(1)}</span><div class="bar"><span style="width:${Number.isFinite(n)?Math.max(0,Math.min(100,n)):0}%"></span></div><strong>${Number.isFinite(n)?Math.round(n):"—"}</strong></div>`}
function info(a,b){return `<div><span>${esc(a)}</span><strong>${esc(b||"—")}</strong></div>`}
async function reloadIssues(id){const r=await db.from("farm_quality_issues").select("*").eq("farm_id",id);if(!r.error)issues.set(id,r.data||[])}
function parseGeo(g){if(!g)return null;if(typeof g==="string"){try{g=JSON.parse(g)}catch{return null}}return g?.type&&g?.coordinates?g:null}

function renderMap(farm,is){
 setTimeout(()=>{
  const el=$("reviewMap");if(!el||!window.L)return;
  map=L.map(el).setView([7.5,-5.5],7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors"}).addTo(map);
  const layers=[];
  const fg=parseGeo(farm.geometry);if(fg){const l=L.geoJSON(fg,{style:{color:"#245f45",weight:3,fillOpacity:.14}}).addTo(map);layers.push(l)}
  is.forEach(x=>{let g=parseGeo(x.issue_geometry);if(!g&&x.latitude!=null&&x.longitude!=null)g={type:"Point",coordinates:[Number(x.longitude),Number(x.latitude)]};if(g){const l=L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:7,color:"#dc2626",fillOpacity:.9}),style:{color:"#dc2626",weight:3}}).addTo(map);layers.push(l)}});
  if(layers.length){let b=layers[0].getBounds();layers.slice(1).forEach(x=>{const z=x.getBounds();if(z.isValid())b=b.extend(z)});if(b.isValid())map.fitBounds(b,{padding:[25,25]})}
  map.invalidateSize();
 },50);
}
function locateIssue(lat,lng){if(map){map.setView([lat,lng],17,{animate:true});L.circleMarker([lat,lng],{radius:9,color:"#dc2626",fillOpacity:.15}).addTo(map)}}
function viewFarmMap(id){const f=farms.find(x=>x.id===id);if(!f)return;openQualityReview(id)}
function closeQcModal(){if(map){map.remove();map=null}$("activeQcModal")?.remove()}

async function qualityDecision(id,decision){
 const text=decision==="validated"?"Validate this farm?":decision==="rejected"?"Reject this farm?":"Request correction for this farm?";
 if(!confirm(text))return;
 let reason=null;
 if(decision!=="validated"){reason=prompt(decision==="rejected"?"Rejection reason:":"Correction reason:");if(!reason?.trim())return}
 try{
  const {error}=await db.rpc("quality_decision",{p_farm_id:id,p_decision:decision,p_reason:reason?.trim()||null});
  if(error)throw error;
  toast(decision==="validated"?"Farm validated.":decision==="rejected"?"Farm rejected.":"Correction requested.","success");
  closeQcModal();await refreshData();
 }catch(e){toast("Decision failed: "+e.message,"error")}
}

function clearFilters(){$("qcSearch").value="";$("qcStatus").value="all";$("qcSeverity").value="all";$("qcIssueType").value="all";applyFilters(true)}
function showLoading(x){$("loadingOverlay")?.classList.toggle("hidden",!x)}
function toast(msg,type="success"){const x=document.createElement("div");x.className="toast "+type;x.textContent=msg;$("toastContainer").appendChild(x);setTimeout(()=>x.remove(),4000)}

window.openQualityReview=openQualityReview;
window.closeQcModal=closeQcModal;
window.viewFarmMap=viewFarmMap;
window.locateIssue=locateIssue;
window.qualityDecision=qualityDecision;
window.qcClearFilters=clearFilters;
window.refreshData=refreshData;
})();
