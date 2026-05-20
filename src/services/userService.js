import { supabaseClient } from "../api/supabase.js";

// HELPERS
const handleResponse = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
};

const getUserByUsername = async (username) => {
    const res = await supabaseClient
        .from("users")
        .select("*")
        .eq("username", username)
        .single();
    return handleResponse(res);
};

// ACTIONS
export const fetchUsers = async () => {
    const res = await supabaseClient
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
    return handleResponse(res);
};

export const createUser = async (user) => {
    const res = await supabaseClient
        .from("users")
        .insert([user])
        .select()
        .single();
    return handleResponse(res);
};

export const deleteUser = async (username) => {
    const user = await getUserByUsername(username);
    if (user.role === "ADMIN") throw new Error("Akun ADMIN tidak bisa dihapus");

    const res = await supabaseClient
        .from("users")
        .delete()
        .eq("username", username);
    return handleResponse(res);
};

export const approveUser = async (username, role) => {
    const res = await supabaseClient
        .from("users")
        .update({ role, status: "AKTIF" })
        .eq("username", username)
        .select()
        .single();
    return handleResponse(res);
};

export const toggleUserStatus = async (username, currentStatus) => {
    const user = await getUserByUsername(username);
    if (user.role === "ADMIN") throw new Error("Akun ADMIN tidak bisa dinonaktifkan");

    const newStatus = currentStatus === "AKTIF" ? "NONAKTIF" : "AKTIF";
    const res = await supabaseClient
        .from("users")
        .update({ status: newStatus })
        .eq("username", username)
        .select()
        .single();

    handleResponse(res);
    return newStatus;
};

export const updateUserRole = async (username, role) => {
    const user = await getUserByUsername(username);
    if (user.role === "ADMIN") throw new Error("Role ADMIN tidak boleh diubah");

    const res = await supabaseClient
        .from("users")
        .update({ role })
        .eq("username", username)
        .select()
        .single();
    return handleResponse(res);
};

export const togglePhotoAccess = async (username, value) => {

    const user = await getUserByUsername(username);

    if (user.role === "ADMIN") {
        throw new Error("Akses foto ADMIN tidak boleh diubah");
    }

    const res = await supabaseClient
        .from("users")
        .update({
            can_preview_photo: value
        })
        .eq("username", username)
        .select()
        .single();

    return handleResponse(res);
};