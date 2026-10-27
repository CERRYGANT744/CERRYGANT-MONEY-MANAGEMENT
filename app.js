import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkHFWAQ_iuHsmyXv6GQiBaDD7caNditis",
  authDomain: "cerrygant-money-management.firebaseapp.com",
  projectId: "cerrygant-money-management",
  storageBucket: "cerrygant-money-management.firebasestorage.app",
  messagingSenderId: "847213534076",
  appId: "1:847213534076:web:2798d1d24d55ef6365a2f9",
  measurementId: "G-LQ4K5H2HVR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_PIN = "018730";
let allEntries = []; 
let dateNotes = {}; 
let selectedSearchDate = ''; 

function setAutoDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dtInput = document.getElementById('entryDateTime');
    if(dtInput) {
        dtInput.value = now.toISOString().slice(0, 16);
    }
}

window.handleAuth = function(e) {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value;
    if(pin === DEFAULT_PIN) {
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        localStorage.setItem('cerrygant_authenticated', 'true');
        initApp();
    } else {
        document.getElementById('authError').classList.remove('hidden');
    }
};

window.logout = function() {
    localStorage.removeItem('cerrygant_authenticated');
    location.reload();
};

window.switchTab = function(tabName) {
    const salesPage = document.getElementById('salesPage');
    const duePage = document.getElementById('duePage');
    const tabSalesBtn = document.getElementById('tabSalesBtn');
    const tabDueBtn = document.getElementById('tabDueBtn');

    if(tabName === 'sales') {
        salesPage.classList.remove('hidden');
        duePage.classList.add('hidden');
        tabSalesBtn.className = "py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition";
        tabDueBtn.className = "py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition";
    } else {
        salesPage.classList.add('hidden');
        duePage.classList.remove('hidden');
        tabDueBtn.className = "py-2 text-xs font-bold rounded-lg bg-amber-600 text-white transition";
        tabSalesBtn.className = "py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition";
        renderDuePage();
    }
};

function initApp() {
    setAutoDateTime();
    
    onSnapshot(collection(db, "cerrygant_sales"), (snapshot) => {
        allEntries = [];
        let totalSalesVal = 0;
        let totalNetProfitVal = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allEntries.push({ id: docSnap.id, ...data });
            totalSalesVal += Number(data.sellPrice || 0);
            totalNetProfitVal += Number(data.profit || 0);
        });

        allEntries.sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime));

        renderFilteredHistory();
        renderDuePage();
        updateSummary(totalSalesVal, totalNetProfitVal);
    }, (error) => {
        console.error("Firestore Error: ", error);
    });

    onSnapshot(collection(db, "cerrygant_notes"), (snapshot) => {
        dateNotes = {};
        snapshot.forEach((docSnap) => {
            dateNotes[docSnap.id] = docSnap.data().noteText || '';
        });
        renderFilteredHistory();
    });

    onSnapshot(doc(db, "cerrygant_meta", "investment"), (docSnap) => {
        if (docSnap.exists()) {
            const amt = docSnap.data().amount || 0;
            const disp = document.getElementById('investmentDisplay');
            if(disp) disp.innerText = `৳ ${Number(amt).toLocaleString('en-IN')}`;
        }
    });
}

window.calculatePreview = function() {
    const cost = parseFloat(document.getElementById('costPrice').value) || 0;
    const sell = parseFloat(document.getElementById('sellPrice').value) || 0;
    const profit = sell - cost;

    const previewBox = document.getElementById('previewBox');
    const previewVal = document.getElementById('previewValue');

    if(cost > 0 || sell > 0) {
        previewBox.classList.remove('hidden');
        if(profit >= 0) {
            previewBox.className = "p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium flex justify-between items-center";
            previewVal.innerText = `+৳ ${profit.toLocaleString('en-IN')} (লাভ)`;
        } else {
            previewBox.className = "p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium flex justify-between items-center";
            previewVal.innerText = `-৳ ${Math.abs(profit).toLocaleString('en-IN')} (ক্ষতি)`;
        }
    } else {
        previewBox.classList.add('hidden');
    }
};

window.handleAddEntry = async function(e) {
    e.preventDefault();
    const dateTime = document.getElementById('entryDateTime').value;
    const productName = document.getElementById('productName').value;
    const customerName = document.getElementById('customerName').value || 'General';
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const sellPrice = parseFloat(document.getElementById('sellPrice').value) || 0;
    const dueAmount = parseFloat(document.getElementById('dueAmount').value) || 0;
    const profit = sellPrice - costPrice;

    try {
        await addDoc(collection(db, "cerrygant_sales"), {
            dateTime,
            productName,
            customerName,
            customerNote: '', 
            costPrice,
            sellPrice,
            dueAmount,
            profit,
            createdAt: new Date()
        });
        
        document.getElementById('entryForm').reset();
        document.getElementById('previewBox').classList.add('hidden');
        setAutoDateTime();
        alert("সেলস এন্ট্রি সফলভাবে সেভ হয়েছে!");
    } catch (err) {
        alert("ডাটা সেভ করতে সমস্যা হয়েছে: " + err.message);
    }
};

window.filterBySpecificDate = function(val) {
    selectedSearchDate = val; 
    const clearBtn = document.getElementById('clearDateBtn');
    if(clearBtn) clearBtn.classList.remove('hidden');
    renderFilteredHistory();
};

window.clearDateFilter = function() {
    selectedSearchDate = '';
    const dateInput = document.getElementById('specificDateFilter');
    if(dateInput) dateInput.value = '';
    const clearBtn = document.getElementById('clearDateBtn');
    if(clearBtn) clearBtn.classList.add('hidden');
    renderFilteredHistory();
};

function renderFilteredHistory() {
    let filtered = allEntries.filter(item => {
        if (!item.dateTime) return false;
        const itemDateStr = item.dateTime.split('T')[0];
        if (selectedSearchDate) {
            return itemDateStr === selectedSearchDate;
        }
        return true;
    });

    renderDateGroupedHistory(filtered);
}

window.editEntry = async function(id) {
    const item = allEntries.find(e => e.id === id);
    if (!item) return;

    const newName = prompt("পণ্যের নতুন নাম দিন:", item.productName);
    if (newName === null) return;

    const newCust = prompt("কাস্টমারের নাম দিন:", item.customerName || '');
    if (newCust === null) return;

    const newCost = prompt("কেনা দাম (৳):", item.costPrice);
    if (newCost === null) return;

    const newSell = prompt("বিক্রি দাম (৳):", item.sellPrice);
    if (newSell === null) return;

    const newDue = prompt("বাকি বা Due (৳):", item.dueAmount || 0);
    if (newDue === null) return;

    const costVal = parseFloat(newCost) || 0;
    const sellVal = parseFloat(newSell) || 0;
    const dueVal = parseFloat(newDue) || 0;
    const profitVal = sellVal - costVal;

    try {
        await updateDoc(doc(db, "cerrygant_sales", id), {
            productName: newName,
            customerName: newCust,
            costPrice: costVal,
            sellPrice: sellVal,
            dueAmount: dueVal,
            profit: profitVal
        });
        alert("সফলভাবে আপডেট করা হয়েছে!");
    } catch (err) {
        alert("আপডেট করতে সমস্যা হয়েছে: " + err.message);
    }
};

// Due Update Function: Baki 0 korle Firestore-e dueAmount: 0 hobe.
// Total entry delete hobe na, tai Sales Page-e record thakbe, shudhu Due Page theke 0 hobar karone hide hoye jabe.
window.updateDueAmount = async function(id) {
    const item = allEntries.find(e => e.id === id);
    if (!item) return;

    const newDueInput = prompt(`কাস্টমার (${item.customerName || 'N/A'})-এর নতুন বাকি অ্যামাউন্ট দিন:`, item.dueAmount || 0);
    if(newDueInput === null) return;

    const updatedDue = parseFloat(newDueInput) || 0;

    try {
        await updateDoc(doc(db, "cerrygant_sales", id), {
            dueAmount: updatedDue
        });
        alert(updatedDue === 0 ? "বাকি ০ টাকা হয়েছে এবং বাকির খাতা থেকে রিমুভ করা হয়েছে! (সেলস পেজে হিস্ট্রি থাকবে)" : "বাকি সফলভাবে আপডেট করা হয়েছে!");
        renderDuePage();
    } catch(err) {
        alert("এরর: " + err.message);
    }
};

window.saveCustomerNote = async function(id) {
    const noteEl = document.getElementById(`custNote_${id}`);
    if(!noteEl) return;
    const customerNote = noteEl.value;

    try {
        await updateDoc(doc(db, "cerrygant_sales", id), { customerNote });
        alert("কাস্টমার নোট সেভ হয়েছে!");
    } catch(err) {
        alert("নোট সেভ করতে সমস্যা হয়েছে: " + err.message);
    }
};

// Pure Delete function (Sales page & Firestore theke pura entry delete korar jonno)
window.deleteEntry = async function(id) {
    if(confirm("আপনি কি নিশ্চিত এই এন্ট্রি সম্পূর্ণ মুছে ফেলতে চান? (সেলস ও ডিউ উভয় জায়গা থেকে মুছে যাবে)")) {
        await deleteDoc(doc(db, "cerrygant_sales", id));
    }
};

window.saveDateNote = async function(dateStr) {
    const noteInput = document.getElementById(`noteInput_${dateStr}`);
    if(!noteInput) return;
    const noteText = noteInput.value;

    try {
        await setDoc(doc(db, "cerrygant_notes", dateStr), { noteText });
        alert("নোট সফলভাবে সেভ হয়েছে!");
    } catch(err) {
        alert("নোট সেভ করতে সমস্যা হয়েছে: " + err.message);
    }
};

window.toggleEditInvestment = function() {
    document.getElementById('investmentEditForm').classList.toggle('hidden');
};

window.saveInvestment = async function() {
    const amount = parseFloat(document.getElementById('newInvestmentInput').value) || 0;
    await setDoc(doc(db, "cerrygant_meta", "investment"), { amount });
    document.getElementById('investmentEditForm').classList.add('hidden');
};

function renderDateGroupedHistory(entries) {
    const list = document.getElementById('historyList');
    const countEl = document.getElementById('entryCount');
    if(countEl) countEl.innerText = `${entries.length} টি এন্ট্রি`;
    
    if(!list) return;

    if(entries.length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">কোনো বিক্রয় তথ্য পাওয়া যায়নি</div>`;
        return;
    }

    let grouped = {};
    entries.forEach(item => {
        const dateStr = item.dateTime ? item.dateTime.split('T')[0] : 'Unknown';
        if(!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(item);
    });

    let html = '';
    for(let dateStr in grouped) {
        let dayItems = grouped[dateStr];
        let daySell = dayItems.reduce((sum, i) => sum + Number(i.sellPrice || 0), 0);
        let dayProfit = dayItems.reduce((sum, i) => sum + Number(i.profit || 0), 0);
        let dayDue = dayItems.reduce((sum, i) => sum + Number(i.dueAmount || 0), 0);
        let currentNote = dateNotes[dateStr] || '';

        let formattedDateHeader = new Date(dateStr).toLocaleDateString('bn-BD', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        html += `
            <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-md space-y-3">
                <div class="border-b border-slate-700 pb-2.5 flex flex-col gap-1.5">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-indigo-400"><i class="fa-solid fa-calendar-day mr-1"></i> ${formattedDateHeader}</span>
                        <span class="text-[10px] text-slate-400">${dayItems.length} টি আইটেম</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 bg-slate-900/60 p-2 rounded-xl text-center">
                        <div>
                            <span class="text-[10px] text-slate-400 block">সেলস</span>
                            <span class="text-xs font-bold text-slate-100">৳${daySell.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 block">লাভ</span>
                            <span class="text-xs font-bold ${dayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">৳${dayProfit.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 block">বাকি</span>
                            <span class="text-xs font-bold text-amber-400">৳${dayDue.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-2">
                    ${dayItems.map(item => {
                        const isProfit = item.profit >= 0;
                        const timeStr = new Date(item.dateTime).toLocaleTimeString('bn-BD', {hour: '2-digit', minute:'2-digit'});
                        const dueVal = Number(item.dueAmount || 0);
                        const custName = item.customerName || 'General';

                        return `
                            <div class="bg-slate-900/90 border border-slate-700/60 rounded-xl p-2.5 flex justify-between items-center text-xs">
                                <div class="space-y-0.5">
                                    <div class="font-semibold text-slate-200">${item.productName} <span class="text-indigo-300 font-normal">(${custName})</span></div>
                                    <div class="text-[11px] text-slate-400">
                                        কেনা: ৳${item.costPrice} | বিক্রি: ৳${item.sellPrice} ${dueVal > 0 ? `| <span class="text-amber-400 font-bold">বাকি: ৳${dueVal}</span>` : ''}
                                    </div>
                                    <div class="text-[9px] text-slate-500">${timeStr}</div>
                                </div>
                                <div class="text-right flex items-center gap-1.5">
                                    <div>
                                        <div class="font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}">
                                            ${isProfit ? '+' : ''}৳ ${item.profit}
                                        </div>
                                    </div>
                                    <button onclick="editEntry('${item.id}')" title="এডিট" class="text-slate-400 hover:text-indigo-400 p-1">✏️</button>
                                    <button onclick="deleteEntry('${item.id}')" title="ডিলিট" class="text-slate-400 hover:text-red-400 p-1">🗑️</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="pt-2 border-t border-slate-700/60">
                    <div class="flex gap-2 items-center">
                        <input type="text" id="noteInput_${dateStr}" value="${currentNote}" placeholder="এই তারিখের জন্য নোট লিখুন..." class="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full focus:outline-none focus:border-indigo-500">
                        <button onclick="saveDateNote('${dateStr}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">নোট সেভ</button>
                    </div>
                </div>
            </div>
        `;
    }

    list.innerHTML = html;
}

function renderDuePage() {
    const dueListEl = document.getElementById('dueListPage');
    const totalDueCountEl = document.getElementById('totalDueCount');
    if(!dueListEl) return;

    // Shudhu je entry-gulo te dueAmount > 0 thakbe shegulo Due Page-e dekhabe
    const dueEntries = allEntries.filter(item => Number(item.dueAmount || 0) > 0);
    
    let totalDueSum = dueEntries.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0);
    if(totalDueCountEl) totalDueCountEl.innerText = `৳ ${totalDueSum.toLocaleString('en-IN')} মোট বাকি`;

    if(dueEntries.length === 0) {
        dueListEl.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">এই মুহূর্তে কোনো কাস্টমারের বাকি (due) নেই</div>`;
        return;
    }

    dueListEl.innerHTML = dueEntries.map(item => {
        const dateFormatted = new Date(item.dateTime).toLocaleString('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' });
        const custNote = item.customerNote || '';

        return `
            <div class="bg-slate-900 border border-amber-500/30 rounded-xl p-3 space-y-2.5">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-xs font-bold text-slate-100">${item.customerName || 'কাস্টমার'} <span class="text-[10px] text-slate-400 font-normal">(${item.productName})</span></div>
                        <div class="text-sm text-amber-400 font-bold mt-0.5">বাকি: ৳${item.dueAmount}</div>
                        <div class="text-[10px] text-slate-500 mt-0.5">তারিখ: ${dateFormatted}</div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="updateDueAmount('${item.id}')" class="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-1 rounded-lg hover:bg-amber-500/30 font-medium">বাকি পরিবর্তন/০</button>
                        <button onclick="deleteEntry('${item.id}')" title="ডিলিট" class="bg-red-500/20 text-red-400 border border-red-500/30 text-xs p-1.5 rounded-lg">🗑️</button>
                    </div>
                </div>
                <div class="flex gap-2 items-center pt-2 border-t border-slate-800">
                    <input type="text" id="custNote_${item.id}" value="${custNote}" placeholder="এই কাস্টমার সম্পর্কে নোট লিখুন..." class="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 w-full focus:outline-none focus:border-amber-500">
                    <button onclick="saveCustomerNote('${item.id}')" class="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs px-2.5 py-1 rounded-lg whitespace-nowrap">নোট সেভ</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateSummary(sales, profit) {
    const salesEl = document.getElementById('totalSales');
    if(salesEl) salesEl.innerText = `৳ ${sales.toLocaleString('en-IN')}`;
    
    const profitEl = document.getElementById('totalProfitLoss');
    if(profitEl) {
        profitEl.innerText = `${profit >= 0 ? '+' : ''}৳ ${profit.toLocaleString('en-IN')}`;
        profitEl.className = `text-xl font-bold mt-1 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
    }
}

if(localStorage.getItem('cerrygant_authenticated') === 'true') {
    const authModal = document.getElementById('authModal');
    const mainApp = document.getElementById('mainApp');
    if(authModal) authModal.classList.add('hidden');
    if(mainApp) mainApp.classList.remove('hidden');
    initApp();
}