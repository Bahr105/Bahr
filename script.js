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
    sections: {}, // إيرادات الأقسام (كاش)
    expenses: [], // المصروفات
    visa: [], // فواتير الفيزا
    credit: [], // المبيعات الآجلة
    totalSectionsCash: 0, // إجمالي إيرادات الأقسام الكاش
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
                console.error('Authentication failed:', resp.error);
                showErrorMessage('فشل المصادقة. يرجى المحاولة مرة أخرى.');
                reject(resp);
            } else {
                console.log('Authentication successful.');
                resolve();
            }
        };

        if (gapi.client.getToken() === null) {
            // Prompt for consent if no token exists
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            // Attempt to refresh token silently
            tokenClient.requestAccessToken({prompt: ''});
        }
    });
}

// --- Google Sheets Data Operations ---
async function loadDataFromSheet(sheetName) {
    if (!gapi.client.getToken()) {
        try {
            await handleAuthClick();
        } catch (error) {
            console.error(`Failed to re-authenticate for ${sheetName}:`, error);
            showErrorMessage(`فشل المصادقة لتحميل البيانات من ${sheetName}. يرجى تسجيل الدخول مرة أخرى.`);
            logout(); // Force logout on auth failure
            return [];
        }
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
        try {
            await handleAuthClick();
        } catch (error) {
            console.error(`Failed to re-authenticate for saving to ${sheetName}:`, error);
            showErrorMessage(`فشل المصادقة لحفظ البيانات في ${sheetName}. يرجى تسجيل الدخول مرة أخرى.`);
            logout(); // Force logout on auth failure
            return false;
        }
    }

    try {
        const range = `${sheetName}!A:Z`;
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: { values: [data] }
        });
        console.log(`تم حفظ البيانات في Google Sheets بنجاح في ورقة ${sheetName}`);
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
    if (usernameSelect) { // Check if element exists
        usernameSelect.innerHTML = '<option value="">اختر المستخدم</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            usernameSelect.appendChild(option);
        });
    }
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
    if (expenseTypeSelect) { // Check if element exists
        expenseTypeSelect.innerHTML = '';
        expenseTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            expenseTypeSelect.appendChild(option);
        });
    }

    // populate section type dropdown
    const sectionTypeSelect = document.getElementById('sectionType');
    if (sectionTypeSelect) { // Check if element exists
        sectionTypeSelect.innerHTML = '';
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionTypeSelect.appendChild(option);
        });
    }

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
    dailyData.totalSectionsCash = 0;
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

    const targetTab = document.getElementById(tabName);
    const targetButton = document.querySelector(`.tab-btn[onclick="openTab('${tabName}')"]`);

    if (targetTab) {
        targetTab.style.display = 'block';
    }
    if (targetButton) {
        targetButton.classList.add('active');
    }

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

    if (expenseForm) {
        expenseForm.style.display = (entryType === 'expense') ? 'block' : 'none';
    }
    if (sectionForm) {
        sectionForm.style.display = (entryType === 'section') ? 'block' : 'none';
    }
    toggleExtraField();
}

function toggleExtraField() {
    const entryType = document.getElementById('entryType').value;
    const expenseTypeSelect = document.getElementById('expenseType');
    const expenseType = expenseTypeSelect ? expenseTypeSelect.value : '';
    const extraFieldContainer = document.getElementById('extraFieldContainer');
    const expenseInvoiceInput = document.getElementById('expenseInvoice');

    if (!extraFieldContainer || !expenseInvoiceInput) return;

    extraFieldContainer.style.display = 'none';
    expenseInvoiceInput.required = true;
    extraFieldContainer.innerHTML = `<label id="extraFieldLabel"></label><input type="text" id="extraField">`; // Reset content

    if (entryType === 'expense') {
        if (expenseType === 'شحن تاب') {
            extraFieldContainer.style.display = 'block';
            document.getElementById('extraFieldLabel').textContent = 'رقم التاب/الفون:';
            expenseInvoiceInput.required = false;
        } else if (expenseType === 'شحن كهربا') {
            extraFieldContainer.style.display = 'block';
            document.getElementById('extraFieldLabel').textContent = 'مكان الشحن:';
            expenseInvoiceInput.required = false;
        } else if (expenseType === 'بنزين') {
            extraFieldContainer.style.display = 'block';
            document.getElementById('extraFieldLabel').textContent = 'اسم المستلم:';
            expenseInvoiceInput.required = false;
        } else if (expenseType === 'أجل') {
            extraFieldContainer.style.display = 'block';
            extraFieldContainer.innerHTML = `
                <label id="extraFieldLabel">اختر العميل:</label>
                <select id="extraFieldCustomerSelect" required></select>
            `;
            populateCustomerSelectForExpense();
            expenseInvoiceInput.required = true;
        } else if (expenseType === 'عجوزات') {
            extraFieldContainer.style.display = 'block';
            document.getElementById('extraFieldLabel').textContent = 'المسؤول عن العجز:';
            expenseInvoiceInput.required = false;
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
        const extraFieldInput = document.getElementById('extraField');
        if (extraFieldInput) {
            extraFieldValue = extraFieldInput.value.trim();
        }
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
            expenseInvoice, // Invoice number for visa
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
            extraFieldValue, // Customer Name
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
            usedVisaNumbers.add(dataToSave[5]); // Store visa number
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

        if (!dailyData.sections[sectionType]) {
            dailyData.sections[sectionType] = [];
        }
        dailyData.sections[sectionType].push(newEntry);
        dailyData.totalSectionsCash += sectionAmount; // Assuming all sections are cash for now
        updateEntriesList();
        updateStats();
        clearSectionForm();
        showSuccessMessage(`تم إضافة إيراد ${sectionType} بنجاح`);
    }
}

// Update Entries List (for expenses & sections tab)
function updateEntriesList() {
    const entriesListContainer = document.getElementById('entriesListContainer');
    if (!entriesListContainer) return; // Handle null element

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
            <button class="btn-danger btn-small" onclick="deleteEntry('${item.displayType}', ${item.id}, '${item.category}', '${item.extraField || ''}')">حذف</button>
        `;
        entriesListContainer.appendChild(itemElement);
    });
}

// Delete Entry Function
function deleteEntry(displayType, id, category, extraField) {
    if (!confirm('هل أنت متأكد من حذف هذا الإدخال؟')) return;

    let itemIndex;
    let amountToRemove = 0;

    if (displayType === 'إيراد قسم') {
        itemIndex = dailyData.sections[category].findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.sections[category][itemIndex].amount;
            dailyData.sections[category].splice(itemIndex, 1);
            dailyData.totalSectionsCash -= amountToRemove;
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
            const visaNum = extraField; // extraField holds visa number
            dailyData.visa.splice(itemIndex, 1);
            dailyData.visaAmount -= amountToRemove;
            usedVisaNumbers.delete(visaNum);
        }
    } else if (displayType === 'آجل') {
        itemIndex = dailyData.credit.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.credit[itemIndex].amount;
            const customerName = extraField; // extraField holds customer name
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
    if (customerForPaymentSelect) { // Check if element exists
        customerForPaymentSelect.innerHTML = '<option value="">اختر العميل</option>';
        
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name;
            option.textContent = customer.name;
            customerForPaymentSelect.appendChild(option);
        });
    }
}

async function addNewCustomer() {
    const newCustomerNameInput = document.getElementById('newCustomerName');
    if (!newCustomerNameInput) return; // Handle null element
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
    const paymentAmountInput = document.getElementById('paymentAmount');
    if (!paymentAmountInput) return; // Handle null element
    const paymentAmount = parseFloat(paymentAmountInput.value);
    
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
        paymentAmountInput.value = '';
        showSuccessMessage(`تم سداد ${paymentAmount} جنيه للعميل ${customerName}`);
    }
}

function updateCustomerCredits() {
    const customerCreditsContainer = document.getElementById('customerCreditsContainer');
    if (!customerCreditsContainer) return; // Handle null element
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
    dailyData.totalSectionsCash = 0;
    for (const section in dailyData.sections) {
        dailyData.totalSectionsCash += dailyData.sections[section].reduce((sum, item) => sum + item.amount, 0);
    }
    dailyData.totalExpenses = dailyData.expenses.reduce((sum, item) => sum + item.amount, 0);
    dailyData.visaAmount = dailyData.visa.reduce((sum, item) => sum + item.amount, 0);
    dailyData.creditAmount = dailyData.credit.reduce((sum, item) => sum + item.amount, 0);
    
    // Update UI
    const totalSectionsElement = document.getElementById('totalSections');
    if (totalSectionsElement) totalSectionsElement.textContent = dailyData.totalSectionsCash.toFixed(2);
    const totalExpensesElement = document.getElementById('totalExpenses');
    if (totalExpensesElement) totalExpensesElement.textContent = dailyData.totalExpenses.toFixed(2);
    const visaAmountElement = document.getElementById('visaAmount');
    if (visaAmountElement) visaAmountElement.textContent = dailyData.visaAmount.toFixed(2);
    const creditAmountElement = document.getElementById('creditAmount');
    if (creditAmountElement) creditAmountElement.textContent = dailyData.creditAmount.toFixed(2);
    
    const summaryTotalSectionsCashElement = document.getElementById('summaryTotalSectionsCash');
    if (summaryTotalSectionsCashElement) summaryTotalSectionsCashElement.textContent = dailyData.totalSectionsCash.toFixed(2);
    const summaryTotalExpensesElement = document.getElementById('summaryTotalExpenses');
    if (summaryTotalExpensesElement) summaryTotalExpensesElement.textContent = dailyData.totalExpenses.toFixed(2);
    const summaryVisaElement = document.getElementById('summaryVisa');
    if (summaryVisaElement) summaryVisaElement.textContent = dailyData.visaAmount.toFixed(2);
    const summaryActualCashElement = document.getElementById('summaryActualCash');
    if (summaryActualCashElement) summaryActualCashElement.textContent = dailyData.drawerAmount.toFixed(2);
    
    // Calculate final total
    // The final total should be (Cash Sections + Drawer Amount) - Expenses
    const finalTotal = (dailyData.totalSectionsCash + dailyData.drawerAmount) - dailyData.totalExpenses;
    const summaryFinalTotalElement = document.getElementById('summaryFinalTotal');
    if (summaryFinalTotalElement) summaryFinalTotalElement.textContent = finalTotal.toFixed(2);
    
    // Update sections summary (Cash only)
    const sectionsSummary = document.getElementById('sectionsSummary');
    if (sectionsSummary) {
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
    }
    
    // Update visa summary
    const visaSummary = document.getElementById('visaSummary');
    if (visaSummary) {
        visaSummary.innerHTML = '';
        if (dailyData.visaAmount > 0) {
            const visaElement = document.createElement('div');
            visaElement.className = 'summary-item';
            visaElement.innerHTML = `<span>إجمالي الفيزا:</span> <span>${dailyData.visaAmount.toFixed(2)} جنيه</span>`;
            visaSummary.appendChild(visaElement);
        }
    }
}

// Calculate Drawer Function
function calculateDrawer() {
    const drawerAmountInput = document.getElementById('drawerAmount');
    if (!drawerAmountInput) return; // Handle null element
    const drawerAmount = parseFloat(drawerAmountInput.value);
    
    if (isNaN(drawerAmount) || drawerAmount < 0) {
        alert('يرجى إدخال مبلغ صحيح للكاش الفعلي في الدرج.');
        return;
    }
    
    dailyData.drawerAmount = drawerAmount;
    updateStats();
    
    const resultMessage = `
        <div class="drawer-result">
            <p><strong>إجمالي إيرادات الأقسام (كاش):</strong> ${dailyData.totalSectionsCash.toFixed(2)} جنيه</p>
            <p><strong>إجمالي المصروفات المدفوعة:</strong> ${dailyData.totalExpenses.toFixed(2)} جنيه</p>
            <p><strong>الكاش الفعلي في الدرج:</strong> ${drawerAmount.toFixed(2)} جنيه</p>
            <p><strong>الإجمالي النهائي (كاش الأقسام + الدرج - المصروفات):</strong> ${(dailyData.totalSectionsCash + drawerAmount - dailyData.totalExpenses).toFixed(2)} جنيه</p>
        </div>
    `;
    
    const drawerResultElement = document.getElementById('drawerResult');
    if (drawerResultElement) drawerResultElement.innerHTML = resultMessage;
}

// Finalize Day Closeout
async function finalizeDayCloseout() {
    if (!confirm('هل أنت متأكد من تقفيل اليوم نهائياً؟ لا يمكن التراجع بعد التقفيل.')) {
        return;
    }
    
    const drawerAmountInput = document.getElementById('drawerAmount');
    if (!drawerAmountInput) {
        alert('يرجى حساب جرد الدرج أولاً.');
        return;
    }
    const drawerAmount = parseFloat(drawerAmountInput.value);
    if (isNaN(drawerAmount)) {
        alert('يرجى حساب جرد الدرج أولاً.');
        return;
    }

    const finalCalculatedTotal = (dailyData.totalSectionsCash + drawerAmount) - dailyData.totalExpenses;

    const finalData = [
        new Date().toLocaleDateString('ar-EG'),
        currentUser,
        dailyData.totalSectionsCash.toFixed(2), // Total Cash Sections
        dailyData.totalExpenses.toFixed(2),
        dailyData.visaAmount.toFixed(2),
        dailyData.creditAmount.toFixed(2),
        drawerAmount.toFixed(2), // Actual Drawer Cash
        finalCalculatedTotal.toFixed(2), // Calculated Final Total
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
    const expenseInvoice = document.getElementById('expenseInvoice');
    if (expenseInvoice) expenseInvoice.value = '';
    const expenseAmount = document.getElementById('expenseAmount');
    if (expenseAmount) expenseAmount.value = '';
    const expenseNotes = document.getElementById('expenseNotes');
    if (expenseNotes) expenseNotes.value = '';
    const extraFieldInput = document.getElementById('extraField');
    if (extraFieldInput) extraFieldInput.value = '';
    const extraFieldCustomerSelect = document.getElementById('extraFieldCustomerSelect');
    if (extraFieldCustomerSelect) extraFieldCustomerSelect.value = '';
}

function clearSectionForm() {
    const sectionInvoice = document.getElementById('sectionInvoice');
    if (sectionInvoice) sectionInvoice.value = '';
    const sectionAmount = document.getElementById('sectionAmount');
    if (sectionAmount) sectionAmount.value = '';
    const sectionNotes = document.getElementById('sectionNotes');
    if (sectionNotes) sectionNotes.value = '';
}

// Reset Daily Data
function resetDailyData() {
    dailyData = {
        sections: {}, expenses: [], visa: [], credit: [],
        totalSectionsCash: 0, totalExpenses: 0, visaAmount: 0, creditAmount: 0,
        drawerAmount: 0,
    };
    usedVisaNumbers.clear();
    initializeDataStructures();
    updateEntriesList();
    updateStats();
    const drawerAmountInput = document.getElementById('drawerAmount');
    if (drawerAmountInput) drawerAmountInput.value = '';
    const drawerResultElement = document.getElementById('drawerResult');
    if (drawerResultElement) drawerResultElement.innerHTML = '';
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

    const targetTab = document.getElementById(tabName);
    const targetButton = document.querySelector(`#accountantDashboardSection .tab-btn[onclick="openAccountantTab('${tabName}')"]`);

    if (targetTab) {
        targetTab.style.display = 'block';
    }
    if (targetButton) {
        targetButton.classList.add('active');
    }

    if (tabName === 'usersTab') {
        loadUsersListForAccountant();
    } else if (tabName === 'reportsTab') {
        populateCashierSelects();
        populateSectionsForReports();
    } else if (tabName === 'closeoutTab') {
        populateCashierSelects();
        const closeoutResults = document.getElementById('closeoutResults');
        if (closeoutResults) closeoutResults.innerHTML = ''; // Clear previous results
    }
}

function populateCashierSelects() {
    const selectCashierForReport = document.getElementById('selectCashierForReport');
    const selectCashierForCloseout = document.getElementById('selectCashierForCloseout');
    
    if (selectCashierForReport) {
        selectCashierForReport.innerHTML = '<option value="">اختر كاشير</option>';
    }
    if (selectCashierForCloseout) {
        selectCashierForCloseout.innerHTML = '<option value="">اختر كاشير</option>';
    }

    users.filter(u => u.role === 'Cashier').forEach(cashier => {
        if (selectCashierForReport) {
            const optionReport = document.createElement('option');
            optionReport.value = cashier.username;
            optionReport.textContent = cashier.username;
            selectCashierForReport.appendChild(optionReport);
        }

        if (selectCashierForCloseout) {
            const optionCloseout = document.createElement('option');
            optionCloseout.value = cashier.username;
            optionCloseout.textContent = cashier.username;
            selectCashierForCloseout.appendChild(optionCloseout);
        }
    });
}

function populateSectionsForReports() {
    const sectionForReport = document.getElementById('sectionForReport');
    if (sectionForReport) { // Check if element exists
        sectionForReport.innerHTML = '<option value="">اختر القسم</option>';
        
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionForReport.appendChild(option);
        });
    }
}

async function loadUsersListForAccountant() {
    const usersListContainer = document.getElementById('usersListContainer');
    if (!usersListContainer) return; // Handle null element
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

async function createNewUser() {
    const newUsernameInput = document.getElementById('newUsername');
    const newPasswordInput = document.getElementById('newUserPassword');
    const newUserRoleSelect = document.getElementById('newUserRole');

    if (!newUsernameInput || !newPasswordInput || !newUserRoleSelect) return; // Handle null elements

    const newUsername = newUsernameInput.value.trim();
    const newPassword = newPasswordInput.value;
    const newUserRole = newUserRoleSelect.value;
    
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
        newUsernameInput.value = '';
        newPasswordInput.value = '';
        showSuccessMessage(`تم إضافة المستخدم ${newUsername} بنجاح`);
    }
}

async function deleteUser(username) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم ${username}؟`)) return;
    
    // In a real implementation, you would need to delete from the sheet
    // This example only removes from the local 'users' array
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex > -1) {
        users.splice(userIndex, 1);
        loadUsersListForAccountant();
        populateCashierSelects();
        showSuccessMessage(`تم حذف المستخدم ${username} بنجاح`);
    }
}

// New functions for generating specific reports
async function generateExpensesReport() {
    const startDate = document.getElementById('expensesReportStartDate').value;
    const endDate = document.getElementById('expensesReportEndDate').value;
    const reportResultElement = document.getElementById('expensesReportResult');

    if (!startDate || !endDate) {
        alert('يرجى تحديد تاريخ البداية والنهاية لتقرير المصروفات.');
        return;
    }

    const expenseData = await loadDataFromSheet('Expenses');
    const filteredData = expenseData.slice(1).filter(row => {
        const rowDate = row[0];
        return rowDate >= startDate && rowDate <= endDate;
    });

    displayReport('تقرير المصروفات', filteredData, 'expenses', reportResultElement);
}

async function generateSectionsReport() {
    const sectionName = document.getElementById('sectionForReport').value;
    const startDate = document.getElementById('sectionsReportStartDate').value;
    const endDate = document.getElementById('sectionsReportEndDate').value;
    const reportResultElement = document.getElementById('sectionsReportResult');

    if (!sectionName) {
        alert('يرجى اختيار القسم لتقرير الأقسام.');
        return;
    }
    if (!startDate || !endDate) {
        alert('يرجى تحديد تاريخ البداية والنهاية لتقرير الأقسام.');
        return;
    }

    const sectionData = await loadDataFromSheet('Sections');
    const filteredData = sectionData.slice(1).filter(row => {
        const rowDate = row[0];
        const rowSection = row[3];
        return rowSection === sectionName && rowDate >= startDate && rowDate <= endDate;
    });

    displayReport(`تقرير قسم ${sectionName}`, filteredData, 'sections', reportResultElement);
}

async function generateCashierReport() {
    const cashierName = document.getElementById('selectCashierForReport').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const reportResultElement = document.getElementById('cashierReportResult');

    if (!cashierName) {
        alert('يرجى اختيار الكاشير لتقرير الكاشير.');
        return;
    }
    if (!startDate || !endDate) {
        alert('يرجى تحديد تاريخ البداية والنهاية لتقرير الكاشير.');
        return;
    }

    const allEntries = [];
    const sectionsData = await loadDataFromSheet('Sections');
    const expensesData = await loadDataFromSheet('Expenses');
    const visaData = await loadDataFromSheet('Visa');
    const creditData = await loadDataFromSheet('Credit');
    const customerPaymentsData = await loadDataFromSheet('CustomerPayments');

    // Filter and add sections
    sectionsData.slice(1).filter(row => {
        const rowDate = row[0];
        const rowCashier = row[2];
        return rowCashier === cashierName && rowDate >= startDate && rowDate <= endDate;
    }).forEach(row => allEntries.push({
        type: 'إيراد قسم',
        category: row[3],
        invoice: row[4],
        amount: parseFloat(row[5]),
        notes: row[6],
        date: row[0],
        time: row[1]
    }));

    // Filter and add expenses
    expensesData.slice(1).filter(row => {
        const rowDate = row[0];
        const rowCashier = row[2];
        return rowCashier === cashierName && rowDate >= startDate && rowDate <= endDate;
    }).forEach(row => allEntries.push({
        type: 'مصروف',
        category: row[3],
        invoice: row[4],
        amount: parseFloat(row[5]),
        notes: row[6],
        extra: row[7],
        date: row[0],
        time: row[1]
    }));

    // Filter and add visa
    visaData.slice(1).filter(row => {
        const rowDate = row[0];
        const rowCashier = row[2];
        return rowCashier === cashierName && rowDate >= startDate && rowDate <= endDate;
    }).forEach(row => allEntries.push({
        type: 'فيزا',
        category: 'فيزا',
        invoice: row[3],
        amount: parseFloat(row[4]),
        notes: `رقم الفيزا: ${row[5]}, ${row[6]}`,
        date: row[0],
        time: row[1]
    }));

    // Filter and add credit sales
    creditData.slice(1).filter(row => {
        const rowDate = row[0];
        const rowCashier = row[2];
        return rowCashier === cashierName && rowDate >= startDate && rowDate <= endDate;
    }).forEach(row => allEntries.push({
        type: 'مبيعات آجلة',
        category: 'آجل',
        invoice: row[3],
        amount: parseFloat(row[4]),
        notes: `العميل: ${row[5]}, ${row[6]}`,
        date: row[0],
        time: row[1]
    }));

    // Filter and add customer payments
    customerPaymentsData.slice(1).filter(row => {
        const rowDate = row[0];
        const rowCashier = row[2];
        return rowCashier === cashierName && rowDate >= startDate && rowDate <= endDate;
    }).forEach(row => allEntries.push({
        type: 'سداد أجل عميل',
        category: 'سداد أجل',
        invoice: 'N/A',
        amount: parseFloat(row[4]),
        notes: `العميل: ${row[3]}, ${row[5]}`,
        date: row[0],
        time: row[1]
    }));

    let html = `<h3>تقرير الكاشير: ${cashierName} من ${startDate} إلى ${endDate}</h3>`;
    if (allEntries.length === 0) {
        html += '<p>لا توجد بيانات لهذا الكاشير في الفترة المحددة.</p>';
    } else {
        html += '<table class="report-table"><thead><tr>';
        html += '<th>التاريخ</th><th>الوقت</th><th>النوع</th><th>القسم/المصروف</th><th>رقم الفاتورة</th><th>المبلغ</th><th>ملاحظات</th>';
        html += '</tr></thead><tbody>';

        let totalIncome = 0;
        let totalExpenses = 0;
        let totalVisa = 0;
        let totalCreditSales = 0;
        let totalCustomerPayments = 0;

        allEntries.sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`));

        allEntries.forEach(entry => {
            html += '<tr>';
            html += `<td>${entry.date}</td><td>${entry.time}</td><td>${entry.type}</td><td>${entry.category}</td><td>${entry.invoice}</td><td>${entry.amount.toFixed(2)}</td><td>${entry.notes || ''}</td>`;
            html += '</tr>';

            if (entry.type === 'إيراد قسم') {
                totalIncome += entry.amount;
            } else if (entry.type === 'مصروف') {
                totalExpenses += entry.amount;
            } else if (entry.type === 'فيزا') {
                totalVisa += entry.amount;
            } else if (entry.type === 'مبيعات آجلة') {
                totalCreditSales += entry.amount;
            } else if (entry.type === 'سداد أجل عميل') {
                totalCustomerPayments += entry.amount;
            }
        });
        html += '</tbody></table>';

        html += `<div class="report-summary mt-20">
            <p><strong>إجمالي إيرادات الأقسام (كاش):</strong> ${totalIncome.toFixed(2)} جنيه</p>
            <p><strong>إجمالي المصروفات:</strong> ${totalExpenses.toFixed(2)} جنيه</p>
            <p><strong>إجمالي مبيعات الفيزا:</strong> ${totalVisa.toFixed(2)} جنيه</p>
            <p><strong>إجمالي المبيعات الآجلة:</strong> ${totalCreditSales.toFixed(2)} جنيه</p>
            <p><strong>إجمالي سداد العملاء الآجلين:</strong> ${totalCustomerPayments.toFixed(2)} جنيه</p>
        </div>`;
    }
    if (reportResultElement) reportResultElement.innerHTML = html;
}


function displayReport(title, data, type, resultElement) {
    if (!resultElement) return; // Handle null element
    let total = 0;
    
    let html = `<h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>لا توجد بيانات في الفترة المحددة.</p>';
    } else {
        html += '<table class="report-table"><thead><tr>';
        
        if (type === 'sections') {
            html += '<th>التاريخ</th><th>الوقت</th><th>الكاشير</th><th>القسم</th><th>رقم الفاتورة</th><th>المبلغ</th><th>ملاحظات</th>';
        } else if (type === 'expenses') {
            html += '<th>التاريخ</th><th>الوقت</th><th>الكاشير</th><th>نوع المصروف</th><th>رقم الفاتورة</th><th>المبلغ</th><th>ملاحظات</th><th>حقل إضافي</th>';
        }
        
        html += '</tr></thead><tbody>';
        
        data.forEach(row => {
            html += '<tr>';
            if (type === 'sections') {
                html += `<td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${parseFloat(row[5]).toFixed(2)}</td><td>${row[6] || ''}</td>`;
                total += parseFloat(row[5]);
            } else if (type === 'expenses') {
                html += `<td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${parseFloat(row[5]).toFixed(2)}</td><td>${row[6] || ''}</td><td>${row[7] || ''}</td>`;
                total += parseFloat(row[5]);
            }
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        html += `<p class="report-total"><strong>الإجمالي: ${total.toFixed(2)} جنيه</strong></p>`;
    }
    
    resultElement.innerHTML = html;
}

async function loadCloseoutData() {
    const cashierName = document.getElementById('selectCashierForCloseout').value;
    const closeoutDate = document.getElementById('closeoutDate').value;
    const closeoutResults = document.getElementById('closeoutResults');
    
    if (!closeoutResults) return; // Handle null element
    closeoutResults.innerHTML = ''; // Clear previous results

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
    if (!closeoutResults) return; // Handle null element
    
    if (data.length === 0) {
        closeoutResults.innerHTML = '<p>لا توجد بيانات تقفيل للكاشير والتاريخ المحددين.</p>';
        return;
    }
    
    const row = data[0];
    let html = `
        <h3>بيانات تقفيل ${row[1]} بتاريخ ${row[0]}</h3>
        <div class="closeout-details">
            <p><strong>إجمالي إيرادات الأقسام (كاش):</strong> ${parseFloat(row[2]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي المصروفات:</strong> ${parseFloat(row[3]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي الفيزا:</strong> ${parseFloat(row[4]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي المبيعات الآجلة:</strong> ${parseFloat(row[5]).toFixed(2)} جنيه</p>
            <p><strong>الكاش الفعلي في الدرج:</strong> ${parseFloat(row[6]).toFixed(2)} جنيه</p>
            <p><strong>الإجمالي النهائي (محسوب):</strong> ${parseFloat(row[7]).toFixed(2)} جنيه</p>
            <p><strong>إجمالي نيو مايند:</strong> ${row[8]}</p>
            <p><strong>الفرق:</strong> ${row[9]}</p>
            <p><strong>حالة التقفيل:</strong> ${row[10]}</p>
            <p><strong>وقت التقفيل:</strong> ${row[11]}</p>
        </div>
    `;
    
    if (row[10] === 'بانتظار المحاسب') {
        html += `
            <div class="closeout-actions mt-20">
                <label for="accountantNewMindTotal">إجمالي نيو مايند:</label>
                <input type="number" id="accountantNewMindTotal" step="0.01" placeholder="أدخل إجمالي التقفيلة من نيو مايند">
                <button class="btn btn-success" onclick="performAccountantCloseout('${row[0]}', '${row[1]}', ${parseFloat(row[7])})">تقفيل الحساب</button>
            </div>
        `;
    }
    
    closeoutResults.innerHTML = html;
}

async function performAccountantCloseout(date, cashier, cashierCalculatedTotal) {
    const accountantNewMindTotalInput = document.getElementById('accountantNewMindTotal');
    if (!accountantNewMindTotalInput) return; // Handle null element
    const accountantNewMindTotal = parseFloat(accountantNewMindTotalInput.value);
    
    if (isNaN(accountantNewMindTotal) || accountantNewMindTotal < 0) {
        alert('يرجى إدخال إجمالي نيو مايند بشكل صحيح.');
        return;
    }

    const difference = accountantNewMindTotal - cashierCalculatedTotal;
    const status = difference === 0 ? 'تم التقفيل' : (difference > 0 ? 'زيادة' : 'عجز');

    // In a real application, you would need to find the specific row in 'DailyCloseout'
    // and update it. This requires more advanced Google Sheets API operations (e.g., `update`).
    // For this example, we'll simulate the update and show a success message.
    
    // Simulate updating the sheet (this part needs actual implementation for real update)
    console.log(`Updating closeout for ${cashier} on ${date}:`);
    console.log(`NewMind Total: ${accountantNewMindTotal}`);
    console.log(`Difference: ${difference}`);
    console.log(`Status: ${status}`);

    showSuccessMessage(`تم تقفيل حساب الكاشير ${cashier} بتاريخ ${date} بنجاح. الفرق: ${difference.toFixed(2)} (${status})`);
    
    // Refresh the closeout data to show the updated status (if implemented)
    loadCloseoutData();
}

async function searchInvoice() {
    const searchInvoiceNumber = document.getElementById('searchInvoiceNumber').value.trim();
    const invoiceSearchResult = document.getElementById('invoiceSearchResult');
    if (!invoiceSearchResult) return; // Handle null element
    invoiceSearchResult.innerHTML = '';

    if (!searchInvoiceNumber) {
        alert('يرجى إدخال رقم الفاتورة للبحث.');
        return;
    }

    let foundEntries = [];

    // Search in Sections
    const sectionsData = await loadDataFromSheet('Sections');
    sectionsData.slice(1).forEach(row => {
        if (row[4] === searchInvoiceNumber) { // Invoice number is at index 4
            foundEntries.push({
                sheet: 'Sections',
                type: 'إيراد قسم',
                date: row[0],
                time: row[1],
                cashier: row[2],
                category: row[3],
                invoice: row[4],
                amount: parseFloat(row[5]),
                notes: row[6]
            });
        }
    });

    // Search in Expenses
    const expensesData = await loadDataFromSheet('Expenses');
    expensesData.slice(1).forEach(row => {
        if (row[4] === searchInvoiceNumber) { // Invoice number is at index 4
            foundEntries.push({
                sheet: 'Expenses',
                type: 'مصروف',
                date: row[0],
                time: row[1],
                cashier: row[2],
                category: row[3],
                invoice: row[4],
                amount: parseFloat(row[5]),
                notes: row[6],
                extraField: row[7]
            });
        }
    });

    // Search in Visa
    const visaData = await loadDataFromSheet('Visa');
    visaData.slice(1).forEach(row => {
        if (row[3] === searchInvoiceNumber) { // Invoice number is at index 3
            foundEntries.push({
                sheet: 'Visa',
                type: 'فيزا',
                date: row[0],
                time: row[1],
                cashier: row[2],
                invoice: row[3],
                amount: parseFloat(row[4]),
                visaNumber: row[5],
                notes: row[6]
            });
        }
    });

    // Search in Credit
    const creditData = await loadDataFromSheet('Credit');
    creditData.slice(1).forEach(row => {
        if (row[3] === searchInvoiceNumber) { // Invoice number is at index 3
            foundEntries.push({
                sheet: 'Credit',
                type: 'مبيعات آجلة',
                date: row[0],
                time: row[1],
                cashier: row[2],
                invoice: row[3],
                amount: parseFloat(row[4]),
                customer: row[5],
                notes: row[6]
            });
        }
    });

    if (foundEntries.length === 0) {
        invoiceSearchResult.innerHTML = '<p>لم يتم العثور على فاتورة بهذا الرقم.</p>';
    } else {
        let html = `<h3>نتائج البحث عن الفاتورة رقم: ${searchInvoiceNumber}</h3>`;
        html += '<table class="report-table"><thead><tr>';
        html += '<th>الورقة</th><th>النوع</th><th>التاريخ</th><th>الوقت</th><th>الكاشير</th><th>القسم/المصروف/العميل</th><th>رقم الفاتورة</th><th>المبلغ</th><th>ملاحظات</th>';
        html += '</tr></thead><tbody>';

        foundEntries.forEach(entry => {
            html += '<tr>';
            html += `<td>${entry.sheet}</td>`;
            html += `<td>${entry.type}</td>`;
            html += `<td>${entry.date}</td>`;
            html += `<td>${entry.time}</td>`;
            html += `<td>${entry.cashier}</td>`;
            html += `<td>${entry.category || entry.customer || entry.visaNumber || ''}</td>`; // Display relevant info
            html += `<td>${entry.invoice}</td>`;
            html += `<td>${entry.amount.toFixed(2)}</td>`;
            html += `<td>${entry.notes || ''}</td>`;
            html += '</tr>';
        });
        html += '</tbody></table>';
        invoiceSearchResult.innerHTML = html;
    }
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
