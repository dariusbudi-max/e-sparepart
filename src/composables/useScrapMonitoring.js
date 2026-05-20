const { ref, computed } = Vue;
import { fetchDepartments } from "../services/analyticsService.js";

export function useScrapMonitoring({ supabaseClient, userData, showToast }) {
    const scrapList = ref([]);
    const departments = ref([]);
    const loading = ref(false);
    const isEditing = ref(false);
    const currentEditId = ref(null);

    const itemOptions = ["Jarum", "Cutting Board", "Input Manual"];
    const selectedItemType = ref("Input Manual");

    const form = ref({
        nama_barang: "",
        tgl_awal_pakai: "",
        tgl_akhir_pakai: "",
        tgl_penukaran: "",
        department: "",
        qty: 1
    });

    const filterSearch = ref("");
    const filterDept = ref("");
    const filterStartRange = ref("");
    const filterEndRange = ref("");

    const isDateRangeRequired = computed(() => {
        return selectedItemType.value === "Jarum";
    });

    const formatDateTime = (isoString) => {
        if (!isoString) return "-";
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "-";

        const pad = (num) => String(num).padStart(2, '0');
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1);
        const year = date.getFullYear();
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());

        return `${day}-${month}-${year} ${hours}:${minutes}`;
    };

    const loadScrapData = async () => {
        loading.value = true;
        try {
            const { data, error } = await supabaseClient
                .from("scrap_monitoring")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            scrapList.value = data || [];

            const deptData = await fetchDepartments();
            departments.value = deptData || [];
        } catch (err) {
            showToast("Gagal memuat data", "error");
        } finally {
            loading.value = false;
        }
    };

    const submitScrap = async () => {
        let finalNamaBarang = selectedItemType.value === "Input Manual"
            ? form.value.nama_barang.trim()
            : selectedItemType.value;

        if (!finalNamaBarang || !form.value.department || !form.value.tgl_penukaran) {
            showToast("Mohon lengkapi kolom yang wajib diisi!", "error");
            return;
        }

        finalNamaBarang = finalNamaBarang.toUpperCase();

        if (isDateRangeRequired.value) {
            if (!form.value.tgl_awal_pakai || !form.value.tgl_akhir_pakai) {
                showToast("Untuk item JARUM, Tanggal Awal & Akhir Pakai WAJIB diisi!", "error");
                return;
            }
        }

        const inputDeptClean = form.value.department.trim().toLowerCase();
        const isDeptValid = departments.value.some(d => d.trim().toLowerCase() === inputDeptClean);
        if (!isDeptValid) {
            showToast("Department tidak terdaftar", "error");
            return;
        }

        loading.value = true;
        try {
            const payload = {
                nama_barang: finalNamaBarang,
                tgl_awal_pakai: isDateRangeRequired.value ? form.value.tgl_awal_pakai : null,
                tgl_akhir_pakai: isDateRangeRequired.value ? form.value.tgl_akhir_pakai : null,
                tgl_penukaran: form.value.tgl_penukaran,
                department: form.value.department,
                qty: Number(form.value.qty || 1),
                created_by: userData.value?.nama || "USER"
            };

            if (isEditing.value) {
                const { error } = await supabaseClient
                    .from("scrap_monitoring")
                    .update(payload)
                    .eq("id", currentEditId.value);

                if (error) throw error;
                showToast("Data scrap berhasil diperbarui", "success");
            } else {
                const { error } = await supabaseClient
                    .from("scrap_monitoring")
                    .insert([payload]);

                if (error) throw error;
                showToast("Data scrap berhasil disimpan", "success");
            }

            resetForm();
            await loadScrapData();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            loading.value = false;
        }
    };

    const editRow = (row) => {
        isEditing.value = true;
        currentEditId.value = row.id;

        const namaUpper = (row.nama_barang || "").toUpperCase();
        if (["JARUM", "CUTTING BOARD"].includes(namaUpper)) {
            selectedItemType.value = namaUpper === "JARUM" ? "Jarum" : "Cutting Board";
            form.value.nama_barang = "";
        } else {
            selectedItemType.value = "Input Manual";
            form.value.nama_barang = row.nama_barang;
        }

        form.value.tgl_awal_pakai = row.tgl_awal_pakai || "";
        form.value.tgl_akhir_pakai = row.tgl_akhir_pakai || "";
        form.value.tgl_penukaran = row.tgl_penukaran || "";
        form.value.department = row.department;
        form.value.qty = row.qty;
    };

    const deleteRow = async (id, nama) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus catatan untuk "${nama}"?`)) return;

        loading.value = true;
        try {
            const { error } = await supabaseClient
                .from("scrap_monitoring")
                .delete()
                .eq("id", id);

            if (error) throw error;
            showToast("Data berhasil dihapus", "success");

            if (currentEditId.value === id) resetForm();
            await loadScrapData();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            loading.value = false;
        }
    };

    const resetForm = () => {
        isEditing.value = false;
        currentEditId.value = null;
        selectedItemType.value = "Input Manual";
        form.value = {
            nama_barang: "",
            tgl_awal_pakai: "",
            tgl_akhir_pakai: "",
            tgl_penukaran: "",
            department: "",
            qty: 1
        };
    };

    const resetFilters = () => {
        filterSearch.value = "";
        filterDept.value = "";
        filterStartRange.value = "";
        filterEndRange.value = "";
    };

    const filteredScrapList = computed(() => {
        return scrapList.value.filter(item => {
            if (filterSearch.value.trim()) {
                const q = filterSearch.value.toLowerCase();
                const matchNama = (item.nama_barang || "").toLowerCase().includes(q);
                const matchUser = (item.created_by || "").toLowerCase().includes(q);
                if (!matchNama && !matchUser) return false;
            }

            if (filterDept.value) {
                if (item.department !== filterDept.value) return false;
            }

            if (filterStartRange.value) {
                if (item.tgl_penukaran < filterStartRange.value) return false;
            }
            if (filterEndRange.value) {
                if (item.tgl_penukaran > filterEndRange.value) return false;
            }

            return true;
        });
    });

    const summary = computed(() => {
        const listToCalculate = filteredScrapList.value;
        const totalRecords = listToCalculate.length;
        const totalQty = listToCalculate.reduce((sum, item) => sum + Number(item.qty || 0), 0);

        const deptMap = {};
        listToCalculate.forEach(item => {
            deptMap[item.department] = (deptMap[item.department] || 0) + Number(item.qty);
        });

        let topDept = "-";
        let maxQty = 0;
        Object.entries(deptMap).forEach(([dept, qty]) => {
            if (qty > maxQty) {
                maxQty = qty;
                topDept = dept;
            }
        });

        return { totalRecords, totalQty, topDept };
    });

    return {
        form,
        scrapList,
        filteredScrapList,
        departments,
        loading,
        summary,
        itemOptions,
        selectedItemType,
        isDateRangeRequired,
        isEditing,
        filterSearch,
        filterDept,
        filterStartRange,
        filterEndRange,
        loadScrapData,
        submitScrap,
        editRow,
        deleteRow,
        cancelEdit: resetForm,
        resetFilters,
        formatDateTime
    };
}