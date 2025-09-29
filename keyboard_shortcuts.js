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
    // Only process if we're not in an input field or textarea
    if (isInputField(event.target)) {
        handleInputFieldShortcuts(event);
        return;
    }

    // Global shortcuts (when not in input fields)
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'z':
            case 'Z':
                if (event.shiftKey) {
                    // Ctrl+Shift+Z - Open pinned expense modal
                    event.preventDefault();
                    openPinnedExpenseModal();
                } else {
                    // Ctrl+Z - Open regular expense modal
                    event.preventDefault();
                    openRegularExpenseModal();
                }
                break;
                
            case 'n':
            case 'N':
                // Ctrl+N - Add new expense (alternative shortcut)
                event.preventDefault();
                openRegularExpenseModal();
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
    if (currentUserRole === 'كاشير' || currentUserRole === 'محاسب') {
        showAddExpenseModal();
    }
}

/**
 * Opens the pinned expense modal (Ctrl+Shift+Z)
 */
function openPinnedExpenseModal() {
    if (currentUserRole === 'كاشير' || currentUserRole === 'محاسب') {
        showAddExpenseModal();
        // Auto-check the pin toggle
        setTimeout(() => {
            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle) {
                pinToggle.checked = true;
            }
        }, 100);
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
            selectFirstSuggestion('expenseCategorySuggestions');
            break;
            
        case 'customerSearch':
            selectFirstSuggestion('customerSuggestions');
            break;
            
        case 'employeeSearch':
            selectFirstSuggestion('employeeSuggestions');
            break;
            
        default:
            // For other search fields, just blur or submit if applicable
            target.blur();
            break;
    }
}

/**
 * Selects the first suggestion in a suggestions list
 * @param {string} suggestionsId - The ID of the suggestions container
 */
function selectFirstSuggestion(suggestionsId) {
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions || suggestions.style.display === 'none') return;
    
    const firstSuggestion = suggestions.querySelector('.suggestion-item');
    if (firstSuggestion) {
        firstSuggestion.click();
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
    
    switch (event.key) {
        case 'ArrowDown':
            currentIndex = (currentIndex + 1) % items.length;
            break;
            
        case 'ArrowUp':
            currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            break;
            
        case 'ArrowRight':
        case 'ArrowLeft':
            // For left/right, we might want to handle differently
            // Currently just prevent default and return
            return;
    }
    
    // Update active item
    items.forEach(item => item.classList.remove('active'));
    items[currentIndex].classList.add('active');
    
    // Scroll into view if needed
    items[currentIndex].scrollIntoView({ block: 'nearest' });
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
        setTimeout(() => setupSuggestionNavigation('expenseCategorySuggestions'), 0);
    };
    
    // Enhance customer search
    window.searchCustomersForExpense = function(searchTerm) {
        originalSearchCustomersForExpense(searchTerm);
        setTimeout(() => setupSuggestionNavigation('customerSuggestions'), 0);
    };
    
    // Enhance employee search
    window.searchEmployeesForExpense = function(searchTerm) {
        originalSearchEmployeesForExpense(searchTerm);
        setTimeout(() => setupSuggestionNavigation('employeeSuggestions'), 0);
    };
}

/**
 * Sets up navigation for a specific suggestions container
 * @param {string} suggestionsId - The ID of the suggestions container
 */
function setupSuggestionNavigation(suggestionsId) {
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions) return;
    
    const items = suggestions.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    
    // Remove any existing active classes
    items.forEach(item => item.classList.remove('active'));
    
    // Add active class to first item by default
    if (items.length > 0) {
        items[0].classList.add('active');
    }
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
