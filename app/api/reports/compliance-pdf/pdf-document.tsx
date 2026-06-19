import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Case } from '@/lib/supabase/types'
import { computeSLACompliance } from '@/lib/metrics/sla'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    color: '#0F172A',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: '1px solid #E2E8F0',
  },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0D9488' },
  reportTitle: { fontSize: 11, color: '#64748B', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10, color: '#0F172A' },
  bigNumber: { fontSize: 32, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subText: { fontSize: 9, color: '#64748B' },
  kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  kpiBox: {
    flex: 1, border: '1px solid #E2E8F0', borderRadius: 6,
    padding: 12, backgroundColor: '#F8FAFC',
  },
  kpiLabel: { fontSize: 8, color: '#64748B', marginBottom: 4 },
  kpiValue: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#F1F5F9',
    padding: '6 8', borderRadius: 4, marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row', padding: '5 8',
    borderBottom: '1px solid #F1F5F9',
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#475569' },
  td: { fontSize: 9, color: '#334155' },
  col1: { width: '25%' },
  col2: { width: '15%' },
  col3: { width: '15%' },
  col4: { width: '20%' },
  col5: { width: '25%' },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #E2E8F0', paddingTop: 8,
  },
  footerText: { fontSize: 8, color: '#94A3B8' },
  pageNumber: { fontSize: 8, color: '#94A3B8' },
})

function cc(pct: number) {
  return pct >= 95 ? '#0D9488' : pct >= 85 ? '#D97706' : '#DC2626'
}

interface PDFData {
  cases: Case[]
  periodLabel: string
  generatedAt: string
}

export async function generateCompliancePDF({ cases, periodLabel, generatedAt }: PDFData): Promise<Buffer> {
  const fulfilled = cases.filter(c => c.fulfilled_at !== null)
  const overallCompliance = computeSLACompliance(fulfilled)
  const breached = fulfilled.filter(c => c.sla_deadline && new Date(c.fulfilled_at!) > new Date(c.sla_deadline))
  const avgH = fulfilled.length > 0
    ? Math.round(fulfilled.reduce((s, c) =>
        s + (new Date(c.fulfilled_at!).getTime() - new Date(c.submitted_at).getTime()) / 3_600_000, 0
      ) / fulfilled.length * 10) / 10
    : null

  const products = [...new Set(cases.map(c => c.product).filter(Boolean))] as string[]
  const productRows = products.map(p => {
    const pc = cases.filter(c => c.product === p)
    const pf = pc.filter(c => c.fulfilled_at !== null)
    const compliance = computeSLACompliance(pf)
    const br = pf.filter(c => c.sla_deadline && new Date(c.fulfilled_at!) > new Date(c.sla_deadline)).length
    const ph = pf.length > 0
      ? Math.round(pf.reduce((s, c) =>
          s + (new Date(c.fulfilled_at!).getTime() - new Date(c.submitted_at).getTime()) / 3_600_000, 0
        ) / pf.length * 10) / 10
      : null
    return { product: p, total: pc.length, compliance, breaches: br, avgH: ph }
  }).sort((a, b) => b.total - a.total)

  const doc = (
    <Document title={`Inqura SLA Report — ${periodLabel}`} author="VirsAI Inqura">
      {/* Page 1 — Executive Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>Inqura</Text>
            <Text style={styles.reportTitle}>Medical Affairs SLA Compliance Report</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{periodLabel}</Text>
            <Text style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>Generated {generatedAt}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall SLA Compliance</Text>
          <Text style={{ ...styles.bigNumber, color: cc(overallCompliance) }}>
            {overallCompliance}%
          </Text>
          <Text style={styles.subText}>
            {`Target: 95% · ${overallCompliance >= 95 ? '✓ Target met' : `${(95 - overallCompliance).toFixed(1)}% below target`}`}
          </Text>
        </View>

        <View style={styles.kpiGrid}>
          {([
            { label: 'Total Cases', value: String(cases.length), color: '#0F172A' },
            { label: 'Fulfilled', value: String(fulfilled.length), color: '#0F172A' },
            { label: 'SLA Breaches', value: String(breached.length), color: breached.length > 0 ? '#DC2626' : '#0D9488' },
            { label: 'Avg Response', value: avgH !== null ? `${avgH}h` : '—', color: '#0F172A' },
          ] as const).map(({ label, value, color }) => (
            <View key={label} style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={{ ...styles.kpiValue, color }}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Prepared by VirsAI Inqura · Confidential</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Page 2 — By-Product */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SLA Compliance by Product</Text>
          <Text style={{ ...styles.subText, marginBottom: 12 }}>{periodLabel}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.th, ...styles.col1 }}>PRODUCT</Text>
              <Text style={{ ...styles.th, ...styles.col2 }}>CASES</Text>
              <Text style={{ ...styles.th, ...styles.col3 }}>SLA %</Text>
              <Text style={{ ...styles.th, ...styles.col4 }}>AVG RESPONSE</Text>
              <Text style={{ ...styles.th, ...styles.col5 }}>BREACHES</Text>
            </View>
            {productRows.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={{ ...styles.td, color: '#94A3B8' }}>No product data for this period</Text>
              </View>
            ) : productRows.map(r => (
              <View key={r.product} style={styles.tableRow}>
                <Text style={{ ...styles.td, ...styles.col1 }}>{r.product}</Text>
                <Text style={{ ...styles.td, ...styles.col2 }}>{r.total}</Text>
                <Text style={{ ...styles.td, ...styles.col3, color: cc(r.compliance), fontFamily: 'Helvetica-Bold' }}>
                  {r.compliance}%
                </Text>
                <Text style={{ ...styles.td, ...styles.col4 }}>{r.avgH !== null ? `${r.avgH}h` : '—'}</Text>
                <Text style={{ ...styles.td, ...styles.col5, color: r.breaches > 0 ? '#DC2626' : '#94A3B8', fontFamily: r.breaches > 0 ? 'Helvetica-Bold' : 'Helvetica' }}>
                  {r.breaches > 0 ? `${r.breaches} breach${r.breaches > 1 ? 'es' : ''}` : 'None'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {breached.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Breach Detail</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.th, width: '25%' }}>CASE ID</Text>
                <Text style={{ ...styles.th, width: '25%' }}>PRODUCT</Text>
                <Text style={{ ...styles.th, width: '25%' }}>DEADLINE</Text>
                <Text style={{ ...styles.th, width: '25%' }}>HOURS OVER</Text>
              </View>
              {breached.slice(0, 20).map(c => {
                const hoursOver = c.sla_deadline
                  ? Math.round((new Date(c.fulfilled_at!).getTime() - new Date(c.sla_deadline).getTime()) / 3_600_000 * 10) / 10
                  : 0
                return (
                  <View key={c.id} style={styles.tableRow}>
                    <Text style={{ ...styles.td, width: '25%' }}>{c.vault_case_id}</Text>
                    <Text style={{ ...styles.td, width: '25%' }}>{c.product ?? '—'}</Text>
                    <Text style={{ ...styles.td, width: '25%' }}>
                      {c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString() : '—'}
                    </Text>
                    <Text style={{ ...styles.td, width: '25%', color: '#DC2626', fontFamily: 'Helvetica-Bold' }}>
                      +{hoursOver}h
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Prepared by VirsAI Inqura · Confidential</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
