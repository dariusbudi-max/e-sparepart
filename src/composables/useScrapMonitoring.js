const { ref, computed } = Vue;
import { fetchDepartments } from "../services/analyticsService.js";
import { exportScrapExcel } from "../exports/excelExport.js";


export function useScrapMonitoring({ supabaseClient, userData, showToast }) {
    const scrapList = ref([]);
    const departments = ref([]);
    const loading = ref(false);
    const isEditing = ref(false);
    const currentEditId = ref(null);

    const itemOptions = ["Jarum", "Cutting Board", "Pantex", "Input Manual"];
    const selectedItemType = ref("Input Manual");

    const searchQuery = ref("");
    const filterDept = ref("");
    const filterStartDate = ref("");
    const filterEndDate = ref("");

    const form = ref({
        nama_barang: "",
        tgl_awal_pakai: "",
        tgl_akhir_pakai: "",
        tgl_penukaran: "",
        department: "",
        qty: ""
    });

    const isDateRangeRequired = computed(() => {
        return selectedItemType.value === "Jarum";
    });

    const isFormInvalid = computed(() => {
        const finalNamaBarang = selectedItemType.value === "Input Manual"
            ? form.value.nama_barang?.trim()
            : selectedItemType.value;

        if (!finalNamaBarang || !form.value.department || !form.value.tgl_penukaran) {
            return true;
        }

        if (isDateRangeRequired.value && (!form.value.tgl_awal_pakai || !form.value.tgl_akhir_pakai)) {
            return true;
        }

        if (form.value.qty === "" || form.value.qty === null || Number(form.value.qty) <= 0) {
            return true;
        }

        return false;
    });

    const loadScrapData = async () => {
        loading.value = true;
        try {
            const { data, error } = await supabaseClient
                .from("scrap_monitoring")
                .select("*", { count: 'exact' })
                .order("created_at", { ascending: false })
                .limit(1000);


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

    const filteredScrapList = computed(() => {
        return scrapList.value.filter(item => {
            const matchSearch = !searchQuery.value ||
                item.nama_barang.toLowerCase().includes(searchQuery.value.toLowerCase());

            const matchDept = !filterDept.value ||
                item.department.toLowerCase() === filterDept.value.toLowerCase();

            let matchDate = true;
            if (item.created_at) {
                const inputDate = new Date(item.created_at).setHours(0, 0, 0, 0);

                if (filterStartDate.value) {
                    const start = new Date(filterStartDate.value).setHours(0, 0, 0, 0);
                    if (inputDate < start) matchDate = false;
                }
                if (filterEndDate.value) {
                    const end = new Date(filterEndDate.value).setHours(23, 59, 59, 999);
                    if (inputDate > end) matchDate = false;
                }
            }

            return matchSearch && matchDept && matchDate;
        });
    });

    const submitScrap = async () => {
        const finalNamaBarang = selectedItemType.value === "Input Manual"
            ? form.value.nama_barang.toUpperCase().trim()
            : selectedItemType.value.toUpperCase();

        if (!finalNamaBarang || !form.value.department || !form.value.tgl_penukaran) {
            showToast("Mohon lengkapi kolom yang wajib diisi!", "error");
            return;
        }

        if (isDateRangeRequired.value && (!form.value.tgl_awal_pakai || !form.value.tgl_akhir_pakai)) {
            showToast("Untuk item JARUM, Tanggal Awal & Akhir Pakai WAJIB diisi!", "error");
            return;
        }

        if (isDateRangeRequired.value && new Date(form.value.tgl_awal_pakai) > new Date(form.value.tgl_akhir_pakai)) {
            showToast("Tanggal akhir pakai harus lebih besar dari tanggal awal", "error");
            return;
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

            let response;

            if (isEditing.value) {
                response = await supabaseClient
                    .from("scrap_monitoring")
                    .update(payload)
                    .eq("id", currentEditId.value);
            } else {
                response = await supabaseClient
                    .from("scrap_monitoring")
                    .insert(payload);
            }

            if (response.error) {
                throw response.error;
            }

            showToast(isEditing.value ? "Data scrap berhasil diperbarui" : "Data scrap berhasil disimpan", "success");
            resetForm();
            await loadScrapData();
        } catch (err) {
            console.error("SCRAP ERROR:", err);
            showToast(err.message || "Terjadi kesalahan saat menyimpan data", "error");
        } finally {
            loading.value = false;
        }
    };

    const editRow = (row) => {
        isEditing.value = true;
        currentEditId.value = row.id;

        const namaBarangUpper = row.nama_barang ? row.nama_barang.toUpperCase() : "";

        if (["JARUM", "CUTTING BOARD", "PANTEX"].includes(namaBarangUpper)) {
            if (namaBarangUpper === "JARUM") selectedItemType.value = "Jarum";
            if (namaBarangUpper === "CUTTING BOARD") selectedItemType.value = "Cutting Board";
            if (namaBarangUpper === "PANTEX") selectedItemType.value = "Pantex";

            form.value.nama_barang = "";
        } else {
            selectedItemType.value = "Input Manual";
            form.value.nama_barang = row.nama_barang;
        }

        form.value.tgl_awal_pakai = row.tgl_awal_pakai || "";
        form.value.tgl_akhir_pakai = row.tgl_akhir_pakai || "";
        form.value.tgl_penukaran = row.tgl_penukaran || "";
        form.value.department = row.department;
        form.value.qty = Number(row.qty);
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
            qty: ""
        };
    };

    const summary = computed(() => {
        const totalRecords = filteredScrapList.value.length;
        const totalQty = filteredScrapList.value.reduce((sum, item) => sum + Number(item.qty || 0), 0);

        const deptMap = {};
        filteredScrapList.value.forEach(item => {
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

    const resetFilters = () => {
        searchQuery.value = "";
        filterDept.value = "";
        filterStartDate.value = "";
        filterEndDate.value = "";
    };

    const exportScrapExcelHandler = () => {

        exportScrapExcel({
            data: filteredScrapList.value,
            summary: summary.value,
            filterStartDate: filterStartDate.value,
            filterEndDate: filterEndDate.value,
            showToast
        });

    };




    return {
        form, scrapList, filteredScrapList, departments, loading, summary, itemOptions, selectedItemType, isDateRangeRequired, isFormInvalid, isEditing,
        searchQuery, filterDept, filterStartDate, filterEndDate, resetFilters,
        loadScrapData, submitScrap, editRow, deleteRow, cancelEdit: resetForm, exportScrapExcel: exportScrapExcelHandler
    };
}
