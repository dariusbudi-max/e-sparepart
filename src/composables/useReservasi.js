import {
	createReservasiService, deleteReservasiService, getReservasiApprovalService,
	getReservasiByDocService, getReservasiListService, setReservasiCodeService
} from "../services/reservasiService.js";
import { useApproval } from "../composables/useApproval.js";

const { ref, computed, watch } = Vue;

export function useReservasi({ showToast, userData, page, can, isAdmin }) {
	const reservasiItems = ref([]);
	const RsvDept = ref("");
	const txTanggal = ref(new Date().toISOString().slice(0, 10));
	const txReservasi = ref("");
	const docNumber = ref("");

	const isSavingReservasi = ref(false);
	const showReservasiModal = ref(false);
	const reservasiSudahTersimpan = ref(false);
	const reservasiEditMode = ref(false);

	const reservasiList = ref([]);
	const reservasiListLoading = ref(false);
	const reservasiListSearch = ref("");
	const reservasiListStatus = ref("PENDING");
	const reservasiListPage = ref(0);
	const reservasiListPageSize = 20;
	const reservasiListHasMore = ref(true);
	const reservasiBarcodePreview = ref("");

	const selectedReservasi = ref(null);
	const showReservasiPreviewModal = ref(false);
	const reservasiPreviewMode = ref("detail");
	const reservasiDetailLoading = ref(false);
	const reservasiApprovalHistory = ref([]);
	const reservasiApprovalLoading = ref(false);
	let reservasiSearchTimer = null;

	const simpanReservasi = async () => {
		if (isSavingReservasi.value) return;

		if (reservasiEditMode.value && docNumber.value) {
			const code = String(txReservasi.value || "").trim().toUpperCase();
			if (!code) {
				showToast("No Reservasi Pabrik wajib diisi.", "error");
				return;
			}

			isSavingReservasi.value = true;
			try {
				const result = await setReservasiCodeService(
					selectedReservasi.value?.header?.id,
					docNumber.value,
					code,
					userData.value?.username || userData.value?.nama || "USER"
				);

				txReservasi.value = String(result.reservasi_code || code).trim().toUpperCase();
				showToast(`No Reservasi Pabrik ${txReservasi.value} berhasil disimpan.`, "success");

				await loadReservasiList({ reset: true });

				const freshData = await getReservasiByDocService(docNumber.value);
				if (freshData?.header) {
					freshData.header.approval_level = Number(freshData.header.approval_level || 0);
					selectedReservasi.value = freshData;
					await loadReservasiApproval(freshData.header.id);
				}

				reservasiEditMode.value = false;
				showReservasiModal.value = false;
				return result;
			} catch (err) {
				console.error("Gagal menyimpan No Reservasi Pabrik:", err);
				showToast(err?.message || "Gagal menyimpan No Reservasi Pabrik.", "error");
				throw err;
			} finally {
				isSavingReservasi.value = false;
			}
		}

		if (!reservasiItems.value.length) {
			showToast("Antrean reservasi masih kosong!", "error");
			return;
		}

		if (!RsvDept.value?.trim()) {
			showToast("Mohon isi Department pemohon!", "error");
			return;
		}

		const invalidQty = reservasiItems.value.some((item) => {
			const qty = Number(item.qty);
			return !Number.isFinite(qty) || qty <= 0;
		});

		if (invalidQty) {
			showToast("Qty barang harus lebih dari 0.", "error");
			return;
		}

		isSavingReservasi.value = true;
		try {
			const header = {
				no_doc: null,
				dept: RsvDept.value.trim().toUpperCase(),
				tanggal: txTanggal.value,
				reservasi_code: txReservasi.value?.trim().toUpperCase() || null,
				pemohon: userData.value?.nama || userData.value?.username || "USER"
			};

			const result = await createReservasiService(header, reservasiItems.value);
			if (!result?.noDoc) throw new Error("Server tidak mengembalikan nomor dokumen BPSC.");

			docNumber.value = String(result.noDoc).trim().toUpperCase();
			reservasiSudahTersimpan.value = true;
			reservasiEditMode.value = false;
			await buatPreviewBarcodeReservasi(docNumber.value);

			showToast(`BPSC ${docNumber.value} berhasil disimpan.`, "success");
			await loadReservasiList({ reset: true });

			return result;
		} catch (err) {
			console.error("Gagal menyimpan reservasi:", err);
			showToast(err?.message || "Gagal menyimpan reservasi", "error");
			throw err;
		} finally {
			isSavingReservasi.value = false;
		}
	};

	const bukaReservasiModal = () => { showReservasiModal.value = true; };
	const tutupReservasiModal = () => {
		if (reservasiEditMode.value) {
			resetReservasiForm();
			showReservasiModal.value = false;
			showToast("Edit BPSC dibatalkan. Perubahan tidak disimpan.", "info");
			return;
		}
		showReservasiModal.value = false;
	};

	const resetReservasiForm = () => {
		reservasiItems.value = [];
		RsvDept.value = "";
		txTanggal.value = new Date().toISOString().slice(0, 10);
		txReservasi.value = "";
		docNumber.value = "";
		reservasiSudahTersimpan.value = false;
		reservasiEditMode.value = false;
		selectedReservasi.value = null;
	};

	const newBon = ({ confirmReset = true } = {}) => {
		const hasData =
			reservasiItems.value.length > 0 ||
			docNumber.value ||
			RsvDept.value ||
			txReservasi.value;

		if (confirmReset && hasData) {
			const confirmed = window.confirm(
				"BON yang sedang aktif akan ditutup.\n\n" +
				"Semua item yang belum disimpan akan dihapus.\n\n" +
				"Lanjut membuat BON baru?"
			);

			if (!confirmed) return false;
		}

		reservasiItems.value = [];
		docNumber.value = "";
		RsvDept.value = "";
		txTanggal.value = new Date().toISOString().slice(0, 10);
		txReservasi.value = "";

		reservasiSudahTersimpan.value = false;
		reservasiEditMode.value = false;

		selectedReservasi.value = null;
		showReservasiPreviewModal.value = false;

		showToast("BON baru siap dibuat.", "info");

		return true;
	};

	const loadReservasiList = async ({ reset = false } = {}) => {
		if (reservasiListLoading.value) return;

		if (reset) {
			reservasiListPage.value = 0;
			reservasiListHasMore.value = true;
			reservasiList.value = [];
		}

		if (!reservasiListHasMore.value && !reset) return;

		reservasiListLoading.value = true;
		try {
			const result = await getReservasiListService({
				page: reservasiListPage.value,
				pageSize: reservasiListPageSize,
				search: reservasiListSearch.value,
				status: reservasiListStatus.value
			});

			if (reset) {
				reservasiList.value = result.data || [];
			} else {
				reservasiList.value.push(...(result.data || []));
			}

			reservasiListHasMore.value = Boolean(result.hasMore);
			if ((result.data || []).length > 0) {
				reservasiListPage.value++;
			}
		} catch (error) {
			console.error("Gagal mengambil daftar reservasi:", error);
			showToast(error?.message || "Gagal mengambil daftar reservasi.", "error");
		} finally {
			reservasiListLoading.value = false;
		}
	};

	const loadReservasiApproval = async (reservasiId) => {
		reservasiApprovalHistory.value = [];
		if (!reservasiId) return [];

		reservasiApprovalLoading.value = true;
		try {
			const data = await getReservasiApprovalService(reservasiId);
			reservasiApprovalHistory.value = Array.isArray(data) ? data : [];
			return reservasiApprovalHistory.value;
		} catch (error) {
			console.error("Gagal mengambil history approval reservasi:", error);
			showToast(error?.message || "Gagal mengambil data approval reservasi.", "error");
			return [];
		} finally {
			reservasiApprovalLoading.value = false;
		}
	};

	watch(page, async (newPage) => {
		if (newPage !== "reservasi") return;
		await loadReservasiList({ reset: true });
	}, { immediate: true });

	const editReservasiDariPreview = async () => {
		const data = selectedReservasi.value;
		if (!data?.header?.id || !data?.header?.no_doc) {
			showToast("Data BPSC tidak lengkap.", "error");
			return;
		}

		const header = data.header;
		const details = Array.isArray(data.details) ? data.details : [];

		reservasiEditMode.value = true;
		reservasiSudahTersimpan.value = true;

		docNumber.value = String(header.no_doc || "").trim().toUpperCase();
		RsvDept.value = String(header.dept || "").trim();
		txTanggal.value = String(header.tanggal || "").trim() || new Date().toISOString().slice(0, 10);
		txReservasi.value = String(header.reservasi_code || "").trim().toUpperCase();

		reservasiItems.value = details.map((item) => ({
			kode: String(item.barang_kode || "").trim(),
			nama: item.barang_nama || "-",
			qty: Number(item.qty || 0),
			satuan: item.satuan || "PCS",
			noMesin: item.no_mesin || "",
			keterangan: item.keterangan || "",
			real: ""
		}));

		showReservasiPreviewModal.value = false;
		showReservasiModal.value = true;

		if (typeof Vue.nextTick === "function") {
			await Vue.nextTick();
		}

		showToast(`BPSC ${docNumber.value} siap diisi No Reservasi Pabrik.`, "info");
	};

	const bukaPreviewReservasi = async (reservasi, mode = "detail") => {
		if (!reservasi?.no_doc) return;
		const noDoc = String(reservasi.no_doc).trim().toUpperCase();

		try {
			reservasiDetailLoading.value = true;
			reservasiPreviewMode.value = mode;

			selectedReservasi.value = null;
			reservasiBarcodePreview.value = "";
			reservasiApprovalHistory.value = [];

			const data = await getReservasiByDocService(noDoc);

			if (!data?.header) {
				throw new Error(`Data BPSC ${noDoc} tidak ditemukan.`);
			}

			data.header.approval_level = Number(data.header.approval_level || 0);
			selectedReservasi.value = data;

			await loadReservasiApproval(data.header.id);
			await buatPreviewBarcodeReservasi(data.header.no_doc || noDoc);

			showReservasiPreviewModal.value = true;

			if (typeof Vue.nextTick === "function") {
				await Vue.nextTick();
			}
		} catch (error) {
			console.error("Gagal mengambil detail reservasi:", error);
			showToast(error?.message || "Gagal mengambil detail reservasi.", "error");
		} finally {
			reservasiDetailLoading.value = false;
		}
	};

	const tutupPreviewReservasi = () => {
		showReservasiPreviewModal.value = false;
		selectedReservasi.value = null;
		reservasiBarcodePreview.value = "";
		reservasiApprovalHistory.value = [];
		reservasiPreviewMode.value = "detail";
	};

	const deleteReservasi = async (item) => {
		if (!item) {
			showToast("Data reservasi tidak valid.", "error");
			return;
		}
		if (!isAdmin?.value) {
			showToast("Hanya Admin yang dapat menghapus reservasi.", "error");
			return;
		}

		const noDoc = String(item.no_doc || "").trim().toUpperCase();
		if (!item.id || !noDoc) {
			showToast("Data reservasi tidak valid.", "error");
			return;
		}

		const status = String(item.status || "").trim().toUpperCase();
		if (status === "FULFILLED") {
			showToast(`BPSC ${noDoc} sudah FULFILLED dan tidak dapat dihapus.`, "warning");
			return;
		}

		const confirmed = window.confirm(
			`Hapus BPSC ${noDoc}?\n\n` +
			`Data header, detail, dan history approval akan dihapus permanen.\n\n` +
			`Tindakan ini tidak dapat dibatalkan.`
		);
		if (!confirmed) return;

		try {
			await deleteReservasiService(item.id, noDoc);
			showToast(`BPSC ${noDoc} berhasil dihapus.`, "success");
			await loadReservasiList({ reset: true });
		} catch (error) {
			console.error("Gagal menghapus reservasi:", error);
			showToast(error?.message || "Gagal menghapus reservasi.", "error");
		}
	};

	const isApproveAction = (action) => {
		const normalized = String(action || "").trim().toUpperCase();
		return ["APPROVE", "APPROVED"].includes(normalized);
	};

	const isRejectAction = (action) => {
		const normalized = String(action || "").trim().toUpperCase();
		return ["REJECT", "REJECTED", "CANCEL", "CANCELLED"].includes(normalized);
	};

	const getApprovalByLevel = (level) => {
		const targetLevel = Number(level);
		const histories = reservasiApprovalHistory.value
			.filter(item => Number(item.level) === targetLevel)
			.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

		return histories[0] || null;
	};

	const getApproval = (level) => {
		return getApprovalByLevel(level);
	};

	const getRejectApproval = () => {
		return reservasiApprovalHistory.value.find((item) => isRejectAction(item.action)) || null;
	};

	const getRejectName = () => {
		const reject = getRejectApproval();
		return reject?.nama || reject?.username || reject?.user || "User";
	};

	const getRejectDate = () => {
		const reject = getRejectApproval();
		if (!reject?.created_at) return "";
		return formatApprovalDate(reject.created_at);
	};

	const getRejectReason = () => {
		const reject = getRejectApproval();
		if (reject) {
			const reason = String(
				reject.keterangan || reject.reason || reject.note || reject.alasan || reject.catatan || ""
			).trim();
			if (reason) return reason;
		}

		const headerReason = String(selectedReservasi.value?.header?.reject_reason || "").trim();
		return headerReason || "-";
	};

	const getRejectLevel = () => {
		const reject = getRejectApproval();
		return reject?.level ? Number(reject.level) : null;
	};

	const getApprovalName = (level) => {
		const approval = getApprovalByLevel(level);
		return approval?.nama || approval?.username || approval?.user || "Menunggu Approval";
	};

	const getApprovalDate = (level) => {
		const approval = getApprovalByLevel(level);
		if (!approval?.created_at) return "";
		return formatApprovalDate(approval.created_at);
	};

	const getApprovalStatus = (level) => {
		const approval = getApprovalByLevel(level);
		if (!approval) return "WAITING";
		if (isRejectAction(approval.action)) return "REJECTED";
		if (isApproveAction(approval.action)) return "APPROVED";
		return "PROCESS";
	};

	const getApprovalKeterangan = (level) => {
		const approval = getApprovalByLevel(level);
		if (approval) {
			const reason = String(approval.keterangan || approval.reason || approval.note || approval.alasan || approval.catatan || "").trim();
			if (reason) return reason;
		}
		return String(selectedReservasi.value?.header?.reject_reason || "").trim();
	};

	const formatApprovalDate = (date) => {
		if (!date) return "";
		const parsedDate = new Date(date);
		if (Number.isNaN(parsedDate.getTime())) return "";

		return new Intl.DateTimeFormat("id-ID", {
			timeZone: "Asia/Jakarta",
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		}).format(parsedDate);
	};

	const isApprovalCompleted = (level) => {
		return getApprovalStatus(level) === "APPROVED";
	};

	const refreshReservasiPreview = async (noDoc) => {
		if (!showReservasiPreviewModal.value || !noDoc) return;

		const freshData = await getReservasiByDocService(noDoc);
		if (!freshData?.header) return;

		freshData.header.approval_level = Number(freshData.header.approval_level || 0);
		selectedReservasi.value = freshData;

		await loadReservasiApproval(freshData.header.id);
		await buatPreviewBarcodeReservasi(freshData.header.no_doc || noDoc);
	};

	const cariReservasi = () => {
		clearTimeout(reservasiSearchTimer);
		reservasiSearchTimer = setTimeout(() => {
			loadReservasiList({ reset: true });
		}, 350);
	};

	const filterReservasiStatus = () => {
		loadReservasiList({ reset: true });
	};

	const generateReservasiBarcodeDataUrl = async (noDoc, { width = 600, barcodeHeight = 180, scale = 3 } = {}) => {
		const cleanDoc = String(noDoc || "").trim().toUpperCase();
		if (!cleanDoc) throw new Error("Nomor dokumen belum tersedia.");

		const paddingX = 40;
		const paddingTop = 35;
		const textHeight = 45;
		const paddingBottom = 35;

		const canvas = document.createElement("canvas");
		canvas.width = width * scale;
		canvas.height = (paddingTop + barcodeHeight + textHeight + paddingBottom) * scale;

		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas context tidak tersedia.");

		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		const barcodeCanvas = document.createElement("canvas");
		const barcodeWidth = (width - (paddingX * 2)) * scale;
		barcodeCanvas.width = barcodeWidth;
		barcodeCanvas.height = barcodeHeight * scale;

		JsBarcode(barcodeCanvas, cleanDoc, {
			format: "CODE128",
			width: 3 * scale,
			height: barcodeHeight * scale,
			displayValue: false,
			margin: 0,
			marginTop: 0,
			marginBottom: 0,
			marginLeft: 0,
			marginRight: 0,
			background: "#ffffff",
			lineColor: "#000000"
		});

		const x = (canvas.width - barcodeCanvas.width) / 2;
		ctx.drawImage(barcodeCanvas, x, paddingTop * scale, barcodeCanvas.width, barcodeCanvas.height);

		ctx.fillStyle = "#000000";
		ctx.font = `bold ${22 * scale}px Arial`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(cleanDoc, canvas.width / 2, (paddingTop + barcodeHeight + (textHeight / 2)) * scale);

		return canvas.toDataURL("image/png");
	};

	const buatPreviewBarcodeReservasi = async (noDoc) => {
		try {
			const cleanDoc = String(noDoc || "").trim().toUpperCase();
			if (!cleanDoc) {
				reservasiBarcodePreview.value = "";
				return;
			}
			reservasiBarcodePreview.value = await generateReservasiBarcodeDataUrl(cleanDoc);
		} catch (error) {
			console.error("Gagal membuat preview barcode:", error);
			reservasiBarcodePreview.value = "";
		}
	};

	const paginatedItems = computed(() => {
		const itemsPerPage = 11;
		const pages = [];
		for (let i = 0; i < reservasiItems.value.length; i += itemsPerPage) {
			pages.push(reservasiItems.value.slice(i, i + itemsPerPage));
		}
		return pages.length ? pages : [[]];
	});

	const {
		isApprovingReservasi, isRejectingReservasi,
		canApproveReservasi, canRejectReservasi,
		approveReservasi, rejectReservasi
	} = useApproval({
		showToast, userData, can,
		loadReservasiList, getReservasiByDocService,
		loadReservasiApproval, buatPreviewBarcodeReservasi, refreshReservasiPreview,
		showReservasiPreviewModal, selectedReservasi
	});

	return {
		reservasiItems, RsvDept, txTanggal, txReservasi, docNumber,
		isSavingReservasi, showReservasiModal, bukaReservasiModal, tutupReservasiModal, reservasiEditMode,
		editReservasiDariPreview, reservasiSudahTersimpan, paginatedItems, simpanReservasi, resetReservasiForm, newBon,
		isApprovingReservasi, isRejectingReservasi, canApproveReservasi, canRejectReservasi, approveReservasi, rejectReservasi, deleteReservasi,
		reservasiList, reservasiListLoading, reservasiListSearch, reservasiListStatus, reservasiListHasMore,
		selectedReservasi, showReservasiPreviewModal, reservasiBarcodePreview, reservasiPreviewMode, reservasiDetailLoading,
		reservasiApprovalHistory, reservasiApprovalLoading, loadReservasiApproval, getApprovalByLevel, getApprovalName,
		getApprovalDate, isApprovalCompleted, refreshReservasiPreview, formatApprovalDate, loadReservasiList,
		bukaPreviewReservasi, tutupPreviewReservasi, cariReservasi, filterReservasiStatus, isRejectAction,
		getRejectApproval, isApproveAction, getApprovalStatus, getApprovalKeterangan, getApproval,
		getRejectName, getRejectDate, getRejectReason, getRejectLevel,
		generateReservasiBarcodeDataUrl, buatPreviewBarcodeReservasi
	};
}