export interface SalesTaxPageData<T = any> {
  pageNumber: number;
  totalSalesTaxPages: number;
  items: T[];
  startIndex: number;
  isLastPage: boolean;
}

/**
 * Paginates Sales Tax Invoice items.
 * 
 * Rules:
 * 1. If 9 or fewer items, they all comfortably fit on 1 page with the Totals Box & Signatory.
 * 2. If items exceed 1 page (> 9 items), we maximize the space on the first page (up to 14 items)
 *    without the Totals Box, overflowing only the remaining items onto subsequent page(s).
 * 3. The final Sales Tax page always contains the Totals Box and Authorized Signatory.
 * 4. The BILL INVOICE remains a strictly separate, final summary page.
 */
export function paginateSalesTaxItems<T = any>(items: T[]): SalesTaxPageData<T>[] {
  const totalItems = items.length;

  // Single page capacity (with Totals Box and Signatory)
  const MAX_SINGLE_PAGE = 9;
  // Non-final page capacity (without Totals Box) - uses maximum available vertical space
  const MAX_NON_LAST_PAGE = 14;
  // Final page capacity (with Totals Box)
  const MAX_LAST_PAGE = 9;

  // 1. All items fit on a single page with Totals Box
  if (totalItems <= MAX_SINGLE_PAGE) {
    return [
      {
        pageNumber: 1,
        totalSalesTaxPages: 1,
        items,
        startIndex: 0,
        isLastPage: true,
      }
    ];
  }

  // 2. Items exceed single page capacity: maximize space on first page!
  const pages: SalesTaxPageData<T>[] = [];
  let remaining = [...items];
  let currentStartIndex = 0;
  let pageNum = 1;

  while (remaining.length > 0) {
    // If remaining items can all fit on the final page with Totals Box
    if (pages.length > 0 && remaining.length <= MAX_LAST_PAGE) {
      pages.push({
        pageNumber: pageNum,
        totalSalesTaxPages: 0,
        items: remaining,
        startIndex: currentStartIndex,
        isLastPage: true,
      });
      break;
    }

    // Determine how many items this page can hold:
    // We want to fill the page to its MAXIMUM space (up to MAX_NON_LAST_PAGE).
    // However, if all remaining items are <= MAX_NON_LAST_PAGE, we must ensure at least
    // 1 item is left over for the final page (which displays the Totals Box).
    let countToTake: number;

    if (remaining.length <= MAX_NON_LAST_PAGE) {
      // Leave at least 1 item for the next (final) page
      countToTake = remaining.length - 1;
    } else {
      // Take the maximum possible rows that fit on a page without Totals Box
      countToTake = MAX_NON_LAST_PAGE;
    }

    pages.push({
      pageNumber: pageNum,
      totalSalesTaxPages: 0,
      items: remaining.slice(0, countToTake),
      startIndex: currentStartIndex,
      isLastPage: false,
    });

    currentStartIndex += countToTake;
    pageNum++;
    remaining = remaining.slice(countToTake);

    // If the remaining items now fit on the last page with Totals Box
    if (remaining.length <= MAX_LAST_PAGE) {
      pages.push({
        pageNumber: pageNum,
        totalSalesTaxPages: 0,
        items: remaining,
        startIndex: currentStartIndex,
        isLastPage: true,
      });
      break;
    }
  }

  const totalPages = pages.length;
  pages.forEach(p => { p.totalSalesTaxPages = totalPages; });
  return pages;
}
