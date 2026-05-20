const { ref, computed } = Vue;
import {
	upsertItem,
	fetchInventory,
	toggleStatusService,
	searchInventory,
	updateLocation,
	fetchAllInventory
} from "../services/inventoryService.js";

export function useInventory({ showToast, userRole }) {
	const inventory = ref([]);
	const isInventoryReady = ref(false);
	const loading = ref(false);
	const isSearching = ref(false);
	const currentPage = ref(0);
	const hasMore = ref(true);
	const pageSize = 300;

	const inventorySearch = ref("");
	const filterLocation = ref("");
	const categoryFilter = ref("all");
	const stockFilter = ref("all");

	const isServerMode = ref(false);
	const serverResults = ref([]);
	const sortKey = ref("");
	const sortOrder = ref(1);

	let lastSearchId = 0;

	const baseInventory = computed(() => {
		return isServerMode.value ? serverResults.value : inventory.value;
	});

	const loadInventory = async (isRefresh = false) => {
		if (loading.value) return;

		if (isRefresh) {
			currentPage.value = 0;
			hasMore.value = true;
			isInventoryReady.value = false;
		}

		if (!hasMore.value) return;

		loading.value = true;
		try {
			const { data, total } = await fetchInventory(currentPage.value, pageSize);

			if (isRefresh) {
				inventory.value = data;
			} else {
				inventory.value = [...inventory.value, ...data];
			}

			// Cek apakah masih ada data selanjutnya
			hasMore.value = inventory.value.length < total;
			currentPage.value++;

		} catch (err) {
			showToast("Gagal memuat data", "error");
		} finally {
			loading.value = false;
			isInventoryReady.value = true;
		}
	};

	const saveItem = async (formItem) => {
		loading.value = true;
		try {
			const data = await upsertItem(formItem);
			const index = inventory.value.findIndex(i => i.kode === data.kode);
			if (index !== -1) {
				inventory.value[index] = data;
			} else {
				inventory.value.unshift(data);
			}
			showToast("Data disimpan", "success");
			return data;
		} catch (err) {
			showToast(err.message, "error");
			throw err;
		} finally {
			loading.value = false;
		}
	};

	const saveNewLocation = async (payload) => {
		loading.value = true;
		try {
			const data = await updateLocation(payload.kode, payload.lokasi);
			const item = inventory.value.find(i => i.kode === payload.kode);
			if (item) item.lokasi = data.lokasi;
			showToast("Lokasi diperbarui", "success");
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loading.value = false;
		}
	};

	const toggleStatus = async (item) => {
		const confirmMsg = item.status === "AKTIF" ? "menonaktifkan" : "mengaktifkan";
		if (!confirm(`Yakin ingin ${confirmMsg} ${item.nama}?`)) return;
		loading.value = true;
		try {
			const newStatus = await toggleStatusService(item.kode, item.status);
			item.status = newStatus;
			showToast(`Status diperbarui`, "success");
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loading.value = false;
		}
	};

	const applyFilters = (data = [], filters = {}) => {
		return data.filter(item => {
			const text = `${item.nama || ""} ${item.kode || ""} ${item.lokasi || ""} ${item.category || ""}`.toLowerCase();

			if (filters.statusOnly && item.status !== "AKTIF") return false;

			if (filters.search && !isServerMode.value) {
				const queryWords = filters.search.toLowerCase().split(" ");
				if (!queryWords.every(q => text.includes(q))) return false;
			}

			if (filters.category && filters.category !== "all") {
				if ((item.category || "").toLowerCase() !== filters.category.toLowerCase()) return false;
			}

			if (filters.location) {
				const itemLoc = (item.lokasi || "").toLowerCase();
				if (!itemLoc.includes(filters.location.toLowerCase())) return false;
			}

			if (filters.stock === "available" && Number(item.stok || 0) <= 0) return false;
			if (filters.stock === "empty" && Number(item.stok || 0) > 0) return false;

			return true;
		});
	};

	const sortByLogic = (data) => {
		if (!sortKey.value) return data;
		return [...data].sort((a, b) => {
			let A = a[sortKey.value];
			let B = b[sortKey.value];
			if (["stok", "min_stok"].includes(sortKey.value)) {
				return (Number(A || 0) - Number(B || 0)) * sortOrder.value;
			}
			return String(A || "").localeCompare(String(B || "")) * sortOrder.value;
		});
	};

	const finalInventory = computed(() => {
		if (!isInventoryReady.value) return [];
		const filtered = applyFilters(baseInventory.value, {
			search: inventorySearch.value,
			location: filterLocation.value
		});
		return sortByLogic(filtered);
	});

	const publicInventory = computed(() => {
		// Jika sedang mencari (server mode), gunakan serverResults
		// Jika tidak, gunakan data inventory lokal yang sudah ter-load
		const sourceData = isServerMode.value ? serverResults.value : inventory.value;

		return applyFilters(sourceData, {
			statusOnly: true,
			search: inventorySearch.value,
			category: categoryFilter.value,
			stock: stockFilter.value
		});
	});

	const handleSearch = async (query) => {
		const currentId = ++lastSearchId;
		const safeQuery = String(query || "").toLowerCase().trim();

		if (!safeQuery) {
			isServerMode.value = false;
			serverResults.value = [];
			return;
		}

		isServerMode.value = true;
		isSearching.value = true;

		try {
			// Cek jika userRole bukan ADMIN, maka aktifkan filter stok > 0
			const onlyAvailable = userRole.value !== 'ADMIN';

			const data = await searchInventory(safeQuery, onlyAvailable);

			if (currentId !== lastSearchId) return;

			serverResults.value = data;
		} catch (err) {
			if (currentId === lastSearchId) serverResults.value = [];
		} finally {
			if (currentId === lastSearchId) isSearching.value = false;
		}
	};

	const sortBy = (key) => {
		if (sortKey.value === key) {
			sortOrder.value = sortOrder.value === 1 ? -1 : 1;
			if (sortOrder.value === 1) sortKey.value = "";
		} else {
			sortKey.value = key;
			sortOrder.value = 1;
		}
	};

	const resetAllFilters = () => {
		inventorySearch.value = "";
		filterLocation.value = "";
		categoryFilter.value = "all";
		stockFilter.value = "all";
		sortKey.value = "";
		sortOrder.value = 1;
		isServerMode.value = false;
		serverResults.value = [];
		loadInventory(true);
	};

	const categoryOptions = computed(() => {
		const source = inventory.value;
		return [...new Set(source.map(i => i?.category).filter(Boolean))].sort();
	});

	const uniqueLocations = computed(() => {
		const source = inventory.value;
		const areas = source
			.map(item => {
				const loc = String(item?.lokasi || "");
				return loc.includes("-") ? loc.split("-")[0].trim() : loc.trim();
			})
			.filter(Boolean);
		return [...new Set(areas)].sort();
	});

	const getExportInventory = async () => {
		try {

			const onlyAvailable = userRole.value !== 'ADMIN';

			const data = await fetchAllInventory({
				search: inventorySearch.value,
				category: categoryFilter.value,
				stock: stockFilter.value,
				location: filterLocation.value,
				onlyAvailable
			});

			return sortByLogic(data);

		} catch (err) {
			showToast("Gagal mengambil data export", "error");
			return [];
		}
	};

	return {
		inventory, isInventoryReady, loading, isSearching, inventorySearch,
		filterLocation, categoryFilter, stockFilter, finalInventory, hasMore,
		publicInventory, categoryOptions, uniqueLocations, loadInventory,
		saveItem, saveNewLocation, toggleStatus, handleSearch, sortBy, getExportInventory,
		resetAllFilters, sortKey, sortOrder, isServerMode
	};
}