
const { createApp, ref, computed, onMounted, watch, reactive, nextTick } = Vue;
const GAS_URL = "https://script.google.com/macros/s/AKfycbxgLvu6EiCVv6Kw9XkPcClC-oxj9ASvbgWAAPA52SPVszfJPgvpntGobcmz3gKq360IdA/exec"; // Ganti dengan URL GAS Anda

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

        const showUserModal = ref(false);
        const isSubmitting = ref(false);
        const loginData = ref({ username: '', password: '' });
        const userData = ref({ username: '', nama: '', role: '', canPreviewPhoto: false });
        const userToken = ref('');
        const adminUsers = ref([]);
        const userSearchQuery = ref('');
        const newUser = reactive({ nama: '', username: '', password: '', role: 'VIEWER' });
        const showRegisterModal = ref(false);
        const regData = ref({ nama: '', username: '', password: '' });
        const showProfileModal = ref(false);
        const loadingProfile = ref(false);
        const profileForm = reactive({ nama: '', password: '' });

        const inventory = ref([]);
        const inventorySearch = ref('');
        const categoryFilter = ref('all');
        const stockFilter = ref('available');
        const departments = ref([]);

        const lowStockItems = ref([]);
        const showLowStock = ref(false);
        const summarySppItems = ref([]);
        const inputKodeManual = ref('');
        const noSPP = ref("SPT-" + new Date().getTime());
        const sppSign = ref({
            pembuat: 'Viky',
            pemeriksa: 'Yohanes',
            diketahui: 'Sudaryanto',
            disetujui: 'Asyiriah'
        });

        const previewImage = ref(null);
        const scannerActive = ref(false);

        const cart = ref([]);
        const showCart = ref(false);
        const txType = ref('KELUAR');
        const txDept = ref('');
        const txNote = ref('');
        const inputQty = ref('');
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
        const cancellingId = ref(null);

        const dashData = ref({ totalItem: 0, totalStok: 0, selisihOpname: 0, totalLowStock: 0 });
        const dashFilter = ref({ startDate: '', endDate: '', dept: '', type: 'ALL' });
        const recentTx = ref([]);

        const showItemModal = ref(false);
        const isEditMode = ref(false);
        const formItem = ref({
            kode: '',
            nama: '',
            satuan: '',
            lokasi: '',
            kategori: '',
            foto: '',
            minStok: 0,
            status: 'AKTIF'
        });
        const showLocationModal = ref(false);
        const locationForm = ref({ kode: '', nama: '', foto: '', lokasi: '' });
        const fileInput = ref(null);
        const isCameraActive = ref(false);
        const videoFeed = ref(null);
        const isUploading = ref(false);
        const showPhotoModal = ref(false);
        let streamInstance = null;

        const searchQuery = ref('');
        const userRole = ref('ADMIN');
        const toast = ref({
            show: false,
            message: '',
            type: 'success'
        });
        const filterLocation = ref('');
        const sortKey = ref('');
        const sortOrder = ref(1);
        const showPass = ref(false);
        const showPassword = ref(false);

        const showScanner = ref(false);
        let html5QrCode = null;
        let dashboardInterval = null;
        let inventoryInterval = null;

        const callAPI = async (action, payload = {}, overrideToken = null) => {
            loading.value = true;
            try {
                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action,
                        token: overrideToken || localStorage.getItem('token'),
                        payload
                    })
                });

                const res = await response.json();

                if (res.status === 'error' && res.message === 'INVALID_SESSION') {
                    alert("Sesi Anda berakhir karena Anda telah login di perangkat lain.");
                    handleLogout(); // Otomatis tendang ke halaman login
                    return res;
                }

                return res;
            } catch (e) {
                console.error("API Error", e);
                return { status: 'error', message: 'Koneksi gagal' };
            } finally {
                loading.value = false;
            }
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

        const submitNewUser = async () => {
            if (!newUser.nama || !newUser.username || !newUser.password) {
                alert('Harap isi Nama, Username, dan Password!');
                return;
            }

            isSubmitting.value = true;

            try {
                // Struktur payload ini harus sesuai dengan case 'ADMIN_MANAGE_USER' di doPost
                const requestPayload = {
                    targetUser: newUser.username,
                    manageAction: 'ADD',
                    payload: {
                        nama: newUser.nama,
                        password: newUser.password,
                        role: newUser.role
                    }
                };

                // Menggunakan callAPI (Pastikan callAPI mengirimkan token di level atas JSON)
                const res = await callAPI('ADMIN_MANAGE_USER', requestPayload);

                if (res && res.status === 'success') {
                    // Update tabel secara lokal (Optimistic)
                    adminUsers.value.unshift({
                        nama: newUser.nama,
                        username: newUser.username,
                        role: newUser.role,
                        status: 'AKTIF',
                        canPreviewPhoto: false,
                        deviceInfo: ''
                    });

                    closeUserModal();
                    alert('User berhasil ditambahkan!');
                } else {
                    alert('Gagal: ' + (res?.message || 'Server Error'));
                }
            } catch (error) {
                console.error(error);
                alert('Terjadi kesalahan koneksi.');
            } finally {
                isSubmitting.value = false;
            }
        };

        const handleRegister = async () => {
            // 1. Validasi Input Kosong
            if (!regData.value.nama || !regData.value.username || !regData.value.password) {
                showToast("Harap isi semua bidang pendaftaran!", "error");
                return;
            }

            // 2. Validasi Minimal 6 Digit Password
            if (regData.value.password.length < 6) {
                showToast("Password minimal harus 6 karakter!", "error");
                return;
            }

            loading.value = true;

            try {
                // Membersihkan input (opsional tapi sangat disarankan)
                const payload = {
                    nama: regData.value.nama.trim(),
                    username: regData.value.username.trim().toLowerCase(), // Username dipaksa huruf kecil
                    password: regData.value.password
                };

                const res = await callAPI('REGISTER', payload);

                if (res.status === 'success') {
                    showToast("Pendaftaran berhasil! Tunggu approval Vickey.", "success");

                    // Tutup modal dan reset form
                    showRegisterModal.value = false;
                    regData.value = { nama: '', username: '', password: '' };
                } else {
                    // Misal: Username sudah ada
                    showToast(res.message || "Pendaftaran gagal.", "error");
                }
            } catch (err) {
                console.error("Reg Error:", err);
                showToast("Terjadi kesalahan koneksi. Silakan coba lagi.", "error");
            } finally {
                loading.value = false;
            }
        };

        const handleLogin = async () => {
            if (!loginData.value.username || !loginData.value.password) {
                showToast("Username dan password harus diisi!", "error");
                return;
            }

            loading.value = true;

            try {
                const deviceInfo = getDeviceInfo();
                const res = await callAPI('LOGIN', {
                    ...loginData.value,
                    deviceInfo: deviceInfo
                });

                if (res.status === 'success') {
                    // 1. Simpan Token & Update State Global
                    localStorage.setItem('token', res.token);
                    userToken.value = res.token;

                    userData.value = {
                        nama: res.nama,
                        role: res.role,
                        canPreviewPhoto: String(res.canPreviewPhoto).toUpperCase() === 'TRUE'
                    };

                    await fetchAllData(res.token);

                    isLoggedIn.value = true;
                    page.value = ROLE_LANDING_PAGE[res.role] || 'inventory';

                    showToast(`Selamat datang, ${res.nama}!`, "success");

                    loginData.value = { username: '', password: '' };

                } else {
                    showToast(res.message, "error");
                }
            } catch (err) {
                console.error("Login Error:", err);
                showToast("Terjadi kesalahan koneksi saat login.", "error");
            } finally {
                loading.value = false;
            }
        };

        const getDeviceInfo = () => {
            const ua = navigator.userAgent;
            let device = "Unknown Device";

            // 1. Deteksi Android & Versinya
            if (/android/i.test(ua)) {
                const match = ua.match(/Android\s([0-9\.]+)/);
                const version = match ? match[1] : "";
                device = `Android ${version}`;
            }
            // 2. Deteksi iOS (iPhone/iPad)
            else if (/iPhone|iPad|iPod/i.test(ua)) {
                const match = ua.match(/OS\s([0-9\_]+)/);
                const version = match ? match[1].replace(/_/g, '.') : "";
                const model = /iPhone/.test(ua) ? "iPhone" : "iPad";
                device = `${model} (iOS ${version})`;
            }
            // 3. Deteksi PC (Windows/Mac/Linux)
            else if (/Windows/i.test(ua)) {
                const match = ua.match(/Windows\sNT\s([0-9\.]+)/);
                let winVer = match ? match[1] : "";
                // Mapping versi Windows NT ke versi publik
                const winMap = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
                device = `Windows ${winMap[winVer] || winVer}`;
            }
            else if (/Macintosh/i.test(ua)) device = "Mac OS";
            else if (/Linux/i.test(ua)) device = "Linux PC";

            // 4. Deteksi Browser
            const browser = /Edg/i.test(ua) ? "Edge" :
                /Chrome/i.test(ua) ? "Chrome" :
                    /Safari/i.test(ua) ? "Safari" :
                        /Firefox/i.test(ua) ? "Firefox" : "Browser";

            return `${device} - ${browser}`;
        };

        const fetchAllData = async (silent = false) => {
            if (!silent) loading.value = true;
            try {
                const [resBase, resInventory, resDash, resLow] = await Promise.all([
                    callAPI('GET_INITIAL_DATA'),
                    callAPI('ADMIN_GET_ITEMS'),
                    callAPI('GET_DASHBOARD', {
                        filterType: dashFilter.value.type,
                        dateStart: dashFilter.value.start,
                        dateEnd: dashFilter.value.end,
                        dept: dashFilter.value.dept
                    }),
                    callAPI('GET_LOW_STOCK_PR', {}) // Panggil di sini agar data standby
                ]);

                // 1. Metadata
                if (resBase?.status === 'success') {
                    departments.value = resBase.departments || [];
                    categoryOptions.value = resBase.categories || [];
                }

                // 2. Inventory
                if (resInventory?.status === 'success') {
                    inventory.value = (resInventory.data || []).map(i => ({
                        ...i,
                        stok: Number(i.stok) || 0,
                        minStok: Number(i.minStok) || 0,
                        imgFailed: false
                    }));
                }

                // 3. Dashboard & Recent Transactions
                if (resDash) {
                    dashData.value = {
                        totalItem: resDash.totalItem,
                        totalStok: resDash.totalStok,
                        totalLowStock: resDash.totalLowStock,
                        selisihOpname: resDash.selisihOpname
                    };
                    recentTx.value = resDash.recentTx || [];
                }

                // 4. Low Stock PR (SIMPAN DI SINI)
                if (resLow) {
                    // Langsung filter data aktif agar modal tinggal pakai
                    const rawData = Array.isArray(resLow) ? resLow : (resLow.data || []);
                    lowStockItems.value = rawData.filter(i =>
                        (i.status || 'AKTIF').toUpperCase() === 'AKTIF'
                    );
                }

            } catch (err) {
                console.error("FetchAllData error:", err);
            }
        };

        const fetchInventory = async () => {
            try {
                const res = await callAPI('ADMIN_GET_ITEMS');

                if (res && res.status === 'success' && Array.isArray(res.data)) {
                    inventory.value = res.data.map(i => ({
                        ...i,
                        stok: Number(i.stok) || 0,
                        minStok: Number(i.minStok) || 0,
                        imgFailed: false
                    }));
                } else {
                    console.error("Gagal load inventory:", res?.message || "Format data salah");
                }
            } catch (err) {
                console.error("Inventory error:", err);
            }
        };

        const fetchDashboard = async () => {
            try {
                const res = await callAPI('GET_DASHBOARD', {
                    filterType: dashFilter.value.type,
                    dateStart: dashFilter.value.start,
                    dateEnd: dashFilter.value.end,
                    dept: dashFilter.value.dept
                });

                if (!res) return;

                dashData.value = {
                    totalItem: res.totalItem,
                    totalStok: res.totalStok,
                    totalLowStock: res.totalLowStock,
                    selisihOpname: res.selisihOpname
                };

                // update hanya jika berubah
                if (JSON.stringify(recentTx.value) !== JSON.stringify(res.recentTx)) {
                    recentTx.value = res.recentTx;
                }

            } catch (err) {
                console.error("Dashboard error:", err);
            }
        };

        const fetchLowStock = async () => {
            showLowStock.value = true;
        };

        const stockRules = {
            available: qty => qty > 0,
            empty: qty => qty === 0,
            all: () => true
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
            loading.value = true;
            try {
                // Sesuaikan dengan struktur doPost Anda: { action, payload, token }
                const res = await callAPI('STAFF_SAVE_PHOTO', {
                    kode: formItem.value.kode,
                    foto: formItem.value.foto,
                    nama: formItem.value.nama // Optional hanya untuk log
                });

                if (res.status === 'success') {
                    alert(res.message);
                    showPhotoModal.value = false;

                    // Refresh data agar foto langsung muncul di tabel utama
                    // Gunakan action yang sudah ada di doPost Anda
                    const result = await callAPI('ADMIN_GET_ITEMS');
                    if (result) {
                        inventory.value = result.data || result;
                    }
                } else {
                    alert("Gagal: " + res.message);
                }
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan sistem saat menyimpan foto.");
            } finally {
                loading.value = false;
            }
        };

        const startLiveCamera = async () => {
            try {
                isCameraActive.value = true;

                const constraints = {
                    video: {
                        facingMode: "environment", // Gunakan kamera belakang
                        width: { ideal: 1280 },    // Resolusi ideal agar detail
                        height: { ideal: 720 }
                    },
                    audio: false
                };

                streamInstance = await navigator.mediaDevices.getUserMedia(constraints);

                if (videoFeed.value) {
                    videoFeed.value.srcObject = streamInstance;

                    // --- LOGIKA AUTO FOCUS ---
                    const track = streamInstance.getVideoTracks()[0];
                    const capabilities = track.getCapabilities();

                    // Cek apakah perangkat mendukung Focus Mode
                    if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                        await track.applyConstraints({
                            advanced: [{ focusMode: 'continuous' }]
                        });
                        console.log("Auto-focus kontinu diaktifkan");
                    }
                }
            } catch (err) {
                console.error("Kamera Error:", err);
                alert("Izin kamera ditolak browser.");
                isCameraActive.value = false;
            }
        };

        const stopCamera = () => {
            if (streamInstance) {
                streamInstance.getTracks().forEach(track => track.stop());
                streamInstance = null;
            }
            isCameraActive.value = false;
        };

        const takeSnapshot = () => {
            const video = videoFeed.value;
            if (!video) return;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            stopCamera();
            const base64Murni = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            processAndUpload(base64Murni);
        };

        const processAndUpload = async (base64Clean) => {
            isUploading.value = true; // Aktifkan Overlay
            try {
                const res = await callAPI('UPLOAD_TO_DRIVE', {
                    file: base64Clean,
                    filename: `IMG_${formItem.value.kode || 'NEW'}_${Date.now()}.jpg`,
                    mimeType: 'image/jpeg'
                });

                if (res.status === 'success') {
                    formItem.value.foto = res.url;
                    console.log("Upload Berhasil:", res.url);
                } else {
                    alert("Gagal: " + res.message);
                }
            } catch (err) {
                console.error(err);
                alert("Koneksi ke GAS terputus.");
            } finally {
                isUploading.value = false; // Matikan Overlay
            }
        };

        const handleFileUpload = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            isUploading.value = true;
            const reader = new FileReader();

            reader.onload = async (e) => {
                const img = new Image();
                img.src = e.target.result;

                img.onload = async () => {
                    // --- LOGIKA KOMPRESI GAMBAR ---
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Batasi maksimal resolusi 1024px agar upload ringan
                    const MAX_SIZE = 1024;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert ke Base64 dengan kualitas 0.7 (70%)
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                    // --- END KOMPRESI ---

                    try {
                        console.log("Memulai upload ke GAS...");
                        const res = await callAPI('UPLOAD_TO_DRIVE', {
                            file: compressedBase64,
                            filename: `IMG_${formItem.value.kode || 'NEW'}_${Date.now()}.jpg`,
                            mimeType: 'image/jpeg'
                        });

                        if (res.status === 'success') {
                            // Update link foto di form
                            formItem.value.foto = res.url;
                            console.log("Upload Sukses:", res.url);
                        } else {
                            alert("Gagal upload ke Drive: " + res.message);
                        }
                    } catch (err) {
                        console.error("Fetch Error:", err);
                        alert("Terjadi kesalahan koneksi ke server GAS.");
                    } finally {
                        isUploading.value = false;
                        // Penting: Reset input file agar bisa pilih file yang sama lagi
                        event.target.value = '';
                    }
                };
            };
            reader.readAsDataURL(file);
        };

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
                formItem.value.foto = '';
            }
        };

        const fixDriveUrl = (url) => {
            if (!url) return "https://placehold.co/400x400?text=No+Image";
            const strUrl = String(url);
            let fileId = "";
            if (strUrl.includes("drive.google.com")) {
                if (strUrl.includes("/d/")) {
                    fileId = strUrl.split("/d/")[1].split("/")[0];
                } else if (strUrl.includes("id=")) {
                    fileId = strUrl.split("id=")[1].split("&")[0];
                }
                if (fileId) return "https://lh3.googleusercontent.com/d/" + fileId;
            }
            return strUrl;
        };

        const togglePhotoAccess = async (user, isChecked) => {
            const original = user.canPreviewPhoto;
            user.canPreviewPhoto = isChecked;
            const res = await callAPI('ADMIN_UPDATE_PHOTO_ACCESS', {
                targetUser: user.username,
                canPreviewPhoto: isChecked
            });
            if (res.status !== 'success') {
                user.canPreviewPhoto = original;
                alert(res.message);
            }
        };

        watch(page, (newPage) => {
            if (newPage === 'transaksi') {
                nextTick(() => {
                    setTimeout(() => {
                        if (qtyInputRef.value) qtyInputRef.value.focus();
                    }, 300); // Beri jeda sedikit agar transisi halaman selesai
                });
            }
        });

        watch(showLowStock, (val) => {
            if (val === true) {
                fetchLowStock()
            }
        });

        const showToast = (msg, type = 'success') => {
            // Reset jika toast sedang tampil agar animasi terulang
            toast.value.show = false;

            setTimeout(() => {
                toast.value = {
                    show: true,
                    message: msg,
                    type: type
                };
            }, 10);

            // Otomatis tutup setelah 3 detik
            setTimeout(() => {
                toast.value.show = false;
            }, 3000);
        };

        const navigate = (target) => {
            page.value = target
            sidebarOpen.value = false
        };

        const setDefaultPageByRole = () => {
            const role = userData.value.role

            if (role === 'VIEWER') {
                page.value = 'inventory'
            } else {
                page.value = 'dashboard'
            }
        };

        const calculateOrderQty = (item) => {
            const min = Number(item.minStok) || 0;
            const stok = Number(item.stok) || 0;
            const target = min * 2;

            return Math.max(target - stok, 0);
        };

        const processTx = async () => {
            // 1. Validasi Dasar & Guard Clauses
            if (cart.value.length === 0) return alert("Keranjang masih kosong!");

            // Validasi Departemen hanya jika tipe adalah KELUAR, MASUK, atau RETURN (sesuaikan kebutuhan)
            // OPNAME biasanya tidak butuh departemen
            if (txType.value !== 'OPNAME' && (!txDept.value || !isDeptValid.value)) {
                return alert("Departemen tujuan tidak valid atau belum dipilih!");
            }

            // 2. Validasi Stok (khusus KELUAR)
            if (txType.value === 'KELUAR') {
                const invalid = cart.value
                    .map(cartItem => {
                        const master = inventory.value.find(i => i.kode === cartItem.kode);
                        const currentStock = master ? Number(master.stok) : 0;
                        return Number(cartItem.qty) > currentStock
                            ? `${cartItem.nama} (Stok: ${currentStock})`
                            : null;
                    })
                    .filter(msg => msg !== null);

                if (invalid.length) {
                    return alert("Stok tidak mencukupi:\n\n" + invalid.join('\n'));
                }
            }

            if (!confirm(`Proses ${txType.value} ${cart.value.length} item?`)) return;

            // 3. Eksekusi API
            loading.value = true; // Aktifkan UI Loading One UI Anda

            try {
                const payload = {
                    jenis: txType.value,
                    dept: txDept.value || '-',
                    user: userData.value.nama || 'System',
                    ket: txNote.value || '-',
                    items: cart.value.map(i => ({
                        kode: i.kode,
                        nama: i.nama,
                        qty: Number(i.qty)
                    }))
                };

                const res = await callAPI('PROSES_TRANSAKSI_MULTI', payload);

                if (res.status === 'success') {
                    // 🔥 UPDATE STOK LOKAL (Optimistic Update)
                    // Ini membuat aplikasi terasa instan tanpa menunggu fetch inventory selesai
                    cart.value.forEach(item => {
                        const inv = inventory.value.find(i => i.kode === item.kode);
                        if (inv) {
                            const qty = Number(item.qty);
                            const current = Number(inv.stok);
                            if (txType.value === 'KELUAR') inv.stok = current - qty;
                            else if (txType.value === 'OPNAME') inv.stok = qty;
                            else inv.stok = current + qty; // MASUK & RETURN
                        }
                    });

                    showToast("Transaksi Berhasil!", "success");
                    resetTransactionForm(); // Menutup modal keranjang

                    await fetchAllData(true);

                } else {
                    showToast(res.message, "error");
                }
            } catch (err) {
                console.error("Tx Error:", err);
                showToast("Koneksi bermasalah", "error");
            } finally {
                loading.value = false; // Matikan loading screen
            }
        };

        const openScanner = () => {
            scannerActive.value = true;

            nextTick(() => {
                const readerElement = document.getElementById('reader');
                if (!readerElement) {
                    console.error("Elemen 'reader' belum siap di DOM.");
                    return;
                }

                if (!html5QrCode) {
                    html5QrCode = new Html5Qrcode("reader");
                }

                html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 15, qrbox: 250 },
                    (txt) => {
                        const item = inventory.value.find(i => i.kode === txt);

                        if (item) {
                            addToCartWithQty(item);
                            closeScanner();
                            console.log("Scan Berhasil: " + item.nama);
                        } else {
                            alert("Item Tidak Terdaftar: " + txt);
                        }
                    }
                ).catch(err => {
                    console.error("Gagal memulai kamera:", err);
                    alert("Kamera tidak dapat diakses. Pastikan izin diberikan.");
                });
            });
        };

        const closeScanner = async () => {
            if (html5QrCode) {
                try {
                    await html5QrCode.stop(); // Hentikan stream kamera
                    scannerActive.value = false;
                } catch (err) {
                    console.error("Gagal menghentikan kamera:", err);
                    scannerActive.value = false; // Tetap tutup modal jika error
                }
            } else {
                scannerActive.value = false;
            }
        };

        const focusSearch = () => {
            if (inputQty.value > 0 && searchInputRef.value) searchInputRef.value.focus();
        };

        const addToCart = (item) => {
            const exist = cart.value.find(c => c.kode === item.kode);
            if (exist) { exist.qty += 1; }
            else { cart.value.push({ ...item, qty: 1 }); }
            showCart.value = false;
        };

        const addToCartWithQty = (item, customQty = null) => {
            // 1. Tangkap jumlah input: prioritas argumen customQty, lalu inputQty, default 1
            const rawInput = customQty !== null ? customQty : inputQty.value;
            const jumlahInput = (rawInput === '' || rawInput <= 0) ? 1 : Number(rawInput);

            const existingIndex = cart.value.findIndex(c => c.kode === item.kode);

            if (existingIndex !== -1) {
                // Jika sudah ada, tambahkan quantity-nya (Math addition, bukan string concatenation)
                cart.value[existingIndex].qty += jumlahInput;
            } else {
                // Jika belum ada, buat entri baru
                cart.value.push({
                    kode: item.kode,
                    nama: item.nama,
                    stok: item.stok,
                    satuan: item.satuan,
                    qty: jumlahInput
                });
            }

            showCart.value = false; // Munculkan cart jika disembunyikan

            // 2. Sentralisasi Reset Form
            searchQuery.value = '';
            inputQty.value = ''; // Reset kosong agar dihitung 1 pada scan berikutnya

            // 3. Kembalikan kursor dengan aman
            nextTick(() => {
                if (qtyInputRef.value) qtyInputRef.value.focus();
            });
        };

        const handleScan = () => {
            const query = searchQuery.value?.toString().trim().toLowerCase();
            if (!query) return;

            const item = inventory.value.find(i => {
                if (i.status !== 'AKTIF') return false;

                const kode = i.kode?.toString().trim().toLowerCase();
                const nama = i.nama?.toString().trim().toLowerCase();

                return kode === query || nama === query;
            });

            if (!item) {
                alert("Barang tidak ditemukan atau sudah dinonaktifkan!");
                searchQuery.value = '';
                return;
            }

            addToCartWithQty(item);
        };

        const isStockInsufficient = (item) => {
            if (txType.value !== 'KELUAR') return false;
            const master = inventory.value.find(i => i.kode === item.kode);
            return master ? item.qty > master.stok : true;
        };

        const getMasterStock = (kode) => {
            const item = inventory.value.find(i => i.kode === kode);
            return item ? item.stok : 0;
        };

        const removeFromCart = (kode) => {
            cart.value = cart.value.filter(item => item.kode !== kode)
        };

        const resetTransactionForm = () => {
            cart.value = [];
            txNote.value = '';
            searchQuery.value = '';
            inputQty.value = '';

            if (departments.value?.length > 0) {
                txDept.value = departments.value[0];
            } else {
                txDept.value = '';
            }

            txType.value = 'KELUAR';

            if (typeof isDeptValid !== 'undefined') {
                isDeptValid.value = true;
            }
        };

        const startScanner = () => {
            showScanner.value = true;

            // Gunakan nextTick agar elemen #reader sudah ada di DOM sebelum diakses
            nextTick(() => {
                const readerElement = document.getElementById('reader');
                if (!readerElement) {
                    console.error("Elemen 'reader' tidak ditemukan.");
                    return;
                }

                if (!html5QrCode) {
                    html5QrCode = new Html5Qrcode("reader");
                }

                html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        qrbox: { width: 250, height: 150 }
                    },
                    (decodedText) => {
                        // Masukkan hasil scan ke v-model inventorySearch
                        inventorySearch.value = decodedText.trim();

                        // Tutup scanner setelah berhasil
                        stopScanner();

                        // Getar singkat sebagai feedback
                        if (navigator.vibrate) navigator.vibrate(100);
                    }
                ).catch(err => {
                    console.error("Gagal kamera:", err);
                    alert("Kamera tidak aktif. Pastikan izin diberikan.");
                    showScanner.value = false;
                });
            });
        };

        const stopScanner = async () => {
            if (html5QrCode && html5QrCode.isScanning) {
                try {
                    await html5QrCode.stop();
                    html5QrCode.clear();
                } catch (err) {
                    console.warn("Gagal menghentikan stream:", err);
                }
            }
            showScanner.value = false;
        };

        const getJenisClass = (jenis) => {
            switch (jenis) {
                case 'MASUK': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
                case 'KELUAR': return 'bg-rose-50 text-rose-700 border-rose-100';
                case 'OPNAME': return 'bg-amber-50 text-amber-700 border-amber-100';
                default: return 'bg-slate-50 text-slate-600 border-slate-100';
            }
        };

        const tambahItemManualByKode = () => {
            const kodeCari = inputKodeManual.value.trim().toUpperCase();
            if (!kodeCari) return;

            // 1. Cari di data master inventory (VLOOKUP)
            const masterItem = inventory.value.find(i => i.kode.toUpperCase() === kodeCari);

            if (masterItem) {
                // 2. Cek Duplikasi (Jangan sampai barang yang sama masuk 2x)
                const exists = summarySppItems.value.find(s => s.kode === masterItem.kode);

                if (exists) {
                    showToast("Barang ini sudah ada di dalam list SPP!");
                    inputKodeManual.value = '';
                    return;
                }

                // 3. Logika Perhitungan Qty (Sama dengan logika stok kritis)
                const stokSekarang = Number(masterItem.stok || 0);
                const batasMinimal = Number(masterItem.minStok || 0);
                let saranQty = (batasMinimal * 2) - stokSekarang;
                if (saranQty <= 0) saranQty = 1;

                // 4. Masukkan ke list SPP
                summarySppItems.value.push({
                    kode: masterItem.kode || '-',
                    nama: masterItem.nama || '-',
                    satuan: masterItem.satuan || 'Pcs',
                    stok: stokSekarang,
                    qtyDiminta: saranQty,
                    jmlPakai: 0,
                    keterangan: ''
                });

                // 5. Bersihkan Input
                inputKodeManual.value = '';

            } else {
                showToast("Kode Barang [" + kodeCari + "] tidak ditemukan di database!");
            }
        };

        const tambahSemuaKeSpp = () => {
            if (lowStockItems.value.length === 0) {
                showToast("Tidak ada item untuk ditambahkan", "warning");
                return;
            }

            let count = 0;
            let duplicateCount = 0;

            lowStockItems.value.forEach(item => {
                // 1. Cek Duplikasi
                const exists = summarySppItems.value.find(s => s.kode === item.kode);

                if (!exists) {
                    const stokSekarang = Number(item.stok || 0);
                    const batasMinimal = Number(item.minStok || 0);

                    // 2. Hitung Saran Qty
                    let saranQty = (batasMinimal * 2) - stokSekarang;
                    if (saranQty <= 0) saranQty = 1;

                    // 3. Push ke Summary
                    summarySppItems.value.push({
                        kode: item.kode || '-',
                        nama: item.nama || '-',
                        satuan: item.satuan || 'Pcs',
                        stok: stokSekarang,
                        qtyDiminta: saranQty,
                        jmlPakai: 0,
                        keterangan: ''
                    });
                    count++;
                } else {
                    duplicateCount++;
                }
            });

            // 4. Feedback & Navigasi menggunakan Toast
            if (count > 0) {
                showToast(`Berhasil menambah ${count} item ke SPP`, "success");
                showLowStock.value = false;
                page.value = 'spp';
            } else if (duplicateCount > 0) {
                showToast("Semua item sudah ada di dalam list SPP", "info");
            }
        };

        const chunkedSppItems = computed(() => {
            const chunks = [];
            const items = [...summarySppItems.value];
            while (items.length > 0) {
                chunks.push(items.splice(0, 17));
            }
            // Jika benar-benar kosong, kasih array kosong agar minimal 1 kertas muncul
            return chunks.length > 0 ? chunks : [[]];
        });

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

        const downloadSPPPDF = () => {
            const { jsPDF } = window.jspdf;
            // Inisialisasi A4 Landscape (297mm x 210mm)
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

        // Fungsi Konfirmasi Masuk ke Form Reservasi
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

        const paginatedItems = computed(() => {
            const pages = [];
            const items = reservasiItems.value;
            for (let i = 0; i < items.length; i += itemsPerPage) {
                pages.push(items.slice(i, i + itemsPerPage));
            }
            if (pages.length === 0) pages.push([]);
            return pages;
        });

        // Fungsi Cetak (Memicu dialog print browser)
        const handlePrint = () => {
            if (reservasiItems.value.length === 0) {
                alert("Daftar permintaan masih kosong!");
                return;
            }
            window.print();
        };

        const handleCancelTx = async (tx) => {
            const ketString = String(tx.ket || "").toUpperCase();

            if (ketString.includes("[DIBATALKAN]")) return;
            if (cancellingId.value === tx.rowId) return;

            if (!confirm(`Batalkan transaksi ${tx.nama}?`)) return;

            cancellingId.value = tx.rowId;

            try {
                const res = await callAPI('CANCEL_TX', {
                    token: userData.value.token,
                    rowId: tx.rowId
                });

                if (res.status === 'success') {
                    tx.ket = "[DIBATALKAN] " + (tx.ket || "");
                    showToast("✅ Transaksi berhasil dibatalkan!");

                    await fetchAllData();

                } else {
                    showToast("❌ " + res.message);
                }

            } catch (e) {
                showToast("🚨 Gangguan server");
            } finally {
                cancellingId.value = null;
            }
        };

        const isVoided = (tx) => {
            const ketString = String(tx.ket || '').toUpperCase();
            return ketString.includes('[DIBATALKAN]');
        };

        const sortBy = (key) => {
            if (sortKey.value === key) {
                if (sortOrder.value === 1) {
                    // Jika sedang Asc, ubah ke Desc
                    sortOrder.value = -1;
                } else {
                    // Jika sedang Desc, matikan sortir (Reset)
                    sortKey.value = '';
                    sortOrder.value = 1;
                    showToast("Urutan dikembalikan ke asli", "success");
                }
            } else {
                // Klik kolom baru
                sortKey.value = key;
                sortOrder.value = 1;
            }
        };

        const resetAllFilters = () => {
            inventorySearch.value = '';
            filterLocation.value = '';
            sortKey.value = '';
            sortOrder.value = 1;
            showToast("Filter dibersihkan", "success");
        };

        const openAddModal = () => {
            isEditMode.value = false;
            formItem.value = { kode: '', nama: '', satuan: '', lokasi: '', foto: '', minStok: 0, status: 'AKTIF' };
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
                minStok: item.minStok || 0,
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

        const saveNewLocation = async () => {
            if (!locationForm.value.lokasi.trim()) return alert("Lokasi tidak boleh kosong");

            loading.value = true;
            try {
                const res = await callAPI('UPDATE_LOCATION', {
                    kode: locationForm.value.kode,
                    lokasiBaru: locationForm.value.lokasi,
                    userNama: userData.value.nama
                });

                if (res.status === 'success') {
                    // Update di UI lokal
                    const targetItem = inventory.value.find(i => i.kode === locationForm.value.kode);
                    if (targetItem) targetItem.lokasi = locationForm.value.lokasi;

                    showLocationModal.value = false;
                    // Opsional: tambahkan toast/notifikasi sukses kecil di sini
                } else {
                    alert("Gagal: " + res.message);
                }
            } finally {
                loading.value = false;
            }
        };

        const saveItem = async () => {
            loading.value = true;
            try {
                const res = await callAPI('ADMIN_SAVE_ITEM', formItem.value);
                if (res.status === 'success') {
                    alert(res.message);
                    showItemModal.value = false;

                    // Refresh Data Barang agar tabel terupdate secara real-time
                    const result = await callAPI('ADMIN_GET_ITEMS');
                    if (result.status === 'success' && Array.isArray(result.data)) {
                        inventory.value = result.data;
                    } else if (Array.isArray(result)) {
                        inventory.value = result;
                    }

                    // Reset form setelah simpan sukses
                    formItem.value = { kode: '', nama: '', category: '', minStok: 0, foto: '' };
                } else {
                    alert("Error: " + res.message);
                }
            } catch (err) {
                alert("Gagal terhubung ke Database GAS");
            } finally {
                loading.value = false;
            }
        };

        const toggleStatus = async (item) => {
            const action = item.status === 'AKTIF' ? 'menonaktifkan' : 'mengaktifkan';
            if (!confirm(`Apakah Anda yakin ingin ${action} barang "${item.nama}"?`)) return;

            loading.value = true;
            try {
                // 2. Hitung status baru
                const newStatus = item.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';

                // 3. Panggil API (Menggunakan parameter kode dan status baru)
                const res = await callAPI('ADMIN_TOGGLE_STATUS', {
                    kode: item.kode,
                    status: newStatus
                });

                if (res.status === 'success') {
                    // 4. Update langsung di UI agar tidak perlu reload seluruh data
                    item.status = newStatus;

                    // Opsional: Jika ingin sinkronasi total, panggil refresh data
                    // const updatedItems = await callAPI('ADMIN_GET_ITEMS');
                    // inventory.value = updatedItems;

                    console.log(res.message);
                } else {
                    alert("Gagal mengubah status: " + res.message);
                }
            } catch (error) {
                console.error(error);
                alert("Terjadi kesalahan sistem saat mengubah status.");
            } finally {
                loading.value = false;
            }
        };

        const fetchUsers = async () => {
            if (userData.value.role !== 'ADMIN') return;
            const res = await callAPI('GET_USERS');
            // code.gs Anda mengembalikan { status: 'success', data: [...] } atau langsung array? 
            // Berdasarkan baris: return data.slice(1).map(...) di code.gs anda:
            if (Array.isArray(res)) {
                adminUsers.value = res;
            } else if (res.status === 'success') {
                adminUsers.value = res.users || res.data; // Menyesuaikan jika ada pembungkus status
            } else {
                console.error("Gagal load user:", res.message);
            }
        };

        const approveWithRole = async (user, selectedRole) => {
            user.role = selectedRole;
            user.status = 'AKTIF';

            try {
                const res = await callAPI('ADMIN_MANAGE_USER', {
                    targetUser: user.username,
                    manageAction: 'APPROVE',
                    payload: selectedRole
                });

                if (res.status === 'success') {
                    showToast(`User ${user.username} berhasil disetujui sebagai ${selectedRole}!`);
                    if (typeof fetchUsers === 'function') fetchUsers();
                } else {
                    showToast("Gagal menyetujui user: " + res.message);
                }
            } catch (error) {
                console.error("Error Approval:", error);
                showToast("Terjadi kesalahan koneksi saat menyetujui user.");
            }
        };

        const deleteUser = async (u) => {
            if (!confirm(`Hapus user ${u.nama}?`)) return;
            const res = await callAPI('ADMIN_MANAGE_USER', {
                targetUser: u.username,
                manageAction: 'DELETE'
            });
            if (res.status === 'success') {
                fetchUsers();
            } else { alert(res.message); }
        };

        const toggleUser = async (u) => {
            const res = await callAPI('ADMIN_MANAGE_USER', {
                targetUser: u.username,
                manageAction: 'TOGGLE_STATUS'
            });
            if (res.status === 'success') {
                fetchUsers();
            } else { alert(res.message); }
        };

        const updateUserRole = async (u) => {
            const res = await callAPI('ADMIN_MANAGE_USER', {
                targetUser: u.username,
                manageAction: 'UPDATE_ROLE',
                payload: u.role
            });
            if (res.status === 'success') {
                // Berhasil, tidak perlu alert agar user experience lancar
            } else {
                alert(res.message);
                fetchUsers(); // Rollback UI jika gagal
            }
        };

        const openEditProfile = () => {
            showPass.value = false;
            profileForm.nama = userData.value.nama;
            profileForm.password = '';
            showProfileModal.value = true;
        };

        const handleUpdateProfile = async () => {
            if (profileForm.password && profileForm.password.length < 6) return alert("Min 6 karakter!");
            loadingProfile.value = true;
            const res = await callAPI('UPDATE_PROFILE', {
                newNama: profileForm.nama,
                newPassword: profileForm.password
            });
            if (res.status === 'success') {
                userData.value.nama = profileForm.nama;
                localStorage.setItem('user_session', JSON.stringify(userData.value));
                showProfileModal.value = false;
                alert("Berhasil!");
            }
            loadingProfile.value = false;
        };

        const exportToExcel = () => {
            try {
                let dataToExport = [];
                let fileName = "";
                const timestamp = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');

                // === 1. EKSPOR STOK KRITIS / LOW STOCK ===
                if (showLowStock.value) {
                    if (!lowStockItems.value.length) return alert("Data stok kritis kosong!");

                    dataToExport = lowStockItems.value.map(item => ({
                        "KODE BARANG": item.kode,
                        "NAMA BARANG": item.nama,
                        "SATUAN": item.satuan,
                        "STOK SAAT INI": item.stok,
                        "MINIMUM STOK": item.minStok,
                        "SARAN ORDER (PR)": item.qtyRequest
                    }));
                    fileName = `Rencana_Order_PR_${timestamp}.xlsx`;

                    // === 2. EKSPOR INVENTORY / MASTER BARANG ===
                } else if (page.value === 'inventory' || page.value === 'master_barang') {
                    if (!filteredInventory.value.length) return alert("Data stok kosong!");

                    // Gunakan filteredInventory agar mengikuti filter halaman
                    dataToExport = filteredInventory.value.map(item => ({
                        "KODE": item.kode,
                        "NAMA BARANG": item.nama,
                        "CATEGORY": item.category || "-",
                        "SATUAN": item.satuan,
                        "LOKASI": item.lokasi || "-",
                        "STOK": item.stok,
                        "STATUS": item.stok <= item.minStok ? "LOW" : "AMAN"
                    }));
                    fileName = `Stock_Holding_${timestamp}.xlsx`;

                    // === 3. EKSPOR RIWAYAT TRANSAKSI ===
                } else if (page.value === 'riwayat') {
                    if (!filteredHistory.value.length) return alert("Data riwayat kosong!");

                    dataToExport = filteredHistory.value.map(tx => ({
                        "TANGGAL": tx.tanggal,
                        "USER": tx.user,
                        "KODE": tx.kode,
                        "NAMA BARANG": tx.nama,
                        "JENIS": tx.jenis,
                        "QTY": tx.qty,
                        "DEPT": tx.dept || "-",
                    }));
                    fileName = `Riwayat_Transaksi_${timestamp}.xlsx`;
                }

                // === GENERATE FILE XLSX MENGGUNAKAN SHEETJS ===
                const ws = XLSX.utils.json_to_sheet(dataToExport);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Data");

                // Trigger download file
                XLSX.writeFile(wb, fileName);

            } catch (e) {
                console.error("Gagal export:", e);
                alert("Terjadi kesalahan saat mengekspor data.");
            }
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

        const filteredHistory = computed(() => {
            let data = recentTx.value || [];

            // Filter berdasarkan pencarian jika ada
            if (searchQuery.value) {
                const q = searchQuery.value.toLowerCase();
                data = data.filter(tx =>
                    tx.nama.toLowerCase().includes(q) ||
                    tx.kode.toLowerCase().includes(q) ||
                    tx.dept?.toLowerCase().includes(q)
                );
            }

            // Kembalikan hanya 200 data teratas
            return data.slice(0, 200);
        });

        const categoryOptions = computed(() => {
            if (!inventory.value) return []

            const categories = inventory.value
                .map(item => item.category)
                .filter(cat => cat)

            return [...new Set(categories)]
        });

        const uniqueLocations = computed(() => {
            if (!inventory.value) return [];

            const areas = inventory.value.map(item => {
                const loc = String(item.lokasi || '');
                if (loc.includes('-')) {
                    // Ambil teks sebelum strip dan hapus spasi kosong
                    return loc.split('-')[0].trim();
                }
                return loc.trim();
            }).filter(Boolean);

            // Ambil nilai unik dan urutkan
            return [...new Set(areas)].sort();
        });

        const sortedMaster = computed(() => {
            let data = inventory.value ? [...inventory.value] : [];

            // Filter berdasarkan Pencarian Teks
            if (inventorySearch.value) {
                const s = inventorySearch.value.toLowerCase();
                data = data.filter(i =>
                    i.nama.toLowerCase().includes(s) ||
                    i.kode.toLowerCase().includes(s) ||
                    i.lokasi.toLowerCase().includes(s)
                );
            }

            // Filter berdasarkan Lokasi Rak
            if (filterLocation.value) {
                data = data.filter(i => {
                    const areaName = String(i.lokasi || '').split('-')[0].trim();
                    return areaName === filterLocation.value;
                });
            }

            // Logika Sorting (Tetap seperti sebelumnya)
            if (sortKey.value) {
                data.sort((a, b) => {
                    let valA = a[sortKey.value];
                    let valB = b[sortKey.value];
                    if (sortKey.value === 'stok' || sortKey.value === 'minStok') {
                        return (Number(valA) - Number(valB)) * sortOrder.value;
                    }
                    return String(valA).localeCompare(String(valB)) * sortOrder.value;
                });
            }
            return data;
        });

        const searchResults = computed(() => {
            if (!searchQuery.value) return [];
            const q = searchQuery.value.toLowerCase();
            return inventory.value.filter(i => i.nama.toLowerCase().includes(q) || i.kode.toLowerCase().includes(q)).slice(0, 12);
        });

        const isDeptValid = computed(() => {
            if (txType.value === 'OPNAME') return true
            return departments.value.includes(txDept.value)
        });

        const filteredInventory = computed(() => {

            if (!inventory.value) return []

            const query = inventorySearch.value?.toLowerCase() || ''
            const selectedCategory = categoryFilter.value

            return inventory.value.filter(item => {

                if (item.status !== 'AKTIF') return false

                const qty = Number(item.stok || 0)

                const stockRules = {
                    available: qty > 0,
                    empty: qty === 0,
                    all: true
                }

                const stockCondition = stockRules[stockFilter.value]

                const categoryCondition =
                    selectedCategory === 'all' ||
                    (item.category && item.category === selectedCategory)

                const matchesSearch =
                    (item.nama && item.nama.toLowerCase().includes(query)) ||
                    (item.kode && item.kode.toLowerCase().includes(query)) ||
                    (item.lokasi && item.lokasi.toLowerCase().includes(query)) ||
                    (item.category && item.category.toLowerCase().includes(query))

                return stockCondition && categoryCondition && matchesSearch
            })
        });

        const searchInMaster = computed(() => {

            if (!inventory.value) return [];

            const query = inventorySearch.value?.toLowerCase() || '';

            if (!query) return inventory.value;

            return inventory.value.filter(i =>
                (i.nama && i.nama.toLowerCase().includes(query)) ||
                (i.kode && i.kode.toLowerCase().includes(query)) ||
                (i.lokasi && i.lokasi.toLowerCase().includes(query))
            );

        });

        const filteredAdminUsers = computed(() => {
            if (!userSearchQuery.value) return adminUsers.value;

            const q = userSearchQuery.value.toLowerCase();

            return adminUsers.value.filter(u => {
                const nama = (u.nama || '').toString().toLowerCase();
                const username = (u.username || '').toString().toLowerCase();

                return nama.includes(q) || username.includes(q);
            });
        });

        const handleLogout = () => {
            // 1. Hapus data dari LocalStorage
            localStorage.removeItem('token');

            // 2. Reset semua State Reaktif ke awal
            isLoggedIn.value = false;
            userToken.value = '';
            userData.value = { username: '', nama: '', role: '', canPreviewPhoto: false };
            location.reload();

            // 3. Bersihkan data sensitif dari memori
            inventory.value = [];
            adminUsers.value = [];
            cart.value = [];

            // 4. Hentikan semua interval (jika ada auto-refresh dashboard)
            if (dashboardInterval) clearInterval(dashboardInterval);
            if (inventoryInterval) clearInterval(inventoryInterval);

            // 5. Arahkan ke halaman dashboard/login
            page.value = 'dashboard';

            // Opsional: Berikan notifikasi kecil
            console.log("Sesi telah dibersihkan.");
        };

        onMounted(async () => {
            const saved = localStorage.getItem('user_session');
            if (saved) {
                const parsed = JSON.parse(saved);
                userData.value = parsed;
                userToken.value = parsed.token || "";

                const res = await callAPI('VALIDATE_SESSION');
                if (res.status === 'success') {
                    isLoggedIn.value = true;

                    // Gabungkan data: Pastikan res.canPreviewPhoto masuk ke userData
                    userData.value = {
                        ...parsed,
                        ...res,
                        // Paksa konversi ke boolean agar v-if tidak bingung
                        canPreviewPhoto: res.canPreviewPhoto === true || res.canPreviewPhoto === 1 || res.canPreviewPhoto === "TRUE"
                    };

                    console.log("Session Validated. Photo Access:", userData.value.canPreviewPhoto);
                    await fetchAllData();

                } else {
                    handleLogout();
                }
            }
        });

        return {
            // 1. CORE APP & AUTH STATE
            isLoggedIn, loading, isSubmitting, page, userRole, userData, loginData,
            handleLogin, handleLogout, navigate, toast,

            // 2. UI & NAVIGATION STATE
            sidebarOpen, showPassword, showPass, showCart, showLowStock, showRegisterModal,
            showLocationModal, showUserModal, showProfileModal, showItemModal, showPhotoModal,
            showScanner, showPopupDetail, closeModal, closeUserModal, closePhotoModal,

            // 3. INVENTORY & MASTER DATA
            inventory, inventorySearch, searchQuery, stockFilter, categoryOptions, categoryFilter,
            filterLocation, uniqueLocations, resetAllFilters, sortedMaster, sortKey, sortOrder,
            sortBy, filteredInventory, getMasterStock, searchInMaster, focusSearch,
            searchInputRef, departments, fixDriveUrl, searchResults,

            // 4. ITEM CRUD & MODALS
            formItem, isEditMode, openAddModal, editItem, saveItem, toggleStatus,
            selectedItem, formInput, saveNewLocation, openUpdateLocation,

            // 5. TRANSACTION & CART (WMS)
            cart, inputQty, qtyInputRef, addToCart, addToCartWithQty, removeFromCart,
            isStockInsufficient, lowStockItems, txType, txDept, txNote, txTanggal,
            processTx, resetTransactionForm, handleCancelTx, isVoided, cancellingId,
            filteredHistory, getJenisClass, recentTx,

            // 6. CAMERA, SCANNER & MEDIA
            scannerActive, isCameraActive, videoFeed, fileInput, startScanner, stopScanner,
            handleScan, openScanner, closeScanner, startLiveCamera, stopCamera, takeSnapshot,
            launchGallery, handleFileUpload, previewImage, openUpdateFoto, savePhotoOnly,
            removePhoto, isUploading, togglePhotoAccess, toggleUser,

            // 7. SPP (SURAT PERMOHONAN PEMBELIAN) & RESERVASI
            summarySppItems, inputKodeManual, tambahSemuaKeSpp, tambahItemManualByKode, kosongkanSpp,
            chunkedSppItems, removeItemSpp, sppSign, noSPP, txReservasi, reservasiItems, locationForm,
            reservasiMeta, bukaPopUpReservasi, tambahkanKeForm, itemsPerPage, paginatedItems,

            // 8. USER MANAGEMENT & PROFILE
            adminUsers, filteredAdminUsers, userSearchQuery, fetchUsers, updateUserRole,
            deleteUser, newUser, openUserModal, submitNewUser, regData, handleRegister,
            profileForm, loadingProfile, openEditProfile, handleUpdateProfile, approveWithRole,

            // 9. DASHBOARD & REPORTING
            dashData, dashFilter, fetchDashboard, handlePrint, downloadPDF,
            downloadSPPPDF, exportToExcel, docNumber
        };
    }
}).mount('#app');
