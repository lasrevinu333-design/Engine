// Exact source transformation only. The staff shared Events destination keeps
// its original feed; manager modules/styles/panel never enter the staff bundle.
export function removeManagerHeldReviewSurface(html) {
  const patterns = [
    /    <!-- manager-held-review:start -->[\s\S]*?    <!-- manager-held-review:end -->\n/g,
    /  <link rel="stylesheet" href="\.\/manager-held-review\.css" data-manager-held-review-asset>\n/g,
    /  <script type="module" src="\.\/manager-held-review-page\.mjs" data-manager-held-review-asset><\/script>\n/g,
  ];
  for (const pattern of patterns) {
    if ([...html.matchAll(pattern)].length !== 1) throw new Error('held_review_employee_edition_boundary_mismatch');
    html = html.replace(pattern, '');
  }
  if (/manager-held-review/.test(html)) throw new Error('held_review_employee_edition_surface_remaining');
  return html;
}
