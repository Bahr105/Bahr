// --- Expenses Management Functions ---

/**
 * Shows the modal for adding a new expense.
 */
function showAddExpenseModal() {
    const form = document.getElementById('addExpenseForm');
    if (form) form.reset();

    const expenseCategorySearch = document.getElementById('expenseCategorySearch');
    if (expenseCategorySearch) expenseCategorySearch.value = '';
    const expenseCategorySuggestions = document.getElementById('expenseCategorySuggestions');
    if (expenseCategorySuggestions) expenseCategorySuggestions.innerHTML = '';
    const selectedExpenseCategoryCode = document.getElementById('selectedExpenseCategoryCode');
    if (selectedExpenseCategoryCode) selectedExpenseCategoryCode.value = '';
    const selectedExpenseCategoryName = document.getElementById('selectedExpenseCategoryName');
    if (selectedExpenseCategoryName) selectedExpenseCategoryName.value = '';
    const selectedExpenseCategoryFormType = document.getElementById('selectedExpenseCategoryFormType');
    if (selectedExpenseCategoryFormType) selectedExpenseCategoryFormType.value = '';
    const selectedExpenseCategoryId = document.getElementById('selectedExpenseCategoryId');
    if (selectedExpenseCategoryId) selectedExpenseCategoryId.value = '';

    const dynamicExpenseForm = document.getElementById('dynamicExpenseForm');
    if (dynamicExpenseForm) dynamicExpenseForm.innerHTML = '';

    document.getElementById('addExpenseModalTitle').textContent = 'إضافة مصروف جديد';
    document.getElementById('addExpenseModalSaveBtn').onclick = addExpense;
    currentEditExpenseId = null;

    const pinToggle = document.getElementById('pinExpenseFormToggle');
    if (pinToggle) {
        pinToggle.checked = false;
    }

    const modal = document.getElementById('addExpenseModal');
    if (modal) modal.classList.add('active');

    loadEmployees().then(() => {
        console.log('تم تحميل بيانات الموظفين للبحث');
    });
}

/**
 * Shows the modal for editing an existing expense.
 * @param {string} expenseId - The ID of the expense to edit.
 */
async function showEditExpenseModal(expenseId) {
    showLoading(true);
    try {
        const allExpenses = await loadExpenses({});
        const expense = allExpenses.find(exp => exp.id === expenseId);
        if (!expense) {
            showMessage('المصروف غير موجود.', 'error');
            return;
        }

        const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
        if (!category) {
            showMessage('تصنيف المصروف غير موجود.', 'error');
            return;
        }

        document.getElementById('expenseCategorySearch').value = `${category.name} (${category.code})`;
        document.getElementById('selectedExpenseCategoryCode').value = category.code;
        document.getElementById('selectedExpenseCategoryName').value = category.name;
        document.getElementById('selectedExpenseCategoryFormType').value = category.formType;
        document.getElementById('selectedExpenseCategoryId').value = category.id;

        await generateDynamicExpenseForm(category.formType, category.id, expense);

        document.getElementById('expenseInvoiceNumber').value = expense.invoiceNumber || '';
        document.getElementById('expenseAmount').value = expense.amount;
        document.getElementById('expenseNotes').value = expense.notes || '';

        if (category.formType === 'فيزا') {
            document.getElementById('visaReferenceNumber').value = expense.referenceNumber || '';
        } else if (category.formType === 'شحن_تاب') {
            document.getElementById('tabName').value = expense.tabName || '';
            document.getElementById('tabPhone').value = expense.tabPhone || '';
        } else if (category.formType === 'شحن_كهربا') {
            document.getElementById('electricityLocation').value = expense.location || '';
        } else if (['بنزين', 'سلف', 'عجوزات'].includes(category.formType)) {
            document.getElementById('personName').value = expense.personName || '';
        } else if (category.formType === 'دفعة_شركة') {
            document.getElementById('companyName').value = expense.companyName || '';
            document.getElementById('companyCode').value = expense.companyCode || '';
        } else if (category.formType === 'اجل') {
            const customer = customers.find(cust => cust.id === expense.customer);
            if (customer) {
                document.getElementById('customerSearch').value = `${customer.name} (${customer.phone})`;
                document.getElementById('selectedCustomerId').value = customer.id;
                document.getElementById('selectedCustomerName').value = customer.name;
            }
        } else if (category.formType === 'سلف_موظف') {
            const employee = employees.find(emp => emp.id === expense.employee);
            if (employee) {
                document.getElementById('employeeSearch').value = `${employee.name} (${employee.phone})`;
                document.getElementById('selectedEmployeeId').value = employee.id;
                document.getElementById('selectedEmployeeName').value = employee.name;
            }
        }

        document.getElementById('addExpenseModalTitle').textContent = 'تعديل مصروف';
        document.getElementById('addExpenseModalSaveBtn').onclick = updateExpense;
        currentEditExpenseId = expenseId;

        const pinButton = document.getElementById('pinExpenseFormBtn');
        if (pinButton) pinButton.style.display = 'none';

        const modal = document.getElementById('addExpenseModal');
        if (modal) modal.classList.add('active');

    } catch (error) {
        console.error('Error showing edit expense modal:', error);
        showMessage('حدث خطأ أثناء عرض نموذج تعديل المصروف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Searches for expense categories based on a search term.
 * @param {string} searchTerm - The term to search for.
 */
// ... داخل expenses_management.js

function searchExpenseCategories(searchTerm) {
    const suggestionsDiv = document.getElementById('expenseCategorySuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 1) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const filtered = categories.filter(cat =>
        cat.name && cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code && cat.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        // لا حاجة لاستدعاء setupSuggestionNavigationForContainer هنا لأن enhanceSearchFunctions ستفعل ذلك
        return;
    }

    filtered.forEach(cat => {
        if (!cat.id || !cat.code || !cat.name || !cat.formType) {
            console.warn('تصنيف ناقص البيانات:', cat);
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cat.name} (${cat.code}) - ${cat.formType}`;
        item.onclick = () => selectExpenseCategory(cat);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
    // تم نقل هذا الاستدعاء إلى enhanceSearchFunctions في keyboard_shortcuts.js
    // setTimeout(() => setupSuggestionNavigationForContainer('expenseCategorySuggestions'), 0);
}

// ... وبالمثل لوظائف searchCustomersForExpense و searchEmployeesForExpense


/**
 * Selects an expense category and populates the form.
 * @param {object} category - The selected category object.
 */
function selectExpenseCategory(category) {
    console.log('Selecting category:', category);
    
    const expenseCategorySearch = document.getElementById('expenseCategorySearch');
    if (expenseCategorySearch) expenseCategorySearch.value = `${category.name} (${category.code})`;
    
    const selectedExpenseCategoryCode = document.getElementById('selectedExpenseCategoryCode');
    if (selectedExpenseCategoryCode) selectedExpenseCategoryCode.value = category.code;
    
    const selectedExpenseCategoryName = document.getElementById('selectedExpenseCategoryName');
    if (selectedExpenseCategoryName) selectedExpenseCategoryName.value = category.name;
    
    const selectedExpenseCategoryFormType = document.getElementById('selectedExpenseCategoryFormType');
    if (selectedExpenseCategoryFormType) selectedExpenseCategoryFormType.value = category.formType;
    
    const selectedExpenseCategoryId = document.getElementById('selectedExpenseCategoryId');
    if (selectedExpenseCategoryId) {
        let categoryId = category.id;
        if (categoryId && !isNaN(categoryId) && categoryId.length < 10) {
            categoryId = 'CAT_' + categoryId;
        }
        selectedExpenseCategoryId.value = categoryId;
        console.log('تم تعيين ID التصنيف:', selectedExpenseCategoryId.value);
    } else {
        console.error('عنصر selectedExpenseCategoryId غير موجود في DOM');
    }
    
    const expenseCategorySuggestions = document.getElementById('expenseCategorySuggestions');
    if (expenseCategorySuggestions) expenseCategorySuggestions.style.display = 'none';

    console.log('تم اختيار التصنيف بنجاح:', {
        id: selectedExpenseCategoryId?.value,
        code: category.code,
        name: category.name,
        formType: category.formType
    });

    generateDynamicExpenseForm(category.formType, selectedExpenseCategoryId?.value);
}

/**
 * Generates dynamic form fields based on the selected category's form type.
 * @param {string} formType - The form type of the selected category.
 * @param {string} categoryId - The ID of the selected category.
 * @param {object} [expenseData={}] - Existing expense data for editing.
 */
async function generateDynamicExpenseForm(formType, categoryId, expenseData = {}) {
    const dynamicFormDiv = document.getElementById('dynamicExpenseForm');
    if (!dynamicFormDiv) return;

    let formHtml = ``;

    const excludedFormTypes = ['دفعة_شركة', 'بنزين', 'شحن_تاب', 'شحن_كهربا', 'سلف', 'اونلاين', 'عيش', 'انابيب'];
    
    if (!excludedFormTypes.includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="expenseInvoiceNumber">رقم الفاتورة: <span style="color: red;">*</span></label>
                <input type="text" id="expenseInvoiceNumber" required placeholder="أدخل رقم الفاتورة" value="${expenseData.invoiceNumber || ''}">
            </div>
        `;
    }

    formHtml += `
        <div class="form-group">
            <label for="expenseAmount">القيمة: <span style="color: red;">*</span></label>
            <input type="number" id="expenseAmount" step="0.01" required placeholder="أدخل القيمة" value="${expenseData.amount || ''}">
        </div>
        <div class="form-group">
            <label for="expenseNotes">الملاحظات (اختياري):</label>
            <input type="text" id="expenseNotes" placeholder="أدخل ملاحظات" value="${expenseData.notes || ''}">
        </div>
    `;

    if (formType === 'فيزا') {
        formHtml += `
            <div class="form-group">
                <label for="visaReferenceNumber">الرقم المرجعي للفيزا : <span style="color: red;">*</span></label>
                <input type="text" id="visaReferenceNumber" pattern="\\d{20}" maxlength="20" required placeholder="ادخل ارقام الفيزا المرجعية "  value="${expenseData.referenceNumber || ''}">
            </div>
        `;
    } else if (formType === 'شحن_تاب') {
        formHtml += `
            <div class="form-group">
                <label for="tabName">اسم التاب (اختياري):</label>
                <input type="text" id="tabName" placeholder="أدخل اسم التاب" value="${expenseData.tabName || ''}">
            </div>
            <div class="form-group">
                <label for="tabPhone">رقم تليفون التاب:</label>
                <input type="tel" id="tabPhone" required placeholder="أدخل رقم تليفون التاب" value="${expenseData.tabPhone || ''}">
            </div>
        `;
    } else if (formType === 'شحن_كهربا') {
        formHtml += `
            <div class="form-group">
                <label for="electricityLocation">مكان الشحن:</label>
                <input type="text" id="electricityLocation" required placeholder="أدخل مكان الشحن" value="${expenseData.location || ''}">
            </div>
        `;
    } else if (['بنزين', 'سلف', 'عجوزات'].includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="personName">اسم الشخص:</label>
                <input type="text" id="personName" required placeholder="أدخل اسم الشخص" value="${expenseData.personName || ''}">
            </div>
        `;
    } else if (formType === 'دفعة_شركة') {
        formHtml += `
            <div class="form-group">
                <label for="companyName">اسم الشركة:</label>
                <input type="text" id="companyName" required placeholder="أدخل اسم الشركة" value="${expenseData.companyName || ''}">
            </div>
            <div class="form-group">
                <label for="companyCode">كود الشركة:</label>
                <input type="text" id="companyCode" placeholder="أدخل كود الشركة" value="${expenseData.companyCode || ''}">
            </div>
        `;
    } else if (formType === 'اجل') {
        formHtml += `
            <div class="form-group">
                <label for="customerSearch">البحث عن العميل: <span style="color: red;">*</span></label>
                <div class="input-group">
                    <input type="text" id="customerSearch" placeholder="ابحث بالاسم أو الرقم" onkeyup="searchCustomersForExpense(this.value)" autocomplete="off" value="${expenseData.customer ? (customers.find(c => c.id === expenseData.customer)?.name + ' (' + customers.find(c => c.id === expenseData.customer)?.phone + ')') : ''}">
                    <div id="customerSuggestions" class="suggestions"></div>
                </div>
                <input type="hidden" id="selectedCustomerId" value="${expenseData.customer || ''}">
                <input type="hidden" id="selectedCustomerName" value="${expenseData.customer ? customers.find(c => c.id === expenseData.customer)?.name : ''}">
            </div>
            <button type="button" class="add-btn" onclick="showAddCustomerModalFromExpense()" style="margin-top: 10px;">
                <i class="fas fa-plus"></i> إضافة عميل جديد
            </button>
        `;
    } else if (formType === 'سلف_موظف') {
        formHtml += `
            <div class="form-group">
                <label for="employeeSearch">البحث عن الموظف: <span style="color: red;">*</span></label>
                <div class="input-group">
                    <input type="text" id="employeeSearch" placeholder="ابحث بالاسم أو الرقم" onkeyup="searchEmployeesForExpense(this.value)" autocomplete="off" value="${expenseData.employee ? (employees.find(e => e.id === expenseData.employee)?.name + ' (' + employees.find(e => e.id === expenseData.employee)?.phone + ')') : ''}">
                    <div id="employeeSuggestions" class="suggestions"></div>
                </div>
                <input type="hidden" id="selectedEmployeeId" value="${expenseData.employee || ''}">
                <input type="hidden" id="selectedEmployeeName" value="${expenseData.employee ? employees.find(e => e.id === expenseData.employee)?.name : ''}">
            </div>
            
        `;
    }

    // Add custom fields dynamically
    const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
    if (customFieldsForCategory.length > 0) {
        formHtml += `<div class="section-header" style="margin-top: 20px;"><h4>حقول إضافية</h4></div>`;
        customFieldsForCategory.forEach(cf => {
            const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
            const requiredAttr = cf.isRequired ? 'required' : '';
            const fieldValue = expenseData.customFields ? expenseData.customFields[cf.fieldName] || '' : '';

            if (cf.fieldType === 'select') {
                formHtml += `
                    <div class="form-group">
                        <label for="${fieldId}">${cf.fieldName}: ${cf.isRequired ? '<span style="color: red;">*</span>' : ''}</label>
                        <select id="${fieldId}" ${requiredAttr}>
                            <option value="">اختر...</option>
                            ${cf.options.map(option => `<option value="${option}" ${fieldValue === option ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else {
                formHtml += `
                    <div class="form-group">
                        <label for="${fieldId}">${cf.fieldName}: ${cf.isRequired ? '<span style="color: red;">*</span>' : ''}</label>
                        <input type="${cf.fieldType}" id="${fieldId}" ${requiredAttr} placeholder="أدخل ${cf.fieldName}" value="${fieldValue}">
                    </div>
                `;
            }
        });
    }

    dynamicFormDiv.innerHTML = formHtml;
}

/**
 * Searches for customers for the expense form.
 * @param {string} searchTerm - The term to search for.
 */
function searchCustomersForExpense(searchTerm) {
    const suggestionsDiv = document.getElementById('customerSuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const filtered = customers.filter(cust =>
        cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cust.phone.includes(searchTerm)
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    filtered.forEach(cust => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cust.name} (${cust.phone}) - رصيد: ${cust.totalCredit.toFixed(2)}`;
        item.onclick = () => selectCustomerForExpense(cust);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
}

/**
 * Selects a customer for the expense form.
 * @param {object} customer - The selected customer object.
 */
function selectCustomerForExpense(customer) {
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) customerSearch.value = `${customer.name} (${customer.phone})`;
    const selectedCustomerId = document.getElementById('selectedCustomerId');
    if (selectedCustomerId) selectedCustomerId.value = customer.id;
    const selectedCustomerName = document.getElementById('selectedCustomerName');
    if (selectedCustomerName) selectedCustomerName.value = customer.name;
    const customerSuggestions = document.getElementById('customerSuggestions');
    if (customerSuggestions) customerSuggestions.style.display = 'none';
}

/**
 * Shows the add customer modal from the expense modal.
 */
function showAddCustomerModalFromExpense() {
    closeModal('addExpenseModal');
    setTimeout(() => {
        showAddCustomerModal(true);
    }, 300);
}

/**
 * Searches for employees for the expense form.
 * @param {string} searchTerm - The term to search for.
 */
function searchEmployeesForExpense(searchTerm) {
    const suggestionsDiv = document.getElementById('employeeSuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 1) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    if (!employees || employees.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">جارٍ تحميل بيانات الموظفين...</div>';
        suggestionsDiv.style.display = 'block';
        
        loadEmployees().then(() => {
            if (employees.length > 0) {
                searchEmployeesForExpense(searchTerm);
            } else {
                suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد بيانات موظفين</div>';
            }
        }).catch(error => {
            console.error('Error loading employees:', error);
            suggestionsDiv.innerHTML = '<div class="suggestion-item">خطأ في تحميل البيانات</div>';
        });
        return;
    }

    const filtered = employees.filter(emp =>
        emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone && emp.phone.includes(searchTerm)
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    filtered.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${emp.name} (${emp.phone}) - سلف: ${emp.totalAdvance.toFixed(2)}`;
        item.onclick = () => selectEmployeeForExpense(emp);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
}

/**
 * Selects an employee for the expense form.
 * @param {object} employee - The selected employee object.
 */
function selectEmployeeForExpense(employee) {
    const employeeSearch = document.getElementById('employeeSearch');
    if (employeeSearch) employeeSearch.value = `${employee.name} (${employee.phone})`;
    const selectedEmployeeId = document.getElementById('selectedEmployeeId');
    if (selectedEmployeeId) selectedEmployeeId.value = employee.id;
    const selectedEmployeeName = document.getElementById('selectedEmployeeName');
    if (selectedEmployeeName) selectedEmployeeName.value = employee.name;
    const employeeSuggestions = document.getElementById('employeeSuggestions');
    if (employeeSuggestions) employeeSuggestions.style.display = 'none';
}

/**
 * Shows the add employee modal from the expense modal.
 */
function showAddEmployeeModalFromExpense() {
    const currentFormData = {
        categoryId: document.getElementById('selectedExpenseCategoryId')?.value,
        categoryName: document.getElementById('selectedExpenseCategoryName')?.value,
        amount: document.getElementById('expenseAmount')?.value,
        invoiceNumber: document.getElementById('expenseInvoiceNumber')?.value
    };
    
    sessionStorage.setItem('pendingExpenseData', JSON.stringify(currentFormData));
    
    closeModal('addExpenseModal');
    
    setTimeout(() => {
        showAddEmployeeModal(true);
    }, 300);
}

/**
 * Adds a new expense to Google Sheets.
 */
async function addExpense() {
    if (expenseSubmissionInProgress) {
        console.log('Expense submission already in progress, skipping...');
        return;
    }
    expenseSubmissionInProgress = true;
    showLoading(true);
    try {
        const now = new Date();
        const currentDateTimeISO = now.toISOString();

        const categoryIdElement = document.getElementById('selectedExpenseCategoryId');
        const categoryCodeElement = document.getElementById('selectedExpenseCategoryCode');
        const categoryNameElement = document.getElementById('selectedExpenseCategoryName');
        const formTypeElement = document.getElementById('selectedExpenseCategoryFormType');
        
        const categoryId = categoryIdElement?.value;
        const categoryCode = categoryCodeElement?.value;
        const categoryName = categoryNameElement?.value;
        const formType = formTypeElement?.value;

        const amountInput = document.getElementById('expenseAmount');
        const amount = amountInput ? parseFloat(amountInput.value) : NaN;

        const notes = document.getElementById('expenseNotes')?.value.trim() || '';
        const invoiceNumber = document.getElementById('expenseInvoiceNumber')?.value.trim() || '';
        const visaReferenceNumber = document.getElementById('visaReferenceNumber')?.value.trim() || '';

        if (!categoryId || !categoryCode || !categoryName || !formType) {
            showMessage('يرجى اختيار تصنيف للمصروف.', 'warning');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            showMessage('يرجى إدخال قيمة صحيحة وموجبة للمصروف.', 'warning');
            return;
        }
        
        const excludedFormTypes = ['دفعة_شركة', 'بنزين', 'شحن_تاب', 'شحن_كهربا', 'سلف_موظف', 'اونلاين', 'عيش', 'انابيب'];
        const formTypesRequiringInvoice = ['عادي', 'فيزا', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'عجوزات', 'سلف_موظف'];

        if (formTypesRequiringInvoice.includes(formType)) {
            if (!invoiceNumber) {
                showMessage('يرجى إدخال رقم الفاتورة.', 'warning');
                return;
            }

            const allExistingExpenses = await readSheet(SHEETS.EXPENSES);
            const isInvoiceNumberDuplicate = allExistingExpenses.slice(1).some(row =>
                row[3] && row[3].trim() === invoiceNumber
            );

            if (isInvoiceNumberDuplicate) {
                showMessage('رقم الفاتورة هذا موجود بالفعل. يرجى إدخال رقم فاتورة فريد.', 'error');
                return;
            }
        }

        if (formType === 'فيزا' && !visaReferenceNumber) {
            showMessage('يرجى إدخال الرقم المرجعي للفيزا.', 'warning');
            return;
        }

        if (formType === 'اجل') {
            const customerId = document.getElementById('selectedCustomerId')?.value;
            if (!customerId) {
                showMessage('يرجى اختيار العميل الآجل.', 'warning');
                return;
            }

            const customerIndex = customers.findIndex(c => c.id === customerId);
            if (customerIndex !== -1) {
                const currentCustomer = customers[customerIndex];
                const newTotalCredit = currentCustomer.totalCredit + amount;

                const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
                if (rowIndex !== -1) {
                    const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [[newTotalCredit.toFixed(2)]]);
                    if (!updateResult.success) {
                        showMessage('فشل تحديث إجمالي الأجل للعميل.', 'error');
                        return;
                    }
                    await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [[currentDateTimeISO.split('T')[0]]]);
                } else {
                    showMessage('لم يتم العثور على العميل لتحديث الأجل.', 'error');
                    return;
                }

                currentCustomer.totalCredit = newTotalCredit;
                customers[customerIndex] = currentCustomer;

                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    customerId,
                    currentDateTimeISO.split('T')[0],
                    'أجل',
                    amount.toFixed(2),
                    invoiceNumber,
                    notes,
                    currentUser.username
                ];
                const historyResult = await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
                if (!historyResult.success) {
                    showMessage('فشل تسجيل حركة الأجل.', 'error');
                    return;
                }
            } else {
                showMessage('العميل المختار غير موجود.', 'error');
                return;
            }
        }

        if (formType === 'سلف_موظف') {
            const employeeId = document.getElementById('selectedEmployeeId')?.value;
            if (!employeeId) {
                showMessage('يرجى اختيار الموظف.', 'warning');
                return;
            }

            const employeeIndex = employees.findIndex(e => e.id === employeeId);
            if (employeeIndex !== -1) {
                const currentEmployee = employees[employeeIndex];
                const newTotalAdvance = currentEmployee.totalAdvance + amount;

                const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, employeeId);
                if (rowIndex !== -1) {
                    const updateResult = await updateSheet(SHEETS.EMPLOYEES, `D${rowIndex}`, [[newTotalAdvance.toFixed(2)]]);
                    if (!updateResult.success) {
                        showMessage('فشل تحديث إجمالي السلف للموظف.', 'error');
                        return;
                    }
                    await updateSheet(SHEETS.EMPLOYEES, `F${rowIndex}`, [[currentDateTimeISO.split('T')[0]]]);
                } else {
                    showMessage('لم يتم العثور على الموظف لتحديث السلف.', 'error');
                    return;
                }

                currentEmployee.totalAdvance = newTotalAdvance;
                employees[employeeIndex] = currentEmployee;

                const historyId = 'EAH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    employeeId,
                    currentDateTimeISO.split('T')[0],
                    'سلفة',
                    amount.toFixed(2),
                    notes,
                    currentUser.username
                ];
                const historyResult = await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
                if (!historyResult.success) {
                    showMessage('فشل تسجيل حركة السلفة.', 'error');
                    return;
                }
            } else {
                showMessage('الموظف المختار غير موجود.', 'error');
                return;
            }
        }
        
        const expenseId = 'EXP_' + now.getTime();

        let expenseData = [
            expenseId,
            categoryName,
            categoryCode,
            invoiceNumber,
            amount.toFixed(2),
            notes,
            currentDateTimeISO.split('T')[0],
            currentDateTimeISO.split('T')[1].substring(0, 8),
            currentUser.username,
            now.getFullYear().toString(),
            visaReferenceNumber,
            document.getElementById('tabName')?.value.trim() || '',
            document.getElementById('tabPhone')?.value.trim() || '',
            document.getElementById('electricityLocation')?.value.trim() || '',
            document.getElementById('personName')?.value.trim() || '',
            document.getElementById('companyName')?.value.trim() || '',
            document.getElementById('companyCode')?.value.trim() || '',
            document.getElementById('selectedCustomerId')?.value || '',
            document.getElementById('selectedEmployeeId')?.value || ''
        ];

        const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
        for (const cf of customFieldsForCategory) {
            const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
            const fieldValue = document.getElementById(fieldId)?.value || '';
            if (cf.isRequired && !fieldValue) {
                showMessage(`يرجى ملء الحقل المطلوب: ${cf.fieldName}.`, 'warning');
                return;
            }
            expenseData.push(fieldValue);
        }

        const result = await appendToSheet(SHEETS.EXPENSES, expenseData);

        if (result.success) {
            showMessage(`تم إضافة ${categoryName} بنجاح.`, 'success');
            await loadCashierExpenses();
            if (formType === 'اجل') {
                await loadCustomers();
                displayCustomers('customersTableBodyCashier');
            }
            if (formType === 'سلف_موظف') {
                await loadEmployees();
                displayEmployees('employeesTableBodyAccountant');
            }

            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle && pinToggle.checked) {
                document.getElementById('expenseInvoiceNumber').value = '';
                document.getElementById('expenseAmount').value = '';
                document.getElementById('expenseNotes').value = '';
                if (formType === 'فيزا') {
                    document.getElementById('visaReferenceNumber').value = '';
                } else if (formType === 'شحن_تاب') {
                    document.getElementById('tabName').value = '';
                    document.getElementById('tabPhone').value = '';
                } else if (formType === 'شحن_كهربا') {
                    document.getElementById('electricityLocation').value = '';
                } else if (['بنزين', 'سلف', 'عجوزات'].includes(formType)) {
                    document.getElementById('personName').value = '';
                } else if (formType === 'دفعة_شركة') {
                    document.getElementById('companyName').value = '';
                    document.getElementById('companyCode').value = '';
                } else if (formType === 'اجل') {
                    document.getElementById('customerSearch').value = '';
                    document.getElementById('selectedCustomerId').value = '';
                    document.getElementById('selectedCustomerName').value = '';
                } else if (formType === 'سلف_موظف') {
                    document.getElementById('employeeSearch').value = '';
                    document.getElementById('selectedEmployeeId').value = '';
                    document.getElementById('selectedEmployeeName').value = '';
                }
                for (const cf of customFieldsForCategory) {
                    const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
                    const fieldElement = document.getElementById(fieldId);
                    if (fieldElement) fieldElement.value = '';
                }
            } else {
                closeModal('addExpenseModal');
            }
        } else {
            showMessage('فشل إضافة المصروف.', 'error');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        showMessage('حدث خطأ أثناء إضافة المصروف.', 'error');
    } finally {
        expenseSubmissionInProgress = false;
        showLoading(false);
    }
}

/**
 * Updates an existing expense in Google Sheets.
 */
async function updateExpense() {
    if (!(await verifyModificationPassword())) return;
    if (!currentEditExpenseId) {
        showMessage('لا يوجد مصروف محدد للتعديل.', 'error');
        return;
    }

    showLoading(true);
    try {
        const now = new Date();
        const currentDateTimeISO = now.toISOString();

        const categoryId = document.getElementById('selectedExpenseCategoryId')?.value;
        const categoryCode = document.getElementById('selectedExpenseCategoryCode')?.value;
        const categoryName = document.getElementById('selectedExpenseCategoryName')?.value;
        const formType = document.getElementById('selectedExpenseCategoryFormType')?.value;
        const amountInput = document.getElementById('expenseAmount');
        const amount = amountInput ? parseFloat(amountInput.value) : NaN;
        const notes = document.getElementById('expenseNotes')?.value.trim() || '';
        const invoiceNumber = document.getElementById('expenseInvoiceNumber')?.value.trim() || '';
        const visaReferenceNumber = document.getElementById('visaReferenceNumber')?.value.trim() || '';

        if (!categoryId) {
            showMessage('يرجى اختيار تصنيف للمصروف.', 'warning');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            showMessage('يرجى إدخال قيمة صحيحة وموجبة للمصروف.', 'warning');
            return;
        }

        if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات', 'سلف_موظف'].includes(formType)) {
            if (!invoiceNumber) {
                showMessage('يرجى إدخال رقم الفاتورة.', 'warning');
                return;
            }
            const allExistingExpenses = await readSheet(SHEETS.EXPENSES);
            const isInvoiceNumberDuplicate = allExistingExpenses.slice(1).some(row =>
                row[0] !== currentEditExpenseId && row[3] && row[3].trim() === invoiceNumber
            );

            if (isInvoiceNumberDuplicate) {
                showMessage('رقم الفاتورة هذا موجود بالفعل لمصروف آخر. يرجى إدخال رقم فاتورة فريد.', 'error');
                return;
            }
        }

        if (formType === 'فيزا' && !visaReferenceNumber) {
            showMessage('يرجى إدخال الرقم المرجعي للفيزا.', 'warning');
            return;
        }

        const oldExpense = (await loadExpenses({})).find(exp => exp.id === currentEditExpenseId);
        if (!oldExpense) {
            showMessage('المصروف الأصلي غير موجود.', 'error');
            return;
        }

        if (formType === 'اجل') {
            const customerId = document.getElementById('selectedCustomerId')?.value;
            if (!customerId) {
                showMessage('يرجى اختيار العميل الآجل.', 'warning');
                return;
            }

            const oldCustomerId = oldExpense.customer;
            const oldAmount = oldExpense.amount;

            if (oldCustomerId !== customerId || oldAmount !== amount) {
                if (oldCustomerId) {
                    const oldCustomer = customers.find(c => c.id === oldCustomerId);
                    if (oldCustomer) {
                        const oldCustomerRowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, oldCustomerId);
                        if (oldCustomerRowIndex !== -1) {
                            const newOldCustomerCredit = oldCustomer.totalCredit - oldAmount;
                            await updateSheet(SHEETS.CUSTOMERS, `D${oldCustomerRowIndex}`, [[newOldCustomerCredit.toFixed(2)]]);
                            oldCustomer.totalCredit = newOldCustomerCredit;
                        }
                    }
                }

                const newCustomer = customers.find(c => c.id === customerId);
                if (newCustomer) {
                    const newCustomerRowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
                    if (newCustomerRowIndex !== -1) {
                        const newNewCustomerCredit = newCustomer.totalCredit + amount;
                        await updateSheet(SHEETS.CUSTOMERS, `D${newCustomerRowIndex}`, [[newNewCustomerCredit.toFixed(2)]]);
                        newCustomer.totalCredit = newNewCustomerCredit;
                    }
                }

                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    customerId,
                    currentDateTimeISO.split('T')[0],
                    'تعديل أجل',
                    amount.toFixed(2),
                    invoiceNumber,
                    `تعديل مصروف ${currentEditExpenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
            }
        }

        if (formType === 'سلف_موظف') {
            const employeeId = document.getElementById('selectedEmployeeId')?.value;
            if (!employeeId) {
                showMessage('يرجى اختيار الموظف.', 'warning');
                return;
            }

            const oldEmployeeId = oldExpense.employee;
            const oldAmount = oldExpense.amount;

            if (oldEmployeeId !== employeeId || oldAmount !== amount) {
                if (oldEmployeeId) {
                    const oldEmployee = employees.find(e => e.id === oldEmployeeId);
                    if (oldEmployee) {
                        const oldEmployeeRowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, oldEmployeeId);
                        if (oldEmployeeRowIndex !== -1) {
                            const newOldEmployeeAdvance = oldEmployee.totalAdvance - oldAmount;
                            await updateSheet(SHEETS.EMPLOYEES, `D${oldEmployeeRowIndex}`, [[newOldEmployeeAdvance.toFixed(2)]]);
                            oldEmployee.totalAdvance = newOldEmployeeAdvance;
                        }
                    }
                }

                const newEmployee = employees.find(e => e.id === employeeId);
                if (newEmployee) {
                    const newEmployeeRowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, employeeId);
                    if (newEmployeeRowIndex !== -1) {
                        const newNewEmployeeAdvance = newEmployee.totalAdvance + amount;
                        await updateSheet(SHEETS.EMPLOYEES, `D${newEmployeeRowIndex}`, [[newNewEmployeeAdvance.toFixed(2)]]);
                        newEmployee.totalAdvance = newNewEmployeeAdvance;
                    }
                }

                const historyId = 'EAH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    employeeId,
                    currentDateTimeISO.split('T')[0],
                    'تعديل سلفة',
                    amount.toFixed(2),
                    `تعديل مصروف ${currentEditExpenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
            }
        }

        const rowIndex = await findRowIndex(SHEETS.EXPENSES, 0, currentEditExpenseId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المصروف لتحديثه.', 'error');
            return;
        }

        let updatedExpenseData = [
            currentEditExpenseId,
            categoryName,
            categoryCode,
            invoiceNumber,
            amount.toFixed(2),
            notes,
            oldExpense.date,
            oldExpense.time,
            currentUser.username,
            oldExpense.year,
            visaReferenceNumber,
            document.getElementById('tabName')?.value.trim() || '',
            document.getElementById('tabPhone')?.value.trim() || '',
            document.getElementById('electricityLocation')?.value.trim() || '',
            document.getElementById('personName')?.value.trim() || '',
            document.getElementById('companyName')?.value.trim() || '',
            document.getElementById('companyCode')?.value.trim() || '',
            document.getElementById('selectedCustomerId')?.value || '',
            document.getElementById('selectedEmployeeId')?.value || ''
        ];

        const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
        for (const cf of customFieldsForCategory) {
            const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
            const fieldValue = document.getElementById(fieldId)?.value || '';
            if (cf.isRequired && !fieldValue) {
                showMessage(`يرجى ملء الحقل المطلوب: ${cf.fieldName}.`, 'warning');
                return;
            }
            updatedExpenseData.push(fieldValue);
        }

        const result = await updateSheet(SHEETS.EXPENSES, `A${rowIndex}:${String.fromCharCode(65 + updatedExpenseData.length - 1)}${rowIndex}`, [updatedExpenseData]);

        if (result.success) {
            showMessage('تم تعديل المصروف بنجاح.', 'success');
            closeModal('addExpenseModal');
            await loadCashierExpenses();
            if (formType === 'اجل') {
                await loadCustomers();
                displayCustomers('customersTableBodyCashier');
            }
            if (formType === 'سلف_موظف') {
                await loadEmployees();
                displayEmployees('employeesTableBodyAccountant');
            }
        } else {
            showMessage('فشل تعديل المصروف.', 'error');
        }
    } catch (error) {
        console.error('Error updating expense:', error);
        showMessage('حدث خطأ أثناء تعديل المصروف.', 'error');
    } finally {
        expenseSubmissionInProgress = false;
        showLoading(false);
    }
}

/**
 * Deletes an expense from Google Sheets.
 * @param {string} expenseId - The ID of the expense to delete.
 * @param {string} expenseCategory - The category of the expense.
 * @param {number} expenseAmount - The amount of the expense.
 * @param {string} expenseInvoiceNumber - The invoice number of the expense.
 */
async function deleteExpense(expenseId, expenseCategory, expenseAmount, expenseInvoiceNumber) {
    if (!(await verifyModificationPassword())) return;
    if (!confirm(`هل أنت متأكد من حذف المصروف "${expenseCategory}" بقيمة ${expenseAmount} ورقم فاتورة ${expenseInvoiceNumber}؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.EXPENSES, 0, expenseId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المصروف لحذفه.', 'error');
            return;
        }

        const expense = (await loadExpenses({})).find(exp => exp.id === expenseId);
        if (!expense) {
            showMessage('المصروف غير موجود.', 'error');
            return;
        }

        const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
        const formType = category ? category.formType : 'عادي';

        if (formType === 'اجل' && expense.customer) {
            const customer = customers.find(c => c.id === expense.customer);
            if (customer) {
                const customerRowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, expense.customer);
                if (customerRowIndex !== -1) {
                    const newTotalCredit = customer.totalCredit - expense.amount;
                    await updateSheet(SHEETS.CUSTOMERS, `D${customerRowIndex}`, [[newTotalCredit.toFixed(2)]]);
                    customer.totalCredit = newTotalCredit;
                }
                const now = new Date();
                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    expense.customer,
                    now.toISOString().split('T')[0],
                    'حذف أجل',
                    (-expense.amount).toFixed(2),
                    expense.invoiceNumber,
                    `حذف مصروف ${expenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
            }
        }

        if (formType === 'سلف_موظف' && expense.employee) {
            const employee = employees.find(e => e.id === expense.employee);
            if (employee) {
                const employeeRowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, expense.employee);
                if (employeeRowIndex !== -1) {
                    const newTotalAdvance = employee.totalAdvance - expense.amount;
                    await updateSheet(SHEETS.EMPLOYEES, `D${employeeRowIndex}`, [[newTotalAdvance.toFixed(2)]]);
                    employee.totalAdvance = newTotalAdvance;
                }
                const now = new Date();
                const historyId = 'EAH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    expense.employee,
                    now.toISOString().split('T')[0],
                    'حذف سلفة',
                    (-expense.amount).toFixed(2),
                    `حذف مصروف ${expenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
            }
        }

        const result = await deleteSheetRow(SHEETS.EXPENSES, rowIndex);

        if (result.success) {
            showMessage('تم حذف المصروف بنجاح.', 'success');
            await loadCashierExpenses();
            if (formType === 'اجل') {
                await loadCustomers();
                displayCustomers('customersTableBodyCashier');
            }
            if (formType === 'سلف_موظف') {
                await loadEmployees();
                displayEmployees('employeesTableBodyAccountant');
            }
        } else {
            showMessage('فشل حذف المصروف.', 'error');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        showMessage('حدث خطأ أثناء حذف المصروف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Loads and displays cashier's expenses.
 */
async function loadCashierExpenses() {
    const expenses = await loadExpenses({ cashier: currentUser.username });
    displayCashierExpensesTable(expenses);
}

/**
 * Displays cashier's expenses in a table.
 * @param {Array<object>} expenses - The array of expense objects to display.
 */
function displayCashierExpensesTable(expenses) {
    const tableBody = document.getElementById('expensesTableBodyCashier');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (expenses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">لا توجد مصروفات مسجلة لهذا الكاشير.</td></tr>';
        return;
    }

    expenses.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeB - dateTimeA;
    });

    expenses.forEach(exp => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = exp.category;
        row.insertCell().textContent = exp.invoiceNumber || '--';
        row.insertCell().textContent = exp.amount.toFixed(2);
        row.insertCell().textContent = exp.date;
        row.insertCell().textContent = exp.time.substring(0, 5);
        row.insertCell().textContent = exp.notes || '--';
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
        `;
    });
}

/**
 * Populates the expense category filter dropdown.
 */
function populateExpenseCategoryFilter() {
    const filterSelect = document.getElementById('expenseCategoryFilterCashier');
    if (!filterSelect) return;

    filterSelect.innerHTML = '<option value="">جميع التصنيفات</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        filterSelect.appendChild(option);
    });
}

/**
 * Filters cashier expenses based on selected criteria.
 */
async function filterCashierExpenses() {
    showLoading(true);
    try {
        const categoryFilter = document.getElementById('expenseCategoryFilterCashier')?.value || '';
        const dateFromFilter = document.getElementById('expenseDateFromFilterCashier')?.value || '';
        const dateToFilter = document.getElementById('expenseDateToFilterCashier')?.value || '';

        const filters = { cashier: currentUser.username };
        if (categoryFilter) filters.category = categoryFilter;
        if (dateFromFilter) filters.dateFrom = dateFromFilter;
        if (dateToFilter) filters.dateTo = dateToFilter;

        const filteredExpenses = await loadExpenses(filters);
        displayCashierExpensesTable(filteredExpenses);
    } catch (error) {
        console.error('Error filtering cashier expenses:', error);
        showMessage('حدث خطأ أثناء تصفية المصروفات.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Clears all cashier expense filters and reloads expenses.
 */
function clearCashierExpenseFilters() {
    const categoryFilter = document.getElementById('expenseCategoryFilterCashier');
    const dateFromFilter = document.getElementById('expenseDateFromFilterCashier');
    const dateToFilter = document.getElementById('expenseDateToFilterCashier');

    if (categoryFilter) categoryFilter.value = '';
    if (dateFromFilter) dateFromFilter.value = '';
    if (dateToFilter) dateToFilter.value = '';

    filterCashierExpenses();
}
