(() => {
"use strict";
const SUPABASE_URL="https://crvnohvudurqfukjpisv.supabase.co",SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm5vaHZ1ZHVycWZ1a2pwaXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTUxNzMsImV4cCI6MjA5NDAzMTE3M30.Qp8E57yAN4LnO4A-yirf-Z3QufGZw9OKjBfcQxG7fo8";
let supabaseClient=null,
    currentUser=null,
    currentProject=null,
    currentProjectUserRole=null,
    farms=[],
    issues=[],
    currentFarm=null,
    currentResult=null,
    currentMap=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const t=x=>String(x||"").toLowerCase(),sev=x=>t(x.severity),kind=x=>t(x.issue_type);

document.addEventListener("DOMContentLoaded",init);
async function init(){
 showLoading(true);
 try{
  if(!window.supabase?.createClient)throw Error("Supabase library did not load.");
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  const s=await supabaseClient.auth.getSession();
  if(s.error)throw s.error;
  if(!s.data?.session?.user){location.href="../login.html";return;}
  currentUser=s.data.session.user;

await loadProfile();
await resolveProject();

const allowedRoles=[
  "validator",
  "manager",
  "owner",
  "super_manager"
];

if(!allowedRoles.includes(currentProjectUserRole)){
  notify(
    "You do not have access to GIS Quality Review.",
    "error"
  );

  setTimeout(()=>{
    location.href="/Dashboard.html?project="+currentProject.id;
  },1000);

  return;
}

  return;
}

await loadQualityData();
bind();
render();
 }catch(e){console.error("Quality Control initialization error:",e);notify(e.message||e,"error");}
 finally{showLoading(false);}
}
async function loadProfile(){
 const r=await supabaseClient
   .from("user_profiles")
   .select("first_name,email")
   .eq("id",currentUser.id)
   .maybeSingle();

 if(r.error)throw Error("user_profiles: "+r.error.message);

 const n=r.data?.first_name
   ||currentUser.email?.split("@")[0]
   ||"User";

 if($("userName"))
   $("userName").textContent=n;

 if($("userAvatar"))
   $("userAvatar").textContent=n.slice(0,2).toUpperCase();
}


async function resolveProject(){
 const r=await supabaseClient
   .from("project_members")
   .select("project_id,role,projects(*)")
   .eq("user_id",currentUser.id)
   .eq("status","active");

 if(r.error)
   throw Error("project_members: "+r.error.message);

 if(!r.data?.length)
   throw Error("No active project membership found.");

 const q=new URLSearchParams(location.search).get("project");
 const saved=localStorage.getItem("lastProject_"+currentUser.id);

 const m=
   r.data.find(x=>x.project_id===q)
   ||r.data.find(x=>x.project_id===saved)
   ||r.data[0];

 if(!m)
   throw Error("No valid project membership found.");

 currentProject=m.projects;

 // Store the user's role for this project
 currentProjectUserRole=(m.role||"").toLowerCase();

 localStorage.setItem(
   "lastProject_"+currentUser.id,
   currentProject.id
 );

 if($("projectBadge"))
   $("projectBadge").textContent=currentProject.name;

 if($("selectedProjectName"))
   $("selectedProjectName").textContent=currentProject.name;

 if($("userRole"))
   $("userRole").textContent=
     currentProjectUserRole
       .replaceAll("_"," ")
       .toUpperCase();

 const u=new URL(location.href);
 u.searchParams.set("project",currentProject.id);

 history.replaceState({},"",u);
}


async function loadQualityData(){
 console.log("=== QUALITY DEBUG ===");
 console.log("Current project:", currentProject);
 console.log("Current project ID:", currentProject?.id);
 console.log("Current role:", currentProjectUserRole);

 const f=await supabaseClient
   .from("farms")
   .select("*")
   .eq("project_id",currentProject.id)
   .order("created_at",{ascending:false});

 console.log("Farms query error:", f.error);
 console.log("Farms query data:", f.data);
 console.log("Farms count:", f.data?.length);

 if(f.error)
   throw f.error;

 farms=f.data||[];


function bind(){
 ["qcStatusFilter","qcTypeFilter"].forEach(id=>{
   $(id)?.addEventListener("change",renderQueue);
 });

 $("refreshBtn")?.addEventListener(
   "click",
   refreshAll
 );

 $("logoutBtn")?.addEventListener(
   "click",
   async e=>{
     e.preventDefault();
     await supabaseClient.auth.signOut();
     location.href="../login.html";
   }
 );
}
function render(){renderStats();renderQueue();}
function renderStats(){
 const map=new Map();issues.forEach(i=>{if(!map.has(i.farm_id))map.set(i.farm_id,[]);map.get(i.farm_id).push(i);});
 let critical=0,warning=0,passed=0,pending=0;
 farms.forEach(f=>{
  const a=map.get(f.id)||[];
  if(a.some(i=>sev(i)==="critical"))critical++;else if(a.some(i=>["warning","high","medium"].includes(sev(i))))warning++;else passed++;
  const wf=t(f.workflow_state||f.status);if(["pending","gis_compliance_review","enumerator_review","field_officer_review"].includes(wf))pending++;
 });
 $("pendingCount").textContent=pending;$("criticalCount").textContent=critical;$("warningCount").textContent=warning;$("passedCount").textContent=passed;$("totalFarmsCount").textContent=farms.length;
}
function matchesIssue(i,k){
 const x=kind(i);if(k==="protected")return x.includes("protected");if(k==="overlap")return x.includes("overlap");if(k==="geometry")return x.includes("geometry")||x.includes("spike")||x.includes("self");
 return !x.includes("protected")&&!x.includes("overlap")&&!x.includes("geometry")&&!x.includes("spike")&&!x.includes("self");
}
function renderQueue(){
 const sf=$("qcStatusFilter")?.value||"all",
       tf=$("qcTypeFilter")?.value||"all",
       rows=[];

 farms.forEach(f=>{
  const wf=t(f.workflow_state||f.status);

  // GIS Validator queue: only farms currently awaiting GIS review
  if(wf!=="gis_compliance_review") return;

  const a=issues.filter(i=>i.farm_id===f.id),
        critical=a.some(i=>sev(i)==="critical"),
        warning=a.some(i=>["warning","high","medium"].includes(sev(i))),
        status=critical?"critical":warning?"warning":"passed",
        pending=true;

  if(sf==="pending"&&!pending)return;
  if(sf!=="all"&&sf!=="pending"&&sf!==status)return;
  if(tf!=="all"&&!a.some(i=>matchesIssue(i,tf)))return;

  rows.push({
   f:f,
   a:a,
   status:status,
   pending:pending
  });
 });

 $("qcQueueBody").innerHTML=rows.length
  ?rows.map(queueRow).join("")
  :'<div class="qc-empty"><i class="fas fa-circle-check"></i><h3>Queue is clear</h3><p>No farms match the current QC filters.</p></div>';
}
function queueRow(x){
 const i=x.a[0]||{},area=x.f.area_ha??x.f.area;
 return `<div class="qc-table-row qc-row" onclick="openQualityReview('${esc(x.f.id)}')"><div class="qc-farmer"><strong>${esc(x.f.farmer_name||"Unnamed farmer")}</strong><small>${esc(x.f.farmer_id||x.f.id)}</small></div><div class="qc-issue-title"><strong>${esc(i.title||(x.status==="passed"?"No quality issues":"Quality issue detected"))}</strong><small>${esc(i.description||"Farm requires routine quality review.")}</small></div><div><span class="qc-pill ${x.status}">${x.status}</span></div><div><span class="qc-pill pending">${x.pending?"Pending review":x.status==="passed"?"Passed":"Needs review"}</span></div><div>${area!=null?Number(area).toFixed(2)+" ha":"—"}</div><div><button class="qc-row-action" onclick="event.stopPropagation();openQualityReview('${esc(x.f.id)}')">Review</button></div></div>`;
}
async function openQualityReview(id){
 currentFarm=farms.find(f=>f.id===id);if(!currentFarm){notify("Farm not found in the loaded project.","error");return;}
 const modal=$("qcReviewModal"); if(!modal){notify("Review modal is missing from the page.","error");return;}
 modal.classList.remove("hidden");
 $("qcReviewTitle").textContent=currentFarm.farmer_name||"Farm Review";
 $("qcReviewSubtitle").textContent=currentFarm.farmer_id||currentFarm.id;
 // Render the farm immediately. Never leave the reviewer looking at a blank modal while the RPC runs.
 const area=currentFarm.area_ha??currentFarm.area;
 $("qcReviewScore").textContent="—";
 $("qcReviewStatus").textContent="Running checks…";
 $("qcComponents").innerHTML='<div style="padding:8px;font-size:9px;color:#8993a2"><i class="fas fa-spinner fa-spin"></i> Running GIS quality checks…</div>';
 $("qcFarmInfo").innerHTML=[["Farmer",currentFarm.farmer_name],["Farmer ID",currentFarm.farmer_id||currentFarm.id],["Area",area!=null?Number(area).toFixed(2)+" ha":"—"],["Workflow",currentFarm.workflow_state||currentFarm.status||"pending"]].map(a=>`<div><span>${esc(a[0])}</span><strong>${esc(a[1]||"—")}</strong></div>`).join("");
 $("qcReviewIssues").innerHTML='<div style="padding:8px;font-size:9px;color:#8993a2">Loading existing quality issues…</div>';
 try{
  // Existing issues are useful even if the RPC is temporarily slow.
  const q=await supabaseClient.from("farm_quality_issues").select("*").eq("farm_id",id);
  if(!q.error){issues=issues.filter(x=>x.farm_id!==id).concat(q.data||[]);}
  renderReviewShell(currentFarm, issues.filter(x=>x.farm_id===id), null);

  // Run the authoritative check with a timeout so a slow/blocked RPC cannot freeze the UI.
  const rpcPromise=supabaseClient.rpc("run_full_quality_check",{p_farm_id:id});
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Quality check is taking longer than expected. Existing results are shown; use Refresh and try again.")),10000));
  const r=await Promise.race([rpcPromise,timeout]);
  if(r.error)throw r.error;
  let result=r.data||{};
  if(typeof result==="string"){try{result=JSON.parse(result)}catch{}}
  currentResult=result;
  // Refresh issues after the check because the RPC may have created/updated them.
  const fresh=await supabaseClient.from("farm_quality_issues").select("*").eq("farm_id",id);
  if(!fresh.error){issues=issues.filter(x=>x.farm_id!==id).concat(fresh.data||[]);}
  populateReview();
 }catch(e){
  console.error("Farm quality review:",e);
  // Keep the farm information visible and show the actual reason instead of a blank panel.
  $("qcReviewStatus").textContent="Review required";
  $("qcComponents").innerHTML='<div style="padding:8px;font-size:9px;color:#b42318">'+esc(e.message||e)+"</div>";
  const list=issues.filter(x=>x.farm_id===id);
  $("qcIssueCount").textContent=list.length+" issue"+(list.length===1?"":"s");
  $("qcReviewIssues").innerHTML=list.length?list.map(i=>`<div class="qc-issue ${["warning","medium","high"].includes(sev(i))?"warning":""}"><strong>${esc(i.title||kind(i))}</strong><p>${esc(i.description||"Quality issue detected.")}</p></div>`).join(""):('<div style="padding:8px;color:#7d8796;font-size:9px">No stored quality issues. The live quality check could not be completed.</div>');
  $("qcDecisionNote").innerHTML='<i class="fas fa-circle-exclamation"></i> Live QC check did not complete. Do not validate until the check succeeds.';
  $("qcValidateBtn").disabled=true;
 }
}
function renderReviewShell(farm,list,result){
 const d=result?.score_details||{};
 $("qcComponents").innerHTML=["geometry","mapping","spatial","attribute","traceability"].map(k=>{const n=Number(d[k+"_score"]);return `<div class="qc-component"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="qc-bar"><span style="width:${Number.isFinite(n)?n:0}%"></span></div><b>${Number.isFinite(n)?Math.round(n):"—"}</b></div>`}).join("");
 $("qcIssueCount").textContent=list.length+" issue"+(list.length===1?"":"s");
 $("qcReviewIssues").innerHTML=list.length?list.map(i=>`<div class="qc-issue ${["warning","medium","high"].includes(sev(i))?"warning":""}"><strong>${esc(i.title||kind(i))}</strong><p>${esc(i.description||"Quality issue detected.")}</p></div>`).join(""): '<div style="padding:8px;color:#28734f;font-size:9px">✓ No stored quality issues.</div>';
}

function populateReview(){
 const d=currentResult.score_details||{},list=issues.filter(i=>i.farm_id===currentFarm.id),critical=list.some(i=>sev(i)==="critical"),score=Number(currentResult.overall_score??d.overall_score);
 $("qcReviewScore").textContent=Number.isFinite(score)?Math.round(score):"—";
 $("qcReviewStatus").textContent=currentResult.quality_status||"review";
 const protectedCritical=list.some(i=>sev(i)==="critical" && (kind(i).includes("protected") || t(i.title).includes("protected area")));
 const otherCritical=list.some(i=>sev(i)==="critical" && !(kind(i).includes("protected") || t(i.title).includes("protected area")));
 const assessment=$("qcProtectedAssessment");
 if(assessment)assessment.style.display=protectedCritical?"block":"none";
 $("qcValidateBtn").disabled=otherCritical || protectedCritical;
 $("qcDecisionNote").innerHTML=critical?'<i class="fas fa-triangle-exclamation"></i> Critical issue detected — validation is blocked.':'<i class="fas fa-circle-info"></i> Review all evidence before deciding.';
 $("qcComponents").innerHTML=["geometry","mapping","spatial","attribute","traceability"].map(k=>{const n=Number(d[k+"_score"]);return `<div class="qc-component"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="qc-bar"><span style="width:${Number.isFinite(n)?n:0}%"></span></div><b>${Number.isFinite(n)?Math.round(n):"—"}</b></div>`;}).join("");
 const area=currentFarm.area_ha??currentFarm.area;
 $("qcFarmInfo").innerHTML=[["Farmer",currentFarm.farmer_name],["Farmer ID",currentFarm.farmer_id||currentFarm.id],["Area",area!=null?Number(area).toFixed(2)+" ha":"—"],["Workflow",currentFarm.workflow_state||currentFarm.status]].map(a=>`<div><span>${esc(a[0])}</span><strong>${esc(a[1]||"—")}</strong></div>`).join("");
 $("qcIssueCount").textContent=list.length+" issue"+(list.length===1?"":"s");
 $("qcReviewIssues").innerHTML=list.length?list.map(i=>`<div class="qc-issue ${["warning","medium","high"].includes(sev(i))?"warning":""}"><strong>${esc(i.title||kind(i))}</strong><p>${esc(i.description||"Quality issue detected.")}</p>${i.latitude!=null&&i.longitude!=null?`<button class="qc-locate" onclick="locateIssue(${Number(i.latitude)},${Number(i.longitude)})">Locate evidence</button>`:""}</div>`).join(""):'<div style="padding:8px;color:#28734f;font-size:10px">✓ No quality issues detected.</div>';
 renderMap(list);
}
function renderMap(list){
 setTimeout(()=>{
  if(!window.L)return;currentMap?.remove();currentMap=L.map("qcReviewMap");L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{attribution:"Tiles © Esri"}).addTo(currentMap);
  const layers=[];let g=currentFarm.geometry;if(typeof g==="string"){try{g=JSON.parse(g)}catch{g=null}}
  if(g)layers.push(L.geoJSON(g,{style:{color:"#245f45",weight:3,fillOpacity:.12}}).addTo(currentMap));
  list.forEach(i=>{let z=i.issue_geometry;if(typeof z==="string"){try{z=JSON.parse(z)}catch{z=null}}if(!z&&i.latitude!=null&&i.longitude!=null)z={type:"Point",coordinates:[+i.longitude,+i.latitude]};if(z)layers.push(L.geoJSON(z,{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:7,color:"#dc2626",fillOpacity:.9}),style:{color:"#dc2626",weight:3}}).addTo(currentMap));});
  if(layers.length){let b=layers[0].getBounds();layers.slice(1).forEach(l=>{const z=l.getBounds();if(z.isValid())b=b.extend(z)});if(b.isValid())currentMap.fitBounds(b,{padding:[25,25]});}else currentMap.setView([7.54,-5.55],7);
  currentMap.invalidateSize();
 },100);
}
function locateIssue(lat,lng){if(currentMap){currentMap.setView([lat,lng],17);L.circleMarker([lat,lng],{radius:9,color:"#dc2626",fillOpacity:.1}).addTo(currentMap);}}
function closeQualityReview(){currentMap?.remove();currentMap=null;$("qcReviewModal").classList.add("hidden");}
async function qualityDecision(decision){
 if(!currentFarm)return;
 const list=issues.filter(i=>i.farm_id===currentFarm.id);
 const protectedCritical=list.some(i=>sev(i)==="critical" && (kind(i).includes("protected") || t(i.title).includes("protected area")));
 const otherCritical=list.some(i=>sev(i)==="critical" && !(kind(i).includes("protected") || t(i.title).includes("protected area")));

 if(decision==="validated"){
  if(otherCritical){notify("Approval blocked: a critical non-protected-area issue must be resolved first.","error");return;}
  if(protectedCritical){
   const verified=$("qcLegalVerified")?.checked;
   const ref=$("qcAuthorizationRef")?.value.trim()||"";
   const comment=$("qcValidatorComment")?.value.trim()||"";
   if(!verified){notify("Verify the legal authorization before approving this protected-area case.","error");return;}
   if(!ref){notify("Enter the authorization / document reference.","error");return;}
   if(!comment){notify("Enter a validator comment for the protected-area decision.","error");return;}
  }
 }
 if(!confirm(decision==="validated"?"Approve and continue to Final Validation?":decision==="rejected"?"Reject this farm?":"Request correction for this farm?"))return;

 let reason=null;
 if(decision==="validated" && protectedCritical){
  reason=`Protected Area reviewed; legal authorization verified. Document: ${$("qcAuthorizationRef").value.trim()}. Validator comment: ${$("qcValidatorComment").value.trim()}`;
 }else if(decision!=="validated"){
  reason=prompt(decision==="rejected"?"Rejection reason:":"Correction reason:");
  if(!reason?.trim())return;
 }

 try{
  const next=decision==="validated"?"final_validation":decision==="rejected"?"rejected":"correction_required";
  const r=await supabaseClient.rpc("transition_farm_workflow",{p_farm_id:currentFarm.id,p_to_state:next,p_reason:reason?.trim()||null});
  if(r.error)throw r.error;
  notify("QC decision saved.","success");
  closeQualityReview();
  await refreshAll();
 }catch(e){
  console.error("QC decision error:",e);
  notify("Decision failed: "+(e.message||e),"error");
 }
}
async function refreshAll(){showLoading(true);try{await loadQualityData();render();notify("Quality queue refreshed.","success");}catch(e){notify(e.message||e,"error")}finally{showLoading(false)}}
function showLoading(v){const o=$("loadingOverlay");if(o)o.style.display=v?"flex":"none";}
function notify(message,kindValue){const n=document.createElement("div");n.textContent=message;n.style.cssText=`position:fixed;right:20px;bottom:20px;z-index:9999;background:${kindValue==="error"?"#b42318":"#23764b"};color:#fff;padding:10px 14px;border-radius:6px;font-size:10px`;document.body.appendChild(n);setTimeout(()=>n.remove(),3500);}
window.openQualityReview=openQualityReview;window.closeQualityReview=closeQualityReview;window.qualityDecision=qualityDecision;window.locateIssue=locateIssue;
})();
