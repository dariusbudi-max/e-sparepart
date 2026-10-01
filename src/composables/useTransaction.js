const { ref, computed, nextTick, unref, watch } = Vue;

import { processTransaction } from "../services/transactionService.js";
import { searchInventory } from "../services/inventoryService.js";
import { getReservasiByDocService, markReservasiFulfilledService } from "../services/reservasiService.js";
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
    const txReservasiManual = ref("");

    const serverSearchResults = ref([]);
    const isSearchingServer = ref(false);

    const activeReservasi = ref(null);
    const isProcessingReservasiScan = ref(false);

    let searchTimer = null;

    const searchResults = computed(() => {
        const q = searchQuery.value?.trim().toLowerCase();
        if (!q) return [];

        const localData = unref(inventoryRef.inventory) || [];
        const localFiltered = localData.filter(i =>
            i.status === "AKTIF" && (
                (i.kode || "").toLowerCase().includes(q) ||
                (i.nama || "").toLowerCase().includes(q)
            )
        );

        const combined = [...localFiltered];
        serverSearchResults.value.forEach(serverItem => {
            if (!combined.some(c => cleanKode(c.kode) === cleanKode(serverItem.kode))) {
                combined.push(serverItem);
            }
        });

        return combined.slice(0, 15);
    });

    const findMasterItem = (kode) => {
        const cleanK = cleanKode(kode);
        let item = (unref(inventoryRef.inventory) || []).find(i => cleanKode(i.kode) === cleanK);
        if (!item) item = serverSearchResults.value.find(i => cleanKode(i.kode) === cleanK);
        if (!item) item = cart.value.find(i => cleanKode(i.kode) === cleanK);
        return item || null;
    };

    const submitReservasiManual = async () => {
        const raw = String(txReservasiManual.value || "")
            .replace(/\r/g, "")
            .replace(/\n/g, "")
            .trim()
            .toUpperCase();

        if (!raw) {
            showToast("No. Reservasi / BPSC wajib diisi.", "error");
            return false;
        }

        if (!/^RSV-/i.test(raw)) {
            showToast("Format No. Reservasi tidak valid. Contoh: RSV-20260907-0001", "error");
            return false;
        }

        const result = await scanReservasiToCart(raw);

        if (result) {
            txReservasiManual.value = "";
        }

        return result;
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
                const result = await searchInventory(q, {
                    onlyAvailable: false,
                    stock: "all"
                });

                const results = Array.isArray(result?.data)
                    ? result.data
                    : [];

                serverSearchResults.value = results.filter(
                    i => String(i?.status || "").trim().toUpperCase() === "AKTIF"
                );

            } catch (err) {
                console.error("Search error:", err);
                serverSearchResults.value = [];
            } finally {
                isSearchingServer.value = false;
            }
        }, 400);
    });

    const TRANSACTION_TYPES = [
        "KELUAR",
        "MASUK",
        "OPNAME",
        "RETURN"
    ];

    const isValidTransactionType = (jenis) => {
        return TRANSACTION_TYPES.includes(
            String(jenis || "").trim().toUpperCase()
        );
    };

    watch(txType, (newType) => {
        const jenis = String(newType || "").trim().toUpperCase();

        if (!isValidTransactionType(jenis)) {
            txType.value = "KELUAR";
            return;
        }

        if (activeReservasi.value && jenis !== "KELUAR") {
            txType.value = "KELUAR";
            showToast("Transaksi dari BPSC hanya boleh menggunakan jenis KELUAR.", "warning");
            return;
        }

        cart.value.forEach(item => {
            if (!item.fromReservasi) {
                item.jenis = jenis;
            }
        });
    });


    const focusQty = () => {
        nextTick(() => {
            setTimeout(() => {
                deps.qtyInputRef?.value?.focus?.();
                deps.qtyInputRef?.value?.select?.();
            }, 150);
        });
    };

    const addToCartWithQty = (item, customQty = null, options = {}) => {
        const qty = parseInt(customQty ?? inputQty.value ?? 1, 10);

        if (isNaN(qty) || qty <= 0) {
            showToast("Qty tidak valid", "error");
            return false;
        }

        const fromReservasi = Boolean(options.fromReservasi);
        let jenis;

        if (fromReservasi) {
            jenis = "KELUAR";
        } else {
            jenis = String(txType.value || "KELUAR").trim().toUpperCase();

            if (!isValidTransactionType(jenis)) {
                showToast(`Jenis transaksi tidak valid: ${jenis}`, "error");
                return false;
            }
        }

        const dept = String(options.dept ?? txDept.value ?? "-").trim();
        const keterangan = String(options.keterangan ?? txNote.value ?? "-").trim();
        const cleanK = cleanKode(item.kode);
        const exist = cart.value.find(c => cleanKode(c.kode) === cleanK);

        if (fromReservasi) {
            const batasReservasi = Number(options.qtyReservasi ?? exist?.qtyReservasi ?? 0);
            const qtySekarang = Number(exist?.qty || 0);
            const qtyBaru = qtySekarang + qty;

            if (batasReservasi > 0 && qtyBaru > batasReservasi) {
                showToast(`Qty ${item.kode} melebihi reservasi. Maksimal ${batasReservasi}.`, "warning");
                return false;
            }
        }

        if (exist) {
            if (fromReservasi) {
                const existingReservasi = String(exist.reservasi_no_doc || "").trim().toUpperCase();
                const incomingReservasi = String(options.reservasi_no_doc || "").trim().toUpperCase();

                if (existingReservasi && incomingReservasi && existingReservasi !== incomingReservasi) {
                    showToast(`Barang ${item.kode} berasal dari BPSC berbeda.`, "warning");
                    return false;
                }

                showToast(`Barang ${item.kode} dari BPSC ${incomingReservasi} sudah ada di cart.`, "info");
                return false;
            }

            exist.qty += qty;
            exist.jenis = jenis;
            exist.dept = dept;
            exist.keterangan = keterangan;
        } else {
            cart.value.push({
                ...item,
                stok: Number(item.stok || 0),
                qty,
                jenis,
                dept,
                keterangan,
                fromReservasi,
                reservasi_no_doc: fromReservasi ? String(options.reservasi_no_doc || "").trim().toUpperCase() : null,
                qtyReservasi: fromReservasi ? Number(options.qtyReservasi || qty) : null
            });
        }

        searchQuery.value = "";
        inputQty.value = 1;
        showCart.value = false;

        focusQty();

        return true;
    };

    const addToCart = (item) => {
        addToCartWithQty(item);
    };

    const validateCartQty = (item) => {
        let qty = Number(item.qty || 0);
        if (!Number.isFinite(qty) || qty < 1) qty = 1;
        if (item.fromReservasi && Number(item.qtyReservasi || 0) > 0 && qty > Number(item.qtyReservasi)) {
            qty = Number(item.qtyReservasi);
            showToast(`Qty ${item.kode} dibatasi maksimal ${item.qtyReservasi} sesuai reservasi.`, "warning");
        }
        item.qty = qty;
    };

    const incrementCartQty = (item) => {
        const maxQty = Number(item.qtyReservasi || 0);
        const currentQty = Number(item.qty || 0);
        if (item.fromReservasi && maxQty > 0 && currentQty >= maxQty) {
            showToast(`Qty maksimal sesuai reservasi: ${maxQty}`, "warning");
            return;
        }
        item.qty = currentQty + 1;
    };

    const removeFromCart = (kode) => {
        const cleanK = cleanKode(kode);
        cart.value = cart.value.filter(i => cleanKode(i.kode) !== cleanK);
    };

    const scanReservasiToCart = async (code) => {
        if (isProcessingReservasiScan.value) return false;

        const rawCode = String(code ?? "")
            .replace(/\r/g, "")
            .replace(/\n/g, "")
            .trim()
            .toUpperCase();

        if (!rawCode) {
            showToast("Barcode reservasi kosong.", "error");
            return false;
        }

        if (!/^RSV-/i.test(rawCode)) {
            showToast("Barcode bukan barcode BPSC / Reservasi.", "error");
            return false;
        }

        const cartReservasiDocs = [
            ...new Set(
                cart.value
                    .map(item => String(item.reservasi_no_doc || "").trim().toUpperCase())
                    .filter(Boolean)
            )
        ];

        if (
            cartReservasiDocs.length > 0 &&
            cartReservasiDocs.some(doc => doc !== rawCode)
        ) {
            showToast(
                `Cart sudah menggunakan BPSC ${cartReservasiDocs[0]}. Satu cart hanya boleh menggunakan satu BPSC.`,
                "warning"
            );
            return false;
        }

        if (
            activeReservasi.value?.no_doc &&
            String(activeReservasi.value.no_doc).trim().toUpperCase() !== rawCode
        ) {
            showToast(
                `BPSC ${activeReservasi.value.no_doc} sedang aktif. Selesaikan transaksi terlebih dahulu sebelum scan BPSC lain.`,
                "warning"
            );
            return false;
        }

        isProcessingReservasiScan.value = true;

        try {
            const data = await getReservasiByDocService(rawCode);

            if (!data?.header) {
                showToast(`BPSC ${rawCode} tidak ditemukan.`, "error");
                return false;
            }

            const header = data.header;
            const noDoc = String(header.no_doc || rawCode).trim().toUpperCase();
            const status = String(header.status || "").trim().toUpperCase();
            const approvalLevel = Number(header.approval_level || 0);

            if (status === "FULFILLED") {
                showToast(`BPSC ${noDoc} sudah pernah diproses.`, "warning");
                return false;
            }

            if (status === "CANCELLED") {
                showToast(`BPSC ${noDoc} sudah dibatalkan.`, "error");
                return false;
            }

            if (status === "REJECTED") {
                showToast(`BPSC ${noDoc} ditolak.`, "error");
                return false;
            }

            if (status === "PENDING") {
                showToast(`BPSC ${noDoc} belum selesai approval (${approvalLevel}/3).`, "warning");
                return false;
            }

            if (!["APPROVED", "READY"].includes(status)) {
                showToast(`BPSC ${noDoc} tidak dapat diproses. Status: ${status}`, "warning");
                return false;
            }

            if (approvalLevel < 3) {
                showToast(`BPSC ${noDoc} belum mendapatkan approval lengkap (${approvalLevel}/3).`, "warning");
                return false;
            }

            const details = Array.isArray(data.details) ? data.details : [];

            if (!details.length) {
                showToast(`BPSC ${noDoc} tidak memiliki detail barang.`, "error");
                return false;
            }

            const dept = String(header.dept || "").trim().toUpperCase();

            if (!dept) {
                showToast(`Department BPSC ${noDoc} kosong.`, "error");
                return false;
            }

            if (
                activeReservasi.value?.no_doc &&
                String(activeReservasi.value.no_doc).trim().toUpperCase() === noDoc
            ) {
                showToast(`BPSC ${noDoc} sudah aktif di cart.`, "info");
                return false;
            }

            const hasNonReservasiItem = cart.value.some(item => !item.fromReservasi);

            if (hasNonReservasiItem) {
                showToast(
                    "Cart sudah berisi barang manual. Kosongkan cart terlebih dahulu sebelum scan BPSC.",
                    "warning"
                );
                return false;
            }

            activeReservasi.value = {
                id: header.id,
                no_doc: noDoc,
                dept
            };

            txType.value = "KELUAR";
            txDept.value = dept;
            txNote.value = noDoc;

            let berhasilMasuk = 0;

            for (const detail of details) {
                const kode = String(detail.barang_kode || "").trim();

                if (!kode) continue;

                const qty = Number(detail.qty || 0);

                if (!Number.isFinite(qty) || qty <= 0) {
                    showToast(`Qty ${detail.barang_nama || kode} tidak valid.`, "error");
                    continue;
                }

                let master = findMasterItem(kode);

                if (!master) {
                    try {
                        const result = await searchInventory(kode, {
                            onlyAvailable: false,
                            stock: "all"
                        });

                        const results = Array.isArray(result?.data)
                            ? result.data
                            : Array.isArray(result)
                                ? result
                                : [];

                        master = results.find(
                            item =>
                                String(item?.status || "").trim().toUpperCase() === "AKTIF" &&
                                cleanKode(item?.kode) === cleanKode(kode)
                        ) || null;
                    } catch (err) {
                        console.error("Gagal mencari inventory reservasi:", err);
                    }
                }

                if (!master) {
                    showToast(`Barang ${kode} tidak ditemukan atau Nonaktif.`, "error");
                    continue;
                }

                const detailNote = String(detail.keterangan || "").trim();
                const keterangan = detailNote ? `${noDoc} - ${detailNote}` : noDoc;
                const jenis = "KELUAR";

                const added = addToCartWithQty(
                    master,
                    qty,
                    {
                        jenis,
                        dept,
                        keterangan,
                        fromReservasi: true,
                        reservasi_no_doc: noDoc,
                        qtyReservasi: qty
                    }
                );

                if (added) {
                    berhasilMasuk++;
                }
            }

            if (berhasilMasuk === 0) {
                activeReservasi.value = null;
                showToast(`Tidak ada item BPSC ${noDoc} yang dapat dimasukkan ke cart.`, "error");
                return false;
            }

            searchQuery.value = "";
            showCart.value = true;

            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }

            showToast(`BPSC ${noDoc}: ${berhasilMasuk} item masuk ke cart.`, "success");
            return true;

        } catch (error) {
            console.error("Gagal scan reservasi:", error);
            showToast(error?.message || "Gagal mengambil data reservasi.", "error");
            return false;

        } finally {
            setTimeout(() => {
                isProcessingReservasiScan.value = false;
            }, 800);
        }
    };

    const resetTransactionForm = () => {
        cart.value = [];
        txNote.value = "";
        txDept.value = "";
        txType.value = "KELUAR";
        txReservasiManual.value = "";
        searchQuery.value = "";
        activeReservasi.value = null;
        showCart.value = false;
        focusQty();
    };

    const processTx = async () => {
        if (processing.value || loading.value) return;

        if (!cart.value.length) {
            showToast("Cart kosong", "error");
            return;
        }

        const jenisTransaksi = String(txType.value || "KELUAR").trim().toUpperCase();

        if (!isValidTransactionType(jenisTransaksi)) {
            showToast(`Jenis transaksi tidak valid: ${jenisTransaksi}`, "error");
            return;
        }

        const hasReservasi = cart.value.some(item => Boolean(item.fromReservasi));
        const hasManual = cart.value.some(item => !item.fromReservasi);

        if (hasReservasi) {
            if (jenisTransaksi !== "KELUAR") {
                showToast("Barang dari BPSC hanya boleh menggunakan jenis transaksi KELUAR.", "error");
                return;
            }

            if (hasManual) {
                showToast("Barang BPSC tidak dapat dicampur dengan barang manual. Kosongkan cart terlebih dahulu.", "warning");
                return;
            }
        }

        cart.value.forEach(item => {
            item.jenis = item.fromReservasi ? "KELUAR" : jenisTransaksi;
        });

        const invalidReservasi = cart.value.find(item => {
            if (!item.fromReservasi) return false;
            const qty = Number(item.qty || 0);
            const batas = Number(item.qtyReservasi || 0);
            return !Number.isFinite(qty) || qty <= 0 || (batas > 0 && qty > batas);
        });

        if (invalidReservasi) {
            const batas = Number(invalidReservasi.qtyReservasi || 0);
            showToast(batas > 0 ? `Qty ${invalidReservasi.kode} melebihi reservasi. Maksimal ${batas}.` : `Qty ${invalidReservasi.kode} tidak valid.`, "error");
            return;
        }

        const invalidQty = cart.value.find(item => {
            const qty = Number(item.qty || 0);
            return !Number.isFinite(qty) || qty <= 0;
        });

        if (invalidQty) {
            showToast(`Qty ${invalidQty.kode} tidak valid.`, "error");
            return;
        }

        const invalidMaster = cart.value.find(item => !findMasterItem(item.kode));

        if (invalidMaster) {
            showToast(`Barang ${invalidMaster.kode} tidak ditemukan di master inventory.`, "error");
            return;
        }

        if (jenisTransaksi === "KELUAR") {
            const invalidStock = cart.value.find(item => {
                const master = findMasterItem(item.kode);
                if (!master) return true;
                const qty = Number(item.qty || 0);
                const stok = Number(master.stok || 0);
                return qty > stok;
            });

            if (invalidStock) {
                const master = findMasterItem(invalidStock.kode);
                const sisa = Number(master?.stok || 0);
                showToast(`Stok tidak cukup: ${invalidStock.nama} (Sisa: ${sisa})`, "error");
                return;
            }
        }

        const dept = String(txDept.value || "").trim();

        if (!dept) {
            showToast("Department wajib diisi.", "error");
            return;
        }

        const reservasiDocs = [...new Set(cart.value.map(item => String(item.reservasi_no_doc || "").trim().toUpperCase()).filter(Boolean))];

        if (reservasiDocs.length > 1) {
            showToast("Transaksi tidak dapat diproses karena cart berisi lebih dari satu BPSC.", "error");
            return;
        }

        if (hasReservasi) {
            const reservasiDept = String(activeReservasi.value?.dept || "").trim();

            if (!reservasiDept) {
                showToast("Department BPSC tidak ditemukan.", "error");
                return;
            }

            txDept.value = reservasiDept;
        }

        loading.value = true;
        processing.value = true;

        try {
            await processTransaction({
                cart: cart.value,
                txType: jenisTransaksi,
                txDept: String(txDept.value || "").trim(),
                txNote: txNote.value,
                username: userData.value?.username || userData.value?.nama || "SYSTEM",
                mode: "STRICT"
            });

            if (reservasiDocs.length === 1) {
                await markReservasiFulfilledService(reservasiDocs[0], userData.value?.username || userData.value?.nama || "SYSTEM");
            }

            serverSearchResults.value = [];
            showToast(reservasiDocs.length === 1 ? "Transaksi dan realisasi BPSC berhasil." : `Transaksi ${jenisTransaksi} berhasil.`, "success");
            resetTransactionForm();

            if (inventoryRef.loadInventory) {
                await inventoryRef.loadInventory(true);
            }

            if (deps.refreshDashboard) {
                await deps.refreshDashboard();
            }
        } catch (e) {
            console.error("processTx error:", e);
            showToast(e?.message || "Transaksi gagal.", "error");
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
        if (txType.value !== "KELUAR") return false;
        const master = findMasterItem(item.kode);
        if (!master) return false;
        const qty = Number(item.qty || 0);
        const stok = Number(master.stok || 0);
        return qty > stok;
    };

    return {
        cart, loading, processing, searchQuery, searchResults, showCart,
        findMasterItem, validateCartQty, incrementCartQty, txType, txDept,
        txNote, txReservasiManual, inputQty, addToCart, addToCartWithQty,
        isStockInsufficientUI, getMasterStockUI, removeFromCart, processTx,
        resetTransactionForm, isSearchingServer, scanReservasiToCart,
        submitReservasiManual, isProcessingReservasiScan, activeReservasi
    };
};