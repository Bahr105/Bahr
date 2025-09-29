// --- Customers Management Functions ---

/**
 * Displays customer data in a specified table body.
 * @param {string} tableBodyId - The ID of the HTML table body element.
 */
function displayCustomers(tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (customers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">لا توجد عملاء مسجلين.</td></tr>';
        return;
    }

    customers.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

    customers.forEach(cust => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = cust.name;
        row.insertCell().textContent = cust.phone;
        row.insertCell().textContent = cust.totalCredit.toFixed(2);
        row.insertCell().textContent = new Date(cust.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();

        if (tableBodyId === 'customersTableBodyAccountant') {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showEditCustomerModal('${cust.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCustomer('${cust.id}', '${cust.name}')"><i class="fas fa-trash"></i> حذف</button>
                <button class="view-btn" onclick="viewCustomerDetails('${cust.id}', '${cust.name}')"><i class="fas fa-eye"></i> تفاصيل</button>
            `;
        } else { // Cashier page
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showEditCustomerModal('${cust.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCustomer('${cust.id}', '${cust.name}')"><i class="fas fa-trash"></i> حذف</button>
            `;
        }
    });
}

/**
 * Displays detailed information and credit history for a specific customer.
 * @param {string} customerId - The ID of the customer.
 * @param {string} customerName - The name of the customer.
 */
async function viewCustomerDetails(customerId, customerName) {
    showLoading(true);
    try {
        currentSelectedCustomerId = customerId;
        const customerDetailsName = document.getElementById('customerDetailsName');
        if (customerDetailsName) customerDetailsName.textContent = customerName;
        const customerDetailsAccountant = document.getElementById('customerDetailsAccountant');
        if (customerDetailsAccountant) customerDetailsAccountant.style.display = 'block';
        const customerPaymentAmount = document.getElementById('customerPaymentAmount');
        if (customerPaymentAmount) customerPaymentAmount.value = '';

        const history = await loadCustomerCreditHistory(customerId);
        const tableBody = document.getElementById('customerCreditHistoryBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">لا توجد حركات أجل/سداد لهذا العميل.</td></tr>';
            return;
        }

        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        history.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.date;
            row.insertCell().textContent = item.type;
            row.insertCell().textContent = item.amount.toFixed(2);
            row.insertCell().textContent = item.invoiceNumber || item.notes || '--';
            row.insertCell().textContent = item.recordedBy;
        });
    } catch (error) {
        console.error('Error viewing customer details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل العميل.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Processes a payment from a customer, updating their credit and history.
 */
async function processCustomerPayment() {
    if (!currentSelectedCustomerId) {
        showMessage('يرجى اختيار عميل أولاً.', 'warning');
        return;
    }

    const paymentAmountInput = document.getElementById('customerPaymentAmount');
    const paymentAmount = paymentAmountInput ? parseFloat(paymentAmountInput.value) : NaN;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showMessage('يرجى إدخال مبلغ سداد صحيح وموجب.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const customerIndex = customers.findIndex(c => c.id === currentSelectedCustomerId);
        if (customerIndex === -1) {
            showMessage('العميل غير موجود.', 'error');
            return;
        }

        const currentCustomer = customers[customerIndex];
        if (currentCustomer.totalCredit < paymentAmount) {
            showMessage('مبلغ السداد أكبر من إجمالي الأجل المستحق.', 'warning');
            return;
        }

        const newTotalCredit = currentCustomer.totalCredit - paymentAmount;
        const now = new Date();
        const date = now.toISOString().split('T')[0];

        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, currentSelectedCustomerId);
        if (rowIndex !== -1) {
            const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [[newTotalCredit.toFixed(2)]]);
            if (!updateResult.success) {
                showMessage('فشل تحديث إجمالي الأجل للعميل.', 'error');
                return;
            }
            await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [[date]]);
        } else {
            showMessage('لم يتم العثور على العميل لتحديث الأجل.', 'error');
            return;
        }

        const historyId = 'CRH_' + now.getTime();
        const newHistoryEntry = [
            historyId,
            currentSelectedCustomerId,
            date,
            'سداد',
            paymentAmount.toFixed(2),
            '',
            `سداد من المحاسب ${currentUserName}`,
            currentUser.username
        ];
        const historyResult = await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
        if (!historyResult.success) {
            showMessage('فشل تسجيل حركة السداد.', 'error');
            return;
        }

        currentCustomer.totalCredit = newTotalCredit;
        customers[customerIndex] = currentCustomer;

        showMessage('تم سداد الأجل بنجاح.', 'success');
        if (paymentAmountInput) paymentAmountInput.value = '';
        await viewCustomerDetails(currentSelectedCustomerId, currentCustomer.name);
        displayCustomers('customersTableBodyAccountant');
        updateAccountantDashboard();
    } catch (error) {
        console.error('Error processing customer payment:', error);
        showMessage('حدث خطأ أثناء معالجة السداد.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Shows the modal for adding a new customer.
 * @param {boolean} [fromExpense=false] - True if called from the expense modal.
 */
function showAddCustomerModal(fromExpense = false) {
    const form = document.getElementById('addCustomerForm');
    if (form) {
        form.reset();
        document.getElementById('addCustomerModalTitle').textContent = 'إضافة عميل جديد';
        document.getElementById('addCustomerModalSaveBtn').onclick = addCustomer;
        currentSelectedCustomerId = null;
    }

    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.classList.add('active');
        modal.dataset.fromExpense = fromExpense;
    }
}

/**
 * Shows the modal for editing an existing customer.
 * @param {string} customerId - The ID of the customer to edit.
 */
async function showEditCustomerModal(customerId) {
    const customer = customers.find(cust => cust.id === customerId);
    if (!customer) {
        showMessage('العميل غير موجود.', 'error');
        return;
    }

    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerPhone').value = customer.phone;

    document.getElementById('addCustomerModalTitle').textContent = 'تعديل عميل';
    document.getElementById('addCustomerModalSaveBtn').onclick = updateCustomer;
    currentSelectedCustomerId = customerId;

    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Adds a new customer to Google Sheets.
 */
async function addCustomer() {
    const name = document.getElementById('customerName')?.value.trim();
    const phone = document.getElementById('customerPhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول العميل.', 'warning');
        return;
    }

    // منع الإضافة المزدوجة
    if (window.addingCustomerInProgress) {
        showMessage('جاري إضافة العميل، يرجى الانتظار...', 'warning');
        return;
    }
    window.addingCustomerInProgress = true;

    const existingCustomer = customers.find(cust => cust.phone === phone);
    if (existingCustomer) {
        showMessage('رقم التليفون موجود بالفعل لعميل آخر. يرجى استخدام رقم فريد.', 'warning');
        window.addingCustomerInProgress = false;
        return;
    }

    showLoading(true);
    try {
        const customerId = 'CUST_' + new Date().getTime();
        const newCustomerData = [
            customerId,
            name,
            phone,
            '0.00',
            new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        ];

        const result = await appendToSheet(SHEETS.CUSTOMERS, newCustomerData);

        if (result.success) {
            showMessage('تم إضافة العميل بنجاح.', 'success');
            closeModal('addCustomerModal');
            await loadCustomers();
            displayCustomers('customersTableBodyCashier');
            displayCustomers('customersTableBodyAccountant');
            updateAccountantDashboard();

            const modal = document.getElementById('addCustomerModal');
            if (modal && modal.dataset.fromExpense === 'true') {
                showAddExpenseModal();
                const newCustomerObj = { id: customerId, name: name, phone: phone, totalCredit: 0 };
                selectCustomerForExpense(newCustomerObj);
            }
        } else {
            showMessage('فشل إضافة العميل.', 'error');
        }
    } catch (error) {
        console.error('Error adding customer:', error);
        showMessage('حدث خطأ أثناء إضافة العميل.', 'error');
    } finally {
        showLoading(false);
        window.addingCustomerInProgress = false;
    }
}

/**
 * Updates an existing customer in Google Sheets.
 */
async function updateCustomer() {
    if (!currentSelectedCustomerId) {
        showMessage('لا يوجد عميل محدد للتعديل.', 'error');
        return;
    }

    const name = document.getElementById('customerName')?.value.trim();
    const phone = document.getElementById('customerPhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول العميل.', 'warning');
        return;
    }

    const existingCustomer = customers.find(cust => cust.phone === phone && cust.id !== currentSelectedCustomerId);
    if (existingCustomer) {
        showMessage('رقم التليفون موجود بالفعل لعميل آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, currentSelectedCustomerId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على العميل لتحديثه.', 'error');
            return;
        }

        const oldCustomer = customers.find(cust => cust.id === currentSelectedCustomerId);
        const updatedCustomerData = [
            currentSelectedCustomerId,
            name,
            phone,
            oldCustomer.totalCredit.toFixed(2),
            oldCustomer.creationDate,
            new Date().toISOString().split('T')[0]
        ];

        const result = await updateSheet(SHEETS.CUSTOMERS, `A${rowIndex}:F${rowIndex}`, [updatedCustomerData]);

        if (result.success) {
            showMessage('تم تعديل العميل بنجاح.', 'success');
            closeModal('addCustomerModal');
            await loadCustomers();
            displayCustomers('customersTableBodyCashier');
            displayCustomers('customersTableBodyAccountant');
            updateAccountantDashboard();
        } else {
            showMessage('فشل تعديل العميل.', 'error');
        }
    } catch (error) {
        console.error('Error updating customer:', error);
        showMessage('حدث خطأ أثناء تعديل العميل.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes a customer from Google Sheets.
 * @param {string} customerId - The ID of the customer to delete.
 * @param {string} customerName - The name of the customer (for confirmation message).
 */
async function deleteCustomer(customerId, customerName) {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customerName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على العميل لحذفه.', 'error');
            return;
        }

        const customer = customers.find(c => c.id === customerId);
        if (customer && customer.totalCredit > 0) {
            showMessage('لا يمكن حذف العميل لديه أجل مستحق. يرجى تسوية الأجل أولاً.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.CUSTOMERS, rowIndex);

        if (result.success) {
            showMessage('تم حذف العميل بنجاح.', 'success');
            await loadCustomers();
            displayCustomers('customersTableBodyCashier');
            displayCustomers('customersTableBodyAccountant');
            updateAccountantDashboard();
        } else {
            showMessage('فشل حذف العميل.', 'error');
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showMessage('حدث خطأ أثناء حذف العميل.', 'error');
    } finally {
        showLoading(false);
    }
}
