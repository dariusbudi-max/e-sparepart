const { ref, computed } = Vue;
import {
    fetchDashboard,
    fetchHistory,
    fetchHistoryExport,
    fetchSummary,
    fetchLowStock,
    fetchDepartments
} from "../services/analyticsService.js";

export function useDashboard(safeFetch, searchQuery) {
    const dashData = ref({ totalItem: 0, totalStok: 0, totalLowStock: 0, selisihOpname: 0 });
    const dashboardTx = ref([]);
    const recentTx = ref([]);
    const lowStockItems = ref([]);
    const departments = ref([]);
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).toISOString().split("T")[0];
    const dashFilter = ref({ startDate: today, endDate: today, dept: '', type: 'ALL' });

    const loadSummary = async () => {
        const data = await safeFetch({ fn: fetchSummary, label: "Ringkasan" });
        if (data) dashData.value = data;
    };

    const loadDashboard = async () => {
        dashboardTx.value = await safeFetch({ fn: fetchDashboard, fallback: [], label: "Dashboard" });
    };

    const loadHistory = async () => {
        recentTx.value = await safeFetch({
            fn: () => fetchHistory(dashFilter.value),
            fallback: [],
            label: "Riwayat"
        });
    };

    const exportHistory = async () => {
        return await safeFetch({
            fn: () => fetchHistoryExport(dashFilter.value),
            fallback: [],
            label: "Export Riwayat"
        });
    };

    const loadLowStock = async () => {
        lowStockItems.value = await safeFetch({ fn: fetchLowStock, fallback: [], label: "Stok Rendah" });
    };

    const loadDepartments = async () => {
        departments.value = await safeFetch({ fn: fetchDepartments, fallback: [], label: "Departemen" });
    };

    const fetchDashboardAll = async () => {
        await Promise.all([loadSummary(), loadDashboard(), loadLowStock(), loadHistory(), loadDepartments()]);
    };

    const resetFilter = async () => {
        dashFilter.value = { startDate: today, endDate: today, dept: '', type: 'ALL' };
        await loadHistory();
    };

    const filteredHistory = computed(() => {
        const q = (searchQuery.value || '').toLowerCase().trim();
        if (!q) return recentTx.value;
        return recentTx.value.filter(tx =>
            tx.kode.toLowerCase().includes(q) ||
            tx.nama.toLowerCase().includes(q) ||
            tx.jenis.toLowerCase().includes(q) ||
            tx.user.toLowerCase().includes(q) ||
            tx.dept.toLowerCase().includes(q) ||
            tx.ket.toLowerCase().includes(q)
        );
    });

    return {
        dashData, dashboardTx, recentTx, lowStockItems, departments,
        today, dashFilter, exportHistory, 
        loadSummary, loadDashboard, loadHistory, loadLowStock,
        loadDepartments, fetchDashboardAll, resetFilter, filteredHistory
    };
}