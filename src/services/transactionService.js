import { supabaseClient } from "../api/supabase.js";

const ALLOWED_TRANSACTION_TYPES = ["KELUAR", "MASUK", "OPNAME", "RETURN"];

export const processTransaction = async ({ cart, txType = null, txDept = "-", txNote = "-", username, mode = "STRICT" }) => {
    if (!Array.isArray(cart) || !cart.length) {
        throw new Error("Cart kosong.");
    }

    const forcedJenis = txType ? String(txType).trim().toUpperCase() : null;

    if (forcedJenis && !ALLOWED_TRANSACTION_TYPES.includes(forcedJenis)) {
        throw new Error(`Jenis transaksi tidak valid: ${forcedJenis}`);
    }

    const dept = String(txDept || "-").trim().toUpperCase();
    const note = String(txNote || "-").trim();

    const payload = cart.map(item => {
        const itemJenis = forcedJenis || String(item.jenis || "KELUAR").trim().toUpperCase();
        const itemDept = forcedJenis ? dept : String(item.dept || dept || "-").trim().toUpperCase();
        const itemKeterangan = forcedJenis ? note : String(item.keterangan || note || "-").trim();

        return {
            kode: String(item.kode || "").trim(),
            qty: Number(item.qty || 0),
            jenis: itemJenis,
            dept: itemDept,
            keterangan: itemKeterangan
        };
    });

    const invalid = payload.find(item => {
        if (!item.kode) return true;
        if (!Number.isFinite(item.qty) || item.qty <= 0) return true;
        if (!ALLOWED_TRANSACTION_TYPES.includes(item.jenis)) return true;
        return false;
    });

    if (invalid) {
        throw new Error(`Data transaksi ${invalid.kode || "barang"} tidak valid.`);
    }

    const { data, error } = await supabaseClient.rpc("atomic_bulk_tx", {
        tx_data: payload,
        username,
        mode
    });

    if (error) {
        throw new Error(error.message || "RPC ERROR");
    }

    return data;
};

export const cancelTransaksi = async (id) => {
    const { error } = await supabaseClient.rpc("cancel_transaksi", {
        p_id: id,
    });
    if (error) {
        throw new Error(error.message || "Gagal membatalkan transaksi di server");
    }
};