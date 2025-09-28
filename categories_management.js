// --- Categories Management Functions ---

/**
 * Displays categories in a specified grid.
 * @param {string} gridId - The ID of the HTML element to display categories in.
 */
function displayCategories(gridId) {
    const categoriesGrid = document.getElementById(gridId);
    if (!categoriesGrid) return;

    categoriesGrid.innerHTML = '';
    if (categories.length === 0) {
        categoriesGrid.innerHTML = '<p>لا توجد تصنيفات مسجلة.</p>';
        return;
    }

    categories.forEach(cat => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <div class="category-header">
                <span class="category-name">${cat.name}</span>
                <span class="category-code">${cat.code}</span>
            </div>
            <div class="category-type">نوع الفورم: ${cat.formType}</div>
            <div class="category-actions">
                <button class="edit-btn" onclick="showEditCategoryModal('${cat.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCategory('${cat.id}', '${cat.name}')"><i class="fas fa-trash"></i> حذف</button>
            </div>
        `;
        categoriesGrid.appendChild(categoryCard);
    });
}

/**
 * Shows the modal for adding a new category.
 */
function showAddCategoryModal() {
    const form = document.getElementById('addCategoryForm');
    if (form) {
        form.reset();
        document.getElementById('addCategoryModalTitle').textContent = 'إضافة تصنيف جديد';
        document.getElementById('addCategoryModalSaveBtn').onclick = addCategory;
        currentEditCategoryId = null;
        document.getElementById('customFieldsContainer').innerHTML = '';
    }
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Shows the modal for editing an existing category.
 * @param {string} categoryId - The ID of the category to edit.
 */
async function showEditCategoryModal(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) {
        showMessage('التصنيف غير موجود.', 'error');
        return;
    }

    document.getElementById('categoryCode').value = category.code;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('formType').value = category.formType;

    const customFieldsContainer = document.getElementById('customFieldsContainer');
    customFieldsContainer.innerHTML = '';
    const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
    customFieldsForCategory.forEach(cf => {
        addCustomFieldToEditor(cf.fieldName, cf.fieldType, cf.isRequired, cf.options);
    });

    document.getElementById('addCategoryModalTitle').textContent = 'تعديل تصنيف';
    document.getElementById('addCategoryModalSaveBtn').onclick = updateCategory;
    currentEditCategoryId = categoryId;

    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Adds a custom field editor item to the category modal.
 * @param {string} [fieldName=''] - The name of the custom field.
 * @param {string} [fieldType='text'] - The type of the custom field.
 * @param {boolean} [isRequired=false] - Whether the custom field is required.
 * @param {Array<string>} [options=[]] - Options for 'select' type fields.
 */
function addCustomFieldToEditor(fieldName = '', fieldType = 'text', isRequired = false, options = []) {
    const container = document.getElementById('customFieldsContainer');
    const fieldId = `customFieldEditor_${Date.now()}`;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'custom-field-editor-item';
    fieldDiv.id = fieldId;
    fieldDiv.innerHTML = `
        <div class="form-group">
            <label for="${fieldId}_name">اسم الحقل:</label>
            <input type="text" id="${fieldId}_name" value="${fieldName}" placeholder="مثال: رقم الطلب" required>
        </div>
        <div class="form-group">
            <label for="${fieldId}_type">نوع الحقل:</label>
            <select id="${fieldId}_type" onchange="toggleOptionsInput('${fieldId}')">
                <option value="text" ${fieldType === 'text' ? 'selected' : ''}>نص</option>
                <option value="number" ${fieldType === 'number' ? 'selected' : ''}>رقم</option>
                <option value="date" ${fieldType === 'date' ? 'selected' : ''}>تاريخ</option>
                <option value="select" ${fieldType === 'select' ? 'selected' : ''}>قائمة منسدلة</option>
            </select>
        </div>
        <div class="form-group">
            <input type="checkbox" id="${fieldId}_required" ${isRequired ? 'checked' : ''}>
            <label for="${fieldId}_required">مطلوب</label>
        </div>
        <div class="form-group options-group" id="${fieldId}_options_group" style="display: ${fieldType === 'select' ? 'block' : 'none'};">
            <label for="${fieldId}_options">خيارات (افصل بينها بفاصلة):</label>
            <input type="text" id="${fieldId}_options" value="${options.join(',')}" placeholder="مثال: خيار1,خيار2">
        </div>
        <button type="button" class="delete-btn" onclick="document.getElementById('${fieldId}').remove()">
            <i class="fas fa-trash"></i> حذف
        </button>
    `;
    container.appendChild(fieldDiv);
}

/**
 * Toggles the visibility of the options input field based on the custom field type.
 * @param {string} fieldId - The ID of the custom field editor item.
 */
function toggleOptionsInput(fieldId) {
    const fieldTypeSelect = document.getElementById(`${fieldId}_type`);
    const optionsGroup = document.getElementById(`${fieldId}_options_group`);
    if (fieldTypeSelect && optionsGroup) {
        if (fieldTypeSelect.value === 'select') {
            optionsGroup.style.display = 'block';
        } else {
            optionsGroup.style.display = 'none';
        }
    }
}

/**
 * Adds a new category to Google Sheets.
 */
async function addCategory() {
    const categoryId = 'CAT_' + new Date().getTime();
    const code = document.getElementById('categoryCode')?.value.trim();
    const name = document.getElementById('categoryName')?.value.trim();
    const formType = document.getElementById('formType')?.value;

    if (!code || !name || !formType) {
        showMessage('يرجى ملء جميع حقول التصنيف الأساسية.', 'warning');
        return;
    }

    const existingCategory = categories.find(cat => cat.code === code);
    if (existingCategory) {
        showMessage('كود التصنيف موجود بالفعل. يرجى استخدام كود آخر.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const newCategoryData = [
            categoryId,
            code,
            name,
            formType,
            new Date().toISOString().split('T')[0],
            currentUserName
        ];

        const result = await appendToSheet(SHEETS.CATEGORIES, newCategoryData);

        if (result.success) {
            const customFieldsToSave = [];
            const customFieldItems = document.querySelectorAll('.custom-field-editor-item');
            for (const item of customFieldItems) {
                const fieldNameInput = item.querySelector('input[type="text"]');
                const fieldTypeSelect = item.querySelector('select');
                const isRequiredCheckbox = item.querySelector('input[type="checkbox"]');
                const optionsInput = item.querySelector('.options-group input[type="text"]');

                if (!fieldNameInput || !fieldTypeSelect || !isRequiredCheckbox) {
                    console.warn('Missing elements in custom field editor item:', item);
                    continue;
                }

                const fieldName = fieldNameInput.value.trim();
                const fieldType = fieldTypeSelect.value;
                const isRequired = isRequiredCheckbox.checked;
                const options = fieldType === 'select' && optionsInput ? optionsInput.value.split(',').map(opt => opt.trim()).filter(opt => opt) : [];

                if (fieldName) {
                    customFieldsToSave.push([
                        categoryId,
                        fieldName,
                        fieldType,
                        isRequired.toString(),
                        JSON.stringify(options)
                    ]);
                }
            }

            if (customFieldsToSave.length > 0) {
                for (const cfData of customFieldsToSave) {
                    await appendToSheet(SHEETS.CATEGORY_CUSTOM_FIELDS, cfData);
                }
            }

            showMessage('تم إضافة التصنيف بنجاح.', 'success');
            closeModal('addCategoryModal');
            await loadCategories();
            await loadCategoryCustomFields();
            displayCategories('categoriesGridCashier');
            displayCategories('categoriesGridAccountant');
            populateExpenseCategoryFilter();
            populateAccountantFilters();
        } else {
            showMessage('فشل إضافة التصنيف.', 'error');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        showMessage('حدث خطأ أثناء إضافة التصنيف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Updates an existing category in Google Sheets.
 */
async function updateCategory() {
    if (!(await verifyModificationPassword())) return;
    if (!currentEditCategoryId) {
        showMessage('لا يوجد تصنيف محدد للتعديل.', 'error');
        return;
    }

    const code = document.getElementById('categoryCode')?.value.trim();
    const name = document.getElementById('categoryName')?.value.trim();
    const formType = document.getElementById('formType')?.value;

    if (!code || !name || !formType) {
        showMessage('يرجى ملء جميع حقول التصنيف الأساسية.', 'warning');
        return;
    }

    const existingCategory = categories.find(cat => {
        const normalizedCatId = normalizeCategoryId(cat.id);
        const normalizedEditId = normalizeCategoryId(currentEditCategoryId);
        return normalizedCatId === normalizedEditId;
    });

    if (!existingCategory) {
        showMessage('التصنيف غير موجود في الذاكرة.', 'error');
        return;
    }

    const duplicateCategory = categories.find(cat => {
        const normalizedCatId = normalizeCategoryId(cat.id);
        const normalizedEditId = normalizeCategoryId(currentEditCategoryId);
        return cat.code === code && normalizedCatId !== normalizedEditId;
    });

    if (duplicateCategory) {
        showMessage('كود التصنيف موجود بالفعل لتصنيف آخر. يرجى استخدام كود فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const originalId = existingCategory.id;
        const rowIndex = await findRowIndex(SHEETS.CATEGORIES, 0, originalId);
        
        if (rowIndex === -1) {
            const rowIndexByCode = await findRowIndex(SHEETS.CATEGORIES, 1, existingCategory.code);
            if (rowIndexByCode === -1) {
                showMessage('لم يتم العثور على التصنيف لتحديثه.', 'error');
                return;
            }
            const updatedCategoryData = [
                currentEditCategoryId,
                code,
                name,
                formType,
                existingCategory.creationDate,
                existingCategory.createdBy
            ];
            await updateSheet(SHEETS.CATEGORIES, `A${rowIndexByCode}:F${rowIndexByCode}`, [updatedCategoryData]);
        } else {
            const updatedCategoryData = [
                originalId,
                code,
                name,
                formType,
                existingCategory.creationDate,
                existingCategory.createdBy
            ];
            await updateSheet(SHEETS.CATEGORIES, `A${rowIndex}:F${rowIndex}`, [updatedCategoryData]);
        }

        // Update custom fields: delete old and add new
        const allCustomFieldsData = await readSheet(SHEETS.CATEGORY_CUSTOM_FIELDS);
        const rowsToDelete = allCustomFieldsData.map((row, idx) => ({ row, idx }))
                                                .filter(item => item.row[0] === currentEditCategoryId);
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await deleteSheetRow(SHEETS.CATEGORY_CUSTOM_FIELDS, rowsToDelete[i].idx + 1);
        }

        const customFieldsToSave = [];
        const customFieldItems = document.querySelectorAll('.custom-field-editor-item');
        for (const item of customFieldItems) {
            const fieldNameInput = item.querySelector('input[type="text"]');
            const fieldTypeSelect = item.querySelector('select');
            const isRequiredCheckbox = item.querySelector('input[type="checkbox"]');
            const optionsInput = item.querySelector('.options-group input[type="text"]');

            if (!fieldNameInput || !fieldTypeSelect || !isRequiredCheckbox) {
                console.warn('Missing elements in custom field editor item during update:', item);
                continue;
            }

            const fieldName = fieldNameInput.value.trim();
            const fieldType = fieldTypeSelect.value;
            const isRequired = isRequiredCheckbox.checked;
            const options = fieldType === 'select' && optionsInput ? optionsInput.value.split(',').map(opt => opt.trim()).filter(opt => opt) : [];

            if (fieldName) {
                customFieldsToSave.push([
                    currentEditCategoryId,
                    fieldName,
                    fieldType,
                    isRequired.toString(),
                    JSON.stringify(options)
                ]);
            }
        }

        if (customFieldsToSave.length > 0) {
            for (const cfData of customFieldsToSave) {
                await appendToSheet(SHEETS.CATEGORY_CUSTOM_FIELDS, cfData);
            }
        }

        showMessage('تم تعديل التصنيف بنجاح.', 'success');
        closeModal('addCategoryModal');
        await loadCategories();
        await loadCategoryCustomFields();
        displayCategories('categoriesGridCashier');
        displayCategories('categoriesGridAccountant');
        populateExpenseCategoryFilter();
        populateAccountantFilters();
    } catch (error) {
        console.error('Error updating category:', error);
        showMessage('حدث خطأ أثناء تعديل التصنيف.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes a category from Google Sheets.
 * @param {string} categoryId - The ID of the category to delete.
 * @param {string} categoryName - The name of the category (for confirmation message).
 */
async function deleteCategory(categoryId, categoryName) {
    if (!(await verifyModificationPassword())) return;
    if (!confirm(`هل أنت متأكد من حذف التصنيف "${categoryName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CATEGORIES, 0, categoryId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على التصنيف لحذفه.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.CATEGORIES, rowIndex);

        if (result.success) {
            const allCustomFieldsData = await readSheet(SHEETS.CATEGORY_CUSTOM_FIELDS);
            const rowsToDelete = allCustomFieldsData.map((row, idx) => ({ row, idx }))
                                                    .filter(item => item.row[0] === categoryId);
            for (let i = rowsToDelete.length - 1; i >= 0; i--) {
                await deleteSheetRow(SHEETS.CATEGORY_CUSTOM_FIELDS, rowsToDelete[i].idx + 1);
            }

            showMessage('تم حذف التصنيف بنجاح.', 'success');
            await loadCategories();
            await loadCategoryCustomFields();
            displayCategories('categoriesGridCashier');
            displayCategories('categoriesGridAccountant');
            populateExpenseCategoryFilter();
            populateAccountantFilters();
        } else {
            showMessage('فشل حذف التصنيف.', 'error');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showMessage('حدث خطأ أثناء حذف التصنيف.', 'error');
    } finally {
        showLoading(false);
    }
}