import { useCallback } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useSentinel } from '../context/SentinelContext.jsx';
import { getSRSTier } from '../utils/srsFormula.js';
import { getRecommendedAction } from '../components/right/RecommendedAction.jsx';
import dayjs from 'dayjs';

export function useReportExport() {
  const { state } = useSentinel();

  const exportPDF = useCallback((options = {}) => {
    const {
      includeCritical = true,
      includeHighRisk = true,
      includePIT = true,
      reviewDetail = 'illness',
      preparedBy = '',
      department = 'Montgomery County Health Department'
    } = options;

    const doc = new jsPDF('p', 'mm', 'letter');
    const pw = 216; // page width mm

    // Filter establishments based on modal selections
    const flagged = state.establishments
      .filter(e => {
        if (includeCritical && e.srs >= 70) return true;
        if (includeHighRisk && e.srs >= 50 && e.srs < 70) return true;
        if (includePIT && e.pit) return true;
        return false;
      })
      .sort((a, b) => b.srs - a.srs);

    const pitCount = state.establishments.filter(e => e.pit).length;
    const criticalCount = state.establishments.filter(e => e.srs >= 70).length;
    const highRiskCount = state.establishments.filter(e => e.srs >= 50 && e.srs < 70).length;

    // ══════════════════════════════════════════════════════════════
    // Cover Page
    // ══════════════════════════════════════════════════════════════
    doc.setFillColor(20, 25, 35);
    doc.rect(0, 0, pw, 280, 'F');

    // Purple accent bar
    doc.setFillColor(142, 68, 173);
    doc.rect(0, 60, pw, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(42);
    doc.setFont('helvetica', 'bold');
    doc.text('SENTINEL', pw / 2, 85, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('Food-Borne Illness Risk Intelligence Platform', pw / 2, 96, { align: 'center' });

    doc.setFillColor(142, 68, 173);
    doc.roundedRect(pw / 2 - 55, 103, 110, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PRIORITY INSPECTION REPORT', pw / 2, 110, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${dayjs().format('MMMM D, YYYY [at] h:mm A')}`, pw / 2, 128, { align: 'center' });
    doc.text(department, pw / 2, 136, { align: 'center' });
    if (preparedBy) {
      doc.text(`Prepared by: ${preparedBy}`, pw / 2, 144, { align: 'center' });
    }

    // Stats table on cover
    doc.autoTable({
      startY: 158,
      margin: { left: 45, right: 45 },
      head: [['Metric', 'Count']],
      body: [
        ['Total Establishments Monitored', String(state.establishments.length)],
        ['[PIT] Priority Inspection Triggers', String(pitCount)],
        ['[CRITICAL] SRS >= 70', String(criticalCount)],
        ['[HIGH RISK] SRS 50-69', String(highRiskCount)],
        ['Included in This Report', String(flagged.length)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [142, 68, 173], textColor: 255, fontSize: 10, font: 'helvetica' },
      bodyStyles: { fontSize: 10, textColor: [220, 220, 230], font: 'helvetica' },
      alternateRowStyles: { fillColor: [30, 35, 50] },
      styles: { fillColor: [25, 30, 42], cellPadding: 5 }
    });

    // ══════════════════════════════════════════════════════════════
    // Executive Summary
    // ══════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, 280, 'F');

    // Header bar
    doc.setFillColor(44, 62, 80);
    doc.rect(0, 0, pw, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', 15, 10);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`This report covers ${flagged.length} flagged food establishment${flagged.length !== 1 ? 's' : ''} in ${department.replace('Health Department', '').trim()}.`, 15, 24);
    doc.text(`Data source: Montgomery Open Data Portal + crowd-sourced review intelligence.`, 15, 30);

    const summaryData = flagged.map(e => {
      const tier = getSRSTier(e.srs);
      const reviews = state.reviews[e.id] || [];
      const action = getRecommendedAction(e, reviews);
      return [
        e.name.slice(0, 28),
        String(e.score ?? 'N/A'),
        e.srs.toFixed(1),
        tier.label,
        e.pit ? 'YES' : '',
        action.short.slice(0, 35)
      ];
    });

    doc.autoTable({
      startY: 36,
      head: [['Establishment', 'Score', 'SRS', 'Tier', 'PIT', 'Recommended Action']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80], fontSize: 8, font: 'helvetica' },
      bodyStyles: { fontSize: 7, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 22 },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 50 }
      },
      margin: { left: 10, right: 10 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4 && data.cell.raw === 'YES') {
          data.cell.styles.textColor = [142, 68, 173];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // ══════════════════════════════════════════════════════════════
    // Per-Establishment Detail Pages
    // ══════════════════════════════════════════════════════════════
    flagged.forEach(est => {
      doc.addPage();

      // Header bar
      doc.setFillColor(44, 62, 80);
      doc.rect(0, 0, pw, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(est.name.slice(0, 60), 15, 10);

      let y = 22;
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Address: ${est.address}`, 15, y); y += 5;
      doc.text(`Last Inspection: ${est.date || 'Unknown'}   |   Official Score: ${est.score ?? 'N/A'}`, 15, y); y += 8;

      // SRS Breakdown Table
      doc.autoTable({
        startY: y,
        head: [['Component', 'Value', 'Weight', 'Contribution']],
        body: [
          ['Inspection Risk (IRS)', est.irs.toFixed(1), '40%', (est.irs * 0.4).toFixed(1)],
          ['Review Risk (RRS)', est.rrs.toFixed(1), '45%', (est.rrs * 0.45).toFixed(1)],
          ['Recency Risk (RecRS)', est.recrs.toFixed(1), '15%', (est.recrs * 0.15).toFixed(1)],
          ['SENTINEL RISK SCORE', est.srs.toFixed(1), '100%', est.srs.toFixed(1)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [52, 73, 94], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 15, right: 15 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      y = doc.lastAutoTable.finalY + 6;

      // PIT Banner
      if (est.pit) {
        doc.setFillColor(142, 68, 173);
        doc.roundedRect(15, y, pw - 30, 11, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('[PIT] PRIORITY INSPECTION TRIGGER - Score >= 85 with illness reviews detected', pw / 2, y + 7, { align: 'center' });
        y += 16;
      }

      // Recommended Action box
      const reviews = state.reviews[est.id] || [];
      const action = getRecommendedAction(est, reviews);
      const tier = getSRSTier(est.srs);
      const rgb = hexToRgb(tier.color);

      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.roundedRect(15, y, pw - 30, 20, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Recommended: ${action.short}`, 20, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const detailLines = doc.splitTextToSize(action.detail, pw - 40);
      doc.text(detailLines.slice(0, 3), 20, y + 12);
      y += 26;

      // Reviews section
      if (reviewDetail === 'summary') {
        // Summary counts only
        const illnessCount = reviews.filter(r => r.illnessSignals?.length > 0).length;
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Review Summary', 15, y); y += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`Total reviews scraped: ${reviews.length}`, 15, y); y += 4;
        doc.text(`Illness-flagged reviews: ${illnessCount}`, 15, y); y += 4;
        if (reviews.length === 0) {
          doc.setTextColor(180, 120, 40);
          doc.text('Reviews not yet scraped.', 15, y);
        }
      } else {
        // Show actual reviews
        let displayReviews;
        if (reviewDetail === 'illness') {
          displayReviews = reviews.filter(r => r.illnessSignals?.length > 0);
        } else {
          displayReviews = reviews;
        }

        const label = reviewDetail === 'illness' ? 'Flagged Reviews (Illness Signals)' : 'All Scraped Reviews';
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label} (${displayReviews.length})`, 15, y); y += 6;

        if (reviews.length === 0) {
          doc.setTextColor(180, 120, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.text('Reviews not yet scraped.', 15, y);
        } else if (displayReviews.length === 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text('No illness signals detected in scraped reviews.', 15, y);
        } else {
          displayReviews.slice(0, 8).forEach(rev => {
            if (y > 245) return;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            const header = `${rev.author || 'Anonymous'}  |  ${rev.date || 'No date'}  |  ${rev.rating ? `(${rev.rating}/5 stars)` : ''}  |  ${rev.source || ''}`;
            doc.text(header, 15, y); y += 3.5;

            doc.setFont('helvetica', 'normal');
            const txt = doc.splitTextToSize(rev.text || '', pw - 35);
            doc.text(txt.slice(0, 4), 15, y);
            y += txt.slice(0, 4).length * 3.2 + 1;

            if (rev.illnessSignals?.length > 0) {
              doc.setTextColor(192, 57, 43);
              doc.setFontSize(7);
              const kws = rev.illnessSignals.map(s => `${s.keyword} [${s.tier}]`).join(', ');
              doc.text(`Signals: ${kws}`, 15, y);
              y += 4;
            }
            doc.setTextColor(40, 40, 40);
            y += 2;
          });
        }
      }
    });

    // ══════════════════════════════════════════════════════════════
    // Methodology & Disclaimer
    // ══════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFillColor(44, 62, 80);
    doc.rect(0, 0, pw, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('METHODOLOGY & DISCLAIMER', 15, 10);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const meth = [
      'SENTINEL RISK SCORE (SRS)',
      'SRS = (0.40 x IRS) + (0.45 x RRS) + (0.15 x RecRS)',
      '',
      'IRS (Inspection Risk Score) = 100 - Official Score. Weight: 40%.',
      'RRS (Review Risk Score) = Weighted illness keyword signal from scraped reviews. Weight: 45%.',
      'RecRS (Recency Risk Score) = min(100, months_since_inspection x 4). Weight: 15%.',
      '',
      'PRIORITY INSPECTION TRIGGER (PIT)',
      'Fires when ALL conditions are met: Official Score >= 85, illness reviews exist, SRS < 50.',
      '',
      'ILLNESS KEYWORD TIERS',
      'T1 (Severe, weight 3.0): food poisoning, salmonella, e.coli, norovirus, hospitalized, ER visit',
      'T2 (Moderate, weight 2.0): vomiting, diarrhea, stomach cramps, nausea, sick after eating, got sick',
      'T3 (Low, weight 1.0): stomach ache, felt unwell, not fresh, undercooked, dirty kitchen, raw meat',
      '',
      'DATA SOURCES',
      'Official scores: Montgomery Open Data Portal (ArcGIS FeatureServer)',
      'Review data: TripAdvisor (primary), Yelp, Google (fallback) via Bright Data API',
      '',
      'DISCLAIMER',
      'Sentinel is a risk-intelligence support tool. All SRS scores, PIT flags, and Recommended Actions',
      'are algorithmic outputs intended to assist -- not replace -- professional judgment by trained food',
      'safety inspectors. Sentinel recommendations do not constitute formal regulatory orders. No enforcement',
      'action should be taken solely on the basis of a Sentinel score without independent verification.',
      '',
      'Review data is sourced from third-party platforms and is subject to accuracy, completeness, and',
      'timeliness limitations of those platforms. Sentinel does not verify individual review authenticity.',
      '',
      `Report generated by Sentinel v1.0 on ${dayjs().format('MMMM D, YYYY [at] h:mm A')}.`,
      department ? `Department: ${department}` : '',
      preparedBy ? `Prepared by: ${preparedBy}` : ''
    ].filter(Boolean);

    doc.text(meth, 15, 24);

    // Save
    const filename = `Sentinel_Priority_Report_${dayjs().format('YYYY-MM-DD_HHmm')}.pdf`;
    doc.save(filename);
  }, [state]);

  return { exportPDF };
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}
