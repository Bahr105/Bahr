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

// متغيرات للتحكم في التنقل في نتائج البحث
let currentSearchResults = [];
let selectedSearchIndex = -1;

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

    // 2. التحقق مما إذا كان هناك أي نافذة منبثقة (modal) مفتوحة حاليًا
    //    إذا كان هناك مودال مفتوح غير مودال إضافة المصروف، لا تفعل شيئًا
    const activeModals = document.querySelectorAll('.modal.active');
    if (activeModals.length > 0 && activeModals[0].id !== 'addExpenseModal') {
        return;
    }

    // 3. اختصار Ctrl + Shift + z: لفتح نافذة إضافة مصروف جديد وتثبيتها
    if (event.ctrlKey && event.shiftKey && event.key === 'Z') {
        event.preventDefault(); // منع السلوك الافتراضي للمتصفح
        showAddExpenseModal();
        
        // تثبيت النافذة إذا كانت متاحة
        const addExpenseModal = document.getElementById('addExpenseModal');
        if (addExpenseModal) {
            addExpenseModal.classList.add('pinned');
        }
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

    // 5. التنقل في نتائج البحث باستخدام الأسهم واختيارها بـ Enter
    handleSearchNavigation(event);
}

/**
 * Handles keyboard navigation in search results
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleSearchNavigation(event) {
    const searchResults = document.querySelectorAll('.search-results li, .autocomplete-items div');
    
    if (searchResults.length === 0) {
        return;
    }

    // تحديث القائمة الحالية للنتائج
    currentSearchResults = Array.from(searchResults);
    
    switch(event.key) {
        case 'ArrowDown':
            event.preventDefault();
            selectedSearchIndex = Math.min(selectedSearchIndex + 1, currentSearchResults.length - 1);
            updateSelectedSearchResult();
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            selectedSearchIndex = Math.max(selectedSearchIndex - 1, 0);
            updateSelectedSearchResult();
            break;
            
        case 'Enter':
            if (selectedSearchIndex >= 0 && selectedSearchIndex < currentSearchResults.length) {
                event.preventDefault();
                currentSearchResults[selectedSearchIndex].click();
                clearSearchSelection();
            }
            break;
            
        case 'Escape':
            clearSearchSelection();
            break;
    }
}

/**
 * Updates the visual selection in search results
 */
function updateSelectedSearchResult() {
    currentSearchResults.forEach((result, index) => {
        if (index === selectedSearchIndex) {
            result.classList.add('selected');
            result.scrollIntoView({ block: 'nearest' });
        } else {
            result.classList.remove('selected');
        }
    });
}

/**
 * Clears search selection
 */
function clearSearchSelection() {
    selectedSearchIndex = -1;
    currentSearchResults.forEach(result => {
        result.classList.remove('selected');
    });
    currentSearchResults = [];
}

/**
 * Initializes search functionality with keyboard navigation
 * @param {string} searchInputId - ID of the search input element
 * @param {string} resultsContainerId - ID of the results container element
 * @param {Function} searchFunction - Function to perform the search
 */
function initializeSearchWithNavigation(searchInputId, resultsContainerId, searchFunction) {
    const searchInput = document.getElementById(searchInputId);
    const resultsContainer = document.getElementById(resultsContainerId);
    
    if (!searchInput || !resultsContainer) return;
    
    searchInput.addEventListener('input', (e) => {
        searchFunction(e.target.value);
        selectedSearchIndex = -1;
        currentSearchResults = Array.from(resultsContainer.querySelectorAll('li, div'));
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
            handleSearchNavigation(e);
        }
    });
    
    // إعادة تعيين عند فقدان التركيز
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            clearSearchSelection();
        }, 200);
    });
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
window.initializeSearchWithNavigation = initializeSearchWithNavigation;
window.handleSearchNavigation = handleSearchNavigation;
window.updateSelectedSearchResult = updateSelectedSearchResult;
window.clearSearchSelection = clearSearchSelection;

// CSS إضافي يمكن إضافته للتنسيق
const additionalStyles = `
    .search-results li.selected,
    .autocomplete-items div.selected {
        background-color: #007bff;
        color: white;
    }
    
    .modal.pinned {
        z-index: 9999 !important;
    }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
