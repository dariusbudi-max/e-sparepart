const { ref, computed, watch } = Vue;
import {
    fetchCatalogFolders, createCatalogFolder, updateCatalogFolder, deleteCatalogFolderService, searchCatalogItems,
    assignItemsToFolder
} from "../services/catalogService.js";

export function useCatalog({ showToast, inventory }) {
    const folders = ref([]);
    const selectedFolderId = ref(null);
    const catalogSearch = ref("");
    const catalogItems = ref([]);
    const loading = ref(false);
    const isSearching = ref(false);
    const currentPage = ref(0);
    const hasMore = ref(true);
    const catalogScrollPosition = ref(0);
    const pageSize = 100;
    let searchTimer;

    const loadFolders = async () => {
        try {
            folders.value = await fetchCatalogFolders();
        } catch (err) {
            console.error(err);
            showToast("Gagal memuat folder katalog", "error");
        }
    };

    const loadItems = async (isLoadMore = false) => {
        if (loading.value) return;
        if (!isLoadMore) {
            currentPage.value = 0;
            hasMore.value = true;
        }
        if (!hasMore.value) return;
        loading.value = true;
        try {
            const { data, total } = await searchCatalogItems({
                folderId: selectedFolderId.value,
                search: catalogSearch.value,
                page: currentPage.value,
                pageSize
            });
            if (isLoadMore) {
                catalogItems.value.push(...data);
            } else {
                catalogItems.value = data;
            }
            hasMore.value = catalogItems.value.length < total;
            currentPage.value++;
        } finally {
            loading.value = false;
            isSearching.value = false;
        }
    };

    const loadFolderContent = async (folderId = null) => {
        selectedFolderId.value = folderId;
        currentPage.value = 0;
        hasMore.value = true;
        await loadItems(false);
    };

    const addFolder = async (nama) => {
        if (!nama?.trim()) return;

        try {
            await createCatalogFolder(nama.trim());
            await loadFolders();
            showToast("Folder berhasil dibuat", "success");
        } catch (err) {
            showToast(err.message || "Gagal membuat folder", "error");
        }
    };

    const removeFolder = async (id, nama) => {
        const confirmText = `Hapus folder "${nama}"?\n\nSemua item akan dipindahkan ke Tanpa Folder.`;
        if (!confirm(confirmText)) return;

        try {
            await deleteCatalogFolderService(id);
            folders.value = folders.value.filter(f => f.id !== id);

            inventory.inventory.value.forEach(item => {
                if (item.folder_id === id) item.folder_id = null;
            });

            inventory.serverResults.value.forEach(item => {
                if (item.folder_id === id) item.folder_id = null;
            });

            if (selectedFolderId.value === id) {
                await loadFolderContent(null);
            }

            showToast("Folder berhasil dihapus", "success");
        } catch (err) {
            showToast(err.message || "Gagal menghapus folder", "error");
        }
    };

    const moveItemsToFolder = async (kodes, targetFolderId) => {
        try {
            const result = await assignItemsToFolder(kodes, targetFolderId);
            console.log("MOVE RESULT:", result);
            inventory.inventory.value.forEach(item => {
                if (kodes.includes(item.kode)) {
                    item.folder_id = targetFolderId;
                }
            });
            inventory.serverResults.value.forEach(item => {
                if (kodes.includes(item.kode)) {
                    item.folder_id = targetFolderId;
                }
            });
            await loadFolderContent(selectedFolderId.value);
            showToast("Item berhasil dipindahkan ke folder", "success");
        } catch (err) {
            console.error("MOVE FOLDER ERROR:", err);
            showToast(err.message || "Gagal memindahkan item", "error");
        }
    };

    const activeFolderObj = computed(() => {
        return folders.value.find(f => f.id === selectedFolderId.value) || { nama: "Semua Item / Tanpa Folder" };
    });

    watch(catalogSearch, () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage.value = 0;
            hasMore.value = true;
            catalogItems.value = [];
            loadItems(false);
        }, 500);
    });

    return {
        folders, selectedFolderId,
        catalogSearch, activeFolderObj, loadFolders, loading,
        isSearching, currentPage,
        hasMore, catalogScrollPosition,
        catalogItems,
        loadItems,
        loadFolderContent, addFolder, removeFolder, moveItemsToFolder
    };
}
