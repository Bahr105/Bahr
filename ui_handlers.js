// --- UI Interaction Functions ---

/**
 * Displays a message to the user.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'warning'|'error'} type - The type of message.
 */
function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;

    // Remove previous messages after a delay
    const existingMessages = messageContainer.querySelectorAll('.message');
    existingMessages.forEach(msg => {
        setTimeout(() => msg.remove(), 5000);
    });

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    messageDiv.onclick = () => messageDiv.remove(); // Close on click

    messageContainer.appendChild(messageDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

/**
 * Shows or hides the loading overlay.
 * @param {boolean} show - True to show, false to hide.
 */
function showLoading(show = true) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }
}

/**
 * Closes a modal by its ID.
 * @param {string} modalId - The ID of the modal to close.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Sets up event listeners to close modals when clicking outside of them.
 */
function setupModalCloseOnOutsideClick() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // If the expense form is pinned, do not close the modal
                const pinToggle = document.getElementById('pinExpenseFormToggle');
                if (modal.id === 'addExpenseModal' && pinToggle && pinToggle.checked) {
                    return;
                }
                closeModal(modal.id);
            }
        });
    });
}

/**
 * Sets default dates and times for various input fields.
 */
function setDefaultDatesAndTimes() {
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const elements = [
        'shiftDateFromCashier',
        'shiftDateToCashier',
        'dashboardDateFromAccountant',
        'dashboardDateToAccountant',
        'reportDateFromAccountant',
        'reportDateToAccountant',
        'accountantShiftDateFrom',
        'accountantShiftDateTo',
        'expenseDateFromFilterCashier',
        'expenseDateToFilterCashier'
    ];

    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = today;
    });

    const timeElements = [
        'shiftTimeFromCashier',
        'shiftTimeToCashier',
        'accountantShiftTimeFrom',
        'accountantShiftTimeTo'
    ];

    timeElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = timeNow;
    });
}

/**
 * Navigates to a specific tab and loads its content.
 * @param {string} tabId - The ID of the tab to show.
 */
async function showTab(tabId) {
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.remove('active'));

    const allNavTabs = document.querySelectorAll('.nav-tab');
    allNavTabs.forEach(navTab => navTab.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    const targetNavTab = document.querySelector(`[onclick="showTab('${tabId}')"]`);
    if (targetNavTab) {
        targetNavTab.classList.add('active');
    }

    showLoading(true);
    try {
        if (tabId === 'categoriesTabCashier' || tabId === 'categoriesTabAccountant') {
            await loadCategories();
            await loadCategoryCustomFields();
            displayCategories(tabId === 'categoriesTabCashier' ? 'categoriesGridCashier' : 'categoriesGridAccountant');
        } else if (tabId === 'expensesTabCashier') {
            await loadCategories();
            await loadCategoryCustomFields();
            await loadCustomers();
            await loadEmployees();
            await loadCashierExpenses();
            populateExpenseCategoryFilter();
        } else if (tabId === 'customersTabCashier') {
            await loadCustomers();
            displayCustomers('customersTableBodyCashier');
        } else if (tabId === 'employeesTabCashier') {
            await loadEmployees();
            displayEmployees('employeesTableBodyCashier');
        } else if (tabId === 'customersTabAccountant') {
            await loadCustomers();
            displayCustomers('customersTableBodyAccountant');
            const customerDetailsAccountant = document.getElementById('customerDetailsAccountant');
            if (customerDetailsAccountant) {
                customerDetailsAccountant.style.display = 'none';
            }
        } else if (tabId === 'employeesTabAccountant') {
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            const employeeDetailsAccountant = document.getElementById('employeeDetailsAccountant');
            if (employeeDetailsAccountant) {
                employeeDetailsAccountant.style.display = 'none';
            }
        } else if (tabId === 'dashboardTabAccountant') {
            await loadUsers();
            await loadCategories();
            await loadCustomers();
            await loadEmployees();
            populateAccountantFilters();
            await updateAccountantDashboard();
        } else if (tabId === 'usersTabAccountant') {
            await loadUsers();
            displayUsers();
        } else if (tabId === 'reportsTabAccountant') {
            await loadUsers();
            await loadCategories();
            populateReportFilters();
            document.getElementById('reportContentAccountant').innerHTML = '<p>يرجى تحديد معايير التقرير والضغط على "إنشاء التقرير".</p>';
        } else if (tabId === 'shiftCloseTabAccountant') {
            await loadUsers();
            await loadCategories();
            populateAccountantShiftCashierFilter();
            await loadAccountantShiftClosuresHistory();
            resetAccountantShiftForm();
        } else if (tabId === 'shiftCloseTabCashier') {
            await loadCategories();
            await loadCashierPreviousClosures();
            setDefaultDatesAndTimes();
        }
    } catch (error) {
        console.error('Error showing tab:', error);
        showMessage('حدث خطأ أثناء تحميل محتوى علامة التبويب.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Verifies a modification password.
 * @returns {boolean} True if the password is correct, false otherwise.
 */
async function verifyModificationPassword() {
    const password = prompt('يرجى إدخال كلمة المرور للتعديل أو الحذف:');
    if (password === MODIFICATION_PASSWORD) {
        return true;
    } else {
        showMessage('كلمة المرور غير صحيحة.', 'error');
        return false;
    }
}

/**
 * Toggles the visibility of a password input field.
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.querySelector('.show-password i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.classList.remove('fa-eye');
        toggleButton.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleButton.classList.remove('fa-eye-slash');
        toggleButton.classList.add('fa-eye');
    }
}

/**
 * Checks if a date string is valid (YYYY-MM-DD).
 * @param {string} dateString - The date string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Checks if a time string is valid (HH:MM or HH:MM:SS).
 * @param {string} timeString - The time string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
function isValidTime(timeString) {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    return regex.test(timeString);
}

/**
 * Normalizes a time string to HH:MM:SS format.
 * Handles 12-hour (AM/PM) and 24-hour formats.
 * @param {string} timeStr - The time string to normalize.
 * @returns {string} The normalized time string in HH:MM:SS format.
 */
function normalizeTimeToHHMMSS(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return '00:00:00';
    }
    
    // If time is already in 24-hour format (HH:MM or HH:MM:SS)
    if (timeStr.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)) {
        const parts = timeStr.split(':');
        if (parts.length === 3) return timeStr;
        if (parts.length === 2) return timeStr + ':00';
        return '00:00:00';
    }
    
    // Convert from AM/PM to 24-hour
    try {
        let period = '';
        let timePart = timeStr.trim();
        
        // Extract AM/PM period if present (Arabic 'ص'/'م')
        if (timeStr.includes('ص') || timeStr.includes('م')) {
            const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(ص|م)/);
            if (match) {
                timePart = match[1] + ':' + match[2] + (match[3] ? ':' + match[3] : '');
                period = match[4];
            }
        }
        
        let [hours, minutes, seconds = '00'] = timePart.split(':').map(Number);
        
        if (isNaN(hours) || isNaN(minutes)) {
            return '00:00:00';
        }
        
        // Convert to 24-hour format
        if (period.includes('م') && hours !== 12) {
            hours += 12;
        } else if (period.includes('ص') && hours === 12) {
            hours = 0;
        }
        
        // Ensure numbers are within valid range
        hours = Math.max(0, Math.min(23, hours));
        minutes = Math.max(0, Math.min(59, minutes));
        seconds = Math.max(0, Math.min(59, seconds));
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error('Error normalizing time:', error, timeStr);
        return '00:00:00';
    }
}