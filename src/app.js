import { supabaseClient } from "./api/supabase.js";
import { callAPI } from "./api/gas.js";

import { useAuth } from "./composables/useAuth.js";
import { useUsers } from "./composables/useUsers.js";

import { useInventory } from "./composables/useInventory.js";
import { searchInventory } from "./services/inventoryService.js";

import { useScrapMonitoring } from "./composables/useScrapMonitoring.js";

import { fixDriveUrl } from "./utils/imageUtils.js";
import { useUploadPhoto } from "./composables/useUploadPhoto.js";
import { useCamera } from "./composables/useCamera.js";

import { useTransaction } from "./composables/useTransaction.js";
import { useImportTx } from "./composables/useImportTx.js";
import { useScanner } from "./composables/useScanner.js";
import { processTransaction } from "./services/transactionService.js";
import { isStockInsufficient, getMasterStock } from "./utils/inventoryHelper.js";
import { validateRows } from "./utils/validator.js";
import { cleanKode } from "./utils/cleaner.js";
import { useCancelTransaction } from "./composables/useCancelTransaction.js";

import { useSafeFetch } from "./composables/useSafeFetch.js";
import { useAnalytics } from "./composables/useAnalytics.js";
import { useOpname } from "./composables/useOpname.js";
import { useDashboard } from "./composables/useDashboard.js";

const { createApp, ref, computed, onMounted, watch, reactive, nextTick } = Vue;

createApp({
    setup() {
        const ROLE_LANDING_PAGE = {
            ADMIN: 'dashboard',
            STAFF: 'dashboard',
            MANAGER: 'dashboard',
            VIEWER: 'inventory'
        };
        const isLoggedIn = ref(false);
        const loading = ref(false);
        const page = ref('dashboard');
        const sidebarOpen = ref(false);
        const toast = ref({ show: false, message: '', type: 'success' });
        const showToast = (msg, type) => {
            toast.value = { show: true, message: msg, type: type };
            setTimeout(() => { toast.value.show = false; }, 3000);
        };

        const showUserModal = ref(false);

        const loginData = ref({ username: '', password: '' });
        const userData = ref({ username: '', nama: '', role: '', canPreviewPhoto: false });
        const isAdminView = ref(false);


        const newUser = reactive({ nama: '', username: '', password: '', role: 'VIEWER' });
        const showRegisterModal = ref(false);
        const regData = ref({ nama: '', username: '', password: '' });
        const showProfileModal = ref(false);
        const loadingProfile = ref(false);
        const profileForm = reactive({ nama: '', password: '' });


        const lastQuery = ref('');
        const searchCache = ref({});
        const isExporting = ref(false);

        const serverResults = ref([]);
        const isServerMode = ref(false);
        const selectedRow = ref(null);

        const isCameraActive = ref(false);
        const videoFeed = ref(null);

        const historySearch = ref('');

        const showLowStock = ref(false);
        const summarySppItems = ref([]);
        const catatanSpp = ref([]);
        const inputKodeManual = ref('');
        const noSPP = ref("SPT-" + new Date().getTime());
        const sppSign = ref({
            pembuat: 'Viky',
            pemeriksa: 'Yohanes',
            diketahui: 'Sudaryanto',
            disetujui: 'Asyiriah'
        });

        const previewImage = ref(null);
        const showImportMode = ref(false);

        const showImport = ref(false);
        const csvPreview = ref([]);
        const showPreview = ref(false);

        const reservasiItems = ref([]);
        const showPopupDetail = ref(false);
        const selectedItem = ref(null);
        const formInput = reactive({
            qty: 1,
            noMesin: '',
            keterangan: ''
        });
        const txTanggal = ref(new Date().toISOString().substr(0, 10));
        const itemsPerPage = 10;
        const docNumber = ref('');
        const txReservasi = ref('');

        const qtyInputRef = ref(null);
        const searchInputRef = ref(null);

        const isRefreshing = ref(false);
        const pivotRawTx = ref([]);

        const showItemModal = ref(false);
        const isEditMode = ref(false);
        const formItem = ref({
            kode: '',
            nama: '',
            satuan: '',
            lokasi: '',
            category: '',
            foto: '',
            min_stok: 0,
            status: 'AKTIF'
        });
        const showLocationModal = ref(false);
        const locationForm = ref({ kode: '', nama: '', foto: '', lokasi: '' });

        const fileInput = ref(null);
        const isUploading = ref(false);
        const showPhotoModal = ref(false);
        let streamInstance = null;

        const userRole = ref('ADMIN');

        const sortKey = ref('');
        const sortOrder = ref(1);
        const showPass = ref(false);
        const showPassword = ref(false);
        const showScanner = ref(false);
        let html5QrCode = null;
        let isScanning = false;
        let searchTimer = null;

        const navigate = (target) => {
            page.value = target
            sidebarOpen.value = false
        };

        const openUserModal = () => {
            newUser.nama = '';
            newUser.username = '';
            newUser.password = '';
            newUser.role = 'VIEWER';
            showUserModal.value = true;
        };

        const closeUserModal = () => {
            showUserModal.value = false;
        };

        const openEditProfile = () => {
            showPass.value = false;

            profileForm.nama = userData.value.nama;
            profileForm.password = "";

            showProfileModal.value = true;
        };

        const openAddModal = () => {
            isEditMode.value = false;
            formItem.value = { kode: '', nama: '', satuan: '', lokasi: '', category: '', foto: '', min_stok: 0, status: 'AKTIF' };
            showItemModal.value = true;
        };

        const editItem = (item) => {
            isEditMode.value = true;
            formItem.value = {
                kode: item.kode || '',
                nama: item.nama || '',
                satuan: item.satuan || '',
                lokasi: item.lokasi || '',
                category: item.category || '',
                min_stok: item.min_stok || 0,
                foto: item.foto || '',
                status: item.status || 'AKTIF'
            };
            showItemModal.value = true;
        };

        const openUpdateLocation = (item) => {
            locationForm.value = {
                kode: item.kode,
                nama: item.nama,
                lokasi: item.lokasi
            };
            showLocationModal.value = true;
        };

        const paginatedItems = computed(() => {
            const items = reservasiItems.value || [];

            const pages = [];
            for (let i = 0; i < items.length; i += itemsPerPage) {
                pages.push(items.slice(i, i + itemsPerPage));
            }

            return pages.length ? pages : [[]];
        });

        const reservasiMeta = reactive({
            department: userData.value?.department || '',
            tanggal: new Date().toISOString().substr(0, 10) // Default tanggal hari ini (YYYY-MM-DD)
        });

        const bukaPopUpReservasi = (item) => {
            selectedItem.value = item;
            // Reset form ke default
            formInput.qty = 1;
            formInput.noMesin = '';
            formInput.keterangan = '';
            showPopupDetail.value = true;
        };

        const tambahkanKeForm = () => {
            const item = selectedItem.value;
            const exist = reservasiItems.value.find(i => i.kode === item.kode);

            if (exist) {
                // Jika barang sudah ada di list, update nilainya
                exist.qty += formInput.qty;
                showToast(`Jumlah ${item.nama} berhasil diperbarui`, 'success');
            } else {
                // Jika belum ada, push data baru
                reservasiItems.value.push({
                    kode: item.kode,
                    nama: item.nama,
                    satuan: item.satuan,
                    qty: formInput.qty,
                    noMesin: formInput.noMesin.toUpperCase(),
                    keterangan: formInput.keterangan
                });
                showToast("Berhasil ditambahkan ke form permintaan", 'success');
            }

            showPopupDetail.value = false;
        };

        const handlePrint = () => {
            if (reservasiItems.value.length === 0) {
                alert("Daftar permintaan masih kosong!");
                return;
            }
            window.print();
        };

        const chunkedSppItems = computed(() => {
            const chunks = [];
            const items = summarySppItems.value || [];

            for (let i = 0; i < items.length; i += 17) {
                chunks.push(items.slice(i, i + 17));
            }

            return chunks.length ? chunks : [[]];
        });

        const tambahSemuaKeSpp = () => {
            if (lowStockItems.value.length === 0) {
                showToast("Tidak ada item untuk ditambahkan", "warning");
                return;
            }

            let count = 0;
            let duplicateCount = 0;

            lowStockItems.value.forEach(item => {
                const exists = summarySppItems.value.find(s => s.kode === item.kode);

                if (!exists) {
                    const stokSekarang = Number(item.stok || 0);
                    const batasMinimal = Number(item.min_stok || 0);

                    let saranQty = (batasMinimal * 2) - stokSekarang;
                    if (saranQty <= 0) saranQty = 1;

                    summarySppItems.value.push({
                        kode: item.kode,
                        nama: item.nama,
                        satuan: item.satuan,
                        stok: stokSekarang,
                        qtyDiminta: saranQty,
                        jmlPakai: usageMap.value[item.kode] || 0,
                        keterangan: ''
                    });

                    count++;
                } else {
                    duplicateCount++;
                }
            });

            if (count > 0) {
                showToast(`Berhasil menambah ${count} item ke SPP`, "success");
                showLowStock.value = false;
                page.value = 'spp';
            } else if (duplicateCount > 0) {
                showToast("Semua item sudah ada di dalam list SPP", "info");
            }
        };

        const tambahItemManualByKode = () => {
            const kodeCari = inputKodeManual.value.trim().toUpperCase();
            if (!kodeCari) return;

            const masterItem = pivotData.value.find(i => i.kode.toUpperCase() === kodeCari);

            if (masterItem) {
                const exists = summarySppItems.value.find(s => s.kode === masterItem.kode);

                if (exists) {
                    showToast("Barang ini sudah ada di dalam list SPP!");
                    inputKodeManual.value = '';
                    return;
                }

                const stokSekarang = Number(masterItem.closing || 0);
                const batasMinimal = Number(masterItem.min_stok || 0);

                let saranQty = (batasMinimal * 2) - stokSekarang;
                if (saranQty <= 0) saranQty = 1;

                summarySppItems.value.push({
                    kode: masterItem.kode,
                    nama: masterItem.nama,
                    satuan: masterItem.satuan || 'Pcs',
                    stok: stokSekarang,
                    qtyDiminta: saranQty,
                    jmlPakai: usageMap.value[masterItem.kode] || 0,
                    keterangan: ''
                });

                inputKodeManual.value = '';
            } else {
                showToast("Kode tidak ditemukan di data pivot!");
            }
        };

        const removeItemSpp = (actualIndex) => {
            summarySppItems.value.splice(actualIndex, 1);
        };

        const kosongkanSpp = () => {
            const konfirmasi = confirm("Apakah Anda yakin ingin menghapus semua daftar item di SPP ini?");
            if (konfirmasi) {
                summarySppItems.value = [];
                inputKodeManual.value = "";

                if (typeof catatanSpp !== 'undefined') {
                    catatanSpp.value = "";
                }
            }
        };




        // MIGRASI KE SUPABASE
        const {
            adminUsers, isSubmitting, userSearchQuery, filteredAdminUsers,
            pendingUsers, loadUsers, submitNewUser, handleDeleteUser,
            toggleUser, handleUpdateUserRole, approveWithRole, handleTogglePhotoAccess
        } = useUsers({ userData, loading, showToast, closeUserModal });

        ///====AUTH====///
        const {
            handleLogin, handleRegister, handleUpdateProfile, refreshSession, handleLogout
        } = useAuth({
            loading, loadingProfile, userData, isLoggedIn, page, showToast, refreshAllData, ROLE_LANDING_PAGE
        });

        ///===INVENTORY===///
        const inventory = useInventory({
            showToast,
            userRole,
        });

        const saveItem = async () => {
            try {
                await inventory.saveItem(formItem.value);
                showItemModal.value = false;
            } catch (err) {
                console.error(err);
            }
        };

        const saveNewLocation = async () => {
            try {
                await inventory.saveNewLocation({
                    kode: locationForm.value.kode,
                    lokasi: locationForm.value.lokasi
                });
                showLocationModal.value = false;
            } catch (err) {
                console.error(err);
            }
        };

        const toggleStatus = async (item) => {
            try {
                await inventory.toggleStatus(item);
            } catch (err) {
                console.error("APP TOGGLE STATUS ERROR:", err);
            }
        };

        const {
            inventory: inventoryData,
            isInventoryReady,
            isSearching,
            inventorySearch,
            filterLocation,
            categoryFilter,
            stockFilter,
            loadInventory,
            handleSearch,
            resetAllFilters,
            sortBy,
            hasMore,
            finalInventory,
            publicInventory,
            categoryOptions,
            uniqueLocations,
            getExportInventory
        } = inventory;

        watch(inventorySearch, (newVal) => {
            clearTimeout(searchTimer);

            // Tunggu 500ms setelah ketikan terakhir sebelum menembak ke server
            searchTimer = setTimeout(() => {
                inventory.handleSearch(newVal);
            }, 500);
        });

        const startScanner = () => {
            showScanner.value = true;

            nextTick(() => {
                const readerElement = document.getElementById('reader');
                if (!readerElement) return;

                if (html5QrCode) html5QrCode.clear();

                html5QrCode = new Html5Qrcode("reader");

                html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        qrbox: { width: 250, height: 150 }
                    },
                    (decodedText) => {
                        inventorySearch.value = decodedText.trim();
                        stopScanner();
                        if (navigator.vibrate) navigator.vibrate(100);
                    }
                ).catch(() => {
                    showScanner.value = false;
                });
            });
        };

        const stopScanner = async () => {
            if (html5QrCode) {
                try {
                    if (html5QrCode.isScanning) {
                        await html5QrCode.stop();
                    }
                    html5QrCode.clear();
                } catch (err) {
                    console.warn(err);
                }
            }
            showScanner.value = false;
        };

        const handleTableScroll = (event) => {
            const { scrollTop, scrollHeight, clientHeight } = event.target;

            // Jika sisa scroll kurang dari 100px, muat data baru
            if (scrollHeight - scrollTop <= clientHeight + 100) {
                if (!inventory.isServerMode.value) { // Jangan paginate jika sedang mode pencarian server
                    inventory.loadInventory();
                }
            }
        };

        //===TRANSAKSI===//
        const tx = useTransaction(inventory, userData, showToast, {
            refreshInventory: async () => {
                await inventory.loadInventory(true);
            },
            refreshDashboard: refreshAllData,
            qtyInputRef,
            searchInputRef,
            loading
        });

        const importer = useImportTx(inventory, async (rows) => {
            await processTransaction({
                cart: rows.map(r => ({
                    ...r,
                    jenis: r.jenis || "KELUAR",
                    dept: r.dept || "-",
                    keterangan: r.keterangan || "-"
                })),
                username: userData.value.nama,
                mode: "STRICT"
            });
            await inventory.loadInventory();
        });

        const scanner = useScanner(async (txt) => {
            const query = cleanKode(txt);
            let item = inventory.inventory.value.find(i => cleanKode(i.kode) === query);

            if (!item) {
                try {
                    const results = await searchInventory(query, false);
                    item = results.find(i => cleanKode(i.kode) === query);
                } catch (err) {
                    console.error(err);
                }
            }

            if (!item) return showToast("Item tidak ditemukan", "error");
            if (item.status !== "AKTIF") return showToast("Barang NONAKTIF", "error");

            tx.addToCartWithQty(item);

            nextTick(() => {
                setTimeout(() => qtyInputRef.value?.focus(), 150);
            });
        });

        const openScanner = async () => {
            scannerActive.value = true;
            await nextTick();
            const el = document.getElementById("reader");
            if (!el) return;
            await scanner.start();
        };

        const closeScanner = async () => {
            await scanner.stop();
            scannerActive.value = false;
        };

        const {
            cart, processing, searchQuery, searchResults, showCart,
            txType, txDept, txNote, inputQty, isSearchingServer, getMasterStockUI,
            addToCart, addToCartWithQty, removeFromCart, isStockInsufficientUI,
            processTx, resetTransactionForm
        } = tx;

        const importLoading = importer.loading;
        const previewData = importer.preview;
        const pasteData = ref("");
        const resetImport = importer.reset;
        const scannerActive = ref(false);

        const handleCSVUpload = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await importer.handleFile(file);
        };

        const parsePaste = async () => {
            try {
                await importer.handlePaste(pasteData.value);
            } catch (err) {
                showToast(err.message, "error");
            }
        };

        const submitImport = async () => {
            try {
                await importer.submit();
                showToast("Import sukses", "success");
                pasteData.value = "";
                await inventory.loadInventory(true);
            } catch (err) {
                showToast(err.message, "error");
            }
        };

        const handleScan = async () => {
            const rawQuery = searchQuery.value;
            const query = cleanKode(rawQuery);

            if (!query) return;

            let item = inventory.inventory.value.find(i =>
                i.status === 'AKTIF' && cleanKode(i.kode) === query
            );

            if (!item) {
                try {
                    const results = await searchInventory(rawQuery, false);
                    item = results.find(i => cleanKode(i.kode) === query && i.status === 'AKTIF');
                } catch (err) {
                    console.error("Search server error:", err);
                }
            }

            if (!item) {
                showToast("Barang tidak ditemukan atau Nonaktif", "error");
                searchQuery.value = "";
                return;
            }

            addToCartWithQty(item);
            searchQuery.value = "";

            nextTick(() => {
                setTimeout(() => {
                    qtyInputRef.value?.focus();
                    qtyInputRef.value?.select?.();
                }, 150);
            });
        };

        const focusSearch = () => {
            searchInputRef.value?.focus();
        };

        const isDeptValid = computed(() => {
            if (txType.value === 'OPNAME') return true;
            const depts = (typeof departments !== 'undefined' ? departments.value : []) || [];
            return depts.map(d => String(d).toLowerCase())
                .includes(String(txDept.value || '').trim().toLowerCase());
        });

        const revalidatePreview = async () => {
            previewData.value = await validateRows(previewData.value, inventory.inventory.value);
        };

        async function refreshAllData() {
            if (isRefreshing.value) return;
            isRefreshing.value = true;
            try {
                await Promise.allSettled([
                    loadInventory(),
                    loadUsers(),
                    fetchDashboardAll()
                ]);
            } finally {
                isRefreshing.value = false;
            }
        }

        ///===DASHBOARD===///
        const { safeFetch } = useSafeFetch(showToast);

        const analytics = useAnalytics(safeFetch);

        const opname = useOpname();

        const dashboard = useDashboard(safeFetch, searchQuery);

        const {
            recentTx, dashData, dashboardTx, lowStockItems, departments,
            dashFilter, loadLowStock, loadDepartments, exportHistory,
            loadHistory, fetchDashboardAll, resetFilter, filteredHistory
        } = dashboard;

        const { pivotData, filter: analyticsFilter, isLoading: isPivotLoading, isPivotLoaded, loadPivot } = analytics;
        const { opnameDetail, loadingOpname, showOpnameModal, loadOpnameDetail } = opname;

        const usageMap = computed(() => {
            if (!pivotData.value || pivotData.value.length === 0) return {};
            return pivotData.value.reduce((acc, item) => {
                acc[item.kode] = item.keluar;
                return acc;
            }, {});
        });


        ///===CANCEL TRANSAKSI===///
        const {
            cancellingId,
            handleCancelTx,
            isVoided
        } = useCancelTransaction({
            refreshHistory: loadHistory,
            refreshInventory: inventory.loadInventory,
            showToast
        });



        //===Photo Sparepart===//
        const {
            startCamera,
            stopCamera: stopCameraCore,
            takeSnapshot: takeSnapshotCore
        } = useCamera(videoFeed);

        const { uploadPhoto, uploadBase64Photo, handleFileUpload } = useUploadPhoto({
            isUploading,
            formItem,
            loadInventory,
            showToast
        });

        const launchGallery = () => {
            if (fileInput.value) {
                fileInput.value.click();
            }
        };

        const closeModal = () => {
            if (isCameraActive.value) stopCamera();
            isUploading.value = false;
            showItemModal.value = false;
        };

        const removePhoto = () => {
            if (confirm("Hapus foto produk ini?")) {
                formItem.value.foto = null;
            }
        };

        const openUpdateFoto = (item) => {
            formItem.value = {
                kode: item.kode,
                nama: item.nama,
                foto: item.foto
            };
            showPhotoModal.value = true;
        };

        const closePhotoModal = () => {
            stopCamera();
            showPhotoModal.value = false;
            loading.value = false;
        };

        const savePhotoOnly = async () => {
            try {
                await loadInventory();
                showToast("Foto berhasil disimpan", "success");
                showPhotoModal.value = false;
            } catch (err) {
                showToast(err.message, "error");
            }
        };

        const handleTakePhoto = async () => {
            const base64 = takeSnapshot();

            if (!base64) {
                showToast("Kamera belum siap", "error");
                return;
            }

            isUploading.value = true;

            try {
                const url = await uploadBase64Photo(base64, formItem.value.kode);

                formItem.value.foto = url;

                stopCamera();
                isCameraActive.value = false;
                await nextTick();

                showToast("Foto berhasil diambil", "success");

            } catch (err) {
                showToast(err.message, "error");
            } finally {
                isUploading.value = false;
            }
        };

        const startLiveCamera = async () => {
            isCameraActive.value = true;

            await nextTick();

            await new Promise(r => setTimeout(r, 200));

            try {
                await startCamera();
            } catch (err) {
                showToast("Gagal membuka kamera", "error");
                isCameraActive.value = false;
            }
        };

        const stopCamera = () => {
            stopCameraCore();
            isCameraActive.value = false;

            if (videoFeed.value) {
                videoFeed.value.srcObject = null;
            }
        };

        const takeSnapshot = () => {
            return takeSnapshotCore();
        };

        const scrap = useScrapMonitoring({
            supabaseClient,
            userData: userData,
            showToast: showToast
        });





        ///===ACCESSORIS===///
        const downloadSPPPDF = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            const totalPages = chunkedSppItems.value.length;

            chunkedSppItems.value.forEach((pageItems, index) => {
                if (index > 0) doc.addPage();

                // --- 1. HEADER SECTION ---
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.text("PT BINTANG INDOKARYA GEMILANG", 15, 15);

                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.text("Jl. Raya Cendrawasih No. 6 KM.20 Tengguli, Kec. Tanjung", 15, 20);
                doc.text("Brebes - Jawa Tengah", 15, 23);

                // Judul Tengah
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                const title = "SURAT PERMOHONAN PEMBELIAN";
                const titleWidth = doc.getTextWidth(title);
                const centerX = 148.5;

                doc.text(title, centerX, 25, { align: 'center' });
                doc.setLineWidth(0.5);
                doc.line(centerX - (titleWidth / 2), 26.5, centerX + (titleWidth / 2), 26.5);

                const boxX = 220;
                const boxY = 10;
                const labelX = 223;
                const valueX = 245;

                doc.setFontSize(8);
                doc.setLineWidth(0.2);
                doc.rect(boxX, boxY, 65, 18);

                doc.setFont("helvetica", "bold");

                // Baris 1: No SPP
                doc.text("No. Internal", labelX, 15);
                doc.text(":", valueX, 15);
                doc.text(noSPP.value, valueX + 2, 15);

                // Baris 2: Tanggal
                doc.text("Tanggal", labelX, 20);
                doc.text(":", valueX, 20);
                doc.text(`${new Date().toLocaleDateString('id-ID')}`, valueX + 2, 20);

                // Baris 3: Dept
                doc.text("Department", labelX, 25);
                doc.text(":", valueX, 25);
                doc.text("SPAREPART", valueX + 2, 25);

                // --- 2. TABLE SECTION ---
                const tableData = pageItems.map((item, i) => [
                    (index * 17) + i + 1,
                    item.kode,
                    item.nama,
                    item.satuan,
                    item.qtyDiminta,
                    item.stok,
                    txTanggal.value || '-',
                    item.jmlPakai,
                    item.keterangan || '-'
                ]);

                // Tambah baris kosong jika data < 15 agar layout konsisten
                while (tableData.length < 17) {
                    tableData.push(["", "", "", "", "", "", "", "", ""]);
                }

                doc.autoTable({
                    startY: 34,
                    head: [['No', 'Kode', 'Nama & Spesifikasi Barang', 'UoM', 'Qty', 'Stock', 'Tgl Dibutuhkan', 'Jumlah Pakai', 'Keterangan']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [30, 41, 59],
                        fontSize: 8,
                        halign: 'center',
                        cellPadding: 1.5
                    },
                    styles: {
                        fontSize: 7,
                        cellPadding: 1.2,
                        valign: 'middle',
                        overflow: 'linebreak'
                    },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 23 },
                        2: { cellWidth: 'auto' }, // Nama barang fleksibel
                        3: { cellWidth: 12, halign: 'center' },
                        4: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
                        5: { cellWidth: 12, halign: 'center' },
                        6: { cellWidth: 25, halign: 'center' },
                        7: { cellWidth: 22, halign: 'center' },
                        8: { cellWidth: 32 }
                    },

                    didDrawPage: (data) => {
                        let finalY = data.cursor.y + 5;
                    }
                });

                const finalY = doc.lastAutoTable.finalY + 5;

                // --- 3. CATATAN SECTION ---
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.text("CATATAN PENDUKUNG:", 15, finalY);
                doc.rect(15, finalY + 2, 130, 25);
                doc.setFont("helvetica", "italic");
                doc.text("-", 17, finalY + 6);

                doc.setFont("helvetica", "bold");
                doc.text("REKOMENDASI :", 152, finalY);
                doc.rect(152, finalY + 2, 130, 25);

                // --- 4. SIGNATURE SECTION ---
                const signY = finalY + 34;
                const colWidth = 297 / 4;
                const signLabels = ["Dibuat Oleh,", "Diperiksa,", "Diketahui,", "Disetujui,"];
                const signNames = [
                    sppSign.value.pembuat,
                    sppSign.value.pemeriksa,
                    sppSign.value.diketahui,
                    sppSign.value.disetujui
                ];

                signLabels.forEach((label, i) => {
                    const xPos = (colWidth * i) + (colWidth / 2);

                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.text(label, xPos, signY, { align: 'center' });

                    doc.setFontSize(8);
                    doc.text(signNames[i], xPos, signY + 22, { align: 'center' });

                    const textWidth = doc.getTextWidth(signNames[i]) + 10;
                    doc.line(xPos - (textWidth / 2), signY + 18, xPos + (textWidth / 2), signY + 18);
                });

                // --- 5. FOOTER SECTION ---
                doc.setFontSize(6);
                doc.setFont("helvetica", "italic");
                doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 15, 205);
                doc.setFont("helvetica", "bold");
                doc.text(`Hal: ${index + 1} / ${totalPages}`, 282, 202, { align: 'right' });
            });

            // Simpan PDF
            doc.save(`${noSPP.value}.pdf`);
        };

        const exportExcel = () => {
            if (showLowStock.value) {
                exportLowStockExcel(); // 🔥 prioritas
            }
            else if (page.value === 'dashboard') {
                exportDashboardExcel();
            }
            else if (page.value === 'inventory' || page.value === 'master_barang') {
                exportInventoryExcel();
            }
            else if (page.value === 'riwayat') {
                exportDashboardExcel();
            }
            else {
                alert("Halaman tidak support export");
            }
        };

        const exportDashboardExcel = async () => {
            isExporting.value = true;
            try {
                const rows = await exportHistory();
                if (!rows || rows.length === 0) {
                    alert("Data kosong!");
                    return;
                }
                const timestamp = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
                const data = rows.map(tx => ({
                    "TANGGAL": tx.tanggal,
                    "USER": tx.user,
                    "KODE": tx.kode,
                    "NAMA BARANG": tx.nama,
                    "JENIS": tx.jenis,
                    "QTY": tx.qty,
                    "STOK AKHIR": tx.stokAkhir,
                    "DEPT": tx.dept || "-",
                    "KETERANGAN": tx.ket || "-"
                }));
                const ws = XLSX.utils.json_to_sheet(data, { origin: "A5" });
                XLSX.utils.sheet_add_aoa(ws, [
                    ["LAPORAN LOG AKTIVITAS"],
                    [`Tanggal Export : ${new Date().toLocaleString("id-ID")}`],
                    [`Filter : ${dashFilter.value.startDate || "-"} s/d ${dashFilter.value.endDate || "-"}`],
                    [`Total Data : ${rows.length}`]
                ], { origin: "A1" });
                ws["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 40 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Riwayat");
                XLSX.writeFile(wb, `Riwayat_${timestamp}.xlsx`);
                showToast(`Export berhasil (${rows.length} data)`, "success");
            } catch (err) {
                console.error(err);
                alert("Gagal export data");
            } finally {
                isExporting.value = false;
            }
        };

        const exportInventoryExcel = async () => {
            try {
                isExporting.value = true;
                await new Promise(resolve => setTimeout(resolve, 50));

                const exportData = await getExportInventory();
                if (!exportData.length) {
                    alert("Data kosong!");
                    return;
                }
                const timestamp = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
                const rows = [
                    ["KODE", "NAMA BARANG", "CATEGORY", "STOK", "STATUS"]
                ];
                exportData.forEach(item => {
                    rows.push([
                        item.kode,
                        item.nama,
                        item.category || "-",
                        item.stok,
                        item.stok <= item.min_stok ? "LOW" : "AMAN"
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 12 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Inventory");
                XLSX.writeFile(wb, `Inventory_${timestamp}.xlsx`);
            } catch (err) {
                console.error(err);
                alert("Gagal export excel");
            } finally {
                isExporting.value = false;
            }
        };

        const exportLowStockExcel = () => {
            if (!lowStockItems.value.length) {
                alert("Data stok kritis kosong!");
                return;
            }

            const timestamp = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');

            const data = lowStockItems.value.map(item => ({
                "KODE BARANG": item.kode,
                "NAMA BARANG": item.nama,
                "SATUAN": item.satuan,
                "STOK SAAT INI": item.stok,
                "MINIMUM STOK": item.min_stok,
                "KEKURANGAN": item.min_stok - item.stok,
                "SARAN ORDER (PR)": (item.min_stok) * 2
            }));

            const ws = XLSX.utils.json_to_sheet(data, { origin: "A5" });

            // Header ala report
            XLSX.utils.sheet_add_aoa(ws, [
                ["LAPORAN STOK KRITIS (LOW STOCK)"],
                [`Tanggal Export : ${new Date().toLocaleString('id-ID')}`],
                [`Total Item : ${lowStockItems.value.length}`],
            ], { origin: "A1" });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Low Stock");

            XLSX.writeFile(wb, `Low_Stock_${timestamp}.xlsx`);
        };

        const downloadPDF = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            const dept = (txDept.value || '-').toUpperCase();
            const tgl = txTanggal.value || '-';
            const resv = (txReservasi.value || '-').toUpperCase();
            const noDoc = docNumber.value || new Date().getTime().toString().substring(7);
            const userName = (userData.value?.nama || '............');

            const allPages = paginatedItems.value;
            if (allPages.length === 0) return;

            // Kita melompat 2 halaman sekaligus (i += 2)
            for (let i = 0; i < allPages.length; i += 2) {
                // Jika bukan lembar pertama, tambah kertas baru
                if (i > 0) doc.addPage();

                // 1. Gambar Halaman UI ke-i di posisi ATAS (Y: 10)
                drawFormToPDF(doc, allPages[i], 10, dept, tgl, resv, noDoc, i + 1, userName, allPages.length);

                // --- 2. GARIS POTONG TENGAH (Simetris di 148.5mm) ---
                doc.setDrawColor(200, 200, 200);
                doc.setLineDashPattern([2, 2], 0);
                doc.line(5, 148.5, 205, 148.5);
                doc.setLineDashPattern([], 0);
                doc.setDrawColor(0, 0, 0);

                // 2. Gambar Halaman UI ke-(i+1) di posisi BAWAH (Y: 150) jika ada
                if (allPages[i + 1]) {
                    drawFormToPDF(doc, allPages[i + 1], 158, dept, tgl, resv, noDoc, i + 2, userName, allPages.length);
                }
            }

            doc.save(`BON BPSC_${dept}_${noDoc}.pdf`);
        };

        const drawFormToPDF = (doc, items, startY, dept, tgl, resv, noDoc, pageNum, userName) => {
            // --- HEADER ---
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text("PT BINTANG INDOKARYA GEMILANG", 10, startY);

            doc.rect(170, startY - 4, 30, 6);
            doc.text(`No. Doc: #${noDoc}`, 171, startY);

            doc.setFontSize(14);
            doc.text("BUKTI PERMINTAAN SUKU CADANG", 105, startY + 8, { align: "center" });
            doc.line(10, startY + 10, 200, startY + 10);

            // --- INFO DEPT/TGL/RESV ---
            doc.setFontSize(9);
            doc.text(`DEPT: ${dept}`, 10, startY + 20);
            doc.text(`TGL: ${tgl}`, 85, startY + 20);
            doc.text(`RESV: ${resv}`, 155, startY + 20);

            // --- TABLE HEADER ---
            let currentY = startY + 25;
            const colX = [10, 35, 93, 105, 120, 135, 165, 200]; // Koordinat X tiap garis vertikal

            doc.setFillColor(240, 240, 240);
            doc.rect(10, currentY, 190, 7, 'F'); // Background Header
            doc.rect(10, currentY, 190, 7);     // Outline Header

            // Garis Vertikal Header
            colX.forEach(x => doc.line(x, currentY, x, currentY + 7));

            doc.setFontSize(7);
            doc.text("Kode", 12, currentY + 5);
            doc.text("Nama Suku Cadang", 37, currentY + 5);
            doc.text("Sat", 95, currentY + 5);
            doc.text("Qty", 108, currentY + 5);
            doc.text("Real", 124, currentY + 5);
            doc.text("No. Mesin", 137, currentY + 5);
            doc.text("Keterangan", 167, currentY + 5);

            // --- TABLE BODY ---
            doc.setFont("helvetica", "normal");

            // Gabungkan data asli + baris kosong (total 8 baris)
            const displayItems = [...items];
            while (displayItems.length < 8) {
                displayItems.push({}); // Tambah objek kosong untuk filler
            }

            displayItems.forEach((item) => {
                currentY += 7;

                // Draw Baris & Garis Vertikal (All Border)
                doc.rect(10, currentY, 190, 7);
                colX.forEach(x => doc.line(x, currentY, x, currentY + 7));

                // Isi Data (jika ada)
                if (item.kode) {
                    doc.text(String(item.kode), 11, currentY + 5);
                    doc.text(String(item.nama || '').substring(0, 32), 36, currentY + 5);
                    doc.text(String(item.satuan || ''), 94, currentY + 5);
                    doc.text(String(item.qty || '0'), 108, currentY + 5, { align: "center" });
                    // Kolom Real kosong (untuk tulis tangan)
                    doc.text(String(item.noMesin || ''), 136, currentY + 5);
                    doc.text(String(item.keterangan || '').substring(0, 20), 166, currentY + 5);
                }
            });

            // --- SIGNATURE SECTION ---
            const sigY = startY + 105;
            const roles = [
                { l: "Diminta Oleh,", n: (userName || "...............") }, // Pakai nama dari userData
                { l: "Diketahui Oleh,", n: "..............." },
                { l: "Disetujui Oleh,", n: "..............." },
                { l: "Diserahkan Oleh,", n: "..............." }
            ];

            roles.forEach((role, i) => {
                const xPos = 15 + (i * 48);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.text(role.l, xPos + 10, sigY, { align: "center" });

                // Nama User di bawah garis
                doc.text(role.n.toUpperCase(), xPos + 10, sigY + 22, { align: "center" });
                doc.line(xPos, sigY + 18, xPos + 25, sigY + 18); // Garis tanda tangan
            });

            // Footer Kecil
            doc.setFontSize(6);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(150, 150, 150);

            const footerY = startY + 132;

            doc.text(`Generated by WMS - Hal ${pageNum} / ${paginatedItems.value.length}`, 10, footerY);

            const now = new Date();
            const dateStr = now.toLocaleDateString('id-ID'); // Format: DD/MM/YYYY
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            doc.text(`Dicetak pada: ${dateStr} ${timeStr}`, 200, footerY, { align: "right" });
            doc.setTextColor(0, 0, 0);
        };


        onMounted(async () => {
            const savedUser = localStorage.getItem("wms_user");

            if (savedUser) {
                try {
                    const parsed = JSON.parse(savedUser);
                    const isExpired = Date.now() - (parsed.loginAt || 0) > 28800000;

                    if (!parsed.loginAt) {
                        parsed.loginAt = Date.now();
                        localStorage.setItem("wms_user", JSON.stringify(parsed));
                    }

                    if (isExpired) throw new Error("Session expired");

                    await refreshSession();

                    if (isLoggedIn.value) {
                        await refreshAllData();
                        if (userData.value.role === "ADMIN") {
                            await loadUsers();
                        }
                    }
                } catch (err) {
                    console.warn("Session invalid:", err.message);
                    localStorage.removeItem("wms_user");
                    isLoggedIn.value = false;
                }
            }

            setInterval(() => {
                if (isLoggedIn.value) refreshSession();
            }, 600000);

            inventory.loadInventory(true);

            const today = new Date().toISOString().split("T")[0];
            analyticsFilter.value.startDate = today;
            analyticsFilter.value.endDate = today;

            isAdminView.value = true;

            nextTick(() => {
                setTimeout(() => {
                    qtyInputRef.value?.focus();
                    qtyInputRef.value?.select?.();
                }, 200);
            });
        });

        return {
            // 1. CORE APP & AUTH STATE
            isLoggedIn, loading, isSubmitting, page, userRole, userData, loginData,
            handleLogin, handleLogout, navigate, toast, selectedRow, handleDeleteUser,

            // 2. UI & NAVIGATION STATE
            sidebarOpen, showPassword, showPass, showCart, showLowStock, showRegisterModal,
            showLocationModal, showUserModal, showProfileModal, showItemModal, showPhotoModal,
            showScanner, showPopupDetail, closeModal, closeUserModal, closePhotoModal,

            // 3. INVENTORY & MASTER DATA
            loadInventory, inventory, inventorySearch, searchQuery, stockFilter, categoryOptions, categoryFilter,
            filterLocation, uniqueLocations, resetAllFilters, sortKey, sortOrder, isInventoryReady, searchCache,
            finalInventory, isSearching, lastQuery, sortBy, handleTableScroll, getExportInventory, hasMore,
            searchInputRef, departments, fixDriveUrl, searchResults, handleSearch, publicInventory,

            // 4. ITEM CRUD & MODALS
            formItem, isEditMode, openAddModal, editItem, saveItem, toggleStatus,
            selectedItem, formInput, saveNewLocation, openUpdateLocation,

            // 5. TRANSACTION & CART (WMS)
            cart, inputQty, qtyInputRef, previewData, pasteData, tx, isSearchingServer, processing, importLoading,
            lowStockItems, txType, txDept, txNote, txTanggal, handleCSVUpload, parsePaste, submitImport, addToCartWithQty,
            resetTransactionForm, handleCancelTx, isVoided, cancellingId, showImportMode, addToCart, resetImport,
            filteredHistory, removeFromCart, processTx, revalidatePreview, isDeptValid,

            // 6. CAMERA, SCANNER & MEDIA
            isStockInsufficientUI, getMasterStockUI, isCameraActive, videoFeed, fileInput, startScanner, stopScanner, handleScan,
            openScanner, scannerActive, handleTakePhoto, scanner, importer, useTransaction, focusSearch, closeScanner, handleFileUpload,
            launchGallery, previewImage, openUpdateFoto, savePhotoOnly, startLiveCamera, stopCamera, takeSnapshot, uploadPhoto, uploadBase64Photo,
            removePhoto, isUploading, toggleUser,

            // 7. SPP (SURAT PERMOHONAN PEMBELIAN) & RESERVASI
            summarySppItems, inputKodeManual, tambahSemuaKeSpp, tambahItemManualByKode, kosongkanSpp, usageMap,
            chunkedSppItems, removeItemSpp, sppSign, noSPP, txReservasi, reservasiItems, locationForm,
            reservasiMeta, bukaPopUpReservasi, tambahkanKeForm, itemsPerPage, paginatedItems,

            // 8. USER MANAGEMENT & PROFILE
            adminUsers, filteredAdminUsers, userSearchQuery, handleUpdateUserRole, handleTogglePhotoAccess, loadUsers,
            newUser, openUserModal, submitNewUser, regData, handleRegister, pendingUsers, refreshSession,
            profileForm, loadingProfile, openEditProfile, handleUpdateProfile, approveWithRole,
            pivotData, isPivotLoaded, isPivotLoading, refreshAllData,

            // 9. UPDATE SUPABASE
            exportExcel, exportDashboardExcel, exportInventoryExcel, exportLowStockExcel, isExporting, analyticsFilter, loadPivot, safeFetch, loadHistory,
            catatanSpp, scrap, loadScrapData: scrap.loadScrapData,

            // 10. DASHBOARD & REPORTING
            dashboard, dashData, dashFilter, handlePrint, downloadPDF, historySearch, dashboardTx, recentTx, loadLowStock, exportHistory,
            loadOpnameDetail, showOpnameModal, loadingOpname, opnameDetail, resetFilter, isRefreshing, fetchDashboardAll, loadDepartments,
            downloadSPPPDF, docNumber
        };
    }
}).mount('#app');