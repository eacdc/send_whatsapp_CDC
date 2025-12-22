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
  const btn1stIntimation = document.getElementById('btn-1st-intimation');
  const btn2ndIntimation = document.getElementById('btn-2nd-intimation');
  const confirmationModal = document.getElementById('confirmation-modal');
  const successMessageContainer = document.getElementById('success-message-container');
  const successMessageContent = document.getElementById('success-message-content');
  const btnCloseSuccess = document.getElementById('btn-close-success');
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

  // Store intimation type (1st or 2nd)
  let currentIntimationType = '1st'; // '1st' or '2nd'

  // Store pending data and filters
  let pendingData = [];
  let filteredData = [];
  let columnFilters = {};
  let selectedRows = new Set(); // Store selected row IDs
  let mobileColumnIndex = -1; // Index of Concern Mobile No column
  let finalDeliveryDateColumnIndex = -1; // Index of Final Delivery Date column
  let jobNameColumnIndex = -1; // Index of Job Name column
  let clientNameColumnIndex = -1; // Index of Client Name column
  let readinessDateColumnIndex = -1; // Index of Readiness Date column (for 2nd intimation)
  let noOfCartonColumnIndex = -1; // Index of Number of Cartons column (for 2nd intimation)
  let qtyPerCartonColumnIndex = -1; // Index of Qty Per Carton column (for 2nd intimation)

  // Fetch pending data from backend (1st intimation)
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
      
      console.log('Fetched pending data (1st intimation):', {
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

  // Fetch pending data for 2nd intimation
  async function fetchPendingData2ndIntimation(username) {
    try {
      const apiBase = getApiBaseUrl();
      
      // Calculate date range (last 2 weeks)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 14);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await fetch(`${apiBase}whatsapp/second-intimation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username,
          startDate: startDateStr,
          endDate: endDateStr
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch 2nd intimation data');
      }

      const pendingJobs = data.pendingData || [];
      const dateRange = {
        startDate: startDateStr,
        endDate: endDateStr
      };
      
      console.log('Fetched pending data (2nd intimation):', {
        username: data.username,
        pendingDataCount: pendingJobs.length,
        dateRange: dateRange
      });
      
      return { pendingJobs, dateRange };
    } catch (error) {
      console.error('Error fetching 2nd intimation data:', error);
      throw error;
    }
  }

  // Fetch pending data based on current intimation type
  async function fetchPendingDataByType(username, intimationType) {
    if (intimationType === '2nd') {
      return await fetchPendingData2ndIntimation(username);
    } else {
      return await fetchPendingData(username);
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
        const { pendingJobs, dateRange } = await fetchPendingDataByType(username, currentIntimationType);
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
      editedValues.clear(); // Clear edited values when new data is loaded
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
      updateSelectAllButton();
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
  
  // Track edited values for each row (for 2nd intimation)
  // Format: { rowId: { readyForDispatchDate: value, noOfCarton: value, qtyPerCarton: value } }
  let editedValues = new Map();

  // Render table header (only once, with search inputs)
  // Headers should always be visible, even when no data or filtered results
  function renderTableHeader() {
    if (!pendingJobsThead) return;

    // Only determine columns if we have data, otherwise use stored columnsToShow
    if (pendingData && pendingData.length > 0) {
      // Get all column keys from the first row
      const allKeys = Object.keys(pendingData[0]);

      // Show all columns except the last 5 columns returned by the procedure
      // (these are internal / technical columns you don't want in the UI)
      // If there are fewer than 5 columns, show everything.
      const numToHide = 5;
      columnsToShow = allKeys.length > numToHide ? allKeys.slice(0, -numToHide) : allKeys.slice();
      
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
        
        // Explicitly exclude ID columns (like "Dispatch Schedule ID")
        if (combined.includes('id') && (combined.includes('schedule') || combined.includes('dispatch'))) {
          return false;
        }
        
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
        // But exclude ID columns
        const dateColumnIndices = [];
        columnsToShow.forEach((key, idx) => {
          const colName = formatColumnName(key).toLowerCase();
          const keyLower = key.toLowerCase();
          const combined = (colName + ' ' + keyLower).toLowerCase();
          
          // Skip ID columns
          if (combined.includes('id') && (combined.includes('schedule') || combined.includes('dispatch'))) {
            return;
          }
          
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
    });
      
    // Add Select checkbox column header as the LAST column
        const selectTh = document.createElement('th');
        selectTh.className = 'select-column-header';
    selectTh.style.width = '90px';
        selectTh.style.textAlign = 'center';
        
        const selectHeaderDiv = document.createElement('div');
        selectHeaderDiv.className = 'select-column-header-content';
        
        const selectLabel = document.createElement('div');
        selectLabel.className = 'column-header-label';
        selectLabel.textContent = 'Select';
        
        selectHeaderDiv.appendChild(selectLabel);
        selectTh.appendChild(selectHeaderDiv);
        headerRow.appendChild(selectTh);
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
      // Account for select column (always added as last column)
      const totalCols = columnsToShow.length + 1;
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
            
            // Store reference to the input for updating after API call
            const inputElement = dateInput;
            const originalValue = value;
            
            // Update the date (pass input element and original value for local update)
            updateExpectedDeliveryDate(orderBookingDetailsID, convertedDate, inputElement, originalValue);
          });
          
          td.appendChild(dateInput);
        } else if ((currentIntimationType === '2nd' && (colIndex === readinessDateColumnIndex || colIndex === noOfCartonColumnIndex || colIndex === qtyPerCartonColumnIndex)) || (currentIntimationType === '1st' && (colIndex === 14 || colIndex === 15))) {
          // For 2nd intimation: Readiness Date, Number of Cartons, Qty Per Carton (last 3 columns)
          // For 1st intimation: 15th and 16th columns (0-indexed: 14 and 15) - editable whole numbers only
          
          const isDateColumn = currentIntimationType === '2nd' && colIndex === readinessDateColumnIndex;
          
          let inputElement;
          
          if (isDateColumn) {
            // Readiness Date - editable date input
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
            
            // Store original value and column key
            const originalValue = value;
            const columnKey = key;
            
            // Handle Enter key press
            dateInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                dateInput.blur();
              }
            });
            
            // Handle blur
            dateInput.addEventListener('blur', () => {
              const inputValue = dateInput.value.trim();
              
              if (!inputValue) {
                // Empty - restore original or clear
                if (originalValue !== null && originalValue !== undefined) {
                  dateInput.value = formatDate(originalValue);
                } else {
                  dateInput.value = '';
                }
                // Mark as not edited (remove from editedValues)
                const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID;
                if (rowId && editedValues.has(rowId)) {
                  editedValues.get(rowId).readyForDispatchDate = undefined;
                }
                updateLocalColumnValue(row, columnKey, null);
                return;
              }
              
              // Convert DD-MM-YYYY to YYYY-MM-DD
              const convertedDate = convertDDMMYYYYToYYYYMMDD(inputValue);
              
              if (!convertedDate) {
                alert('Invalid date format. Please use DD-MM-YYYY format (e.g., 25-12-2024)');
                if (originalValue !== null && originalValue !== undefined) {
                  dateInput.value = formatDate(originalValue);
                } else {
                  dateInput.value = '';
                }
                return;
              }
              
              // Track that this value was edited
              const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID;
              if (rowId) {
                if (!editedValues.has(rowId)) {
                  editedValues.set(rowId, {});
                }
                editedValues.get(rowId).readyForDispatchDate = convertedDate;
              }
              
              // Update local data
              updateLocalColumnValue(row, columnKey, convertedDate);
            });
            
            inputElement = dateInput;
          } else {
            // Number input (Number of Cartons or Qty Per Carton)
            const numberInput = document.createElement('input');
            numberInput.type = 'text';
            numberInput.className = 'editable-number-input';
            numberInput.inputMode = 'numeric';
            numberInput.pattern = '[0-9]*';
            
            // Set initial value
            if (value !== null && value !== undefined) {
              const numValue = parseInt(value, 10);
              numberInput.value = isNaN(numValue) ? '' : numValue.toString();
            } else {
              numberInput.value = '';
            }
            
            // Store original value and column key
            const originalValue = value;
            const columnKey = key;
            const isNoOfCarton = currentIntimationType === '2nd' && colIndex === noOfCartonColumnIndex;
            const isQtyPerCarton = currentIntimationType === '2nd' && colIndex === qtyPerCartonColumnIndex;
            
            // Handle input to allow only whole numbers
            numberInput.addEventListener('input', (e) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, '');
            });
            
            // Handle Enter key press
            numberInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                numberInput.blur();
              }
            });
            
            // Handle blur
            numberInput.addEventListener('blur', () => {
              const inputValue = numberInput.value.trim();
              
              if (!inputValue) {
                // Empty - restore original or clear
                if (originalValue !== null && originalValue !== undefined) {
                  const numValue = parseInt(originalValue, 10);
                  numberInput.value = isNaN(numValue) ? '' : numValue.toString();
                } else {
                  numberInput.value = '';
                }
                // Mark as not edited
                const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID;
                if (rowId && editedValues.has(rowId)) {
                  if (isNoOfCarton) {
                    editedValues.get(rowId).noOfCarton = undefined;
                  } else if (isQtyPerCarton) {
                    editedValues.get(rowId).qtyPerCarton = undefined;
                  }
                }
                updateLocalColumnValue(row, columnKey, null);
                return;
              }
              
              // Validate whole number
              const numValue = parseInt(inputValue, 10);
              if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue)) {
                alert('Please enter a valid whole number (0 or positive integer)');
                if (originalValue !== null && originalValue !== undefined) {
                  const numValue = parseInt(originalValue, 10);
                  numberInput.value = isNaN(numValue) ? '' : numValue.toString();
                } else {
                  numberInput.value = '';
                }
                return;
              }
              
              // Track that this value was edited
              const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID;
              if (rowId) {
                if (!editedValues.has(rowId)) {
                  editedValues.set(rowId, {});
                }
                if (isNoOfCarton) {
                  editedValues.get(rowId).noOfCarton = numValue;
                } else if (isQtyPerCarton) {
                  editedValues.get(rowId).qtyPerCarton = numValue;
                }
              }
              
              // Update local data
              updateLocalColumnValue(row, columnKey, numValue);
            });
            
            inputElement = numberInput;
          }
          
          td.appendChild(inputElement);
        } else {
          // Regular cell content
          // Format date columns to DD-MM-YYYY, but exclude ID columns
          if (value !== null && value !== undefined) {
            const lowerColumnName = columnName.toLowerCase();
            const lowerKey = key.toLowerCase();
            const combined = (lowerColumnName + ' ' + lowerKey).toLowerCase();
            
            // Explicitly check if this is an ID column - don't format as date
            const isIDColumn = combined.includes('id') && (combined.includes('schedule') || combined.includes('dispatch'));
            
            if (!isIDColumn && isDateColumn(columnName)) {
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
      });
        
      // Add Select checkbox column as the LAST column
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
          });
          
          selectTd.appendChild(checkbox);
          tr.appendChild(selectTd);
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
  
  // Update Select All/Deselect All button visibility and state
  function updateSelectAllButton() {
    if (!selectAllContainer || !btnSelectAll) return;
    
    const hasFilteredData = filteredData.length > 0;
    
    // Show button when there are items to select/deselect
    if (hasFilteredData) {
      selectAllContainer.classList.remove('hidden');
      
      // Show "Deselect All" when more than 1 row is selected, otherwise "Select All"
      if (selectedRows.size > 1) {
        btnSelectAll.textContent = 'Deselect All';
      } else {
        btnSelectAll.textContent = 'Select All';
      }
    } else {
      selectAllContainer.classList.add('hidden');
    }
    
    // Also update send button
    updateSendButton();
  }
  
  // Select All / Deselect All button handler
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      // Check button text to determine action
      const isDeselectMode = btnSelectAll.textContent === 'Deselect All';
      
      if (isDeselectMode) {
        // Deselect all selected rows
        selectedRows.clear();
        
        // Update all checkboxes and row styles
        const checkboxes = pendingJobsTbody.querySelectorAll('input[type="checkbox"]');
        const rows = pendingJobsTbody.querySelectorAll('tr');
        
        checkboxes.forEach((checkbox) => {
          checkbox.checked = false;
        });
        
        rows.forEach((row) => {
          row.classList.remove('row-selected');
        });
      } else {
        // Select all filtered rows
      filteredData.forEach((row, idx) => {
        const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${idx}`;
          selectedRows.add(rowId);
      });
      
      // Update checkboxes and row styles in DOM
      const checkboxes = pendingJobsTbody.querySelectorAll('input[type="checkbox"]');
      const rows = pendingJobsTbody.querySelectorAll('tr');
      
        checkboxes.forEach((checkbox) => {
          checkbox.checked = true;
        });
        
        rows.forEach((row) => {
            row.classList.add('row-selected');
      });
      }
      
      updateSelectAllButton();
      updateSendButton();
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
    
    // Update send button and select all button after rendering
    updateSendButton();
    updateSelectAllButton();
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
    const lowerName = columnName.toLowerCase();
    
    // Exclude columns that contain "ID" - these are identifiers, not dates
    // Specifically exclude "Dispatch Schedule ID" and similar ID columns
    if (lowerName.includes('id') && (lowerName.includes('schedule') || lowerName.includes('dispatch'))) {
      return false;
    }
    
    // Exclude any column that ends with "ID" or contains "ID" as a separate word
    if (lowerName.endsWith(' id') || (lowerName.endsWith('id') && !lowerName.includes('date'))) {
      // Only exclude if it doesn't also contain "date" (e.g., "Date ID" would still be excluded)
      if (!lowerName.includes('date')) {
        return false;
      }
    }
    
    // Exclude "Dispatch Schedule" columns that don't have "date" in them
    if ((lowerName.includes('dispatch') || lowerName.includes('schedule')) && !lowerName.includes('date')) {
      // Only exclude if it contains "id" or ends with "id"
      if (lowerName.includes('id') || lowerName.endsWith('id')) {
        return false;
      }
    }
    
    // Date keywords - but "schedule" alone is not enough if it's an ID column
    const dateKeywords = ['date', 'delivery', 'order date'];
    const hasDateKeyword = dateKeywords.some(keyword => lowerName.includes(keyword));
    
    // "schedule" can indicate a date, but only if it's not an ID column
    const hasSchedule = lowerName.includes('schedule');
    const isScheduleDate = hasSchedule && !lowerName.includes('id') && (lowerName.includes('date') || lowerName.includes('delivery'));
    
    return hasDateKeyword || isScheduleDate;
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
    updateSelectAllButton();
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
        loadingText.textContent = currentIntimationType === '2nd' ? 'Sending material readiness data...' : 'Sending messages...';
      }
      loadingOverlay.classList.remove('hidden');
    }
    
    try {
      const apiBase = getApiBaseUrl();
      
      // Handle 2nd intimation differently
      if (currentIntimationType === '2nd') {
        // Get selected rows with their data (only send edited values)
        const selectedRowsData = [];
        filteredData.forEach((row, idx) => {
          const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID || `row-${idx}`;
          if (selectedRows.has(rowId)) {
            const orderBookingDetailsId = row.OrderBookingDetailsID || row.orderBookingDetailsID;
            
            if (!orderBookingDetailsId) {
              return;
            }
            
            // Check if this row has any edited values
            const editedData = editedValues.get(rowId);
            if (!editedData || Object.keys(editedData).length === 0) {
              console.warn(`Row ${rowId} has no edited values, skipping`);
              return;
            }
            
            // Build the item object with only edited values
            const item = {
              orderBookingDetailsId: [Number(orderBookingDetailsId)]
            };
            
            // Only include edited values
            if (editedData.readyForDispatchDate !== undefined) {
              item.readyForDispatchDate = editedData.readyForDispatchDate;
            }
            if (editedData.noOfCarton !== undefined) {
              item.noOfCarton = editedData.noOfCarton;
            }
            if (editedData.qtyPerCarton !== undefined) {
              item.qtyPerCarton = editedData.qtyPerCarton;
            }
            
            // Only add if at least one field was edited (orderBookingDetailsId is always included)
            if (Object.keys(item).length > 1) {
              selectedRowsData.push(item);
            }
          }
        });
        
        if (selectedRowsData.length === 0) {
          alert('No rows with edited values selected. Please edit at least one field (Readiness Date, Number of Cartons, or Qty Per Carton) before sending.');
          if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
          }
          return;
        }
        
        const requestBody = {
          username: username,
          items: selectedRowsData
        };
        
        console.log('Sending material readiness data:', {
          url: `${apiBase}comm/material-readiness/send`,
          body: requestBody
        });
        
        const response = await fetch(`${apiBase}comm/material-readiness/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        
        console.log('Material readiness send response:', { status: response.status, data });
        
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to send material readiness data');
        }
        
        // Success - reload 2nd intimation data and stay on 2nd intimation page
        if (loadingOverlay) {
          const loadingText = loadingOverlay.querySelector('.loading-spinner p');
          if (loadingText) {
            loadingText.textContent = 'Loading data...';
          }
        }
        
        const { pendingJobs, dateRange } = await fetchPendingData2ndIntimation(username);
        showDashboard(username, pendingJobs, dateRange);
        
        // Clear selected rows and edited values after successful send
        selectedRows.clear();
        editedValues.clear();
        updateSelectAllButton();
        updateSendButton();
        
        alert(`Successfully sent material readiness data for ${selectedRowsData.length} item(s)`);
        
      } else {
        // Handle 1st intimation (existing logic)
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
      
        // Success - show success message with details (only for 1st intimation)
        if (data.results && Array.isArray(data.results)) {
          showSuccessMessage(data.results);
          // Refresh data after showing success message
          const { pendingJobs, dateRange } = await fetchPendingDataByType(username, currentIntimationType);
          showDashboard(username, pendingJobs, dateRange);
        } else {
          // If no results, just reload
      window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error sending data:', error);
      alert('Error sending data: ' + error.message);
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

  // Show success message with details
  function showSuccessMessage(results) {
    if (!successMessageContainer || !successMessageContent) return;
    
    // Clear previous content
    successMessageContent.innerHTML = '';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'success-message-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Job Card No', 'Order Qty', 'Client Name', 'Job Name', 'Final Delivery Date', 'Contact Person', 'Mail Sent', 'WhatsApp Sent'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    results.forEach(result => {
      const row = document.createElement('tr');
      
      const cells = [
        result.jobCardNo || '',
        result.orderQty || '',
        result.clientName || '',
        result.jobName || '',
        result.finalDeliveryDate ? formatDate(result.finalDeliveryDate) : '',
        result.contactPerson || '',
        result.mailSent || 'No',
        result.whatsappSent || 'No'
      ];
      
      cells.forEach(cellText => {
        const td = document.createElement('td');
        td.textContent = cellText;
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    successMessageContent.appendChild(table);
    successMessageContainer.classList.remove('hidden');
    
    // Scroll to success message
    successMessageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Hide success message
  function hideSuccessMessage() {
    if (successMessageContainer) {
      successMessageContainer.classList.add('hidden');
    }
  }

  // Close success message button handler
  if (btnCloseSuccess) {
    btnCloseSuccess.addEventListener('click', () => {
      hideSuccessMessage();
    });
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
  async function updateExpectedDeliveryDate(orderBookingDetailsID, newDate, inputElement = null, originalValue = null) {
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
      // If already in YYYY-MM-DD format, use as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        formattedDate = newDate;
      } else {
        // Try to parse and format
      const parsedDate = new Date(newDate);
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
        }
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
      
      // Update local data instead of reloading
      if (finalDeliveryDateColumnIndex >= 0 && columnsToShow && columnsToShow.length > 0) {
        const finalDeliveryDateKey = columnsToShow[finalDeliveryDateColumnIndex];
        
        // Update pendingData
        const pendingRow = pendingData.find(row => 
          (row.OrderBookingDetailsID || row.orderBookingDetailsID) == orderBookingDetailsID
        );
        if (pendingRow && finalDeliveryDateKey) {
          pendingRow[finalDeliveryDateKey] = formattedDate;
        }
        
        // Update filteredData
        const filteredRow = filteredData.find(row => 
          (row.OrderBookingDetailsID || row.orderBookingDetailsID) == orderBookingDetailsID
        );
        if (filteredRow && finalDeliveryDateKey) {
          filteredRow[finalDeliveryDateKey] = formattedDate;
        }
        
        // Update the input field value to show the formatted date
        if (inputElement) {
          inputElement.value = formatDate(formattedDate);
        }
      }
    } catch (error) {
      console.error('Error updating delivery date:', error);
      alert('Error updating delivery date: ' + error.message);
      
      // Restore original value on error
      if (inputElement && originalValue !== null && originalValue !== undefined) {
        inputElement.value = formatDate(originalValue);
      } else if (inputElement) {
        inputElement.value = '';
      }
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
  
  // Update local column value (for number columns)
  function updateLocalColumnValue(row, columnKey, newValue) {
    if (!row || !columnKey) {
      console.warn('Invalid row or column key for local update');
      return;
    }
    
    // Get the row identifier
    const rowId = row.OrderBookingDetailsID || row.orderBookingDetailsID;
    if (!rowId) {
      console.warn('Row ID not found for local update');
      return;
    }
    
    console.log('Updating local column value:', {
      rowId,
      columnKey,
      newValue
    });
    
    // Update pendingData
    const pendingRow = pendingData.find(r => 
      (r.OrderBookingDetailsID || r.orderBookingDetailsID) == rowId
    );
    if (pendingRow && columnKey) {
      pendingRow[columnKey] = newValue;
    }
    
    // Update filteredData
    const filteredRow = filteredData.find(r => 
      (r.OrderBookingDetailsID || r.orderBookingDetailsID) == rowId
    );
    if (filteredRow && columnKey) {
      filteredRow[columnKey] = newValue;
    }
    
    // Update the row object itself
    row[columnKey] = newValue;
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

  // Handle intimation type button clicks
  if (btn1stIntimation) {
    btn1stIntimation.addEventListener('click', async () => {
      if (currentIntimationType === '1st') return; // Already active
      
      // Set 1st intimation as active
      btn1stIntimation.classList.add('active');
      if (btn2ndIntimation) btn2ndIntimation.classList.remove('active');
      currentIntimationType = '1st';
      
      // Fetch and display 1st intimation data
      const username = localStorage.getItem('whatsapp_username');
      if (username) {
        showLoading(true);
        try {
          const { pendingJobs, dateRange } = await fetchPendingDataByType(username, '1st');
          showDashboard(username, pendingJobs, dateRange);
        } catch (error) {
          console.error('Failed to fetch 1st intimation data:', error);
          alert('Failed to load 1st intimation data: ' + error.message);
        } finally {
          showLoading(false);
        }
      }
    });
  }

  if (btn2ndIntimation) {
    btn2ndIntimation.addEventListener('click', async () => {
      if (currentIntimationType === '2nd') return; // Already active
      
      // Set 2nd intimation as active
      btn2ndIntimation.classList.add('active');
      if (btn1stIntimation) btn1stIntimation.classList.remove('active');
      currentIntimationType = '2nd';
      
      // Fetch and display 2nd intimation data
      const username = localStorage.getItem('whatsapp_username');
      if (username) {
        showLoading(true);
        try {
          const { pendingJobs, dateRange } = await fetchPendingDataByType(username, '2nd');
          showDashboard(username, pendingJobs, dateRange);
        } catch (error) {
          console.error('Failed to fetch 2nd intimation data:', error);
          alert('Failed to load 2nd intimation data: ' + error.message);
        } finally {
          showLoading(false);
        }
      }
    });
  }

  // Initialize - show loading initially
  showLoading(true);
  checkAuth();
})();
