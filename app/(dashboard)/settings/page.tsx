import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SettingsActions } from './SettingsActions'
import { WebhookForm } from './WebhookForm'
import { VaultConfigForm } from './VaultConfigForm'
import { UserManagement } from './UserManagement'
import { isAdmin } from '@/lib/auth/require-session'

const SlackLogo = () => (
  <svg width="28" height="28" viewBox="0 0 122.8 122.8" aria-label="Slack">
    <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#E01E5A"/>
    <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#E01E5A"/>
    <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36C5F0"/>
    <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36C5F0"/>
    <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2EB67D"/>
    <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2EB67D"/>
    <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ECB22E"/>
    <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ECB22E"/>
  </svg>
)

const TeamsLogo = () => (
  <svg width="28" height="28" viewBox="0 0 2228.833 2073.333" aria-label="Microsoft Teams">
    <path d="M1554.637 777.5h575.713c54.391 0 98.483 44.092 98.483 98.483v524.398c0 199.901-162.051 361.952-361.952 361.952h-1.711c-199.901.028-361.975-162.023-361.975-361.924V828.971c.001-28.427 23.044-51.471 51.442-51.471z" fill="#5059C9"/>
    <path d="M1943.75 685.64c120.782 0 218.721-97.94 218.721-218.721s-97.94-218.721-218.721-218.721-218.721 97.94-218.721 218.721 97.939 218.721 218.721 218.721z" fill="#5059C9"/>
    <path d="M1218.75 685.64c151.413 0 274.121-122.708 274.121-274.121S1370.163 137.398 1218.75 137.398s-274.121 122.708-274.121 274.121 122.708 274.121 274.121 274.121z" fill="#7B83EB"/>
    <path d="M1651.542 777.5H755.208a98.46 98.46 0 00-98.483 98.483v600.225c0 362.12 293.56 655.679 655.679 655.679s655.679-293.559 655.679-655.679V875.983c0-54.391-44.092-98.483-98.541-98.483z" fill="#7B83EB"/>
    <path d="M1133.333 1090.667H900v713.333H713.333v-713.333H480V920h653.333v170.667z" fill="#fff"/>
  </svg>
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [admin, serviceClient] = await Promise.all([
    isAdmin(),
    createServiceClient(),
  ])

  // Integrations (webhooks)
  const { data: integrationRows } = await serviceClient
    .from('integrations')
    .select('id, type, webhook_url, enabled, label')

  type IntegrationRow = { type: string; webhook_url: string; enabled: boolean; label: string | null }
  const integrations = (integrationRows ?? []) as IntegrationRow[]

  function getIntegration(type: string) {
    const row = integrations.find(i => i.type === type)
    if (!row) return null
    return {
      ...row,
      webhook_url_masked: `••••••••${row.webhook_url.slice(-12)}`,
      webhook_url: undefined,
    }
  }

  // Vault sync status
  const { data: lastSync } = await serviceClient
    .from('sync_log')
    .select('status, completed_at, records_processed, error_msg, sync_type')
    .order('started_at', { ascending: false })
    .limit(5)

  const latestSync = lastSync?.[0]
  const vaultConnected = latestSync?.status === 'success'
  const lastSyncAt = latestSync?.completed_at ? new Date(latestSync.completed_at) : null

  // Admin-only data
  let vaultConfig: {
    id?: string; name?: string; vault_url?: string;
    vault_client_id?: string; vault_username?: string | null; vault_api_version?: string | null;
  } | null = null
  let userList: Array<{
    id: string; email?: string; last_sign_in_at?: string | null;
    user_metadata?: Record<string, unknown>
  }> = []

  if (admin) {
    const [vaultRes, usersRes] = await Promise.all([
      serviceClient.from('tenants')
        .select('id, name, vault_url, vault_client_id, vault_username, vault_api_version')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      serviceClient.auth.admin.listUsers(),
    ])
    vaultConfig = vaultRes.data
    userList = usersRes.data?.users ?? []
  }

  const mappedUsers = userList.map(u => ({
    id: u.id,
    email: u.email ?? '(no email)',
    role: (u.user_metadata?.role as string) ?? 'user',
    lastSignIn: u.last_sign_in_at ?? null,
    isSelf: u.id === user.id,
  }))

  return (
    <div className="max-w-2xl space-y-5">

      {/* Admin badge */}
      {admin && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px]"
          style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Admin — you have access to all configuration sections.
        </div>
      )}

      {/* Vault connection status */}
      <Card>
        <CardHeader>
          <CardTitle>Vault Connection</CardTitle>
          <CardDescription>Veeva Vault integration status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: vaultConnected ? 'var(--success-text)' : lastSync ? 'var(--danger-text)' : 'var(--border)' }}
            />
            <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              {vaultConnected ? 'Connected' : lastSync ? 'Last sync failed' : 'Never synced'}
            </span>
            <Badge variant={vaultConnected ? 'success' : 'secondary'} className="ml-auto">
              {vaultConfig?.vault_url?.replace('https://', '') ?? process.env.VAULT_URL?.replace('https://', '') ?? 'Not configured'}
            </Badge>
          </div>

          {lastSyncAt && (
            <dl className="space-y-1.5">
              {[
                ['Last sync', lastSyncAt.toLocaleString()],
                ['Records processed', String(latestSync?.records_processed ?? '—')],
                ['Type', latestSync?.sync_type ?? '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-2)' }}>
                  <dt className="text-[12px]" style={{ color: 'var(--text-4)' }}>{label}</dt>
                  <dd className="text-[12px] font-medium capitalize" style={{ color: 'var(--text-2)' }}>{val}</dd>
                </div>
              ))}
            </dl>
          )}

          {latestSync?.error_msg && (
            <div
              className="rounded-[8px] p-3 text-[12px]"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}
            >
              {latestSync.error_msg}
            </div>
          )}

          <SettingsActions action="sync" />
        </CardContent>
      </Card>

      {/* Vault configuration — admin only */}
      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>Vault Configuration</CardTitle>
            <CardDescription>
              Veeva Vault connection credentials. Use "Test connection" to validate before saving.
              Credentials are stored server-side and never returned to the browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VaultConfigForm existing={vaultConfig ? {
              name: vaultConfig.name ?? '',
              vault_url: vaultConfig.vault_url ?? '',
              vault_client_id: vaultConfig.vault_client_id ?? '',
              vault_username: vaultConfig.vault_username ?? null,
              vault_api_version: vaultConfig.vault_api_version ?? null,
            } : null} />
          </CardContent>
        </Card>
      )}

      {/* Sync history */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {!lastSync?.length ? (
            <p className="text-[12px]" style={{ color: 'var(--text-4)' }}>No syncs yet</p>
          ) : (
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Time', 'Type', 'Records', 'Status'].map(h => (
                    <th key={h} className="text-left pb-2.5 pr-4 label-caps">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lastSync.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-2)' }}>
                    <td className="py-2.5 pr-4 text-[12px]" style={{ color: 'var(--text-3)' }}>
                      {s.completed_at ? new Date(s.completed_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-[12px] capitalize" style={{ color: 'var(--text-3)' }}>{s.sync_type}</td>
                    <td className="py-2.5 pr-4 text-[12px] tabular-nums" style={{ color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {s.records_processed ?? '—'}
                    </td>
                    <td className="py-2.5">
                      <Badge variant={s.status === 'success' ? 'success' : s.status === 'error' ? 'destructive' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Integrations — admin only */}
      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Receive SLA alerts and escalation notifications in Slack or Microsoft Teams.
              Webhook URLs are stored server-side and never exposed to the browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <WebhookForm
              type="slack"
              label="Slack"
              logo={<SlackLogo />}
              docsUrl="https://api.slack.com/messaging/webhooks"
              placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
              existing={getIntegration('slack') as Parameters<typeof WebhookForm>[0]['existing']}
            />
            <WebhookForm
              type="teams"
              label="Microsoft Teams"
              logo={<TeamsLogo />}
              docsUrl="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
              placeholder="https://outlook.office.com/webhook/..."
              existing={getIntegration('teams') as Parameters<typeof WebhookForm>[0]['existing']}
            />
          </CardContent>
        </Card>
      )}

      {/* SLA configuration */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Configuration</CardTitle>
          <CardDescription>Default response time targets by priority</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            {[
              { label: 'Critical priority', value: '24 hours' },
              { label: 'Urgent priority (default)', value: '48 hours' },
              { label: 'Standard priority', value: '72 hours' },
              { label: 'Off-label inquiries', value: '48 hours (auto-upgraded)' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-2)' }}>
                <dt className="text-[12px]" style={{ color: 'var(--text-3)' }}>{label}</dt>
                <dd className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
            Custom per-product SLA targets available in Phase 2.
          </p>
        </CardContent>
      </Card>

      {/* User management — admin only */}
      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Invite colleagues by email. They&apos;ll receive a magic link to set their password.
              Only invited users can sign in — there is no self-registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserManagement users={mappedUsers} />
          </CardContent>
        </Card>
      )}

      {/* Non-admin: account info only */}
      {!admin && (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{user.email}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>Your account</p>
              </div>
              <Badge variant="outline">User</Badge>
            </div>
            <p className="text-[11px] mt-3" style={{ color: 'var(--text-4)' }}>
              Contact your administrator to invite others or update your access.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
