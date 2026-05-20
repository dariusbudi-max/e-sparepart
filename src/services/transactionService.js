import { supabaseClient } from "../api/supabase.js";


export const processTransaction = async ({
    cart,
    txType = null,
    txDept = "-",
    txNote = "-",
    username,
    mode = "STRICT"
}) => {
    let payload = cart.map(i => ({
        kode: i.kode,
        qty: Number(i.qty),
        jenis: i.jenis || txType,
        dept: i.dept || txDept || "-",
        keterangan: i.keterangan || txNote || "-"
    }));

    

    const { data, error } = await supabaseClient.rpc("atomic_bulk_tx", {
        tx_data: payload,
        username,
        mode
    });

    if (error) throw new Error(error.message || "RPC ERROR");
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