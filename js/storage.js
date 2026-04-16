/* ============================================
   Bee Like Orçamento — Storage Module
   Gerenciamento de configurações via localStorage
   ============================================ */

const Storage = (function () {
    const CONFIG_KEY = 'beelike_config';
    const BUDGET_KEY = 'beelike_budget';
    const PAPER_TYPES = [
        'Acetato Transparente',
        'Filme UV DTF',
        'Glossy',
        'Glossy Adesivo',
        'Glossy Dupla Face',
        'Manta Magnética Adesiva',
        'Matte / Fosco',
        'Matte Adesivo',
        'Matte Dupla Face',
        'Papel Magnético',
        'Papel Sublimação',
        'Personalizada',
        'PVC Imprimível',
        'RC Seda (Resistente à Água)',
        'RC Super Brilhante (Resistente à Água)',
        'RC Veludo (Resistente à Água)',
        'Seda',
        'Super Adesivo Brilhante',
        'Super Brilhante',
        'Transfer para Tecidos Claros (Light Iron-On)',
        'Transfer para Tecidos Escuros (Dark Iron-On)',
        'Veludo / Super Cristal Veludo',
        'Vinil Adesivo Branco',
        'Vinil Adesivo Fosco (PET)',
        'Vinil Adesivo Transparente',
        'Vinil Holográfico'
    ];

    const DEFAULT_MARKUP_TIERS = [
        { maxVal: 2,     markup: 18 },
        { maxVal: 5,     markup: 16 },
        { maxVal: 10,    markup: 14 },
        { maxVal: 19,    markup: 12 },
        { maxVal: 99999, markup: 9  }
    ];

    const DEFAULT_CONFIG = {
        companyInfo: {
            name: '',
            description: '',
            cnpj: ''
        },
        apiUrl: 'https://beelike.automatizeconsulting.com.br',
        activeProductId: '',
        products: {}
    };

    /* ---------- Config ---------- */

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function getConfig() {
        try {
            const raw = localStorage.getItem(CONFIG_KEY);
            if (!raw) return deepClone(DEFAULT_CONFIG);
            const saved = JSON.parse(raw);

            const result = deepClone(DEFAULT_CONFIG);
            if (saved.companyInfo)     result.companyInfo     = Object.assign({}, result.companyInfo, saved.companyInfo);
            if (saved.apiUrl)          result.apiUrl          = saved.apiUrl;
            // retrocompatibilidade: migra sheetsWebhookUrl para apiUrl se existir
            if (!saved.apiUrl && saved.sheetsWebhookUrl) result.apiUrl = saved.sheetsWebhookUrl;
            if (saved.activeProductId) result.activeProductId = saved.activeProductId;
            if (saved.products)        result.products        = saved.products;

            return result;
        } catch (err) {
            console.error('[Storage] getConfig error:', err);
            return deepClone(DEFAULT_CONFIG);
        }
    }

    function saveConfig(config) {
        try {
            const json = JSON.stringify(config);
            localStorage.setItem(CONFIG_KEY, json);
            // Verificação: confirma que foi realmente salvo
            const verify = localStorage.getItem(CONFIG_KEY);
            if (verify !== json) throw new Error('Verification failed after save');
            return true;
        } catch (err) {
            console.error('[Storage] saveConfig error:', err);
            return false;
        }
    }

    function resetConfig() {
        localStorage.removeItem(CONFIG_KEY);
        return deepClone(DEFAULT_CONFIG);
    }

    function getDefaults() {
        return deepClone(DEFAULT_CONFIG);
    }

    function getDefaultMarkupTiers() {
        return deepClone(DEFAULT_MARKUP_TIERS);
    }

    function isLocalStorageAvailable() {
        try {
            const testKey = '__beelike_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /* ---------- Budget Items ---------- */

    function getBudgetItems() {
        try {
            const raw = localStorage.getItem(BUDGET_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveBudgetItems(items) {
        try {
            localStorage.setItem(BUDGET_KEY, JSON.stringify(items));
            return true;
        } catch {
            return false;
        }
    }

    function addBudgetItem(item) {
        const items = getBudgetItems();
        item.id = Date.now() + Math.random().toString(36).slice(2, 6);
        items.push(item);
        saveBudgetItems(items);
        return item;
    }

    function removeBudgetItem(id) {
        const items = getBudgetItems().filter(i => i.id !== id);
        saveBudgetItems(items);
        return items;
    }

    function clearBudget() {
        localStorage.removeItem(BUDGET_KEY);
    }

    /* ---------- Public API ---------- */

    return {
        getConfig,
        saveConfig,
        resetConfig,
        getDefaults,
        getDefaultMarkupTiers,
        getPaperTypes: () => PAPER_TYPES,
        getBudgetItems,
        saveBudgetItems,
        addBudgetItem,
        removeBudgetItem,
        clearBudget,
        isLocalStorageAvailable
    };
})();
