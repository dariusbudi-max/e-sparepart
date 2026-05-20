const { ref } = Vue;
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

    return { opnameDetail, loadingOpname, showOpnameModal, loadOpnameDetail };
}