const cfg=window.APP_CONFIG;const $=id=>document.getElementById(id);
let supabaseClient=null,records=[];
function msg(id,text,error=false){$(id).textContent=text;$(id).style.color=error?"#ffb4c0":"#a4b1ca";}
function setup(){if(!cfg.SUPABASE_URL.startsWith("https://")||cfg.SUPABASE_ANON_KEY.startsWith("YOUR_")){msg("loginMessage","Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js first.",true);return false;}supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);return true;}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!supabaseClient&&!setup())return;msg("loginMessage","Signing in…");const {error}=await supabaseClient.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error){msg("loginMessage",error.message,true);return;}await checkSession();});
async function checkSession(){if(!supabaseClient&&!setup())return;const {data}=await supabaseClient.auth.getSession();if(data.session){$("loginPanel").classList.add("hidden");$("dataPanel").classList.remove("hidden");await loadRecords();}}
async function loadRecords(){
  msg("dataMessage","Loading records…");
  const {data:auth}=await supabaseClient.auth.getUser();if(!auth.user){msg("dataMessage","Please sign in again.",true);return;}
  let q=supabaseClient.from("location_records").select("id,visitor_id,latitude,longitude,accuracy_m,consented_at,created_at").order("created_at",{ascending:false}).limit(1000);
  const from=$("fromDate").value,to=$("toDate").value,term=$("filterText").value.trim();
  if(from)q=q.gte("created_at",new Date(from+"T00:00:00").toISOString());
  if(to)q=q.lt("created_at",new Date(new Date(to+"T00:00:00").getTime()+86400000).toISOString());
  const {data,error}=await q;
  if(error){msg("dataMessage","Could not read records: "+error.message,true);return;}
  records=(data||[]).filter(r=>!term||[r.visitor_id,r.latitude,r.longitude].some(v=>String(v).toLowerCase().includes(term.toLowerCase())));
  $("totalCount").textContent=records.length;$("pageCount").textContent=records.length;
  $("latestTime").textContent=records.length?new Date(records[0].created_at).toLocaleString():"—";
  $("recordsBody").innerHTML=records.length?records.map(r=>`<tr><td>${esc(new Date(r.created_at).toLocaleString())}</td><td>${esc(r.visitor_id)}</td><td>${Number(r.latitude).toFixed(6)}</td><td>${Number(r.longitude).toFixed(6)}</td><td>${r.accuracy_m==null?"—":Math.round(r.accuracy_m)+" m"}</td><td><a class="map-link" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(r.latitude)}&mlon=${encodeURIComponent(r.longitude)}#map=16/${encodeURIComponent(r.latitude)}/${encodeURIComponent(r.longitude)}">Open map</a></td><td><button class="small-button danger" data-delete="${esc(r.id)}">Delete</button></td></tr>`).join(""):`<tr><td colspan="7">No records found.</td></tr>`;
  msg("dataMessage",`Loaded ${records.length} record(s). The database policy controls which rows your account may see.`);
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("recordsBody").addEventListener("click",async e=>{const id=e.target.dataset.delete;if(!id)return;if(!confirm("Delete this location record permanently?"))return;const {error}=await supabaseClient.from("location_records").delete().eq("id",id);if(error){msg("dataMessage","Delete failed: "+error.message,true);return;}await loadRecords();});
$("refresh").addEventListener("click",loadRecords);$("filterText").addEventListener("input",()=>{clearTimeout(window.filterTimer);window.filterTimer=setTimeout(loadRecords,300);});
$("signOut").addEventListener("click",async()=>{await supabaseClient.auth.signOut();$("dataPanel").classList.add("hidden");$("loginPanel").classList.remove("hidden");msg("loginMessage","Signed out.");});
$("export").addEventListener("click",()=>{const rows=[["created_at","visitor_id","latitude","longitude","accuracy_m"],...records.map(r=>[r.created_at,r.visitor_id,r.latitude,r.longitude,r.accuracy_m])];const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="consented-location-records.csv";a.click();URL.revokeObjectURL(url);});
if(setup())checkSession();
