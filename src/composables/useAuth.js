import { getDeviceInfo } from "../utils/device.js";
import {
	login,
	register,
	updateProfile,
	validateSession,
	updateDeviceInfo,
	updateSessionToken
} from "../services/authService.js";

export function useAuth({
	loading,
	loadingProfile,
	userData,
	isLoggedIn,
	page,
	showToast,
	refreshAllData,
	ROLE_LANDING_PAGE,
	showRegisterModal
}) {
	const handleLogin = async (loginData) => {
		if (!loginData?.username || !loginData?.password) {
			showToast("Username dan Password wajib diisi", "error");
			return;
		}

		loading.value = true;

		try {
			const user = await login(loginData.username, loginData.password);
			const sessionToken = crypto.randomUUID();

			await updateSessionToken(user.username, sessionToken);
			await new Promise(resolve => setTimeout(resolve, 300));

			userData.value = {
				username: user.username,
				nama: user.nama,
				role: user.role,
				permissions:user.permissions || {},
				session_token: sessionToken,
			};

			isLoggedIn.value = true;
			page.value = ROLE_LANDING_PAGE[user.role] || "dashboard";

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					page: page.value,
					session_token: sessionToken,
					loginAt: Date.now(),
				})
			);

			await refreshAllData();
			showToast(`Selamat datang, ${user.nama}!`, "success");
		} catch (err) {
			showToast(err.message || "Login gagal", "error");
		} finally {
			loading.value = false;
		}
	};

	const handleRegister = async ({ regData }) => {
		if (!regData || !regData.password) {
			showToast("Data register tidak valid", "error");
			return;
		}

		if (regData.password.length < 6) {
			showToast("Password minimal 6 karakter", "error");
			return;
		}

		loading.value = true;

		try {
			const { deviceId, deviceName } = getDeviceInfo();

			await register(regData, {
				device_id: deviceId,
				device_name: deviceName
			});

			showToast("Pendaftaran berhasil! Menunggu approval.", "success");

			regData.nama = "";
			regData.username = "";
			regData.password = "";

			showRegisterModal.value = false;

			isLoggedIn.value = false;
			page.value = "login";
		} catch (err) {
			showToast(err.message || "Register gagal", "error");
		} finally {
			loading.value = false;
		}
	};

	const handleUpdateProfile = async ({ profileForm, showProfileModal }) => {
		loadingProfile.value = true;

		try {
			const updatedUser = await updateProfile(userData.value.username, profileForm);

			userData.value.nama = updatedUser.nama;

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					loginAt: Date.now()
				})
			);

			if (showProfileModal?.value !== undefined) {
				showProfileModal.value = false;
			}

			showToast("Profil berhasil diperbarui", "success");
			await refreshSession();
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loadingProfile.value = false;
		}
	};

	const refreshSession = async () => {
		try {
			const saved = localStorage.getItem("wms_user");
			if (!saved) return;

			const parsed = JSON.parse(saved);
			const freshUser = await validateSession(parsed.username);

			if (!freshUser) {
				showToast("Session tidak valid", "error");
				await handleLogout(true);
				return;
			}

			if (
				freshUser.session_token &&
				parsed.session_token &&
				freshUser.session_token !== parsed.session_token
			) {
				showToast("Sesi login Anda telah berakhir karena akun digunakan di perangkat lain", "error");
				await handleLogout(true, true);
				return;
			}

			const { deviceId, deviceName } = getDeviceInfo();

			userData.value = {
				username: freshUser.username,
				nama: freshUser.nama,
				role: freshUser.role,
				permissions:freshUser.permissions || {},
				device_id: deviceId,
				device_name: deviceName,
				session_token: parsed.session_token
			};

			isLoggedIn.value = true;

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					page: page.value,
					loginAt: parsed.loginAt || Date.now()
				})
			);

		} catch (err) {
			console.error("Refresh session error:", err);
		}
	};

	const handleLogout = async (silent = false, isKicked = false) => {
		try {
			if (userData.value?.username && !isKicked) {
				await updateSessionToken(userData.value.username, null);
			}
		} catch (err) {
			console.warn("Logout API error:", err);
		}

		isLoggedIn.value = false;
		userData.value = {
			username: "",
			nama: "",
			role: "",
			permissions:{}
		};

		localStorage.removeItem("wms_user");
		page.value = "login";

		if (!silent) {
			showToast("Logout berhasil", "success");
		}
	};

	return {
		handleLogin,
		handleRegister,
		handleUpdateProfile,
		refreshSession,
		handleLogout,
	};
}
