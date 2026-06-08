import * as desktopApi from './desktop-api'
import * as serverApi from './api.functions'

const useDesktopApi = import.meta.env.MODE === 'tauri'

function select<T extends keyof typeof serverApi & keyof typeof desktopApi>(key: T) {
  return (useDesktopApi ? desktopApi[key] : serverApi[key]) as typeof serverApi[T]
}

export const setupValidator = select('setupValidator')
export const changeAdminPasswordFn = select('changeAdminPasswordFn')
export const loginFn = select('loginFn')
export const logoutFn = select('logoutFn')
export const getCurrentUserFn = select('getCurrentUserFn')
export const getAllMembersFn = select('getAllMembersFn')
export const getCheckInMembersFn = select('getCheckInMembersFn')
export const createMemberFn = select('createMemberFn')
export const renewMembershipFn = select('renewMembershipFn')
export const deleteMemberFn = select('deleteMemberFn')
export const registerAttendanceFn = select('registerAttendanceFn')
export const getTodayAttendanceFn = select('getTodayAttendanceFn')
export const getAttendanceLogsFn = select('getAttendanceLogsFn')
export const getMonthlySummaryFn = select('getMonthlySummaryFn')
export const deleteAttendanceFn = select('deleteAttendanceFn')
export const exportBackupFn = select('exportBackupFn')
export const restoreBackupFn = select('restoreBackupFn')
