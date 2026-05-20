import { supabaseClient } from "../api/supabase.js";

/* ================= HELPERS ================= */

const handleResponse = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
};

const cleanUsername = (username) => username.trim().toLowerCase();

/* ================= AUTH SERVICES ================= */

export const login = async (username, password) => {
    const usernameClean = cleanUsername(username);

    const res = await supabaseClient
        .from("users")
        .select("*")
        .eq("username", usernameClean)
        .eq("status", "AKTIF")
        .single();

    const user = handleResponse(res);

    if (user.password !== password) {
        throw new Error("Password salah");
    }

    return user;
};

export const register = async (payload, deviceInfo) => {
    const usernameClean = cleanUsername(payload.username);

    // Cek duplikasi username
    const { data: existing } = await supabaseClient
        .from("users")
        .select("username")
        .eq("username", usernameClean)
        .maybeSingle();

    if (existing) {
        throw new Error("Username sudah terdaftar");
    }

    const res = await supabaseClient
        .from("users")
        .insert([{
            nama: payload.nama.trim(),
            username: usernameClean,
            password: payload.password,
            role: "VIEWER",
            status: "PENDING",
            can_preview_photo: false,
            device_info: deviceInfo,
        }])
        .select()
        .single();

    return handleResponse(res);
};

/* ================= PROFILE & SESSION ================= */

export const updateProfile = async (username, data) => {
    const payload = { nama: data.nama };

    if (data.password) {
        payload.password = data.password;
    }

    const res = await supabaseClient
        .from("users")
        .update(payload)
        .eq("username", username)
        .select()
        .single();

    return handleResponse(res);
};

export const validateSession = async (username) => {
    const { data, error } = await supabaseClient
        .from("users")
        .select("username, nama, role, status, can_preview_photo, session_token, device_info")
        .eq("username", username)
        .single();

    if (error || !data) throw new Error("Session tidak valid atau akun tidak aktif");
    if (data.status !== "AKTIF") throw new Error("Akun dinonaktifkan");

    return data;
};

export const updateDeviceInfo = async (username, deviceInfo) => {
    const res = await supabaseClient
        .from("users")
        .update({ device_info: deviceInfo })
        .eq("username", username)
        .select()
        .single();

    return handleResponse(res);
};

export const updateSessionToken = async (username, token) => {
    const { error } = await supabaseClient
        .from("users")
        .update({ session_token: token })
        .eq("username", username);

    if (error) throw error;
};