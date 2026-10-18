import type { Contact } from "./types"

function escapeCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function toCsv(contacts: Contact[]): string {
  const lines = [
    "name,phone",
    ...contacts.map((c) => `${escapeCell(c.name)},${escapeCell(c.phone)}`),
  ]
  // BOM so Excel reads UTF-8 names correctly.
  return "﻿" + lines.join("\r\n")
}

export function downloadCsv(contacts: Contact[]) {
  const blob = new Blob([toCsv(contacts)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `whatsapp-list-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
