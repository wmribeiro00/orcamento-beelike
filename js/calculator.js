/* ============================================
   Bee Like Orçamento — Calculator Engine
   Cálculos de aproveitamento de folha e custos
   ============================================ */

const Calculator = (function () {

    /* Dimensões das folhas em mm */
    const SHEETS = {
        A4: { width: 190, height: 280 },
        A3: { width: 280, height: 400 }
    };

    /**
     * Calcula quantos adesivos retangulares cabem na folha
     * Suporta orientação: 'auto' (melhor), 'horizontal' (como digitado), 'vertical' (rotacionado 90°)
     * Sempre retorna dados de comparação entre ambas orientações
     */
    function calcRectLayout(stickerW, stickerH, sheetSize, margin, spacing, orientation) {
        const sheet = SHEETS[sheetSize];
        const usableW = sheet.width - 2 * margin;
        const usableH = sheet.height - 2 * margin;

        // Horizontal = adesivo como digitado (W×H)
        const horizontal = _fitGrid(stickerW, stickerH, usableW, usableH, spacing);

        // Vertical = adesivo rotacionado 90° (H×W)
        const vertical = _fitGrid(stickerH, stickerW, usableW, usableH, spacing);

        // Dados de comparação (sempre presentes)
        const comparison = {
            horizontalCount: horizontal.count,
            horizontalCols: horizontal.cols,
            horizontalRows: horizontal.rows,
            verticalCount: vertical.count,
            verticalCols: vertical.cols,
            verticalRows: vertical.rows
        };

        let chosen, isRotated;

        if (orientation === 'horizontal') {
            chosen = horizontal;
            isRotated = false;
        } else if (orientation === 'vertical') {
            chosen = vertical;
            isRotated = true;
        } else {
            // Auto: escolhe a melhor orientação
            if (vertical.count > horizontal.count) {
                chosen = vertical;
                isRotated = true;
            } else {
                chosen = horizontal;
                isRotated = false;
            }
        }

        return {
            cols: chosen.cols,
            rows: chosen.rows,
            count: chosen.count,
            stickerW: isRotated ? stickerH : stickerW,
            stickerH: isRotated ? stickerW : stickerH,
            rotated: isRotated,
            ...comparison
        };
    }

    /**
     * Calcula quantos adesivos circulares cabem na folha
     * Cada círculo ocupa um quadrado de lado = diâmetro
     */
    function calcCircularLayout(diameter, sheetSize, margin, spacing) {
        const sheet = SHEETS[sheetSize];
        const usableW = sheet.width - 2 * margin;
        const usableH = sheet.height - 2 * margin;

        const grid = _fitGrid(diameter, diameter, usableW, usableH, spacing);

        return {
            cols: grid.cols,
            rows: grid.rows,
            count: grid.count,
            diameter,
            rotated: false
        };
    }

    /**
     * Calcula o layout completo baseado nos parâmetros do formulário
     */
    function calculateLayout(params) {
        const { format, width, height, quantity, sheetSize, margin, spacing, orientation } = params;

        let layout;

        if (format === 'circular') {
            layout = calcCircularLayout(width, sheetSize, margin, spacing);
        } else {
            // quadrado: width === height; retangular: width !== height
            const w = format === 'quadrado' ? width : width;
            const h = format === 'quadrado' ? width : height;
            layout = calcRectLayout(w, h, sheetSize, margin, spacing, orientation || 'auto');
        }

        if (layout.count === 0) {
            return {
                ...layout,
                stickersPerSheet: 0,
                sheetsNeeded: 0,
                totalStickers: 0,
                utilization: 0,
                sheetSize,
                format,
                quantity,
                sheetWidth: SHEETS[sheetSize].width,
                sheetHeight: SHEETS[sheetSize].height,
                margin,
                spacing,
                error: 'O adesivo é maior que a área útil da folha.'
            };
        }

        const sheetsNeeded = Math.ceil(quantity / layout.count);
        const totalStickers = layout.count * sheetsNeeded;

        // Calcular aproveitamento
        const sheet = SHEETS[sheetSize];
        const sheetArea = sheet.width * sheet.height;
        let stickerArea;
        if (format === 'circular') {
            stickerArea = Math.PI * Math.pow(layout.diameter / 2, 2) * layout.count;
        } else {
            stickerArea = layout.stickerW * layout.stickerH * layout.count;
        }
        const utilization = Math.min((stickerArea / sheetArea) * 100, 100);

        return {
            ...layout,
            stickersPerSheet: layout.count,
            sheetsNeeded,
            totalStickers,
            utilization: Math.round(utilization * 10) / 10,
            sheetSize,
            format,
            quantity,
            sheetWidth: sheet.width,
            sheetHeight: sheet.height,
            margin,
            spacing,
            error: null
        };
    }

    /**
     * Calcula os custos com base no layout e configuração
     */
    function calculateCosts(layout, material, sheetSize, config, markupOverride) {
        if (!layout || layout.stickersPerSheet === 0) {
            return {
                materialCost: 0,
                printCost: 0,
                totalCost: 0,
                markup: markupOverride || config.defaultMarkup,
                salePrice: 0,
                unitCost: 0,
                unitSalePrice: 0
            };
        }

        // Nova estrutura: priceA3/priceA4 direto no produto (sem objeto materials)
        const pricePerSheet = sheetSize === 'A3' ? (config.priceA3 || 0) : (config.priceA4 || 0);

        const materialCost = layout.sheetsNeeded * pricePerSheet;
        const printCost = layout.sheetsNeeded * config.printCostPerSheet;
        const totalCost = materialCost + printCost;

        const markup = markupOverride || config.defaultMarkup;
        const salePrice = totalCost * markup;

        const unitCost = totalCost / layout.quantity;
        const unitSalePrice = salePrice / layout.quantity;

        return {
            materialCost: round2(materialCost),
            printCost: round2(printCost),
            totalCost: round2(totalCost),
            markup,
            salePrice: round2(salePrice),
            unitCost: round2(unitCost),
            unitSalePrice: round2(unitSalePrice)
        };
    }

    /**
     * Retorna as dimensões de uma folha
     */
    function getSheetDimensions(sheetSize) {
        return { ...SHEETS[sheetSize] };
    }

    /* ---------- Private Helpers ---------- */

    function _fitGrid(itemW, itemH, areaW, areaH, spacing) {
        if (itemW <= 0 || itemH <= 0) return { cols: 0, rows: 0, count: 0 };

        const cols = Math.floor((areaW + spacing) / (itemW + spacing));
        const rows = Math.floor((areaH + spacing) / (itemH + spacing));

        return {
            cols: Math.max(0, cols),
            rows: Math.max(0, rows),
            count: Math.max(0, cols * rows)
        };
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    /**
     * Calcula custos para produtos de custo unitário (type: 'unit')
     */
    function calculateUnitCosts(quantity, unitCost, markup) {
        if (!quantity || quantity <= 0 || !unitCost || unitCost <= 0) {
            return { totalCost: 0, markup, salePrice: 0, unitSalePrice: 0 };
        }
        const totalCost  = round2(unitCost * quantity);
        const salePrice  = round2(totalCost * markup);
        const unitSalePrice = round2(salePrice / quantity);
        return { totalCost, markup, salePrice, unitSalePrice };
    }

    /* ---------- Public API ---------- */

    return {
        calculateLayout,
        calculateCosts,
        calculateUnitCosts,
        getSheetDimensions,
        SHEETS
    };
})();
