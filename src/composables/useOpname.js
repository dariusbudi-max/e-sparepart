const { ref, computed } = Vue;
import { fetchOpnameDetail } from "../services/analyticsService.js";

export function useOpname() {
    const opnameDetail = ref([]);
    const loadingOpname = ref(false);
    const showOpnameModal = ref(false);

    const loadOpnameDetail = async () => {
        if (loadingOpname.value) return;
        loadingOpname.value = true;
        try {
            opnameDetail.value = await fetchOpnameDetail();
            showOpnameModal.value = true;
        } catch (err) {
            console.error(err);
        } finally {
            loadingOpname.value = false;
        }
    };

    const filteredOpnameDetail = computed(() => {
        const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date();

        return opnameDetail.value.filter(item => {
            const dateProperty = item.created_at || item.tanggal || new Date(); 
            const opnameDate = new Date(dateProperty);
            const timeDiff = now - opnameDate;
            
            return timeDiff <= SEVEN_DAYS_IN_MS;
        });
    });

    return { opnameDetail, filteredOpnameDetail, loadingOpname, showOpnameModal, loadOpnameDetail };
}
