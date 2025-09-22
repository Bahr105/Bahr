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
    sales: {}, // المبيعات (هيكل: { "اسم القسم": [{id, invoiceNumber, amount, notes, timestamp}] })
    expenses: [], // المصروفات (هيكل: [{id, type, invoiceNumber, amount, notes, extraField, timestamp}])
    visa: [], // فواتير الفيزا (هيكل: [{id, invoiceNumber, amount, visaNumber, notes, timestamp}])
    credit: [], // المبيعات الآجلة (هيكل: [{id, invoiceNumber, amount, customer, notes, timestamp}])
    // exchanges: [], // تم إزالة سكشن البدل
    totalSales: 0,
    totalExpenses: 0,
    visaAmount: 0,
    creditAmount: 0,
    drawerAmount: 0,
    // exchangeExpenses: 0 // تم إزالة سكشن البدل
};

let users = []; // Loaded from Google Sheets (username, password, role)
let salesSections = []; // Loaded from Google Sheets (names of sales sections)
let expenseTypes = []; // Loaded from Google Sheets (names of expense types)
let customers = []; // Loaded from Google Sheets (customer names and credit)
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
        console.error(`خطأ في تحميل البيانات من ${sheetName}:`, err);
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
        return false;
    }
}

// --- Initial Data Loading on Page Load ---
async function loadInitialData() {
    await loadUsers();
    await loadSectionsAndExpenseTypesFromSheets();
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

// Load Sales Sections and Expense Types from Google Sheets
async function loadSectionsAndExpenseTypesFromSheets() {
    const sectionsData = await loadDataFromSheet('Categories'); // Assuming a 'Categories' sheet
    salesSections = [];
    expenseTypes = [];

    if (sectionsData.length > 1) { // Skip header row
        sectionsData.slice(1).forEach(row => {
            const name = row[0]; // Category name
            const type = row[1]; // Type (sales/expense)
            if (name && type) {
                if (type === 'sales' && !salesSections.includes(name)) {
                    salesSections.push(name);
                } else if (type === 'expense' && !expenseTypes.includes(name)) {
                    expenseTypes.push(name);
                }
            }
        });
    } else {
        console.warn('No category data found in Google Sheet "Categories".');
    }
    initializeDataStructures(); // Re-initialize dailyData with loaded sections/types
    populateExpenseTypeDropdown();
}

// Populate expense type dropdown in cashier dashboard
function populateExpenseTypeDropdown() {
    const expenseTypeSelect = document.getElementById('expenseType');
    expenseTypeSelect.innerHTML = ''; // Clear existing options
    expenseTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        expenseTypeSelect.appendChild(option);
    });
    toggleExtraField(); // Call to set initial state for extra field
}

// Load Customers from Google Sheets (Updated to load credit)
async function loadCustomersFromSheets() {
    const customerData = await loadDataFromSheet('Customers');
    customers = [];
    if (customerData.length > 1) { // Skip header row
        // Assuming Customer Name is in col 0 and Total Credit is in col 1
        customers = customerData.slice(1).map(row => ({
            name: row[0],
            totalCredit: parseFloat(row[1] || 0) // Load total credit
        })).filter(c => c.name);
    } else {
        console.warn('No customer data found in Google Sheet "Customers".');
    }
}

// --- Core Application Logic ---

// Initialize data structures for daily operations
function initializeDataStructures() {
    dailyData.sales = {};
    salesSections.forEach(section => {
        if (!dailyData.sales[section]) {
            dailyData.sales[section] = [];
        }
    });
    dailyData.expenses = []; // Expenses are now a flat array
    dailyData.visa = [];
    dailyData.credit = [];
    // dailyData.exchanges = []; // تم إزالة سكشن البدل
    dailyData.totalSales = 0;
    dailyData.totalExpenses = 0;
    dailyData.visaAmount = 0;
    dailyData.creditAmount = 0;
    dailyData.drawerAmount = 0;
    // dailyData.exchangeExpenses = 0; // تم إزالة سكشن البدل
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
    await loadSectionsAndExpenseTypesFromSheets();
    await loadCustomersFromSheets();
    initializeDataStructures();
    loadCustomersForCashier(); // Load customers for the customer tab
    loadSalesSectionsForCashier(); // Load sales sections for the sales tab
    updateExpensesList(); // Update expenses list for the expenses tab
    updateStats();
    openTab('expensesTab'); // Default to expenses tab
}

// Function to open specific tab
function openTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.style.display = 'none');

    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`.tab-btn[onclick="openTab('${tabName}')"]`).classList.add('active');

    // Specific updates for each tab
    if (tabName === 'sectionsTab') {
        loadSalesSectionsForCashier();
    } else if (tabName === 'customersTab') {
        loadCustomersForCashier();
        updateCustomerCredits(); // Updated to show actual credits
    } else if (tabName === 'summaryTab') {
        updateStats();
    } else if (tabName === 'expensesTab') {
        updateExpensesList();
    }
}

// Toggle extra field based on expense type
function toggleExtraField() {
    const expenseType = document.getElementById('expenseType').value;
    const extraFieldContainer = document.getElementById('extraFieldContainer');
    const extraFieldLabel = document.getElementById('extraFieldLabel');
    const expenseInvoiceInput = document.getElementById('expenseInvoice');

    extraFieldContainer.style.display = 'none';
    expenseInvoiceInput.required = true; // Default to required

    if (expenseType === 'شحن تاب') {
        extraFieldContainer.style.display = 'block';
        extraFieldLabel.textContent = 'رقم التاب/الفون:';
        expenseInvoiceInput.required = false; // No invoice for tab charge
    } else if (expenseType === 'شحن كهربا') {
        extraFieldContainer.style.display = 'block';
        extraFieldLabel.textContent = 'مكان الشحن:';
        expenseInvoiceInput.required = false; // No invoice for electricity charge
    } else if (expenseType === 'بنزين') {
        extraFieldContainer.style.display = 'block';
        extraFieldLabel.textContent = 'اسم المستلم:';
        expenseInvoiceInput.required = false; // No invoice for gas
    } else if (expenseType === 'أجل') {
        extraFieldContainer.style.display = 'block';
        extraFieldLabel.textContent = 'اختر العميل:';
        extraFieldContainer.innerHTML = `
            <label id="extraFieldLabel">اختر العميل:</label>
            <select id="extraFieldCustomerSelect" onchange="selectedCustomer = this.value"></select>
            <button class="btn btn-small" onclick="openAddNewCustomerModal()">+ عميل جديد</button>
        `;
        populateCustomerSelectForExpense();
        expenseInvoiceInput.required = true; // Invoice required for credit sales
    } else if (expenseType === 'عجوزات') {
        extraFieldContainer.style.display = 'block';
        extraFieldLabel.textContent = 'المسؤول عن العجز:';
        expenseInvoiceInput.required = false; // No invoice for deficit
    } else {
        // Reset extra field if type changes to one without extra field
        extraFieldContainer.innerHTML = `<label id="extraFieldLabel"></label><input type="text" id="extraField">`;
    }
}

// Populate customer select for 'أجل' expense type
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

// Open modal for adding new customer from expense tab
function openAddNewCustomerModal() {
    const newCustomerName = prompt('أدخل اسم العميل الجديد:');
    if (newCustomerName && newCustomerName.trim() !== '') {
        addNewCustomer(newCustomerName.trim()); // Call existing function to add customer
    }
}

// Search expenses by type
function searchExpenses() {
    const searchTerm = document.getElementById('expenseSearch').value.toLowerCase();
    const expenseTypeSelect = document.getElementById('expenseType');
    
    // Filter options in the dropdown
    const filteredOptions = expenseTypes.filter(type => type.toLowerCase().includes(searchTerm));
    expenseTypeSelect.innerHTML = '';
    filteredOptions.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        expenseTypeSelect.appendChild(option);
    });
    toggleExtraField(); // Update extra field based on new selection
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
    } else if (!expenseInvoice && expenseType !== 'فيزا') { // Visa might not always have an invoice number
        alert('يرجى إدخال رقم الفاتورة.');
        return;
    }

    // Prepare data for Google Sheets based on expense type
    let sheetName = 'Expenses';
    let dataToSave = [
        new Date().toLocaleDateString('ar-EG'),
        new Date().toLocaleTimeString('ar-EG'),
        currentUser,
        expenseType,
        expenseInvoice,
        expenseAmount,
        expenseNotes,
        extraFieldValue // This column will hold the specific detail
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
            expenseInvoice, // Invoice number for credit
            expenseAmount,
            extraFieldValue, // Customer name
            expenseNotes
        ];
    }
    // 'مرتجع' is treated as a regular expense for now, as per previous discussion.

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
            usedVisaNumbers.add(dataToSave[5]); // Add visa number to used set
        } else if (expenseType === 'أجل') {
            dailyData.credit.push(newEntry);
            dailyData.creditAmount += expenseAmount;
            // Update local customer credit
            const customerIndex = customers.findIndex(c => c.name === extraFieldValue);
            if (customerIndex > -1) {
                customers[customerIndex].totalCredit += expenseAmount;
            }
        } else {
            dailyData.expenses.push(newEntry);
            dailyData.totalExpenses += expenseAmount;
        }
        
        updateExpensesList();
        updateStats();
        clearExpenseForm();
        showSuccessMessage(`تم إضافة ${expenseType} بنجاح`);
        if (expenseType === 'أجل') {
            updateCustomerCredits(); // Refresh customer credits display
        }
    }
}

// Update Expenses List (for expenses tab)
function updateExpensesList() {
    const expensesListContainer = document.getElementById('expensesListContainer');
    expensesListContainer.innerHTML = '';

    if (dailyData.expenses.length === 0 && dailyData.visa.length === 0 && dailyData.credit.length === 0) {
        expensesListContainer.innerHTML = '<p>لا توجد مصروفات أو مبيعات خاصة مسجلة اليوم.</p>';
        return;
    }

    // Combine all relevant entries for display
    const allEntries = [
        ...dailyData.expenses.map(e => ({ ...e, category: e.type, displayType: 'مصروف' })),
        ...dailyData.visa.map(v => ({ ...v, category: 'فيزا', displayType: 'فيزا', invoiceNumber: v.invoiceNumber, notes: `رقم الفيزا: ${v.visaNumber}, ${v.notes}` })),
        ...dailyData.credit.map(c => ({ ...c, category: 'آجل', displayType: 'آجل', invoiceNumber: c.invoiceNumber, notes: `العميل: ${c.extraField}, ${c.notes}` }))
    ].sort((a, b) => b.id - a.id); // Sort by latest first

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
            <button class="btn-danger btn-small" onclick="deleteEntryFromDailyData('${item.displayType}', ${item.id})">حذف</button>
        `;
        expensesListContainer.appendChild(itemElement);
    });
}

// Delete Entry from dailyData (client-side only)
function deleteEntryFromDailyData(displayType, id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإدخال؟ (سيتم حذفه من الواجهة فقط، وليس من Google Sheets تلقائيًا)')) return;

    let itemIndex;
    let amountToRemove = 0;

    if (displayType === 'مصروف') {
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
            const visaNum = dailyData.visa[itemIndex].visaNumber;
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
            // Update local customer credit
            const customerIndex = customers.findIndex(c => c.name === customerName);
            if (customerIndex > -1) {
                customers[customerIndex].totalCredit -= amountToRemove;
            }
        }
    }
    updateExpensesList();
    updateStats();
    showSuccessMessage('تم حذف الإدخال بنجاح من القائمة المحلية.');
    if (displayType === 'آجل') {
        updateCustomerCredits(); // Refresh customer credits display
    }
}


// Load Sales Sections into Dashboard
function loadSalesSectionsForCashier() {
    const salesContainer = document.getElementById('salesSectionsContainer');
    salesContainer.innerHTML = '';
    salesSections.forEach(section => createSalesSectionUI(section));
}

// Create Sales Section UI
function createSalesSectionUI(section) {
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

// Update Sale Display
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
            <button class="btn-danger btn-small" onclick="deleteSaleEntry('${section}', ${item.id})">حذف</button>
        `;
        listElement.appendChild(itemElement);
    });
}

// Delete Sale Entry (client-side only)
function deleteSaleEntry(section, id) {
    if (!confirm('هل أنت متأكد من حذف فاتورة المبيعات هذه؟ (سيتم حذفها من الواجهة فقط)')) return;

    const itemIndex = dailyData.sales[section].findIndex(item => item.id === id);
    if (itemIndex > -1) {
        const amountToRemove = dailyData.sales[section][itemIndex].amount;
        dailyData.sales[section].splice(itemIndex, 1);
        dailyData.totalSales -= amountToRemove;
        updateSaleDisplay(section);
        updateStats();
        showSuccessMessage('تم حذف فاتورة المبيعات بنجاح من القائمة المحلية.');
    }
}

// Clear Sale Form
function clearSaleForm(section) {
    document.getElementById(section + '-invoice').value = '';
    document.getElementById(section + '-amount').value = '';
    document.getElementById(section + '-notes').value = '';
}

// Customer Management Functions (for Customers Tab)
function loadCustomersForCashier() {
    const customersListContainer = document.getElementById('customersListContainer');
    customersListContainer.innerHTML = '';
    
    if (customers.length === 0) {
        customersListContainer.innerHTML = '<p>لا توجد عملاء آجلين مسجلين.</p>';
        return;
    }

    customers.forEach(customer => {
        const customerElement = document.createElement('div');
        customerElement.className = 'customer-item';
        customerElement.innerHTML = `
            <span>${customer.name}</span>
            <!-- Add actions like view credit, etc. -->
        `;
        customersListContainer.appendChild(customerElement);
    });
}

// Add New Customer (Updated to save initial credit)
async function addNewCustomer(customerNameFromPrompt = null) {
    const newCustomerNameInput = document.getElementById('newCustomerName');
    const newCustomerName = customerNameFromPrompt || newCustomerNameInput.value.trim();
    
    if (!newCustomerName) {
        alert('يرجى إدخال اسم العميل');
        return;
    }
    
    // Check if customer exists by name (case-insensitive for better UX)
    if (customers.some(c => c.name.toLowerCase() === newCustomerName.toLowerCase())) {
        alert('هذا العميل موجود بالفعل');
        return;
    }
    
    // Send [Customer Name, Initial Total Credit (0)] to Google Sheets
    const success = await saveToGoogleSheets([newCustomerName, 0], 'Customers'); 
    if (success) {
        customers.push({ name: newCustomerName, totalCredit: 0 }); // Add to local array
        loadCustomersForCashier(); // Refresh customer list
        populateCustomerSelectForExpense(); // Update customer select in expense tab
        updateCustomerCredits(); // Update credit display
        if (newCustomerNameInput) newCustomerNameInput.value = '';
        showSuccessMessage(`تم إضافة العميل ${newCustomerName} بنجاح`);
    }
}

// Update Customer Credits (Updated to show actual credits)
function updateCustomerCredits() {
    const customerCreditsContainer = document.getElementById('customerCreditsContainer');
    customerCreditsContainer.innerHTML = '';

    if (customers.length === 0) {
        customerCreditsContainer.innerHTML = '<p>لا توجد عملاء آجلين مسجلين.</p>';
        return;
    }

    const customerCreditList = document.createElement('ul');
    customerCreditList.className = 'users-list'; // Reusing users-list style
    customers.forEach(customer => {
        const listItem = document.createElement('li');
        listItem.className = 'customer-item';
        listItem.innerHTML = `
            <span>${customer.name}</span>
            <span>الرصيد: ${customer.totalCredit.toFixed(2)} جنيه</span>
        `;
        customerCreditList.appendChild(listItem);
    });
    customerCreditsContainer.appendChild(customerCreditList);
}

// Update Statistics (Summary Tab)
function updateStats() {
    let totalOperations = dailyData.expenses.length + dailyData.visa.length + dailyData.credit.length;
    for (const section in dailyData.sales) { totalOperations += dailyData.sales[section].length; }
    
    // Recalculate totals from dailyData
    dailyData.totalSales = 0;
    for (const section in dailyData.sales) {
        dailyData.totalSales += dailyData.sales[section].reduce((sum, item) => sum + item.amount, 0);
    }
    dailyData.totalExpenses = dailyData.expenses.reduce((sum, item) => sum + item.amount, 0);
    dailyData.visaAmount = dailyData.visa.reduce((sum, item) => sum + item.amount, 0);
    dailyData.creditAmount = dailyData.credit.reduce((sum, item) => sum + item.amount, 0);
    
    // Removed dailyData.exchangeExpenses from expectedCash calculation
    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount;
    
    // Update UI elements
    document.getElementById('totalSales').textContent = dailyData.totalSales.toFixed(2);
    document.getElementById('totalExpenses').textContent = dailyData.totalExpenses.toFixed(2);
    document.getElementById('visaAmount').textContent = dailyData.visaAmount.toFixed(2);
    document.getElementById('creditAmount').textContent = dailyData.creditAmount.toFixed(2);
    
    document.getElementById('summaryTotalSales').textContent = dailyData.totalSales.toFixed(2);
    document.getElementById('summaryTotalExpenses').textContent = dailyData.totalExpenses.toFixed(2);
    document.getElementById('summaryExpectedCash').textContent = expectedCash.toFixed(2);
    document.getElementById('summaryActualCash').textContent = dailyData.drawerAmount.toFixed(2); // Will be updated by calculateDrawer
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
    
    // Removed dailyData.exchangeExpenses from expectedCash calculation
    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount;
    const difference = drawerAmount - expectedCash;
    
    let resultMessage = `
        <div class="drawer-result">
            <p><strong>الكاش المتوقع:</strong> ${expectedCash.toFixed(2)} جنيه</p>
            <p><strong>الكاش الفعلي في الدرج:</strong> ${drawerAmount.toFixed(2)} جنيه</p>
            <p><strong>الفرق:</strong> <span style="color: ${difference >= 0 ? 'green' : 'red'};">${Math.abs(difference).toFixed(2)} جنيه ${difference >= 0 ? 'زيادة' : 'نقص'}</span></p>
        </div>
    `;
    
    document.getElementById('drawerResult').innerHTML = resultMessage;
    updateStats(); // Update summary actual cash
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

    // Removed dailyData.exchangeExpenses from expectedCash calculation
    const expectedCash = dailyData.totalSales - dailyData.totalExpenses - dailyData.visaAmount - dailyData.creditAmount;
    const ourTotalSales = dailyData.totalSales; // Total sales recorded by cashier
    const ourTotalCloseout = expectedCash + dailyData.visaAmount + dailyData.creditAmount; // Total closeout based on cashier's entries

    // For cashier, we don't have NewMind total yet, so we'll leave it for accountant
    const finalData = [
        new Date().toLocaleDateString('ar-EG'),
        currentUser,
        ourTotalSales.toFixed(2),
        dailyData.totalExpenses.toFixed(2),
        dailyData.visaAmount.toFixed(2),
        dailyData.creditAmount.toFixed(2),
        0, // dailyData.exchangeExpenses.toFixed(2), // تم إزالة سكشن البدل، لذا نضع 0
        expectedCash.toFixed(2),
        drawerAmount.toFixed(2),
        ourTotalCloseout.toFixed(2), // Our calculated total closeout
        'N/A', // NewMind Total (to be filled by accountant)
        'N/A', // Difference with NewMind
        'بانتظار المحاسب', // Status
        new Date().toLocaleString('ar-EG') // Timestamp of cashier closeout
    ];
    
    const success = await saveToGoogleSheets(finalData, 'DailyCloseout');
    
    if (success) {
        showSuccessMessage('تم تقفيل اليوم بنجاح! يمكنك الآن الخروج من النظام.');
        resetDailyData();
        logout(); // Log out after successful closeout
    }
}

// Clear Expense Form
function clearExpenseForm() {
    document.getElementById('expenseInvoice').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseNotes').value = '';
    const extraFieldInput = document.getElementById('extraField');
    if (extraFieldInput) extraFieldInput.value = '';
    const extraFieldCustomerSelect = document.getElementById('extraFieldCustomerSelect');
    if (extraFieldCustomerSelect) extraFieldCustomerSelect.value = '';
    selectedCustomer = '';
    toggleExtraField(); // Reset extra field visibility
}

// Reset Daily Data Function
function resetDailyData() {
    dailyData = {
        sales: {}, expenses: [], visa: [], credit: [],
        totalSales: 0, totalExpenses: 0, visaAmount: 0, creditAmount: 0,
        drawerAmount: 0,
        // exchangeExpenses: 0 // تم إزالة سكشن البدل
    };
    usedVisaNumbers.clear();
    selectedCustomer = '';
    initializeDataStructures();
    loadSalesSectionsForCashier();
    loadCustomersForCashier();
    updateExpensesList();
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
    loadUsersListForAccountant(); // Load users for management tab
    openAccountantTab('usersTab'); // Default to users tab
}

// Function to open specific accountant tab
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
    } else if (tabName === 'closeoutTab') {
        populateCashierSelects();
    }
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

// Load Users List for Accountant Management Tab
function loadUsersListForAccountant() {
    const usersListContainer = document.getElementById('usersListContainer');
    usersListContainer.innerHTML = '';

    if (users.length === 0) {
        usersListContainer.innerHTML = '<p>لا توجد مستخدمون مسجلون.</p>';
        return;
    }

    const userList = document.createElement('ul');
    userList.className = 'users-list';
    users.forEach(user => {
        const listItem = document.createElement('li');
        listItem.className = 'user-item';
        listItem.innerHTML = `
            <span>${user.username} (${user.role})</span>
            <!-- Add edit/delete functionality here if needed -->
        `;
        userList.appendChild(listItem);
    });
    usersListContainer.appendChild(userList);
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
        loadUsersListForAccountant(); // Refresh users list
        showSuccessMessage(`تم إنشاء المستخدم ${newUsername} بنجاح.`);
        document.getElementById('newUsername').value = '';
        document.getElementById('newUserPassword').value = '';
    }
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
        sales: [], expenses: [], visa: [], credit: [],
        totalSales: 0, totalExpenses: 0, visaAmount: 0, creditAmount: 0
    };

    // Helper to filter data by cashier and date
    const filterData = (data, cashierColIndex, dateColIndex) => {
        return data.filter(row => {
            const rowDate = new Date(row[dateColIndex]);
            const rowCashier = row[cashierColIndex];
            return rowCashier === cashierUsername && rowDate >= start && rowDate < end;
        });
    };

    const allSales = await loadDataFromSheet('Sales');
    report.sales = filterData(allSales.slice(1), 2, 0); // Cashier is col 2, Date is col 0
    report.totalSales = report.sales.reduce((sum, row) => sum + parseFloat(row[5] || 0), 0); // Amount is col 5

    const allExpenses = await loadDataFromSheet('Expenses');
    report.expenses = filterData(allExpenses.slice(1), 2, 0); // Cashier is col 2, Date is col 0
    report.totalExpenses = report.expenses.reduce((sum, row) => sum + parseFloat(row[5] || 0), 0); // Amount is col 5

    const allVisa = await loadDataFromSheet('Visa');
    report.visa = filterData(allVisa.slice(1), 2, 0); // Cashier is col 2, Date is col 0
    report.visaAmount = report.visa.reduce((sum, row) => sum + parseFloat(row[4] || 0), 0); // Amount is col 4

    const allCredit = await loadDataFromSheet('Credit');
    report.credit = filterData(allCredit.slice(1), 2, 0); // Cashier is col 2, Date is col 0
    report.creditAmount = report.credit.reduce((sum, row) => sum + parseFloat(row[4] || 0), 0); // Amount is col 4

    // Exchanges are removed, so no need to calculate exchangeExpenses

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
        ${report.expenses.length > 0 ? report.expenses.map(e => `<div class="report-item">${e[3]} (${e[4]}): ${e[5]} جنيه</div>`).join('') : '<p>لا توجد مصروفات.</p>'}
        <h5>تفاصيل الفيزا:</h5>
        ${report.visa.length > 0 ? report.visa.map(v => `<div class="report-item">فاتورة #${v[3]}: ${v[4]} جنيه (فيزا: ${v[5]})</div>`).join('') : '<p>لا توجد عمليات فيزا.</p>'}
        <h5>تفاصيل الآجل:</h5>
        ${report.credit.length > 0 ? report.credit.map(c => `<div class="report-item">فاتورة #${c[3]}: ${c[4]} جنيه (عميل: ${c[5]})</div>`).join('') : '<p>لا توجد مبيعات آجلة.</p>'}
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
    let rowIndexToUpdate = -1;
    const cashierCloseout = allDailyCloseouts.slice(1).find((row, index) => {
        const entryDate = new Date(row[0]); // Assuming date is in the first column
        entryDate.setHours(0, 0, 0, 0);
        const entryCashier = row[1]; // Assuming cashier is in the second column
        if (entryCashier === cashierUsername && entryDate.getTime() === closeoutDate.getTime()) {
            rowIndexToUpdate = index + 2; // +1 for header, +1 for 0-based index
            return true;
        }
        return false;
    });

    if (!cashierCloseout) {
        alert(`لم يتم العثور على تقفيلة للكاشير ${cashierUsername} بتاريخ ${closeoutDateStr}. يرجى التأكد من أن الكاشير قام بتقفيل يومه.`);
        return;
    }

    const cashierTotalSales = parseFloat(cashierCloseout[2]);
    const cashierTotalExpenses = parseFloat(cashierCloseout[3]);
    const cashierVisaAmount = parseFloat(cashierCloseout[4]);
    const cashierCreditAmount = parseFloat(cashierCloseout[5]);
    // const cashierExchangeExpenses = parseFloat(cashierCloseout[6]); // تم إزالة سكشن البدل
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
    if (rowIndexToUpdate !== -1) {
        const updatedRowData = [...cashierCloseout]; // Copy existing data
        updatedRowData[10] = accountantNewMindTotal.toFixed(2); // Update NewMind Total
        updatedRowData[11] = differenceWithNewMind.toFixed(2); // Update Difference
        updatedRowData[12] = status; // Update Status
        updatedRowData[13] = currentUser; // Accountant who closed it
        updatedRowData[14] = new Date().toLocaleString('ar-EG'); // Timestamp of accountant closeout

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `DailyCloseout!A${rowIndexToUpdate}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [updatedRowData]
                }
            });
            showSuccessMessage('تم تقفيل حساب الكاشير بنجاح في Google Sheets.');
        } catch (err) {
            console.error('خطأ في تحديث تقفيلة الكاشير:', err);
            showErrorMessage('خطأ في تحديث تقفيلة الكاشير في Google Sheets.');
        }
    } else {
        showErrorMessage('لم يتم العثور على الصف لتحديثه.');
    }
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

    const searchInSheet = async (sheetName, invoiceColIndex, otherCols = []) => {
        const data = await loadDataFromSheet(sheetName);
        const rows = data.slice(1); // Skip header
        rows.forEach(row => {
            if (row[invoiceColIndex] === invoiceNumber) {
                found = true;
                resultHtml += `<div class="report-item"><strong>الورقة:</strong> ${sheetName}<br>`;
                resultHtml += `<strong>التاريخ:</strong> ${row[0]}، <strong>الوقت:</strong> ${row[1]}، <strong>الكاشير:</strong> ${row[2]}<br>`;
                resultHtml += `<strong>رقم الفاتورة:</strong> ${row[invoiceColIndex]}، <strong>القيمة:</strong> ${row[invoiceColIndex + 1]} جنيه<br>`;
                otherCols.forEach(col => {
                    if (row[col.index]) resultHtml += `<strong>${col.label}:</strong> ${row[col.index]}<br>`;
                });
                resultHtml += `<strong>ملاحظات:</strong> ${row[row.length - 1] || 'لا توجد'}</div>`;
            }
        });
    };

    // Define column indices based on your Google Sheet structure
    // Sales: Date, Time, Cashier, Section, Invoice, Amount, Notes
    await searchInSheet('Sales', 4); 
    // Expenses: Date, Time, Cashier, Type, Invoice, Amount, Notes, ExtraField
    await searchInSheet('Expenses', 4, [{label: 'النوع', index: 3}, {label: 'تفاصيل إضافية', index: 7}]);
    // Visa: Date, Time, Cashier, Invoice, Amount, VisaNumber, Notes
    await searchInSheet('Visa', 3, [{label: 'رقم الفيزا', index: 5}]); 
    // Credit: Date, Time, Cashier, Invoice, Amount, Customer, Notes
    await searchInSheet('Credit', 3, [{label: 'العميل', index: 5}]); 
    // Exchanges: Removed from search
    // await searchInSheet('Exchanges', 3, [ 
    //     {label: 'قيمة أصلية', index: 4},
    //     {label: 'فاتورة بدل', index: 5},
    //     {label: 'قيمة بدل', index: 6},
    //     {label: 'الفرق', index: 7}
    // ]);

    if (!found) {
        resultHtml += '<p>لم يتم العثور على فاتورة بهذا الرقم.</p>';
    }
    searchResultDiv.innerHTML = resultHtml;
}


// --- Utility Functions ---

function showSuccessMessage(message) {
    console.log('Success:', message);
    alert(message); // For a more visible notification
}

function showErrorMessage(message) {
    console.error('Error:', message);
    alert(message); // For a more visible notification
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
