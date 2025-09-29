// --- Main Application Entry Point ---

document.addEventListener('DOMContentLoaded', async () => {
    // Setup modal closing behavior
    setupModalCloseOnOutsideClick();

    // Load Google Scripts and initial data
    try {
        await loadGoogleScripts();
    } catch (error) {
        console.error('Failed to load Google Scripts:', error);
        showMessage('فشل تحميل الخدمات الخارجية. يرجى إعادة تحميل الصفحة.', 'error');
    }

    // Set default dates and times for inputs
    setDefaultDatesAndTimes();

    // Hide non-default pages
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');

    // Add event listeners for close buttons in modals
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

// إضافة مستمع لحدث الضغط على لوحة المفاتيح لتشغيل الاختصارات
        document.addEventListener('keydown', handleKeyboardShortcuts);

    console.log('DOM loaded and initialized successfully.');
});



/**
 * Handles keyboard shortcuts for the application.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleKeyboardShortcuts(event) {
    // 1. التحقق مما إذا كانت صفحة الكاشير هي النشطة حاليًا
    const cashierPage = document.getElementById('cashierPage');
    if (!cashierPage || !cashierPage.classList.contains('active')) {
        return; // إذا لم تكن صفحة الكاشير نشطة، لا تفعل شيئًا
    }

   

    // 3. اختصار Ctrl + z: لفتح نافذة إضافة مصروف جديد
    if (event.ctrlKey && event.key === 'z') {
        event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل تحديد كل النص)
        showAddExpenseModal(); // استدعاء الدالة التي تفتح نافذة إضافة المصروف
    }

    // 4. اختصار Ctrl + S: لحفظ المصروف (إذا كانت نافذة إضافة المصروف مفتوحة)
    if (event.ctrlKey && event.key === 's') {
        const addExpenseModal = document.getElementById('addExpenseModal');
        // التحقق مما إذا كانت نافذة إضافة المصروف مفتوحة ونشطة
        if (addExpenseModal && addExpenseModal.classList.contains('active')) {
            event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل حفظ الصفحة)
            const saveButton = document.getElementById('addExpenseModalSaveBtn');
            if (saveButton) {
                saveButton.click(); // محاكاة النقر على زر الحفظ
            }
        }
    }
}


// --- Global Error Handling ---
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // showMessage('حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.', 'error'); // Can be annoying
});

// --- Expose global functions for HTML event handlers ---
// This is necessary because HTML event attributes (like onclick) look for functions in the global scope.
// If you were using modern event listeners (addEventListener) exclusively, this might not be needed.
window.login = login;
window.logout = logout;
window.togglePasswordVisibility = togglePasswordVisibility;
window.showTab = showTab;
window.showCashierPage = showCashierPage;
window.showAccountantPage = showAccountantPage;
window.setDefaultDatesAndTimes = setDefaultDatesAndTimes;
window.displayCategories = displayCategories;
window.verifyModificationPassword = verifyModificationPassword;
window.showAddCategoryModal = showAddCategoryModal;
window.showEditCategoryModal = showEditCategoryModal;
window.addCustomFieldToEditor = addCustomFieldToEditor;
window.toggleOptionsInput = toggleOptionsInput;
window.addCategory = addCategory;
window.updateCategory = updateCategory;
window.deleteCategory = deleteCategory;
window.showAddExpenseModal = showAddExpenseModal;
window.showEditExpenseModal = showEditExpenseModal;
window.searchExpenseCategories = searchExpenseCategories;
window.selectExpenseCategory = selectExpenseCategory;
window.generateDynamicExpenseForm = generateDynamicExpenseForm;
window.searchCustomersForExpense = searchCustomersForExpense;
window.selectCustomerForExpense = selectCustomerForExpense;
window.showAddCustomerModalFromExpense = showAddCustomerModalFromExpense;
window.searchEmployeesForExpense = searchEmployeesForExpense;
window.selectEmployeeForExpense = selectEmployeeForExpense;
window.showAddEmployeeModalFromExpense = showAddEmployeeModalFromExpense;
window.addExpense = addExpense;
window.updateExpense = updateExpense;
window.deleteExpense = deleteExpense;
window.loadCashierExpenses = loadCashierExpenses;
window.displayCashierExpensesTable = displayCashierExpensesTable;
window.populateExpenseCategoryFilter = populateExpenseCategoryFilter;
window.filterCashierExpenses = filterCashierExpenses;
window.clearCashierExpenseFilters = clearCashierExpenseFilters;
window.displayCustomers = displayCustomers;
window.viewCustomerDetails = viewCustomerDetails;
window.processCustomerPayment = processCustomerPayment;
window.showAddCustomerModal = showAddCustomerModal;
window.showEditCustomerModal = showEditCustomerModal;
window.addCustomer = addCustomer;
window.updateCustomer = updateCustomer;
window.deleteCustomer = deleteCustomer;
window.displayEmployees = displayEmployees;
window.viewEmployeeDetails = viewEmployeeDetails;
window.processEmployeePayment = processEmployeePayment;
window.showAddEmployeeModal = showAddEmployeeModal;
window.showEditEmployeeModal = showEditEmployeeModal;
window.addEmployee = addEmployee;
window.updateEmployee = updateEmployee;
window.deleteEmployee = deleteEmployee;
window.deleteUser = deleteUser;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
window.calculateCashierShift = calculateCashierShift;
window.finalizeCashierShiftCloseout = finalizeCashierShiftCloseout;
window.loadCashierPreviousClosures = loadCashierPreviousClosures;
window.populateAccountantFilters = populateAccountantFilters;
window.populateAccountantShiftCashierFilter = populateAccountantShiftCashierFilter;
window.updateAccountantDashboard = updateAccountantDashboard;
window.updateAccountantCashierOverview = updateAccountantCashierOverview;
window.searchInvoiceAccountant = searchInvoiceAccountant;
window.populateReportFilters = populateReportFilters;
window.generateAccountantReport = generateAccountantReport;
window.print

// --- Main Application Entry Point ---

document.addEventListener('DOMContentLoaded', async () => {
    // Setup modal closing behavior
    setupModalCloseOnOutsideClick();

    // Load Google Scripts and initial data
    try {
        await loadGoogleScripts();
    } catch (error) {
        console.error('Failed to load Google Scripts:', error);
        showMessage('فشل تحميل الخدمات الخارجية. يرجى إعادة تحميل الصفحة.', 'error');
    }

    // Set default dates and times for inputs
    setDefaultDatesAndTimes();

    // Hide non-default pages
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');

    // Add event listeners for close buttons in modals
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

// إضافة مستمع لحدث الضغط على لوحة المفاتيح لتشغيل الاختصارات
        document.addEventListener('keydown', handleKeyboardShortcuts);

    console.log('DOM loaded and initialized successfully.');
});



/**
 * Handles keyboard shortcuts for the application.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleKeyboardShortcuts(event) {
    // 1. التحقق مما إذا كانت صفحة الكاشير هي النشطة حاليًا
    const cashierPage = document.getElementById('cashierPage');
    if (!cashierPage || !cashierPage.classList.contains('active')) {
        return; // إذا لم تكن صفحة الكاشير نشطة، لا تفعل شيئًا
    }


    // 3. اختصار Ctrl + z: لفتح نافذة إضافة مصروف جديد
    if (event.ctrlKey && event.key === 'z') {
        event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل تحديد كل النص)
        showAddExpenseModal(); // استدعاء الدالة التي تفتح نافذة إضافة المصروف
    }

    // 4. اختصار Ctrl + S: لحفظ المصروف (إذا كانت نافذة إضافة المصروف مفتوحة)
    if (event.ctrlKey && event.key === 's') {
        const addExpenseModal = document.getElementById('addExpenseModal');
        // التحقق مما إذا كانت نافذة إضافة المصروف مفتوحة ونشطة
        if (addExpenseModal && addExpenseModal.classList.contains('active')) {
            event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل حفظ الصفحة)
            const saveButton = document.getElementById('addExpenseModalSaveBtn');
            if (saveButton) {
                saveButton.click(); // محاكاة النقر على زر الحفظ
            }
        }
    }
}


// --- Global Error Handling ---
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // showMessage('حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.', 'error'); // Can be annoying
});

// --- Expose global functions for HTML event handlers ---
// This is necessary because HTML event attributes (like onclick) look for functions in the global scope.
// If you were using modern event listeners (addEventListener) exclusively, this might not be needed.
window.login = login;
window.logout = logout;
window.togglePasswordVisibility = togglePasswordVisibility;
window.showTab = showTab;
window.showCashierPage = showCashierPage;
window.showAccountantPage = showAccountantPage;
window.setDefaultDatesAndTimes = setDefaultDatesAndTimes;
window.displayCategories = displayCategories;
window.verifyModificationPassword = verifyModificationPassword;
window.showAddCategoryModal = showAddCategoryModal;
window.showEditCategoryModal = showEditCategoryModal;
window.addCustomFieldToEditor = addCustomFieldToEditor;
window.toggleOptionsInput = toggleOptionsInput;
window.addCategory = addCategory;
window.updateCategory = updateCategory;
window.deleteCategory = deleteCategory;
window.showAddExpenseModal = showAddExpenseModal;
window.showEditExpenseModal = showEditExpenseModal;
window.searchExpenseCategories = searchExpenseCategories;
window.selectExpenseCategory = selectExpenseCategory;
window.generateDynamicExpenseForm = generateDynamicExpenseForm;
window.searchCustomersForExpense = searchCustomersForExpense;
window.selectCustomerForExpense = selectCustomerForExpense;
window.showAddCustomerModalFromExpense = showAddCustomerModalFromExpense;
window.searchEmployeesForExpense = searchEmployeesForExpense;
window.selectEmployeeForExpense = selectEmployeeForExpense;
window.showAddEmployeeModalFromExpense = showAddEmployeeModalFromExpense;
window.addExpense = addExpense;
window.updateExpense = updateExpense;
window.deleteExpense = deleteExpense;
window.loadCashierExpenses = loadCashierExpenses;
window.displayCashierExpensesTable = displayCashierExpensesTable;
window.populateExpenseCategoryFilter = populateExpenseCategoryFilter;
window.filterCashierExpenses = filterCashierExpenses;
window.clearCashierExpenseFilters = clearCashierExpenseFilters;
window.displayCustomers = displayCustomers;
window.viewCustomerDetails = viewCustomerDetails;
window.processCustomerPayment = processCustomerPayment;
window.showAddCustomerModal = showAddCustomerModal;
window.showEditCustomerModal = showEditCustomerModal;
window.addCustomer = addCustomer;
window.updateCustomer = updateCustomer;
window.deleteCustomer = deleteCustomer;
window.displayEmployees = displayEmployees;
window.viewEmployeeDetails = viewEmployeeDetails;
window.processEmployeePayment = processEmployeePayment;
window.showAddEmployeeModal = showAddEmployeeModal;
window.showEditEmployeeModal = showEditEmployeeModal;
window.addEmployee = addEmployee;
window.updateEmployee = updateEmployee;
window.deleteEmployee = deleteEmployee;
window.deleteUser = deleteUser;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
window.calculateCashierShift = calculateCashierShift;
window.finalizeCashierShiftCloseout = finalizeCashierShiftCloseout;
window.loadCashierPreviousClosures = loadCashierPreviousClosures;
window.populateAccountantFilters = populateAccountantFilters;
window.populateAccountantShiftCashierFilter = populateAccountantShiftCashierFilter;
window.updateAccountantDashboard = updateAccountantDashboard;
window.updateAccountantCashierOverview = updateAccountantCashierOverview;
window.searchInvoiceAccountant = searchInvoiceAccountant;
window.populateReportFilters = populateReportFilters;
window.generateAccountantReport = generateAccountantReport;
window.print
// محتوى main.js الأصلي اللي رفعته انت
// (أنا مش هغير فيه أي سطر، بس هضيف في الآخر التعديلات المطلوبة)


// ------------------ [إضافات جديدة] ------------------
// Ctrl+Shift+Z: فتح وتثبيت القائمة
const MENU_PIN_STORAGE_KEY = 'app_menu_pinned_state';

function getMenuElement() {
  return document.getElementById('sideMenu') || document.getElementById('mainMenu') || document.getElementById('appMenu');
}

function togglePinMenu() {
  const menu = getMenuElement();
  if (!menu) return;
  const pinned = menu.classList.toggle('pinned');
  menu.classList.add('open');
  localStorage.setItem(MENU_PIN_STORAGE_KEY, pinned ? '1' : '0');
}

function restoreMenuPinState() {
  const menu = getMenuElement();
  if (!menu) return;
  const pinned = localStorage.getItem(MENU_PIN_STORAGE_KEY) === '1';
  if (pinned) menu.classList.add('pinned', 'open');
}

function handlePinShortcut(e) {
  if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    togglePinMenu();
  }
}

document.addEventListener('DOMContentLoaded', restoreMenuPinState);
document.addEventListener('keydown', handlePinShortcut);

// ------------------ [Autocomplete] ------------------
function initGlobalSearchBoxes() {
  const inputs = document.querySelectorAll('input.search-box');
  inputs.forEach(setupSearchBox);
}

function setupSearchBox(input) {
  if (input._autocompleteInitialized) return;
  input._autocompleteInitialized = true;

  const container = document.createElement('div');
  container.className = 'search-suggestions';
  container.style.position = 'absolute';
  container.style.zIndex = 9999;
  container.style.display = 'none';
  container.style.background = '#fff';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '6px';
  input.parentNode.insertBefore(container, input.nextSibling);

  let suggestions = [];
  let focusedIndex = -1;

  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) return (container.style.display = 'none');

    const cats = await getCategoriesList();
    suggestions = cats.filter(c => c.name.toLowerCase().includes(q)).slice(0, 20);
    renderSuggestions();
  });

  input.addEventListener('keydown', e => {
    if (container.style.display === 'none') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % suggestions.length;
      highlightItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + suggestions.length) % suggestions.length;
      highlightItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0) chooseSuggestion(suggestions[focusedIndex]);
    }
  });

  function renderSuggestions() {
    container.innerHTML = '';
    focusedIndex = -1;
    if (suggestions.length === 0) return (container.style.display = 'none');
    suggestions.forEach((item, i) => {
      const row = document.createElement('div');
      row.textContent = item.name;
      row.style.padding = '6px 10px';
      row.style.cursor = 'pointer';
      row.addEventListener('mousedown', e => {
        e.preventDefault();
        chooseSuggestion(item);
      });
      container.appendChild(row);
    });
    container.style.display = 'block';
  }

  function highlightItem() {
    [...container.children].forEach((el, i) => {
      el.style.background = i === focusedIndex ? '#eee' : '';
    });
  }

  function chooseSuggestion(item) {
    input.value = item.name;
    container.style.display = 'none';
    if (typeof window.selectExpenseCategory === 'function') {
      window.selectExpenseCategory(item);
    }
  }
}

async function getCategoriesList() {
  if (Array.isArray(window.categories)) return window.categories;
  const domItems = document.querySelectorAll('.category-item');
  return Array.from(domItems).map(el => ({
    id: el.dataset.id || el.textContent.trim(),
    name: el.textContent.trim()
  }));
}

document.addEventListener('DOMContentLoaded', initGlobalSearchBoxes);
