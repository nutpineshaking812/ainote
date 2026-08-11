import api from './index';

/**
 * Updates the user's profile information.
 * @param {object} profileData - The profile data to update (e.g., { username, nickname }).
 * @returns {Promise<object>} The updated user object.
 */
export const updateProfile = async (profileData) => {
  return api.put('/user/profile', profileData);
};

/**
 * Changes the user's password.
 * @param {object} passwordData - The password data to update (e.g., { oldPassword, newPassword }).
 * @returns {Promise<object>} A success message.
 */
export const changePassword = async (passwordData) => {
  return api.put('/user/password', passwordData);
};

/**
 * Gets the user's token quota and balance.
 * @returns {Promise<object>} The quota object { tokenBalance, totalTokenUsage, invitationSlots }.
 */
export const getUserQuota = async () => {
  return api.get('/user/quota');
};
