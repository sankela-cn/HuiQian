<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  CircleCheckFilled,
  Connection,
  DataAnalysis,
  DocumentChecked,
  Grid,
  Monitor,
  MoreFilled,
  Operation,
  Picture,
  Refresh,
  Search,
  Setting,
  SwitchButton,
  User,
  UserFilled,
} from '@element-plus/icons-vue'

type Page = 'overview' | 'students' | 'attendance' | 'statistics' | 'settings' | 'activity' | 'account' | 'admins'

type NavigationItem = {
  id: Page
  label: string
  icon: Component
}

type AdminAccount = {
  id: number
  username: string
  account_type: 'super_admin' | 'admin'
  enabled: number
}

type WebApiErrorPayload = {
  code?: string
  msg?: string
}

type Student = {
  id: number
  name: string
  role: string
  samples: number
  fingerprint: string
  joined: string
}

type BackendStudent = {
  id: number
  name: string
  role: string | number
  created_at: string
  sample_count: number
  fp_count: number
}

type AttendanceRecord = {
  id: number
  user_id: number
  name: string
  punch_time: string
  kind: 'in' | 'out'
  photo?: string | null
}

type PresenceUser = { user_id: number; name: string; in_time: string }
type StatsUser = { user_id: number; name: string; punches: number; seconds: number }
type ActivityLog = { id: number; actor: string; action: string; detail: string; created_at: string }
type ApiActivityLog = {
  id: number
  user?: string | null
  actor?: string | null
  action: string
  detail?: string | null
  log_time?: string | null
  created_at?: string | null
}
type PunchSettings = { punch_mode: 'unlimited' | 'window'; windows: string[][]; out_deadline: string }

const navItems: NavigationItem[] = [
  { id: 'overview', label: '总览', icon: Grid },
  { id: 'students', label: '学生', icon: User },
  { id: 'attendance', label: '考勤', icon: DocumentChecked },
  { id: 'statistics', label: '统计', icon: DataAnalysis },
  { id: 'settings', label: '设置', icon: Setting },
  { id: 'activity', label: '日志', icon: Operation },
]

const pageTitles: Record<Page, string> = {
  overview: '现场总览',
  students: '学生档案',
  attendance: '考勤记录',
  statistics: '本周统计',
  settings: '打卡设置',
  activity: '操作日志',
  account: '我的账号',
  admins: '管理员账号',
}

const students = ref<Student[]>([])

const recentActivity = [
  { name: '刘恩泽', action: '签到成功', time: '09:18', method: '人脸 + 指纹', tone: 'success' },
  { name: '张欣怡', action: '签到成功', time: '09:05', method: '人脸识别', tone: 'info' },
  { name: '陈浩然', action: '签退成功', time: '08:56', method: '人脸识别', tone: 'warning' },
  { name: '李雨桐', action: '签到成功', time: '08:42', method: '人脸 + 指纹', tone: 'success' },
  { name: '王嘉禾', action: '签到成功', time: '08:33', method: '人脸识别', tone: 'info' },
]

// Legacy mock data is intentionally retained for now because this file contains older encoded text.
void recentActivity

const signedIn = ref(false)
const sessionChecking = ref(true)
const loginSubmitting = ref(false)
const logoutSubmitting = ref(false)
const loginError = ref('')
const loginForm = ref({ username: '', password: '' })
const currentAdmin = ref<AdminAccount | null>(null)
const activePage = ref<Page>('overview')
const searchTerm = ref('')
const drawerOpen = ref(false)
const connectionDialogOpen = ref(false)
const piBaseUrl = ref('http://127.0.0.1:8000')
const connectionStatus = ref<'online' | 'offline'>('offline')
const lastCheckedAt = ref('未检查')
const isRefreshing = ref(false)
const connectionSaving = ref(false)
const connectionMessage = ref('')
const connectionMessageType = ref<'success' | 'error'>('success')
const selectedStudent = ref<Student>({ id: 0, name: '', role: '', samples: 0, fingerprint: '', joined: '' })
const studentRoleFilter = ref('')
const studentEditorOpen = ref(false)
const studentEditSubmitting = ref(false)
const studentEditError = ref('')
const studentEditForm = ref({ name: '', role: '0' })
const passwordSaved = ref(false)
const attendanceRecords = ref<AttendanceRecord[]>([])
const attendanceDate = ref(new Date().toISOString().slice(0, 10))
const attendanceLoaded = ref(false)
const attendanceRefreshing = ref(false)
const attendanceError = ref('')
const attendanceLastUpdatedAt = ref('')
const attendanceRefreshMessage = ref('')
const attendanceRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null)
const unavailableAttendancePhotoIds = ref<number[]>([])
const presenceUsers = ref<PresenceUser[]>([])
const presenceCount = ref(0)
const statsUsers = ref<StatsUser[]>([])
const statsLoaded = ref(false)
const statsRefreshing = ref(false)
const statsError = ref('')
const statsLastUpdatedAt = ref('')
const statsRefreshMessage = ref('')
const statsRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null)
const activityLogs = ref<ActivityLog[]>([])
const activityLoaded = ref(false)
const activityKeyword = ref('')
const activityActor = ref('')
const activityAction = ref('')
const activityDate = ref('')
const settingsLoaded = ref(false)
const defaultPunchWindows = [['07:30', '10:00']]
const settingsState = ref<PunchSettings>({ punch_mode: 'unlimited', windows: defaultPunchWindows.map((window) => [...window]), out_deadline: '23:00' })
const admins = ref<AdminAccount[]>([])
const adminsLoaded = ref(false)
const adminForm = ref({ username: '', password: '' })
const adminSaving = ref(false)
const adminPasswordDraft = ref<Record<number, string>>({})
const adminError = ref('')
const passwordForm = ref({ current: '', next: '', confirm: '' })
const settingsMessage = ref('')

const filteredStudents = computed(() => {
  const keyword = searchTerm.value.trim()
  return students.value.filter((student) => {
    const matchesKeyword = !keyword || student.name.includes(keyword)
    const matchesRole = !studentRoleFilter.value || student.role === studentRoleFilter.value
    return matchesKeyword && matchesRole
  })
})

const currentTitle = computed(() => pageTitles[activePage.value])
const isOnline = computed(() => connectionStatus.value === 'online')
const accountTypeLabel = computed(() => currentAdmin.value?.account_type === 'super_admin' ? '超级管理员' : '普通管理员')
const piAddress = computed(() => `后端 · ${piBaseUrl.value}`)

function webApiErrorMessage(payload: WebApiErrorPayload, status: number): string {
  const messages: Record<string, string> = {
    ADMIN_ACCOUNT_NOT_FOUND: '管理员账号不存在，请先在树莓派后端创建账号。',
    ADMIN_CREDENTIALS_INVALID: '账号或密码错误，请检查后重试。',
    CREDENTIALS_REQUIRED: '请输入管理员账号和密码。',
    PI_LOGIN_ENDPOINT_MISSING: '树莓派后端不支持管理员登录，请先更新后端代码。',
    PI_UNREACHABLE: '无法连接后端，请检查地址、网络和后端服务。',
    WEB_SESSION_REQUIRED: '请先登录管理后台。',
  }
  return messages[payload.code ?? ''] ?? payload.msg ?? `请求失败（HTTP ${status}），请稍后重试。`
}

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'include', ...options })
  } catch {
    throw new Error('无法连接本机网页服务，请确认网页服务正在运行。')
  }

  const payload = await response.json().catch(() => ({})) as T & WebApiErrorPayload
  if (!response.ok) {
    throw new Error(webApiErrorMessage(payload, response.status))
  }
  return payload
}

async function checkSession() {
  sessionChecking.value = true
  loginError.value = ''
  try {
    const payload = await readJson<{ admin: AdminAccount }>('/web-api/auth/me')
    currentAdmin.value = payload.admin
    signedIn.value = true
    await loadWorkspaceData()
  } catch (error) {
    currentAdmin.value = null
    signedIn.value = false
    if (error instanceof Error && error.message !== '请先登录管理后台') {
      loginError.value = error.message
    }
  } finally {
    sessionChecking.value = false
  }
}

async function submitLogin() {
  if (loginSubmitting.value) return
  loginSubmitting.value = true
  loginError.value = ''
  try {
    const payload = await readJson<{ admin: AdminAccount }>('/web-api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value),
    })
    currentAdmin.value = payload.admin
    loginForm.value.password = ''
    signedIn.value = true
    await loadWorkspaceData()
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请稍后重试。'
  } finally {
    loginSubmitting.value = false
  }
}

async function logout() {
  if (logoutSubmitting.value) return
  logoutSubmitting.value = true
  try {
    await readJson('/web-api/auth/logout', { method: 'POST' })
    currentAdmin.value = null
    signedIn.value = false
    activePage.value = 'overview'
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '退出失败，请稍后重试。'
  } finally {
    logoutSubmitting.value = false
  }
}

async function selectPage(page: Page) {
  const samePage = activePage.value === page
  activePage.value = page
  syncRefreshTimer(page)
  if (page === 'attendance') await loadAttendance()
  if (page === 'statistics') await loadStatistics()
  if (page === 'settings') await loadSettings()
  if (page === 'activity') await loadActivity(samePage)
  if (page === 'admins') await loadAdmins()
}

function openStudent(student: Student) {
  selectedStudent.value = student
  drawerOpen.value = true
}

function openStudentEditor() {
  studentEditForm.value = {
    name: selectedStudent.value.name,
    role: selectedStudent.value.role === '管理员' ? '1' : '0',
  }
  studentEditError.value = ''
  // Close the drawer mask before opening the dialog so it cannot intercept dialog clicks.
  drawerOpen.value = false
  studentEditorOpen.value = true
}

function closeStudentEditor() {
  studentEditorOpen.value = false
  drawerOpen.value = true
}

async function saveStudentEdit() {
  const name = studentEditForm.value.name.trim()
  if (!name) {
    studentEditError.value = '请输入姓名。'
    return
  }
  if (studentEditSubmitting.value) return
  studentEditSubmitting.value = true
  studentEditError.value = ''
  try {
    await readJson(`/web-api/students/${selectedStudent.value.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role: Number(studentEditForm.value.role) }),
    })
    const editedId = selectedStudent.value.id
    await loadStudents()
    const updated = students.value.find((student) => student.id === editedId)
    if (updated) selectedStudent.value = updated
    studentEditorOpen.value = false
    drawerOpen.value = true
  } catch (error) {
    studentEditError.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  } finally {
    studentEditSubmitting.value = false
  }
}

async function refreshConnection() {
  isRefreshing.value = true
  try {
    const payload = await readJson<{ online: boolean; checked_at: string; base_url?: string }>('/web-api/connection')
    connectionStatus.value = payload.online ? 'online' : 'offline'
    if (payload.base_url) piBaseUrl.value = payload.base_url
    lastCheckedAt.value = new Date(payload.checked_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    connectionStatus.value = 'offline'
    lastCheckedAt.value = '连接失败'
  } finally {
    isRefreshing.value = false
  }
}

async function loadStudents() {
  try {
    const payload = await readJson<{ students: BackendStudent[] }>('/web-api/students')
    students.value = payload.students.map((student) => ({
      id: student.id,
      name: student.name,
      role: studentRoleLabel(student.role),
      samples: student.sample_count,
      fingerprint: student.fp_count > 0 ? '已绑定' : '未绑定',
      joined: student.created_at,
    }))
    if (students.value.length > 0) selectedStudent.value = students.value[0]
  } catch {
    students.value = []
  }
}

function studentRoleLabel(role: string | number): string {
  if (role === 1 || role === '1' || role === '管理员') return '管理员'
  return '学生'
}

type RefreshSource = 'initial' | 'manual' | 'auto'

function formatUpdatedAt() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function loadAttendance(force = false, source: RefreshSource = 'initial') {
  if (attendanceLoaded.value && !force) return
  if (attendanceRefreshing.value) return
  attendanceRefreshing.value = true
  attendanceError.value = ''
  attendanceRefreshMessage.value = ''
  const query = attendanceDate.value ? `?date=${encodeURIComponent(attendanceDate.value)}` : ''
  try {
    const payload = await readJson<{ records: AttendanceRecord[] }>(`/web-api/attendance${query}`)
    attendanceRecords.value = Array.isArray(payload.records) ? payload.records : []
    unavailableAttendancePhotoIds.value = []
    attendanceLastUpdatedAt.value = formatUpdatedAt()
    if (source === 'manual') {
      attendanceRefreshMessage.value = '已更新'
      setTimeout(() => { attendanceRefreshMessage.value = '' }, 2500)
    }
  } catch (error) {
    attendanceError.value = error instanceof Error ? error.message : '考勤记录刷新失败，请稍后重试'
  } finally {
    attendanceLoaded.value = true
    attendanceRefreshing.value = false
  }
}

function retryAttendance() {
  return loadAttendance(true, 'manual')
}

async function loadPresence() {
  try {
    const payload = await readJson<{ count: number; users: PresenceUser[] }>('/web-api/presence')
    presenceCount.value = Number.isFinite(payload.count) ? payload.count : 0
    presenceUsers.value = Array.isArray(payload.users) ? payload.users : []
  } catch {
    presenceCount.value = 0
    presenceUsers.value = []
  }
}

async function loadStatistics(force = false, source: RefreshSource = 'initial') {
  if (statsLoaded.value && !force) return
  if (statsRefreshing.value) return
  statsRefreshing.value = true
  statsError.value = ''
  statsRefreshMessage.value = ''
  try {
    const payload = await readJson<{ stats: { users: StatsUser[] } }>('/web-api/statistics')
    statsUsers.value = Array.isArray(payload.stats?.users) ? payload.stats.users : []
    statsLastUpdatedAt.value = formatUpdatedAt()
    if (source === 'manual') {
      statsRefreshMessage.value = '已更新'
      setTimeout(() => { statsRefreshMessage.value = '' }, 2500)
    }
  } catch (error) {
    statsError.value = error instanceof Error ? error.message : '统计数据刷新失败，请稍后重试'
  } finally {
    statsLoaded.value = true
    statsRefreshing.value = false
  }
}

function retryStatistics() {
  return loadStatistics(true, 'manual')
}

async function loadActivity(force = false) {
  if (activityLoaded.value && !force) return
  try {
    const payload = await readJson<{ logs: ApiActivityLog[] }>('/web-api/activity')
    activityLogs.value = (Array.isArray(payload.logs) ? payload.logs : []).map((log) => ({
      id: log.id,
      actor: log.user ?? log.actor ?? '',
      action: log.action,
      detail: log.detail ?? '',
      created_at: log.log_time ?? log.created_at ?? '',
    }))
    resetActivityFilters()
    activityLoaded.value = true
  } catch {
    activityLogs.value = []
    activityLoaded.value = false
  }
}

const activityActionLabels: Record<string, string> = {
  'administrator login': '管理员登录',
  'administrator logout': '管理员退出',
  'create administrator': '创建管理员',
  'update administrator status': '更新管理员状态',
  'reset administrator password': '重置管理员密码',
  'change own administrator password': '修改管理员密码',
  'delete user': '删除用户',
  punch: '打卡',
  'update settings': '修改打卡设置',
}

function activityActionLabel(action: string): string {
  return activityActionLabels[action] ?? action
}

function activityDetailLabel(detail: string): string {
  if (detail === 'session issued') return '登录会话已创建'
  if (detail === 'session revoked') return '登录会话已撤销'
  const username = detail.match(/^username=(.+)$/)
  if (username) return `用户名：${username[1]}`
  const status = detail.match(/^id=(\d+) enabled=(0|1)$/)
  if (status) return `管理员 #${status[1]}${status[2] === '1' ? '已启用' : '已禁用'}`
  const punch = detail.match(/^(in|out)\s+(.+)$/)
  if (punch) return `${punch[1] === 'in' ? '签到' : '签退'} · 照片：${punch[2]}`
  return detail
}

const activityActorOptions = computed(() => Array.from(new Set(activityLogs.value.map((log) => log.actor).filter(Boolean))).sort())
const activityActionOptions = computed(() => Array.from(new Set(activityLogs.value.map((log) => log.action).filter(Boolean))).sort())
const filteredActivityLogs = computed(() => {
  const keyword = activityKeyword.value.trim().toLocaleLowerCase()
  return activityLogs.value.filter((log) => {
    const matchesKeyword = !keyword || [log.actor, log.action, activityActionLabel(log.action), log.detail, activityDetailLabel(log.detail)]
      .some((value) => value.toLocaleLowerCase().includes(keyword))
    const matchesActor = !activityActor.value || log.actor === activityActor.value
    const matchesAction = !activityAction.value || log.action === activityAction.value
    const matchesDate = !activityDate.value || log.created_at.slice(0, 10) === activityDate.value
    return matchesKeyword && matchesActor && matchesAction && matchesDate
  })
})

function resetActivityFilters() {
  activityKeyword.value = ''
  activityActor.value = ''
  activityAction.value = ''
  activityDate.value = ''
}

function normalizePunchWindows(windows: unknown): string[][] {
  if (!Array.isArray(windows)) return defaultPunchWindows.map((window) => [...window])
  const normalized = windows
    .filter((window): window is unknown[] => Array.isArray(window))
    .map((window) => [String(window[0] ?? ''), String(window[1] ?? '')])
  return normalized.length ? normalized : defaultPunchWindows.map((window) => [...window])
}

async function loadSettings(force = false) {
  if (settingsLoaded.value && !force) return
  try {
    const payload = await readJson<PunchSettings>('/web-api/settings')
    settingsState.value = {
      punch_mode: payload.punch_mode === 'window' ? 'window' : 'unlimited',
      windows: normalizePunchWindows(payload.windows),
      out_deadline: payload.out_deadline || '23:00',
    }
  } catch {
    settingsState.value = { punch_mode: 'unlimited', windows: defaultPunchWindows.map((window) => [...window]), out_deadline: '23:00' }
  } finally {
    settingsLoaded.value = true
  }
}

async function loadAdmins(force = false) {
  if (adminsLoaded.value && !force) return
  try {
    const payload = await readJson<{ admins: AdminAccount[] }>('/web-api/admins')
    admins.value = Array.isArray(payload.admins) ? payload.admins : []
  } catch {
    admins.value = []
  } finally {
    adminsLoaded.value = true
  }
}

function attendanceLabel(kind: AttendanceRecord['kind']) {
  return kind === 'in' ? '签到' : '签退'
}

function attendancePhotoUrl(record: AttendanceRecord): string | null {
  const filename = record.photo?.trim() ?? ''
  if (
    unavailableAttendancePhotoIds.value.includes(record.id) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)
  ) {
    return null
  }
  return `/web-api/attendance/photos/${encodeURIComponent(filename)}`
}

function markAttendancePhotoUnavailable(recordId: number) {
  if (!unavailableAttendancePhotoIds.value.includes(recordId)) {
    unavailableAttendancePhotoIds.value = [...unavailableAttendancePhotoIds.value, recordId]
  }
}

function attendanceTone(kind: AttendanceRecord['kind']) {
  return kind === 'in' ? 'success' : 'warning'
}

function formatPunchTime(value: string) {
  if (!value) return ''
  return value.replace('T', ' ').slice(11, 16)
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}小时${minutes}分`
}

function addPunchWindow() {
  settingsState.value.windows.push(['', ''])
}

function removePunchWindow(index: number) {
  if (settingsState.value.windows.length > 1) settingsState.value.windows.splice(index, 1)
}

type PunchWindowRange = { startMinutes: number; endMinutes: number }

type PunchWindowValidation = PunchWindowRange | { error: string }

function validatePunchWindows(windows: string[][]): string {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
  const ranges: PunchWindowValidation[] = windows.map((window, index) => {
    const start = window[0]?.trim() ?? ''
    const end = window[1]?.trim() ?? ''
    if (!timePattern.test(start) || !timePattern.test(end)) return { error: `请完整填写时间段 ${index + 1}，格式为 HH:mm。` }
    const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3))
    const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3))
    if (startMinutes >= endMinutes) return { error: `时间段 ${index + 1} 的开始时间必须早于结束时间。` }
    return { startMinutes, endMinutes }
  })
  const invalid = ranges.find((range): range is { error: string } => 'error' in range)
  if (invalid) return invalid.error
  const validRanges = ranges as PunchWindowRange[]
  for (let index = 0; index < validRanges.length; index += 1) {
    for (let next = index + 1; next < validRanges.length; next += 1) {
      const current = validRanges[index]
      const following = validRanges[next]
      if (current.startMinutes < following.endMinutes && following.startMinutes < current.endMinutes) {
        return `时间段 ${index + 1} 与时间段 ${next + 1} 不能重叠。`
      }
    }
  }
  return ''
}

async function saveSettings() {
  settingsMessage.value = ''
  const validationError = validatePunchWindows(settingsState.value.windows)
  if (validationError) {
    settingsMessage.value = validationError
    return
  }
  try {
    await readJson('/web-api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsState.value),
    })
    settingsMessage.value = '打卡设置已保存。'
  } catch (error) {
    settingsMessage.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  }
}

async function changePassword() {
  passwordSaved.value = false
  if (!passwordForm.value.current || !passwordForm.value.next || passwordForm.value.next !== passwordForm.value.confirm) {
    settingsMessage.value = '请填写当前密码，并确认两次新密码一致。'
    return
  }
  try {
    await readJson('/web-api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: passwordForm.value.current, new_password: passwordForm.value.next }),
    })
    currentAdmin.value = null
    signedIn.value = false
    loginError.value = '密码已更新，请使用新密码重新登录。'
  } catch (error) {
    settingsMessage.value = error instanceof Error ? error.message : '修改密码失败，请稍后重试。'
  }
}

async function createAdmin() {
  if (adminSaving.value) return
  adminSaving.value = true
  adminError.value = ''
  try {
    await readJson('/web-api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminForm.value),
    })
    adminForm.value = { username: '', password: '' }
    await loadAdmins(true)
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : '创建失败，请稍后重试。'
  } finally {
    adminSaving.value = false
  }
}

async function updateAdminStatus(admin: AdminAccount) {
  if (admin.account_type === 'super_admin') return
  adminError.value = ''
  try {
    await readJson(`/web-api/admins/${admin.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !admin.enabled }),
    })
    await loadAdmins(true)
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : '更新失败，请稍后重试。'
  }
}

async function resetAdminPassword(admin: AdminAccount) {
  const password = adminPasswordDraft.value[admin.id] ?? ''
  if (!password) {
    adminError.value = '请输入新密码。'
    return
  }
  adminError.value = ''
  try {
    await readJson(`/web-api/admins/${admin.id}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    adminPasswordDraft.value[admin.id] = ''
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : '重置失败，请稍后重试。'
  }
}

async function loadWorkspaceData() {
  await refreshConnection()
  await loadStudents()
  await Promise.all([loadAttendance(), loadPresence()])
}

function normalizeConnectionInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

async function saveConnection() {
  if (connectionSaving.value) return
  connectionSaving.value = true
  connectionMessage.value = ''
  try {
    const payload = await readJson<{ online: boolean; checked_at: string; base_url: string }>('/web-api/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: normalizeConnectionInput(piBaseUrl.value) }),
    })
    piBaseUrl.value = payload.base_url
    connectionStatus.value = payload.online ? 'online' : 'offline'
    lastCheckedAt.value = new Date(payload.checked_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    connectionMessageType.value = 'success'
    connectionMessage.value = '后端连接成功'
    try {
      await readJson('/web-api/auth/me')
    } catch {
      currentAdmin.value = null
      signedIn.value = false
      activePage.value = 'overview'
      connectionDialogOpen.value = false
      loginError.value = '后端已连接，但当前登录会话来自旧后端，请使用新后端管理员账号重新登录。'
      return
    }
    await loadStudents()
    await Promise.all([loadAttendance(true), loadPresence()])
  } catch (error) {
    connectionMessageType.value = 'error'
    connectionMessage.value = error instanceof Error ? error.message : '后端连接失败，请检查地址和网络。'
    await refreshConnection()
  } finally {
    connectionSaving.value = false
  }
}

function clearRefreshTimers() {
  if (attendanceRefreshTimer.value) clearInterval(attendanceRefreshTimer.value)
  if (statsRefreshTimer.value) clearInterval(statsRefreshTimer.value)
  attendanceRefreshTimer.value = null
  statsRefreshTimer.value = null
}

function syncRefreshTimer(page: Page) {
  clearRefreshTimers()
  if (page === 'attendance') {
    attendanceRefreshTimer.value = setInterval(() => loadAttendance(true, 'auto'), 60_000)
  }
  if (page === 'statistics') {
    statsRefreshTimer.value = setInterval(() => loadStatistics(true, 'auto'), 60_000)
  }
}

watch(activePage, (page) => syncRefreshTimer(page))
watch(attendanceDate, () => {
  attendanceRefreshMessage.value = ''
  void loadAttendance(true, 'manual')
})
onBeforeUnmount(clearRefreshTimers)
onMounted(checkSession)
</script>

<template>
  <main v-if="sessionChecking" class="login-screen" aria-live="polite">
    <section class="login-panel session-loading">正在验证管理员会话...</section>
  </main>

  <main v-else-if="!signedIn" class="login-screen">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-signal" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="eyebrow">HUIQIAN / 管理端</p>
      <h1 id="login-title">回到考勤现场</h1>
      <p class="login-copy">使用管理员账号连接当前树莓派。登录凭据不会保存在浏览器中。</p>
      <el-form label-position="top" @submit.prevent="submitLogin">
        <el-form-item label="管理员用户名">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" placeholder="请输入密码" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-button class="login-button" type="primary" native-type="submit" :loading="loginSubmitting">进入管理台</el-button>
      </el-form>
      <p v-if="loginError" class="login-error" role="alert">{{ loginError }}</p>
      <p class="login-target"><span class="status-dot online"></span>{{ piAddress }}</p>
    </section>
  </main>

  <main v-else class="app-shell">
    <aside class="side-rail">
      <button class="brand" type="button" aria-label="返回现场总览" @click="selectPage('overview')">
        <span class="brand-mark"><Connection /></span>
        <span><strong>慧签</strong><small>现场管理台</small></span>
      </button>

      <nav class="primary-nav" aria-label="主导航">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-item hover-lift"
          :class="{ active: activePage === item.id }"
          type="button"
          @click="selectPage(item.id)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="rail-footer">
        <button class="account-button" type="button" @click="selectPage('account')">
          <span class="avatar">{{ currentAdmin?.username.slice(0, 1).toUpperCase() }}</span>
          <span><strong>{{ currentAdmin?.username }}</strong><small>{{ accountTypeLabel }}</small></span>
          <el-icon><MoreFilled /></el-icon>
        </button>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">现场控制 / {{ activePage === 'overview' ? '实时总览' : '管理工作区' }}</p>
          <h1>{{ currentTitle }}</h1>
        </div>
        <div class="top-actions">
          <button class="signal-chip" type="button" @click="connectionDialogOpen = true">
            <span class="status-dot" :class="isOnline ? 'online' : 'offline'"></span>
            <span>{{ isOnline ? '树莓派在线' : '树莓派离线' }}</span>
            <small>{{ piAddress }}</small>
          </button>
          <button class="icon-button" type="button" aria-label="刷新连接状态" @click="refreshConnection">
            <el-icon :class="{ spinning: isRefreshing }"><Refresh /></el-icon>
          </button>
        </div>
      </header>

      <section v-if="activePage === 'overview'" class="page-content overview-page">
        <section class="signal-strip" data-testid="connection-signal">
          <div class="signal-leading">
            <span class="signal-icon"><Monitor /></span>
            <div>
              <p>{{ isOnline ? '树莓派在线' : '树莓派离线' }}</p>
              <span>{{ isOnline ? '设备、考勤和人员数据正在同步' : '正在显示最后一次成功读取的数据' }}</span>
            </div>
          </div>
          <div class="signal-meta">
            <span>最后检查</span>
            <strong>{{ lastCheckedAt }}</strong>
          </div>
          <button class="text-button" type="button" @click="refreshConnection">重新连接</button>
        </section>

        <section class="metric-grid" aria-label="今日数据">
          <article class="metric-card blue hover-lift">
            <span>系统人数</span>
            <strong>{{ students.length }}</strong>
            <small>已录入人员</small>
          </article>
          <article class="metric-card green hover-lift">
            <span>当前在场</span>
            <strong>{{ presenceCount }}</strong>
            <small>当前在场</small>
          </article>
          <article class="metric-card orange hover-lift">
            <span>今日签到</span>
            <strong>{{ attendanceRecords.filter((record) => record.kind === 'in').length }}</strong>
            <small>今日签到</small>
          </article>
          <article class="metric-card violet hover-lift">
            <span>今日签退</span>
            <strong>{{ attendanceRecords.filter((record) => record.kind === 'out').length }}</strong>
            <small>今日签退</small>
          </article>
        </section>

        <section class="overview-grid">
          <article class="activity-panel hover-lift" data-testid="activity-feed">
            <div class="section-heading">
              <div>
                <p class="eyebrow">实时记录</p>
                <h2>最近打卡动态</h2>
              </div>
              <button class="text-button" type="button" @click="selectPage('attendance')">查看全部</button>
            </div>
            <ol class="activity-list">
              <li v-for="record in attendanceRecords.slice(0, 5)" :key="record.id" class="hover-lift">
                <span class="activity-time">{{ formatPunchTime(record.punch_time) }}</span>
                <span class="activity-line" :class="attendanceTone(record.kind)"></span>
                <div class="activity-person"><strong>{{ record.name }}</strong><span>树莓派考勤记录</span></div>
                <span class="event-pill" :class="attendanceTone(record.kind)">{{ attendanceLabel(record.kind) }}</span>
              </li>
            </ol>
          </article>

          <aside class="presence-panel hover-lift">
            <div class="section-heading compact">
              <div><p class="eyebrow">现场快照</p><h2>在场人员</h2></div>
              <span class="count-badge">{{ presenceCount }} 人</span>
            </div>
            <div class="presence-stack" aria-label="在场人员头像">
              <span v-for="person in presenceUsers.slice(0, 6)" :key="person.user_id" class="presence-avatar">{{ person.name.slice(0, 1) }}</span>
              <span v-if="presenceCount > 6" class="presence-more">+{{ presenceCount - 6 }}</span>
            </div>
            <div class="presence-note"><CircleCheckFilled /> {{ presenceCount ? '当前在场人员已同步' : '当前没有在场人员' }}</div>
            <button class="wide-secondary" type="button" @click="selectPage('students')">查看人员状态</button>
          </aside>
        </section>
      </section>

      <section v-else-if="activePage === 'students'" class="page-content">
        <div class="page-toolbar">
          <el-input v-model="searchTerm" class="search-box" placeholder="搜索学生姓名" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <select v-model="studentRoleFilter" class="student-role-filter" aria-label="按角色筛选">
            <option value="">全部角色</option>
            <option value="学生">学生</option>
            <option value="管理员">管理员</option>
          </select>
        </div>
        <section class="data-surface">
          <div class="section-heading"><div><p class="eyebrow">人员档案</p><h2>已录入学生</h2></div><span class="surface-count">{{ filteredStudents.length }} 人</span></div>
          <div class="desktop-table">
            <div class="table-row table-header"><span>姓名</span><span>人员角色</span><span>人脸样本</span><span>指纹</span><span>录入日期</span><span></span></div>
            <button v-for="student in filteredStudents" :key="student.name" class="table-row table-data hover-lift" type="button" @click="openStudent(student)">
              <span class="name-cell"><i>{{ student.name.slice(0, 1) }}</i>{{ student.name }}</span><span>{{ student.role }}</span><span>{{ student.samples }} 张</span><span><b :class="student.fingerprint === '已绑定' ? 'good' : 'muted'">{{ student.fingerprint }}</b></span><span>{{ student.joined }}</span><span>查看</span>
            </button>
          </div>
        </section>
      </section>

      <section v-else-if="activePage === 'attendance'" class="page-content">
        <div class="page-toolbar"><el-input v-model="attendanceDate" class="search-box" type="date" /><el-button data-testid="attendance-refresh" plain :loading="attendanceRefreshing" :disabled="attendanceRefreshing" @click="loadAttendance(true, 'manual')">刷新记录</el-button><span class="refresh-meta">最后更新：{{ attendanceLastUpdatedAt || '尚未更新' }}</span><span v-if="attendanceRefreshMessage" class="refresh-success">{{ attendanceRefreshMessage }}</span></div>
        <div v-if="attendanceError" class="refresh-error" role="alert"><span>刷新失败：{{ attendanceError }}{{ attendanceRecords.length ? '，已保留当前数据' : '' }}</span><el-button data-testid="attendance-retry" link type="danger" @click="retryAttendance">重试</el-button></div>
        <section class="data-surface">
          <div class="section-heading"><div><p class="eyebrow">考勤流水</p><h2>当天记录</h2></div><span class="surface-count">{{ attendanceRecords.length }} 条</span></div>
          <ol class="attendance-list">
            <li v-for="record in attendanceRecords" :key="record.id" class="hover-lift">
              <span class="attendance-time">{{ formatPunchTime(record.punch_time) }}</span>
              <span class="avatar mini">{{ record.name.slice(0, 1) }}</span>
              <div><strong>{{ record.name }}</strong><small>{{ record.punch_time }}</small></div>
              <span class="event-pill" :class="attendanceTone(record.kind)">{{ attendanceLabel(record.kind) }}</span>
              <span class="attendance-photo">
                <el-image
                  v-if="attendancePhotoUrl(record)"
                  class="attendance-photo-image"
                  :src="attendancePhotoUrl(record) ?? ''"
                  :preview-src-list="[attendancePhotoUrl(record) ?? '']"
                  preview-teleported
                  fit="cover"
                  :alt="`${record.name}的打卡照片`"
                  @error="markAttendancePhotoUnavailable(record.id)"
                />
                <span v-else class="attendance-photo-unavailable" data-testid="attendance-photo-unavailable">
                  <el-icon><Picture /></el-icon>
                  <small>无照片</small>
                </span>
              </span>
            </li>
            <li v-if="!attendanceRecords.length" class="empty-row">当前日期没有考勤记录</li>
          </ol>
        </section>
      </section>

      <section v-else-if="activePage === 'statistics'" class="page-content">
        <section class="data-surface statistic-surface"><div class="section-heading"><div><p class="eyebrow">本周汇总</p><h2>人员考勤统计</h2></div><div class="section-actions"><span class="refresh-meta">最后更新：{{ statsLastUpdatedAt || '尚未更新' }}</span><span v-if="statsRefreshMessage" class="refresh-success">{{ statsRefreshMessage }}</span><el-button data-testid="statistics-refresh" plain :loading="statsRefreshing" :disabled="statsRefreshing" @click="loadStatistics(true, 'manual')">刷新</el-button></div></div><div v-if="statsError" class="refresh-error" role="alert"><span>刷新失败：{{ statsError }}{{ statsUsers.length ? '，已保留当前数据' : '' }}</span><el-button data-testid="statistics-retry" link type="danger" @click="retryStatistics">重试</el-button></div><ol class="attendance-list"><li v-for="(item, index) in statsUsers" :key="item.user_id" class="hover-lift"><span class="attendance-time">#{{ index + 1 }}</span><span class="avatar mini">{{ item.name.slice(0, 1) }}</span><div><strong>{{ item.name }}</strong><small>{{ item.punches }} 次打卡 · {{ formatDuration(item.seconds) }}</small></div><span class="event-pill info">{{ item.punches }} 次</span></li><li v-if="!statsUsers.length && !statsError" class="empty-row">本周暂无统计数据</li></ol></section>
      </section>

      <section v-else-if="activePage === 'settings'" class="page-content settings-layout">
        <section class="data-surface"><div class="section-heading"><div><p class="eyebrow">考勤规则</p><h2>打卡窗口</h2></div></div><el-form label-position="top" @submit.prevent="saveSettings"><el-form-item label="打卡模式"><el-radio-group v-model="settingsState.punch_mode"><el-radio-button value="unlimited">不限时</el-radio-button><el-radio-button value="window">时间窗口</el-radio-button></el-radio-group></el-form-item><div v-if="settingsState.punch_mode === 'window'" class="punch-window-list" data-testid="punch-window-settings"><div v-for="(window, index) in settingsState.windows" :key="index" class="punch-window-row" data-testid="punch-window-row"><span class="punch-window-label">时间段 {{ index + 1 }}</span><el-input :data-testid="`punch-window-start-${index}`" v-model="window[0]" type="time" aria-label="开始时间" /><span class="punch-window-separator">至</span><el-input :data-testid="`punch-window-end-${index}`" v-model="window[1]" type="time" aria-label="结束时间" /><el-button :data-testid="`remove-punch-window-${index}`" text type="danger" :disabled="settingsState.windows.length === 1" @click="removePunchWindow(index)">删除</el-button></div><el-button data-testid="add-punch-window" plain type="primary" @click="addPunchWindow">添加时间段</el-button></div><div class="time-row"><el-form-item label="签退截至时间"><el-input v-model="settingsState.out_deadline" type="time" /></el-form-item></div><el-button data-testid="save-punch-settings" type="primary" native-type="submit">保存打卡规则</el-button><p v-if="settingsMessage" class="settings-message" :class="{ 'settings-message-error': !settingsMessage.includes('已保存') }" role="alert">{{ settingsMessage }}</p></el-form></section>
      </section>

      <section v-else-if="activePage === 'activity'" class="page-content">
        <section class="data-surface">
          <div class="section-heading">
            <div><p class="eyebrow">系统留痕</p><h2>管理操作日志</h2></div>
            <el-button plain @click="loadActivity(true)">刷新</el-button>
          </div>
          <div class="activity-filter-bar" aria-label="日志筛选">
            <el-input v-model="activityKeyword" data-testid="activity-keyword" class="activity-filter-keyword" placeholder="搜索操作者、操作或详情" clearable>
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <select v-model="activityActor" data-testid="activity-actor" class="activity-filter-control" aria-label="按操作者筛选">
              <option value="">全部操作者</option>
              <option v-for="actor in activityActorOptions" :key="actor" :value="actor">{{ actor }}</option>
            </select>
            <select v-model="activityAction" data-testid="activity-action" class="activity-filter-control" aria-label="按操作类型筛选">
              <option value="">全部操作</option>
              <option v-for="action in activityActionOptions" :key="action" :value="action">{{ activityActionLabel(action) }}</option>
            </select>
            <input v-model="activityDate" data-testid="activity-date" class="activity-filter-control activity-filter-date" type="date" aria-label="按日期筛选" />
            <el-button plain @click="resetActivityFilters">清空筛选</el-button>
          </div>
          <div class="activity-filter-summary"><span data-testid="activity-filtered-count">显示 {{ filteredActivityLogs.length }} / {{ activityLogs.length }} 条</span></div>
          <ol class="log-list">
            <li v-for="log in filteredActivityLogs" :key="log.id">
              <span>{{ formatPunchTime(log.created_at) }}</span>
              <div><strong>{{ log.actor }} · {{ activityActionLabel(log.action) }}</strong><small>{{ activityDetailLabel(log.detail) }}</small></div>
            </li>
            <li v-if="!activityLogs.length" class="empty-row">暂无操作日志</li>
            <li v-else-if="!filteredActivityLogs.length" class="empty-row" data-testid="activity-empty-filter">没有匹配的日志，请调整筛选条件</li>
          </ol>
        </section>
      </section>

      <section v-else-if="activePage === 'account'" class="page-content account-layout"><section class="data-surface"><div class="section-heading"><div><p class="eyebrow">当前登录</p><h2>我的账号</h2></div><span class="event-pill success">{{ accountTypeLabel }}</span></div><div class="account-identity"><span class="avatar large">{{ currentAdmin?.username.slice(0, 1).toUpperCase() }}</span><div><strong>{{ currentAdmin?.username }}</strong><small>{{ currentAdmin?.account_type === 'super_admin' ? '可管理普通管理员账号' : '仅可修改自己的密码' }}</small></div></div><el-form label-position="top" class="password-form" @submit.prevent="changePassword"><el-form-item label="当前密码"><el-input v-model="passwordForm.current" type="password" show-password autocomplete="current-password" /></el-form-item><el-form-item label="新密码"><el-input v-model="passwordForm.next" type="password" show-password placeholder="至少 10 位，包含两类字符" autocomplete="new-password" /></el-form-item><el-form-item label="确认新密码"><el-input v-model="passwordForm.confirm" type="password" show-password autocomplete="new-password" /></el-form-item><el-button type="primary" native-type="submit">修改我的密码</el-button><p v-if="settingsMessage" class="success-copy">{{ settingsMessage }}</p></el-form><el-button v-if="currentAdmin?.account_type === 'super_admin'" plain @click="selectPage('admins')">管理普通管理员</el-button><button class="logout-button" type="button" :disabled="logoutSubmitting" @click="logout"><el-icon><SwitchButton /></el-icon>{{ logoutSubmitting ? '正在退出...' : '退出登录' }}</button></section></section>

      <section v-else-if="activePage === 'admins'" class="page-content"><section v-if="currentAdmin?.account_type === 'super_admin'" class="data-surface"><div class="section-heading"><div><p class="eyebrow">权限管理</p><h2>普通管理员</h2></div></div><el-form class="admin-create-form" @submit.prevent="createAdmin"><el-input v-model="adminForm.username" placeholder="管理员用户名" autocomplete="username" /><el-input v-model="adminForm.password" type="password" show-password placeholder="至少 10 位，包含两类字符" autocomplete="new-password" /><el-button type="primary" native-type="submit" :loading="adminSaving"><el-icon><UserFilled /></el-icon>创建管理员</el-button></el-form><p v-if="adminError" class="login-error">{{ adminError }}</p><div v-for="admin in admins" :key="admin.id" class="admin-row hover-lift"><span class="avatar">{{ admin.username.slice(0, 1).toUpperCase() }}</span><div><strong>{{ admin.username }}</strong><small>{{ admin.account_type === 'super_admin' ? '超级管理员（仅树莓派可管理）' : '普通管理员' }}</small></div><span class="event-pill" :class="admin.enabled ? 'success' : 'warning'">{{ admin.enabled ? '已启用' : '已禁用' }}</span><template v-if="admin.account_type === 'admin'"><el-button plain @click="updateAdminStatus(admin)">{{ admin.enabled ? '禁用' : '启用' }}</el-button><el-input v-model="adminPasswordDraft[admin.id]" class="admin-password-input" type="password" show-password placeholder="重置密码" /><el-button plain @click="resetAdminPassword(admin)">重置</el-button></template></div></section><section v-else class="data-surface"><p class="empty-row">当前账号没有管理员管理权限</p></section></section>
    </section>

    <nav class="mobile-nav" aria-label="手机导航">
      <button v-for="item in navItems.slice(0, 3)" :key="item.id" :class="{ active: activePage === item.id }" type="button" @click="selectPage(item.id)"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></button>
      <button :class="{ active: !['overview', 'students', 'attendance'].includes(activePage) }" type="button" @click="selectPage('settings')"><el-icon><MoreFilled /></el-icon><span>更多</span></button>
    </nav>
  </main>

  <el-drawer v-model="drawerOpen" size="460px" :with-header="false">
    <section class="drawer-content"><button class="drawer-close" type="button" @click="drawerOpen = false">关闭</button><p class="eyebrow">人员详情</p><div class="drawer-person"><span class="avatar large">{{ selectedStudent.name.slice(0, 1) }}</span><div><h2>{{ selectedStudent.name }}</h2><span class="event-pill info">{{ selectedStudent.role }}</span></div></div><div class="detail-grid"><div><span>人脸样本</span><strong>{{ selectedStudent.samples }} 张</strong></div><div><span>指纹状态</span><strong>{{ selectedStudent.fingerprint }}</strong></div></div><div class="sample-preview"><span class="sample-face">{{ selectedStudent.name.slice(0, 1) }}</span><div><strong>样本由树莓派端录入</strong><small>网页仅查看，不支持上传或删除。</small></div></div><el-button type="primary" plain @click="openStudentEditor">编辑姓名与角色</el-button></section>
  </el-drawer>

  <el-dialog v-model="studentEditorOpen" title="编辑人员信息" width="420px">
    <el-form label-position="top" @submit.prevent="saveStudentEdit">
      <el-form-item label="姓名"><el-input v-model="studentEditForm.name" aria-label="编辑姓名" autocomplete="off" /></el-form-item>
      <el-form-item label="角色"><el-select v-model="studentEditForm.role" aria-label="编辑角色" style="width: 100%"><el-option label="学生" value="0" /><el-option label="管理员" value="1" /></el-select></el-form-item>
      <p v-if="studentEditError" class="login-error" role="alert">{{ studentEditError }}</p>
    </el-form>
    <template #footer><el-button @click="closeStudentEditor">取消</el-button><el-button type="primary" :loading="studentEditSubmitting" @click="saveStudentEdit">保存修改</el-button></template>
  </el-dialog>

  <el-dialog v-model="connectionDialogOpen" title="连接树莓派" width="440px">
    <p class="dialog-copy">修改后，网页服务会使用新地址读取设备与考勤数据。</p>
    <el-input v-model="piBaseUrl" aria-label="树莓派地址" />
    <p v-if="connectionMessage" :class="connectionMessageType === 'success' ? 'success-copy' : 'login-error'" role="status">{{ connectionMessage }}</p>
    <template #footer><el-button @click="connectionDialogOpen = false">取消</el-button><el-button type="primary" :loading="connectionSaving" @click="saveConnection">保存并连接</el-button></template>
  </el-dialog>
</template>
