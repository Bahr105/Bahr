
// --- Keyboard Shortcuts Functions ---

/**
 * Initializes keyboard shortcuts for the application
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Add focus management for search suggestions
    setupSearchSuggestionNavigation();
}

/**
 * Handles all keyboard shortcuts in the application
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardShortcuts(event) {
    // Ignore shortcuts when user is typing in input fields, textareas, or contenteditable elements
    if (isInputField(event.target)) {
        handleInputFieldShortcuts(event);
        return;
    }

    // Global shortcuts (when not in input fields)
    switch (event.key) {
        case 'F1':
            event.preventDefault();
            openHelpModal();
            break;
            
        case 'F2':
            event.preventDefault();
            openQuickSearch();
            break;
            
        case 'F3':
            event.preventDefault();
            openRegularExpenseModal();
            break;
            
        case 'F4':
            event.preventDefault();
            openPinnedExpenseModal();
            break;
            
        case 'F5':
            event.preventDefault();
            refreshCurrentView();
            break;
            
        case 'F9':
            event.preventDefault();
            toggleSidebar();
            break;
            
        case 'Escape':
            event.preventDefault();
            closeAllModals();
            break;
            
        case ' ':
            // Space key for quick actions
            if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                executeQuickAction();
            }
            break;
    }

    // Ctrl/Cmd based shortcuts
    if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
            case 'n':
                event.preventDefault();
                openRegularExpenseModal();
                break;
                
            case 'p':
                event.preventDefault();
                openPinnedExpenseModal();
                break;
                
            case 'f':
                event.preventDefault();
                openQuickSearch();
                break;
                
            case 's':
                event.preventDefault();
                saveCurrentData();
                break;
                
            case 'r':
                event.preventDefault();
                refreshCurrentView();
                break;
                
            case 'h':
                event.preventDefault();
                openHelpModal();
                break;
                
            case 'q':
                event.preventDefault();
                quickLogout();
                break;
        }
    }

    // Alt based shortcuts
    if (event.altKey) {
        switch (event.key.toLowerCase()) {
            case '1':
                event.preventDefault();
                navigateToSection('dashboard');
                break;
                
            case '2':
                event.preventDefault();
                navigateToSection('expenses');
                break;
                
            case '3':
                event.preventDefault();
                navigateToSection('reports');
                break;
                
            case '4':
                event.preventDefault();
                navigateToSection('settings');
                break;
        }
    }
}

/**
 * Handles keyboard shortcuts when in input fields
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleInputFieldShortcuts(event) {
    const target = event.target;
    
    // Handle Enter key in search fields
    if (event.key === 'Enter') {
        handleEnterKeyInSearch(target);
        return;
    }
    
    // Handle Escape key to close suggestions or clear field
    if (event.key === 'Escape') {
        if (target.value.trim() === '') {
            target.blur();
        } else {
            target.value = '';
            closeAllSuggestions();
        }
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

/**
 * Opens the regular expense modal (F3 or Ctrl+N)
 */
function openRegularExpenseModal() {
    if (currentUserRole === 'كاشير' || currentUserRole === 'محاسب') {
        showAddExpenseModal();
    } else {
        showMessage('ليس لديك الصلاحية لإضافة مصروفات.', 'error');
    }
}

/**
 * Opens the pinned expense modal (F4 or Ctrl+P)
 */
function openPinnedExpenseModal() {
    if (currentUserRole === 'كاشير' || currentUserRole === 'محاسب') {
        showAddExpenseModal();
        // Auto-check the pin toggle
        setTimeout(() => {
            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle) {
                pinToggle.checked = true;
                // Trigger any change events if needed
                const event = new Event('change', { bubbles: true });
                pinToggle.dispatchEvent(event);
            }
        }, 100);
    } else {
        showMessage('ليس لديك الصلاحية لإضافة مصروفات.', 'error');
    }
}

/**
 * Opens quick search modal (F2 or Ctrl+F)
 */
function openQuickSearch() {
    const searchModal = document.getElementById('quickSearchModal');
    if (searchModal) {
        searchModal.style.display = 'block';
        const searchInput = searchModal.querySelector('input[type="search"]');
        if (searchInput) {
            searchInput.focus();
        }
    } else {
        // Fallback: focus on existing search field if available
        const existingSearch = document.querySelector('input[type="search"]');
        if (existingSearch) {
            existingSearch.focus();
        }
    }
}

/**
 * Opens help modal (F1 or Ctrl+H)
 */
function openHelpModal() {
    showMessage('شاشة المساعدة - قائمة الاختصارات:\n\n' +
        'F1 - المساعدة\n' +
        'F2 - بحث سريع\n' +
        'F3 - إضافة مصروف\n' +
        'F4 - إضافة مصروف مثبت\n' +
        'F5 - تحديث\n' +
        'F9 - إظهار/إخفاء القائمة الجانبية\n' +
        'Esc - إغلاق النوافذ\n' +
        'Space - إجراء سريع\n' +
        'Alt+1-4 - التنقل بين الأقسام\n' +
        'Ctrl+N - مصروف جديد\n' +
        'Ctrl+P - مصروف مثبت\n' +
        'Ctrl+F - بحث\n' +
        'Ctrl+S - حفظ\n' +
        'Ctrl+R - تحديث\n' +
        'Ctrl+Q - خروج سريع', 'info', 8000);
}

/**
 * Refreshes current view (F5 or Ctrl+R)
 */
function refreshCurrentView() {
    if (typeof refreshExpenses === 'function') {
        refreshExpenses();
    } else if (typeof loadDashboard === 'function') {
        loadDashboard();
    } else {
        location.reload();
    }
}

/**
 * Toggles sidebar visibility (F9)
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar, .side-nav, nav');
    if (sidebar) {
        const isHidden = sidebar.style.display === 'none' || sidebar.classList.contains('hidden');
        sidebar.style.display = isHidden ? 'block' : 'none';
        if (sidebar.classList) {
            sidebar.classList.toggle('hidden');
        }
    }
}

/**
 * Closes all modals and dropdowns (Escape)
 */
function closeAllModals() {
    // Close modals
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
    modals.forEach(modal => {
        if (modal.style.display === 'block' || modal.classList.contains('show')) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    });
    
    // Close dropdowns
    const dropdowns = document.querySelectorAll('.dropdown-menu, .suggestions');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    
    // Clear any active selections
    document.querySelectorAll('.active').forEach(item => {
        item.classList.remove('active');
    });
}

/**
 * Executes quick action based on context (Space)
 */
function executeQuickAction() {
    // Determine context and execute appropriate action
    if (document.querySelector('.expense-list')) {
        // If we're in expenses list, open add expense
        openRegularExpenseModal();
    } else if (document.querySelector('.dashboard')) {
        // If in dashboard, refresh data
        refreshCurrentView();
    } else {
        // Default action: toggle quick search
        openQuickSearch();
    }
}

/**
 * Navigates to specific section (Alt+1-4)
 */
function navigateToSection(section) {
    const sections = {
        'dashboard': () => { if (typeof loadDashboard === 'function') loadDashboard(); },
        'expenses': () => { if (typeof loadExpenses === 'function') loadExpenses(); },
        'reports': () => { if (typeof loadReports === 'function') loadReports(); },
        'settings': () => { if (typeof loadSettings === 'function') loadSettings(); }
    };
    
    if (sections[section]) {
        sections[section]();
    }
}

/**
 * Saves current data (Ctrl+S)
 */
function saveCurrentData() {
    // Check if we're in a form context
    const activeForm = document.querySelector('form:focus-within');
    if (activeForm) {
        activeForm.dispatchEvent(new Event('submit', { cancelable: true }));
    } else {
        showMessage('لا يوجد بيانات للحفظ في الوقت الحالي.', 'info');
    }
}

/**
 * Quick logout (Ctrl+Q)
 */
function quickLogout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
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
    }
}

// --- Search and Suggestion Functions (Keep existing but optimized) ---

/**
 * Handles Enter key press in search fields
 */
function handleEnterKeyInSearch(target) {
    const searchId = target.id;
    
    switch (searchId) {
        case 'expenseCategorySearch':
            selectActiveOrFirstSuggestion('expenseCategorySuggestions');
            break;
        case 'customerSearch':
            selectActiveOrFirstSuggestion('customerSuggestions');
            break;
        case 'employeeSearch':
            selectActiveOrFirstSuggestion('employeeSuggestions');
            break;
        default:
            if (target.type === 'search') {
                performSearch(target.value);
            }
            target.blur();
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
    } else {
        return;
    }

    items.forEach(item => item.classList.remove('active'));
    items[currentIndex].classList.add('active');
    items[currentIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Selects the currently active suggestion or the first one if none is active.
 */
function selectActiveOrFirstSuggestion(suggestionsId) {
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
}

/**
 * Sets up navigation for search suggestions
 */
function setupSearchSuggestionNavigation() {
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('suggestion-item')) {
            event.target.classList.remove('active');
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
    } else {
        showMessage(`بحث عن: ${query}`, 'info');
    }
}

// Initialize keyboard shortcuts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeKeyboardShortcuts();
    
    // Add CSS for active suggestion items
    addSuggestionStyles();
    
    // Show available shortcuts on first load
    setTimeout(() => {
        if (!localStorage.getItem('shortcutsShown')) {
            openHelpModal();
            localStorage.setItem('shortcutsShown', 'true');
        }
    }, 2000);
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
        }
        .shortcut-hint {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            opacity: 0.9;
            z-index: 10000;
        }
    `;
    document.head.appendChild(style);
}

// Expose functions globally
window.initializeKeyboardShortcuts = initializeKeyboardShortcuts;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
