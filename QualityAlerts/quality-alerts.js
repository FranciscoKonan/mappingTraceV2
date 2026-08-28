(() => {
"use strict";

const SUPABASE_URL="https://crvnohvudurqfukjpisv.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjcnZub2h2dXVkcnFmdWtqcGlzdiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NDU1MTczLCJleHAiOjIwOTQwMzExNzN9.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8";
let db,user,project,farms=[],issues=[],activeTab="protected",protectedPage=1,polygonPage=1,currentFarm=null,currentResult=null,map=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const typeOf=x=>String(x||"").toLowerCase();
const issueType=x=>typeOf(x.issue_type);
const sev=x=>typeOf(x.severity);

document.addEventListener("DOMContentLoaded",()=>{try{init()}catch(e){console.error(e);finishLoading();showError(e.message)}});

async function init(){
 showLoading(true);
 if(!window.supabase?.createClient)throw Error("Supabase client library failed to load.");
 db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const {data:{session}}=await db.auth.getSession();
 if(!session){location.href="../login.html";return}
 user=session.user;
 bindShell();
 await loadIdentity();
 await resolveProject();
 await loadData();
 renderAll();
 finishLoading();
}

function bindShell(){
 $("sidebarToggle")?.addEventListener("click",()=>{ $("sidebar").classList.toggle("collapsed")});
 $("burgerBtn")?.addEventListener("click",()=>{ $("sidebar").classList.toggle("mobile-open");$("sidebarOverlay").classList.toggle("active")});
 $("sidebarOverlay")?.addEventListener("click",()=>{ $("sidebar").classList.remove("mobile-open");$("sidebarOverlay").classList.remove("active")});
 $("dropdownSelected")?.addEventListener("click",e=>{e.stopPropagation();$("dropdownMenu").classList.toggle("show")});
 $("projectSearch")?.addEventListener("input",filterProjects);
 $("refreshBtn")?.addEventListener("click",refreshAll);
 $("logoutBtn")?.addEventListener("click",async e=>{e.preventDefault();await db.auth.signOut();location.href="../login.html"});
 document.addEventListener("click",()=> $("dropdownMenu")?.classList.remove("show"));
}

async function loadIdentity(){
 const {data}=await db.from("user_profiles").select("first_name,email").eq("id",user.id).maybeSingle();
 const n=data?.first_name||user.email?.split("@")[0]||"User";
 $("userName").textContent=n;$("userAvatar").textContent=n.slice(0,2).toUpperCase();
}

async function resolveProject(){
 const {data,error}=await db.from("project_members").select("project_id,role,projects(*)").eq("user_id",user.id).eq("status","active");
 if(error)throw error;if(!data?.length)throw Error("No active project membership found.");
 const requested=new URLSearchParams(location.search).get("project");
 const last=localStorage.getItem(`lastProject_${user.id}`);
 const m=data.find(x=>x.projects?.id===requested)||data.find(x=>x.projects?.id===last)||data[0];
 project=m.projects;
 $("projectBadge").textContent=project.name;$("selectedProjectName").textContent=project.name;$("userRole").textContent=(m.role||"").replaceAll("_"," ").toUpperCase();
 if(data.length>1){$("projectSelectorContainer").classList.remove("hidden");$("dropdownItems").innerHTML=data.map(x=>`<div class="dropdown-item" data-id="${esc(x.project_id)}">${esc(x.projects?.name||x.project_id)}</div>`).join("");document.querySelectorAll(".dropdown-item").forEach(i=>i.addEventListener("click",()=>changeProject(i.dataset.id,data)))}
 localStorage.setItem(`lastProject_${user.id}`,project.id);
 const u=new URL(location.href);u.searchParams.set("project",project.id);history.replaceState({}, "", u);
 const q=`?project=${encodeURIComponent(project.id)}`;
 $("dataMgmtLink").href="../DataManagement.html"+q;
 document.querySelector('[data-page="dashboard"]').href="../Dashboard.html"+q;
 document.querySelector('[data-page="live-mapping"]').href="../LiveMapping/live-mapping.html"+q;
 document.querySelector('[data-page="submissions"]').href="../Submissions/submissions.html"+q;
 document.querySelector('[data-page="exports"]').href="../Exports/exports.html"+q;
}
function filterProjects(e){const q=e.target.value.toLowerCase();document.querySelectorAll(".dropdown-item").forEach(x=>x.style.display=x.textContent.toLowerCase().includes(q)?"":"none")}
async function changeProject(id,members){const m=members.find(x=>x.project_id===id);if(!m)return;project=m.projects;localStorage.setItem(`lastProject_${user.id}`,project.id);location.href=`quality-alerts.html?project=${encodeURIComponent(project.id)}`}

async function loadData(){
 const f=await db.from("farms").select("*").eq("project_id",project.id).order("created_at",{ascending:false});if(f.error)throw f.error;farms=f.data||[];
 issues=[];
 if(farms.length){for(let i=0;i<farms.length;i+=200){const ids=farms.slice(i,i+200).map(x=>x.id);const r=await db.from("farm_quality_issues").select("*").in("farm_id",ids);if(!r.error)issues.push(...(r.data||[]))}}
}

function renderAll(){renderStats();renderProtected();renderPolygon()}
function renderStats(){
 const counts={critical:0,high:0,medium:0,low:0};issues.forEach(i=>{const s=sev(i);if(counts[s]!=null)counts[s]++});
 ["critical","high","medium","low"].forEach(s=>$(s+"Count").textContent=counts[s]);
 $("totalAlerts").textContent=issues.length;$("protectedBadge").textContent=issues.filter(i=>issueType(i)==="protected_area_conflict").length;$("polygonBadge").textContent=issues.filter(i=>issueType(i)!=="protected_area_conflict").length;$("navAlertCount")&&( $("navAlertCount").textContent=issues.filter(i=>sev(i)==="critical").length);
}
function renderProtected(){
 let data=issues.filter(i=>issueType(i)==="protected_area_conflict");
 const sf=$("protectedSeverityFilter").value,st=$("protectedStatusFilter").value;
 if(sf!=="all")data=data.filter(i=>sev(i)===sf);if(st!=="all")data=data.filter(i=>typeOf(i.status)===st);
 $("protectedAlertCount").textContent=`${data.length} alerts`;$("protectedShowingCount").textContent=data.length;
 $("protectedAlertsList").innerHTML=data.length?data.map(alertHtml).join(""):`<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No Protected Area Alerts</h3><p>All farms are outside protected areas.</p></div>`;
}
function renderPolygon(){
 let data=issues.filter(i=>issueType(i)!=="protected_area_conflict");
 const tf=$("polygonTypeFilter").value,sf=$("polygonSeverityFilter").value,st=$("polygonStatusFilter").value;
 if(tf!=="all")data=data.filter(i=>issueType(i).includes(tf));if(sf!=="all")data=data.filter(i=>sev(i)===sf);if(st!=="all")data=data.filter(i=>typeOf(i.status)===st);
 $("polygonAlertCount").textContent=`${data.length} alerts`;$("polygonShowingCount").textContent=data.length;
 $("polygonAlertsList").innerHTML=data.length?data.map(alertHtml).join(""):`<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No Polygon Quality Alerts</h3><p>All polygons pass quality checks.</p></div>`;
}
function alertHtml(i){
 const farm=farms.find(f=>f.id===i.farm_id),name=farm?.farmer_name||"Unknown farmer";
 return `<div class="alert-row"><div><span class="severity-badge ${esc(sev(i)||"low")}">${esc(sev(i)||"low")}</span></div><div class="alert-farmer"><strong>${esc(i.title||issueType(i))}</strong><small>${esc(name)}</small></div><div class="alert-desc">${esc(i.description||"Quality issue detected.")}</div><div>${i.latitude!=null&&i.longitude!=null?`${Number(i.latitude).toFixed(5)}, ${Number(i.longitude).toFixed(5)}`:"—"}</div><div>${esc(typeOf(i.status)||"new")}</div><div><button class="alert-action" onclick="openQualityReview('${esc(i.farm_id)}')">Review</button></div></div>`;
}

function switchTab(tab){activeTab=tab;document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".tab-content").forEach(x=>x.classList.toggle("active",x.id===tab+"Tab"))}
function applyProtectedFilters(){renderProtected()}function clearProtectedFilters(){$("protectedSeverityFilter").value="all";$("protectedSupplierFilter").value="all";$("protectedStatusFilter").value="all";renderProtected()}
function applyPolygonFilters(){renderPolygon()}function clearPolygonFilters(){$("polygonTypeFilter").value="all";$("polygonSeverityFilter").value="all";$("polygonSupplierFilter").value="all";$("polygonStatusFilter").value="all";renderPolygon()}
function markProtectedRead(){toast("Protected alerts marked as read.","success")}function markPolygonRead(){toast("Polygon alerts marked as read.","success")}
function refreshProtectedAlerts(){renderProtected();toast("Protected alerts refreshed.","success")}function refreshPolygonAlerts(){renderPolygon();toast("Polygon alerts refreshed.","success")}
function protectedPrevPage(){}function protectedNextPage(){}function polygonPrevPage(){}function polygonNextPage(){}

async function openQualityReview(farmId){
 currentFarm=farms.find(f=>f.id===farmId);if(!currentFarm)return;
 $("qcReviewModal").classList.remove("hidden");$("qcReviewTitle").textContent=currentFarm.farmer_name||"Farm Quality Review";$("qcReviewSubtitle").textContent=`${currentFarm.farmer_id||currentFarm.id} · ${currentFarm.workflow_state||currentFarm.status||"pending"}`;$("qcReviewIssues").innerHTML='<div class="loading-cell">Running GIS quality checks...</div>';
 const {data,error}=await db.rpc("run_full_quality_check",{p_farm_id:farmId});
 if(error){$("qcReviewIssues").innerHTML=`<div style="color:#b42318;font-size:11px">${esc(error.message)}</div>`;return}
 currentResult=data||{};const r=currentResult.score_details||{};await reloadFarmIssues(farmId);const list=issues.filter(i=>i.farm_id===farmId);const score=Number(currentResult.overall_score??r.overall_score);const critical=list.some(i=>sev(i)==="critical");
 $("qcReviewScore").textContent=Number.isFinite(score)?Math.round(score):"—";$("qcReviewStatus").textContent=currentResult.quality_status||"pending";$("qcValidateBtn").disabled=critical;$("qcDecisionNote").textContent=critical?"Critical issue detected — Validate is blocked.":"Review the evidence before making a decision.";
 $("qcComponents").innerHTML=["geometry","mapping","spatial","attribute","traceability"].map(k=>{const n=Number(r[k+"_score"]);return `<div class="qc-component"><span>${k==="attribute"?"Attributes":k[0].toUpperCase()+k.slice(1)}</span><div class="qc-bar"><span style="width:${Number.isFinite(n)?n:0}%"></span></div><strong>${Number.isFinite(n)?Math.round(n):"—"}</strong></div>`}).join("");
 $("qcFarmInfo").innerHTML=[["Farmer",currentFarm.farmer_name],["Farmer ID",currentFarm.farmer_id||currentFarm.id],["Area",(currentFarm.area_ha??currentFarm.area)!=null?Number(currentFarm.area_ha??currentFarm.area).toFixed(2)+" ha":"—"],["Workflow",String(currentFarm.workflow_state||currentFarm.status||"pending").replaceAll("_"," ")]].map(x=>`<div><span>${esc(x[0])}</span><strong>${esc(x[1]||"—")}</strong></div>`).join("");
 $("qcIssueCount").textContent=`(${list.length})`;$("qcReviewIssues").innerHTML=list.length?list.map(i=>`<div class="qc-issue ${sev(i)==="warning"?"warning":""}"><strong>${esc(i.title||issueType(i))}</strong><p>${esc(i.description||"Quality issue detected.")}</p>${i.latitude!=null&&i.longitude!=null?`<button class="qc-locate" onclick="locateIssue(${Number(i.latitude)},${Number(i.longitude)})"><i class="fas fa-location-arrow"></i> Locate on map</button>`:""}</div>`).join(""):`<div style="font-size:11px;color:#697386">✓ No quality issues detected.</div>`;
 renderReviewMap(currentFarm,list);
}
async function reloadFarmIssues(id){const r=await db.from("farm_quality_issues").select("*").eq("farm_id",id);if(!r.error){issues=issues.filter(x=>x.farm_id!==id).concat(r.data||[])}}
function renderReviewMap(farm,list){setTimeout(()=>{if(!window.L)return;map?.remove();map=L.map("qcReviewMap");L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors"}).addTo(map);const layers=[];if(farm.geometry){const l=L.geoJSON(farm.geometry,{style:{color:"#245f45",weight:3,fillOpacity:.15}}).addTo(map);layers.push(l)}list.forEach(i=>{let g=i.issue_geometry;if(typeof g==="string"){try{g=JSON.parse(g)}catch{g=null}}if(!g&&i.latitude!=null&&i.longitude!=null)g={type:"Point",coordinates:[Number(i.longitude),Number(i.latitude)]};if(g){const l=L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:7,color:"#dc2626",fillOpacity:.9}),style:{color:"#dc2626",weight:3}}).addTo(map);layers.push(l)}});if(layers.length){let b=layers[0].getBounds();layers.slice(1).forEach(l=>{const z=l.getBounds();if(z.isValid())b=b.extend(z)});if(b.isValid())map.fitBounds(b,{padding:[25,25]})}else map.setView([7.5,-5.5],7);map.invalidateSize()},80)}
function locateIssue(lat,lng){if(map){map.setView([lat,lng],17,{animate:true});L.circleMarker([lat,lng],{radius:9,color:"#dc2626",fillOpacity:.1}).addTo(map)}}
function closeQualityReview(){map?.remove();map=null;$("qcReviewModal").classList.add("hidden")}
async function qualityDecision(decision){if(!currentFarm)return;const label=decision==="validated"?"Validate this farm?":decision==="rejected"?"Reject this farm?":"Request correction for this farm?";if(!confirm(label))return;let reason=null;if(decision!=="validated"){reason=prompt(decision==="rejected"?"Rejection reason:":"Correction reason:");if(!reason?.trim())return}try{const {error}=await db.rpc("quality_decision",{p_farm_id:currentFarm.id,p_decision:decision,p_reason:reason?.trim()||null});if(error)throw error;toast("Decision saved successfully.","success");closeQualityReview();await refreshAll()}catch(e){toast("Decision failed: "+e.message,"error")}}
async function refreshAll(){showLoading(true);try{await loadData();renderAll();toast("Quality alerts refreshed.","success")}catch(e){toast(e.message,"error")}finally{finishLoading()}}
function showLoading(x){$("loadingOverlay")?.classList.toggle("hidden",!x)}function finishLoading(){showLoading(false)}
function showError(m){toast("Quality Alerts: "+m,"error")}
function toast(m,t){const x=document.createElement("div");x.textContent=m;x.style.cssText="position:fixed;right:20px;bottom:20px;z-index:500;background:"+(t==="error"?"#b42318":"#23764b")+";color:#fff;padding:10px 14px;border-radius:6px;font-size:11px;box-shadow:0 8px 24px #0002";document.body.appendChild(x);setTimeout(()=>x.remove(),4000)}

window.switchTab=switchTab;window.applyProtectedFilters=applyProtectedFilters;window.clearProtectedFilters=clearProtectedFilters;window.markProtectedRead=markProtectedRead;window.refreshProtectedAlerts=refreshProtectedAlerts;window.protectedPrevPage=protectedPrevPage;window.protectedNextPage=protectedNextPage;window.applyPolygonFilters=applyPolygonFilters;window.clearPolygonFilters=clearPolygonFilters;window.markPolygonRead=markPolygonRead;window.refreshPolygonAlerts=refreshPolygonAlerts;window.polygonPrevPage=polygonPrevPage;window.polygonNextPage=polygonNextPage;window.openQualityReview=openQualityReview;window.closeQualityReview=closeQualityReview;window.locateIssue=locateIssue;window.qualityDecision=qualityDecision;
})();
