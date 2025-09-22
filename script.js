// --- Google Sheets API Configuration ---
const API_KEY = 'AIzaSyAFKAWVM6Y7V3yxuD7c-9u0e11Ki1z-5VU'; // Replace with your actual API Key
const CLIENT_ID = '514562869133-nuervm5carqqctkqudvqkcolup7s12ve.apps.googleusercontent.com'; // Replace with your actual Client ID
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q'; // Replace with your actual Spreadsheet ID
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'; // Full read/write access

let gapiInited = false;
let gisInited = false;
let tokenClient;

// --- Global Application State ---
let dailyData = {
    sales: {}, // المبيعات
    expenses: {}, // المصروفات
    visa: [], // فواتير الفيزا
    credit: [], // المبيعات الآجلة
    exchanges: [], // عمليات البدل
    totalSales: 0,
    totalExpenses: 0,
    visaAmount: 0,
    creditAmount: 0,
    drawerAmount: 0,
    exchangeExpenses: 0 // مصروفات البدل (الفلوس اللي اتدفعت للعميل)
};

let users = []; // Loaded from Google Sheets
let salesSections = []; // Loaded from Google Sheets
let expenseSections = []; // Loaded from Google Sheets
let customers = []; // Loaded from Google Sheets
let currentUser = '';
let currentUserRole = '';
let selectedCustomer = '';
let usedVisaNumbers = new Set(); // To track unique visa numbers for the day

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
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        // All Google APIs are loaded, proceed with initial data loading
        loadInitialData();
    }
}

async function handleAuthClick() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                console.error('Authentication failed:', resp);
                reject(resp);
            } else {
                console.log('Authentication successful.');
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

// Helper function to load data from a specific sheet
async function loadDataFromSheet(sheetName) {
    if (!gapi.client.getToken()) {
        await handleAuthClick(); // Request token if not available
    }
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
        });
        return response.result.values || [];
    } catch (err) {
        console.error(`Error loading data from ${sheetName}:`, err);
        showErrorMessage(`خطأ في تحميل البيانات من ${sheetName}. يرجى التحقق من الاتصال والاذونات.`);
        return [];
    }
}

// Save data to Google Sheets
async function saveToGoogleSheets(data, sheetName) {
    if (!gapi.client.getToken()) {
        await handleAuthClick();
    }

    try {
        const range = `${sheetName}!A:Z`;
        
        // Append data to the sheet
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: [data]
            }
        });
        
        console.log(`تم حفظ البيانات في Google Sheets بنجاح في ورقة ${sheetName}`);
        return true;
    } catch (err) {
        console.error('خطأ في حفظ البيانات:', err);
        showErrorMessage(`خطأ في حفظ البيانات في ${sheetName}. يرجى التحقق من الاتصال والاذونات.`);
        // Optionally save to local storage for retry
        // saveToLocalStorage(data, sheetName);
        return false;
    }
}

// --- Initial Data Loading on Page Load ---
async function loadInitialData() {
    await loadUsers();
    await loadSectionsFromSheets();
    await loadCustomersFromSheets();
    populateUserDropdown();
}

// Load Users from Google Sheets
async function loadUsers() {
    const userData = await loadDataFromSheet('Users');
    if (userData.length > 1) { // Skip header row
        users = userData.slice(1).map(row => ({
            username: row[0],
            password: row[1],
            role: row[2]
        }));
    } else {
        console.warn('No user data found in Google Sheet "Users".');
        users = []; // Ensure users array is empty if no data
    }
}

// Populate the username dropdown in the login form
function populateUserDropdown() {
    const usernameSelect = document.getElementById('username');
    usernameSelect.innerHTML = '<option value="">اختر المستخدم</option>'; // Reset options
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        option.textContent = user.username;
        usernameSelect.appendChild(option);
    });
}

// Load Sales and Expense Sections from Google Sheets
async function loadSectionsFromSheets() {
    const sectionsData = await loadDataFromSheet('Sections');
    salesSections = [];
    expenseSections = [];

    if (sectionsData.length > 1) { // Skip header row
        sectionsData.slice(1).forEach(row => {
            const sectionName = row[0]; // Assuming section name is in the 1st column
            const sectionType = row[1]; // Assuming section type is in the 2nd column
            if (sectionName && sectionType) {
                if (sectionType === 'sales' && !salesSections.includes(sectionName)) {
                    salesSections.push(sectionName);
                } else if (sectionType === 'expenses' && !expenseSections.includes(sectionName)) {
                    expenseSections.push(sectionName);
                }
            }
        });
    } else {
        console.warn('No section data found in Google Sheet "Sections".');
    }
    initializeDataStructures(); // Re-initialize dailyData with loaded sections
}

// Load Customers from Google Sheets
async function loadCustomersFromSheets() {
    const customerData = await loadDataFromSheet('Customers');
    customers = [];
    if (customerData.length > 1) { // Skip header row
        customers = customerData.slice(1).map(row => row[0]).filter(name => name); // Assuming customer name is in the first column
    } else {
        console.warn('No customer data found in Google Sheet "Customers".');
    }
}

// --- Core Application Logic ---

// Initialize data structures for daily operations
function initializeDataStructures() {
    dailyData.sales = {};
    dailyData.expenses = {};

    salesSections.forEach(section => {
        if (!dailyData.sales[section]) {
            dailyData.sales[section] = [];
        }
    });

    expenseSections.forEach(section => {
        if (!dailyData.expenses[section]) {
            dailyData.expenses[section] = [];
        }
    });
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
    resetDailyData(); // Clear all daily data on logout
}

// --- Cashier Dashboard Functions ---

async function showCashierDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('accountantDashboardSection').style.display = 'none';
    document.getElementById('cashierDashboardSection').style.display = 'block';
    document.getElementById('currentUserCashier').textContent = currentUser;
    document.getElementById('currentDateCashier').textContent = new Date().toLocaleDateString('ar-EG');
    
    // Reload sections and customers in case they were updated by accountant
    await loadSectionsFromSheets();
    await loadCustomersFromSheets();
    initializeDataStructures();
    loadCustomers();
    loadSections();
    updateStats();
}

// Add New Section (available to cashier, but accountant can manage/delete)
async function addNewSection() {
    const sectionName = document.getElementById('newSectionName').value.trim();
    const sectionType = document.querySelector('input[name="sectionType"]:checked').value;
    
    if (!sectionName) {
        alert('يرجى إدخال اسم القسم');
        return;
    }
    
    if (salesSections.includes(sectionName) || expenseSections.includes(sectionName)) {
        alert('هذا القسم موجود بالفعل');
        return;
    }

    const success = await saveToGoogleSheets([sectionName, sectionType, currentUser, new Date().toLocaleDateString('ar-EG')], 'Sections');
    if (success) {
        if (sectionType === 'sales') {
            salesSections.push(sectionName);
            dailyData.sales[sectionName] = [];
            createSalesSection(sectionName);
        } else {
            expenseSections.push(sectionName);
            dailyData.expenses[sectionName] = [];
            createExpenseSection(sectionName);
        }
        document.getElementById('newSectionName').value = '';
        showSuccessMessage(`تم إضافة قسم ${sectionName} بنجاح`);
    }
}

// Search Sections
function searchSections() {
    const searchTerm = document.getElementById('sectionSearch').value.toLowerCase();
    
    const salesContainer = document.getElementById('salesSectionsContainer');
    salesContainer.querySelectorAll('.section-card').forEach(section => {
        const sectionName = section.querySelector('h4').textContent.toLowerCase();
        section.style.display = sectionName.includes(searchTerm) ? 'block' : 'none';
    });
    
    const expenseContainer = document.getElementById('expenseSectionsContainer');
    expenseContainer.querySelectorAll('.section-card').forEach(section => {
        const sectionName = section.querySelector('h4').textContent.toLowerCase();
        section.style.display = sectionName.includes(searchTerm) ? 'block' : 'none';
    });
}

// Load Sections into Dashboard
function loadSections() {
    const salesContainer = document.getElementById('salesSectionsContainer');
    salesContainer.innerHTML = '';
    salesSections.forEach(section => createSalesSection(section));
    
    const expenseContainer = document.getElementById('expenseSectionsContainer');
    expenseContainer.innerHTML = '';
    expenseSections.forEach(section => createExpenseSection(section));
}

// Create Sales Section UI
function createSalesSection(section) {
    const container = document.getElementById('salesSectionsContainer');
    const sectionCard = document.createElement('div');
    sectionCard.className = 'section-card';
    sectionCard.innerHTML = `
        <h4>${section}</h4>
        <div class="section-stats">
            <small>عدد الفواتير: <span id="${section}-count">0</span></small>
            <small>الإجمالي: <span id="${section}-total">0</span> جنيه</small>
        </div>
        <div class="invoice-form">
            <input type="text" placeholder="رقم الفاتورة" id="${section}-invoice" required>
            <input type="number" placeholder="القيمة" id="${section}-amount" step="0.01" required>
            <input type="text" placeholder="ملاحظات (اختياري)" id="${section}-notes">
            <button onclick="addSale('${section}')">إضافة فاتورة</button>
        </div>
        <div class="invoice-list" id="${section}-list"></div>
    `;
    container.appendChild(sectionCard);
    updateSaleDisplay(section);
}

// Create Expense Section UI
function createExpenseSection(section) {
    const container = document.getElementById('expenseSectionsContainer');
    const sectionCard = document.createElement('div');
    sectionCard.className = 'section-card';
    let extraInput = '';
    let placeholderText = `ملاحظات (اختياري)`;

    // Special handling for specific expense types
    if (section === 'شحن_تاب') {
        extraInput = `<input type="text" placeholder="رقم التاب/الفون" id="${section}-extra" required>`;
        placeholderText = `ملاحظات (اختياري)`;
    } else if (section === 'شحن_كهربا') {
        extraInput = `<input type="text" placeholder="مكان الشحن" id="${section}-extra" required>`;
        placeholderText = `ملاحظات (اختياري)`;
    } else if (section === 'بنزين') {
        extraInput = `<input type="text" placeholder="اسم المستلم" id="${section}-extra" required>`;
        placeholderText = `ملاحظات (اختياري)`;
    } else if (section === 'عجوزات') {
        extraInput = `<input type="text" placeholder="المسؤول عن العجز" id="${section}-extra" required>`;
        placeholderText = `سبب العجز (اختياري)`;
    }

    sectionCard.innerHTML = `
        <h4>${section}</h4>
        <div class="section-stats">
            <small>عدد العمليات: <span id="${section}-count">0</span></small>
            <small>الإجمالي: <span id="${section}-total">0</span> جنيه</small>
        </div>
        <div class="invoice-form">
            ${extraInput}
            <input type="number" placeholder="المبلغ" id="${section}-amount" step="0.01" required>
            <input type="text" placeholder="${placeholderText}" id="${section}-notes">
            <button onclick="addExpense('${section}')">إضافة ${section}</button>
        </div>
        <div class="invoice-list" id="${section}-list"></div>
    `;
    container.appendChild(sectionCard);
    updateExpenseDisplay(section);
}

// Add Sale Function
async function addSale(section) {
    const invoiceNumber = document.getElementById(section + '-invoice').value.trim();
    const amount = parseFloat(document.getElementById(section + '-amount').value);
    const notes = document.getElementById(section + '-notes').value.trim();
    
    if (!invoiceNumber || isNaN(amount) || amount <= 0) {
        alert('يرجى إدخال رقم الفاتورة وقيمة صحيحة');
        return;
    }
    
    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        section,
        invoiceNumber,
        amount,
        notes
    ], 'Sales');

    if (success) {
        let sale = { id: Date.now(), invoiceNumber, amount, notes, timestamp: new Date().toLocaleString('ar-EG') };
        dailyData.sales[section].push(sale);
        dailyData.totalSales += amount;
        updateSaleDisplay(section);
        updateStats();
        clearSaleForm(section);
        showSuccessMessage(`تم إضافة فاتورة ${section} بنجاح`);
    }
}

// Add Visa Function
async function addVisa() {
    const invoiceNumber = document.getElementById('فيزا-invoice').value.trim();
    const amount = parseFloat(document.getElementById('فيزا-amount').value);
    const visaNumber = document.getElementById('فيزا-number').value.trim();
    const notes = document.getElementById('فيزا-notes').value.trim();
    const errorDiv = document.getElementById('فيزا-error');
    
    errorDiv.innerHTML = '';
    
    if (!invoiceNumber || isNaN(amount) || amount <= 0) {
        errorDiv.innerHTML = 'يرجى إدخال رقم الفاتورة وقيمة صحيحة';
        return;
    }
    
    if (!visaNumber || visaNumber.length !== 4 || !/^\d+$/.test(visaNumber)) {
        errorDiv.innerHTML = 'يرجى إدخال آخر 4 أرقام من الفيزا بشكل صحيح (4 أرقام فقط)';
        return;
    }
    
    if (usedVisaNumbers.has(visaNumber)) {
        errorDiv.innerHTML = `رقم الفيزا ${visaNumber} مستخدم بالفعل اليوم!`;
        return;
    }
    
    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        invoiceNumber,
        amount,
        visaNumber,
        notes
    ], 'Visa');

    if (success) {
        let visa = { id: Date.now(), invoiceNumber, amount, visaNumber, notes, timestamp: new Date().toLocaleString('ar-EG') };
        dailyData.visa.push(visa);
        dailyData.visaAmount += amount;
        usedVisaNumbers.add(visaNumber);
        updateVisaDisplay();
        updateStats();
        clearVisaForm();
        showSuccessMessage(`تم إضافة فاتورة الفيزا بنجاح`);
    }
}

// Add Credit Function
async function addCredit() {
    const invoiceNumber = document.getElementById('آجل-invoice').value.trim();
    const amount = parseFloat(document.getElementById('آجل-amount').value);
    const notes = document.getElementById('آجل-notes').value.trim();
    
    if (!invoiceNumber || isNaN(amount) || amount <= 0) {
        alert('يرجى إدخال رقم الفاتورة وقيمة صحيحة');
        return;
    }
    
    if (!selectedCustomer) {
        alert('يرجى اختيار العميل');
        return;
    }
    
    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        invoiceNumber,
        amount,
        selectedCustomer,
        notes
    ], 'Credit');

    if (success) {
        let credit = { id: Date.now(), invoiceNumber, amount, customer: selectedCustomer, notes, timestamp: new Date().toLocaleString('ar-EG') };
        dailyData.credit.push(credit);
        dailyData.creditAmount += amount;
        updateCreditDisplay();
        updateStats();
        clearCreditForm();
        showSuccessMessage(`تم إضافة فاتورة آجل للعميل ${selectedCustomer} بنجاح`);
    }
}

// Add Exchange Function
async function addExchange() {
    const originalInvoice = document.getElementById('بدل-original-invoice').value.trim();
    const originalAmount = parseFloat(document.getElementById('بدل-original-amount').value);
    const newInvoice = document.getElementById('بدل-new-invoice').value.trim();
    const newAmount = parseFloat(document.getElementById('بدل-new-amount').value);
    const notes = document.getElementById('بدل-notes').value.trim();
    
    if (!originalInvoice || isNaN(originalAmount) || originalAmount <= 0 || 
        !newInvoice || isNaN(newAmount) || newAmount <= 0) {
        alert('يرجى إدخال بيانات الفواتير بشكل صحيح');
        return;
    }
    
    const difference = newAmount - originalAmount;
    
    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        originalInvoice,
        originalAmount,
        newInvoice,
        newAmount,
        difference,
        notes
    ], 'Exchanges');

    if (success) {
        let exchange = { id: Date.now(), originalInvoice, originalAmount, newInvoice, newAmount, difference, notes, timestamp: new Date().toLocaleString('ar-EG') };
        dailyData.exchanges.push(exchange);
        
        if (difference > 0) { // If new item is more expensive, it's an expense
            dailyData.exchangeExpenses += difference;
            dailyData.totalExpenses += difference;
        }
        
        updateExchangeDisplay();
        updateStats();
        clearExchangeForm();
        showSuccessMessage(`تم إضافة عملية البدل بنجاح`);
    }
}

// Add Expense Function
async function addExpense(section) {
    const amount = parseFloat(document.getElementById(section + '-amount').value);
    const notes = document.getElementById(section + '-notes').value.trim();
    let typeOrDescription = '';

    // Handle special expense types
    if (section === 'شحن_تاب' || section === 'شحن_كهربا' || section === 'بنزين' || section === 'عجوزات') {
        typeOrDescription = document.getElementById(section + '-extra').value.trim();
        if (!typeOrDescription) {
            alert(`يرجى إدخال ${section === 'شحن_تاب' ? 'رقم التاب/الفون' : section === 'شحن_كهربا' ? 'مكان الشحن' : section === 'بنزين' ? 'اسم المستلم' : 'المسؤول عن العجز'}`);
            return;
        }
    } else {
        typeOrDescription = section; // Default to section name if no specific input
    }
    
    if (isNaN(amount) || amount <= 0) {
        alert('يرجى إدخال مبلغ صحيح');
        return;
    }
    
    const success = await saveToGoogleSheets([
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        section,
        typeOrDescription, // This column will hold the specific detail
        amount,
        notes
    ], 'Expenses');

    if (success) {
        let expense = { id: Date.now(), type: typeOrDescription, amount, notes, timestamp: new Date().toLocaleString('ar-EG') };
        dailyData.expenses[section].push(expense);
        dailyData.totalExpenses += amount;
        updateExpenseDisplay(section);
        updateStats();
        clearExpenseForm(section);
        showSuccessMessage(`تم إضافة مصروف ${section} بنجاح`);
    }
}

// Update Statistics
function updateStats() {
    let totalOperations = dailyData.visa.length + dailyData.credit.length + dailyData.exchanges.length;
    for (const section in dailyData.sales) { totalOperations += dailyData.sales[section].length; }
    for (const section in dailyData.expenses) { totalOperations += dailyData.expenses[section].length; }
    
    document.getElementById('totalOperations').textContent = totalOperations;
    document.getElementById('totalSales').textContent = dailyData.totalSales.toFixed(2);
    document.getElementById('totalExpenses').textContent = dailyData.totalExpenses.toFixed(2);
    document.getElementById('visaAmount').textContent = dailyData.visaAmount.toFixed(2);
    document.getElementById('creditAmount').textContent = dailyData.creditAmount.toFixed(2);
    
    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount - dailyData.exchangeExpenses;
    document.getElementById('expectedCash').textContent = expectedCash.toFixed(2);
    
    document.getElementById('summaryTotalSales').textContent = dailyData.totalSales.toFixed(2);
    document.getElementById('summaryTotalExpenses').textContent = dailyData.totalExpenses.toFixed(2);
    document.getElementById('summaryVisa').textContent = dailyData.visaAmount.toFixed(2);
    document.getElementById('summaryCredit').textContent = dailyData.creditAmount.toFixed(2);
    document.getElementById('summaryActualCash').textContent = expectedCash.toFixed(2);
    document.getElementById('summaryTotal').textContent = (expectedCash + dailyData.visaAmount + dailyData.creditAmount).toFixed(2);
}

// Update Display Functions
function updateSaleDisplay(section) {
    const listElement = document.getElementById(section + '-list');
    const countElement = document.getElementById(section + '-count');
    const totalElement = document.getElementById(section + '-total');
    
    listElement.innerHTML = '';
    const count = dailyData.sales[section].length;
    const total = dailyData.sales[section].reduce((sum, item) => sum + item.amount, 0);
    
    countElement.textContent = count;
    totalElement.textContent = total.toFixed(2);
    
    dailyData.sales[section].forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'invoice-item';
        itemElement.innerHTML = `
            <div>
                <strong>فاتورة #${item.invoiceNumber}</strong>: ${item.amount.toFixed(2)} جنيه
                ${item.notes ? `<br><small>ملاحظات: ${item.notes}</small>` : ''}
                <br><small>${item.timestamp}</small>
            </div>
            <button class="btn-danger btn-small" onclick="deleteEntry('sales', '${section}', ${item.id})">حذف</button>
        `;
        listElement.appendChild(itemElement);
    });
}

function updateVisaDisplay() {
    const listElement = document.getElementById('فيزا-list');
    listElement.innerHTML = '';
    
    dailyData.visa.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'invoice-item';
        itemElement.innerHTML = `
            <div>
                <strong>فاتورة #${item.invoiceNumber}</strong>: ${item.amount.toFixed(2)} جنيه
                <br><small>رقم الفيزا: ${item.visaNumber}</small>
                ${item.notes ? `<br><small>ملاحظات: ${item.notes}</small>` : ''}
                <br><small>${item.timestamp}</small>
            </div>
            <button class="btn-danger btn-small" onclick="deleteEntry('visa', null, ${item.id})">حذف</button>
        `;
        listElement.appendChild(itemElement);
    });
}

function updateCreditDisplay() {
    const listElement = document.getElementById('آجل-list');
    listElement.innerHTML = '';
    
    dailyData.credit.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'invoice-item';
        itemElement.innerHTML = `
            <div>
                <strong>فاتورة #${item.invoiceNumber}</strong>: ${item.amount.toFixed(2)} جنيه
                <br><small>العميل: ${item.customer}</small>
                ${item.notes ? `<br><small>ملاحظات: ${item.notes}</small>` : ''}
                <br><small>${item.timestamp}</small>
            </div>
            <button class="btn-danger btn-small" onclick="deleteEntry('credit', null, ${item.id})">حذف</button>
        `;
        listElement.appendChild(itemElement);
    });
}

function updateExchangeDisplay() {
    const listElement = document.getElementById('بدل-list');
    const calculationElement = document.getElementById('بدل-calculation');
    
    listElement.innerHTML = '';
    calculationElement.innerHTML = '';
    
    let totalDifference = 0;
    
    dailyData.exchanges.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'invoice-item';
        itemElement.innerHTML = `
            <div>
                <strong>بدل من #${item.originalInvoice} (${item.originalAmount.toFixed(2)}) إلى #${item.newInvoice} (${item.newAmount.toFixed(2)})</strong>
                <br><small>الفرق: ${item.difference.toFixed(2)} جنيه</small>
                ${item.notes ? `<br><small>ملاحظات: ${item.notes}</small>` : ''}
                <br><small>${item.timestamp}</small>
            </div>
            <button class="btn-danger btn-small" onclick="deleteEntry('exchanges', null, ${item.id})">حذف</button>
        `;
        listElement.appendChild(itemElement);
        
        totalDifference += item.difference;
    });
    
    if (dailyData.exchanges.length > 0) {
        calculationElement.innerHTML = `
            <div class="calculation-result">
                <strong>إجمالي الفرق من عمليات البدل: ${totalDifference.toFixed(2)} جنيه</strong>
                ${totalDifference > 0 ? '<p style="color: red;">(هذا المبلغ يعتبر مصروف إضافي)</p>' : ''}
            </div>
        `;
    }
}

function updateExpenseDisplay(section) {
    const listElement = document.getElementById(section + '-list');
    const countElement = document.getElementById(section + '-count');
    const totalElement = document.getElementById(section + '-total');
    
    listElement.innerHTML = '';
    const count = dailyData.expenses[section].length;
    const total = dailyData.expenses[section].reduce((sum, item) => sum + item.amount, 0);
    
    countElement.textContent = count;
    totalElement.textContent = total.toFixed(2);
    
    dailyData.expenses[section].forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'invoice-item';
        itemElement.innerHTML = `
            <div>
                <strong>${item.type}</strong>: ${item.amount.toFixed(2)} جنيه
                ${item.notes ? `<br><small>ملاحظات: ${item.notes}</small>` : ''}
                <br><small>${item.timestamp}</small>
            </div>
            <button class="btn-danger btn-small" onclick="deleteEntry('expenses', '${section}', ${item.id})">حذف</button>
        `;
        listElement.appendChild(itemElement);
    });
}

// Delete Entry (Client-side only for now, full deletion from Sheets is complex)
function deleteEntry(type, section, id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإدخال؟')) return;

    let itemIndex;
    let amountToRemove = 0;

    if (type === 'sales' && section) {
        itemIndex = dailyData.sales[section].findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.sales[section][itemIndex].amount;
            dailyData.sales[section].splice(itemIndex, 1);
            dailyData.totalSales -= amountToRemove;
            updateSaleDisplay(section);
        }
    } else if (type === 'expenses' && section) {
        itemIndex = dailyData.expenses[section].findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.expenses[section][itemIndex].amount;
            dailyData.expenses[section].splice(itemIndex, 1);
            dailyData.totalExpenses -= amountToRemove;
            updateExpenseDisplay(section);
        }
    } else if (type === 'visa') {
        itemIndex = dailyData.visa.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.visa[itemIndex].amount;
            const visaNum = dailyData.visa[itemIndex].visaNumber;
            dailyData.visa.splice(itemIndex, 1);
            dailyData.visaAmount -= amountToRemove;
            usedVisaNumbers.delete(visaNum); // Remove from used set
            updateVisaDisplay();
        }
    } else if (type === 'credit') {
        itemIndex = dailyData.credit.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            amountToRemove = dailyData.credit[itemIndex].amount;
            dailyData.credit.splice(itemIndex, 1);
            dailyData.creditAmount -= amountToRemove;
            updateCreditDisplay();
        }
    } else if (type === 'exchanges') {
        itemIndex = dailyData.exchanges.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            const difference = dailyData.exchanges[itemIndex].difference;
            dailyData.exchanges.splice(itemIndex, 1);
            if (difference > 0) {
                dailyData.exchangeExpenses -= difference;
                dailyData.totalExpenses -= difference;
            }
            updateExchangeDisplay();
        }
    }
    updateStats();
    showSuccessMessage('تم حذف الإدخال بنجاح (مؤقتًا من الواجهة).');
    // Note: Deleting from Google Sheets requires more complex logic (finding row index and deleting)
}


// Clear Form Functions
function clearSaleForm(section) {
    document.getElementById(section + '-invoice').value = '';
    document.getElementById(section + '-amount').value = '';
    document.getElementById(section + '-notes').value = '';
}

function clearVisaForm() {
    document.getElementById('فيزا-invoice').value = '';
    document.getElementById('فيزا-amount').value = '';
    document.getElementById('فيزا-number').value = '';
    document.getElementById('فيزا-notes').value = '';
    document.getElementById('فيزا-error').innerHTML = '';
}

function clearCreditForm() {
    document.getElementById('آجل-invoice').value = '';
    document.getElementById('آجل-amount').value = '';
    document.getElementById('آجل-notes').value = '';
    document.getElementById('selected-customer').value = '';
    selectedCustomer = '';
}

function clearExchangeForm() {
    document.getElementById('بدل-original-invoice').value = '';
    document.getElementById('بدل-original-amount').value = '';
    document.getElementById('بدل-new-invoice').value = '';
    document.getElementById('بدل-new-amount').value = '';
    document.getElementById('بدل-notes').value = '';
}

function clearExpenseForm(section) {
    if (document.getElementById(section + '-extra')) {
        document.getElementById(section + '-extra').value = '';
    }
    document.getElementById(section + '-amount').value = '';
    document.getElementById(section + '-notes').value = '';
}

// Customer Management Functions (for Credit)
function loadCustomers() {
    const customersList = document.getElementById('customersList');
    customersList.innerHTML = '';
    
    customers.forEach(customer => {
        const customerElement = document.createElement('div');
        customerElement.className = 'customer-item';
        customerElement.innerHTML = `
            <span>${customer}</span>
            <button class="btn btn-small" onclick="selectCustomer('${customer}')">اختيار</button>
        `;
        customersList.appendChild(customerElement);
    });
}

function searchCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const customerItems = document.querySelectorAll('.customer-item');
    
    customerItems.forEach(item => {
        const customerName = item.querySelector('span').textContent.toLowerCase();
        item.style.display = customerName.includes(searchTerm) ? 'flex' : 'none';
    });
}

function selectCustomer(customer) {
    selectedCustomer = customer;
    document.getElementById('selected-customer').value = customer;
    closeCustomerModal();
}

async function addNewCustomer() {
    const newCustomerName = document.getElementById('newCustomerName').value.trim();
    
    if (!newCustomerName) {
        alert('يرجى إدخال اسم العميل');
        return;
    }
    
    if (customers.includes(newCustomerName)) {
        alert('هذا العميل موجود بالفعل');
        return;
    }
    
    const success = await saveToGoogleSheets([newCustomerName, currentUser, new Date().toLocaleDateString('ar-EG')], 'Customers');
    if (success) {
        customers.push(newCustomerName);
        loadCustomers();
        document.getElementById('newCustomerName').value = '';
        showSuccessMessage(`تم إضافة العميل ${newCustomerName} بنجاح`);
    }
}

function openCustomerModal() {
    document.getElementById('customerModal').style.display = 'block';
    loadCustomers(); // Reload customers in modal
}

function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
    document.getElementById('customerSearch').value = '';
    document.querySelectorAll('.customer-item').forEach(item => item.style.display = 'flex');
}

// Calculate Drawer Function
function calculateDrawer() {
    const drawerAmount = parseFloat(document.getElementById('drawerAmount').value);
    
    if (isNaN(drawerAmount) || drawerAmount < 0) {
        alert('يرجى إدخال مبلغ صحيح للدرج');
        return;
    }
    
    dailyData.drawerAmount = drawerAmount;
    
    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount - dailyData.exchangeExpenses;
    const difference = drawerAmount - expectedCash;
    
    let resultMessage = `
        <div class="drawer-result">
            <p><strong>النقدي المتوقع:</strong> ${expectedCash.toFixed(2)} جنيه</p>
            <p><strong>النقدي الفعلي في الدرج:</strong> ${drawerAmount.toFixed(2)} جنيه</p>
            <p><strong>الفرق:</strong> <span style="color: ${difference >= 0 ? 'green' : 'red'};">${Math.abs(difference).toFixed(2)} جنيه ${difference >= 0 ? 'زيادة' : 'نقص'}</span></p>
        </div>
    `;
    
    document.getElementById('drawerResult').innerHTML = resultMessage;
}

// Compare with New Mind Function
function compareWithNewMind() {
    const newMindTotal = parseFloat(document.getElementById('newMindTotal').value);
    
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        alert('يرجى إدخال تقفيلة صحيحة من نيو مايند');
        return;
    }
    
    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount - dailyData.exchangeExpenses;
    const ourTotal = expectedCash + dailyData.visaAmount + dailyData.creditAmount; // This is the total sales recorded by cashier
    
    const difference = ourTotal - newMindTotal;
    
    let resultMessage = `
        <div class="comparison-result">
            <p><strong>إجمالي تقفيلتنا (مبيعات):</strong> ${ourTotal.toFixed(2)} جنيه</p>
            <p><strong>تقفيلة نيو مايند:</strong> ${newMindTotal.toFixed(2)} جنيه</p>
            <p><strong>الفرق:</strong> <span style="color: ${difference >= 0 ? 'green' : 'red'};">${Math.abs(difference).toFixed(2)} جنيه ${difference >= 0 ? 'زيادة' : 'نقص'}</span></p>
        </div>
    `;
    
    document.getElementById('comparisonResult').innerHTML = resultMessage;
}

// Finalize Day Closeout Function (Cashier's side)
async function finalizeDayCloseout() {
    if (!confirm('هل أنت متأكد من تقفيل اليوم نهائياً؟ لا يمكن التراجع بعد التقفيل.')) {
        return;
    }
    
    const drawerAmount = parseFloat(document.getElementById('drawerAmount').value);
    if (isNaN(drawerAmount)) {
        alert('يرجى حساب جرد الدرج أولاً.');
        return;
    }

    const newMindTotal = parseFloat(document.getElementById('newMindTotal').value);
    if (isNaN(newMindTotal)) {
        alert('يرجى إدخال تقفيلة نيو مايند للمقارنة أولاً.');
        return;
    }

    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount - dailyData.exchangeExpenses;
    const ourTotalSales = dailyData.totalSales; // Total sales recorded by cashier
    const ourTotalCloseout = expectedCash + dailyData.visaAmount + dailyData.creditAmount; // Total closeout based on cashier's entries

    const differenceWithNewMind = ourTotalCloseout - newMindTotal;
    let status = 'مطابق';
    if (differenceWithNewMind > 0) status = 'زيادة';
    else if (differenceWithNewMind < 0) status = 'نقص';

    const finalData = [
        new Date().toLocaleDateString('ar-EG'),
        currentUser,
        ourTotalSales.toFixed(2),
        dailyData.totalExpenses.toFixed(2),
        dailyData.visaAmount.toFixed(2),
        dailyData.creditAmount.toFixed(2),
        dailyData.exchangeExpenses.toFixed(2),
        expectedCash.toFixed(2),
        drawerAmount.toFixed(2),
        ourTotalCloseout.toFixed(2), // Our calculated total closeout
        newMindTotal.toFixed(2),
        differenceWithNewMind.toFixed(2),
        status,
        'لم يتم التقفيل بواسطة محاسب', // Placeholder for accountant
        new Date().toLocaleString('ar-EG')
    ];
    
    const success = await saveToGoogleSheets(finalData, 'DailyCloseout');
    
    if (success) {
        showSuccessMessage('تم تقفيل اليوم بنجاح! يمكنك الآن الخروج من النظام.');
        resetDailyData();
        logout(); // Log out after successful closeout
    }
}

// Reset Daily Data Function
function resetDailyData() {
    dailyData = {
        sales: {}, expenses: {}, visa: [], credit: [], exchanges: [],
        totalSales: 0, totalExpenses: 0, visaAmount: 0, creditAmount: 0,
        drawerAmount: 0, exchangeExpenses: 0
    };
    usedVisaNumbers.clear();
    selectedCustomer = '';
    initializeDataStructures();
    loadSections();
    updateVisaDisplay();
    updateCreditDisplay();
    updateExchangeDisplay();
    updateStats();
    document.getElementById('drawerAmount').value = '';
    document.getElementById('newMindTotal').value = '';
    document.getElementById('drawerResult').innerHTML = '';
    document.getElementById('comparisonResult').innerHTML = '';
}

// --- Accountant Dashboard Functions ---

async function showAccountantDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('cashierDashboardSection').style.display = 'none';
    document.getElementById('accountantDashboardSection').style.display = 'block';
    document.getElementById('currentUserAccountant').textContent = currentUser;
    document.getElementById('currentDateAccountant').textContent = new Date().toLocaleDateString('ar-EG');

    populateCashierSelects();
    loadCurrentSectionsForManageModal();
}

// Populate cashier dropdowns for reports and closeout
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

// Open Create User Modal
function openCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'block';
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserRole').value = 'Cashier';
}

function closeCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'none';
}

// Create New User
async function createNewUser() {
    const newUsername = document.getElementById('newUsername').value.trim();
    const newUserPassword = document.getElementById('newUserPassword').value.trim();
    const newUserRole = document.getElementById('newUserRole').value;

    if (!newUsername || !newUserPassword) {
        alert('يرجى إدخال اسم المستخدم وكلمة المرور');
        return;
    }

    if (users.some(u => u.username === newUsername)) {
        alert('اسم المستخدم هذا موجود بالفعل.');
        return;
    }

    const success = await saveToGoogleSheets([newUsername, newUserPassword, newUserRole], 'Users');
    if (success) {
        users.push({ username: newUsername, password: newUserPassword, role: newUserRole });
        populateUserDropdown(); // Update login dropdown
        populateCashierSelects(); // Update accountant dropdowns
        showSuccessMessage(`تم إنشاء المستخدم ${newUsername} بنجاح.`);
        closeCreateUserModal();
    }
}

// Open Manage Sections Modal
async function openManageSectionsModal() {
    document.getElementById('manageSectionsModal').style.display = 'block';
    await loadSectionsFromSheets(); // Ensure latest sections are loaded
    loadCurrentSectionsForManageModal();
}

function closeManageSectionsModal() {
    document.getElementById('manageSectionsModal').style.display = 'none';
}

// Load current sections into manage modal
function loadCurrentSectionsForManageModal() {
    const salesList = document.getElementById('currentSalesSections');
    const expenseList = document.getElementById('currentExpenseSections');
    salesList.innerHTML = '<h4>أقسام المبيعات:</h4>';
    expenseList.innerHTML = '<h4>أقسام المصروفات:</h4>';

    salesSections.forEach(section => {
        const item = document.createElement('div');
        item.className = 'section-item';
        item.innerHTML = `<span>${section}</span> <button class="btn-danger btn-small" onclick="deleteSection('${section}', 'sales')">حذف</button>`;
        salesList.appendChild(item);
    });

    expenseSections.forEach(section => {
        const item = document.createElement('div');
        item.className = 'section-item';
        item.innerHTML = `<span>${section}</span> <button class="btn-danger btn-small" onclick="deleteSection('${section}', 'expenses')">حذف</button>`;
        expenseList.appendChild(item);
    });
}

// Add Section from Manage Modal (Accountant version)
async function addSectionFromManageModal() {
    const sectionName = document.getElementById('manageSectionName').value.trim();
    const sectionType = document.querySelector('input[name="manageSectionType"]:checked').value;

    if (!sectionName) {
        alert('يرجى إدخال اسم القسم');
        return;
    }

    if (salesSections.includes(sectionName) || expenseSections.includes(sectionName)) {
        alert('هذا القسم موجود بالفعل.');
        return;
    }

    const success = await saveToGoogleSheets([sectionName, sectionType, currentUser, new Date().toLocaleDateString('ar-EG')], 'Sections');
    if (success) {
        if (sectionType === 'sales') {
            salesSections.push(sectionName);
        } else {
            expenseSections.push(sectionName);
        }
        document.getElementById('manageSectionName').value = '';
        showSuccessMessage(`تم إضافة قسم ${sectionName} بنجاح.`);
        loadCurrentSectionsForManageModal(); // Refresh list in modal
        initializeDataStructures(); // Update dailyData structure
        loadSections(); // Refresh cashier dashboard sections
    }
}

// Delete Section (Accountant only)
async function deleteSection(sectionName, sectionType) {
    if (!confirm(`هل أنت متأكد من حذف القسم "${sectionName}"؟ هذا سيؤثر على بيانات الكاشير.`)) return;

    // This is a simplified deletion. A robust solution would involve:
    // 1. Reading all data from 'Sections' sheet.
    // 2. Filtering out the row to be deleted.
    // 3. Clearing the sheet.
    // 4. Writing back the filtered data.
    // This is more complex for a direct client-side Google Sheets API.
    // For now, we'll remove it from the local arrays and show a message.
    // A more advanced backend would handle actual row deletion.

    showErrorMessage('وظيفة حذف الأقسام من Google Sheets غير مطبقة بالكامل في هذا المثال لتعقيدها. تم الحذف من القائمة المحلية فقط.');

    if (sectionType === 'sales') {
        salesSections = salesSections.filter(s => s !== sectionName);
    } else {
        expenseSections = expenseSections.filter(s => s !== sectionName);
    }
    loadCurrentSectionsForManageModal();
    initializeDataStructures(); // Update dailyData structure
    loadSections(); // Refresh cashier dashboard sections
}


// Generate Cashier Report
async function generateCashierReport() {
    const cashierUsername = document.getElementById('selectCashierForReport').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const reportResultDiv = document.getElementById('cashierReportResult');
    reportResultDiv.innerHTML = '';

    if (!cashierUsername || !startDate || !endDate) {
        alert('يرجى اختيار الكاشير وتحديد نطاق التاريخ.');
        return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // Include end date fully

    let report = {
        sales: [], expenses: [], visa: [], credit: [], exchanges: [],
        totalSales: 0, totalExpenses: 0, visaAmount: 0, creditAmount: 0, exchangeExpenses: 0
    };

    // Helper to filter data by cashier and date
    const filterData = (data, sheetName) => {
        return data.filter(row => {
            const rowDate = new Date(row[0]); // Assuming date is in the first column
            const rowCashier = row[2]; // Assuming cashier is in the third column
            return rowCashier === cashierUsername && rowDate >= start && rowDate < end;
        });
    };

    const allSales = await loadDataFromSheet('Sales');
    report.sales = filterData(allSales.slice(1), 'Sales');
    report.totalSales = report.sales.reduce((sum, row) => sum + parseFloat(row[5] || 0), 0);

    const allExpenses = await loadDataFromSheet('Expenses');
    report.expenses = filterData(allExpenses.slice(1), 'Expenses');
    report.totalExpenses = report.expenses.reduce((sum, row) => sum + parseFloat(row[5] || 0), 0);

    const allVisa = await loadDataFromSheet('Visa');
    report.visa = filterData(allVisa.slice(1), 'Visa');
    report.visaAmount = report.visa.reduce((sum, row) => sum + parseFloat(row[4] || 0), 0);

    const allCredit = await loadDataFromSheet('Credit');
    report.credit = filterData(allCredit.slice(1), 'Credit');
    report.creditAmount = report.credit.reduce((sum, row) => sum + parseFloat(row[4] || 0), 0);

    const allExchanges = await loadDataFromSheet('Exchanges');
    report.exchanges = filterData(allExchanges.slice(1), 'Exchanges');
    report.exchangeExpenses = report.exchanges.reduce((sum, row) => {
        const diff = parseFloat(row[7] || 0); // Difference column
        return sum + (diff > 0 ? diff : 0); // Only count positive differences as expenses
    }, 0);
    report.totalExpenses += report.exchangeExpenses; // Add exchange expenses to total expenses

    const expectedCash = report.totalSales - report.totalExpenses - report.visaAmount - report.creditAmount;

    let reportHtml = `
        <h4>تقرير الكاشير: ${cashierUsername} (${startDate} - ${endDate})</h4>
        <p><strong>إجمالي المبيعات:</strong> ${report.totalSales.toFixed(2)} جنيه</p>
        <p><strong>إجمالي المصروفات:</strong> ${report.totalExpenses.toFixed(2)} جنيه</p>
        <p><strong>مبيعات الفيزا:</strong> ${report.visaAmount.toFixed(2)} جنيه</p>
        <p><strong>المبيعات الآجلة:</strong> ${report.creditAmount.toFixed(2)} جنيه</p>
        <p><strong>الكاش المتوقع:</strong> ${expectedCash.toFixed(2)} جنيه</p>
        <hr>
        <h5>تفاصيل المبيعات:</h5>
        ${report.sales.length > 0 ? report.sales.map(s => `<div class="report-item">فاتورة #${s[4]} (${s[3]}): ${s[5]} جنيه</div>`).join('') : '<p>لا توجد مبيعات.</p>'}
        <h5>تفاصيل المصروفات:</h5>
        ${report.expenses.length > 0 ? report.expenses.map(e => `<div class="report-item">${e[4]} (${e[3]}): ${e[5]} جنيه</div>`).join('') : '<p>لا توجد مصروفات.</p>'}
        <h5>تفاصيل الفيزا:</h5>
        ${report.visa.length > 0 ? report.visa.map(v => `<div class="report-item">فاتورة #${v[3]}: ${v[4]} جنيه (فيزا: ${v[5]})</div>`).join('') : '<p>لا توجد عمليات فيزا.</p>'}
        <h5>تفاصيل الآجل:</h5>
        ${report.credit.length > 0 ? report.credit.map(c => `<div class="report-item">فاتورة #${c[3]}: ${c[4]} جنيه (عميل: ${c[5]})</div>`).join('') : '<p>لا توجد مبيعات آجلة.</p>'}
        <h5>تفاصيل البدل:</h5>
        ${report.exchanges.length > 0 ? report.exchanges.map(ex => `<div class="report-item">بدل من #${ex[3]} (${ex[4]}) إلى #${ex[5]} (${ex[6]})، فرق: ${ex[7]} جنيه</div>`).join('') : '<p>لا توجد عمليات بدل.</p>'}
    `;
    reportResultDiv.innerHTML = reportHtml;
}

// Perform Accountant Closeout
async function performAccountantCloseout() {
    const cashierUsername = document.getElementById('selectCashierForCloseout').value;
    const closeoutDateStr = document.getElementById('closeoutDate').value;
    const accountantNewMindTotal = parseFloat(document.getElementById('accountantNewMindTotal').value);
    const closeoutResultDiv = document.getElementById('accountantCloseoutResult');
    closeoutResultDiv.innerHTML = '';

    if (!cashierUsername || !closeoutDateStr || isNaN(accountantNewMindTotal) || accountantNewMindTotal < 0) {
        alert('يرجى اختيار الكاشير، تحديد تاريخ التقفيل، وإدخال تقفيلة نيو مايند صحيحة.');
        return;
    }

    const closeoutDate = new Date(closeoutDateStr);
    closeoutDate.setHours(0, 0, 0, 0); // Normalize date to start of day

    // Find the cashier's closeout entry for this specific date
    const allDailyCloseouts = await loadDataFromSheet('DailyCloseout');
    const cashierCloseout = allDailyCloseouts.slice(1).find(row => {
        const entryDate = new Date(row[0]); // Assuming date is in the first column
        entryDate.setHours(0, 0, 0, 0);
        const entryCashier = row[1]; // Assuming cashier is in the second column
        return entryCashier === cashierUsername && entryDate.getTime() === closeoutDate.getTime();
    });

    if (!cashierCloseout) {
        alert(`لم يتم العثور على تقفيلة للكاشير ${cashierUsername} بتاريخ ${closeoutDateStr}. يرجى التأكد من أن الكاشير قام بتقفيل يومه.`);
        return;
    }

    const cashierTotalSales = parseFloat(cashierCloseout[2]);
    const cashierTotalExpenses = parseFloat(cashierCloseout[3]);
    const cashierVisaAmount = parseFloat(cashierCloseout[4]);
    const cashierCreditAmount = parseFloat(cashierCloseout[5]);
    const cashierExchangeExpenses = parseFloat(cashierCloseout[6]);
    const cashierExpectedCash = parseFloat(cashierCloseout[7]);
    const cashierActualDrawerAmount = parseFloat(cashierCloseout[8]);
    const cashierOurTotalCloseout = parseFloat(cashierCloseout[9]); // This is the cashier's calculated total

    const differenceWithNewMind = cashierOurTotalCloseout - accountantNewMindTotal;
    let status = 'مطابق';
    if (differenceWithNewMind > 0) status = 'زيادة';
    else if (differenceWithNewMind < 0) status = 'نقص';

    let resultHtml = `
        <h4>نتائج تقفيل حساب الكاشير: ${cashierUsername} (${closeoutDateStr})</h4>
        <p><strong>إجمالي مبيعات الكاشير:</strong> ${cashierTotalSales.toFixed(2)} جنيه</p>
        <p><strong>إجمالي مصروفات الكاشير:</strong> ${cashierTotalExpenses.toFixed(2)} جنيه</p>
        <p><strong>مبيعات الفيزا:</strong> ${cashierVisaAmount.toFixed(2)} جنيه</p>
        <p><strong>المبيعات الآجلة:</strong> ${cashierCreditAmount.toFixed(2)} جنيه</p>
        <p><strong>الكاش المتوقع:</strong> ${cashierExpectedCash.toFixed(2)} جنيه</p>
        <p><strong>الكاش الفعلي في الدرج:</strong> ${cashierActualDrawerAmount.toFixed(2)} جنيه</p>
        <p><strong>إجمالي تقفيلة الكاشير:</strong> ${cashierOurTotalCloseout.toFixed(2)} جنيه</p>
        <p><strong>تقفيلة نيو مايند (المحاسب):</strong> ${accountantNewMindTotal.toFixed(2)} جنيه</p>
        <p><strong>الفرق:</strong> <span style="color: ${differenceWithNewMind >= 0 ? 'green' : 'red'};">${Math.abs(differenceWithNewMind).toFixed(2)} جنيه ${differenceWithNewMind >= 0 ? 'زيادة' : 'نقص'}</span></p>
        <p><strong>الحالة:</strong> ${status}</p>
    `;
    closeoutResultDiv.innerHTML = resultHtml;

    // Update the existing row in DailyCloseout sheet with accountant's data
    // This requires finding the row index and using gapi.client.sheets.spreadsheets.values.update
    // This is more complex than append and requires a separate function.
    // For simplicity, we'll just show the result and assume a manual update or more complex backend logic.
    showErrorMessage('وظيفة تحديث تقفيلة الكاشير في Google Sheets بواسطة المحاسب غير مطبقة بالكامل في هذا المثال لتعقيدها.');
    // A full implementation would involve:
    // 1. Getting all rows from 'DailyCloseout'.
    // 2. Finding the specific row index for cashierCloseout.
    // 3. Modifying that row's 'Accountant' and 'Final Status' columns.
    // 4. Updating the sheet with the modified data.
}

// Search Invoice
async function searchInvoice() {
    const invoiceNumber = document.getElementById('searchInvoiceNumber').value.trim();
    const searchResultDiv = document.getElementById('invoiceSearchResult');
    searchResultDiv.innerHTML = '';

    if (!invoiceNumber) {
        alert('يرجى إدخال رقم الفاتورة للبحث.');
        return;
    }

    let found = false;
    let resultHtml = '<h4>نتائج البحث عن فاتورة:</h4>';

    const searchInSheet = async (sheetName, invoiceColIndex, otherCols) => {
        const data = await loadDataFromSheet(sheetName);
        const header = data[0];
        const rows = data.slice(1);
        rows.forEach(row => {
            if (row[invoiceColIndex] === invoiceNumber) {
                found = true;
                resultHtml += `<div class="report-item"><strong>الورقة:</strong> ${sheetName}<br>`;
                resultHtml += `<strong>التاريخ:</strong> ${row[0]}، <strong>الوقت:</strong> ${row[1]}، <strong>الكاشير:</strong> ${row[2]}<br>`;
                resultHtml += `<strong>رقم الفاتورة:</strong> ${row[invoiceColIndex]}، <strong>القيمة:</strong> ${row[invoiceColIndex + 1]} جنيه<br>`;
                if (otherCols) {
                    otherCols.forEach(col => {
                        if (row[col.index]) resultHtml += `<strong>${col.label}:</strong> ${row[col.index]}<br>`;
                    });
                }
                resultHtml += `<strong>ملاحظات:</strong> ${row[row.length - 1] || 'لا توجد'}</div>`;
            }
        });
    };

    await searchInSheet('Sales', 4); // Invoice is col 4, Amount is col 5
    await searchInSheet('Visa', 3, [{label: 'رقم الفيزا', index: 5}]); // Invoice is col 3, Amount is col 4, VisaNum is col 5
    await searchInSheet('Credit', 3, [{label: 'العميل', index: 5}]); // Invoice is col 3, Amount is col 4, Customer is col 5
    await searchInSheet('Exchanges', 3, [ // Original Invoice is col 3, New Invoice is col 5
        {label: 'قيمة أصلية', index: 4},
        {label: 'فاتورة بدل', index: 5},
        {label: 'قيمة بدل', index: 6},
        {label: 'الفرق', index: 7}
    ]);

    if (!found) {
        resultHtml += '<p>لم يتم العثور على فاتورة بهذا الرقم.</p>';
    }
    searchResultDiv.innerHTML = resultHtml;
}


// --- Utility Functions ---

function showSuccessMessage(message) {
    console.log('Success:', message);
    // You can implement a more visible success notification here (e.g., a toast message)
}

function showErrorMessage(message) {
    console.error('Error:', message);
    // You can implement a more visible error notification here
}

// --- Initialize on Page Load ---
window.onload = async function() {
    gapiLoaded();
    gisLoaded();

    // Check for existing login session
    currentUser = localStorage.getItem('currentUser');
    currentUserRole = localStorage.getItem('currentUserRole');

    if (currentUser && currentUserRole) {
        // Attempt to re-authenticate silently
        try {
            await handleAuthClick(); // This will try to get a token without prompt if possible
            if (currentUserRole === 'Cashier') {
                showCashierDashboard();
            } else if (currentUserRole === 'Accountant') {
                showAccountantDashboard();
            }
        } catch (error) {
            console.warn('Failed to re-authenticate, showing login page.', error);
            // If silent re-auth fails, clear session and show login
            logout();
        }
    }
};
