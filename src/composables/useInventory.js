const { ref, computed, watch } = Vue;
import {
	upsertItem,
	fetchInventory,
	toggleStatusService,
	searchInventory,
	updateLocation,
	fetchAllInventory,
	fetchAllLocations,
	deleteItemService, checkExistingItemsByCodes, insertBatchInventory
} from "../services/inventoryService.js";

export function useInventory({ showToast, userRole, userData }) {
	const inventory = ref([]);
	const isInventoryReady = ref(false);
	const loading = ref(false);
	const isSearching = ref(false);
	const currentPage = ref(0);
	const hasMore = ref(true);
	const pageSize = 300;
	const currentSearchPage = ref(0);
	const hasMoreSearch = ref(true);
	const locations = ref([]);
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
				inventory.value.push(...data);
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

	const loadLocations = async () => {
		try {
			locations.value = await fetchAllLocations();
		} catch (err) {
			console.error(err);
		}
	};

	const saveItem = async (formItem, isEditMode = false) => {
		loading.value = true;
		try {
			if (!isEditMode) {
				const formattedCode = formItem.kode.trim().toUpperCase();
				const existingCodes = await checkExistingItemsByCodes([formattedCode]);

				if (existingCodes.length > 0) {
					showToast(`Kode barang "${formattedCode}" sudah terdaftar di database!`, "error");
					return null;
				}
			}

			const data = await upsertItem(formItem);
			const index = inventory.value.findIndex(i => i.kode === data.kode);

			if (index !== -1) {
				inventory.value[index] = data;
			} else {
				inventory.value.unshift(data);
			}

			if (isServerMode.value) {
				const serverIndex = serverResults.value.findIndex(i => i.kode === data.kode);
				if (serverIndex !== -1) {
					serverResults.value[serverIndex] = data;
				} else {
					serverResults.value.unshift(data);
				}
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
		if (!payload?.kode || !payload?.lokasi) {
			showToast("Data lokasi tidak valid", "error");
			return;
		}

		loading.value = true;
		try {
			const username = userData?.value?.nama || "SYSTEM";
			const data = await updateLocation(payload.kode, payload.lokasi, username);

			const item = inventory.value.find(i => i.kode === payload.kode);
			if (item) item.lokasi = data.lokasi;

			if (isServerMode.value) {
				const serverItem = serverResults.value.find(i => i.kode === payload.kode);
				if (serverItem) serverItem.lokasi = data.lokasi;
			}

			showToast("Lokasi berhasil diperbarui", "success");
		} catch (err) {
			showToast(err.message || "Gagal update lokasi", "error");
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

			const mainItem = inventory.value.find(i => i.kode === item.kode);
			if (mainItem) mainItem.status = newStatus;

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
		const sourceData = isServerMode.value ? serverResults.value : inventory.value;

		return applyFilters(sourceData, {
			statusOnly: true,
			search: inventorySearch.value,
			category: categoryFilter.value,
			location: filterLocation.value,
			stock: stockFilter.value
		});
	});

	const handleSearch = async (query, isLoadMore = false) => {
		const currentId = ++lastSearchId;
		const safeQuery = String(query || "").toLowerCase().trim();

		if (!safeQuery && !filterLocation.value && categoryFilter.value === "all" && stockFilter.value === "all") {
			isServerMode.value = false;
			serverResults.value = [];
			currentSearchPage.value = 0;
			hasMoreSearch.value = true;
			return;
		}

		isServerMode.value = true;

		if (!isLoadMore) {
			currentSearchPage.value = 0;
			hasMoreSearch.value = true;
			isSearching.value = true;
		}

		if (!hasMoreSearch.value && isLoadMore) return;

		try {
			const onlyAvailable = userRole.value !== 'ADMIN';
			const pageSize = 100;

			const { data, total } = await searchInventory(safeQuery, {
				onlyAvailable: onlyAvailable,
				stock: stockFilter.value,
				category: categoryFilter.value,
				location: filterLocation.value,
				page: currentSearchPage.value,
				pageSize: pageSize
			});

			if (currentId !== lastSearchId) return;

			if (isLoadMore) {
				serverResults.value = [...serverResults.value, ...data];
			} else {
				serverResults.value = data;
			}

			hasMoreSearch.value = serverResults.value.length < total;
			currentSearchPage.value++;

		} catch (err) {
			console.error("Search Error:", err);
			if (currentId === lastSearchId && !isLoadMore) serverResults.value = [];
		} finally {
			if (currentId === lastSearchId) isSearching.value = false;
		}
	};

	watch(
		[categoryFilter, stockFilter, filterLocation],
		() => {
			currentSearchPage.value = 0;
			hasMoreSearch.value = true;
			handleSearch(inventorySearch.value, false);
		}
	);

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

	const deleteItem = async (kode, nama) => {
		const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus data "${nama}" (${kode}) secara permanen? Tindakan ini tidak dapat dibatalkan.`);
		if (!confirmDelete) return false;

		loading.value = true;
		try {
			await deleteItemService(kode);

			inventory.value = inventory.value.filter(item => item.kode !== kode);

			if (isServerMode.value) {
				serverResults.value = serverResults.value.filter(item => item.kode !== kode);
			}

			showToast("Data barang berhasil dihapus", "success");
			return true;
		} catch (err) {
			showToast(err.message || "Gagal menghapus data", "error");
			return false;
		} finally {
			loading.value = false;
		}
	};

	const checkExistingCodes = async (kodes) => {
		try {
			return await checkExistingItemsByCodes(kodes);
		} catch (err) {
			console.error("Collision Check Error: ", err);
			throw err;
		}
	};

	const saveBatchItem = async (cleanItems) => {
		try {
			return await insertBatchInventory(cleanItems);
		} catch (err) {
			console.error("Batch Saving Error: ", err);
			throw err;
		}
	};

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
		inventory, isInventoryReady, loading, isSearching, inventorySearch, currentSearchPage, hasMoreSearch,
		filterLocation, categoryFilter, stockFilter, finalInventory, hasMore, deleteItem, checkExistingCodes, saveBatchItem,
		publicInventory, categoryOptions, locations, loadLocations, loadInventory, serverResults,
		saveItem, saveNewLocation, toggleStatus, handleSearch, sortBy, getExportInventory,
		resetAllFilters, sortKey, sortOrder, isServerMode
	};
}
