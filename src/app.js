import { supabaseClient } from "./api/supabase.js";

import { useAuth } from "./composables/useAuth.js";
import { useUsers } from "./composables/useUsers.js";
import { useAcl } from "./composables/useAcl.js";
import { PERMISSION } from "./constants/permissions.js";
import { ACCESS_PERMISSIONS } from "./constants/accessPermissions.js";
import { canAccessPage } from "./constants/pagePermissions.js";

import { useInventory } from "./composables/useInventory.js";
import { searchInventory } from "./services/inventoryService.js";
import { fetchPhotos, deletePhoto, setCoverPhoto } from "./services/inventoryPhotoService.js";
import { useCatalog } from "./composables/useCatalog.js";
import { usePhotoManager } from "./composables/usePhotoManager.js";
import { useBarcode } from "./composables/useBarcode.js";

import { useReservasi } from "./composables/useReservasi.js";
import { useReservasiBarcode } from "./composables/useReservasiBarcode.js";

import { useScrapMonitoring } from "./composables/useScrapMonitoring.js";
import { useAuditLogs } from "./composables/useAudit.js";

import { createWatermarkedImage } from "./utils/photoProcessor.js";
import { fixDriveUrl } from "./utils/imageUtils.js";
import { useUploadPhoto } from "./composables/useUploadPhoto.js";
import { useCamera } from "./composables/useCamera.js";
import { deleteFromDrive } from "./services/driveService.js";

import { useTransaction } from "./composables/useTransaction.js";
import { useImportTx } from "./composables/useImportTx.js";
import { useScanner } from "./composables/useScanner.js";
import { processTransaction } from "./services/transactionService.js";
import { validateRows } from "./utils/validator.js";
import { cleanKode } from "./utils/cleaner.js";
import { useCancelTransaction } from "./composables/useCancelTransaction.js";

import { useSafeFetch } from "./composables/useSafeFetch.js";
import { useAnalytics } from "./composables/useAnalytics.js";
import { useOpname } from "./composables/useOpname.js";
import { useDashboard } from "./composables/useDashboard.js";
import { exportDashboardExcel, exportInventoryExcel, exportLowStockExcel, exportOpnameExcel } from "./exports/excelExport.js";
import { downloadSPPPDF, downloadBONPDF, downloadBarcodePDF, downloadQrPDF } from "./exports/pdfExport.js";

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
        const newUser = reactive({ nama: '', username: '', password: '', role: 'VIEWER' });
        const showRegisterModal = ref(false);
        const regData = reactive({ nama: '', username: '', password: '' });
        const showProfileModal = ref(false);
        const loadingProfile = ref(false);
        const profileForm = reactive({ nama: '', password: '' });
        const isExporting = ref(false);
        const selectedRow = ref(null);

        const isCameraActive = ref(false);
        const videoFeed = ref(null);
        const showLowStock = ref(false);
        const summarySppItems = ref([]);
        const catatanSpp = ref("");
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
        const showPopupDetail = ref(false);
        const selectedItem = ref(null);
        const formInput = reactive({
            qty: 1,
            noMesin: '',
            keteranganDept: "",
            keteranganManual: ""
        });

        const qtyInputRef = ref(null);
        const searchInputRef = ref(null);
        const showScrapInput = ref(false);

        const isRefreshing = ref(false);

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

        const scannerActive = ref(false);
        const reservasiScannerActive = ref(false);
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

        const bukaPopUpReservasi = (item) => {
            selectedItem.value = item;

            formInput.qty = 1;
            formInput.noMesin = "";
            formInput.keteranganDept = RsvDept.value || "";
            formInput.keteranganManual = "";

            showPopupDetail.value = true;
        };

        const tambahkanKeForm = () => {
            const item = selectedItem.value;

            if (!item) {
                showToast("Barang belum dipilih.", "error");
                return;
            }

            const qty = Number(formInput.qty || 0);

            if (!Number.isFinite(qty) || qty <= 0) {
                showToast("Qty harus lebih dari 0.", "error");
                return;
            }

            const deptKeterangan = String(
                formInput.keteranganDept || ""
            ).trim().toUpperCase();

            const keteranganManual = String(
                formInput.keteranganManual || ""
            ).trim().toUpperCase();

            if (!deptKeterangan) {
                showToast("Department keterangan wajib dipilih.", "error");
                return;
            }

            if (!keteranganManual) {
                showToast("Keterangan / tujuan wajib diisi.", "error");
                return;
            }

            const keterangan = `${deptKeterangan} - ${keteranganManual}`;

            const exist = reservasiItems.value.find(
                i => String(i.kode).trim().toUpperCase() ===
                    String(item.kode).trim().toUpperCase()
            );

            if (exist) {
                exist.qty = Number(exist.qty || 0) + qty;

                if (formInput.noMesin?.trim()) {
                    exist.noMesin = formInput.noMesin
                        .trim()
                        .toUpperCase();
                }

                exist.keterangan = keterangan;

                showToast(
                    `Jumlah ${item.nama} berhasil diperbarui.`,
                    "success"
                );
            } else {
                reservasiItems.value.push({
                    kode: item.kode,
                    nama: item.nama,
                    satuan: item.satuan || "PCS",
                    qty,

                    noMesin: String(
                        formInput.noMesin || ""
                    ).trim().toUpperCase(),

                    keterangan
                });

                showToast(
                    `${item.nama} berhasil ditambahkan ke form.`,
                    "success"
                );
            }

            showPopupDetail.value = false;
        };

        const handlePrint = async () => {
            if (!reservasiItems.value.length) {
                showToast("Daftar permintaan masih kosong.", "warning");
                return;
            }

            if (!docNumber.value) {
                showToast("Simpan reservasi terlebih dahulu sebelum mencetak.", "warning");
                return;
            }

            await renderReservasiBarcode();
            await new Promise(resolve => setTimeout(resolve, 150));

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
        const { permissions, can, cannot, isAdmin, hasRole, canAny, canAll } = acl;

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

        const disableSaveItem = computed(() => {
            return (
                loading.value ||
                isUploading.value ||
                !!photoPreview.value
            );
        });

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
            isInventoryReady, isSearching, inventorySearch, filterLocation, categoryFilter,
            stockFilter, loadInventory, handleSearch, resetAllFilters, sortBy,
            hasMore, finalInventory, publicInventory, categoryOptions, locations,
            loadLocations, getExportInventory, deleteItem
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
            if (!newVal || !newVal.trim()) return inventory.handleSearch(newVal);
            searchTimer = setTimeout(() => inventory.handleSearch(newVal), 500);
        });

        const inventoryScanner = useScanner(
            "inventory-reader",
            async (txt) => {
                const code = txt.trim();
                if (!code) return;
                inventorySearch.value = code;
                await nextTick();
                if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
                await closeInventoryScanner();
            }
        );

        const startScanner = async () => {
            if (showScanner.value) return;
            showScanner.value = true;
            await nextTick();
            try {
                await inventoryScanner.start();
            } catch (err) {
                showScanner.value = false;
                showToast(err?.message || "Kamera tidak dapat digunakan", "error");
            }
        };

        const stopScanner = async () => {
            await inventoryScanner.stop();
            showScanner.value = false;
        };

        const closeInventoryScanner = async () => {
            await stopScanner();
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

        const barcode = useBarcode({ showToast });
        const barcodeType = barcode.barcodeType;
        const selectedLabel = barcode.selectedLabel;

        const reservasi = useReservasi({ showToast, userData, page, can, isAdmin });

        const {
            reservasiItems, RsvDept, txTanggal, txReservasi, docNumber, isSavingReservasi, resetReservasiForm, showReservasiModal, bukaReservasiModal, newBon,
            reservasiList, reservasiListLoading, reservasiListSearch, reservasiListStatus, reservasiListHasMore, reservasiEditMode, editReservasiDariPreview,
            isApprovingReservasi, canApproveReservasi, approveReservasi, canRejectReservasi, isRejectingReservasi, rejectReservasi, deleteReservasi,
            selectedReservasi, showReservasiPreviewModal, reservasiBarcodePreview, reservasiPreviewMode, reservasiDetailLoading, loadReservasiList,
            bukaPreviewReservasi, tutupPreviewReservasi, reservasiApprovalHistory, reservasiApprovalLoading,
            getApprovalName, getApprovalDate, isApprovalCompleted, cariReservasi, formatApprovalDate, filterReservasiStatus, getRejectApproval, getRejectName,
            isApproveAction, isRejectAction, getApprovalStatus, getApprovalKeterangan, getApproval, getRejectDate, getRejectReason, getRejectLevel,
            tutupReservasiModal, paginatedItems, simpanReservasi
        } = reservasi;

        const { renderReservasiBarcode, downloadReservasiBarcode } = useReservasiBarcode({ docNumber, paginatedItems, showReservasiModal });

        const resetReservasi = async () => {
            resetReservasiForm();
            await nextTick();
            showToast("Form reservasi berhasil dikosongkan.", "success");
        };

        const openBon = async () => {
            bukaReservasiModal();
        };

        const downloadReservasiBarcodePreview = async () => {
            const noDoc = String(selectedReservasi.value?.header?.no_doc || "").trim().toUpperCase();
            if (!noDoc) {
                showToast("Nomor dokumen reservasi tidak tersedia.", "error");
                return;
            }
            await downloadReservasiBarcode(noDoc, showToast);
        };

        const reservasiScanner = useScanner(
            "reservasi-reader",
            async (txt) => {
                const code = String(txt ?? "")
                    .replace(/\r/g, "")
                    .replace(/\n/g, "")
                    .trim()
                    .toUpperCase();

                if (!code) return;

                if (!/^RSV-/i.test(code)) {
                    showToast("Barcode bukan barcode BPSC / Reservasi.", "error");
                    return;
                }

                if (navigator.vibrate) {
                    navigator.vibrate(150);
                }

                await closeReservasiScanner();
                await scanReservasiToCart(code);
            },
            {
                fps: 20,
                qrbox: {
                    width: 360,
                    height: 120
                },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.CODE_128
                ]
            }
        );

        const openReservasiScanner = async () => {
            if (reservasiScannerActive.value) return;

            if (scannerActive.value) await closeScanner();

            reservasiScannerActive.value = true;
            await nextTick();

            const reader = document.getElementById("reservasi-reader");
            if (!reader) {
                reservasiScannerActive.value = false;
                console.error("Element #reservasi-reader tidak ditemukan.");
                showToast("Area scanner reservasi belum tersedia.", "error");
                return;
            }

            try {
                await reservasiScanner.start();
            } catch (err) {
                reservasiScannerActive.value = false;
                console.error("Gagal membuka scanner reservasi:", err);
                showToast(err?.message || "Kamera tidak dapat digunakan.", "error");
            }
        };

        const closeReservasiScanner = async () => {
            try {
                await reservasiScanner.stop();
            } catch (err) {
                console.warn("Gagal menghentikan scanner reservasi:", err);
            } finally {
                reservasiScannerActive.value = false;
            }
        };

        watch(
            [showReservasiModal, docNumber, paginatedItems],
            async () => {
                if (!showReservasiModal.value) return;
                await renderReservasiBarcode();
            },
            { deep: true }
        );

        //===TRANSAKSI===//
        const tx = useTransaction(inventory, userData, showToast, {
            refreshInventory: async () => { await inventory.loadInventory(true); },
            refreshDashboard: refreshAllData,
            qtyInputRef,
            searchInputRef,
            loading
        });

        const {
            cart, processing, searchQuery, searchResults, showCart,
            txType, txNote, inputQty, findMasterItem,
            isSearchingServer, getMasterStockUI, txDept,
            addToCart, addToCartWithQty, removeFromCart, isStockInsufficientUI,
            processTx, resetTransactionForm, txReservasiManual, validateCartQty, incrementCartQty,
            submitReservasiManual,
            scanReservasiToCart, isProcessingReservasiScan, activeReservasi
        } = tx;

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

        const transaksiScanner = useScanner(
            "transaksi-reader",
            async (txt) => {
                const raw = String(txt ?? "").replace(/\r/g, "").replace(/\n/g, "").trim();
                if (!raw) return;

                const query = cleanKode(raw);
                if (!query) {
                    showToast("Barcode inventory tidak valid.", "error");
                    return;
                }

                let item = inventory.inventory.value.find(
                    i => String(i?.status || "").trim().toUpperCase() === "AKTIF" && cleanKode(i?.kode) === query
                );

                if (!item) {
                    try {
                        const result = await searchInventory(query);
                        const results = Array.isArray(result?.data) ? result.data : [];
                        item = results.find(
                            i => String(i?.status || "").trim().toUpperCase() === "AKTIF" && cleanKode(i?.kode) === query
                        ) || null;
                    } catch (err) {
                        console.error("Search server error:", err);
                        showToast("Gagal mencari data inventory.", "error");
                        return;
                    }
                }

                if (!item) {
                    showToast(`Barang dengan kode ${raw} tidak ditemukan atau Nonaktif.`, "error");
                    return;
                }

                const added = addToCartWithQty(item);
                if (added === false) return;

                if (navigator.vibrate) navigator.vibrate(100);

                nextTick(() => {
                    setTimeout(() => {
                        qtyInputRef.value?.focus?.();
                        qtyInputRef.value?.select?.();
                    }, 100);
                });
            },
            {
                fps: 15,
                qrbox: { width: 320, height: 160 }
            }
        );

        const openScanner = async () => {
            if (scannerActive.value) return;

            if (reservasiScannerActive.value) await closeReservasiScanner();

            scannerActive.value = true;
            await nextTick();
            await new Promise(resolve => requestAnimationFrame(resolve));

            const reader = document.getElementById("transaksi-reader");
            if (!reader) {
                scannerActive.value = false;
                console.error("Element #transaksi-reader tidak ditemukan.");
                showToast("Area scanner barang belum tersedia.", "error");
                return;
            }

            try {
                await transaksiScanner.start();
            } catch (err) {
                scannerActive.value = false;
                console.error("Gagal membuka scanner transaksi:", err);
                showToast(err?.message || "Kamera tidak dapat digunakan.", "error");
            }
        };

        const closeScanner = async () => {
            try {
                await transaksiScanner.stop();
            } finally {
                scannerActive.value = false;
            }
        };

        const importLoading = importer.loading;
        const previewData = importer.preview;
        const pasteData = ref("");
        const resetImport = importer.reset;

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
            const rawQuery = String(searchQuery.value || "").trim();
            if (!rawQuery) return;

            if (/^RSV-/i.test(rawQuery)) {
                searchQuery.value = "";
                await scanReservasiToCart(rawQuery);
                return;
            }

            const query = cleanKode(rawQuery);
            if (!query) return;

            let item = inventory.inventory.value.find(i => i.status === "AKTIF" && cleanKode(i.kode) === query);

            if (!item) {
                try {
                    const { data = [] } = await searchInventory(rawQuery);
                    item = data.find(i => cleanKode(i.kode) === query && i.status === "AKTIF");
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

        const focusSearch = () => { searchInputRef.value?.focus(); };

        const isDeptValid = computed(() => {
            if (txType.value === 'OPNAME') return true;
            const depts = (typeof departments !== 'undefined' ? departments.value : []) || [];
            return depts.map(d => String(d).toLowerCase()).includes(String(txDept.value || '').trim().toLowerCase());
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

        watch(page, async () => {
            try {
                await transaksiScanner.stop();
            } catch (err) {
                console.warn("Stop transaksi scanner:", err);
            }

            try {
                await inventoryScanner.stop();
            } catch (err) {
                console.warn("Stop inventory scanner:", err);
            }

            try {
                await reservasiScanner.stop();
            } catch (err) {
                console.warn("Stop reservasi scanner:", err);
            }

            scannerActive.value = false;
            showScanner.value = false;
            reservasiScannerActive.value = false;
        });


        ///===DASHBOARD===///
        const { safeFetch } = useSafeFetch(showToast);

        const analytics = useAnalytics(safeFetch);

        const opname = useOpname();
        const { opnameDetail, filteredOpnameDetail, loadingOpname, showOpnameModal, loadOpnameDetail, formatOpnameDate } = opname;
        loadOpnameDetail(false);

        const dashboard = useDashboard(safeFetch, searchQuery);

        const {
            recentTx, dashData, dashboardTx, lowStockItems, departments,
            dashFilter, loadLowStock, loadDepartments, exportHistory,
            loadHistory, fetchDashboardAll, resetFilter, filteredHistory
        } = dashboard;

        const { pivotData, filter: analyticsFilter, isLoading: isPivotLoading, isPivotLoaded, loadPivot } = analytics;
        
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
            formItem,
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

        const monitoring = useAuditLogs({
            supabaseClient,
            userData,
            showToast, previewGallery
        });

        watch(page, (newPage) => {
            if (newPage === "monitoring_logs") {
                monitoring.loadLogs();
            }
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
                    return await scrap.exportScrapExcel();
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
            if (reservasiItems.value.length === 0) {
                alert("Daftar item masih kosong!");
                return;
            }
            if (!RsvDept.value?.trim()) {
                showToast("Mohon isi Department pemohon!", "error");
                return;
            }
            if (!docNumber.value) {
                showToast("Simpan reservasi terlebih dahulu sebelum mencetak.", "warning");
                return;
            }
            downloadBONPDF({
                paginatedItems: paginatedItems.value,
                txDept: txDept.value,
                txTanggal: txTanggal.value,
                txReservasi: txReservasi.value,
                docNumber: docNumber.value,
                userData: userData.value
            });
        };

        const exportBarcode = async () => {
            if (!barcode.printQueue.value || barcode.printQueue.value.length === 0) {
                showToast("Antrean cetak masih kosong.", "warning");
                return;
            }
            if (barcodeType.value === "qr") {
                await downloadQrPDF({ items: barcode.printQueue.value });
                return;
            }
            await downloadBarcodePDF({ items: barcode.printQueue.value, labelKey: selectedLabel.value });
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
                loadLocations(),
                catalog.loadFolders()
            ]);


            const today = new Date().toISOString().split("T")[0];
            analyticsFilter.value.startDate = today;
            analyticsFilter.value.endDate = today;

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
            showPermissionModal, openPermissionModal, previewPhoto, monitoring,
            permissions, can, cannot, hasRole, canAny, canAll, canAccessPage, PERMISSION, ACCESS_PERMISSIONS, isAdmin,

            // 2. UI & NAVIGATION STATE
            sidebarOpen, showPassword, showPass, showCart, showLowStock, showRegisterModal,
            showLocationModal, showUserModal, showProfileModal, showItemModal, showPhotoModal,
            showScanner, showPopupDetail, closeModal, closeUserModal, closePhotoModal,

            // 3. INVENTORY & MASTER DATA
            loadInventory, inventory, inventorySearch, searchQuery, stockFilter, categoryOptions, categoryFilter,
            filterLocation, locations, loadLocations, resetAllFilters, sortKey, sortOrder, isInventoryReady, deleteItem,
            finalInventory, isSearching, sortBy, handleTableScroll, getExportInventory, hasMore, removeItem,
            searchInputRef, departments, fixDriveUrl, searchResults, handleSearch, publicInventory,

            // 4. ITEM CRUD & MODALS
            formItem, isEditMode, formInput, selectedItem, openAddModal, editItem, saveItem, toggleStatus, getItemCoverPhoto, saveNewLocation, openUpdateLocation, catalog, showAddFolderModal,
            newFolderName, handleCreateFolder, openCatalogMenu, showFolderMenu, showAssignModal, selectedItemForFolder, selectedTargetFolderId, openAssignFolderModal, executeAssignFolder, showImportModal,
            importStep, rawExcelInput, parsedItems, isImporting, validCount, duplicateCount, openImportExcelModal, processExcelRawInput, executeBatchInsert, disableSaveItem, barcode, barcodeType,
            selectedLabel, reservasi, simpanReservasi, renderReservasiBarcode, reservasiScannerActive, isSavingReservasi, showReservasiModal, bukaReservasiModal,
            newBon, openBon, reservasiList, reservasiPreviewMode, isApprovingReservasi, canApproveReservasi, canRejectReservasi, isRejectingReservasi, rejectReservasi, deleteReservasi, approveReservasi,
            reservasiDetailLoading, reservasiListLoading, reservasiListSearch, reservasiListStatus, reservasiListHasMore, selectedReservasi, isApproveAction, isRejectAction, getApprovalStatus,
            getApprovalKeterangan, getApproval, showReservasiPreviewModal, reservasiBarcodePreview, reservasiApprovalHistory, formatApprovalDate, reservasiApprovalLoading, reservasiEditMode,
            editReservasiDariPreview, getApprovalName, getApprovalDate, isApprovalCompleted, getRejectApproval, getRejectName, getRejectDate, getRejectReason, getRejectLevel, loadReservasiList,
            bukaPreviewReservasi, tutupPreviewReservasi, cariReservasi, filterReservasiStatus, tutupReservasiModal, downloadReservasiBarcode, downloadReservasiBarcodePreview, openReservasiScanner, closeReservasiScanner, RsvDept,

            // 5. TRANSACTION & CART (WMS)
            cart, inputQty, qtyInputRef, previewData, pasteData, tx, isSearchingServer, processing, importLoading, findMasterItem,
            lowStockItems, txType, txDept, txNote, txTanggal, handleCSVUpload, parsePaste, submitImport, addToCartWithQty, validateCartQty,
            resetTransactionForm, handleCancelTx, isVoided, cancellingId, showImportMode, addToCart, resetImport, txReservasiManual,
            submitReservasiManual, incrementCartQty,
            filteredHistory, removeFromCart, processTx, revalidatePreview, isDeptValid, scanReservasiToCart, isProcessingReservasiScan, activeReservasi,

            // 6. CAMERA, SCANNER & MEDIA
            isStockInsufficientUI, getMasterStockUI, isCameraActive, videoFeed, fileInput, startScanner, stopScanner, handleScan,
            openScanner, scannerActive, handleTakePhoto, importer, useTransaction, focusSearch, closeScanner,
            launchGallery, openUpdateFoto, startLiveCamera, stopCamera, handleGallerySelected, processImageFile,
            removePhoto, isUploading, toggleUser, photoPreview, confirmAndUploadPhoto, cancelPreview, selectPhoto,
            makeCover, previewGallery, openPreviewGallery, closePreviewGallery, nextPreview, prevPreview, currentPreviewPhoto, canUploadPhoto,
            refreshPhotos, photoUrlInput, handleUrlSelected, resetPhotoState, handleDrop, handleDragOver, handleDragLeave, isDragOver,
            handleDragEnter, dragCounter,


            // 7. SPP (SURAT PERMOHONAN PEMBELIAN) & RESERVASI
            summarySppItems, inputKodeManual, tambahSemuaKeSpp, tambahItemManualByKode, kosongkanSpp, usageMap, resetReservasi,
            chunkedSppItems, removeItemSpp, sppSign, noSPP, txReservasi, reservasiItems, locationForm, resetReservasiForm, bukaPopUpReservasi, tambahkanKeForm, paginatedItems,

            // 8. USER MANAGEMENT & PROFILE
            adminUsers, filteredAdminUsers, userSearchQuery, handleUpdateUserRole, loadUsers,
            newUser, openUserModal, submitNewUser, regData, handleRegister, pendingUsers, refreshSession,
            profileForm, loadingProfile, openEditProfile, handleUpdateProfile, approveWithRole,
            pivotData, isPivotLoaded, isPivotLoading, refreshAllData,

            // 9. UPDATE SUPABASE
            exportExcel, isExporting, analyticsFilter, loadPivot, loadHistory,
            catatanSpp, scrap, loadScrapData: scrap.loadScrapData, showScrapInput, exportSPP, exportBON, exportBarcode,

            // 10. DASHBOARD & REPORTING
            dashboard, dashData, dashFilter, handlePrint, dashboardTx, recentTx, loadLowStock, exportHistory,
            loadOpnameDetail, formatOpnameDate, showOpnameModal, loadingOpname, filteredOpnameDetail, opnameDetail, resetFilter, isRefreshing, fetchDashboardAll, loadDepartments,
            docNumber
        };
    }
}).mount('#app');