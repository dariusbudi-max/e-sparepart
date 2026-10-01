import { supabaseClient } from "../api/supabase.js";

const getIndonesiaDateString = () => {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(new Date()).replace(/-/g, "");
};

const generateNoDoc = async () => {
	const dateStr = getIndonesiaDateString();
	const prefix = `RSV-${dateStr}-`;

	const { data, error } = await supabaseClient
		.from("reservasi")
		.select("no_doc")
		.like("no_doc", `${prefix}%`);

	if (error) {
		console.error("Gagal mengambil nomor BPSC terakhir:", error);
		throw new Error(error.message || "Gagal mengambil nomor BPSC terakhir.");
	}

	let lastNumber = 0;
	(data || []).forEach((row) => {
		const noDoc = String(row?.no_doc || "").trim().toUpperCase();
		const match = noDoc.match(new RegExp(`^RSV-${dateStr}-(\\d{4})$`));
		if (!match) return;

		const number = Number(match[1]);
		if (Number.isFinite(number) && number > lastNumber) {
			lastNumber = number;
		}
	});

	const nextNumber = lastNumber + 1;
	if (nextNumber > 9999) {
		throw new Error(`Nomor BPSC untuk tanggal ${dateStr} sudah mencapai batas 9999.`);
	}

	return `${prefix}${String(nextNumber).padStart(4, "0")}`;
};

export const createReservasiService = async (header, items) => {
	const requestedNoDoc = String(header?.no_doc || "").trim().toUpperCase();
	const noDoc = requestedNoDoc || await generateNoDoc();
	const reservasiCode = String(header?.reservasi_code || "").trim().toUpperCase() || null;

	const { data: resvData, error: resvError } = await supabaseClient
		.from("reservasi")
		.insert({
			no_doc: noDoc,
			dept: header?.dept || "SPAREPART",
			tanggal: header?.tanggal || `${getIndonesiaDateString().slice(0, 4)}-${getIndonesiaDateString().slice(4, 6)}-${getIndonesiaDateString().slice(6, 8)}`,
			reservasi_code: reservasiCode,
			pemohon: header?.pemohon || "SYSTEM",
			status: "PENDING",
			approval_level: 0
		})
		.select()
		.single();

	if (resvError) {
		console.error("Gagal membuat header reservasi:", resvError);
		throw resvError;
	}

	const details = (items || []).map((item) => ({
		reservasi_id: resvData.id,
		barang_kode: String(item.kode || "").trim(),
		barang_nama: item.nama || "-",
		qty: Number(item.qty || 1),
		satuan: item.satuan || "PCS",
		no_mesin: item.noMesin || "-",
		keterangan: item.keterangan || "-"
	}));

	if (details.length > 0) {
		const { error: detailError } = await supabaseClient
			.from("reservasi_detail")
			.insert(details);

		if (detailError) {
			console.error("Gagal membuat detail reservasi:", detailError);
			throw detailError;
		}
	}

	return {
		noDoc,
		reservasiId: resvData.id
	};
};

export const getReservasiByDocService = async (noDoc) => {
	const cleanDoc = String(noDoc || "").replace(/\r/g, "").replace(/\n/g, "").trim().toUpperCase();
	if (!cleanDoc) throw new Error("Nomor BPSC kosong");
	if (!cleanDoc.startsWith("RSV-")) throw new Error(`Barcode BPSC tidak valid: ${cleanDoc}`);

	const { data: header, error: headerError } = await supabaseClient.from("reservasi").select("*").eq("no_doc", cleanDoc).maybeSingle();
	if (headerError) throw headerError;
	if (!header) throw new Error(`BPSC ${cleanDoc} tidak ditemukan`);

	const { data: details, error: detailError } = await supabaseClient.from("reservasi_detail").select("*").eq("reservasi_id", header.id).order("id", { ascending: true });
	if (detailError) throw detailError;

	const detailRows = details || [];
	if (!detailRows.length) return { header, details: [] };

	const barangCodes = [...new Set(detailRows.map((item) => String(item.barang_kode || "").trim()).filter(Boolean))];
	let inventoryMap = new Map();

	if (barangCodes.length) {
		const { data: inventories, error: inventoryError } = await supabaseClient.from("inventory").select("kode, stok, min_stok").in("kode", barangCodes);
		if (inventoryError) throw inventoryError;
		inventoryMap = new Map((inventories || []).map((inv) => [String(inv.kode || "").trim(), inv]));
	}

	const enrichedDetails = detailRows.map((item) => {
		const kode = String(item.barang_kode || "").trim();
		const inventory = inventoryMap.get(kode);
		return {
			...item,
			qty: Number(item.qty || 0),
			stok_tersedia: inventory ? Number(inventory.stok || 0) : null,
			min_stok: inventory ? Number(inventory.min_stok || 0) : null
		};
	});

	return { header, details: enrichedDetails };
};

export const approveReservasiService = async (reservasiId, noDoc, username, expectedLevel) => {
	if (!reservasiId) throw new Error("ID reservasi tidak tersedia.");

	const cleanNoDoc = String(noDoc || "").trim().toUpperCase();
	if (!cleanNoDoc) throw new Error("Nomor dokumen BPSC tidak tersedia.");

	const cleanUsername = String(username || "").trim();
	if (!cleanUsername) throw new Error("User approval tidak tersedia.");

	const level = Number(expectedLevel);
	if (![1, 2, 3].includes(level)) throw new Error("Level approval tidak valid.");

	const { data, error } = await supabaseClient.rpc("approve_reservasi", {
		p_reservasi_id: reservasiId,
		p_no_doc: cleanNoDoc,
		p_username: cleanUsername,
		p_level: level
	});

	if (error) {
		console.error("RPC approve_reservasi error:", error);
		throw new Error(error.message || "Gagal melakukan approval reservasi.");
	}
	if (!data) throw new Error("Server tidak mengembalikan data reservasi.");

	return data;
};

export const rejectReservasiService = async (reservasiId, noDoc, username, expectedLevel, reason) => {
	if (!reservasiId) throw new Error("ID reservasi tidak tersedia.");

	const cleanReservasiId = String(reservasiId).trim();
	const cleanNoDoc = String(noDoc || "").trim().toUpperCase();
	const cleanUsername = String(username || "").trim();
	const cleanReason = String(reason || "").trim();
	const level = Number(expectedLevel);
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

	if (!uuidRegex.test(cleanReservasiId)) throw new Error("ID reservasi bukan UUID yang valid.");
	if (!cleanNoDoc) throw new Error("Nomor dokumen BPSC tidak tersedia.");
	if (!cleanUsername) throw new Error("User pembatalan tidak tersedia.");
	if (![1, 2, 3].includes(level)) throw new Error("Level approval tidak valid.");
	if (!cleanReason) throw new Error("Alasan pembatalan wajib diisi.");

	try {
		const { data, error } = await supabaseClient.rpc("reject_reservasi", {
			p_reservasi_id: cleanReservasiId,
			p_no_doc: cleanNoDoc,
			p_username: cleanUsername,
			p_level: level,
			p_reason: cleanReason
		});

		if (error) {
			console.error("RPC reject_reservasi error:", error);
			throw new Error(error.message || "Gagal melakukan pembatalan reservasi.");
		}
		if (!data) throw new Error("Server tidak mengembalikan data pembatalan reservasi.");

		return data;
	} catch (error) {
		console.error("rejectReservasiService error:", error);
		throw error;
	}
};

export const getReservasiListService = async ({ page = 0, pageSize = 20, search = "", status = "ALL" } = {}) => {
	const from = page * pageSize;
	const to = from + pageSize - 1;

	let query = supabaseClient.from("reservasi").select("*", { count: "exact" }).order("id", { ascending: false }).range(from, to);

	const cleanSearch = String(search || "").trim();
	if (cleanSearch) {
		const keyword = cleanSearch.replace(/[%_]/g, "\\$&");
		query = query.or(`no_doc.ilike.%${keyword}%,dept.ilike.%${keyword}%,pemohon.ilike.%${keyword}%,reservasi_code.ilike.%${keyword}%`);
	}

	if (status && status !== "ALL") query = query.eq("status", status);

	const { data, error, count } = await query;
	if (error) throw error;

	return {
		data: data || [],
		count: count || 0,
		hasMore: (from + (data?.length || 0)) < (count || 0)
	};
};

export const deleteReservasiService = async (reservasiId, noDoc) => {
	if (!reservasiId) throw new Error("ID reservasi tidak valid.");
	const cleanNoDoc = String(noDoc || "").trim().toUpperCase();
	if (!cleanNoDoc) throw new Error("Nomor dokumen BPSC tidak valid.");

	const { data: existing, error: checkError } = await supabaseClient
		.from("reservasi")
		.select("id, no_doc, status")
		.eq("id", reservasiId)
		.eq("no_doc", cleanNoDoc)
		.maybeSingle();

	if (checkError) throw checkError;
	if (!existing) throw new Error(`BPSC ${cleanNoDoc} tidak ditemukan.`);

	const status = String(existing.status || "").trim().toUpperCase();
	if (status === "FULFILLED") throw new Error(`BPSC ${cleanNoDoc} sudah FULFILLED dan tidak boleh dihapus.`);

	const { error: approvalError } = await supabaseClient.from("reservasi_approval").delete().eq("reservasi_id", reservasiId);
	if (approvalError) throw approvalError;

	const { error: detailError } = await supabaseClient.from("reservasi_detail").delete().eq("reservasi_id", reservasiId);
	if (detailError) throw detailError;

	const { error: deleteError } = await supabaseClient.from("reservasi").delete().eq("id", reservasiId).eq("no_doc", cleanNoDoc);
	if (deleteError) throw deleteError;

	return true;
};

export const getReservasiApprovalService = async (reservasiId) => {
	if (!reservasiId) throw new Error("ID reservasi tidak tersedia.");

	const { data, error } = await supabaseClient.rpc("get_reservasi_approval", { p_reservasi_id: reservasiId });

	if (error) {
		console.error("RPC get_reservasi_approval error:", error);
		throw new Error(error.message || "Gagal mengambil history approval reservasi.");
	}

	return Array.isArray(data) ? data : [];
};

export const setReservasiCodeService = async (reservasiId, noDoc, reservasiCode, username) => {
	const cleanId = String(reservasiId || "").trim();
	const cleanDoc = String(noDoc || "").trim().toUpperCase();
	const cleanCode = String(reservasiCode || "").trim().toUpperCase();
	const cleanUsername = String(username || "").trim();

	if (!cleanId) throw new Error("ID BPSC tidak valid.");
	if (!cleanDoc) throw new Error("Nomor BPSC tidak valid.");
	if (!cleanCode) throw new Error("No Reservasi Pabrik wajib diisi.");

	const { data, error } = await supabaseClient.rpc("set_reservasi_code", {
		p_reservasi_id: cleanId,
		p_no_doc: cleanDoc,
		p_reservasi_code: cleanCode,
		p_username: cleanUsername || "SYSTEM"
	});

	if (error) throw error;
	if (!data?.success) throw new Error("Gagal menyimpan No Reservasi Pabrik.");

	return data;
};

export const markReservasiFulfilledService = async (noDoc, username = "SYSTEM") => {
	const cleanDoc = String(noDoc || "").trim().toUpperCase();
	if (!cleanDoc) throw new Error("Nomor BPSC tidak valid.");

	const { data: reservasi, error: findError } = await supabaseClient
		.from("reservasi")
		.select("id, no_doc, status, approval_level")
		.eq("no_doc", cleanDoc)
		.maybeSingle();

	if (findError) throw findError;
	if (!reservasi) throw new Error(`BPSC ${cleanDoc} tidak ditemukan.`);

	const status = String(reservasi.status || "").trim().toUpperCase();
	const approvalLevel = Number(reservasi.approval_level || 0);

	if (!["APPROVED", "READY"].includes(status)) {
		if (status === "FULFILLED") return true;
		throw new Error(`BPSC ${cleanDoc} tidak dapat diselesaikan. Status: ${status}`);
	}

	if (approvalLevel < 3) {
		throw new Error(`BPSC ${cleanDoc} belum mendapatkan approval lengkap (${approvalLevel}/3).`);
	}

	const { error: updateError } = await supabaseClient
		.from("reservasi")
		.update({ status: "FULFILLED" })
		.eq("id", reservasi.id)
		.neq("status", "FULFILLED");

	if (updateError) throw updateError;
	return true;
};