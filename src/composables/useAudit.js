const { ref, computed, nextTick } = Vue;
import { uploadToDrive, deleteFromDrive } from "../services/driveService.js";
import { compressImage } from "../utils/imageUtils.js";
import { createMonitoringWatermarkedImage, getCurrentLocation } from "../utils/photoprocessor.js";

export function useAuditLogs({ supabaseClient, userData, showToast, previewGallery }) {
	const logs = ref([]);
	const loading = ref(false);
	const isDeleting = ref(false);
	const deletingLogId = ref(null);
	const isSubmitting = ref(false);
	const searchQuery = ref("");
	const filterStatus = ref("ALL");
	const filterKategori = ref("ALL");
	const filterArea = ref("");
	const showAddModal = ref(false);
	const showAfterModal = ref(false);
	const showDetailModal = ref(false);
	const selectedLog = ref(null);

	const formBefore = ref({
		judul: "",
		area_lokasi: "",
		kategori: "METERAN",
		barang_kode: "",
		keterangan_before: "",
		photos: []
	});

	const formAfter = ref({
		id: null,
		keterangan_after: "",
		photos: []
	});


	const isCameraActive = ref(false);
	const cameraTarget = ref(null);
	const mediaStream = ref(null);

	const getCameraElement = (target) => {
		const id = target === "AFTER" ? "monitoring-camera-after" : "monitoring-camera-before";
		return document.getElementById(id);
	};

	const kategoriOptions = ["5S", "MAINTENANCE", "SAFETY", "KERUSAKAN", "METERAN", "LAINNYA"];

	const loadLogs = async () => {
		loading.value = true;
		try {
			const { data, error } = await supabaseClient
				.from("monitoring_logs")
				.select("*")
				.order("created_at", { ascending: false });
			if (error) throw error;
			logs.value = Array.isArray(data) ? data : [];
		} catch (err) {
			console.error("Gagal memuat monitoring logs:", err);
			logs.value = [];
			showToast?.(err?.message || "Gagal mengambil data monitoring audit", "error");
		} finally {
			loading.value = false;
		}
	};

	const filteredLogs = computed(() => {
		return logs.value.filter((item) => {
			const matchQuery =
				!searchQuery.value ||
				item.judul?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
				item.area_lokasi?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
				item.auditor?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
				item.barang_kode?.toLowerCase().includes(searchQuery.value.toLowerCase());
			const matchStatus = filterStatus.value === "ALL" || item.status === filterStatus.value;
			const matchKategori = filterKategori.value === "ALL" || item.kategori === filterKategori.value;
			const matchArea = !filterArea.value || item.area_lokasi?.toLowerCase().includes(filterArea.value.toLowerCase());
			return matchQuery && matchStatus && matchKategori && matchArea;
		});
	});

	const stats = computed(() => {
		const total = logs.value.length;
		const open = logs.value.filter((l) => l.status === "OPEN").length;
		const closed = logs.value.filter((l) => l.status === "CLOSED").length;
		return { total, open, closed };
	});

	const openPhotoPreview = async (log, type = "BEFORE") => {
		if (!log?.id) return;
		try {
			let photos = await fetchMonitoringPhotos(log.id, type);
			if (!photos.length) {
				const legacyUrl = type === "AFTER" ? log.photo_after_url : log.photo_before_url;
				const legacyId = type === "AFTER" ? log.photo_after_id : log.photo_before_id;
				if (legacyUrl) {
					photos = [{ id: `${log.id}-${type}-legacy`, log_id: log.id, photo_type: type, photo_url: legacyUrl, drive_file_id: legacyId, sort_order: 0 }];
				}
			}
			if (!photos.length) {
				showToast?.(type === "AFTER" ? "Foto After belum tersedia." : "Foto Before belum tersedia.", "info");
				return;
			}
			previewGallery.value = { show: true, photos, current: 0 };
		} catch (err) {
			console.error("Open monitoring photo preview error:", err);
			showToast?.("Gagal membuka preview foto.", "error");
		}
	};

	const closePhotoPreview = () => {
		previewGallery.value = { show: false, photos: [], current: 0 };
	};

	const startCamera = async (target = "BEFORE") => {
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error("Kamera tidak didukung oleh browser atau halaman tidak menggunakan HTTPS.");
			}
			stopCamera();
			cameraTarget.value = target;
			isCameraActive.value = true;
			await nextTick();
			const video = getCameraElement(target);
			if (!video) {
				isCameraActive.value = false;
				throw new Error(`Elemen video untuk kamera ${target} tidak ditemukan.`);
			}
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: { ideal: "environment" },
					width: { ideal: 1280 },
					height: { ideal: 720 }
				},
				audio: false
			});
			mediaStream.value = stream;
			video.srcObject = stream;
			video.muted = true;
			video.setAttribute("playsinline", "");
			video.setAttribute("autoplay", "");
			await video.play();
		} catch (err) {
			console.error("Kamera gagal diakses:", err);
			isCameraActive.value = false;
			showToast?.(err?.message || "Gagal membuka kamera. Pastikan izin kamera diberikan.", "error");
		}
	};

	const stopCamera = () => {
		if (mediaStream.value) {
			mediaStream.value.getTracks().forEach((track) => track.stop());
			mediaStream.value = null;
		}
		const beforeVideo = document.getElementById("monitoring-camera-before");
		const afterVideo = document.getElementById("monitoring-camera-after");
		[beforeVideo, afterVideo].forEach((video) => {
			if (video) {
				video.pause();
				video.srcObject = null;
			}
		});
		isCameraActive.value = false;
		cameraTarget.value = null;
	};

	const capturePhotoFromCamera = async (target = "BEFORE") => {
		const video = getCameraElement(target);

		if (!video) {
			showToast?.("Elemen kamera tidak ditemukan.", "error");
			return;
		}
		if (!video.srcObject) {
			showToast?.("Kamera belum aktif.", "error");
			return;
		}
		if (!video.videoWidth || !video.videoHeight) {
			showToast?.("Kamera belum siap mengambil foto. Tunggu sebentar.", "error");
			return;
		}

		const photoList = target === "BEFORE" ? formBefore.value.photos : formAfter.value.photos;
		const MAX_PHOTOS = 6;

		if (photoList.length >= MAX_PHOTOS) {
			showToast?.(`Maksimal ${MAX_PHOTOS} foto ${target}.`, "warning");
			stopCamera();
			return;
		}

		try {
			showToast?.("Mengambil lokasi GPS...", "info");
			const location = await getCurrentLocation();
			const capturedAt = new Date();
			const watermarked = await createMonitoringWatermarkedImage(video, location, capturedAt);

			if (typeof watermarked !== "string" || !watermarked.startsWith("data:image/")) {
				throw new Error("Gagal menghasilkan foto watermark.");
			}

			photoList.push({
				id: `${target}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
				base64: watermarked,
				preview: watermarked,
				file: null,
				uploaded: false,
				uploading: false,
				uploadedUrl: null,
				driveFileId: null,
				latitude: location.latitude,
				longitude: location.longitude,
				accuracy: location.accuracy,
				capturedAt: capturedAt.toISOString()
			});

			stopCamera();
			showToast?.(`Foto ${target} berhasil diambil dengan watermark GPS.`, "success");
		} catch (err) {
			console.error("Capture foto monitoring error:", err);
			showToast?.(err?.message || "Gagal mengambil foto monitoring.", "error");
		}
	};

	const handleFileSelect = async (event, target = "BEFORE") => {
		const input = event?.target;
		const files = Array.from(input?.files || []);
		if (!files.length) return;

		const photoList = target === "BEFORE" ? formBefore.value.photos : formAfter.value.photos;
		const MAX_PHOTOS = 6;

		if (photoList.length >= MAX_PHOTOS) {
			showToast?.(`Maksimal ${MAX_PHOTOS} foto ${target}.`, "warning");
			if (input) input.value = "";
			return;
		}

		const availableSlots = MAX_PHOTOS - photoList.length;
		const selectedFiles = files.slice(0, availableSlots);

		if (files.length > availableSlots) {
			showToast?.(`Hanya ${availableSlots} foto yang bisa ditambahkan. Maksimal ${MAX_PHOTOS} foto.`, "warning");
		}

		let successCount = 0;

		for (const file of selectedFiles) {
			try {
				if (!file.type?.startsWith("image/")) {
					showToast?.(`${file.name} bukan file gambar.`, "error");
					continue;
				}

				const maxSize = 10 * 1024 * 1024;
				if (file.size > maxSize) {
					showToast?.(`${file.name} terlalu besar. Maksimal 10 MB.`, "error");
					continue;
				}

				const originalPreview = await new Promise((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => {
						if (typeof reader.result === "string") {
							resolve(reader.result);
						} else {
							reject(new Error("Preview gambar tidak valid."));
						}
					};
					reader.onerror = () => reject(reader.error || new Error("Gagal membaca gambar."));
					reader.readAsDataURL(file);
				});

				showToast?.(`Mengambil lokasi GPS untuk ${file.name}...`, "info");
				let location;

				try {
					location = await getCurrentLocation();
				} catch (gpsError) {
					console.error(`GPS gagal untuk ${file.name}:`, gpsError);
					if (gpsError?.code === 1) {
						showToast?.(`Foto ${file.name} tidak dapat diproses. Izin lokasi browser ditolak. Aktifkan izin lokasi untuk situs ini, kemudian pilih foto kembali.`, "error");
					} else {
						showToast?.(`Foto ${file.name} tidak dapat diproses. ${gpsError?.message || "Lokasi GPS tidak tersedia."}`, "error");
					}
					continue;
				}

				if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
					showToast?.(`Foto ${file.name} ditolak karena koordinat GPS tidak valid.`, "error");
					continue;
				}

				const img = await new Promise((resolve, reject) => {
					const image = new Image();
					image.onload = () => resolve(image);
					image.onerror = () => reject(new Error("Gagal memuat gambar."));
					image.src = originalPreview;
				});

				const capturedAt = new Date();
				const watermarked = await createMonitoringWatermarkedImage(img, location, capturedAt);

				if (typeof watermarked !== "string" || !watermarked.startsWith("data:image/")) {
					throw new Error("Gagal menghasilkan foto watermark GPS.");
				}

				photoList.push({
					id: `${target}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
					base64: watermarked,
					preview: watermarked,
					file,
					uploaded: false,
					uploading: false,
					uploadedUrl: null,
					driveFileId: null,
					latitude: location.latitude,
					longitude: location.longitude,
					accuracy: location.accuracy,
					capturedAt: capturedAt.toISOString()
				});

				successCount++;
			} catch (err) {
				console.error(`Gagal memproses foto ${file.name}:`, err);
				showToast?.(`${file.name}: ${err?.message || "Gagal memproses foto."}`, "error");
			}
		}

		if (input) input.value = "";

		if (successCount > 0) {
			showToast?.(`${successCount} foto berhasil ditambahkan dengan watermark GPS.`, "success");
		}
	};

	const cleanBase64 = (value) => {
		if (!value) return "";
		return value.includes(",") ? value.split(",")[1] : value;
	};

	const uploadPhoto = async (photoOrTarget, targetOrPhoto = "BEFORE", index = 0, showSuccessToast = true) => {
		let photo, target;
		if (typeof photoOrTarget === "string" && targetOrPhoto && typeof targetOrPhoto === "object") {
			target = photoOrTarget;
			photo = targetOrPhoto;
		} else {
			photo = photoOrTarget;
			target = targetOrPhoto;
		}
		if (!photo || typeof photo !== "object") {
			showToast?.("Data foto tidak valid.", "error");
			return false;
		}
		if (target !== "BEFORE" && target !== "AFTER") {
			showToast?.("Jenis foto tidak valid.", "error");
			return false;
		}
		if (isPhotoUploadComplete(photo)) return true;
		if (photo.uploading === true) return false;
		if (typeof photo.base64 !== "string" || !photo.base64.startsWith("data:image/")) {
			showToast?.(`Data foto ${target} #${index + 1} tidak valid.`, "error");
			return false;
		}
		photo.uploading = true;
		try {
			const title = target === "BEFORE" ? formBefore.value.judul || "AUDIT" : selectedLog.value?.judul || "AUDIT";
			const safeTitle = String(title).substring(0, 20).replace(/[^\w-]/g, "_");
			const filename = `${target}_${safeTitle}_${Date.now()}_${index + 1}.jpg`;
			const watermarkedResponse = await fetch(photo.base64);
			if (!watermarkedResponse.ok) throw new Error("Gagal membaca foto watermark.");
			const watermarkedBlob = await watermarkedResponse.blob();
			const watermarkedFile = new File([watermarkedBlob], filename, { type: "image/jpeg", lastModified: Date.now() });
			const compressedBase64 = await compressImage(watermarkedFile, { maxSize: 1280, quality: 0.8, mimeType: "image/jpeg" });
			if (typeof compressedBase64 !== "string" || !compressedBase64) throw new Error("Gagal melakukan kompresi foto.");
			const compressedSizeBytes = Math.ceil((compressedBase64.length * 3) / 4);
			photo.compressedBase64 = compressedBase64;
			const uploadRes = await uploadToDrive(cleanBase64(compressedBase64), filename, "AUDIT");
			if (!uploadRes || !uploadRes.url || !uploadRes.fileId) throw new Error("Upload Drive tidak memberikan URL atau File ID.");
			photo.uploadedUrl = uploadRes.url;
			photo.driveFileId = uploadRes.fileId;
			photo.uploaded = true;
			if (showSuccessToast) showToast?.(`Foto ${target} #${index + 1} berhasil diupload.`, "success");
			return true;
		} catch (err) {
			console.error(`[AUDIT] Upload foto ${target} #${index + 1} gagal:`, err);
			photo.uploaded = false;
			photo.uploadedUrl = null;
			photo.driveFileId = null;
			photo.compressedBase64 = null;
			showToast?.(err?.message || `Gagal upload foto ${target} #${index + 1}.`, "error");
			return false;
		} finally {
			photo.uploading = false;
		}
	};

	const uploadAllPhotos = async (target = "BEFORE") => {
		const photoList = target === "BEFORE" ? formBefore.value.photos : formAfter.value.photos;
		if (!Array.isArray(photoList) || photoList.length === 0) {
			showToast?.(`Belum ada foto ${target}.`, "warning");
			return false;
		}
		const pendingPhotos = photoList.filter((photo) => !isPhotoUploadComplete(photo) && photo.uploading !== true);
		if (pendingPhotos.length === 0) {
			await nextTick();
			return photoList.every(isPhotoUploadComplete);
		}
		let successCount = 0, failedCount = 0;
		showToast?.(`Memulai upload ${pendingPhotos.length} foto ${target}...`, "info");
		for (const photo of pendingPhotos) {
			const index = photoList.indexOf(photo);
			try {
				const success = await uploadPhoto(photo, target, index, false);
				if (success) successCount++;
				else failedCount++;
			} catch (error) {
				failedCount++;
				console.error(`Upload foto ${target} #${index + 1} exception:`, error);
			}
		}
		await nextTick();
		const remaining = photoList.filter((photo) => !isPhotoUploadComplete(photo));
		if (remaining.length > 0) {
			showToast?.(`${successCount} foto berhasil, ${remaining.length} foto belum berhasil upload. Silakan upload ulang.`, "warning");
			return false;
		}
		showToast?.(`Semua ${photoList.length} foto ${target} berhasil diupload.`, "success");
		return true;
	};

	const isPhotoUploadComplete = (photo) => Boolean(photo && photo.uploaded === true && photo.uploading !== true && photo.uploadedUrl && photo.driveFileId);

	const canSaveBefore = computed(() => {
		const form = formBefore.value;
		if (!form.judul?.trim() || !form.area_lokasi?.trim() || !form.keterangan_before?.trim()) return false;
		if (!Array.isArray(form.photos) || form.photos.length === 0) return false;
		return form.photos.every(isPhotoUploadComplete);
	});

	const canSaveAfter = computed(() => {
		const form = formAfter.value;
		if (!form.id || !form.keterangan_after?.trim()) return false;
		if (!Array.isArray(form.photos) || form.photos.length === 0) return false;
		return form.photos.every(isPhotoUploadComplete);
	});

	const validateUploadedPhotos = (photos, target) => {
		if (!Array.isArray(photos) || !photos.length) {
			showToast?.(`Minimal 1 foto ${target} wajib ditambahkan.`, "warning");
			return false;
		}
		const uploading = photos.filter((photo) => photo.uploading);
		if (uploading.length > 0) {
			showToast?.(`Masih ada ${uploading.length} foto ${target} yang sedang diupload.`, "warning");
			return false;
		}
		const pending = photos.filter((photo) => !photo.uploaded);
		if (pending.length > 0) {
			showToast?.(`${pending.length} foto ${target} belum berhasil diupload. Semua foto wajib diupload sebelum disimpan.`, "warning");
			return false;
		}
		const invalidGps = photos.filter((photo) => !Number.isFinite(Number(photo.latitude)) || !Number.isFinite(Number(photo.longitude)));
		if (invalidGps.length > 0) {
			showToast?.(`${invalidGps.length} foto ${target} tidak memiliki koordinat GPS yang valid.`, "error");
			return false;
		}
		return true;
	};

	const clearPhoto = (target = "BEFORE", index = null) => {
		const photoList = target === "BEFORE" ? formBefore.value.photos : formAfter.value.photos;
		if (index === null) {
			photoList.splice(0);
			return;
		}
		const photo = photoList[index];
		if (photo?.uploaded && photo.driveFileId) {
			deleteFromDrive(photo.driveFileId).catch((err) => console.warn("Gagal menghapus foto Drive:", err));
		}
		photoList.splice(index, 1);
	};

	const openAddModal = () => {
		stopCamera();
		formBefore.value = { judul: "", area_lokasi: "", kategori: "5S", barang_kode: "", keterangan_before: "", photos: [] };
		showAddModal.value = true;
	};

	const closeAddModal = () => {
		stopCamera();
		showAddModal.value = false;
	};

	const closeAfterModal = () => {
		stopCamera();
		showAfterModal.value = false;
	};	

	const submitLogBefore = async () => {
		if (!formBefore.value.judul.trim()) { showToast?.("Judul audit/temuan wajib diisi", "error"); return; }
		if (!formBefore.value.area_lokasi.trim()) { showToast?.("Area/Lokasi wajib diisi", "error"); return; }
		if (!formBefore.value.keterangan_before.trim()) { showToast?.("Keterangan sebelum (Before) wajib diisi", "error"); return; }
		if (!validateUploadedPhotos(formBefore.value.photos, "BEFORE")) return;
		isSubmitting.value = true;
		try {
			const currentAuditor = userData?.value?.nama || userData?.value?.username || "Auditor System";
			const firstPhoto = formBefore.value.photos[0];
			const payload = {
				judul: formBefore.value.judul.trim(),
				area_lokasi: formBefore.value.area_lokasi.trim(),
				kategori: formBefore.value.kategori,
				barang_kode: formBefore.value.barang_kode?.trim() || null,
				keterangan_before: formBefore.value.keterangan_before.trim(),
				photo_before_url: firstPhoto?.uploadedUrl || null,
				photo_before_id: firstPhoto?.driveFileId || null,
				status: "OPEN", auditor: currentAuditor,
				created_at: new Date().toISOString(), updated_at: new Date().toISOString()
			};
			const { data: insertedLog, error } = await supabaseClient.from("monitoring_logs").insert([payload]).select().single();
			if (error) throw error;
			const photoRows = formBefore.value.photos.map((photo, index) => ({
				log_id: insertedLog.id,
				photo_type: "BEFORE",
				photo_url: photo.uploadedUrl,
				drive_file_id: photo.driveFileId,
				sort_order: index,
				latitude: photo.latitude ?? null,
				longitude: photo.longitude ?? null,
				accuracy: photo.accuracy ?? null,
				captured_at: photo.capturedAt ?? null
			}));
			if (photoRows.length) {
				const { error: photoError } = await supabaseClient.from("monitoring_log_photos").insert(photoRows);
				if (photoError) {
					await supabaseClient.from("monitoring_logs").delete().eq("id", insertedLog.id);
					throw photoError;
				}
			}
			showToast?.("Temuan audit berhasil disimpan!", "success");
			showAddModal.value = false;
			await loadLogs();
		} catch (err) {
			console.error("Submit Before error:", err);
			showToast?.(err?.message || "Gagal menyimpan temuan audit", "error");
		} finally {
			isSubmitting.value = false;
		}
	};

	const openAfterModal = (log) => {
		stopCamera();
		selectedLog.value = log;
		formAfter.value = { id: log.id, keterangan_after: log.keterangan_after || "", photos: [] };
		showAfterModal.value = true;
	};

	const fetchMonitoringPhotos = async (logId, type) => {
		if (!logId || !type) return [];
		const { data, error } = await supabaseClient
			.from("monitoring_log_photos")
			.select("*")
			.eq("log_id", logId)
			.eq("photo_type", type)
			.order("sort_order", { ascending: true })
			.order("created_at", { ascending: true });
		if (error) {
			console.error("Gagal mengambil foto monitoring:", error);
			showToast?.("Gagal mengambil foto monitoring.", "error");
			return [];
		}
		return Array.isArray(data) ? data : [];
	};

	const submitLogAfter = async () => {
		if (!formAfter.value.keterangan_after.trim()) { showToast?.("Keterangan sesudah (After) wajib diisi", "error"); return; }
		if (!validateUploadedPhotos(formAfter.value.photos, "AFTER")) return;
		isSubmitting.value = true;
		try {
			const firstPhoto = formAfter.value.photos[0];
			const updatePayload = {
				keterangan_after: formAfter.value.keterangan_after.trim(),
				photo_after_url: firstPhoto?.uploadedUrl || null,
				photo_after_id: firstPhoto?.driveFileId || null,
				status: "CLOSED", updated_at: new Date().toISOString()
			};
			const { error } = await supabaseClient.from("monitoring_logs").update(updatePayload).eq("id", formAfter.value.id);
			if (error) throw error;
			const photoRows = formAfter.value.photos.map((photo, index) => ({
				log_id: formAfter.value.id,
				photo_type: "AFTER",
				photo_url: photo.uploadedUrl,
				drive_file_id: photo.driveFileId,
				sort_order: index,
				latitude: photo.latitude ?? null,
				longitude: photo.longitude ?? null,
				accuracy: photo.accuracy ?? null,
				captured_at: photo.capturedAt ?? null
			}));
			if (photoRows.length) {
				const { error: photoError } = await supabaseClient.from("monitoring_log_photos").insert(photoRows);
				if (photoError) throw photoError;
			}
			showToast?.("Tindak lanjut berhasil disimpan! Status log: CLOSED", "success");
			showAfterModal.value = false;
			await loadLogs();
		} catch (err) {
			console.error("Submit After error:", err);
			showToast?.(err?.message || "Gagal memperbarui perbaikan", "error");
		} finally {
			isSubmitting.value = false;
		}
	};

	const deleteLog = async (log) => {
		if (!log?.id) return;
		if (!confirm(`Hapus log audit "${log.judul}"?`)) return;
		if (isDeleting.value) return;
		isDeleting.value = true;
		deletingLogId.value = log.id;
		try {
			if (log.photo_before_id) {
				try {
					await deleteFromDrive(log.photo_before_id);
				} catch (e) {
					console.warn("Gagal menghapus foto Before dari Drive:", e);
				}
			}
			if (log.photo_after_id) {
				try {
					await deleteFromDrive(log.photo_after_id);
				} catch (e) {
					console.warn("Gagal menghapus foto After dari Drive:", e);
				}
			}
			const { error } = await supabaseClient
				.from("monitoring_logs")
				.delete()
				.eq("id", log.id);
			if (error) throw error;
			logs.value = logs.value.filter((item) => item.id !== log.id);
			showToast?.("Log audit berhasil dihapus", "success");
		} catch (err) {
			console.error("Delete log error:", err);
			showToast?.(err?.message || "Gagal menghapus log audit", "error");
		} finally {
			isDeleting.value = false;
			deletingLogId.value = null;
		}
	};

	const openDetailModal = (log) => {
		selectedLog.value = log;
		showDetailModal.value = true;
	};

	return {
		logs, loading, isSubmitting, filteredLogs, stats, isDeleting, deletingLogId,
		searchQuery, filterStatus, filterKategori, filterArea, kategoriOptions,
		showAddModal, showAfterModal, showDetailModal, selectedLog, uploadAllPhotos, validateUploadedPhotos,
		closeAddModal, closeAfterModal, openAddModal, openAfterModal, openDetailModal,
		formBefore, formAfter, loadLogs, submitLogBefore, submitLogAfter, canSaveBefore, canSaveAfter, deleteLog,
		openPhotoPreview, closePhotoPreview, uploadPhoto, fetchMonitoringPhotos,
		isCameraActive, startCamera, stopCamera, cameraTarget, capturePhotoFromCamera, handleFileSelect, clearPhoto
	};
}