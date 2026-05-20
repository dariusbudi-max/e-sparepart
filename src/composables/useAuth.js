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
}) {
	/* ================= LOGIN ================= */

	const handleLogin = async (loginData) => {
		if (!loginData) {
			showToast("Data login tidak ditemukan", "error");
			return;
		}

		if (!loginData.username || !loginData.password) {
			showToast("Username dan Password wajib diisi", "error");
			return;
		}

		loading.value = true;

		try {
			const user = await login(
				loginData.username,
				loginData.password
			);

			const sessionToken = crypto.randomUUID();
			const deviceInfo = getDeviceInfo();

			await updateSessionToken(
				user.username,
				sessionToken
			);

			await updateDeviceInfo(
				user.username,
				deviceInfo
			);

			userData.value = {
				username: user.username,
				nama: user.nama,
				role: user.role,
				canPreviewPhoto: user.can_preview_photo,
				device_info: deviceInfo,
				session_token: sessionToken
			};

			isLoggedIn.value = true;
			page.value = ROLE_LANDING_PAGE[user.role] || "dashboard";

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					session_token: sessionToken,
					loginAt: Date.now(),
				})
			);

			showToast(`Selamat datang, ${user.nama}!`, "success");
			await refreshAllData();
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loading.value = false;
		}
	};

	/* ================= REGISTER ================= */

	const handleRegister = async ({ regData, showRegisterModal }) => {
		if (regData.value.password.length < 6) {
			showToast("Password minimal 6 karakter", "error");
			return;
		}

		loading.value = true;

		try {
			const deviceInfo = getDeviceInfo();

			await register(regData.value, deviceInfo);

			showToast("Pendaftaran berhasil! Menunggu approval VicKey.", "success");

			showRegisterModal.value = false;
			regData.value = {
				nama: "",
				username: "",
				password: "",
			};
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loading.value = false;
		}
	};

	/* ================= UPDATE PROFILE ================= */

	const handleUpdateProfile = async ({
		profileForm,
		showProfileModal,
		refreshSession,
	}) => {
		loadingProfile.value = true;

		try {
			const updatedUser = await updateProfile(
				userData.value.username,
				profileForm
			);

			userData.value.nama = updatedUser.nama;

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					loginAt: Date.now(),
				})
			);

			showProfileModal.value = false;
			showToast("Profil berhasil diperbarui", "success");

			await refreshSession();
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loadingProfile.value = false;
		}
	};

	/* ================= REFRESH SESSION ================= */

	const refreshSession = async () => {
		try {
			const saved = localStorage.getItem("wms_user");
			if (!saved) return;

			const parsed = JSON.parse(saved);
			const currentDevice = getDeviceInfo();
			const freshUser = await validateSession(parsed.username);

			if (freshUser.session_token !== parsed.session_token) {
				showToast("Sesi login digunakan di perangkat lain", "error");
				await handleLogout();
				return;
			}

			if (freshUser.device_info && freshUser.device_info !== currentDevice) {
				showToast("Perangkat tidak dikenali", "error");
				await handleLogout();
				return;
			}

			userData.value = {
				username: freshUser.username,
				nama: freshUser.nama,
				role: freshUser.role,
				canPreviewPhoto: freshUser.can_preview_photo,
				device_info: currentDevice,
				session_token: parsed.session_token
			};

			isLoggedIn.value = true;
			page.value = ROLE_LANDING_PAGE[freshUser.role] || "dashboard";

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					loginAt: Date.now(),
				})
			);
		} catch (err) {
			console.error("Refresh session error:", err);
			await handleLogout();
		}
	};

	/* ================= LOGOUT ================= */

	const handleLogout = async () => {
		try {
			if (userData.value?.username) {
				await updateSessionToken(userData.value.username, null);
			}
		} catch (err) { }

		isLoggedIn.value = false;
		userData.value = {};
		localStorage.removeItem("wms_user");
		page.value = "login";
	};

	return {
		handleLogin,
		handleRegister,
		handleUpdateProfile,
		refreshSession,
		handleLogout,
	};
}