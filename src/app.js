import { supabaseClient } from "./api/supabase.js";
import { callAPI } from "./api/gas.js";

import { useAuth } from "./composables/useAuth.js";
import { useUsers } from "./composables/useUsers.js";
import { useAcl } from "./composables/useAcl.js";
import { PERMISSION } from "./constants/permissions.js";
import { ACCESS_PERMISSIONS } from "./constants/accessPermissions.js";
import { canAccessPage } from "./constants/pagePermissions.js";

import { useInventory } from "./composables/useInventory.js";
import { searchInventory } from "./services/inventoryService.js";
import { fetchPhotos, deletePhoto, setCoverPhoto, updatePhotoOrder } from "./services/inventoryPhotoService.js";
import { useCatalog } from "./composables/useCatalog.js";
import { usePhotoManager } from "./composables/usePhotoManager.js";

import { useScrapMonitoring } from "./composables/useScrapMonitoring.js";

import { createWatermarkedImage } from "./utils/photoProcessor.js";
import { fixDriveUrl } from "./utils/imageUtils.js";
import { useUploadPhoto } from "./composables/useUploadPhoto.js";
import { useCamera } from "./composables/useCamera.js";
import { deleteFromDrive } from "./services/driveService.js";

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
import { exportDashboardExcel, exportInventoryExcel, exportLowStockExcel, exportOpnameExcel, exportScrapExcel } from "./exports/excelExport.js";
import { downloadSPPPDF, downloadBONPDF } from "./exports/pdfExport.js";

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
        const regData = reactive({ nama: '', username: '', password: '' });
        const showProfileModal = ref(false);
        const loadingProfile = ref(false);
        const profileForm = reactive({ nama: '', password: '' });

        const lastQuery = ref('');
        const searchCache = ref({});
        const isExporting = ref(false);

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

        const photoPreview = ref(null);
        const previewSource = ref(null);
        const showImportMode = ref(false);
        const previewGallery = ref({
            show: false,
            photos: [],
            current: 0
        });
        const photoUrlInput = ref("");
        const isDragOver = ref(false);
        const dragCounter = ref(0);

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
        const showScrapInput = ref(false);

        const isRefreshing = ref(false);
        const pivotRawTx = ref([]);

        const showItemModal = ref(false);
        const isEditMode = ref(false);
        const formItem = ref({
            kode: "",
            nama: "",
            satuan: "",
            lokasi: "",
            category: "",
            photos: [],
            selectedPhoto: null,
            min_stok: 0,
            status: "AKTIF"
        });
        const showLocationModal = ref(false);
        const locationForm = ref({ kode: '', nama: '', lokasi: '' });
        const showImportModal = ref(false);
        const importStep = ref(1);
        const rawExcelInput = ref("");
        const parsedItems = ref([]);
        const isImporting = ref(false);

        const fileInput = ref(null);
        const isUploading = ref(false);
        const showPhotoModal = ref(false);

        const userRole = ref('ADMIN');

        const showAddFolderModal = ref(false);
        const newFolderName = ref("");
        const showAssignModal = ref(false);
        const selectedItemForFolder = ref(null);
        const selectedTargetFolderId = ref("");
        const showFolderMenu = ref(false);

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
            formItem.value = { kode: '', nama: '', satuan: '', lokasi: '', category: '', photos: [], selectedPhoto: null, min_stok: 0, status: 'AKTIF' };
            showItemModal.value = true;
        };

        const editItem = (item) => {
            isEditMode.value = true;
            formItem.value = {
                kode: item.kode,
                nama: item.nama,
                satuan: item.satuan,
                lokasi: item.lokasi,
                category: item.category,
                min_stok: item.min_stok,
                status: item.status,

                photos: item.inventory_photos
                    ? [...item.inventory_photos]
                    : [],

                selectedPhoto: item.inventory_photos?.find(x => x.is_cover)
                    || item.inventory_photos?.[0]
                    || null

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
            toggleUser, handleUpdateUserRole, approveWithRole, handleTogglePermission, selectedPermissionUser,
            showPermissionModal, openPermissionModal
        } = useUsers({ userData, loading, showToast, closeUserModal });

        ///====AUTH====///
        const {
            handleLogin, handleRegister, handleUpdateProfile, refreshSession, handleLogout
        } = useAuth({
            loading, loadingProfile, userData, isLoggedIn, page, showToast, refreshAllData, ROLE_LANDING_PAGE, showRegisterModal
        });

        const acl = useAcl(userData);
        const { permissions, can, cannot, hasRole, canAny, canAll } = acl;

        const previewPhoto = (item) => {
            if (!can(PERMISSION.PHOTO_PREVIEW)) return;

            openPreviewGallery(
                item.inventory_photos || [],
                item.kode
            );
        };

        ///===INVENTORY===///
        const inventory = useInventory({
            showToast,
            userRole,
            userData
        });

        const saveItem = async () => {
            try {
                const data = await inventory.saveItem(formItem.value, isEditMode.value);

                if (!isEditMode.value && data) {
                    isEditMode.value = true;
                    formItem.value.kode = data.kode;
                    showToast("Barang berhasil dibuat. Sekarang Anda dapat menambahkan foto.", "success");
                    return;
                }

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

        const openImportExcelModal = () => {
            rawExcelInput.value = "";
            parsedItems.value = [];
            importStep.value = 1;
            isImporting.value = false;
            showImportModal.value = true;
        };

        const processExcelRawInput = async () => {
            const lines = rawExcelInput.value.split("\n");
            const temporaryList = [];

            for (let line of lines) {
                if (!line.trim()) continue;

                const columns = line.split("\t");

                const kode = columns[0] ? columns[0].trim().toUpperCase() : "";
                const nama = columns[1] ? columns[1].trim() : "";
                const category = columns[2] ? columns[2].trim().toUpperCase() : "UNSET";
                const satuan = columns[3] ? columns[3].trim().toUpperCase() : "PCS";
                const lokasi = columns[4] ? columns[4].trim().toUpperCase() : "-";

                if (kode && nama) {
                    temporaryList.push({
                        kode,
                        nama,
                        category,
                        satuan,
                        lokasi,
                        stok: 0,
                        min_stok: 0,
                        status: "AKTIF"
                    });
                }
            }

            if (temporaryList.length === 0) {
                showToast("Format data Excel tidak valid atau kosong!", "error");
                return;
            }

            try {
                inventory.loading.value = true;

                const targetKodes = temporaryList.map(item => item.kode);
                const existingKodes = await inventory.checkExistingCodes(targetKodes);

                parsedItems.value = temporaryList.map(item => ({
                    ...item,
                    isDuplicate: existingKodes.includes(item.kode)
                }));

                importStep.value = 2;
            } catch (err) {
                showToast("Gagal melakukan pengecekan data ke database", "error");
            } finally {
                inventory.loading.value = false;
            }
        };

        const validCount = computed(() => parsedItems.value.filter(i => !i.isDuplicate).length);
        const duplicateCount = computed(() => parsedItems.value.filter(i => i.isDuplicate).length);

        const executeBatchInsert = async () => {
            const dataToSave = parsedItems.value.filter(item => !item.isDuplicate);
            if (dataToSave.length === 0) return;

            isImporting.value = true;
            try {
                const cleanData = dataToSave.map(({ isDuplicate, ...rest }) => rest);
                const savedData = await inventory.saveBatchItem(cleanData);

                showToast(`Berhasil menyimpan ${savedData.length} item baru!`, "success");
                showImportModal.value = false;

                inventory.loadInventory(true);
            } catch (err) {
                showToast(err.message || "Gagal menyimpan batch import", "error");
            } finally {
                isImporting.value = false;
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
            locations,
            loadLocations,
            getExportInventory,
            deleteItem
        } = inventory;

        const handleTableScroll = async (event) => {
            const target = event.target;
            const reachedBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 150;
            if (!reachedBottom) return;

            if (page.value === "catalog_menu") {
                if (catalog.loading.value || !catalog.hasMore.value) return;
                await catalog.loadItems(true);
                return;
            }

            if (["master_barang", "inventory"].includes(page.value)) {
                if (inventory.isServerMode.value) {
                    if (inventory.loading.value || inventory.isSearching.value || !inventory.hasMoreSearch.value) return;
                    await inventory.handleSearch(inventorySearch.value, true);
                } else {
                    if (inventory.loading.value || !inventory.hasMore.value) return;
                    await inventory.loadInventory();
                }
                return;
            }
        };

        const removeItem = async (item) => {
            await inventory.deleteItem(item.kode, item.nama);
        };

        watch(inventorySearch, (newVal) => {
            clearTimeout(searchTimer);

            if (!newVal || newVal.trim() === "") {
                inventory.handleSearch(newVal);
                return;
            }

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

        const catalog = useCatalog({
            showToast,
            inventory
        });

        const getItemCoverPhoto = (item) => {
            if (item.inventory_photos && item.inventory_photos.length > 0) {
                const cover = item.inventory_photos.find(p => p.is_cover);
                return cover ? cover.photo_url : item.inventory_photos[0].photo_url;
            }
            return item.foto || "";
        };

        const handleCreateFolder = async () => {
            if (!newFolderName.value.trim()) return;
            await catalog.addFolder(newFolderName.value);
            newFolderName.value = "";
            showAddFolderModal.value = false;
        };

        const openAssignFolderModal = (item) => {
            selectedItemForFolder.value = item;
            selectedTargetFolderId.value = item.folder_id || "";
            showAssignModal.value = true;
        };

        const executeAssignFolder = async () => {
            if (!selectedItemForFolder.value) return;
            const target = selectedTargetFolderId.value === "" ? null : selectedTargetFolderId.value;
            await catalog.moveItemsToFolder([selectedItemForFolder.value.kode], target);
            showAssignModal.value = false;
        };

        const openCatalogMenu = async () => {
            page.value = "catalog_menu";
            await catalog.loadFolders();
            if (catalog.catalogItems.value.length === 0) {
                await catalog.loadFolderContent(null);
            }
        };

        watch(page, async (newPage) => {
            if (newPage !== "catalog_menu") return;

            await catalog.loadFolders();
            await catalog.loadFolderContent(
                catalog.activeFolderId?.value || null,
                true
            );
        });



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
                    const { data = [] } = await searchInventory(query);

                    item = data.find(
                        i => cleanKode(i.kode) === query
                    );
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
                    const { data = [] } = await searchInventory(rawQuery);

                    item = data.find(
                        i =>
                            cleanKode(i.kode) === query &&
                            i.status === "AKTIF"
                    );
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
        const { opnameDetail, filteredOpnameDetail, loadingOpname, showOpnameModal, loadOpnameDetail } = opname;

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
            stopCamera: stopCameraCore
        } = useCamera(videoFeed);

        const {
            saveUploadedPhoto,
            readFilePreview,
            refreshPhotoList
        } = useUploadPhoto({
            isUploading,
            formItem,
            loadInventory: inventory.loadInventory,
            showToast
        });

        const {
            canUploadPhoto, launchGallery, handleGallerySelected, handleUrlSelected,
            handleTakePhoto, removePhoto, openUpdateFoto, processImageFile,
            handleDrop, handleDragOver, handleDragEnter, handleDragLeave,
            confirmAndUploadPhoto, refreshPhotos, resetPhotoState, closePhotoModal,
            closeModal, cancelPreview, startLiveCamera, stopCamera,
            selectPhoto, makeCover, openPreviewGallery, closePreviewGallery,
            nextPreview, prevPreview, currentPreviewPhoto
        } = usePhotoManager({
            Vue, videoFeed, fileInput, photoPreview,
            previewSource, photoUrlInput, formItem, showPhotoModal, showItemModal,
            isEditMode, isUploading, isCameraActive, dragCounter, isDragOver, previewGallery,
            inventory, catalog, showToast, createWatermarkedImage, fixDriveUrl, readFilePreview, saveUploadedPhoto, refreshPhotoList,
            fetchPhotos, deletePhoto, deleteFromDrive, setCoverPhoto, startCamera, stopCameraCore
        });

        const scrap = useScrapMonitoring({
            supabaseClient,
            userData: userData,
            showToast: showToast
        });

        watch(page, (newPage) => {
            const saved = localStorage.getItem("wms_user");

            if (!saved) return;

            const parsed = JSON.parse(saved);

            localStorage.setItem(
                "wms_user",
                JSON.stringify({
                    ...parsed,
                    page: newPage
                })
            );
        });


        ///===ACCESSORIS===///
        const exportExcel = async () => {
            try {
                isExporting.value = true;
                if (showOpnameModal.value) {
                    return exportOpnameExcel({
                        data: filteredOpnameDetail.value,
                        showToast
                    });
                }
                if (showLowStock.value) {
                    return exportLowStockExcel({
                        data: lowStockItems.value
                    });
                }
                if (page.value === "dashboard" || page.value === "riwayat") {
                    if (!can(PERMISSION.EXPORT_EXCEL)) {
                        showToast("Anda tidak memiliki akses export", "error");
                        return;
                    }

                    return await exportDashboardExcel({
                        exportHistory,
                        dashFilter: dashFilter.value,
                        showToast
                    });
                }
                if (page.value === "inventory" || page.value === "master_barang") {
                    return await exportInventoryExcel({
                        getExportInventory
                    });
                }
                if (page.value === "scrap_monitoring") {
                    const params = await scrap.exportScrapExcel();
                    return scrap.exportScrapExcel();
                }
                alert("Halaman tidak support export");
            } catch (err) {
                console.error(err);
                alert("Gagal export Excel");
            } finally {
                isExporting.value = false;
            }
        };

        const exportSPP = () => {
            downloadSPPPDF({
                chunkedSppItems: chunkedSppItems.value,
                noSPP: noSPP.value,
                txTanggal: txTanggal.value,
                sppSign: sppSign.value
            });
        };

        const exportBON = () => {
            downloadBONPDF({
                paginatedItems: paginatedItems.value,
                txDept: txDept.value,
                txTanggal: txTanggal.value,
                txReservasi: txReservasi.value,
                docNumber: docNumber.value,
                userData: userData.value
            });
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

                    if (isExpired) {
                        console.warn("Session expired local");
                        localStorage.removeItem("wms_user");
                        isLoggedIn.value = false;
                        return;
                    }

                    await refreshSession();

                    if (isLoggedIn.value) {
                        const saved = JSON.parse(localStorage.getItem("wms_user"));
                        page.value = saved?.page || ROLE_LANDING_PAGE[userData.value.role];

                        await refreshAllData();
                    }
                } catch (err) {
                    console.warn("Session invalid:", err.message);
                    localStorage.removeItem("wms_user");
                    isLoggedIn.value = false;
                }
            }

            let isRefreshing = false;

            const refreshSessionSafe = async () => {
                if (isRefreshing) return;

                isRefreshing = true;
                try {
                    await refreshSession();
                } finally {
                    isRefreshing = false;
                }
            };

            setInterval(() => {
                if (isLoggedIn.value) refreshSessionSafe();
            }, 30000);

            await Promise.all([
                inventory.loadInventory(true),
                inventory.loadLocations(),
                catalog.loadFolders()
            ]);

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
            handleLogin, handleLogout, navigate, toast, selectedRow, handleDeleteUser, handleTogglePermission, selectedPermissionUser,
            showPermissionModal, openPermissionModal, previewPhoto,
            permissions, can, cannot, hasRole, canAny, canAll, canAccessPage, PERMISSION, ACCESS_PERMISSIONS,

            // 2. UI & NAVIGATION STATE
            sidebarOpen, showPassword, showPass, showCart, showLowStock, showRegisterModal,
            showLocationModal, showUserModal, showProfileModal, showItemModal, showPhotoModal,
            showScanner, showPopupDetail, closeModal, closeUserModal, closePhotoModal,

            // 3. INVENTORY & MASTER DATA
            loadInventory, inventory, inventorySearch, searchQuery, stockFilter, categoryOptions, categoryFilter,
            filterLocation, locations, loadLocations, resetAllFilters, sortKey, sortOrder, isInventoryReady, searchCache,
            finalInventory, isSearching, lastQuery, sortBy, handleTableScroll, getExportInventory, hasMore, removeItem,
            searchInputRef, departments, fixDriveUrl, searchResults, handleSearch, publicInventory,

            // 4. ITEM CRUD & MODALS
            formItem, isEditMode, formInput, selectedItem, openAddModal, editItem, saveItem, toggleStatus, getItemCoverPhoto,
            saveNewLocation, openUpdateLocation, catalog, showAddFolderModal, newFolderName, handleCreateFolder, openCatalogMenu, showFolderMenu,
            showAssignModal, selectedItemForFolder, selectedTargetFolderId, openAssignFolderModal, executeAssignFolder,
            showImportModal, importStep, rawExcelInput, parsedItems, isImporting, validCount, duplicateCount, openImportExcelModal, processExcelRawInput,
            executeBatchInsert,

            // 5. TRANSACTION & CART (WMS)
            cart, inputQty, qtyInputRef, previewData, pasteData, tx, isSearchingServer, processing, importLoading,
            lowStockItems, txType, txDept, txNote, txTanggal, handleCSVUpload, parsePaste, submitImport, addToCartWithQty,
            resetTransactionForm, handleCancelTx, isVoided, cancellingId, showImportMode, addToCart, resetImport,
            filteredHistory, removeFromCart, processTx, revalidatePreview, isDeptValid,

            // 6. CAMERA, SCANNER & MEDIA
            isStockInsufficientUI, getMasterStockUI, isCameraActive, videoFeed, fileInput, startScanner, stopScanner, handleScan,
            openScanner, scannerActive, handleTakePhoto, scanner, importer, useTransaction, focusSearch, closeScanner,
            launchGallery, openUpdateFoto, startLiveCamera, stopCamera, handleGallerySelected,
            removePhoto, isUploading, toggleUser, photoPreview, confirmAndUploadPhoto, cancelPreview, selectPhoto,
            makeCover, previewGallery, openPreviewGallery, closePreviewGallery, nextPreview, prevPreview, currentPreviewPhoto, canUploadPhoto,
            refreshPhotos, photoUrlInput, handleUrlSelected, resetPhotoState, handleDrop, handleDragOver, handleDragLeave, isDragOver,
            handleDragEnter, dragCounter,


            // 7. SPP (SURAT PERMOHONAN PEMBELIAN) & RESERVASI
            summarySppItems, inputKodeManual, tambahSemuaKeSpp, tambahItemManualByKode, kosongkanSpp, usageMap,
            chunkedSppItems, removeItemSpp, sppSign, noSPP, txReservasi, reservasiItems, locationForm,
            reservasiMeta, bukaPopUpReservasi, tambahkanKeForm, itemsPerPage, paginatedItems,

            // 8. USER MANAGEMENT & PROFILE
            adminUsers, filteredAdminUsers, userSearchQuery, handleUpdateUserRole, loadUsers,
            newUser, openUserModal, submitNewUser, regData, handleRegister, pendingUsers, refreshSession,
            profileForm, loadingProfile, openEditProfile, handleUpdateProfile, approveWithRole,
            pivotData, isPivotLoaded, isPivotLoading, refreshAllData,

            // 9. UPDATE SUPABASE
            exportExcel, isExporting, analyticsFilter, loadPivot, safeFetch, loadHistory,
            catatanSpp, scrap, loadScrapData: scrap.loadScrapData, showScrapInput, exportSPP, exportBON,

            // 10. DASHBOARD & REPORTING
            dashboard, dashData, dashFilter, handlePrint, historySearch, dashboardTx, recentTx, loadLowStock, exportHistory,
            loadOpnameDetail, showOpnameModal, loadingOpname, filteredOpnameDetail, opnameDetail, resetFilter, isRefreshing, fetchDashboardAll, loadDepartments,
            docNumber
        };
    }
}).mount('#app');
