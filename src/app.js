import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import benches from "./seats.json";
import "./style.css";

const required=["VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN","VITE_FIREBASE_PROJECT_ID","VITE_FIREBASE_APP_ID"];
const ready=required.every(k=>!!import.meta.env[k]);
const root=document.getElementById("app");
const seats=benches.flatMap(b=>b.seats);
const valid=new Set(seats.map(s=>s.id));
let auth=null,db=null,user=null,reservations={},selected=new Set(),unsub=null,seatNames={},familyDraft="",residentDraft=false,gradeDraft=false,authError="",admins={},adminError="",adminBusy=false;
if(ready){
 const app=initializeApp({apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID});
 auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,async u=>{user=u;if(!u){try{await signInAnonymously(auth)}catch(e){authError=e.message;render()}}else{authError="";render()}});
 onSnapshot(collection(db,"admins"),snap=>{admins={};snap.forEach(d=>admins[d.id]=d.data());render()},err=>{adminError=err.message;render()});
 unsub=onSnapshot(collection(db,"reservations"),snap=>{reservations={};snap.forEach(d=>reservations[d.id]=d.data());render();},err=>{document.getElementById("message").textContent="שגיאה בטעינת מקומות: "+err.message;});
}
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function captureDraft(){const f=document.getElementById("booking");if(!f)return;const d=new FormData(f);for(const id of selected)seatNames[id]=String(d.get("name-"+id)||"");familyDraft=String(d.get("familyName")||"");residentDraft=!!d.get("resident");gradeDraft=!!d.get("grade")}
function isGoogle(){return !!user?.providerData?.some(p=>p.providerId==="google.com") && user.emailVerified}
function isSuper(){return isGoogle() && user.email?.toLowerCase()==="shok.shayke@gmail.com"}
function isAdmin(){return isSuper() || (isGoogle() && admins[user.uid]?.active===true)}
function render(){
 const taken=Object.keys(reservations).length;
 root.innerHTML=`<header><div class="wrap"><h1>בית הכנסת אלוני הבשן</h1><p>בחירת מקומות ישיבה</p></div></header><main class="wrap"><div class="layout"><section class="panel"><div class="summary"><strong>${seats.length} מקומות</strong><span>${taken} שמורים</span><span>${seats.length-taken} פנויים</span></div><div class="legend">🟢 פנוי　🟡 מסומן　🔴 שמור</div><div class="scroll"><div class="map" id="map"><img src="/synagogue-plan.png" alt="תוכנית בית הכנסת"/></div></div><small>אפשר לגלול לצדדים בטלפון כדי לראות את כל המפה.</small></section><aside class="panel"><h2>בחירת מושבים</h2><p id="identity">${user?"אפשר להזמין ללא הרשמה או הזנת פרטי קשר":"מכין אפשרות להזמנה ללא התחברות..."}</p><p>מקומות שנבחרו: <strong id="selection">${[...selected].join(", ")||"אין"}</strong></p><form id="booking"><div class="seat-names">${[...selected].sort().map(id=>`<label>שם להצגה — מושב ${safe(id)}<input name="name-${safe(id)}" required maxlength="70" value="${safe(seatNames[id]||"")}" placeholder="שם המתפלל/ת"></label>`).join("")||"<p>בחרו מושבים במפה כדי להזין שם נפרד לכל מושב.</p>"}</div><label>שם משפחה<input name="familyName" required maxlength="70" value="${safe(familyDraft)}"></label><label class="check"><input type="checkbox" name="resident" required ${residentDraft?"checked":""}> אני תושב/ת אלוני הבשן</label><label class="check"><input type="checkbox" name="grade" required ${gradeDraft?"checked":""}> המתפלל/ת בכיתה א׳ ומעלה</label><button type="submit" ${!ready||!user?"disabled":""}>שמור מקומות</button></form><p id="message" role="status">${authError?safe("שגיאת זיהוי: "+authError):ready?"":"חיבור Firebase טרם הוגדר. אי אפשר להזמין מקומות."}</p><h3>ההזמנות שלי</h3><div id="mine"></div><section class="admin-area"><h3>ניהול גבאים</h3><p>${isAdmin()?"מחובר כמנהל":"כניסה למנהלים מורשים בלבד"}</p><button type="button" id="admin-login">${isGoogle()?"התנתקות מחשבון Google":"כניסה עם Google"}</button><p id="admin-error">${safe(adminError)}</p><div id="admin-panel"></div></section></aside></div></main>`;
 const map=document.getElementById("map");
 for(const s of seats){const d=reservations[s.id],b=document.createElement("button");b.type="button";b.className="seat "+(d?"taken":selected.has(s.id)?"selected":"");b.style.left=(((s.x-68)*(1491/642)+114)/1695*100)+"%";b.style.top=(((s.y-120)*(1404/603)+239)/1800*100)+"%";b.title=s.id+(d?" — "+d.displayName:" — פנוי");b.setAttribute("aria-label",b.title);b.textContent=s.id.split("-S")[1];b.onclick=()=>{if(d)return;captureDraft();if(selected.has(s.id)){selected.delete(s.id);delete seatNames[s.id]}else selected.add(s.id);render()};map.appendChild(b)}
 document.getElementById("booking").onsubmit=book;
 document.getElementById("mine").innerHTML=Object.entries(reservations).filter(([id,d])=>d.ownerUid===user?.uid).map(([id,d])=>`<div class="myseat">${safe(id)} — ${safe(d.displayName)} <button data-cancel="${safe(id)}">ביטול</button></div>`).join("")||"אין הזמנות";
 document.getElementById("admin-login").onclick=async()=>{try{adminError="";if(isGoogle()){await signOut(auth);await signInAnonymously(auth)}else await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){adminError=e.message;render()}};
 if(isAdmin())renderAdmin();
 document.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>cancel(b.dataset.cancel));
}
async function book(e){
 e.preventDefault();const form=e.currentTarget;const msg=document.getElementById("message");if(!ready||!user||!selected.size){msg.textContent="יש להתחבר ולבחור לפחות מושב אחד";return}
 const data=new FormData(form);const familyName=String(data.get("familyName")||"").trim();const names=Object.fromEntries([...selected].map(id=>[id,String(data.get("name-"+id)||"").trim()]));
 if(Object.values(names).some(name=>!name)||!familyName||!data.get("resident")||!data.get("grade")){msg.textContent="יש למלא את כל הפרטים ולאשר את תנאי הזכאות";return}
 const ids=[...selected];if(ids.some(id=>!valid.has(id))){msg.textContent="מושב לא חוקי";return}
 try{await runTransaction(db,async tx=>{const refs=ids.map(id=>doc(db,"reservations",id));const old=await Promise.all(refs.map(ref=>tx.get(ref)));if(old.some(d=>d.exists()))throw Error("אחד המקומות כבר נתפס. בחרו מקומות פנויים.");refs.forEach((ref,i)=>tx.set(ref,{displayName:names[ids[i]],familyName,ownerUid:user.uid,residentConfirmed:true,gradeConfirmed:true,createdAt:serverTimestamp()}));});selected.clear();seatNames={};familyDraft="";residentDraft=false;gradeDraft=false;render();document.getElementById("message").textContent="המקומות נשמרו בהצלחה"}catch(err){msg.textContent="לא ניתן לשמור: "+err.message}
}
async function cancel(id){if(!db||!user||reservations[id]?.ownerUid!==user.uid)return;try{await runTransaction(db,async tx=>{const ref=doc(db,"reservations",id),snapshot=await tx.get(ref);if(!snapshot.exists()||snapshot.data().ownerUid!==user.uid)throw Error("אין הרשאה לביטול");tx.delete(ref)});}catch(err){document.getElementById("message").textContent=err.message}}
render();

function renderAdmin(){
 const panel=document.getElementById("admin-panel");
 panel.innerHTML=`<p><strong>כל ההזמנות:</strong> ${Object.keys(reservations).length}</p><label>חיפוש מתפלל או מושב<input id="admin-search" placeholder="שם / משפחה / מספר מושב"></label><button type="button" id="admin-export">ייצוא CSV</button><div id="admin-list"></div>${isSuper()?'<h4>ניהול גבאים</h4><p>גבאי נוסף צריך להתחבר פעם אחת עם Google ולשלוח לך את מזהה המשתמש (UID) שלו.</p><label>UID של גבאי<input id="admin-uid" placeholder="Firebase UID"></label><button type="button" id="admin-add">אישור גבאי</button><div id="admin-members"></div>':""}<p id="admin-action-message" role="status"></p>`;
 const message=t=>{const e=document.getElementById("admin-action-message");if(e)e.textContent=t};
 const list=()=>{const q=document.getElementById("admin-search").value.toLowerCase();document.getElementById("admin-list").innerHTML=Object.entries(reservations).filter(([id,d])=>(id+" "+d.displayName+" "+d.familyName).toLowerCase().includes(q)).sort(([a],[b])=>a.localeCompare(b)).map(([id,d])=>`<div class="admin-seat"><strong>${safe(id)}</strong> — ${safe(d.displayName)} (${safe(d.familyName)}) <button data-admin-edit="${safe(id)}">עריכה</button> <button data-admin-move="${safe(id)}">העברה</button> <button data-admin-delete="${safe(id)}">ביטול</button></div>`).join("")||"אין תוצאות";
 document.querySelectorAll("[data-admin-edit]").forEach(b=>b.onclick=async()=>{const id=b.dataset.adminEdit,d=reservations[id],name=prompt("שם חדש",d.displayName);if(name===null)return;const trimmed=name.trim();if(!trimmed||trimmed.length>70)return message("יש להזין שם תקין");try{await updateDoc(doc(db,"reservations",id),{displayName:trimmed});message("השם עודכן")}catch(e){message(e.message)}});
 document.querySelectorAll("[data-admin-delete]").forEach(b=>b.onclick=async()=>{const id=b.dataset.adminDelete;if(!confirm("לבטל הזמנה למושב "+id+"?"))return;try{await deleteDoc(doc(db,"reservations",id));message("ההזמנה בוטלה")}catch(e){message(e.message)}});
 document.querySelectorAll("[data-admin-move]").forEach(b=>b.onclick=async()=>{const id=b.dataset.adminMove,to=prompt("לאיזה מושב להעביר? (לדוגמה B05-S1)");if(!to)return;const target=to.trim().toUpperCase();if(!valid.has(target)||reservations[target])return message("מושב היעד אינו חוקי או תפוס");try{await runTransaction(db,async tx=>{const from=doc(db,"reservations",id),dest=doc(db,"reservations",target),old=await tx.get(from),next=await tx.get(dest);if(!old.exists()||next.exists())throw Error("המושב כבר השתנה");tx.set(dest,{...old.data(),createdAt:serverTimestamp()});tx.delete(from)});message("המושב הועבר")}catch(e){message(e.message)}});
 }; 
 document.getElementById("admin-search").oninput=list;list();
 document.getElementById("admin-export").onclick=()=>{const rows=[["מושב","שם","משפחה"],...Object.entries(reservations).map(([id,d])=>[id,d.displayName,d.familyName])];const csv="\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="synagogue-reservations.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 if(isSuper()){document.getElementById("admin-members").innerHTML=Object.entries(admins).map(([uid,d])=>`<div>${safe(uid)} — ${d.active?"פעיל":"לא פעיל"} <button data-revoke="${safe(uid)}">הסרה</button></div>`).join("");document.getElementById("admin-add").onclick=async()=>{const uid=document.getElementById("admin-uid").value.trim();if(!/^[a-zA-Z0-9]{20,128}$/.test(uid))return message("UID לא תקין");try{await setDoc(doc(db,"admins",uid),{active:true,createdAt:serverTimestamp()});message("הגבאי אושר")}catch(e){message(e.message)}};document.querySelectorAll("[data-revoke]").forEach(b=>b.onclick=async()=>{if(!confirm("להסיר הרשאות גבאי?"))return;try{await deleteDoc(doc(db,"admins",b.dataset.revoke));message("הרשאות הוסרו")}catch(e){message(e.message)}})}
}
