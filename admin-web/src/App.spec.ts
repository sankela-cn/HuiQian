import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'

describe('HuiQian admin dashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks the signed Cookie session before showing the workspace', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, code: 'WEB_SESSION_REQUIRED', msg: '请先登录管理后台' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/web-api/auth/me', { credentials: 'include' })
    expect(wrapper.get('#login-title').text()).toContain('回到考勤现场')
  })

  it('marks dashboard cards and panels for hover motion', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance?date=2026-08-26': { ok: true, records: [] },
        '/web-api/presence': { ok: true, users: [], count: 0 },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(wrapper.findAll('.metric-card.hover-lift')).toHaveLength(4)
    expect(wrapper.get('[data-testid="activity-feed"]').classes()).toContain('hover-lift')
    expect(wrapper.findAll('.presence-panel.hover-lift')).toHaveLength(1)
    expect(wrapper.findAll('.side-rail .nav-item.hover-lift')).toHaveLength(6)
  })

  it('submits administrator credentials to the local web service', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, code: 'WEB_SESSION_REQUIRED', msg: '请先登录管理后台' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const [usernameInput, passwordInput] = wrapper.findAll('input')
    await usernameInput.setValue('admin')
    await passwordInput.setValue('AdminPass123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/web-api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'AdminPass123!' }),
      credentials: 'include',
    })
    expect(wrapper.text()).toContain('admin')
  })

  it('shows a clear Chinese message when administrator credentials are invalid', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ code: 'WEB_SESSION_REQUIRED', msg: '请先登录管理后台' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ code: 'ADMIN_CREDENTIALS_INVALID', msg: 'administrator credentials are invalid' }) })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const [usernameInput, passwordInput] = wrapper.findAll('input')
    await usernameInput.setValue('admin')
    await passwordInput.setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('账号或密码错误，请检查后重试。')
  })

  it('shows a separate message when the administrator account does not exist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ code: 'WEB_SESSION_REQUIRED', msg: '请先登录管理后台' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ code: 'ADMIN_ACCOUNT_NOT_FOUND', msg: 'administrator account was not found' }) })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const [usernameInput, passwordInput] = wrapper.findAll('input')
    await usernameInput.setValue('missing-admin')
    await passwordInput.setValue('AdminPass123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('管理员账号不存在，请先在树莓派后端创建账号。')
  })

  it('logs out through the local web service before returning to the login page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ msg: '请先登录管理后台' }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, students: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const [usernameInput, passwordInput] = wrapper.findAll('input')
    await usernameInput.setValue('admin')
    await passwordInput.setValue('AdminPass123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('.account-button').trigger('click')
    await wrapper.get('.logout-button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/web-api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    expect(wrapper.get('#login-title').text()).toContain('回到考勤现场')
  })

  it('loads connection state and students through the local web service after session recovery', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, online: true, message: '慧签后端运行中', checked_at: '2026-08-18T01:00:00.000Z' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          students: [{ id: 7, name: '刘恩泽', role: '学生', created_at: '2026-08-15', sample_count: 3, fp_count: 1 }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/web-api/connection', { credentials: 'include' })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/web-api/students', { credentials: 'include' })
    const studentNav = wrapper.findAll('.nav-item').find((item) => item.text().includes('学生'))
    await studentNav?.trigger('click')
    expect(wrapper.text()).toContain('刘恩泽')
    expect(wrapper.text()).toContain('2026-08-15')
  })

  it('opens the student editor from the person detail drawer', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [{ id: 7, name: '梁健', role: 0, created_at: '2026-08-15', sample_count: 3, fp_count: 0 }] },
        '/web-api/attendance': { ok: true, records: [] },
        '/web-api/presence': { ok: true, count: 0, users: [] },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item')[1].trigger('click')
    await flushPromises()
    await wrapper.find('.table-data').trigger('click')
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text().includes('编辑姓名与角色'))
    expect(editButton).toBeDefined()
    await editButton?.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[role="dialog"]').some((dialog) => dialog.text().includes('编辑人员信息'))).toBe(true)
    expect((wrapper.get('input[aria-label="编辑姓名"]').element as HTMLInputElement).value).toBe('梁健')
    await wrapper.get('input[aria-label="编辑姓名"]').setValue('梁健新')
    await wrapper.findAll('button').find((button) => button.text().includes('保存修改'))?.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/web-api/students/7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '梁健新', role: 0 }),
      credentials: 'include',
    })
  })

  it('loads real attendance records when the attendance page is opened', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance': { ok: true, records: [{ id: 11, user_id: 7, name: '刘恩泽', punch_time: '2026-08-18 09:00:00', kind: 'in', photo: '20260826_090000_000001.jpg' }] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const attendanceNav = wrapper.findAll('.nav-item').find((item) => item.text().includes('考勤'))
    await attendanceNav?.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/web-api/attendance'))).toBe(true)
    expect(wrapper.text()).toContain('刘恩泽')
    const photo = wrapper.get('img[alt="刘恩泽的打卡照片"]')
    expect(photo.attributes('src')).toBe('/web-api/attendance/photos/20260826_090000_000001.jpg')
    const image = wrapper.findComponent({ name: 'ElImage' })
    expect(image.props('previewTeleported')).toBe(true)
  })

  it('shows an unavailable state when an attendance record has no photo', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance': { ok: true, records: [{ id: 12, user_id: 8, name: '张欣怡', punch_time: '2026-08-18 09:10:00', kind: 'in', photo: null }] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const attendanceNav = wrapper.findAll('.nav-item').find((item) => item.text().includes('考勤'))
    await attendanceNav?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="attendance-photo-unavailable"]').text()).toContain('无照片')
  })

  it('makes manual attendance refresh visible and retains records after a failed refresh', async () => {
    let attendanceAttempts = 0
    let rejectRefresh: ((error: Error) => void) | undefined
    const refreshPending = new Promise<never>((_, reject) => { rejectRefresh = reject })
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/web-api/attendance')) {
        attendanceAttempts += 1
        if (attendanceAttempts === 1) {
          return { ok: true, status: 200, json: async () => ({ ok: true, records: [{ id: 1, user_id: 1, name: '旧记录', punch_time: '2026-08-18 09:00:00', kind: 'in', photo: null }] }) }
        }
        if (attendanceAttempts === 2) {
          await refreshPending
        }
        return { ok: false, status: 503, json: async () => ({ msg: 'attendance unavailable' }) }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item').find((item) => item.text().includes('考勤'))?.trigger('click')
    await flushPromises()
    const refresh = wrapper.get('[data-testid="attendance-refresh"]')
    await refresh.trigger('click')
    expect(refresh.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('旧记录')
    rejectRefresh?.(new Error('network down'))
    await flushPromises()
    expect(wrapper.text()).toContain('旧记录')
    expect(wrapper.text()).toContain('刷新失败')
    expect(wrapper.find('[data-testid="attendance-retry"]').exists()).toBe(true)
  })

  it('auto-refreshes statistics only while the statistics page is active', async () => {
    vi.useFakeTimers()
    let statisticsAttempts = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/web-api/statistics') {
        statisticsAttempts += 1
        return { ok: true, status: 200, json: async () => ({ ok: true, stats: { users: [{ user_id: 1, name: '统计用户', punches: statisticsAttempts, seconds: 3600 }] } }) }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item').find((item) => item.text().includes('统计'))?.trigger('click')
    await flushPromises()
    expect(statisticsAttempts).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(statisticsAttempts).toBe(2)
    await wrapper.findAll('.nav-item').find((item) => item.text().includes('总览'))?.trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(statisticsAttempts).toBe(2)
    wrapper.unmount()
  })

  it('retries activity loading after a failed request when the log page is selected again', async () => {
    let activityAttempts = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/web-api/activity') {
        activityAttempts += 1
        if (activityAttempts === 1) {
          return { ok: false, status: 503, json: async () => ({ msg: 'activity unavailable' }) }
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, logs: [{ id: 1, actor: 'admin', action: 'refresh', detail: 'loaded', created_at: '2026-08-18 09:00:00' }] }) }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance': { ok: true, records: [] },
        '/web-api/presence': { ok: true, count: 0, users: [] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const activityNav = wrapper.findAll('.nav-item')[5]
    await activityNav.trigger('click')
    await flushPromises()
    await activityNav.trigger('click')
    await flushPromises()

    expect(activityAttempts).toBe(2)
    expect(wrapper.text()).toContain('loaded')
  })

  it('renders activity logs returned with the Pi backend field names (user/log_time)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/web-api/activity') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            logs: [
              { id: 1, user: 'admin:admin', action: 'administrator login', detail: 'session issued', log_time: '2026-08-18 09:00:00' },
              { id: 2, user: 'admin', action: 'create administrator', detail: 'username=monitor', log_time: '2026-08-18 10:30:00' },
            ],
          }),
        }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance': { ok: true, records: [] },
        '/web-api/presence': { ok: true, count: 0, users: [] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const activityNav = wrapper.findAll('.nav-item')[5]
    await activityNav.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('admin:admin · 管理员登录')
    expect(wrapper.text()).toContain('09:00')
    expect(wrapper.text()).toContain('登录会话已创建')
    expect(wrapper.text()).toContain('创建管理员')

    await activityNav.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('admin:admin · 管理员登录')
  })

  it('filters activity logs by keyword, actor, action, and date', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/web-api/activity') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            logs: [
              { id: 1, user: 'admin:admin', action: 'administrator login', detail: 'session issued', log_time: '2026-08-18 09:00:00' },
              { id: 2, user: 'admin:monitor', action: 'create administrator', detail: 'username=monitor', log_time: '2026-08-19 10:30:00' },
              { id: 3, user: 'admin:admin', action: 'punch', detail: 'in', log_time: '2026-08-19 11:00:00' },
              { id: 4, user: 'admin:guest', action: 'update settings', detail: 'window', log_time: '2026-08-20 12:00:00' },
            ],
          }),
        }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance': { ok: true, records: [] },
        '/web-api/presence': { ok: true, count: 0, users: [] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item')[5].trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="activity-filtered-count"]').text()).toContain('4')
    await wrapper.get('input[data-testid="activity-keyword"]').setValue('monitor')
    expect(wrapper.get('.log-list').text()).toContain('admin:monitor')
    expect(wrapper.get('.log-list').text()).not.toContain('admin:guest')

    await wrapper.get('input[data-testid="activity-keyword"]').setValue('')
    await wrapper.get('[data-testid="activity-actor"]').setValue('admin:monitor')
    expect(wrapper.get('.log-list').text()).toContain('admin:monitor')
    expect(wrapper.get('.log-list').text()).not.toContain('admin:guest')

    await wrapper.get('[data-testid="activity-actor"]').setValue('')
    await wrapper.get('[data-testid="activity-action"]').setValue('punch')
    expect(wrapper.get('.log-list').text()).toContain('admin:admin')
    expect(wrapper.get('.log-list').text()).not.toContain('admin:monitor')

    await wrapper.get('[data-testid="activity-action"]').setValue('')
    await wrapper.get('[data-testid="activity-date"]').setValue('2026-08-20')
    expect(wrapper.get('.log-list').text()).toContain('admin:guest')
    expect(wrapper.get('.log-list').text()).not.toContain('admin:monitor')
  })

  it('shows Chinese activity labels and a clear empty state for unmatched filters', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/web-api/activity') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            logs: [
              { id: 1, user: 'admin:admin', action: 'administrator login', detail: 'session issued', log_time: '2026-08-18 09:00:00' },
              { id: 2, user: 'admin:monitor', action: 'create administrator', detail: 'username=monitor', log_time: '2026-08-19 10:30:00' },
            ],
          }),
        }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/attendance': { ok: true, records: [] },
        '/web-api/presence': { ok: true, count: 0, users: [] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item')[5].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('管理员登录')
    expect(wrapper.text()).toContain('创建管理员')
    expect(wrapper.text()).toContain('用户名：monitor')
    await wrapper.get('input[data-testid="activity-keyword"]').setValue('not-found')
    expect(wrapper.get('[data-testid="activity-empty-filter"]').text()).toContain('没有匹配的日志')
  })

  it('renders, adds, and removes multiple punch windows in settings', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/settings': { punch_mode: 'window', windows: [['07:30', '10:00'], ['14:00', '15:00']], out_deadline: '23:00' },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item').find((item) => item.text().includes('设置'))?.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="punch-window-row"]')).toHaveLength(2)
    expect((wrapper.get('[data-testid="punch-window-start-0"]').element as HTMLInputElement).value).toBe('07:30')
    await wrapper.get('[data-testid="add-punch-window"]').trigger('click')
    expect(wrapper.findAll('[data-testid="punch-window-row"]')).toHaveLength(3)
    await wrapper.get('[data-testid="remove-punch-window-2"]').trigger('click')
    expect(wrapper.findAll('[data-testid="punch-window-row"]')).toHaveLength(2)
    await wrapper.get('[data-testid="remove-punch-window-1"]').trigger('click')
    expect(wrapper.findAll('[data-testid="punch-window-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="remove-punch-window-0"]').attributes('disabled')).toBeDefined()
  })

  it('hides punch window controls in unlimited mode and restores them when selected', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/settings': { punch_mode: 'unlimited', windows: [['07:30', '10:00']], out_deadline: '23:00' },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item').find((item) => item.text().includes('设置'))?.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="punch-window-settings"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('添加时间段')
    await wrapper.get('input[value="window"]').setValue(true)
    expect(wrapper.findAll('[data-testid="punch-window-settings"]')).toHaveLength(1)
    expect((wrapper.get('[data-testid="punch-window-start-0"]').element as HTMLInputElement).value).toBe('07:30')
  })

  it('saves multiple valid punch windows and blocks invalid windows', async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/students': { ok: true, students: [] },
        '/web-api/settings': options?.method === 'POST' ? { ok: true } : { punch_mode: 'window', windows: [['07:30', '10:00']], out_deadline: '23:00' },
      }
      return { ok: true, status: 200, json: async () => payloads[url] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.findAll('.nav-item').find((item) => item.text().includes('设置'))?.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="add-punch-window"]').trigger('click')
    await wrapper.get('[data-testid="punch-window-start-1"]').setValue('14:00')
    await wrapper.get('[data-testid="punch-window-end-1"]').setValue('15:00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/web-api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ punch_mode: 'window', windows: [['07:30', '10:00'], ['14:00', '15:00']], out_deadline: '23:00' }),
      credentials: 'include',
    })

    await wrapper.get('[data-testid="punch-window-start-1"]').setValue('09:00')
    await wrapper.get('[data-testid="punch-window-end-1"]').setValue('09:30')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('时间段 1 与时间段 2 不能重叠')
    expect(fetchMock.mock.calls.filter(([url, options]) => url === '/web-api/settings' && (options as RequestInit | undefined)?.method === 'POST')).toHaveLength(1)
  })

  it('reloads workspace data after the backend address is changed', async () => {
    let studentRequests = 0
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/web-api/connection' && options?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ ok: true, online: true, base_url: 'http://10.42.0.1:8000', checked_at: '2026-08-18T01:00:00.000Z' }) }
      }
      if (url === '/web-api/students') {
        studentRequests += 1
        return { ok: true, status: 200, json: async () => ({ ok: true, students: studentRequests > 1 ? [{ id: 7, name: '树莓派学生', role: '学生', created_at: '2026-08-18', sample_count: 3, fp_count: 0 }] : [] }) }
      }
      const payloads: Record<string, unknown> = {
        '/web-api/auth/me': { ok: true, admin: { id: 1, username: 'admin', account_type: 'super_admin', enabled: 1 } },
        '/web-api/connection': { ok: true, online: true, base_url: 'http://127.0.0.1:8000', checked_at: '2026-08-18T01:00:00.000Z' },
        '/web-api/attendance': { ok: true, records: [] },
        '/web-api/presence': { ok: true, count: 0, users: [] },
      }
      const key = url.startsWith('/web-api/attendance') ? '/web-api/attendance' : url
      return { ok: true, status: 200, json: async () => payloads[key] ?? { ok: true } }
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.get('.signal-chip').trigger('click')
    await flushPromises()
    const input = wrapper.find('input[aria-label="树莓派地址"]')
    expect(input.exists()).toBe(true)
    await input.setValue('http://10.42.0.1:8000')
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存并连接'))
    await saveButton?.trigger('click')
    await flushPromises()

    expect(studentRequests).toBe(2)
    await wrapper.findAll('.nav-item')[1].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('树莓派学生')
    wrapper.unmount()
  })
})
