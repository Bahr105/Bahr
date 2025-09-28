// --- Users Management Functions ---

/**
 * Displays user data in the accountant's user table.
 */
function displayUsers() {
    const tableBody = document.getElementById('usersTableBodyAccountant');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">لا توجد مستخدمين.</td></tr>';
        return;
    }

    users.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${user.status === 'نشط' ? 'active' : user.status === 'موقوف' ? 'suspended' : 'blocked'}">${user.status}</span>`;

        row.insertCell().textContent = user.creationDate;

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showEditUserModal('${user.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="deleteUser('${user.id}', '${user.name}')"><i class="fas fa-trash"></i> حذف</button>
            <button class="block-btn" onclick="showChangePasswordModal('${user.id}')"><i class="fas fa-key"></i> كلمة المرور</button>
            <button class="status-btn" onclick="toggleUserStatus('${user.id}', '${user.status}')"><i class="fas fa-toggle-${user.status === 'نشط' ? 'on' : 'off'}"></i> ${user.status === 'نشط' ? 'إيقاف' : 'تنشيط'}</button>
        `;
    });
}

/**
 * Shows the modal for adding a new user.
 */
function showAddUserModal() {
    const form = document.getElementById('addUserForm');
    if (form) {
        form.reset();
        document.getElementById('addUserModalTitle').textContent = 'إضافة مستخدم جديد';
        document.getElementById('addUserModalSaveBtn').onclick = addUser;
        currentEditUserId = null;
    }

    const modal = document.getElementById('addUserModal');
    if (modal) modal.classList.add('active');
}

/**
 * Shows the modal for editing an existing user.
 * @param {string} userId - The ID of the user to edit.
 */
async function showEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) {
        showMessage('المستخدم غير موجود.', 'error');
        return;
    }

    document.getElementById('userName').value = user.name;
    document.getElementById('userPhone').value = user.phone;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userPassword').value = user.password;
    document.getElementById('userRole').value = user.role;

    document.getElementById('addUserModalTitle').textContent = 'تعديل مستخدم';
    document.getElementById('addUserModalSaveBtn').onclick = updateUser;
    currentEditUserId = userId;

    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Adds a new user to Google Sheets.
 */
async function addUser() {
    const name = document.getElementById('userName')?.value.trim();
    const phone = document.getElementById('userPhone')?.value.trim();
    const username = document.getElementById('userUsername')?.value.trim();
    const password = document.getElementById('userPassword')?.value.trim();
    const role = document.getElementById('userRole')?.value;

    if (!name || !phone || !username || !password || !role) {
        showMessage('يرجى ملء جميع حقول المستخدم.', 'warning');
        return;
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        showMessage('اسم المستخدم موجود بالفعل. يرجى استخدام اسم مستخدم فريد.', 'warning');
        return;
    }

    const existingPhone = users.find(u => u.phone === phone);
    if (existingPhone) {
        showMessage('رقم التليفون موجود بالفعل لمستخدم آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const userId = 'USER_' + new Date().getTime();
        const newUserData = [
            userId,
            name,
            phone,
            username,
            password,
            role,
            'نشط',
            new Date().toISOString().split('T')[0]
        ];

        const result = await appendToSheet(SHEETS.USERS, newUserData);

        if (result.success) {
            showMessage('تم إضافة المستخدم بنجاح.', 'success');
            closeModal('addUserModal');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل إضافة المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        showMessage('حدث خطأ أثناء إضافة المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Updates an existing user in Google Sheets.
 */
async function updateUser() {
    if (!currentEditUserId) {
        showMessage('لا يوجد مستخدم محدد للتعديل.', 'error');
        return;
    }

    const name = document.getElementById('userName')?.value.trim();
    const phone = document.getElementById('userPhone')?.value.trim();
    const username = document.getElementById('userUsername')?.value.trim();
    const password = document.getElementById('userPassword')?.value.trim();
    const role = document.getElementById('userRole')?.value;

    if (!name || !phone || !username || !password || !role) {
        showMessage('يرجى ملء جميع حقول المستخدم.', 'warning');
        return;
    }

    const existingUser = users.find(u => u.username === username && u.id !== currentEditUserId);
    if (existingUser) {
        showMessage('اسم المستخدم موجود بالفعل لمستخدم آخر. يرجى استخدام اسم مستخدم فريد.', 'warning');
        return;
    }

    const existingPhone = users.find(u => u.phone === phone && u.id !== currentEditUserId);
    if (existingPhone) {
        showMessage('رقم التليفون موجود بالفعل لمستخدم آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, currentEditUserId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لتحديثه.', 'error');
            return;
        }

        const oldUser = users.find(u => u.id === currentEditUserId);
        const updatedUserData = [
            currentEditUserId,
            name,
            phone,
            username,
            password,
            role,
            oldUser.status,
            oldUser.creationDate
        ];

        const result = await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [updatedUserData]);

        if (result.success) {
            showMessage('تم تعديل المستخدم بنجاح.', 'success');
            closeModal('addUserModal');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل تعديل المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showMessage('حدث خطأ أثناء تعديل المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes a user from Google Sheets.
 * @param {string} userId - The ID of the user to delete.
 * @param {string} userName - The name of the user (for confirmation message).
 */
async function deleteUser(userId, userName) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, userId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لحذفه.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.USERS, rowIndex);

        if (result.success) {
            showMessage('تم حذف المستخدم بنجاح.', 'success');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل حذف المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('حدث خطأ أثناء حذف المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Toggles the status of a user (active/suspended).
 * @param {string} userId - The ID of the user.
 * @param {string} currentStatus - The current status of the user.
 */
async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'نشط' ? 'موقوف' : 'نشط';
    if (!confirm(`هل أنت متأكد من تغيير حالة المستخدم إلى "${newStatus}"؟`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, userId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لتغيير حالته.', 'error');
            return;
        }

        const user = users.find(u => u.id === userId);
        const updatedUserData = [
            user.id, user.name, user.phone, user.username, user.password, user.role, newStatus, user.creationDate
        ];

        const result = await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [updatedUserData]);

        if (result.success) {
            showMessage(`تم تغيير حالة المستخدم إلى "${newStatus}" بنجاح.`, 'success');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل تغيير حالة المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showMessage('حدث خطأ أثناء تغيير حالة المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Shows the modal for changing a user's password.
 * @param {string} userId - The ID of the user.
 */
function showChangePasswordModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) {
        showMessage('المستخدم غير موجود.', 'error');
        return;
    }

    document.getElementById('changePasswordModalUserName').textContent = user.name;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('changePasswordModalSaveBtn').onclick = () => changeUserPassword(userId);

    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.classList.add('active');
}

/**
 * Changes a user's password in Google Sheets.
 * @param {string} userId - The ID of the user.
 */
async function changeUserPassword(userId) {
    const newPassword = document.getElementById('newPassword')?.value.trim();
    const confirmNewPassword = document.getElementById('confirmNewPassword')?.value.trim();

    if (!newPassword || !confirmNewPassword) {
        showMessage('يرجى إدخال كلمة المرور الجديدة وتأكيدها.', 'warning');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showMessage('كلمة المرور الجديدة وتأكيدها غير متطابقين.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, userId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لتغيير كلمة مروره.', 'error');
            return;
        }

        const user = users.find(u => u.id === userId);
        const updatedUserData = [
            user.id, user.name, user.phone, user.username, newPassword, user.role, user.status, user.creationDate
        ];

        const result = await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [updatedUserData]);

        if (result.success) {
            showMessage('تم تغيير كلمة المرور بنجاح.', 'success');
            closeModal('changePasswordModal');
            await loadUsers();
            displayUsers();
        } else {
            showMessage('فشل تغيير كلمة المرور.', 'error');
        }
    } catch (error) {
        console.error('Error changing user password:', error);
        showMessage('حدث خطأ أثناء تغيير كلمة المرور.', 'error');
    } finally {
        showLoading(false);
    }
}
