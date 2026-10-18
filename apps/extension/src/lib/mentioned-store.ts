import { storage } from "wxt/utils/storage"

// Usernames already mentioned, grouped by post key.
const mentionedItem = storage.defineItem<Record<string, string[]>>(
  "local:mentioned",
  { fallback: {} }
)

export async function getMentioned(postKey: string) {
  const all = await mentionedItem.getValue()
  return new Set(all[postKey] ?? [])
}

export async function addMentioned(postKey: string, username: string) {
  const all = await mentionedItem.getValue()
  const list = new Set(all[postKey] ?? [])
  list.add(username)
  await mentionedItem.setValue({ ...all, [postKey]: Array.from(list) })
}

export async function resetPost(postKey: string) {
  const all = await mentionedItem.getValue()
  delete all[postKey]
  await mentionedItem.setValue(all)
}

export async function resetAllMentioned() {
  await mentionedItem.setValue({})
}
