// --- Keyboard Shortcuts Functions ---

/**
 * Initializes keyboard shortcuts for the application
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Add focus management for search suggestions
    setupSearchSuggestionNavigation();

    // Add specific shortcuts for the login page
    const loginPage = document.getElementById('loginPage');
    if (loginPage) {
        loginPage.addEventListener('keydown', handleLoginShortcuts);
    }
}

/**
 * Handles all keyboard shortcuts in the application
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardShortcuts(event) {
    // Only process if we're not in an input field or textarea
    if (isInputField(event.target)) {
        handleInputFieldShortcuts(event);
        return;
    }

    // Normalize key to lowercase for easier comparison
    const key = event.key.toLowerCase();

    // Define keys for Z in English and Arabic
    const zKeys = ['z', 'ز'];

    // Ctrl + Z or Ctrl + ز to open regular expense modal
    if ((event.ctrlKey || event.metaKey) && zKeys.includes(key)) {
        event.preventDefault();
        openRegularExpenseModal();
        return;
    }

    // Alt + Z or Alt + ز to open pinned expense modal
    if (event.altKey && !event.ctrlKey && !event.metaKey && zKeys.includes(key)) {
        event.preventDefault();
        openPinnedExpenseModal();
        return;
    }

    // Global shortcuts (when not in input fields)
    if (event.ctrlKey || event.metaKey) { // Ctrl or Cmd key
        switch (key) {
            case 'n':
                // Ctrl+N - Add new expense (alternative shortcut)
                event.preventDefault();
                openRegularExpenseModal();
                break;
        }
    }
}

/**
 * Handles keyboard shortcuts specifically for the login page.
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleLoginShortcuts(event) {
    const target = event.target;
    // Check if the target is the username or password input field
    if (target.id === 'username' || target.id === 'password') {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default Enter behavior (e.g., form submission)
            const loginButton = document.getElementById('loginButton'); // Assuming 'loginButton' is the ID of your login button
            if (loginButton) {
                loginButton.click(); // Simulate a click on the login button
            } else {
                console.warn("Login button with ID 'loginButton' not found.");
                // Fallback: if button not found, try to call login function directly
                if (typeof window.login === 'function') {
                    window.login();
                }
            }
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
        event.preventDefault(); // Prevent form submission or other default behavior
        handleEnterKeyInSearch(target);
        return;
    }
    
    // Handle arrow keys in search suggestion lists
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        handleArrowKeysInSearch(target, event);
        return;
    }
    
    // Handle Escape key to close suggestions
    if (event.key === 'Escape') {
        closeAllSuggestions();
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
    return inputTypes.includes(target.tagName.toLowerCase()) || 
           target.isContentEditable;
}

/**
 * Opens the regular expense modal (Ctrl+Z)
 */
function openRegularExpenseModal() {
    if (currentUser Role === 'كاشير' || currentUser Role === 'محاسب') {
        showAddExpenseModal();
        // Uncheck pin toggle if exists
        setTimeout(() => {
            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle) {
                pinToggle.checked = false;
            }
        }, 100);
    } else {
        showMessage('ليس لديك الصلاحية لإضافة مصروفات.', 'error');
    }
}

/**
 * Opens the pinned expense modal (Alt+Z)
 */
function openPinnedExpenseModal() {
    if (currentUser Role === 'كاشير' || currentUser Role === 'محاسب') {
        showAddExpenseModal();
        // Auto-check the pin toggle
        setTimeout(() => {
            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle) {
                pinToggle.checked = true;
            }
        }, 100);
    } else {
        showMessage('ليس لديك الصلاحية لإضافة مصروفات.', 'error');
    }
}

/**
 * Handles Enter key press in search fields
 * @param {HTMLInputElement} target - The search input field
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
            // For other search fields, just blur or submit if applicable
            target.blur();
            break;
    }
}

/**
 * Selects the currently active suggestion or the first one if none is active.
 * @param {string} suggestionsId - The ID of the suggestions container
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
 * Handles arrow key navigation in search fields
 * @param {HTMLInputElement} target - The search input field
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleArrowKeysInSearch(target, event) {
    const searchId = target.id;
    let suggestionsId;
    
    // Determine which suggestions we're dealing with
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
            return; // Not a search field we handle
    }
    
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions || suggestions.style.display === 'none') return;
    
    navigateSuggestions(suggestions, event);
}

/**
 * Navigates through search suggestions using arrow keys
 * @param {HTMLElement} suggestions - The suggestions container
 * @param {KeyboardEvent} event - The keyboard event
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

    console.log(`Suggestion navigation: active index ${currentIndex}`);
}

/**
 * Sets up navigation for search suggestions
 */
function setupSearchSuggestionNavigation() {
    // Add click handlers for suggestions
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('suggestion-item')) {
            event.target.classList.remove('active');
        }
    });
    
    // Add mouseover handlers for suggestions
    document.addEventListener('mouseover', (event) => {
        if (event.target.classList.contains('suggestion-item')) {
            // Remove active class from all siblings
            const siblings = Array.from(event.target.parentElement.children);
            siblings.forEach(sibling => sibling.classList.remove('active'));
            // Add active class to hovered item
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
        // Remove active classes
        const items = suggestion.querySelectorAll('.suggestion-item');
        items.forEach(item => item.classList.remove('active'));
    });
}

/**
 * Enhances existing search functions to support keyboard navigation
 */
function enhanceSearchFunctions() {
    // Store original functions
    const originalSearchExpenseCategories = window.searchExpenseCategories;
    const originalSearchCustomersForExpense = window.searchCustomersForExpense;
    const originalSearchEmployeesForExpense = window.searchEmployeesForExpense;
    
    // Enhance expense category search
    window.searchExpenseCategories = function(searchTerm) {
        originalSearchExpenseCategories(searchTerm);
        // Ensure setupSuggestionNavigation is called after DOM update
        setTimeout(() => setupSuggestionNavigationForContainer('expenseCategorySuggestions'), 0);
    };
    
    // Enhance customer search
    window.searchCustomersForExpense = function(searchTerm) {
        originalSearchCustomersForExpense(searchTerm);
        // Ensure setupSuggestionNavigation is called after DOM update
        setTimeout(() => setupSuggestionNavigationForContainer('customerSuggestions'), 0);
    };
    
    // Enhance employee search
    window.searchEmployeesForExpense = function(searchTerm) {
        originalSearchEmployeesForExpense(searchTerm);
        // Ensure setupSuggestionNavigation is called after DOM update
        setTimeout(() => setupSuggestionNavigationForContainer('employeeSuggestions'), 0);
    };
}

/**
 * Sets up navigation for a specific suggestions container (renamed for clarity).
 * @param {string} suggestionsId - The ID of the suggestions container
 */
function setupSuggestionNavigationForContainer(suggestionsId) {
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions) return;

    const items = suggestions.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    // إزالة أي صنف active موجود
    items.forEach(item => item.classList.remove('active'));

    // تعيين الصنف active للعنصر الأول
    items[0].classList.add('active');
}


// Initialize keyboard shortcuts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeKeyboardShortcuts();
    enhanceSearchFunctions();
    
    // Add CSS for active suggestion items
    addSuggestionStyles();
});

/**
 * Adds CSS styles for active suggestion items
 */
function addSuggestionStyles() {
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);
}

// Expose functions globally for HTML event handlers
window.initializeKeyboardShortcuts = initializeKeyboardShortcuts;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
window.handleLoginShortcuts = handleLoginShortcuts; // Expose for potential direct use if needed
window.openRegularExpenseModal = openRegularExpenseModal;
window.openPinnedExpenseModal = openPinnedExpenseModal;
