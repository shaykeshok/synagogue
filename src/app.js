import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import benches from "./seats.json";
import "./style.css";

const required=["VITE_FIREBASE_API_KEY","VITE_FIREBASE_AUTH_DOMAIN","VITE_FIREBASE_PROJECT_ID","VITE_FIREBASE_APP_ID"];
const ready=required.every(k=>!!import.meta.env[k]);
const root=document.getElementById("app");
const seats=benches.flatMap(b=>b.seats);
const valid=new Set(seats.map(s=>s.id));
let auth=null,db=null,user=null,reservations={},selected=new Set(),unsub=null,seatNames={},familyDraft="",residentDraft=false,gradeDraft=false,authError="";
if(ready){
 const app=initializeApp({apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID});
 auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,async u=>{user=u;if(!u){try{await signInAnonymously(auth)}catch(e){authError=e.message;render()}}else{authError="";render()}});
 unsub=onSnapshot(collection(db,"reservations"),snap=>{reservations={};snap.forEach(d=>reservations[d.id]=d.data());render();},err=>{document.getElementById("message").textContent="שגיאה בטעינת מקומות: "+err.message;});
}
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function captureDraft(){const f=document.getElementById("booking");if(!f)return;const d=new FormData(f);for(const id of selected)seatNames[id]=String(d.get("name-"+id)||"");familyDraft=String(d.get("familyName")||"");residentDraft=!!d.get("resident");gradeDraft=!!d.get("grade")}
function render(){
 const taken=Object.keys(reservations).length;
 root.innerHTML=`<header><div class="wrap"><h1>בית הכנסת אלוני הבשן</h1><p>בחירת מקומות ישיבה</p></div></header><main class="wrap"><div class="notice">מפת המושבים עדיין טעונה אימות מול התוכנית האדריכלית. ההזמנות מותנות בהגדרת Firebase וכללי אבטחה.</div><div class="layout"><section class="panel"><div class="summary"><strong>${seats.length} מקומות</strong><span>${taken} שמורים</span><span>${seats.length-taken} פנויים</span></div><div class="legend">🟢 פנוי　🟡 מסומן　🔴 שמור</div><div class="scroll"><div class="map" id="map"><img src="/synagogue-plan.png" alt="תוכנית בית הכנסת"/></div></div><small>אפשר לגלול לצדדים בטלפון כדי לראות את כל המפה.</small></section><aside class="panel"><h2>בחירת מושבים</h2><p id="identity">${user?"אפשר להזמין ללא הרשמה או הזנת פרטי קשר":"מכין אפשרות להזמנה ללא התחברות..."}</p><p>מקומות שנבחרו: <strong id="selection">${[...selected].join(", ")||"אין"}</strong></p><form id="booking"><div class="seat-names">${[...selected].sort().map(id=>`<label>שם להצגה — מושב ${safe(id)}<input name="name-${safe(id)}" required maxlength="70" value="${safe(seatNames[id]||"")}" placeholder="שם המתפלל/ת"></label>`).join("")||"<p>בחרו מושבים במפה כדי להזין שם נפרד לכל מושב.</p>"}</div><label>שם משפחה<input name="familyName" required maxlength="70" value="${safe(familyDraft)}"></label><label class="check"><input type="checkbox" name="resident" required ${residentDraft?"checked":""}> אני תושב/ת אלוני הבשן</label><label class="check"><input type="checkbox" name="grade" required ${gradeDraft?"checked":""}> המתפלל/ת בכיתה א׳ ומעלה</label><button type="submit" ${!ready||!user?"disabled":""}>שמור מקומות</button></form><p id="message" role="status">${authError?safe("שגיאת זיהוי: "+authError):ready?"":"חיבור Firebase טרם הוגדר. אי אפשר להזמין מקומות."}</p><h3>ההזמנות שלי</h3><div id="mine"></div></aside></div></main>`;
 const map=document.getElementById("map");
 for(const s of seats){const d=reservations[s.id],b=document.createElement("button");b.type="button";b.className="seat "+(d?"taken":selected.has(s.id)?"selected":"");b.style.left=(s.x/768*100)+"%";b.style.top=(s.y/1087*100)+"%";b.title=s.id+(d?" — "+d.displayName:" — פנוי");b.setAttribute("aria-label",b.title);b.textContent=s.id.split("-S")[1];b.onclick=()=>{if(d)return;captureDraft();if(selected.has(s.id)){selected.delete(s.id);delete seatNames[s.id]}else selected.add(s.id);render()};map.appendChild(b)}
 document.getElementById("booking").onsubmit=book;
 document.getElementById("mine").innerHTML=Object.entries(reservations).filter(([id,d])=>d.ownerUid===user?.uid).map(([id,d])=>`<div class="myseat">${safe(id)} — ${safe(d.displayName)} <button data-cancel="${safe(id)}">ביטול</button></div>`).join("")||"אין הזמנות";
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
