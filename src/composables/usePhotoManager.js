export function usePhotoManager({
    Vue, videoFeed, fileInput, photoPreview, previewSource, photoUrlInput, formItem, showPhotoModal,
    showItemModal, isEditMode, isUploading, isCameraActive, dragCounter, isDragOver, previewGallery,
    inventory, catalog, showToast, createWatermarkedImage, fixDriveUrl, readFilePreview, saveUploadedPhoto,
    refreshPhotoList, fetchPhotos, deletePhoto, deleteFromDrive, setCoverPhoto, startCamera, stopCameraCore
}) {
    const { computed, nextTick } = Vue;

    const canUploadPhoto = computed(() => {
        return isEditMode.value && !!formItem.value.kode;
    });

    const launchGallery = () => {
        if (!fileInput.value) return;

        fileInput.value.value = "";
        fileInput.value.click();
    };

    const clearPreview = () => {
        photoPreview.value = null;
        previewSource.value = null;
        photoUrlInput.value = "";

        if (fileInput.value) {
            fileInput.value.value = "";
        }
    };

    const updatePhotoCache = (list, kode, latest) => {
        if (!Array.isArray(list)) return;

        const index = list.findIndex(item => item.kode === kode);
        if (index === -1) return;

        list[index] = {
            ...list[index],
            inventory_photos: [...latest]
        };
    };

    const buildPreviewFromImage = async (img, source) => {
        photoPreview.value = await createWatermarkedImage(img, formItem.value.kode);
        previewSource.value = source;
    };

    const processImageSource = async (blobOrFile, source) => {
        const rawBase64 = await readFilePreview(blobOrFile);
        const img = new Image();

        await new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                    await buildPreviewFromImage(img, source);
                    resolve();
                } catch (err) { reject(err); }
            };
            img.onerror = () => reject(new Error("Gagal membaca file gambar."));
            img.src = rawBase64;
        });
    };

    const handleGallerySelected = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        await processImageFile(file);
    };

    const handleUrlSelected = async () => {
        let url = photoUrlInput.value.trim();

        if (!url) {
            showToast("Masukkan URL gambar yang valid.", "error");
            return;
        }

        try {
            showToast("Mengambil gambar...", "info");

            if (url.includes("drive.google.com")) {
                url = fixDriveUrl(url);
            } else {
                url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Gagal mengambil gambar dari URL tersebut.");
            }

            const blob = await response.blob();
            if (!blob.type.startsWith("image/")) {
                throw new Error("URL bukan file gambar.");
            }

            await processImageSource(blob, "url");
            photoUrlInput.value = "";
            showToast("Gambar berhasil dimuat dan diberi watermark.", "success");
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Terjadi kesalahan saat memuat URL.", "error");
        }
    };

    const handleTakePhoto = async () => {
        if (!videoFeed.value || videoFeed.value.readyState < 4) {
            showToast("Kamera belum siap", "error");
            return;
        }

        try {
            photoPreview.value = await createWatermarkedImage(videoFeed.value, formItem.value.kode);
            previewSource.value = "camera";
            stopCamera();
            showToast("Foto berhasil diambil! Silakan tinjau.", "success");
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Gagal mengambil foto.", "error");
        }
    };

    const removePhoto = async (photo) => {
        if (!confirm("Hapus foto ini?")) return;
        try {
            if (photo.drive_file_id) await deleteFromDrive(photo.drive_file_id);
            await deletePhoto(photo.id);
            await refreshPhotos(formItem.value.kode);
            showToast("Foto berhasil dihapus", "success");
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Gagal menghapus foto.", "error");
        }
    };

    const openUpdateFoto = async (item) => {
        try {
            const photos = await fetchPhotos(item.kode);
            formItem.value = {
                kode: item.kode,
                nama: item.nama,
                satuan: item.satuan || "",
                lokasi: item.lokasi || "",
                category: item.category || "",
                min_stok: item.min_stok || 0,
                status: item.status || "AKTIF",
                photos,
                selectedPhoto: photos.find(p => p.is_cover) || photos[0] || null
            };

            clearPreview();
            stopCamera();
            showPhotoModal.value = true;
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Gagal memuat daftar foto.", "error");
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();

        dragCounter.value = 0;
        isDragOver.value = false;

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        await processImageFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();

        dragCounter.value++;

        isDragOver.value = true;
    };

    const handleDragLeave = (e) => {
        e.preventDefault();

        dragCounter.value--;

        if (dragCounter.value <= 0) {
            dragCounter.value = 0;
            isDragOver.value = false;
        }
    };

    const processImageFile = async (file) => {
        try {
            if (!file.type.startsWith("image/")) {
                showToast("File harus berupa gambar.", "error");
                return;
            }

            await processImageSource(file, "gallery");
            showToast("Gambar berhasil diproses.", "success");
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Gagal memproses gambar.", "error");
        }
    };

    const confirmAndUploadPhoto = async () => {
        if (isUploading.value) return;
        if (!photoPreview.value) {
            showToast("Belum ada foto yang akan diupload.", "error");
            return;
        }

        isUploading.value = true;
        try {
            const base64Clean = photoPreview.value.includes(",") ? photoPreview.value.split(",")[1] : photoPreview.value;
            await saveUploadedPhoto({ base64: base64Clean });
            await refreshPhotos(formItem.value.kode);

            clearPreview();
            stopCamera();
            showToast("Foto berhasil diupload.", "success");
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Proses upload gagal.", "error");
        } finally {
            isUploading.value = false;
        }
    };

    const refreshPhotos = async (kode) => {
        try {
            const latest = await refreshPhotoList(kode);

            updatePhotoCache(inventory.inventory?.value, kode, latest);
            updatePhotoCache(inventory.serverResults?.value, kode, latest);
            updatePhotoCache(catalog.catalogItems?.value, kode, latest);

            if (formItem.value.kode === kode) {
                formItem.value.photos = [...latest];
                formItem.value.selectedPhoto = latest.find((p) => p.is_cover) || latest[0] || null;
            }

            return latest;
        } catch (err) {
            console.error("Refresh Photo Error:", err);
            showToast(err?.message || "Gagal refresh foto.", "error");
            throw err;
        }
    };

    const resetPhotoState = () => {
        stopCamera();
        clearPreview();
        isUploading.value = false;
        dragCounter.value = 0;
        isDragOver.value = false;
    };

    const closePhotoModal = () => {
        resetPhotoState();
        showPhotoModal.value = false;
    };

    const closeModal = () => {
        resetPhotoState();
        showItemModal.value = false;
    };

    const cancelPreview = async () => {
        const source = previewSource.value;

        clearPreview();

        if (source === "camera") {
            await nextTick();
            await startLiveCamera();
        }
    };

    const startLiveCamera = async () => {
        if (isCameraActive.value) return;

        isCameraActive.value = true;
        await nextTick();

        try {
            await startCamera();
            previewSource.value = "camera";
        } catch (err) {
            isCameraActive.value = false;
            console.error(err);
            showToast(err?.message || "Gagal membuka kamera.", "error");
        }
    };

    const stopCamera = () => {
        try {
            stopCameraCore();
        } catch (err) {
            console.error("Stop camera error:", err);
        } finally {
            isCameraActive.value = false;

            if (videoFeed.value) {
                videoFeed.value.srcObject = null;
            }
        }
    };

    const selectPhoto = (photo) => {
        formItem.value.selectedPhoto = photo;
    };

    const makeCover = async (photo) => {
        try {
            await setCoverPhoto(formItem.value.kode, photo.id);
            await refreshPhotos(formItem.value.kode);
            showToast("Foto utama berhasil diperbarui", "success");
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Gagal mengubah foto utama.", "error");
        }
    };

    const openPreviewGallery = async (photos = [], kode = null) => {
        try {
            let list = photos;
            if (kode) list = await fetchPhotos(kode);

            if (!Array.isArray(list) || !list.length) {
                showToast("Belum ada foto.", "info");
                return;
            }

            previewGallery.value = {
                show: true,
                photos: [...list],
                current: Math.max(list.findIndex(p => p.is_cover), 0)
            };
        } catch (err) {
            console.error(err);
            showToast("Gagal membuka galeri.", "error");
        }
    };

    const closePreviewGallery = () => {
        previewGallery.value = {
            show: false,
            photos: [],
            current: 0
        };
    };

    const nextPreview = () => {
        if (!previewGallery.value.photos.length) return;

        previewGallery.value.current =
            (previewGallery.value.current + 1) %
            previewGallery.value.photos.length;
    };

    const prevPreview = () => {
        if (!previewGallery.value.photos.length) return;

        previewGallery.value.current =
            (previewGallery.value.current - 1 +
                previewGallery.value.photos.length) %
            previewGallery.value.photos.length;
    };

    const currentPreviewPhoto = computed(() => {
        return previewGallery.value.photos[previewGallery.value.current] || null;
    });

    return {
        canUploadPhoto, launchGallery, handleGallerySelected, handleUrlSelected, handleTakePhoto, removePhoto,
        openUpdateFoto, processImageFile, handleDrop, handleDragOver, handleDragEnter, handleDragLeave, confirmAndUploadPhoto,
        refreshPhotos, resetPhotoState, closePhotoModal, closeModal, cancelPreview, startLiveCamera, stopCamera,
        selectPhoto, makeCover, openPreviewGallery, closePreviewGallery, nextPreview, prevPreview, currentPreviewPhoto
    };
}