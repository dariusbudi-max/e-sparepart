const { ref } = Vue;
import { fetchPivotInventory } from "../services/pivotService.js";

export function useAnalytics(safeFetch) {
    const pivotData = ref([]);
    const isLoading = ref(false);
    const isPivotLoaded = ref(false);
    const filter = ref({ startDate: "", endDate: "", dept: "", type: "ALL", kode: "" });

    const loadPivot = async () => {
        if (!filter.value.startDate || !filter.value.endDate) return;

        isLoading.value = true;

        const data = await safeFetch({
            fn: () => fetchPivotInventory(filter.value),
            fallback: [],
            label: "Analisa Pivot"
        });

        pivotData.value = data;
        isPivotLoaded.value = true;
        isLoading.value = false;
    };

    return { pivotData, filter, isLoading, isPivotLoaded, loadPivot };
}