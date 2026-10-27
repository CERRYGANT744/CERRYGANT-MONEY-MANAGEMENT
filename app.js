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

const DEFAULT_PIN = "1234";
let allEntries = []; 
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

    renderHistory(filtered);
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

// Fixed Due Clear Function: কাস্টমার যত টাকা দিবে তা বর্তমান বাকি থেকে বিয়োগ হয়ে যাবে
window.clearDue = async function(id) {
    const item = allEntries.find(e => e.id === id);
    if (!item) return;

    const currentDue = Number(item.dueAmount || 0);
    const payAmount = prompt(`কাস্টমার (${item.customerName || 'N/A'}) কত টাকা পরিশোধ করছে?\n(বর্তমান মোট বাকি: ৳${currentDue})`, currentDue);
    
    if(payAmount === null) return;

    const paidVal = parseFloat(payAmount) || 0;
    const updatedDue = Math.max(0, currentDue - paidVal);

    try {
        await updateDoc(doc(db, "cerrygant_sales", id), {
            dueAmount: updatedDue
        });
        alert(`বাকি সফলভাবে আপডেট করা হয়েছে! নতুন বাকি: ৳${updatedDue}`);
    } catch(err) {
        alert("এরર: " + err.message);
    }
};

window.deleteEntry = async function(id) {
    if(confirm("আপনি কি নিশ্চিত এই এন্ট্রি মুছে ফেলতে চান?")) {
        await deleteDoc(doc(db, "cerrygant_sales", id));
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

function renderHistory(entries) {
    const list = document.getElementById('historyList');
    const countEl = document.getElementById('entryCount');
    if(countEl) countEl.innerText = `${entries.length} টি এন্ট্রি`;
    
    if(!list) return;

    if(entries.length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">এই পেজে বা তারিখে কোনো বিক্রয় তথ্য পাওয়া যায়নি</div>`;
        return;
    }

    list.innerHTML = entries.map(item => {
        const isProfit = item.profit >= 0;
        const dateFormatted = new Date(item.dateTime).toLocaleString('bn-BD', {
            month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
        });
        const dueVal = Number(item.dueAmount || 0);
        const custName = item.customerName || 'General';

        return `
            <div class="bg-slate-800 border border-slate-700/70 rounded-xl p-3 flex justify-between items-center">
                <div class="space-y-0.5">
                    <div class="font-semibold text-sm text-slate-100">${item.productName} <span class="text-xs text-indigo-400 font-normal">(${custName})</span></div>
                    <div class="text-xs text-slate-400">
                        কেনা: ৳${item.costPrice} | বিক্রি: ৳${item.sellPrice} ${dueVal > 0 ? `| <span class="text-amber-400 font-bold">বাকি: ৳${dueVal}</span>` : ''}
                    </div>
                    <div class="text-[10px] text-slate-500">${dateFormatted}</div>
                </div>
                <div class="text-right flex items-center gap-1.5">
                    <div>
                        <div class="text-xs font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}">
                            ${isProfit ? '+' : ''}৳ ${item.profit}
                        </div>
                        <span class="text-[9px] px-1.5 py-0.5 rounded ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
                            ${isProfit ? 'লাভ' : 'ক্ষতি'}
                        </span>
                    </div>
                    <button onclick="editEntry('${item.id}')" title="সম্পূর্ণ এডিট" class="text-slate-400 hover:text-indigo-400 text-xs p-1">✏️</button>
                    <button onclick="deleteEntry('${item.id}')" title="ডিলিট" class="text-slate-400 hover:text-red-400 text-xs p-1">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderDuePage() {
    const dueListEl = document.getElementById('dueListPage');
    const totalDueCountEl = document.getElementById('totalDueCount');
    if(!dueListEl) return;

    const dueEntries = allEntries.filter(item => Number(item.dueAmount || 0) > 0);
    
    let totalDueSum = dueEntries.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0);
    if(totalDueCountEl) totalDueCountEl.innerText = `৳ ${totalDueSum.toLocaleString('en-IN')} মোট বাকি`;

    if(dueEntries.length === 0) {
        dueListEl.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">এই মুহূর্তে কোনো কাস্টমারের বাকি (due) নেই</div>`;
        return;
    }

    dueListEl.innerHTML = dueEntries.map(item => {
        const dateFormatted = new Date(item.dateTime).toLocaleString('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' });
        return `
            <div class="bg-slate-900 border border-amber-500/30 rounded-xl p-3 flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold text-slate-100">${item.customerName || 'কাস্টমার'} <span class="text-[10px] text-slate-400 font-normal">(${item.productName})</span></div>
                    <div class="text-xs text-amber-400 font-bold mt-0.5">বাকি: ৳${item.dueAmount}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">তারিখ: ${dateFormatted}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="clearDue('${item.id}')" class="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-1 rounded-lg hover:bg-amber-500/30 font-medium">পেমেন্ট/ক্লিয়ার</button>
                    <button onclick="editEntry('${item.id}')" class="bg-slate-800 text-slate-300 text-xs p-1.5 rounded-lg border border-slate-700">✏️</button>
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