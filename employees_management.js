// --- Employees Management Functions ---

/**
 * Displays employee data in a specified table body.
 * @param {string} tableBodyId - The ID of the HTML table body element.
 */
function displayEmployees(tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">لا توجد موظفين مسجلين.</td></tr>';
        return;
    }

    employees.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

    employees.forEach(emp => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = emp.name;
        row.insertCell().textContent = emp.phone;
        row.insertCell().textContent = emp.totalAdvance.toFixed(2);
        row.insertCell().textContent = new Date(emp.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();

        if (currentUserRole === 'محاسب') {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showEditEmployeeModal('${emp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteEmployee('${emp.id}', '${emp.name}')"><i class="fas fa-trash"></i> حذف</button>
                <button class="view-btn" onclick="viewEmployeeDetails('${emp.id}', '${emp.name}')"><i class="fas fa-eye"></i> تفاصيل</button>
            `;
        } else {
            actionsCell.textContent = '--';
        }
    });
}

/**
 * Displays detailed information and advance history for a specific employee.
 * @param {string} employeeId - The ID of the employee.
 * @param {string} employeeName - The name of the employee.
 */
async function viewEmployeeDetails(employeeId, employeeName) {
    showLoading(true);
    try {
        currentSelectedEmployeeId = employeeId;
        const employeeDetailsName = document.getElementById('employeeDetailsName');
        if (employeeDetailsName) employeeDetailsName.textContent = employeeName;
        const employeeDetailsAccountant = document.getElementById('employeeDetailsAccountant');
        if (employeeDetailsAccountant) employeeDetailsAccountant.style.display = 'block';
        const employeePaymentAmount = document.getElementById('employeePaymentAmount');
        if (employeePaymentAmount) employeePaymentAmount.value = '';

        const history = await loadEmployeeAdvanceHistory(employeeId);
        const tableBody = document.getElementById('employeeAdvanceHistoryBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">لا توجد حركات سلف/سداد لهذا الموظف.</td></tr>';
            return;
        }

        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        history.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.date;
            row.insertCell().textContent = item.type;
            row.insertCell().textContent = item.amount.toFixed(2);
            row.insertCell().textContent = item.notes || '--';
            row.insertCell().textContent = item.recordedBy;
        });
    } catch (error) {
        console.error('Error viewing employee details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Processes a payment from an employee, updating their advance and history.
 */
async function processEmployeePayment() {
    if (!currentSelectedEmployeeId) {
        showMessage('يرجى اختيار موظف أولاً.', 'warning');
        return;
    }

    const paymentAmountInput = document.getElementById('employeePaymentAmount');
    const paymentAmount = paymentAmountInput ? parseFloat(paymentAmountInput.value) : NaN;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showMessage('يرجى إدخال مبلغ سداد صحيح وموجب.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const employeeIndex = employees.findIndex(e => e.id === currentSelectedEmployeeId);
        if (employeeIndex === -1) {
            showMessage('الموظف غير موجود.', 'error');
            return;
        }

        const currentEmployee = employees[employeeIndex];
        if (currentEmployee.totalAdvance < paymentAmount) {
            showMessage('مبلغ السداد أكبر من إجمالي السلف المستحقة.', 'warning');
            return;
        }

        const newTotalAdvance = currentEmployee.totalAdvance - paymentAmount;
        const now = new Date();
        const date = now.toISOString().split('T')[0];

        const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, currentSelectedEmployeeId);
        if (rowIndex !== -1) {
            const updateResult = await updateSheet(SHEETS.EMPLOYEES, `D${rowIndex}`, [[newTotalAdvance.toFixed(2)]]);
            if (!updateResult.success) {
                showMessage('فشل تحديث إجمالي السلف للموظف.', 'error');
                return;
            }
            await updateSheet(SHEETS.EMPLOYEES, `F${rowIndex}`, [[date]]);
        } else {
            showMessage('لم يتم العثور على الموظف لتحديث السلف.', 'error');
            return;
        }

        const historyId = 'EAH_' + now.getTime();
        const newHistoryEntry = [
            historyId,
            currentSelectedEmployeeId,
            date,
            'سداد سلفة',
            paymentAmount.toFixed(2),
            `سداد من المحاسب ${currentUserName}`,
            currentUser.username
        ];
        const historyResult = await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
        if (!historyResult.success) {
            showMessage('فشل تسجيل حركة السداد.', 'error');
            return;
        }

        currentEmployee.totalAdvance = newTotalAdvance;
        employees[employeeIndex] = currentEmployee;

        showMessage('تم سداد السلفة بنجاح.', 'success');
        if (paymentAmountInput) paymentAmountInput.value = '';
        await viewEmployeeDetails(currentSelectedEmployeeId, currentEmployee.name);
        displayEmployees('employeesTableBodyAccountant');
        updateAccountantDashboard();
    } catch (error) {
        console.error('Error processing employee payment:', error);
        showMessage('حدث خطأ أثناء معالجة السداد.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Shows the modal for adding a new employee.
 * @param {boolean} [fromExpense=false] - True if called from the expense modal.
 */
function showAddEmployeeModal(fromExpense = false) {
    const form = document.getElementById('addEmployeeForm');
    if (form) {
        form.reset();
        document.getElementById('addEmployeeModalTitle').textContent = 'إضافة موظف جديد';
        document.getElementById('addEmployeeModalSaveBtn').onclick = addEmployee;
        currentEditEmployeeId = null;
    }

    const modal = document.getElementById('addEmployeeModal');
    if (modal) {
        modal.classList.add('active');
        modal.dataset.fromExpense = fromExpense;
    }
}

/**
 * Shows the modal for editing an existing employee.
 * @param {string} employeeId - The ID of the employee to edit.
 */
async function showEditEmployeeModal(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
        showMessage('الموظف غير موجود.', 'error');
        return;
    }

    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeePhone').value = employee.phone;

    document.getElementById('addEmployeeModalTitle').textContent = 'تعديل موظف';
    document.getElementById('addEmployeeModalSaveBtn').onclick = updateEmployee;
    currentEditEmployeeId = employeeId;

    const modal = document.getElementById('addEmployeeModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Adds a new employee to Google Sheets.
 */
async function addEmployee() {
    const name = document.getElementById('employeeName')?.value.trim();
    const phone = document.getElementById('employeePhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول الموظف.', 'warning');
        return;
    }

    const existingEmployee = employees.find(emp => emp.phone === phone);
    if (existingEmployee) {
        showMessage('رقم التليفون موجود بالفعل لموظف آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const employeeId = 'EMP_' + new Date().getTime();
        const newEmployeeData = [
            employeeId,
            name,
            phone,
            '0.00',
            new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        ];

        const result = await appendToSheet(SHEETS.EMPLOYEES, newEmployeeData);

        if (result.success) {
            showMessage('تم إضافة الموظف بنجاح.', 'success');
            closeModal('addEmployeeModal');
            
            await loadEmployees(true);
            
            const modal = document.getElementById('addEmployeeModal');
            if (modal && modal.dataset.fromExpense === 'true') {
                const pendingData = sessionStorage.getItem('pendingExpenseData');
                
                setTimeout(() => {
                    showAddExpenseModal();
                    
                    setTimeout(() => {
                        const newEmployeeObj = { 
                            id: employeeId, 
                            name: name, 
                            phone: phone, 
                            totalAdvance: 0 
                        };
                        
                        selectEmployeeForExpense(newEmployeeObj);
                        
                        if (pendingData) {
                            const data = JSON.parse(pendingData);
                            if (data.amount) {
                                document.getElementById('expenseAmount').value = data.amount;
                            }
                            if (data.invoiceNumber) {
                                document.getElementById('expenseInvoiceNumber').value = data.invoiceNumber;
                            }
                            sessionStorage.removeItem('pendingExpenseData');
                        }
                    }, 500);
                }, 300);
            } else {
                displayEmployees('employeesTableBodyAccountant');
                if (document.getElementById('employeesTabCashier').classList.contains('active')) {
                    displayEmployees('employeesTableBodyCashier');
                }
            }
            
            updateAccountantDashboard();
        } else {
            showMessage('فشل إضافة الموظف.', 'error');
        }
    } catch (error) {
        console.error('Error adding employee:', error);
        showMessage('حدث خطأ أثناء إضافة الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Updates an existing employee in Google Sheets.
 */
async function updateEmployee() {
    if (!currentEditEmployeeId) {
        showMessage('لا يوجد موظف محدد للتعديل.', 'error');
        return;
    }

    const name = document.getElementById('employeeName')?.value.trim();
    const phone = document.getElementById('employeePhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول الموظف.', 'warning');
        return;
    }

    const existingEmployee = employees.find(emp => emp.phone === phone && emp.id !== currentEditEmployeeId);
    if (existingEmployee) {
        showMessage('رقم التليفون موجود بالفعل لموظف آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, currentEditEmployeeId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على الموظف لتحديثه.', 'error');
            return;
        }

        const oldEmployee = employees.find(emp => emp.id === currentEditEmployeeId);
        const updatedEmployeeData = [
            currentEditEmployeeId,
            name,
            phone,
            oldEmployee.totalAdvance.toFixed(2),
            oldEmployee.creationDate,
            new Date().toISOString().split('T')[0]
        ];

        const result = await updateSheet(SHEETS.EMPLOYEES, `A${rowIndex}:F${rowIndex}`, [updatedEmployeeData]);

        if (result.success) {
            showMessage('تم تعديل الموظف بنجاح.', 'success');
            closeModal('addEmployeeModal');
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            if (document.getElementById('employeesTabCashier').classList.contains('active')) {
                displayEmployees('employeesTableBodyCashier');
            }
            updateAccountantDashboard();
        } else {
            showMessage('فشل تعديل الموظف.', 'error');
        }
    } catch (error) {
        console.error('Error updating employee:', error);
        showMessage('حدث خطأ أثناء تعديل الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes an employee from Google Sheets.
 * @param {string} employeeId - The ID of the employee to delete.
 * @param {string} employeeName - The name of the employee (for confirmation message).
 */
async function deleteEmployee(employeeId, employeeName) {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${employeeName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, employeeId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على الموظف لحذفه.', 'error');
            return;
        }

        const employee = employees.find(e => e.id === employeeId);
        if (employee && employee.totalAdvance > 0) {
            showMessage('لا يمكن حذف الموظف لديه سلف مستحقة. يرجى تسوية السلف أولاً.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.EMPLOYEES, rowIndex);

        if (result.success) {
            showMessage('تم حذف الموظف بنجاح.', 'success');
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            if (document.getElementById('employeesTabCashier').classList.contains('active')) {
                displayEmployees('employeesTableBodyCashier');
            }
            updateAccountantDashboard();
        } else {
            showMessage('فشل حذف الموظف.', 'error');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        showMessage('حدث خطأ أثناء حذف الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}