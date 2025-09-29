// --- Keyboard Shortcuts Functions ---

/**
 * Initializes keyboard shortcuts for the application
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    setupSearchSuggestionNavigation();
}

/**
 * Handles all keyboard shortcuts in the application
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardShortcuts(event) {
    // Prevent Chrome default shortcuts that conflict with our app
    preventChromeDefaultShortcuts(event);
    
    // Ignore shortcuts when user is typing in input fields
    if (isInputField(event.target)) {
        handleInputFieldShortcuts(event);
        return;
    }

    // Global shortcuts (when not in input fields)
    handleGlobalShortcuts(event);
}

/**
 * Prevents Chrome default shortcuts that conflict with our application
 * @param {KeyboardEvent} event - The keyboard event
 */
function preventChromeDefaultShortcuts(event) {
    const key = event.key.toLowerCase();
    
    // Prevent Chrome shortcuts that we want to use in our app
    const conflicts = [
        // Ctrl+P (Print) - we use for pinned expense
        { ctrl: true, key: 'p', prevent: true },
        // Ctrl+N (New Window) - we use for new expense
        { ctrl: true, key: 'n', prevent: true },
        // F1 (Chrome Help) - we use for app help
        { key: 'f1', prevent: true },
        // F3 (Search) - we use for new expense
        { key: 'f3', prevent: true },
        // F4 (Address bar) - we use for pinned expense
        { key: 'f4', prevent: true },
        // Alt+D (Address bar) - we use for navigation
        { alt: true, key: 'd', prevent: true },
        // Alt+1-9 (Tab switching) - we use for section navigation
        { alt: true, key: '1', prevent: true },
        { alt: true, key: '2', prevent: true },
        { alt: true, key: '3', prevent: true },
        { alt: true, key: '4', prevent: true },
        // Ctrl+S (Save Page) - we use for saving data
        { ctrl: true, key: 's', prevent: true },
        // Ctrl+R (Reload) - we use for refreshing view
        { ctrl: true, key: 'r', prevent: true },
        // Ctrl+F (Find) - we use for quick search
        { ctrl: true, key: 'f', prevent: true },
        // Ctrl+H (History) - we use for help
        { ctrl: true, key: 'h', prevent: true },
        // Space (Scroll down) - we use for quick action
        { key: ' ', prevent: true, checkModifiers: false } // Prevent default space behavior globally
    ];

    conflicts.forEach(conflict => {
        const ctrlMatch = !('ctrl' in conflict) || (conflict.ctrl === (event.ctrlKey || event.metaKey));
        const altMatch = !('alt' in conflict) || (conflict.alt === event.altKey);
        const shiftMatch = !('shift' in conflict) || (conflict.shift === event.shiftKey);
        const keyMatch = conflict.key === key || conflict.key === event.key;
        
        // Special handling for space key to prevent default scroll only if no modifiers
        if (conflict.key === ' ' && conflict.checkModifiers === false) {
            if (!event.ctrlKey && !event.altKey && !event.shiftKey && keyMatch && conflict.prevent) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        } else if (ctrlMatch && altMatch && shiftMatch && keyMatch && conflict.prevent) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    });
}

/**
 * Handles global keyboard shortcuts
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleGlobalShortcuts(event) {
    const key = event.key.toLowerCase();
    
    // Handle Escape key first - only close modals if any are open
    if (event.key === 'Escape') {
        handleEscapeKey();
        return;
    }

    // Function key shortcuts (F1-F12)
    if (key.startsWith('f') && !isNaN(key.substring(1))) {
        handleFunctionKeyShortcuts(event);
        return;
    }

    // Ctrl/Cmd based shortcuts
    if (event.ctrlKey || event.metaKey) {
        handleCtrlShortcuts(event);
        return;
    }

    // Alt based shortcuts
    if (event.altKey) {
        handleAltShortcuts(event);
        return;
    }

    // Single key shortcuts
    handleSingleKeyShortcuts(event);
}

/**
 * Handles Escape key - only closes modals if any are open
 */
function handleEscapeKey() {
    if (areAnyModalsOpen()) {
        closeAllModals();
        console.log('إغلاق النوافذ المفتوحة باستخدام Esc');
    } else {
        console.log('لا توجد نوافذ مفتوحة لإغلاقها');
        // لا تفعل anything إذا لم تكن هناك نوافذ مفتوحة
    }
}

/**
 * Checks if any modals or dialogs are currently open
 * @returns {boolean} True if any modal is open
 */
function areAnyModalsOpen() {
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
    const dropdowns = document.querySelectorAll('.dropdown-menu, .suggestions');
    
    // Check if any modal is visible
    const hasVisibleModal = Array.from(modals).some(modal => {
        return modal.style.display === 'block' || 
               modal.classList.contains('show') ||
               modal.offsetParent !== null ||
               getComputedStyle(modal).display !== 'none';
    });
    
    // Check if any dropdown is visible
    const hasVisibleDropdown = Array.from(dropdowns).some(dropdown => {
        return dropdown.style.display !== 'none' &&
               dropdown.offsetParent !== null;
    });
    
    // Check if any suggestions are visible
    const hasVisibleSuggestions = Array.from(document.querySelectorAll('.suggestions')).some(suggestion => {
        return suggestion.style.display !== 'none';
    });
    
    return hasVisibleModal || hasVisibleDropdown || hasVisibleSuggestions;
}

/**
 * Handles function key shortcuts (F1-F12)
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleFunctionKeyShortcuts(event) {
    event.preventDefault();
    event.stopPropagation();
    
    switch (event.key) {
        case 'F1':
            openHelpModal();
            break;
        case 'F2':
            openQuickSearch();
            break;
        case 'F3':
            openRegularExpenseModal();
            break;
        case 'F4':
            openPinnedExpenseModal();
            break;
        case 'F5':
            refreshCurrentView();
            break;
        case 'F9':
            toggleSidebar();
            break;
        case 'F12':
            // Leave F12 for developer tools
            break;
    }
}

/**
 * Handles Ctrl/Cmd based shortcuts
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleCtrlShortcuts(event) {
    event.preventDefault();
    event.stopPropagation();
    
    switch (event.key.toLowerCase()) {
        case 'n':
            openRegularExpenseModal();
            break;
        case 'p':
            openPinnedExpenseModal();
            break;
        case 'f':
            openQuickSearch();
            break;
        case 's':
            saveCurrentData();
            break;
        case 'r':
            refreshCurrentView();
            break;
        case 'h':
            openHelpModal();
            break;
        case 'q':
            quickLogout();
            break;
    }
}

/**
 * Handles Alt based shortcuts
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleAltShortcuts(event) {
    event.preventDefault();
    event.stopPropagation();
    
    switch (event.key) {
        case '1':
        case '١': // Arabic 1
            navigateToSection('dashboard');
            break;
        case '2':
        case '٢': // Arabic 2
            navigateToSection('expenses');
            break;
        case '3':
        case '٣': // Arabic 3
            navigateToSection('reports');
            break;
        case '4':
        case '٤': // Arabic 4
            navigateToSection('settings');
            break;
    }
}

/**
 * Handles single key shortcuts
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleSingleKeyShortcuts(event) {
    switch (event.key) {
        case ' ':
            if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
                event.preventDefault(); // Prevent default scroll behavior
                executeQuickAction();
            }
            break;
        case '/':
            event.preventDefault();
            openQuickSearch();
            break;
        case '?':
            event.preventDefault();
            openHelpModal();
            break;
    }
}

/**
 * Handles keyboard shortcuts when in input fields
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleInputFieldShortcuts(event) {
    const target = event.target;
    
    // Handle Escape key to close suggestions or clear field
    if (event.key === 'Escape') {
        // First, check if there are any open suggestions
        const hasOpenSuggestions = areAnySuggestionsOpen();
        
        if (hasOpenSuggestions) {
            // Close suggestions only
            closeAllSuggestions();
            console.log('إغلاق قوائم الاقتراحات باستخدام Esc');
        } else if (target.value.trim() !== '') {
            // Clear field if it has content
            target.value = '';
            console.log('مسح محتوى الحقل باستخدام Esc');
        } else {
            // If field is empty and no suggestions, blur the field
            target.blur();
            console.log('الخروج من الحقل باستخدام Esc');
        }
        
        event.preventDefault();
        return;
    }
    
    // Handle Enter key in search fields
    if (event.key === 'Enter') {
        handleEnterKeyInSearch(target);
        event.preventDefault(); // Prevent form submission if handled
        return;
    }
    
    // Handle arrow keys in search suggestion lists
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
        handleArrowKeysInSearch(target, event);
        return;
    }
    
    // Ctrl+Enter to submit forms from any input
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submitParentForm(target);
        return;
    }
    
    // Ctrl+/ for quick help while in input fields
    if (event.key === '/' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        openHelpModal();
        return;
    }
}

/**
 * Checks if any suggestion dropdowns are open
 * @returns {boolean} True if any suggestions are visible
 */
function areAnySuggestionsOpen() {
    const suggestions = document.querySelectorAll('.suggestions');
    return Array.from(suggestions).some(suggestion => 
        suggestion.style.display !== 'none' && 
        suggestion.offsetParent !== null
    );
}

/**
 * Checks if the target element is an input field
 * @param {Element} target - The target element
 * @returns {boolean} True if it's an input field
 */
function isInputField(target) {
    const inputTypes = ['input', 'textarea', 'select'];
    const isInput = inputTypes.includes(target.tagName.toLowerCase());
    const isContentEditable = target.isContentEditable;
    const isSearchField = target.type === 'search';
    
    return isInput || isContentEditable || isSearchField;
}

// --- Application Functions ---

/**
 * Opens the regular expense modal (F3 or Ctrl+N)
 */
function openRegularExpenseModal() {
    if (typeof currentUserRole === 'undefined' || currentUserRole === 'كاشير' || currentUserRole === 'محاسب') {
        if (typeof showAddExpenseModal === 'function') {
            showAddExpenseModal();
            console.log('فتح modal المصروف العادي');
        } else {
            showMessage('وظيفة إضافة المصروفات غير متاحة.', 'error');
        }
    } else {
        showMessage('ليس لديك الصلاحية لإضافة مصروفات.', 'error');
    }
}

/**
 * Opens the pinned expense modal (F4 or Ctrl+P)
 */
function openPinnedExpenseModal() {
    if (typeof currentUserRole === 'undefined' || currentUserRole === 'كاشير' || currentUserRole === 'محاسب') {
        if (typeof showAddExpenseModal === 'function') {
            showAddExpenseModal();
            console.log('فتح modal المصروف المثبت');
            // Auto-check the pin toggle
            setTimeout(() => {
                const pinToggle = document.getElementById('pinExpenseFormToggle');
                if (pinToggle) {
                    pinToggle.checked = true;
                    const event = new Event('change', { bubbles: true });
                    pinToggle.dispatchEvent(event);
                }
            }, 100);
        } else {
            showMessage('وظيفة إضافة المصروفات غير متاحة.', 'error');
        }
    } else {
        showMessage('ليس لديك الصلاحية لإضافة مصروفات.', 'error');
    }
}

/**
 * Opens quick search modal (F2 or Ctrl+F or /)
 */
function openQuickSearch() {
    console.log('فتح البحث السريع');
    const searchModal = document.getElementById('quickSearchModal');
    if (searchModal) {
        searchModal.style.display = 'block';
        const searchInput = searchModal.querySelector('input[type="search"]');
        if (searchInput) {
            searchInput.focus();
        }
    } else {
        const existingSearch = document.querySelector('input[type="search"]');
        if (existingSearch) {
            existingSearch.focus();
        } else {
            showMessage('خيار البحث غير متاح حالياً.', 'info');
        }
    }
}

/**
 * Opens help modal (F1 or Ctrl+H or ?)
 */
function openHelpModal() {
    const shortcutsList = `
        <div style="text-align: right; line-height: 1.8;">
            <h3>🎯 اختصارات الكيبورد</h3>
            <br>
            <strong>الأزرار الوظيفية:</strong><br>
            F1 - عرض هذه المساعدة<br>
            F2 - بحث سريع<br>
            F3 - إضافة مصروف جديد<br>
            F4 - إضافة مصروف مثبت<br>
            F5 - تحديث البيانات<br>
            F9 - إظهار/إخفاء القائمة الجانبية<br>
            <br>
            <strong>اختصارات التحكم:</strong><br>
            Ctrl + N - مصروف جديد<br>
            Ctrl + P - مصروف مثبت<br>
            Ctrl + F - بحث سريع<br>
            Ctrl + S - حفظ<br>
            Ctrl + R - تحديث<br>
            Ctrl + H - مساعدة<br>
            Ctrl + Q - خروج سريع<br>
            <br>
            <strong>اختصارات Alt للتنقل:</strong><br>
            Alt + 1 (أو Alt + ١) - لوحة التحكم<br>
            Alt + 2 (أو Alt + ٢) - المصروفات<br>
            Alt + 3 (أو Alt + ٣) - التقارير<br>
            Alt + 4 (أو Alt + ٤) - الإعدادات<br>
            <br>
            <strong>اختصارات أخرى:</strong><br>
            / - بحث سريع<br>
            ? - مساعدة<br>
            Esc - إغلاق النوافذ المفتوحة أو مسح حقل الإدخال<br>
            Space - إجراء سريع (إضافة مصروف/تحديث/بحث)<br>
            Ctrl + Enter - إرسال النموذج الحالي (داخل حقول الإدخال)<br>
        </div>
    `;
    
    showMessage(shortcutsList, 'info', 15000); // Increased display time for help
}

/**
 * Refreshes current view (F5 or Ctrl+R)
 */
function refreshCurrentView() {
    console.log('تحديث البيانات');
    if (typeof refreshExpenses === 'function') {
        refreshExpenses();
    } else if (typeof loadDashboard === 'function') {
        loadDashboard();
    } else {
        showMessage('تم تحديث البيانات', 'success');
    }
}

/**
 * Toggles sidebar visibility (F9)
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar, .side-nav, nav, [class*="sidebar"], [class*="side"]');
    if (sidebar) {
        const isHidden = sidebar.style.display === 'none' || 
                        sidebar.classList.contains('hidden') ||
                        sidebar.offsetParent === null;
        
        sidebar.style.display = isHidden ? 'block' : 'none';
        if (sidebar.classList) {
            sidebar.classList.toggle('hidden', !isHidden);
        }
        console.log('تبديل القائمة الجانبية: ' + (isHidden ? 'إظهار' : 'إخفاء'));
    } else {
        showMessage('القائمة الجانبية غير موجودة', 'info');
    }
}

/**
 * Closes all modals and dropdowns (Escape)
 */
function closeAllModals() {
    console.log('إغلاق جميع النوافذ');
    
    // Close modals
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
    let closedCount = 0;
    
    modals.forEach(modal => {
        if (modal.style.display === 'block' || 
            modal.classList.contains('show') ||
            getComputedStyle(modal).display !== 'none') {
            
            modal.style.display = 'none';
            modal.classList.remove('show');
            closedCount++;
        }
    });
    
    // Close dropdowns
    const dropdowns = document.querySelectorAll('.dropdown-menu, .suggestions');
    dropdowns.forEach(dropdown => {
        if (dropdown.style.display !== 'none') {
            dropdown.style.display = 'none';
            closedCount++;
        }
    });
    
    // Clear any active selections
    document.querySelectorAll('.active').forEach(item => {
        item.classList.remove('active');
    });
    
    console.log(`تم إغلاق ${closedCount} نافذة/قائمة`);
}

/**
 * Executes quick action based on context (Space)
 */
function executeQuickAction() {
    console.log('إجراء سريع');
    if (document.querySelector('.expense-list')) {
        openRegularExpenseModal();
    } else if (document.querySelector('.dashboard')) {
        refreshCurrentView();
    } else {
        openQuickSearch();
    }
}

/**
 * Navigates to specific section (Alt+1-4)
 */
function navigateToSection(section) {
    console.log('التنقل إلى: ' + section);
    const sections = {
        'dashboard': () => { 
            if (typeof loadDashboard === 'function') loadDashboard();
            else showMessage('شاشة الرئيسية', 'info');
        },
        'expenses': () => { 
            if (typeof loadExpenses === 'function') loadExpenses();
            else showMessage('شاشة المصروفات', 'info');
        },
        'reports': () => { 
            if (typeof loadReports === 'function') loadReports();
            else showMessage('شاشة التقارير', 'info');
        },
        'settings': () => { 
            if (typeof loadSettings === 'function') loadSettings();
            else showMessage('شاشة الإعدادات', 'info');
        }
    };
    
    if (sections[section]) {
        sections[section]();
    }
}

/**
 * Saves current data (Ctrl+S)
 */
function saveCurrentData() {
    console.log('حفظ البيانات');
    const activeForm = document.querySelector('form:focus-within');
    if (activeForm) {
        activeForm.dispatchEvent(new Event('submit', { cancelable: true }));
        showMessage('تم محاولة حفظ البيانات.', 'success');
    } else {
        showMessage('لا يوجد بيانات للحفظ في الوقت الحالي.', 'info');
    }
}

/**
 * Quick logout (Ctrl+Q)
 */
function quickLogout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        console.log('خروج سريع');
        if (typeof logout === 'function') {
            logout();
        } else {
            window.location.href = 'logout.html';
        }
    }
}

/**
 * Submits parent form of an input element
 */
function submitParentForm(element) {
    let form = element.closest('form');
    if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        console.log('تم إرسال النموذج الأبوي.');
    } else {
        console.log('لم يتم العثور على نموذج أبوي لإرساله.');
    }
}

// --- Search and Suggestion Functions ---

/**
 * Handles Enter key press in search fields
 */
function handleEnterKeyInSearch(target) {
    const searchId = target.id;
    
    switch (searchId) {
        case 'expenseCategorySearch':
            selectActiveOrFirstSuggestion('expenseCategorySuggestions', target);
            break;
        case 'customerSearch':
            selectActiveOrFirstSuggestion('customerSuggestions', target);
            break;
        case 'employeeSearch':
            selectActiveOrFirstSuggestion('employeeSuggestions', target);
            break;
        default:
            if (target.type === 'search') {
                performSearch(target.value);
            }
            target.blur(); // Remove focus after action
            break;
    }
}

/**
 * Handles arrow key navigation in search fields
 */
function handleArrowKeysInSearch(target, event) {
    const searchId = target.id;
    let suggestionsId;
    
    switch (searchId) {
        case 'expenseCategorySearch':
            suggestionsId = 'expenseCategorySuggestions';
            break;
        case 'customerSearch':
            suggestionsId = 'customerSuggestions';
            break;
        case 'employeeSearch':
            suggestionsId = 'employeeSuggestions';
            break;
        default:
            return;
    }
    
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions || suggestions.style.display === 'none') return;
    
    navigateSuggestions(suggestions, event);
}

/**
 * Navigates through search suggestions using arrow keys
 */
function navigateSuggestions(suggestions, event) {
    event.preventDefault();

    const items = Array.from(suggestions.querySelectorAll('.suggestion-item'));
    if (items.length === 0) return;

    const currentActive = suggestions.querySelector('.suggestion-item.active');
    let currentIndex = currentActive ? items.indexOf(currentActive) : -1;

    if (event.key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
        currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    }

    items.forEach(item => item.classList.remove('active'));
    if (currentIndex >= 0) {
        items[currentIndex].classList.add('active');
        items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
}

/**
 * Selects the currently active suggestion or the first one if none is active.
 * @param {string} suggestionsId - The ID of the suggestions container.
 * @param {HTMLElement} inputTarget - The input element associated with the suggestions.
 */
function selectActiveOrFirstSuggestion(suggestionsId, inputTarget) {
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions || suggestions.style.display === 'none') return;
    
    const activeSuggestion = suggestions.querySelector('.suggestion-item.active');
    if (activeSuggestion) {
        activeSuggestion.click();
    } else {
        const firstSuggestion = suggestions.querySelector('.suggestion-item');
        if (firstSuggestion) {
            firstSuggestion.click();
        }
    }
    // After selection, close suggestions and blur the input
    closeAllSuggestions();
    if (inputTarget) {
        inputTarget.blur();
    }
}

/**
 * Sets up navigation for search suggestions
 */
function setupSearchSuggestionNavigation() {
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('suggestion-item')) {
            // When a suggestion is clicked, remove active class and close suggestions
            event.target.classList.remove('active');
            closeAllSuggestions();
        }
    });
    
    document.addEventListener('mouseover', (event) => {
        if (event.target.classList.contains('suggestion-item')) {
            const siblings = Array.from(event.target.parentElement.children);
            siblings.forEach(sibling => sibling.classList.remove('active'));
            event.target.classList.add('active');
        }
    });
}

/**
 * Closes all suggestion dropdowns
 */
function closeAllSuggestions() {
    const allSuggestions = document.querySelectorAll('.suggestions');
    allSuggestions.forEach(suggestion => {
        suggestion.style.display = 'none';
        const items = suggestion.querySelectorAll('.suggestion-item');
        items.forEach(item => item.classList.remove('active'));
    });
}

/**
 * Performs a general search
 */
function performSearch(query) {
    if (typeof window.globalSearch === 'function') {
        window.globalSearch(query);
        showMessage(`البحث عن: "${query}"`, 'info');
    } else {
        showMessage(`بحث عن: ${query}`, 'info');
    }
}

// Placeholder for showMessage function if not defined elsewhere
if (typeof showMessage !== 'function') {
    window.showMessage = function(message, type = 'info', duration = 3000) {
        console.log(`[Message - ${type.toUpperCase()}]: ${message}`);
        // You can implement a visual message display here (e.g., a toast notification)
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
            direction: rtl;
            text-align: right;
        `;
        msgDiv.innerHTML = message;
        document.body.appendChild(msgDiv);

        setTimeout(() => {
            msgDiv.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            msgDiv.style.opacity = '0';
            msgDiv.addEventListener('transitionend', () => msgDiv.remove());
        }, duration);
    };
}

// Placeholder for showAddExpenseModal function if not defined elsewhere
if (typeof showAddExpenseModal !== 'function') {
    window.showAddExpenseModal = function() {
        showMessage('فتح نافذة إضافة المصروفات (وظيفة وهمية)', 'info');
        // Simulate opening a modal
        const modal = document.createElement('div');
        modal.id = 'tempExpenseModal';
        modal.classList.add('modal');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            z-index: 10000;
            display: block;
            direction: rtl;
            text-align: right;
        `;
        modal.innerHTML = `
            <h3>إضافة مصروف جديد</h3>
            <p>هذه نافذة وهمية للمصروفات.</p>
            <label for="pinExpenseFormToggle">تثبيت المصروف:</label>
            <input type="checkbox" id="pinExpenseFormToggle">
            <button onclick="document.getElementById('tempExpenseModal').style.display='none';">إغلاق</button>
        `;
        document.body.appendChild(modal);
    };
}

// Placeholder for globalSearch function if not defined elsewhere
if (typeof window.globalSearch !== 'function') {
    window.globalSearch = function(query) {
        console.log(`Executing global search for: ${query}`);
        // Implement your actual global search logic here
        showMessage(`البحث العام عن: "${query}"`, 'info');
    };
}

// Placeholder for loadDashboard, loadExpenses, loadReports, loadSettings, logout
// These functions should be defined in your main application logic
if (typeof loadDashboard !== 'function') window.loadDashboard = () => showMessage('تحميل لوحة التحكم', 'info');
if (typeof loadExpenses !== 'function') window.loadExpenses = () => showMessage('تحميل صفحة المصروفات', 'info');
if (typeof loadReports !== 'function') window.loadReports = () => showMessage('تحميل صفحة التقارير', 'info');
if (typeof loadSettings !== 'function') window.loadSettings = () => showMessage('تحميل صفحة الإعدادات', 'info');
if (typeof logout !== 'function') window.logout = () => {
    showMessage('تسجيل الخروج...', 'info');
    window.location.href = 'logout.html'; // Redirect to logout page
};


// Initialize keyboard shortcuts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeKeyboardShortcuts();
    addSuggestionStyles();
    
    // Show available shortcuts on first load
    setTimeout(() => {
        if (!localStorage.getItem('shortcutsShown')) {
            showMessage('💡 يمكنك استخدام اختصارات الكيبورد - اضغط F1 للمساعدة', 'info', 5000);
            localStorage.setItem('shortcutsShown', 'true');
        }
    }, 3000);
});

/**
 * Adds CSS styles for active suggestion items
 */
function addSuggestionStyles() {
    if (document.querySelector('#keyboardShortcutsStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'keyboardShortcutsStyles';
    style.textContent = `
        .suggestion-item.active {
            background-color: #007bff !important;
            color: white !important;
        }
        .suggestion-item:hover {
            background-color: #e9ecef;
        }
        .suggestions {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            position: absolute; /* Ensure suggestions appear over other content */
            width: 100%; /* Adjust as needed */
        }
        /* Basic modal styles for demonstration */
        .modal {
            display: none; /* Hidden by default */
            position: fixed; /* Stay in place */
            z-index: 10000; /* Sit on top */
            left: 0;
            top: 0;
            width: 100%; /* Full width */
            height: 100%; /* Full height */
            overflow: auto; /* Enable scroll if needed */
            background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
        }
        .modal > div {
            background-color: #fefefe;
            margin: 15% auto; /* 15% from the top and centered */
            padding: 20px;
            border: 1px solid #888;
            width: 80%; /* Could be more or less, depending on screen size */
            max-width: 500px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
    `;
    document.head.appendChild(style);
}

// Expose functions globally
window.initializeKeyboardShortcuts = initializeKeyboardShortcuts;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;

console.log('✅ اختصارات الكيبورد جاهزة للاستخدام!');
