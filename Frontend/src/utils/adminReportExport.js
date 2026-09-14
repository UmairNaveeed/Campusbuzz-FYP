import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND = [25, 57, 101]; // #193965

const REPORT_SUMMARIES = {
  'user-activity':
    'This report summarizes campus user accounts for the selected period. It includes total registered users, new sign-ups, users who published at least one post, and accounts currently suspended. Use it to track growth and participation.',
  'content-analytics':
    'This report measures content volume and engagement: posts created, comments, likes, and average engagement per post. Figures reflect non-deleted posts within the date range.',
  'moderation-actions':
    'This report covers post reports submitted by users and how they align with Post Moderation categories: Hate Speech and Inappropriate Content only. Pending and resolved counts help track moderation workload.',
  'community-health':
    'This report shows the sentiment distribution of campus posts analyzed by the ML service (positive, neutral, negative). Campus mood is the share of positive posts among labeled content.',
  'trends-analysis':
    'This report lists trending hashtags and topics with mention counts and sentiment breakdown. If few posts exist in the selected window, the system may widen the range (see note below).',
  'discussion-forums':
    'This report summarizes group discussion forums: message volume and average sentiment mood per forum, based on analyzed discussion content.',
};

const METRIC_HINTS = {
  'Total campus users': 'All registered non-admin accounts.',
  'New registrations': 'Users who signed up during this period.',
  'Users who posted': 'Distinct authors with at least one post in range.',
  'Suspended accounts': 'Accounts marked suspended (all time).',
  'Posts created': 'New posts in the period (not deleted).',
  'Comments': 'Comments on posts in the period.',
  'Total likes': 'Like actions on posts in the period.',
  'Avg engagement / post': 'Average likes plus comments per post.',
  'Total reports': 'User-submitted post reports in the period.',
  'Pending review': 'Reports awaiting admin action.',
  'Resolved': 'Reports marked resolved.',
  'Hate speech reports': 'Reports tagged as hate speech.',
  'Inappropriate content reports': 'Reports tagged as inappropriate content.',
  'Posts analyzed': 'Posts with sentiment labels in range.',
  'Positive posts': 'Share of posts labeled positive.',
  'Neutral posts': 'Share labeled neutral.',
  'Negative posts': 'Share labeled negative.',
  'Campus mood': 'Positive share among labeled posts (%).',
};

export function formatMetricValue(value) {
  if (typeof value === 'number') return value.toLocaleString();
  return String(value ?? '—');
}

export function downloadCsv(report) {
  if (!report) return;
  const lines = [
    ['Report', report.title],
    ['Period', report.rangeLabel],
    ['Generated', new Date(report.generatedAt).toLocaleString()],
    [],
    ['Metric', 'Value'],
    ...(report.metrics || []).map((m) => [m.label, formatMetricValue(m.value)]),
    [],
    ['Detail', 'Value'],
    ...(report.details || []).map((d) => [d.label, formatMetricValue(d.value)]),
  ];
  if (report.breakdown?.length) {
    lines.push([], ['Breakdown', 'Count', 'Sentiment', 'Mood']);
    report.breakdown.forEach((b) =>
      lines.push([
        b.label,
        formatMetricValue(b.value),
        b.sentiment || '',
        b.mood != null ? `${b.mood}%` : '',
      ])
    );
  }
  if (report.items?.length) {
    lines.push([], ['Item', 'Count', 'Sentiment', 'Mood', 'Positive%', 'Neutral%', 'Negative%']);
    report.items.forEach((row) => {
      const name = row.trend || row.forumName || row.id;
      lines.push([
        name,
        row.mentions ?? row.postsCount ?? '',
        row.sentiment || '',
        row.avgSentiment != null ? `${row.avgSentiment}%` : '',
        row.positive ?? '',
        row.neutral ?? '',
        row.negative ?? '',
      ]);
    });
  }
  const csv = lines
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.reportType}-${report.range}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc, y, needed = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

function addSectionTitle(doc, title, y) {
  y = ensureSpace(doc, y, 15);
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  return y + 7;
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `CampusBuzz Admin Report — Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
}

export function downloadPdf(report) {
  if (!report) return;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;
  let y = 18;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CampusBuzz', 14, 14);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Reports & Analytics', 14, 22);

  y = 36;
  doc.setTextColor(...BRAND);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title || 'Report', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Period: ${report.rangeLabel || '—'}`, 14, y);
  y += 5;
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, y);
  y += 5;
  doc.text(`Report type: ${report.reportType || '—'}`, 14, y);
  y += 10;

  y = addSectionTitle(doc, 'Report overview', y);
  doc.setFontSize(10);
  const summary =
    REPORT_SUMMARIES[report.reportType] ||
    'Administrative analytics export for the selected period and report type.';
  y = addWrappedText(doc, summary, 14, y, contentWidth) + 6;

  if (report.rangeNote) {
    y = ensureSpace(doc, y, 20);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    const noteLines = doc.splitTextToSize(report.rangeNote, contentWidth - 8);
    const boxH = noteLines.length * 5 + 8;
    doc.roundedRect(14, y - 4, contentWidth, boxH, 2, 2, 'FD');
    doc.setTextColor(30, 64, 120);
    doc.setFontSize(9);
    doc.text(noteLines, 18, y + 2);
    y += boxH + 6;
  }

  if (report.metrics?.length) {
    y = addSectionTitle(doc, 'Key metrics', y);
    const metricRows = report.metrics.map((m) => [
      m.label,
      formatMetricValue(m.value),
      METRIC_HINTS[m.label] || 'Primary indicator for this report.',
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value', 'Explanation']],
      body: metricRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND, textColor: 255 },
      columnStyles: { 2: { cellWidth: 'auto' } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (report.breakdown?.length) {
    y = ensureSpace(doc, y, 30);
    y = addSectionTitle(doc, 'Breakdown', y);
    const isModeration = report.reportType === 'moderation-actions';
    const head = isModeration
      ? [['Category', 'Report count', 'Notes']]
      : [['Category', 'Count', 'Sentiment / mood']];
    const body = report.breakdown.map((b) => {
      if (isModeration) {
        return [
          b.label,
          formatMetricValue(b.value),
          'Matches Post Moderation filter categories.',
        ];
      }
      const moodPart = b.mood != null ? `Mood ${b.mood}%` : '';
      const sentPart = b.sentiment ? `Sentiment: ${b.sentiment}` : '';
      return [b.label, formatMetricValue(b.value), [sentPart, moodPart].filter(Boolean).join(' · ') || '—'];
    });
    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: BRAND, textColor: 255 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (report.items?.length) {
    y = ensureSpace(doc, y, 30);
    const isTrends = report.reportType === 'trends-analysis';
    y = addSectionTitle(doc, isTrends ? 'Trending topics' : 'Discussion forums', y);
    const head = isTrends
      ? [['Topic / hashtag', 'Mentions', 'Dominant sentiment', 'Mood %', 'Pos %', 'Neu %', 'Neg %']]
      : [['Forum', 'Messages', 'Dominant sentiment', 'Mood %', 'Pos %', 'Neu %', 'Neg %']];
    const body = report.items.map((row) => [
      row.trend || row.forumName || row.id || '—',
      formatMetricValue(row.mentions ?? row.postsCount ?? 0),
      row.sentiment || '—',
      row.avgSentiment != null ? `${row.avgSentiment}%` : '—',
      row.positive != null ? `${row.positive}%` : '—',
      row.neutral != null ? `${row.neutral}%` : '—',
      row.negative != null ? `${row.negative}%` : '—',
    ]);
    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: BRAND, textColor: 255 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (report.details?.length) {
    y = ensureSpace(doc, y, 30);
    y = addSectionTitle(doc, 'Detailed statistics', y);
    autoTable(doc, {
      startY: y,
      head: [['Statistic', 'Value', 'Explanation']],
      body: report.details.map((d) => [
        d.label,
        formatMetricValue(d.value),
        METRIC_HINTS[d.label] || 'Additional detail for this report.',
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: BRAND, textColor: 255 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  y = ensureSpace(doc, y, 25);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const footerNote =
    'Data is sourced from live campus database records and ML sentiment analysis where applicable. ' +
    'Export reflects the same figures shown in the admin Reports & Analytics screen.';
  addWrappedText(doc, footerNote, 14, y, contentWidth);

  addFooter(doc);
  doc.save(`${report.reportType}-${report.range}-${Date.now()}.pdf`);
}
