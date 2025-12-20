(function() {
  'use strict';

  // Set current year
  const YEAR_EL = document.getElementById('year');
  if (YEAR_EL) YEAR_EL.textContent = String(new Date().getFullYear());

  // Config
  const DEFAULT_API_BASE = 'https://cdcapi.onrender.com/api/';
  const LOCAL_API_BASE = 'http://localhost:3001/api/';

  function isValidAbsoluteUrl(value) {
    if (!value || typeof value !== 'string') return false;
    const v = value.trim();
    if (!(v.startsWith('http://') || v.startsWith('https://'))) return false;
    try { new URL(v); return true; } catch (_) { return false; }
  }

  function getApiBaseUrl() {
    try {
      const stored = localStorage.getItem('whatsapp_api_base');
      const chosen = isValidAbsoluteUrl(stored) ? stored : DEFAULT_API_BASE;
      return chosen.endsWith('/') ? chosen : chosen + '/';
    } catch (_) {
      return DEFAULT_API_BASE;
    }
  }

  function setButtonLoading(button, isLoading, loadingText = 'Loading...') {
    if (!button) return;
    if (isLoading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent ?? '';
      }
      button.disabled = true;
      button.textContent = loadingText;
      button.classList.add('btn-loading');
      button.setAttribute('aria-busy', 'true');
    } else {
      button.disabled = false;
      if (button.dataset.originalText != null) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
      button.classList.remove('btn-loading');
      button.removeAttribute('aria-busy');
    }
  }

  // DOM Elements
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');
  const headerInfo = document.getElementById('header-info');
  const headerUsername = document.getElementById('header-username');
  const headerDateRange = document.getElementById('header-date-range');
  const pendingJobsTable = document.getElementById('pending-jobs-table');
  const pendingJobsThead = document.getElementById('pending-jobs-thead');
  const pendingJobsTbody = document.getElementById('pending-jobs-tbody');
  const pendingJobsEmpty = document.getElementById('pending-jobs-empty');
  const loadingOverlay = document.getElementById('loading-overlay');
  const selectAllContainer = document.getElementById('select-all-container');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnSendWhatsApp = document.getElementById('btn-send-whatsapp');
  const confirmationModal = document.getElementById('confirmation-modal');
  const btnConfirmYes = document.getElementById('btn-confirm-yes');
  const btnConfirmNo = document.getElementById('btn-confirm-no');
  const confirmationMessage = document.getElementById('confirmation-message');
  const datePickerModal = document.getElementById('date-picker-modal');
  const datePickerInput = document.getElementById('date-picker-input');
  const btnDateOk = document.getElementById('btn-date-ok');
  const btnDateCancel = document.getElementById('btn-date-cancel');
  
  // Store current editing context
  let currentEditingOrderBookingDetailsID = null;
  let currentEditingDateTextElement = null;

  // Store pending data and filters
  let pendingData = [];
  let filteredData = [];
  let columnFilters = {};
  let selectedRows = new Set(); // Store selected row IDs
  let mobileColumnIndex = -1; // Index of Concern Mobile No column
  let finalDeliveryDateColumnIndex = -1; // Index of Final Delivery Date column
  let jobNameColumnIndex = -1; // Index of Job Name column
  let clientNameColumnIndex = -1; // Index of Client Name column

  // Fetch pending data from backend
  async function fetchPendingData(username) {
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}whatsapp/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data');
      }

      const pendingJobs = data.pendingData || [];
      const dateRange = data.dateRange || null;
      
      console.log('Fetched pending data:', {
        username: data.username,
        pendingDataCount: pendingJobs.length,
        dateRange: dateRange
      });
      
      return { pendingJobs, dateRange };
    } catch (error) {
      console.error('Error fetching pending data:', error);
      throw error;
    }
  }

  // Show/hide loading overlay
  function showLoading(show = true) {
    if (loadingOverlay) {
      if (show) {
        loadingOverlay.classList.remove('hidden');
      } else {
        loadingOverlay.classList.add('hidden');
      }
    }
  }

  // Check if user is already logged in
  async function checkAuth() {
    const username = localStorage.getItem('whatsapp_username');
    if (username) {
      // User is logged in, fetch pending data
      showLoading(true);
      try {
        showDashboard(username); // Show dashboard first
        const { pendingJobs, dateRange } = await fetchPendingData(username);
        showDashboard(username, pendingJobs, dateRange);
      } catch (error) {
        console.error('Failed to fetch pending data on reload:', error);
        // Still show dashboard, but without data
        showDashboard(username);
      } finally {
        showLoading(false);
      }
    } else {
      showLogin();
      showLoading(false);
    }
  }

  function showLogin() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    btnLogout.classList.add('hidden');
    if (headerInfo) {
      headerInfo.classList.add('hidden');
    }
    loginError.textContent = '';
  }

  function showDashboard(username, pendingJobsData = null, dateRange = null) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    btnLogout.classList.remove('hidden');
    if (headerInfo) {
      headerInfo.classList.remove('hidden');
    }
    if (headerUsername) {
      headerUsername.textContent = username;
    }
    if (headerDateRange) {
      if (dateRange) {
        // Format dates to DD-MM-YYYY
        const startDateFormatted = formatDate(dateRange.startDate);
        const endDateFormatted = formatDate(dateRange.endDate);
        headerDateRange.textContent = `${startDateFormatted} to ${endDateFormatted}`;
      } else {
        headerDateRange.textContent = 'N/A';
      }
    }
    // Display pending jobs if data is available
    console.log('showDashboard - pendingJobsData:', {
      hasData: !!pendingJobsData,
      isArray: Array.isArray(pendingJobsData),
      length: pendingJobsData?.length,
      sample: pendingJobsData?.[0]
    });
    
    if (pendingJobsData && Array.isArray(pendingJobsData) && pendingJobsData.length > 0) {
      console.log('Displaying pending jobs:', pendingJobsData.length, 'items');
      pendingData = pendingJobsData;
      filteredData = [...pendingData];
      columnFilters = {};
      selectedRows.clear(); // Clear selections when new data is loaded
      renderPendingJobsTable();
      updateSendButton();
    } else {
      console.log('No pending jobs data available or empty array', {
        pendingJobsData,
        isArray: Array.isArray(pendingJobsData),
        length: pendingJobsData?.length
      });
      // Clear table if no data
      if (pendingJobsThead) pendingJobsThead.innerHTML = '';
      if (pendingJobsTbody) pendingJobsTbody.innerHTML = '';
      if (pendingJobsTable) pendingJobsTable.classList.add('hidden');
      if (pendingJobsEmpty) {
        pendingJobsEmpty.classList.remove('hidden');
        pendingJobsEmpty.textContent = pendingJobsData && pendingJobsData.length === 0 
          ? 'No pending jobs found for the selected date range' 
          : 'No pending jobs data available';
      }
      if (btnSendWhatsApp) btnSendWhatsApp.disabled = true;
      updateDeselectAllButton();
    }
  }

  // Login handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    const username = document.getElementById('username').value.trim();
    if (!username) {
      loginError.textContent = 'Please select a username';
      return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, 'Signing in...');
    showLoading(true);

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}whatsapp/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store username in localStorage
      localStorage.setItem('whatsapp_username', username);
      
      // Show dashboard with pending data
      const pendingJobs = data.pendingData || [];
      const dateRange = data.dateRange || null;
      
      console.log('Login response data:', {
        username: data.username,
        pendingDataCount: pendingJobs.length,
        dateRange: dateRange,
        samplePendingData: pendingJobs[0],
        firstRowKeys: pendingJobs[0] ? Object.keys(pendingJobs[0]) : []
      });
      
      // Use the same fetchPendingData function for consistency
      showDashboard(username, pendingJobs, dateRange);
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = error.message || 'Failed to login. Please try again.';
    } finally {
      setButtonLoading(submitButton, false);
      showLoading(false);
    }
  });

  // Store column keys for reuse
  let columnsToShow = [];

  // Render table header (only once, with search inputs)
  // Headers should always be visible, even when no data or filtered results
  function renderTableHeader() {
    if (!pendingJobsThead) return;

    // Only determine columns if we have data, otherwise use stored columnsToShow
    if (pendingData && pendingData.length > 0) {
      // Get all column keys from the first row, excluding last 4 columns
      const allKeys = Object.keys(pendingData[0]);
      columnsToShow = allKeys.slice(0, -4); // Exclude last 4 columns
      
      // Find the index of Concern Mobile No column
      mobileColumnIndex = columnsToShow.findIndex(key => {
        const colName = formatColumnName(key).toLowerCase();
        return colName.includes('mobile') || colName.includes('concern mobile');
      });
      
      // Find the index of Final Delivery Date column
      // Try multiple matching strategies
      finalDeliveryDateColumnIndex = columnsToShow.findIndex(key => {
        const colName = formatColumnName(key).toLowerCase();
        const keyLower = key.toLowerCase();
        const combined = (colName + ' ' + keyLower).toLowerCase();
        
        // Strategy 1: Exact pattern matches
        const exactPatterns = [
          'final delivery date',
          'finaldeliverydate',
          'final delivery',
          'finaldelivery',
          'final_delivery_date',
          'expected delivery date',
          'expecteddeliverydate'
        ];
        
        const exactMatch = exactPatterns.some(pattern => 
          colName.includes(pattern) || 
          keyLower.includes(pattern) ||
          colName === pattern ||
          keyLower === pattern
        );
        
        if (exactMatch) {
          console.log('Found Final Delivery Date column (exact match):', { key, colName, keyLower });
          return true;
        }
        
        // Strategy 2: Contains "final", "delivery", and "date" (in any order)
        const hasFinal = combined.includes('final');
        const hasDelivery = combined.includes('delivery');
        const hasDate = combined.includes('date');
        
        if (hasFinal && hasDelivery && hasDate) {
          console.log('Found Final Delivery Date column (keyword match):', { key, colName, keyLower });
          return true;
        }
        
        return false;
      });
      
      // Fallback: if not found, try to find by position (usually one of the last date columns)
      if (finalDeliveryDateColumnIndex === -1) {
        console.warn('Final Delivery Date column not found by name, trying fallback...');
        // Look for date columns and pick the last one (usually Final Delivery Date)
        const dateColumnIndices = [];
        columnsToShow.forEach((key, idx) => {
          const colName = formatColumnName(key).toLowerCase();
          if (isDateColumn(colName)) {
            dateColumnIndices.push({ index: idx, key, colName });
          }
        });
        console.log('Date columns found:', dateColumnIndices);
        if (dateColumnIndices.length > 0) {
          // Usually Final Delivery Date is the last date column
          finalDeliveryDateColumnIndex = dateColumnIndices[dateColumnIndices.length - 1].index;
          console.log('Using fallback: Last date column as Final Delivery Date', {
            index: finalDeliveryDateColumnIndex,
            column: columnsToShow[finalDeliveryDateColumnIndex],
            allDateColumns: dateColumnIndices
          });
        }
      }
      
      // Find the index of Job Name column
      jobNameColumnIndex = columnsToShow.findIndex(key => {
        const colName = formatColumnName(key).toLowerCase();
        const keyLower = key.toLowerCase();
        return colName.includes('job name') || 
               keyLower.includes('jobname') ||
               keyLower.includes('job_name') ||
               (colName.includes('job') && colName.includes('name'));
      });
      
      // Find the index of Client Name column
      clientNameColumnIndex = columnsToShow.findIndex(key => {
        const colName = formatColumnName(key).toLowerCase();
        const keyLower = key.toLowerCase();
        return colName.includes('client name') || 
               keyLower.includes('clientname') ||
               keyLower.includes('client_name') ||
               (colName.includes('client') && colName.includes('name'));
      });
      
      console.log('Column detection:', {
        mobileColumnIndex,
        finalDeliveryDateColumnIndex,
        jobNameColumnIndex,
        clientNameColumnIndex,
        allColumns: columnsToShow.map((k, idx) => ({
          index: idx,
          key: k,
          formatted: formatColumnName(k),
          isDate: isDateColumn(formatColumnName(k)),
          isFinalDelivery: idx === finalDeliveryDateColumnIndex
        }))
      });
    }

    // If no columns determined yet, don't render (shouldn't happen, but safety check)
    if (!columnsToShow || columnsToShow.length === 0) {
      console.warn('No columns to display');
      return;
    }

    // Clear existing header
    pendingJobsThead.innerHTML = '';

    // Create header row with search boxes
    const headerRow = document.createElement('tr');
    
    columnsToShow.forEach((key, index) => {
      const th = document.createElement('th');
      const headerDiv = document.createElement('div');
      headerDiv.className = 'column-header';
      
      const label = document.createElement('div');
      label.className = 'column-header-label';
      label.textContent = formatColumnName(key);
      
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'column-search';
      searchInput.placeholder = `Filter ${formatColumnName(key)}...`;
      searchInput.value = columnFilters[key] || '';
      searchInput.dataset.columnKey = key; // Store the key for reference
      
      // Use input event with debouncing for better performance
      let timeoutId;
      searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        columnFilters[key] = value.trim().toLowerCase();
        
        // Clear previous timeout
        clearTimeout(timeoutId);
        
        // Debounce the filter application (small delay for smooth typing)
        timeoutId = setTimeout(() => {
          applyFilters();
        }, 150);
      });
      
      headerDiv.appendChild(label);
      headerDiv.appendChild(searchInput);
      th.appendChild(headerDiv);
      
      // Set column width for Job Name and Client Name columns to be the same
      if (index === jobNameColumnIndex || index === clientNameColumnIndex) {
        // Use a fixed width that matches client name column width
        th.style.width = '150px';
        th.style.maxWidth = '150px';
        th.style.minWidth = '150px';
      }
      
      headerRow.appendChild(th);
      
      // Insert Select checkbox column header AFTER Concern Mobile No column
      if (index === mobileColumnIndex) {
        const selectTh = document.createElement('th');
        selectTh.className = 'select-column-header';
        selectTh.style.width = '90px';
        selectTh.style.textAlign = 'center';
        
        const selectHeaderDiv = document.createElement('div');
        selectHeaderDiv.className = 'select-column-header-content';
        
        const selectLabel = document.createElement('div');
        selectLabel.className = 'column-header-label';
        selectLabel.textContent = 'Select';
        selectLabel.style.marginBottom = '0.3rem';
        
        const deselectAllBtn = document.createElement('button');
        deselectAllBtn.id = 'btn-deselect-all';
        deselectAllBtn.className = 'deselect-all-btn hidden';
        deselectAllBtn.textContent = 'Deselect All';
        deselectAllBtn.type = 'button';
        deselectAllBtn.addEventListener('click', () => {
          // Deselect all rows
          selectedRows.clear();
          
          // Update all checkboxes
          const checkboxes = pendingJobsTbody.querySelectorAll('input[type="checkbox"]');
          const rows = pendingJobsTbody.querySelectorAll('tr');
          
          checkboxes.forEach((checkbox, idx) => {
            checkbox.checked = false;
            const row = rows[idx];
            if (row) {
              row.classList.remove('row-selected');
            }
          });
          
          updateSelectAllButton();
          updateSendButton();
          updateDeselectAllButton();
        });
        
        selectHeaderDiv.appendChild(selectLabel);
        selectHeaderDiv.appendChild(deselectAllBtn);
        selectTh.appendChild(selectHeaderDiv);
        headerRow.appendChild(selectTh);
      }
    });
    pendingJobsThead.appendChild(headerRow);
  }

  // Render table body only (called when filtering)
  // Headers should always remain visible
  function renderTableBody() {
    if (!pendingJobsTbody) {
      console.error('Table body element not found');
      return;
    }

    // Clear existing body
    pendingJobsTbody.innerHTML = '';

    // ALWAYS keep table visible (headers must remain) even when no results
    pendingJobsTable.classList.remove('hidden');
    if (pendingJobsEmpty) pendingJobsEmpty.classList.add('hidden');

    // Ensure headers are rendered if they don't exist
    if (!pendingJobsThead || pendingJobsThead.children.length === 0) {
      renderTableHeader();
    }

    if (filteredData.length === 0) {
      // Show empty message row in the table body, but keep headers visible
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      // Account for select column if it exists (after Concern Mobile No)
      const totalCols = columnsToShow.length + (mobileColumnIndex >= 0 ? 1 : 0);
      emptyCell.colSpan = totalCols || 1;
      emptyCell.className = 'empty-table-message';
      emptyCell.textContent = 'No matching records found. Try adjusting your filters.';
      emptyCell.style.textAlign = 'center';
      emptyCell.style.padding = '2rem';
      emptyCell.style.color = 'var(--muted)';
      emptyRow.appendChild(emptyCell);
      pendingJobsTbody.appendChild(emptyRow);
      return;
    }

    // Create data rows
    filteredData.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      tr.dataset.rowIndex = rowIndex;
      
      // Generate unique row ID (use OrderBookingDetailsID or index)
      const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${rowIndex}`;
      tr.dataset.rowId = rowId;
      
      // Add selected class if row is selected
      if (selectedRows.has(rowId)) {
        tr.classList.add('row-selected');
      }
      
      columnsToShow.forEach((key, colIndex) => {
        const td = document.createElement('td');
        const value = row[key];
        const columnName = formatColumnName(key);
        
        // Check if this is Final Delivery Date column - add editable input
        if (colIndex === finalDeliveryDateColumnIndex && finalDeliveryDateColumnIndex >= 0) {
          console.log('Adding editable input to Final Delivery Date cell', {
            colIndex,
            finalDeliveryDateColumnIndex,
            columnName,
            value
          });
          
          const dateInput = document.createElement('input');
          dateInput.type = 'text';
          dateInput.className = 'editable-date-input';
          dateInput.placeholder = 'DD-MM-YYYY';
          
          // Set initial value in DD-MM-YYYY format
          if (value !== null && value !== undefined) {
            dateInput.value = formatDate(value);
          } else {
            dateInput.value = '';
          }
          
          // Store the orderBookingDetailsID for later use
          const orderBookingDetailsID = row.OrderBookingDetailsID || row.orderBookingDetailsID;
          
          // Handle Enter key press
          dateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              dateInput.blur(); // Trigger blur event which will handle the update
            }
          });
          
          // Handle blur (when user clicks outside)
          dateInput.addEventListener('blur', () => {
            const inputValue = dateInput.value.trim();
            
            if (!orderBookingDetailsID) {
              alert('OrderBookingDetailsID not found');
              return;
            }
            
            // If input is empty, don't update
            if (!inputValue) {
              // Restore original value if empty
              if (value !== null && value !== undefined) {
                dateInput.value = formatDate(value);
              }
              return;
            }
            
            // Convert DD-MM-YYYY to YYYY-MM-DD
            const convertedDate = convertDDMMYYYYToYYYYMMDD(inputValue);
            
            if (!convertedDate) {
              alert('Invalid date format. Please use DD-MM-YYYY format (e.g., 25-12-2024)');
              // Restore original value
              if (value !== null && value !== undefined) {
                dateInput.value = formatDate(value);
              } else {
                dateInput.value = '';
              }
              return;
            }
            
            // Update the date
            updateExpectedDeliveryDate(orderBookingDetailsID, convertedDate);
          });
          
          td.appendChild(dateInput);
        } else {
          // Regular cell content
          // Format date columns to DD-MM-YYYY
          if (value !== null && value !== undefined) {
            if (isDateColumn(columnName)) {
              td.textContent = formatDate(value);
            } else {
              td.textContent = String(value);
            }
          } else {
            td.textContent = '';
          }
        }
        
        // Set column width for Job Name and Client Name columns to be the same
        if (colIndex === jobNameColumnIndex || colIndex === clientNameColumnIndex) {
          td.style.width = '150px';
          td.style.maxWidth = '150px';
          td.style.minWidth = '150px';
        }
        
        // Add text truncation and tooltip for Job Name and Client Name columns
        if (colIndex === jobNameColumnIndex || colIndex === clientNameColumnIndex) {
          td.style.overflow = 'hidden';
          td.style.textOverflow = 'ellipsis';
          // Add title attribute for hover tooltip
          if (value !== null && value !== undefined && value !== '') {
            td.title = String(value);
          }
        }
        
        tr.appendChild(td);
        
        // Insert Select checkbox column AFTER Concern Mobile No column
        if (colIndex === mobileColumnIndex) {
          const selectTd = document.createElement('td');
          selectTd.className = 'select-column-cell';
          selectTd.style.textAlign = 'center';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.rowId = rowId;
          checkbox.checked = selectedRows.has(rowId);
          checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              selectedRows.add(rowId);
              tr.classList.add('row-selected');
            } else {
              selectedRows.delete(rowId);
              tr.classList.remove('row-selected');
            }
            updateSelectAllButton();
            updateSendButton();
            updateDeselectAllButton();
          });
          
          selectTd.appendChild(checkbox);
          tr.appendChild(selectTd);
        }
      });
      pendingJobsTbody.appendChild(tr);
    });
    
    updateSelectAllButton();
    updateSendButton();
  }
  
  // Update Send button state based on selected rows
  function updateSendButton() {
    if (!btnSendWhatsApp) return;
    
    const hasSelections = selectedRows.size > 0;
    btnSendWhatsApp.disabled = !hasSelections;
    
    console.log('Update Send Button:', {
      selectedRowsCount: selectedRows.size,
      hasSelections,
      disabled: !hasSelections
    });
  }
  
  // Update Deselect All button visibility
  function updateDeselectAllButton() {
    const btnDeselectAll = document.getElementById('btn-deselect-all');
    if (!btnDeselectAll) return;
    
    // Show button when more than one row is selected
    if (selectedRows.size > 1) {
      btnDeselectAll.classList.remove('hidden');
    } else {
      btnDeselectAll.classList.add('hidden');
    }
  }
  
  // Update Select All button visibility and state
  function updateSelectAllButton() {
    if (!selectAllContainer || !btnSelectAll) return;
    
    // Show button if there are active filters or if filteredData has items
    const hasFilters = Object.values(columnFilters).some(v => v && v.trim() !== '');
    const hasFilteredData = filteredData.length > 0;
    
    if (hasFilters && hasFilteredData) {
      selectAllContainer.classList.remove('hidden');
      
      // Update button text based on selection state
      const allSelected = filteredData.every((row, idx) => {
        const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${idx}`;
        return selectedRows.has(rowId);
      });
      
      btnSelectAll.textContent = allSelected ? 'Deselect All' : 'Select All';
    } else {
      selectAllContainer.classList.add('hidden');
    }
    
    // Also update send button and deselect all button
    updateSendButton();
    updateDeselectAllButton();
  }
  
  // Select All button handler
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      const allSelected = filteredData.every((row, idx) => {
        const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${idx}`;
        return selectedRows.has(rowId);
      });
      
      // Toggle all filtered rows
      filteredData.forEach((row, idx) => {
        const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${idx}`;
        if (allSelected) {
          selectedRows.delete(rowId);
        } else {
          selectedRows.add(rowId);
        }
      });
      
      // Update checkboxes and row styles in DOM
      const checkboxes = pendingJobsTbody.querySelectorAll('input[type="checkbox"]');
      const rows = pendingJobsTbody.querySelectorAll('tr');
      
      checkboxes.forEach((checkbox, idx) => {
        checkbox.checked = !allSelected;
        const row = rows[idx];
        if (row) {
          if (!allSelected) {
            row.classList.add('row-selected');
          } else {
            row.classList.remove('row-selected');
          }
        }
      });
      
      updateSelectAllButton();
      updateSendButton();
      updateDeselectAllButton();
    });
  }
  
  // Deselect All button handler (in Select column header)
  // This is set up in renderTableHeader, but we also need to ensure it's updated

  // Render pending jobs table (initial render)
  function renderPendingJobsTable() {
    if (!pendingJobsTable || !pendingJobsThead || !pendingJobsTbody) {
      console.error('Table elements not found');
      return;
    }

    console.log('Rendering table with', filteredData.length, 'rows');

    // Always show table structure, even if no data
    // Headers should always be visible
    pendingJobsTable.classList.remove('hidden');
    if (pendingJobsEmpty) pendingJobsEmpty.classList.add('hidden');

    if (!pendingData || pendingData.length === 0) {
      // No data at all - show empty message but keep table structure
      if (pendingJobsEmpty) {
        pendingJobsEmpty.classList.remove('hidden');
        pendingJobsEmpty.textContent = 'No pending jobs found for the selected date range';
      }
      return;
    }

    // Render header once (will be kept visible even when filtering)
    renderTableHeader();
    
    // Render body
    renderTableBody();
    
    // Update send button and deselect all button after rendering
    updateSendButton();
    updateDeselectAllButton();
  }

  // Format column name for display
  function formatColumnName(key) {
    // Convert camelCase or snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  // Format date to DD-MM-YYYY format
  function formatDate(value) {
    if (!value) return '';
    
    // If it's already a string in a date format, try to parse it
    let date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      // Try to parse various date formats
      date = new Date(value);
      if (isNaN(date.getTime())) {
        // If parsing fails, return original value
        return value;
      }
    } else {
      return String(value);
    }

    // Format as DD-MM-YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  }

  // Convert DD-MM-YYYY format to YYYY-MM-DD format
  function convertDDMMYYYYToYYYYMMDD(dateString) {
    if (!dateString) return null;
    
    // Remove any whitespace
    dateString = dateString.trim();
    
    // Check if it's in DD-MM-YYYY format
    const ddMMyyyyPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
    const match = dateString.match(ddMMyyyyPattern);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      
      // Validate date
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const date = new Date(year, month - 1, day);
        // Check if date is valid (handles invalid dates like 31-02-2024)
        if (date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    
    // If not in DD-MM-YYYY format, try to parse as-is
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return null;
  }

  // Check if a column is a date column
  function isDateColumn(columnName) {
    const dateKeywords = ['date', 'schedule', 'delivery', 'order date'];
    const lowerName = columnName.toLowerCase();
    return dateKeywords.some(keyword => lowerName.includes(keyword));
  }

  // Apply filters to data (only re-renders body, not header)
  function applyFilters() {
    filteredData = pendingData.filter(row => {
      return Object.keys(columnFilters).every(key => {
        const filterValue = columnFilters[key];
        if (!filterValue) return true; // No filter for this column
        
        const cellValue = row[key];
        const cellString = cellValue !== null && cellValue !== undefined 
          ? String(cellValue).toLowerCase() 
          : '';
        
        return cellString.includes(filterValue);
      });
    });

    // Only re-render the body, not the entire table (preserves focus on search inputs)
    renderTableBody();
    updateSendButton();
    updateDeselectAllButton();
  }
  
  // Get selected OrderBookingDetailsIDs
  function getSelectedOrderBookingDetailsIDs() {
    const selectedIds = [];
    filteredData.forEach((row, idx) => {
      const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${idx}`;
      if (selectedRows.has(rowId)) {
        // Get the actual OrderBookingDetailsID value
        const orderBookingDetailsID = row.OrderBookingDetailsID || row.orderBookingDetailsID;
        if (orderBookingDetailsID) {
          selectedIds.push(Number(orderBookingDetailsID));
        }
      }
    });
    console.log('Selected OrderBookingDetailsIDs:', selectedIds);
    return selectedIds;
  }
  
  // Show confirmation modal
  function showConfirmationModal() {
    const selectedIds = getSelectedOrderBookingDetailsIDs();
    const count = selectedIds.length;
    
    console.log('Show confirmation modal:', { count, selectedIds });
    
    if (count === 0) {
      alert('Please select at least one row to send messages.');
      return;
    }
    
    if (confirmationMessage) {
      confirmationMessage.textContent = `Are you sure you want to send WhatsApp messages to ${count} selected item${count > 1 ? 's' : ''}?`;
    }
    
    if (confirmationModal) {
      confirmationModal.classList.remove('hidden');
      console.log('Modal shown');
    } else {
      console.error('Confirmation modal element not found');
    }
  }
  
  // Hide confirmation modal
  function hideConfirmationModal() {
    if (confirmationModal) {
      confirmationModal.classList.add('hidden');
    }
  }
  
  // Send WhatsApp messages
  async function sendWhatsAppMessages() {
    const username = localStorage.getItem('whatsapp_username');
    if (!username) {
      alert('User not logged in');
      return;
    }
    
    const selectedIds = getSelectedOrderBookingDetailsIDs();
    if (selectedIds.length === 0) {
      alert('No items selected');
      return;
    }
    
    hideConfirmationModal();
    
    // Show loading with custom message
    if (loadingOverlay) {
      const loadingText = loadingOverlay.querySelector('.loading-spinner p');
      if (loadingText) {
        loadingText.textContent = 'Sending messages...';
      }
      loadingOverlay.classList.remove('hidden');
    }
    
    try {
      const apiBase = getApiBaseUrl();
      const requestBody = {
        username: username,
        orderBookingDetailsIds: selectedIds
      };
      
      console.log('Sending WhatsApp messages:', {
        url: `${apiBase}comm/first-intimation/send`,
        body: requestBody
      });
      
      const response = await fetch(`${apiBase}comm/first-intimation/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      console.log('Send response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to send messages');
      }
      
      // Success - reload the page to fetch latest pending list
      window.location.reload();
    } catch (error) {
      console.error('Error sending WhatsApp messages:', error);
      alert('Error sending messages: ' + error.message);
    } finally {
      // Hide loading (though page will reload on success)
      if (loadingOverlay) {
        const loadingText = loadingOverlay.querySelector('.loading-spinner p');
        if (loadingText) {
          loadingText.textContent = 'Loading...';
        }
        loadingOverlay.classList.add('hidden');
      }
    }
  }
  
  // Send button click handler
  if (btnSendWhatsApp) {
    console.log('Setting up send button event handler');
    btnSendWhatsApp.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Send button clicked');
      showConfirmationModal();
    });
  } else {
    console.error('Send button element not found');
  }
  
  // Confirmation modal handlers
  if (btnConfirmYes) {
    btnConfirmYes.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Confirm Yes clicked');
      sendWhatsAppMessages();
    });
  } else {
    console.error('Confirm Yes button element not found');
  }
  
  if (btnConfirmNo) {
    btnConfirmNo.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Confirm No clicked');
      hideConfirmationModal();
    });
  } else {
    console.error('Confirm No button element not found');
  }
  
  // Close modal on overlay click
  if (confirmationModal) {
    confirmationModal.addEventListener('click', (e) => {
      if (e.target === confirmationModal) {
        hideConfirmationModal();
      }
    });
  }
  
  // Show date picker modal
  function showDatePickerModal(orderBookingDetailsID, currentDate, dateTextElement) {
    currentEditingOrderBookingDetailsID = orderBookingDetailsID;
    currentEditingDateTextElement = dateTextElement;
    
    // Set current date in input if available
    if (datePickerInput && currentDate) {
      // Convert DD-MM-YYYY or other formats to YYYY-MM-DD for date input
      let dateValue = currentDate;
      if (typeof currentDate === 'string') {
        // Try to parse and format
        const parsedDate = new Date(currentDate);
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const day = String(parsedDate.getDate()).padStart(2, '0');
          dateValue = `${year}-${month}-${day}`;
        }
      } else if (currentDate instanceof Date) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        dateValue = `${year}-${month}-${day}`;
      }
      datePickerInput.value = dateValue;
    } else if (datePickerInput) {
      datePickerInput.value = '';
    }
    
    if (datePickerModal) {
      datePickerModal.classList.remove('hidden');
    }
  }
  
  // Hide date picker modal
  function hideDatePickerModal() {
    if (datePickerModal) {
      datePickerModal.classList.add('hidden');
    }
    currentEditingOrderBookingDetailsID = null;
    currentEditingDateTextElement = null;
  }
  
  // Update expected delivery date
  async function updateExpectedDeliveryDate(orderBookingDetailsID, newDate) {
    if (!orderBookingDetailsID || !newDate) {
      alert('Invalid date or order booking details ID');
      return;
    }
    
    // Format date as YYYY-MM-DD
    let formattedDate = newDate;
    if (newDate instanceof Date) {
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    } else if (typeof newDate === 'string') {
      // Ensure it's in YYYY-MM-DD format
      const parsedDate = new Date(newDate);
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }
    }
    
    // Show loading state
    if (loadingOverlay) {
      const loadingText = loadingOverlay.querySelector('.loading-spinner p');
      if (loadingText) {
        loadingText.textContent = 'Updating delivery date...';
      }
      loadingOverlay.classList.remove('hidden');
    }
    
    try {
      const apiBase = getApiBaseUrl();
      const username = localStorage.getItem('whatsapp_username');
      
      if (!username) {
        throw new Error('User not logged in');
      }
      
      console.log('Updating delivery date:', {
        orderBookingDetailsID,
        newDate: formattedDate
      });
      
      // Call the update procedure via API
      const response = await fetch(`${apiBase}whatsapp/update-delivery-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          orderBookingDetailsID: Number(orderBookingDetailsID),
          newExpectedDeliveryDate: formattedDate
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update delivery date');
      }
      
      console.log('Delivery date updated successfully');
      
      // Reload pending list
      if (username) {
        const { pendingJobs, dateRange } = await fetchPendingData(username);
        showDashboard(username, pendingJobs, dateRange);
      }
    } catch (error) {
      console.error('Error updating delivery date:', error);
      alert('Error updating delivery date: ' + error.message);
    } finally {
      // Hide loading
      if (loadingOverlay) {
        const loadingText = loadingOverlay.querySelector('.loading-spinner p');
        if (loadingText) {
          loadingText.textContent = 'Loading...';
        }
        loadingOverlay.classList.add('hidden');
      }
    }
  }
  
  // Date picker OK button handler
  if (btnDateOk) {
    btnDateOk.addEventListener('click', () => {
      if (!datePickerInput || !datePickerInput.value) {
        alert('Please select a date');
        return;
      }
      
      if (!currentEditingOrderBookingDetailsID) {
        alert('Invalid order booking details ID');
        return;
      }
      
      const selectedDate = datePickerInput.value;
      updateExpectedDeliveryDate(currentEditingOrderBookingDetailsID, selectedDate);
    });
  }
  
  // Date picker Cancel button handler
  if (btnDateCancel) {
    btnDateCancel.addEventListener('click', () => {
      hideDatePickerModal();
    });
  }
  
  // Close date picker modal on overlay click
  if (datePickerModal) {
    datePickerModal.addEventListener('click', (e) => {
      if (e.target === datePickerModal) {
        hideDatePickerModal();
      }
    });
  }

  // Logout handler
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('whatsapp_username');
    pendingData = [];
    filteredData = [];
    columnFilters = {};
    selectedRows.clear();
    if (selectAllContainer) selectAllContainer.classList.add('hidden');
    if (btnSendWhatsApp) btnSendWhatsApp.disabled = true;
    showLogin();
    loginForm.reset();
  });

  // Initialize - show loading initially
  showLoading(true);
  checkAuth();
})();
