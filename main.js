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

    // إضافة مستمع لحدث الضغط على لوحة المفاتيح لتحسين البحث
    document.addEventListener('keydown', handleSearchNavigation);

    console.log('DOM loaded and initialized successfully.');
});

// متغير لتتبع ما إذا كانت نافذة المصروفات مثبتة
let isAddExpenseModalPinned = false;

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
    //    **تعديل: تجاهل هذا الشرط إذا كانت نافذة المصروفات مثبتة**
    const activeModals = document.querySelectorAll('.modal.active');
    if (activeModals.length > 0 && activeModals[0].id !== 'addExpenseModal' && !isAddExpenseModalPinned) {
        return;
    }

    // 3. اختصار Ctrl + Shift + z: لفتح نافذة إضافة مصروف جديد وتثبيتها
    if (event.ctrlKey && event.shiftKey && event.key === 'Z') { // 'Z' for Shift + z
        event.preventDefault(); // منع السلوك الافتراضي للمتصفح
        showAddExpenseModal(); // استدعاء الدالة التي تفتح نافذة إضافة المصروف
        isAddExpenseModalPinned = true; // تثبيت النافذة
        console.log('Add Expense Modal Pinned: ', isAddExpenseModalPinned);
        return; // لا تنفذ أي اختصارات أخرى بعد فتح وتثبيت النافذة
    }

    // 4. اختصار Ctrl + z: لفتح نافذة إضافة مصروف جديد (إذا لم تكن مثبتة)
    //    **تعديل: هذا الاختصار سيعمل فقط إذا لم تكن النافذة مثبتة بالفعل**
    if (event.ctrlKey && event.key === 'z' && !isAddExpenseModalPinned) {
        event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل تحديد كل النص)
        showAddExpenseModal(); // استدعاء الدالة التي تفتح نافذة إضافة المصروف
    }

    // 5. اختصار Ctrl + S: لحفظ المصروف (إذا كانت نافذة إضافة المصروف مفتوحة)
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

/**
 * Handles keyboard navigation for search results (Arrow Up/Down, Enter).
 * This function needs to be integrated with your specific search result display logic.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleSearchNavigation(event) {
    const activeElement = document.activeElement;

    // Check if the active element is a search input field
    // You might need to adjust the selector based on your actual input fields
    if (activeElement && activeElement.classList.contains('search-input')) {
        const searchResultsContainer = activeElement.nextElementSibling; // Assuming results are next to input
        if (!searchResultsContainer || !searchResultsContainer.classList.contains('search-results-list')) {
            return; // Not a search input with a results container
        }

        const resultItems = searchResultsContainer.querySelectorAll('.search-result-item');
        if (resultItems.length === 0) {
            return; // No results to navigate
        }

        let currentIndex = -1;
        const activeResult = searchResultsContainer.querySelector('.search-result-item.active');
        if (activeResult) {
            currentIndex = Array.from(resultItems).indexOf(activeResult);
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (currentIndex < resultItems.length - 1) {
                if (activeResult) activeResult.classList.remove('active');
                resultItems[currentIndex + 1].classList.add('active');
                resultItems[currentIndex + 1].scrollIntoView({ block: 'nearest' });
            } else { // Wrap around to the first item
                if (activeResult) activeResult.classList.remove('active');
                resultItems[0].classList.add('active');
                resultItems[0].scrollIntoView({ block: 'nearest' });
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (currentIndex > 0) {
                if (activeResult) activeResult.classList.remove('active');
                resultItems[currentIndex - 1].classList.add('active');
                resultItems[currentIndex - 1].scrollIntoView({ block: 'nearest' });
            } else { // Wrap around to the last item
                if (activeResult) activeResult.classList.remove('active');
                resultItems[resultItems.length - 1].classList.add('active');
                resultItems[resultItems.length - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (activeResult) {
                // Simulate click on the active result
                activeResult.click();
            } else {
                // If no result is active, select the first one
                resultItems[0].click();
            }
            // Optionally, hide the search results after selection
            searchResultsContainer.style.display = 'none';
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
