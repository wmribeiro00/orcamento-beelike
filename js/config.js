/* ============================================
   Bee Like Orçamento — Config Page Logic
   Gerencia formulário de configurações e produtos
   ============================================ */

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    let config = Storage.getConfig();

    /* === DOM References === */
    const elCompanyName  = $('#company-name');
    const elCompanyDesc  = $('#company-description');
    const elCompanyCnpj  = $('#company-cnpj');
    const elApiUrl       = $('#sheets-webhook');
    const elProductList  = $('#product-list');
    const elNewForm      = $('#new-product-form');
    const elBtnAddProd   = $('#btn-add-product');
    const elBtnConfirm   = $('#btn-confirm-new-product');
    const elBtnCancel    = $('#btn-cancel-new-product');
    const elNewProdType  = $('#new-product-type');
    const elUnitFields   = $('#new-product-unit-fields');
    const elSheetFields  = $('#new-product-sheet-fields');
    const btnSave        = $('#btn-save');
    const btnReset       = $('#btn-reset');
    const toast          = $('#toast');
    const toastText      = $('#toast-text');

    /* === Init === */
    function populateNewPaperTypeSelect() {
        const sel = $('#new-paper-type');
        if (!sel) return;
        Storage.getPaperTypes().forEach(pt => {
            const opt = document.createElement('option');
            opt.value = pt;
            opt.textContent = pt;
            sel.appendChild(opt);
        });
    }

    function init() {
        if (typeof Storage.isLocalStorageAvailable === 'function' && !Storage.isLocalStorageAvailable()) {
            showToast('⚠️ localStorage bloqueado neste navegador/ambiente. As configurações não serão salvas.', 'error');
        }
        populateNewPaperTypeSelect();

        const apiUrl = config.apiUrl;
        if (apiUrl) {
            showToast('Carregando configurações do servidor...', 'success');
            fetch(apiUrl + '/api/data')
                .then(r => r.json())
                .then(result => {
                    if (result.status === 'ok') {
                        const localCompany = config.companyInfo || {};
                        if (result.config) {
                            const remoteCompany = result.config.companyInfo || {};
                            config = result.config;
                            config.apiUrl = config.apiUrl || apiUrl;
                            config.companyInfo = {
                                name:        remoteCompany.name        || localCompany.name        || '',
                                description: remoteCompany.description || localCompany.description || '',
                                cnpj:        remoteCompany.cnpj        || localCompany.cnpj        || ''
                            };
                        }
                        if (result.products && Object.keys(result.products).length > 0) {
                            config.products = result.products;
                        }
                        Storage.saveConfig(config);
                    }
                    populateCompanyFields();
                    renderProductList();
                })
                .catch(() => {
                    showToast('⚠️ Sem conexão com o servidor. Usando dados locais.', 'error');
                    populateCompanyFields();
                    renderProductList();
                });
        } else {
            populateCompanyFields();
            renderProductList();
        }
        bindEvents();
    }

    /* === Company Fields === */
    function populateCompanyFields() {
        const ci = config.companyInfo || {};
        elCompanyName.value = ci.name        || '';
        elCompanyDesc.value = ci.description || '';
        elCompanyCnpj.value = ci.cnpj        || '';
        elApiUrl.value      = config.apiUrl  || '';
    }

    /* === Product List === */
    function renderProductList() {
        const products = config.products || {};
        const ids = Object.keys(products);

        if (ids.length === 0) {
            elProductList.innerHTML = '<p class="form-hint" style="padding: 8px 0;">Nenhum produto cadastrado.</p>';
            return;
        }

        // Ordena: primeiro por nome, depois por tipo de papel
        const sortedIds = ids.slice().sort((a, b) => {
            const pa = products[a], pb = products[b];
            const nameCompare = (pa.name || '').localeCompare(pb.name || '', 'pt-BR', { sensitivity: 'base' });
            if (nameCompare !== 0) return nameCompare;
            return (pa.paperType || '').localeCompare(pb.paperType || '', 'pt-BR', { sensitivity: 'base' });
        });

        elProductList.innerHTML = sortedIds.map(id => {
            const p = products[id];
            const typeLabel = p.type === 'unit' ? '📦 Custo unitário' : '📋 Por folha';
            const paperBadge = p.type === 'sheet' && p.paperType
                ? `<span class="badge" style="font-size: 11px; padding: 2px 8px; margin-left: 6px; background: rgba(245,166,35,0.15); color: #f5a623;">${p.paperType}</span>`
                : '';
            return `
            <div class="product-list-item" data-product-id="${id}">
                <div class="product-list-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div class="product-list-info">
                        <strong>${p.name}</strong>
                        <span class="badge" style="font-size: 11px; padding: 2px 8px; margin-left: 8px;">${typeLabel}</span>
                        ${paperBadge}
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 18px; opacity: 0.4; line-height: 1;">›</span>
                        <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation(); removeProduct('${id}')" title="Excluir produto" style="color: #ef4444; font-size: 14px;">🗑️</button>
                    </div>
                </div>
                <div class="product-list-body">
                    ${renderProductEditor(id, p)}
                </div>
            </div>`;
        }).join('');
    }

    function renderProductEditor(id, p) {
        const tiers = p.markupTiers || Storage.getDefaultMarkupTiers();

        if (p.type === 'unit') {
            return `
            <div class="config-section">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Custo por Unidade (R$)</label>
                        <input type="number" class="form-input" step="0.01" min="0"
                               value="${p.unitCost || 0}"
                               onchange="updateProductField('${id}', 'unitCost', parseFloat(this.value) || 0)">
                    </div>
                    <div class="form-group"></div>
                </div>
            </div>
            ${renderTierEditor(id, tiers)}`;
        }

        // Sheet product
        const normalizedPaperType = (p.paperType || '').trim().toLowerCase();
        const paperOptions = Storage.getPaperTypes().map(pt =>
            `<option value="${pt}" ${pt.trim().toLowerCase() === normalizedPaperType ? 'selected' : ''}>${pt}</option>`
        ).join('');

        return `
            <div class="config-section">
                <h4>🏷️ Tipo de Papel</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Tipo de Papel</label>
                        <select class="form-input"
                                onchange="updateProductField('${id}', 'paperType', this.value)">
                            <option value="">— Selecione —</option>
                            ${paperOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Preço A4 (R$)</label>
                        <input type="number" class="form-input" step="0.01" min="0"
                               value="${p.priceA4 || 0}"
                               onchange="updateProductField('${id}', 'priceA4', parseFloat(this.value) || 0)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Preço A3 (R$)</label>
                        <input type="number" class="form-input" step="0.01" min="0"
                               value="${p.priceA3 || 0}"
                               onchange="updateProductField('${id}', 'priceA3', parseFloat(this.value) || 0)">
                    </div>
                </div>
            </div>
            <div class="config-section">
                <h4>⚙️ Parâmetros</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Impressão/folha (R$)</label>
                        <input type="number" class="form-input" step="0.01" min="0"
                               value="${p.printCostPerSheet || 0}"
                               onchange="updateProductField('${id}', 'printCostPerSheet', parseFloat(this.value) || 0)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Margem (mm)</label>
                        <input type="number" class="form-input" step="0.5" min="0"
                               value="${p.sheetMargin || 5}"
                               onchange="updateProductField('${id}', 'sheetMargin', parseFloat(this.value) || 0)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Espaçamento (mm)</label>
                        <input type="number" class="form-input" step="0.5" min="0"
                               value="${p.stickerSpacing || 2}"
                               onchange="updateProductField('${id}', 'stickerSpacing', parseFloat(this.value) || 0)">
                    </div>
                </div>
            </div>
            ${renderTierEditor(id, tiers)}`;
    }

    function renderTierEditor(productId, tiers) {
        const labels = ['1–2', '3–5', '6–10', '11–19', '20+'];
        const suffix = (config.products[productId] || {}).type === 'unit' ? 'un.' : 'folhas';
        const rows = tiers.map((tier, i) => `
            <div class="form-group">
                <label class="form-label">${labels[i] || ('Faixa ' + (i+1))} ${suffix}</label>
                <input type="number" class="form-input" step="0.1" min="1"
                       value="${tier.markup}"
                       onchange="updateProductTier('${productId}', ${i}, parseFloat(this.value) || 1)">
            </div>`).join('');
        return `<div class="config-section">
            <h4>💹 Markup por Faixa</h4>
            <div class="form-row" style="flex-wrap: wrap; gap: 8px;">${rows}</div>
        </div>`;
    }

    /* === In-place product field update === */
    window.updateProductField = function(productId, field, value) {
        if (!config.products[productId]) return;
        config.products[productId][field] = value;
    };

    window.updateProductTier = function(productId, tierIndex, value) {
        if (!config.products[productId] || !config.products[productId].markupTiers) return;
        config.products[productId].markupTiers[tierIndex].markup = value;
    };

    window.removeProduct = function(productId) {
        const products = config.products || {};
        const ids = Object.keys(products);
        if (ids.length <= 1) {
            showToast('Não é possível excluir o único produto.', 'error');
            return;
        }
        if (!confirm(`Excluir o produto "${products[productId].name}"?`)) return;
        const productName = products[productId].name;
        delete config.products[productId];
        Storage.saveConfig(config);
        renderProductList();

        // Remove da API
        if (config.apiUrl) {
            fetch(config.apiUrl + '/api/products/' + encodeURIComponent(productId), {
                method: 'DELETE'
            }).catch(() => {});
        }
        showToast(`Produto "${productName}" excluído.`, 'success');
    };

    /* === Add New Product === */
    function buildMarkupTiers() {
        const vals = [
            parseFloat($('#new-tier-1').value) || 18,
            parseFloat($('#new-tier-2').value) || 16,
            parseFloat($('#new-tier-3').value) || 14,
            parseFloat($('#new-tier-4').value) || 12,
            parseFloat($('#new-tier-5').value) || 9,
        ];
        const maxVals = [2, 5, 10, 19, 99999];
        return vals.map((markup, i) => ({ maxVal: maxVals[i], markup }));
    }

    function addNewProduct() {
        const name = $('#new-product-name').value.trim();
        const type = elNewProdType.value;

        if (!name) {
            showToast('Informe o nome do produto.', 'error');
            return;
        }

        // Gera ID único a partir do nome + timestamp para permitir nomes duplicados
        const baseId = name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 'produto';
        const id = config.products[baseId] ? baseId + '_' + Date.now() : baseId;

        const markupTiers = buildMarkupTiers();

        if (type === 'unit') {
            config.products[id] = {
                name,
                type: 'unit',
                unitCost:    parseFloat($('#new-product-unit-cost').value) || 0,
                markupTiers
            };
        } else {
            // Sheet product
            config.products[id] = {
                name,
                type: 'sheet',
                paperType:         $('#new-paper-type').value.trim(),
                priceA4:           parseFloat($('#new-sheet-a4').value)          || 0,
                priceA3:           parseFloat($('#new-sheet-a3').value)          || 0,
                printCostPerSheet: parseFloat($('#new-sheet-print-cost').value)  || 0,
                sheetMargin:       parseFloat($('#new-sheet-margin').value)      || 5,
                stickerSpacing:    parseFloat($('#new-sheet-spacing').value)     || 2,
                markupTiers
            };
        }

        Storage.saveConfig(config);
        elNewForm.classList.add('hidden');
        $('#new-product-name').value = '';
        renderProductList();

        // Envia para a API
        if (config.apiUrl) {
            fetch(config.apiUrl + '/api/products', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ product: config.products[id] })
            }).catch(() => {});
        }
        showToast(`Produto "${name}" adicionado!`, 'success');
    }

    /* === Events === */
    function bindEvents() {
        // Show/hide new product form
        elBtnAddProd.addEventListener('click', () => {
            elNewForm.classList.remove('hidden');
            elBtnAddProd.classList.add('hidden');
        });

        elBtnCancel.addEventListener('click', () => {
            elNewForm.classList.add('hidden');
            elBtnAddProd.classList.remove('hidden');
        });

        elBtnConfirm.addEventListener('click', () => {
            addNewProduct();
            elBtnAddProd.classList.remove('hidden');
        });

        // Toggle unit/sheet fields in new product form
        elNewProdType.addEventListener('change', () => {
            const isUnit = elNewProdType.value === 'unit';
            elUnitFields.classList.toggle('hidden', !isUnit);
            elSheetFields.classList.toggle('hidden', isUnit);
        });

        // Save all
        btnSave.addEventListener('click', () => {
            config.companyInfo = {
                name:        elCompanyName.value.trim(),
                description: elCompanyDesc.value.trim(),
                cnpj:        elCompanyCnpj.value.trim()
            };
            config.apiUrl = elApiUrl.value.trim();

            // Salva localmente sempre
            const ok = Storage.saveConfig(config);
            if (!ok) {
                showToast('Erro ao salvar: localStorage bloqueado ou indisponível neste ambiente.', 'error');
                return;
            }

            // Envia para a API se URL configurada
            if (config.apiUrl) {
                const url = config.apiUrl;

                // 1. Salva config geral (empresa, URL da API)
                fetch(url + '/api/config', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ config })
                })
                .then(() => showToast('Configurações e produtos salvos no servidor!', 'success'))
                .catch(() => showToast('⚠️ Erro ao conectar com o servidor. Dados salvos localmente.', 'error'));

                // 2. Sincroniza cada produto
                Object.values(config.products || {}).forEach(product => {
                    fetch(url + '/api/products', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ product })
                    }).catch(() => {});
                });
            } else {
                showToast('Configurações salvas localmente. Configure a URL da API para sincronizar entre máquinas.', 'success');
            }
        });

        // Reset
        btnReset.addEventListener('click', () => {
            if (confirm('Restaurar todas as configurações para os valores padrão? Isso removerá produtos adicionados.')) {
                config = Storage.resetConfig();
                populateCompanyFields();
                renderProductList();
                showToast('Configurações restauradas.', 'success');
            }
        });
    }

    /* === Toast === */
    function showToast(msg, type = 'success') {
        toastText.textContent = msg;
        toast.className = 'toast ' + type;
        toast.querySelector('.toast-icon').textContent = type === 'success' ? '✅' : '⚠️';
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
