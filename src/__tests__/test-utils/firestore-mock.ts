type DocData = { [key: string]: any };

let store: Record<string, Record<string, DocData>> = {};

export function resetMockFirestore() {
  store = {};
}

export function setCollectionDocs(collectionName: string, docs: { id?: string; data: DocData }[]) {
  store[collectionName] = {};
  docs.forEach((d, i) => {
    const id = d.id || `doc${i + 1}`;
    store[collectionName][id] = d.data;
  });
}

export function collection(_db: any, name: string) {
  return { __collection: name };
}

export function doc(_db: any, collectionName: string, id?: string) {
  // support being called as doc(db, 'buses', name) or doc(db, collection, id)
  if (typeof collectionName === 'object' && collectionName.__collection) {
    return { __collection: collectionName.__collection, id };
  }
  return { __collection: collectionName, id };
}

export function where(field: string, op: string, value: any) {
  return { __where: { field, op, value } };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return { __query: true, collection: collectionRef.__collection || collectionRef, constraints };
}

export async function getDocs(refOrQuery: any) {
  let collectionName = '';
  let constraints: any[] = [];

  if (refOrQuery && refOrQuery.__query) {
    collectionName = refOrQuery.collection;
    constraints = refOrQuery.constraints || [];
  } else if (refOrQuery && refOrQuery.__collection) {
    collectionName = refOrQuery.__collection;
  } else if (typeof refOrQuery === 'string') {
    collectionName = refOrQuery;
  }

  const col = store[collectionName] || {};
  const docs = Object.keys(col).map(id => ({ id, data: () => col[id] }));

  if (constraints && constraints.length) {
    const whereC = constraints.find((c: any) => c && c.__where);
    if (whereC) {
      const { field, op, value } = whereC.__where;
      return { docs: docs.filter(d => {
        const dv = (d.data() || {})[field];
        if (op === '==') return dv === value;
        return false;
      }), size: docs.length, empty: docs.length === 0 };
    }
  }

  return { docs, size: docs.length, empty: docs.length === 0 };
}

export async function getDoc(docRef: any) {
  const collectionName = docRef.__collection;
  const id = docRef.id;
  const col = store[collectionName] || {};
  if (!id) return { exists: () => false } as any;
  const data = col[id];
  if (!data) return { exists: () => false } as any;
  return { exists: () => true, data: () => data } as any;
}

export function setDoc(docRef: any, data: DocData, _opts?: any) {
  const collectionName = docRef.__collection || docRef.collection;
  const id = docRef.id || `doc${Object.keys(store[collectionName] || {}).length + 1}`;
  store[collectionName] = store[collectionName] || {};
  store[collectionName][id] = data;
  return Promise.resolve();
}

export function updateDoc(docRef: any, updates: DocData) {
  const collectionName = docRef.__collection || docRef.collection;
  const id = docRef.id;
  store[collectionName] = store[collectionName] || {};
  const current = store[collectionName][id] || {};
  // handle increment operation
  const newData = { ...current };
  for (const k of Object.keys(updates)) {
    const v = updates[k];
    if (v && v.__op === 'increment') {
      newData[k] = (newData[k] || 0) + v.amount;
    } else {
      newData[k] = v;
    }
  }
  store[collectionName][id] = newData;
  return Promise.resolve();
}

export function writeBatch(_db: any) {
  const ops: Array<() => Promise<void>> = [];
  return {
    set(docRef: any, data: any, _opts?: any) { ops.push(() => setDoc(docRef, data, _opts)); },
    update(docRef: any, updates: any) { ops.push(() => updateDoc(docRef, updates)); },
    delete(docRef: any) { ops.push(async () => { const col = docRef.__collection; const id = docRef.id; if (store[col]) delete store[col][id]; }); },
    commit: async () => { for (const fn of ops) await fn(); }
  };
}

export function increment(amount: number) {
  return { __op: 'increment', amount };
}

export function serverTimestamp() {
  return Date.now();
}

export async function runTransaction(_db: any, updateFn: any) {
  const tx = {
    get: async (ref: any) => await getDoc(ref),
    update: async (ref: any, updates: any) => await updateDoc(ref, updates)
  };
  return updateFn(tx);
}

export async function addDoc(collectionRef: any, data: any) {
  const collectionName = collectionRef.__collection || collectionRef;
  const id = `doc${(Object.keys(store[collectionName] || {}).length + 1)}`;
  store[collectionName] = store[collectionName] || {};
  store[collectionName][id] = data;
  return { id };
}

export async function deleteDoc(docRef: any) {
  const col = docRef.__collection;
  const id = docRef.id;
  if (store[col]) delete store[col][id];
  return Promise.resolve();
}

export const limit = (n: number) => ({ __limit: n });

// exports required so vitest's mock factory can return this module
export default {
  resetMockFirestore,
  setCollectionDocs,
  collection,
  doc,
  where,
  query,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp,
  runTransaction,
  addDoc,
  deleteDoc,
  limit
};
