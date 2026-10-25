/* আমার হিসাব — local-first PWA. Google Drive backup uses OAuth token flow and Drive appDataFolder. */
(() => {
"use strict";
const CLIENT_ID = "822363790054-s0n5f46cfj134jgpcog4114jo9qf8fb9.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const STORAGE_KEY = "amarHishabData_v1";
const $ = id => document.getElementById(id);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const currentMonth = () => todayISO().slice(0,7);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const money = n => "৳" + Number(n || 0).toLocaleString("bn-BD",{maximumFractionDigits:2});
const parseAmount = v => Math.max(0, Number(v) || 0);
const monthOf = date => (date || "").slice(0,7);
const dateText = d => d ? new Date(d+"T12:00:00").toLocaleDateString("bn-BD",{day:"numeric",month:"short",year:"numeric"}) : "তারিখ নেই";
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const defaultCategories = [
 {id:"e-grocery",type:"expense",name:"মুদি বাজার খরচ",budget:2500},
 {id:"e-fresh",type:"expense",name:"কাঁচা বাজার",budget:1500},
 {id:"e-fuel",type:"expense",name:"মোটরসাইকেল তেল খরচ",budget:1800},
 {id:"e-oil",type:"expense",name:"মোটরসাইকেল মবিল খরচ",budget:300},
 {id:"e-repair",type:"expense",name:"মোটরসাইকেল মেরামত খরচ",budget:400},
 {id:"e-goat",type:"expense",name:"ছাগলের খরচ",budget:500},
 {id:"e-medical",type:"expense",name:"মেডিকেল খরচ",budget:500},
 {id:"e-cosmetics",type:"expense",name:"কসমেটিকস খরচ",budget:300},
 {id:"e-electric",type:"expense",name:"বিদ্যুৎ বিল",budget:500},
 {id:"e-mobile",type:"expense",name:"মোবাইল বিল",budget:300},
 {id:"e-water-fridge",type:"expense",name:"পানি ও ফ্রিজের বিল",budget:400},
 {id:"e-clothes",type:"expense",name:"পোশাকের খরচ",budget:500},
 {id:"e-other",type:"expense",name:"অন্যান্য খরচ",budget:2500},
 {id:"i-salary",type:"income",name:"বেতন",budget:0},
 {id:"i-incentive",type:"income",name:"ইনসেনটিভ",budget:0},
 {id:"i-goat-sale",type:"income",name:"ছাগল বিক্রি",budget:0},
 {id:"i-other",type:"income",name:"অন্যান্য আয়",budget:0},
 {id:"s-salary",type:"saving",name:"বেতন থেকে জমা",budget:0},
 {id:"s-incentive",type:"saving",name:"ইন্সেনটিভ থেকে জমা",budget:0},
 {id:"s-goat-sale",type:"saving",name:"ছাগল বিক্রি থেকে জমা",budget:0},
 {id:"s-other",type:"saving",name:"অন্যান্য খাত থেকে জমা",budget:0}
];
function initialState(){return {version:1,categories:defaultCategories.map(c=>({...c})),transactions:[],loans:[],repayments:[],monthlyBudgets:{},settings:{salaryAmount:17000,lastSalaryDate:"",nextSalaryDate:"",dailyMode:"auto",fixedDailyBudget:400},createdAt:new Date().toISOString()};}
function loadState(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));if(parsed&&parsed.version===1&&Array.isArray(parsed.categories))return {...initialState(),...parsed,transactions:Array.isArray(parsed.transactions)?parsed.transactions:[],loans:Array.isArray(parsed.loans)?parsed.loans:[],repayments:Array.isArray(parsed.repayments)?parsed.repayments:[],monthlyBudgets:parsed.monthlyBudgets||{},settings:{...initialState().settings,...parsed.settings}};}catch(e){}return initialState();}
const DRIVE_CONNECTED_KEY = "amarHishabDriveConnected_v1";
const DRIVE_DIRTY_KEY = "amarHishabDriveBackupDirty_v1";
let state=loadState(), selectedMonth=currentMonth(), googleToken=null, googleTokenExpiresAt=0, tokenClient=null, installPrompt=null, toastTimer;
let driveAuthPending=null, driveBackupPending=false, driveBackupTimer=null, driveBackupBusy=false;
let driveConnected=localStorage.getItem(DRIVE_CONNECTED_KEY)==="1";
let driveDirty=localStorage.getItem(DRIVE_DIRTY_KEY)==="1";
function persist(){
  // Save locally first. Never wait for the network to save a transaction.
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  driveDirty=true; localStorage.setItem(DRIVE_DIRTY_KEY,"1");
  scheduleDriveBackup();
}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3000);}
function cat(id){return state.categories.find(c=>c.id===id);}
function activeTransactions(month=null){return state.transactions.filter(t=>!month||monthOf(t.date)===month);}
function sum(arr,fn){return arr.reduce((n,x)=>n+fn(x),0);}
function monthBudget(month=selectedMonth){return Number(state.monthlyBudgets[month]?.total ?? 12000);}
function catBudget(id,month=selectedMonth){return Number(state.monthlyBudgets[month]?.categories?.[id] ?? cat(id)?.budget ?? 0);}
function expenseTransactions(month=selectedMonth){return activeTransactions(month).filter(t=>t.type==="expense");}
function savingsTransactions(){return state.transactions.filter(t=>t.type==="saving");}
function monthDays(month){const [y,m]=month.split("-").map(Number);return new Date(y,m,0).getDate();}
function daysRemaining(month=selectedMonth){if(month===currentMonth())return Math.max(1,monthDays(month)-new Date().getDate()+1);return month>currentMonth()?monthDays(month):1;}
function dateDiff(a,b){if(!a||!b)return null;return Math.ceil((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);}
function totalLoansOutstanding(){return sum(state.loans,l=>Math.max(0,Number(l.amount)-sum(state.repayments.filter(r=>r.loanId===l.id),r=>Number(r.amount))));}
function monthlyTotals(month=selectedMonth){const ts=activeTransactions(month);return {income:sum(ts.filter(t=>t.type==="income"),t=>t.amount),expense:sum(ts.filter(t=>t.type==="expense"),t=>t.amount),saving:sum(ts.filter(t=>t.type==="saving"),t=>t.amount)};}
function dailySuggested(){const remaining=Math.max(0,monthBudget()-monthlyTotals().expense);if(state.settings.dailyMode==="fixed")return Math.min(remaining,parseAmount(state.settings.fixedDailyBudget));const days=daysRemaining();return days?remaining/days:remaining;}
function categoryLabel(t){return cat(t.categoryId)?.name || t.categoryName || "অজানা/পুরোনো খাত";}
function render(){
 const totals=monthlyTotals(), budget=monthBudget(), remaining=budget-totals.expense;
 $("monthPicker").value=selectedMonth;
 $("totalIncome").textContent=money(totals.income);
 $("totalExpense").textContent=money(totals.expense);
 $("totalSavings").textContent=money(sum(savingsTransactions(),t=>t.amount));
 $("budgetRemaining").textContent=money(remaining);
 $("budgetRemaining").classList.toggle("status-warning",remaining<0);
 const todaySpent=sum(state.transactions.filter(t=>t.type==="expense"&&t.date===todayISO()),t=>t.amount);
 $("dailySuggested").textContent=money(dailySuggested());
 $("todaySpent").textContent=money(todaySpent);
 $("daysLeft").textContent=String(daysRemaining()).replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[d])+" দিন";
 const pct=budget>0?Math.min(100,Math.max(0,totals.expense/budget*100)):0;
 $("budgetProgress").style.width=pct+"%";
 $("budgetProgress").style.background=remaining<0?"#c53030":pct>=85?"#d97706":"#15845a";
 $("budgetStatus").textContent=remaining<0?"বাজেট অতিক্রম":"বাজেটের মধ্যে";
 $("budgetStatus").style.background=remaining<0?"#ffe6e6":"#e4f6eb";
 $("budgetHint").textContent=remaining<0?`মাসিক বাজেট ${money(Math.abs(remaining))} অতিক্রম হয়েছে। নতুন খরচ যোগ করার সময় সতর্ক থাকুন।`:`মাসিক বাজেটের ${pct.toLocaleString("bn-BD",{maximumFractionDigits:1})}% ব্যবহার হয়েছে।`;
 const next=state.settings.nextSalaryDate, diff=next?dateDiff(todayISO(),next):null;
 $("salaryCountdown").textContent=next?(diff<0?`বেতনের সম্ভাব্য তারিখ ${Math.abs(diff)} দিন আগে পেরিয়েছে — তারিখ আপডেট করুন।`:diff===0?"আজ বেতন পাওয়ার সম্ভাব্য দিন":`পরবর্তী বেতন পেতে ${diff} দিন বাকি (${dateText(next)})`):"সেটিংসে পরবর্তী বেতনের তারিখ দিন";
 renderCategoryOverview();renderTransactions();renderBudgets();renderSavings();renderLoans();renderCategoryManager();
}
function renderCategoryOverview(){
 const rows=state.categories.filter(c=>c.type==="expense").map(c=>{const spent=sum(expenseTransactions().filter(t=>t.categoryId===c.id),t=>t.amount);return {c,spent,budget:catBudget(c.id)};});
 $("categoryOverview").innerHTML=rows.map(({c,spent,budget})=>`<div class="category-row"><div class="category-main"><div class="category-title">${escapeHtml(c.name)}</div><div class="category-meta">খরচ ${money(spent)} · বাজেট ${money(budget)}</div><div class="mini-progress"><span style="width:${budget?Math.min(100,spent/budget*100):spent?100:0}%;background:${spent>budget?"#c53030":"#15845a"}"></span></div></div><div class="category-amount"><strong class="${budget-spent<0?"status-warning":"status-good"}">${money(budget-spent)}</strong><small class="category-meta">বাকি</small></div></div>`).join("")||'<div class="empty-state">এখনো কোনো খরচের খাত নেই।</div>';
}
function transactionActions(t){return `<div class="row-actions"><button class="small-button" data-edit-transaction="${t.id}">এডিট</button><button class="small-button danger" data-delete-transaction="${t.id}">মুছুন</button></div>`;}
function renderTransactions(){
 const sorted=[...state.transactions].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||b.createdAt.localeCompare(a.createdAt));
 const filtered=sorted.filter(t=>monthOf(t.date)===selectedMonth);
 const list=filtered.filter(t=>$("transactionFilter").value==="all"||t.type===$("transactionFilter").value);
 const html=arr=>arr.map(t=>`<div class="transaction-row"><div class="transaction-main"><div class="category-title">${escapeHtml(categoryLabel(t))}</div><div class="transaction-meta">${dateText(t.date)}${t.note?" · "+escapeHtml(t.note):""}</div></div><div class="amount"><strong class="${t.type==="income"||t.type==="saving"?"amount-positive":"amount-negative"}">${t.type==="expense"?"−":"+"}${money(t.amount)}</strong><small class="transaction-meta">${t.type==="expense"?"খরচ":t.type==="income"?"আয়":"সঞ্চয়"}</small></div>${transactionActions(t)}</div>`).join("");
 $("allTransactions").innerHTML=html(list)||'<div class="empty-state">এই মাসে কোনো লেনদেন নেই।</div>';
 $("recentTransactions").innerHTML=html(filtered.slice(0,5))||'<div class="empty-state">এখনো কোনো লেনদেন যোগ করা হয়নি।</div>';
}
function renderBudgets(){
 const cats=state.categories.filter(c=>c.type==="expense");
 $("categoryBudgets").innerHTML=cats.map(c=>{const spent=sum(expenseTransactions().filter(t=>t.categoryId===c.id),t=>t.amount),b=catBudget(c.id);return `<div class="category-row"><div class="category-main"><div class="category-title">${escapeHtml(c.name)}</div><div class="category-meta">খরচ ${money(spent)} / ${money(b)}</div><div class="mini-progress"><span style="width:${b?Math.min(100,spent/b*100):spent?100:0}%;background:${spent>b?"#c53030":"#15845a"}"></span></div></div><div class="category-amount"><strong class="${b-spent<0?"status-warning":"status-good"}">${money(b-spent)}</strong><small class="category-meta">বাকি</small></div><button class="small-button" data-edit-category-budget="${c.id}">এডিট</button></div>`;}).join("")||'<div class="empty-state">খরচের খাত নেই।</div>';
 $("categoryBudgetTotal").textContent=money(sum(cats,c=>catBudget(c.id)));
}
function renderSavings(){
 const total=sum(savingsTransactions(),t=>t.amount);$("savingsTotalAll").textContent=money(total);
 $("savingsBreakdown").innerHTML=state.categories.filter(c=>c.type==="saving").map(c=>{const n=sum(savingsTransactions().filter(t=>t.categoryId===c.id),t=>t.amount);return `<div class="category-row"><div class="category-main"><div class="category-title">${escapeHtml(c.name)}</div><div class="category-meta">মোট জমা</div></div><div class="category-amount"><strong class="amount-positive">${money(n)}</strong></div><button class="small-button" data-add-saving="${c.id}">জমা যোগ</button></div>`;}).join("")||'<div class="empty-state">সঞ্চয়ের খাত নেই। সেটিংস থেকে যোগ করুন।</div>';
}
function renderLoans(){
 const outstanding=totalLoansOutstanding(),borrowed=sum(state.loans,l=>Number(l.amount)),repaid=sum(state.repayments,r=>Number(r.amount));
 $("loanSummary").innerHTML=`<div><span class="category-meta">মোট ধার নেওয়া</span><strong>${money(borrowed)}</strong></div><div><span class="category-meta">মোট ফেরত দিয়েছেন</span><strong class="status-good">${money(repaid)}</strong></div><div><span class="category-meta">এখনো ফেরত বাকি</span><strong class="${outstanding>0?"status-warning":"status-good"}">${money(outstanding)}</strong></div>`;
 $("loanList").innerHTML=state.loans.map(l=>{const paid=sum(state.repayments.filter(r=>r.loanId===l.id),r=>r.amount),left=Math.max(0,l.amount-paid);return `<div class="transaction-row"><div class="transaction-main"><div class="category-title">${escapeHtml(l.source)}</div><div class="transaction-meta">নেওয়া: ${dateText(l.date)}${l.dueDate?" · ফেরতের লক্ষ্য: "+dateText(l.dueDate):""}${l.note?" · "+escapeHtml(l.note):""}</div><div class="transaction-meta">ধার ${money(l.amount)} · ফেরত ${money(paid)}</div></div><div class="amount"><strong class="${left?"status-warning":"status-good"}">${money(left)}</strong><small class="transaction-meta">বাকি</small></div><div class="row-actions"><button class="small-button" data-edit-loan="${l.id}">এডিট</button><button class="small-button danger" data-delete-loan="${l.id}">মুছুন</button></div></div>`;}).join("")||'<div class="empty-state">এখনো ধার যোগ করা হয়নি।</div>';
 const history=[...state.repayments].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
 $("repaymentHistory").innerHTML=history.map(r=>{const l=state.loans.find(x=>x.id===r.loanId);return `<div class="transaction-row repayment-row"><div class="transaction-main"><div class="category-title">${escapeHtml(l?.source||"মুছে ফেলা ধার")}</div><div class="transaction-meta">ফেরতের তারিখ: ${dateText(r.date)}</div></div><div class="amount"><strong class="amount-positive">${money(r.amount)}</strong><small class="transaction-meta">ফেরত</small></div><div class="row-actions"><button class="small-button" data-edit-repayment="${r.id}">এডিট</button><button class="small-button danger" data-delete-repayment="${r.id}">মুছুন</button></div></div>`;}).join("")||'<div class="empty-state">এখনো কোনো ফেরতের রেকর্ড নেই। ধার ফেরত দিলে তারিখ ও পরিমাণ এখানে দেখা যাবে।</div>';
 const open=state.loans.filter(l=>l.amount>sum(state.repayments.filter(r=>r.loanId===l.id),r=>r.amount));
 $("repayLoanSelect").innerHTML=open.map(l=>`<option value="${l.id}">${escapeHtml(l.source)} — বাকি ${money(l.amount-sum(state.repayments.filter(r=>r.loanId===l.id),r=>r.amount))}</option>`).join("");
 $("repayDate").value ||= todayISO();
 $("repayForm").classList.toggle("hidden",!open.length);
}
function renderCategoryManager(){
 $("categoryManager").innerHTML=state.categories.map(c=>`<div class="category-manager-row"><input aria-label="খাতের নাম" data-category-name="${c.id}" value="${escapeHtml(c.name)}"><select aria-label="খাতের ধরন" data-category-type="${c.id}"><option value="expense" ${c.type==="expense"?"selected":""}>খরচ</option><option value="income" ${c.type==="income"?"selected":""}>আয়</option><option value="saving" ${c.type==="saving"?"selected":""}>সঞ্চয়</option></select><button class="small-button" data-save-category="${c.id}">সংরক্ষণ</button></div>`).join("");
}
function showModal(id){const d=$(id);if(d&&!d.open)d.showModal();}
function closeModal(id){const d=$(id);if(d?.open)d.close();}
function populateTransactionCategories(type,selected=""){
 const list=state.categories.filter(c=>c.type===type);
 $("transactionCategory").innerHTML=list.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
 if(selected&&list.some(c=>c.id===selected))$("transactionCategory").value=selected;
}
function openTransaction(kind="expense",id=null,categoryId=null){
 const t=id?state.transactions.find(x=>x.id===id):null;
 $("transactionForm").reset();$("transactionId").value=t?.id||"";
 $("transactionType").value=t?.type||kind;populateTransactionCategories($("transactionType").value,t?.categoryId||categoryId);
 $("transactionAmount").value=t?.amount??"";$("transactionDate").value=t?.date||todayISO();$("transactionNote").value=t?.note||"";
 $("transactionModalTitle").textContent=t?"লেনদেন এডিট করুন":"লেনদেন যোগ করুন";
 showModal("transactionModal");
}
function openBudgetEditor(){
 $("monthlyBudgetInput").value=monthBudget();
 $("budgetEditorRows").innerHTML=state.categories.filter(c=>c.type==="expense").map(c=>`<div class="budget-edit-row"><label>${escapeHtml(c.name)}</label><input type="number" min="0" step="0.01" data-budget-input="${c.id}" aria-label="${escapeHtml(c.name)} বাজেট" value="${catBudget(c.id)}"></div>`).join("");
 showModal("budgetModal");
}
function addTransaction(t){state.transactions.push({id:uid(),createdAt:new Date().toISOString(),...t});}
function transactionFormSubmit(e){
 e.preventDefault();const id=$("transactionId").value,type=$("transactionType").value,categoryId=$("transactionCategory").value,amount=parseAmount($("transactionAmount").value),date=$("transactionDate").value,note=$("transactionNote").value.trim();
 if(!categoryId||amount<=0||!date){toast("খাত, সঠিক টাকার পরিমাণ ও তারিখ দিন।");return;}
 const c=cat(categoryId);if(!c||c.type!==type){toast("লেনদেনের ধরন অনুযায়ী খাত নির্বাচন করুন।");return;}
 if(id){const old=state.transactions.find(t=>t.id===id);if(old)Object.assign(old,{type,categoryId,amount,date,note,categoryName:c.name,updatedAt:new Date().toISOString()});}
 else addTransaction({type,categoryId,categoryName:c.name,amount,date,note});
 persist();closeModal("transactionModal");render();toast(id?"লেনদেন সংশোধন হয়েছে।":"লেনদেন সংরক্ষণ হয়েছে।");
}
function budgetSubmit(e){e.preventDefault();const total=parseAmount($("monthlyBudgetInput").value),categories={};document.querySelectorAll("[data-budget-input]").forEach(el=>categories[el.dataset.budgetInput]=parseAmount(el.value));state.monthlyBudgets[selectedMonth]={total,categories};persist();closeModal("budgetModal");render();toast("মাসিক বাজেট সংরক্ষণ হয়েছে।");}
function settingsSubmit(e){e.preventDefault();state.settings.salaryAmount=parseAmount($("salaryAmount").value);state.settings.lastSalaryDate=$("lastSalaryDate").value;state.settings.nextSalaryDate=$("nextSalaryDate").value;state.settings.dailyMode=$("dailyMode").value;state.settings.fixedDailyBudget=parseAmount($("fixedDailyBudget").value);persist();render();toast("সেটিংস সংরক্ষণ হয়েছে।");}
function loadSettingsForm(){const s=state.settings;$("salaryAmount").value=s.salaryAmount;$("lastSalaryDate").value=s.lastSalaryDate;$("nextSalaryDate").value=s.nextSalaryDate;$("dailyMode").value=s.dailyMode;$("fixedDailyBudget").value=s.fixedDailyBudget;$("fixedDailyWrap").classList.toggle("hidden",s.dailyMode!=="fixed");}
function exportJson(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`amar-hishab-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);toast("JSON ব্যাকআপ ডাউনলোড শুরু হয়েছে।");}
function importJsonFile(file){const reader=new FileReader();reader.onload=()=>{try{const incoming=JSON.parse(reader.result);if(!incoming||incoming.version!==1||!Array.isArray(incoming.categories)||!Array.isArray(incoming.transactions))throw new Error("Invalid");if(!confirm("বর্তমান হিসাব প্রতিস্থাপন করে ব্যাকআপ Restore করবেন? আগে বর্তমান ডেটার ব্যাকআপ নিন।"))return;state={...initialState(),...incoming,transactions:Array.isArray(incoming.transactions)?incoming.transactions:[],loans:Array.isArray(incoming.loans)?incoming.loans:[],repayments:Array.isArray(incoming.repayments)?incoming.repayments:[],monthlyBudgets:incoming.monthlyBudgets||{},settings:{...initialState().settings,...incoming.settings}};persist();render();loadSettingsForm();toast("ব্যাকআপ Restore হয়েছে।");}catch(e){toast("এই JSON ফাইলটি সঠিক আমার হিসাব ব্যাকআপ নয়।");}};reader.readAsText(file);}
function addCategory(){const type=$("newCategoryType").value,name=$("newCategoryName").value.trim();if(!name){toast("খাতের নাম লিখুন।");return;}if(state.categories.some(c=>c.type===type&&c.name.toLocaleLowerCase()===name.toLocaleLowerCase())){toast("এই নামে খাত আগে থেকেই আছে।");return;}const id=uid();state.categories.push({id,type,name,budget:0});if(type==="expense"){const mb=state.monthlyBudgets[selectedMonth]||{total:monthBudget(),categories:{}};mb.categories[id]=0;state.monthlyBudgets[selectedMonth]=mb;}persist();$("newCategoryName").value="";render();toast("নতুন খাত যোগ হয়েছে।");}
function saveCategory(id){const c=cat(id),name=document.querySelector(`[data-category-name="${id}"]`)?.value.trim(),type=document.querySelector(`[data-category-type="${id}"]`)?.value;if(!c||!name){toast("খাতের নাম লিখুন।");return;}if(state.categories.some(x=>x.id!==id&&x.type===type&&x.name.toLocaleLowerCase()===name.toLocaleLowerCase())){toast("একই নামে খাত আছে।");return;}const oldType=c.type;c.name=name;c.type=type;state.transactions.forEach(t=>{if(t.categoryId===id)t.categoryName=name;});if(oldType!==type){state.transactions.forEach(t=>{if(t.categoryId===id)t.type=type;});}persist();render();toast("খাতের নাম/ধরন সংরক্ষণ হয়েছে।");}
function editCategoryBudget(id){openBudgetEditor();setTimeout(()=>{const el=document.querySelector(`[data-budget-input="${id}"]`);el?.scrollIntoView({block:"center",behavior:"smooth"});el?.focus();},100);}
function editLoan(id){const l=state.loans.find(x=>x.id===id);if(!l)return;const source=prompt("ধার নেওয়ার উৎস/ব্যক্তির নাম",l.source);if(source===null)return;const amount=prompt("ধারের মোট পরিমাণ (৳)",l.amount);if(amount===null)return;const n=parseAmount(amount);if(!source.trim()||n<=0){toast("সঠিক নাম ও পরিমাণ দিন।");return;}l.source=source.trim();l.amount=n;persist();render();toast("ধারের তথ্য এডিট হয়েছে।");}
function deleteLoan(id){if(state.repayments.some(r=>r.loanId===id)){toast("এই ধারের ফেরত রেকর্ড আছে। আগে ফেরতের রেকর্ড সামলান।");return;}if(confirm("এই ধার মুছে ফেলবেন?")){state.loans=state.loans.filter(l=>l.id!==id);persist();render();}}
function editRepayment(id){const r=state.repayments.find(x=>x.id===id);if(!r)return;const amountText=prompt("ফেরতের পরিমাণ (৳)",r.amount);if(amountText===null)return;const amount=parseAmount(amountText);if(amount<=0){toast("সঠিক পরিমাণ দিন।");return;}const date=prompt("ফেরতের তারিখ (YYYY-MM-DD)",r.date);if(date===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+"T12:00:00").getTime())){toast("তারিখ YYYY-MM-DD ফরম্যাটে দিন।");return;}const loan=state.loans.find(x=>x.id===r.loanId);const otherPaid=sum(state.repayments.filter(x=>x.loanId===r.loanId&&x.id!==id),x=>Number(x.amount));if(loan&&otherPaid+amount>Number(loan.amount)){toast("এই পরিবর্তনে মোট ফেরত ধারের পরিমাণ ছাড়িয়ে যাবে।");return;}r.amount=amount;r.date=date;persist();render();toast("ফেরতের রেকর্ড সংশোধন হয়েছে।");}
function deleteRepayment(id){const r=state.repayments.find(x=>x.id===id);if(!r)return;if(confirm("এই ফেরতের রেকর্ড মুছে ফেলবেন?")){state.repayments=state.repayments.filter(x=>x.id!==id);persist();render();toast("ফেরতের রেকর্ড মুছে ফেলা হয়েছে।");}}
function updateGoogleButtons(){
  const ready=!!googleToken && Date.now()<googleTokenExpiresAt;
  $("backupGoogleBtn").disabled=!ready;
  $("restoreGoogleBtn").disabled=!ready;
}
function loadGoogleIdentity(){
  return new Promise(resolve=>{
    if(window.google?.accounts?.oauth2)return resolve(true);
    const existing=document.querySelector('script[data-google-identity]');
    if(existing){existing.addEventListener('load',()=>resolve(!!window.google?.accounts?.oauth2),{once:true});existing.addEventListener('error',()=>resolve(false),{once:true});return;}
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.googleIdentity='1';
    script.onload=()=>resolve(!!window.google?.accounts?.oauth2);script.onerror=()=>resolve(false);document.head.appendChild(script);
  });
}
function requestGoogleToken(promptMode){
  if(driveAuthPending)return driveAuthPending;
  driveAuthPending=(async()=>{
    if(!navigator.onLine)return false;
    const loaded=await loadGoogleIdentity();if(!loaded)return false;
    return await new Promise(resolve=>{
      try{
        tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:DRIVE_SCOPE,callback:response=>{
          if(response.error||!response.access_token){googleToken=null;googleTokenExpiresAt=0;updateGoogleButtons();resolve(false);return;}
          googleToken=response.access_token;googleTokenExpiresAt=Date.now()+Math.max(60,Number(response.expires_in||3600)-60)*1000;
          driveConnected=true;localStorage.setItem(DRIVE_CONNECTED_KEY,"1");
          $("googleStatus").textContent="Google Drive সংযুক্ত। ইন্টারনেট থাকলে অপেক্ষমাণ ব্যাকআপ স্বয়ংক্রিয়ভাবে পাঠানো হবে।";
          updateGoogleButtons();resolve(true);
        }});
        // Follow the reference shop app: after first consent, use prompt:none for silent renewal.
        tokenClient.requestAccessToken(promptMode==="consent"?{prompt:"consent"}:{prompt:"none"});
      }catch(e){resolve(false);}
    });
  })().finally(()=>{driveAuthPending=null;});
  return driveAuthPending;
}
async function connectGoogle(){
  if(!navigator.onLine){$("googleStatus").textContent="ইন্টারনেট এলে Google Drive সংযুক্ত করুন। আপনার হিসাব ফোনে সংরক্ষিত আছে।";return;}
  const ok=await requestGoogleToken("consent");
  if(!ok){$("googleStatus").textContent="Google অনুমতি পাওয়া যায়নি। ইন্টারনেট/Google সেশন পরীক্ষা করে আবার চেষ্টা করুন।";return;}
  toast("Google Drive সংযুক্ত হয়েছে।");
  if(driveDirty) scheduleDriveBackup(500);
}
async function ensureGoogleAccess(silent=true){
  if(googleToken && Date.now()<googleTokenExpiresAt)return true;
  googleToken=null;updateGoogleButtons();
  if(!driveConnected)return false;
  const ok=await requestGoogleToken(silent?"none":"consent");
  if(!ok){$("googleStatus").textContent="ব্যাকআপ অপেক্ষমাণ। Google-এর নীরব অনুমতি পাওয়া যায়নি; Google Drive সংযোগ বোতাম একবার চাপুন। ফোনের হিসাব নিরাপদে লোকালেই আছে।";return false;}
  return true;
}
async function googleRequest(url,options={}){
  if(!googleToken || Date.now()>=googleTokenExpiresAt)throw new Error("Google token expired");
  const res=await fetch(url,{...options,headers:{...(options.headers||{}),Authorization:"Bearer "+googleToken}});
  if(res.status===401){googleToken=null;googleTokenExpiresAt=0;updateGoogleButtons();throw new Error("Google অনুমতি মেয়াদ শেষ");}
  if(!res.ok)throw new Error(await res.text());return res;
}
async function googleBackup(silent=false){
  if(driveBackupBusy)return false;
  if(!navigator.onLine){driveDirty=true;localStorage.setItem(DRIVE_DIRTY_KEY,"1");$("googleStatus").textContent="অফলাইন: হিসাব ফোনে সেভ আছে; ইন্টারনেট এলে ব্যাকআপ হবে।";return false;}
  if(!driveConnected){if(!silent)await connectGoogle();return false;}
  driveBackupBusy=true;
  try{
    if(!await ensureGoogleAccess(true))return false;
    const payload=JSON.stringify({...state,exportedAt:new Date().toISOString(),backupApp:"আমার হিসাব"},null,2);
    const q=await googleRequest("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=100");
    const data=await q.json();const found=(data.files||[]).filter(f=>f.name==="amar-hishab-backup.json").sort((a,b)=>(b.modifiedTime||"").localeCompare(a.modifiedTime||""));
    const metadata={name:"amar-hishab-backup.json",mimeType:"application/json",parents:["appDataFolder"]};let res;
    const boundary="-------amarHishabBoundary"+uid().replace(/-/g,"");
    if(found.length){res=await googleRequest(`https://www.googleapis.com/upload/drive/v3/files/${found[0].id}?uploadType=multipart&fields=id,name,modifiedTime`,{method:"PATCH",headers:{"Content-Type":"multipart/related; boundary="+boundary},body:`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:metadata.name,mimeType:metadata.mimeType})}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${payload}\r\n--${boundary}--`});}
    else{res=await googleRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime",{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body:`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${payload}\r\n--${boundary}--`});}
    const saved=await res.json();driveDirty=false;localStorage.setItem(DRIVE_DIRTY_KEY,"0");
    $("googleStatus").textContent="Google Drive ব্যাকআপ সফল: "+(saved.modifiedTime||new Date().toLocaleString("bn-BD"));return true;
  }catch(e){
    driveDirty=true;localStorage.setItem(DRIVE_DIRTY_KEY,"1");
    $("googleStatus").textContent="ব্যাকআপ এখনো হয়নি—পরেরবার ইন্টারনেট/Google অনুমতি পাওয়া গেলে আবার চেষ্টা হবে। আপনার হিসাব ফোনে সেভ আছে।";
    if(!silent)toast("ব্যাকআপ হয়নি; পরে আবার চেষ্টা করা হবে।");return false;
  }finally{driveBackupBusy=false;updateGoogleButtons();}
}
function scheduleDriveBackup(delay=1800){
  clearTimeout(driveBackupTimer);driveBackupPending=true;
  if(!driveDirty || !driveConnected || !navigator.onLine)return;
  driveBackupTimer=setTimeout(async()=>{driveBackupPending=false;await googleBackup(true);},delay);
}
window.addEventListener("online",()=>{if(driveDirty&&driveConnected){$("googleStatus").textContent="ইন্টারনেট এসেছে—ব্যাকআপ চেষ্টা করা হচ্ছে…";scheduleDriveBackup(800);}});
window.addEventListener("focus",()=>{if(driveDirty&&driveConnected&&navigator.onLine)scheduleDriveBackup(800);});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&driveDirty&&driveConnected&&navigator.onLine)scheduleDriveBackup(800);});
async function googleRestore(){
 if(!await ensureGoogleAccess(false)){await connectGoogle();if(!googleToken)return;}if(!confirm("Google Drive ব্যাকআপ Restore করলে বর্তমান ডেটা প্রতিস্থাপিত হবে। আগে JSON ব্যাকআপ নেবেন?"))return;
 $("restoreGoogleBtn").disabled=true;
 try{const q=await googleRequest("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=100");const data=await q.json();const file=(data.files||[]).filter(f=>f.name==="amar-hishab-backup.json").sort((a,b)=>(b.modifiedTime||"").localeCompare(a.modifiedTime||""))[0];if(!file)throw new Error("Google Drive-এ ব্যাকআপ ফাইল পাওয়া যায়নি।");const r=await googleRequest(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);const incoming=await r.json();if(incoming.version!==1||!Array.isArray(incoming.categories)||!Array.isArray(incoming.transactions))throw new Error("ব্যাকআপ ফাইলের ফরম্যাট সঠিক নয়।");state={...initialState(),...incoming,transactions:Array.isArray(incoming.transactions)?incoming.transactions:[],loans:Array.isArray(incoming.loans)?incoming.loans:[],repayments:Array.isArray(incoming.repayments)?incoming.repayments:[],monthlyBudgets:incoming.monthlyBudgets||{},settings:{...initialState().settings,...incoming.settings}};persist();render();loadSettingsForm();$("googleStatus").textContent="Google Drive থেকে Restore সফল হয়েছে।";toast("ব্যাকআপ Restore সম্পন্ন।");}catch(e){$("googleStatus").textContent="Restore ব্যর্থ: "+e.message;toast("Restore করা যায়নি।");}finally{$("restoreGoogleBtn").disabled=!googleToken;}
}
function wireEvents(){
 document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>b.dataset.open==="loanModal"?showModal("loanModal"):openTransaction(b.dataset.kind||"expense")));
 document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tab)));
 document.querySelectorAll("[data-tab-jump]").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tabJump)));
 $("monthPicker").addEventListener("change",e=>{selectedMonth=e.target.value||currentMonth();render();});
 $("transactionType").addEventListener("change",e=>populateTransactionCategories(e.target.value));
 $("transactionForm").addEventListener("submit",transactionFormSubmit);
 $("editBudgetBtn").addEventListener("click",openBudgetEditor);$("editBudgetBtn2").addEventListener("click",openBudgetEditor);
 $("budgetForm").addEventListener("submit",budgetSubmit);
 $("salaryForm").addEventListener("submit",settingsSubmit);
 $("dailyMode").addEventListener("change",e=>$("fixedDailyWrap").classList.toggle("hidden",e.target.value!=="fixed"));
 $("transactionFilter").addEventListener("change",renderTransactions);
 $("manageCategoriesBtn").addEventListener("click",()=>{activateTab("settings");$("categoryManager").scrollIntoView({behavior:"smooth",block:"center"});});
 $("addCategoryBtn").addEventListener("click",addCategory);
 $("exportJsonBtn").addEventListener("click",exportJson);
 $("importJsonFile").addEventListener("change",e=>{if(e.target.files[0])importJsonFile(e.target.files[0]);e.target.value="";});
 $("connectGoogleBtn").addEventListener("click",connectGoogle);$("backupGoogleBtn").addEventListener("click",()=>googleBackup(false));$("restoreGoogleBtn").addEventListener("click",googleRestore);
 $("clearDataBtn").addEventListener("click",()=>{if(confirm("সব হিসাব স্থায়ীভাবে মুছে ফেলবেন? আগে JSON ব্যাকআপ নিন।")){state=initialState();persist();render();loadSettingsForm();toast("সব ডেটা মুছে ফেলা হয়েছে।");}});
 $("repayForm").addEventListener("submit",e=>{e.preventDefault();const loanId=$("repayLoanSelect").value,amount=parseAmount($("repayAmount").value),date=$("repayDate").value,l=state.loans.find(x=>x.id===loanId);if(!l||amount<=0||!date){toast("সঠিক ধার ও ফেরতের পরিমাণ দিন।");return;}const outstanding=l.amount-sum(state.repayments.filter(r=>r.loanId===loanId),r=>r.amount);if(amount>outstanding){toast("ফেরতের পরিমাণ বাকি ধারের চেয়ে বেশি হতে পারে না।");return;}state.repayments.push({id:uid(),loanId,amount,date,createdAt:new Date().toISOString()});persist();render();$("repayAmount").value="";toast("ধার ফেরত রেকর্ড হয়েছে।");});
 document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit-transaction]");if(edit){openTransaction("expense",edit.dataset.editTransaction);return;}
  const del=e.target.closest("[data-delete-transaction]");if(del){if(confirm("এই লেনদেন মুছে ফেলবেন?")){state.transactions=state.transactions.filter(t=>t.id!==del.dataset.deleteTransaction);persist();render();toast("লেনদেন মুছে ফেলা হয়েছে।");}return;}
  const save=e.target.closest("[data-save-category]");if(save){saveCategory(save.dataset.saveCategory);return;}
  const bgt=e.target.closest("[data-edit-category-budget]");if(bgt){editCategoryBudget(bgt.dataset.editCategoryBudget);return;}
  const sv=e.target.closest("[data-add-saving]");if(sv){openTransaction("saving",null,sv.dataset.addSaving);return;}
  const loanEdit=e.target.closest("[data-edit-loan]");if(loanEdit){editLoan(loanEdit.dataset.editLoan);return;}
  const loanDel=e.target.closest("[data-delete-loan]");if(loanDel){deleteLoan(loanDel.dataset.deleteLoan);return;}
  const repaymentEdit=e.target.closest("[data-edit-repayment]");if(repaymentEdit){editRepayment(repaymentEdit.dataset.editRepayment);return;}
  const repaymentDel=e.target.closest("[data-delete-repayment]");if(repaymentDel){deleteRepayment(repaymentDel.dataset.deleteRepayment);return;}
 });
 $("loanForm").addEventListener("submit",e=>{e.preventDefault();const source=$("loanSource").value.trim(),amount=parseAmount($("loanAmount").value),date=$("loanDate").value,dueDate=$("loanDueDate").value,note=$("loanNote").value.trim();if(!source||amount<=0||!date){toast("উৎস, পরিমাণ ও তারিখ দিন।");return;}state.loans.push({id:uid(),source,amount,date,dueDate,note,createdAt:new Date().toISOString()});persist();closeModal("loanModal");$("loanForm").reset();render();toast("ধার রেকর্ড হয়েছে।");});
 document.querySelectorAll("[data-open='loanModal']").forEach(b=>b.addEventListener("click",()=>{$("loanDate").value=todayISO();}));
 $("installBtn").addEventListener("click",async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden");}else toast("ব্রাউজারের মেনু থেকে Add to Home screen নির্বাচন করুন।");});
}
function activateTab(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".tab-content").forEach(s=>s.classList.toggle("hidden",s.id!=="tab-"+name));}
function boot(){
 $("monthPicker").value=selectedMonth;$("transactionDate").value=todayISO();$("repayDate").value=todayISO();$("loanDate").value=todayISO();
 wireEvents();loadSettingsForm();render();
  updateGoogleButtons();
  if(driveConnected){$("googleStatus").textContent="আগে Google Drive সংযুক্ত করা হয়েছিল। সংযোগ নীরবে যাচাই করা হচ্ছে…";setTimeout(async()=>{if(await ensureGoogleAccess(true)&&driveDirty)scheduleDriveBackup(500);},1200);}
  if(driveDirty){$("googleStatus").textContent="কিছু পরিবর্তন ব্যাকআপের অপেক্ষায় আছে। ইন্টারনেট এলে স্বয়ংক্রিয়ভাবে চেষ্টা হবে।";}
 if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden");});
 window.addEventListener("appinstalled",()=>{$("installBtn").classList.add("hidden");toast("অ্যাপ ইনস্টল হয়েছে।");});
}
boot();
})();