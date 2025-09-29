// --- Data Loading Functions ---

/**
 * Loads user data from Google Sheets into the global `users` array.
 */
async function loadUsers() {
    try {
        const data = await readSheet(SHEETS.USERS);
        if (data.length > 1) {
            users = data.slice(1).map(row => ({
                id: row[0] || '',
                name: row[1] || '',
                phone: row[2] || '',
                username: row[3] || '',
                password: row[4] || '',
                role: row[5] || '',
                status: row[6] || 'نشط',
                creationDate: row[7] || ''
            }));
        } else {
            users = [];
        }
    } catch (error) {
        console.error('Error loading users:', error);
        users = [];
    }
}

/**
 * Loads category data from Google Sheets into the global `categories` array.
 */
async function loadCategories() {
    try {
        const data = await readSheet(SHEETS.CATEGORIES);
        if (data.length > 1) {
            categories = data.slice(1).map(row => {
                let id = row[0] || '';
                // Normalize ID format on load
                if (id && !isNaN(id) && id.length < 10) {
                    id = 'CAT_' + id;
                }
                
                return {
                    id: id,
                    code: row[1] || '',
                    name: row[2] || '',
                    formType: row[3] || 'عادي',
                    creationDate: row[4] || '',
                    createdBy: row[5] || '',
                    originalId: row[0] || '' // Save original ID as in the sheet
                };
            });
        } else {
            categories = [];
        }
        
        console.log('Categories loaded:', categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
    }
}

/**
 * Verifies if a category exists by its ID.
 * @param {string} categoryId - The ID of the category to verify.
 * @returns {Promise<boolean>} True if the category exists, false otherwise.
 */
async function verifyCategoryExists(categoryId) {
    const normalizedId = normalizeCategoryId(categoryId);
    
    // Search in memory first
    const inMemory = categories.find(cat => normalizeCategoryId(cat.id) === normalizedId);
    if (inMemory) return true;
    
    // Search directly in the sheet
    try {
        const data = await readSheet(SHEETS.CATEGORIES);
        for (let i = 1; i < data.length; i++) {
            const rowId = data[i][0] || '';
            if (normalizeCategoryId(rowId) === normalizedId) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error verifying category:', error);
        return false;
    }
}

/**
 * Loads custom field definitions for categories from Google Sheets.
 */
async function loadCategoryCustomFields() {
    try {
        const data = await readSheet(SHEETS.CATEGORY_CUSTOM_FIELDS);
        if (data.length > 1) {
            categoryCustomFields = data.slice(1).map(row => ({
                categoryId: row[0] || '',
                fieldName: row[1] || '',
                fieldType: row[2] || 'text',
                isRequired: (row[3] || 'false').toLowerCase() === 'true',
                options: row[4] ? JSON.parse(row[4]) : [] // If FieldType is 'select'
            }));
        } else {
            categoryCustomFields = [];
        }
    } catch (error) {
        console.error('Error loading category custom fields:', error);
        categoryCustomFields = [];
    }
}

/**
 * Loads customer data from Google Sheets into the global `customers` array.
 */
async function loadCustomers() {
    try {
        const data = await readSheet(SHEETS.CUSTOMERS);
        if (data.length > 1) {
            customers = data.slice(1).map(row => ({
                id: row[0] || '',
                name: row[1] || '',
                phone: row[2] || '',
                totalCredit: parseFloat((row[3] || '0').replace(/,/g, '')),
                creationDate: row[4] || '',
                lastUpdate: row[5] || ''
            }));
        } else {
            customers = [];
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
    }
}

/**
 * Loads credit history for a specific customer.
 * @param {string} customerId - The ID of the customer.
 * @returns {Promise<Array<object>>} A promise that resolves with the customer's credit history.
 */
async function loadCustomerCreditHistory(customerId) {
    try {
        const data = await readSheet(SHEETS.CUSTOMER_CREDIT_HISTORY);
        if (data.length <= 1) return [];

        return data.slice(1).filter(row => row[1] === customerId).map(row => ({
            id: row[0] || '',
            customerId: row[1] || '',
            date: row[2] || '',
            type: row[3] || '',
            amount: parseFloat((row[4] || '0').replace(/,/g, '')),
            invoiceNumber: row[5] || '',
            notes: row[6] || '',
            recordedBy: row[7] || ''
        }));
    } catch (error) {
        console.error('Error loading customer credit history:', error);
        return [];
    }
}

/**
 * Loads employee data from Google Sheets into the global `employees` array.
 * @param {boolean} [forceReload=false] - If true, forces a reload even if data exists.
 */
async function loadEmployees(forceReload = false) {
    if (!forceReload && employees.length > 0) {
        return;
    }
    
    try {
        const data = await readSheet(SHEETS.EMPLOYEES);
        if (data.length > 1) {
            employees = data.slice(1).map(row => ({
                id: row[0] || '',
                name: row[1] || '',
                phone: row[2] || '',
                totalAdvance: parseFloat((row[3] || '0').replace(/,/g, '')),
                creationDate: row[4] || '',
                lastUpdate: row[5] || ''
            }));
            console.log('تم تحميل', employees.length, 'موظف');
        } else {
            employees = [];
            console.log('لا توجد بيانات موظفين');
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        employees = [];
    }
}

/**
 * Loads advance history for a specific employee.
 * @param {string} employeeId - The ID of the employee.
 * @returns {Promise<Array<object>>} A promise that resolves with the employee's advance history.
 */
async function loadEmployeeAdvanceHistory(employeeId) {
    try {
        const data = await readSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY);
        if (data.length <= 1) return [];

        return data.slice(1).filter(row => row[1] === employeeId).map(row => ({
            id: row[0] || '',
            employeeId: row[1] || '',
            date: row[2] || '',
            type: row[3] || '',
            amount: parseFloat((row[4] || '0').replace(/,/g, '')),
            notes: row[5] || '',
            recordedBy: row[6] || ''
        }));
    } catch (error) {
        console.error('Error loading employee advance history:', error);
        return [];
    }
}

/**
 * Loads expense data from Google Sheets, applying optional filters.
 * @param {object} [filters={}] - An object containing filters (e.g., cashier, dateFrom, dateTo, category, formType).
 * @returns {Promise<Array<object>>} A promise that resolves with the filtered expense data.
 */
async function loadExpenses(filters = {}) {
    try {
        const data = await readSheet(SHEETS.EXPENSES);
        if (data.length <= 1) return [];

        let expenses = data.slice(1).map(row => {
            const expense = {
                id: row[0] || '',
                category: row[1] || '',
                categoryCode: row[2] || '',
                invoiceNumber: row[3] || '',
                amount: parseFloat((row[4] || '0').replace(/,/g, '')),
                notes: row[5] || '',
                date: row[6] || '',
                time: row[7] || '',
                cashier: row[8] || '',
                year: row[9] || '',
                referenceNumber: row[10] || '',
                tabName: row[11] || '',
                tabPhone: row[12] || '',
                location: row[13] || '',
                personName: row[14] || '',
                companyName: row[15] || '',
                companyCode: row[16] || '',
                customer: row[17] || '',
                employee: row[18] || ''
            };
            // Add custom fields dynamically
            const customFieldsStartIndex = 19;
            const categoryObj = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            if (categoryObj) {
                const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryObj.id);
                expense.customFields = {};
                customFieldsForCategory.forEach((cf, index) => {
                    expense.customFields[cf.fieldName] = row[customFieldsStartIndex + index] || '';
                });
            }
            return expense;
        });

        // Apply filters
        if (filters.cashier) {
            expenses = expenses.filter(exp => exp.cashier === filters.cashier);
        }
        if (filters.dateFrom) {
            const filterDateFrom = new Date(filters.dateFrom);
            expenses = expenses.filter(exp => new Date(exp.date) >= filterDateFrom);
        }
        if (filters.dateTo) {
            const filterDateTo = new Date(filters.dateTo);
            filterDateTo.setHours(23, 59, 59, 999);
            expenses = expenses.filter(exp => new Date(exp.date) <= filterDateTo);
        }
        if (filters.timeFrom && filters.timeTo) {
            expenses = expenses.filter(exp => {
                const expDateTime = new Date(`${exp.date}T${exp.time}`);
                const filterStartDateTime = new Date(`${exp.date}T${filters.timeFrom}`);
                const filterEndDateTime = new Date(`${exp.date}T${filters.timeTo}`);
                return expDateTime >= filterStartDateTime && expDateTime <= filterEndDateTime;
            });
        }
        if (filters.category) {
            expenses = expenses.filter(exp => exp.category === filters.category);
        }
        if (filters.formType) {
            expenses = expenses.filter(exp => {
                const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
                return category && category.formType === filters.formType;
            });
        }

        return expenses;
    } catch (error) {
        console.error('Error loading expenses:', error);
        return [];
    }
}

/**
 * Loads shift closure data from Google Sheets, applying optional filters.
 * @param {object} [filters={}] - An object containing filters (e.g., cashier, dateFrom, dateTo, timeFrom, timeTo).
 * @returns {Promise<Array<object>>} A promise that resolves with the filtered shift closure data.
 */
async function loadShiftClosures(filters = {}) {
    try {
        const data = await readSheet(SHEETS.SHIFT_CLOSURES);
        if (data.length <= 1) return [];

        let closures = data.slice(1).map(row => ({
            id: row[0] || '',
            cashier: row[1] || '',
            dateFrom: row[2] || '',
            timeFrom: row[3] ? row[3].substring(0, 5) : '00:00', // توحيد إلى HH:MM
            dateTo: row[4] || '',
            timeTo: row[5] ? row[5].substring(0, 5) : '23:59',
            totalExpenses: parseFloat((row[6] || '0').replace(/,/g, '')),
            expenseCount: parseInt(row[7] || 0),
            totalInsta: parseFloat((row[8] || '0').replace(/,/g, '')),
            instaCount: parseInt(row[9] || 0),
            totalVisa: parseFloat((row[10] || '0').replace(/,/g, '')),
            visaCount: parseInt(row[11] || 0),
            totalOnline: parseFloat((row[12] || '0').replace(/,/g, '')),
            onlineCount: parseInt(row[13] || 0),
            grandTotal: parseFloat((row[14] || '0').replace(/,/g, '')), // Cashier's recorded total (includes drawer cash, excludes returns)
            drawerCash: parseFloat((row[15] || '0').replace(/,/g, '')),
            newMindTotal: parseFloat((row[16] || '0').replace(/,/g, '')),
            difference: parseFloat((row[17] || '0').replace(/,/g, '')),
            status: row[18] || '',
            closureDate: row[19] || '',
            closureTime: row[20] || '',
            accountant: row[21] || '',
            totalReturns: parseFloat((row[22] || '0').replace(/,/g, '')),
            grandTotalAfterReturns: parseFloat((row[23] || '0').replace(/,/g, '')) // Accountant's comparison total (after deducting returns)
        
        }));

        // Apply filters
        if (filters.cashier) {
            closures = closures.filter(closure => closure.cashier === filters.cashier);
        }
        if (filters.dateFrom && filters.dateTo) {
            const filterStartDateTime = new Date(`${filters.dateFrom}T${filters.timeFrom || '00:00'}:00`);
            const filterEndDateTime = new Date(`${filters.dateTo}T${filters.timeTo || '23:59'}:59.999`);
            closures = closures.filter(closure => {
                const closureStart = new Date(`${closure.dateFrom}T${closure.timeFrom}:00`);
                const closureEnd = new Date(`${closure.dateTo}T${closure.timeTo}:00`);
                return closureStart >= filterStartDateTime && closureEnd <= filterEndDateTime;
            });
        }

        return closures;
    } catch (error) {
        console.error('Error loading shift closures:', error);
        return [];
    }
}

/**
 * Loads all initial data required for the application.
 */
async function loadInitialData() {
    if (initialDataLoaded) {
        console.log('Initial data already loaded, skipping...');
        return;
    }
    
    try {
        showLoading(true);
        await Promise.all([
            loadUsers(),
            loadCategories(),
            loadCategoryCustomFields(),
            loadCustomers(),
            loadEmployees()
        ]);
        populateUserDropdown();
        initialDataLoaded = true;
        console.log('✅ تم تحميل البيانات الأولية بنجاح');
    } catch (error) {
        console.error('Error loading initial data:', error);
        showMessage('حدث خطأ أثناء تحميل البيانات', 'error');
    } finally {
        showLoading(false);
    }
}
