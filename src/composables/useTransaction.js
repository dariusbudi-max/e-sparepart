const { ref, computed, nextTick, unref, watch } = Vue;
import { processTransaction } from "../services/transactionService.js";
import { searchInventory } from "../services/inventoryService.js";
import { cleanKode } from "../utils/cleaner.js";

export const useTransaction = (inventoryRef, userData, showToast, deps = {}) => {
    const cart = ref([]);
    const loading = deps.loading || ref(false);
    const processing = ref(false);
    const searchQuery = ref("");
    const showCart = ref(false);
    const txType = ref("KELUAR");
    const txDept = ref("");
    const txNote = ref("");
    const inputQty = ref(1);

    const serverSearchResults = ref([]);
    const isSearchingServer = ref(false);
    let searchTimer = null;

    const searchResults = computed(() => {
        const q = searchQuery.value?.trim().toLowerCase();
        if (!q) return [];

        // 1. Ambil data yang sudah ter-load di memori (Lokal)
        const localData = unref(inventoryRef.inventory) || [];
        const localFiltered = localData.filter(i =>
            i.status === 'AKTIF' && (
                (i.kode || "").toLowerCase().includes(q) ||
                (i.nama || "").toLowerCase().includes(q)
            )
        );

        // 2. Gabungkan dengan data dari server, pastikan tidak ada duplikat kode
        const combined = [...localFiltered];

        serverSearchResults.value.forEach(serverItem => {
            if (!combined.some(c => cleanKode(c.kode) === cleanKode(serverItem.kode))) {
                combined.push(serverItem);
            }
        });

        return combined.slice(0, 15); // Ambil top 15 saja
    });

    const findMasterItem = (kode) => {
        const cleanK = cleanKode(kode);

        let item = (unref(inventoryRef.inventory) || [])
            .find(i => cleanKode(i.kode) === cleanK);

        if (!item) {
            item = serverSearchResults.value
                .find(i => cleanKode(i.kode) === cleanK);
        }

        if (!item) {
            item = cart.value
                .find(i => cleanKode(i.kode) === cleanK);
        }

        return item || null;
    };

    watch(searchQuery, (newVal) => {
        const q = newVal?.trim();
        if (!q || q.length < 2) {
            serverSearchResults.value = [];
            return;
        }

        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            isSearchingServer.value = true;
            try {
                // Gunakan service pencarian yang sudah kita buat sebelumnya
                // Khusus transaksi, ADMIN/STAFF bisa mencari semua barang AKTIF
                const results = await searchInventory(q, false);
                serverSearchResults.value = results.filter(i => i.status === 'AKTIF');
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                isSearchingServer.value = false;
            }
        }, 400); // Debounce 400ms
    });

    const focusQty = () => {
        nextTick(() => {
            setTimeout(() => {
                deps.qtyInputRef?.value?.focus?.();
                deps.qtyInputRef?.value?.select?.();
            }, 150);
        });
    };

    const addToCartWithQty = (item, customQty = null) => {
        const qty = parseInt(customQty ?? inputQty.value ?? 1, 10);

        if (isNaN(qty) || qty <= 0) {
            showToast("Qty tidak valid", "error");
            return;
        }

        const exist = cart.value.find(c => cleanKode(c.kode) === cleanKode(item.kode));
        if (exist) {
            exist.qty += qty;
        } else {
            cart.value.push({ ...item, stok: Number(item.stok || 0), qty });
        }

        searchQuery.value = "";
        inputQty.value = 1;
        showCart.value = false;
        focusQty();
    };

    const addToCart = (item) => addToCartWithQty(item);

    const removeFromCart = (kode) => {
        const cleanK = cleanKode(kode);
        cart.value = cart.value.filter(i => cleanKode(i.kode) !== cleanK);
    };

    const resetTransactionForm = () => {
        cart.value = [];
        txNote.value = "";
        txDept.value = "";
        txType.value = "KELUAR";
        searchQuery.value = "";
        showCart.value = false;
        focusQty();
    };

    const processTx = async () => {
        if (processing.value || loading.value) return;
        if (!cart.value.length) return showToast("Cart kosong", "error");

        if (txType.value === "KELUAR") {
            const invalid = cart.value.find(item => {
                const master = findMasterItem(item.kode);
                return !master || Number(item.qty || 0) > Number(master.stok || 0);
            });

            if (invalid) {
                const master = findMasterItem(invalid.kode);
                const sisa = master ? master.stok : 0;
                return showToast(`Stok tidak cukup: ${invalid.nama} (Sisa: ${sisa})`, "error");
            }
        }

        loading.value = true;
        processing.value = true;
        try {
            await processTransaction({
                cart: cart.value,
                txType: txType.value,
                txDept: txDept.value,
                txNote: txNote.value,
                username: userData.value?.nama || "SYSTEM",
                mode: "STRICT"
            });

            serverSearchResults.value = [];

            showToast("Transaksi sukses", "success");
            resetTransactionForm();
            if (inventoryRef.loadInventory) await inventoryRef.loadInventory(true);
            if (deps.refreshDashboard) await deps.refreshDashboard();
        } catch (e) {
            showToast(e.message, "error");
        } finally {
            loading.value = false;
            processing.value = false;
        }
    };

    const getMasterStockUI = (kode) => {
        const master = findMasterItem(kode);

        return Number(master?.stok || 0);
    };

    const isStockInsufficientUI = (item) => {
        if (txType.value !== 'KELUAR') return false;

        const master = findMasterItem(item.kode);

        if (!master) return false;

        const qty = Number(item.qty || 0);
        const stok = Number(master?.stok || 0);

        return qty > stok;
    };

    return {
        cart, loading, processing, searchQuery, searchResults, showCart, findMasterItem,
        txType, txDept, txNote, inputQty, addToCart, addToCartWithQty, isStockInsufficientUI,
        removeFromCart, processTx, resetTransactionForm, isSearchingServer, getMasterStockUI
    };
};