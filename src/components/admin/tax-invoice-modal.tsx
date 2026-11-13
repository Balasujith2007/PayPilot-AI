"use client"

import { useRef } from "react"
import { Printer, Download, X, CheckCircle2, ShieldCheck, Building2 } from "lucide-react"

export interface InvoiceData {
  id: string
  invoiceNumber: string
  orderId: string
  customerName: string
  customerEmail: string
  customerGstin?: string | null
  storeGstin: string
  supplyState: string
  placeOfSupply: string
  isInterState: boolean
  hsnSummary: Array<{
    hsnCode: string
    categoryName?: string
    rate: number
    taxableAmount: number
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
  }>
  subtotal: number // paise
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  discountTotal: number
  couponCode?: string | null
  total: number // paise
  currency: string
  status: string
  digitalSignature: string
  issuedAt: string | Date
  order?: {
    orderNumber: string
    createdAt: string | Date
    paymentMethod?: string
    paymentReference?: string
    shippingAddress?: Record<string, unknown>
    items?: Array<{
      name: string
      variantName?: string
      sku: string
      quantity: number
      price: number
      total: number
    }>
  }
}

function formatInr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function numberToWords(num: number): string {
  const rupees = Math.floor(num / 100)
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

  function inWords(n: number): string {
    if (n === 0) return ""
    if (n < 20) return a[n] + " "
    if (n < 100) return b[Math.floor(n / 10)] + " " + inWords(n % 10)
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred " + inWords(n % 100)
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand " + inWords(n % 1000)
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh " + inWords(n % 100000)
    return inWords(Math.floor(n / 10000000)) + " Crore " + inWords(n % 10000000)
  }

  const result = inWords(rupees).trim()
  return (result ? result : "Zero") + " Rupees Only"
}

export function TaxInvoiceModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceData | null
  onClose: () => void
}) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!invoice) return null

  const handlePrint = () => {
    window.print()
  }

  const items = invoice.order?.items || []
  const shipping = (invoice.order?.shippingAddress || {}) as Record<string, string>
  const totalTax = invoice.cgstTotal + invoice.sgstTotal + invoice.igstTotal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white text-zinc-900 rounded-2xl shadow-2xl overflow-hidden my-4 sm:my-6 border border-zinc-200 max-h-[92vh] flex flex-col">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-zinc-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base truncate">GST Tax Invoice &middot; {invoice.invoiceNumber}</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">Official GST Compliant Electronic Tax Invoice</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Container */}
        <div
          ref={printRef}
          className="p-4 sm:p-8 space-y-4 sm:space-y-6 text-xs sm:text-sm bg-white print:p-0 print:space-y-4 print:text-xs overflow-y-auto"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {/* Header Banner */}
          <div className="border-b-2 border-zinc-900 pb-4 sm:pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 uppercase">PAYPILOT</span>
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 font-semibold bg-zinc-100 border border-zinc-300 rounded text-zinc-700">
                    TAX INVOICE
                  </span>
                </div>
                <p className="font-semibold text-zinc-800 text-xs sm:text-sm">PayPilot Technologies India Private Limited</p>
                <p className="text-[11px] sm:text-xs text-zinc-600">CIN: U72900KA2023PTC178921</p>
                <p className="text-[11px] sm:text-xs text-zinc-600">Level 4, Outer Ring Road, Bellandur, Bengaluru, Karnataka, 560103</p>
                <p className="text-[11px] sm:text-xs text-zinc-700 mt-1 font-mono font-medium">
                  <strong>GSTIN:</strong> {invoice.storeGstin} &middot; <strong>PAN:</strong> AABCU9603R &middot; <strong>State:</strong> Karnataka (Code 29)
                </p>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-200">
                <span className="inline-block text-[10px] sm:text-xs uppercase tracking-wider font-bold px-2.5 py-1 bg-zinc-900 text-white rounded mb-1 sm:mb-2">
                  ORIGINAL FOR RECIPIENT
                </span>
                <p className="text-[11px] sm:text-xs text-zinc-500">Invoice No:</p>
                <p className="text-sm sm:text-base font-bold font-mono text-zinc-900">{invoice.invoiceNumber}</p>
                <p className="text-[11px] sm:text-xs text-zinc-500 mt-1">Invoice Date:</p>
                <p className="text-[11px] sm:text-xs font-semibold text-zinc-800">
                  {new Date(invoice.issuedAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Details Row: Bill To / Ship To / Supply Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-zinc-50 p-3.5 sm:p-4 rounded-xl border border-zinc-200 text-xs">
            <div>
              <p className="font-bold text-zinc-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-600" />
                Bill & Ship To (Customer)
              </p>
              <p className="font-semibold text-zinc-900 text-xs sm:text-sm">{invoice.customerName}</p>
              <p className="text-zinc-600">{invoice.customerEmail}</p>
              {shipping.line1 && <p className="text-zinc-600 mt-1">{shipping.line1}</p>}
              {shipping.city && (
                <p className="text-zinc-600">
                  {shipping.city}, {shipping.state || invoice.placeOfSupply} - {shipping.postalCode || "400001"}
                </p>
              )}
              <p className="text-zinc-700 font-mono mt-1">
                <strong>Customer GSTIN:</strong> {invoice.customerGstin || "URP (Unregistered Person)"}
              </p>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-zinc-200 pt-3 sm:pt-0 sm:pl-6 space-y-1">
              <p className="font-bold text-zinc-900 uppercase tracking-wider mb-1">
                Tax & Supply Details
              </p>
              <p className="text-zinc-700">
                <strong>Order Reference:</strong>{" "}
                <span className="font-mono">{invoice.order?.orderNumber || invoice.orderId}</span>
              </p>
              <p className="text-zinc-700">
                <strong>Place of Supply:</strong> {invoice.placeOfSupply}
              </p>
              <p className="text-zinc-700">
                <strong>Supply Type:</strong>{" "}
                <span className="font-medium text-emerald-700">
                  {invoice.isInterState ? "Inter-State (IGST Applicable)" : "Intra-State (CGST + SGST Applicable)"}
                </span>
              </p>
              <p className="text-zinc-700">
                <strong>Reverse Charge:</strong> No
              </p>
              <p className="text-zinc-700">
                <strong>Payment Status:</strong>{" "}
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Paid Online
                </span>
              </p>
            </div>
          </div>

          {/* Itemized Goods Table */}
          <div className="overflow-x-auto border border-zinc-200 rounded-xl">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead className="bg-zinc-900 text-white font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">HSN/SAC</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Taxable Amt</th>
                  {invoice.isInterState ? (
                    <th className="py-2.5 px-3 text-right">IGST (18%)</th>
                  ) : (
                    <>
                      <th className="py-2.5 px-3 text-right">CGST (9%)</th>
                      <th className="py-2.5 px-3 text-right">SGST (9%)</th>
                    </>
                  )}
                  <th className="py-2.5 px-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-normal">
                {items.length > 0 ? (
                  items.map((item, idx) => {
                    const taxableItemPaise = item.total || item.price * item.quantity
                    const taxRate = 18
                    const igstAmt = invoice.isInterState ? Math.round((taxableItemPaise * taxRate) / 100) : 0
                    const halfTaxAmt = !invoice.isInterState ? Math.round((taxableItemPaise * (taxRate / 2)) / 100) : 0
                    const itemGrandTotal = taxableItemPaise + (invoice.isInterState ? igstAmt : halfTaxAmt * 2)

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 px-3 text-center font-mono text-zinc-500">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-zinc-900">{item.name}</p>
                          <p className="text-zinc-500 text-[11px] font-mono">SKU: {item.sku || "N/A"}</p>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-zinc-600">
                          {invoice.hsnSummary?.[idx]?.hsnCode || "6109"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatInr(taxableItemPaise)}</td>
                        {invoice.isInterState ? (
                          <td className="py-2.5 px-3 text-right font-mono text-zinc-700">{formatInr(igstAmt)}</td>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono text-zinc-700">{formatInr(halfTaxAmt)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-zinc-700">{formatInr(halfTaxAmt)}</td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                          {formatInr(itemGrandTotal)}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="py-3 px-3 text-center font-mono">1</td>
                    <td className="py-3 px-3 font-semibold">Store Order Purchase ({invoice.orderId})</td>
                    <td className="py-3 px-3 text-center font-mono">6109</td>
                    <td className="py-3 px-3 text-center font-mono">1</td>
                    <td className="py-3 px-3 text-right font-mono">{formatInr(invoice.subtotal)}</td>
                    {invoice.isInterState ? (
                      <td className="py-3 px-3 text-right font-mono">{formatInr(invoice.igstTotal)}</td>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-right font-mono">{formatInr(invoice.cgstTotal)}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatInr(invoice.sgstTotal)}</td>
                      </>
                    )}
                    <td className="py-3 px-3 text-right font-mono font-bold">{formatInr(invoice.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* HSN Tax Summary & Totals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 pt-2">
            {/* Left: HSN Summary & Words */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  HSN / SAC Tax Liability Summary
                </p>
                <div className="overflow-x-auto border border-zinc-200 rounded">
                  <table className="w-full text-[11px] min-w-[340px]">
                    <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
                      <tr>
                        <th className="p-1.5 text-left">HSN</th>
                        <th className="p-1.5 text-right">Taxable</th>
                        {invoice.isInterState ? (
                          <th className="p-1.5 text-right">IGST (18%)</th>
                        ) : (
                          <>
                            <th className="p-1.5 text-right">CGST (9%)</th>
                            <th className="p-1.5 text-right">SGST (9%)</th>
                          </>
                        )}
                        <th className="p-1.5 text-right">Tax Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 font-mono">
                      {invoice.hsnSummary && invoice.hsnSummary.length > 0 ? (
                        invoice.hsnSummary.map((h, i) => (
                          <tr key={i}>
                            <td className="p-1.5 font-bold">{h.hsnCode}</td>
                            <td className="p-1.5 text-right">{formatInr(h.taxableAmount)}</td>
                            {invoice.isInterState ? (
                              <td className="p-1.5 text-right">{formatInr(h.igstAmount)}</td>
                            ) : (
                              <>
                                <td className="p-1.5 text-right">{formatInr(h.cgstAmount)}</td>
                                <td className="p-1.5 text-right">{formatInr(h.sgstAmount)}</td>
                              </>
                            )}
                            <td className="p-1.5 text-right font-bold">
                              {formatInr(h.igstAmount || h.cgstAmount + h.sgstAmount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-1.5">6109</td>
                          <td className="p-1.5 text-right">{formatInr(invoice.subtotal)}</td>
                          {invoice.isInterState ? (
                            <td className="p-1.5 text-right">{formatInr(invoice.igstTotal)}</td>
                          ) : (
                            <>
                              <td className="p-1.5 text-right">{formatInr(invoice.cgstTotal)}</td>
                              <td className="p-1.5 text-right">{formatInr(invoice.sgstTotal)}</td>
                            </>
                          )}
                          <td className="p-1.5 text-right font-bold">{formatInr(totalTax)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <p className="text-[11px] text-zinc-500 font-medium">Invoice Amount in Words:</p>
                <p className="text-xs font-semibold text-zinc-900 italic mt-0.5">{numberToWords(invoice.total)}</p>
              </div>
            </div>

            {/* Right: Financial Totals Breakdown */}
            <div className="md:col-span-5 bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Taxable Value (Subtotal):</span>
                <span className="font-mono">{formatInr(invoice.subtotal)}</span>
              </div>

              {invoice.isInterState ? (
                <div className="flex justify-between text-zinc-700">
                  <span>Integrated GST (IGST 18%):</span>
                  <span className="font-mono font-medium">{formatInr(invoice.igstTotal)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-zinc-700">
                    <span>Central GST (CGST 9%):</span>
                    <span className="font-mono font-medium">{formatInr(invoice.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-700">
                    <span>State GST (SGST 9%):</span>
                    <span className="font-mono font-medium">{formatInr(invoice.sgstTotal)}</span>
                  </div>
                </>
              )}

              {invoice.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Voucher Discount ({invoice.couponCode || "COUPON"}):</span>
                  <span className="font-mono">-{formatInr(invoice.discountTotal)}</span>
                </div>
              )}

              <div className="border-t border-zinc-300 pt-2 flex justify-between items-baseline">
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Total Invoice Amount:</span>
                <span className="text-base sm:text-lg font-black font-mono text-zinc-950">{formatInr(invoice.total)}</span>
              </div>
              <p className="text-[10px] text-zinc-500 text-right">Includes all taxes and cess</p>
            </div>
          </div>

          {/* Digital Signature & Watermark Footer */}
          <div className="pt-4 sm:pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="text-[10px] text-zinc-500 max-w-sm space-y-0.5">
              <p className="font-semibold text-zinc-700">Declaration & Terms:</p>
              <p>1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
              <p>2. Computer generated invoice; requires no physical signature under Rule 46 of the CGST Rules, 2017.</p>
            </div>

            {/* Official Digital Signature Watermark Seal */}
            <div className="relative border-2 border-emerald-600/40 bg-emerald-50/50 rounded-xl p-3 text-center w-full sm:w-auto sm:min-w-60 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-[11px] mb-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                DIGITALLY SIGNED & VERIFIED
              </div>
              <p className="text-[10px] font-semibold text-zinc-800">PayPilot Technologies India Pvt Ltd</p>
              <p className="text-[9px] text-zinc-500 font-mono mt-0.5">
                Auth: System-Generated PKI &middot; {new Date(invoice.issuedAt).toISOString().slice(0, 10)}
              </p>
              <div className="mt-1 pt-1 border-t border-emerald-600/20 text-[9px] text-emerald-700 font-medium">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

