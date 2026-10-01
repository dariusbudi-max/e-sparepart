const { ref, computed } = Vue;
import { fetchOpnameDetail } from "../services/analyticsService.js";

export function useOpname() {
    const opnameDetail = ref([]);
    const loadingOpname = ref(false);
    const showOpnameModal = ref(false);

    const loadOpnameDetail = async (openModal = true) => {
        if (loadingOpname.value) return;
        loadingOpname.value = true;
        try {
            const data = await fetchOpnameDetail();
            opnameDetail.value = Array.isArray(data) ? data : [];
            if (openModal) showOpnameModal.value = true;
        } catch (err) {
            opnameDetail.value = [];
            if (openModal) showOpnameModal.value = false;
        } finally {
            loadingOpname.value = false;
        }
    };

    const formatOpnameDate = (date) => {
        if (!date) return "-";

        const d = new Date(date);

        if (Number.isNaN(d.getTime())) {
            return "-";
        }

        return d.toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const filteredOpnameDetail = computed(() => opnameDetail.value);

    return { opnameDetail, filteredOpnameDetail, loadingOpname, showOpnameModal, loadOpnameDetail, formatOpnameDate };
}
