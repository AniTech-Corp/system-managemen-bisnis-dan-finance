/**
 * Helper hierarki bagan akun (parent–child).
 *
 * Fungsi di sini murni (tanpa Prisma / React) supaya gampang diuji. Dipakai oleh
 * UI Bagan Akun untuk menampilkan pohon dan oleh API untuk mencegah siklus
 * (akun A menjadi induk B, lalu B menjadi induk A).
 */

export interface AccountTreeInput {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
}

export interface AccountTreeNode<T extends AccountTreeInput> {
  account: T;
  children: AccountTreeNode<T>[];
}

export interface FlatAccountRow<T extends AccountTreeInput> {
  account: T;
  depth: number;
  hasChildren: boolean;
}

/** Urutkan berdasarkan kode akun; angka dibandingkan sebagai angka (6-9000 > 6-1400). */
function compareCode(a: AccountTreeInput, b: AccountTreeInput): number {
  return a.code.localeCompare(b.code, 'id', { numeric: true });
}

/**
 * Susun daftar akun datar menjadi pohon.
 *
 * Akun yang induknya tidak ada (mis. induk dihapus/nonaktif dan tidak ikut
 * dimuat) atau berada dalam siklus tetap ditampilkan sebagai akar, supaya tidak
 * ada akun yang "hilang" dari layar.
 */
export function buildAccountTree<T extends AccountTreeInput>(accounts: readonly T[]): AccountTreeNode<T>[] {
  const nodes = new Map<string, AccountTreeNode<T>>();
  for (const account of accounts) nodes.set(account.id, { account, children: [] });

  const roots: AccountTreeNode<T>[] = [];
  for (const account of accounts) {
    const node = nodes.get(account.id)!;
    const parent = account.parentId ? nodes.get(account.parentId) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Node yang tidak terjangkau dari akar berarti berada dalam siklus. Angkat
  // menjadi akar tanpa anak agar render tetap berhenti.
  const reachable = new Set<string>();
  const mark = (node: AccountTreeNode<T>) => {
    if (reachable.has(node.account.id)) return;
    reachable.add(node.account.id);
    node.children.forEach(mark);
  };
  roots.forEach(mark);

  const orphans = accounts
    .filter((a) => !reachable.has(a.id))
    .map((a) => nodes.get(a.id)!);
  for (const orphan of orphans) {
    orphan.children = [];
    roots.push(orphan);
  }

  const sortTree = (list: AccountTreeNode<T>[]) => {
    list.sort((a, b) => compareCode(a.account, b.account));
    list.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  return roots;
}

/**
 * Ratakan pohon untuk dirender sebagai tabel. `isExpanded` menentukan apakah
 * anak sebuah akun ikut ditampilkan.
 */
export function flattenAccountTree<T extends AccountTreeInput>(
  roots: readonly AccountTreeNode<T>[],
  isExpanded: (id: string) => boolean = () => true
): FlatAccountRow<T>[] {
  const rows: FlatAccountRow<T>[] = [];
  const visit = (node: AccountTreeNode<T>, depth: number) => {
    rows.push({ account: node.account, depth, hasChildren: node.children.length > 0 });
    if (node.children.length > 0 && isExpanded(node.account.id)) {
      node.children.forEach((child) => visit(child, depth + 1));
    }
  };
  roots.forEach((root) => visit(root, 0));
  return rows;
}

/** Semua id akun di atas `id` (induk, kakek, …), urut dari yang terdekat. */
export function ancestorIds<T extends AccountTreeInput>(accounts: readonly T[], id: string): string[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let cursor = byId.get(id)?.parentId ?? null;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    out.push(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return out;
}

/** Semua id turunan (anak, cucu, …) dari sebuah akun. */
export function descendantIds<T extends AccountTreeInput>(accounts: readonly T[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const account of accounts) {
    if (!account.parentId) continue;
    const list = childrenOf.get(account.parentId) ?? [];
    list.push(account.id);
    childrenOf.set(account.parentId, list);
  }

  const out = new Set<string>();
  const queue = [...(childrenOf.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (out.has(next)) continue;
    out.add(next);
    queue.push(...(childrenOf.get(next) ?? []));
  }
  return out;
}

/**
 * Apakah memindahkan `id` ke bawah `parentId` akan membuat siklus?
 * Termasuk kasus `parentId === id`.
 */
export function wouldCreateCycle<T extends AccountTreeInput>(
  accounts: readonly T[],
  id: string,
  parentId: string | null | undefined
): boolean {
  if (!parentId) return false;
  if (parentId === id) return true;

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const seen = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === id) return true;
    if (seen.has(cursor)) return false; // data lama sudah bersiklus; jangan menggantung
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}
