/* ============================================
   Bee Like Orçamento — Main Application
   Lógica da calculadora, preview canvas e orçamento
   ============================================ */

(function () {
    'use strict';

    /* === State === */
    let config = Storage.getConfig();
    let activeProductId = config.activeProductId || 'adesivos';
    let activeProduct = null;          // referência ao produto ativo
    let currentLayout = null;
    let currentCosts = null;
    let selectedSheet = 'A4';
    let selectedOrientation = 'auto';
    let budgetItems = Storage.getBudgetItems();

    /* === DOM References (initialized in init) === */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    let els = {};

    /* === Init === */
    function init() {
        els = {
            // Product selector
            productSelector: $('#product-selector'),

            // Form
            sheetFields:      $('#sheet-fields'),
            unitFields:       $('#unit-fields'),
            formProductIcon:  $('#form-product-icon'),
            formProductTitle: $('#form-product-title'),
            paperTypeDisplay: $('#paper-type-display'),
            formatRadios:     () => $$('input[name="format"]'),
            dimensionsGroup:  $('#dimensions-inputs'),
            dimensionsLabel:  $('#dimensions-label'),
            quantityInput:    $('#input-quantity'),
            unitCostInput:    $('#input-unit-cost'),
            unitCostHint:     $('#unit-cost-hint'),
            sheetToggle:      $('#sheet-toggle'),
            sheetBtns:        () => $$('.sheet-toggle-btn[data-sheet]'),
            addBtn:           $('#btn-add-item'),

            // Preview
            previewCard:      $('#preview-card'),
            canvas:           $('#preview-canvas'),
            sheetLabel:       $('#preview-sheet-label'),
            utilizationFill:  $('#utilization-fill'),
            utilizationValue: $('#utilization-value'),

            // Costs
            rowPerSheet:  $('#row-per-sheet'),
            rowSheets:    $('#row-sheets'),
            rowMaterial:  $('#row-material'),
            rowPrint:     $('#row-print'),
            rowUnit:      $('#row-unit'),
            costPerSheet: $('#cost-per-sheet'),
            costSheets:   $('#cost-sheets'),
            costMaterial: $('#cost-material'),
            costPrint:    $('#cost-print'),
            costTotal:    $('#cost-total'),
            costUnit:     $('#cost-unit'),
            costSale:     $('#cost-sale'),
            costPerLabel: $('#cost-per-label'),

            // Error
            errorMsg:  $('#error-message'),
            errorText: $('#error-text'),

            // Budget
            budgetEmpty:        $('#budget-empty'),
            budgetTableWrapper: $('#budget-table-wrapper'),
            budgetTbody:        $('#budget-tbody'),
            budgetFooter:       $('#budget-footer'),
            budgetCount:        $('#budget-count'),
            budgetTotalCost:    $('#budget-total-cost'),
            budgetTotalSale:    $('#budget-total-sale'),
            budgetCodeWrapper:  $('#budget-code-wrapper'),
            budgetCode:         $('#budget-code'),
            budgetMarkup:       $('#budget-markup'),
            btnClear:           $('#btn-clear-budget'),
            btnPrint:           $('#btn-print'),
            btnSaveSheets:      $('#btn-save-sheets'),

            // Client
            clientCnpj:  $('#client-cnpj'),
            clientName:  $('#client-name'),
            clientPhone: $('#client-phone'),
            clientEmail: $('#client-email'),

            // Orientation comparison
            orientationGroup:      $('#orientation-group'),
            orientationToggle:     $('#orientation-toggle'),
            orientationBtns:       () => $$('#orientation-toggle .sheet-toggle-btn'),
            orientationHint:       $('#orientation-hint'),
            orientationComparison: $('#orientation-comparison'),
            orientationHRow:       $('#orientation-h-row'),
            orientationVRow:       $('#orientation-v-row'),
            orientationHCount:     $('#orientation-h-count'),
            orientationVCount:     $('#orientation-v-count'),

            // Toast
            toast:     $('#toast'),
            toastText: $('#toast-text'),

            // Print-only elements
            printDate:         $('#print-date'),
            printCompanyName:  $('#print-company-name'),
            printCompanyDesc:  $('#print-company-desc'),
            printCompanyCnpj:  $('#print-company-cnpj'),
            printClientCnpj:   $('#print-client-cnpj'),
            printClientName:   $('#print-client-name'),
            printClientPhone:  $('#print-client-phone'),
            printClientEmail:  $('#print-client-email'),
        };

        bindEvents();
        initInputMasks();
        renderBudget();

        // Sincroniza produtos com o Sheets antes de renderizar o seletor
        syncFromSheets(function() {
            renderProductSelector();
            switchProduct(activeProductId, false);
        });

        // Pré-preenche campos do cliente se vieram via URL (ex: "Novo p/ Cliente")
        const params = new URLSearchParams(window.location.search);
        if (params.get('clientName'))  els.clientName.value  = params.get('clientName');
        if (params.get('clientCnpj'))  els.clientCnpj.value  = params.get('clientCnpj');
        if (params.get('clientPhone')) els.clientPhone.value = params.get('clientPhone');
        if (params.get('clientEmail')) els.clientEmail.value = params.get('clientEmail');
    }

    /* === Sync produtos da API === */
    function syncFromSheets(onDone) {
        const apiUrl = config.apiUrl;
        if (!apiUrl) { onDone(); return; }

        fetch(apiUrl + '/api/data')
            .then(function(r) { return r.json(); })
            .then(function(result) {
                if (result.status === 'ok') {
                    if (result.products && Object.keys(result.products).length > 0) {
                        config.products = result.products;
                        Storage.saveConfig(config);
                    } else if (result.config && result.config.products && Object.keys(result.config.products).length > 0) {
                        // fallback: produtos salvos dentro do config.json (formato legado)
                        config.products = result.config.products;
                        Storage.saveConfig(config);
                    }
                }
                onDone();
            })
            .catch(function() {
                onDone();
            });
    }

    /* === Product Selector === */
    function renderProductSelector() {
        const products = config.products || {};
        // Ordena alfabeticamente por label (nome + tipo de papel)
        const ids = Object.keys(products).sort((a, b) => {
            const pa = products[a], pb = products[b];
            const la = pa.type === 'sheet' && pa.paperType ? `${pa.name} — ${pa.paperType}` : pa.name;
            const lb = pb.type === 'sheet' && pb.paperType ? `${pb.name} — ${pb.paperType}` : pb.name;
            return la.localeCompare(lb, 'pt-BR', { sensitivity: 'base' });
        });
        els.productSelector.style.display = '';
        els.productSelector.innerHTML = `
            <label class="product-select-label no-print">Produto:</label>
            <select class="product-select no-print" id="product-select">
                ${ids.map(id => {
                    const p = products[id];
                    const icon = p.type === 'unit' ? '📦' : '📋';
                    const label = p.type === 'sheet' && p.paperType ? `${p.name} — ${p.paperType}` : p.name;
                    return `<option value="${id}" ${id === activeProductId ? 'selected' : ''}>${icon} ${label}</option>`;
                }).join('')}
            </select>`;

        document.getElementById('product-select').addEventListener('change', function() {
            switchProduct(this.value);
        });
    }

    function switchProduct(productId, doRecalc = true) {
        const products = config.products || {};
        if (!products[productId]) {
            productId = Object.keys(products)[0];
        }
        activeProductId = productId;
        activeProduct = products[productId];

        // Update select value
        const sel = document.getElementById('product-select');
        if (sel) sel.value = productId;

        // Update form header
        els.formProductTitle.textContent = 'Novo(a) ' + activeProduct.name;
        els.formProductIcon.textContent = activeProduct.type === 'unit' ? '📦' : '📐';

        // Show/hide field groups
        if (activeProduct.type === 'unit') {
            els.sheetFields.classList.add('hidden');
            els.unitFields.classList.remove('hidden');
            els.previewCard.classList.add('hidden');
            // Show/hide cost rows
            [els.rowPerSheet, els.rowSheets, els.rowMaterial, els.rowPrint].forEach(r => r.classList.add('hidden'));
            els.rowUnit.classList.remove('hidden');
            // Populate unit cost hint
            if (activeProduct.unitCost !== undefined) {
                els.unitCostInput.value = activeProduct.unitCost;
            }
        } else {
            els.sheetFields.classList.remove('hidden');
            els.unitFields.classList.add('hidden');
            els.previewCard.classList.remove('hidden');
            [els.rowPerSheet, els.rowSheets, els.rowMaterial, els.rowPrint].forEach(r => r.classList.remove('hidden'));
            els.rowUnit.classList.remove('hidden');
            // Render paper type for this product
            renderPaperTypeDisplay();
        }

        // Reset markup to default for new product
        const firstTier = (activeProduct.markupTiers || [])[0];
        els.budgetMarkup.value = firstTier ? firstTier.markup : 5;

        clearResults();
        if (activeProduct.type === 'sheet') {
            renderDimensionInputs();
        }
        if (doRecalc) recalculate();
    }

    /* === Material Radios (dynamic per product) === */
    function renderPaperTypeDisplay() {
        if (!activeProduct || activeProduct.type !== 'sheet') return;
        const paperType = activeProduct.paperType || '—';
        const priceA4 = activeProduct.priceA4 ? formatCurrency(activeProduct.priceA4) + '/folha' : '—';
        const priceA3 = activeProduct.priceA3 ? formatCurrency(activeProduct.priceA3) + '/folha' : '—';

        els.paperTypeDisplay.innerHTML = `
            <div class="paper-type-name">🏷️ ${paperType}</div>
            <p class="form-hint">A4: ${priceA4} &nbsp;·&nbsp; A3: ${priceA3}</p>`;
    }

    /* === Event Binding === */
    function bindEvents() {
        // Format change
        document.addEventListener('change', (e) => {
            if (e.target.name === 'format') {
                renderDimensionInputs();
                updateOrientationVisibility();
                recalculate();
            }
        });

        // Sheet toggle
        els.sheetToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.sheet-toggle-btn[data-sheet]');
            if (!btn) return;
            selectedSheet = btn.dataset.sheet;
            els.sheetBtns().forEach(b => b.classList.toggle('active', b === btn));
            renderMaterialRadios();
            recalculate();
        });

        // Orientation toggle
        els.orientationToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.sheet-toggle-btn[data-orientation]');
            if (!btn) return;
            selectedOrientation = btn.dataset.orientation;
            els.orientationBtns().forEach(b => b.classList.toggle('active', b === btn));
            updateOrientationHint();
            recalculate();
        });

        // Quantity change
        els.quantityInput.addEventListener('input', recalculate);

        // Unit cost change
        els.unitCostInput.addEventListener('input', recalculate);

        // Add to budget
        els.addBtn.addEventListener('click', addToBudget);

        // Budget markup change
        els.budgetMarkup.addEventListener('input', recalculateBudgetTotals);

        // Clear budget
        els.btnClear.addEventListener('click', () => {
            if (budgetItems.length === 0) return;
            if (confirm('Limpar todos os itens do orçamento?')) {
                budgetItems = [];
                Storage.clearBudget();
                els.budgetCodeWrapper.classList.add('hidden');
                els.budgetCode.textContent = '—';
                renderBudget();
                showToast('Orçamento limpo', 'success');
            }
        });

        // Print
        els.btnPrint.addEventListener('click', () => {
            updatePrintElements();
            window.print();
        });

        // Sync client fields to print section in real time
        [els.clientCnpj, els.clientName, els.clientPhone, els.clientEmail].forEach(input => {
            input.addEventListener('input', updatePrintElements);
        });

        // Save to Google Sheets
        els.btnSaveSheets.addEventListener('click', saveToSheets);
    }

    /* === Dynamic Dimension Inputs === */
    function renderDimensionInputs() {
        const format = getSelectedFormat();
        let html = '';

        if (format === 'quadrado') {
            els.dimensionsLabel.textContent = 'Lado (mm)';
            html = `<input type="number" class="form-input" id="input-width"
                           placeholder="Ex: 50" min="5" max="420" value="50">`;
        } else if (format === 'retangular') {
            els.dimensionsLabel.textContent = 'Dimensões (mm)';
            html = `<div class="form-row">
                        <input type="number" class="form-input" id="input-width"
                               placeholder="Largura" min="5" max="420" value="80">
                        <input type="number" class="form-input" id="input-height"
                               placeholder="Altura" min="5" max="420" value="50">
                    </div>`;
        } else {
            els.dimensionsLabel.textContent = 'Diâmetro (mm)';
            html = `<input type="number" class="form-input" id="input-width"
                           placeholder="Ex: 50" min="5" max="420" value="50">`;
        }

        els.dimensionsGroup.innerHTML = html;

        els.dimensionsGroup.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', recalculate);
        });

        updateOrientationVisibility();
        recalculate();
    }

    /* === Orientation Helpers === */
    function updateOrientationVisibility() {
        const format = getSelectedFormat();
        if (format === 'retangular') {
            els.orientationGroup.classList.remove('hidden');
        } else {
            els.orientationGroup.classList.add('hidden');
            selectedOrientation = 'auto';
            els.orientationBtns().forEach(b => {
                b.classList.toggle('active', b.dataset.orientation === 'auto');
            });
        }
    }

    function updateOrientationHint() {
        const hints = {
            auto:       'Automático seleciona a melhor posição',
            horizontal: 'Adesivo na posição original (largura × altura)',
            vertical:   'Adesivo rotacionado 90° (altura × largura)'
        };
        els.orientationHint.textContent = hints[selectedOrientation] || '';
    }

    /* === Getters === */
    function getSelectedFormat() {
        const checked = document.querySelector('input[name="format"]:checked');
        return checked ? checked.value : 'quadrado';
    }

    function getWidth() {
        const el = $('#input-width');
        return el ? parseFloat(el.value) || 0 : 0;
    }

    function getHeight() {
        const el = $('#input-height');
        if (el) return parseFloat(el.value) || 0;
        return getWidth();
    }

    function getQuantity() {
        return parseInt(els.quantityInput.value) || 0;
    }

    function getUnitCost() {
        return parseFloat(els.unitCostInput.value) || 0;
    }

    /* === Markup por Faixa === */
    function getMarkupForVal(val) {
        const tiers = (activeProduct && activeProduct.markupTiers) || config.markupTiers || [];
        if (!tiers.length) return 5;
        for (const tier of tiers) {
            if (val <= (tier.maxVal || tier.maxSheets || 99999)) return tier.markup;
        }
        return tiers[tiers.length - 1].markup;
    }

    /* === Recalculate === */
    function recalculate() {
        if (!activeProduct) return;
        const quantity = getQuantity();

        if (activeProduct.type === 'unit') {
            recalculateUnit(quantity);
        } else {
            recalculateSheet(quantity);
        }
    }

    function recalculateSheet(quantity) {
        const format   = getSelectedFormat();
        const width    = getWidth();
        const height   = getHeight();

        if (width <= 0 || height <= 0 || quantity <= 0) {
            clearResults();
            drawEmptyCanvas();
            return;
        }

        currentLayout = Calculator.calculateLayout({
            format,
            width,
            height,
            quantity,
            sheetSize:   selectedSheet,
            margin:      activeProduct.sheetMargin,
            spacing:     activeProduct.stickerSpacing,
            orientation: format === 'retangular' ? selectedOrientation : 'auto'
        });

        if (currentLayout.error) {
            showError(currentLayout.error);
            clearResults();
            drawEmptyCanvas();
            return;
        }

        hideError();

        // Auto-fill markup from tier
        const tierMarkup = getMarkupForVal(currentLayout.sheetsNeeded);
        els.budgetMarkup.value = tierMarkup;

        // Build a config-like object for calculateCosts
        const productConfig = {
            priceA3:           activeProduct.priceA3,
            priceA4:           activeProduct.priceA4,
            printCostPerSheet: activeProduct.printCostPerSheet,
            defaultMarkup:     tierMarkup
        };

        currentCosts = Calculator.calculateCosts(
            currentLayout,
            null,
            selectedSheet,
            productConfig,
            tierMarkup
        );

        updateCostDisplay();
        updateUtilization();
        drawPreview();
    }

    function recalculateUnit(quantity) {
        const unitCost = getUnitCost();

        if (quantity <= 0 || unitCost <= 0) {
            clearResults();
            return;
        }

        hideError();

        const tierMarkup = getMarkupForVal(quantity);
        els.budgetMarkup.value = tierMarkup;

        currentLayout = null;
        currentCosts = Calculator.calculateUnitCosts(quantity, unitCost, tierMarkup);

        updateCostDisplayUnit();
    }

    /* === Update Cost Display — Sheet === */
    function updateCostDisplay() {
        if (!currentLayout || !currentCosts) return;

        els.costPerSheet.textContent = currentLayout.stickersPerSheet;
        els.costSheets.textContent   = currentLayout.sheetsNeeded;
        els.costMaterial.textContent = formatCurrency(currentCosts.materialCost);
        els.costPrint.textContent    = formatCurrency(currentCosts.printCost);
        els.costTotal.textContent    = formatCurrency(currentCosts.totalCost);
        els.costUnit.textContent     = formatCurrency(currentCosts.unitCost);
        els.costSale.textContent     = formatCurrency(currentCosts.salePrice);
        els.costPerLabel.textContent = formatCurrency(currentCosts.unitSalePrice);

        // Orientation comparison
        if (currentLayout.format === 'retangular' && currentLayout.horizontalCount !== undefined) {
            els.orientationComparison.classList.remove('hidden');

            const w = getWidth();
            const h = getHeight();
            const hText = `${currentLayout.horizontalCols}×${currentLayout.horizontalRows} = ${currentLayout.horizontalCount} un. (${w}×${h}mm)`;
            const vText = `${currentLayout.verticalCols}×${currentLayout.verticalRows} = ${currentLayout.verticalCount} un. (${h}×${w}mm)`;

            const isHActive = !currentLayout.rotated;
            els.orientationHRow.style.background = isHActive ? 'rgba(34, 197, 94, 0.12)' : 'transparent';
            els.orientationHRow.style.color       = isHActive ? '#22c55e' : 'inherit';
            els.orientationVRow.style.background  = !isHActive ? 'rgba(34, 197, 94, 0.12)' : 'transparent';
            els.orientationVRow.style.color        = !isHActive ? '#22c55e' : 'inherit';

            const bestIsH = currentLayout.horizontalCount >= currentLayout.verticalCount;
            const mark = ' ✓ melhor';
            if (currentLayout.horizontalCount !== currentLayout.verticalCount) {
                els.orientationHCount.textContent = hText + (bestIsH ? mark : '');
                els.orientationVCount.textContent = vText + (!bestIsH ? mark : '');
            } else {
                els.orientationHCount.textContent = hText;
                els.orientationVCount.textContent = vText;
            }
        } else {
            els.orientationComparison.classList.add('hidden');
        }
    }

    /* === Update Cost Display — Unit === */
    function updateCostDisplayUnit() {
        if (!currentCosts) return;
        els.costTotal.textContent    = formatCurrency(currentCosts.totalCost);
        els.costUnit.textContent     = '—';
        els.costSale.textContent     = formatCurrency(currentCosts.salePrice);
        els.costPerLabel.textContent = formatCurrency(currentCosts.unitSalePrice);
        els.orientationComparison.classList.add('hidden');
    }

    function clearResults() {
        if (els.costPerSheet) els.costPerSheet.textContent = '—';
        if (els.costSheets)   els.costSheets.textContent   = '—';
        if (els.costMaterial) els.costMaterial.textContent = '—';
        if (els.costPrint)    els.costPrint.textContent    = '—';
        els.costTotal.textContent    = '—';
        els.costUnit.textContent     = '—';
        els.costSale.textContent     = '—';
        els.costPerLabel.textContent = '—';
        if (els.utilizationFill)  els.utilizationFill.style.width = '0%';
        if (els.utilizationValue) els.utilizationValue.textContent = '0%';
        els.orientationComparison.classList.add('hidden');
        currentCosts  = null;
        currentLayout = null;
    }

    function updateUtilization() {
        if (!currentLayout) return;
        const pct = currentLayout.utilization;
        els.utilizationFill.style.width    = pct + '%';
        els.utilizationValue.textContent   = pct + '%';
    }

    /* === Error Handling === */
    function showError(msg) {
        els.errorMsg.classList.remove('hidden');
        els.errorText.textContent = msg;
    }

    function hideError() {
        els.errorMsg.classList.add('hidden');
    }

    /* === Canvas Preview === */
    function drawPreview() {
        const canvas = els.canvas;
        const ctx    = canvas.getContext('2d');
        const dpr    = window.devicePixelRatio || 1;
        const layout = currentLayout;

        if (!layout || layout.stickersPerSheet === 0) { drawEmptyCanvas(); return; }

        els.sheetLabel.textContent = selectedSheet;

        const containerWidth = canvas.parentElement.clientWidth - 32;
        const sheetW = layout.sheetWidth;
        const sheetH = layout.sheetHeight;
        const aspectRatio = sheetW / sheetH;

        const displayH = Math.min(containerWidth / aspectRatio, 500);
        const displayW = displayH * aspectRatio;

        canvas.style.width  = displayW + 'px';
        canvas.style.height = displayH + 'px';
        canvas.style.margin = '0 auto';
        canvas.style.display = 'block';
        canvas.width  = displayW * dpr;
        canvas.height = displayH * dpr;
        ctx.scale(dpr, dpr);

        const scale   = displayW / sheetW;
        const margin  = layout.margin * scale;
        const spacing = layout.spacing * scale;

        ctx.clearRect(0, 0, displayW, displayH);
        ctx.fillStyle   = '#1a1a24';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.lineWidth   = 1.5;
        roundRect(ctx, 1, 1, displayW - 2, displayH - 2, 6, true, true);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(margin, margin, displayW - 2 * margin, displayH - 2 * margin);
        ctx.setLineDash([]);

        const isCircular = layout.format === 'circular';
        const sW = (isCircular ? layout.diameter : layout.stickerW) * scale;
        const sH = (isCircular ? layout.diameter : layout.stickerH) * scale;

        for (let row = 0; row < layout.rows; row++) {
            for (let col = 0; col < layout.cols; col++) {
                const x = margin + col * (sW + spacing);
                const y = margin + row * (sH + spacing);
                ctx.fillStyle   = 'rgba(245, 158, 11, 0.12)';
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
                ctx.lineWidth   = 1;
                if (isCircular) {
                    const r = sW / 2;
                    ctx.beginPath();
                    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                } else {
                    roundRect(ctx, x, y, sW, sH, 2, true, true);
                }
            }
        }

        ctx.fillStyle  = 'rgba(255, 255, 255, 0.25)';
        ctx.font       = `${10 * (displayW / 300)}px Inter, sans-serif`;
        ctx.textAlign  = 'center';
        ctx.fillText(`${sheetW} × ${sheetH} mm`, displayW / 2, displayH - 6);
    }

    function drawEmptyCanvas() {
        if (!els.canvas) return;
        const canvas = els.canvas;
        const ctx    = canvas.getContext('2d');
        const dpr    = window.devicePixelRatio || 1;

        const containerWidth = canvas.parentElement.clientWidth - 32;
        const sheet = Calculator.getSheetDimensions(selectedSheet);
        const aspectRatio = sheet.width / sheet.height;
        const displayH = Math.min(containerWidth / aspectRatio, 500);
        const displayW = displayH * aspectRatio;

        canvas.style.width  = displayW + 'px';
        canvas.style.height = displayH + 'px';
        canvas.style.margin = '0 auto';
        canvas.style.display = 'block';
        canvas.width  = displayW * dpr;
        canvas.height = displayH * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, displayW, displayH);
        ctx.fillStyle   = '#1a1a24';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth   = 1.5;
        roundRect(ctx, 1, 1, displayW - 2, displayH - 2, 6, true, true);

        ctx.fillStyle    = 'rgba(255, 255, 255, 0.15)';
        ctx.font         = `${14 * (displayW / 300)}px Inter, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Preencha os campos', displayW / 2, displayH / 2 - 10);
        ctx.font = `${11 * (displayW / 300)}px Inter, sans-serif`;
        ctx.fillText('para visualizar', displayW / 2, displayH / 2 + 14);

        if (els.sheetLabel) els.sheetLabel.textContent = selectedSheet;
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill)   ctx.fill();
        if (stroke) ctx.stroke();
    }

    /* === Budget Management === */
    function addToBudget() {
        const quantity = getQuantity();
        if (!quantity || quantity <= 0) {
            showToast('Informe a quantidade.', 'error');
            return;
        }

        if (activeProduct.type === 'unit') {
            if (!currentCosts || currentCosts.totalCost === 0) {
                showToast('Informe o custo unitário.', 'error');
                return;
            }
        } else {
            if (!currentLayout || !currentCosts || currentLayout.stickersPerSheet === 0) {
                showToast('Configure os dados do item corretamente.', 'error');
                return;
            }
        }

        const markup = parseFloat(els.budgetMarkup.value) || 5;
        let item = {
            productId:   activeProductId,
            productName: activeProduct.name,
            productType: activeProduct.type,
            quantity,
            markup,
            totalCost:  currentCosts.totalCost,
            salePrice:  currentCosts.salePrice,
        };

        if (activeProduct.type === 'sheet') {
            item.paperType     = activeProduct.paperType || '';
            item.format        = getSelectedFormat();
            item.width         = getWidth();
            item.height        = getHeight();
            item.sheetSize     = selectedSheet;
            item.sheetsNeeded  = currentLayout.sheetsNeeded;
            item.description   = formatDimensions(item) + (item.paperType ? ' — ' + item.paperType : '');
        } else {
            item.unitCost    = getUnitCost();
            item.description = '';
        }

        Storage.addBudgetItem(item);
        budgetItems = Storage.getBudgetItems();
        renderBudget();
        showToast('Item adicionado ao orçamento!', 'success');
    }

    function removeBudgetItem(id) {
        budgetItems = Storage.removeBudgetItem(id);
        renderBudget();
        showToast('Item removido.', 'success');
    }

    function renderBudget() {
        const hasItems = budgetItems.length > 0;

        els.budgetEmpty.classList.toggle('hidden', hasItems);
        els.budgetTableWrapper.classList.toggle('hidden', !hasItems);
        els.budgetFooter.classList.toggle('hidden', !hasItems);
        els.budgetCount.textContent = budgetItems.length + (budgetItems.length === 1 ? ' item' : ' itens');

        if (!hasItems) return;

        els.budgetTbody.innerHTML = budgetItems.map((item, idx) => {
            return `<tr>
                <td>${idx + 1}</td>
                <td>${item.productName || item.materialName || '—'}</td>
                <td>${item.description || formatDimensions(item)}</td>
                <td>${item.quantity}</td>
                <td class="no-print">${formatCurrency(item.totalCost)}</td>
                <td class="text-accent">${formatCurrency(item.salePrice)}</td>
                <td class="col-actions no-print">
                    <button class="btn btn-ghost btn-icon btn-remove" data-id="${item.id}" title="Remover item">✕</button>
                </td>
            </tr>`;
        }).join('');

        els.budgetTbody.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => removeBudgetItem(btn.dataset.id));
        });

        recalculateBudgetTotals();
    }

    function recalculateBudgetTotals() {
        let totalCost = 0;
        let totalSale = 0;

        budgetItems.forEach(item => {
            totalCost += item.totalCost;
            totalSale += item.salePrice; // usa o markup individual de cada item
        });

        els.budgetTotalCost.textContent = formatCurrency(totalCost);
        els.budgetTotalSale.textContent = formatCurrency(totalSale);
    }

    /* === Update Print-Only Elements === */
    function updatePrintElements() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        els.printDate.innerHTML = `Orçamento gerado em<br><strong>${dateStr} às ${timeStr}</strong>`;

        // Company info
        const ci = config.companyInfo || {};
        if (els.printCompanyName) els.printCompanyName.textContent = ci.name || '';
        if (els.printCompanyDesc) els.printCompanyDesc.textContent = ci.description || '';
        if (els.printCompanyCnpj) els.printCompanyCnpj.textContent = ci.cnpj ? 'CNPJ ' + ci.cnpj : '';

        // Client info
        els.printClientCnpj.textContent  = els.clientCnpj.value.trim()  || '—';
        els.printClientName.textContent  = els.clientName.value.trim()  || '—';
        els.printClientPhone.textContent = els.clientPhone.value.trim() || '—';
        els.printClientEmail.textContent = els.clientEmail.value.trim() || '—';
    }

    /* === Save to API === */
    function saveToSheets() {
        if (!config.apiUrl) {
            showToast('Configure a URL da API nas Configurações.', 'error');
            return;
        }
        if (budgetItems.length === 0) {
            showToast('Adicione itens ao orçamento antes de salvar.', 'error');
            return;
        }

        const payload = {
            date:        new Date().toLocaleString('pt-BR'),
            clientCnpj:  els.clientCnpj.value.trim()  || '—',
            clientName:  els.clientName.value.trim()  || '—',
            clientPhone: els.clientPhone.value.trim() || '—',
            clientEmail: els.clientEmail.value.trim() || '—',
            items: budgetItems.map(item => ({
                productName: item.productName || item.materialName || '—',
                description: item.description || formatDimensions(item),
                quantity:    item.quantity,
                totalCost:   item.totalCost,
                salePrice:   item.salePrice
            }))
        };

        els.btnSaveSheets.disabled = true;
        els.btnSaveSheets.textContent = '⏳ Salvando...';

        fetch(config.apiUrl + '/api/budgets', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(data => {
            const budgetCode = data.budgetCode;
            els.budgetCode.textContent = budgetCode;
            els.budgetCodeWrapper.classList.remove('hidden');
            showToast('Orçamento salvo! Código: ' + budgetCode, 'success');
        })
        .catch(() => showToast('Erro ao salvar. Verifique a URL da API nas Configurações.', 'error'))
        .finally(() => {
            els.btnSaveSheets.disabled = false;
            els.btnSaveSheets.textContent = '💾 Salvar Orçamento';
        });
    }

    /* === Input Masks === */
    function initInputMasks() {
        els.clientCnpj.addEventListener('input', () => applyCnpjMask(els.clientCnpj));
        els.clientCnpj.addEventListener('blur',  () => validateCnpj(els.clientCnpj));
        els.clientPhone.addEventListener('input', () => applyPhoneMask(els.clientPhone));
        els.clientPhone.addEventListener('blur',  () => validatePhone(els.clientPhone));
    }

    function applyCnpjMask(input) {
        const digits = input.value.replace(/\D/g, '').slice(0, 14);
        let result = '';
        for (let i = 0; i < digits.length; i++) {
            if (i === 2 || i === 5) result += '.';
            else if (i === 8) result += '/';
            else if (i === 12) result += '-';
            result += digits[i];
        }
        input.value = result;
        clearFieldError(input);
    }

    function validateCnpj(input) {
        const digits = input.value.replace(/\D/g, '');
        if (digits.length === 0) { clearFieldError(input); return; }
        if (digits.length < 14) setFieldError(input, 'CNPJ incompleto');
        else clearFieldError(input);
    }

    function applyPhoneMask(input) {
        const digits = input.value.replace(/\D/g, '').slice(0, 11);
        if (digits.length === 0) { input.value = ''; clearFieldError(input); return; }
        let result = '(';
        for (let i = 0; i < digits.length; i++) {
            if (i === 2) result += ') ';
            else if (i === 7) result += '-';
            result += digits[i];
        }
        input.value = result;
        clearFieldError(input);
    }

    function validatePhone(input) {
        const digits = input.value.replace(/\D/g, '');
        if (digits.length === 0) { clearFieldError(input); return; }
        if (digits.length < 11) setFieldError(input, 'Telefone incompleto');
        else clearFieldError(input);
    }

    function setFieldError(input, msg) {
        input.classList.add('input-error');
        let hint = input.parentElement.querySelector('.field-error-text');
        if (!hint) {
            hint = document.createElement('span');
            hint.className = 'field-error-text';
            input.parentElement.appendChild(hint);
        }
        hint.textContent = '⚠ ' + msg;
    }

    function clearFieldError(input) {
        input.classList.remove('input-error');
        const hint = input.parentElement.querySelector('.field-error-text');
        if (hint) hint.remove();
    }

    /* === Helpers === */
    function formatCurrency(val) {
        return 'R$ ' + (val || 0).toFixed(2).replace('.', ',');
    }

    function formatDimensions(item) {
        if (!item.format) return item.description || '—';
        if (item.format === 'quadrado') return item.width + '×' + item.width + 'mm';
        if (item.format === 'circular') return 'Ø' + item.width + 'mm';
        return item.width + '×' + item.height + 'mm';
    }

    function showToast(msg, type = 'success') {
        els.toastText.textContent = msg;
        els.toast.className = 'toast ' + type;
        els.toast.querySelector('.toast-icon').textContent = type === 'success' ? '✅' : '⚠️';
        void els.toast.offsetWidth;
        els.toast.classList.add('show');
        setTimeout(() => els.toast.classList.remove('show'), 3000);
    }

    /* === Window Resize === */
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (activeProduct && activeProduct.type === 'sheet') {
                if (currentLayout && currentLayout.stickersPerSheet > 0) drawPreview();
                else drawEmptyCanvas();
            }
        }, 200);
    });

    /* === Start === */
    document.addEventListener('DOMContentLoaded', init);
})();
