// --- Google Sheets API Configuration ---
const API_KEY = 'AIzaSyAFKAWVM6Y7V3yxuD7c-9u0e11Ki1z-5VU';
const CLIENT_ID = '514562869133-nuervm5carqqctkqudvqkcolup7s12ve.apps.googleusercontent.com';
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let gapiInited = false;
let gisInited = false;
let tokenClient;

// --- Global Application State ---
let dailyData = {
    sections: {}, // إيرادات الأقسام
    expenses: [], // المصروفات
    visa: [], // فواتير الفيزا
    credit: [], // المبيعات الآجلة
    totalSections: 0,
    totalExpenses: 0,
    visaAmount: 0,
    creditAmount: 0,
    drawerAmount: 0,
};

let users = [];
let sections = [];
let expenseTypes = [];
let customers = [];
let currentUser = '';
let currentUserRole = '';
let selectedCustomer = '';
let usedVisaNumbers = new Set();

// --- Google API Initialization ---
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        loadInitialData();
    }
}

async function handleAuthClick() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                reject(resp);
            } else {
                resolve();
            }
        };

        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    });
}

// --- Google Sheets Data Operations ---
async function loadDataFromSheet(sheetName) {
    if (!gapi.client.getToken()) {
        await handleAuthClick();
    }
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
        });
        return response.result.values || [];
    } catch (err) {
        console.error(`خطأ في تحميل البيانات من ${sheetName}:`, err);
        showErrorMessage(`خطأ في تحميل البيانات من ${sheetName}`);
        return [];
    }
}

async function saveToGoogleSheets(data, sheetName) {
    if (!gapi.client.getToken()) {
        await handleAuthClick();
    }

    try {
        const range = `${sheetName}!A:Z`;
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: { values: [data] }
        });
        console.log(`تم حفظ البيانات في ${sheetName}`);
        return true;
    } catch (err) {
        console.error('خطأ في حفظ البيانات:', err);
        showErrorMessage(`خطأ في حفظ البيانات في ${sheetName}`);
        return false;
    }
}

// --- Initial Data Loading ---
async function loadInitialData() {
    await loadUsers();
    await loadSectionsAndExpenseTypes();
    await loadCustomers();
    populateUserDropdown();
}

async function loadUsers() {
    const userData = await loadDataFromSheet('Users');
    if (userData.length > 1) {
        users = userData.slice(1).map(row => ({
            username: row[0],
            password: row[1],
            role: row[2]
        }));
    } else {
        users = [];
    }
}

function populateUserDropdown() {
    const usernameSelect = document.getElementById('username');
    usernameSelect.innerHTML = '<option value="">اختر المستخدم</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        option.textContent = user.username;
        usernameSelect.appendChild(option);
    });
}

async function loadSectionsAndExpenseTypes() {
    const categoriesData = await loadDataFromSheet('Categories');
    sections = [];
    expenseTypes = [];

    if (categoriesData.length > 1) {
        categoriesData.slice(1).forEach(row => {
            const name = row[0];
            const type = row[1];
            if (name && type) {
                if (type === 'sales' && !sections.includes(name)) {
                    sections.push(name);
                } else if (type === 'expense' && !expenseTypes.includes(name)) {
                    expenseTypes.push(name);
                }
            }
        });
    }
    initializeDataStructures();
    populateDropdowns();
}

function populateDropdowns() {
    // populate expense type dropdown
    const expenseTypeSelect = document.getElementById('expenseType');
    expenseTypeSelect.innerHTML = '';
    expenseTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        expenseTypeSelect.appendChild(option);
    });

    // populate section type dropdown
    const sectionTypeSelect = document.getElementById('sectionType');
    sectionTypeSelect.innerHTML = '';
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        sectionTypeSelect.appendChild(option);
    });

    toggleEntryForm();
}

async function loadCustomers() {
    const customerData = await loadDataFromSheet('Customers');
    customers = [];
    if (customerData.length > 1) {
        customers = customerData.slice(1).map(row => ({
            name: row[0],
            totalCredit: parseFloat(row[1] || 0)
        })).filter(c => c.name);
    }
}

// --- Core Application Logic ---
function initializeDataStructures() {
    dailyData.sections = {};
    sections.forEach(section => {
        if (!dailyData.sections[section]) {
            dailyData.sections[section] = [];
        }
    });
    dailyData.expenses = [];
    dailyData.visa = [];
    dailyData.credit = [];
    dailyData.totalSections = 0;
    dailyData.totalExpenses = 0;
    dailyData.visaAmount = 0;
    dailyData.creditAmount = 0;
    dailyData.drawerAmount = 0;
}

// Login Function
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        alert('يرجى اختيار المستخدم وإدخال كلمة المرور');
        return;
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        currentUser = username;
        currentUserRole = user.role;
        localStorage.setItem('currentUser', currentUser);
        localStorage.setItem('currentUserRole', currentUserRole);

        if (currentUserRole === 'Cashier') {
            showCashierDashboard();
        } else if (currentUserRole === 'Accountant') {
            showAccountantDashboard();
        }
    } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
}

// Logout Function
function logout() {
    document.getElementById('cashierDashboardSection').style.display = 'none';
    document.getElementById('accountantDashboardSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    currentUser = '';
    currentUserRole = '';
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentUserRole');
    resetDailyData();
}

// --- Cashier Dashboard Functions ---
async function showCashierDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('accountantDashboardSection').style.display = 'none';
    document.getElementById('cashierDashboardSection').style.display = 'block';
    document.getElementById('currentUserCashier').textContent = currentUser;
    document.getElementById('currentDateCashier').textContent = new Date().toLocaleDateString('ar-EG');
    
    await loadSectionsAndExpenseTypes();
    await loadCustomers();
    initializeDataStructures();
    loadCustomersForCashier();
    updateEntriesList();
    updateStats();
    openTab('expensesSectionsTab');
}

function openTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.style.display = 'none');

    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`.tab-btn[onclick="openTab('${tabName}')"]`).classList.add('active');

    if (tabName === 'customersTab') {
        loadCustomersForCashier();
        updateCustomerCredits();
    } else if (tabName === 'summaryTab') {
        updateStats();
    } else if (tabName === 'expensesSectionsTab') {
        updateEntriesList();
    }
}

function toggleEntryForm() {
    const entryType = document.getElementById('entryType').value;
    const expenseForm = document.getElementById('expenseForm');
    const sectionForm = document.getElementById('sectionForm');

    if (entryType === 'expense') {
        expenseForm.style.display = 'block';
        sectionForm.style.display = 'none';
    } else {
        expenseForm.style.display = 'none';
        sectionForm.style.display = 'block';
    }
    toggleExtraField();
}

function toggleExtraField() {
    const entryType = document.getElementById('entryType').value;
    const expenseType = document.getElementById('expenseType').value;
    const extraFieldContainer = document.getElementById('extraFieldContainer');
    const extraFieldLabel = document.getElementById('extraFieldLabel');
    const expenseInvoiceInput = document.getElementById('expenseInvoice');

    extraFieldContainer.style.display = 'none';
    expenseInvoiceInput.required = true;

    if (entryType === 'expense') {
        if (expenseType === 'شحن تاب') {
            extraFieldContainer.style.display = 'block';
            extraFieldLabel.textContent = 'رقم التاب/الفون:';
            expenseInvoiceInput.required = false;
        } else if (expenseType === 'شحن كهربا') {
            extraFieldContainer.style.display = 'block';
            extraFieldLabel.textContent = 'مكان الشحن:';
            expenseInvoiceInput.required = false;
        } else if (expenseType === 'بنزين') {
            extraFieldContainer.style.display = 'block';
            extraFieldLabel.textContent = 'اسم المستلم:';
            expenseInvoiceInput.required = false;
        } else if (expenseType === 'أجل') {
            extraFieldContainer.style.display = 'block';
            extraFieldLabel.textContent = 'اختر العميل:';
            extraFieldContainer.innerHTML = `
                <label id="extraFieldLabel">اختر العميل:</label>
                <select id="extraFieldCustomerSelect"></select>
            `;
            populateCustomerSelectForExpense();
            expenseInvoiceInput.required = true;
        } else if (expenseType === 'عجوزات') {
            extraFieldContainer.style.display = 'block';
            extraFieldLabel.textContent = 'المسؤول عن العجز:';
            expenseInvoiceInput.required = false;
        } else {
            extraFieldContainer.innerHTML = `<label id="extraFieldLabel"></label><input type="text" id="extraField">`;
        }
    }
}

function populateCustomerSelectForExpense() {
    const customerSelectElement = document.getElementById('extraFieldCustomerSelect');
    if (customerSelectElement) {
        customerSelectElement.innerHTML = '<option value="">اختر العميل</option>';
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name;
            option.textContent = customer.name;
            customerSelectElement.appendChild(option);
        });
    }
}

// Add Expense Function
async function addExpense() {
    const expenseType = document.getElementById('expenseType').value;
    const expenseInvoice = document.getElementById('expenseInvoice').value.trim();
    const expenseAmount = parseFloat(document.getElementById('expenseAmount').value);
    const expenseNotes = document.getElementById('expenseNotes').value.trim();
    let extraFieldValue = '';

    if (isNaN(expenseAmount) || expenseAmount <= 0) {
        alert('يرجى إدخال قيمة صحيحة للمصروف.');
        return;
    }

    if (expenseType === 'أجل') {
        extraFieldValue = document.getElementById('extraFieldCustomerSelect').value;
        if (!extraFieldValue) {
            alert('يرجى اختيار العميل الآجل.');
            return;
        }
        if (!expenseInvoice) {
            alert('يرجى إدخال رقم الفاتورة للمبيعات الآجلة.');
            return;
        }
    } else if (expenseType === 'شحن تاب' || expenseType === 'شحن كهربا' || expenseType === 'بنزين' || expenseType === 'عجوزات') {
        extraFieldValue = document.getElementById('extraField').value.trim();
        if (!extraFieldValue) {
            alert(`يرجى إدخال ${expenseType === 'شحن تاب' ? 'رقم التاب/الفون' : expenseType === 'شحن كهربا' ? 'مكان الشحن' : expenseType === 'بنزين' ? 'اسم المستلم' : 'المسؤول عن العجز'}.`);
            return;
        }
    } else if (!expenseInvoice && expenseType !== 'فيزا') {
        alert('يرجى إدخال رقم الفاتورة.');
        return;
    }

    let sheetName = 'Expenses';
    let dataToSave = [
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        expenseType,
        expenseInvoice,
        expenseAmount,
        expenseNotes,
        extraFieldValue
    ];

    if (expenseType === 'فيزا') {
        sheetName = 'Visa';
        const visaNumber = prompt('يرجى إدخال آخر 4 أرقام من الفيزا:');
        if (!visaNumber || visaNumber.length !== 4 || !/^\d+$/.test(visaNumber)) {
            alert('يرجى إدخال آخر 4 أرقام من الفيزا بشكل صحيح (4 أرقام فقط).');
            return;
        }
        if (usedVisaNumbers.has(visaNumber)) {
            alert(`رقم الفيزا ${visaNumber} مستخدم بالفعل اليوم!`);
            return;
        }
        dataToSave = [
            new Date().toLocaleDateString('ar-EG'),
            new Date().toLocaleTimeString('ar-EG'),
            currentUser,
            expenseInvoice,
            expenseAmount,
            visaNumber,
            expenseNotes
        ];
    } else if (expenseType === 'أجل') {
        sheetName = 'Credit';
        dataToSave = [
            new Date().toLocaleDateString('ar-EG'),
            new Date().toLocaleTimeString('ar-EG'),
            currentUser,
            expenseInvoice,
            expenseAmount,
            extraFieldValue,
            expenseNotes
        ];
    }

    const success = await saveToGoogleSheets(dataToSave, sheetName);

    if (success) {
        const newEntry = {
            id: Date.now(),
            type: expenseType,
            invoiceNumber: expenseInvoice,
            amount: expenseAmount,
            notes: expenseNotes,
            extraField: extraFieldValue,
            timestamp: new Date().toLocaleString('ar-EG')
        };

        if (expenseType === 'فيزا') {
            dailyData.visa.push(newEntry);
            dailyData.visaAmount += expenseAmount;
            usedVisaNumbers.add(dataToSave[5]);
        } else if (expenseType === 'أجل') {
            dailyData.credit.push(newEntry);
            dailyData.creditAmount += expenseAmount;
            const customerIndex = customers.findIndex(c => c.name === extraFieldValue);
            if (customerIndex > -1) {
                customers[customerIndex].totalCredit += expenseAmount;
            }
        } else {
            dailyData.expenses.push(newEntry);
            dailyData.totalExpenses += expenseAmount;
        }
        
        updateEntriesList();
        updateStats();
        clearExpenseForm();
        showSuccessMessage(`تم إضافة ${expenseType} بنجاح`);
        if (expenseType === 'أجل') {
            updateCustomerCredits();
        }
    }
}

// Add Section Entry Function
async function addSectionEntry() {
    const sectionType = document.getElementById('sectionType').value;
    const sectionInvoice = document.getElementById('sectionInvoice').value.trim();
    const sectionAmount = parseFloat(document.getElementById('sectionAmount').value);
    const sectionNotes = document.getElementById('sectionNotes').value.trim();

    if (!sectionInvoice || isNaN(sectionAmount) || sectionAmount <= 0) {
        alert('يرجى إدخال رقم الفاتورة وقيمة صحيحة');
        return;
    }

    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        sectionType,
        sectionInvoice,
        sectionAmount,
        sectionNotes
    ], 'Sections');

    if (success) {
        const newEntry = {
            id: Date.now(),
            type: sectionType,
            invoiceNumber: sectionInvoice,
            amount: sectionAmount,
            notes: sectionNotes,
            timestamp: new Date().toLocaleString('ar-EG')
        };

        dailyData.sections[sectionType].push(newEntry);
        dailyData.totalSections += sectionAmount;
        updateEntriesList();
        updateStats();
        clearSectionForm();
        showSuccessMessage(`تم إضافة إيراد ${sectionType} بنجاح`);
    }
}

// Update Entries List (for expenses & sections tab)
function updateEntriesList() {
    const entriesListContainer = document.getElementById('entriesListContainer');
    entriesListContainer.innerHTML = '';

    // Combine all entries
    const allEntries = [];
    
    // Add section entries
    for (const section in dailyData.sections) {
        dailyData.sections[section].forEach(entry => {
            allEntries.push({
                ...entry,
                category: section,
                displayType: 'إيراد قسم'
            });
        });
    }
    
    // Add expense entries
    dailyData.expenses.forEach(entry => {
        allEntries.push({
            ...entry,
            category: entry.type,
            displayType: 'مصروف'
        });
    });
    
    // Add visa entries
    dailyData.visa.forEach(entry => {
        allEntries.push({
            ...entry,
            category: 'فيزا',
            displayType: 'فيزا',
            notes: `رقم الفيزا: ${entry.extraField}, ${entry.notes}`
        });
    });
    
    // Add credit entries
    dailyData.credit.forEach(entry => {
        allEntries.push({
            ...entry,
            category: 'آجل',
            displayType: 'آجل',
            notes: `العميل: ${entry.extraField}, ${entry.notes}`
        });
    });

    // Sort by latest first
    allEntries.sort((a, b) => b.id - a.id);

    if (allEntries.length === 0) {
        entriesListContainer.innerHTML = '<p>لا توجد إدخالات مسجلة اليوم.</p>';
        return;
    }

    allEntries.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'invoice-item';
        itemElement.innerHTML = `
            <div>
                <strong>${item.displayType}: ${item.category}</strong>
                ${item.invoiceNumber ? ` (#${item.invoiceNumber})` : ''}: ${item.amount.toFixed(2)} جنيه
                ${item.notes ? `<br><small>ملاحظات: ${item.notes}</small>` : ''}
                <br><small>${item.timestamp}</small>
            </div>
            <button class="btn-danger btn-small" onclick="deleteEntry('${item.displayType}', ${item.id}, '${item.category}')">حذف</button>
        `;
        entriesListContainer.appendChild(itemElement);
    });
}

// Delete Entry Function
function deleteEntry(displayType, id, category) {
    if (!confirm('هل أنت متأكد من حذف هذا الإدخال؟')) return;

    let itemIndex;
    let amountToRemove = 0;

    if (displayType === 'إيراد قسم') {
        itemIndex = dailyData.sections[category].findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.sections[category][itemIndex].amount;
            dailyData.sections[category].splice(itemIndex, 1);
            dailyData.totalSections -= amountToRemove;
        }
    } else if (displayType === 'مصروف') {
        itemIndex = dailyData.expenses.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.expenses[itemIndex].amount;
            dailyData.expenses.splice(itemIndex, 1);
            dailyData.totalExpenses -= amountToRemove;
        }
    } else if (displayType === 'فيزا') {
        itemIndex = dailyData.visa.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.visa[itemIndex].amount;
            const visaNum = dailyData.visa[itemIndex].extraField;
            dailyData.visa.splice(itemIndex, 1);
            dailyData.visaAmount -= amountToRemove;
            usedVisaNumbers.delete(visaNum);
        }
    } else if (displayType === 'آجل') {
        itemIndex = dailyData.credit.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.credit[itemIndex].amount;
            const customerName = dailyData.credit[itemIndex].extraField;
            dailyData.credit.splice(itemIndex, 1);
            dailyData.creditAmount -= amountToRemove;
            const customerIndex = customers.findIndex(c => c.name === customerName);
            if (customerIndex > -1) {
                customers[customerIndex].totalCredit -= amountToRemove;
            }
        }
    }

    updateEntriesList();
    updateStats();
    showSuccessMessage('تم حذف الإدخال بنجاح');
    if (displayType === 'آجل') {
        updateCustomerCredits();
    }
}

// Customer Management Functions
function loadCustomersForCashier() {
    const customerForPaymentSelect = document.getElementById('customerForPayment');
    customerForPaymentSelect.innerHTML = '<option value="">اختر العميل</option>';
    
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.name;
        option.textContent = customer.name;
        customerForPaymentSelect.appendChild(option);
    });
}

async function addNewCustomer() {
    const newCustomerNameInput = document.getElementById('newCustomerName');
    const newCustomerName = newCustomerNameInput.value.trim();
    
    if (!newCustomerName) {
        alert('يرجى إدخال اسم العميل');
        return;
    }
    
    if (customers.some(c => c.name.toLowerCase() === newCustomerName.toLowerCase())) {
        alert('هذا العميل موجود بالفعل');
        return;
    }
    
    const success = await saveToGoogleSheets([newCustomerName, 0], 'Customers');
    if (success) {
        customers.push({ name: newCustomerName, totalCredit: 0 });
        loadCustomersForCashier();
        populateCustomerSelectForExpense();
        updateCustomerCredits();
        newCustomerNameInput.value = '';
        showSuccessMessage(`تم إضافة العميل ${newCustomerName} بنجاح`);
    }
}

async function processCustomerPayment() {
    const customerName = document.getElementById('customerForPayment').value;
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    
    if (!customerName || isNaN(paymentAmount) || paymentAmount <= 0) {
        alert('يرجى اختيار العميل وإدخال مبلغ صحيح');
        return;
    }
    
    const customerIndex = customers.findIndex(c => c.name === customerName);
    if (customerIndex === -1) {
        alert('العميل غير موجود');
        return;
    }
    
    if (paymentAmount > customers[customerIndex].totalCredit) {
        alert('المبلغ المسدد أكبر من الدين المتبقي للعميل');
        return;
    }
    
    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        customerName,
        paymentAmount,
        'سداد دين'
    ], 'CustomerPayments');
    
    if (success) {
        customers[customerIndex].totalCredit -= paymentAmount;
        updateCustomerCredits();
        document.getElementById('paymentAmount').value = '';
        showSuccessMessage(`تم سداد ${paymentAmount} جنيه للعميل ${customerName}`);
    }
}

function updateCustomerCredits() {
    const customerCreditsContainer = document.getElementById('customerCreditsContainer');
    customerCreditsContainer.innerHTML = '';

    if (customers.length === 0) {
        customerCreditsContainer.innerHTML = '<p>لا توجد عملاء آجلين مسجلين.</p>';
        return;
    }

    const customerCreditList = document.createElement('ul');
    customerCreditList.className = 'users-list';
    customers.forEach(customer => {
        if (customer.totalCredit > 0) {
            const listItem = document.createElement('li');
            listItem.className = 'customer-item';
            listItem.innerHTML = `
                <span>${customer.name}</span>
                <span>الرصيد: ${customer.totalCredit.toFixed(2)} جنيه</span>
            `;
            customerCreditList.appendChild(listItem);
        }
    });
    
    if (customerCreditList.children.length === 0) {
        customerCreditsContainer.innerHTML = '<p>لا توجد ديون على العملاء.</p>';
    } else {
        customerCreditsContainer.appendChild(customerCreditList);
    }
}

// Update Statistics
function updateStats() {
    // Recalculate totals
    dailyData.totalSections = 0;
    for (const section in dailyData.sections) {
        dailyData.totalSections += dailyData.sections[section].reduce((sum, item) => sum + item.amount, 0);
    }
    dailyData.totalExpenses = dailyData.expenses.reduce((sum, item) => sum + item.amount, 0);
    dailyData.visaAmount = dailyData.visa.reduce((sum, item) => sum + item.amount, 0);
    dailyData.creditAmount = dailyData.credit.reduce((sum, item) => sum + item.amount, 0);
    
    // Update UI
    document.getElementById('totalSections').textContent = dailyData.totalSections.toFixed(2);
    document.getElementById('totalExpenses').textContent = dailyData.totalExpenses.toFixed(2);
    document.getElementById('visaAmount').textContent = dailyData.visaAmount.toFixed(2);
    document.getElementById('creditAmount').textContent = dailyData.creditAmount.toFixed(2);
    
    document.getElementById('summaryTotalSections').textContent = dailyData.totalSections.toFixed(2);
    document.getElementById('summaryTotalExpenses').textContent = dailyData.totalExpenses.toFixed(2);
    document.getElementById('summaryVisa').textContent = dailyData.visaAmount.toFixed(2);
    document.getElementById('summaryActualCash').textContent = dailyData.drawerAmount.toFixed(2);
    
    // Calculate final total
    const finalTotal = dailyData.totalSections + dailyData.totalExpenses + dailyData.drawerAmount;
    document.getElementById('summaryFinalTotal').textContent = finalTotal.toFixed(2);
    
    // Update sections summary
    const sectionsSummary = document.getElementById('sectionsSummary');
    sectionsSummary.innerHTML = '';
    for (const section in dailyData.sections) {
        const sectionTotal = dailyData.sections[section].reduce((sum, item) => sum + item.amount, 0);
        if (sectionTotal > 0) {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'summary-item';
            sectionElement.innerHTML = `<span>${section}:</span> <span>${sectionTotal.toFixed(2)} جنيه</span>`;
            sectionsSummary.appendChild(sectionElement);
        }
    }
    
    // Update visa summary
    const visaSummary = document.getElementById('visaSummary');
    visaSummary.innerHTML = '';
    if (dailyData.visaAmount > 0) {
        const visaElement = document.createElement('div');
        visaElement.className = 'summary-item';
        visaElement.innerHTML = `<span>إجمالي الفيزا:</span> <span>${dailyData.visaAmount.toFixed(2)} جنيه</span>`;
        visaSummary.appendChild(visaElement);
    }
}

// Calculate Drawer Function
function calculateDrawer() {
    const drawerAmountInput = document.getElementById('drawerAmount');
    const drawerAmount = parseFloat(drawerAmountInput.value);
    
    if (isNaN(drawerAmount) || drawerAmount < 0) {
        alert('يرجى إدخال مبلغ صحيح للكاش الفعلي في الدرج.');
        return;
    }
    
    dailyData.drawerAmount = drawerAmount;
    updateStats();
    
    const resultMessage = `
        <div class="drawer-result">
            <p><strong>إجمالي إيرادات الأقسام:</strong> ${dailyData.totalSections.toFixed(2)} جنيه</p>
            <p><strong>إجمالي المصروفات المدفوعة:</strong> ${dailyData.totalExpenses.toFixed(2)} جنيه</p>
            <p><strong>الكاش الفعلي في الدرج:</strong> ${drawerAmount.toFixed(2)} جنيه</p>
            <p><strong>الإجمالي النهائي:</strong> ${(dailyData.totalSections + dailyData.totalExpenses + drawerAmount).toFixed(2)} جنيه</p>
        </div>
    `;
    
    document.getElementById('drawerResult').innerHTML = resultMessage;
}

// Finalize Day Closeout
async function finalizeDayCloseout() {
    if (!confirm('هل أنت متأكد من تقفيل اليوم نهائياً؟ لا يمكن التراجع بعد التقفيل.')) {
        return;
    }
    
    const drawerAmount = parseFloat(document.getElementById('drawerAmount').value);
    if (isNaN(drawerAmount)) {
        alert('يرجى حساب جرد الدرج أولاً.');
        return;
    }

    const finalTotal = dailyData.totalSections + dailyData.totalExpenses + drawerAmount;

    const finalData = [
        new Date().toLocaleDateString('ar-EG'),
        currentUser,
        dailyData.totalSections.toFixed(2),
        dailyData.totalExpenses.toFixed(2),
        dailyData.visaAmount.toFixed(2),
        dailyData.creditAmount.toFixed(2),
        drawerAmount.toFixed(2),
        finalTotal.toFixed(2),
        'N/A', // NewMind Total (to be filled by accountant)
        'N/A', // Difference with NewMind
        'بانتظار المحاسب',
        new Date().toLocaleString('ar-EG')
    ];
    
    const success = await saveToGoogleSheets(finalData, 'DailyCloseout');
    
    if (success) {
        showSuccessMessage('تم تقفيل اليوم بنجاح! يمكنك الآن الخروج من النظام.');
        resetDailyData();
        logout();
    }
}

// Clear Forms
function clearExpenseForm() {
    document.getElementById('expenseInvoice').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseNotes').value = '';
    const extraFieldInput = document.getElementById('extraField');
    if (extraFieldInput) extraFieldInput.value = '';
    const extraFieldCustomerSelect = document.getElementById('extraFieldCustomerSelect');
    if (extraFieldCustomerSelect) extraFieldCustomerSelect.value = '';
}

function clearSectionForm() {
    document.getElementById('sectionInvoice').value = '';
    document.getElementById('sectionAmount').value = '';
    document.getElementById('sectionNotes').value = '';
}

// Reset Daily Data
function resetDailyData() {
    dailyData = {
        sections: {}, expenses: [], visa: [], credit: [],
        totalSections: 0, totalExpenses: 0, visaAmount: 0, creditAmount: 0,
        drawerAmount: 0,
    };
    usedVisaNumbers.clear();
    initializeDataStructures();
    updateEntriesList();
    updateStats();
    document.getElementById('drawerAmount').value = '';
    document.getElementById('drawerResult').innerHTML = '';
}

// --- Accountant Dashboard Functions ---
async function showAccountantDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('cashierDashboardSection').style.display = 'none';
    document.getElementById('accountantDashboardSection').style.display = 'block';
    document.getElementById('currentUserAccountant').textContent = currentUser;
    document.getElementById('currentDateAccountant').textContent = new Date().toLocaleDateString('ar-EG');

    populateCashierSelects();
    loadUsersListForAccountant();
    populateSectionsForReports();
    openAccountantTab('usersTab');
}

function openAccountantTab(tabName) {
    const tabContents = document.querySelectorAll('#accountantDashboardSection .tab-content');
    tabContents.forEach(content => content.style.display = 'none');

    const tabButtons = document.querySelectorAll('#accountantDashboardSection .tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`#accountantDashboardSection .tab-btn[onclick="openAccountantTab('${tabName}')"]`).classList.add('active');

    if (tabName === 'usersTab') {
        loadUsersListForAccountant();
    } else if (tabName === 'reportsTab') {
        populateCashierSelects();
        populateSectionsForReports();
    } else if (tabName === 'closeoutTab') {
        populateCashierSelects();
    }
}

function populateCashierSelects() {
    const selectCashierForReport = document.getElementById('selectCashierForReport');
    const selectCashierForCloseout = document.getElementById('selectCashierForCloseout');
    
    selectCashierForReport.innerHTML = '<option value="">اختر كاشير</option>';
    selectCashierForCloseout.innerHTML = '<option value="">اختر كاشير</option>';

    users.filter(u => u.role === 'Cashier').forEach(cashier => {
        const optionReport = document.createElement('option');
        optionReport.value = cashier.username;
        optionReport.textContent = cashier.username;
        selectCashierForReport.appendChild(optionReport);

        const optionCloseout = document.createElement('option');
        optionCloseout.value = cashier.username;
        optionCloseout.textContent = cashier.username;
        selectCashierForCloseout.appendChild(optionCloseout);
    });
}

function populateSectionsForReports() {
    const sectionForReport = document.getElementById('sectionForReport');
    sectionForReport.innerHTML = '<option value="">اختر القسم</option>';
    
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        sectionForReport.appendChild(option);
    });
}

async function loadUsersListForAccountant() {
    const usersListContainer = document.getElementById('usersListContainer');
    usersListContainer.innerHTML = '';

    const usersList = document.createElement('ul');
    usersList.className = 'users-list';
    
    users.forEach(user => {
        const listItem = document.createElement('li');
        listItem.className = 'user-item';
        listItem.innerHTML = `
            <span>${user.username}</span>
            <span>${user.role === 'Cashier' ? 'كاشير' : 'محاسب'}</span>
            <button class="btn-danger btn-small" onclick="deleteUser('${user.username}')">حذف</button>
        `;
        usersList.appendChild(listItem);
    });
    
    usersListContainer.appendChild(usersList);
}

async function addNewUser() {
    const newUsername = document.getElementById('newUsername').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const newUserRole = document.getElementById('newUserRole').value;
    
    if (!newUsername || !newPassword || !newUserRole) {
        alert('يرجى إدخال جميع البيانات المطلوبة');
        return;
    }
    
    if (users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
        alert('اسم المستخدم موجود بالفعل');
        return;
    }
    
    const success = await saveToGoogleSheets([newUsername, newPassword, newUserRole], 'Users');
    if (success) {
        users.push({ username: newUsername, password: newPassword, role: newUserRole });
        loadUsersListForAccountant();
        populateCashierSelects();
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        showSuccessMessage(`تم إضافة المستخدم ${newUsername} بنجاح`);
    }
}

async function deleteUser(username) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم ${username}؟`)) return;
    
    // Note: This only removes from the current session, not from Google Sheets
    // In a real implementation, you would need to delete from the sheet
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex > -1) {
        users.splice(userIndex, 1);
        loadUsersListForAccountant();
        populateCashierSelects();
        showSuccessMessage(`تم حذف المستخدم ${username} بنجاح`);
    }
}

async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const cashierName = document.getElementById('selectCashierForReport').value;
    const sectionName = document.getElementById('sectionForReport').value;
    
    if (!startDate || !endDate) {
        alert('يرجى تحديد تاريخ البداية والنهاية');
        return;
    }
    
    let reportTitle = '';
    let reportData = [];
    
    if (reportType === 'sections') {
        if (!sectionName) {
            alert('يرجى اختيار القسم');
            return;
        }
        reportTitle = `تقرير قسم ${sectionName}`;
        // Load section data from Google Sheets and filter by date and section
        const sectionData = await loadDataFromSheet('Sections');
        reportData = sectionData.slice(1).filter(row => {
            const rowDate = row[0];
            const rowSection = row[3];
            const rowCashier = row[2];
            return rowSection === sectionName && 
                   rowDate >= startDate && 
                   rowDate <= endDate &&
                   (!cashierName || rowCashier === cashierName);
        });
    } else if (reportType === 'expenses') {
        reportTitle = 'تقرير المصروفات';
        // Load expense data from Google Sheets and filter by date
        const expenseData = await loadDataFromSheet('Expenses');
        reportData = expenseData.slice(1).filter(row => {
            const rowDate = row[0];
            const rowCashier = row[2];
            return rowDate >= startDate && 
                   rowDate <= endDate &&
                   (!cashierName || rowCashier === cashierName);
        });
    }
    
    displayReport(reportTitle, reportData, reportType);
}

function displayReport(title, data, type) {
    const reportResults = document.getElementById('reportResults');
    let total = 0;
    
    let html = `<h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>لا توجد بيانات في الفترة المحددة.</p>';
    } else {
        html += '<table class="report-table"><thead><tr>';
        
        if (type === 'sections') {
            html += '<th>التاريخ</th><th>الكاشير</th><th>رقم الفاتورة</th><th>المبلغ</th><th>ملاحظات</th>';
        } else if (type === 'expenses') {
            html += '<th>التاريخ</th><th>الكاشير</th><th>نوع المصروف</th><th>رقم الفاتورة</th><th>المبلغ</th><th>ملاحظات</th>';
        }
        
        html += '</tr></thead><tbody>';
        
        data.forEach(row => {
            html += '<tr>';
            if (type === 'sections') {
                html += `<td>${row[0]}</td><td>${row[2]}</td><td>${row[4]}</td><td>${parseFloat(row[5]).toFixed(2)}</td><td>${row[6] || ''}</td>`;
                total += parseFloat(row[5]);
            } else if (type === 'expenses') {
                html += `<td>${row[0]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${parseFloat(row[5]).toFixed(2)}</td><td>${row[6] || ''}</td>`;
                total += parseFloat(row[5]);
            }
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        html += `<p class="report-total"><strong>الإجمالي: ${total.toFixed(2)} جنيه</strong></p>`;
    }
    
    reportResults.innerHTML = html;
}

async function loadCloseoutData() {
    const cashierName = document.getElementById('selectCashierForCloseout').value;
    const closeoutDate = document.getElementById('closeoutDate').value;
    
    if (!cashierName || !closeoutDate) {
        alert('يرجى اختيار الكاشير والتاريخ');
        return;
    }
    
    const closeoutData = await loadDataFromSheet('DailyCloseout');
    const filteredData = closeoutData.slice(1).filter(row => {
        return row[0] === closeoutDate && row[1] === cashierName;
    });
    
    displayCloseoutData(filteredData);
}

function displayCloseoutData(data) {
    const closeoutResults = document.getElementById('closeoutResults');
    
    if (data.length === 0) {
        closeoutResults.innerHTML = '<p>لا توجد بيانات تقفيل للكاشير والتاريخ المحددين.</p>';
        return;
    }
    
    const row = data[0];
    let html = `
        <h3>بيانات تقفيل ${row[1]} بتاريخ ${row[0]}</h3>
        <div class="closeout-details">
            <p><strong>إجمالي إيرادات الأقسام:</strong> ${parseFloat(row[2]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي المصروفات:</strong> ${parseFloat(row[3]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي الفيزا:</strong> ${parseFloat(row[4]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي المبيعات الآجلة:</strong> ${parseFloat(row[5]).toFixed(2)} جنيه</p>
            <p><strong>الكاش الفعلي في الدرج:</strong> ${parseFloat(row[6]).toFixed(2)} جنيه</p>
            <p><strong>الإجمالي النهائي:</strong> ${parseFloat(row[7]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي نيو مايند:</strong> ${row[8]}</p>
            <p><strong>الفرق:</strong> ${row[9]}</p>
            <p><strong>حالة التقفيل:</strong> ${row[10]}</p>
            <p><strong>وقت التقفيل:</strong> ${row[11]}</p>
        </div>
    `;
    
    if (row[10] === 'بانتظار المحاسب') {
        html += `
            <div class="closeout-actions">
                <label for="newmindTotal">إجمالي نيو مايند:</label>
                <input type="number" id="newmindTotal" step="0.01">
                <button class="btn-primary" onclick="finalizeCloseout('${row[0]}', '${row[1]}')">إقفال نهائي</button>
            </div>
        `;
    }
    
    closeoutResults.innerHTML = html;
}

async function finalizeCloseout(date, cashier) {
    const newmindTotal = parseFloat(document.getElementById('newmindTotal').value);
    
    if (isNaN(newmindTotal) || newmindTotal < 0) {
        alert('يرجى إدخال إجمالي نيو مايند بشكل صحيح');
        return;
    }
    
    // In a real implementation, you would update the specific row in Google Sheets
    // For now, we'll just show a success message
    showSuccessMessage(`تم إقفال تقفيل ${cashier} بتاريخ ${date} بنجاح`);
    document.getElementById('closeoutResults').innerHTML += '<p class="success">تم الإقفال النهائي</p>';
}

// --- Utility Functions ---
function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function showErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-message';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// --- Initialize App on Load ---
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('currentUserRole');
    
    if (savedUser && savedRole) {
        currentUser = savedUser;
        currentUserRole = savedRole;
        
        if (currentUserRole === 'Cashier') {
            showCashierDashboard();
        } else if (currentUserRole === 'Accountant') {
            showAccountantDashboard();
        }
    }
});
